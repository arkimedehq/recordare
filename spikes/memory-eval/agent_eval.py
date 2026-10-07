# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Agent-mode evaluation of the pre-turn memory context (WORK_PLAN 5.7).

The answer model is an agent: it gets Recordare's read tools over MCP (their own names, descriptions and schemas) and
decides by itself whether to call them — as a real client's agent does. Variants:
  tools          tools only (today's behaviour)
  tools+context  the same, plus the `<memory-context>` block Recordare serves for the question, appended to the system
                 prompt (the service instance must run with MEMORY_CONTEXT=1)
Both variants answer every question of the same ingested memory; the judge is the usual one.

  EVAL_DATASET=dataset_dev_context uv run python agent_eval.py [--variants tools,tools+context]
"""
from __future__ import annotations

import argparse
import asyncio
import json
import time
from collections import defaultdict

import httpx
import httpx2
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client

from evalkit.common import SCORE, USAGE, fmt_when, judge, llm_client, llm_model, load_questions, load_sessions
from systems.service_sys import ADMIN, URL, ServiceSystem

READ_TOOLS = {"search_episodes", "search_memory", "resolve_period"}
MAX_ROUNDS = 4
# A neutral assistant prompt, like a general agent platform's: nothing pushes the model to use memory.
SYSTEM = ("Sei un assistente personale utile e conciso. Oggi è TODAY. Hai a disposizione degli strumenti: usali "
          "quando ti servono. Rispondi in italiano.")


async def mcp_tools(token: str, now: str) -> list[dict]:
    async with httpx2.AsyncClient(headers={"authorization": f"Bearer {token}", "x-recordare-now": now}, timeout=60) as client:
        async with streamable_http_client(f"{URL}/mcp", http_client=client) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                listed = await session.list_tools()
    return [{"type": "function", "function": {"name": t.name, "description": t.description or t.name, "parameters": t.input_schema}}
            for t in listed.tools if t.name in READ_TOOLS]


async def mcp_call(token: str, now: str, name: str, args: dict) -> str:
    async with httpx2.AsyncClient(headers={"authorization": f"Bearer {token}", "x-recordare-now": now}, timeout=60) as client:
        async with streamable_http_client(f"{URL}/mcp", http_client=client) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                res = await session.call_tool(name, args)
    return "\n".join(c.text for c in res.content if getattr(c, "type", "") == "text") or "{}"


def memory_context(token: str, question: dict) -> tuple[str | None, int]:
    r = httpx.post(f"{URL}/api/v1/context", json={"query": question["q"]}, timeout=60,
                   headers={"authorization": f"Bearer {token}", "x-recordare-now": question["asked_at"]})
    r.raise_for_status()
    body = r.json()
    return body.get("block"), body.get("items", 0)


def run_agent(question: dict, token: str, tools: list[dict], with_context: bool) -> dict:
    system = SYSTEM.replace("TODAY", fmt_when(question["asked_at"]))
    items = 0
    if with_context:
        block, items = memory_context(token, question)
        if block:
            system = f"{system}\n\n{block}"
    messages: list[dict] = [{"role": "system", "content": system}, {"role": "user", "content": question["q"]}]
    calls: list[str] = []
    for _ in range(MAX_ROUNDS + 1):
        for attempt in range(4):
            try:
                resp = llm_client().chat.completions.create(model=llm_model(), messages=messages, tools=tools, temperature=0,
                                                            max_tokens=1500)
                break
            except Exception as err:  # noqa: BLE001 - transient provider errors
                print(f"  ! agent call failed ({attempt + 1}): {type(err).__name__}", flush=True)
                time.sleep(5 * 2 ** attempt)
        else:
            return {"answer": "", "calls": calls, "items": items}
        USAGE.add("agent", resp.usage)
        msg = resp.choices[0].message
        if not msg.tool_calls:
            return {"answer": (msg.content or "").strip(), "calls": calls, "items": items}
        messages.append({"role": "assistant", "content": msg.content or "", "tool_calls": [tc.model_dump() for tc in msg.tool_calls]})
        for tc in msg.tool_calls:
            calls.append(tc.function.name)
            try:
                args = json.loads(tc.function.arguments or "{}")
                out = asyncio.run(mcp_call(token, question["asked_at"], tc.function.name, args))
            except Exception as err:  # noqa: BLE001 - a failed tool is an answer the agent must handle
                out = json.dumps({"error": type(err).__name__})
            messages.append({"role": "tool", "tool_call_id": tc.id, "content": out[:12_000]})
    return {"answer": "(too many tool rounds)", "calls": calls, "items": items}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--variants", default="tools,tools+context")
    args = ap.parse_args()
    variants = args.variants.split(",")

    sys_ = ServiceSystem()
    sys_.ingest(load_sessions())
    questions = load_questions()
    user = next(iter(sys_.owners))
    owner = sys_.owners[user]
    # A personal token that may also read the context (the harness's own MCP token has the mcp scope only).
    token = httpx.post(f"{URL}/api/v1/admin/owners/{owner['id']}/tokens", timeout=30,
                       headers={"authorization": f"Bearer {ADMIN}"},
                       json={"clientId": sys_.client_id, "scopes": ["mcp", "read"]}).json()["token"]
    tools = asyncio.run(mcp_tools(token, questions[0]["asked_at"]))
    print(f"tools offered: {[t['function']['name'] for t in tools]}", flush=True)

    results: dict[str, list[dict]] = defaultdict(list)
    for q in questions:
        for v in variants:
            out = run_agent(q, token, tools, with_context=v == "tools+context")
            verdict = judge(q, out["answer"])
            results[v].append({"id": q["id"], "category": q["category"], **out, "verdict": verdict.get("verdict"), "reason": verdict.get("reason")})
            print(f"{q['id']} {v:14s} [{verdict.get('verdict'):>7s}] calls={out['calls']} ctx_items={out['items']}\n"
                  f"        → {out['answer'][:220]!r}", flush=True)

    summary = {}
    for v, rows in results.items():
        by_cat: dict[str, list[float]] = defaultdict(list)
        for r in rows:
            if r["verdict"] in SCORE:
                by_cat[r["category"]].append(SCORE[r["verdict"]])
        summary[v] = {
            "accuracy": round(sum(sum(x) for x in by_cat.values()) / max(1, sum(len(x) for x in by_cat.values())), 3),
            "by_category": {c: round(sum(x) / len(x), 3) for c, x in sorted(by_cat.items())},
            "tool_use_rate": round(sum(1 for r in rows if r["calls"]) / len(rows), 3),
            "context_served": sum(1 for r in rows if r["items"]),
        }
    print(json.dumps({"summary": summary, "usage": USAGE.as_dict(), "engine_cost": sys_.cost()}, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
