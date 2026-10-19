# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Provider matrix (WORK_PLAN 4.5b, D27): one command per engine model, from a profile file.

    uv run --directory <this dir> python provider_eval.py --config profiles/<name>.json [--dataset dataset_blind5]
        [--runs 1] [--port 8085] [--tag pm] [--smoke-only] [--outcomes]
    uv run --directory <this dir> python provider_eval.py --table          (every measured profile, as a table)

Steps: (1) smoke — one tiny structured call through the service's own adapter (`npm run smoke:llm`), trying the
profile's reasoning-off variants in order; (2) a service instance of its own (port, queue prefix) on that model, built
first when `dist/` is older than `src/`; (3) `run_eval.py --system service` (answer and judge stay on the spike's LLM,
so scores compare across engines); (4) per-stage extraction scoring when the set has a gold, the answer outcomes with
`--outcomes`; (5) the check of rule 9 — a run whose extractions carry more than one prompt version is marked
discarded (two versions of the same prompt); (6) the engine's cost from the service's own call accounting and the profile's prices. Writes
results/pm-<label>-<dataset>-<tag>.json; the service log goes to pm_<label>.log.

Profile file (JSON): {"label", "provider": "openai-compatible" | "anthropic" | "claude-cli", "profile": a service
profile name (service/src/llm/provider-profiles.ts), "baseUrl"?, "model", "keyEnv"? (the variable holding the key, in
this directory's .env or the environment; none for local servers), "reasoningOffTry"? ([LLM_PROFILE_JSON overrides,
tried in order until the smoke passes; default: the profile as is]), "price"? ({"input", "cachedInput"?, "output"}:
USD per million tokens), "weights"? (open weights: name and licence), "notes"?}.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path

import httpx
import psycopg
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parent
SERVICE = ROOT.parent.parent / "service"
RESULTS = ROOT / "results"
DB_URL = os.getenv("RECORDARE_DB_URL", "postgres://recordare:recordare@localhost:5433/recordare")


def load_profile(path: str) -> dict:
    p = json.loads(Path(path).read_text())
    for k in ("label", "provider", "model"):
        if not p.get(k):
            raise SystemExit(f"{path}: '{k}' is required")
    if not re.fullmatch(r"[a-z0-9._-]+", p["label"]):
        raise SystemExit(f"{path}: label must be lower case letters, digits, '.', '_' or '-'")
    return p


def api_key(p: dict) -> str:
    if not p.get("keyEnv"):
        return ""
    key = os.getenv(p["keyEnv"]) or (dotenv_values(ROOT / ".env").get(p["keyEnv"]) or "")
    if not key.strip():
        raise SystemExit(f"{p['keyEnv']} is not set (this directory's .env or the environment)")
    return key.strip().strip("'\"")


def service_env(p: dict, key: str, profile_json: str | None, port: int | None = None) -> dict:
    env = {**os.environ, "LLM_PROVIDER": p["provider"], "LLM_PROFILE": p.get("profile", "generic"),
           "LLM_MODEL": p["model"], "LLM_BASE_URL": p.get("baseUrl", ""), "LLM_API_KEY": key}
    env.pop("LLM_PROFILE_JSON", None)
    if profile_json:
        env["LLM_PROFILE_JSON"] = profile_json
    if port:
        # One instance per queue (rule 9): a run never shares workers with another engine.
        env.update({"PORT": str(port), "QUEUE_PREFIX": f"recordare-pm-{re.sub(r'[^a-z0-9_-]', '-', p['label'])}"})
    return env


def smoke(p: dict, key: str) -> tuple[str | None, dict]:
    """The first reasoning-off variant whose structured call answers with an event; (None, last output) if none."""
    last: dict = {}
    for variant in p.get("reasoningOffTry") or [None]:
        pj = json.dumps(variant) if variant is not None else None
        res = subprocess.run(["npm", "run", "-s", "smoke:llm"], cwd=SERVICE, env=service_env(p, key, pj),
                             capture_output=True, text=True, timeout=180)
        try:
            last = json.loads(res.stdout[res.stdout.index("{"):])
        except ValueError:
            last = {"error": (res.stderr or res.stdout).strip()[-600:]}
        events = (last.get("out") or {}).get("events") if isinstance(last.get("out"), dict) else None
        print(f"smoke {pj or '(profile as is)'}: {'ok' if events else 'failed'} — {json.dumps(last, ensure_ascii=False)[:300]}")
        if events:
            return pj or "", last
    return None, last


def ensure_built() -> None:
    main = SERVICE / "dist" / "main.js"
    newest = max(f.stat().st_mtime for f in (SERVICE / "src").rglob("*.ts"))
    if not main.exists() or main.stat().st_mtime < newest:
        print("building the service (dist older than src)…", flush=True)
        subprocess.run(["npm", "run", "-s", "build"], cwd=SERVICE, check=True)


def port_free(port: int) -> bool:
    with socket.socket() as s:
        return s.connect_ex(("127.0.0.1", port)) != 0


def start_service(p: dict, key: str, pj: str, port: int) -> subprocess.Popen:
    if not port_free(port):
        raise SystemExit(f"port {port} is in use: stop that instance or pass --port")
    log = open(ROOT / f"pm_{p['label']}.log", "w")
    proc = subprocess.Popen(["node", "dist/main.js"], cwd=SERVICE, env=service_env(p, key, pj or None, port),
                            stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
    for _ in range(60):
        time.sleep(1)
        if proc.poll() is not None:
            raise SystemExit(f"the service exited ({proc.returncode}): see pm_{p['label']}.log")
        try:
            if httpx.get(f"http://localhost:{port}/api/v1/health", timeout=2).status_code == 200:
                return proc
        except httpx.HTTPError:
            pass
    stop_service(proc)
    raise SystemExit("the service did not become healthy in 60 s")


def stop_service(proc: subprocess.Popen) -> None:
    if proc.poll() is None:
        os.killpg(proc.pid, signal.SIGTERM)
        try:
            proc.wait(20)
        except subprocess.TimeoutExpired:
            os.killpg(proc.pid, signal.SIGKILL)


def run_files(dataset: str, label: str, tag: str, runs: int) -> list[Path]:
    """The result files run_eval.py wrote for this profile (its label: service-<dataset>-emb_…-<model>[-nothink]-<tag>)."""
    ds = "" if dataset == "dataset" else f"-{dataset}"
    suffixes = [f"-r{r}" for r in range(1, runs + 1)] if runs > 1 else [""]
    out = []
    for s in suffixes:
        hits = sorted(RESULTS.glob(f"service{ds}-emb_*-{label}*-{tag}{s}.json"), key=lambda f: f.stat().st_mtime)
        if hits:
            out.append(hits[-1])
    return out


def prompt_versions(memory_ids: list[str]) -> list[str]:
    with psycopg.connect(DB_URL) as conn:
        rows = conn.execute("SELECT DISTINCT prompt_version FROM extraction_runs WHERE memory_id = ANY(%s::uuid[])",
                            (memory_ids,)).fetchall()
    return sorted(r[0] for r in rows if r[0])


def usd(cost: dict, price: dict | None) -> float | None:
    if not price:
        return None
    total = 0.0
    for c in cost.values():
        cached = c.get("cached", 0)
        total += (c["input"] - cached) * price["input"] + cached * price.get("cachedInput", price["input"])
        total += c["output"] * price["output"]
    return round(total / 1e6, 4)


def uv(*args: str, env: dict | None = None) -> None:
    subprocess.run(["uv", "run", "--directory", str(ROOT), "python", *args], cwd=ROOT, env=env, check=False)


def measure(args) -> None:
    p = load_profile(args.config)
    key = api_key(p)
    pj, smoke_out = smoke(p, key)
    report: dict = {"label": p["label"], "provider": p["provider"], "profile": p.get("profile", "generic"),
                    "model": p["model"], "baseUrl": p.get("baseUrl"), "weights": p.get("weights"),
                    "dataset": args.dataset, "tag": args.tag, "smoke": "ok" if pj is not None else "failed",
                    "profileJson": pj or None, "smokeOutput": smoke_out}
    out = RESULTS / f"pm-{p['label']}-{args.dataset}-{args.tag}.json"  # runs with different tags never overwrite each other
    RESULTS.mkdir(exist_ok=True)
    if pj is None or args.smoke_only:
        out.write_text(json.dumps(report, ensure_ascii=False, indent=2))
        print(f"→ {out.name}")
        return

    ensure_built()
    admin = dotenv_values(SERVICE / ".env").get("ADMIN_API_KEY") or ""
    proc = start_service(p, key, pj, args.port)
    try:
        env = {**os.environ, "RECORDARE_URL": f"http://localhost:{args.port}", "RECORDARE_ADMIN_KEY": admin,
               "EMBED_MODEL": "st:BAAI/bge-m3", "EVAL_DATASET": args.dataset, "SERVICE_MODEL": p["label"],
               "RUN_TAG": args.tag}
        uv("run_eval.py", "--system", "service", "--runs", str(args.runs), "--resume",
           *(["--only", args.only] if args.only else []), env=env)
    finally:
        stop_service(proc)

    gold = ROOT / args.dataset / "gold.json"
    runs = []
    for f in run_files(args.dataset, p["label"], args.tag, args.runs):
        s = json.loads(f.read_text())["summary"]
        ext = f.with_name(f.stem + "-extraction.json")
        oc = f.with_name(f.stem + "-outcomes.json")
        fresh = lambda d: d.exists() and d.stat().st_mtime >= f.stat().st_mtime  # noqa: E731 - a re-run makes them stale
        if gold.exists() and not fresh(ext):
            uv("extraction_eval.py", str(f.relative_to(ROOT)), str(gold.relative_to(ROOT)))
        if args.outcomes and not fresh(oc):
            uv("outcome_eval.py", f.stem)
        versions = prompt_versions(list((s.get("memory_ids") or {}).values()))
        families = [v.rsplit(".v", 1)[0] for v in versions]
        row = {"file": f.name, "accuracy": s["accuracy"], "judge_errors": s["judge_errors"],
               "engine_cost": s.get("engine_cost"), "engine_usd": usd(s.get("engine_cost") or {}, p.get("price")),
               "ingest_seconds": s["ingest_seconds"], "prompt_versions": versions, "discarded": len(set(families)) < len(families)}
        if fresh(ext):
            e = json.loads(ext.read_text())
            row["extraction"] = {k: e.get(k) for k in ("episode_recall", "date_accuracy_of_found", "plan_outcome_accuracy",
                                                       "unsupported_rate", "facts_current_ok", "facts_history_ok", "notes_recall")}
        if fresh(oc):
            o = json.loads(oc.read_text())["summary"]
            row["outcomes"] = {k: o.get(f"{k}_rate") for k in ("unjustified_assertion", "over_abstention", "invented_on_unknown")}
        runs.append(row)
    kept = [r["accuracy"] for r in runs if not r["discarded"]]
    report.update({"runs": runs, "accuracy_mean": round(sum(kept) / len(kept), 3) if kept else None})
    if args.only:  # a subset is a check of the pipeline, not a measurement of the model
        report["accuracy_mean"], report["check_only"] = None, args.only
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps({k: report[k] for k in ("label", "dataset", "smoke", "profileJson", "accuracy_mean")}, ensure_ascii=False))
    print(f"→ {out.name}")


def table() -> None:
    """Every pm-*.json, one row each: the supported-models table's measured part (≥ 95 % = supported, maintainer's rule)."""
    print("| Engine model | Provider / profile | Set | Smoke | Accuracy | Recall | Plan outcome | Unsupported | Engine USD | Weights |")
    print("|---|---|---|---|---|---|---|---|---|---|")
    for f in sorted(RESULTS.glob("pm-*.json")):
        r = json.loads(f.read_text())
        ex = next((x.get("extraction") for x in r.get("runs", []) if x.get("extraction")), {}) or {}
        cost = [x["engine_usd"] for x in r.get("runs", []) if x.get("engine_usd") is not None]
        acc = r.get("accuracy_mean")
        cells = [r["model"], f"{r['provider']} / {r['profile']}", f"{r['dataset'].replace('dataset_', '')} ({r['tag']})", r["smoke"],
                 f"{acc * 100:.1f} %" if acc is not None else "—", ex.get("episode_recall", "—"),
                 ex.get("plan_outcome_accuracy", "—"), ex.get("unsupported_rate", "—"),
                 f"{sum(cost) / len(cost):.3f}" if cost else "—", (r.get("weights") or {}).get("licence", "API only")]
        print("| " + " | ".join(str(c) for c in cells) + " |")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--config", help="profile file (profiles/*.json)")
    ap.add_argument("--dataset", default="dataset_blind5", help="dataset folder (default: blind5, the matrix's set)")
    ap.add_argument("--runs", type=int, default=1)
    ap.add_argument("--port", type=int, default=8085)
    ap.add_argument("--tag", default="pm", help="RUN_TAG of the results (default pm)")
    ap.add_argument("--only", help="comma-separated question ids (a cheap end-to-end check; not a measurement)")
    ap.add_argument("--smoke-only", action="store_true", help="only the smoke call (cents or less)")
    ap.add_argument("--outcomes", action="store_true", help="also grade answer outcomes (outcome_eval.py)")
    ap.add_argument("--table", action="store_true", help="print the measured profiles as a table")
    args = ap.parse_args()
    if args.table:
        table()
    elif args.config:
        measure(args)
    else:
        ap.error("--config or --table")


if __name__ == "__main__":
    sys.exit(main())
