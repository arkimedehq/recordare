# Recordare service

NestJS service implementing `docs/API.md` and `docs/DATA_MODEL.md` (v1 home / research profile, D33). Status
(2026-10-07): ingest, engine, consolidation, MCP tools, admin API and telemetry built; the read API (`API.md` §4) and
the client library are not built yet (`docs/WORK_PLAN.md`). Client guide: `docs/INTEGRATION.md`; deployment:
`docs/DEPLOYMENT.md`.

## Development

```bash
docker compose up -d db redis          # from the repository root (Postgres :5433, Redis :6380)
cd service && cp .env.example .env     # set ADMIN_API_KEY, LLM_* and EMBEDDING_*
npm install
npm run build && npm run migration:run # needs DATABASE_URL and EMBEDDING_DIM in the environment
npm run start:dev                      # SWC + watch
```

Checks — run all three before every commit (CI runs them): `npm run typecheck`, `npm run lint`, `npm test`
(integration tests use the `recordare_test` database of the compose `db`).

## Layout

| Path | What |
|---|---|
| `src/config` | Environment schema (zod), validated at startup |
| `src/db` | Data source, migrations (explicit SQL: enums, HNSW / GIN / partial indexes) |
| `src/llm` | `LlmPort` + OpenAI-compatible and native Anthropic adapters, provider profiles (D27), per-call accounting |
| `src/embedding`, `src/clock` | Embedding port (any OpenAI-compatible server), clock port |
| `src/auth`, `src/admin`, `src/me` | Client API keys, personal tokens, admin API, owner resolution, viewer context; `GET / PATCH api/v1/me` |
| `src/identity` | Identity entities |
| `src/rawlog` | Layer 0: REST ingest (idempotent, consent-gated), edits and purges, raw-log search (full-text + vector) |
| `src/queue` | BullMQ: debounced idle extraction jobs, message embeddings, hourly consolidation sweep |
| `src/engine` | Extraction (one call per window, writer with lifecycle rules and the recall-echo guard), near-duplicate / correction resolver, quality profiles, nightly consolidation (digests), facts review |
| `src/recall` | `search_episodes`, `search_memory`, period resolver (IT/EN), people-aware recall, explicit writes and forgetting, recall log |
| `src/mcp` | MCP server at `/mcp` (streamable HTTP): the tools of `docs/API.md` §3 |
| `src/telemetry`, `src/atlas` | Live event stream for operators (SSE) and the atlas snapshot — contract `docs/ATLAS_EVENTS.md` |

## Choosing an LLM provider (D27)

`LLM_PROVIDER=openai-compatible` with `LLM_PROFILE` = `deepseek` | `openai` | `openrouter` | `ollama` | `vllm` |
`generic` (or `LLM_PROFILE_JSON` for any other server), or `LLM_PROVIDER=anthropic` with
`LLM_PROFILE=anthropic`. `LLM_MODEL` is the default model of every task.

**One model per task.** Each LLM task can have its own model and, if needed, its own provider:
`LLM_<TASK>_MODEL`, `LLM_<TASK>_PROVIDER`, `LLM_<TASK>_PROFILE`, `LLM_<TASK>_PROFILE_JSON`, `LLM_<TASK>_BASE_URL`,
`LLM_<TASK>_API_KEY` (unset → the `LLM_*` default). Tasks:

| Task | What it does | Recommended (measured, `spikes/memory-eval/RESULTS.md`) |
|---|---|---|
| `EXTRACT` | episodes, plans, facts and notes from a conversation window (one call per window) | `deepseek-flash`, reasoning off — best answers (91 % blind5) and best plan outcomes, cheapest with prefix caching |
| `EXTRACT_ECONOMY` | the same for owners on the `economy` profile | `deepseek-flash` (no cheaper model measured reached it: Gemini 3.1 Flash-Lite 81 %, Qwen 3.7 Flash 78.5 %) |
| `RESOLVE` | near-duplicate / correction check on short pairs (only when candidates exist) | `deepseek-flash` (a light model is enough; cheaper ones not yet measured on this task) |
| `DIGEST` | nightly consolidation (M5): the diary of each changed day and month | `deepseek-flash` (to be measured) |
| `FACTS` | the nightly facts review (knob `factsReview` / `FACTS_REVIEW`) and the separate facts-and-notes pass (`FACTS_PASS=separate`) — both off in every profile | both measured with no gain on facts (DeepSeek V4 Pro for the pass, blind5 for the review) — keep them off |

Engine models are supported at ≥ 95 % on the suite or as the best measured; see RESULTS.md for the full matrix
(premium models such as Claude Sonnet 5.5 did not answer better; DeepSeek V4 Pro extracts facts and notes best —
a candidate for a future facts / consolidation task).
