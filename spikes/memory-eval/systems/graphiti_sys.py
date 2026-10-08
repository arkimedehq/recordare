# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""System B — Graphiti (temporal knowledge graph) on FalkorDB.

LLM: the spike's OpenAI-compatible endpoint (DeepSeek) in `json_object` mode.
Embeddings: local model via EMBED_MODEL (graph name carries the dimension). No reranker LLM (passthrough).
One episode per session, reference_time = session timestamp, group_id = user.
FalkorDB: `docker run -d --name memeval-falkordb -p 6390:6379 falkordb/falkordb:v4.22.0` (6.x breaks Graphiti fulltext indexes).
"""
from __future__ import annotations

import asyncio
import os
from collections.abc import Iterable
from datetime import datetime

from evalkit.embed import dim  # noqa: E402

os.environ.setdefault("EMBEDDING_DIM", str(dim()))  # must be set before graphiti_core is imported

from graphiti_core import Graphiti  # noqa: E402
from graphiti_core.cross_encoder.client import CrossEncoderClient  # noqa: E402
from graphiti_core.driver.falkordb_driver import FalkorDriver  # noqa: E402
from graphiti_core.embedder.client import EmbedderClient  # noqa: E402
from graphiti_core.llm_client.config import LLMConfig  # noqa: E402
from graphiti_core.llm_client.openai_generic_client import OpenAIGenericClient  # noqa: E402
from graphiti_core.nodes import EpisodeType  # noqa: E402
from graphiti_core.prompts.models import Message  # noqa: E402
from pydantic import ValidationError  # noqa: E402

from evalkit.common import USAGE, engine_model, fmt_when  # noqa: E402
from graphiti_core.search.search_config_recipes import COMBINED_HYBRID_SEARCH_RRF  # noqa: E402
from evalkit.embed import embed  # noqa: E402

NUM_RESULTS = 12


class LocalEmbedder(EmbedderClient):
    async def create(self, input_data: str | list[str] | Iterable) -> list[float]:
        text = input_data if isinstance(input_data, str) else " ".join(map(str, input_data))
        return embed([text])[0].tolist()

    async def create_batch(self, input_data_list: list[str]) -> list[list[float]]:
        return [v.tolist() for v in embed(input_data_list)]


class PassthroughReranker(CrossEncoderClient):
    async def rank(self, query: str, passages: list[str]) -> list[tuple[str, float]]:
        n = len(passages)
        return [(p, 1.0 - i / max(n, 1)) for i, p in enumerate(passages)]


class ValidatingGenericClient(OpenAIGenericClient):
    """In json_object mode DeepSeek sometimes echoes the JSON schema instead of an instance:
    validate against the response model and retry with an explicit hint."""

    async def _generate_response(self, messages, response_model=None, max_tokens=8192, model_size=None, **kw):
        attempt_msgs = list(messages)
        for attempt in range(3):
            result = await super()._generate_response(attempt_msgs, response_model, max_tokens,
                                                      *( [model_size] if model_size is not None else []))
            if response_model is None:
                return result
            try:
                response_model.model_validate(result)
                return result
            except ValidationError:
                print(f"  ! graphiti: invalid {response_model.__name__} (attempt {attempt + 1}), retrying", flush=True)
                attempt_msgs = list(messages) + [Message(role="user", content=(
                    "Your previous output was not a valid instance. Return ONLY a JSON object with the "
                    "actual field values (not the JSON schema)."))]
        return result


class GraphitiSystem:
    name = "graphiti"

    def __init__(self) -> None:
        self.loop = asyncio.new_event_loop()
        self.llm = ValidatingGenericClient(
            config=LLMConfig(api_key=os.environ["LLM_API_KEY"],
                             base_url=(f"http://localhost:{os.getenv('EMBED_PORT', '8790')}/v1"
                                       if os.getenv("ENGINE_NO_THINKING") else os.environ["LLM_BASE_URL"]),
                             model=engine_model(), small_model=engine_model(), temperature=0),
            structured_output_mode="json_object",
            max_tokens=8192,
        )
        self.g = Graphiti(
            graph_driver=FalkorDriver(host="localhost", port=int(os.getenv("FALKOR_PORT", "6390")),
                                      database=f"memeval_{dim()}"),
            llm_client=self.llm,
            embedder=LocalEmbedder(),
            cross_encoder=PassthroughReranker(),
        )

    def _run(self, coro):
        return self.loop.run_until_complete(coro)

    def reset(self, users: set[str]) -> None:
        # Fresh state per run. The FalkorDB driver stores each group_id in its own graph, so the
        # per-user graphs must be dropped too (vector indexes keep their dimension otherwise).
        for name in {self.g.driver._database, *users}:
            try:
                self._run(self.g.driver.client.select_graph(name).delete())
            except Exception:  # noqa: BLE001 - graph does not exist yet
                pass
        self._run(self.g.build_indices_and_constraints())

    def ingest(self, sessions: list[dict]) -> None:
        for s in sessions:
            body = "\n".join(f"{m['role']}: {m['content']}" for m in s["messages"])
            self._run(self.g.add_episode(
                name=s["id"],
                episode_body=body,
                source=EpisodeType.message,
                source_description=f"chat session {s['id']} ({fmt_when(s['ts'])})",
                reference_time=datetime.fromisoformat(s["ts"]),
                group_id=s["user"],
            ))
            print(f"  ingested {s['id']}", flush=True)
        for prompt, u in self.llm.token_tracker.get_usage().items():
            USAGE.calls["ingest"] = USAGE.calls.get("ingest", 0) + getattr(u, "call_count", 0)
            USAGE.prompt["ingest"] = USAGE.prompt.get("ingest", 0) + u.total_input_tokens
            USAGE.completion["ingest"] = USAGE.completion.get("ingest", 0) + u.total_output_tokens

    def context(self, user: str, question: dict) -> str:
        """Zep-style context: facts with validity, entity summaries and source episodes."""
        cfg = COMBINED_HYBRID_SEARCH_RRF.model_copy(deep=True)
        cfg.limit = NUM_RESULTS
        res = self._run(self.g.search_(question["q"], config=cfg, group_ids=[user]))
        out = ["FATTI:"]
        for e in res.edges:
            span = []
            if e.valid_at:
                span.append(f"valido dal {e.valid_at:%Y-%m-%d}")
            if e.invalid_at:
                span.append(f"non più valido dal {e.invalid_at:%Y-%m-%d}")
            out.append(f"- {e.fact}" + (f" ({', '.join(span)})" if span else ""))
        out.append("ENTITÀ:")
        out += [f"- {n.name}: {n.summary}" for n in res.nodes if n.summary]
        out.append("EPISODI (conversazioni originali):")
        out += [f"- [{fmt_when(ep.valid_at.isoformat())}] {ep.content}" for ep in res.episodes]
        return "\n".join(out)
