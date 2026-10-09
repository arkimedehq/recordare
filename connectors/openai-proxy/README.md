# Recordare memory proxy (OpenAI-compatible)

Gives the **full client level** — every turn captured, the relevant memories added before each answer — to chat
platforms that have no plugin hooks: **AnythingLLM**, **Open WebUI** and **LibreChat**, or any platform whose LLM
provider can be an OpenAI-compatible URL. The platform talks to the proxy as if it were its provider; the proxy talks
to the real provider and to Recordare.

```
platform ──► proxy ──► upstream provider (any OpenAI-compatible API)
               │
               └──► Recordare: POST api/v1/context (stores the person's message) → (answer) → ingest the answer
```

Per `POST /v1/chat/completions` (streamed or not):
1. **Who**: an identity resolver finds the person and the conversation (below). None ⇒ pure pass-through.
2. **Before the answer**: one call (`POST api/v1/context` with `ingest`) stores the person's last message and returns
   the memories relevant to it as a fenced `<memory-context>` block, appended to the end of the first system message (a
   system message is added when there is none). With `RECALL=false` the message is stored with a plain
   `POST api/v1/ingest/messages`. The call is time-boxed (`RECALL_TIMEOUT_MS`, 1.5 s); on any failure the request goes
   on without the block and the message waits in the retry queue.
3. **The answer** is forwarded unchanged — a stream stays a stream (SSE bytes are piped as they arrive while the text
   is accumulated) — and, when complete and final, sent to Recordare in the background.

Other `/v1/*` calls (`/v1/models`, embeddings, …) are passed through. `GET /health` answers locally.

Recall over **MCP tools** is not part of the proxy: platforms that support per-user MCP headers (LibreChat, Open WebUI)
can register Recordare's `/mcp` directly (`docs/INTEGRATION.md`).

## Run it

Node ≥ 20 (local) or Docker. Build from this folder: `npm ci && npm run build && node dist/main.js` (the bundle includes
`packages/client`, built from its sources). Docker: the published image `ghcr.io/arkimedehq/recordare-openai-proxy` (amd64 + arm64, tags `latest` and the version),
or build it from the repository root:
```sh
docker build -f connectors/openai-proxy/Dockerfile -t recordare-openai-proxy .
```
`compose.example.yml` is a service to copy next to the platform. Keep the proxy on the platform's private network
(no published port), or set `PROXY_API_KEY` (see Security).

### Recordare set-up (admin, once)
```sh
# a client for the platform, its key; persons are created on first use (autoProvision)
curl -H "authorization: Bearer $ADMIN_API_KEY" -H 'content-type: application/json' \
  -d '{"name":"AnythingLLM","kind":"platform","autoProvision":true}' $RECORDARE_URL/api/v1/admin/clients
curl -H "authorization: Bearer $ADMIN_API_KEY" -H 'content-type: application/json' \
  -d '{"scopes":["ingest","read"]}' $RECORDARE_URL/api/v1/admin/clients/<client id>/keys
```
Recordare has no consent flag (D50): an auto-provisioned person's turns are stored from the first request; to stop,
turn `CAPTURE` / `RECALL` off or remove the proxy. To attach the platform's user to an existing person instead, bind the identity:
`POST api/v1/admin/identities {kind: "account", personId, clientId, externalId: "anythingllm:2"}` (the external id
is the Recordare user the proxy resolves, see Identity). A single-person install can use a **personal token** (`rp_…`)
instead of a client key: every resolved request is then that person.

### Configuration (environment)

| Variable | Default | Meaning |
|---|---|---|
| `UPSTREAM_BASE_URL` | — (required) | The real provider, e.g. `https://api.deepseek.com/v1`; `/v1/x` → `<base>/x` |
| `UPSTREAM_API_KEY` | — | Sent upstream as `Authorization: Bearer …`. Unset: the caller's `Authorization` is passed through (the platform keeps the provider key) |
| `PROXY_API_KEY` | — | Callers must present it as their bearer key; needs `UPSTREAM_API_KEY` |
| `RECORDARE_URL`, `RECORDARE_API_KEY` | — | Recordare and a client key (`rk_…`, scopes `ingest` + `read`) or a personal token (`rp_…`). Unset: plain proxy |
| `RESOLVERS` | `generic,openwebui,anythingllm` | Identity resolvers, in order (the first that finds a user wins) |
| `USER_MAP` | `{}` | JSON alias map: `{"anythingllm:2":"andrea","openwebui:<uuid>":"andrea"}` (generic headers: the bare id) |
| `USER_MAP_ONLY` | `false` | Only mapped users are remembered; the others pass through |
| `DEFAULT_USER` | — | AnythingLLM: the user when the marker's user is not expanded (single-user mode: `[User ID]`) |
| `OPENWEBUI_JWT_SECRET` | — | Open WebUI JWT mode (verify `X-OpenWebUI-User-Jwt`, HS256); plain user headers are then ignored |
| `RECALL_TIMEOUT_MS` | `1500` | For the Recordare call before the answer (the message's ingest with its context) |
| `END_IDLE_SECONDS` | `0` | Quiet seconds after which the proxy tells Recordare the conversation ended; `0` = Recordare's own idle delay (`IDLE_DELAY_SECONDS`, 900 s) |
| `TZ` | system | Time zone of the day used in synthesised conversation ids |
| `SKIP_PATTERNS` | — | Extra regexes (JSON array or `\|\|`-separated) on the last user message marking background calls |
| `RECALL`, `CAPTURE` | `true` | Turn injection / capture off |
| `LOG_UPSTREAM` | `false` | Debug: log the messages sent upstream (personal data — never in production) |
| `PORT` | `8788` | Listening port |
| `MAX_BODY_BYTES` | 25 MB | Largest chat request |

## Identity

A request is remembered only when a resolver finds a person; otherwise it is forwarded untouched. Headers and markers
come from the **platform's admin configuration**; user-typed text is never read for identity (a marker in a user
message is ignored).

| Resolver | Reads | Recordare user | Conversation |
|---|---|---|---|
| `generic` | `X-Recordare-User`, `X-Recordare-Conversation`, `X-Recordare-Message` (the person's message id, optional) | the header value | the header value |
| `openwebui` | `X-OpenWebUI-User-Id`, `X-OpenWebUI-Chat-Id` (or the signed `X-OpenWebUI-User-Jwt`, claim `sub`) | `openwebui:<id>` | `openwebui:<chat id>` |
| `anythingllm` | the marker `[[recordare user=… ws=…]]` in the **first system message** | `anythingllm:<user>` | `anythingllm:<ws>:<user>:<day>` |

All mapped through `USER_MAP`. Unexpanded placeholders (`{{…}}`, `[User ID]`) and values like `null` / `new` count as
missing. Without a conversation id the conversation is **one per user (and workspace) and day**; identity headers
(`X-Recordare-*`, `X-OpenWebUI-*`) are never sent upstream, and markers are removed from every system message.

### AnythingLLM (v1.17)
1. LLM provider **Generic OpenAI**: base URL `http://recordare-proxy:8788/v1`, API key = `PROXY_API_KEY` (or the
   provider key when the proxy passes it through), the model name of the upstream, its context window.
2. In each workspace's **system prompt**, add (anywhere, it is removed before the provider sees it):
   `[[recordare user={user.id} ws={workspace.id}]]`. AnythingLLM expands the variables for normal and agent chats.
   Multi-user mode gives each person their id (`anythingllm:<id>`); in single-user mode `{user.id}` stays
   `[User ID]` — set `DEFAULT_USER`, or write a literal user in the marker.
3. Turn off AnythingLLM's own memories (two memories feeding one prompt). Its background LLM calls (memory extraction,
   thread names, …) carry no marker and pass through.

AnythingLLM sends **no thread id**, so the conversation is synthesised per workspace, user and day: two threads of one
day are one Recordare conversation. That is the most stable id available — a hash of the first message would change
as AnythingLLM truncates the history. An explicit `conv=` attribute overrides it (useful with fixed-purpose
workspaces). AnythingLLM sends no message ids either: deletions and edits in AnythingLLM do not reach Recordare.

### Open WebUI
Set `ENABLE_FORWARD_USER_INFO_HEADERS=true` on Open WebUI and add the proxy as an OpenAI connection
(`http://recordare-proxy:8788/v1`). Prefer the JWT mode: set the same secret in Open WebUI's
`FORWARD_USER_INFO_HEADER_JWT_SECRET` and the proxy's `OPENWEBUI_JWT_SECRET`, so a forged user header is not trusted.
Its task calls (titles, tags, follow-ups, search queries, autocomplete: prompts starting with `### Task:`) are skipped;
its RAG template (also `### Task:`, with the person's text in `<user_query>`) is a real turn, and only the
`<user_query>` text is stored.

### LibreChat
A custom endpoint in `librechat.yaml` with the generic headers:
```yaml
endpoints:
  custom:
    - name: "Recordare"
      apiKey: "${RECORDARE_PROXY_KEY}"            # the proxy's PROXY_API_KEY (or the provider key in pass-through)
      baseURL: "http://recordare-proxy:8788/v1"
      models: { default: ["deepseek-flash"], fetch: true }
      titleConvo: true
      headers:
        X-Recordare-User: "{{LIBRECHAT_USER_ID}}"
        X-Recordare-Conversation: "librechat:{{LIBRECHAT_BODY_CONVERSATIONID}}"
        X-Recordare-Message: "{{LIBRECHAT_BODY_MESSAGEID}}"
```
Title requests (`… title for the conversation …`) are skipped by a built-in pattern; add others with `SKIP_PATTERNS`.

## Turns, repeats and background calls
- **Message ids**: the person's message is `m:<platform message id>` when the platform sends one, else
  `u:<hash(conversation, position among the user messages, text)>`; the answer is `<that id>:a`. Recordare deduplicates
  on these ids, so retries never duplicate.
- **Repeated calls of one turn** — agent loops (several LLM calls with tool results after the same user message) and
  regenerations — have the same id: the message is sent and the memory context asked **once** (cached 15 min, the
  block is re-injected on each call). Only a complete answer **without tool calls** is captured; a regenerated answer
  replaces the stored one (`upsert`), so the last answer wins. Tool calls and results are not captured (v0.1).
- **Background calls** — the platforms' own LLM jobs — are neither captured nor given memories: no identity
  (AnythingLLM's jobs carry no marker), the built-in patterns (`### Task:` without `<user_query>`; "generate … title …
  conversation/chat/thread"), `SKIP_PATTERNS`, or an `X-Recordare-Skip` header.
- **End of a conversation**: Recordare extracts a conversation after its idle delay. With `END_IDLE_SECONDS` the proxy
  ends it earlier (`POST api/v1/ingest/conversations/{id}/end`, once its messages left the retry queue).

## Never in the way
- Recordare unreachable or slow: the request is forwarded without the block after at most `RECALL_TIMEOUT_MS` per
  call; after a connection failure the proxy stops calling Recordare before answers for 30 s (pure pass-through) and
  queues what it captures.
- **Retry queue in memory** (v0.1): up to 1000 batches, ~8 attempts with back-off over ≈ 10 minutes (`Retry-After`
  honoured), permanent errors (400 / 413 / 422) dropped and logged; one last attempt on SIGTERM; **lost on restart**.
- Logs carry no message content (except with `LOG_UPSTREAM`).

## Security
The proxy trusts the identity its caller states: whoever can reach it can claim any user. Keep it on the platform's
private network, or set `PROXY_API_KEY` so only the platform can call it; with Open WebUI use the JWT mode. The
Recordare key is a client key: it never changes a person's settings (`owner_settings` is not a client scope).

## Limits (v0.1)
- No MCP tool injection (the model gets memories in the prompt, not `recordare_*` tools); use the platform's MCP support.
- AnythingLLM: conversations per day, no edits / deletions; the prompt the proxy sees is the one AnythingLLM already
  truncated (RAG context lives in the system message, which is never ingested).
- The memory context misses easily on messages with instructions ("… answer in one sentence"), cross-language and
  period questions — a Recordare limit (WORK_PLAN 6.6b item 8), not the proxy's.
- In-memory retry queue and turn cache (lost on restart).

## Tests
`npm test` (vitest: resolvers, marker removal, background calls, injection, stream accumulation, repeated turns,
Recordare down, pass-through), `npm run typecheck`. `smoke.sh` runs the AnythingLLM end-to-end test against a local
Recordare (`SMOKE_DIR=/some/scratch/dir connectors/openai-proxy/smoke.sh`; ~5 GB of Docker disk, 2 LLM turns; removes
the AnythingLLM image afterwards).

Smoke-tested 2026-10-08 with AnythingLLM 1.17.0 (multi-user mode, the default `automatic` chat mode — agent path with
native tools — streamed and not) and DeepSeek upstream. Open WebUI and LibreChat: unit tests only, from their source
and docs (header names, task prompts, placeholders) — not run yet.
