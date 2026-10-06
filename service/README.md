# Recordare service

NestJS service implementing `docs/API.md` and `docs/DATA_MODEL.md` (v1 home / research profile, D33).

## Development

```bash
docker compose up -d db redis          # from the repository root (Postgres :5433, Redis :6380)
cd service && cp .env.example .env     # set ADMIN_API_KEY, LLM_* and EMBEDDING_*
npm install
npm run build && npm run migration:run # needs DATABASE_URL and EMBEDDING_DIM in the environment
npm run start:dev                      # SWC + watch
```

Checks: `npm run typecheck`, `npm run lint`, `npm test` (integration tests use the
`recordare_test` database of the compose `db`).

## Layout

| Path | What |
|---|---|
| `src/config` | Environment schema (zod), validated at startup |
| `src/db` | Data source, migrations (explicit SQL: enums, HNSW / GIN / partial indexes) |
| `src/llm` | `LlmPort` + OpenAI-compatible and native Anthropic adapters, provider profiles (D27), per-call accounting |
| `src/embedding`, `src/clock` | Embedding port (any OpenAI-compatible server), clock port |
| `src/auth`, `src/admin`, `src/me` | Client API keys, personal tokens, admin API, owner resolution |
| `src/identity` | Identity entities |

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
| `FACTS` | separate facts-and-notes pass, only with `FACTS_PASS=separate` (off in every profile) | measured with DeepSeek V4 Pro: no gain over the inline extraction — keep it off |

Engine models are supported at ≥ 95 % on the suite or as the best measured; see RESULTS.md for the full matrix
(premium models such as Claude Sonnet 5.5 did not answer better; DeepSeek V4 Pro extracts facts and notes best —
a candidate for a future facts / consolidation task).
