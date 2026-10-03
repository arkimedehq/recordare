# API contracts v1

Status: **M1 contracts, revision 3** (2026-10-03): consistency + security reviews applied, then split
into deployment profiles (§0) so v1 stays focused on the twin.
Client-neutral: nothing here is specific to Arkimede. Data model: `DATA_MODEL.md`. Two integration
levels (vision → Architecture): **basic** = MCP tools only; **full** = REST ingest + MCP + read API
+ SDK.

Conventions: JSON over HTTPS; controllers hard-code `api/v1/…` (no global prefix); ISO 8601 with
offset; uuids; errors as RFC 9457 problem details (`{type, title, status, detail, code}`); zod
schemas are the single source of truth and generate `GET /api/v1/openapi.json` (M2); pagination
`?cursor&limit` → `{items, nextCursor}`; every non-idempotent POST accepts an `Idempotency-Key`
header (24 h replay window, same response returned).

## 0. Deployment profiles (D33)

| Profile | For | Contents |
|---|---|---|
| **v1 — home / research** (built now) | One installation run by its owner(s) and their own clients (Arkimede, Claude Code, the research simulator) | Owners and identities created by the **admin API**; client API keys; **personal access tokens** for MCP-only clients (created via admin API); hashed credentials and simple scopes; per-owner isolation; **viewer context resolved by Recordare** (disclosure is part of the twin, not a security add-on); `author_role` provenance; consent flag; forgetting that sticks |
| **Public** (deferred — M7 / public release) | Recordare as a service for people the operator does not know | Owner login (email magic link, verified email, owner pages), OAuth 2.1 for MCP connectors, owner-driven link codes + revocation UI, `read_audit`, persistent idempotency table, backup-retention policy and provider-retention notice, export restricted to owner sessions; network-level protection (firewall / WAF / rate limits) in front |

Items marked **(public profile)** below are specified so the design stays coherent, but are not
built in v1. Nothing in the public profile changes memory rows, so enabling it later needs no data
migration.

## 1. Identity, authentication, viewer context (tasks 1.1, 1.5 → D24)

### Model
- **Person**: a human known to the installation. **Owner**: a person with a memory (one per
  person, whatever platform). Contacts are persons scoped to one owner's memory.
- **Client**: a platform integration (Arkimede installation, Claude Desktop setup, import tool).
- **External identity**: `client_user` (`clientId + externalUserId`) or `channel`
  (`telegram:…`, `phone:+39…`, `email:…`); only verified bindings identify interlocutors.

### Owner authentication (public profile)
**v1**: owners are created by the admin (`POST api/v1/admin/owners`); consent (`episodicEnabled`),
personal tokens and identity bindings are managed through the admin API or an owner personal token;
there are no owner pages.

**Public profile**: owners log in to Recordare's own pages with an **email magic link** (no passwords; passkeys and
OIDC later). The owner session is needed for: giving consent (`episodicEnabled`), creating link
codes, revoking clients, authorising OAuth MCP clients, creating personal tokens, exports, the
self-service diary.
- The owner email is set **only** through a verification mail the owner opens (claim flow); it is
  never taken from client or ingest payloads, and changing it requires the current owner session
  plus verification of the new address.
- Magic links: single use, ≤ 15 min, rate-limited per address and IP, bound to the browser that
  requested them; new-login notifications by email.
- An auto-provisioned owner (created by a client) has no email until claimed: until then its
  memory is exactly as protected as that client's key, and it has no owner pages. Host toggles
  (e.g. Arkimede's "enable diary") **open Recordare's owner page**; they never change consent with
  the client key.

### Credentials (D24)
| Level | Credential | Acts as |
|---|---|---|
| Full | **Client API key** `Authorization: Bearer rk_…` | Owners mapped to that client, selected per request with `X-Recordare-User: <externalUserId>` |
| Basic | **Personal access token** `rp_…`, bound to one owner + one client, created by the owner (owner session) — for header-capable MCP clients (Claude Code, Cursor, SDKs) | That owner |
| Basic (OAuth) — public profile | **OAuth 2.1** per the MCP authorization spec (code + PKCE, dynamic client registration, protected-resource metadata); the owner logs in (magic link) and consents — for clients that require it (Claude Desktop / claude.ai connectors). Scheduled for M6; personal tokens cover M3–M5 | That owner |
| Admin | API key with scope `admin` | Installation management |

### Scopes
| Scope | Allows |
|---|---|
| `ingest` | §2 ingest, edits, deletions of the client's own conversations |
| `mcp` | §3 tools (read + `log_episode`, `correct_episode`, `forget_episode`) |
| `read` | §4 GET endpoints |
| `write` | §4 manual entries, corrections, forgetting, fact edits |
| `owner_settings` | `PATCH settings` incl. `episodicEnabled` — never client API keys (consent, D4). v1: admin key or the owner's personal token; public profile: owner sessions / owner-created tokens |
| `export` | §4 export jobs — v1: admin key or the owner's personal token; public profile: owner sessions only, expiring download |
| `admin` | `api/v1/admin/…` |

Keys and tokens: argon2id hashes, shown once, visible prefix, rotation by create + revoke. A
client can never mint tokens for another client. `Idempotency-Key` replays are scoped to
`(credential, owner, method + path)`; v1 keeps them in Redis for 24 h (persistent table in the
public profile).

### Viewer context (who will see the result) — every read
The viewer set is **resolved by Recordare, never asserted by the client or the LLM**:
- **Client API keys and MCP sessions opened with them**: the only accepted source is
  `X-Recordare-Conversation: <externalConversationId>`, resolved against the participants Recordare
  has ingested for that conversation. `X-Recordare-Viewers` and `_meta.recordare.viewers` may only
  **add** viewers (narrowing what is returned), never replace the resolved set. A read **without a
  resolvable conversation returns nothing**.
- **Personal tokens and owner sessions** (owner-direct use, e.g. Claude Code): no header → viewers =
  the owner; a conversation header, if sent, applies as above.
- (Public profile) the resolved viewer set and its source are written to `read_audit`.

Rule (`DATA_MODEL.md` → read rule): in phase 1 memories — and raw data derived from chats
(quotes, `fromChats` excerpts, message ids) — are returned only when the viewers are exactly the
owner; otherwise the response is empty with a neutral note (`"nothing to show here"`) that does not
reveal whether memories exist. Missing and forbidden items look the same.

### Linking the same person across clients
**v1**: the admin binds identities (`POST api/v1/admin/identities {personId, kind, clientId |
channel, externalId}`); binding an id already bound to another owner fails with a generic
`400 cannot_link`.

**Public profile**:
1. In an **owner session**, the owner picks the target client and creates a link code
   (`POST api/v1/me/link-codes {clientId}` → `{code, expiresAt}`, single use, 10 min), seeing what
   that client will get: episodes and facts of all clients; raw chats only of its own conversations
   (`clients.raw_log_scope = own`, widenable by the owner).
2. That client submits it: `POST api/v1/identities/link {code, externalUserId}`; redemption by any
   other client is rejected. The owner receives a notification.
3. If the `externalUserId` is already bound to another owner, the link fails with a generic
   `400 cannot_link` (no hint that the id exists) — person merge is not supported in v1.
4. The owner can list and revoke connected clients and identities at any time:
   `GET api/v1/me/identities`, `DELETE api/v1/me/identities/{id}` (owner session).

Admin (`api/v1/admin/…`): clients, keys, persons, owners, identities CRUD; owner export / full
erasure jobs.

## 2. REST ingest (task 1.2) — full integration

### `POST api/v1/ingest/messages` (scope `ingest`)
```ts
{
  conversation: {
    externalId: string;
    source?: "chat" | "voice" | "import_chat" | "import_social" | "import_email"
           | "import_notes" | "interview";                // default "chat"
    channel?: string; title?: string;
    participants?: Array<{
      ref: string; role: "owner" | "assistant" | "other"; displayName?: string;
      identity?: { channel: string; externalId: string } | { externalUserId: string };
      // resolved to a person only if the identity is verified for this owner;
      // otherwise stored by display name (never enters `audience`)
    }>;
  };
  messages: Array<{                       // max 500, any order
    externalId: string;
    role: "user" | "assistant" | "tool" | "other";        // "system" is rejected (may carry secrets)
    toolName?: string;                    // role "tool": agent tool calls / results (D30)
    authorRef?: string;
    content: string;                      // verbatim, ≤ 64 KB
    sentAt: string;                       // reference time for date resolution
    upsert?: boolean;                     // true: same externalId with new content = edit
  }>;
  hints?: { conversationEnded?: boolean };
}
```
Response **`200`** after the raw rows are written synchronously (extraction is always async):
`{conversationId, accepted, duplicates, conflicts: [externalId…], stored: boolean}`.
- Same `externalId` and same content → duplicate (ignored). Same `externalId`, different content →
  listed in `conflicts` (`409`-style per item) unless `upsert: true`, which records an edit.
- **Owner without `episodicEnabled`** → nothing is stored, `stored: false` (no raw log without
  consent). Disabling it later stops ingest and extraction; existing memories stay until the owner
  deletes them ("disable and erase" is offered on the owner page).
- Each accepted batch (re)schedules the conversation's idle job (D1, D5, global delay); messages
  are extracted when pending, by `sentAt`, so late or out-of-order messages are never skipped.

### Edits and deletions
- `PATCH api/v1/ingest/conversations/{externalId}/messages/{messageExternalId}` `{content}`.
- `DELETE …/messages/{messageExternalId}`, `DELETE api/v1/ingest/conversations/{externalId}` →
  purge (`DATA_MODEL.md` → Forgetting and deletion), `202` + job id.

### Imports
`source: import_*` with historical `sentAt`, batched; extracted by the nightly path with topic
segmentation (D29); forward-only supersession by `sentAt`.

## 3. MCP tools (task 1.3) — both levels

Transport: **MCP streamable HTTP** at `/mcp`. **One MCP session per owner**: the owner is fixed
at `initialize` (token owner, or `X-Recordare-User` for client keys); every request re-validates
`X-Recordare-User` against the session owner — a mismatch returns 403 and terminates the session
(hosts that reuse one session across users cannot cross memories). The viewer context follows §1
(conversation header; `_meta` may only add viewers). Tool schemas use the provider-neutral subset
(D27). Tools are always listed (no hint whether a diary exists); with `episodicEnabled` off, reads
return nothing and writes are rejected with a neutral error.

### `log_episode` (D11)
| Param | Type | Notes |
|---|---|---|
| `content` | string, required | |
| `kind` | `"event" \| "plan"` | default `event` |
| `occurred_at`, `occurred_until` | string | ISO date / datetime resolved by the agent |
| `date_precision` | `"day" \| "month" \| "year" \| "approximate"` | |
| `people` | string[] | Names as mentioned |
| `place` | string | |

Returns `{id, stored}`. Dedup: the same content for the same owner within 10 minutes returns the
existing episode (agent retries). Evidence: the owner's `user` message in the conversation of the
call (bound late if the ingest has not arrived yet). **Importance 10 and `stance: stated` only when
the evidence binds to a `user` message of the owner**; otherwise (basic level, or no owner message)
the call is stored in a per-client daily conversation (`source: mcp_tool`, `evidence_kind:
agent_paraphrase`) with `origin: assistant_stated`, default importance and the label "noted by the
assistant" — so an injected tool output cannot create a high-importance "the user said" memory.

### `correct_episode` / `forget_episode` (D16, D18 — also for MCP-only owners)
- `correct_episode {id, content?, occurred_at?, date_precision?}` → new row with `corrects`, old
  row invalidated.
- `forget_episode {id}` → forgetting as in `DATA_MODEL.md` (tombstone, no comeback).

### `search_episodes` (D12, D13, D29)
| Param | Type | Notes |
|---|---|---|
| `query` | string | Optional for pure period overviews |
| `from`, `to` | string | ISO dates, inclusive, matched by overlap (`resolve_period` helps) |
| `mode` | `"search" \| "list" \| "latest"` | `search` relevance; `list` chronological in range; `latest` most recent matches first |
| `include_plans` | boolean | default true |
| `limit` | integer | defaults: search 10, list 30, latest 5 |

Returns:
```ts
{
  period?: { from: string; to: string };
  digests: Array<{ day: string; text: string }>;     // list mode without query
  episodes: Episode[];                                // in period / matching
  outsidePeriod: Episode[];                           // same shape; filled only when the period has no match (max 5)
  fromChats: Array<{ conversationId: string; messageId: string; at: string; excerpt: string }>;
  notes: string[];                                    // e.g. unresolved plans, shared-conversation notice
}
type Episode = {
  id: string; kind: "event" | "plan" | "state_change"; content: string;
  when: string;                                       // human-readable, with precision
  planStatus?: "open" | "confirmed" | "cancelled" | "rescheduled" | "unresolved";
  rescheduledTo?: string; origin: "owner_lived" | "owner_told" | "assistant_stated";
  authorRole: "owner" | "assistant" | "other" | "tool";   // who wrote the evidence
  people: string[]; feelings: string[]; opinion?: string;
  source: { conversationId: string; messageIds: string[]; at: string };
};
```
Every item carries `authorRole` (`owner | assistant | other | tool`) so hosts can wrap non-owner
content as data, not instructions. `fromChats` (raw-log fallback, D13) is filled when fewer than 3 episodes match or the best match
is below the relevance threshold (tuned on the eval suite); limited to the client's own
conversations (`raw_log_scope`). Statuses always explicit; cancelled, unresolved and superseded
items are never presented as current (premise check, D29).

### `search_facts` (D31, value chain, as-of)
| Param | Type | Notes |
|---|---|---|
| `query` | string | Topic |
| `as_of` | string | ISO date; default now |
| `include_pending` | boolean | default false |

Returns `{facts: [{key, value | null, status, validFrom, validTo, history: [...], source}]}`;
`unknown_current` → "the current value is not known".

### `remember` and `search_memory` (D34 — semantic notes)
- `remember {content, category?}` — explicit "remember that…": stored as a stated note (owner's
  `user` message as evidence, same rules as `log_episode`).
- `search_memory {query, include_pending?}` — preferences, habits, values, knowledge, plus the
  relevant state facts; complements `search_episodes` (what happened / when).

### `resolve_period` (D12, deterministic)
`{expression, now?, locale?}` → `{from, to, label}`; Monday-based weeks, owner's timezone; `now`
defaults to server time (override allowed for tests and historical questions). No LLM.

## 4. Read / write API for host UIs (task 1.4) — the diary (D18)

Scoped to the owner (`X-Recordare-User` + viewer context, personal token, or owner session).
The same pages are served by Recordare itself for owners without a host UI.

| Method + path | Scope | Purpose |
|---|---|---|
| `GET api/v1/episodes?from&to&kind&planStatus&q&cursor&limit` | read | Timeline |
| `GET api/v1/episodes/{id}` | read | Detail: evidence (quotes filtered by `raw_log_scope` and the viewer rule), correction history, linked plan / event |
| `POST api/v1/episodes` | write | Manual entry |
| `POST api/v1/episodes/{id}/corrections` | write | Correction (new row, `corrects`) |
| `DELETE api/v1/episodes/{id}` | write | Forget one episode |
| `POST api/v1/forget {from, to, keepRaw?}` | write | Forget a period (async job) |
| `GET api/v1/digests?level&from&to` | read | Diary entries |
| `GET api/v1/facts?key&asOf&status&includePending` / `GET …/{id}` | read | Facts with history |
| `POST api/v1/facts/{id}/corrections`, `DELETE api/v1/facts/{id}` | write | Fix or forget a fact |
| `POST api/v1/facts/{id}/confirm` / `…/reject` | write | Pending facts (D20) |
| `GET api/v1/promotions?status` + `POST …/{id}/confirm\|reject` | read / write | Pattern proposals (D20, D26) |
| `GET api/v1/plans?status` | read | Open / unresolved plans |
| `GET api/v1/notes?category&pinned&includePending` / `GET …/{id}` | read | Semantic notes (D34) |
| `POST api/v1/notes`, `POST …/{id}/corrections`, `POST …/{id}/confirm\|reject`, `PATCH …/{id} {pinned}`, `DELETE …/{id}` | write | Manage notes |
| `GET api/v1/notes/changes?since=<seq>` | read | Change feed for clients keeping copies (Arkimede → A-MEM, D34) |
| `GET api/v1/settings`, `PATCH api/v1/settings` | read / owner_settings | `episodicEnabled`, locale, timezone |
| `GET api/v1/usage?from&to` | read | LLM calls and tokens for this owner |
| `POST api/v1/exports` → `GET api/v1/exports/{id}` | export | Async full export (JSON archive) |
| `GET api/v1/me/identities`, `DELETE api/v1/me/identities/{id}` | owner session (public profile) | Connected clients / identities, revoke |

## 5. SDK (task 1.6)

`@arkimedehq/recordare-client`, generated around the zod schemas:
```ts
const rc = new RecordareClient({ baseUrl, apiKey });
const owner = rc.as("arkimede-user-42", { conversation: "chat-123" });   // user + viewer context
await owner.ingest({ conversation, messages });     // batching, retries, idempotency keys
await owner.episodes.list({ from, to });
await owner.episodes.correct(id, { occurredAt: "2026-03-03" });
await owner.facts.list({ asOf: "2026-12-05" });
```
Typed errors; batching for imports; an **outbox helper** (persist-then-send with retry) so ingest
never blocks or fails the host's chat. MCP is used through the host's own MCP client.

## 6. Versioning and compatibility
- Breaking changes only under `api/v2/…`; additive changes within v1; MCP tool names stable, new
  parameters optional.
- Contract tests (M3) run the same scenarios through REST + MCP, both levels, including the
  viewer-context rule (shared conversations get nothing).
