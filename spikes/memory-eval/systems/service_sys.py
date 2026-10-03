"""System S — the Recordare service itself, through its public contracts (WORK_PLAN 3.4).

Sessions go in through REST ingest (incrementally up to each question's asked_at, as for every
system); questions go out through MCP `search_episodes` with the official MCP Python client, as any
agent would call it. The calling agent's planning step (period + topic) runs on LLM_MODEL, the same
planner as system D. M3: the service answers from the raw log only (episodes arrive in M4).

Needs a running service (`npm run start:dev` in service/) and:
  RECORDARE_URL (default http://localhost:8080), RECORDARE_ADMIN_KEY, RECORDARE_DB_URL
  (to wait for background embeddings; default postgres://recordare:recordare@localhost:5433/recordare).
"""
from __future__ import annotations

import asyncio
import json
import os
import time
from datetime import datetime, timedelta

import httpx
import httpx2
import psycopg
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client

from evalkit.common import chat, fmt_when
from systems.d_sys import PLAN_SYSTEM, calendar

URL = os.getenv("RECORDARE_URL", "http://localhost:8080")
ADMIN = os.environ.get("RECORDARE_ADMIN_KEY", "")
DB_URL = os.getenv("RECORDARE_DB_URL", "postgres://recordare:recordare@localhost:5433/recordare")


class ServiceSystem:
    name = "service"

    def __init__(self) -> None:
        assert ADMIN, "RECORDARE_ADMIN_KEY is required"
        self.http = httpx.Client(base_url=URL, timeout=60, headers={"authorization": f"Bearer {ADMIN}"})
        self.run = f"eval{int(time.time())}"
        client = self._post("/api/v1/admin/clients", {"name": f"memory-eval {self.run}", "kind": "platform"})
        self.client_id = client["id"]
        self.key = self._post(f"/api/v1/admin/clients/{self.client_id}/keys", {"scopes": ["ingest", "mcp", "read"]})["key"]
        self.owners: dict[str, dict] = {}

    def _post(self, path: str, body: dict, token: str | None = None, headers: dict | None = None) -> dict:
        h = {**({"authorization": f"Bearer {token}"} if token else {}), **(headers or {})}
        r = self.http.post(path, json=body, headers=h)
        r.raise_for_status()
        return r.json() if r.content else {}

    def _owner(self, user: str) -> dict:
        if user not in self.owners:
            o = self._post("/api/v1/admin/owners", {"displayName": user, "episodicEnabled": True})
            ext = f"{user}-{self.run}"
            self._post("/api/v1/admin/identities", {"kind": "client_user", "personId": o["personId"], "clientId": self.client_id, "externalId": ext})
            tok = self._post(f"/api/v1/admin/owners/{o['personId']}/tokens", {"clientId": self.client_id, "scopes": ["mcp"]})["token"]
            self.owners[user] = {"id": o["personId"], "ext": ext, "token": tok}
        return self.owners[user]

    # ── Ingest ──────────────────────────────────────────────────────────────────

    def ingest(self, sessions: list[dict]) -> None:
        for s in sessions:
            owner = self._owner(s["user"])
            base = datetime.fromisoformat(s["ts"])
            messages = [{
                "externalId": f"{s['id']}-{i}",
                "role": "user" if m["role"] == "user" else "assistant",
                "content": m["content"],
                "sentAt": (base + timedelta(seconds=i)).isoformat(),
            } for i, m in enumerate(s["messages"])]
            res = self._post("/api/v1/ingest/messages", {"conversation": {"externalId": s["id"]}, "messages": messages},
                             token=self.key, headers={"x-recordare-user": owner["ext"]})
            assert res.get("stored"), res
        self._wait_embeddings()

    def _wait_embeddings(self, timeout_s: int = 300) -> None:
        ids = [o["id"] for o in self.owners.values()]
        deadline = time.time() + timeout_s
        with psycopg.connect(DB_URL) as conn:
            while time.time() < deadline:
                (pending,) = conn.execute(
                    "SELECT count(*) FROM messages WHERE owner_id = ANY(%s) AND role <> 'assistant' AND embedding IS NULL",
                    (ids,)).fetchone()
                if pending == 0:
                    return
                time.sleep(0.5)
        print("  ! embeddings still pending after timeout", flush=True)

    # ── Recall ──────────────────────────────────────────────────────────────────

    def context(self, user: str, question: dict) -> str:
        owner = self._owner(user)
        now = datetime.fromisoformat(question["asked_at"])
        raw = chat([{"role": "system", "content": PLAN_SYSTEM}, {"role": "user", "content": (
            f"TODAY: {fmt_when(question['asked_at'])}\nCALENDAR:\n{calendar(now.date(), 21, 0)}\n\nQUESTION: {question['q']}")}],
            phase="recall", json_mode=True, max_tokens=2000)
        try:
            plan = json.loads(raw)
        except ValueError:
            plan = {}
        args = {"query": plan.get("topic") or question["q"], "mode": plan.get("mode") or "search", "limit": 8}
        for k in ("from", "to"):
            if plan.get(k):
                args[k] = plan[k]
        out = asyncio.run(self._search(owner["token"], args))
        lines = []
        if args.get("from") or args.get("to"):
            lines.append(f"PERIODO CERCATO: {args.get('from', '…')} → {args.get('to', '…')}")
        lines.append("DALLE CHAT (testo originale):")
        for h in out.get("fromChats", []):
            lines.append(f"- [{fmt_when(h['at'])} · sessione {h['conversation']}] {h['excerpt']}")
        return "\n".join(lines)

    @staticmethod
    async def _search(token: str, args: dict) -> dict:
        async with httpx2.AsyncClient(headers={"authorization": f"Bearer {token}"}, timeout=60) as client:
            async with streamable_http_client(f"{URL}/mcp", http_client=client) as (read, write):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    res = await session.call_tool("search_episodes", args)
                    if res.structured_content:
                        return res.structured_content
                    return json.loads(res.content[0].text) if res.content else {}
