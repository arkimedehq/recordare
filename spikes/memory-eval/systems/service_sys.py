# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""System S — the Recordare service itself, through its public contracts (WORK_PLAN 3.4).

Sessions go in through REST ingest (incrementally up to each question's asked_at, as for every
system); questions go out through MCP `search_episodes` with the official MCP Python client, as any
agent would call it. The calling agent's planning step (period + topic) runs on LLM_MODEL, the same
planner as system D. M4: the service's own engine extracts episodes, plans, facts and notes (with the
LLM configured in the service); questions use search_episodes + search_memory, asked "as of" the
question time (X-Recordare-Now; the service must run with ALLOW_CLOCK_OVERRIDE=true).

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

from evalkit.common import DATASET, chat, fmt_when
from systems.d_sys import PLAN_SYSTEM as D_PLAN_SYSTEM, calendar

# The agent knows the service's tools, including mode "latest" (see the search_episodes description).
PLAN_SYSTEM = D_PLAN_SYSTEM.replace(
    '"mode": "search" | "list"', '"mode": "search" | "list" | "latest"').replace(
    '"search" for a specific fact or event.',
    '"latest" for "when did I last…" / "the most recent time" questions; "search" for a specific fact or event.')

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
        # Entity memories (D48): owners the dataset marks as an entity (a shared device everyone talks to).
        conv = DATASET / "conversations.json"
        self.entities = set(json.loads(conv.read_text()).get("entities", [])) if conv.exists() else set()

    def _post(self, path: str, body: dict, token: str | None = None, headers: dict | None = None) -> dict:
        h = {**({"authorization": f"Bearer {token}"} if token else {}), **(headers or {})}
        r = self.http.post(path, json=body, headers=h)
        r.raise_for_status()
        return r.json() if r.content else {}

    def _owner(self, user: str) -> dict:
        if user not in self.owners:
            o = self._post("/api/v1/admin/owners", {"displayName": user.capitalize(), "episodicEnabled": True,
                                                    **({"kind": "entity"} if user in self.entities else {})})
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
            # Group chats: other people's messages keep role "other" and their author as a participant
            # (unverified: they never enter the audience, and are never the owner's statements).
            authors = sorted({m["author"] for m in s["messages"] if m["role"] == "other" and m.get("author")})
            # Tool messages keep their role and tool name (a client's recall tools: the echo dev set); other roles
            # unknown to the service are sent as the assistant's.
            messages = [{
                "externalId": f"{s['id']}-{i}",
                "role": m["role"] if m["role"] in ("user", "assistant", "other", "tool") else "assistant",
                **({"authorRef": m["author"]} if m["role"] == "other" and m.get("author") else {}),
                **({"toolName": m["tool"]} if m["role"] == "tool" and m.get("tool") else {}),
                "content": m["content"],
                "sentAt": (base + timedelta(seconds=i)).isoformat(),
            } for i, m in enumerate(s["messages"])]
            conversation = {"externalId": s["id"],
                            "participants": [{"ref": a, "role": "other", "displayName": a} for a in authors]}
            # conversationEnded: extract now instead of waiting for the idle delay.
            res = self._post("/api/v1/ingest/messages", {"conversation": conversation, "messages": messages,
                                                         "hints": {"conversationEnded": True}},
                             token=self.key, headers={"x-recordare-user": owner["ext"]})
            assert res.get("stored"), res
        self._wait_processed()

    def cost(self) -> dict:
        """LLM calls made by the service for this run's owners (engine cost, by prompt)."""
        ids = [o["id"] for o in self.owners.values()]
        with psycopg.connect(DB_URL) as conn:
            rows = conn.execute(
                "SELECT prompt_id, count(*), sum(input_tokens), sum(cached_input_tokens), sum(output_tokens) "
                "FROM llm_calls WHERE owner_id = ANY(%s) GROUP BY prompt_id", (ids,)).fetchall()
        return {r[0]: {"calls": r[1], "input": int(r[2] or 0), "cached": int(r[3] or 0), "output": int(r[4] or 0)} for r in rows}

    def owner_ids(self) -> dict:
        return {u: o["id"] for u, o in self.owners.items()}

    def _wait_processed(self, timeout_s: int = 1800) -> None:
        """Wait until the engine extracted every message and raw embeddings exist (failed runs are reported)."""
        ids = [o["id"] for o in self.owners.values()]
        deadline = time.time() + timeout_s
        with psycopg.connect(DB_URL, autocommit=True) as conn:
            while time.time() < deadline:
                (pending,) = conn.execute(
                    "SELECT count(*) FROM messages WHERE owner_id = ANY(%s) AND (extracted_run_id IS NULL OR (role <> 'assistant' AND embedding IS NULL))",
                    (ids,)).fetchone()
                (failed,) = conn.execute(
                    "SELECT count(*) FROM extraction_runs WHERE owner_id = ANY(%s) AND status = 'failed'", (ids,)).fetchone()
                if pending == 0:
                    if failed:
                        print(f"  ! {failed} extraction runs failed", flush=True)
                    return
                if failed and pending:
                    # A failed window stays pending (retried by the nightly sweep): do not wait forever.
                    (running,) = conn.execute(
                        "SELECT count(*) FROM extraction_runs WHERE owner_id = ANY(%s) AND status = 'running'", (ids,)).fetchone()
                    if running == 0:
                        print(f"  ! {failed} extraction runs failed, {pending} messages left pending", flush=True)
                        return
                time.sleep(1)
        print("  ! processing still pending after timeout", flush=True)

    # ── Recall ──────────────────────────────────────────────────────────────────

    def context(self, user: str, question: dict) -> str:
        owner = self._owner(user)
        # The nights before the question have passed: run the consolidation as of that moment (M5). Idempotent and
        # free when nothing changed; set CONSOLIDATE=0 to measure without it.
        if os.getenv("CONSOLIDATE", "1") != "0":
            # The first call digests every past day: minutes with a slow provider.
            r = self.http.post(f"/api/v1/admin/owners/{owner['id']}/consolidate", headers={"x-recordare-now": question["asked_at"]}, timeout=600)
            r.raise_for_status()
        now = datetime.fromisoformat(question["asked_at"])
        raw = chat([{"role": "system", "content": PLAN_SYSTEM}, {"role": "user", "content": (
            f"TODAY: {fmt_when(question['asked_at'])}\nCALENDAR:\n{calendar(now.date(), 21, 0)}\n\nQUESTION: {question['q']}")}],
            phase="recall", json_mode=True, max_tokens=2000)
        try:
            plan = json.loads(raw)
        except ValueError:
            plan = {}
        # As the tool description asks: the query is always passed, also when listing a period (it ranks the
        # items and finds the chat excerpts); without a topic it is the user's question itself.
        topic = plan.get("topic") or question["q"]
        args = {"query": topic, "mode": plan.get("mode") or "search"}
        for k in ("from", "to"):
            if plan.get(k):
                args[k] = plan[k]
        memory_args = {"query": topic, **({"as_of": plan["to"]} if plan.get("to") else {})}
        episodes, memory = asyncio.run(self._call(owner["token"], question["asked_at"], args, memory_args))
        return format_context(args, episodes, memory)

    @staticmethod
    async def _call(token: str, now: str, episode_args: dict, memory_args: dict) -> tuple[dict, dict]:
        headers = {"authorization": f"Bearer {token}", "x-recordare-now": now}
        async with httpx2.AsyncClient(headers=headers, timeout=60) as client:
            async with streamable_http_client(f"{URL}/mcp", http_client=client) as (read, write):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    out = []
                    for name, args in (("search_episodes", episode_args), ("search_memory", memory_args)):
                        res = await session.call_tool(name, args)
                        out.append(res.structured_content or (json.loads(res.content[0].text) if res.content else {}))
                    return out[0], out[1]



def _episode_line(e: dict) -> str:
    status = e.get("planStatus")
    tag = ""
    if status:
        label = {"open": "PIANO non ancora avvenuto", "confirmed": "PIANO confermato", "cancelled": "PIANO ANNULLATO",
                 "rescheduled": f"PIANO RINVIATO al {e.get('rescheduledTo', '?')}", "unresolved": "PIANO: non si sa se è avvenuto"}[status]
        tag = f" [{label}]"
    extra = []
    if e.get("people"):
        extra.append("con/riguarda: " + ", ".join(e["people"]))
    if e.get("feelings"):
        extra.append("sentimenti: " + ", ".join(e["feelings"]))
    if e.get("opinion"):
        extra.append("opinione: " + e["opinion"])
    if e.get("origin") == "assistant_stated":
        extra.append("detto dall'assistente")
    if e.get("claimedBy"):
        extra.append("affermazione di " + ", ".join(e["claimedBy"]) + ", non confermata dal proprietario")
    src = e.get("source", {})
    return (f"- [{e['when']}]{tag} {e['content']}" + (f" ({'; '.join(extra)})" if extra else "")
            + (f" — fonte: sessione {src.get('conversation')}" if src.get("conversation") else ""))


def format_context(args: dict, episodes: dict, memory: dict) -> str:
    lines = []
    owner = (episodes.get("owner") or memory.get("owner") or {}).get("name")
    if owner:
        lines.append(f"MEMORIA DI: {owner} — è l'utente che fa la domanda (i ricordi parlano di lui/lei in terza persona)")
    if args.get("from") or args.get("to"):
        lines.append(f"PERIODO CERCATO: {args.get('from', '…')} → {args.get('to', '…')}")
    lines.append("EPISODI:")
    lines += [_episode_line(e) for e in episodes.get("episodes", [])] or ["- (nessuno)"]
    if episodes.get("claims"):
        lines.append("AFFERMAZIONI DI ALTRE PERSONE (non sono ricordi del proprietario; su di lui/lei non confermate):")
        lines += [_episode_line(e) for e in episodes["claims"]]
    if episodes.get("outsidePeriod"):
        lines.append("ALTRI EPISODI PERTINENTI (fuori dal periodo cercato):")
        lines += [_episode_line(e) for e in episodes["outsidePeriod"]]
    if episodes.get("digests"):
        lines.append("DIARIO DEL PERIODO (riassunti dei giorni / mesi):")
        lines += [f"- {d['from']}{'' if d['from'] == d['to'] else ' → ' + d['to']}: {d['text']}" for d in episodes["digests"]]
    for n in episodes.get("notes", []):
        lines.append(f"NOTA: {n}")
    if memory.get("facts") or memory.get("notes"):
        lines.append("PROFILO (fatti con storico, note):")
        for f in memory.get("facts", []):
            hist = "; ".join(f"{h['value'] or '(sconosciuto)'} dal {h['from'] or '?'}" + (f" al {h['to']}" if h.get("to") else "") + f" [{h['status']}]"
                             for h in f.get("history", []))
            # Entity memories (D48): the person the fact is about; without it, the owner's own fact.
            about = f"[{f['about']}] " if f.get("about") else ""
            lines.append(f"- {about}{f['key']}: {f['value'] or '(non noto)'} — storico: {hist}")
        for n in memory.get("notes", []):
            lines.append(f"- [{n['category']}] {n['content']}")
    if episodes.get("fromChats"):
        lines.append("DALLE CHAT (testo originale):")
        for h in episodes["fromChats"]:
            who = f" · scritto da {h['author']}" if h.get("author") else (" · scritto dal proprietario" if h.get("authorRole") == "owner" else "")
            lines.append(f"- [{fmt_when(h['at'])} · sessione {h['conversation']}{who}] {h['excerpt']}")
    return "\n".join(lines)
