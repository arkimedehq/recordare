# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Recurring patterns (WORK_PLAN 5.4): what the service's nightly pattern pass draws from a dataset's sessions.

The sessions go in through REST ingest up to each checkpoint of `patterns_gold.json`; at each checkpoint the pattern
pass runs alone for every memory (admin `POST memories/{id}/patterns`, as of the checkpoint). The patterns current at the
last checkpoint are matched by an LLM judge (LLM_MODEL) against the gold: expected patterns (recall) and traps (one-off
events, one trip, wishes, a retold event, the assistant's or a tool's words, a pattern that stopped holding, a habit the
memory already holds as a note). Any current pattern that matches no expected item is a false one.

Env as run_eval.py's service system (RECORDARE_URL, RECORDARE_ADMIN_KEY, RECORDARE_DB_URL; the service with
ALLOW_CLOCK_OVERRIDE=true). EVAL_DATASET=dataset_dev_patterns, RUN_TAG names the result file.
"""
from __future__ import annotations

import json
import os
import time
from datetime import datetime

import psycopg

from evalkit.common import DATASET, RESULTS, USAGE, chat
from systems.service_sys import DB_URL, ServiceSystem

JUDGE_SYSTEM = """You compare the recurring patterns an AI memory drew about people's lives with a gold list.
For each PATTERN, say which gold item it states — the same habit of the same person; details such as the exact weekday \
may be missing, but must not contradict the gold — or "none" when it states no gold item.
Output JSON only: {"matches": [{"n": 1, "gold": "<gold id>" | "none"}]}"""


def ts(x: str) -> datetime:
    return datetime.fromisoformat(x)


def snapshot(ids: dict[str, str]) -> dict[str, list[dict]]:
    """Every pattern of every memory: content, subject, note status, promotion status, evidence count."""
    with psycopg.connect(DB_URL) as conn:
        rows = conn.execute(
            "SELECT p.memory_id::text, p.pattern, p.status::text, n.status::text, pr.display_name, cardinality(p.episode_ids), n.confidence "
            "FROM episode_promotions p LEFT JOIN notes n ON n.id = p.note_id LEFT JOIN persons pr ON pr.id = p.subject_person_id "
            "WHERE p.memory_id = ANY(%s::uuid[]) ORDER BY p.created_at", (list(ids.values()),)).fetchall()
    by_id = {v: k for k, v in ids.items()}
    out: dict[str, list[dict]] = {u: [] for u in ids}
    for m, pattern, status, note_status, subject, n, conf in rows:
        out[by_id[m]].append({"pattern": pattern, "status": status, "note": note_status, "subject": subject, "episodes": n,
                              "confidence": conf})
    return out


def judge(user: str, gold: dict, patterns: list[dict]) -> list[str]:
    if not patterns:
        return []
    items = [*gold.get("expected", []), *gold.get("traps", [])]
    msg = ("GOLD:\n" + "\n".join(f"- {g['id']}: {g['desc']}" for g in items) + "\n\nPATTERNS (memory of " + user + "):\n"
           + "\n".join(f"{i + 1}. {('[' + p['subject'] + '] ') if p['subject'] else ''}{p['pattern']}" for i, p in enumerate(patterns)))
    out = json.loads(chat([{"role": "system", "content": JUDGE_SYSTEM}, {"role": "user", "content": msg}], "judge", json_mode=True, max_tokens=3000))
    by_n = {m.get("n"): m.get("gold", "none") for m in out.get("matches", [])}
    return [by_n.get(i + 1, "none") for i in range(len(patterns))]


def score(gold: dict, memories: dict[str, list[dict]], checkpoint: str | None = None) -> dict:
    """Current patterns only. TP: an expected item found; false: a trap or nothing at all."""
    found = expected = false = traps = 0
    detail = {}
    for user, g in gold.items():
        want = set(g.get("checkpoint_expected", {}).get(checkpoint, [])) if checkpoint else {e["id"] for e in g.get("expected", [])}
        current = [p for p in memories.get(user, []) if p["status"] == "active"]
        matches = judge(user, g, current)
        trap_ids = {t["id"] for t in g.get("traps", [])}
        hit = {m for m in matches if m in want}
        wrong = [current[i]["pattern"] for i, m in enumerate(matches) if m not in want and (checkpoint is None or m in trap_ids or m == "none")]
        if checkpoint:  # an intermediate checkpoint checks only that its expected items exist
            wrong = []
        found += len(hit)
        expected += len(want)
        false += len(wrong)
        traps += sum(1 for m in matches if m in trap_ids and m not in want)
        detail[user] = {"expected": sorted(want), "found": sorted(hit), "false": wrong,
                        "patterns": [{**p, "match": m} for p, m in zip(current, matches)],
                        "other": [p for p in memories.get(user, []) if p["status"] != "active"]}
    return {"found": found, "expected": expected, "false": false, "traps": traps, "detail": detail}


def main() -> None:
    conv = json.loads((DATASET / "conversations.json").read_text())
    gold = json.loads((DATASET / "patterns_gold.json").read_text())
    system = ServiceSystem()
    for user in gold["memories"]:
        system._account(user)
    ids = system.memory_ids()
    sessions = sorted(conv["sessions"], key=lambda s: ts(s["ts"]))
    done = 0
    result: dict = {"dataset": DATASET.name, "run": system.run, "checkpoints": {}}
    t0 = time.time()
    for cp in gold["checkpoints"]:
        batch = [s for s in sessions[done:] if ts(s["ts"]) < ts(cp)]
        print(f"checkpoint {cp}: {len(batch)} sessions", flush=True)
        system.ingest(batch)
        done += len(batch)
        reports = {}
        for user, mid in ids.items():
            r = system.http.post(f"/api/v1/admin/memories/{mid}/patterns", headers={"x-recordare-now": cp}, timeout=600)
            r.raise_for_status()
            reports[user] = r.json()
        snap = snapshot(ids)
        result["checkpoints"][cp] = {"reports": reports, "patterns": snap}
        if cp != gold["checkpoints"][-1]:
            mid_score = score({u: g for u, g in gold["memories"].items() if cp in g.get("checkpoint_expected", {})}, snap, cp)
            result["checkpoints"][cp]["score"] = mid_score
            print(f"  checkpoint expected found {mid_score['found']}/{mid_score['expected']}", flush=True)
    final = score(gold["memories"], result["checkpoints"][gold["checkpoints"][-1]]["patterns"])
    result["score"] = final
    with psycopg.connect(DB_URL) as conn:
        result["prompt_versions"] = sorted(r[0] for r in conn.execute(
            "SELECT DISTINCT prompt_version FROM extraction_runs WHERE memory_id = ANY(%s::uuid[])", (list(ids.values()),)).fetchall())
    result["cost"] = system.cost()
    result["judge_usage"] = USAGE.as_dict()
    result["seconds"] = round(time.time() - t0)

    for user, d in final["detail"].items():
        print(f"\n{user}: found {d['found']} of {d['expected']}")
        for p in d["patterns"]:
            print(f"  [{p['match']}] {('[' + p['subject'] + '] ') if p['subject'] else ''}{p['pattern']} ({p['episodes']} ep., {p['confidence']})")
        for p in d["other"]:
            print(f"  ({p['status']}) {p['pattern']}")
    print(f"\nRECALL {final['found']}/{final['expected']}  FALSE {final['false']} (traps {final['traps']})  prompt versions {result['prompt_versions']}")
    RESULTS.mkdir(exist_ok=True)
    out = RESULTS / f"patterns-{DATASET.name}-{int(time.time())}-{os.getenv('RUN_TAG', 'run')}.json"
    out.write_text(json.dumps(result, ensure_ascii=False, indent=1, default=str))
    print(f"→ {out}")


if __name__ == "__main__":
    main()
