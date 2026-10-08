# Atlas events — contract v1

The contract between Recordare and any live viewer of it — first of all **Recordare Atlas**
(`arkimedehq/recordare-atlas`, optional, WORK_PLAN 5b.7). Recordare works the same with no viewer attached.

**Rules.** Every event mirrors one real step inside the service, emitted as it happens; nothing is synthesised.
**Metadata only**: ids, kinds, counts, tokens, durations — never message, memory, query or prompt text. Admin access
only. Each event carries `v` (contract version) and `at` (ISO time). **Versioning**: new event types and new fields
are additive and keep `v`; removing or changing the meaning of a field raises it. A viewer ignores types it does not
know.

## Endpoints (admin key; read-only)

| Endpoint | What |
|---|---|
| `GET api/v1/admin/owners` | People list: `id, name, episodes, lastActivity` (most recent first, max 200) |
| `GET api/v1/admin/owners/:id/atlas` | Snapshot of one person: episodes (kind, author role, importance, day, plan status, hidden state, `xyz` position by meaning), real edges (`similar`, `corrects`, `duplicate`, `outcome`, `rescheduled`, `people`), facts / notes / digests (ids and kinds), lifetime `totals` (LLM calls, input / output tokens, recalls) |
| `GET api/v1/admin/telemetry/stream[?owner=<id>]` | Server-Sent Events, one per step below (`event:` = type, `data:` = JSON) |

## Events

| Type | Fields (besides `v`, `at`, `ownerId`) | Emitted when |
|---|---|---|
| `message.ingested` | `conversationId`, `messages`, `roles` (count per role) | messages stored by ingest |
| `extraction.started` / `extraction.finished` | `runId`, `conversationId`, `messages` / `status` (`done`, `failed`, `skipped`), `written` | one extraction window starts / ends |
| `llm.started` | `runId`, `promptId`, `task` (`extract`, `extract_economy`, `resolve`, `facts`, `digest`) | an LLM call leaves |
| `llm.call` | `runId`, `promptId`, `model`, `inputTokens`, `cachedInputTokens`, `outputTokens`, `latencyMs`, `status` | the call came back (or failed) |
| `work.started` / `work.finished` | `op` (`embed.messages`, `context`, `embed.memories`, `recall`, `consolidation`), `id` (pairs them) / `ms` | work without an LLM call starts / ends |
| `memory.written` | `runId`, `table` (`episodes`, `facts`, `notes`), `id`, `kind`, `authorRole`, `importance`, `corrects` | a memory row written |
| `episode.linked` | `relation` (`duplicate`, `corrects`), `from`, `to` | the resolver linked two episodes |
| `recall.served` | `tool` (an MCP tool, or `memory_context` for the pre-turn block, only when it is not empty), `mode`, `episodeIds`, `claimIds`, `chats`, `digests`, `facts`, `notes` | a recall answered |
| `digest.written` | `level` (`day`, `month`), `period`, `sources` | a nightly diary written |
| `consolidation.finished` | `days`, `months`, `llmCalls`, `failed` | an owner's consolidation ends |
| `episode.forgotten` | `ids` | episodes forgotten |

Client platforms (agents, their LLM calls, tools) reach the atlas on their own channel — OpenTelemetry GenAI traces —
not through this stream (WORK_PLAN 5b.8).
