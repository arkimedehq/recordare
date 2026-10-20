# Work plan

Status: **2026-10-08** — phase 1 implemented through M5 (some rows partial), M4b done except the
provider matrix, M5b mostly done, M6 mostly done (Arkimede integrated with the Diary, connectors 6.6 done), M7: the
**v0.1.0 public** (2026-10-08; public profile still deferred, D33); **v0.2.0 public** (2026-10-10: M8, the agent memory, 8.0–8.10); **v0.3.0 public** (2026-10-17: memory quality and control). Each
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
Status (2026-10-18): the generated OpenAPI is **done** — `GET api/v1/openapi.json` (OpenAPI 3.1, `service/src/openapi/`):
paths, scopes, parameters and request bodies from the routes and their zod schemas (a `@Body()` or whole `@Query()`
without one fails the build of the document); the JSON answers from `@Returns` response schemas, checked against every
response in the tests (`test/helpers/response-contract.ts`) and by the compiler against the handlers and the client types.

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
embedding and clock ports, v1 auth (client API keys, personal tokens, admin API, memory resolution),
docker-compose, CI, Dockerfile. Moved to where they are first used: `QueuePort` (BullMQ idle jobs) →
M3, `VectorStorePort` and IT/EN prompt files → M4.
Status (2026-10-07): done except 2.3 `VectorStorePort` (**TODO** — pgvector SQL is inline in the services) and 2.6 i18n
(**partial** — prompts are English with a memory-language line; period resolver and relation words are IT/EN).
Status (2026-10-18): 2.3 **closed by decision** — no `VectorStorePort` (maintainer, 2026-10-18; D25 below): recall ranks
by vector, full text and dates in one SQL query and compares rows' embeddings in SQL (near duplicates, patterns, Atlas),
and forgetting deletes rows with their vectors in one transaction; a port that a second store could fill would split those
queries, change recall (paid eval runs) and lose the single transaction, for no deployment that needs it (Postgres is
required anyway). Done instead: `service/src/db/pgvector.ts` — vector parameters (`vectorParam`) and every embedding
write (`storeEmbeddings`, one place for the eight copies); results unchanged. Larger volumes: pgvectorscale (index only).
Status (2026-10-08): 2.6 still **partial**, with the language module (maintainer's rule: all languages, at least the most
used): `service/src/lang` holds periods and month names from Intl for 25 locales, relation words and third-person stand-ins for the self for
many languages (scripts without spaces matched as substrings), used by the period resolver, people matching and
the leak detector; prompts stay English with a memory-language line; the admin console is IT/EN.
Status (2026-10-18): 2.6 **done**. Prompts stay English with the MEMORY LANGUAGE line (D27: the instructions are read by
the model, the memory is written in the memory's language); the service's own sentences — the recall tools' notes for the
agent, unknown / approximate dates, the "same person?" question — are in `service/src/lang/messages.ts` for the 25
languages (IT and EN unchanged, so recall is unchanged where it was measured), weekday names from Intl; a memory's
locale is any BCP 47 tag in the admin API too (was `it` / `en`), and a regional one (`it-IT`, accepted by `PATCH settings`)
no longer falls back to English. The admin console stays IT/EN (operators' UI, not the memory's).

| # | Task |
|---|---|
| 2.1 | NestJS project, strict TS, lint, `tsc --noEmit`, test runner; CI on every push |
| 2.2 | Postgres + migrations (TypeORM); pgvector with HNSW index (**D25**) |
| 2.3 | Ports and adapters: `LlmPort` (adapters OpenAI-compatible + native Anthropic, provider profiles from config — reasoning off, structured-output mode, token param, caching, usage — validate + retry; D27), `EmbeddingPort` (OpenAI-compatible, `bge-m3` default), ~~`VectorStorePort` (pgvector adapter; Qdrant would be just another adapter)~~ — not built, decided 2026-10-18 (status above), `ClockPort`, `QueuePort` (BullMQ) |
| 2.4 | Auth (v1 home / research profile, D33): hashed client API keys, personal tokens, admin bootstrap, person / identity tables |
| 2.5 | `docker-compose.yml` (service, Postgres, Redis), health endpoint, config via env |
| 2.6 | i18n scaffolding for prompts and messages (IT/EN) — **done 2026-10-18**: all languages (status above) |

### M3 — Layer 0: raw log

**Done 2026-10-03** (branch `m3-raw-log`): REST ingest (idempotent, consent-gated until 8.1, conflicts / upsert
edits, verified-only participants), edits and purges, BullMQ (debounced idle extraction jobs —
runner is a placeholder until M4 — and background message embeddings), raw-log search (full-text +
vector), MCP endpoint with server-resolved viewer context (removed by 8.2, D50) and `search_episodes` (raw only), eval
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
feed is recorded in `note_changes` but has no endpoint yet), 4.4c (TODO), 4.5b (partial), 4.5c (partial; done 2026-10-16) and 4.7
(partial: the diary part is built); 4.4b and 4.6 done in M4b; 4.8, 4.9, 4.11 done; 4.10 and 4.12 TODO.
Status (2026-10-12): 4.1, 4.10, 4.12, 4.13, 4.14 done. Status (2026-10-15): 4.4c done.

| # | Task |
|---|---|
| 4.1 | Per-conversation idle debounce (D1/D5) + service-side cursor (D22) + nightly sweep — **done 2026-10-12**: when a memory's nightly consolidation is due, the hourly sweep first extracts its conversations with pending (unextracted) messages where nothing arrived for longer than the idle delay (a failed call, a lost idle job), then consolidates; once a day per memory, so a window that keeps failing costs one retry a day |
| 4.2 | Episode extraction (D2, D9, D10, D21): bi-temporal, `datePrecision`, plans with `validUntil` / `invalidatedAt`, valence / feelings / opinion, `people`, provenance to raw message |
| 4.3 | `log_episode` (explicit capture, max importance); semantic notes (D34): extraction in the same call, `notes` tables, `remember` / `search_memory`, notes change feed — **done 2026-10-12**: the change feed's endpoint `GET api/v1/notes/changes?since` built with 4.7 |
| 4.4 | `search_episodes` full: date-range filter, `mode: search \| list`, ranking relevance + recency + importance + access boost (D14), automatic raw-log fallback (D13); deterministic resolver for common period expressions (this / last week, month names) |
| 4.4b | Eval suite = `dataset/` + `dataset_holdout/` (+ a new blind set when prompts change a lot); gaps from `ENGINE_IDEAS.md` covered (rescheduled plans, corrections, `latest` mode, facts as-of) — **done** in M4b: blind sets 3–8 (4b.1, 4.8) |
| 4.4c | Cost budget per idle window and per person/month, measured by the per-call accounting; CI fails if a change raises tokens per message beyond the budget — **done** (2026-10-15): `service/test/cost/` — a reference day of one person (two weeks of history, then 100 messages in three idle windows and the night after), per quality profile: calls and estimated input tokens per idle window and per night, projected to a month, against `budget.json`; CI fails above it, an intended rise is recorded in the same commit (`COST_BUDGET_UPDATE=1`). First budget (UTF-8 bytes / 4): economy ≈ 230 input tokens per message, 4 calls a night, ≈ 1.0 M input tokens a month; balanced ≈ 230, 5, ≈ 1.2 M; full ≈ 290, 5, ≈ 1.3 M. Output tokens depend on the model and are not budgeted; nothing limits a memory at run time (D35: cost is the deployer's option) |
| 4.5 | Per-person toggle `episodicMemoryEnabled` (D4), default off — *superseded by D50 / 8.1 (2026-10-09): no consent flag in Recordare; the client platform's switch is the only one* |
| 4.5b | **Provider matrix**: eval suite run against DeepSeek, Ollama and at least one of OpenAI / Anthropic / Gemini; CLI `eval --config <profile>`; supported-models table (D27) — **partial**: measured (DeepSeek, Ollama local models, OpenRouter models, claude-cli). **2026-10-18**: the CLI `spikes/memory-eval/provider_eval.py --config profiles/<model>.json` (smoke with the profile's reasoning-off variants, a service instance of its own, scores, extraction, outcomes, rule-9 check, engine cost; `--table`) and the supported-models table `docs/MODELS.md` (scores and weight licences); profiles ready for OpenAI, Gemini and Anthropic native APIs. Still open: the runs on those native APIs (keys needed) |
| 4.5c | Eval categories for H1 (plan resolution incl. unresolved, premise traps, accumulate vs supersede, correction vs change) with unjustified-assertion and over-abstention rates (`RESEARCH_NOTES.md`) — **done 2026-10-16**: the H1 categories are in the blind sets (4b.1) and scored per category; the two rates come from a second, independent grading of stored answers (`spikes/memory-eval/outcome_eval.py`: supported / unjustified / abstained, reference known / unknown), for the service and the baselines on blind3 and the current engine on blind7, 9, 10, 11 (RESULTS.md). Recordare has the lowest unjustified-assertion rate on blind3 (0.028 vs Mem0 0.046, Cognee 0.065, D 0.065, full context 0.037); the H1 categories hardly separate the systems on these sets (too few hard items). **2026-10-18**: a harder blind set for H1, `dataset_blind12` (Tommaso, Bologna, 62 sessions, 54 questions, all H1: unresolved plans 8, implicit outcomes 7, moved plans 7, premise traps 7, accumulate 6, supersede 8, correction vs change 7, never said 4; written and audited by separate agents, 8 questions fixed in the audit). **2026-10-19**, 1 run each: Recordare 92.6 % (unjustified 0.019, nothing invented on 13 unknown outcomes; unresolved plans and correction vs change 1.00), full context 95.4 % (unjustified 0.037, invented on unknown 0.077: it asserts an unconfirmed outcome, takes a correction for a change). Recordare's own H1 error: a same-day intention ("this afternoon I paint the railing") stored as done and not revised by a later plan; two recall misses with the memory right (RESULTS.md). Follow-ups (2026-10-19): `extract.v17` corrects an event told as done that a later window shows did not happen (dev set 4/6 → 6/6, blind5 within noise; h11 itself still missed: subtler phrasing); a list without a period selects by relevance (h30 fixed); a fact unknown again no longer fails the window (migration `UnknownFactHistory`); blind12 re-run 88.9 %, within noise of 92.6 %. 3 runs each on blind12 (Recordare `extract.v17`): accuracy 93.5 / 93.2 / 93.2 % (Recordare / full context / Mem0, within noise), unjustified 0.025 / 0.062 / 0.093, invented on unknown 0.000 / 0.051 / 0.128 |
| 4.6 | Eval harness v2: compare with M0 scores; must not regress below the D23 prototype — **done** in M4b (4b.2) |
| 4.7 | Read / timeline API (`API.md` §4: episodes, digests, facts, notes, plans, forget a period, settings, usage, export); prerequisite of the Arkimede Diary tab (6.3) — **partial**: **done (2026-10-08)** for the diary: episodes (timeline, detail, correct, forget), digests, facts, notes (pin, delete, confirm / reject), plans; in `packages/client` and the conformance suite. **Done 2026-10-12** — the rest of §4: manual entry (episodes, notes; stated, theirs), fact / note corrections, `GET facts/{id}` / `GET notes/{id}` with evidence, the notes change feed, settings (`PATCH` with `memory_settings`: the personal token), usage by prompt and day, full exports (background, gzipped JSON archive, 7 days; `export`: the personal token); client methods and conformance tests. |
| 4.8 | **Done 2026-10-08** — fresh blind sets written by separate agents and re-read by a second one: `dataset_blind7` (person memory) **91.3 %** and `dataset_blind8` (entity memory) **82.1 %**, 3 runs each on DeepSeek direct (RESULTS.md). Entity memory stays experimental: unidentified speakers and attribution are the weak spots. **2026-10-12**: a fresh blind entity set `dataset_blind11` (bike repair shop, 40 q, written and audited by separate agents), current engine × 3: **98.8 %** (100 / 97.5 / 98.8; attribution, unidentified, hand-over, carry-over 1.0 in every run) — RESULTS |
| 4.9 | **Done** — `log_episode` stance: `stated` only with the holder's own words behind it, `inferred` for an agent-only write (`API.md` §3) |
| 4.10 | **Done 2026-10-08 — `extract.v11`** (dev set `dataset_dev_news` 62.5 → 75 %, linked news stored with both dates, trivia not; blind7 3 runs 91.7 % vs v8 91.3 %, parity; v10 without the exclusion of others' claims about the holder lost 2.9 points, provenance −0.17 — rejected; RESULTS 4.10) — **News received as a memory** (maintainer's request 2026-10-07): today help requests and general information are not episodes (they stay in the raw log, which recall searches). Record "X learned that …" as a low-importance episode only when the news links to the person's life — an open plan, a place or a person they know — or when they react to it ("then I'll take the umbrella"); stray trivia stays in the raw log. Extraction prompt change: a small dev set (linked vs unlinked news, assistant answers and tool output), 1 run before deciding (evaluation rules) |
| 4.11 | **Done** — found through the Diary (2026-10-08): (1) a plan **confirmed before its date** ("the trip is for the whole family" read as a confirmation of the 12 October trip) — code guard: a `confirm` patch on a plan whose date is after the evidence message is not an outcome (treat it as `amend`); (2) episodes say "l'owner" instead of the person's name — the extractor should name the person (or write in the third person without the word "owner"). Measure both on the dev sets **Done (2026-10-08)**: plan guard in the writer; "l'owner" replaced by the person's name in code when stored (naming the person in the prompt, extract.v9, cost ≈ 2 points on blind5 and was dropped) — RESULTS.md. |
| 4.12 | **Done 2026-10-08** (summary, counts only — keeping the text was dropped: forgetting must stay complete; an empty model answer shows as `returned` all zero) — **Keep the output of empty extractions** (found 2026-10-08 recording the README animation): a live extraction ran its LLM call and wrote nothing in 2 of 3 English takes and 1 of 2 Italian ones (short, generic demo chats — maybe right, maybe not); the model's answer is not kept when it yields no memory, so it cannot be checked. Store the raw output (or a summary: counts, discarded items and why — guards, schema) in `extraction_runs` for runs that write nothing, visible to the admin; then look at a few real cases before deciding if anything is wrong |
| 4.13 | **Done 2026-10-12** (tombstone scopes `fact` / `note`: slot key or note category, subject and evidence messages, ids only; the extraction does not write it again from those messages, a new message telling it is news; the messages stay in the chat search) — **Deleting a fact or note leaves no tombstone** (found 2026-10-08 updating DATA_MODEL): `DELETE api/v1/facts|notes/{id}` and a rejected pending one remove the row and its evidence, so a re-extraction of the same messages (an edit, a re-run) could write it again; episodes already have forget tombstones (D16). Add the same for facts and notes, with a test |
| 4.14 | **Done 2026-10-12** (`hnsw.iterative_scan = strict_order` at connection start; measured: a memory with 0.5 % of 20,000 rows, HNSW forced, 3 → 10 of 10 rows; the planner picks the `memory_id` btree for small and mid-size memories, so it changes results only when HNSW meets a selective filter; test `test/db/hnsw-iterative.int.spec.ts`) — **`hnsw.iterative_scan` never set** (found 2026-10-08): DATA_MODEL relies on pgvector's iterative index scans for filtered vector queries (per memory), but the service never sets it, so a filtered HNSW search can return fewer rows than asked on large installations. Set it per session (or per query) and measure on a large memory |

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
Local engines measured: Qwen3-8B 59.7 %, Qwen3-14B 66.7 %, Qwen3.5-9B 73.6 %, Gemma 4 12B 73.6 %, gpt-oss 20B 83.3 %, Gemma 4 26B does not fit, MiniCPM excluded after probes. **Maintainer's rule: an engine
model is supported only at ≥ 95 % on the suite**; weaker models are removed, results kept (RESULTS.md). Details in
`spikes/memory-eval/RESULTS.md` § M4b.
Status (2026-10-08): 4b.1, 4b.2, 4b.3 (profiles in `service/src/engine/quality-profile.ts`, measured on blind3) and 4b.5
(Mem0 and Cognee on blind3, Mem0 on blind4) done; 4b.4 partial (as 4.5b). Later blind sets: blind5, blind6, and the
fresh blind7 / blind8 of 4.8 (91.3 % person memory, 82.1 % entity memory).

### M5 — Layer 2: consolidation

Status (2026-10-07): 5.1, 5.2 done; 5.3, 5.5 partial; 5.4 TODO; 5.6 built and off; 5.7 one idea done (extract.v8).
Status (2026-10-08): 5.1, 5.2 done; 5.3, 5.5 partial; 5.4 TODO; 5.6 built and off; 5.7 partial (memory-context work done 2026-10-08)
(extract.v8 and the pre-turn memory context built; now its misses from 6.6b (8)); 5.8 TODO (idea).
Status (2026-10-12): 5.3, 5.5 done; 5.7 turn taint done.

| # | Task |
|---|---|
| 5.1 | Nightly job per person with new episodes (zero LLM calls if nothing new) — **done** |
| 5.2 | Daily digests + monthly roll-up (D8); period questions read digests first — **done**; digests in recall behind the knob `recallDigests`, off (measured −1.9 pt) |
| 5.3 | Dedup of the same event across conversations (link, never rewrite) — **done 2026-10-12**: near-duplicate resolver at extraction, and a nightly pass in the consolidation (before the diary) for the pairs no check could see — extractions of two conversations running at the same time, a failed check, `log_episode` and corrections (never checked); `episodes.resolved_at` (migration `EpisodeResolvedAt1791120000000`) stamps each check; one call only when such pairs exist. Not measured on the eval sets (they do not run the consolidation; the extraction path is unchanged) |
| 5.4 | Pattern promotions with `episode_promotions` (D20) — **done 2026-10-12** (D26 decided: the memory's own conclusions, nobody confirms them): a nightly pattern pass in the consolidation (task `patterns`, quality-profile knob `patterns`, on in balanced / full) draws recurring patterns from the episodes of the last 90 days — one call per memory per night with new episodes, none otherwise — and keeps, updates or retires them on its own; a pattern is an inferred note of the memory (never pending, `tags` `{pattern}`, labelled in `search_memory` and the memory context) backed by ≥ 3 episodes on different days of one subject (code check; never the assistant's or a tool's words); forgotten or stopped patterns are not drawn again from the same episodes. Admin `POST memories/:id/patterns` runs it alone. Dev set `dataset_dev_patterns`, `patterns.v2`, 3 runs: 20 / 21 habits, no false pattern, the stopped one retired each time; blind set `dataset_blind_patterns` (9 memories, 5 languages), 3 runs: 38 / 39 habits, 1 false pattern in 3 runs (a restated note), the stopped one retired each time (RESULTS 5.4). Follow-up measured on the dev set (two new cases): a `known` verdict and a lower restatement check lost habits — reverted; known limit: a habit already stated in words may come back once as a pattern (RESULTS 5.4) |
| 5.5 | User-driven deletion: episode, period; digests recomputed; vectors removed (D16) — **done 2026-10-12**: forget one episode (2026-10-08); forget a period (`POST api/v1/forget {from, to, keepRaw?}`, client `forgetPeriod`; episodes by overlap with their chains, raw messages by `sent_at`, deleted or kept hidden, `period` tombstone); what forgetting takes with it (`service/src/recall/forgetting.ts`, for a message, a conversation, an episode or a period): episodes, facts and notes left without evidence are deleted, a plan whose status came from a message that went gets back its earlier one, a fact or note that replaced an older one makes it current again (a correction does not), digests superseded. Forgetting an episode also takes the facts and notes its messages alone supported — not those another message also supports, and not the other episodes those messages told (maintainer's choice, 2026-10-12) |
| 5.6 | **Nightly facts review** (2026-10-07) — **built, off**: built (`facts_review.v1`, task `facts`, admin `POST memories/:id/review-facts`), measured on blind5 — no gain on current facts (0.769 ×3), history +1 fact in 1/3, rewording churn → knob `factsReview` off. Facts work moves to the extraction prompt |
| 5.7 | **Ideas from other platforms' memory** (`docs/literature/agent-platform-memory.md`, 2026-10-07) — **partial**: the extraction-prompt idea is done as extract.v8 (D40), the others TODO; each to be measured: fenced injected memory (`<memory-context>`) so the echo guard keeps working with connectors; a no-LLM pre-turn recall block for connectors (self card, current facts, upcoming plans + ≤ 3 matches); extraction prompt for personal facts said in passing and transitions ("switched / stopped" → replace; accepting a proposal states it, a bare "ok" does not); web-tool taint (assistant text after a web result never becomes a holder fact); a nightly pattern pass proposing pending inferred notes backed by ≥ 2 episodes Pre-turn memory context **built** (`POST api/v1/context`, always available; the client decides per agent — Arkimede: agent option, off by default): dev set in agent mode, 1 run each — neutral prompt 93.3 → 100 %, voice agent's prompt 90 → 93.3 % with tool calls 9 → 5 of 15, no harm on unrelated questions (RESULTS.md); next: a blind set. **Done (2026-10-08)**: the memory-context misses found by the connectors (6.6b (8)) — each sentence of the message matched on its own so an instruction suffix does not dilute the question, and a period named in the message ("last Saturday") brings that period's episodes (all languages); measured on blind7, 3 runs: 92.4 % vs 92.0 % (parity), fixes the misses seen in probes and connectors — kept, floors unchanged and now knobs (RESULTS 5.7). **Turn taint done (2026-10-12)**: an assistant reply after the output of a tool that is not Recordare's, in its turn, counts as the tool — facts and notes from it are pending, episodes `assistant_stated`; code rule, no prompt change; dev sets with tools 100 % (`dev_agent_personal`, `dev_echo`, 1 run each; RESULTS 5.7). The nightly pattern pass is done with 5.4 (2026-10-12). |
| 5.8 | **TODO — idea to evaluate when accessible** (maintainer's request 2026-10-08): a **decision model** (e.g. Jev by TypeSafe AI, Sept 2026: typed probabilistic decisions in 70–500 ms, no text; or, open and local, a small LLM forced to a closed JSON answer by constrained decoding — e.g. Spark-X2.5-4B by iFLYTEK, Sept 2026, 4 B parameters, Ollama / llama.cpp / vLLM; licence to check — measured per decision, not against the 95 % extraction bar, which small models missed at 60–83 %) Open, local, AGPL-compatible options (2026-10): **SemIf** (MIT; reads the probability of each allowed answer from an open 4 B model in one forward pass, decisions defined per request — no training; ~5× faster than generating JSON, 0.81 balanced accuracy reported), **Kev** (Apache-2.0; LoRA adapters on Qwen3.5 0.8 / 4 / 9 B serving Jev's own API — one contract for hosted Jev and local Kev, chosen by provider configuration), **jevlike** (MIT; a classifier trained on our own labels over a frozen encoder — fits the skip-window gate, our eval sets give the labels). as a fast, cheap judge for the engine's internal decisions — never for writing episodes, notes or digests. Candidates: skip windows with nothing to remember (fewer extraction calls), near-duplicate resolution (`resolve`), plan patches (happened / cancelled / only details, next to the D37 and 4.11 guards), memory-context relevance instead of a fixed similarity floor, who is speaking in an entity memory. Conditions: an optional provider task (D27: Recordare works without it), availability / price / local use checked, measured on the dev and blind sets (first: the skip-window gate, cost and accuracy vs the LLM). **Measured 2026-10-12, parked**: the gate has little to save — on the eval sets 38 of 3,214 extraction calls returned nothing (1.2 %), and the home installation made 13 extraction calls in five days (2 empty): too few to train or measure a gate; revisit with real volume |
| 5.9 | **Done (8.9, 2026-10-10)** — **Semantic memory: learned sources** (D49, maintainer's request 2026-10-08): sources stored with their passages and embeddings, origin and provider; learning as an episode linked both ways to its source; recall tool for passages (+ optional context passage); a client's document-search output not ingested as chat (a "consulted source" reference instead). Design first (data model, API, MCP tool, limits per profile, forgetting), then a dev set with questions answered only from sources, measured |

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
| 5b.1 | Service: live event stream for operators (`GET api/v1/admin/telemetry/stream`, Server-Sent Events): message ingested, extraction run start / end, LLM call (task, model, tokens, cost), episode / fact / note written, near-duplicate or correction, claim isolated, recall served, consolidation steps. Metadata only by default — no content unless the viewer is the holder (D33 / disclosure rules) |
| 5b.2 | Service: snapshot for the initial map: episodes (kind, importance, dates, links: corrects / duplicate_of / plan → event / shared people), facts and notes, per memory; 2-D / 3-D layout from the embeddings (e.g. UMAP / PCA computed server-side and cached) |
| 5b.3 | Dashboard app — now the `recordare-atlas` repo (5b.7) (TypeScript, Vite; Three.js or React Three Fiber): the prototype on real data — neurons placed by meaning, click a neuron to read the episode with its sources, filters by period / kind / person, replay of a day at speed, cost counters from `llm_calls` |
| 5b.4 | Access: admin key or the memory's own token only; no public mode; works with no content (metadata view) for shared screens |
| 5b.5 | Performance: thousands of neurons at 60 fps (instanced points, GPU particles), graceful fallback without WebGL |
| 5b.6 | **Visible neural network, real events only** (maintainer's request 2026-10-07): the brain shows an actual network — neurons joined by visible axon / dendrite paths within and between regions (fibre tracts) — instead of free-flying "meteors". Impulses run along those paths from one region to another. **No fake animation:** every impulse is one real Recordare event from the telemetry stream (5b.1) following the real route of that data (message → ingest → LLM extraction → episode written → links / resolver → recall …); with no events the brain is quiet. A "replay" of recorded events is allowed only if labelled as such. **The rule holds for every view** — the current brain view (regions, neurons, signals) as well as the network view: no decorative or simulated motion in the product; the simulated prototype exists only until the telemetry stream does |
| 5b.7 | **`recordare-atlas`: the dashboard as its own repo** (maintainer's decision 2026-10-08): part of the Recordare project, published together with it (same licence, AGPL), but optional — Recordare works without it (no listener, no cost). The repo holds the brain app plus a small server (holds the admin key, serves the app, relays the sources); installable on its own (Docker image). Recordare keeps only its sources: telemetry stream, atlas snapshot, totals. A **versioned event contract** (`atlas-events v1`) documented in Recordare lets the two repos evolve separately |
| 5b.8 | **Client agents on the brain** (maintainer's request 2026-10-08): show what the client platform does — agents invoked, its LLM calls, tools run — next to Recordare's own work, for Arkimede and any other client. Preferred route: the atlas server receives **OpenTelemetry traces (OTLP)** with the GenAI semantic conventions (`gen_ai.*`: `invoke_agent`, `chat`, `execute_tool`; model, tokens, durations — check the current version first), so any instrumented platform connects without custom code; a small helper for clients without OpenTelemetry. Mapping: agent planning → prefrontal cortex, the client's LLM generating → Broca's area (Recordare's LLM understanding = Wernicke's area), tools → motor cortex, recall → the existing prefrontal → hippocampus path. Events tied to the memory through Recordare's identities. **Metadata only** on this channel (prompts, replies, tool outputs never travel as telemetry: the viewer may not be the holder, content would escape forgetting and disclosure, and agent traces carry system prompts and tool data that are not memories); conversation content reaches Recordare only through ingest, under the memory's rules. Arkimede: instrument `backend/src/common/llm-usage.util.ts` and the agent / multi-agent services (work in the Arkimede repo, with the maintainer's OK) |
| 5b.9 | **Idea — Recordare speaks OpenTelemetry too**: emit its own operations as GenAI memory spans (`search_memory`, `create_memory`, `update_memory`, `delete_memory`; metadata only) so standard observability tools (Grafana / Jaeger / Langfuse) see Recordare with no dedicated integration, and the atlas could read them like any client. Observation only: memory content keeps travelling on ingest (REST / MCP) — telemetry samples, batches and drops, carries no authorship or participants, and escapes forgetting, so it is never a memory channel |

### M6 — Integrations (proof of client neutrality)

Status (2026-10-07): 6.1 TODO; **6.2 done** in Arkimede (outbox, identity + naming, MCP tools as `recordare_*` without
`log_episode`, consent state *(superseded by D50 / 8.1, 2026-10-09: no consent)*, error turns excluded); 6.3 partial (Settings switch done; Diary tab TODO — needs 4.7);
6.4 partial (unit tests; no recorded regression run); 6.5, 6.6 TODO; 6.7 (client library + conformance, Arkimede on it), 6.8 (entity memory, D48) and 6.9 (admin console) done; D34's A-MEM toggle split and the notes copy
Recordare → A-MEM TODO *(done 2026-10-13)*. Next in order (maintainer's decision 2026-10-07: connectors last): the 5.7 ideas,
4.7 read API (then the Diary tab, 6.3), 4.8 fresh blind dataset (and a blind entity-memory set), 4.10, then 6.6
connectors.
Status (2026-10-08): 6.1, 6.2, 6.3, 6.6, 6.7, 6.8, 6.9 done; 6.6b mostly done ((5), (10) done 2026-10-13, (6) on hold, (8) done with 5.7); 6.4 partial (unit tests; no recorded regression run) *(done 2026-10-18)*; 6.5 TODO *(done: (1)–(3) 2026-10-15, (4) 2026-10-16)*; D34's A-MEM
toggle split and the notes copy Recordare → A-MEM TODO *(done 2026-10-13: `sharedMemoryEnabled` apart from
`autoMemoryEnabled`; Diary copies by hand or by category rule, kept in step through the notes change feed)*; Arkimede still uses the synced copy of the client library, not
the npm package. Of the order above, 4.7 (diary
part), 6.3, 4.8, 6.6, 4.12, 4.10, 4.13, 4.14, the 8.7 follow-ups (2026-10-14, D51 included) 4.4c and 6.5 (2026-10-15/16) are done; next:
6.6b (6) when resumed.

| # | Task | Where |
|---|---|---|
| 6.1 | **Basic level**: configure Claude Code / Claude Desktop as MCP client, run a scripted session, verify tools work | This repo (docs + smoke test) — **done 2026-10-08** (Claude Code; INTEGRATION §4b, `npm run smoke:mcp`; agent writes wait for the person's confirmation; Claude Desktop needs OAuth or a bridge, untested) |
| 6.2 | **Arkimede full level**: register Recordare in its MCP client; non-blocking ingest of persisted messages (outbox + retry, never fails the chat); identity mapping Arkimede user → person | `personalAgent`, own branch |
| 6.3 | Arkimede settings: `episodicMemoryEnabled` toggle (since 8.1 the only switch: on = remembered; no "waiting for activation") + Diary tab (D18) via the Recordare timeline API | `personalAgent` Diary tab **done (2026-10-08)**: Settings → Diary (timeline with detail, correct, forget; diary; who you are; plans; to confirm) over a backend proxy; Arkimede's key needs the `write` scope. |
| 6.4 | Arkimede regression checklist (`EPISODIC_MEMORY_TODO.md` → Regression checklist): A-MEM, `search_conversations`, `search_memory` unchanged | `personalAgent` — **done 2026-10-18**: `backend/test/integration/memory-regression.integration.spec.ts` (real Postgres) runs the pre-Recordare queries (`ba089fc^`) next to today's code on the same rows: per-query notes, vector-leg scopes, pinned prefix, `search_conversations` (own and project chats; voice / API chats and error turns included), the three tools' names and arguments — equal. Reviewed by diff: every A-MEM change since then is additive with the old behaviour as default (D34 split: shared starts equal to auto); fact extraction unchanged (only the usage attribution); `recordare_*` tools never collide. Consolidation with nothing new: zero LLM calls (service tests: extraction gate, facts review, patterns). Not verified live: Recordare's tool schemas (`$schema`, `format: uuid`, `pattern`) on Gemini — LangChain strips `$schema`, the rest reaches the API (OpenAI-compatible verified in production) |
| 6.5 | **Continuous listening from a home voice device** (maintainer's decision 2026-10-07; D45): (1) a conversation source `ambient` and an extraction note for it (transcribed speech, recognition errors possible, not addressed to the assistant) — a prompt change, measured; (2) attribution caution: from `ambient`, episodes as usual but facts and notes about the holder stay **pending** until the holder confirms them in a chat or by voice to the assistant (a misrecognised speaker must not turn a sister's sentence into the holder's fact); (3) an `ambient` dev set (multi-speaker home conversations, recognition errors, a misattributed speaker) measured before the mode is enabled; (4) later, optional: a "room" ingest that fans one transcript out to the memories of the people present (v1: one ingest call per person, with the others as identity-linked participants). Already there: per-person memory, participants linked to persons through client identities, consent per person *(superseded by D50 / 8.1, 2026-10-09: no consent)*, forgetting by period. **(1)–(3) done 2026-10-15**: source `ambient`, `extract.v16` (the HEARD AROUND ME note in ambient windows only); every fact and note heard there pending — wider than "about the holder", since a misrecognised speaker makes any subject unsure — until its person says it again outside the room or confirms it; a pending item only proposes to replace or correct a stated one (migration `PendingProposals`); recall marks episodes and chat excerpts heard there (`heard`); a link code heard there is never a claim. Dev set `dataset_dev_ambient`: 86.7 % (misattributed 0.90) vs 88.3 % as `voice`, where a sister's night shifts became the holder's stated job (RESULTS.md). **(4) done 2026-10-16**: `POST api/v1/ingest/room` (client `ingestRoom`) fans one transcript out to the recipients' memories — each recipient's words as `user` turns, the other speakers as contacts (by user id or voice identity), an unknown voice "someone" — as `ambient` conversations with the same external id; no prompt change (each copy is an ordinary ambient window), so no new measurement | `recordare` |
| 6.6 | **Connectors: Recordare in any agent platform with one install** (maintainer's request 2026-10-07). MCP alone gives recall and explicit writes but no automatic capture of the conversation; each connector does both — sends the turns to ingest after each answer, and gives the agent the memory (MCP tools and/or context injected before the turn). In order: (1) **Claude Code plugin** — bundled MCP server + `Stop` / `SessionEnd` hooks that read `transcript_path` and ingest the new turns; (2) **Hermes Agent memory provider** (its official provider interface: per-turn sync, pre-turn prefetch); (3) **OpenClaw memory-slot plugin**; (4) **OpenAI-compatible memory proxy** for clients without plugins (forward to the real provider, ingest the turns, optionally add memory). Plus a `recordare connect` onboarding command (create the person, a personal token, configure the chosen connector). Each connector in its own small repo or package, metadata-only telemetry, consent rules unchanged *(superseded by D50 / 8.1, 2026-10-09: no consent)* | connectors — **done 2026-10-08 (full level, each smoke-tested for real)**: Claude Code plugin, Codex (hooks + MCP installer), OpenClaw plugin, Hermes Agent memory provider, OpenAI-compatible memory proxy (AnythingLLM tested; Open WebUI / LibreChat by the same mechanism, unit-tested) — `connectors/`; Claude Desktop / claude.ai basic only. Published with v0.1.0: Claude Code plugin through the repository's marketplace, `@arkimedehq/openclaw-recordare` on npm, image `ghcr.io/arkimedehq/recordare-openai-proxy`. The `recordare connect` onboarding command is not built (TODO) |
| 6.6b | **Found while building the connectors (2026-10-08)** — **done 2026-10-08: (1) `POST ingest/conversations/{id}/end`, (2) `TOOLS` in `packages/client` kept in sync by the conformance suite, (3) `POST api/v1/context {ingest}`, (4) the client is built before publishing, (9) personal tokens read before their conversation is stored, (11) console chip "waiting for consent"** *(superseded by D50 / 8.1, 2026-10-09: no consent)*; still TODO: (6), (8) → 5.7 (in progress); done 2026-10-13: (5) (the OpenClaw retry queue is on disk, across restarts — checked on a real OpenClaw 2026.9.9 Gateway: Recordare down, one turn, Gateway restarted, Recordare back → delivered once), (10) (`/mcp` answers plain JSON); the connectors dropped their workarounds (one call before a turn, `/end` at the end, OpenClaw's tools from `TOOLS`; Hermes, in Python, still copies its schemas) — done 2026-10-08: (1) a message-less "conversation ended" call (today the hint must ride on a message, so every connector keeps its last message to re-send it, and loses it on restart); (2) publish the MCP tool schemas (a JSON file in `packages/client` or `GET api/v1/mcp/tools`) so connectors that declare tools statically (OpenClaw) stop copying them by hand; (3) one call for "store this message and give me the memory context" (today a connector must ingest first, then ask the context: two round trips before each turn); (4) `packages/client/dist` stale against `src` — build it in CI / before publishing; (5) durable retry queue in the OpenClaw plugin (in memory today); (6) real-channel tests for OpenClaw (multi-person, groups) and Codex's interactive hook trust; (7) Claude Desktop / claude.ai stay at the basic level (no hooks to capture the conversation); (8) **the memory context misses easily** (Hermes smoke): "Come si chiama il mio gatto? Rispondi in una frase." → 0 items, without the suffix → 1, the English question → 0, period questions ("cosa ho fatto sabato scorso?") → 0 — the similarity floor on the raw message; measure with 5.7 (strip instructions, cross-language, resolve periods); (9) a read naming a conversation not stored yet returns nothing, even with a personal token; (10) `/mcp` answers only as an event stream (minor); (11) a person auto-provisioned by a client starts without consent, so a platform's first users are silently not remembered until the admin switches it on — tell the admin (console notice) *(superseded by D50 / 8.1, 2026-10-09: no consent)* |
| 6.7 | **One client, one contract, one conformance suite** (maintainer's decision 2026-10-07): uniformity at the contract level, not the mechanism — Arkimede stays the native server-side client (outbox, stable ids, participants, deletions, consent state *(superseded by D50 / 8.1, 2026-10-09: no consent)*: better than transcript hooks, which remain the best option only for platforms we do not control). (1) The client library `@arkimedehq/recordare-client` (API.md §5) lives **in this repo** as a workspace package (`packages/client/`), reusing the service's zod schemas — contract and client change in one commit, one CI, one version; it carries batched ingest with retries, identity / naming / consent state *(superseded by D50 / 8.1, 2026-10-09: no consent)*, the MCP session with user + conversation headers, and the fenced injected-context format; Arkimede moves onto it. (2) The same features for every client, Arkimede included (e.g. the pre-turn recall with `<memory-context>`, 5.7). (3) A **conformance suite** every client passes against the real service (a turn ingested once, deletions propagate, nothing sent before consent *(superseded by D50 / 8.1, 2026-10-09: no consent)*, recall carries user + conversation); Arkimede passes it first. TypeScript connectors live in `connectors/` on top of the client; other languages (Hermes, Python) as their own packages **Done (2026-10-07)**: `packages/client` (standards: official MCP SDK, RFC 9457, Retry-After, W3C trace context) + conformance suite in the service's CI; Arkimede moved onto it (synced copy in `backend/src/recordare/client/`, tools built from MCP `tools/list`). Read API wrappers come with 4.7. | `recordare` + `personalAgent` |
| 6.8 | **Entity memory** (D48, maintainer's decision 2026-10-07): memory `kind = entity` for shared accounts and devices (Arkimede's voice user first); facts with the person they are about; identification only says whose; named-in-window guard. **Done on branch `entity-memory`** (migration, admin `kind` / `displayName`, `GET /me` `kind`, `search_memory` `about`, dev set 95.5 % on 1 run). Client side (2026-10-07): `PATCH /me {kind}` while the memory is empty, the name follows the client's user (sync on rename), `GET /me` `atlasUrl` (`ATLAS_URL`); Arkimede: memory kind chosen in the memory settings, shared-memory notice, name sync, Atlas link for admins. TODO: intimate items readable only by their person (stronger identification) | `recordare` + `personalAgent` |
| 6.9 | **Admin console** (maintainer's decision 2026-10-07, after the Arkimede work): a small protected page served by Recordare itself (`/admin`, admin key or password) — persons and clients, consent on / off *(superseded by D50 / 8.1, 2026-10-09: no consent)*, kind, name, quality profile, keys and tokens, run a consolidation. Not in Recordare Atlas: the atlas stays a read-only view without login **Done** (2026-10-07): `service/console/` served at `/admin`, plus admin reads `GET persons` / `GET clients`, `PATCH clients/:id`, `DELETE identities/:id`; name search; IT/EN. | `recordare` |

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
(`API.md` §0, D33) — holder login and pages, OAuth 2.1 for MCP connectors, holder-driven linking and
revocation, read audit, persistent idempotency, backup / provider retention policy — plus network
protection in front (firewall / WAF / rate limits).

- Security: per-person data isolation tests, key rotation, rate limits, audit log of reads
  (the twin is a high-value secret — vision principle 5).
- Backup / restore, export of a person's data, full deletion.
- README, `docs/API.md`, deployment guide, AGPL headers, Docker image.
- Publish to `arkimedehq/recordare` — **only after the maintainer's OK**.

**First public release — v0.1, home / research profile** (maintainer's request 2026-10-08: publish when a working version
runs on some clients; the maintainer gives the final OK). Criteria, all required:
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
5b. **Released 2026-10-08**: tag `v0.1.0`, both repositories public; the npm package follows (maintainer's decision) —
   published the same day (`@arkimedehq/recordare-client`, `@arkimedehq/openclaw-recordare`; proxy image on GHCR).
6. **What goes public together**: `arkimedehq/recordare` and `arkimedehq/recordare-atlas`; `@arkimedehq/recordare-client`
   on npm (Arkimede then installs it instead of the synced copy); Arkimede's integration through its own public mirror —
   both repositories and the npm package are public; Arkimede's move to the npm package is TODO.
Not required for v0.1: the public profile (holder login, OAuth), connectors (6.6), phases 2+ of the vision (the
connectors shipped with v0.1 anyway).

### M8 — Agent memory (D50, maintainer's decision 2026-10-09)

Every memory belongs to an agent (a client account); personal mode = first person (the digital twin emerges),
entity mode = "someone" unless marked own; no consent, no viewer filter for now. Inventory with file references and
the open points: `docs/AGENT_MEMORY_AUDIT.md`; research: `docs/literature/human-memory-and-agent-architectures.md`.
Each prompt step: dev sets (1 run while iterating) + 3 blind runs to confirm; state the budget first (rules 1–9).

| # | Task |
|---|---|
| 8.0 | **D50** written (EPISODIC_MEMORY_TODO), M8 planned — **done 2026-10-09** |
| 8.1 | **No consent**: remove the consent gate everywhere (ingest, extraction, consolidation, MCP writes, `/me`, admin, console, client library, connectors, Arkimede); migration drops `episodic_enabled*`, `ingest_refused_at`; docs state the deployer's duty to inform (GDPR). Tests only — **done 2026-10-09**: ingest always stores (`stored` gone from the result), extraction / consolidation / MCP writes ungated, `episodicEnabled` gone from `/me` and admin, console switch and "waiting" chip gone, client library without `ConsentState` / `knownOff` / `status`, openai-proxy without `noConsent`, Arkimede badge off / active / unknown; migration `NoConsent1791060000000` |
| 8.2 | **No viewer filter**: answers use the whole memory in every conversation; keep a conversation resolver (MCP writes need it for evidence); `audience` / `disclosure` stay recorded. Tests only — **done 2026-10-09**: `ViewerContextService` → `ConversationResolver` (no viewer gate), MCP recall and `POST api/v1/context` answer in every conversation (shared, unknown, none, extra viewers), `"nothing to show here"` and `X-Recordare-Viewers` / `_meta.recordare.viewers` gone; MCP writes still need a resolvable conversation or a personal token; `raw_log_scope` kept |
| 8.3 | **Memory identity**: memory = account with `mode` personal / entity (migration from `persons.kind`), contacts per memory, account vs participant identities, attribution method + confidence on participants and messages, `own` marker on ingest, the account holder as "self", undeclared author = self (personal) / someone (entity). Prompt input unchanged: 1 run blind7 + 1 run dev_entity as a no-change check — **built 2026-10-09** (branch `memory-identity`; the no-change check is pending, the developer runs it): migration `MemoryIdentity1791070000000` (`memories.mode` / `gender` — table renamed in 8.10, `persons.kind` gone, contacts required to be scoped + `full_name` / `relation` + aliases, backfill of missing contacts, identities `account` / `participant`, `messages.author_kind` / `attribution_method` / `attribution_confidence`, sources `document` / `perception` / `ambient`, `subject_kind` / `subject_person_id` / `subject_candidates` on episodes / facts / notes, `clarifications` without behaviour); ingest `own` and attribution, participant identities resolved and created inside the memory, writer subjects (never `undecided` yet), `/me` + admin + console `mode` / `gender` (contacts count, identity kinds), client library `mode` / `gender` / `own` / sources; attribution on participants (only on messages) not built; prompts unchanged (the account speaker keeps today's labels); **no-change check passed 2026-10-09**: blind7 91.3 % (1 run; v11 3-run mean 91.7 %), dev_entity 100 % (1 run) |
| 8.4 | **Personal first person** (`extract.v12` and facts / resolver prompts): the agent's voice, subject on episodes / notes / facts, gender setting, recall returns the subject (an identified speaker gets their own memories), a leak detector instead of the 4.11 naming substitution. New dev set `dataset_dev_agent_personal`; dev sets 1 run each; confirm blind7 × 3 (bar 91.7 %) — **built 2026-10-09** (branch `personal-first-person`; **blind7 × 3 confirmation pending**, the developer runs it): `extract.v12` / `facts.v2` for personal memories (entity memories keep `extract.v11+entity.v3`, byte-identical inputs — test), speakers `me` / `me (assistant)` / `Name [C#]`, contacts listed and linked (`ContactBook`: created when only mentioned, merged only when clear; a participant identity binds to the one contact known only by name), subjects on episodes / facts / notes, clarifications (undecided → question → answered by a later window, 14-day expiry, one offered by the memory context), recall with `memory` / `subject` / `speaker` / `clarifications` (an identified speaker's items first), claims = others' statements about someone else, leak detector instead of the 4.11 naming substitution, the gate counts any person's turn; identified people may be sent as `user` with `authorRef` (8.7 follow-up). Dev runs (RESULTS 8.4, 8 runs ≈ 0.11 USD): new set 100 % / 94.7 %, dataset 97.9 %, news 75 %, poison 90 % / 95 %, echo 100 %, context 96.7 %; leaks 1 / 88 episodes, 0 / 19 notes. 8.5 / 8.6 inherit: entity prompt and recall framing, digests in the first person (digests still take only holder / assistant episodes), the facts review with subjects; **blind confirmed 2026-10-09: 91.7 % (3 runs), parity with v11; provenance −0.23 → 8.4b** |
| 8.4b | **Provenance after the first person** (blind7 provenance −0.23 with v12, overall parity): find why on `dataset_dev_poison` (not blind), fix, measure (dev runs + blind7 × 3) — **built 2026-10-09** (branch `provenance-v12`): `extract.v13` for personal memories (entity unchanged) — a claim about me is one episode, subject me, first person, with the absolute date it was said, who said it and where; claims no longer described as "about others" in recall. Dev: poison 100 %, dataset 100 %, personal 94.7 %; blind7 × 3 **90.9 %** (within noise of v11 / v12, 91.7 %), **provenance 0.6** (v12 0.4) — RESULTS 8.4b |
| 8.5 | **Entity agent**: own-marked input in first person, "someone" otherwise, subjects everywhere; new dev set `dataset_dev_entity_own`; confirm blind8 × 3 (bar 82.1 %) — **built 2026-10-09** (branch `entity-agent`): `extract.v13+entity.v4` / `facts.v2+entity.v4` built from the personal sections (personal prompts byte-identical, pinned by a test); "I" = the shared agent (its replies, actions, own content, its place), people by name, `someone` until the conversation identifies them; one `ContactBook` for both modes (entity-only name lookup removed), subject-less episodes / notes are someone's, subject-less facts the agent's; `speaker` in every recall (`someone` for an unidentified entity speaker), clarifications offered only to an identified speaker, claims by the personal rule, one gate. Maintainer's decisions: the assistant is "I", default gender masculine, "which Marco?" only to an identified speaker, `self` replaces the null subject (already stored so: no migration). Dev: `dev_entity_own` (new, 15 q) 100 %, `dev_entity` 100 %, `dev_poison` (control) 90 % (answers omitting claim dates; memory unchanged). **Blind8 × 3: 91.4 %** (90.3 / 93.5 / 90.3) vs 82.1 %, +9.1 [−1.1, +20.4], unidentified +0.89; e01 lost in 2 runs (recall found no appointments) — RESULTS 8.5. Follow-up: MCP writes (`log_episode` / `remember`) in entity memories still use the 8.3 subject rule |
| 8.6 | **Digests** in the agent's voice (day / month diaries), facts review with subjects; one consolidation run on the dev sets — **built 2026-10-09** (branch `agent-diary`): `digest.day.v2` / `digest.month.v2` (`+entity` for entity memories) in the first person with the memory's language and gender; sources = the memory's own items, a person's news about themself, what a tool taught — never others' claims (other, inferred); items labelled `[Name]` / `[someone]` / `[undecided: …]`; the prompt version is in a day's fingerprint (every day rewritten once); leaks counted in the consolidation run's summary. `facts_review.v2` (`+entity`): facts of every subject with ME / PEOPLE I KNOW, through the extraction's writer (fixes a latent break since 8.5: the review gave the writer no self names / contacts). Maintainer's decisions: contacts' news in the personal diary, rewrite the old diaries, both knobs stay off. Dev, 1 run each, both knobs on: `dataset` 97.9 % (q14 partial, as in v12b), `dev_agent_personal` 94.7 % (a16, as with the knobs off) — no gain; 25 day + 10 month digests, 0 leaks, 0 failures; the review proposed no change in 9 calls. Knobs stay **off** — RESULTS 8.6 |
| 8.7 | **Done 2026-10-09 (Arkimede mode + gender; connectors: one memory per agent, people as participants, per-user as an option). Follow-ups for the service / library (**done 2026-10-14**: the alias, personal tokens, gender in `PersonDirectory` — Arkimede dropped its own gender sync; **D51 done 2026-10-14** (branch `holder-link-codes`), maintainer's choice: the attribution to "I" must be as certain as possible — the holder's channel identity is linked by a one-time code sent from the channel (never stored; a claim, not in groups) and the holder's confirmation (`me/link-codes`, `me/identities`, admin and console equivalents; library methods; OpenClaw / Hermes / proxy send the code and tell the model; the past keeps its attribution); the connectors' explicit holder lists stay as the alternative): bind the holder's identity from ingest (the account holder's participant in a personal memory) so `selfSenders` / `SELF_IDS` / `SELF_USERS` are not needed; add a known participant's new display name as an alias; let personal tokens set mode / gender; sync gender in `PersonDirectory` like the name; rename participant role `owner` (done in 8.10 as `holder`); after 8.4 identified people may be sent as `user` with `authorRef`** — **Arkimede, client library, connectors**: account = memory, other users as participants, mode in Settings, each connector's account choice; conformance + smoke tests |
| 8.8 | **Kinox migration** (after 8.4–8.6): count, back up, rewrite Andrea's memory in the first person (Diary corrections kept), subjects / contacts for Arkim3de; sample-checked — **done 2026-10-10 as a restart from zero** (maintainer's choice): backup `recordare-20261010-011857.sql.gz`; the derived memory of both memories deleted in one transaction (Andrea 1 episode / 1 fact / 1 note / 2 digests, Arkim3de 4 / 1 / 2 / 2; clarifications, plan events, run outputs; review / consolidation watermarks reset); the raw log (39 messages), identities and tombstones kept (no contacts, no tombstones existed). New memories are written by `extract.v13` / `entity.v4` / `digest.*.v2` |
| 8.9 | **Learned sources** (D49) as the agent's knowledge: sources, passages + embeddings, own / provided-by, episode ↔ source links, `search_knowledge`, context passage; new dev set — **built 2026-10-10** (branch `learned-sources`): migration `Sources1791090000000` (`sources`, `source_passages` with full-text + HNSW, `episode_sources`); text only, in one request or in parts (`POST api/v1/ingest/sources`, `…/parts`; no size limit per source or memory — maintainer's decision; `MAX_REQUEST_BYTES` 16 MB per request), passages split in code and embedded in the background (receiving → indexing → ready); who gave it (`me` / a contact by name / `someone`); the learning episode by the extraction of its conversation (`SOURCES LEARNED IN THIS CONVERSATION`, only when present — system prompt unchanged) or in code from `src/lang/learned.ts` (25 languages); MCP `search_knowledge` / `learn_source`, `sources` on episodes, one passage in the memory context (`CONTEXT_MIN_PASSAGE_SIMILARITY` 0.6, to measure); read / forget routes (forgetting leaves `forgotten_at` on the episodes); client `learnSource` (automatic parts) / `forgetSource` / `sources`; body-parser errors → 413 / 400. Dev set `dataset_dev_knowledge` (new, 15 q): **96.7 %** (k04 partial); `dataset` control 95.8 % (q14, q18 partial on the answers' wording; memory unchanged) — RESULTS 8.9. Follow-ups: Arkimede "Fai imparare" button; connectors exposing the two tools; a dev case where the extraction links the source (the dataset's sources arrive after their conversation is extracted) |
| 8.10 | **Rename** the memory and its holder: no more "owner" in the product; tests only — **built 2026-10-10** (branch `rename-memories`): migration `Memories1791100000000` renames in place (no data changes beyond the renamed values): table `memories`, every memory column `memory_id` (persons and external identities included), indexes and constraints after them (e.g. `facts_memory_key_idx`, `persons_memory_id_fk`); the human a personal memory belongs to is its **holder** — enum value `holder` for participant role, author role and disclosure tier, origins `holder_lived` / `holder_told`, implied participant ref `holder`; token scope `memory_settings`, extraction gate marker `gate:no-holder-message`. API / MCP / client library / Atlas events: `memoryId`; admin routes `api/v1/admin/memories…`, telemetry stream `?memory=<id>`, personal-token principal `memory_token`, conversation resolution `memory_direct`; Atlas contract **v2**. Breaking: 0.1.0 clients do not work with it. The header `X-Recordare-User` is unchanged. The word remains only in the old migrations, the prompt texts and the leak detector's word lists (natural language, pinned), the CHANGELOG's history and the spike artefacts. Also: the OpenClaw plugin now declares `recordare_search_knowledge` / `recordare_learn_source` in its manifest (after 8.9 it offered them but the manifest listed six tools, and its test failed) |
| 8.11 | **Fresh blind sets** for the agent memory (personal with declared speakers; entity with own input), written by separate agents and re-read; 3 runs each for the reported numbers — **measured 2026-10-10** (`spikes/memory-eval/RESULTS.md` §8.11): blind9 personal **81.6 %** (bar 90.9 %), blind10 entity **89.8 %** (bar 91.4 %, within noise). Gaps found on the personal set: the period filter hides earlier actions about the asked day, plans not linked to the action that fulfilled them, the agent's own slips (stored as "I corrected the assistant", or not stored), detail of the agent's own turns collapsed, raw passages behind invalidated episodes; fixes to be discussed with the maintainer. **Fixes built 2026-10-10** (branch `blind9-gaps`): `extract.v14` (my own slips in the first person, options compared kept, plan steps done before the date amend the plan), out-of-period items in a period search, corrected chat excerpts marked (`correctedBy`); blind9 **88.8 %**, blind10 **91.4 %** (3 runs each; dev sets `dataset_dev_gaps*` 100 %). Step 2: out-of-period items ranked by relevance alone (blind9 q40 fixed): blind9 **90.1 %**, blind10 **93.3 %** (3 runs each; main set control 100 %). Step 3 (branch `entity-acts`): `entity.v5` (the agent's actions at someone's request are its own, with who asked; a C-number only for the item's person) and the writer's fallback for a listed contact the window never names given as an episode's subject; blind10 q04 0/3 → 2/3 + 1 partial, blind10 **91.9 %** (3 runs, within noise of 93.3; q06 now counts the blocked bungalow as a message for Nico), blind9 control 94.0 % (1 run). Step 4 (branch `resolver-outcome`): near-duplicate resolver `resolve.v2` — of two tellings of one event it keeps the one the model says covers the other, and keeps both when each has something of its own (before: the shorter one, holding the outcome, was hidden; blind9 q20's confirmation number reached the context in 2 of 10 runs, now 3/3); blind9 **90.2 %** (3 runs), blind10 control 92.9 % (1 run); q20 is still judged wrong when the answer names the holder in the third person; H13 (branch `modular-extract`, RESEARCH_NOTES H13): classify-and-compose extraction (arm B) no gain, removed; a `search_episodes` search ranks by relevance alone (arm R): blind9 **96.0 %**, blind10 **94.3 %** (3 runs each; main set 100 %); predict-then-extract (arm C, Nemori) no gain at +45 % extraction input, removed. Step 5 (branch `group-chats`): `extract.v15` (a group chat's name, the conversation title, in the extraction input), a `list` with a query also brings relevant out-of-period items, the judge told who asks (`holder` / `asker`: an answer naming the holder in the third person is not wrong; judge agreement 92.4 → 93.1 %); blind9 **96.0 %** (95.2 % for arm R under the new judge; q05 names one group of two in 3/3), blind10 **96.7 %** (3 runs each; main set 100 %). Step 6 (branch `vague-span`): a vague span ("these weeks") is not a period (the `search_episodes` description), chat excerpts carry their group chat's name (`group`); blind9 **97.2 %** (q05 correct 3/3), blind10 **96.7 %** (3 runs each; main set 100 %) |
| 8.12 | Later: reflection (the agent's own thoughts), self-model, procedural memory, the agent's own intents, perceptual layer (photos / audio / video / sensors), privacy and disclosure |
| 8.13 | From `docs/COMPETITORS.md` §6, **each discussed with the maintainer before it is built**: forget everything about a contact (tombstones; the deployer's GDPR tool); privacy as scopes checked at read time (later); a self card and contact cards as deterministic views in the Diary; D49 sources on Supermemory's documents / memories split; avoid LLM at read time, deleting outdated items, recency as truth, "when in doubt, extract"; re-run Mem0 OSS on the new agent sets (3 runs, budget first) — **done 2026-10-19**: blind5, 7, 9, 10, 11, 12, 3 runs each; Recordare ahead by 7–15 points on blind5, 9, 10, 11, within noise on blind7 and 12, lower unjustified-assertion rate on five sets of six (RESULTS.md); one LongMemEval-S point (~100 questions, 1 run, ≈ 10 blind runs of cost; LoCoMo skipped) — **done 2026-10-20**: 100 questions, Recordare 76.0 %, full context 84.5 % (whole history in the prompt); 83.7 / 82.6 % without single-session-assistant (0.14 / 1.00: what the assistant said is not in Recordare's memory: a gap against D30); Recordare ahead on temporal reasoning and knowledge updates (RESULTS.md) |

### M9 — Local models (after the project is complete; maintainer's decision 2026-10-09)

Every LLM task of Recordare (extraction, separate facts pass, near-duplicate resolver, day / month digests, facts
review) could run on a small local model doing only that task — a brain that also works offline (a robot). Phase after
M8, when the prompts are stable; every model kept only at ≥ 95 % on the suite (maintainer's rule).

| # | Task |
|---|---|
| 9.1 | **Decision model or distilled model, per task** (with 5.8): a decision model (Jev-like: typed probabilistic answers, no text, milliseconds) fits the *choices* — resolver (corrects / repeats / different), attribution ("which Marco"), importance, "does this news touch the person's life"; a small model distilled from the LLM (teacher → student, LoRA on an open base such as Qwen / Gemma) fits the *texts* — extraction, digests. Likely hybrid; compare on each task |
| 9.2 | **Training data**: synthetic conversations written by the teacher (many languages, the hard cases: plans, corrections, people, news), processed by the teacher; never the blind sets; Recordare keeps no model outputs (forgetting), so data is generated, not harvested. Check the teacher's terms first (some providers forbid training other models on their outputs) |
| 9.3 | **Pilot: the near-duplicate resolver** (smallest, unchanged by D50), then **digests**, then **extraction** once M8's prompt is final; constrained JSON decoding (llama.cpp / Ollama) for structured outputs |
| 9.4 | **Hardware**: evaluate buying a PC with an adequate GPU, to run (and possibly train) the local models instead of renting GPUs — sized on the measured needs (model size, VRAM, speed) of the models that pass 95 % |

## Open decisions to take along the way

| Id | Question | Proposal | When |
|---|---|---|---|
| D23 | Engine: build D / adopt Memobase / hybrid | **Build D — approved 2026-10-02** | Done |
| D35 | Cost | An option: quality profiles economy / balanced / full, per installation + per-memory override | Done (2026-10-03) |
| D34 | Notes: Recordare complete, A-MEM unchanged | Recordare has semantic notes; one-way copies to A-MEM by user choice; Arkimede toggle split in M6 | Done (2026-10-03) |
| D33 | Deployment profiles | v1 home / research; public-profile hardening deferred to M7 | Done (2026-10-03) |
| D31 | Facts in Recordare | State slots with value chain; notes stay in A-MEM until migration | Done (2026-10-03) |
| D32 | Extraction calls per window | One call (amends D2) | Done (2026-10-03) |
| D29 | Data model / recall additions from the literature | Approved (`EPISODIC_MEMORY_TODO.md`) | Done (2026-10-02) |
| D30 | Assistant turns | Extracted with `origin: assistant_stated` | Done (2026-10-02) |
| D28 | Data model fields for research hypotheses | Reserved from v1 (`EPISODIC_MEMORY_TODO.md`) | Done (2026-10-02) |
| D27 | LLM / embedding providers | **Any provider** via config profiles; DeepSeek + Ollama only as test setups | Done (2026-10-02) |
| D24 | MCP transport and per-person auth for basic-level clients | **Decided (M1)**: streamable HTTP at `/mcp`; personal access tokens for header-capable clients; OAuth 2.1 per the MCP authorization spec for clients that require it (Claude Desktop / claude.ai); full level = client API key + `X-Recordare-User` (`API.md` §1) | Done (2026-10-03) |
| D25 | Vector store | **pgvector** — decided, in use (HNSW, see below); no vector-store port (2026-10-18, 2.3) | Done (2026-10-03) |
| D26 | Where pattern promotions go while A-MEM lives in Arkimede | ~~Exposed by Recordare as `pending` proposals via API; the client decides~~ — the memory is autonomous (maintainer, 2026-10-12): patterns are its own inferred notes, kept / updated / retired by itself; a client reads them as notes (`pattern: true`) and may only forget them | **Decided 2026-10-12** (5.4 built) |
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
  further) — ~~kept reachable through `VectorStorePort`~~ (2026-10-18: no port, see M2 status: one-query hybrid recall
  and transactional forgetting are the reasons for pgvector). **TimescaleDB** (time-series
  hypertables: no benefit at our volume, partitioning constraints, non-OSI Timescale
  License next to AGPL, heavy image, rarely available on managed Postgres).
- Escape hatch: **pgvectorscale** (PostgreSQL licence) adds a StreamingDiskANN index on the
  same `vector` type — only an index change, no schema migration, if volumes ever grow.

## After phase 1

Roadmap phases 2–8 (self-model, contacts & disclosure, twin interface, initiative L1,
voice, initiative L2, legacy mode) and the A-MEM migration follow the order in
`DIGITAL_TWIN_VISION.md`. Phase 1 must already keep `people` on episodes and
holder-lived vs twin-lived provenance in the data model, so phase 3 can add disclosure
without migrating episodes.

## Working conventions

- One branch per milestone (`m0-engine-decision`, `m1-contracts`, …), merged `--no-ff`
  after the maintainer's OK; branch deleted after merge.
- Each milestone ends with: tests green, `tsc --noEmit` clean, eval harness run (from M3),
  docs updated (decisions recorded as D-numbers).

## Evaluation budget (maintainer's rule, 2026-10-05)

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
