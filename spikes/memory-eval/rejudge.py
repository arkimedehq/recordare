# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Judge the stored answers of earlier runs again (a judge change keeps old runs comparable without new ingestion).
Usage, with EVAL_DATASET set to the runs' dataset:
    uv run --directory <this dir> python rejudge.py <run label> [<run label> …]
Reads results/<label>.json, writes results/<label>-rejudged.json and prints the verdicts that changed.
"""
from __future__ import annotations

import json
import sys
from concurrent.futures import ThreadPoolExecutor

from evalkit.common import RESULTS, SCORE, judge, load_questions


def main() -> None:
    questions = {q["id"]: q for q in load_questions()}
    for label in sys.argv[1:]:
        run = json.loads((RESULTS / f"{label}.json").read_text())
        rows = run["rows"]
        with ThreadPoolExecutor(max_workers=8) as pool:
            verdicts = list(pool.map(lambda r: judge(questions[r["id"]], r["answer"]), rows))
        new_rows = [{**r, **v, "old_verdict": r["verdict"]} for r, v in zip(rows, verdicts)]
        scored = [r for r in new_rows if r["verdict"] in SCORE]
        acc = round(sum(SCORE[r["verdict"]] for r in scored) / max(len(scored), 1), 3)
        (RESULTS / f"{label}-rejudged.json").write_text(json.dumps(
            {"summary": {**run["summary"], "accuracy": acc, "accuracy_before": run["summary"]["accuracy"],
                         "judge_errors": len(new_rows) - len(scored)}, "rows": new_rows}, ensure_ascii=False, indent=2))
        print(f"{label}: {run['summary']['accuracy']} → {acc}")
        for r in new_rows:
            if r["verdict"] != r["old_verdict"]:
                print(f"  {r['id']} {r['old_verdict']} → {r['verdict']}: {r.get('reason', '')[:140]}")


if __name__ == "__main__":
    main()
