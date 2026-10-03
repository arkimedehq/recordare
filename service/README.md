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

`LLM_PROVIDER=openai-compatible` with `LLM_PROFILE` = `deepseek` | `openai` | `ollama` | `vllm` |
`generic` (or `LLM_PROFILE_JSON` for any other server), or `LLM_PROVIDER=anthropic` with
`LLM_PROFILE=anthropic`. The model is always `LLM_MODEL` (optional `LLM_LIGHT_MODEL` for light tasks).
