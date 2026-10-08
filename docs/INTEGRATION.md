# Integrating a client platform (M6)

How an agent platform (Arkimede first, any other after) uses Recordare as its users' memory, at the **full level**
(client API key, REST ingest + MCP). Contracts: `API.md`; events for the optional live view: `ATLAS_EVENTS.md`.

Infrastructure (standalone, or co-hosted with Arkimede on a small server): `DEPLOYMENT.md`.

**Use the client library** (`packages/client`, WORK_PLAN 6.7): it does sections 2–4 below the same way for every
platform — person, consent and name sync, ingest, deletions, MCP recall with the right headers, the outbox delivery
policy — and passes the conformance suite. A platform keeps only its outbox storage and its chat mapping.

## 1. Set-up (admin, once)
1. Create the client: `POST api/v1/admin/clients {name, kind: "platform", autoProvision: true}`.
2. Create its key: `POST api/v1/admin/clients/{id}/keys {scopes: ["ingest", "mcp", "read"]}` — shown once; store it
   as a secret of the platform.
3. **Consent stays with the admin / the owner** (D4): a client key can never turn a person's episodic memory on.
   Home profile: the admin enables it per person (`PATCH api/v1/admin/owners/{ownerId} {episodicEnabled: true}`).
   Public profile: the host's toggle opens Recordare's owner page.

## 2. People
- Every request names the platform's user: `X-Recordare-User: <the platform's own user id>`. With `autoProvision`
  the person is created at first contact; `GET api/v1/me` returns `ownerId` — store it next to your user (it ties
  your telemetry to the person: OpenTelemetry attribute `recordare.owner_id`).
- Name the person after your user and keep it in sync: `PATCH api/v1/me {displayName}` whenever the user renames their
  profile (the name follows the platform). The user's choice of memory kind goes the same way: `PATCH api/v1/me
  {kind: human | entity}` (D48 — `entity` for a shared account everyone uses), accepted only while the memory is empty
  (409 `memory_not_empty`). `GET api/v1/me` returns `kind` (show a shared memory as such) and `atlasUrl` when Recordare
  Atlas is installed (link it for your admins only: it shows every person's activity).
- `GET api/v1/me` also says `episodicEnabled`: until the consent is given, ingest stores nothing — show the user
  "waiting for activation" instead of buffering their messages (holding them would bypass the consent).
- The same human on two platforms: the admin links the identities (`POST api/v1/admin/identities`).

## 3. Ingest — never block the chat
- Send every persisted message (user, assistant, other participants, tool output) with `POST api/v1/ingest/messages`,
  with stable `externalId`s (idempotent: a retry never duplicates) and the conversation's participants.
- Use an **outbox**: write the message to your own table first, send asynchronously, retry with back-off; a Recordare
  outage must never fail or slow the chat. Edits and deletions follow (`API.md` §2).

## 4. Recall — MCP
- Register Recordare's MCP endpoint (`/mcp`) in your MCP client with the key and `X-Recordare-User`.
- **Always send `X-Recordare-Conversation: <externalConversationId>`**: Recordare resolves who will see the answer from
  the participants it ingested; without a resolvable conversation a read returns nothing (viewer rule, `API.md` §1).
- Optional, per agent: `POST api/v1/context {query}` before an answer returns the relevant memories as a fenced
  block for the end of the system prompt (`API.md`, WORK_PLAN 5.7) — the agent may answer without a tool call.
- Tools: `search_episodes`, `search_memory` (facts and notes), `resolve_period`, `log_episode`, `correct_episode`,
  `forget_episode`, `remember`.

## 5. Observability (optional)
Recordare Atlas shows Recordare's own work from its telemetry stream; your agents (LLM calls, tools) appear when you
export OpenTelemetry GenAI traces to the atlas (`recordare-atlas` README) — metadata only, with `recordare.owner_id`
on the spans.
