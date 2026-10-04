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

### M0.5 — Eval hygiene before building (2026-10-02)

**Done**: gold audit applied, judge validated and rewritten (false accepts 0 %, false rejects
≤ 3 %), as-of ingestion in the runner; D 100 % / baseline 66–83 % on the base sets
(`spikes/memory-eval/RESULTS.md` → Harness v1.1).

| # | Task |
|---|---|
| 0.5.1 | Gold audit of `dataset/` and `dataset_holdout/` by a second reader (dates, weekdays, year boundary, who is who) — fixes recorded in `spikes/memory-eval/GOLD_AUDIT.md` |
| 0.5.2 | Judge validation: per question, vague / specific-but-wrong / correct-plus-extra / correct-paraphrase answers; measure judge false-accept and false-reject rates; fix the judge prompt (per-type rules) until both are low |

The rest of the eval upgrade (N ≥ 3 runs + paired tests, controls and baselines, correct /
hallucinated / omitted outcomes, per-stage extraction eval, new probe types, cost columns)
lands in M3/M4 as the service's regression suite (`literature/README.md` → Evaluation).

### M1 — Contracts (engine-independent)

**Draft done 2026-10-03, revision 2 after a consistency review** (branch `m1-contracts`): `docs/API.md` (identity, auth, ingest, MCP tools,
read API, SDK) and `docs/DATA_MODEL.md` (data model v1 with D28–D30). OpenAPI is generated from the
zod schemas in M2 rather than hand-written.

| # | Task | Output |
|---|---|---|
| 1.1 | **Identity model**: `client` (platform, API key) → `external identity` (client + external user id) → `person` (one memory per person). Linking flow for the same person across clients | `docs/API.md` § Identity |
| 1.2 | **REST ingest**: `POST api/v1/ingest/messages` (batch). Per message: external conversation id, external message id, role, author, content, `sentAt`, channel, optional interlocutor identity. Idempotent on (client, conversation, message); edit and delete endpoints | `docs/API.md` § Ingest + OpenAPI |
| 1.3 | **MCP tools**: `log_episode`, `search_episodes` (D11/D12) — JSON schemas valid across LLM providers (no unsupported keywords, flat params) | `docs/API.md` § MCP |
| 1.3b | **Data model v1** with the fields of D28 + D29 + D30 (plan statuses incl. `unresolved` and typed patches, kinds, bi-temporal facts with `unknown_current`, `corrects` / `supersedes`, `derivedFrom` / `needsRecheck`, `origin` incl. `assistant_stated`, `disclosure` + audience set, source ids, evidence message ids) | `docs/DATA_MODEL.md` |
| 1.4 | **Read API** for host UIs (timeline / diary, edit, delete, "forget period" — D16/D18) | `docs/API.md` § Timeline |
| 1.5 | MCP transport + auth: streamable HTTP, bearer key bound to a person (basic level has no ingest, so the key is the identity) | Decision D24 |
| 1.6 | SDK shape: thin TS client `@arkimedehq/recordare-client` (ingest, timeline, typed errors) | Package skeleton |

### M2 — Service scaffold

**Done 2026-10-03** (branch `m2-scaffold`): NestJS 12 + TypeScript 6 strict (tsc build, SWC for dev and
tests — the Nest 12 CLI does not run on Node 20), env validation, health, initial migration of data
model v1 (home / research profile), provider-neutral `LlmPort` with OpenAI-compatible and native
Anthropic adapters and profiles (verified live on DeepSeek and Ollama with `npm run smoke:llm`),
embedding and clock ports, v1 auth (client API keys, personal tokens, admin API, owner resolution),
docker-compose, CI, Dockerfile. Moved to where they are first used: `QueuePort` (BullMQ idle jobs) →
M3, `VectorStorePort` and IT/EN prompt files → M4.

| # | Task |
|---|---|
| 2.1 | NestJS project, strict TS, lint, `tsc --noEmit`, test runner; CI on every push |
| 2.2 | Postgres + migrations (TypeORM); pgvector with HNSW index (**D25**) |
| 2.3 | Ports and adapters: `LlmPort` (adapters OpenAI-compatible + native Anthropic, provider profiles from config — reasoning off, structured-output mode, token param, caching, usage — validate + retry; D27), `EmbeddingPort` (OpenAI-compatible, `bge-m3` default), `VectorStorePort` (pgvector adapter; Qdrant would be just another adapter), `ClockPort`, `QueuePort` (BullMQ) |
| 2.4 | Auth (v1 home / research profile, D33): hashed client API keys, personal tokens, admin bootstrap, person / identity tables |
| 2.5 | `docker-compose.yml` (service, Postgres, Redis), health endpoint, config via env |
| 2.6 | i18n scaffolding for prompts and messages (IT/EN) |

### M3 — Layer 0: raw log

**Done 2026-10-03** (branch `m3-raw-log`): REST ingest (idempotent, consent-gated, conflicts / upsert
edits, verified-only participants), edits and purges, BullMQ (debounced idle extraction jobs —
runner is a placeholder until M4 — and background message embeddings), raw-log search (full-text +
vector), MCP endpoint with server-resolved viewer context and `search_episodes` (raw only), eval
system S through REST + MCP: **90 % / 71 %** on the base sets (spike baseline 83 % / 66 %).

| # | Task |
|---|---|
| 3.1 | Ingest endpoint → raw message log (verbatim, provenance, idempotency, edit/delete) |
| 3.2 | Raw-log search (FTS + vector, tuned fusion) — this is also the D13 fallback |
| 3.3 | MCP server with `search_episodes` returning raw-log hits only (first usable increment) |
| 3.4 | **Eval harness v1**: spike dataset ingested through the REST API, questions asked through MCP, scored by the same judge — baseline number for the service |

### M4 — Layer 1: episodes (encoding + recall)

**Core done 2026-10-03** (branch `m4-engine`): engine (one extraction call per window, code-side
lifecycle rules, near-duplicate / correction resolver), notes (D34), recall tools (`search_episodes`
with `latest`, `search_memory` with as-of, `resolve_period`, explicit writes and forgetting).
Service v1: 100 % / 89–96 % on the base sets, **96.4 % on the held-out noise set**
(`spikes/memory-eval/RESULTS.md`). Still open: 4.4b (new blind set — the held-out one is no longer
blind for the engine prompt), 4.5b (provider matrix), 4.5c (H1 categories), 4.6 (N ≥ 3 runs,
controls, per-stage extraction eval) — they move to M4b together with the M3/M4 eval upgrade.

| # | Task |
|---|---|
| 4.1 | Per-conversation idle debounce (D1/D5) + service-side cursor (D22) + nightly sweep |
| 4.2 | Episode extraction (D2, D9, D10, D21): bi-temporal, `datePrecision`, plans with `validUntil` / `invalidatedAt`, valence / feelings / opinion, `people`, provenance to raw message |
| 4.3 | `log_episode` (explicit capture, max importance); semantic notes (D34): extraction in the same call, `notes` tables, `remember` / `search_memory`, notes change feed |
| 4.4 | `search_episodes` full: date-range filter, `mode: search \| list`, ranking relevance + recency + importance + access boost (D14), automatic raw-log fallback (D13); deterministic resolver for common period expressions (this / last week, month names) |
| 4.4b | Eval suite = `dataset/` + `dataset_holdout/` (+ a new blind set when prompts change a lot); gaps from `ENGINE_IDEAS.md` covered (rescheduled plans, corrections, `latest` mode, facts as-of) |
| 4.4c | Cost budget per idle window and per person/month, measured by the per-call accounting; CI fails if a change raises tokens per message beyond the budget |
| 4.5 | Per-person toggle `episodicMemoryEnabled` (D4), default off |
| 4.5b | **Provider matrix**: eval suite run against DeepSeek, Ollama and at least one of OpenAI / Anthropic / Gemini; CLI `eval --config <profile>`; supported-models table (D27) |
| 4.5c | Eval categories for H1 (plan resolution incl. unresolved, premise traps, accumulate vs supersede, correction vs change) with unjustified-assertion and over-abstention rates (`RESEARCH_NOTES.md`) |
| 4.6 | Eval harness v2: compare with M0 scores; must not regress below the D23 prototype |

### M4b — Rigorous evaluation and quality profiles

| # | Task |
|---|---|
| 4b.1 | Third blind dataset (separate agent, no access to prompts / results): another person and domains, IT + EN, H1 probes (plan resolution incl. unresolved, premise traps, accumulate vs supersede, correction vs change, anti-traps, implicit changes), noise generator, **gold annotations of episodes / plans / facts / notes** for per-stage scoring |
| 4b.2 | Harness: N ≥ 3 runs per configuration, mean ± confidence interval, paired comparisons; controls (no-memory, full-context, raw-log only); per-category reporting; per-stage extraction scoring against gold; cost columns (calls, tokens, cached share, latency) |
| 4b.3 | Quality profiles (D35) as configuration: economy / balanced / full, measured on the suite |
| 4b.4 | Provider matrix (D27): DeepSeek, local Ollama, at least one more hosted provider; supported-models table |
| 4b.5 | Market baselines on `dataset_blind3` (base + noise, 3 runs, same harness, judge and embeddings): **Mem0** OSS (the most used agent memory; ADD/UPDATE/DELETE over fact strings) and **Cognee** OSS (knowledge graph + vectors). Thin adapters in `systems/`, engines on the same LLM (`deepseek-flash`, thinking off); licences checked before use (run as dependencies, no code copied); report accuracy, extraction cost and injected tokens per query next to service v4, D and the controls (H6) |

Status (2026-10-03): 4b.1 done (`dataset_blind3`, audited); 4b.2 done (multi-run + CI, paired bootstrap,
controls, per-stage scorer — validated and fixed). **Base, blind: service 86.0 % (Claude engine 87.5 %), D 92.1 %,
full context 97.2 %, no memory 8.3 %.** Fixes from the blind failures (third-party claims attributed to their
author, chat excerpts always alongside episodes) → service 96.2 % post-hoc; a fourth blind set must confirm it.
Noise: v3 88.0 % (D 94.0 %, full context 95.3 %) — corrections lost because the episode list held only
recent items; **extract.v4** (recent + related episodes) → **noise 95.4 %, base 94.9 %**, on par with D and with
full context. Facts are the weakest extraction stage (→ M5). Next: local models in the matrix (Qwen3-8B,
MiniCPM4.1-8B; MiniCPM5-2B as light model), profiles.
Local engines measured: Qwen3-8B 59.7 %, Qwen3-14B 66.7 %, MiniCPM excluded after probes. **Owner's rule: an engine
model is supported only at ≥ 95 % on the suite**; weaker models are removed, results kept (RESULTS.md). Details in
`spikes/memory-eval/RESULTS.md` § M4b.

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

Only if Recordare opens to people the operator does not know: enable the **public profile**
(`API.md` §0, D33) — owner login and pages, OAuth 2.1 for MCP connectors, owner-driven linking and
revocation, read audit, persistent idempotency, backup / provider retention policy — plus network
protection in front (firewall / WAF / rate limits).

- Security: per-person data isolation tests, key rotation, rate limits, audit log of reads
  (the twin is a high-value secret — vision principle 5).
- Backup / restore, export of a person's data, full deletion.
- README, `docs/API.md`, deployment guide, AGPL headers, Docker image.
- Publish to `arkimedehq/recordare` — **only after the owner's OK**.

## Open decisions to take along the way

| Id | Question | Proposal | When |
|---|---|---|---|
| D23 | Engine: build D / adopt Memobase / hybrid | **Build D — approved 2026-10-02** | Done |
| D35 | Cost | An option: quality profiles economy / balanced / full, per installation + owner override | Done (2026-10-03) |
| D34 | Notes: Recordare complete, A-MEM unchanged | Recordare has semantic notes; one-way copies to A-MEM by user choice; Arkimede toggle split in M6 | Done (2026-10-03) |
| D33 | Deployment profiles | v1 home / research; public-profile hardening deferred to M7 | Done (2026-10-03) |
| D31 | Facts in Recordare | State slots with value chain; notes stay in A-MEM until migration | Done (2026-10-03) |
| D32 | Extraction calls per window | One call (amends D2) | Done (2026-10-03) |
| D29 | Data model / recall additions from the literature | Approved (`EPISODIC_MEMORY_TODO.md`) | Done (2026-10-02) |
| D30 | Assistant turns | Extracted with `origin: assistant_stated` | Done (2026-10-02) |
| D28 | Data model fields for research hypotheses | Reserved from v1 (`EPISODIC_MEMORY_TODO.md`) | Done (2026-10-02) |
| D27 | LLM / embedding providers | **Any provider** via config profiles; DeepSeek + Ollama only as test setups | Done (2026-10-02) |
| D24 | MCP transport and per-person auth for basic-level clients | **Decided (M1)**: streamable HTTP at `/mcp`; personal access tokens for header-capable clients; OAuth 2.1 per the MCP authorization spec for clients that require it (Claude Desktop / claude.ai); full level = client API key + `X-Recordare-User` (`API.md` §1) | Done (2026-10-03) |
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
