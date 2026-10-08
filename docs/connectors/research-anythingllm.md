# Research: a full Recordare connector for AnythingLLM

Status: research note, 2026-10-08. Not a contract; no code yet.
Sources: AnythingLLM source at `master` commit `3c7e73b` (2026-10-06), latest release
[v1.17.0](https://github.com/Mintplex-Labs/anything-llm/releases/tag/v1.17.0) (published 2026-10-01), read locally
(shallow clone, nothing installed or run), plus the official docs. File paths below are relative to the
[repo root](https://github.com/Mintplex-Labs/anything-llm). **Nothing here was run against a live instance**: the
behaviour is read from code and must be confirmed by the smoke test in §5.

## 1. Extension points (v1.17.0)

| Point | What it gives us | Limits |
|---|---|---|
| **MCP** (`storage/plugins/anythingllm_mcp_servers.json`, [docs](https://docs.anythingllm.com/mcp-compatibility/overview)) | Recordare tools to the model. Transports: stdio, `sse`, `streamable` / `http` (`server/utils/MCP/hypervisor/index.js` → `createHttpTransport`, official MCP SDK `StreamableHTTPClientTransport`). Optional `headers` object; AnythingLLM-only `anythingllm.autoStart` and `suppressedTools`. | Agents only ("MCP tools for use with AI Agents"). **Headers are static** per server: one `X-Recordare-User` (or one personal token) for the whole instance, so per-user identity is impossible over MCP. No `X-Recordare-Conversation` either. |
| **Agent mode reach** | Since the `automatic` chat mode (now the default for new workspaces, `models/workspace.js`), every UI chat goes through the agent path *if the provider supports native tool calling* (`server/utils/chats/agents.js` → `Workspace.supportsNativeToolCalling`); for most providers that is on by default, opt-out with `PROVIDER_DISABLE_NATIVE_TOOL_CALLING`. Otherwise the user must type `@agent`. | Workspaces set to `chat` / `query`, the embed widget (`automatic` → `chat`, `utils/chats/embed.js`) and the OpenAI-compatible endpoint never use tools. |
| **Custom agent skills** (`storage/plugins/agent-skills/<hubId>/plugin.json` + `handler.js`, [docs](https://docs.anythingllm.com/agent/custom/introduction)) | In-process JS tool; `this.super` is the aibitat instance, whose `handlerProps.invocation` carries `user_id`, `workspace_id`, `thread_id` (`server/utils/agents/imported.js`, `aibitat/plugins/chat-history.js`). So a skill *can* call Recordare with the real user. | Runs only when the model decides to call it (a tool, not a hook); same agent-only reach as MCP. `invocation` is internal, not a documented API (could change). |
| **Agent Flows** (`server/utils/agentFlows/`) | No-code tool chains: `apiCall`, `llmInstruction`, `webScraping` blocks. | Also tools invoked by the agent; no trigger on chat events. |
| **Developer API** (`/api/v1/*`, API key, Swagger at `/api/docs`) | `GET /v1/workspace/{slug}/chats` (default thread only, filters `thread_id: null`; returns `{role, content, sentAt}` with no ids, no user), `GET /v1/workspace/{slug}/thread/{threadSlug}/chats`, **`POST /v1/admin/workspace-chats`** `{offset}` → raw rows (`id`, `workspaceId`, `prompt`, `response` JSON, `user_id`, `thread_id`, `api_session_id`, `createdAt`, plus `workspace.slug`, `user.username`), 20 per page, newest first; documented as "disabled until multi user mode is enabled". Chat endpoints: `/v1/workspace/{slug}/chat`, `/stream-chat`, thread `new` / `chat` with `userId`. Admin user endpoints (`/v1/admin/users`). | No webhooks, no event stream, no "since" cursor (page by offset and stop at the last seen `id`). The API key is instance-wide (admin power). |
| **Embed widget** (`/v1/embed`, `embed_chats` table) | Public chat bubble per workspace; chats readable via `GET /v1/embed/{embedUuid}/chats` (session-scoped). | Anonymous visitors (session id only): not a person Recordare should remember (D33 keeps us off public profiles). |
| **System prompt variables** (`server/models/systemPromptVariables.js`) | `{user.id}`, `{user.name}`, `{user.bio}`, `{workspace.id}`, `{workspace.name}`, date/time, plus admin-defined static ones; expanded in the workspace system prompt for normal chat (`utils/chats/index.js` → `chatPrompt`) and agent chat (`aibitat/providers/ai-provider.js` → `systemPrompt`). | No thread id variable. Unknown user (single-user mode, embed, API without `userId`) expands to the literal placeholder `[User ID]`. |
| **Built-in memory** (new: `server/utils/memories/`, `jobs/extract-memories.js`, `memories` table) | AnythingLLM now has its own per-user global + workspace memories, extracted by an idle/background observer-reflector job and appended to the system prompt. | Overlaps Recordare: recommend turning it off in the connector setup to avoid two memories feeding the same prompt (and AnythingLLM's extractor calls going through our proxy, see §2). |

Other: Telegram bot (`utils/telegramBot`) and scheduled jobs exist; neither is a hook on chat messages. I found **no
webhook / event subscription** in the code (searched `webhook`, `EventEmitter`, hooks).

## 2. A hook on every message in normal chat?

There is none. Viable options:

### (i) OpenAI-compatible proxy as the "Generic OpenAI" provider — recommended for capture + injection
AnythingLLM's `GenericOpenAiLLM` (`server/utils/AiProviders/genericOpenAi/index.js`) and the agent provider
(`utils/agents/aibitat/providers/genericOpenAi.js`) call `GENERIC_OPEN_AI_BASE_PATH` with `GENERIC_OPEN_AI_API_KEY`,
the AnythingLLM `User-Agent` and **static** `GENERIC_OPEN_AI_CUSTOM_HEADERS` (`"Name:value,Name2:value2"`).

Identity: **none is forwarded.** `streamGetChatCompletion(messages, {user})` receives the user but Generic OpenAI
ignores it (only OpenRouter sets the OpenAI `user` field, as `user_${id}`). No workspace / thread header either.
Workaround that does work from code: put a marker in the workspace system prompt using the prompt variables, e.g.
`[[recordare user={user.id} ws={workspace.id}]]`. It is expanded server-side in both chat and agent paths, so the proxy
reads it from the **first `system` message only** (never from user text, which the user controls), strips it, and maps
the AnythingLLM user id → `X-Recordare-User` (via a mapping table, or `{user.name}` if usernames are the external ids).
Spoofing: only admins / managers can edit workspace prompts; a request without a valid marker (embed widget, single-user
`[User ID]`, AnythingLLM's own memory-extraction, title, router-classifier calls) is passed through untouched — or, in
single-user mode, mapped to one configured owner.

Per request the proxy: (1) `POST /api/v1/context {query: last user message}` → appends the `<memory-context>` block to
the system message; (2) forwards (stream or not) to the real provider, teeing the SSE stream; (3) after completion,
ingests the last user message + final assistant text. Agent loops make several calls per turn: ingest only the final
call (no `tool_calls` in the reply), optionally tool calls as `role: "tool"` (D30); dedupe by
`externalId = hash(user, ws, user-message text, timestamp bucket)`.

Gaps: no thread id → conversation externalId must be synthesised (e.g. `anythingllm:{ws}:{user}:{day}` or a hash of
the first user message in `messages`); no message ids, so edits / regenerations / `/reset` deletions are invisible
(a regenerate looks like a second assistant reply to the same user text → use `upsert`). The prompt the proxy sees is
already compressed / truncated by AnythingLLM and carries RAG context in the system message, which must not be ingested.
Reliability: high for capture (the proxy is in the request path; if Recordare is down it must still forward and queue
the ingest), but it changes the LLM provider choice — the real provider moves into the proxy config, and AnythingLLM's
native provider features (e.g. per-provider model lists, the model router) are lost or must be proxied.

### (ii) Polling the developer API — recommended for capture when the provider must stay native
`POST /v1/admin/workspace-chats` gives every chat (normal, agent, threads, API sessions) with `id`, `user_id`,
`thread_id`, `workspaceId`, `createdAt` — exactly what ingest needs: conversation
`externalId = anythingllm:{workspaceId}:{thread_id ?? "default"}:{user_id}`, message `externalId = chat:{id}:user|assistant`,
`X-Recordare-User` from `user_id` (or `user.username`). Cursor = highest `id` seen. Agent turns are first saved with
`include: false` and an empty response, then upserted (`chat-history.js`): read only rows with `include: true` and a
non-empty `response.text`, and treat later changes with `upsert`. Downsides: latency = poll interval; deletions/resets
are not signalled (rows with `include: false` after a reset could be diffed but not cheaply); requires multi-user mode
(per the endpoint doc; in single-user mode use the per-workspace/per-thread endpoints, no user id needed); instance-wide
admin API key held by the connector. No injection: recall must come from MCP or the proxy.

### (iii) MCP in agent mode only
Gives recall tools (and `remember` etc.) with zero AnythingLLM changes, but static headers ⇒ one Recordare owner per
AnythingLLM instance; no automatic capture (the model would have to call a tool). Fine for a single-user desktop
install, not for multi-user.

| | Capture | Injection | Per-user identity | Thread id | Provider unchanged |
|---|---|---|---|---|---|
| (i) proxy | every turn incl. agent | yes, every turn | via system-prompt marker | no (synthesised) | no |
| (ii) polling | every saved turn | no | yes (`user_id`) | yes | yes |
| (iii) MCP | no | tools only, agent mode | no (static) | no | yes |
| custom skill | no | tool only, agent mode | yes (`invocation.user_id`) | yes | yes |

## 3. Licence
AnythingLLM is **MIT** ([LICENSE](https://github.com/Mintplex-Labs/anything-llm/blob/master/LICENSE), "Copyright (c)
Mintplex Labs Inc."), compatible with AGPL-3.0: code may be reused with the notice in `THIRD_PARTY_NOTICES.md`. We
should not need any: the connector only talks to its HTTP API / config files.

## 4. Recommended design
A small connector service in the Recordare repo (TypeScript, built on `packages/client`), two modes the admin picks:

1. **Capture = polling (ii) by default**: reliable ids, real user and thread, no change to the LLM path. Idempotent via
   message externalIds; per-owner consent is enforced by Recordare (`stored: false`).
2. **Recall**: (a) **proxy mode** (i) for injection on every turn — the proxy then also does capture inline, and polling
   is switched off (the proxy cannot derive the polling ids, so running both would double-ingest: one capture source
   per instance); or (b) **MCP mode** (iii) for single-user installs.
   A custom skill that reads `invocation.user_id` is a possible multi-user tool path but relies on internals: park it.
3. Setup doc: disable AnythingLLM's built-in memories; map AnythingLLM users → Recordare externalUserIds; add the marker
   to each workspace prompt (proxy mode); keep embed-widget chats out (no person).

## 5. Local smoke test (no account needed)
```sh
export STORAGE_LOCATION=$PWD/.anythingllm && mkdir -p $STORAGE_LOCATION && touch $STORAGE_LOCATION/.env
docker run -d --name allm -p 3001:3001 --cap-add SYS_ADMIN \
  -v $STORAGE_LOCATION:/app/server/storage -v $STORAGE_LOCATION/.env:/app/server/.env \
  -e STORAGE_DIR=/app/server/storage \
  -e LLM_PROVIDER=generic-openai -e GENERIC_OPEN_AI_BASE_PATH=http://host.docker.internal:<proxy>/v1 \
  -e GENERIC_OPEN_AI_MODEL_PREF=<model> -e GENERIC_OPEN_AI_MODEL_TOKEN_LIMIT=32000 \
  mintplexlabs/anythingllm:1.17.0   # verify the tag exists on Docker Hub; `latest` otherwise
```
([docker guide](https://github.com/Mintplex-Labs/anything-llm/blob/master/docker/HOW_TO_USE_DOCKER.md)). Then, scripted:
- API key: in single-user mode without `AUTH_TOKEN`, `POST /api/system/generate-api-key` needs no auth
  (`server/endpoints/system.js`); otherwise create it in the UI (Settings → Developer API).
- Multi-user: `POST /api/system/enable-multi-user` (internal endpoint, UI session) or the UI; users via
  `POST /api/v1/admin/users/new`.
- `POST /api/v1/workspace/new {name}`; set the prompt with the marker via `POST /api/v1/workspace/{slug}/update
  {openAiPrompt}`; `POST /api/v1/workspace/{slug}/thread/new {userId}`;
  `POST /api/v1/workspace/{slug}/thread/{thread}/chat {message, mode:"chat"|"automatic", userId}`.
- Assert: Recordare raw log has both turns under the right owner and conversation; a second chat that needs the first
  fact gets it from the injected block (proxy) or from `search_memory` (MCP, `mode:"automatic"`).
- MCP: write `storage/plugins/anythingllm_mcp_servers.json`
  `{"mcpServers":{"recordare":{"type":"streamable","url":"http://host.docker.internal:<port>/mcp","headers":{"Authorization":"Bearer rk_…","X-Recordare-User":"<id>"}}}}`.

## 6. Same proxy for Open WebUI and LibreChat?
- **Open WebUI** ([v0.11.4](https://github.com/open-webui/open-webui/releases/tag/v0.11.4), 2026-09-21): with
  `ENABLE_FORWARD_USER_INFO_HEADERS=true` it forwards `X-OpenWebUI-User-Id/-Name/-Email/-Role`, plus
  `X-OpenWebUI-Chat-Id` and `X-OpenWebUI-Message-Id` (`backend/open_webui/env.py`, `utils/headers.py`); with
  `FORWARD_USER_INFO_HEADER_JWT_SECRET` set it sends one **signed HS256 JWT** (`X-OpenWebUI-User-Jwt`, 300 s) instead
  — the proxy can verify identity. So the proxy gets full coverage (user + chat + message ids). Note
  [CVE-2026-59224](https://osv.dev/vulnerability/CVE-2026-59224) (unsigned forwarded user id in the terminal proxy,
  fixed in 0.10.0): prefer the JWT mode. Licence: the "Open WebUI License" (BSD-3 plus a branding clause) — do not reuse
  its code without checking compatibility; we only consume headers.
- **LibreChat** (latest tags v0.8.8-rc*, MIT): custom endpoints' `headers` support `{{LIBRECHAT_USER_ID}}`,
  `{{LIBRECHAT_USER_EMAIL}}`, `{{LIBRECHAT_BODY_CONVERSATIONID}}`, `{{LIBRECHAT_BODY_MESSAGEID}}`,
  `{{LIBRECHAT_BODY_PARENTMESSAGEID}}` ([custom endpoint](https://www.librechat.ai/en/docs/configuration/librechat_yaml/object_structure/custom_endpoint));
  the same placeholders work in `mcpServers` headers
  ([MCP servers](https://www.librechat.ai/docs/configuration/librechat_yaml/object_structure/mcp_servers)), so even
  MCP can be per-user there. Full coverage via the proxy; headers are set by the admin config, not by users.
- AnythingLLM is the weak one: no identity forwarding, hence the system-prompt marker or polling.

## Not verified
- No AnythingLLM instance was run: agent auto-mode reach, marker expansion in agent calls, the admin chats endpoint
  in single-user mode, the exact Docker tag `1.17.0`, and how many LLM calls one agent turn makes all need the smoke test.
- Custom-skill access to `this.super.handlerProps.invocation` is read from code, not from public docs.
- Open WebUI / LibreChat statements come from `main` source and docs pages, not from running them.
