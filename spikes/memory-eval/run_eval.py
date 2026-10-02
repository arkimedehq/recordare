"""Run the memory-engine comparison for one system.

Usage (from this directory):
    uv run --directory <this dir> python run_eval.py --system baseline [--only q01,q02]

Writes results/<system>.json and prints a per-category summary.
"""
from __future__ import annotations

import argparse
import os
import json
import time
from collections import defaultdict

from evalkit.common import DATASET, RESULTS, SCORE, USAGE, answer, judge, load_questions, load_sessions

USER = "luca"


def build(system: str):
    if system == "baseline":
        from systems.baseline import Baseline
        return Baseline()
    if system == "graphiti":
        from systems.graphiti_sys import GraphitiSystem
        return GraphitiSystem()
    if system == "d":
        from systems.d_sys import DSystem
        return DSystem()
    if system == "memobase":
        from systems.memobase_sys import MemobaseSystem
        return MemobaseSystem()
    raise SystemExit(f"unknown system: {system}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--system", required=True)
    ap.add_argument("--only", help="comma-separated question ids")
    ap.add_argument("--noise", action="store_true", help="add dataset/noise.json sessions")
    args = ap.parse_args()
    label = args.system + ("-noise" if args.noise else "")
    if os.getenv("EMBED_MODEL"):
        label += "-emb_" + os.environ["EMBED_MODEL"].split("/")[-1].replace(":", "_")
    if os.getenv("ENGINE_MODEL") and args.system != "baseline":
        label += f"-{os.environ['ENGINE_MODEL']}" + ("-nothink" if os.getenv("ENGINE_NO_THINKING") else "")

    sys_ = build(args.system)
    t0 = time.time()
    sessions = load_sessions()
    if args.noise:
        sessions = sorted(sessions + json.loads((DATASET / "noise.json").read_text())["sessions"],
                          key=lambda s: s["ts"])
    sys_.ingest(sessions)
    ingest_s = time.time() - t0

    questions = load_questions()
    if args.only:
        wanted = set(args.only.split(","))
        questions = [q for q in questions if q["id"] in wanted]

    rows, latencies = [], []
    for q in questions:
        t = time.time()
        ctx = sys_.context(USER, q)
        latencies.append(time.time() - t)
        ans = answer(q, ctx)
        verdict = judge(q, ans)
        rows.append({"id": q["id"], "category": q["category"], "q": q["q"], "expected": q["expected"],
                     "context": ctx, "answer": ans, **verdict})
        print(f"{q['id']} [{verdict['verdict']:>7}] {q['q']}\n        → {ans[:160]}")

    by_cat = defaultdict(list)
    for r in rows:
        by_cat[r["category"]].append(SCORE[r["verdict"]])
    total = sum(SCORE[r["verdict"]] for r in rows) / max(len(rows), 1)
    summary = {
        "system": label,
        "sessions": len(sessions),
        "embed_model": __import__("evalkit.embed", fromlist=["MODEL"]).MODEL,
        "accuracy": round(total, 3),
        "by_category": {c: round(sum(v) / len(v), 2) for c, v in sorted(by_cat.items())},
        "ingest_seconds": round(ingest_s, 1),
        "retrieval_p50_ms": round(sorted(latencies)[len(latencies) // 2] * 1000) if latencies else None,
        "usage": USAGE.as_dict(),
    }
    RESULTS.mkdir(exist_ok=True)
    (RESULTS / f"{label}.json").write_text(
        json.dumps({"summary": summary, "rows": rows}, ensure_ascii=False, indent=2))
    if hasattr(sys_, "dump"):
        (RESULTS / f"{label}-memory.json").write_text(sys_.dump())
    print("\n" + json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
