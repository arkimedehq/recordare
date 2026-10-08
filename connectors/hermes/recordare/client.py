# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese

"""HTTP access to Recordare: REST (ingest, pre-turn context) and a minimal MCP client (Streamable HTTP, JSON-RPC).

Every request carries the credential (`Authorization: Bearer rp_…|rk_…`), the Recordare user with a client key
(`X-Recordare-User`) and the conversation (`X-Recordare-Conversation`) — the headers Recordare resolves the owner and
the viewers from (docs/API.md §1). Errors are raised to the caller (the provider logs and swallows them).
"""

from __future__ import annotations

import itertools
import json
import threading
from typing import Any, Dict, Optional, Tuple

import requests

MCP_PROTOCOL_VERSION = "2025-06-18"
USER_AGENT = "recordare-hermes/0.1"


class RecordareError(RuntimeError):
    """A non-2xx answer. `retry_after` is the server's Retry-After in seconds, when it sent one."""

    def __init__(self, status: int, message: str, retry_after: Optional[float] = None):
        super().__init__(f"HTTP {status}: {message}")
        self.status, self.retry_after = status, retry_after


def retry_after_seconds(resp: requests.Response) -> Optional[float]:
    """Retry-After as seconds (delta-seconds or an HTTP date), None when absent or unreadable."""
    value = resp.headers.get("Retry-After")
    if not value:
        return None
    try:
        return max(0.0, float(value))
    except ValueError:
        pass
    try:
        from email.utils import parsedate_to_datetime
        from datetime import datetime, timezone
        return max(0.0, (parsedate_to_datetime(value) - datetime.now(timezone.utc)).total_seconds())
    except Exception:
        return None


def _problem(resp: requests.Response) -> RecordareError:
    """RFC 9457 problem details → RecordareError (only the code / title: never echo request content)."""
    try:
        body = resp.json()
        detail = str(body.get("code") or body.get("title") or "")
    except Exception:
        detail = ""
    return RecordareError(resp.status_code, detail or resp.reason or "error", retry_after_seconds(resp))


class RecordareClient:
    """One credential against one Recordare installation. Thread-safe; one instance per provider."""

    def __init__(self, url: str, api_key: str):
        self.url = url.rstrip("/")
        self._key = api_key
        self._http = requests.Session()
        self._mcp_lock = threading.Lock()
        self._mcp_sessions: Dict[Optional[str], str] = {}  # Recordare user (None = token owner) → MCP session id
        self._ids = itertools.count(1)

    @property
    def personal(self) -> bool:
        """A personal token acts as its own person: no user header (docs/API.md §1, credentials)."""
        return self._key.startswith("rp_")

    def headers(self, user: Optional[str], conversation: Optional[str]) -> Dict[str, str]:
        h = {"Authorization": f"Bearer {self._key}", "User-Agent": USER_AGENT}
        if user and not self.personal:
            h["X-Recordare-User"] = user
        if conversation:
            h["X-Recordare-Conversation"] = conversation
        return h

    # -- REST ---------------------------------------------------------------------------------------------------------

    def post(self, path: str, body: Dict[str, Any], *, user: Optional[str], conversation: Optional[str],
             timeout: Tuple[float, float]) -> Any:
        resp = self._http.post(f"{self.url}{path}", json=body, headers=self.headers(user, conversation), timeout=timeout)
        if not resp.ok:
            raise _problem(resp)
        return None if resp.status_code == 204 or not resp.content else resp.json()

    def ingest(self, body: Dict[str, Any], *, user: Optional[str], conversation: str, timeout: Tuple[float, float]) -> Any:
        return self.post("/api/v1/ingest/messages", body, user=user, conversation=conversation, timeout=timeout)

    def context(self, query: str, *, user: Optional[str], conversation: Optional[str], timeout: float) -> Optional[str]:
        """The pre-turn memory block (`POST api/v1/context`), None when nothing is relevant."""
        data = self.post("/api/v1/context", {"query": query}, user=user, conversation=conversation,
                         timeout=(min(1.5, timeout), timeout))
        return (data or {}).get("block") or None

    # -- MCP (Streamable HTTP) ----------------------------------------------------------------------------------------

    def _rpc(self, payload: Dict[str, Any], *, user: Optional[str], conversation: Optional[str],
             session: Optional[str], timeout: float) -> Tuple[Optional[Dict[str, Any]], requests.Response]:
        h = self.headers(user, conversation)
        h.update({"Accept": "application/json, text/event-stream", "Content-Type": "application/json"})
        if session:
            h.update({"Mcp-Session-Id": session, "Mcp-Protocol-Version": MCP_PROTOCOL_VERSION})
        resp = self._http.post(f"{self.url}/mcp", data=json.dumps(payload), headers=h, timeout=(3.0, timeout))
        if not resp.ok:
            raise _problem(resp)
        if "id" not in payload or resp.status_code == 202:
            return None, resp
        return _jsonrpc_response(resp, payload["id"]), resp

    def _open_session(self, user: Optional[str], conversation: Optional[str], timeout: float) -> str:
        init = {"jsonrpc": "2.0", "id": next(self._ids), "method": "initialize", "params": {
            "protocolVersion": MCP_PROTOCOL_VERSION, "capabilities": {},
            "clientInfo": {"name": "recordare-hermes", "version": "0.1.0"}}}
        msg, resp = self._rpc(init, user=user, conversation=conversation, session=None, timeout=timeout)
        session = resp.headers.get("Mcp-Session-Id")
        if not session or not msg or "error" in msg:
            raise RecordareError(resp.status_code, "MCP initialize failed")
        self._rpc({"jsonrpc": "2.0", "method": "notifications/initialized"},
                  user=user, conversation=conversation, session=session, timeout=timeout)
        return session

    def call_tool(self, name: str, arguments: Dict[str, Any], *, user: Optional[str], conversation: Optional[str],
                  timeout: float = 20.0) -> str:
        """Call one Recordare MCP tool; returns its text content (a JSON document). One MCP session per Recordare user
        (Recordare fixes the owner at `initialize`); a session the server no longer knows (404, e.g. after a restart)
        is reopened once."""
        for attempt in (0, 1):
            with self._mcp_lock:
                session = self._mcp_sessions.get(user)
                if session is None:
                    session = self._open_session(user, conversation, timeout)
                    self._mcp_sessions[user] = session
            call = {"jsonrpc": "2.0", "id": next(self._ids), "method": "tools/call",
                    "params": {"name": name, "arguments": arguments}}
            try:
                msg, _ = self._rpc(call, user=user, conversation=conversation, session=session, timeout=timeout)
            except RecordareError as err:
                if err.status in (400, 404) and attempt == 0:
                    with self._mcp_lock:
                        self._mcp_sessions.pop(user, None)
                    continue
                raise
            if msg is None:
                raise RecordareError(502, "no MCP response")
            if "error" in msg:
                raise RecordareError(400, str((msg["error"] or {}).get("message") or "MCP error"))
            result = msg.get("result") or {}
            text = "\n".join(c.get("text", "") for c in result.get("content") or [] if c.get("type") == "text")
            if result.get("isError"):
                return json.dumps({"error": text or "tool error"})
            return text or json.dumps(result.get("structuredContent") or {})
        raise RecordareError(404, "MCP session lost")


def _jsonrpc_response(resp: requests.Response, request_id: Any) -> Optional[Dict[str, Any]]:
    """The JSON-RPC response with `request_id`, from a JSON body or a text/event-stream body."""
    ctype = resp.headers.get("Content-Type", "")
    if "text/event-stream" not in ctype:
        body = resp.json()
        items = body if isinstance(body, list) else [body]
        return next((m for m in items if isinstance(m, dict) and m.get("id") == request_id), None)
    data: list = []
    for line in resp.text.splitlines() + [""]:
        if line.startswith("data:"):
            data.append(line[5:].lstrip())
        elif not line.strip() and data:
            try:
                msg = json.loads("\n".join(data))
            except ValueError:
                msg = None
            data = []
            if isinstance(msg, dict) and msg.get("id") == request_id:
                return msg
    return None
