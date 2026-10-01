# Memory engine evaluation (spike)

Goal: decide whether Recordare (the twin service) builds its own episodic memory engine
(design D1–D22 in `../../docs/EPISODIC_MEMORY_TODO.md`) or adopts an existing open-source
engine and builds only the twin layer on top. Time box: 1–2 days.


## Systems under test

| ID | System | Why |
|---|---|---|
| **A** | Raw baseline — hybrid FTS + vector over raw messages (≈ today's `search_conversations` + a vector leg) | Lower bound: what we get with zero memory engineering |
| **B** | **Graphiti** (getzep/graphiti, Apache-2.0) + FalkorDB | Closest to our decisions: raw episodes, bi-temporal model, fact validity, MCP server; very active |
| **C** | **Memobase** (memodb-io/memobase, Apache-2.0) | User profile + event timeline, built for temporal questions; activity slowing (last push 2026-01) |
| *(D)* | Prototype of our design | Only if B and C both fail the must-have criteria |

Not tested: Mem0 / Cognee / MIRIX / Letta / MemOS (fact- or graph-centric, or agent-internal;
see prior art), Second Me (stalled since 2025-09, fine-tuning-centric — idea kept for phase 2).

## Dataset

`dataset/conversations.json` — synthetic Italian sessions (Jan–Mar 2026) of user `luca`
plus user `elena` (isolation check). Covers: events with relative dates ("ieri",
"sabato"), people, emotions, a cancelled plan, a confirmed plan, a vague future plan,
a knowledge update (Golf → Tesla), technical noise.

`dataset/questions.json` — 18 questions with `asked_at`, reference answer and
`must_not` markers. Categories: point-temporal, aggregate, paraphrase, period,
plan-cancelled, plan-confirmed, knowledge-update, historical-state, emotion, people,
third-party-event, relative-date resolution, negative, future-plan, small-detail,
provenance, relative-period, detail-recall.

## Procedure

1. **Ingest** every session in timestamp order, per user, using the message timestamp
   as reference time (systems must resolve "ieri" against it, not ingestion time).
2. **Query**: for each question, ask the system for context as user `luca` at
   `asked_at` (systems that support a reference time get it).
3. **Answer**: the **same LLM and the same prompt** produce the final answer from each
   system's context (fair comparison: we test memory, not the answering model).
4. **Judge**: LLM judge against `expected` / `must_not` (correct / partial / wrong),
   then manual review of disagreements.

## Criteria

| Criterion | Measure | Must-have? |
|---|---|---|
| Answer accuracy | % correct (partial = 0.5), per category | ✅ ≥ baseline A + clear margin on temporal / aggregate / plan categories |
| User isolation | No `elena` content in `luca` answers | ✅ zero leaks |
| Italian | Extraction and retrieval quality on Italian text | ✅ |
| Ingest cost | LLM calls and tokens per ingested message | ✅ sustainable (report € / 1000 messages) |
| Footprint | RAM / containers at idle and under ingest (Docker VM = 8 GB, like the home box) | ✅ fits alongside Arkimede on 8 GB |
| Provenance | Can a result point back to the source session/message? | ✅ |
| Ingest latency | Time until a message is queryable | — |
| Query latency | p50 / p95 context retrieval | — |
| Extensibility | Can disclosure levels, digests, twin-lived vs owner-lived be added on top without forking? | ✅ (qualitative) |
| Integration | REST / MCP / SDK from a NestJS service; Python sidecar acceptable? | — (qualitative) |
| Health | Activity, licence, maintainers | — |

## Decision rule

- One of B / C passes all must-haves → Recordare = twin layer on top of it.
- Both fail → build our design (D), reusing the lessons (failure modes per category).
- Partial (e.g. great temporal, weak extensibility) → discuss trade-off.

## Prerequisites (to confirm)

- LLM for ingest / answer / judge: OpenAI-compatible endpoint + key (same model for
  all systems). Embeddings: Arkimede `embedding-service` or provider embeddings.
- Docker: FalkorDB (B), Memobase server + Postgres + Redis (C).
- Runner in Python (both engines ship Python SDKs); the spike language does not
  constrain the service stack (NestJS).
