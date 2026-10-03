"""Per-stage scoring of the service's extraction against gold annotations (WORK_PLAN 4b.2, HaluMem).

    uv run --directory <this dir> python extraction_eval.py results/<service run>.json dataset_blind3/gold.json

Reads what the engine stored for the run's owner (episodes, plans, facts, notes) and scores it with
the LLM judge (DeepSeek flash, JSON mode):
- episode recall (gold episode found) and date accuracy; plan outcome accuracy;
- unsupported episodes (stored but not in gold: invented, other people's claims, noise);
- facts: current value and history per gold key; notes recall.
"""
from __future__ import annotations

import json
import os
import sys
from datetime import date, datetime

import psycopg

from evalkit.common import chat

DB_URL = os.getenv("RECORDARE_DB_URL", "postgres://recordare:recordare@localhost:5433/recordare")
BATCH = 12


def ask(system: str, user: str) -> dict:
    raw = chat([{"role": "system", "content": system}, {"role": "user", "content": user}], phase="judge", json_mode=True, max_tokens=4000)
    try:
        return json.loads(raw)
    except ValueError:
        return {}


def load(owner_id: str) -> dict:
    with psycopg.connect(DB_URL) as conn:
        ep = conn.execute(
            """SELECT id, kind, content, occurred_at, date_precision, plan_status, invalidated_at IS NOT NULL,
                      duplicate_of IS NOT NULL, author_role, stance
               FROM episodes WHERE owner_id = %s AND deleted_at IS NULL ORDER BY occurred_at NULLS LAST""", (owner_id,)).fetchall()
        facts = conn.execute(
            "SELECT key, value, status, valid_from, valid_to FROM facts WHERE owner_id = %s AND deleted_at IS NULL ORDER BY key, valid_from NULLS FIRST",
            (owner_id,)).fetchall()
        notes = conn.execute("SELECT category, content, pending FROM notes WHERE owner_id = %s AND deleted_at IS NULL AND status = 'current'", (owner_id,)).fetchall()
    return {
        "episodes": [{"id": r[0], "kind": r[1], "content": r[2], "date": r[3].date().isoformat() if r[3] else None, "precision": r[4],
                      "plan_status": r[5], "invalidated": r[6], "duplicate": r[7], "author": r[8], "stance": r[9]} for r in ep],
        "facts": [{"key": r[0], "value": r[1], "status": r[2], "from": r[3].date().isoformat() if r[3] else None,
                   "to": r[4].date().isoformat() if r[4] else None} for r in facts],
        "notes": [{"category": r[0], "content": r[1], "pending": r[2]} for r in notes],
    }


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

UNSUPPORTED_SYSTEM = """You check stored memories against the gold memory of a person. For each STORED item answer \
whether it is supported by the GOLD list (same event or a faithful detail of it). Reply JSON \
{"results":[{"stored":<number>,"supported":true|false,"why":"<if false: invented | other person's claim | noise | \
duplicate>"}]}."""

FACT_SYSTEM = """You compare a person's state facts (gold) with what a memory system stored. For each GOLD key decide \
whether the stored facts (any key name may be used) give the correct CURRENT value and a correct HISTORY of values. \
Reply JSON {"results":[{"gold_key":"<key>","current_ok":true|false,"history_ok":true|false}]}."""

NOTES_SYSTEM = """For each GOLD note decide whether a STORED note expresses it. Reply JSON \
{"results":[{"gold":<number>,"found":true|false}]}."""


def main() -> None:
    run = json.load(open(sys.argv[1]))["summary"]
    gold = json.load(open(sys.argv[2]))
    owner_id = run["owner_ids"][gold["user"]]
    stored = load(owner_id)
    visible = [e for e in stored["episodes"] if not e["invalidated"] and not e["duplicate"]]

    # Episode recall, dates, plan outcomes.
    results = []
    for i in range(0, len(gold["episodes"]), BATCH):
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

    # Unsupported stored episodes.
    unsupported = []
    gold_list = "\n".join(f"- {g['content']} ({g.get('date')})" for g in gold["episodes"])
    for i in range(0, len(visible), BATCH):
        part = visible[i:i + BATCH]
        user = f"GOLD:\n{gold_list}\n\nSTORED:\n" + "\n".join(f"{n + 1}: {e['content']} ({e['date']})" for n, e in enumerate(part))
        for r in ask(UNSUPPORTED_SYSTEM, user).get("results", []):
            if r.get("supported") is False and 1 <= int(r.get("stored", 0)) <= len(part):
                unsupported.append({"content": part[int(r["stored"]) - 1]["content"][:160], "why": r.get("why")})

    # Facts and notes.
    fact_user = "GOLD:\n" + "\n".join(f"{f['key']}: " + "; ".join(f"{h['value']} from {h['from']} to {h['to']}" for h in f["history"]) for f in gold["facts"])
    fact_user += "\n\nSTORED:\n" + "\n".join(f"{f['key']} = {f['value']} [{f['status']}] from {f['from']} to {f['to']}" for f in stored["facts"])
    fact_res = ask(FACT_SYSTEM, fact_user).get("results", [])
    note_user = "GOLD:\n" + "\n".join(f"{n + 1}: [{g['category']}] {g['content']}" for n, g in enumerate(gold["notes"]))
    note_user += "\n\nSTORED:\n" + "\n".join(f"- [{n['category']}] {n['content']}" for n in stored["notes"])
    note_res = ask(NOTES_SYSTEM, note_user).get("results", [])

    rate = lambda xs, k: round(sum(1 for x in xs if x.get(k)) / max(len(xs), 1), 3)  # noqa: E731
    report = {
        "run": sys.argv[1], "gold_episodes": len(gold["episodes"]), "stored_visible_episodes": len(visible),
        "episode_recall": round(len(found) / max(len(gold["episodes"]), 1), 3),
        "date_accuracy_of_found": rate(found, "date_ok"),
        "plan_outcome_accuracy": rate(plans, "outcome_ok"),
        "unsupported_episodes": len(unsupported), "unsupported_rate": round(len(unsupported) / max(len(visible), 1), 3),
        "facts_current_ok": rate(fact_res, "current_ok"), "facts_history_ok": rate(fact_res, "history_ok"),
        "notes_recall": rate(note_res, "found"),
        "missed_episodes": [r["gold"] for r in results if not r.get("match")],
        "unsupported": unsupported,
        "at": datetime.now().isoformat(timespec="seconds"),
    }
    out = sys.argv[1].replace(".json", "-extraction.json")
    json.dump(report, open(out, "w"), ensure_ascii=False, indent=1)
    print(json.dumps({k: v for k, v in report.items() if k not in ("unsupported", "missed_episodes")}, indent=1))
    print("missed:", report["missed_episodes"])
    for u in unsupported:
        print("unsupported:", u)


if __name__ == "__main__":
    main()
