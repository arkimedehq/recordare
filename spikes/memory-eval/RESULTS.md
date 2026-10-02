# Memory engine evaluation — results

## Round 2 (2026-10-02) — `bge-m3`, 24 questions, prototype D

Answer + judge: DeepSeek `deepseek-flash` (temperature 0) for every system, as in round 1.
Embeddings: `BAAI/bge-m3` (1024 dims, sentence-transformers as Arkimede) for every system.
Dataset: round 1 + 6 questions aimed at what the designs differ on (q19–q24: "last week",
"when did I change car", "did I ski in December?", "this week", third-party achievements over
the year, "how many times at Cervinia") → 24 questions. Same noise set (187 sessions, 507 messages).

| System | Engine LLM | Base (17 sessions) | **Noise (187 sessions)** | Ingest (noise) |
|---|---|---|---|---|
| A — baseline (BM25 + vector over raw messages, RRF top-8) | — | 88% | **67%** | 13 s |
| B — Graphiti 0.30 + FalkorDB 4.22 | `deepseek-v4-pro`, thinking off | 90% | **81%** | 2244 s ¹ |
| C — Memobase 0.0.42 | `deepseek-v4-pro`, thinking off | 88% | **88%** | 264 s |
| **D — prototype of our design** (`systems/d_sys.py`) | `deepseek-v4-pro`, thinking off | **100%** | **96%** | 318 s |
| C — Memobase, local | Ollama `qwen3:8b`, thinking off | 79% | **65%** | 1294 s |
| D — prototype, local | Ollama `qwen3:8b`, thinking off | 85% | **73%** ² | 1055 s |

¹ Several runs shared the CPU (bge-m3 in each process + Ollama): ingest times are indicative only.
² The local D noise run used the prompt before the last rule ("a state change is both an episode
and a fact"); the DeepSeek D rows use the final prompt.

Run-to-run variance at temperature 0 is about ±1 question (±4 points): D noise scored 98%, 92%
and 96% across three prompt iterations; read differences under ~5 points as noise.

### What D is

One engine call per session (= one idle window, D1) extracts episodes (bi-temporal, date
precision, plan/event, people, place, importance, valence/feelings/opinion — D10/D21), plan
updates (open plans are shown to the extractor; a later mention confirms or cancels them) and
profile facts with supersession history. Daily digests (D8). Recall: the calling agent's model
(`LLM_MODEL`) fills `from` / `to` / `mode` / `topic` as it would fill `search_episodes`
params (D12); episodes are filtered by event date and ranked by vector + importance + recency
(D14), list mode is chronological; context also carries digests (period questions), facts with
history and 3 raw-log snippets with provenance (D13).

**Fairness caveat**: D got three prompt iterations after looking at base results; B and C were
used as shipped (only infra fixes). The rules added are generic, not dataset answers: absolute
dates in content; "stasera / oggi" is an event, not a plan; undated news → message date,
precision approximate; a lived state change is both an episode and a fact. A held-out dataset
is needed before trusting the gap fully (see open items).

### Findings

1. **D ≥ Memobase on every axis measured**: +8 points under noise with DeepSeek, +8 with a
   local model; it answers the questions Memobase misses ("this week", plan status, emotions in
   detail) because of explicit event dates, the date filter and plan status.
2. **Graphiti improved with bge-m3** (75% → 81% under noise) but its structural limit stays:
   facts supersede each other (q01 "last time I skied" still fails on base), slowest ingest.
   Not a candidate.
3. **Embeddings matter less than structure**: bge-m3 lifted the baseline (56% → 67%) and
   Graphiti, Memobase stayed at ~88%; the spread between systems comes from the data model.
4. **Local (sovereign) deployment works but costs accuracy**: `qwen3:8b` loses 12–23 points
   for both engines (misresolved dates, omitted details, Italian quality). A bigger local model
   (or a hybrid: local embeddings + hosted extraction) is the realistic option for now.
   Memobase's SDK default 60 s timeout is too short with a local model (raised to 600 s).
5. **The date-range step belongs to the agent**: with the planner on the small local model, D
   dropped further (wrong ranges for "last time" / "last week"). In the service the client
   agent fills `from` / `to`; Recordare should also offer a deterministic resolver for common
   expressions (this week / last week / month names) so small agents do not have to compute
   calendars.
6. **Ingest cost (D, DeepSeek)**: ≈ 490 input + 16 output tokens per message on the noise set
   (one call per session, ~1 k tokens of fixed prompt per call). Batching per idle window
   rather than per short session is the main lever. Recall adds ~600 tokens per question
   (planner), which in the service is part of the agent's tool call.

### Spike fixes in this round
- Graphiti's FalkorDB driver stores each `group_id` in its own graph (`luca`, `elena`): the
  per-run reset only cleared the default graph, so **round-1 Graphiti runs may have accumulated
  data across runs**. Reset now drops the per-user graphs.
- Embedding dimension is derived from the model (Memobase config, Graphiti graph name).
- Gateway (`embed_server.py`) also fronts Ollama (`reasoning_effort: none` disables qwen3
  thinking on the OpenAI-compatible API).

### Open items (not blocking D23)
- Held-out evaluation set written without looking at D's prompts (different user, other
  life domains, English sessions) to confirm the gap.
- Local model sweep (`qwen3:14b`, `gemma3`, …) for the sovereign profile.

## Round 1 (2026-10-02, morning) — MiniLM, 18 questions

Answer + judge: DeepSeek `deepseek-flash` (temperature 0) for every system — constant, so the
comparison measures memory, not the answering model. Engine-internal extraction: see column.
Embeddings: local `paraphrase-multilingual-MiniLM-L12-v2` (384 dims) for every system.
Dataset: 15 Italian sessions of `luca` + 2 of `elena`, 18 questions. "Noise" = +150
deterministic filler sessions for `luca` (+20 for `elena`) with lexical traps (`gen_noise.py`).

### Final scores

| System | Engine LLM (extraction) | Base (17 sessions) | **Noise (187 sessions)** | Ingest (noise) |
|---|---|---|---|---|
| A — baseline: BM25 + vector over raw messages, RRF top-8 | — (no LLM) | 86% | **56%** | 4 s |
| B — Graphiti 0.30 + FalkorDB 4.22 | `deepseek-v4-pro`, thinking off | 81% | **75%** | 1240 s (≈6.6 s/session) |
| C — Memobase 0.0.42 | `deepseek-v4-pro`, thinking off | 81% | **83%** | 258 s (≈1.4 s/session) |

Earlier runs, kept for the record (misleading, see "What went wrong"):
Graphiti with `deepseek-flash` 53%; Memobase with `deepseek-flash` or `deepseek-v4-pro` *with
thinking* 3% (silent empty extraction).

### What went wrong in the first round (lessons)

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

### Per-system analysis

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

### Embedding models (retrieval only, no LLM — `emb_eval.py`)

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

### Decision status after round 1 (superseded by round 2 → D23)

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
