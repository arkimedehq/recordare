# Work plan

Status: **draft (2026-10-02)**. Covers roadmap phase 1 (episodic memory,
`EPISODIC_MEMORY_TODO.md`) from engine decision to a first Arkimede integration.
Later roadmap phases (`DIGITAL_TWIN_VISION.md` → Roadmap) are listed at the end and get
their own plan when phase 1 is done.

## Guiding constraints

- **Client-neutral**: Recordare serves any agentic platform. Arkimede is the first client,
  not a special case — no Arkimede-specific fields, endpoints or assumptions in the
  contracts. Every feature must work through the public contracts (REST ingest, MCP, SDK).
- **Two integration levels** (vision → Architecture): *basic* = MCP tools only (Claude
  Desktop / Code, Cursor, …); *full* = MCP + REST ingest + SDK. Both are tested.
- **Any LLM / embedding provider** (D27): DeepSeek and local Ollama are our test setups only;
  provider differences live in configuration profiles, prompts and schemas are provider-neutral.
- **Engine behind a port**: the memory engine (build D / Memobase / hybrid) sits behind an
  internal interface, so the contracts and the service skeleton do not depend on D23.
- **Evaluate, don't assume**: the spike dataset becomes a regression harness that runs
  against the service through its public API.
- **Lessons from the spike**: every LLM call disables reasoning or sizes `max_tokens` for
  it; structured output is validated and retried; prompts exist in IT and EN.
- Stack: TypeScript / NestJS, Postgres, BullMQ + Redis (same family as Arkimede: NestJS 10,
  TypeORM, BullMQ, zod).

## Milestones

M0 and M1 can run in parallel: contracts do not depend on the engine choice.

### M0 — Close the engine decision (spike) → D23

**Done 2026-10-02** (`spikes/memory-eval/RESULTS.md`, round 2): D 96% under noise vs Memobase
88%, Graphiti 81%, baseline 67%; local `qwen3:8b` D 73% vs Memobase 65%. D23 approved: build
D (`EPISODIC_MEMORY_TODO.md`); `deepseek-flash` = same quality as `v4-pro` → our test default (any provider, D27). Held-out dataset (blind to D's prompts): D 86% vs Memobase 61%
under noise. Ideas to borrow / reject and cost principles: `ENGINE_IDEAS.md`. Left open: local
model sweep.

| # | Task | Output |
|---|---|---|
| 0.1 | Re-run Memobase with `bge-m3` embeddings (via `embed_server.py`), base + noise. Graphiti once, for completeness only: its fact-supersession model fails "how many times" / "last time" structurally, embeddings won't fix that — the real contest is Memobase vs D | Updated `RESULTS.md` |
| 0.2 | Prototype D in the spike: episode extraction prompt (bi-temporal, plans, emotions), daily digests, date-range filter (time-aware query expansion), vector `bge-m3` + BM25 with tuned fusion | `systems/d_sys.py`, scores base + noise |
| 0.3 | Local model run (Ollama, e.g. qwen3, thinking off) for C and D | Sovereign/local story verified or ruled out |
| 0.4 | Extend the dataset with questions D is designed for and the others miss: "this week", "how many times", cancelled plans | More discriminating eval |
| 0.5 | Record **D23** in `EPISODIC_MEMORY_TODO.md` | Decision |

Decision rule (proposal): if D is within ~5 points of Memobase under noise, build D (native
stack, date filter, digests, plans, provenance, disclosure later); otherwise adopt Memobase
behind the engine port (hybrid) and revisit after M4.

### M1 — Contracts (engine-independent)

| # | Task | Output |
|---|---|---|
| 1.1 | **Identity model**: `client` (platform, API key) → `external identity` (client + external user id) → `person` (one memory per person). Linking flow for the same person across clients | `docs/API.md` § Identity |
| 1.2 | **REST ingest**: `POST api/v1/ingest/messages` (batch). Per message: external conversation id, external message id, role, author, content, `sentAt`, channel, optional interlocutor identity. Idempotent on (client, conversation, message); edit and delete endpoints | `docs/API.md` § Ingest + OpenAPI |
| 1.3 | **MCP tools**: `log_episode`, `search_episodes` (D11/D12) — JSON schemas valid across LLM providers (no unsupported keywords, flat params) | `docs/API.md` § MCP |
| 1.4 | **Read API** for host UIs (timeline / diary, edit, delete, "forget period" — D16/D18) | `docs/API.md` § Timeline |
| 1.5 | MCP transport + auth: streamable HTTP, bearer key bound to a person (basic level has no ingest, so the key is the identity) | Decision D24 |
| 1.6 | SDK shape: thin TS client `@arkimedehq/recordare-client` (ingest, timeline, typed errors) | Package skeleton |

### M2 — Service scaffold

| # | Task |
|---|---|
| 2.1 | NestJS project, strict TS, lint, `tsc --noEmit`, test runner; CI on every push |
| 2.2 | Postgres + migrations (TypeORM); pgvector with HNSW index (**D25**) |
| 2.3 | Ports and adapters: `LlmPort` (adapters OpenAI-compatible + native Anthropic, provider profiles from config — reasoning off, structured-output mode, token param, caching, usage — validate + retry; D27), `EmbeddingPort` (OpenAI-compatible, `bge-m3` default), `VectorStorePort` (pgvector adapter; Qdrant would be just another adapter), `ClockPort`, `QueuePort` (BullMQ) |
| 2.4 | Auth: hashed API keys per client, admin bootstrap, person/identity tables |
| 2.5 | `docker-compose.yml` (service, Postgres, Redis), health endpoint, config via env |
| 2.6 | i18n scaffolding for prompts and messages (IT/EN) |

### M3 — Layer 0: raw log

| # | Task |
|---|---|
| 3.1 | Ingest endpoint → raw message log (verbatim, provenance, idempotency, edit/delete) |
| 3.2 | Raw-log search (FTS + vector, tuned fusion) — this is also the D13 fallback |
| 3.3 | MCP server with `search_episodes` returning raw-log hits only (first usable increment) |
| 3.4 | **Eval harness v1**: spike dataset ingested through the REST API, questions asked through MCP, scored by the same judge — baseline number for the service |

### M4 — Layer 1: episodes (encoding + recall)

| # | Task |
|---|---|
| 4.1 | Per-conversation idle debounce (D1/D5) + service-side cursor (D22) + nightly sweep |
| 4.2 | Episode extraction (D2, D9, D10, D21): bi-temporal, `datePrecision`, plans with `validUntil` / `invalidatedAt`, valence / feelings / opinion, `people`, provenance to raw message |
| 4.3 | `log_episode` (explicit capture, max importance) |
| 4.4 | `search_episodes` full: date-range filter, `mode: search \| list`, ranking relevance + recency + importance + access boost (D14), automatic raw-log fallback (D13); deterministic resolver for common period expressions (this / last week, month names) |
| 4.4b | Eval suite = `dataset/` + `dataset_holdout/` (+ a new blind set when prompts change a lot); gaps from `ENGINE_IDEAS.md` covered (rescheduled plans, corrections, `latest` mode, facts as-of) |
| 4.4c | Cost budget per idle window and per person/month, measured by the per-call accounting; CI fails if a change raises tokens per message beyond the budget |
| 4.5 | Per-person toggle `episodicMemoryEnabled` (D4), default off |
| 4.5b | **Provider matrix**: eval suite run against DeepSeek, Ollama and at least one of OpenAI / Anthropic / Gemini; CLI `eval --config <profile>`; supported-models table (D27) |
| 4.6 | Eval harness v2: compare with M0 scores; must not regress below the D23 prototype |

### M5 — Layer 2: consolidation

| # | Task |
|---|---|
| 5.1 | Nightly job per person with new episodes (zero LLM calls if nothing new) |
| 5.2 | Daily digests + monthly roll-up (D8); period questions read digests first |
| 5.3 | Dedup of the same event across conversations (link, never rewrite) |
| 5.4 | Pattern promotions with `episode_promotions` (D20) — destination depends on **D26** |
| 5.5 | User-driven deletion: episode, period; digests recomputed; vectors removed (D16) |

### M6 — Integrations (proof of client neutrality)

| # | Task | Where |
|---|---|---|
| 6.1 | **Basic level**: configure Claude Code / Claude Desktop as MCP client, run a scripted session, verify tools work | This repo (docs + smoke test) |
| 6.2 | **Arkimede full level**: register Recordare in its MCP client; non-blocking ingest of persisted messages (outbox + retry, never fails the chat); identity mapping Arkimede user → person | `personalAgent`, own branch |
| 6.3 | Arkimede settings: `episodicMemoryEnabled` toggle + Diary tab (D18) via the Recordare timeline API | `personalAgent` |
| 6.4 | Arkimede regression checklist (`EPISODIC_MEMORY_TODO.md` → Regression checklist): A-MEM, `search_conversations`, `search_memory` unchanged | `personalAgent` |

### M7 — Hardening and release

- Security: per-person data isolation tests, key rotation, rate limits, audit log of reads
  (the twin is a high-value secret — vision principle 5).
- Backup / restore, export of a person's data, full deletion.
- README, `docs/API.md`, deployment guide, AGPL headers, Docker image.
- Publish to `arkimedehq/recordare` — **only after the owner's OK**.

## Open decisions to take along the way

| Id | Question | Proposal | When |
|---|---|---|---|
| D23 | Engine: build D / adopt Memobase / hybrid | **Build D — approved 2026-10-02** | Done |
| D27 | LLM / embedding providers | **Any provider** via config profiles; DeepSeek + Ollama only as test setups | Done (2026-10-02) |
| D24 | MCP transport and per-person auth for basic-level clients | Streamable HTTP, bearer key bound to a person | M1 |
| D25 | Vector store | **pgvector** (proposed 2026-10-02, see below) | M2 |
| D26 | Where pattern promotions go while A-MEM lives in Arkimede | Exposed by Recordare as `pending` proposals via API; the client decides (Arkimede imports them into A-MEM) | M5 |
| — | Single-tenant (one install per family) vs multi-tenant | Model `person` + `client` so both work; start single-tenant | M1 |

### D25 rationale — pgvector (2026-10-02)
- Recordare has its own DB anyway (cannot share Arkimede's Qdrant), so the choice is
  Postgres alone vs Postgres + Qdrant.
- One container less on home deployments (Postgres and Redis are needed regardless).
- The date-range filter is central: vector + FTS + `occurredAt BETWEEN` in one SQL query,
  no payload duplication, no cross-store fusion.
- Deletion is transactional: "forget March" (D16) removes episodes, digests and vectors in
  one transaction — no orphan vectors in a personal diary. One `pg_dump` for backup/export.
- Volumes are small (thousands of episodes per person): HNSW is more than enough.
  Memobase uses Postgres + pgvector too.
- Not chosen: **Qdrant** (familiar from Arkimede, built-in sparse+dense hybrid, scales
  further) — kept reachable through `VectorStorePort`. **TimescaleDB** (time-series
  hypertables: no benefit at our volume, partitioning constraints, non-OSI Timescale
  License next to AGPL, heavy image, rarely available on managed Postgres).
- Escape hatch: **pgvectorscale** (PostgreSQL licence) adds a StreamingDiskANN index on the
  same `vector` type — only an index change, no schema migration, if volumes ever grow.

## After phase 1

Roadmap phases 2–8 (self-model, contacts & disclosure, twin interface, initiative L1,
voice, initiative L2, legacy mode) and the A-MEM migration follow the order in
`DIGITAL_TWIN_VISION.md`. Phase 1 must already keep `people` on episodes and
owner-lived vs twin-lived provenance in the data model, so phase 3 can add disclosure
without migrating episodes.

## Working conventions

- One branch per milestone (`m0-engine-decision`, `m1-contracts`, …), merged `--no-ff`
  after the owner's OK; branch deleted after merge.
- Each milestone ends with: tests green, `tsc --noEmit` clean, eval harness run (from M3),
  docs updated (decisions recorded as D-numbers).
