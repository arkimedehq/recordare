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
from datetime import datetime
from collections import defaultdict

from evalkit.common import DATASET, RESULTS, SCORE, USAGE, answer, eval_user, judge, load_questions, load_sessions



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
    if system == "service":
        from systems.service_sys import ServiceSystem
        return ServiceSystem()
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
    if DATASET.name != "dataset":
        label += f"-{DATASET.name}"
    if os.getenv("EMBED_MODEL"):
        label += "-emb_" + os.environ["EMBED_MODEL"].split("/")[-1].replace(":", "_")
    if os.getenv("ENGINE_MODEL") and args.system != "baseline":
        label += f"-{os.environ['ENGINE_MODEL']}" + ("-nothink" if os.getenv("ENGINE_NO_THINKING") else "")

    sys_ = build(args.system)
    sessions = load_sessions()
    if args.noise:
        sessions = sorted(sessions + json.loads((DATASET / "noise.json").read_text())["sessions"],
                          key=lambda s: s["ts"])
    if hasattr(sys_, "reset"):
        sys_.reset({s["user"] for s in sessions})

    questions = load_questions()
    if args.only:
        wanted = set(args.only.split(","))
        questions = [q for q in questions if q["id"] in wanted]

    # Ingest incrementally up to each question's asked_at: a system must never see sessions from
    # after the moment the question is asked (mid-period questions like "this week").
    def when(iso: str) -> datetime:
        return datetime.fromisoformat(iso)

    rows, latencies, ingest_s, done = [], [], 0.0, 0
    for q in sorted(questions, key=lambda q: when(q["asked_at"])):
        batch = []
        while done < len(sessions) and when(sessions[done]["ts"]) <= when(q["asked_at"]):
            batch.append(sessions[done])
            done += 1
        if batch:
            t0 = time.time()
            sys_.ingest(batch)
            ingest_s += time.time() - t0
        t = time.time()
        ctx = sys_.context(eval_user(), q)
        latencies.append(time.time() - t)
        ans = answer(q, ctx)
        verdict = judge(q, ans)
        rows.append({"id": q["id"], "category": q["category"], "q": q["q"], "expected": q["expected"],
                     "context": ctx, "answer": ans, **verdict})
        print(f"{q['id']} [{verdict['verdict']:>7}] {q['q']}\n        → {ans[:160]}")

    rows.sort(key=lambda r: r["id"])
    scored = [r for r in rows if r["verdict"] in SCORE]
    by_cat = defaultdict(list)
    for r in scored:
        by_cat[r["category"]].append(SCORE[r["verdict"]])
    total = sum(SCORE[r["verdict"]] for r in scored) / max(len(scored), 1)
    summary = {
        "system": label,
        "sessions": len(sessions),
        "sessions_ingested": done,
        "embed_model": __import__("evalkit.embed", fromlist=["MODEL"]).MODEL,
        "accuracy": round(total, 3),
        "judge_errors": len(rows) - len(scored),
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
