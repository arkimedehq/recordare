# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Judge validation (WORK_PLAN M0.5.2): run the judge on hand-labelled candidate answers and
measure false accepts (a wrong answer graded correct) and false rejects (a correct answer graded
wrong). Usage:
    uv run --directory <this dir> python judge_eval.py [--dataset dataset|dataset_holdout]
Reads judge_validation/<dataset>.json, writes results/judge-<dataset>.json.
"""
from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor

from evalkit.common import RESULTS, ROOT, judge

VERDICTS = ("correct", "partial", "wrong")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", default="dataset")
    args = ap.parse_args()
    questions = {q["id"]: q for q in json.loads((ROOT / args.dataset / "questions.json").read_text())["questions"]}
    items = json.loads((ROOT / "judge_validation" / f"{args.dataset}.json").read_text())["items"]

    with ThreadPoolExecutor(max_workers=8) as pool:
        verdicts = list(pool.map(lambda it: judge(questions[it["qid"]], it["answer"]), items))

    confusion: dict[str, Counter] = defaultdict(Counter)  # expected -> judged
    by_variant: dict[str, Counter] = defaultdict(Counter)
    errors = []
    for it, v in zip(items, verdicts):
        got = v["verdict"]
        confusion[it["expected_verdict"]][got] += 1
        by_variant[it["variant"]]["ok" if got == it["expected_verdict"] else "ko"] += 1
        if got != it["expected_verdict"]:
            errors.append({**it, "judged": got, "reason": v.get("reason", "")})

    wrong_total = sum(confusion["wrong"].values()) or 1
    correct_total = sum(confusion["correct"].values()) or 1
    summary = {
        "dataset": args.dataset,
        "items": len(items),
        "agreement": round(sum(confusion[e][e] for e in VERDICTS) / len(items), 3),
        # wrong answers graded correct (partial counted separately: it still earns 0.5)
        "false_accept_rate": round(confusion["wrong"]["correct"] / wrong_total, 3),
        "wrong_graded_partial_rate": round(confusion["wrong"]["partial"] / wrong_total, 3),
        "false_reject_rate": round(confusion["correct"]["wrong"] / correct_total, 3),
        "correct_graded_partial_rate": round(confusion["correct"]["partial"] / correct_total, 3),
        "confusion": {e: dict(confusion[e]) for e in VERDICTS},
        "by_variant": {k: dict(c) for k, c in sorted(by_variant.items())},
    }
    RESULTS.mkdir(exist_ok=True)
    (RESULTS / f"judge-{args.dataset}.json").write_text(
        json.dumps({"summary": summary, "errors": errors}, ensure_ascii=False, indent=2))
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    for e in errors:
        print(f"{e['qid']} {e['variant']}: expected {e['expected_verdict']}, judged {e['judged']} — {e['reason'][:140]}")


if __name__ == "__main__":
    main()
