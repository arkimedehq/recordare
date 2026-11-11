# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Learning from outside dev set (WORK_PLAN 8.16 F1, D57): an entity memory keeps lasting knowledge it reads or is told,
with its source and how far to trust it; repetition is no confirmation, perishable news fades, hidden instructions in a
page create nothing.

One entity memory; its conversations (web searches as tool messages with a URL, the household's words, a voice nobody
recognised) are ingested as of their own time and extracted by the service's idle job (real extraction). Then
deterministic checks on what was kept (origin, pending, informants' track records, expiry, intents) and, per phase, a
consolidation as of that day and questions answered by an agent with Recordare's MCP read tools, graded by the judge.

Needs a running service with ALLOW_CLOCK_OVERRIDE=true and a short IDLE_DELAY_SECONDS, and RECORDARE_URL /
RECORDARE_ADMIN_KEY / RECORDARE_DB_URL as for service_sys.

  EVAL_DATASET=dataset_dev_learning uv run python learning_eval.py
"""
from __future__ import annotations

import asyncio
import json
import time
from collections import Counter

import httpx
import psycopg
from psycopg.rows import dict_row

from agent_eval import mcp_tools, run_agent
from evalkit.common import DATASET, USAGE, judge
from systems.service_sys import ADMIN, DB_URL, URL

EXTRACTION_WAIT_S = 600

ITEMS = """
  SELECT 'note' AS t, n.id, n.content AS text, n.origin::text AS origin, n.pending, n.status::text AS status, n.lasts FROM notes n
   WHERE n.memory_id = %(m)s AND n.deleted_at IS NULL
  UNION ALL
  SELECT 'fact', f.id, f.key || ': ' || COALESCE(f.value, ''), f.origin::text, f.pending, f.status::text, NULL FROM facts f
   WHERE f.memory_id = %(m)s AND f.deleted_at IS NULL
"""
# Episodes too, for a check that asks for them (`"episodes": true`): what touched a life is an episode, not a note.
EPISODES = """
  SELECT 'episode' AS t, e.id, e.content AS text, e.origin::text AS origin, false AS pending,
         CASE WHEN e.invalidated_at IS NULL THEN 'current' ELSE 'invalidated' END AS status, NULL AS lasts FROM episodes e
   WHERE e.memory_id = %(m)s AND e.deleted_at IS NULL
"""


def main() -> None:
    assert ADMIN, "RECORDARE_ADMIN_KEY is required"
    tl = json.loads((DATASET / "timeline.json").read_text())
    admin = httpx.Client(base_url=URL, timeout=60, headers={"authorization": f"Bearer {ADMIN}"})

    def post(path: str, body: dict, **kw) -> dict:
        r = admin.post(path, json=body, **kw)
        r.raise_for_status()
        return r.json() if r.content else {}

    run = f"learn{int(time.time())}"
    client = post("/api/v1/admin/clients", {"name": f"learning-eval {run}", "kind": "platform"})
    key = post(f"/api/v1/admin/clients/{client['id']}/keys", {"scopes": ["ingest", "mcp", "read"]})["key"]
    m = tl["memory"]
    user = f"{m['user']}-{run}"
    memory = post("/api/v1/admin/memories", {"displayName": m["name"], "mode": m["mode"], "locale": m["locale"], "timezone": m["timezone"]})["personId"]
    post("/api/v1/admin/identities", {"kind": "account", "personId": memory, "clientId": client["id"], "externalId": user})
    as_client = httpx.Client(base_url=URL, timeout=120, headers={"authorization": f"Bearer {key}", "x-recordare-user": user})
    people = {p["name"]: p for p in tl["people"]}

    def wait_extracted() -> None:
        deadline = time.time() + EXTRACTION_WAIT_S
        with psycopg.connect(DB_URL) as db:
            while time.time() < deadline:
                (n,) = db.execute("SELECT count(*) FROM messages WHERE memory_id = %s AND extracted_run_id IS NULL", (memory,)).fetchone()
                if n == 0:
                    return
                time.sleep(5)
        print("  ! extraction still pending, going on", flush=True)

    bound: set[str] = set()
    for c in tl["conversations"]:
        participants = [{"ref": p["name"].lower(), "role": "other", "displayName": p["name"], "identity": {"channel": "voice", "externalId": p["voice"]}}
                        for p in tl["people"]]
        participants += [{"ref": x["ref"], "role": "other", "displayName": x["name"]} for x in c.get("participants", [])]
        msgs = []
        for i, x in enumerate(c["messages"]):
            at = c["at"][:17] + f"{i:02d}" + c["at"][19:]
            if "by" in x:
                msgs.append({"externalId": f"{c['id']}-{i}", "role": "other", "authorRef": x["by"].lower(), "content": x["content"], "sentAt": at})
            else:
                msgs.append({"externalId": f"{c['id']}-{i}", "role": x["role"], "content": x["content"], "sentAt": at,
                             **({"toolName": x["tool"], "authorRef": "assistant"} if x["role"] == "tool" else {})})
        r = as_client.post("/api/v1/ingest/messages", json={"conversation": {"externalId": f"{run}-{c['id']}", "participants": participants}, "messages": msgs})
        r.raise_for_status()
        wait_extracted()
        # The household's verified faces: a person with a verified identity is household (trusted to teach).
        with psycopg.connect(DB_URL) as db:
            ids = dict(db.execute("SELECT display_name, id::text FROM persons WHERE memory_id = %s", (memory,)).fetchall())
        for name, p in people.items():
            if p.get("verified") and name in ids and name not in bound:
                post("/api/v1/admin/identities", {"kind": "participant", "memoryId": memory, "personId": ids[name], "channel": "face",
                                                  "externalId": f"{p['voice']}-face", "verified": True})
                bound.add(name)

    checks: list[tuple[str, bool]] = []

    def check(k: dict) -> None:
        with psycopg.connect(DB_URL) as db:
            db.row_factory = dict_row
            items = db.execute(EPISODES if k.get("episodes") else ITEMS, {"m": memory}).fetchall()
            hit = [i for i in items if k["match"].lower() in i["text"].lower() and (not k.get("and") or k["and"].lower() in i["text"].lower())]
            cur = [i for i in hit if i["status"] in ("current", "unknown_current")]
            ok = True
            detail = [f"{i['t']}:{i['origin']}:{'P' if i['pending'] else 'S'}:{i['status']}:{i['lasts']}:{i['text'][:60]}" for i in hit]
            if "count" in k:
                pool = [i for i in hit if not k.get("lasts") or i["lasts"] == k["lasts"]]
                ok &= len(pool) == k["count"]
            elif "lasts" in k:
                ok &= any(i["lasts"] == k["lasts"] for i in cur)
            if "origin" in k:
                ok &= any(i["origin"] == k["origin"] for i in cur)
            if "pending" in k:
                ok &= bool(cur) and all(i["pending"] == k["pending"] for i in cur)
            if "current_contains" in k:
                ok &= any(k["current_contains"] in i["text"].lower() for i in cur)
            if "source" in k:
                srcs = {r["key"] for r in db.execute(
                    "SELECT i.key FROM item_informants ii JOIN informants i ON i.id = ii.informant_id WHERE ii.note_id = ANY(%s) OR ii.fact_id = ANY(%s)",
                    ([i["id"] for i in cur], [i["id"] for i in cur])).fetchall()}
                ok &= k["source"] in srcs
                detail.append(f"sources={sorted(srcs)}")
            if "informant" in k:
                row = db.execute("SELECT confirmed, corrected FROM informants WHERE memory_id = %s AND key = %s", (memory, k["informant"])).fetchone()
                detail.append(f"informant={row}")
                ok &= bool(row) and row["confirmed"] >= k.get("confirmed_min", 0) and row["corrected"] >= k.get("corrected_min", 0)
            if "intents" in k:
                (n,) = db.execute("SELECT count(*) AS n FROM intents WHERE memory_id = %s", (memory,)).fetchone().values()
                detail.append(f"intents={n}")
                ok &= n == k["intents"]
        checks.append((f"{k['id']} {k['what']} — {detail}", ok))

    for k in tl["checks_after_messages"]:
        check(k)

    token = post(f"/api/v1/admin/memories/{memory}/tokens", {"clientId": client["id"], "scopes": ["mcp", "read"]})["token"]
    results = []
    for phase in tl["phases"]:
        tools = asyncio.run(mcp_tools(token, phase["asked_at"]))
        if phase["asked_at"] > phase["consolidate_at"]:
            report = post(f"/api/v1/admin/memories/{memory}/consolidate", {}, headers={"x-recordare-now": phase["consolidate_at"]})
            print(f"consolidated as of {phase['consolidate_at']}: faded {report.get('faded')}", flush=True)
            tools = asyncio.run(mcp_tools(token, phase["asked_at"]))
        for k in phase.get("checks", []):
            check(k)
        for q in phase["questions"]:
            q = {**q, "asked_at": phase["asked_at"]}
            out = run_agent(q, token, tools, with_context=True)
            verdict = judge(q, out["answer"])
            results.append({"id": q["id"], "category": q["category"], **out, "verdict": verdict.get("verdict"), "reason": verdict.get("reason")})
            print(f"{q['id']} [{verdict.get('verdict'):>7s}] calls={out['calls']}\n        → {out['answer'][:240]!r}", flush=True)

    print("\nDETERMINISTIC CHECKS")
    for name, ok in checks:
        print(f"  {'ok ' if ok else 'BAD'} {name}")
    score = {"correct": 1.0, "partial": 0.5}
    total = sum(score.get(r["verdict"], 0) for r in results)
    print(f"\nanswers: {total}/{len(results)} — {dict(Counter(r['verdict'] for r in results))}; checks {sum(ok for _, ok in checks)}/{len(checks)}")
    print(f"usage: {USAGE.summary() if hasattr(USAGE, 'summary') else USAGE}")
    (DATASET.parent / "results").mkdir(exist_ok=True)
    (DATASET.parent / "results" / f"learning_{run}.json").write_text(json.dumps({"checks": checks, "answers": results}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
