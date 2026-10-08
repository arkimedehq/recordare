# API contracts v1

Status: **M1 contracts, revision 3** (2026-10-03): consistency + security reviews applied, then split
into deployment profiles (§0) so v1 stays focused on the twin.
**Built (2026-10-08)**: §2 ingest (with `…/end`), §3 MCP tools (as noted per tool) and the pre-turn memory context
(`POST api/v1/context`, with `ingest`), the §4 rows the host diary needs (WORK_PLAN 4.7), `GET / PATCH api/v1/me`, §5
client library, the admin API and console, live telemetry and the atlas snapshot; `GET api/v1/health` (no auth:
liveness and database reachability). Sections or rows marked **not built yet (v1 plan)** are the contract still to
build (the other §4 rows, OpenAPI, `Idempotency-Key`).
Client-neutral: nothing here is specific to Arkimede. Data model: `DATA_MODEL.md`. Two integration
levels (vision → Architecture): **basic** = MCP tools only; **full** = REST ingest + MCP + read API
+ SDK.

Conventions: JSON over HTTPS; controllers hard-code `api/v1/…` (no global prefix); ISO 8601 with
offset; uuids; errors as RFC 9457 problem details (`{type, title, status, detail, code}`); zod
schemas are the single source of truth and generate `GET /api/v1/openapi.json` (**not built yet**); pagination
`?cursor&limit` → `{items, nextCursor}` (as built only `GET api/v1/episodes` pages; the other §4 lists return plain
arrays); every non-idempotent POST accepts an `Idempotency-Key`
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
**v1**: owners are created by the admin (`POST api/v1/admin/owners`), or auto-provisioned at a client's first
request when that client allows it (`autoProvision`, named after the client's user id until the client renames them);
consent (`episodicEnabled`), personal tokens and identity bindings are managed through the admin API (and its console,
§6) — as built no route lets an owner personal token change them; there are no owner pages. Nightly consolidation runs on its own (`CONSOLIDATION_HOUR`, owner's timezone); `POST api/v1/admin/owners/:id/consolidate` runs it now (honours `X-Recordare-Now` where allowed); `POST api/v1/admin/owners/:id/review-facts` runs the facts review alone now (WORK_PLAN 5.6, same lock as the consolidation). Quality profile (D35): `qualityProfile` `economy | balanced | full` on owner create /
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
| Basic | **Personal access token** `rp_…`, bound to one owner + one client, created by the owner (owner session; v1: by the admin, `POST api/v1/admin/owners/:id/tokens {clientId, scopes, expiresAt?}`) — for header-capable MCP clients (Claude Code, Cursor, SDKs); with `ingest` and `read` too it also serves full-level connectors for one person (`connectors/`). Disabling its client stops it | That owner |
| Basic (OAuth) — public profile | **OAuth 2.1** per the MCP authorization spec (code + PKCE, dynamic client registration, protected-resource metadata); the owner logs in (magic link) and consents — for clients that require it (Claude Desktop / claude.ai connectors). Scheduled for M6; personal tokens cover M3–M5 | That owner |
| Admin | API key with scope `admin` (v1: the installation's single `ADMIN_API_KEY`, set in its environment) | Installation management |

### Scopes
| Scope | Allows |
|---|---|
| `ingest` | §2 ingest, edits, deletions, `…/end` of the client's own conversations; `ingest` inside `POST api/v1/context`; `PATCH api/v1/me` (client keys) |
| `mcp` | §3 tools (reads + `log_episode`, `remember`, `correct_episode`, `forget_episode`) |
| `read` | §4 GET endpoints, `GET api/v1/me`, `POST api/v1/context` |
| `write` | §4 manual entries, corrections, forgetting, fact / note edits |
| `owner_settings` | `PATCH settings` incl. `episodicEnabled` — never client API keys (consent, D4). v1: admin key or the owner's personal token; public profile: owner sessions / owner-created tokens. As built no route uses it yet: consent is set by the admin (`PATCH api/v1/admin/owners/:id`) |
| `export` | §4 export jobs — v1: admin key or the owner's personal token; public profile: owner sessions only, expiring download. Not built yet |
| `admin` | `api/v1/admin/…` (as built: only the `ADMIN_API_KEY` credential; a key or token listing `admin` gets no admin route) |

Client keys are created with `ingest`, `mcp`, `read`, `write` only (`POST api/v1/admin/clients/:id/keys {scopes}`);
`admin`, `owner_settings` and `export` are never given to a client key.

Keys and tokens: argon2id hashes, shown once, visible prefix, rotation by create + revoke. A
client can never mint tokens for another client. `Idempotency-Key` replays are scoped to
`(credential, owner, method + path)`; v1 keeps them in Redis for 24 h (persistent table in the
public profile).

### Viewer context (who will see the result) — every read
The viewer set is **resolved by Recordare, never asserted by the client or the LLM**:
- **Client API keys and MCP sessions opened with them**: the only accepted source is
  `X-Recordare-Conversation: <externalConversationId>` (MCP calls may carry it as `_meta.recordare.conversation`
  instead), resolved against the participants Recordare has ingested for that conversation. `X-Recordare-Viewers` and `_meta.recordare.viewers` may only
  **add** viewers (narrowing what is returned), never replace the resolved set. A read **without a
  resolvable conversation returns nothing**.
- **Personal tokens and owner sessions** (owner-direct use, e.g. Claude Code): no header → viewers =
  the owner; a conversation header, if sent, applies as above — except that a conversation not stored yet (a client
  reading before it ingests) counts as the person's own (viewers = the owner).
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

Admin (`api/v1/admin/…`), built: `POST clients {name, kind: platform | mcp_client | import, autoProvision?,
rawLogScope?}`, `GET clients`, `PATCH clients/:id`, `POST clients/:id/keys {scopes}` (→ `{id, key, prefix}`, the key
shown once), `DELETE keys/:id`, `POST owners {displayName, kind?, locale? (it | en), timezone?, episodicEnabled?,
qualityProfile?}`, `PATCH owners/:id`, `GET persons`, `POST identities {kind: client_user, personId, clientId,
externalId} | {kind: channel, personId, ownerScope?, channel, externalId, verified?}`, `DELETE identities/:id`,
`POST owners/:id/tokens` (→ `{id, token, prefix}`), `DELETE tokens/:id`, `POST owners/:id/consolidate`,
`POST owners/:id/review-facts`, `GET owners` (owners with memory size, for the atlas), `GET owners/:id/atlas`,
`GET telemetry/stream` (§6; the console routes are described there). Revocations take effect at once (the credential
cache is cleared). Not built yet: owner export / full erasure jobs.

## 2. REST ingest (task 1.2) — full integration

### `POST api/v1/ingest/messages` (scope `ingest`)
A client key names the person with `X-Recordare-User`; a personal token with `ingest` ingests for its owner (the
connectors for one person). The admin credential cannot ingest (403).
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
- **Owner without `episodicEnabled`** → nothing is stored, `stored: false`, `conversationId: null` (no raw log without
  consent); Recordare only notes when it last refused (`owners.ingest_refused_at`), so the admin console shows the
  person as waiting for consent (WORK_PLAN 6.6b). Disabling it later stops ingest and extraction; existing memories
  stay until the owner deletes them ("disable and erase" is offered on the owner page — public profile).
- Each accepted batch (re)schedules the conversation's idle job (D1, D5, global delay); messages
  are extracted when pending, by `sentAt`, so late or out-of-order messages are never skipped.

### Edits and deletions
- `PATCH api/v1/ingest/conversations/{externalId}/messages/{messageExternalId}` `{content}` → `204` (`404` when
  unknown); the previous text goes to `message_revisions` and the message is extracted again.
- `DELETE …/messages/{messageExternalId}`, `DELETE api/v1/ingest/conversations/{externalId}` →
  purge (`DATA_MODEL.md` → Forgetting and deletion). As built: the purge runs synchronously and returns `202` with no
  body (plan: `202` + job id); `404` when unknown (the client library treats it as done).
- `POST api/v1/ingest/conversations/{externalId}/end` → `202`: the conversation ended on the client (session closed,
  /new) — extraction runs now instead of after the idle delay; `404` for a conversation never ingested (so also when
  nothing was stored for lack of consent). Same effect as `hints.conversationEnded` (honoured also on a batch whose
  messages are all duplicates), without re-sending a message.

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
return nothing and writes (`log_episode`, `remember`, `correct_episode`) are rejected with `{error: "memory is off for this
person"}`; `forget_episode` stays allowed. As built: a session is opened only by an `initialize` request (`404` for an
unknown session id); the admin credential gets `403`; a request from another credential than the one that opened the
session is refused like an owner mismatch. Writes need a resolvable context — a personal token, or a conversation
Recordare has ingested — otherwise they return `{error: "cannot write here"}`. The published tool schemas are in
`packages/client` (`TOOLS`, kept in sync by the conformance suite) for connectors that declare tools up front.

### `log_episode` (D11)
| Param | Type | Notes |
|---|---|---|
| `content` | string, required | |
| `kind` | `"event" \| "plan"` | default `event` |
| `occurred_at`, `occurred_until` | string | ISO date resolved by the agent (as built `YYYY-MM-DD` or `YYYY-MM`; a datetime is rejected) |
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
  row invalidated; returns `{id, stored}` (the new row's id).
- `forget_episode {id}` → forgetting as in `DATA_MODEL.md` (tombstone, no comeback); returns `{forgotten: true}`.

### `search_episodes` (D12, D13, D29)
| Param | Type | Notes |
|---|---|---|
| `query` | string | Optional for pure period overviews |
| `from`, `to` | string | ISO dates (`YYYY-MM-DD`, or `YYYY-MM` = the whole month), inclusive, matched by overlap (`resolve_period` helps) |
| `mode` | `"search" \| "list" \| "latest"` | `search` relevance; `list` chronological in range; `latest` most recent matches first |
| `include_plans` | boolean | default true |
| `limit` | integer, 1–50 | defaults: search 10, list 30, latest 5 |

Returns (as built):
```ts
{
  owner: { name: string };                            // whose memory: items speak of this person in the third person
  period?: { from: string | null; to: string | null };
  digests: Array<{ level: "day" | "month"; from: string; to: string; text: string }>;  // list mode with a period (knob, below)
  episodes: Episode[];                                // in period / matching; what the owner lived, said or planned
  claims: Episode[];                                  // other people's / tools' statements (authorRole other | tool), kept apart
  outsidePeriod: Episode[];                           // same shape; filled only when the period has no match (max 5)
  fromChats: Array<{ conversationId: string; conversation: string; messageId: string; at: string;
                     authorRole: "owner" | "other" | "tool"; author?: string; excerpt: string }>;
  notes: string[];                                    // e.g. unresolved plans, claims / others' excerpts notice
}
type Episode = {
  id: string; kind: "event" | "plan" | "state_change"; content: string;
  when: string;                                       // human-readable, with precision
  planStatus?: "open" | "confirmed" | "cancelled" | "rescheduled" | "unresolved";
  rescheduledTo?: string; origin: "owner_lived" | "owner_told" | "assistant_stated";
  authorRole: "owner" | "assistant" | "other" | "tool";   // who wrote the evidence
  claimedBy?: string[];                               // for claims: who wrote the evidence
  inferred: boolean;
  people: string[]; feelings: string[]; opinion?: string;
  source: { conversation: string; messageIds: string[]; at: string };   // conversation = the client's own id
};
```
In a conversation others take part in, every list is empty and `notes` says `"nothing to show here"`.
Every item carries `authorRole` (`owner | assistant | other | tool`) so hosts can wrap non-owner
content as data, not instructions; such items also carry `claimedBy` (the names of who wrote the evidence), every
result names its `owner` (items speak of the owner in the third person: that is the user asking), chat excerpts carry
their `author` when not the owner; when such items are returned, `notes` says so explicitly (M4b: answer models
ignored the bare field). `digests` (M5): for `list` requests with a period, the diary of that period — day entries for spans up to 45 days, month summaries for longer ones; they summarise the owner's own episodes only (never other people's claims). As built they are returned only when `RECALL_DIGESTS` is on (off in every quality profile by default — `KNOBS.md`); otherwise `digests` is empty. `fromChats` (raw log, D13) always carries up to 2 excerpts not already behind the returned
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
  `user` message as evidence, same rules as `log_episode`); without such evidence it is stored as an inferred,
  **pending** note (`origin: assistant_stated`) the owner confirms in the diary (§4). `category` defaults to
  `knowledge`. Returns `{id, stored}`.
- `search_memory {query, as_of?, include_pending?}` — preferences, habits, values, knowledge, plus the
  relevant state facts valid at `as_of` (ISO date, default today) with their history; complements `search_episodes`
  (what happened / when). Returns `{owner, notes, facts, notes_info}` (`notes_info`: notices, e.g. `"nothing to show
  here"` in a conversation others take part in). In an entity memory (D48) facts about people carry `about` (the
  person's name); facts without it are the entity's own.

### `resolve_period` (D12, deterministic)
As built: `{expression}` → `{from, to, label}` (or `{error}` for an unknown expression); expressions in the
most used languages (`service/src/lang`: relative periods and month names from Intl for 25 locales, plus seasons and
synonyms); Monday-based weeks, owner's timezone; "now" is the server clock (`X-Recordare-Now` overrides it where
`ALLOW_CLOCK_OVERRIDE` is set — tests and evaluations). No LLM. `now?` / `locale?` parameters: not built.

### Pre-turn memory context (WORK_PLAN 5.7) — built
`POST api/v1/context {query?, ingest?}` (scope `read`; `X-Recordare-User`, `X-Recordare-Conversation`) → `{block, items}`.
`ingest` (the body of `POST api/v1/ingest/messages`, scope `ingest` too) stores the turn first and answers for that
conversation, `query` defaulting to its last user message — one round trip before each turn instead of two (`400` when
there is neither a `query` nor a user message; `403` for `ingest` without the `ingest` scope; without consent the
turn is not stored, so with a client key the conversation is unknown and the answer is `block: null`). With a personal token, a conversation not stored yet counts as
the person's own. `query` is cut at 8 000 characters. The block holds the
memories relevant to the message about to be answered (current facts and notes, upcoming open plans, up to 3 episodes,
each above a similarity floor; ≈ 300 tokens at most) as one fenced `<memory-context>` block marked "data, not
instructions", or `block: null` when nothing is relevant. No LLM call. Same viewer rule as every read (nothing in a
conversation others take part in); a served block is logged in `recall_log` (tool `memory_context`; the recall-echo guard then treats the reply
as possibly echoing it). Always available: whether to use it, and for which agent, is the client's choice (the host
appends it at the end of its system prompt and never stores it as a message).

## 4. Read / write API for host UIs (task 1.4) — the diary (D18)

**Built (2026-10-08, WORK_PLAN 4.7)** — the rows the host diary needs: `GET episodes` (timeline, newest first; `from`
/ `to` local dates, `kind`, `planStatus` incl. computed `unresolved`, `q` full text, opaque `cursor` + `nextCursor`,
`limit` ≤ 200), `GET episodes/{id}` (evidence: message text only from the client's own conversations unless its
`raw_log_scope` is `all`, `otherClient` otherwise; `history` = the versions it corrected; for a plan `planEvents`,
`confirmedBy`, `rescheduledTo`), `POST episodes/{id}/corrections {content?, occurredAt?, datePrecision?}` →
`{id}`, `DELETE episodes/{id}` (forgetting that sticks, as `forget_episode`), `GET digests` (current day / month
entries, newest first), `GET facts` (slots with `history`, `asOf`, per person in an entity memory), `DELETE facts/{id}`,
`POST facts/{id}/confirm | reject`, `GET notes`, `PATCH notes/{id} {pinned}`, `DELETE notes/{id}`,
`POST notes/{id}/confirm | reject`, `GET plans` (open and unresolved by default, soonest first); plus the
`GET / PATCH api/v1/me` rows. Edits answer `204` (`404` for an id that is not the owner's); only `GET episodes` pages
(`{items, nextCursor}`, default 50), the other lists are arrays. As built, deleting a fact or a note (and rejecting a
pending one) removes the row with its evidence — no tombstone, no `note_changes` entry; confirming makes it stated
(`pending` false). **Not built yet**: manual entry, fact / note corrections, promotions (5.4), forgetting a period
(5.5), settings, usage, exports, the notes change feed, `GET facts/{id}` / `GET notes/{id}`. Client library:
`packages/client` (`episodes`, `episode`, `digests`, `facts`, `notes`, `plans`, `correctEpisode`, `forgetEpisode`,
`pinNote`, `delete`, `decide`).

Scoped to the owner, and the reader is the owner themself in the host's UI (owner-direct): a client key names the person
with `X-Recordare-User` (scope `read` to read, `write` to edit), a personal token is the person; no conversation header,
no viewer resolution (the viewer rule is for answers inside conversations). In an entity memory everyone using the
account sees all of it (D48).

| Method + path | Scope | Purpose |
|---|---|---|
| `GET api/v1/episodes?from&to&kind&planStatus&q&cursor&limit` | read | Timeline |
| `GET api/v1/episodes/{id}` | read | Detail: evidence (quotes filtered by `raw_log_scope`; owner-direct, so no viewer rule), correction history, linked plan / event |
| `POST api/v1/episodes` | write | Manual entry |
| `POST api/v1/episodes/{id}/corrections` | write | Correction (new row, `corrects`) |
| `DELETE api/v1/episodes/{id}` | write | Forget one episode |
| `POST api/v1/forget {from, to, keepRaw?}` | write | Forget a period (async job) |
| `GET api/v1/digests?level&from&to` | read | Diary entries (`level` `day \| month`) |
| `GET api/v1/facts?key&asOf&status&includePending` / `GET …/{id}` | read | Facts with history (as built: `key`, `asOf`, `includePending`; no `status` filter) |
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
| `GET api/v1/me` | read | Who the request acts for: `{ownerId, displayName, kind, episodicEnabled, atlasUrl?, via, scopes}` (`atlasUrl`: `ATLAS_URL`, when the atlas is installed) (`kind` `entity` = a shared memory: the client tells its users so) (`episodicEnabled` = the owner's consent: until it is given, ingest stores nothing) (with a client key: the person behind `X-Recordare-User`, auto-provisioned if the client allows it; `via` `client \| owner_token`) |
| `PATCH api/v1/me {displayName?, kind?}` | ingest (client key; a personal token gets 403) | The person's settings from their platform: the name follows the client's user (sync on every rename); `kind` `human \| entity` (D48) only while the memory has no episode, fact or note → else 409 `memory_not_empty` (the admin can still change it). Consent is never set here |
| `GET api/v1/me/identities`, `DELETE api/v1/me/identities/{id}` | owner session (public profile) | Connected clients / identities, revoke |

## 5. Client library (task 1.6, WORK_PLAN 6.7) — built (2026-10-07)

`@arkimedehq/recordare-client` in `packages/client/` (its README): `RecordareClient` (`me`, `updateMe`, `ingest` split
into requests of 500, `context` / `contextWithTurn` (§3 pre-turn memory context, with `ingest`), `endConversation`,
`editMessage`, `deleteMessage` / `deleteConversation` with 404 = done, the §4 wrappers `episodes`, `episode`,
`correctEpisode`, `forgetEpisode`, `digests`, `facts`, `notes`, `plans`, `pinNote`, `delete`, `decide`, `mcp.listTools` /
`mcp.callTool` over the official MCP SDK with one session per user + conversation), `TOOLS` (the published MCP tool
schemas), `PersonDirectory` (cached person, consent, kind and Atlas address; the platform's opt-in; name sync),
`afterFailure` (outbox delivery policy: back-off with jitter, `Retry-After`, park on 400 / 413 / 422), typed errors
(RFC 9457). A host keeps only its outbox storage and its chat mapping. A conformance suite runs it against the service
in CI (`service/test/conformance`). Built on it: the OpenClaw connector and the OpenAI-compatible memory proxy
(`connectors/`); the Claude Code / Codex hook script (dependency-free) and the Hermes connector (Python) call the same
routes directly.

## 6. Versioning and compatibility
- Breaking changes only under `api/v2/…`; additive changes within v1; MCP tool names stable, new
  parameters optional.
- Contract tests (M3) run the same scenarios through REST + MCP, both levels, including the
  viewer-context rule (shared conversations get nothing).

### Admin console (WORK_PLAN 6.9)
`GET /admin` serves a static page (public: it holds no data) over the admin API; the operator types the admin key, kept
in that browser tab only (strict CSP, `no-store`). Routes it uses besides those above, all admin only and metadata only:
`GET api/v1/admin/owners/{id}/runs?conversation=&limit=` (a person's recent extraction runs with their summary — returned,
written, dropped and why, counts only; WORK_PLAN 4.12), `GET api/v1/admin/persons` (owners with settings, message / episode / fact / note counts, pending extraction, last
message, `waitingForConsentSince` — when a client last sent messages while consent was off, `owners.ingest_refused_at`,
null once consent is on — linked identities, active personal tokens by prefix), `GET api/v1/admin/clients` (clients with active keys by prefix),
`PATCH api/v1/admin/clients/:id {autoProvision?, disabled?}` (disabled = every key and token of the client stops at
once), `DELETE api/v1/admin/identities/:id` (unlinks a client's user from a person; memories stay). The console uses
the other admin routes of §1 for the rest (consent, memory kind, quality profile, name, identities, personal tokens,
client keys, consolidate); it is in Italian and English.

### Live telemetry (M5b, admin only)
`GET api/v1/admin/telemetry/stream[?owner=<personId>]` — Server-Sent Events, one per real step inside the service:
`message.ingested`, `extraction.started` / `extraction.finished`, `work.started` / `work.finished` (op: `embed.messages`, `context`, `embed.memories`, `recall`, `consolidation`; id, duration — work without an LLM call), `llm.started` (prompt id, task — the call left) and `llm.call` (prompt id, model, tokens, latency, status),
`memory.written` (episodes / facts / notes with kind and author role), `episode.linked` (duplicate / corrects),
`recall.served` (tool, mode, returned episode and claim ids, counts), `digest.written`, `consolidation.finished`,
`episode.forgotten`. Metadata only — ids, kinds, counts, tokens — never message or memory content. Nothing is
synthesised: the dashboard (WORK_PLAN 5b.6) moves only when these events arrive. Versioned contract: `ATLAS_EVENTS.md`.

Recall log: every `search_episodes` / `search_memory` served, and every memory-context block served (tool
`memory_context`), writes one `recall_log` row (tool, mode, item count,
conversation; never the query or the memories) — the source of the atlas totals and of the recall-echo guard (D38).

`GET api/v1/admin/owners/:id/atlas` — the dashboard's starting map of one owner: episodes as neurons (kind, author
role, importance, day, plan status, hidden state, position by meaning = first three principal components of the
embeddings), real edges (nearest neighbours in meaning, corrections, duplicates, plan → outcome, reschedules, shared
people), facts / notes / digests as the cortex, and the owner's lifetime `totals` (LLM calls, input / output tokens,
recalls — from `llm_calls` and `recall_log`). Metadata only.
