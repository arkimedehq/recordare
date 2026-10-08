# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""System D — prototype of Recordare's own design (docs/EPISODIC_MEMORY_TODO.md, D1–D22).

Ingest — one engine call per session (a session stands for one idle window, D1):
  - episodes: bi-temporal (`occurred_at` resolved against the message time, `created_at` =
    ingestion), date precision, kind event|plan, people, place, importance, valence /
    feelings / opinion (D21), provenance = session id;
  - plan updates: open plans are shown to the extractor, a later mention confirms or cancels
    them (D10) — a past plan is never turned into an event by itself;
  - profile facts (key → value) with supersession history, so state questions ("what car do
    I have / did I have") have a home. In the service this is the semantic layer (A-MEM for
    now, D26); here it lives in the same call for simplicity (the service keeps D2's two calls).
Consolidation: one daily digest per day with episodes (D8; monthly roll-up skipped, 3 months).
Recall — one call per question on the agent's model (LLM_MODEL) stands for the agent filling
  `search_episodes` params (D12): date range + mode (search | list) + topic. Episodes are filtered by `occurred_at`,
  ranked by vector similarity + importance + recency (D14); list mode returns them
  chronologically; digests for period questions; facts with history; raw-log snippets with
  provenance (D13 fallback, always included here: small and cheap).
"""
from __future__ import annotations

import json
import math
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta

import numpy as np

from evalkit.common import WEEKDAYS_IT, chat, engine_chat_json, fmt_when
from evalkit.embed import embed

SEARCH_TOP_K = 10
LIST_CAP = 30
FACTS_TOP_K = 8
RAW_TOP_K = 3
OPEN_PLAN_DAYS = 90


def calendar(ref: date, back: int, ahead: int) -> str:
    """Explicit weekday → date table: models resolve 'sabato' / 'giovedì prossimo' far more
    reliably when they do not have to compute the calendar themselves."""
    days = [ref + timedelta(days=d) for d in range(-back, ahead + 1)]
    return "\n".join(f"{WEEKDAYS_IT[d.weekday()]} {d.isoformat()}" + ("  ← oggi" if d == ref else "") for d in days)


def to_date(value) -> date | None:
    try:
        return date.fromisoformat(str(value)[:10]) if value else None
    except ValueError:
        return None


EXTRACT_SYSTEM = """You are the memory encoder of a personal assistant. From one chat session \
between the user and the assistant, extract what should be remembered about the user's life.

Return JSON:
{
  "episodes": [{
    "content": "<self-contained sentence in the conversation's language: who, what, where, \
with whom, outcome — no pronouns needing context>",
    "kind": "event" | "plan",
    "occurred_at": "YYYY-MM-DD" | null,      // when it happened / is planned (NOT the message date)
    "occurred_until": "YYYY-MM-DD" | null,   // last day for multi-day events or plans
    "date_precision": "day" | "month" | "approximate" | "unknown",
    "subject": "user" | "family" | "other",  // whose experience: the user, close family, someone else
    "people": ["<names as mentioned, with relation if stated, e.g. 'Marco (cognato)'>"],
    "place": "<place>" | null,
    "importance": 1-10,                      // emotional charge, novelty, self-relevance; explicit "remember" = 10
    "valence": -2..2,                        // how the user felt about it
    "feelings": ["<short tags>"],
    "opinion": "<one-line stance the user expressed>" | null
  }],
  "plan_updates": [{"plan_id": "<id from OPEN PLANS>", "status": "confirmed" | "cancelled", \
"note": "<short>"}],
  "facts": [{"key": "<stable snake_case topic, e.g. car, daughter, wife, brother_in_law, job>", \
"value": "<current value, conversation language>", "supersedes": "<fact id from CURRENT FACTS>" | null}]
}

Rules:
- Resolve relative dates ("ieri", "sabato", "la settimana prossima", "giovedì") against the \
MESSAGE TIME using the CALENDAR. Never use today's real date.
- Write absolute dates in "content" (never "ieri", "oggi", "stasera").
- Something stated as happening today or tonight ("stasera ceno con…", "oggi corro") is an \
"event" on the message date, not a plan.
- News reported without a date ("Giulia ha vinto la gara") happened recently: occurred_at = \
message date, date_precision "approximate".
- Episodes: events the user lived or reports about people close to them, and plans. \
Requests for help, general knowledge questions, how-tos and small talk are NOT episodes.
- When a session confirms an open plan happened, add a plan_update "confirmed" AND an event \
episode with what actually happened. When it says a plan is off, add "cancelled" only.
- A plan is something the user intends or has scheduled; vague wishes are plans with \
date_precision "approximate".
- A change of state the user lived (bought / sold something, moved, changed job) is BOTH an \
event episode on its date AND a fact update.
- Facts: durable state about the user (possessions, family, job, home, habits). If a new \
value replaces a current fact, set "supersedes" to that fact's id. Do not restate unchanged facts.
- Empty lists when there is nothing to remember. Output JSON only."""


DIGEST_SYSTEM = """Write the diary entry of one day for a personal assistant's memory, from the \
episodes below. 1-3 sentences, conversation language, factual, keep names, places and feelings. \
Return JSON {"digest": "<text>"}."""


PLAN_SYSTEM = """You prepare a memory search for a personal assistant. Given today's date, a \
CALENDAR and the user's question, return JSON:
{"from": "YYYY-MM-DD" | null, "to": "YYYY-MM-DD" | null, "mode": "search" | "list", \
"topic": "<what to look for, short, conversation language>" | null}

- from/to: the period the question is about, inclusive; null when no period is implied.
  "questa settimana" = Monday of the current week → today; "la settimana scorsa" = previous \
Monday → Sunday; a month name without year = its most recent occurrence not after today; \
"quest'inverno" = 1 December of the previous year → today; "quest'anno" = 1 January → today.
- mode "list" for overviews of a period ("cosa ho fatto a…") and for counting / enumerating \
("quante volte", "quali…", "che traguardi…"); "search" for a specific fact or event.
- topic: null for a pure period overview; otherwise the subject (e.g. "sciare", "Cervinia", \
"traguardi di Giulia", "macchina")."""


class DSystem:
    name = "d"

    def __init__(self) -> None:
        self.users: dict[str, dict] = {}

    def _store(self, user: str) -> dict:
        return self.users.setdefault(user, {"episodes": [], "facts": [], "raw": [], "digests": {}})

    # ── Ingest ──────────────────────────────────────────────────────────────────

    def ingest(self, sessions: list[dict]) -> None:
        for s in sessions:
            self._encode(self._store(s["user"]), s)
            print(f"  ingested {s['id']}", flush=True)
        for st in self.users.values():
            self._index(st)
            self._consolidate(st)

    def _encode(self, st: dict, s: dict) -> None:
        when = datetime.fromisoformat(s["ts"])
        st["raw"] += [{"session": s["id"], "ts": s["ts"], "role": m["role"], "content": m["content"]}
                      for m in s["messages"]]
        cutoff = when.date() - timedelta(days=OPEN_PLAN_DAYS)
        open_plans = [e for e in st["episodes"] if e["kind"] == "plan" and e["status"] == "open"
                      and (to_date(e["occurred_at"]) or when.date()) >= cutoff]
        current = [f for f in st["facts"] if f["valid_to"] is None]
        user_msg = (
            f"MESSAGE TIME: {fmt_when(s['ts'])}\n\nCALENDAR:\n{calendar(when.date(), 14, 21)}\n\n"
            "OPEN PLANS:\n" + ("\n".join(f"{p['id']}: {p['content']} (date {p['occurred_at']})" for p in open_plans) or "(none)")
            + "\n\nCURRENT FACTS:\n" + ("\n".join(f"{f['id']}: {f['key']} = {f['value']}" for f in current) or "(none)")
            + "\n\nSESSION:\n" + "\n".join(f"{m['role']}: {m['content']}" for m in s["messages"])
        )
        out = engine_chat_json([{"role": "system", "content": EXTRACT_SYSTEM},
                                {"role": "user", "content": user_msg}], phase="ingest")
        for ep in out.get("episodes") or []:
            if not isinstance(ep, dict) or not ep.get("content"):
                continue
            if not to_date(ep.get("occurred_at")) and ep.get("kind") != "plan":
                ep["occurred_at"], ep["date_precision"] = s["ts"][:10], "approximate"  # reported, undated
            st["episodes"].append({
                **ep,
                "id": f"e{len(st['episodes']) + 1}",
                "kind": "plan" if ep.get("kind") == "plan" else "event",
                "status": "open" if ep.get("kind") == "plan" else None,
                "importance": int(ep.get("importance") or 5),
                "created_at": s["ts"],
                "session": s["id"],
            })
        by_id = {e["id"]: e for e in st["episodes"]}
        for upd in out.get("plan_updates") or []:
            plan = by_id.get(str(upd.get("plan_id")))
            if plan and plan["kind"] == "plan" and upd.get("status") in ("confirmed", "cancelled"):
                plan["status"] = upd["status"]
                plan["status_at"] = s["ts"][:10]
                plan["status_note"] = upd.get("note")
        facts_by_id = {f["id"]: f for f in st["facts"]}
        for f in out.get("facts") or []:
            if not isinstance(f, dict) or not f.get("key") or not f.get("value"):
                continue
            if any(c["key"] == f["key"] and c["value"] == f["value"] for c in current):
                continue  # restated, unchanged
            old = facts_by_id.get(str(f.get("supersedes")))
            if old and old["valid_to"] is None:
                old["valid_to"] = s["ts"][:10]
            st["facts"].append({"id": f"f{len(st['facts']) + 1}", "key": f["key"], "value": f["value"],
                                "valid_from": s["ts"][:10], "valid_to": None, "session": s["id"]})

    def _index(self, st: dict) -> None:
        def ep_text(e: dict) -> str:
            extra = " ".join(filter(None, [e.get("place"), ", ".join(e.get("people") or []), e.get("opinion")]))
            return f"{e['content']} {extra}".strip()
        st["ep_vecs"] = embed([ep_text(e) for e in st["episodes"]]) if st["episodes"] else np.zeros((0, 1))
        st["fact_vecs"] = embed([f"{f['key']}: {f['value']}" for f in st["facts"]]) if st["facts"] else np.zeros((0, 1))
        user_raw = [r for r in st["raw"] if r["role"] == "user"]
        st["raw_user"] = user_raw
        st["raw_vecs"] = embed([r["content"] for r in user_raw]) if user_raw else np.zeros((0, 1))

    def _consolidate(self, st: dict) -> None:
        days: dict[str, list[dict]] = {}
        for e in st["episodes"]:
            d = to_date(e.get("occurred_at"))
            if e["kind"] == "event" and d and e.get("date_precision") in ("day", "approximate"):
                days.setdefault(d.isoformat(), []).append(e)

        def digest(item):
            day, eps = item
            out = engine_chat_json([{"role": "system", "content": DIGEST_SYSTEM}, {"role": "user", "content": (
                f"DAY: {fmt_when(day + 'T00:00:00')[:-6]}\nEPISODES:\n" + "\n".join(f"- {e['content']}" for e in eps))}],
                phase="consolidate", max_tokens=600)
            return day, out.get("digest", "")

        # Incremental: only days whose episode set changed since the last consolidation.
        seen = st.setdefault("digest_keys", {})
        changed = {d: eps for d, eps in days.items() if seen.get(d) != tuple(e["id"] for e in eps)}
        with ThreadPoolExecutor(max_workers=8) as pool:
            st["digests"].update(pool.map(digest, sorted(changed.items())))
        seen.update({d: tuple(e["id"] for e in eps) for d, eps in changed.items()})

    # ── Recall ──────────────────────────────────────────────────────────────────

    def context(self, user: str, question: dict) -> str:
        st = self.users.get(user)
        if not st:
            return ""
        now = datetime.fromisoformat(question["asked_at"])
        # The calling agent fills the tool params, so this runs on the agent's model (LLM_MODEL),
        # not on the engine's: a local engine model is tested on Recordare's own work only.
        raw = chat([{"role": "system", "content": PLAN_SYSTEM}, {"role": "user", "content": (
            f"TODAY: {fmt_when(question['asked_at'])}\nCALENDAR:\n{calendar(now.date(), 21, 0)}\n\n"
            f"QUESTION: {question['q']}")}], phase="recall", json_mode=True, max_tokens=2000)
        try:
            plan = json.loads(raw)
        except ValueError:
            plan = {}
        lo, hi = to_date(plan.get("from")), to_date(plan.get("to"))
        mode = plan.get("mode") if plan.get("mode") in ("search", "list") else "search"
        topic = plan.get("topic") or None
        qvec = embed([topic or question["q"]], kind="query")[0]

        eps = st["episodes"]
        sims = st["ep_vecs"] @ qvec if eps else np.zeros(0)

        def in_range(e: dict) -> bool:
            d = to_date(e.get("occurred_at"))
            if lo is None and hi is None:
                return True
            if d is None:
                return False
            end = to_date(e.get("occurred_until")) or d
            return (lo is None or end >= lo) and (hi is None or d <= hi)

        def score(i: int) -> float:
            e = eps[i]
            age = (now.date() - (to_date(e.get("occurred_at")) or to_date(e["created_at"]))).days
            return float(sims[i]) + 0.01 * e["importance"] + 0.03 * math.exp(-max(age, 0) / 90)

        cand = [i for i, e in enumerate(eps) if in_range(e)]
        if mode == "list":
            if topic:
                cand = sorted(cand, key=score, reverse=True)[:LIST_CAP]
            else:
                cand = sorted(cand, key=lambda i: eps[i]["importance"], reverse=True)[:LIST_CAP]
            chosen = sorted(cand, key=lambda i: (eps[i].get("occurred_at") or "", i))
        else:
            chosen = sorted(cand, key=score, reverse=True)[:SEARCH_TOP_K]
        outside = []
        if not chosen and (lo or hi):
            outside = sorted(range(len(eps)), key=score, reverse=True)[:5]

        out = []
        if lo or hi:
            out.append(f"PERIODO CERCATO: {lo or '…'} → {hi or '…'}")
        if mode == "list" and not topic and st["digests"]:
            days = [d for d in sorted(st["digests"]) if (lo is None or d >= lo.isoformat()) and (hi is None or d <= hi.isoformat())]
            if days:
                out.append("DIARIO (riassunti giornalieri):")
                out += [f"- {fmt_when(d + 'T00:00:00')[:-6]}: {st['digests'][d]}" for d in days]
        out.append("EPISODI" + (" (nel periodo)" if lo or hi else "") + ":")
        out += [self._fmt_episode(eps[i]) for i in chosen] or ["- (nessun episodio nel periodo)"]
        if outside:
            out.append("ALTRI EPISODI PERTINENTI (fuori dal periodo cercato):")
            out += [self._fmt_episode(eps[i]) for i in outside]

        if st["facts"]:
            fs = st["fact_vecs"] @ qvec
            keys = []
            for i in np.argsort(-fs):
                k = st["facts"][i]["key"]
                if k not in keys:
                    keys.append(k)
                if len(keys) >= FACTS_TOP_K:
                    break
            out.append("PROFILO (fatti, con storico):")
            for k in keys:
                for f in [f for f in st["facts"] if f["key"] == k]:
                    span = f"dal {f['valid_from']}" + (f" al {f['valid_to']} (non più valido)" if f["valid_to"] else " (attuale)")
                    out.append(f"- {k}: {f['value']} [{span}]")

        if st["raw_user"]:
            rs = st["raw_vecs"] @ embed([question["q"]], kind="query")[0]
            out.append("DALLE CHAT (testo originale):")
            for i in np.argsort(-rs)[:RAW_TOP_K]:
                r = st["raw_user"][i]
                out.append(f"- [{fmt_when(r['ts'])} · sessione {r['session']}] {r['content']}")
        return "\n".join(out)

    @staticmethod
    def _fmt_episode(e: dict) -> str:
        when = e.get("occurred_at") or "data ignota"
        if e.get("occurred_until") and e["occurred_until"] != e.get("occurred_at"):
            when += f" → {e['occurred_until']}"
        if e.get("date_precision") and e["date_precision"] != "day":
            when += f" ({e['date_precision']})"
        d = to_date(e.get("occurred_at"))
        if d and e.get("date_precision") == "day":
            when = f"{WEEKDAYS_IT[d.weekday()]} {when}"
        tag = ""
        if e["kind"] == "plan":
            tag = {"open": "PIANO non confermato", "confirmed": f"PIANO confermato il {e.get('status_at')}",
                   "cancelled": f"PIANO ANNULLATO il {e.get('status_at')}"}[e["status"]]
            if e.get("status_note"):
                tag += f": {e['status_note']}"
            tag = f" [{tag}]"
        extra = []
        if e.get("people"):
            extra.append("con/riguarda: " + ", ".join(e["people"]))
        if e.get("feelings"):
            extra.append("sentimenti: " + ", ".join(e["feelings"]))
        if e.get("opinion"):
            extra.append(f"opinione: {e['opinion']}")
        return (f"- [{when}]{tag} {e['content']}" + (f" ({'; '.join(extra)})" if extra else "")
                + f" — fonte: sessione {e['session']} del {e['created_at'][:10]}")

    def dump(self) -> str:
        """Debug: the extracted memory, for manual review."""
        return json.dumps({u: {k: st[k] for k in ("episodes", "facts", "digests")} for u, st in self.users.items()},
                          ensure_ascii=False, indent=1)
