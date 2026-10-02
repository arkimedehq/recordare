# Memory engine evaluation — results (2026-10-02)

Answer + judge: DeepSeek `deepseek-flash` (temperature 0) for every system — constant, so the
comparison measures memory, not the answering model. Engine-internal extraction: see column.
Embeddings: local `paraphrase-multilingual-MiniLM-L12-v2` (384 dims) for every system.
Dataset: 15 Italian sessions of `luca` + 2 of `elena`, 18 questions. "Noise" = +150
deterministic filler sessions for `luca` (+20 for `elena`) with lexical traps (`gen_noise.py`).

## Final scores

| System | Engine LLM (extraction) | Base (17 sessions) | **Noise (187 sessions)** | Ingest (noise) |
|---|---|---|---|---|
| A — baseline: BM25 + vector over raw messages, RRF top-8 | — (no LLM) | 86% | **56%** | 4 s |
| B — Graphiti 0.30 + FalkorDB 4.22 | `deepseek-v4-pro`, thinking off | 81% | **75%** | 1240 s (≈6.6 s/session) |
| C — Memobase 0.0.42 | `deepseek-v4-pro`, thinking off | 81% | **83%** | 258 s (≈1.4 s/session) |

Earlier runs, kept for the record (misleading, see "What went wrong"):
Graphiti with `deepseek-flash` 53%; Memobase with `deepseek-flash` or `deepseek-v4-pro` *with
thinking* 3% (silent empty extraction).

## What went wrong in the first round (lessons)

1. **Reasoning models + capped `max_tokens` = empty output, silently.** Memobase's LLM wrapper
   caps `max_tokens=1024`; DeepSeek models think first and spend the budget, so content is
   empty and the pipeline exits without error (`if not user_memo_str: return`). Same failure hit
   our own judge at `max_tokens=200`. Fix used: local gateway (`embed_server.py`) forwarding to
   DeepSeek with `thinking: {type: disabled}`. **Any engine we adopt or build must disable
   reasoning or size `max_tokens` for it.**
2. **Graphiti in `json_object` mode**: DeepSeek sometimes echoes the JSON schema instead of an
   instance → patched with a validating client that retries (`systems/graphiti_sys.py`).
3. **FalkorDB 6.0** (released 2026-10-01) breaks Graphiti's fulltext index creation → pinned 4.22.
4. **Clean datasets flatter naive retrieval**: the baseline drops 86% → 56% with noise.

## Per-system analysis

**C — Memobase (best under noise).** Profile slots (semantic) + event timeline with *two dates*
(`mention` vs `event in`) — essentially our D21/D22 design. Robust to lexical traps. Fast ingest.
Weak points: project activity slowing (last push 2026-01), Python + Postgres + Redis server,
prompts officially only `en`/`zh`, the 1024-token cap above, misses on "this week"
(relative-period) and some partial detail answers.

**B — Graphiti (good, but structural mismatch).** Treats facts as *states that supersede each
other*: "went skiing at Cervinia" becomes "no longer valid from 7 Feb" after the Livigno trip,
so "last time I skied" / "how many times" fail. Excellent for real state changes (car, address).
Slow ingest, graph DB (Neo4j/FalkorDB) dependency, mixed-language facts.

**A — baseline.** Strong floor on point lookups and provenance; collapses with noise (coffee
machine answered for "che macchina ho?"; March trip pushed out of top-8); no date filter.

## Embedding models (retrieval only, no LLM — `emb_eval.py`)

recall@8 of gold sessions, vector-only; `st:` = sentence-transformers exactly as Arkimede's
`embedding-service` (same query/document prompt logic):

| Model | Base | Noise | RSS | CPU emb/s (M4) |
|---|---|---|---|---|
| `st:intfloat/multilingual-e5-small` | 85% | 59% | 0.98 GB | 389 |
| `st:mixedbread-ai/mxbai-embed-large-v1` | 84% | 60% | 0.77 GB | 8 |
| `st:BAAI/bge-m3` | **96%** | **76%** | 1.41 GB | 26 |
| `paraphrase-multilingual-MiniLM-L12-v2` (fastembed) | 88% | 75% | — | 273 |
| `intfloat/multilingual-e5-large` | not measured (fastembed ONNX external-data bug) | | | |

Hybrid BM25+vector fusion *hurts* under noise (62-68% vs 75-76% vector-only) — fusion weights
must be tuned. Outcome: Arkimede moved to bge-m3 (2026-10-02, both deploys).
Note: the engine scores above used MiniLM; re-running B/C with bge-m3 is an open item.

## Decision status — OPEN

The first-round decision ("build our own engine D") was based on broken runs and is withdrawn.
Options now on the table:

1. **Adopt Memobase as the engine** behind Recordare's twin layer (fastest path; must handle
   thinking/token cap, Italian prompts, project health risk — possibly fork).
2. **Build D (our design)** taking Memobase's model as the reference (profile + dated events) in
   NestJS/Postgres, with what we already know beats it on paper: date-range filter, digests,
   plans/validity, provenance, disclosure tiers.
3. Hybrid: Memobase now, D later behind the same API.

Before deciding: re-run B/C (and a D prototype) with `bge-m3` embeddings and with a local model
(Ollama, e.g. qwen3 with thinking off) to check the sovereign/local deployment story.
