# Integrating a client platform (M6)

> Since D50 (2026-10-09) Recordare has no consent flag: every memory stores what its client sends; the on/off switch
> belongs to the client platform (WORK_PLAN 8.1).

How an agent platform (Arkimede first, any other after) uses Recordare as its users' memory, at the **full level**
(client API key, REST ingest + MCP). Contracts: `API.md`; events for the optional live view: `ATLAS_EVENTS.md`.

Infrastructure (standalone, or co-hosted with Arkimede on a small server): `DEPLOYMENT.md`.

**Use the client library** (`packages/client`, WORK_PLAN 6.7): it does sections 2–4 below the same way for every
platform — person and name sync, ingest, deletions, MCP recall with the right headers, the outbox delivery
policy — and passes the conformance suite. A platform keeps only its outbox storage and its chat mapping.

**Ready-made connectors** (`connectors/`, full level, §4c): Claude Code, Codex, OpenClaw, Hermes Agent, and an
OpenAI-compatible memory proxy for platforms without plugin hooks (AnythingLLM, Open WebUI, LibreChat).

## 1. Set-up (admin, once)
1. Create the client: `POST api/v1/admin/clients {name, kind: "platform", autoProvision: true}`.
2. Create its key: `POST api/v1/admin/clients/{id}/keys {scopes: ["ingest", "mcp", "read", "write"]}` (`write` for the person's own edits in a diary UI) — shown once; store it
   as a secret of the platform.
3. **The on/off switch is yours** (D50): Recordare has no consent flag and stores whatever your platform sends. Give
   your users (or your admins) a per-user memory switch and send nothing while it is off. Informing the people around
   the agent — and any legal basis, e.g. under the GDPR — is the duty of whoever deploys the platform, not a Recordare
   setting.

## 2. People
- Every request names the platform's user: `X-Recordare-User: <the platform's own user id>`. With `autoProvision`
  the person is created at first contact; `GET api/v1/me` returns `ownerId` — store it next to your user (it ties
  your telemetry to the person: OpenTelemetry attribute `recordare.owner_id`).
- Name the person after your user and keep it in sync (client key only): `PATCH api/v1/me {displayName}` whenever the user renames their
  profile (the name follows the platform). The user's choice of memory mode goes the same way: `PATCH api/v1/me
  {mode: personal | entity}` (D50 — `entity` for a shared account everyone uses: a home device, a robot, a place),
  accepted only while the memory is empty (409 `memory_not_empty`); and the first person's grammatical gender from the
  user's profile, any time: `PATCH api/v1/me {gender: masculine | feminine | neutral}` (default masculine). `GET
  api/v1/me` returns `mode` and `gender` (show a shared memory as such) and `atlasUrl` when Recordare Atlas is installed
  (link it for your admins only: it shows every person's activity).
- **Two kinds of identity** (D50, WORK_PLAN 8.3): `X-Recordare-User` is an **account** identity — it opens the memory of
  that user's account. A participant's `identity` in an ingest (`{externalUserId}` for one of your users, `{channel,
  externalId}` for a channel id) is a **participant** identity — it names a contact *inside the memory being written*
  (created on first sight, named after its `displayName`) and never opens a memory. So the same user of yours can be
  one memory's account and a contact in another (a person talking to a shared device's memory): send their id as the
  participant's `identity` and their name as `displayName`. Binding by hand: `POST api/v1/admin/identities` (`API.md` §1).

## 3. Ingest — never block the chat
- Send every persisted message (user, assistant, other participants, tool output) with `POST api/v1/ingest/messages`,
  with stable `externalId`s (idempotent: a retry never duplicates) and the conversation's participants.
- Recordare records who said each message (D50): your user's turns are the memory's own in a personal memory and
  "someone"'s in an entity memory unless the participant carries an identity; the assistant's are the agent's.
  Content that is the **agent's own** — knowledge you give it, what a device perceives, a document — goes with
  `own: true` on the message (`user` or `other` role), with `source: document | perception | ambient` when that is the
  conversation's nature. (Until WORK_PLAN 8.4 the extraction reads own content like your user's turns.)
- Use an **outbox**: write the message to your own table first, send asynchronously, retry with back-off; a Recordare
  outage must never fail or slow the chat. Edits and deletions follow (`API.md` §2).
- When a conversation ends on your side (session closed, /new), say so: `POST api/v1/ingest/conversations/{id}/end`
  (or `hints.conversationEnded` on the last batch) — extraction then runs at once instead of after the idle delay.

## 4. Recall — MCP
- Register Recordare's MCP endpoint (`/mcp`) in your MCP client with the key and `X-Recordare-User`.
- **Always send `X-Recordare-Conversation: <externalConversationId>`**: no longer for visibility — answers use the
  whole memory in every conversation, shared ones included (D50; privacy comes later) — but MCP writes need it as their
  evidence (with a client key a write without a resolvable conversation gets `"cannot write here"`; a personal token
  writes as the person), and recall leaves the current turn out of the chat excerpts (`API.md` §1).
  `X-Recordare-Viewers` is gone: Recordare ignores it.
- Optional, per agent: `POST api/v1/context {query}` before an answer returns the relevant memories as a fenced
  block for the end of the system prompt (`API.md` §3, WORK_PLAN 5.7) — the agent may answer without a tool call.
  `POST api/v1/context {ingest}` (scopes `read` + `ingest`; client library `contextWithTurn`) stores the user's turn
  and returns its context in one call — one round trip before each turn instead of two.
- Tools: `search_episodes`, `search_memory` (facts and notes), `resolve_period`, `log_episode`, `correct_episode`,
  `forget_episode`, `remember`. A platform that already ingests every turn may leave `log_episode` out (the
  connectors do); tool schemas: `TOOLS` in the client library.
- The person's own diary in your UI (`API.md` §4, e.g. the Arkimede Diary): timeline, episode detail, day / month
  diary, facts, notes, plans, and the person's edits (correct, forget, pin, confirm / reject what is pending) — scope
  `read`, `write` for edits; owner-direct (no conversation header).

## 4b. Standard MCP clients — Claude Code (basic level, WORK_PLAN 6.1)
A client that only speaks MCP (no ingest) uses a **personal token** bound to one person and one client:
```bash
# admin, once: a client for it and the person's token (scope mcp)
curl -H "authorization: Bearer $ADMIN_API_KEY" -H 'content-type: application/json' \
  -d '{"name":"Claude Code","kind":"mcp_client"}' $RECORDARE_URL/api/v1/admin/clients
curl -H "authorization: Bearer $ADMIN_API_KEY" -H 'content-type: application/json' \
  -d '{"clientId":"<client id>","scopes":["mcp"]}' $RECORDARE_URL/api/v1/admin/owners/<person id>/tokens
# the person, in Claude Code (scope local = this project only; user = every project)
claude mcp add --transport http --scope user recordare $RECORDARE_URL/mcp --header "Authorization: Bearer rp_…"
```
- With a personal token reads are owner-direct (no conversation header needed).
- **Writes wait for the person**: such a client sends no conversation, so Recordare has none of the person's own words
  behind what the agent writes. `log_episode` is stored as stated by the assistant (inferred), `remember` as a pending
  note that recall shows only with `include_pending`; the person confirms it in their diary (read API §4, e.g. the
  Arkimede Diary). This is the poisoning guard (API.md §3), kept on purpose; a client that also ingests the
  conversation (Arkimede) gets confirmed memories — and so does a personal-token client that ingests the person's turns
  (the connectors, §4c): without a conversation named, the person's own messages from the same client in the last 30
  minutes are the evidence.
- Smoke test of the basic level (use a test person: it writes one episode, then forgets it, and one pending note):
  `RECORDARE_URL=… RECORDARE_TOKEN=rp_… npm run smoke:mcp` in `service/`. Tested with Claude Code 2026-10-08.
- Claude Desktop: its remote connectors expect OAuth, which v1 does not provide (D33); a local bridge that adds the
  header (e.g. `mcp-remote` with `--header`) should work but is untested.

## 4c. Connectors (full level, WORK_PLAN 6.6)
`connectors/` holds ready-made full-level clients, each with its README (English and Italian): **Claude Code** (plugin)
and **Codex** (installer) with shared capture hooks, **OpenClaw** (native plugin), **Hermes Agent** (memory provider),
and an **OpenAI-compatible memory proxy** (AnythingLLM, Open WebUI, LibreChat). Each one captures the turns, adds the
memory context before each turn (`POST api/v1/context`, with `ingest` where the turn is stored in the same call), ends
the conversation with `…/end` and, except the proxy, exposes the MCP tools (as `recordare_*` in OpenClaw and Hermes).
**One memory per agent** (D50): an agent platform's agent has one memory — a **personal token** with `mcp`, `ingest`,
`read` (client of kind `mcp_client`), or a **client key** with the same scopes (the proxy needs only `ingest` + `read`)
and the agent's account in its settings (`X-Recordare-User`). The people who talk to the agent (OpenClaw senders, Hermes
gateway users, the proxy's platform users) are **participants** with an identity, recognised inside that memory as its
contacts, and their turns are sent as role `other` with their author; the account holder (listed in each connector's
settings) is the memory's "I". One memory per person stays a setting (`memoryPer: "user"`, `RECORDARE_MEMORY_PER=user`,
`MEMORY_PER=user`). Claude Code and Codex: the personal token's memory. Mode and gender of a memory are set by the
admin or with `PATCH api/v1/me`, not by the connectors.

## 5. Observability (optional)
Recordare Atlas shows Recordare's own work from its telemetry stream; your agents (LLM calls, tools) appear when you
export OpenTelemetry GenAI traces to the atlas (`recordare-atlas` README) — metadata only, with `recordare.owner_id`
on the spans.
