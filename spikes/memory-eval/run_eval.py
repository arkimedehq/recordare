# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
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
    if system == "nomemory":
        from systems.controls import NoMemory
        return NoMemory()
    if system == "fullcontext":
        from systems.controls import FullContext
        return FullContext()
    if system == "memobase":
        from systems.memobase_sys import MemobaseSystem
        return MemobaseSystem()
    if system == "mem0":
        from systems.mem0_sys import Mem0System
        return Mem0System()
    if system == "cognee":
        from systems.cognee_sys import CogneeSystem
        return CogneeSystem()
    raise SystemExit(f"unknown system: {system}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", type=int, default=1, help="repeat the whole run N times (fresh system each time)")
    ap.add_argument("--system", required=True)
    ap.add_argument("--only", help="comma-separated question ids")
    ap.add_argument("--noise", action="store_true", help="add dataset/noise.json sessions")
    ap.add_argument("--resume", action="store_true", help="reuse completed -rN result files of the same label")
    args = ap.parse_args()
    label = args.system + ("-noise" if args.noise else "")
    if DATASET.name != "dataset":
        label += f"-{DATASET.name}"
    if os.getenv("EMBED_MODEL"):
        label += "-emb_" + os.environ["EMBED_MODEL"].split("/")[-1].replace(":", "_")
    # The engine model belongs to the label only where this process picks it: the service has its own
    # LLM config (SERVICE_MODEL names it), controls have no engine.
    engine = os.getenv("SERVICE_MODEL") if args.system == "service" else os.getenv("ENGINE_MODEL")
    if engine and args.system not in ("baseline", "fullcontext", "nomemory"):
        label += f"-{engine}" + ("-nothink" if os.getenv("ENGINE_NO_THINKING") else "")

    if os.getenv("RUN_TAG"):  # distinguishes engine versions measured on the same dataset
        label += f"-{os.environ['RUN_TAG']}"

    summaries = []
    for run in range(1, args.runs + 1):
        done = RESULTS / f"{label}-r{run}.json"
        if args.resume and done.exists():  # a chain stopped midway (provider outage, balance) keeps its runs
            print(f"#### run {run}: reusing {done.name}")
            summaries.append(json.loads(done.read_text()))
            continue
        summaries.append(run_once(args, label, run if args.runs > 1 else None))
    if args.runs > 1:
        aggregate(label, summaries)


def run_once(args, label: str, run: int | None) -> dict:
    USAGE.calls.clear(); USAGE.prompt.clear(); USAGE.completion.clear()
    if run:
        label = f"{label}-r{run}"
        print(f"\n#### run {run}", flush=True)
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
    if hasattr(sys_, "cost"):
        summary["engine_cost"] = sys_.cost()
        summary["memory_ids"] = sys_.memory_ids()
        (RESULTS / f"{label}.json").write_text(json.dumps({"summary": summary, "rows": rows}, ensure_ascii=False, indent=2))
    if hasattr(sys_, "dump"):
        (RESULTS / f"{label}-memory.json").write_text(sys_.dump())
    print("\n" + json.dumps(summary, ensure_ascii=False, indent=2))
    return {"summary": summary, "rows": rows}


def aggregate(label: str, runs: list[dict]) -> None:
    """Mean ± 95% CI over runs, and per-question mean score (for paired comparisons)."""
    import statistics
    accs = [r["summary"]["accuracy"] for r in runs]
    mean = statistics.mean(accs)
    sd = statistics.stdev(accs) if len(accs) > 1 else 0.0
    half = 1.96 * sd / (len(accs) ** 0.5) if len(accs) > 1 else 0.0
    per_q: dict[str, list[float]] = defaultdict(list)
    cats: dict[str, str] = {}
    for r in runs:
        for row in r["rows"]:
            if row["verdict"] in SCORE:
                per_q[row["id"]].append(SCORE[row["verdict"]])
                cats[row["id"]] = row["category"]
    out = {
        "system": label, "runs": len(runs), "accuracy_mean": round(mean, 3), "accuracy_sd": round(sd, 3),
        "accuracy_ci95": [round(mean - half, 3), round(mean + half, 3)], "accuracy_runs": accs,
        "per_question": {q: round(sum(v) / len(v), 3) for q, v in sorted(per_q.items())},
        "categories": cats,
    }
    (RESULTS / f"{label}-agg.json").write_text(json.dumps(out, ensure_ascii=False, indent=2))
    print("\n#### aggregate\n" + json.dumps({k: out[k] for k in ("system", "runs", "accuracy_mean", "accuracy_sd", "accuracy_ci95", "accuracy_runs")}, indent=1))


if __name__ == "__main__":
    main()
