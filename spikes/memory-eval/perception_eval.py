# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Perceptions dev set (WORK_PLAN 8.12e): what the agent's senses noticed is remembered as seen, once, and fades.

One entity memory; its people introduce themselves (voice identities), their faces are bound; perceptions are posted as
of their own time (`POST api/v1/perceptions`, one a repeat that must come back as `duplicate`); one person tells what a
perception was (real extraction). Then, per phase: a consolidation as of that day (it also fades what is past its time),
a deterministic count of the perceived episodes left, and questions answered by an agent with Recordare's MCP read tools
(as agent_eval does), graded by the usual judge.

Needs a running service with ALLOW_CLOCK_OVERRIDE=true and a short IDLE_DELAY_SECONDS (the told message is extracted
by its idle job), and RECORDARE_URL / RECORDARE_ADMIN_KEY / RECORDARE_DB_URL as for service_sys.

  EVAL_DATASET=dataset_dev_perception uv run python perception_eval.py
"""
from __future__ import annotations

import asyncio
import json
import time
from collections import Counter

import httpx
import psycopg

from agent_eval import mcp_tools, run_agent
from evalkit.common import DATASET, USAGE, judge
from systems.service_sys import ADMIN, DB_URL, URL

EXTRACTION_WAIT_S = 600


def main() -> None:
    assert ADMIN, "RECORDARE_ADMIN_KEY is required"
    tl = json.loads((DATASET / "timeline.json").read_text())
    admin = httpx.Client(base_url=URL, timeout=60, headers={"authorization": f"Bearer {ADMIN}"})

    def post(path: str, body: dict, **kw) -> dict:
        r = admin.post(path, json=body, **kw)
        r.raise_for_status()
        return r.json() if r.content else {}

    run = f"perc{int(time.time())}"
    client = post("/api/v1/admin/clients", {"name": f"perception-eval {run}", "kind": "platform"})
    key = post(f"/api/v1/admin/clients/{client['id']}/keys", {"scopes": ["ingest", "mcp", "read"]})["key"]
    m = tl["memory"]
    user = f"{m['user']}-{run}"
    memory = post("/api/v1/admin/memories", {"displayName": m["name"], "mode": m["mode"], "locale": m["locale"], "timezone": m["timezone"]})["personId"]
    post("/api/v1/admin/identities", {"kind": "account", "personId": memory, "clientId": client["id"], "externalId": user})
    as_client = httpx.Client(base_url=URL, timeout=120, headers={"authorization": f"Bearer {key}", "x-recordare-user": user})
    people = {p["name"]: p for p in tl["people"]}

    def ingest(conv: str, msgs: list[dict]) -> None:
        participants = [{"ref": p["name"].lower(), "role": "other", "displayName": p["name"], "identity": {"channel": "voice", "externalId": p["voice"]}}
                        for p in tl["people"]]
        r = as_client.post("/api/v1/ingest/messages", json={"conversation": {"externalId": conv, "participants": participants}, "messages": [
            {"externalId": f"{conv}-{i}", "role": "other", "authorRef": x["by"].lower(), "content": x["content"], "sentAt": x["sentAt"]}
            for i, x in enumerate(msgs)]})
        r.raise_for_status()

    def wait_extracted() -> None:
        deadline = time.time() + EXTRACTION_WAIT_S
        with psycopg.connect(DB_URL) as db:
            while time.time() < deadline:
                (n,) = db.execute("SELECT count(*) FROM messages WHERE memory_id = %s AND extracted_run_id IS NULL", (memory,)).fetchone()
                if n == 0:
                    return
                time.sleep(5)
        print("  ! extraction still pending, going on", flush=True)

    # The household introduces itself; then their faces are bound as addresses of theirs.
    ingest("intro", tl["intro"])
    wait_extracted()
    with psycopg.connect(DB_URL) as db:
        ids = dict(db.execute("SELECT display_name, id::text FROM persons WHERE memory_id = %s", (memory,)).fetchall())
    for name, p in people.items():
        post("/api/v1/admin/identities", {"kind": "participant", "memoryId": memory, "personId": ids[name], "channel": "face",
                                          "externalId": p["face"], "verified": True})

    checks: list[tuple[str, bool, str]] = []
    for p in tl["perceptions"]:
        body = {"text": p["text"], "at": p["at"], "sensor": p["sensor"], "place": p.get("place"),
                "people": [{"identity": {"channel": "face", "externalId": people[n]["face"]}, "confidence": 0.9} for n in p.get("people", [])]
                + [{"identity": {"channel": "face", "externalId": f"unknown-{p['id']}-{i}"}, "confidence": 0.8} for i in range(p.get("unknown", 0))]}
        if "keepDays" in p:
            body["keepDays"] = p["keepDays"]
        r = as_client.post("/api/v1/perceptions", json={k: v for k, v in body.items() if v is not None}, headers={"x-recordare-now": p["at"]})
        r.raise_for_status()
        out = r.json()
        want_people = sorted(p.get("people", []))
        checks.append((f"{p['id']} duplicate={out['duplicate']}", out["duplicate"] == bool(p.get("expect_duplicate")), ""))
        checks.append((f"{p['id']} people={sorted(x['name'] for x in out['people'])}", sorted(x["name"] for x in out["people"]) == want_people, ""))

    ingest("told", tl["told"])
    wait_extracted()

    token = post(f"/api/v1/admin/memories/{memory}/tokens", {"clientId": client["id"], "scopes": ["mcp", "read"]})["token"]
    results = []
    for phase in tl["phases"]:
        report = post(f"/api/v1/admin/memories/{memory}/consolidate", {}, headers={"x-recordare-now": phase["consolidate_at"]})
        with psycopg.connect(DB_URL) as db:
            (left,) = db.execute("SELECT count(*) FROM episodes WHERE memory_id = %s AND origin = 'perceived'", (memory,)).fetchone()
        checks.append((f"after consolidation {phase['consolidate_at']}: perceived={left} (faded {report.get('faded')})", left == phase["perceived_after"], ""))
        tools = asyncio.run(mcp_tools(token, phase["asked_at"]))
        for q in phase["questions"]:
            q = {**q, "asked_at": phase["asked_at"]}
            out = run_agent(q, token, tools, with_context=True)
            verdict = judge(q, out["answer"])
            results.append({"id": q["id"], "category": q["category"], **out, "verdict": verdict.get("verdict"), "reason": verdict.get("reason")})
            print(f"{q['id']} [{verdict.get('verdict'):>7s}] calls={out['calls']}\n        → {out['answer'][:240]!r}", flush=True)

    print("\nDETERMINISTIC CHECKS")
    for name, ok, _ in checks:
        print(f"  {'ok ' if ok else 'BAD'} {name}")
    score = {"correct": 1.0, "partial": 0.5}
    total = sum(score.get(r["verdict"], 0) for r in results)
    print(f"\nanswers: {total}/{len(results)} — {dict(Counter(r['verdict'] for r in results))}; checks {sum(ok for _, ok, _ in checks)}/{len(checks)}")
    print(f"usage: {USAGE.summary() if hasattr(USAGE, 'summary') else USAGE}")
    (DATASET.parent / "results").mkdir(exist_ok=True)
    (DATASET.parent / "results" / f"perception_{run}.json").write_text(json.dumps({"checks": checks, "answers": results}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
