# Integrating a client platform (M6)

How an agent platform (Arkimede first, any other after) uses Recordare as its users' memory, at the **full level**
(client API key, REST ingest + MCP). Contracts: `API.md`; events for the optional live view: `ATLAS_EVENTS.md`.

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
- Name the person once: `PATCH api/v1/me {displayName}` (only while unnamed; afterwards the admin / owner decide).
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
- Tools: `search_episodes`, `search_memory` (facts and notes), `resolve_period`, `log_episode`, `correct_episode`,
  `forget_episode`, `remember`.

## 5. Observability (optional)
Recordare Atlas shows Recordare's own work from its telemetry stream; your agents (LLM calls, tools) appear when you
export OpenTelemetry GenAI traces to the atlas (`recordare-atlas` README) — metadata only, with `recordare.owner_id`
on the spans.
