"""Per-stage scoring of the service's extraction against gold annotations (WORK_PLAN 4b.2, HaluMem).

    uv run --directory <this dir> python extraction_eval.py results/<service run>.json dataset_blind3/gold.json

Reads what the engine stored for the run's owner (episodes, plans, facts, notes) and scores it with
the LLM judge (DeepSeek flash, JSON mode):
- episode recall (gold episode found) and date accuracy; plan outcome accuracy;
- unsupported episodes (a detail neither in the episode's source messages nor in the owner's history, or another
  person's claim stored as the owner's);
- facts: current value and history per gold key (slots only); notes recall (notes or facts; partial = half).
"""
from __future__ import annotations

import json
import os
import sys
from datetime import date, datetime

import psycopg

from evalkit.common import chat

DB_URL = os.getenv("RECORDARE_DB_URL", "postgres://recordare:recordare@localhost:5433/recordare")
BATCH = 6


def ask(system: str, user: str) -> dict:
    # Reasoning judges need room: a capped budget returns empty content (spike lesson).
    try:
        raw = chat([{"role": "system", "content": system}, {"role": "user", "content": user}], phase="judge", json_mode=True, max_tokens=16000)
        return json.loads(raw)
    except Exception as err:  # noqa: BLE001 - one failed batch must not abort the scoring
        print(f"  ! scoring batch failed: {type(err).__name__}", flush=True)
        return {}


def load(owner_id: str) -> dict:
    with psycopg.connect(DB_URL) as conn:
        ep = conn.execute(
            # Dates in the owner's timezone: stored instants are local midnights (Europe/Rome in the datasets).
            """SELECT e.id, e.kind, e.content, (e.occurred_at AT TIME ZONE o.timezone)::date, e.date_precision, e.plan_status,
                      e.invalidated_at IS NOT NULL, e.duplicate_of IS NOT NULL, e.author_role, e.stance
               FROM episodes e JOIN owners o ON o.person_id = e.owner_id
               WHERE e.owner_id = %s AND e.deleted_at IS NULL ORDER BY e.occurred_at NULLS LAST""", (owner_id,)).fetchall()
        facts = conn.execute(
            """SELECT f.key, f.value, f.status, (f.valid_from AT TIME ZONE o.timezone)::date, (f.valid_to AT TIME ZONE o.timezone)::date
               FROM facts f JOIN owners o ON o.person_id = f.owner_id
               WHERE f.owner_id = %s AND f.deleted_at IS NULL ORDER BY f.key, f.valid_from NULLS FIRST""",
            (owner_id,)).fetchall()
        notes = conn.execute("SELECT category, content, pending FROM notes WHERE owner_id = %s AND deleted_at IS NULL AND status = 'current'", (owner_id,)).fetchall()
    return {
        "episodes": [{"id": r[0], "kind": r[1], "content": r[2], "date": r[3].isoformat() if r[3] else None, "precision": r[4],
                      "plan_status": r[5], "invalidated": r[6], "duplicate": r[7], "author": r[8], "stance": r[9]} for r in ep],
        "facts": [{"key": r[0], "value": r[1], "status": r[2], "from": r[3].isoformat() if r[3] else None,
                   "to": r[4].isoformat() if r[4] else None} for r in facts],
        "notes": [{"category": r[0], "content": r[1], "pending": r[2]} for r in notes],
    }


def evidence(owner_id: str) -> dict[str, list[str]]:
    """Source messages of each episode: '[date] speaker: text'."""
    with psycopg.connect(DB_URL) as conn:
        rows = conn.execute(
            """SELECT ev.episode_id, (m.sent_at AT TIME ZONE o.timezone)::date, m.role, m.content
               FROM episode_evidence ev JOIN messages m ON m.id = ev.message_id JOIN owners o ON o.person_id = m.owner_id
               WHERE m.owner_id = %s""", (owner_id,)).fetchall()
    out: dict[str, list[str]] = {}
    for ep, day, role, content in rows:
        out.setdefault(ep, []).append(f"[{day}] {'owner' if role == 'user' else role}: {content[:600]}")
    return out


def near(g_date: str | None, e_date: str | None, days: int = 20) -> bool:
    if not g_date or not e_date:
        return True
    g = date.fromisoformat(g_date[:10] if len(g_date) >= 10 else f"{g_date}-01")
    return abs((date.fromisoformat(e_date) - g).days) <= days


MATCH_SYSTEM = """You score a memory extractor against gold annotations. For each GOLD item, find the STORED item \
describing the same event (same event, not just the same topic). Reply JSON {"results":[{"gold":"<gold id>",\
"match":<stored number or 0>,"date_ok":true|false,"outcome_ok":true|false|null}]}. date_ok: the stored date is the \
gold date (precision-aware: a month gold date accepts any day of that month). outcome_ok (plans only): the stored \
status reflects the gold outcome (confirmed / cancelled / rescheduled / unresolved = still open or unknown after its \
date); null for non-plans."""

UNSUPPORTED_SYSTEM = """You check memories a system extracted about the OWNER. Each numbered MEMORY comes with the \
SOURCE messages it was extracted from; the system also knew the owner's earlier history, summarised in BACKGROUND. \
A memory is faithful when every detail is stated in its source or known from the background (names, places, \
relations), dates may be resolved from relative words ("ieri", "sabato") using the message date, and what it says \
about the owner was said or lived by the owner, not merely claimed by another person. Judge each memory as of its \
source: a plan later moved or cancelled is still faithful if the source said so then. Mark unfaithful only a detail \
that is absent from both source and background, contradicts them, or is attributed to the wrong person. Reply JSON \
{"results":[{"memory":<number>,"supported":true|false,"why":"<if false: the unfaithful detail and why>"}]}."""

FACT_SYSTEM = """You compare a person's state facts (gold) with what a memory system stored. For each GOLD key decide \
whether the stored facts (any key name may be used) give the correct CURRENT value and a correct HISTORY of values. \
Reply JSON {"results":[{"gold_key":"<key>","current_ok":true|false,"history_ok":true|false}]}."""

NOTES_SYSTEM = """For each GOLD note about a person decide whether the STORED knowledge (notes and state facts, any \
language) expresses it: "found" (the substance is there, possibly spread over several items or worded differently), \
"partial" (only part of it, e.g. one of several friends) or "missing". Reply JSON \
{"results":[{"gold":<number>,"verdict":"found"|"partial"|"missing"}]}."""


def main() -> None:
    run = json.load(open(sys.argv[1]))["summary"]
    gold = json.load(open(sys.argv[2]))
    owner_id = run["owner_ids"][gold["user"]]
    stored = load(owner_id)
    visible = [e for e in stored["episodes"] if not e["invalidated"] and not e["duplicate"]]

    # Episode recall, dates, plan outcomes (KB_ONLY=1 scores facts and notes only, to check their stability).
    kb_only = bool(os.getenv("KB_ONLY"))
    results = []
    for i in range(0, 0 if kb_only else len(gold["episodes"]), BATCH):
        part = gold["episodes"][i:i + BATCH]
        cands = [e for e in visible if any(near(g.get("date"), e["date"]) for g in part)]
        user = "GOLD:\n" + "\n".join(
            f"{g['id']}: [{g['kind']}] {g['content']} (date {g.get('date')} {g.get('date_precision')}; plan outcome {g.get('plan_outcome')})" for g in part)
        user += "\n\nSTORED:\n" + "\n".join(
            f"{n + 1}: [{e['kind']}{'/' + e['plan_status'] if e['plan_status'] else ''}] {e['content']} (date {e['date']} {e['precision']})"
            for n, e in enumerate(cands))
        results += ask(MATCH_SYSTEM, user).get("results", [])
    found = [r for r in results if r.get("match")]
    plans = [r for r in results if r.get("outcome_ok") is not None]

    # Unsupported stored episodes: grounded in their own source messages (gold does not list every
    # small true event, so "not in gold" is not "invented").
    unsupported = []
    sources = evidence(owner_id)
    background = "\n".join(
        [f"- {f['key']}: " + "; ".join(f"{h['value']} ({h['from']}→{h['to']})" for h in f["history"]) for f in gold["facts"]]
        + [f"- {g.get('date')}: {g['content']}" for g in gold["episodes"]])
    for i in range(0, 0 if kb_only else len(visible), BATCH):
        part = visible[i:i + BATCH]
        user = f"BACKGROUND:\n{background}\n\n" + "\n\n".join(
            f"MEMORY {n + 1}: {e['content']} (date {e['date']})\nSOURCE:\n" + "\n".join(sources.get(e["id"], ["(no source)"]))
            for n, e in enumerate(part))
        for r in ask(UNSUPPORTED_SYSTEM, user).get("results", []):
            idx = int(r.get("memory", 0) or 0)
            if r.get("supported") is False and 1 <= idx <= len(part):
                unsupported.append({"content": part[idx - 1]["content"][:160], "why": r.get("why")})

    # Facts and notes.
    fact_user = "GOLD:\n" + "\n".join(f"{f['key']}: " + "; ".join(f"{h['value']} from {h['from']} to {h['to']}" for h in f["history"]) for f in gold["facts"])
    fact_user += "\n\nSTORED:\n" + "\n".join(f"{f['key']} = {f['value']} [{f['status']}] from {f['from']} to {f['to']}" for f in stored["facts"])
    fact_res = ask(FACT_SYSTEM, fact_user).get("results", [])
    note_user = "GOLD:\n" + "\n".join(f"{n + 1}: [{g['category']}] {g['content']}" for n, g in enumerate(gold["notes"]))
    note_user += "\n\nSTORED:\n" + "\n".join(
        [f"- [{n['category']}] {n['content']}" for n in stored["notes"]]
        + [f"- fact {f['key']} = {f['value']}" for f in stored["facts"] if f["status"] == "current"])
    note_res = ask(NOTES_SYSTEM, note_user).get("results", [])
    note_credit = {"found": 1.0, "partial": 0.5}

    rate = lambda xs, k: round(sum(1 for x in xs if x.get(k)) / max(len(xs), 1), 3)  # noqa: E731
    report = {
        "run": sys.argv[1], "gold_episodes": len(gold["episodes"]), "stored_visible_episodes": len(visible),
        "episode_recall": round(len(found) / max(len(gold["episodes"]), 1), 3),
        "date_accuracy_of_found": rate(found, "date_ok"),
        "plan_outcome_accuracy": rate(plans, "outcome_ok"),
        "unsupported_episodes": len(unsupported), "unsupported_rate": round(len(unsupported) / max(len(visible), 1), 3),
        "facts_current_ok": rate(fact_res, "current_ok"), "facts_history_ok": rate(fact_res, "history_ok"),
        "notes_recall": round(sum(note_credit.get(r.get("verdict"), 0) for r in note_res) / max(len(gold["notes"]), 1), 3),
        "notes_missing": [gold["notes"][int(r["gold"]) - 1]["content"][:80] for r in note_res
                          if r.get("verdict") == "missing" and 1 <= int(r.get("gold", 0) or 0) <= len(gold["notes"])],
        "missed_episodes": [r["gold"] for r in results if not r.get("match")],
        "facts_detail": {r.get("gold_key"): [bool(r.get("current_ok")), bool(r.get("history_ok"))] for r in fact_res},
        "unsupported": unsupported,
        "at": datetime.now().isoformat(timespec="seconds"),
    }
    out = sys.argv[1].replace(".json", "-kb.json" if kb_only else "-extraction.json")
    json.dump(report, open(out, "w"), ensure_ascii=False, indent=1)
    print(json.dumps({k: v for k, v in report.items() if k not in ("unsupported", "missed_episodes", "notes_missing", "facts_detail")}, indent=1))
    print("missed:", report["missed_episodes"])
    for u in unsupported:
        print("unsupported:", u)


if __name__ == "__main__":
    main()
