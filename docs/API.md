# API contracts v1

Status: **M1 contract draft** (2026-10-03). Client-neutral: nothing here is specific to Arkimede.
Data model: `DATA_MODEL.md`. Two integration levels (vision → Architecture): **basic** = MCP tools
only; **full** = REST ingest + MCP + read API + SDK.

Conventions: JSON over HTTPS; controllers hard-code their path under `api/v1/…` (no global
prefix, like Arkimede); ISO 8601 timestamps with offset; ids are uuids; errors use RFC 9457
problem details (`{type, title, status, detail, code}`); request bodies validated with zod schemas
that are the single source of truth — the OpenAPI document is generated from them in M2
(`GET /api/v1/openapi.json`). Pagination: `?cursor=…&limit=…` → `{items, nextCursor}`.

## 1. Identity and authentication (task 1.1, 1.5 → D24)

### Model
- **Person**: any human known to the installation. **Owner**: a person with a memory (one memory
  per person, whatever platform they use).
- **Client**: a platform integration (an Arkimede installation, a Claude Desktop setup, an
  import tool, the research simulator).
- **External identity**: how a client or a channel names a person — `client_user`
  (`clientId + externalUserId`) or `channel` (`telegram:12345`, `phone:+39…`, `email:…`).
  Channel bindings identify interlocutors; only **verified** bindings can raise a tier.
- Same person on Arkimede and on Claude Desktop = one owner: both external identities point to
  the same person.

### Credentials (D24)
| Level | Credential | Acts as |
|---|---|---|
| Full | **API key** of the client (`Authorization: Bearer rk_live_…`), scopes `ingest`, `mcp`, `read`, `write` | Any owner mapped to that client, selected per request with `X-Recordare-User: <externalUserId>` |
| Basic | **Personal access token** bound to one owner and one client (`Authorization: Bearer rp_…`), scopes `mcp` (+ `read`) — for MCP clients that accept a custom header (Claude Code, Cursor, most SDKs) | That owner only |
| Basic (OAuth) | **OAuth 2.1** per the MCP authorization spec (authorization code + PKCE, dynamic client registration, protected-resource metadata): the owner logs in to Recordare and consents; the client receives access / refresh tokens bound to that owner — for clients that require it (Claude Desktop / claude.ai custom connectors) | That owner only |
| Admin | API key with scope `admin` | Installation management |

Keys and tokens are stored hashed (argon2id), shown once, with a visible prefix; rotation =
create new, revoke old. An unknown `X-Recordare-User` on a full-level call returns 404 unless
the client is allowed to auto-provision owners (`clients.auto_provision`), in which case the
person, owner and `client_user` identity are created.

### Linking the same person across clients
1. The owner (already known through client A) asks for a link code: `POST api/v1/me/link-codes`
   → `{code, expiresAt}` (short, single use, 10 min).
2. Client B (or the owner in client B's UI) submits it: `POST api/v1/identities/link`
   `{code, externalUserId}` with client B's key → B's identity is attached to the same person.
3. Personal tokens for MCP-only clients are created from a client UI or the admin API:
   `POST api/v1/me/tokens {clientId, scopes, expiresAt?}`.

Admin endpoints (`api/v1/admin/…`): clients, API keys, persons, owners, identities — CRUD, plus
`POST admin/owners/{id}/export` and `DELETE admin/owners/{id}` (full erasure).

## 2. REST ingest (task 1.2) — full integration

Pushes conversation messages into Layer 0. Extraction happens later (idle debounce, D1), never
inline. All endpoints are **idempotent** on `(client, owner, conversation.externalId,
message.externalId)`.

### `POST api/v1/ingest/messages`
```ts
{
  conversation: {
    externalId: string;               // client's conversation id
    source?: "chat" | "voice" | "import_chat" | "import_social" | "import_email"
           | "import_notes" | "interview" | "simulation";   // default "chat"
    channel?: string;                 // "arkimede", "telegram", "whatsapp", …
    title?: string;
    participants?: Array<{
      ref: string;                    // stable id inside this conversation ("u1", external user id, …)
      role: "owner" | "assistant" | "twin" | "other";
      displayName?: string;
      identity?: { channel: string; externalId: string } | { externalUserId: string };
    }>;
  };
  messages: Array<{                   // max 500 per call, any order (sorted by sentAt server-side)
    externalId: string;
    role: "user" | "assistant" | "system" | "other";
    authorRef?: string;               // participant ref; default: owner for "user", assistant for "assistant"
    content: string;                  // verbatim, max 64 KB
    sentAt: string;                   // when it was written: reference time for date resolution
  }>;
  hints?: { conversationEnded?: boolean };   // true → extract now instead of waiting for idle
}
```
Response `202 {conversationId, accepted: n, duplicates: n}`. The owner is the
`X-Recordare-User` of the call; its participant entry is implied if omitted. Messages are never
extracted inline: each accepted batch (re)schedules the conversation's idle job (D1, D5).

### Edits and deletions
- `PATCH api/v1/ingest/conversations/{externalId}/messages/{messageExternalId}` `{content}` →
  keeps the previous text as a revision; rows citing the message are re-evaluated.
- `DELETE api/v1/ingest/conversations/{externalId}/messages/{messageExternalId}` and
  `DELETE api/v1/ingest/conversations/{externalId}` → physical purge of raw rows and derived
  memories without other evidence (`DATA_MODEL.md` → Deletion). `202`, async.

### Imports
Same endpoint with `source: import_*` and historical `sentAt`; large imports in batches.
Extraction of imported conversations goes through the nightly path with topic segmentation
(D29), never inline. Supersession is forward-only by `sentAt`, so a late import cannot overwrite
newer facts.

## 3. MCP tools (task 1.3) — both levels

Transport: **MCP streamable HTTP** at `/mcp` (D24), auth as above. Tool schemas use the
provider-neutral subset (flat objects, enums, no `oneOf`, no `format` keywords — D27); outputs are
validated in code. Tools are listed only if the owner has `episodic_enabled` (D4, D11).

### `log_episode` (D11)
Explicit capture ("note that today I serviced the car").
| Param | Type | Notes |
|---|---|---|
| `content` | string, required | What happened / is planned, in the user's words |
| `kind` | `"event" \| "plan"` | Default `event` |
| `occurred_at` | string | ISO date or datetime, resolved by the agent; omit when unknown |
| `occurred_until` | string | For multi-day events / plans |
| `date_precision` | `"day" \| "month" \| "year" \| "approximate"` | Default `day` when a date is given |
| `people` | string[] | Names as mentioned |
| `place` | string | |

Returns `{id, stored: {...normalised episode}}`. Explicit capture = importance 10, `stance:
stated`. Evidence = the current conversation's latest user message when the client ingests
(full level); otherwise the tool call itself is stored as a Layer-0 message in a per-client
daily conversation (`source: chat`, `channel: mcp`), so every episode keeps evidence.

### `search_episodes` (D12, D13, D29)
| Param | Type | Notes |
|---|---|---|
| `query` | string | Optional for pure period overviews |
| `from`, `to` | string | ISO dates, inclusive; the agent resolves relative periods (use `resolve_period`) |
| `mode` | `"search" \| "list" \| "latest"` | `search` = relevance; `list` = chronological within the range (overviews, counting); `latest` = most recent matching items first ("when did I last…") |
| `include_plans` | boolean | Default true |
| `limit` | integer | Default 10 (`search`), 30 (`list`) |

Returns:
```ts
{
  period?: { from: string; to: string };
  digests: Array<{ day: string; text: string }>;            // list mode without query
  episodes: Array<{
    id: string; kind: "event" | "plan" | "state_change";
    content: string; when: string;                          // human-readable date with precision
    planStatus?: "open" | "confirmed" | "cancelled" | "rescheduled" | "unresolved";
    rescheduledTo?: string;                                 // date of the new plan
    origin: "owner_lived" | "owner_told" | "assistant_stated";
    people: string[]; feelings: string[]; opinion?: string;
    source: { conversationId: string; messageIds: string[]; at: string };
  }>;
  outsidePeriod?: Array<...>;                               // only when the period has no match
  fromChats?: Array<{ conversationId: string; messageId: string; at: string; excerpt: string }>;
                                                            // raw-log fallback, labelled (D13)
  notes: string[];  // e.g. "plan X is unresolved: its date passed without confirmation"
}
```
Statuses are always explicit; cancelled, superseded or unresolved items are never presented as
current (premise check, D29).

### `search_facts` (D29 value chain, facts as-of)
| Param | Type | Notes |
|---|---|---|
| `query` | string | Topic ("macchina", "dove abito") |
| `as_of` | string | ISO date; default now — "where did I live in early December?" |

Returns `{facts: [{key, value, status, validFrom, validTo, history: [{value, from, to, status}],
source}]}`; `unknown_current` is returned as "the current value is not known".

### `resolve_period` (D12, deterministic)
`{expression: string, now?: string, locale?: "it" | "en"}` → `{from, to, label}` for "questa
settimana", "la settimana scorsa", "a febbraio", "quest'inverno", "last week", … (Monday-based
weeks, owner's timezone). No LLM. Unknown expressions → error with suggestion to pass dates.

## 4. Read / write API for host UIs (task 1.4) — the diary (D18)

All scoped to the authenticated owner (`X-Recordare-User` or personal token).

| Method + path | Purpose |
|---|---|
| `GET api/v1/episodes?from&to&kind&planStatus&q&cursor&limit` | Timeline |
| `GET api/v1/episodes/{id}` | Detail with evidence (messages), history (corrections), linked plan / event |
| `POST api/v1/episodes` | Manual entry (same fields as `log_episode`) |
| `POST api/v1/episodes/{id}/corrections` `{content?, occurredAt?, datePrecision?, importance?}` | Correction = new row with `corrects`, old row `invalidated_at` (no rewrite) |
| `DELETE api/v1/episodes/{id}` | Forget one episode (physical, D16) |
| `POST api/v1/forget` `{from, to}` | Forget a period (async job, digests recomputed) |
| `GET api/v1/digests?level=day\|month&from&to` | Diary entries |
| `GET api/v1/facts?key&asOf&status` / `GET api/v1/facts/{id}` | Facts with history |
| `POST api/v1/facts/{id}/confirm` / `…/reject` | Pending facts (D20) |
| `GET api/v1/plans?status` | Open / unresolved plans |
| `GET api/v1/settings` / `PATCH api/v1/settings` | `episodicEnabled`, locale, timezone |
| `GET api/v1/usage?from&to` | LLM calls and tokens for this owner (cost transparency) |
| `GET api/v1/export` | Full export of the owner's memory (JSON) |

## 5. SDK (task 1.6)

`@arkimedehq/recordare-client` — thin TypeScript client generated around the zod schemas:
```ts
const rc = new RecordareClient({ baseUrl, apiKey });          // full level
const owner = rc.as("arkimede-user-42");                       // X-Recordare-User
await owner.ingest({ conversation, messages });                // batches, retries with backoff, idempotent
await owner.episodes.list({ from, to });
await owner.episodes.correct(id, { occurredAt: "2026-03-03" });
await owner.facts.list({ asOf: "2026-12-05" });
```
Typed errors (`RecordareError` with `code`), automatic batching of large imports, an
**outbox helper** for hosts (persist-then-send with retry) so ingest never blocks or fails the
host's chat flow. MCP tools are not wrapped: hosts use their own MCP client.

## 6. Versioning and compatibility
- Breaking changes only with a new `api/v2/…` path; additive changes (new optional fields, new
  tools) within v1.
- MCP tool names are stable; new parameters are optional.
- The contract test suite (M3) runs the same scenarios through REST + MCP for both levels.
