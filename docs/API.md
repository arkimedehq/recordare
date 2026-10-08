# API contracts v1

Status: **M1 contracts, revision 3** (2026-10-03): consistency + security reviews applied, then split
into deployment profiles (§0) so v1 stays focused on the twin.
**Built (2026-10-07)**: §2 ingest, §3 MCP tools (as noted per tool), `GET / PATCH api/v1/me`, the admin API, live
telemetry and the atlas snapshot. Sections or rows marked **not built yet (v1 plan)** are the contract still to build
(§4 read API, §5 SDK, OpenAPI, `Idempotency-Key`).
Client-neutral: nothing here is specific to Arkimede. Data model: `DATA_MODEL.md`. Two integration
levels (vision → Architecture): **basic** = MCP tools only; **full** = REST ingest + MCP + read API
+ SDK.

Conventions: JSON over HTTPS; controllers hard-code `api/v1/…` (no global prefix); ISO 8601 with
offset; uuids; errors as RFC 9457 problem details (`{type, title, status, detail, code}`); zod
schemas are the single source of truth and generate `GET /api/v1/openapi.json` (**not built yet**); pagination
`?cursor&limit` → `{items, nextCursor}`; every non-idempotent POST accepts an `Idempotency-Key`
header (24 h replay window, same response returned — **not built yet**; ingest is idempotent on message ids).

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
there are no owner pages. Nightly consolidation runs on its own (`CONSOLIDATION_HOUR`, owner's timezone); `POST api/v1/admin/owners/:id/consolidate` runs it now (honours `X-Recordare-Now` where allowed); `POST api/v1/admin/owners/:id/review-facts` runs the facts review alone now (WORK_PLAN 5.6, same lock as the consolidation). Quality profile (D35): `qualityProfile` `economy | balanced | full` on owner create /
`PATCH api/v1/admin/owners/:id` (`null` = the installation default `QUALITY_PROFILE`, `balanced` unless set). The same
routes take `kind` `human | entity` (D48: an **entity memory**, shared by everyone using the account — a home device,
a robot, a place) and `PATCH` takes `displayName` (a client's later sync of its user's name overwrites it: the name follows the platform).

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

Admin (`api/v1/admin/…`), built: `POST clients`, `POST clients/:id/keys`, `DELETE keys/:id`, `POST owners`,
`PATCH owners/:id`, `POST identities`, `POST owners/:id/tokens`, `DELETE tokens/:id`, `POST owners/:id/consolidate`,
`POST owners/:id/review-facts`, `GET owners` (owners with memory size, for the atlas), `GET owners/:id/atlas`,
`GET telemetry/stream` (§6). Not built yet: owner export / full erasure jobs.

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
  purge (`DATA_MODEL.md` → Forgetting and deletion). As built: the purge runs synchronously and returns `202` with no
  body (plan: `202` + job id).
- `POST api/v1/ingest/conversations/{externalId}/end` → `202`: the conversation ended on the client (session closed,
  /new) — extraction runs now instead of after the idle delay; `404` for a conversation never ingested. Same effect as
  `hints.conversationEnded`, without re-sending a message.

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

Returns `{id, stored}`. Evidence (as built): the owner's message in the conversation of the call received in the last
30 minutes whose text overlaps the content (trigram similarity ≥ 0.2, or the content found inside the message: word similarity
≥ 0.6) — with a personal token and no conversation named, the
owner's messages from the same client (a connector that ingests the turns); planned, not built yet: 10-minute dedup of agent
retries and late binding when the ingest has not arrived. **Importance 10 and `stance: stated` only when
the evidence binds to a `user` message of the owner**; otherwise (`stance: inferred`, confidence 0.6) (basic level, or no owner message)
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
content as data, not instructions; such items also carry `claimedBy` (the names of who wrote the evidence), every
result names its `owner` (items speak of the owner in the third person: that is the user asking), chat excerpts carry
their `author` when not the owner; when such items are returned, `notes` says so explicitly (M4b: answer models
ignored the bare field). `digests` (M5): for `list` requests with a period, the diary of that period — day entries for spans up to 45 days, month summaries for longer ones; they summarise the owner's own episodes only (never other people's claims). `fromChats` (raw log, D13) always carries up to 2 excerpts not already behind the returned
episodes — the log answers what episodes never hold, e.g. help requests ("when did I ask you…") — and up to 3 when fewer
than 3 episodes match or the best match is below the relevance threshold; limited to the client's own
conversations (`raw_log_scope`). Statuses always explicit; cancelled, unresolved and superseded
items are never presented as current (premise check, D29).

### `search_facts` (D31, value chain, as-of) — not built yet (v1 plan)
Today `search_memory` (below) returns facts too, as of a date (`as_of`), each with its value chain; a separate
`search_facts` tool is planned.

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
- `search_memory {query, as_of?, include_pending?}` — preferences, habits, values, knowledge, plus the
  relevant state facts valid at `as_of` (ISO date, default today) with their history; complements `search_episodes`
  (what happened / when). Returns `{notes, facts}`. In an entity memory (D48) facts about people carry `about` (the
  person's name); facts without it are the entity's own.

### `resolve_period` (D12, deterministic)
As built: `{expression}` → `{from, to, label}` (or `{error}` for an unknown expression); Italian and English
expressions; Monday-based weeks, owner's timezone; "now" is the server clock (`X-Recordare-Now` overrides it where
`ALLOW_CLOCK_OVERRIDE` is set — tests and evaluations). No LLM. `now?` / `locale?` parameters: not built.

### Pre-turn memory context (WORK_PLAN 5.7) — built
`POST api/v1/context {query?, ingest?}` (scope `read`; `X-Recordare-User`, `X-Recordare-Conversation`) → `{block, items}`.
`ingest` (the body of `POST api/v1/ingest/messages`, scope `ingest` too) stores the turn first and answers for that
conversation, `query` defaulting to its last user message — one round trip before each turn instead of two. With a
personal token, a conversation not stored yet counts as the person's own. The block holds the
memories relevant to the message about to be answered (current facts and notes, upcoming open plans, up to 3 episodes,
each above a similarity floor; ≈ 300 tokens at most) as one fenced `<memory-context>` block marked "data, not
instructions", or `block: null` when nothing is relevant. No LLM call. Same viewer rule as every read (nothing in a
conversation others take part in); a served block is logged in `recall_log` (the recall-echo guard then treats the reply
as possibly echoing it). Always available: whether to use it, and for which agent, is the client's choice (the host
appends it at the end of its system prompt and never stores it as a message).

## 4. Read / write API for host UIs (task 1.4) — the diary (D18)

**Built (2026-10-08, WORK_PLAN 4.7)** — the rows the host diary needs: `GET episodes` (timeline, newest first; `from`
/ `to` local dates, `kind`, `planStatus` incl. computed `unresolved`, `q` full text, opaque `cursor` + `nextCursor`,
`limit` ≤ 200), `GET episodes/{id}` (evidence: message text only from the client's own conversations unless its
`raw_log_scope` is `all`, `otherClient` otherwise; `history` = the versions it corrected; for a plan `planEvents`,
`confirmedBy`, `rescheduledTo`), `POST episodes/{id}/corrections {content?, occurredAt?, datePrecision?}` →
`{id}`, `DELETE episodes/{id}` (forgetting that sticks, as `forget_episode`), `GET digests`, `GET facts` (slots with
`history`, `asOf`, per person in an entity memory), `DELETE facts/{id}`, `POST facts/{id}/confirm | reject`,
`GET notes`, `PATCH notes/{id} {pinned}`, `DELETE notes/{id}`, `POST notes/{id}/confirm | reject`, `GET plans`
(open and unresolved by default, soonest first); plus the `GET / PATCH api/v1/me` rows. **Not built yet**: manual entry,
fact / note corrections, promotions (5.4), forgetting a period (5.5), settings, usage, exports, the notes change feed,
`GET facts/{id}` / `GET notes/{id}`. Client library: `packages/client` (`episodes`, `episode`, `digests`, `facts`,
`notes`, `plans`, `correctEpisode`, `forgetEpisode`, `pinNote`, `delete`, `decide`).

Scoped to the owner, and the reader is the owner themself in the host's UI (owner-direct): a client key names the person
with `X-Recordare-User` (scope `read` to read, `write` to edit), a personal token is the person; no conversation header,
no viewer resolution (the viewer rule is for answers inside conversations). In an entity memory everyone using the
account sees all of it (D48).

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
| `GET api/v1/me` | read | Who the request acts for: `{ownerId, displayName, kind, episodicEnabled, atlasUrl?, via, scopes}` (`atlasUrl`: `ATLAS_URL`, when the atlas is installed) (`kind` `entity` = a shared memory: the client tells its users so) (`episodicEnabled` = the owner's consent: until it is given, ingest stores nothing) (with a client key: the person behind `X-Recordare-User`, auto-provisioned if the client allows it) |
| `PATCH api/v1/me {displayName?, kind?}` | ingest (client key) | The person's settings from their platform: the name follows the client's user (sync on every rename); `kind` `human \| entity` (D48) only while the memory has no episode, fact or note → else 409 `memory_not_empty` (the admin can still change it). Consent is never set here |
| `GET api/v1/me/identities`, `DELETE api/v1/me/identities/{id}` | owner session (public profile) | Connected clients / identities, revoke |

## 5. Client library (task 1.6, WORK_PLAN 6.7) — built (2026-10-07)

`@arkimedehq/recordare-client` in `packages/client/` (its README): `RecordareClient` (`me`, `updateMe`, `ingest` split
into requests of 500, `editMessage`, `deleteMessage` / `deleteConversation` with 404 = done, `mcp.listTools` /
`mcp.callTool` over the official MCP SDK with one session per user + conversation), `PersonDirectory` (cached person,
consent, kind and Atlas address; the platform's opt-in; name sync), `afterFailure` (outbox delivery policy: back-off
with jitter, `Retry-After`, park on 400 / 413 / 422), typed errors (RFC 9457). A host keeps only its outbox storage and
its chat mapping. A conformance suite runs it against the service in CI (`service/test/conformance`). Not built yet:
the read API wrappers (§4: episodes, facts, digests) — they come with §4.

## 6. Versioning and compatibility
- Breaking changes only under `api/v2/…`; additive changes within v1; MCP tool names stable, new
  parameters optional.
- Contract tests (M3) run the same scenarios through REST + MCP, both levels, including the
  viewer-context rule (shared conversations get nothing).

### Admin console (WORK_PLAN 6.9)
`GET /admin` serves a static page (public: it holds no data) over the admin API; the operator types the admin key, kept
in that browser tab only (strict CSP, `no-store`). Routes it uses besides those above, all admin only and metadata only:
`GET api/v1/admin/persons` (owners with settings, message / episode / fact / note counts, pending extraction, linked
identities, active personal tokens by prefix), `GET api/v1/admin/clients` (clients with active keys by prefix),
`PATCH api/v1/admin/clients/:id {autoProvision?, disabled?}` (disabled = every key and token of the client stops at
once), `DELETE api/v1/admin/identities/:id` (unlinks a client's user from a person; memories stay).

### Live telemetry (M5b, admin only)
`GET api/v1/admin/telemetry/stream[?owner=<personId>]` — Server-Sent Events, one per real step inside the service:
`message.ingested`, `extraction.started` / `extraction.finished`, `work.started` / `work.finished` (op: `embed.messages`, `context`, `embed.memories`, `recall`, `consolidation`; id, duration — work without an LLM call), `llm.started` (prompt id, task — the call left) and `llm.call` (prompt id, model, tokens, latency, status),
`memory.written` (episodes / facts / notes with kind and author role), `episode.linked` (duplicate / corrects),
`recall.served` (tool, mode, returned episode and claim ids, counts), `digest.written`, `consolidation.finished`,
`episode.forgotten`. Metadata only — ids, kinds, counts, tokens — never message or memory content. Nothing is
synthesised: the dashboard (WORK_PLAN 5b.6) moves only when these events arrive. Versioned contract: `ATLAS_EVENTS.md`.

Recall log: every `search_episodes` / `search_memory` served writes one `recall_log` row (tool, mode, item count,
conversation; never the query or the memories) — the source of the atlas totals and of the recall-echo guard (D38).

`GET api/v1/admin/owners/:id/atlas` — the dashboard's starting map of one owner: episodes as neurons (kind, author
role, importance, day, plan status, hidden state, position by meaning = first three principal components of the
embeddings), real edges (nearest neighbours in meaning, corrections, duplicates, plan → outcome, reschedules, shared
people), facts / notes / digests as the cortex, and the owner's lifetime `totals` (LLM calls, input / output tokens,
recalls — from `llm_calls` and `recall_log`). Metadata only.
