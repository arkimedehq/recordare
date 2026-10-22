# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""System B — Graphiti (temporal knowledge graph) on FalkorDB.

LLM: the spike's OpenAI-compatible endpoint (ENGINE_MODEL; with ENGINE_NO_THINKING through the local gateway, which
disables reasoning) in `json_object` mode. Every chat call's tokens (cache hits included) are recorded under phase
'ingest' — Graphiti's generic client keeps no usage of its own — and calls made while answering a question under
'search' (none with this search recipe).
Embeddings: local model via EMBED_MODEL (graph name carries the dimension); calls counted under 'embed' (no tokens,
local). No reranker LLM (passthrough).
Ingest (mirrors the Mem0 adapter, `market_common`): one `message` episode per session, reference_time = session
timestamp, group_id = user; lines are "user: …" / "assistant: …", other participants of a group chat "<name>: …"
(Graphiti's message format is "actor: content"), and the session header says it is a group chat.
Learned sources (WORK_PLAN 8.9; blind9–11): a document / note / page is one `text` episode (title, author, who provided
it, text); forgetting a source is Graphiti's own `remove_episode` (the episode, the edges it created, the entities
only it mentions).
FalkorDB: `docker run -d --name memeval-falkordb -p 6390:6379 falkordb/falkordb:v4.22.0` (6.x breaks Graphiti fulltext indexes).
"""
from __future__ import annotations

import asyncio
import json
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

from evalkit.common import USAGE, fmt_when  # noqa: E402
from graphiti_core.search.search_config_recipes import COMBINED_HYBRID_SEARCH_RRF  # noqa: E402
from evalkit.embed import embed  # noqa: E402
from systems.market_common import engine_llm, other_text, session_header, source_text  # noqa: E402

NUM_RESULTS = 12
_phase = {"name": "ingest"}


class LocalEmbedder(EmbedderClient):
    async def create(self, input_data: str | list[str] | Iterable) -> list[float]:
        USAGE.add("embed", None)
        text = input_data if isinstance(input_data, str) else " ".join(map(str, input_data))
        return embed([text])[0].tolist()

    async def create_batch(self, input_data_list: list[str]) -> list[list[float]]:
        USAGE.add("embed", None)
        return [v.tolist() for v in embed(input_data_list)]


class PassthroughReranker(CrossEncoderClient):
    async def rank(self, query: str, passages: list[str]) -> list[tuple[str, float]]:
        n = len(passages)
        return [(p, 1.0 - i / max(n, 1)) for i, p in enumerate(passages)]


class ValidatingGenericClient(OpenAIGenericClient):
    """In json_object mode DeepSeek sometimes echoes the JSON schema instead of an instance:
    validate against the response model and retry with an explicit hint. Records every call's usage."""

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        create = self.client.chat.completions.create

        async def counted(*a, **kw):
            resp = await create(*a, **kw)
            USAGE.add(_phase["name"], resp.usage)
            return resp

        self.client.chat.completions.create = counted

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


def _line(m: dict) -> str:
    return other_text(m) if m["role"] == "other" else f"{m['role']}: {m['content']}"


class GraphitiSystem:
    name = "graphiti"

    def __init__(self) -> None:
        self.loop = asyncio.new_event_loop()
        llm = engine_llm()
        self.llm = ValidatingGenericClient(
            config=LLMConfig(api_key=llm["api_key"], base_url=llm["base_url"],
                             model=llm["model"], small_model=llm["model"], temperature=0),
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
        self.by_source: dict[str, str] = {}  # learned source id -> its episode uuid
        self.users: set[str] = set()

    def _run(self, coro):
        return self.loop.run_until_complete(coro)

    def reset(self, users: set[str]) -> None:
        # Fresh state per run. The FalkorDB driver stores each group_id in its own graph, so the
        # per-user graphs must be dropped too (vector indexes keep their dimension otherwise).
        self.users = set(users)
        for name in {self.g.driver._database, *users}:
            try:
                self._run(self.g.driver.client.select_graph(name).delete())
            except Exception:  # noqa: BLE001 - graph does not exist yet
                pass
        self._run(self.g.build_indices_and_constraints())
        # Each user's graph needs its indexes before the first episode: the driver clone Graphiti makes per group_id
        # only schedules their creation as a background task, which an interrupted event loop can leave half done.
        for user in users:
            self._run(self.g.driver.clone(database=user).build_indices_and_constraints())

    def ingest(self, sessions: list[dict]) -> None:
        _phase["name"] = "ingest"
        for s in sessions:
            if s.get("type") == "forget_source":
                uuid = self.by_source.pop(s["source"], None)
                if uuid:  # remove_episode works on self.g.driver; the episode lives in the user's own graph
                    default, self.g.driver = self.g.driver, self.g.driver.clone(database=s["user"])
                    try:
                        self._run(self.g.remove_episode(uuid))
                    finally:
                        self.g.driver = default
                print(f"  forgot {s['source']}", flush=True)
                continue
            if s.get("type") == "source":
                body, kind, desc = source_text(s), EpisodeType.text, f"document provided in chat ({fmt_when(s['ts'])})"
            else:
                body = "\n".join(_line(m) for m in s["messages"])
                kind, desc = EpisodeType.message, session_header(s)
            out = self._run(self.g.add_episode(
                name=s["id"], episode_body=body, source=kind, source_description=desc,
                reference_time=datetime.fromisoformat(s["ts"]), group_id=s["user"],
            ))
            if s.get("type") == "source":
                self.by_source[s["id"]] = out.episode.uuid
            print(f"  ingested {s['id']} (+{len(out.nodes)} entities, +{len(out.edges)} facts)", flush=True)

    def context(self, user: str, question: dict) -> str:
        """Zep-style context: facts with validity, entity summaries and source episodes."""
        _phase["name"] = "search"
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

    def dump(self) -> str:
        """Every fact (edge) per user with its validity (results/<label>-memory.json), for inspection."""
        out = {}
        for user in sorted(self.users):
            records, _, _ = self._run(self.g.driver.clone(database=user).execute_query(
                "MATCH (a:Entity)-[e:RELATES_TO]->(b:Entity) WHERE e.group_id = $g "
                "RETURN a.name AS a, b.name AS b, e.fact AS fact, e.valid_at AS valid_at, e.invalid_at AS invalid_at",
                g=user))
            out[user] = [{k: (str(v) if v is not None else None) for k, v in r.items()} for r in records]
        return json.dumps(out, ensure_ascii=False, indent=2)
