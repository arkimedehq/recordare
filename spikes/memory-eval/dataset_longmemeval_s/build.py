# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""LongMemEval-S (Wu et al., ICLR 2025; code and data MIT: github.com/xiaowu0162/LongMemEval,
huggingface.co/datasets/xiaowu0162/longmemeval-cleaned) converted to the harness format (WORK_PLAN 8.13).

Every question has its own history (~48 sessions, ~120 k tokens), so every question is its own user: a memory of its
own, its sessions, and the question asked as that user at `question_date`. A sample stratified by question type is
taken with a fixed seed (abstention questions, `_abs`, stay in their type and are counted apart).

    curl -L -o raw/longmemeval_s_cleaned.json \\
      https://huggingface.co/datasets/xiaowu0162/longmemeval-cleaned/resolve/main/longmemeval_s_cleaned.json
    python dataset_longmemeval_s/build.py --n 3          # pilot
    python dataset_longmemeval_s/build.py --n 100 --types single-session-assistant   # one type of the same sample
    EVAL_DATASET=dataset_longmemeval_s uv run python run_eval.py --system service

Public benchmark, not blind: never tune prompts on it. Scores use this harness's answer model and judge, not the
paper's GPT-4o judge, so they are not the leaderboard's numbers.
"""
from __future__ import annotations

import argparse
import json
import random
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

HERE = Path(__file__).parent


def iso(when: str) -> str:
    """'2023/05/20 (Sat) 02:21' -> '2023-05-20T02:21:00+00:00' (the dataset has no time zone)."""
    return datetime.strptime(when.split(" (")[0] + " " + when.split(") ")[1], "%Y/%m/%d %H:%M").isoformat() + "+00:00"


def sample(data: list[dict], n: int, seed: int) -> list[dict]:
    """n questions, by type in proportion to the full set (at least one per type when n allows), fixed seed."""
    by_type: dict[str, list[dict]] = defaultdict(list)
    for q in data:
        by_type[q["question_type"]].append(q)
    rng = random.Random(seed)
    types = sorted(by_type, key=lambda t: -len(by_type[t]))
    quota = {t: max(1, round(n * len(by_type[t]) / len(data))) if n >= len(types) else 0 for t in types}
    for t in types[:n] if n < len(types) else []:
        quota[t] = 1
    while sum(quota.values()) > n:
        quota[max(quota, key=quota.get)] -= 1
    while sum(quota.values()) < n:
        quota[types[0]] += 1
    return [q for t in types for q in rng.sample(by_type[t], quota[t])]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=3)
    ap.add_argument("--seed", type=int, default=20261020)
    ap.add_argument("--types", help="comma-separated question types: keep only these of the sample (a change measured "
                    "where it acts, on the same questions)")
    args = ap.parse_args()
    data = json.loads((HERE / "raw" / "longmemeval_s_cleaned.json").read_text())
    chosen = sample(data, args.n, args.seed)
    if args.types:
        chosen = [q for q in chosen if q["question_type"] in args.types.split(",")]

    sessions, questions, users = [], [], {}
    for q in chosen:
        user = f"lme_{q['question_id']}"
        users[user] = f"LongMemEval {q['question_id']}"
        # 76 of the 500 questions have history sessions timed after the question (the same day, a few hours later):
        # the question is asked one minute after the last session, or the harness would hide them.
        last = max(iso(w) for w in q["haystack_dates"])
        asked = max(iso(q["question_date"]), (datetime.fromisoformat(last) + timedelta(minutes=1)).isoformat())
        assert asked[:10] >= max(w for w in q["haystack_dates"])[:10].replace("/", "-"), q["question_id"]
        for sid, when, turns in zip(q["haystack_session_ids"], q["haystack_dates"], q["haystack_sessions"]):
            ts = iso(when)
            sessions.append({"id": f"{q['question_id']}-{sid}", "user": user, "ts": ts,
                             "messages": [{"role": t["role"], "content": t["content"]} for t in turns]})
        questions.append({"id": q["question_id"], "user": user, "asked_at": asked, "q": q["question"],
                          "category": q["question_type"] + ("-abs" if q["question_id"].endswith("_abs") else ""),
                          "expected": str(q["answer"]), "must_not": []})

    note = ("LongMemEval-S (MIT), converted by build.py: one user per question, its haystack sessions, the question "
            f"asked at question_date. Sample of {args.n} of 500, stratified by type, seed {args.seed}"
            f"{f'; only {args.types} ({len(questions)})' if args.types else ''}.")
    (HERE / "conversations.json").write_text(json.dumps(
        {"_note": note, "users": users, "sessions": sessions}, ensure_ascii=False, indent=1))
    (HERE / "questions.json").write_text(json.dumps({"_note": note, "questions": questions}, ensure_ascii=False, indent=1))
    print(f"{len(questions)} questions, {len(sessions)} sessions, "
          f"{sum(len(m['content']) for s in sessions for m in s['messages']) / 1e6:.1f} M chars")
    for q in questions:
        print(f"  {q['id']} [{q['category']}] {q['q']}")


if __name__ == "__main__":
    main()
