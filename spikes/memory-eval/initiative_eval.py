# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Initiatives (D53, WORK_PLAN 8.12c): what the service decides to say or do on its own from a dataset's sessions.

The sessions go in through REST ingest up to each checkpoint of `initiatives_gold.json`; at each checkpoint the nightly
passes that feed the initiatives run alone for every memory as of the checkpoint (patterns, thoughts — the questions —,
then the initiative sweep: admin `POST memories/{id}/initiatives`), and every initiative created since the last checkpoint
is judged against the gold: which expected item it states (recall; the kind must match, the day it is due must be the
expected one, `for` the expected person), or which trap (an initiative that must not exist), or none (a false initiative).
Precision = matched expected / all initiatives; the sweep runs once a day between checkpoints (the hourly sweep of a real
night, compressed: due dates fall on the day).

Env as run_eval.py's service system (RECORDARE_URL, RECORDARE_ADMIN_KEY, RECORDARE_DB_URL; the service with
ALLOW_CLOCK_OVERRIDE=true). EVAL_DATASET=dataset_dev_initiatives, RUN_TAG names the result file; REUSE_RUN=<run> skips
the ingest and re-runs the passes on an earlier run's memories (intents, initiatives and the passes' runs are cleared).
"""
from __future__ import annotations

import json
import os
import time
from datetime import datetime, timedelta
from pathlib import Path

import psycopg

from evalkit.common import DATASET, RESULTS, USAGE, chat
from systems.service_sys import DB_URL, ServiceSystem

MATCH_SYSTEM = """You compare the initiatives an AI agent decided to take on its own with a gold list.
Each INITIATIVE has a kind (say: a reminder; ask: "did it happen?"; lookup: something to find out), whom it is for, the day
it is due and its text. For each, say which gold item it is — the same thing to remind, ask or look up, for the same
person; wording may differ, the kind and the matter must agree — or "none" when it is none of them. A gold item marked
TRAP describes something that must NOT be said: match it only when the initiative says exactly that.
Output JSON only: {"matches": [{"n": 1, "gold": "<gold id>" | "none"}]}"""


def ts(x: str) -> datetime:
    return datetime.fromisoformat(x)


def ask(system: str, msg: str) -> dict:
    # The judge model reasons before answering and its reasoning counts in max_tokens: on long lists 4000 left nothing for
    # the answer (empty completions). More room, the same judge.
    for max_tokens in (8000, 16000):
        try:
            return json.loads(chat([{"role": "system", "content": system}, {"role": "user", "content": msg}], "judge", json_mode=True, max_tokens=max_tokens))
        except (json.JSONDecodeError, ValueError) as e:
            print(f"  ! judge answer unusable ({e.__class__.__name__}), {'retrying' if max_tokens == 8000 else 'giving up'}", flush=True)
    return {}


def snapshot(ids: dict[str, str], tz: str) -> dict[str, list[dict]]:
    """Every initiative of every memory, with its local due day."""
    with psycopg.connect(DB_URL) as conn:
        rows = conn.execute(
            "SELECT i.memory_id::text, i.id::text, i.kind::text, i.text, i.status::text, p.display_name, "
            "  to_char(i.due_at AT TIME ZONE %s, 'YYYY-MM-DD'), i.reason, i.created_at, i.worth "
            "FROM initiatives i LEFT JOIN persons p ON p.id = i.for_person_id WHERE i.memory_id = ANY(%s::uuid[]) ORDER BY i.seq",
            (tz, list(ids.values()))).fetchall()
    by_id = {v: k for k, v in ids.items()}
    out: dict[str, list[dict]] = {u: [] for u in ids}
    for m, iid, kind, text, status, who, day, reason, created, worth in rows:
        out[by_id[m]].append({"id": iid, "kind": kind, "text": text, "status": status, "for": who or "holder", "due_day": day, "reason": reason,
                              "created": str(created), "worth": worth})
    return out


def label(i: dict) -> str:
    return f"({i['kind']}, for {i['for']}, due {i['due_day']}{'' if i.get('worth') is None else f', worth {i[chr(119)+chr(111)+chr(114)+chr(116)+chr(104)]:.2f}'}) {i['text']}"


def match(user: str, gold: dict, items: list[dict]) -> list[str]:
    """Which gold item each initiative is; a judge call that fails is split in halves down to single items."""
    if not items:
        return []
    lines = [f"- {g['id']}: [{g['kind']}, for {g.get('for', 'holder')}, due {g.get('due_day', '?')}] {g['desc']}" for g in gold.get("expected", [])]
    lines += [f"- {t['id']} (TRAP): {t['desc']}" for t in gold.get("traps", [])]
    head = "GOLD:\n" + "\n".join(lines) + f"\n\nINITIATIVES (memory of {user}):\n"

    def go(lo: int, hi: int) -> dict[int, str]:
        msg = head + "\n".join(f"{n + 1}. {label(items[n])}" for n in range(lo, hi))
        out = ask(MATCH_SYSTEM, msg)
        if out or hi - lo <= 1:
            return {m.get("n"): m.get("gold", "none") for m in out.get("matches", []) if isinstance(m, dict)}
        mid = (lo + hi) // 2
        return {**go(lo, mid), **go(mid, hi)}
    by_n: dict[int, str] = {}
    for lo in range(0, len(items), 10):  # ten at a time from the start: a long list is where the judge ran out of room
        by_n.update(go(lo, min(lo + 10, len(items))))
    return [by_n.get(n + 1, "none") for n in range(len(items))]


def score(gold: dict, snap: dict[str, list[dict]], cp_index: int) -> dict:
    found = due = traps = false = total = wrong_day = wrong_for = dup = 0
    detail = {}
    for user, g in gold.items():
        items = snap.get(user, [])
        matches = match(user, g, items)
        expected = {e["id"]: e for e in g.get("expected", []) if e.get("by", 1) <= cp_index + 1}
        trap_ids = {t["id"] for t in g.get("traps", [])}
        hit: set[str] = set()
        judged = []
        for i, m in zip(items, matches):
            e = expected.get(m) or next((x for x in g.get("expected", []) if x["id"] == m), None)
            ok_day = e is None or not e.get("due_day") or e["due_day"] == i["due_day"]
            ok_for = e is None or (e.get("for", "holder") == i["for"])
            if e and m in expected:
                if m in hit:
                    dup += 1  # the same thing said twice (Kinox 2026-11-07)
                hit.add(m)
                wrong_day += 0 if ok_day else 1
                wrong_for += 0 if ok_for else 1
            elif m in trap_ids:
                traps += 1
            elif not e:
                false += 1
            judged.append({**i, "match": m, "day_ok": ok_day, "for_ok": ok_for})
        found += len(hit); due += len(expected); total += len(items)
        detail[user] = {"due": sorted(expected), "found": sorted(hit), "missed": sorted(set(expected) - hit),
                        "traps_hit": [m for m in matches if m in trap_ids], "initiatives": judged}
    return {"found": found, "due": due, "traps": traps, "false": false, "wrong_day": wrong_day, "wrong_for": wrong_for, "duplicates": dup, "initiatives": total, "detail": detail}


def rescore(path: str) -> None:
    """Judge a saved run again (RESCORE=<result.json>): no ingest, no passes, only the judges."""
    r = json.loads(Path(path).read_text())
    gold = json.loads((DATASET / "initiatives_gold.json").read_text())
    cps = list(r["checkpoints"])
    for i, cp in enumerate(cps):
        s = score(gold["memories"], r["checkpoints"][cp]["initiatives"], i)
        r["checkpoints"][cp]["score"] = s
        print(f"  {cp}: found {s['found']}/{s['due']}  traps {s['traps']}  false {s['false']}  wrong day {s['wrong_day']}  of {s['initiatives']}", flush=True)
    final = r["checkpoints"][cps[-1]]["score"]
    r["score"] = {k: v for k, v in final.items() if k != "detail"}
    r["rescored"] = True
    for user, d in final["detail"].items():
        print(f"{user}: found {d['found']} of {d['due']}; missed {d['missed']}; traps hit {d['traps_hit']}")
        for it in d["initiatives"]:
            print(f"  [{it['match']}{'' if it['day_ok'] else ' DAY?'}] {label(it)}")
    print(f"FOUND {final['found']}/{final['due']}  TRAPS {final['traps']}  FALSE {final['false']}  of {final['initiatives']}")
    Path(path).write_text(json.dumps(r, ensure_ascii=False, indent=1, default=str))


def main() -> None:
    if os.getenv("RESCORE"):
        return rescore(os.environ["RESCORE"])
    conv = json.loads((DATASET / "conversations.json").read_text())
    gold = json.loads((DATASET / "initiatives_gold.json").read_text())
    tz = gold.get("timezone", "Europe/Rome")
    reuse = os.getenv("REUSE_RUN")
    system = ServiceSystem()
    if reuse:
        with psycopg.connect(DB_URL) as conn:
            ids = {u: conn.execute("SELECT person_id::text FROM external_identities WHERE external_id = %s", (f"{u}-{reuse}",)).fetchone()[0] for u in gold["memories"]}
            conn.execute("DELETE FROM initiatives WHERE memory_id = ANY(%s::uuid[])", (list(ids.values()),))
            conn.execute("DELETE FROM intents WHERE memory_id = ANY(%s::uuid[]) AND message_id IS NULL", (list(ids.values()),))
            conn.execute("UPDATE intents SET status = 'armed', attempts = 0, reconsider_at = NULL WHERE memory_id = ANY(%s::uuid[]) AND status IN ('fired', 'expired')", (list(ids.values()),))
            conn.execute("DELETE FROM notes WHERE memory_id = ANY(%s::uuid[]) AND origin = 'reflected'", (list(ids.values()),))
            conn.execute("DELETE FROM episode_promotions WHERE memory_id = ANY(%s::uuid[])", (list(ids.values()),))
            conn.execute("UPDATE memories SET patterns_upto = NULL, thoughts_upto = NULL WHERE person_id = ANY(%s::uuid[])", (list(ids.values()),))
            conn.execute("DELETE FROM extraction_runs WHERE memory_id = ANY(%s::uuid[]) AND kind = 'consolidation'", (list(ids.values()),))
        system.memories = {u: {"id": i} for u, i in ids.items()}
    else:
        for user in gold["memories"]:
            system._account(user)
        ids = system.memory_ids()
    sessions = sorted(conv["sessions"], key=lambda s: ts(s["ts"]))
    done = 0
    result: dict = {"dataset": DATASET.name, "run": system.run, "checkpoints": {}}
    t0 = time.time()
    previous = None
    for i, cp in enumerate(gold["checkpoints"]):
        batch = [s for s in sessions[done:] if ts(s["ts"]) < ts(cp)]
        print(f"checkpoint {cp}: {len(batch)} sessions", flush=True)
        # Sweeps at SWEEP_HOURS local (default one a day at 09:00) between the checkpoints, as the hourly sweep of a real night would (the gold's
        # due days follow), then the checkpoint itself; SWEEP_DAILY=0 keeps the checkpoints only.
        moments = []
        if os.getenv("SWEEP_DAILY", "1") != "0":
            start = ts(previous) if previous else ts(cp) - timedelta(days=10)
            # SWEEP_HOURS: the local hours of the day's sweeps (default 9); same-day follow-ups need several ("9,12,15,18,21").
            hours = [int(h) for h in os.getenv("SWEEP_HOURS", "9").split(",")]
            day = start.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
            while day < ts(cp):
                moments.extend((day + timedelta(hours=h)).isoformat() for h in hours if day + timedelta(hours=h) < ts(cp))
                day += timedelta(days=1)
        moments.append(cp)
        reports = {u: {"patterns": None, "thoughts": None, "sweeps": []} for u in ids}
        # Each sweep sees only what was said before it (2026-11-07: ingesting the whole period first let a later
        # "picked Mum up yesterday" close the reminder before the day it was due — in production a window is extracted
        # within the hour). Patterns and thoughts run at the checkpoint, before its sweep, as before.
        for at in moments:
            now_batch = [s for s in sessions[done:] if ts(s["ts"]) < ts(at)]
            if now_batch and not reuse:
                system.ingest(now_batch)
            done += len(now_batch)
            for user, mid in ids.items():
                if at == cp:
                    for step in ("patterns", "thoughts"):
                        r = system.http.post(f"/api/v1/admin/memories/{mid}/{step}", headers={"x-recordare-now": cp}, timeout=600)
                        r.raise_for_status()
                        reports[user][step] = r.json()
                r = system.http.post(f"/api/v1/admin/memories/{mid}/initiatives", headers={"x-recordare-now": at}, timeout=600)
                r.raise_for_status()
                reports[user]["sweeps"].append({"at": at, **r.json()})
        snap = snapshot(ids, tz)
        s = score(gold["memories"], snap, i)
        result["checkpoints"][cp] = {"reports": reports, "initiatives": snap, "score": s}
        print(f"  found {s['found']}/{s['due']}  traps {s['traps']}  false {s['false']}  wrong day {s['wrong_day']}  wrong for {s['wrong_for']}  dup {s['duplicates']}  of {s['initiatives']}", flush=True)
        previous = cp
    final = result["checkpoints"][gold["checkpoints"][-1]]["score"]
    result["score"] = {k: v for k, v in final.items() if k != "detail"}
    with psycopg.connect(DB_URL) as conn:
        result["prompt_versions"] = sorted(r[0] for r in conn.execute(
            "SELECT DISTINCT prompt_version FROM extraction_runs WHERE memory_id = ANY(%s::uuid[])", (list(ids.values()),)).fetchall())
    result["cost"] = system.cost()
    result["judge_usage"] = USAGE.as_dict()
    result["seconds"] = round(time.time() - t0)
    for user, d in final["detail"].items():
        print(f"\n{user}: found {d['found']} of {d['due']}; missed {d['missed']}; traps hit {d['traps_hit']}")
        for it in d["initiatives"]:
            flags = ("" if it["day_ok"] else " DAY?") + ("" if it["for_ok"] else " FOR?")
            print(f"  [{it['match']}{flags}] {label(it)}")
    print(f"\nFOUND {final['found']}/{final['due']}  TRAPS {final['traps']}  FALSE {final['false']}  of {final['initiatives']}  prompt versions {result['prompt_versions']}")
    RESULTS.mkdir(exist_ok=True)
    out = RESULTS / f"initiatives-{DATASET.name}-{int(time.time())}-{os.getenv('RUN_TAG', 'run')}.json"
    out.write_text(json.dumps(result, ensure_ascii=False, indent=1, default=str))
    print(f"→ {out}")


if __name__ == "__main__":
    main()
