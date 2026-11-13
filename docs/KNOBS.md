# Knobs — every setting in one place

*Italian version: [KNOBS_it.md](KNOBS_it.md).*

Every setting of Recordare, its optional companions and its client side, with where it is set, its default and — for the
engine's knobs — whether and how it was measured. Cost is the operator's option, never a silent limit (D35); a knob that
did not show a gain stays off until a measurement says otherwise (evaluation rules, `WORK_PLAN.md`).

## 1. Quality profiles (per installation, per person)

`QUALITY_PROFILE` sets the installation default (`balanced`); each person may have their own (`qualityProfile`, admin
API or console). A profile only groups knobs; models stay provider configuration (§3).

| Knob | economy | balanced | full | What it does · measured |
|---|---|---|---|---|
| `windowChars` | 16 000 | 12 000 | 8 000 | Characters of messages per extraction call (fewer = more calls, finer extraction) · blind3: profiles within noise |
| `extractionTask` | `extract_economy` | `extract` | `extract` | Which task's model runs the extraction (§3) |
| `reasoning` | off | off | on | Lets the extraction model reason (slower, more output) |
| `factsPass` | inline | inline | inline | Facts and notes in the episode call, or a separate call on the `facts` model · blind5 with V4 Pro: no gain, +65 calls |
| `recentEpisodes` / `relatedEpisodes` | 6 / 6 | 8 / 10 | 12 / 20 | Episodes shown to the extractor (recent + related to the window) |
| `resolverWindowDays` / `resolverSimilarity` | 3 / 0.7 | 3 / 0.7 | 7 / 0.6 | Near-duplicate candidates (± days, min similarity) |
| `rawHitsAlongside` | 1 | 3 | 5 | Chat excerpts returned next to matching episodes |
| `recallDigests` | off | off | off | Nightly diary given to period overviews · blind5 3+3 runs: −1.9 pt, within noise; diary v2 (8.6, first person) dev sets 1 run: no gain |
| `factsReview` | off | off | off | Nightly facts review against new episodes · no gain measured (5.6; v2 with subjects, 8.6: proposed no change on the dev sets) |
| `patterns` | off | on | on | Nightly pattern pass: recurring patterns (≥ 3 episodes on different days) become the memory's own inferred notes, kept / updated / retired by it · one call per memory per night with new episodes · dev_patterns, `patterns.v2`, 3 runs: 20 / 21 habits, no false pattern (5.4) |
| `initiativeWording` | off | on | on | Initiatives worded and weighed by the model (D53, 8.12c, `initiative.v3`, with the local hours that suit each): one call when intents are due; below worth 0.3 a plan's ask is dropped (never a request or a promise); off: the service's own sentence · dev_initiatives 19–20 / 22, ≈ 95 % precision (RESULTS.md) |
| `thoughts` | off | on | on | Thought pass (D53, 8.12a–d): the agent's own insights, questions and opinions, its self notes (8.12b) and procedures (8.12d, how it does a recurring task, from an outcome; dev_procedures, `thoughts.v7`, 3 runs: 11 / 14, 10 / 14, 11 / 14, at most one false), each resting on the episodes it cites, supported / weakened / retired by later ones · one call per memory when the new episodes gathered an importance ≥ 20, none otherwise · dev_thoughts, `thoughts.v6`, 3 runs: 14 / 14, 14 / 14, 13 / 14 expected thoughts, no false thought; the self-model (8.12b, kind `self`, from the agent's own replies and the reactions to them) dev_self 11–12 / 15 self notes, no false one (RESULTS.md) |

Installation overrides of single knobs (they win over every profile): `EXTRACTION_WINDOW_CHARS`, `FACTS_PASS`,
`RECALL_DIGESTS`, `FACTS_REVIEW`, `PATTERNS`, `THOUGHTS`, `INITIATIVE_WORDING`.

## 2. Service (`service/.env`, or `deploy/.env` for the installed service)

| Variable | Default | What it does |
|---|---|---|
| `DATABASE_URL`, `REDIS_URL` | — | Postgres (pgvector) and Redis |
| `QUEUE_PREFIX` | `recordare` | Separates installations or evaluation instances on one Redis (rule 9: one instance per queue) |
| `PORT` | 8080 | HTTP port inside the container |
| `ADMIN_API_KEY` | — | Admin credential (≥ 32 characters): admin API and console |
| `ATLAS_URL` | — | Where people open Recordare Atlas; handed to clients in `GET /me` (admins only see it in Arkimede) |
| `MAX_REQUEST_BYTES` | 16 MB (16 777 216) | Largest JSON request body (≥ 100 000); bigger → `413` `payload_too_large`. A learned source bigger than this arrives in parts (`learnSource` sends 4 MB parts, `SOURCE_PART_BYTES`); no limit per source or per memory (WORK_PLAN 8.9) |
| `IDLE_DELAY_SECONDS` | 900 | Quiet time before a conversation is extracted (a new message restarts it) |
| `CONTEXT_MIN_FACT_SIMILARITY`, `…_EPISODE_…`, `…_PLAN_…`, `…_PERIOD_…` | 0.50, 0.55, 0.45, 0.35 | Memory context (`POST api/v1/context`): minimum similarity for facts and notes, episodes, upcoming plans, episodes of a named period. Lower floors (0.45 / 0.48 / 0.42) measured: no gain (RESULTS 5.7) |
| `card` (body of `POST api/v1/context`) | true (D54) | The self card at the top of the memory context (WORK_PLAN 8.13): an agent always knows who it is; `false` turns it off · measured on ten evaluation memories: 526 characters on average, 600 at most (≈ 130–150 tokens) |
| `CONTEXT_MIN_PASSAGE_SIMILARITY` | 0.6 | Memory context: minimum similarity for the one passage of a learned source it may hold (cut at 300 characters, `- learned (from «title»): …`; WORK_PLAN 8.9). First value, to measure |
| `CONTEXT_MIN_PROCEDURE_SIMILARITY` | 0.55 | Memory context: minimum similarity (title and situation) for the one procedure it carries whole, on its own budget of 1 500 characters, cut only between steps (WORK_PLAN 8.16 F2). First value, to measure |
| `CONTEXT_EMBEDDING_BUDGET_MS` | 1500 | Memory context: the longest wait for its query vectors; past it, the block holds the self card only (`Nothing else came to mind`, a warning in the log, `recall.served` with `late`), and the late vectors serve the same message next time (query cache). 0 = wait without limit (the earlier behaviour). A hosted embedding provider with slow tails may want more · measured on Kinox (i3-1215U, bge-m3 on CPU): a query alone 110–150 ms; with a long text already on the server ≈ 1.6 s (at 1000: served at ≈ 1 s with the card); during voice turns, with the CPU shared with speech recognition, 570–730 ms — 1500 keeps a margin under the host's 2.5 s |
| `CONTEXT_SHORT_QUERY_WORDS` | 4 | Memory context (D54): a message of at most this many words (Intl word segmentation, any language: "e lui?", "他呢？") is matched together with the person's previous turn in the same conversation too; 0 never · unit and integration tests, not measured on a dev set |
| `CONSOLIDATION_SCHEDULE` | on | Nightly consolidation on its own, preceded by the extraction of messages left pending (4.1); off = only on demand (evaluations) |
| `CONSOLIDATION_HOUR` | 3 | Local hour (person's timezone) after which the night runs |
| `INITIATIVE_DAILY_LIMIT` | 3 | Initiatives a person is given a day at most (D53, 8.12c); the rest wait for tomorrow |
| `PERCEPTION_KEEP_DAYS` | 14 | Days a perception is kept before it fades (8.12e, API.md §4c); 0 = kept; a memory's `perceptionKeepDays` and a request's `keepDays` win. A first guess |
| `PERCEPTION_DEDUP_MINUTES` | 10 | The same perception (sensor, place, words) again within these minutes is one; 0 = every one kept |
| `LEARNED_NEWS_KEEP_DAYS` | 7 | Learning from outside (8.16, D57): days perishable knowledge (news, a forecast, a price) is kept when it names no date of its own; it fades at the nightly consolidation |
| `LEARNED_RECHECK_DAYS` | 180 | Days after which slowly changing learned knowledge (opening hours, a phone number) is told as possibly out of date |
| `PROCEDURES_FROM_SOURCES` | off | Mode B2 (8.16 F2c): an entity memory that learns reads a source learned for a task with its own model (task `procedures`) and keeps its procedures, pending; per memory `proceduresFromSources` (console) wins; never on the economy profile. To measure |
| `PROCEDURES_SOURCE_CHARS` | 30 000 | B2: characters of a source read (its beginning). First value, to measure and tune |
| `PROCEDURES_PER_SOURCE` | 3 | B2: procedures kept from one source. First value |
| `PROCEDURES_DAILY_CALLS` | 5 | B2: readings per memory a day; a source over the cap waits for the nightly sweep. First value |
| `LEARNING_OWN_TOOLS` | empty | Tool names (a regular expression, case-insensitive) that are the agent's own first-party tools (a calendar, a device): what they say is trusted enough to be kept at once; empty: every tool counts as a site |
| `LEARNED_AHEAD_DAYS` | 3 | 8.16 F3: something read that touches a known life is told (or asked about) when it is at most this many days ahead |
| `LEARNING_STAGE_YOUNG` | 30 | 8.16 F3 child-like stages: below this many items the household confirmed an entity memory that learns is young — up to two learning questions a day per person, what it read said only as a question. First value, to measure |
| `LEARNING_STAGE_GROWN` | 150 | From this many it is grown: it asks to confirm only lasting knowledge read. First value, to measure |
| `WEBHOOK_ALLOW_PRIVATE` | false | Webhooks may point to private addresses and plain http (a client co-hosted with Recordare); off: public https only |
| `QUALITY_PROFILE` | `balanced` | Installation default profile (§1) |
| `LOG_LLM_CALLS` | on | One `llm_calls` row per call (tokens, latency; never content) |
| `ALLOW_CLOCK_OVERRIDE` | off | Evaluations / tests only: honour `X-Recordare-Now` |
| `NODE_ENV` | development | — |

## 3. Models and providers (any provider, D27)

| Variable | What it does |
|---|---|
| `LLM_PROVIDER` | `openai-compatible` (default), `anthropic`, `claude-cli` (local evaluations only) |
| `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` | Default endpoint and model of every task |
| `LLM_PROFILE` / `LLM_PROFILE_JSON` | Provider profile — how to switch reasoning off, structured output: `generic`, `deepseek`, `openrouter`, `ollama`, `vllm`, `anthropic`, `openai`, or a JSON definition |
| `LLM_<TASK>_MODEL` / `_PROVIDER` / `_PROFILE` / `_PROFILE_JSON` / `_BASE_URL` / `_API_KEY` | Per-task override; tasks: `EXTRACT`, `EXTRACT_ECONOMY`, `RESOLVE`, `FACTS`, `DIGEST`, `PATTERNS`, `THOUGHTS`, `INITIATIVE`, `PROCEDURES` |
| `EMBEDDING_BASE_URL`, `EMBEDDING_API_KEY`, `EMBEDDING_MODEL` | Embedding endpoint (measured with `BAAI/bge-m3`) |
| `EMBEDDING_DIM` | Fixed per installation (1024 for bge-m3); changing the model needs a re-embed |
| `EMBEDDING_QUIET_MS` | Default 10000. Interactive embeddings (memory context, recall tools, `remember`) are sent at once; background ones (new messages, extracted memories, passages, nightly passes) run one request at a time and start only after this long without an interactive one — a conversation asks again within seconds, background work waits for its pause — or after 60 s of waiting at most. 0 = as soon as no interactive request is in flight. A message is then vector-searchable up to a minute later during a conversation (full-text finds it meanwhile). Evaluation setups may use 0 (on-demand consolidation then never waits) · measured on Kinox: the context query during a turn's ingest 4 970 ms → 137 ms |
| `EMBEDDING_BACKGROUND_BATCH_CHARS` | Default 2000. Characters per background request (a longer text goes alone, 64 texts at most): a request already on a serial server cannot be interrupted, so this bounds a query's wait; on a CPU it is also faster (no padding of short texts to the longest: one turn's ingest 4.9 s → ≈ 2 s on Kinox). A GPU or hosted provider (parallel, rate-limited by requests) may raise it (e.g. 50000) and set `EMBEDDING_QUIET_MS=0` |

Supported models: only those reaching 95 % on the evaluation — measured models, scores and weight licences in `docs/MODELS.md`.

## 4. Per person (admin API, console, or the person's platform)

No consent setting (D50): every memory stores what its client sends; the on/off switch is the client's (§8).

| Setting | Who sets it | Default | What it does |
|---|---|---|---|
| `mode` | the person on their platform (only while the memory is empty), or the admin | `personal` | `entity` = a memory shared by everyone using the account (D48, D50): undeclared input is "someone"'s |
| `gender` | the platform (from the account's profile) or the admin, any time | `masculine` | `feminine`, `neutral`: the first person in gendered languages (D50; read from WORK_PLAN 8.4) |
| `displayName` | follows the platform's profile (synced) | the client's user id | The person's name |
| `qualityProfile` | admin | installation default | §1 |
| `locale`, `timezone` | admin | `it`, `Europe/Rome` | Language of the memories, local dates and the night |
| `quietFrom`, `quietTo` | admin | 22, 8 | The memory's quiet hours (local): no initiative is due inside them (D53, 8.12c) |
| `perceptionKeepDays` | admin (console) | installation default | Days a perception is kept before it fades (8.12e); 0 = kept |
| `proceduresFromSources` | admin (console) | `PROCEDURES_FROM_SOURCES` (off) | Procedures from sources learned for a task (8.16 F2c, mode B2), for an entity memory that learns |
| `learnFromOutside` | admin (console) | on for an entity memory, off for a personal one | Learning from outside (8.16, D57): the memory keeps lasting knowledge it reads or is told, with its source and trust; off: today's rules (`entity.v12` prompt) |

## 5. Per client (admin API or console — every setting below, webhooks and channels included)

| Setting | Default | What it does |
|---|---|---|
| `kind` | — | `platform`, `mcp_client`, `import` |
| `autoProvision` | off | Create a person at the first contact of a new user |
| `rawLogScope` | `own` | Raw-log excerpts from this client's conversations only, or all |
| `disabled` | off | Every key and token of the client stops at once |
| `channels` | `[]` | D55: the channels the client reaches a person on, each with how — `chat` / `messaging` `always`, `voice` on `presence`; a new initiative's `channel` (where the clock may push it) is the first of its acceptable `channels` declared `always` (§5b: messaging only for a request or a promise). `INITIATIVE_VOICE_PACE_MINUTES` (service env, default 30, on trial, maintainer 2026-11-05; 0 = no pace): at most one spontaneous announcement — an initiative by voice or an opening — per person this often (§5c). `INITIATIVE_TIMING` (service env, default `v0`; `v1` corrects v0 with each person's outcomes — F4, `learning.ts`: accepted said / asked / done vs ignored / declined, per part of the day and channel, a Beta estimate whose prior is v0's fit, prior strength 2, at least 3 outcomes before holding back below 0.35 or switching channel by a 0.2 margin, last 60 days; `v2` is v1 and the moment's context — F6: a pause after a refusal, a busy person, a conversation in progress, company learnt apart; `due` pushes as soon as due — the evaluation baseline). `INITIATIVE_TIMING_SHADOW` (service env, default false): with `v0`, logs what `v1` would have decided beside each decision (`features.shadow`) and what v2's moment would hold (`features.moment`), changing nothing. Timing v2 (service env, first guesses, on trial): `INITIATIVE_COOLDOWN_DECLINED_MINUTES` (default 180; after a declined initiative or a negative reaction, nothing flexible for that person), `INITIATIVE_COOLDOWN_IGNORED_MINUTES` (default 60, from the outcome; after one ignored that was given within twice this time), `INITIATIVE_CONVERSATION_GAP_SECONDS` (default 90; how long a client's `talking` in a place holds an opening there); 0 turns each off. Identity thresholds 0.6 (medium) / 0.85 (high) are constants (`IDENTITY_THRESHOLD`), not measured yet; so is timing v0 (`TIMING`: thresholds say 0.5 / ask 0.6, preferred hours say 9–21 / ask 10–20, off-hours fit 0.3, default prior 0.7, timed grace and last chance 2 h) — a first guess, logged with every decision for F4 to replace |
| Key scopes | — | `ingest`, `mcp`, `read`, `write` (never admin, memory settings or export) |

Webhooks (D53, 8.12c): `POST api/v1/admin/clients/{id}/webhooks {url, token?, authentication?, description?, events?}` registers where a client receives the agent's initiatives (Standard Webhooks, the `whsec_` secret shown once); `GET …/webhooks`, `DELETE api/v1/admin/webhooks/{id}`. `API.md` §4b.

## 6. Installation scripts (`deploy/`)

| Variable | Default | What it does |
|---|---|---|
| `RECORDARE_PORT` | 8090 | Host port of the service |
| `RECORDARE_PROJECT` | `recordare` | Compose project name (containers `<name>-recordare-1`, …); another name for a second installation on the same host — the installer stops if the name is already used by other files |
| `EMBEDDER_MAX_BATCH_TOKENS` (standalone) | 2048 | Batch of the bge-m3 embedder; ≈ 4.5 GB of RAM at 2048 (text-embeddings-inference's own default, 16384, runs out of memory on an 8 GB host); longer inputs are truncated |
| `RECORDARE_BIND` | `127.0.0.1` | `0.0.0.0` opens the API and the admin console on the LAN (every route still needs a key) |
| `ARKIMEDE_NETWORK` | — | Set by the co-hosted install: the Docker network shared with Arkimede |
| `LINK_ARKIMEDE` | yes | The installer creates Arkimede's client and writes its `.env` |
| `ARKIMEDE_DIR` (co-hosted) | found from Arkimede's running backend | Arkimede's folder, whose `.env` the installer updates |
| `LLM_API_KEY_FILE` (install.sh) | — | Non-interactive install: read the LLM key from this file (never on the command line) |
| `EMBEDDER_IMAGE` (standalone) | text-embeddings-inference CPU 1.9 image for the host's architecture | Set by the installer (`cpu-arm64-1.9` on arm64) |
| `RECORDARE_MEM_LIMIT` (co-hosted) | `768m` | Memory limit of the service container next to Arkimede |
| `RECORDARE_DB_PASSWORD`, `POSTGRES_PASSWORD` | generated | Database password written by the installer (kept on re-runs) |
| `KEEP` (backup.sh) | 14 | Database dumps kept |

## 7. Recordare Atlas (`recordare-atlas`, optional)

| Variable | Default | What it does |
|---|---|---|
| `RECORDARE_URL`, `RECORDARE_ADMIN_KEY` | — | The service it reads (the admin key stays on the atlas server) |
| `ATLAS_INGEST_TOKEN` | — | Bearer token OTLP senders must present at `/v1/traces` |
| `ATLAS_HOST`, `ATLAS_PORT` | `127.0.0.1`, 5175 | Listen address (container: `0.0.0.0`) |
| `ATLAS_BIND`, `ATLAS_PUBLIC_PORT`, `ATLAS_NETWORK` | `127.0.0.1`, 5175, — | Compose: host binding (LAN only on a trusted network), host port, Recordare's Docker network |
| `ATLAS_ALLOWED_HOSTS` | — | Development server only: extra Host names (e.g. `host.docker.internal`) |

## 8. Client side — Arkimede (any client through `packages/client`)

| Setting | Where | Default | What it does |
|---|---|---|---|
| `RECORDARE_URL`, `RECORDARE_API_KEY` | Arkimede `.env` | — | Off unless both are set |
| `RECORDARE_OUTBOX_POLL_MS` | Arkimede `.env` | 3000 | How often the outbox worker sends |
| `episodicMemoryEnabled` | Settings → Memory, per user | off | The platform's own opt-in, the only on/off switch (D50): while off nothing is sent and no person is created |
| Memory type | Settings → Memory, per user | personal | Personal / shared (`PATCH /me {kind}`, only while empty) |
| Memory context | Agents → agent, per agent | off | Before each answer, Recordare's relevant memories (`POST api/v1/context`) at the end of the prompt (WORK_PLAN 5.7) · dev set: no harm, +3–7 pt; with the voice agent's prompt tool calls 9 → 5 of 15. A client choice: Recordare serves the block whenever asked, from the whole memory in every conversation (D50) |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`, `_HEADERS`, `_PROTOCOL`, `OTEL_SERVICE_NAME` | Arkimede `.env` | off | OpenTelemetry GenAI traces to the atlas (metadata only) |
| Library delivery policy | `packages/client` (`DEFAULT_DELIVERY`) | 12 attempts, 5 s → 1 h | Outbox retries (jitter, `Retry-After`), then parked |
| Source part size | `packages/client` (`SOURCE_PART_BYTES`, `learnSource`'s `partBytes`) | 4 MB | A learned source bigger than this is sent in parts, cut at paragraph boundaries (keep it below the service's `MAX_REQUEST_BYTES`) |

## 8b. Connectors (`connectors/`, each README has the full list)

| Connector | Where | Main settings |
|---|---|---|
| Claude Code | plugin options (`url`, `token` in the keychain); or `RECORDARE_URL` / `RECORDARE_TOKEN`, or `~/.config/recordare/claude-code.json` (hooks only) | A personal token with the scopes `mcp`, `ingest`, `read` |
| Codex | `install.sh --url … [--trust]` → `~/.config/recordare/codex.json`, `$CODEX_HOME/hooks.json` and `config.toml` | `RECORDARE_URL`, `RECORDARE_TOKEN`, `RECORDARE_TRUST_HOOKS=1` (= `--trust`), `CODEX_HOME` (default `~/.codex`) |
| OpenClaw | plugin options | `url`, `apiKey` (default `RECORDARE_URL` / `RECORDARE_API_KEY`), `memoryPer` (`agent` (D50) \| `user`), `defaultUser` (the agent's account with a client key), `selfSenders` (the account holder's senders), `users` (`memoryPer: user`), `autoRecall` (on), `capture` (on), `tools` (on), `groups` (on), `timeoutMs` (3000), `initiatives` (off: initiatives pushed to the person's last direct chat as session notices, D55 F3), `initiativesPollSeconds` (60, at least 15) |
| Hermes Agent | env or `memory.recordare.*` | `RECORDARE_URL`, `RECORDARE_API_KEY`, `RECORDARE_MEMORY_PER` (`agent` (D50) \| `user`), `RECORDARE_USER` (the agent's account with a client key), `RECORDARE_SELF_IDS` (the account holder), `RECORDARE_USER_ALIASES`, `RECORDARE_RECALL` / `_TOOLS` / `_CAPTURE` (on), `RECORDARE_TIMEOUT` (3 s) |
| OpenAI-compatible memory proxy | env | `UPSTREAM_BASE_URL`, `UPSTREAM_API_KEY`, `PROXY_API_KEY`, `RECORDARE_URL`, `RECORDARE_API_KEY`, `MEMORY_PER` (`instance` (D50) \| `workspace` \| `user`), `RECORDARE_USER` (the proxy's account with a client key), `SELF_USERS` (the account holder), `RESOLVERS`, `USER_MAP`, `USER_MAP_ONLY`, `DEFAULT_USER`, `OPENWEBUI_JWT_SECRET`, `RECALL_TIMEOUT_MS` (1500), `END_IDLE_SECONDS` (0 = Recordare's idle delay), `SKIP_PATTERNS`, `RECALL` / `CAPTURE` (on), `MEMORY_TOOLS` (off: the context-only memory charter, D54), `LOG_UPSTREAM` (off), `PORT` (8788), `MAX_BODY_BYTES` (25 MB), `TZ` |

## 9. Evaluation spike (`spikes/memory-eval/.env`)

`LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` (answer and judge), `ENGINE_MODEL`, `ENGINE_NO_THINKING`, `EMBED_MODEL`,
`EVAL_DATASET`, `RECORDARE_URL` / `RECORDARE_ADMIN_KEY` / `RECORDARE_DB_URL` (service system),
`EVAL_SOURCE_AMBIENT_AS` (service system: send a set's `ambient` sessions with this source instead, e.g. `voice` — the
comparison arm of WORK_PLAN 6.5), `CONSOLIDATE`,
`AGENT_SYSTEM_FILE` (agent mode: a real agent's prompt), `REASONING_OFF_BODY`, `OPEN_ROUTER_API_KEY`; the provider matrix (`provider_eval.py --config profiles/<model>.json`) reads each profile's key from the variable it names (`OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `LLM_API_KEY`). Spike runs cost
money: the evaluation budget rules in `WORK_PLAN.md` apply.
