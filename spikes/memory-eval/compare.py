# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Paired comparison of two multi-run results (WORK_PLAN 4b.2, MemDelta).

    uv run --directory <this dir> python compare.py results/A-agg.json results/B-agg.json

Uses per-question mean scores over runs; paired bootstrap over questions gives the mean
difference (B − A) with a 95% interval and the share of resamples where B > A. Differences
whose interval crosses 0 are reported as "within noise".
"""
from __future__ import annotations

import json
import random
import sys
from collections import defaultdict


def main() -> None:
    a = json.load(open(sys.argv[1]))
    b = json.load(open(sys.argv[2]))
    qs = sorted(set(a["per_question"]) & set(b["per_question"]))
    diffs = [b["per_question"][q] - a["per_question"][q] for q in qs]
    rng = random.Random(7)
    boots = []
    for _ in range(10_000):
        sample = [diffs[rng.randrange(len(diffs))] for _ in diffs]
        boots.append(sum(sample) / len(sample))
    boots.sort()
    mean = sum(diffs) / len(diffs)
    lo, hi = boots[249], boots[9749]
    by_cat: dict[str, list[float]] = defaultdict(list)
    for q, d in zip(qs, diffs):
        by_cat[a["categories"].get(q, "?")].append(d)
    print(json.dumps({
        "A": a["system"], "B": b["system"], "questions": len(qs),
        "A_mean": a["accuracy_mean"], "B_mean": b["accuracy_mean"],
        "diff_B_minus_A": round(mean, 3), "ci95": [round(lo, 3), round(hi, 3)],
        "p_B_better": round(sum(1 for x in boots if x > 0) / len(boots), 3),
        "verdict": "within noise" if lo <= 0 <= hi else ("B better" if lo > 0 else "A better"),
        "by_category": {c: round(sum(v) / len(v), 2) for c, v in sorted(by_cat.items())},
        "changed_questions": {q: round(d, 2) for q, d in zip(qs, diffs) if abs(d) >= 0.34},
    }, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
