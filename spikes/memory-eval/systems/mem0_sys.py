# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Market baseline — Mem0 OSS (`mem0ai`, Apache-2.0; used as an installed dependency, no code or
prompt copied; WORK_PLAN 4b.5).

Engine: `mem0.Memory` (v3 pipeline of mem0ai 2.x): one LLM call per `add()` extracts new memories
(ADD-only, linked to existing ones), embeds them and stores them; search = semantic + BM25 hybrid.
- LLM: provider "openai" pointed at the spike's OpenAI-compatible endpoint (ENGINE_MODEL; with
  ENGINE_NO_THINKING through the local gateway, which disables reasoning), json_object mode.
- Embeddings: provider "openai" pointed at the gateway's /v1/embeddings = the run's EMBED_MODEL
  (bge-m3, 1024 dims), like every other system.
- Store: embedded Qdrant (local path) + Mem0's SQLite history under `.engine_data/mem0` (wiped
  per run). Mem0's spaCy extras (`mem0ai[nlp]`, English models) are not installed: entity boosts
  are off and BM25 runs on unlemmatized text — the English model would not help Italian anyway.
- Ingest: one `add()` per session, user_id = dataset user (one Mem0 user each), messages as
  user/assistant; other participants of a group chat become user-role messages prefixed with
  their name, plus a system line saying so (Mem0 has no third-party role).
  Time: the OSS `add(timestamp=…)` is platform-only, and the extraction prompt otherwise grounds
  relative dates ("sabato", "ieri") on today's system date. The adapter passes the session date
  as the prompt's Observation Date / Current Date — the slot Mem0's own prompt reserves for it —
  and stores the session timestamp as the memory's `created_at` (metadata).
- Context: `search(question, top_k=SEARCH_TOP_K)` scoped to the user, rendered as a list of
  memories with their date — the format Mem0's own examples inject into an agent prompt.
"""
from __future__ import annotations

import os
import time

from systems.market_common import (STORE, GATEWAY, check_gateway_embeddings, engine_llm, fresh_dir, is_group,
                                   other_text, record_usage, session_header)

os.environ.setdefault("MEM0_TELEMETRY", "False")
os.environ.setdefault("MEM0_DIR", str(STORE / "mem0_home"))

import mem0.memory.main as mem0_main  # noqa: E402
from mem0 import Memory  # noqa: E402

from evalkit.embed import dim  # noqa: E402

SEARCH_TOP_K = 25
ATTEMPTS = 4

_observation = {"date": None}
_build_prompt = mem0_main.generate_additive_extraction_prompt


def _dated_prompt(*args, **kwargs):
    """Ground the extraction on the session date instead of today's system date (see docstring)."""
    if _observation["date"]:
        kwargs.setdefault("timestamp", _observation["date"])
        kwargs.setdefault("current_date", _observation["date"])
    return _build_prompt(*args, **kwargs)


mem0_main.generate_additive_extraction_prompt = _dated_prompt


class Mem0System:
    name = "mem0"

    def __init__(self) -> None:
        check_gateway_embeddings()
        root = fresh_dir("mem0")  # fresh state per run
        llm = engine_llm()
        self.memory = Memory.from_config({
            "llm": {"provider": "openai", "config": {
                "model": llm["model"], "api_key": llm["api_key"], "openai_base_url": llm["base_url"],
                "temperature": 0, "max_tokens": 4000, "is_reasoning_model": False,
                "response_callback": lambda _llm, resp, _params: record_usage(resp.usage)}},
            "embedder": {"provider": "openai", "config": {
                "model": "local", "api_key": "local", "openai_base_url": GATEWAY, "embedding_dims": dim()}},
            "vector_store": {"provider": "qdrant", "config": {
                "collection_name": "memeval", "path": str(root / "qdrant"), "embedding_model_dims": dim()}},
            "history_db_path": str(root / "history.db"),
        })

    def ingest(self, sessions: list[dict]) -> None:
        for s in sessions:
            messages = [{"role": "system", "content": session_header(s)}] if is_group(s) else []
            messages += [{"role": m["role"], "content": m["content"]} if m["role"] in ("user", "assistant")
                         else {"role": "user", "content": other_text(m)} for m in s["messages"]]
            _observation["date"] = s["ts"][:10]
            for attempt in range(ATTEMPTS):  # Mem0 raises on provider errors instead of retrying
                try:
                    out = self.memory.add(messages, user_id=s["user"], metadata={"created_at": s["ts"], "session": s["id"]})
                    break
                except Exception as err:  # noqa: BLE001 - transient provider errors
                    print(f"  ! mem0 add failed (attempt {attempt + 1}): {type(err).__name__}: {str(err)[:160]}", flush=True)
                    if attempt == ATTEMPTS - 1:
                        raise
                    time.sleep(5 * 2 ** attempt)
            _observation["date"] = None
            print(f"  ingested {s['id']} (+{len(out.get('results', []))} memories)", flush=True)

    def context(self, user: str, question: dict) -> str:
        res = self.memory.search(question["q"], filters={"user_id": user}, top_k=SEARCH_TOP_K)
        lines = ["MEMORIE:"]
        for r in res.get("results", []):
            when = (r.get("created_at") or "")[:10]
            lines.append(f"- [{when}] {r['memory']}" if when else f"- {r['memory']}")
        return "\n".join(lines)

    def dump(self) -> str:
        """All stored memories per user (results/<label>-memory.json), for inspection."""
        import json
        out = {}
        for user in {p.get("user_id") for p in self._payloads()} - {None}:
            got = self.memory.get_all(filters={"user_id": user}, top_k=1000)
            out[user] = [{"memory": m["memory"], "created_at": m.get("created_at")} for m in got.get("results", [])]
        return json.dumps(out, ensure_ascii=False, indent=2)

    def _payloads(self) -> list[dict]:
        points, _ = self.memory.vector_store.client.scroll(collection_name="memeval", limit=10000, with_payload=True)
        return [p.payload for p in points]
