# Research: an OpenClaw connector for Recordare

Status: research note, 2026-10-08. Sources were read from the published packages, not only from web pages:
`openclaw@2026.9.9` (npm `latest`, GitHub release [v2026.9.9](https://github.com/openclaw/openclaw/releases/tag/v2026.9.9),
2026-10-08; `beta` = 2026.10.1-beta.2), `@openclaw/memory-lancedb@2026.9.9` and `@honcho-ai/openclaw-honcho@1.7.0`
(unpacked with `npm pack`, nothing installed). The docs paths below are under
[docs.openclaw.ai](https://docs.openclaw.ai) (also shipped in the npm package under `docs/`).

## 0. What OpenClaw is today
- Official repo: [github.com/openclaw/openclaw](https://github.com/openclaw/openclaw), TypeScript, **MIT**
  ("Copyright (c) 2026 OpenClaw Foundation"). Docs: [docs.openclaw.ai](https://docs.openclaw.ai)
  (index for LLMs: [llms.txt](https://docs.openclaw.ai/llms.txt)). Versions are calendar-based (`2026.9.9`).
- Names over time: Warelay → CLAWDIS → Clawdbot (Jan 2026) → Moltbot (27 Jan 2026) → OpenClaw (30 Jan 2026)
  ([Wikipedia](https://en.wikipedia.org/wiki/OpenClaw), [docs: lore](https://docs2.openclaw.ai/start/lore)).
- Architecture: a long-running **Gateway** (Node ≥ 24.16 or ≥ 26.1, from `package.json` `engines`) that owns
  sessions and channels (Telegram, WhatsApp, Slack, Discord, iMessage, Control UI…), runs the agent
  (an embedded runner, or Codex / Copilot / CLI harnesses), and loads **native plugins in-process**.

## 1. Extension mechanisms

| Mechanism | What it is | Use for Recordare |
| --- | --- | --- |
| Native plugin (`openclaw.plugin.json` + TS/JS entry) | In-process module; registers hooks, tools, services, CLI commands, MCP resolvers ([building plugins](https://docs.openclaw.ai/plugins/building-plugins), [SDK overview](https://docs.openclaw.ai/plugins/sdk-overview)) | **Yes: the connector** |
| Typed plugin hooks `api.on(name, handler)` | ~40 lifecycle hooks ([hooks](https://docs.openclaw.ai/plugins/hooks), [hook reference](https://docs.openclaw.ai/plugins/hooks/reference)) | capture + recall |
| Memory slot `plugins.slots.memory` | Exactly one plugin of `kind: "memory"` owns it (default: bundled `memory-core`, Markdown `MEMORY.md` + `memory_search`); claiming it disables the previous owner | **No** (see §5) |
| Context-engine slot `plugins.slots.contextEngine` | Replaces history assembly / compaction ([context engine](https://docs.openclaw.ai/concepts/context-engine)) | No |
| Skills (`SKILL.md`) | Prompt-level instructions, no code | Optional, later |
| Internal hooks (`HOOK.md`, `command:new`…) | Operator scripts on commands | No |
| MCP client (`mcp.servers`) | Native, see §2 | Possible, but see §2 |

### Hooks relevant here (types from `dist/*.d.ts` of 2026.9.9)
Handlers get `(event, ctx)`; `ctx: PluginHookAgentContext` (§3).

- `before_prompt_build` — **recall**. Event `{ prompt: string; currentUserMessage?: string; currentUserMessageId?: string; messages: unknown[] }`.
  Returns `{ prependContext?, appendContext?, prependSystemContext?, appendSystemContext?, systemPrompt?, toolsAllow? }`.
  15 s default budget. `currentUserMessage` is the current request *before* history/envelope projection (empty string =
  no text, e.g. image-only); `currentUserMessageId` is stable across retries of one admitted request. Registering with
  `{ requiresToolAuthority: true }` runs it after tool policy is final and gives `ctx.toolAuthority.allows(tool)`
  ([prompt and session hooks](https://docs.openclaw.ai/plugins/hooks/prompt-and-session)).
- `agent_end` — **capture**. Event `{ runId?: string; messages: unknown[]; success: boolean; error?: string; durationMs?: number }`
  (the whole in-memory transcript of the session, not just the turn). Observation only, fire-and-forget on channel
  paths, 30 s default per-handler timeout. Incognito sessions get empty `messages`.
- `session_end` — event `{ sessionId; sessionKey?; messageCount; reason?: "new"|"reset"|"idle"|"daily"|"compaction"|"deleted"|"shutdown"|"restart"|"unknown"; nextSessionId?; nextSessionKey? }`
  → map to `hints.conversationEnded`. Shutdown/restart share a 2 s total drain budget.
- `message_received` — every inbound channel message (`content`, `senderId`, `messageId`, `timestamp`, `threadId`,
  `sessionKey`, `runId`, media, metadata; ctx `{ channelId, accountId?, conversationId?, sessionKey?, runId? }`).
  Fires also for group messages that do not trigger the agent (mention-gated), so it is the hook for other
  participants' messages.
- `message_sent` — outbound delivery result (`content`, `success`, `sessionKey`).
- Older `before_agent_start` is "compatibility-only"; new plugins use `before_model_resolve` + `before_prompt_build`.

**Permission gate**: non-bundled plugins need `plugins.entries.<id>.hooks.allowConversationAccess: true` for
`before_prompt_build`, `agent_end`, `llm_input/output`, `before_agent_run`…; prompt hooks are also blocked by
`allowPromptInjection: false` ([hooks → permissions](https://docs.openclaw.ai/plugins/hooks#permissions-and-scope)).
Runtime caveat: `agent_turn_prepare` and queued injections are not wired into Codex/Copilot harnesses;
`before_prompt_build` is supported by embedded, CLI, Copilot and Codex runtimes.

### Packaging, configuration, install
- Files: `package.json` with an `openclaw` block, `openclaw.plugin.json` (manifest, **required**: `id`, `configSchema`
  as inline JSON Schema; tools must be declared statically in `contracts.tools`), entry module exporting
  `definePluginEntry({ id, name, description, kind?, configSchema?, register(api) })` from
  `openclaw/plugin-sdk/plugin-entry` ([manifest](https://docs.openclaw.ai/plugins/manifest),
  [entry points](https://docs.openclaw.ai/plugins/sdk-entrypoints)).
- `package.json` `openclaw`: `extensions: ["./index.ts"]` (source, fine for local loads) or `runtimeExtensions:
  ["./dist/index.js"]` (published builds), `compat.pluginApi: ">=2026.x"`, `install.minHostVersion`;
  `peerDependencies: { openclaw: ">=…" }`.
- Config lives in `openclaw.json` (JSON5) under `plugins.entries.<id>.{enabled, config, hooks}`; the plugin reads
  `api.pluginConfig` inside `register`. Editing config hot-reloads (re-runs `register`).
- Install: `openclaw plugins install <spec>` with `clawhub:<pkg>`, `npm:<pkg>` (or bare npm name), `git:github.com/o/r@tag`,
  a local directory/archive, or `--link ./dir --force` for development; then `openclaw plugins enable <id>`,
  `openclaw plugins inspect <id> --runtime --json`, `openclaw plugins reload <id>`
  ([CLI plugins](https://docs.openclaw.ai/cli/plugins), [manage plugins](https://docs.openclaw.ai/plugins/manage-plugins)).
  Distribution: npm and/or [ClawHub](https://docs.openclaw.ai/plugins/community).

### Example 1 — `@openclaw/memory-lancedb` (official, external, MIT, monorepo `extensions/memory-lancedb/`)
Layout (published): `openclaw.plugin.json` (`id: memory-lancedb`, `kind: "memory"`, `contracts.tools:
[memory_forget, memory_recall, memory_store]`, `uiHints`, `activation.onCommands: ["ltm"]`), `package.json`
(`openclaw.extensions`, `runtimeExtensions`, `compat.pluginApi: ">=2026.9.9"`), `dist/index.js` (entry),
`auto-recall.js`, `config.js`, `embeddings.js`, `lancedb-store.js`, `memory-capture-sanitization.js`, `memory-cli.js`.
Entry (`index.ts`): `api.registerMemoryCapability?.(…)`, three `api.registerTool((ctx) => ({ name, parameters, execute }))`,
`api.on("before_prompt_build", autoRecall, { requiresToolAuthority: true })` returning `{ prependContext }`,
`api.on("agent_end", …)` (captures user texts, keyed by `ctx.agentId` + `ctx.sessionKey`, skips incognito),
`api.on("session_end", …)` (drops per-session cursors), `api.registerService({ id, start, stop })`.
Docs: [memory-lancedb](https://docs.openclaw.ai/plugins/memory-lancedb). Note: it keys memory **per agent**, not per person.

### Example 2 — `@honcho-ai/openclaw-honcho` 1.7.0 (closest to us: external memory service, MIT, [plastic-labs/openclaw-honcho](https://github.com/plastic-labs/openclaw-honcho))
No `kind` (does not take the memory slot). `dist/hooks/capture.js`: on `agent_end`, takes the last `role: "user"` message
and everything after it, sender = `ctx.senderId` (falls back to parsing the inbound metadata block on hosts < 2026.8),
skips cron/heartbeat/`internal_system` runs, strips OpenClaw's inbound envelope ("Conversation info (untrusted
metadata):" JSON blocks, `[Mon 2026-03-23 13:12]` timestamp prefix) before storing. `dist/hooks/context.js`: on
`before_prompt_build` fetches the per-sender user model and returns `appendSystemContext`. Maps sender ids to Honcho
peers in a local JSON file (`~/.honcho/openclaw-peers.json`). Docs: [Honcho memory](https://docs.openclaw.ai/concepts/memory-honcho).

## 2. MCP support
- **Native MCP client.** Config under `mcp.servers.<name>`; transports `stdio`, `sse`, `streamable-http`; fields `url`,
  `transport`, **`headers`** (static key/value map), `connectionTimeoutMs`, `requestTimeoutMs`, `auth: "oauth"`,
  `toolFilter.include/exclude`, `sslVerify`, mTLS ([connect MCP servers](https://docs.openclaw.ai/tools/mcp),
  [transports](https://docs.openclaw.ai/cli/mcp/transports)). CLI: `openclaw mcp add recordare --url https://…/mcp
  --transport streamable-http`, `openclaw mcp doctor recordare --probe`. Remote HTTP MCP with headers: **yes**.
  (Tools go through normal tool policy; a plugin can also ship a server via manifest `mcpServers`.)
- **Per-requester headers**: `api.registerMcpServerConnectionResolver({ serverName, resolve(ctx) → { url, headers } | null })`,
  `ctx = { requesterSenderId: string; agentAccountId?; messageChannel? }`
  ([infrastructure → requester-scoped MCP](https://docs.openclaw.ai/plugins/sdk-overview/infrastructure)).
  Limits that matter for Recordare: the resolver gets **no session/conversation**, so it cannot set
  `X-Recordare-Conversation`; runs without a trusted sender (cron, Control UI owner, CLI) never get the server; the
  resolved transport is cached and revalidated at most every 5 min. → Static/requester MCP alone cannot satisfy
  Recordare's viewer rule (INTEGRATION.md §4). Use plugin-registered tools instead (§5). *(Since D50 / WORK_PLAN 8.2
  there is no viewer rule: recall works without a conversation; MCP writes from a client key still need one, so the
  plugin tools remain the better route.)*

## 3. Identity: person, session, channel, groups
`PluginHookAgentContext` (agent hooks) has: `agentId`, `sessionKey`, `sessionId`, `runId`, `channel` /
`messageProvider` (e.g. `telegram`), `accountId`, `chatId` / `channelId` (conversation target), **`senderId`**
(channel-scoped sender id, e.g. Telegram user id; added ~2026.8 per Honcho's code comments), `channelContext.{sender,chat}.id`,
`trigger` (`user`, `cron`, `heartbeat`…), `inputProvenance.kind` (`external_user` | `inter_session` | `internal_system`).
Sender fields are **absent for system runs** (cron, heartbeat) and may be absent elsewhere.
Tool factories get `OpenClawPluginToolContext`: `agentId`, `sessionKey`, `sessionId`, `messageChannel`,
`agentAccountId`, **`requesterSenderId`**, `senderIsOwner`, `deliveryContext`.

- Session key: canonical shape `agent:<agentId>:<provider>:…` (e.g. a group/room or a DM peer). **Default
  `session.dmScope: "main"` puts all DMs of all people into one session** — a multi-person install must set
  `per-channel-peer` (or `per-peer`) ([session management](https://docs.openclaw.ai/concepts/session)).
  `session.identityLinks` maps one person's identities across channels to one peer for routing; Gateway **profiles**
  can be linked to channel senders by an admin (`users.linkChannelIdentity`, [user model](https://docs.openclaw.ai/concepts/user-model)),
  but the hook context exposes no profile id (only `requesterProfileId` in some internal types) — not usable yet.
- Groups: isolated per group by default (`session.groupScope: "per-group"`). Each turn has one `senderId`; inbound
  group payloads carry `ChatType=group`, `GroupSubject`, `GroupMembers` (if known), `WasMentioned`
  ([groups](https://docs.openclaw.ai/channels/groups)) — these are prompt template fields; **not verified** whether they
  reach plugin hooks. Other members' messages are observable through `message_received` (each with its `senderId`).
- Control UI / CLI / OpenAI-compatible HTTP turns are owner/operator turns ([OpenAI HTTP API](https://docs.openclaw.ai/gateway/openai-http-api)
  "treats chat turns as owner-sender turns"); whether `senderId` is set there is **not verified** → the plugin needs a
  configured fallback person.

## 4. Licences
- OpenClaw: **MIT** (repo and npm package; `THIRD_PARTY_NOTICES.md` included). `@openclaw/memory-lancedb`: same repo,
  MIT. `openclaw-honcho`: **MIT** (Plastic Labs). All AGPL-3.0-compatible: code may be reused with the MIT notice
  recorded in `THIRD_PARTY_NOTICES.md` at the moment of reuse (e.g. Honcho's envelope-stripping / turn-boundary helpers).
- The plugin imports `openclaw/plugin-sdk/*` (MIT) and our `@arkimedehq/recordare-client` (AGPL-3.0-or-later). An
  AGPL plugin loaded in an MIT host is fine licence-wise; whether to publish the plugin under AGPL or a permissive
  licence (adoption on ClawHub) is the owner's call — note the client library is AGPL, so a permissive plugin
  could not bundle it.

## 5. Proposed minimal design: `@arkimedehq/openclaw-recordare` (plugin id `recordare`)
Choices: no `kind: "memory"` (leave `memory-core` / `MEMORY.md` alone, like Honcho; D34 spirit); capture via
`before_prompt_build` + `agent_end`; recall both as an injected block and as tools; Recordare MCP called through
`packages/client` (`RecordareMcp`) with per-call headers, not via `mcp.servers`.

```
packages/openclaw-recordare/
  package.json            # openclaw.extensions ["./src/index.ts"], runtimeExtensions ["./dist/index.js"],
                          # compat.pluginApi ">=2026.9.9", peerDependencies openclaw, dep @arkimedehq/recordare-client
  openclaw.plugin.json    # id "recordare", categories ["memory"], activation.onStartup true,
                          # contracts.tools [recordare_search_memory, recordare_search_episodes, recordare_resolve_period,
                          #   recordare_remember, recordare_correct_episode, recordare_forget_episode], configSchema, uiHints (apiKey sensitive)
  src/index.ts            # definePluginEntry: hooks + tools + service (outbox flush)
  src/identity.ts         # ctx → { user, conversationId, participants } ; skip rules
  src/transcript.ts       # text of AgentMessage content blocks; strip inbound envelope (ported from Honcho, MIT notice)
  src/outbox.ts           # small durable queue (JSONL/SQLite in api.resolvePath(stateDir)), retry with back-off
  test/                   # vitest with a fake api + fetch mock; conformance against a dev Recordare
```

Config (`plugins.entries.recordare.config`):
`url` (required), `apiKey` (client key, scopes ingest+mcp+read; `${ENV}` expansion), `users` (map
`"<channel>:<senderId>"` → Recordare user id; default `"<channel>:<senderId>"` verbatim, relying on Recordare
`autoProvision`), `defaultUser` (for turns without a sender: Control UI, CLI, owner), `capture` (bool, default true),
`autoRecall` (`"off" | "context" `, default `"context"`), `tools` (bool, default true), `groups`
(`"off" | "mapped"`, default `"mapped"`: ingest group turns only for senders in `users`), `captureSystemRuns` (default false).
Also required in `openclaw.json`: `plugins.entries.recordare.hooks.allowConversationAccess: true`; for several people,
`session.dmScope: "per-channel-peer"`.

Hooks and flow:
1. `before_prompt_build` (ordinary phase): resolve `user` from `ctx.channel`/`ctx.senderId` (else `defaultUser`, else
   skip); skip incognito (`isIncognitoSessionKey` from `openclaw/plugin-sdk/routing`), cron/heartbeat/`internal_system`.
   Stash `{ text: event.currentUserMessage, id: event.currentUserMessageId ?? runId, at: now, user }` by `ctx.runId`.
   If `autoRecall`: `POST api/v1/context {query: currentUserMessage}` with `X-Recordare-User` and
   `X-Recordare-Conversation: <sessionKey>`, timeout ~3 s, return `{ prependContext: block }` (dynamic text belongs in
   the user-side context; `appendSystemContext` would break prompt caching every turn — measure before choosing).
2. `agent_end` (if `success`): take the stashed user text (fallback: last `role:"user"` message, envelope stripped) and the
   last `role:"assistant"` text blocks; enqueue `POST api/v1/ingest/messages` with
   `conversation: { externalId: sessionKey, channel: ctx.channel, participants: [owner ref → user, assistant ref → agentId] }`,
   messages `externalId` = `<currentUserMessageId|runId>:u` / `<runId>:a`, `sentAt` ISO. Outbox: never block the turn.
   Tool results (`toolResult` role) optional later (D30: `role: "tool"`).
3. `message_received` (groups, `groups: "mapped"`): buffer non-agent messages of the group with `role: "other"` and
   `authorRef = senderId` so the next ingest carries them; participants grow as senders appear.
4. `session_end` (reason ≠ `compaction`): send `hints.conversationEnded: true` for that `sessionKey`.
5. Tools: `api.registerTool((ctx) => …)` for each declared `recordare_*` tool; `execute` calls Recordare MCP via
   `RecordareMcp` with `X-Recordare-User` from `ctx.requesterSenderId`/`messageChannel` (or `defaultUser`) and
   `X-Recordare-Conversation: ctx.sessionKey`; return `null` from the factory when no user resolves. No `log_episode`
   (as in Arkimede). Schemas: copy Recordare's MCP input schemas at build time (manifest must list names statically).
6. `api.registerService({ start, stop })`: start/stop the outbox flusher; `stop` drains with a bound.

Consent: `GET api/v1/me` → `episodicEnabled`; if false, do not buffer (INTEGRATION.md §2), log once per user.

### Local test / smoke test
- Node: OpenClaw needs **Node ≥ 24.16** (this Mac has v20.19) → use Docker or a project-local Node 24.
- Docker: official images `ghcr.io/openclaw/openclaw:<version>` (mirror `openclaw/openclaw`; tags `2026.9.9`, `latest`,
  `slim`); repo `docker compose` with `openclaw-gateway` + `openclaw-cli` services
  ([Docker install](https://docs.openclaw.ai/install/docker)). Mount the plugin dir and run
  `openclaw plugins install --link /plugins/recordare --force`.
- Headless turns: `openclaw agent exec "…" --json [--config <file>] [--state-dir <dir>]` runs one embedded turn without
  a Gateway (temp state, uses installed plugins, exit 0/1/2), or `openclaw agent --local --agent main --message "…" --json`;
  Gateway-backed `openclaw agent --session-key … --message …` keeps one session across calls
  ([agent CLI](https://docs.openclaw.ai/cli/agent)). LLM: DeepSeek via `@openclaw/deepseek-provider` + `DEEPSEEK_API_KEY`,
  or the bundled Ollama provider.
- Script: (1) start Recordare dev + a test person with `episodicEnabled`; (2) two `agent` turns in one session key
  ("my sister is called Giulia", then a filler); (3) assert `ingest` rows for the conversation (`externalId` = session key);
  (4) after extraction, a new session asks "what is my sister called?" → assert the recall block was injected
  (`openclaw plugins inspect recordare --runtime --json`, gateway logs) and the answer. Per-sender identity cannot be
  exercised from the CLI (no `senderId`, uses `defaultUser`); a real channel (a Telegram test bot) or the
  [OpenAI-compatible HTTP endpoint](https://docs.openclaw.ai/gateway/openai-http-api) is needed — unverified which
  sender id the latter yields.

## Not verified
- Exact shape of `agent_end` `messages` items (we saw `role` + `content` string or `[{type:"text",text}]` in Honcho's
  parser; a per-message `timestamp` field is likely but unconfirmed).
- Whether `GroupMembers` / chat type reach plugin hook contexts; whether `senderId` is set for Control UI / HTTP API turns.
- Hook behaviour on the Codex app-server harness beyond what the docs state (we assume the default embedded runner).
- `registerMcpServerConnectionResolver` and `before_prompt_build` were read in docs/types only, not run.
- Nothing was executed: no OpenClaw instance was started.
