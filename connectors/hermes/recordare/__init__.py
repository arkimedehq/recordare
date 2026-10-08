# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese

"""Recordare memory provider for Hermes Agent — the full client level (capture + recall).

- Capture: the person's message is queued when the turn starts and stored before the agent runs (so what the agent
  stores with `recordare_remember` binds to the person's own words): with recall on, `prefetch` stores it and gets the
  memory context in one call (`POST api/v1/context` with `ingest`); otherwise, or when that cannot run, it is delivered
  right away (and always before a memory tool call). The answer follows after the turn (`sync_turn`, background); both
  go through a durable SQLite outbox that retries. A session end (`/new`, `/reset`, exit) queues
  `POST …/conversations/{id}/end` after the conversation's pending messages: Recordare extracts now instead of after its
  idle delay.
- Recall: `prefetch` returns Recordare's pre-turn memory context (no LLM call; Hermes wraps it in its own
  `<memory-context>` fence), and the `recordare_*` tools call Recordare's MCP tools bound in code to the person and the
  conversation.
- Never raises into Hermes: every failure is logged (without content) and swallowed.

Config (env in `$HERMES_HOME/.env`, or `memory.recordare.*` in config.yaml for the non-secret ones): see README.md.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from agent.memory_provider import MemoryProvider, spawn_context_thread

from .client import RecordareClient, RecordareError
from .outbox import Outbox, get_outbox

logger = logging.getLogger(__name__)

MAX_CONTENT_BYTES = 60 * 1024  # Recordare accepts 64 KiB per message
TURN_START_DEADLINE_S = 1.5    # the person's message must be stored before a read or a memory tool call
DEFAULT_TIMEOUT_S = 3.0        # context request (Hermes bounds prefetch at 8 s)


def _p(description: str, type_: str = "string", **extra: Any) -> Dict[str, Any]:
    return {"type": type_, "description": description, **extra}


_ISO = "ISO date YYYY-MM-DD (or YYYY-MM); see recordare_resolve_period"
_PRECISION = _p("How precise the date is", enum=["day", "month", "year", "approximate"])

# Recordare's MCP tools (docs/API.md §3) under a `recordare_` prefix. `log_episode` is left out: the conversation is
# already captured. Extra arguments are tolerated (dropped before the call).
TOOLS: List[Dict[str, Any]] = [
    {"name": "recordare_search_episodes",
     "description": "Search what the user lived, did or planned (events, plans, changes), with dates and status. Use "
                    "from/to for questions about a period. mode: \"search\" = most relevant, \"list\" = chronological in "
                    "the period (overviews, counting), \"latest\" = most recent first (\"when did I last…\").",
     "parameters": {"type": "object", "properties": {
         "query": _p("What to look for — pass the user's question also when listing a period"),
         "from": _p(f"Start date, {_ISO}"), "to": _p(f"End date (inclusive), {_ISO}"),
         "mode": _p("search | list | latest", enum=["search", "list", "latest"]),
         "include_plans": _p("Include plans (default true)", "boolean"),
         "limit": _p("Max items (1-50)", "integer")}, "required": []}},
    {"name": "recordare_search_memory",
     "description": "Search who the user is: preferences, habits, values, relationships, knowledge and current state "
                    "(car, home, job…). Use as_of for \"what was it on that date\"; each fact comes with its history.",
     "parameters": {"type": "object", "properties": {
         "query": _p("Topic"), "as_of": _p("ISO date YYYY-MM-DD; default today"),
         "include_pending": _p("Include facts awaiting confirmation", "boolean")}, "required": ["query"]}},
    {"name": "recordare_resolve_period",
     "description": "Deterministic: \"last week\", \"in February\", \"la settimana scorsa\"… → {from, to} (ISO, inclusive), "
                    "in the user's timezone.",
     "parameters": {"type": "object", "properties": {"expression": _p("The period as the user said it")},
                    "required": ["expression"]}},
    {"name": "recordare_remember",
     "description": "Explicit \"remember that…\" from the user about preferences, habits, values, knowledge.",
     "parameters": {"type": "object", "properties": {
         "content": _p("What to remember, in the user's words"),
         "category": _p("Kind of note", enum=["preference", "habit", "value", "relationship", "knowledge", "profile",
                                               "constraint"])}, "required": ["content"]}},
    {"name": "recordare_correct_episode",
     "description": "The user corrects a remembered episode (wrong date or detail). The old version is kept as history.",
     "parameters": {"type": "object", "properties": {
         "id": _p("Episode id (from recordare_search_episodes)"), "content": _p("Corrected text"),
         "occurred_at": _p(f"Corrected date, {_ISO}"), "date_precision": _PRECISION}, "required": ["id"]}},
    {"name": "recordare_forget_episode",
     "description": "The user asks to forget an episode. It is deleted with its corrections and never recreated.",
     "parameters": {"type": "object", "properties": {"id": _p("Episode id (from recordare_search_episodes)")},
                    "required": ["id"]}},
]
_TOOL_ARGS = {t["name"]: set(t["parameters"]["properties"]) for t in TOOLS}


def _secret(name: str) -> str:
    try:
        from agent.secret_scope import get_secret
        return (get_secret(name, "") or "").strip()
    except Exception:  # unscoped read under a multiplexing gateway: treat as unset
        return ""


def _config() -> Dict[str, Any]:
    """`memory.recordare` block of config.yaml ({} on error)."""
    try:
        from hermes_cli.config import load_config_readonly
        block = (load_config_readonly().get("memory") or {}).get("recordare") or {}
        return dict(block) if isinstance(block, dict) else {}
    except Exception:
        return {}


def _setting(env: str, key: str, default: Any = "") -> Any:
    value = _secret(env)
    return value if value else _config().get(key, default)


def _flag(env: str, key: str, default: bool) -> bool:
    value = _setting(env, key, default)
    return value if isinstance(value, bool) else str(value).strip().lower() not in ("0", "false", "no", "off", "")


def _aliases() -> Dict[str, str]:
    raw = _setting("RECORDARE_USER_ALIASES", "user_aliases", {})
    if isinstance(raw, str):
        try:
            raw = json.loads(raw) if raw.strip() else {}
        except ValueError:
            logger.warning("Recordare: RECORDARE_USER_ALIASES is not valid JSON; ignored")
            raw = {}
    return {str(k): str(v) for k, v in raw.items()} if isinstance(raw, dict) else {}


def _clip(text: str) -> str:
    data = text.encode("utf-8")
    return text if len(data) <= MAX_CONTENT_BYTES else data[:MAX_CONTENT_BYTES].decode("utf-8", "ignore") + " […]"


def _user_instruction(text: str) -> str:
    """The message as `sync_turn` will receive it (Hermes strips skill scaffolding there), so both name one message."""
    try:
        from agent.memory_manager import MemoryManager
        return MemoryManager._strip_skill_scaffolding(text) or ""
    except Exception:
        return text


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


def strip_fence(block: str) -> str:
    """Recordare's block without its own `<memory-context …>` fence (Hermes adds its fence and note)."""
    lines = block.strip().splitlines()
    if lines and lines[0].lstrip().startswith("<memory-context"):
        lines = lines[1:]
    if lines and lines[-1].strip() == "</memory-context>":
        lines = lines[:-1]
    return "\n".join(lines).strip()


class RecordareMemoryProvider(MemoryProvider):
    """Recordare episodic memory and digital twin (https://github.com/arkimedehq/recordare)."""

    def __init__(self) -> None:
        self._client: Optional[RecordareClient] = None
        self._outbox: Optional[Outbox] = None
        self._user: Optional[str] = None        # X-Recordare-User (client key); None with a personal token
        self._conv = ""                         # conversation externalId = X-Recordare-Conversation
        self._session_id = ""
        self._base = "cli"                      # gateway_session_key or platform
        self._meta: Dict[str, Any] = {}
        self._active = False                    # resolved a person: capture / recall / tools on
        self._capture = False                   # primary agent context and capture enabled
        self._recall, self._tools = True, True
        self._timeout = DEFAULT_TIMEOUT_S
        self._raw_user_ids: set = set()
        self._turn_author: Optional[str] = None
        self._pending_user: Optional[tuple] = None  # (text, externalId) ingested at turn start
        self._turn_row: Optional[int] = None    # outbox row of that message, left for prefetch to store with its context
        self._initialized = False

    # -- identity ---------------------------------------------------------------------------------------------------------

    @property
    def name(self) -> str:
        return "recordare"

    def is_available(self) -> bool:
        return bool(_setting("RECORDARE_URL", "url") and _secret("RECORDARE_API_KEY"))

    def unavailable_reason(self) -> str:
        return "set RECORDARE_URL and RECORDARE_API_KEY (personal token rp_… or client key rk_…) in $HERMES_HOME/.env"

    def get_config_schema(self) -> List[Dict[str, Any]]:
        return [
            {"key": "url", "description": "Recordare address, e.g. http://localhost:8080", "required": True,
             "env_var": "RECORDARE_URL"},
            {"key": "api_key", "description": "Personal token (rp_…, one person) or client key (rk_…, several people)",
             "secret": True, "required": True, "env_var": "RECORDARE_API_KEY"},
            {"key": "user", "description": "Recordare user for turns without a gateway user (CLI) — client keys only",
             "env_var": "RECORDARE_USER"},
            {"key": "user_aliases", "description": "JSON {\"<platform>:<user id>\": \"<Recordare user>\"}",
             "env_var": "RECORDARE_USER_ALIASES"},
        ]

    def save_config(self, values: Dict[str, Any], hermes_home: str) -> None:
        """All fields carry `env_var`: Hermes writes them to $HERMES_HOME/.env."""

    def identity_signature(self) -> Dict[str, Any]:
        return {"recordare.user": _setting("RECORDARE_USER", "user"), "recordare.aliases": _aliases()}

    def _resolve_user(self, platform: str, kwargs: Dict[str, Any], personal: bool) -> tuple:
        """(active, X-Recordare-User). Gateways: `<platform>:<user_id_alt|user_id>` through the alias map; otherwise
        RECORDARE_USER. With a personal token every turn is the token's person, unless an alias map is set: then only
        the mapped ids are remembered (other people writing to the same bot are left out)."""
        aliases = _aliases()
        ids = [f"{platform}:{v}" for v in (kwargs.get("user_id_alt"), kwargs.get("user_id")) if v]
        self._raw_user_ids = {str(v) for v in (kwargs.get("user_id_alt"), kwargs.get("user_id")) if v}
        mapped = next((aliases[i] for i in ids if i in aliases), None)
        if personal:
            return (not ids or not aliases or mapped is not None), None
        user = mapped or (ids[0] if ids else None) or _setting("RECORDARE_USER", "user") or None
        return user is not None, user

    # -- lifecycle --------------------------------------------------------------------------------------------------------

    def initialize(self, session_id: str, **kwargs: Any) -> None:
        self._initialized = True
        try:
            self._initialize(session_id, kwargs)
        except Exception as exc:
            self._active = False
            logger.warning("Recordare provider disabled: %s", exc)

    def _initialize(self, session_id: str, kwargs: Dict[str, Any]) -> None:
        self._client = RecordareClient(str(_setting("RECORDARE_URL", "url")), _secret("RECORDARE_API_KEY"))
        platform = str(kwargs.get("platform") or "cli")
        self._active, self._user = self._resolve_user(platform, kwargs, self._client.personal)
        if not self._active:
            logger.info("Recordare: no Recordare user for this %s session; memory off", platform)
            return
        self._capture = kwargs.get("agent_context", "primary") == "primary" and _flag("RECORDARE_CAPTURE", "capture", True)
        self._recall = _flag("RECORDARE_RECALL", "recall", True)
        self._tools = _flag("RECORDARE_TOOLS", "tools", True)
        try:
            self._timeout = float(_setting("RECORDARE_TIMEOUT", "timeout", DEFAULT_TIMEOUT_S))
        except (TypeError, ValueError):
            self._timeout = DEFAULT_TIMEOUT_S
        home = Path(str(kwargs.get("hermes_home") or "") or self._hermes_home())
        self._outbox = get_outbox(home / "recordare_outbox.db", self._client, spawn_context_thread)
        self._base = str(kwargs.get("gateway_session_key") or platform)
        self._session_id = session_id
        # The conversation follows the session lineage: kept across compression, resumed with the session, new on /new.
        self._conv = self._outbox.lineage_get(session_id) or self._new_conv(session_id)
        assistant = str(kwargs.get("agent_identity") or "hermes")
        participants = [{"ref": "owner", "role": "owner", **({"displayName": str(kwargs["user_name"])}
                                                            if kwargs.get("user_name") else {})},
                        {"ref": "assistant", "role": "assistant", "displayName": assistant}]
        title = kwargs.get("session_title") or kwargs.get("chat_name")
        self._meta = {"channel": f"hermes:{platform}", "participants": participants,
                      **({"title": str(title)[:500]} if title else {})}

    @staticmethod
    def _hermes_home() -> str:
        from hermes_constants import get_hermes_home
        return str(get_hermes_home())

    def _new_conv(self, session_id: str) -> str:
        conv = f"hermes:{self._base}/{session_id}"
        if self._outbox:
            self._outbox.lineage_set(session_id, conv)
        return conv

    def _conversation(self) -> Dict[str, Any]:
        return {"externalId": self._conv, **self._meta}

    def system_prompt_block(self) -> str:
        if not (self._active and self._tools):
            return ""
        return ("# Recordare memory\nLong-term memory of the user's life is active. Use recordare_search_episodes for "
                "what happened or was planned (with dates), recordare_search_memory for who the user is, "
                "recordare_resolve_period to turn a period into dates, recordare_remember when the user asks you to "
                "remember something.")

    # -- capture ----------------------------------------------------------------------------------------------------------

    def on_turn_start(self, turn_number: int, message: str, **kwargs: Any) -> None:
        """Queue the person's message. With recall on, `prefetch` (which Hermes runs right after, before the agent)
        stores it together with the context read; otherwise it is delivered now (bounded; on failure it stays in the
        outbox and the turn goes on)."""
        try:
            author = kwargs.get("author_id")
            self._turn_author = str(author) if author else None
            self._pending_user, self._turn_row = None, None
            text = _user_instruction(message or "").strip()
            if not (self._active and self._capture and self._outbox and text) or self._other_author():
                return
            ext_id = f"{self._session_id}:{uuid.uuid4().hex[:12]}:u"
            row = self._outbox.add_batch(self._conv, self._user, {"conversation": self._conversation(), "messages": [
                {"externalId": ext_id, "role": "user", "content": _clip(text), "sentAt": _now()}]}, wake=not self._recall)
            self._pending_user = (text, ext_id)
            if self._recall:
                self._turn_row = row
            else:
                self._outbox.deliver_now(TURN_START_DEADLINE_S)
        except Exception as exc:
            logger.warning("Recordare turn start: %s", exc)

    def _other_author(self) -> bool:
        """In a shared room, a turn written by someone other than the session's person is not theirs to remember."""
        return bool(self._turn_author and self._raw_user_ids and self._turn_author not in self._raw_user_ids)

    def sync_turn(self, user_content: str, assistant_content: str, *, session_id: str = "",
                  messages: Optional[List[Dict[str, Any]]] = None, turn_author: Optional[Dict[str, Any]] = None) -> None:
        try:
            if not (self._active and self._capture and self._outbox):
                return
            if turn_author and turn_author.get("id"):
                self._turn_author = str(turn_author["id"])
            now, turn = _now(), uuid.uuid4().hex[:12]
            out: List[Dict[str, Any]] = []
            text = (user_content or "").strip()
            pending, self._pending_user = self._pending_user, None
            if text and not self._other_author() and not (pending and pending[0] == text):
                out.append({"externalId": f"{self._session_id}:{turn}:u", "role": "user", "content": _clip(text),
                            "sentAt": now})
            answer = (assistant_content or "").strip()
            if answer and not self._other_author():
                out.append({"externalId": f"{self._session_id}:{turn}:a", "role": "assistant", "content": _clip(answer),
                            "sentAt": now})
            if out:
                self._outbox.add_batch(self._conv, self._user, {"conversation": self._conversation(), "messages": out})
        except Exception as exc:
            logger.warning("Recordare sync_turn: %s", exc)

    def on_session_end(self, messages: List[Dict[str, Any]]) -> None:
        self._end_conversation()

    def on_session_switch(self, new_session_id: str, *, parent_session_id: str = "", reset: bool = False,
                          rewound: bool = False, **kwargs: Any) -> None:
        try:
            if not (self._active and self._outbox):
                return
            if reset:  # a genuinely new conversation (/new, /reset)
                self._end_conversation()
                self._conv = self._new_conv(new_session_id)
            else:      # same conversation under a new session id (compression, /branch, /resume of the same lineage)
                self._conv = self._outbox.lineage_get(new_session_id) or self._conv
                self._outbox.lineage_set(new_session_id, self._conv)
            self._session_id = new_session_id
            self._pending_user, self._turn_row = None, None
        except Exception as exc:
            logger.warning("Recordare session switch: %s", exc)

    def _end_conversation(self) -> None:
        try:
            if self._active and self._capture and self._outbox and self._conv:
                self._outbox.add_end(self._conv, self._user)
        except Exception as exc:
            logger.warning("Recordare session end: %s", exc)

    def shutdown(self) -> None:
        """Deliver what is pending within a short deadline; the rest is replayed at the next start."""
        try:
            if self._outbox:
                self._outbox.deliver_now(4.0)
        except Exception as exc:
            logger.warning("Recordare shutdown: %s", exc)

    # -- recall -----------------------------------------------------------------------------------------------------------

    def prefetch(self, query: str, *, session_id: str = "") -> str:
        """The memory context for the turn; the turn's message, when still queued, is stored in the same call. (Reads
        always name the conversation: with a personal token one not stored yet counts as the person's own.)"""
        row, self._turn_row = self._turn_row, None
        try:
            if not (self._active and self._recall and self._client and query and query.strip()) or self._other_author():
                return ""
            q = query[:4000]
            sent, block = False, None
            if row is not None and self._outbox:
                sent, block = self._outbox.send_with(row, TURN_START_DEADLINE_S, lambda body: self._client.context(
                    q, user=self._user, conversation=self._conv, timeout=self._timeout, ingest=body))
                if not sent:  # the outbox is busy or older messages come first: store it the usual way
                    self._outbox.deliver_now(TURN_START_DEADLINE_S)
            if not sent:
                block = self._client.context(q, user=self._user, conversation=self._conv, timeout=self._timeout)
            return strip_fence(block) if block else ""
        except Exception as exc:
            logger.info("Recordare context unavailable: %s", exc)
            return ""
        finally:
            if row is not None and self._outbox:
                self._outbox.wake()  # whatever is still queued (this message, if not stored here) goes now

    def get_tool_schemas(self) -> List[Dict[str, Any]]:
        """Hermes routes tool names from this list when the provider is added, BEFORE `initialize`: so the schemas
        depend only on configuration; after an initialize that found no person they are withdrawn."""
        if self._initialized and not (self._active and self._tools):
            return []
        return [dict(t) for t in TOOLS] if _flag("RECORDARE_TOOLS", "tools", True) else []

    def handle_tool_call(self, tool_name: str, args: Dict[str, Any], **kwargs: Any) -> str:
        try:
            if not (self._active and self._client) or tool_name not in _TOOL_ARGS:
                return json.dumps({"error": f"unknown tool {tool_name}"})
            if self._other_author():
                return json.dumps({"error": "memory is not available for this person"})
            clean = {k: v for k, v in (args or {}).items() if k in _TOOL_ARGS[tool_name] and v not in (None, "")}
            if self._outbox:  # the turn's message must be stored for the call to bind to it
                self._outbox.deliver_now(TURN_START_DEADLINE_S)
            return self._client.call_tool(tool_name[len("recordare_"):], clean, user=self._user,
                                          conversation=self._conv)
        except RecordareError as exc:
            logger.info("Recordare tool %s: %s", tool_name, exc)
            return json.dumps({"error": f"Recordare: {exc}"})
        except Exception as exc:
            logger.warning("Recordare tool %s: %s", tool_name, type(exc).__name__)
            return json.dumps({"error": "Recordare is not reachable"})


def register(ctx: Any) -> None:
    """Hermes plugin entry point."""
    ctx.register_memory_provider(RecordareMemoryProvider())
