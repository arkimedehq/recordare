"""Market baseline — Cognee OSS (`cognee`, Apache-2.0, upstream NOTICE.md by Topoteretes UG; used as an
installed dependency, nothing redistributed, no code or prompt copied; WORK_PLAN 4b.5).

Engine: Cognee's documented pipeline `add()` → `cognify()` (chunking, LLM entity/relation extraction
into its default KnowledgeGraph, chunk summaries, vector indexes of chunks / entities / edges).
`remember()` is the same plus `improve()`, whose triplet index serves only TRIPLET_COMPLETION, so it
is skipped (cost without effect on the search used here).
- LLM: litellm-native structured output (Cognee's default framework), provider "custom", model
  "openai/<ENGINE_MODEL>" at the spike's OpenAI-compatible endpoint (with ENGINE_NO_THINKING through
  the local gateway, which disables reasoning). litellm does not know the model, so Cognee uses its
  JSON-object fallback (schema in the prompt + validation retries) — no strict json_schema needed.
- Embeddings: provider "openai_compatible" at the gateway's /v1/embeddings = the run's EMBED_MODEL
  (bge-m3, 1024 dims), like every other system.
- Store: Cognee's local defaults (SQLite metadata, LanceDB vectors, Ladybug/Kuzu graph) under
  `.engine_data/cognee` (wiped per run); one dataset per dataset user (backend access control gives
  each dataset its own graph and vector store).
- Ingest: one text document per session: a header with the session date/time (and, for group
  chats, a note that name-prefixed lines are other participants), then "utente: …",
  "assistente: …", "<Name>: …" lines. `cognify` runs after each incremental batch (incremental
  loading processes only new documents). Cognee's TEMPORAL search needs `temporal_cognify=True`, a
  separate event-extraction pipeline that replaces the standard graph; the default pipeline is used
  (dates stay in the document text, entities and summaries).
- Context: `search(query_type=HYBRID_COMPLETION, only_context=True)` = exactly the context Cognee's
  default search hands its own answer LLM (relevant passages + entity neighbourhoods + facts),
  without Cognee's answer prompt. Chosen over GRAPH_COMPLETION (triplets only: loses the dates
  and wording of the passages) and over CHUNKS (plain RAG, no graph). Lanes top-k = SEARCH_TOP_K,
  capped at MAX_CONTEXT_CHARS.
"""
from __future__ import annotations

import asyncio
import os

from systems.market_common import (GATEWAY, check_gateway_embeddings, engine_llm, fresh_dir, is_group, other_text,
                                   record_usage, session_header)

os.environ.setdefault("TELEMETRY_DISABLED", "1")
os.environ.setdefault("LOG_LEVEL", "WARNING")  # Cognee logs every pipeline task at INFO
os.environ.setdefault("COGNEE_LOG_FILE", "false")

import cognee  # noqa: E402
import litellm  # noqa: E402
from litellm.integrations.custom_logger import CustomLogger  # noqa: E402

from evalkit.embed import MODEL as EMBED_MODEL, dim  # noqa: E402

SEARCH_TOP_K = 5
MAX_CONTEXT_CHARS = 8000
ROLE = {"user": "utente", "assistant": "assistente"}


class _UsageLogger(CustomLogger):
    """Engine LLM tokens (Cognee calls litellm.acompletion) → USAGE phase 'ingest'."""

    async def async_log_success_event(self, kwargs, response_obj, start_time, end_time):
        record_usage(getattr(response_obj, "usage", None))


class CogneeSystem:
    name = "cognee"

    def __init__(self) -> None:
        check_gateway_embeddings()
        root = fresh_dir("cognee")  # fresh state per run (before any Cognee engine is created)
        cognee.config.system_root_directory(str(root / "system"))
        cognee.config.data_root_directory(str(root / "data"))
        llm = engine_llm()
        cognee.config.set_llm_config({
            "llm_provider": "custom", "llm_model": f"openai/{llm['model']}", "llm_endpoint": llm["base_url"],
            "llm_api_key": llm["api_key"], "llm_max_completion_tokens": 8000, "llm_args": {"temperature": 0},
        })
        cognee.config.set_embedding_config({
            "embedding_provider": "openai_compatible", "embedding_model": EMBED_MODEL.removeprefix("st:"),
            "embedding_endpoint": GATEWAY, "embedding_api_key": "local", "embedding_dimensions": dim(),
            # One request in flight: the gateway embeds on CPU, serially; Cognee's default fan-out
            # (150 data points in flight) queues requests past its 300 s embedding timeout.
            "embedding_batch_size": 32, "embedding_max_concurrent_data_points": 32,
        })
        litellm.callbacks.append(_UsageLogger())
        self.loop = asyncio.new_event_loop()

    def _run(self, coro):
        return self.loop.run_until_complete(coro)

    @staticmethod
    def _document(s: dict) -> str:
        lines = [session_header(s)]
        lines += [f"{ROLE[m['role']]}: {m['content']}" if m["role"] in ROLE else other_text(m) for m in s["messages"]]
        return "\n".join(lines)

    def ingest(self, sessions: list[dict]) -> None:
        by_user: dict[str, list[str]] = {}
        for s in sessions:
            by_user.setdefault(s["user"], []).append(self._document(s))
        for user, docs in by_user.items():
            self._run(cognee.add(docs, dataset_name=user))
            self._run(cognee.cognify(datasets=[user]))
        print(f"  ingested {', '.join(s['id'] for s in sessions)}", flush=True)

    def context(self, user: str, question: dict) -> str:
        res = self._run(cognee.search(question["q"], query_type=cognee.SearchType.HYBRID_COMPLETION, datasets=[user],
                                      top_k=SEARCH_TOP_K, only_context=True, verbose=True))
        parts = [r.get("context_result") for r in res if isinstance(r, dict)]
        text = "\n\n".join(p if isinstance(p, str) else "\n---\n".join(map(str, p)) for p in parts if p)
        return text[:MAX_CONTEXT_CHARS]
