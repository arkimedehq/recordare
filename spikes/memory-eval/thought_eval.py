# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""The agent's own thoughts (D53, WORK_PLAN 8.12a) and self-model (8.12b): what the service's thought pass draws from a
dataset's sessions. The gold is `thoughts_gold.json` or `self_gold.json`, whichever the dataset has.

The sessions go in through REST ingest up to each checkpoint of `thoughts_gold.json`; at each checkpoint the nightly
passes that come before a thought run alone for every memory, as of the checkpoint: the pattern pass, then the thought
pass (admin `POST memories/{id}/patterns`, `…/thoughts`). Two LLM judges (LLM_MODEL):
- matching: which gold item each thought states — an expected thought (recall), a trap, or none;
- support: whether the episodes a thought cites back it (a thought they do not back is a false thought, whatever the gold).
Scored at each checkpoint: expected thoughts due by it found among the current ones; one expected to be retired by it no
longer current; traps hit (a rumination trap, `[7]` in its `why`, only by a thought written after the first checkpoint);
false thoughts (not backed by their episodes).

Env as run_eval.py's service system (RECORDARE_URL, RECORDARE_ADMIN_KEY, RECORDARE_DB_URL; the service with
ALLOW_CLOCK_OVERRIDE=true). EVAL_DATASET=dataset_dev_thoughts, RUN_TAG names the result file.
"""
from __future__ import annotations

import json
import os
import time
from datetime import datetime

import psycopg

from evalkit.common import DATASET, RESULTS, USAGE, chat
from systems.service_sys import DB_URL, ServiceSystem

MATCH_SYSTEM = """You compare the thoughts an AI agent drew about its own life with a gold list.
For each THOUGHT, say which gold item it states — the same claim or the same question about the same person or \
situation; wording and details may differ but must not contradict the gold — or "none" when it states no gold item. \
Being about the same topic is not enough: a question about a topic does not state a gold claim about that topic, and a \
thought about what to do in a situation does not state a gold judgement of someone's character. Match a gold item that \
describes a kind of thought ("a habit as a thought", "a second thought about X") only when the thought is exactly that.
Output JSON only: {"matches": [{"n": 1, "gold": "<gold id>" | "none"}]}"""

SUPPORT_SYSTEM = """You check whether a thought an AI agent drew is backed by the episodes it cites.
"yes": the episodes clearly show what the thought says (an insight or opinion may draw a reasonable conclusion or \
suggestion from them; a question may ask about a gap they leave; a self thought — what the agent learned about itself — \
may rest on its replies, "ME:", and what the person said next, "THEY:"). "partly": some of it goes beyond the episodes. "no": \
the episodes do not show it, or it states more than they give (a judgement of someone's character, a cause or a habit \
they do not show, a certainty they do not have).
Output JSON only: {"verdicts": [{"n": 1, "support": "yes" | "partly" | "no", "why": "<short>"}]}"""


def ts(x: str) -> datetime:
    return datetime.fromisoformat(x)


def snapshot(ids: dict[str, str]) -> dict[str, list[dict]]:
    """Every thought of every memory: content, kind, subject, status, support, and the episodes it cites."""
    with psycopg.connect(DB_URL) as conn:
        rows = conn.execute(
            "SELECT p.memory_id::text, n.id::text, n.content, n.category::text, p.status::text, pr.display_name, n.support_count, n.confidence, "
            "  ARRAY(SELECT '[' || COALESCE(to_char(e.occurred_at AT TIME ZONE 'Europe/Rome', 'YYYY-MM-DD'), 'undated') || '] ' || e.content "
            "    FROM note_evidence x JOIN episodes e ON e.id = x.episode_id WHERE x.note_id = n.id AND NOT x.against ORDER BY e.occurred_at), "
            "  ARRAY(SELECT e.content FROM note_evidence x JOIN episodes e ON e.id = x.episode_id WHERE x.note_id = n.id AND x.against ORDER BY e.occurred_at), "
            "  ARRAY(SELECT '[' || to_char(m.sent_at AT TIME ZONE 'Europe/Rome', 'YYYY-MM-DD') || '] ' || CASE WHEN m.role = 'assistant' THEN 'ME: ' ELSE 'THEY: ' END || left(m.content, 300) "
            "    FROM note_evidence x JOIN messages m ON m.id = x.message_id WHERE x.note_id = n.id AND NOT x.against ORDER BY m.sent_at) "
            "FROM episode_promotions p JOIN notes n ON n.id = p.note_id LEFT JOIN persons pr ON pr.id = p.subject_person_id "
            "WHERE p.memory_id = ANY(%s::uuid[]) AND p.kind = 'thought' ORDER BY p.created_at", (list(ids.values()),)).fetchall()
    by_id = {v: k for k, v in ids.items()}
    out: dict[str, list[dict]] = {u: [] for u in ids}
    for m, nid, content, kind, status, subject, support, conf, ev, against, msgs in rows:
        out[by_id[m]].append({"id": nid, "thought": content, "kind": kind, "status": status, "subject": subject, "support": support,
                              "confidence": conf, "episodes": ev + msgs, "against": against})
    return out


def label(t: dict) -> str:
    return f"({t['kind']}) {('[' + t['subject'] + '] ') if t['subject'] else ''}{t['thought']}"


def ask(system: str, msg: str) -> dict:
    """A judge call; a truncated or malformed answer is tried once more with room to spare, then counts as no answer."""
    for max_tokens in (4000, 8000):
        try:
            return json.loads(chat([{"role": "system", "content": system}, {"role": "user", "content": msg}], "judge", json_mode=True, max_tokens=max_tokens))
        except (json.JSONDecodeError, ValueError) as e:
            print(f"  ! judge answer unusable ({e.__class__.__name__}), {'retrying' if max_tokens == 4000 else 'giving up'}", flush=True)
    return {}


def match(user: str, gold: dict, thoughts: list[dict]) -> list[str]:
    if not thoughts:
        return []
    items = [*gold.get("expected", []), *gold.get("traps", [])]
    msg = ("GOLD:\n" + "\n".join(f"- {g['id']}: {g['desc']}" for g in items) + "\n\nTHOUGHTS (memory of " + user + "):\n"
           + "\n".join(f"{i + 1}. {label(t)}" for i, t in enumerate(thoughts)))
    out = ask(MATCH_SYSTEM, msg)
    by_n = {m.get("n"): m.get("gold", "none") for m in out.get("matches", [])}
    return [by_n.get(i + 1, "none") for i in range(len(thoughts))]


def support(thoughts: list[dict]) -> list[dict]:
    if not thoughts:
        return []
    msg = "\n\n".join(f"THOUGHT {i + 1}: {label(t)}\nEPISODES:\n" + "\n".join(f"- {e}" for e in t["episodes"]) for i, t in enumerate(thoughts))
    out = ask(SUPPORT_SYSTEM, msg)
    by_n = {v.get("n"): v for v in out.get("verdicts", [])}
    return [{"backed": by_n.get(i + 1, {}).get("support", "unjudged"), "why": by_n.get(i + 1, {}).get("why", "")} for i in range(len(thoughts))]


def score(gold: dict, snap: dict[str, list[dict]], cp_index: int, first_ids: set[str]) -> dict:
    found = due = retired_ok = retired_due = trap_hits = false = partly = total = unjudged = 0
    detail = {}
    for user, g in gold.items():
        current = [t for t in snap.get(user, []) if t["status"] == "active"]
        matches = match(user, g, current)
        checks = support(current)
        want = {e["id"] for e in g.get("expected", []) if e.get("by", 1) <= cp_index + 1 and e.get("retired_at", 99) > cp_index + 1}
        gone = {e["id"] for e in g.get("expected", []) if e.get("retired_at", 99) <= cp_index + 1}
        rumination = {t["id"] for t in g.get("traps", []) if "[7]" in t.get("why", "")}
        traps = {t["id"] for t in g.get("traps", [])} - rumination
        hit = {m for m in matches if m in want}
        hits = [m for i, m in enumerate(matches) if m in traps or (m in rumination and current[i]["id"] not in first_ids)]
        found += len(hit); due += len(want)
        retired_due += len(gone); retired_ok += len(gone - set(matches))
        trap_hits += len(hits)
        false += sum(1 for c in checks if c["backed"] == "no"); partly += sum(1 for c in checks if c["backed"] == "partly")
        unjudged += sum(1 for c in checks if c["backed"] == "unjudged")
        total += len(current)
        detail[user] = {"due": sorted(want), "found": sorted(hit), "retired_due": sorted(gone), "traps_hit": hits,
                        "thoughts": [{**t, "match": m, **c} for t, m, c in zip(current, matches, checks)],
                        "other": [t for t in snap.get(user, []) if t["status"] != "active"]}
    return {"found": found, "due": due, "retired_ok": retired_ok, "retired_due": retired_due, "traps": trap_hits,
            "false": false, "partly": partly, "unjudged": unjudged, "thoughts": total, "detail": detail}


def main() -> None:
    conv = json.loads((DATASET / "conversations.json").read_text())
    gold = json.loads(next(DATASET / f for f in ("thoughts_gold.json", "self_gold.json") if (DATASET / f).exists()).read_text())
    reuse = os.getenv("REUSE_RUN")  # an earlier run's memories, already extracted: only the nightly passes again
    system = ServiceSystem()
    if reuse:
        with psycopg.connect(DB_URL) as conn:
            ids = {u: conn.execute("SELECT person_id::text FROM external_identities WHERE external_id = %s", (f"{u}-{reuse}",)).fetchone()[0]
                   for u in gold["memories"]}
            # A clean slate for what the passes write: their notes, registers and watermarks.
            conn.execute("DELETE FROM notes WHERE memory_id = ANY(%s::uuid[]) AND origin = 'reflected'", (list(ids.values()),))
            conn.execute("DELETE FROM episode_promotions WHERE memory_id = ANY(%s::uuid[])", (list(ids.values()),))
            conn.execute("UPDATE memories SET patterns_upto = NULL, thoughts_upto = NULL WHERE person_id = ANY(%s::uuid[])", (list(ids.values()),))
            # One thought prompt version per run (rule 9): the earlier passes' runs go with what they wrote.
            conn.execute("DELETE FROM extraction_runs WHERE memory_id = ANY(%s::uuid[]) AND kind = 'consolidation'", (list(ids.values()),))
        system.memories = {u: {"id": i} for u, i in ids.items()}
    else:
        for user in gold["memories"]:
            system._account(user)
        ids = system.memory_ids()
    sessions = sorted(conv["sessions"], key=lambda s: ts(s["ts"]))
    done = 0
    first_ids: set[str] = set()
    result: dict = {"dataset": DATASET.name, "run": system.run, "checkpoints": {}}
    t0 = time.time()
    for i, cp in enumerate(gold["checkpoints"]):
        batch = [s for s in sessions[done:] if ts(s["ts"]) < ts(cp)]
        print(f"checkpoint {cp}: {len(batch)} sessions", flush=True)
        if not reuse:
            system.ingest(batch)
        done += len(batch)
        reports = {}
        for user, mid in ids.items():
            reports[user] = {}
            for step in ("patterns", "thoughts"):
                r = system.http.post(f"/api/v1/admin/memories/{mid}/{step}", headers={"x-recordare-now": cp}, timeout=600)
                r.raise_for_status()
                reports[user][step] = r.json()
        snap = snapshot(ids)
        if i == 0:
            first_ids = {t["id"] for ts_ in snap.values() for t in ts_}
        s = score(gold["memories"], snap, i, first_ids)
        result["checkpoints"][cp] = {"reports": reports, "thoughts": snap, "score": s}
        print(f"  found {s['found']}/{s['due']}  retired {s['retired_ok']}/{s['retired_due']}  traps {s['traps']}  "
              f"false {s['false']} partly {s['partly']} unjudged {s['unjudged']} of {s['thoughts']}", flush=True)
    final = result["checkpoints"][gold["checkpoints"][-1]]["score"]
    result["score"] = {k: v for k, v in final.items() if k != "detail"}
    with psycopg.connect(DB_URL) as conn:
        result["prompt_versions"] = sorted(r[0] for r in conn.execute(
            "SELECT DISTINCT prompt_version FROM extraction_runs WHERE memory_id = ANY(%s::uuid[])", (list(ids.values()),)).fetchall())
    result["cost"] = system.cost()
    result["judge_usage"] = USAGE.as_dict()
    result["seconds"] = round(time.time() - t0)

    for user, d in final["detail"].items():
        print(f"\n{user}: found {d['found']} of {d['due']}; traps hit {d['traps_hit']}")
        for t in d["thoughts"]:
            print(f"  [{t['match']} · {t['backed']}] {label(t)} (support {t['support']}, {len(t['episodes'])} ep.)"
                  + (f" — {t['why']}" if t["backed"] != "yes" else ""))
        for t in d["other"]:
            print(f"  ({t['status']}) {label(t)}")
    print(f"\nFOUND {final['found']}/{final['due']}  RETIRED {final['retired_ok']}/{final['retired_due']}  TRAPS {final['traps']}  "
          f"FALSE {final['false']} PARTLY {final['partly']} of {final['thoughts']}  prompt versions {result['prompt_versions']}")
    RESULTS.mkdir(exist_ok=True)
    out = RESULTS / f"thoughts-{DATASET.name}-{int(time.time())}-{os.getenv('RUN_TAG', 'run')}.json"
    out.write_text(json.dumps(result, ensure_ascii=False, indent=1, default=str))
    print(f"→ {out}")


if __name__ == "__main__":
    main()
