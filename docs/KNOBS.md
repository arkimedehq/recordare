# Knobs — every setting in one place

*Italian version: [KNOBS_it.md](KNOBS_it.md).*

Every setting of Recordare, its optional companions and its client side, with where it is set, its default and — for the
engine's knobs — whether and how it was measured. Cost is the owner's option, never a silent limit (D35); a knob that
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
| `recallDigests` | off | off | off | Nightly diary given to period overviews · blind5 3+3 runs: −1.9 pt, within noise |
| `factsReview` | off | off | off | Nightly facts review against new episodes · no gain measured |

Installation overrides of single knobs (they win over every profile): `EXTRACTION_WINDOW_CHARS`, `FACTS_PASS`,
`RECALL_DIGESTS`, `FACTS_REVIEW`.

## 2. Service (`service/.env`, or `deploy/.env` for the installed service)

| Variable | Default | What it does |
|---|---|---|
| `DATABASE_URL`, `REDIS_URL` | — | Postgres (pgvector) and Redis |
| `QUEUE_PREFIX` | `recordare` | Separates installations or evaluation instances on one Redis (rule 9: one instance per queue) |
| `PORT` | 8080 | HTTP port inside the container |
| `ADMIN_API_KEY` | — | Admin credential (≥ 32 characters): admin API and console |
| `ATLAS_URL` | — | Where people open Recordare Atlas; handed to clients in `GET /me` (admins only see it in Arkimede) |
| `IDLE_DELAY_SECONDS` | 900 | Quiet time before a conversation is extracted (a new message restarts it) |
| `CONTEXT_MIN_FACT_SIMILARITY`, `…_EPISODE_…`, `…_PLAN_…`, `…_PERIOD_…` | 0.50, 0.55, 0.45, 0.35 | Memory context (`POST api/v1/context`): minimum similarity for facts and notes, episodes, upcoming plans, episodes of a named period. Lower floors (0.45 / 0.48 / 0.42) measured: no gain (RESULTS 5.7) |
| `CONSOLIDATION_SCHEDULE` | on | Nightly consolidation on its own; off = only on demand (evaluations) |
| `CONSOLIDATION_HOUR` | 3 | Local hour (person's timezone) after which the night runs |
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
| `LLM_<TASK>_MODEL` / `_PROVIDER` / `_PROFILE` / `_PROFILE_JSON` / `_BASE_URL` / `_API_KEY` | Per-task override; tasks: `EXTRACT`, `EXTRACT_ECONOMY`, `RESOLVE`, `FACTS`, `DIGEST` |
| `EMBEDDING_BASE_URL`, `EMBEDDING_API_KEY`, `EMBEDDING_MODEL` | Embedding endpoint (measured with `BAAI/bge-m3`) |
| `EMBEDDING_DIM` | Fixed per installation (1024 for bge-m3); changing the model needs a re-embed |

Supported models: only those reaching 95 % on the evaluation (`RESULTS.md`).

## 4. Per person (admin API, console, or the person's platform)

No consent setting (D50): every memory stores what its client sends; the on/off switch is the client's (§8).

| Setting | Who sets it | Default | What it does |
|---|---|---|---|
| `mode` | the person on their platform (only while the memory is empty), or the admin | `personal` | `entity` = a memory shared by everyone using the account (D48, D50): undeclared input is "someone"'s |
| `gender` | the platform (from the account's profile) or the admin, any time | `masculine` | `feminine`, `neutral`: the first person in gendered languages (D50; read from WORK_PLAN 8.4) |
| `displayName` | follows the platform's profile (synced) | the client's user id | The person's name |
| `qualityProfile` | admin | installation default | §1 |
| `locale`, `timezone` | admin | `it`, `Europe/Rome` | Language of the memories, local dates and the night |

## 5. Per client (admin API or console)

| Setting | Default | What it does |
|---|---|---|
| `kind` | — | `platform`, `mcp_client`, `import` |
| `autoProvision` | off | Create a person at the first contact of a new user |
| `rawLogScope` | `own` | Raw-log excerpts from this client's conversations only, or all |
| `disabled` | off | Every key and token of the client stops at once |
| Key scopes | — | `ingest`, `mcp`, `read`, `write` (never admin, owner settings or export) |

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

## 8b. Connectors (`connectors/`, each README has the full list)

| Connector | Where | Main settings |
|---|---|---|
| Claude Code | plugin options (`url`, `token` in the keychain); or `RECORDARE_URL` / `RECORDARE_TOKEN`, or `~/.config/recordare/claude-code.json` (hooks only) | A personal token with the scopes `mcp`, `ingest`, `read` |
| Codex | `install.sh --url … [--trust]` → `~/.config/recordare/codex.json`, `$CODEX_HOME/hooks.json` and `config.toml` | `RECORDARE_URL`, `RECORDARE_TOKEN`, `RECORDARE_TRUST_HOOKS=1` (= `--trust`), `CODEX_HOME` (default `~/.codex`) |
| OpenClaw | plugin options | `url`, `apiKey` (default `RECORDARE_URL` / `RECORDARE_API_KEY`), `memoryPer` (`agent` (D50) \| `user`), `defaultUser` (the agent's account with a client key), `selfSenders` (the account holder's senders), `users` (`memoryPer: user`), `autoRecall` (on), `capture` (on), `tools` (on), `groups` (on), `timeoutMs` (3000) |
| Hermes Agent | env or `memory.recordare.*` | `RECORDARE_URL`, `RECORDARE_API_KEY`, `RECORDARE_MEMORY_PER` (`agent` (D50) \| `user`), `RECORDARE_USER` (the agent's account with a client key), `RECORDARE_SELF_IDS` (the account holder), `RECORDARE_USER_ALIASES`, `RECORDARE_RECALL` / `_TOOLS` / `_CAPTURE` (on), `RECORDARE_TIMEOUT` (3 s) |
| OpenAI-compatible memory proxy | env | `UPSTREAM_BASE_URL`, `UPSTREAM_API_KEY`, `PROXY_API_KEY`, `RECORDARE_URL`, `RECORDARE_API_KEY`, `MEMORY_PER` (`instance` (D50) \| `workspace` \| `user`), `RECORDARE_USER` (the proxy's account with a client key), `SELF_USERS` (the account holder), `RESOLVERS`, `USER_MAP`, `USER_MAP_ONLY`, `DEFAULT_USER`, `OPENWEBUI_JWT_SECRET`, `RECALL_TIMEOUT_MS` (1500), `END_IDLE_SECONDS` (0 = Recordare's idle delay), `SKIP_PATTERNS`, `RECALL` / `CAPTURE` (on), `LOG_UPSTREAM` (off), `PORT` (8788), `MAX_BODY_BYTES` (25 MB), `TZ` |

## 9. Evaluation spike (`spikes/memory-eval/.env`)

`LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` (answer and judge), `ENGINE_MODEL`, `ENGINE_NO_THINKING`, `EMBED_MODEL`,
`EVAL_DATASET`, `RECORDARE_URL` / `RECORDARE_ADMIN_KEY` / `RECORDARE_DB_URL` (service system), `CONSOLIDATE`,
`AGENT_SYSTEM_FILE` (agent mode: a real agent's prompt), `REASONING_OFF_BODY`, `OPEN_ROUTER_API_KEY`. Spike runs cost
money: the evaluation budget rules in `WORK_PLAN.md` apply.
