# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""System S — the Recordare service itself, through its public contracts (WORK_PLAN 3.4).

Sessions go in through REST ingest (incrementally up to each question's asked_at, as for every
system); questions go out through MCP `search_episodes` with the official MCP Python client, as any
agent would call it. The calling agent's planning step (period + topic) runs on LLM_MODEL, the same
planner as system D. M4: the service's own engine extracts episodes, plans, facts and notes (with the
LLM configured in the service); questions use search_episodes + search_memory, asked "as of" the
question time (X-Recordare-Now; the service must run with ALLOW_CLOCK_OVERRIDE=true).

Agent memory (D50, WORK_PLAN 8.4): a session may declare identified participants (`participants: [{name, identity}]`:
their messages carry the identity, so the service knows them as contacts); a question may be asked by one of them
(`asker: {name, identity}`: the question is ingested in its own conversation as that person's turn and the recall runs in
that conversation). `genders` in conversations.json sets a memory's first-person gender (default masculine).

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
        self.memories: dict[str, dict] = {}
        # Entity memories (D48): memories the dataset marks as an entity (a shared device everyone talks to).
        conv = DATASET / "conversations.json"
        meta = json.loads(conv.read_text()) if conv.exists() else {}
        self.entities = set(meta.get("entities", []))
        self.genders: dict[str, str] = meta.get("genders", {})

    def _post(self, path: str, body: dict, token: str | None = None, headers: dict | None = None) -> dict:
        h = {**({"authorization": f"Bearer {token}"} if token else {}), **(headers or {})}
        r = self.http.post(path, json=body, headers=h)
        r.raise_for_status()
        return r.json() if r.content else {}

    def _account(self, user: str) -> dict:
        if user not in self.memories:
            # An entity's name reads as a name ("casa_bellandi" → "Casa Bellandi"): it is "I" in its memory (8.5).
            name = user.replace("_", " ").title() if user in self.entities else user.capitalize()
            o = self._post("/api/v1/admin/memories", {"displayName": name,
                                                    **({"mode": "entity"} if user in self.entities else {}),
                                                    **({"gender": self.genders[user]} if user in self.genders else {})})
            ext = f"{user}-{self.run}"
            self._post("/api/v1/admin/identities", {"kind": "account", "personId": o["personId"], "clientId": self.client_id, "externalId": ext})
            tok = self._post(f"/api/v1/admin/memories/{o['personId']}/tokens", {"clientId": self.client_id, "scopes": ["mcp"]})["token"]
            self.memories[user] = {"id": o["personId"], "ext": ext, "token": tok}
        return self.memories[user]

    # ── Ingest ──────────────────────────────────────────────────────────────────

    def ingest(self, sessions: list[dict]) -> None:
        for s in sessions:
            account = self._account(s["user"])
            # Learned sources (WORK_PLAN 8.9): a dataset entry {"type": "source", …} is learned, {"type": "forget_source"} forgotten.
            if s.get("type") == "source":
                self._learn(account, s)
                continue
            if s.get("type") == "forget_source":
                self.http.delete(f"/api/v1/ingest/sources/{s['source']}", headers={"authorization": f"Bearer {self.key}",
                                                                                   "x-recordare-user": account["ext"]}).raise_for_status()
                continue
            base = datetime.fromisoformat(s["ts"])
            # Group chats: other people's messages keep role "other" and their author as a participant — identified
            # when the session declares their identity (a contact of the memory), otherwise known by name only.
            declared = {p["name"]: p["identity"] for p in s.get("participants", []) if p.get("identity")}
            authors = sorted({m["author"] for m in s["messages"] if m["role"] == "other" and m.get("author")} | set(declared))
            # Tool messages keep their role and tool name (a client's recall tools: the echo dev set); other roles
            # unknown to the service are sent as the assistant's.
            messages = [{
                "externalId": f"{s['id']}-{i}",
                "role": m["role"] if m["role"] in ("user", "assistant", "other", "tool") else "assistant",
                **({"authorRef": m["author"]} if m["role"] == "other" and m.get("author") else {}),
                **({"toolName": m["tool"]} if m["role"] == "tool" and m.get("tool") else {}),
                # Content given to the agent to keep (a manual, a note): the agent's own (D50).
                **({"own": True} if m.get("own") else {}),
                "content": m["content"],
                "sentAt": (base + timedelta(seconds=i)).isoformat(),
            } for i, m in enumerate(s["messages"])]
            conversation = {"externalId": s["id"],
                            "participants": [{"ref": a, "role": "other", "displayName": a,
                                              **({"identity": {"externalUserId": declared[a]}} if a in declared else {})}
                                             for a in authors]}
            # conversationEnded: extract now instead of waiting for the idle delay.
            res = self._post("/api/v1/ingest/messages", {"conversation": conversation, "messages": messages,
                                                         "hints": {"conversationEnded": True}},
                             token=self.key, headers={"x-recordare-user": account["ext"]})
            assert res.get("conversationId"), res
        self._wait_processed()

    def cost(self) -> dict:
        """LLM calls made by the service for this run's memories (engine cost, by prompt)."""
        ids = [o["id"] for o in self.memories.values()]
        with psycopg.connect(DB_URL) as conn:
            rows = conn.execute(
                "SELECT prompt_id, count(*), sum(input_tokens), sum(cached_input_tokens), sum(output_tokens) "
                "FROM llm_calls WHERE memory_id = ANY(%s) GROUP BY prompt_id", (ids,)).fetchall()
        return {r[0]: {"calls": r[1], "input": int(r[2] or 0), "cached": int(r[3] or 0), "output": int(r[4] or 0)} for r in rows}

    def memory_ids(self) -> dict:
        return {u: o["id"] for u, o in self.memories.items()}

    def dump(self) -> str:
        """The memories written (with their subject), the contacts, the clarifications and the extraction runs' leak
        counts (WORK_PLAN 8.4: first-person leaks, counts only in the service; the text here is the eval's own data)."""
        ids = [o["id"] for o in self.memories.values()]
        with psycopg.connect(DB_URL) as conn:
            q = lambda sql: [dict(zip([d.name for d in cur.description], r)) for cur in [conn.execute(sql, (ids,))] for r in cur.fetchall()]  # noqa: E731
            out = {
                "episodes": q("SELECT e.content, e.kind, e.subject_kind, p.display_name AS subject, e.author_role, e.stance FROM episodes e "
                              "LEFT JOIN persons p ON p.id = e.subject_person_id WHERE e.memory_id = ANY(%s) ORDER BY e.recorded_at"),
                "notes": q("SELECT n.content, n.subject_kind, p.display_name AS subject, n.pending FROM notes n "
                           "LEFT JOIN persons p ON p.id = n.subject_person_id WHERE n.memory_id = ANY(%s) ORDER BY n.recorded_at"),
                "facts": q("SELECT f.key, f.value, f.status, f.pending, p.display_name AS subject FROM facts f "
                           "LEFT JOIN persons p ON p.id = f.subject_person_id WHERE f.memory_id = ANY(%s) ORDER BY f.recorded_at"),
                "contacts": q("SELECT display_name, full_name, relation FROM persons WHERE memory_id = ANY(%s) ORDER BY created_at"),
                "clarifications": q("SELECT question, status, resolution FROM clarifications WHERE memory_id = ANY(%s) ORDER BY created_at"),
                "runs": q("SELECT prompt_version, summary FROM extraction_runs WHERE memory_id = ANY(%s) AND summary IS NOT NULL"),
            }
        leaks = {"episodes": 0, "notes": 0}
        written = {"episodes": 0, "notes": 0}
        for r in out["runs"]:
            for k in leaks:
                leaks[k] += (r["summary"].get("leaks") or {}).get(k, 0)
                written[k] += (r["summary"].get("written") or {}).get(k, 0)
        out["leak_rate"] = {k: f"{leaks[k]}/{written[k]}" for k in leaks}
        out["prompt_versions"] = sorted({r["prompt_version"] for r in out.pop("runs")})
        return json.dumps(out, ensure_ascii=False, indent=1, default=str)

    def _wait_processed(self, timeout_s: int = 1800) -> None:
        """Wait until the engine extracted every message and raw embeddings exist (failed runs are reported)."""
        ids = [o["id"] for o in self.memories.values()]
        deadline = time.time() + timeout_s
        with psycopg.connect(DB_URL, autocommit=True) as conn:
            while time.time() < deadline:
                (pending,) = conn.execute(
                    "SELECT count(*) FROM messages WHERE memory_id = ANY(%s) AND (extracted_run_id IS NULL OR (role <> 'assistant' AND embedding IS NULL))",
                    (ids,)).fetchone()
                (failed,) = conn.execute(
                    "SELECT count(*) FROM extraction_runs WHERE memory_id = ANY(%s) AND status = 'failed'", (ids,)).fetchone()
                if pending == 0:
                    if failed:
                        print(f"  ! {failed} extraction runs failed", flush=True)
                    return
                if failed and pending:
                    # A failed window stays pending (retried by the nightly sweep): do not wait forever.
                    (running,) = conn.execute(
                        "SELECT count(*) FROM extraction_runs WHERE memory_id = ANY(%s) AND status = 'running'", (ids,)).fetchone()
                    if running == 0:
                        print(f"  ! {failed} extraction runs failed, {pending} messages left pending", flush=True)
                        return
                time.sleep(1)
        print("  ! processing still pending after timeout", flush=True)

    def _learn(self, account: dict, s: dict) -> None:
        self.has_sources = True
        body = {"externalId": s["id"], "title": s["title"], "text": s["text"], "learnedAt": s["ts"],
                **({"author": s["author"]} if s.get("author") else {}), **({"kind": s["kind"]} if s.get("kind") else {}),
                **({"providedBy": {"name": s["provided_by"]}} if s.get("provided_by") else {}),
                **({"conversation": {"externalId": s["conversation"]}} if s.get("conversation") else {})}
        self._post("/api/v1/ingest/sources", body, token=self.key, headers={"x-recordare-user": account["ext"]})

    # ── Recall ──────────────────────────────────────────────────────────────────

    def context(self, user: str, question: dict) -> str:
        account = self._account(user)
        # The nights before the question have passed: run the consolidation as of that moment (M5). Idempotent and
        # free when nothing changed; set CONSOLIDATE=0 to measure without it.
        if os.getenv("CONSOLIDATE", "1") != "0":
            # The first call digests every past day: minutes with a slow provider.
            r = self.http.post(f"/api/v1/admin/memories/{account['id']}/consolidate", headers={"x-recordare-now": question["asked_at"]}, timeout=600)
            r.raise_for_status()
        now = datetime.fromisoformat(question["asked_at"])
        conversation = self._asker_turn(account, question) if question.get("asker") else None
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
        episodes, memory, knowledge = asyncio.run(self._call(account["token"], question["asked_at"], args, memory_args, conversation,
                                                             {"query": topic} if getattr(self, "has_sources", False) else None))
        if conversation:
            # The asker's turn is not part of the dataset: purged once answered (never extracted into the memory).
            self.http.delete(f"/api/v1/ingest/conversations/{conversation}",
                             headers={"authorization": f"Bearer {self.key}", "x-recordare-user": account["ext"]}).raise_for_status()
        return format_context(args, episodes, memory, knowledge)

    def _asker_turn(self, account: dict, question: dict) -> str:
        """A question asked by an identified participant: their turn in a conversation of its own (the speaker)."""
        asker = question["asker"]
        conv = f"ask-{question['id']}-{self.run}"
        self._post("/api/v1/ingest/messages", {
            "conversation": {"externalId": conv, "participants": [
                {"ref": asker["name"], "role": "other", "displayName": asker["name"], "identity": {"externalUserId": asker["identity"]}}]},
            "messages": [{"externalId": f"{conv}-q", "role": "other", "authorRef": asker["name"], "content": question["q"],
                          "sentAt": question["asked_at"]}]},
            token=self.key, headers={"x-recordare-user": account["ext"]})
        return conv

    @staticmethod
    async def _call(token: str, now: str, episode_args: dict, memory_args: dict, conversation: str | None = None,
                    knowledge_args: dict | None = None) -> tuple[dict, dict, dict]:
        headers = {"authorization": f"Bearer {token}", "x-recordare-now": now,
                   **({"x-recordare-conversation": conversation} if conversation else {})}
        async with httpx2.AsyncClient(headers=headers, timeout=60) as client:
            async with streamable_http_client(f"{URL}/mcp", http_client=client) as (read, write):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    out = []
                    calls = [("search_episodes", episode_args), ("search_memory", memory_args)]
                    # Datasets with learned sources (8.9) also search what was learned.
                    if knowledge_args:
                        calls.append(("search_knowledge", knowledge_args))
                    for name, args in calls:
                        res = await session.call_tool(name, args)
                        out.append(res.structured_content or (json.loads(res.content[0].text) if res.content else {}))
                    return out[0], out[1], (out[2] if len(out) > 2 else {})



def _subject(e: dict) -> str | None:
    """Personal memories: whose an item is when it is not the self's (first-person items need no label)."""
    s = e.get("subject") or {}
    if s.get("kind") == "contact":
        return s.get("name")
    if s.get("kind") == "someone":
        return "qualcuno"
    if s.get("kind") == "undecided":
        return "incerto tra " + " / ".join(s.get("candidates", []))
    return None


def _episode_line(e: dict, personal: bool = False, me: str = "") -> str:
    status = e.get("planStatus")
    tag = ""
    if status:
        label = {"open": "PIANO non ancora avvenuto", "confirmed": "PIANO confermato", "cancelled": "PIANO ANNULLATO",
                 "rescheduled": f"PIANO RINVIATO al {e.get('rescheduledTo', '?')}", "unresolved": "PIANO: non si sa se è avvenuto"}[status]
        tag = f" [{label}]"
    extra = []
    if personal and _subject(e):
        extra.append("soggetto: " + _subject(e))
    if e.get("people"):
        extra.append("con/riguarda: " + ", ".join(e["people"]))
    if e.get("feelings"):
        extra.append("sentimenti: " + ", ".join(e["feelings"]))
    if e.get("opinion"):
        extra.append("opinione: " + e["opinion"])
    learned = [f"«{x['title']}»" for x in e.get("sources", []) if x.get("title")]
    if learned:
        extra.append("fonte appresa: " + ", ".join(learned))
    # Personal memories: the person and the assistant are one self — who said it is not shown (D50).
    if e.get("origin") == "assistant_stated" and not personal:
        extra.append("detto dall'assistente")
    # Personal memories: only others' statements about someone else (inferred) are claims; a person's own news is theirs.
    if e.get("claimedBy") and (not personal or (e.get("authorRole") == "other" and e.get("inferred"))):
        extra.append("affermazione di " + ", ".join(e["claimedBy"]) + (f", non confermata da {me}" if personal else ", non confermata dal proprietario"))
    src = e.get("source", {})
    return (f"- [{e['when']}]{tag} {e['content']}" + (f" ({'; '.join(extra)})" if extra else "")
            + (f" — fonte: sessione {src.get('conversation')}" if src.get("conversation") else ""))


def format_context(args: dict, episodes: dict, memory: dict, knowledge: dict | None = None) -> str:
    lines = []
    mem = episodes.get("memory") or memory.get("memory") or {}
    self_name = mem.get("name")
    entity = mem.get("mode") == "entity"
    # Agent memory (D50): both modes are written in the first person of the memory's self (8.4 personal, 8.5 entity).
    personal = mem.get("mode") == "personal" or entity
    if entity:
        lines.append(f"MEMORIA: la memoria di {self_name}, un agente condiviso che più persone usano — i ricordi in prima persona "
                     f"(«ho impostato…», «le chiavi di scorta sono…») sono di {self_name}: le sue azioni, ciò che gli è stato dato da "
                     "tenere, il suo luogo; quelli delle persone hanno il loro soggetto; «qualcuno» è chi non si è identificato.")
        speaker = episodes.get("speaker") or memory.get("speaker") or {}
        if speaker.get("kind") == "contact":
            lines.append(f"CHI FA LA DOMANDA: {speaker['name']} — «io» nella domanda è {speaker['name']}, non {self_name}.")
        else:
            lines.append(f"CHI FA LA DOMANDA: una persona che usa {self_name}, non identificata — «io» nella domanda è chi parla "
                         f"(se nella domanda dice chi è, vale quel nome), non {self_name}.")
    elif personal:
        # Agent memory (D50, 8.4): first person = the memory's self; the asker may be someone it knows.
        lines.append(f"MEMORIA: la memoria di {self_name} — i ricordi in prima persona («sono andato…», «ho prenotato…») sono di {self_name}; "
                     "quelli di altre persone hanno il loro soggetto.")
        speaker = episodes.get("speaker") or memory.get("speaker") or {}
        if speaker.get("kind") == "contact":
            lines.append(f"CHI FA LA DOMANDA: {speaker['name']}, una persona che {self_name} conosce — «io» nella domanda è {speaker['name']}; "
                         f"i ricordi in prima persona sono di {self_name}, non di {speaker['name']}.")
        else:
            lines.append(f"CHI FA LA DOMANDA: {self_name} (l'utente) — «io» nella domanda è {self_name}.")
    elif self_name:
        lines.append(f"MEMORIA DI: {self_name} — è l'utente che fa la domanda (i ricordi parlano di lui/lei in terza persona)")
    if args.get("from") or args.get("to"):
        lines.append(f"PERIODO CERCATO: {args.get('from', '…')} → {args.get('to', '…')}")
    lines.append("EPISODI:")
    lines += [_episode_line(e, personal, self_name) for e in episodes.get("episodes", [])] or ["- (nessuno)"]
    if episodes.get("claims"):
        lines.append(f"AFFERMAZIONI DI ALTRE PERSONE (non confermate; ciò che dicono di {self_name} non è un suo ricordo né qualcosa che ha detto):" if personal
                     else "AFFERMAZIONI DI ALTRE PERSONE (non sono ricordi del proprietario; su di lui/lei non confermate):")
        lines += [_episode_line(e, personal, self_name) for e in episodes["claims"]]
    if episodes.get("outsidePeriod"):
        lines.append("ALTRI EPISODI PERTINENTI (fuori dal periodo cercato):")
        lines += [_episode_line(e, personal, self_name) for e in episodes["outsidePeriod"]]
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
            # The person the fact is about (D48, D50); without it, the memory's own fact.
            name = (f.get("subject") or {}).get("name") or f.get("about")
            about = f"[{name}] " if name else ""
            lines.append(f"- {about}{f['key']}: {f['value'] or '(non noto)'} — storico: {hist}")
        for n in memory.get("notes", []):
            who = f"[{_subject(n)}] " if personal and _subject(n) else ""
            lines.append(f"- [{n['category']}] {who}{n['content']}")
    if episodes.get("fromChats"):
        lines.append("DALLE CHAT (testo originale):")
        for h in episodes["fromChats"]:
            mine = f" · scritto da qualcuno che usa {self_name}" if entity else f" · scritto da {self_name}" if personal else " · scritto dal proprietario"
            who = f" · scritto da {h['author']}" if h.get("author") else (mine if h.get("authorRole") == "holder" else "")
            lines.append(f"- [{fmt_when(h['at'])} · sessione {h['conversation']}{who}] {h['excerpt']}")
    if knowledge and knowledge.get("passages"):
        lines.append("CONOSCENZA APPRESA (brani delle fonti imparate: il loro testo, non ricordi di fatti accaduti):")
        for p in knowledge["passages"]:
            src = p["source"]
            by = src.get("providedBy") or {}
            giver = f", data da {by['name']}" if by.get("kind") == "contact" else (", data da qualcuno" if by.get("kind") == "someone" else "")
            lines.append(f"- «{src['title']}»{' di ' + src['author'] if src.get('author') else ''} (imparata il {src['learnedAt'][:10]}{giver})"
                         f"{' · ' + p['heading'] if p.get('heading') else ''}: {p['text']}")
        for e in knowledge.get("episodes", []):
            lines.append(f"- episodio collegato [{e['when']}]: {e['content']}")
    for e in episodes.get("episodes", []):
        for src in e.get("sources", []):
            if src.get("forgotten"):
                lines.append(f"- NOTA: l'episodio «{e['content'][:60]}…» si riferiva a una fonte poi dimenticata (il suo testo non c'è più).")
    return "\n".join(lines)
