# Work plan

Status: **2026-10-08** — phase 1 implemented through M5 (some rows partial), M4b done except the
provider matrix, M5b mostly done, M6 mostly done (Arkimede integrated with the Diary, connectors 6.6 done), M7: the
**v0.1.0 release criteria are met and v0.1.0 is public** (2026-10-08; public profile still deferred, D33). Each
milestone below has a status line; rows say **done / partial / TODO**.
Covers roadmap phase 1 (episodic memory, `EPISODIC_MEMORY_TODO.md`) from engine decision to a first Arkimede integration.
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
Status (2026-10-07): 1.1–1.5 done as documents and built in M2–M4 (public-profile parts deferred, D33); the read API
of 1.4 is **not built** (see 4.7); 1.6 SDK skeleton and the generated OpenAPI **not built** (→ 6.7).
Status (2026-10-08): 1.4 **partial** — the diary part of the read API is built (4.7), forgetting a period and the rest
of §4 are TODO; 1.6 **done** as the client library (`packages/client`, 6.7; published on npm as
`@arkimedehq/recordare-client` 0.1.0); the generated OpenAPI is still **not built**.

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
Status (2026-10-07): done except 2.3 `VectorStorePort` (**TODO** — pgvector SQL is inline in the services) and 2.6 i18n
(**partial** — prompts are English with an owner-language line; period resolver and relation words are IT/EN).
Status (2026-10-08): 2.6 still **partial**, with the language module (owner's rule: all languages, at least the most
used): `service/src/lang` holds periods and month names from Intl for 25 locales, relation words and owner naming for
many languages (scripts without spaces matched as substrings), used by the period resolver, people matching and
owner naming; prompts stay English with an owner-language line; the admin console is IT/EN.

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
Status (2026-10-07): done except 4.1 (nightly sweep of pending messages TODO), 4.4c (TODO) and 4.5b (partial); 4.7–4.8 TODO.
Status (2026-10-08): done except 4.1 (partial: nightly sweep of pending messages TODO), 4.3 (partial: the notes change
feed is recorded in `note_changes` but has no endpoint yet), 4.4c (TODO), 4.5b (partial), 4.5c (partial) and 4.7
(partial: the diary part is built); 4.4b and 4.6 done in M4b; 4.8, 4.9, 4.11 done; 4.10 and 4.12 TODO.

| # | Task |
|---|---|
| 4.1 | Per-conversation idle debounce (D1/D5) + service-side cursor (D22) + nightly sweep — **partial**: the nightly sweep of pending (unextracted) messages is TODO (the hourly sweep only consolidates) |
| 4.2 | Episode extraction (D2, D9, D10, D21): bi-temporal, `datePrecision`, plans with `validUntil` / `invalidatedAt`, valence / feelings / opinion, `people`, provenance to raw message |
| 4.3 | `log_episode` (explicit capture, max importance); semantic notes (D34): extraction in the same call, `notes` tables, `remember` / `search_memory`, notes change feed — **partial**: all built except the change feed's endpoint (`GET api/v1/notes/changes`, with 4.7; changes are already recorded in `note_changes`) |
| 4.4 | `search_episodes` full: date-range filter, `mode: search \| list`, ranking relevance + recency + importance + access boost (D14), automatic raw-log fallback (D13); deterministic resolver for common period expressions (this / last week, month names) |
| 4.4b | Eval suite = `dataset/` + `dataset_holdout/` (+ a new blind set when prompts change a lot); gaps from `ENGINE_IDEAS.md` covered (rescheduled plans, corrections, `latest` mode, facts as-of) — **done** in M4b: blind sets 3–8 (4b.1, 4.8) |
| 4.4c | Cost budget per idle window and per person/month, measured by the per-call accounting; CI fails if a change raises tokens per message beyond the budget — **TODO** (accounting exists, no budget / CI gate) |
| 4.5 | Per-person toggle `episodicMemoryEnabled` (D4), default off |
| 4.5b | **Provider matrix**: eval suite run against DeepSeek, Ollama and at least one of OpenAI / Anthropic / Gemini; CLI `eval --config <profile>`; supported-models table (D27) — **partial**: measured (DeepSeek, Ollama local models, OpenRouter models, claude-cli); no `eval --config` CLI, no formal supported-models table with weight licences |
| 4.5c | Eval categories for H1 (plan resolution incl. unresolved, premise traps, accumulate vs supersede, correction vs change) with unjustified-assertion and over-abstention rates (`RESEARCH_NOTES.md`) — **partial**: the H1 categories are in the blind sets (4b.1) and scored per category; the two rates are not reported <!-- verify: no unjustified-assertion / over-abstention rate found in RESULTS.md --> |
| 4.6 | Eval harness v2: compare with M0 scores; must not regress below the D23 prototype — **done** in M4b (4b.2) |
| 4.7 | Read / timeline API (`API.md` §4: episodes, digests, facts, notes, plans, forget a period, settings, usage, export); prerequisite of the Arkimede Diary tab (6.3) — **partial**: **done (2026-10-08)** for the diary: episodes (timeline, detail, correct, forget), digests, facts, notes (pin, delete, confirm / reject), plans; in `packages/client` and the conformance suite. Rest of §4 (manual entry, period forgetting, settings, usage, export, change feed) TODO. |
| 4.8 | **Done 2026-10-08** — fresh blind sets written by separate agents and re-read by a second one: `dataset_blind7` (person memory) **91.3 %** and `dataset_blind8` (entity memory) **82.1 %**, 3 runs each on DeepSeek direct (RESULTS.md). Entity memory stays experimental: unidentified speakers and attribution are the weak spots |
| 4.9 | **Done** — `log_episode` stance: `stated` only with the owner's own words behind it, `inferred` for an agent-only write (`API.md` §3) |
| 4.10 | **TODO** — **News received as a memory** (owner's request 2026-10-07): today help requests and general information are not episodes (they stay in the raw log, which recall searches). Record "X learned that …" as a low-importance episode only when the news links to the person's life — an open plan, a place or a person they know — or when they react to it ("then I'll take the umbrella"); stray trivia stays in the raw log. Extraction prompt change: a small dev set (linked vs unlinked news, assistant answers and tool output), 1 run before deciding (evaluation rules) |
| 4.11 | **Done** — found through the Diary (2026-10-08): (1) a plan **confirmed before its date** ("the trip is for the whole family" read as a confirmation of the 12 October trip) — code guard: a `confirm` patch on a plan whose date is after the evidence message is not an outcome (treat it as `amend`); (2) episodes say "l'owner" instead of the person's name — the extractor should name the person (or write in the third person without the word "owner"). Measure both on the dev sets **Done (2026-10-08)**: plan guard in the writer; "l'owner" replaced by the person's name in code when stored (naming the person in the prompt, extract.v9, cost ≈ 2 points on blind5 and was dropped) — RESULTS.md. |
| 4.12 | **Done 2026-10-08** (summary, counts only — keeping the text was dropped: forgetting must stay complete; an empty model answer shows as `returned` all zero) — **Keep the output of empty extractions** (found 2026-10-08 recording the README animation): a live extraction ran its LLM call and wrote nothing in 2 of 3 English takes and 1 of 2 Italian ones (short, generic demo chats — maybe right, maybe not); the model's answer is not kept when it yields no memory, so it cannot be checked. Store the raw output (or a summary: counts, discarded items and why — guards, schema) in `extraction_runs` for runs that write nothing, visible to the admin; then look at a few real cases before deciding if anything is wrong |
| 4.13 | **TODO** — **Deleting a fact or note leaves no tombstone** (found 2026-10-08 updating DATA_MODEL): `DELETE api/v1/facts|notes/{id}` and a rejected pending one remove the row and its evidence, so a re-extraction of the same messages (an edit, a re-run) could write it again; episodes already have forget tombstones (D16). Add the same for facts and notes, with a test |
| 4.14 | **TODO** — **`hnsw.iterative_scan` never set** (found 2026-10-08): DATA_MODEL relies on pgvector's iterative index scans for filtered vector queries (per owner), but the service never sets it, so a filtered HNSW search can return fewer rows than asked on large installations. Set it per session (or per query) and measure on a large memory |

### M4b — Rigorous evaluation and quality profiles

| # | Task |
|---|---|
| 4b.1 | Third blind dataset (separate agent, no access to prompts / results): another person and domains, IT + EN, H1 probes (plan resolution incl. unresolved, premise traps, accumulate vs supersede, correction vs change, anti-traps, implicit changes), noise generator, **gold annotations of episodes / plans / facts / notes** for per-stage scoring |
| 4b.2 | Harness: N ≥ 3 runs per configuration, mean ± confidence interval, paired comparisons; controls (no-memory, full-context, raw-log only); per-category reporting; per-stage extraction scoring against gold; cost columns (calls, tokens, cached share, latency) |
| 4b.3 | Quality profiles (D35) as configuration: economy / balanced / full, measured on the suite |
| 4b.4 | Provider matrix (D27): DeepSeek, local Ollama, at least one more hosted provider; supported-models table — **partial** (as 4.5b) |
| 4b.5 | Market baselines on `dataset_blind3` (base + noise, 3 runs, same harness, judge and embeddings): **Mem0** OSS (the most used agent memory; ADD/UPDATE/DELETE over fact strings) and **Cognee** OSS (knowledge graph + vectors). Thin adapters in `systems/`, engines on the same LLM (`deepseek-flash`, thinking off); licences checked before use (run as dependencies, no code copied); report accuracy, extraction cost and injected tokens per query next to service v4, D and the controls (H6) |

Status (2026-10-03): 4b.1 done (`dataset_blind3`, audited); 4b.2 done (multi-run + CI, paired bootstrap,
controls, per-stage scorer — validated and fixed). **Base, blind: service 86.0 % (Claude engine 87.5 %), D 92.1 %,
full context 97.2 %, no memory 8.3 %.** Fixes from the blind failures (third-party claims attributed to their
author, chat excerpts always alongside episodes) → service 96.2 % post-hoc; a fourth blind set must confirm it.
Noise: v3 88.0 % (D 94.0 %, full context 95.3 %) — corrections lost because the episode list held only
recent items; **extract.v4** (recent + related episodes) → **noise 95.4 %, base 94.9 %**, on par with D and with
full context. Facts are the weakest extraction stage (→ M5). Next: local models in the matrix (Qwen3-8B,
MiniCPM4.1-8B; MiniCPM5-2B as light model), profiles.
**Blind set 4 (84 q, nobody tuned on it): service v4 80.8 % base / 79.8 % noise, Mem0 78.0 / 79.3 %, D 88.3 %,
full context 89.9 %** — extraction is fine (recall 0.96–0.99, dates ~1.0); the gap is recall (provenance, period
overviews, corrections, third-party). Profiles: economy 93.5 %, balanced 94.9 %, full 92.1 % on blind3 (within noise;
full costs 3.5× output). Next: recall work (H11) at category level, confirmed on a fifth blind set.
**H11 recall step 1 (branch `h11-recall`):** blind4 86.9 % (1 run, category-level steering), **blind5 89.2 % vs D 91.7 %
and full context 91.4 % — within noise** (3 runs, fresh blind set). Open weak spots for all systems: poisoning
probes (incl. a group message addressed to the assistant), implicit changes; for the service also rescheduled plans
and cross-language questions.
Local engines measured: Qwen3-8B 59.7 %, Qwen3-14B 66.7 %, Qwen3.5-9B 73.6 %, Gemma 4 12B 73.6 %, gpt-oss 20B 83.3 %, Gemma 4 26B does not fit, MiniCPM excluded after probes. **Owner's rule: an engine
model is supported only at ≥ 95 % on the suite**; weaker models are removed, results kept (RESULTS.md). Details in
`spikes/memory-eval/RESULTS.md` § M4b.
Status (2026-10-08): 4b.1, 4b.2, 4b.3 (profiles in `service/src/engine/quality-profile.ts`, measured on blind3) and 4b.5
(Mem0 and Cognee on blind3, Mem0 on blind4) done; 4b.4 partial (as 4.5b). Later blind sets: blind5, blind6, and the
fresh blind7 / blind8 of 4.8 (91.3 % person memory, 82.1 % entity memory).

### M5 — Layer 2: consolidation

Status (2026-10-07): 5.1, 5.2 done; 5.3, 5.5 partial; 5.4 TODO; 5.6 built and off; 5.7 one idea done (extract.v8).
Status (2026-10-08): 5.1, 5.2 done; 5.3, 5.5 partial; 5.4 TODO; 5.6 built and off; 5.7 partial (memory-context work done 2026-10-08)
(extract.v8 and the pre-turn memory context built; now its misses from 6.6b (8)); 5.8 TODO (idea).

| # | Task |
|---|---|
| 5.1 | Nightly job per person with new episodes (zero LLM calls if nothing new) — **done** |
| 5.2 | Daily digests + monthly roll-up (D8); period questions read digests first — **done**; digests in recall behind the knob `recallDigests`, off (measured −1.9 pt) |
| 5.3 | Dedup of the same event across conversations (link, never rewrite) — **partial**: near-duplicate resolver at extraction; no consolidation dedup pass |
| 5.4 | Pattern promotions with `episode_promotions` (D20) — destination depends on **D26** — **TODO** (table created, unused) |
| 5.5 | User-driven deletion: episode, period; digests recomputed; vectors removed (D16) — **partial**: forget one episode done; TODO: forget a period, re-verdict facts whose evidence was forgotten, delete episodes left without evidence when a message is deleted |
| 5.6 | **Nightly facts review** (2026-10-07) — **built, off**: built (`facts_review.v1`, task `facts`, admin `POST owners/:id/review-facts`), measured on blind5 — no gain on current facts (0.769 ×3), history +1 fact in 1/3, rewording churn → knob `factsReview` off. Facts work moves to the extraction prompt |
| 5.7 | **Ideas from other platforms' memory** (`docs/literature/agent-platform-memory.md`, 2026-10-07) — **partial**: the extraction-prompt idea is done as extract.v8 (D40), the others TODO; each to be measured: fenced injected memory (`<memory-context>`) so the echo guard keeps working with connectors; a no-LLM pre-turn recall block for connectors (owner card, current facts, upcoming plans + ≤ 3 matches); extraction prompt for personal facts said in passing and transitions ("switched / stopped" → replace; accepting a proposal states it, a bare "ok" does not); web-tool taint (assistant text after a web result never becomes an owner fact); a nightly pattern pass proposing pending inferred notes backed by ≥ 2 episodes Pre-turn memory context **built** (`POST api/v1/context`, always available; the client decides per agent — Arkimede: agent option, off by default): dev set in agent mode, 1 run each — neutral prompt 93.3 → 100 %, voice agent's prompt 90 → 93.3 % with tool calls 9 → 5 of 15, no harm on unrelated questions (RESULTS.md); next: a blind set. **Done (2026-10-08)**: the memory-context misses found by the connectors (6.6b (8)) — each sentence of the message matched on its own so an instruction suffix does not dilute the question, and a period named in the message ("last Saturday") brings that period's episodes (all languages); measured on blind7, 3 runs: 92.4 % vs 92.0 % (parity), fixes the misses seen in probes and connectors — kept, floors unchanged and now knobs (RESULTS 5.7). The other ideas (web-tool taint, nightly pattern pass) TODO. |
| 5.8 | **TODO — idea to evaluate when accessible** (owner's request 2026-10-08): a **decision model** (e.g. Jev by TypeSafe AI, Sept 2026: typed probabilistic decisions in 70–500 ms, no text; or, open and local, a small LLM forced to a closed JSON answer by constrained decoding — e.g. Spark-X2.5-4B by iFLYTEK, Sept 2026, 4 B parameters, Ollama / llama.cpp / vLLM; licence to check — measured per decision, not against the 95 % extraction bar, which small models missed at 60–83 %) Open, local, AGPL-compatible options (2026-10): **SemIf** (MIT; reads the probability of each allowed answer from an open 4 B model in one forward pass, decisions defined per request — no training; ~5× faster than generating JSON, 0.81 balanced accuracy reported), **Kev** (Apache-2.0; LoRA adapters on Qwen3.5 0.8 / 4 / 9 B serving Jev's own API — one contract for hosted Jev and local Kev, chosen by provider configuration), **jevlike** (MIT; a classifier trained on our own labels over a frozen encoder — fits the skip-window gate, our eval sets give the labels). as a fast, cheap judge for the engine's internal decisions — never for writing episodes, notes or digests. Candidates: skip windows with nothing to remember (fewer extraction calls), near-duplicate resolution (`resolve`), plan patches (happened / cancelled / only details, next to the D37 and 4.11 guards), memory-context relevance instead of a fixed similarity floor, who is speaking in an entity memory. Conditions: an optional provider task (D27: Recordare works without it), availability / price / local use checked, measured on the dev and blind sets (first: the skip-window gate, cost and accuracy vs the LLM) |
| 5.9 | **TODO** — **Semantic memory: learned sources** (D49, owner's request 2026-10-08): sources stored with their passages and embeddings, origin and provider; learning as an episode linked both ways to its source; recall tool for passages (+ optional context passage); a client's document-search output not ingested as chat (a "consulted source" reference instead). Design first (data model, API, MCP tool, limits per profile, forgetting), then a dev set with questions answered only from sources, measured |

**Watch** (weak spots seen in the blind sets, not yet worked on): third-party news in group chats (extract.v8),
standing intents for requests to the assistant, plan outcome 0.77 (clean run), implicit changes 0.67,
cross-language questions.
Seen on the fresh blind sets of 4.8 (2026-10-08): provenance 0.4 / 0.8 / 0.7 on blind7; in the entity memory, speakers
who never identify (0.0 / 0.33 / 0.0) and attribution between people (blind8).

### M5b — Neural Atlas: live dashboard (after M5)

A 3D "virtual brain" showing Recordare at work, live: regions are the components (thalamus = ingest, hippocampus =
episodes, LLM = extraction calls, amygdala = importance / feelings, anterior cingulate = conflicts: duplicates,
corrections, third-party claims, neocortex = facts and notes, prefrontal = recall via MCP), neurons are episodes,
synapses their links, and signals travel between regions as data flows. "Sleep" mode replays the M5 consolidation
(hippocampus → neocortex), the same mechanism the architecture borrows from human memory. Prototype with simulated
data: `docs/prototypes/neural-atlas.html` (Three.js + bloom; also published as a private artifact).

Status (2026-10-07): 5b.1, 5b.2, 5b.6, 5b.7, 5b.8 done; 5b.3 partial (no click-to-read, filters, day replay); 5b.4
partial (admin key only); 5b.5 partial (no fallback without WebGL, no fps check); 5b.9 TODO (idea).
Status (2026-10-08): unchanged per row; Recordare Atlas is public with Recordare (v0.1.0), its UI in English (default)
and Italian, and it has a light rendering mode for low-power GPUs with render on demand when idle (5b.5 still partial:
no fallback without WebGL).

| # | Task |
|---|---|
| 5b.1 | Service: live event stream for operators (`GET api/v1/admin/telemetry/stream`, Server-Sent Events): message ingested, extraction run start / end, LLM call (task, model, tokens, cost), episode / fact / note written, near-duplicate or correction, claim isolated, recall served, consolidation steps. Metadata only by default — no content unless the viewer is the owner (D33 / disclosure rules) |
| 5b.2 | Service: snapshot for the initial map: episodes (kind, importance, dates, links: corrects / duplicate_of / plan → event / shared people), facts and notes, per owner; 2-D / 3-D layout from the embeddings (e.g. UMAP / PCA computed server-side and cached) |
| 5b.3 | Dashboard app — now the `recordare-atlas` repo (5b.7) (TypeScript, Vite; Three.js or React Three Fiber): the prototype on real data — neurons placed by meaning, click a neuron to read the episode with its sources, filters by period / kind / person, replay of a day at speed, cost counters from `llm_calls` |
| 5b.4 | Access: admin key or the owner's own token only; no public mode; works with no content (metadata view) for shared screens |
| 5b.5 | Performance: thousands of neurons at 60 fps (instanced points, GPU particles), graceful fallback without WebGL |
| 5b.6 | **Visible neural network, real events only** (owner's request 2026-10-07): the brain shows an actual network — neurons joined by visible axon / dendrite paths within and between regions (fibre tracts) — instead of free-flying "meteors". Impulses run along those paths from one region to another. **No fake animation:** every impulse is one real Recordare event from the telemetry stream (5b.1) following the real route of that data (message → ingest → LLM extraction → episode written → links / resolver → recall …); with no events the brain is quiet. A "replay" of recorded events is allowed only if labelled as such. **The rule holds for every view** — the current brain view (regions, neurons, signals) as well as the network view: no decorative or simulated motion in the product; the simulated prototype exists only until the telemetry stream does |
| 5b.7 | **`recordare-atlas`: the dashboard as its own repo** (owner's decision 2026-10-08): part of the Recordare project, published together with it (same licence, AGPL), but optional — Recordare works without it (no listener, no cost). The repo holds the brain app plus a small server (holds the admin key, serves the app, relays the sources); installable on its own (Docker image). Recordare keeps only its sources: telemetry stream, atlas snapshot, totals. A **versioned event contract** (`atlas-events v1`) documented in Recordare lets the two repos evolve separately |
| 5b.8 | **Client agents on the brain** (owner's request 2026-10-08): show what the client platform does — agents invoked, its LLM calls, tools run — next to Recordare's own work, for Arkimede and any other client. Preferred route: the atlas server receives **OpenTelemetry traces (OTLP)** with the GenAI semantic conventions (`gen_ai.*`: `invoke_agent`, `chat`, `execute_tool`; model, tokens, durations — check the current version first), so any instrumented platform connects without custom code; a small helper for clients without OpenTelemetry. Mapping: agent planning → prefrontal cortex, the client's LLM generating → Broca's area (Recordare's LLM understanding = Wernicke's area), tools → motor cortex, recall → the existing prefrontal → hippocampus path. Events tied to the owner through Recordare's identities. **Metadata only** on this channel (prompts, replies, tool outputs never travel as telemetry: the viewer may not be the owner, content would escape forgetting and disclosure, and agent traces carry system prompts and tool data that are not memories); conversation content reaches Recordare only through ingest, under the memory's rules. Arkimede: instrument `backend/src/common/llm-usage.util.ts` and the agent / multi-agent services (work in the Arkimede repo, with the owner's OK) |
| 5b.9 | **Idea — Recordare speaks OpenTelemetry too**: emit its own operations as GenAI memory spans (`search_memory`, `create_memory`, `update_memory`, `delete_memory`; metadata only) so standard observability tools (Grafana / Jaeger / Langfuse) see Recordare with no dedicated integration, and the atlas could read them like any client. Observation only: memory content keeps travelling on ingest (REST / MCP) — telemetry samples, batches and drops, carries no authorship or participants, and escapes forgetting, so it is never a memory channel |

### M6 — Integrations (proof of client neutrality)

Status (2026-10-07): 6.1 TODO; **6.2 done** in Arkimede (outbox, identity + naming, MCP tools as `recordare_*` without
`log_episode`, consent state, error turns excluded); 6.3 partial (Settings switch done; Diary tab TODO — needs 4.7);
6.4 partial (unit tests; no recorded regression run); 6.5, 6.6 TODO; 6.7 (client library + conformance, Arkimede on it), 6.8 (entity memory, D48) and 6.9 (admin console) done; D34's A-MEM toggle split and the notes copy
Recordare → A-MEM TODO. Next in order (owner's decision 2026-10-07: connectors last): the 5.7 ideas,
4.7 read API (then the Diary tab, 6.3), 4.8 fresh blind dataset (and a blind entity-memory set), 4.10, then 6.6
connectors.
Status (2026-10-08): 6.1, 6.2, 6.3, 6.6, 6.7, 6.8, 6.9 done; 6.6b mostly done ((5), (6), (10) TODO, (8) done with 5.7); 6.4 partial (unit tests; no recorded regression run); 6.5 TODO; D34's A-MEM
toggle split and the notes copy Recordare → A-MEM TODO; Arkimede still uses the synced copy of the client library, not
the npm package. Of the order above, 4.7 (diary
part), 6.3, 4.8 and 6.6 are done; next: 4.12, 4.10, 4.13, 4.14, the rest of 6.6b.

| # | Task | Where |
|---|---|---|
| 6.1 | **Basic level**: configure Claude Code / Claude Desktop as MCP client, run a scripted session, verify tools work | This repo (docs + smoke test) — **done 2026-10-08** (Claude Code; INTEGRATION §4b, `npm run smoke:mcp`; agent writes wait for the person's confirmation; Claude Desktop needs OAuth or a bridge, untested) |
| 6.2 | **Arkimede full level**: register Recordare in its MCP client; non-blocking ingest of persisted messages (outbox + retry, never fails the chat); identity mapping Arkimede user → person | `personalAgent`, own branch |
| 6.3 | Arkimede settings: `episodicMemoryEnabled` toggle + Diary tab (D18) via the Recordare timeline API | `personalAgent` Diary tab **done (2026-10-08)**: Settings → Diary (timeline with detail, correct, forget; diary; who you are; plans; to confirm) over a backend proxy; Arkimede's key needs the `write` scope. |
| 6.4 | Arkimede regression checklist (`EPISODIC_MEMORY_TODO.md` → Regression checklist): A-MEM, `search_conversations`, `search_memory` unchanged | `personalAgent` |
| 6.5 | **Continuous listening from a home voice device** (owner's decision 2026-10-07; D45): (1) a conversation source `ambient` and an extraction note for it (transcribed speech, recognition errors possible, not addressed to the assistant) — a prompt change, measured; (2) attribution caution: from `ambient`, episodes as usual but facts and notes about the owner stay **pending** until the owner confirms them in a chat or by voice to the assistant (a misrecognised speaker must not turn a sister's sentence into the owner's fact); (3) an `ambient` dev set (multi-speaker home conversations, recognition errors, a misattributed speaker) measured before the mode is enabled; (4) later, optional: a "room" ingest that fans one transcript out to the memories of the people present (v1: one ingest call per person, with the others as identity-linked participants). Already there: per-person memory, participants linked to persons through client identities, consent per person, forgetting by period | `recordare` |
| 6.6 | **Connectors: Recordare in any agent platform with one install** (owner's request 2026-10-07). MCP alone gives recall and explicit writes but no automatic capture of the conversation; each connector does both — sends the turns to ingest after each answer, and gives the agent the memory (MCP tools and/or context injected before the turn). In order: (1) **Claude Code plugin** — bundled MCP server + `Stop` / `SessionEnd` hooks that read `transcript_path` and ingest the new turns; (2) **Hermes Agent memory provider** (its official provider interface: per-turn sync, pre-turn prefetch); (3) **OpenClaw memory-slot plugin**; (4) **OpenAI-compatible memory proxy** for clients without plugins (forward to the real provider, ingest the turns, optionally add memory). Plus a `recordare connect` onboarding command (create the person, a personal token, configure the chosen connector). Each connector in its own small repo or package, metadata-only telemetry, consent rules unchanged | connectors — **done 2026-10-08 (full level, each smoke-tested for real)**: Claude Code plugin, Codex (hooks + MCP installer), OpenClaw plugin, Hermes Agent memory provider, OpenAI-compatible memory proxy (AnythingLLM tested; Open WebUI / LibreChat by the same mechanism, unit-tested) — `connectors/`; Claude Desktop / claude.ai basic only. Published with v0.1.0: Claude Code plugin through the repository's marketplace, `@arkimedehq/openclaw-recordare` on npm, image `ghcr.io/arkimedehq/recordare-openai-proxy`. The `recordare connect` onboarding command is not built (TODO) |
| 6.6b | **Found while building the connectors (2026-10-08)** — **done 2026-10-08: (1) `POST ingest/conversations/{id}/end`, (2) `TOOLS` in `packages/client` kept in sync by the conformance suite, (3) `POST api/v1/context {ingest}`, (4) the client is built before publishing, (9) personal tokens read before their conversation is stored, (11) console chip "waiting for consent"**; still TODO: (5) (the OpenClaw retry queue is still in memory), (6), (8) → 5.7 (in progress), (10); the connectors dropped their workarounds (one call before a turn, `/end` at the end, OpenClaw's tools from `TOOLS`; Hermes, in Python, still copies its schemas) — done 2026-10-08: (1) a message-less "conversation ended" call (today the hint must ride on a message, so every connector keeps its last message to re-send it, and loses it on restart); (2) publish the MCP tool schemas (a JSON file in `packages/client` or `GET api/v1/mcp/tools`) so connectors that declare tools statically (OpenClaw) stop copying them by hand; (3) one call for "store this message and give me the memory context" (today a connector must ingest first, then ask the context: two round trips before each turn); (4) `packages/client/dist` stale against `src` — build it in CI / before publishing; (5) durable retry queue in the OpenClaw plugin (in memory today); (6) real-channel tests for OpenClaw (multi-person, groups) and Codex's interactive hook trust; (7) Claude Desktop / claude.ai stay at the basic level (no hooks to capture the conversation); (8) **the memory context misses easily** (Hermes smoke): "Come si chiama il mio gatto? Rispondi in una frase." → 0 items, without the suffix → 1, the English question → 0, period questions ("cosa ho fatto sabato scorso?") → 0 — the similarity floor on the raw message; measure with 5.7 (strip instructions, cross-language, resolve periods); (9) a read naming a conversation not stored yet returns nothing, even with a personal token; (10) `/mcp` answers only as an event stream (minor); (11) a person auto-provisioned by a client starts without consent, so a platform's first users are silently not remembered until the admin switches it on — tell the admin (console notice) |
| 6.7 | **One client, one contract, one conformance suite** (owner's decision 2026-10-07): uniformity at the contract level, not the mechanism — Arkimede stays the native server-side client (outbox, stable ids, participants, deletions, consent state: better than transcript hooks, which remain the best option only for platforms we do not control). (1) The client library `@arkimedehq/recordare-client` (API.md §5) lives **in this repo** as a workspace package (`packages/client/`), reusing the service's zod schemas — contract and client change in one commit, one CI, one version; it carries batched ingest with retries, identity / naming / consent state, the MCP session with user + conversation headers, and the fenced injected-context format; Arkimede moves onto it. (2) The same features for every client, Arkimede included (e.g. the pre-turn recall with `<memory-context>`, 5.7). (3) A **conformance suite** every client passes against the real service (a turn ingested once, deletions propagate, nothing sent before consent, recall carries user + conversation); Arkimede passes it first. TypeScript connectors live in `connectors/` on top of the client; other languages (Hermes, Python) as their own packages **Done (2026-10-07)**: `packages/client` (standards: official MCP SDK, RFC 9457, Retry-After, W3C trace context) + conformance suite in the service's CI; Arkimede moved onto it (synced copy in `backend/src/recordare/client/`, tools built from MCP `tools/list`). Read API wrappers come with 4.7. | `recordare` + `personalAgent` |
| 6.8 | **Entity memory** (D48, owner's decision 2026-10-07): owner `kind = entity` for shared accounts and devices (Arkimede's voice user first); facts with the person they are about; identification only says whose; named-in-window guard. **Done on branch `entity-memory`** (migration, admin `kind` / `displayName`, `GET /me` `kind`, `search_memory` `about`, dev set 95.5 % on 1 run). Client side (2026-10-07): `PATCH /me {kind}` while the memory is empty, the name follows the client's user (sync on rename), `GET /me` `atlasUrl` (`ATLAS_URL`); Arkimede: memory kind chosen in the memory settings, shared-memory notice, name sync, Atlas link for admins. TODO: intimate items readable only by their person (stronger identification) | `recordare` + `personalAgent` |
| 6.9 | **Admin console** (owner's decision 2026-10-07, after the Arkimede work): a small protected page served by Recordare itself (`/admin`, admin key or password) — persons and clients, consent on / off, kind, name, quality profile, keys and tokens, run a consolidation. Not in Recordare Atlas: the atlas stays a read-only view without login **Done** (2026-10-07): `service/console/` served at `/admin`, plus admin reads `GET persons` / `GET clients`, `PATCH clients/:id`, `DELETE identities/:id`; name search; IT/EN. | `recordare` |

**Other agent platforms — possible clients** (reviewed 2026-10-04; none has a temporal / provenance-aware memory,
which confirms the standalone-service bet). Not committed work: candidates after Arkimede, in this order.

| Platform | What it is | Memory today | Integration path | Priority |
|---|---|---|---|---|
| OpenHuman (`tinyhumansai/openhuman`, GPL-3.0, ~40k stars, early beta) | Rust agent harness (desktop / web / terminal / library), 26 providers + local | Pluggable engine behind TinyMemory (`Recall / Fetch / Store`): hosted CortexDB, Mem0, Supermemory, Cognee… — documents + RAG, no event time, plans or provenance | A **Recordare engine adapter for TinyMemory** (their engine-selection panel) — one adapter reaches all their users | Medium (after M6.2) |
| Open Dots (`Anil-matcha/open-dots`, MIT, prototype) | Self-hosted personal-agent workspace (Next.js + FastAPI), personas, approval-gated actions | Chat history in SQLite only; "no durable memory service" by its own README | No MCP client seen: a small adapter on their side (REST ingest + recall) | Low (maturity) |


### M7 — Hardening and release

Status (2026-10-07): not started (D33). A Dockerfile exists; nothing published.
Status (2026-10-08): **v0.1.0 released** — all the v0.1 criteria below are met; tag `v0.1.0` with GitHub releases,
`arkimedehq/recordare` and `arkimedehq/recordare-atlas` public, `@arkimedehq/recordare-client` and
`@arkimedehq/openclaw-recordare` on npm, image `ghcr.io/arkimedehq/recordare-openai-proxy` on GHCR. Of the hardening
list: per-person isolation tests, backup (`deploy/backup.sh`) / update, README, API, deployment guide, AGPL (SPDX)
headers, Docker images and publishing are done; key rotation is manual (new key, delete the old one); rate limits,
read audit, export of a person's data and full deletion are TODO, with the public profile (D33).

Only if Recordare opens to people the operator does not know: enable the **public profile**
(`API.md` §0, D33) — owner login and pages, OAuth 2.1 for MCP connectors, owner-driven linking and
revocation, read audit, persistent idempotency, backup / provider retention policy — plus network
protection in front (firewall / WAF / rate limits).

- Security: per-person data isolation tests, key rotation, rate limits, audit log of reads
  (the twin is a high-value secret — vision principle 5).
- Backup / restore, export of a person's data, full deletion.
- README, `docs/API.md`, deployment guide, AGPL headers, Docker image.
- Publish to `arkimedehq/recordare` — **only after the owner's OK**.

**First public release — v0.1, home / research profile** (owner's request 2026-10-08: publish when a working version
runs on some clients; the owner gives the final OK). Criteria, all required:
1. **Clients**: Arkimede at the full level (ingest, MCP recall, Diary) — done; at least one standard MCP client at the
   basic level (Claude Code or Claude Desktop with a personal token: recall, `remember`, `log_episode`) — 6.1, a
   documented set-up plus a scripted smoke test — **done 2026-10-08** (Claude Code, `npm run smoke:mcp`).
2. **Install**: both profiles tested end to end on a clean machine — co-hosted (Kinox) done, standalone (with
   text-embeddings-inference) **done 2026-10-08** on a clean clone (macOS arm64): install, ingest → extraction →
   recall, MCP smoke test, backup and update; fixed on the way: the Compose project name (`RECORDARE_PROJECT`) and the
   embedder's memory (batch 2048 tokens).
3. **Quality**: a fresh blind set (4.8) measured with the released engine (3 runs, numbers in RESULTS.md); CI green —
   **done 2026-10-08** (blind7 91.3 %, blind8 82.1 %).
4. **Hygiene**: no secret in the repositories' history; AGPL headers; `THIRD_PARTY_NOTICES.md` and dependency licences
   checked; per-person isolation tests; the home profile's limits stated plainly (trusted operator, not for strangers —
   D33) — **done 2026-10-08**.
5. **Docs**: README and every project document in English and Italian (done), INTEGRATION, DEPLOYMENT, KNOBS, a
   CHANGELOG; version tag `v0.1.0` — **done 2026-10-08**.
5b. **Released 2026-10-08**: tag `v0.1.0`, both repositories public; the npm package follows (owner's decision) —
   published the same day (`@arkimedehq/recordare-client`, `@arkimedehq/openclaw-recordare`; proxy image on GHCR).
6. **What goes public together**: `arkimedehq/recordare` and `arkimedehq/recordare-atlas`; `@arkimedehq/recordare-client`
   on npm (Arkimede then installs it instead of the synced copy); Arkimede's integration through its own public mirror —
   both repositories and the npm package are public; Arkimede's move to the npm package is TODO.
Not required for v0.1: the public profile (owner login, OAuth), connectors (6.6), phases 2+ of the vision (the
connectors shipped with v0.1 anyway).

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
| D25 | Vector store | **pgvector** — decided, in use (HNSW, see below) | Done (2026-10-03) |
| D26 | Where pattern promotions go while A-MEM lives in Arkimede | Exposed by Recordare as `pending` proposals via API; the client decides (Arkimede imports them into A-MEM) | Open — with 5.4 |
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

## Evaluation budget (owner's rule, 2026-10-05)

Measured: since the 2026-10-04 top-up, 41 runs / 2,178 judged questions used 27.8 M input + 4.1 M output tokens
(≈ 6.4 USD on DeepSeek); Mem0 alone was 56 % of it. The cost is the measurement, not Recordare (one person, five
months, 232 sessions ≈ 1 M input tokens, two thirds cached). Rules:

1. **Exploratory checks: 1 run.** 3 runs only for results that feed a decision or a reported number.
2. **Base first, noise only if base is promising** (and only for the systems still in question).
3. **Measured market baselines are not re-run** (Mem0, Cognee, Graphiti, Memobase) unless a specific question needs
   it — their numbers stay in `RESULTS.md`.
4. **Controls once per dataset** (no-memory, full context): they do not change between engine versions.
5. **Small slices while iterating** (`--only` on the failing questions), the full set only to confirm.
6. **Judge without reasoning** once re-validated against the current judge (`judge_eval.py`): ~4× fewer output tokens.
7. Every chain is `--resume`-able and ordered by priority, so a stopped chain (balance, outage) keeps what it paid for.
8. Before a large chain, state its expected token budget and check the provider balance.
9. **One service instance per queue** (2026-10-07): before a run, check that only the intended service consumes the
   queue (a half-stopped instance kept extracting with old code); compare versions side by side with separate ports
   and `QUEUE_PREFIX`es. After a run, check that its extractions carry a single prompt version
   (`extraction_runs.prompt_version`) — a mixed run is discarded.
