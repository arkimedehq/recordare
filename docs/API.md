# API contracts v1

> Since D50 (2026-10-09) Recordare has no consent flag: every memory stores what its client sends; the on/off switch
> belongs to the client platform (WORK_PLAN 8.1).

Status: **M1 contracts, revision 3** (2026-10-03): consistency + security reviews applied, then split
into deployment profiles (§0) so v1 stays focused on the twin.
**Built (2026-10-08)**: §2 ingest (with `…/end`), §3 MCP tools (as noted per tool) and the pre-turn memory context
(`POST api/v1/context`, with `ingest`), the §4 rows the host diary needs (WORK_PLAN 4.7), `GET / PATCH api/v1/me`, §5
client library, the admin API and console, live telemetry and the atlas snapshot; `GET api/v1/health` (no auth:
liveness and database reachability). **Built (2026-10-10, WORK_PLAN 8.9, D49)**: learned sources — §2 source ingest,
§3 `search_knowledge` / `learn_source`, the §4 source rows. Sections or rows marked **not built yet (v1 plan)** are the contract still to
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
Request bodies: JSON up to `MAX_REQUEST_BYTES` (default 16 MB, `KNOBS.md`); a bigger body → `413` `payload_too_large`,
malformed JSON → `400` `invalid_json` (both problem details, never a 500). A learned source bigger than that arrives in
parts (§2).

## 0. Deployment profiles (D33)

| Profile | For | Contents |
|---|---|---|
| **v1 — home / research** (built now) | One installation run by its operator(s) and their own clients (Arkimede, Claude Code, the research simulator) | Memories and identities created by the **admin API**; client API keys; **personal access tokens** for MCP-only clients (created via admin API); hashed credentials and simple scopes; per-memory isolation; conversation resolved by Recordare (the viewer filter on answers is gone with D50: privacy and disclosure come later); `author_role` provenance; forgetting that sticks |
| **Public** (deferred — M7 / public release) | Recordare as a service for people the operator does not know | Holder login (email magic link, verified email, holder pages), OAuth 2.1 for MCP connectors, holder-driven link codes + revocation UI, `read_audit`, persistent idempotency table, backup-retention policy and provider-retention notice, export restricted to holder sessions; network-level protection (firewall / WAF / rate limits) in front |

Items marked **(public profile)** below are specified so the design stays coherent, but are not
built in v1. Nothing in the public profile changes memory rows, so enabling it later needs no data
migration.

## 1. Identity, authentication, conversation context (tasks 1.1, 1.5 → D24)

### Model
- **Memory** (the `memories` row, D50): the memory of one client account — an agent's. Its own person row carries
  the account's name (in a personal memory, the name of "I"). **Contacts**: the people a memory knows, persons scoped to
  that memory only (the same human in two memories is two unrelated contacts).
- **Client**: a platform integration (Arkimede installation, Claude Desktop setup, import tool).
- **External identity** (WORK_PLAN 8.3): `account` (`clientId + externalUserId` → the memory that client account opens)
  or `participant` (a client's participant id `clientId + externalId`, or a channel id `telegram:…`, `phone:+39…`,
  `email:…` → the self or a contact **of one memory**); only verified participant bindings identify interlocutors, and
  a participant identity never opens a memory.

### Holder authentication (public profile)
**v1**: memories are created by the admin (`POST api/v1/admin/memories`), or auto-provisioned at a client's first
request when that client allows it (`autoProvision`, named after the client's user id until the client renames them);
personal tokens and identity bindings are managed through the admin API (and its console,
§6) — as built no route lets a personal token change them; there are no holder pages. Nightly consolidation runs on its own (`CONSOLIDATION_HOUR`, the memory's timezone); `POST api/v1/admin/memories/:id/consolidate` runs it now (honours `X-Recordare-Now` where allowed); `POST api/v1/admin/memories/:id/review-facts` runs the facts review alone now (WORK_PLAN 5.6, same lock as the consolidation). Quality profile (D35): `qualityProfile` `economy | balanced | full` on memory create /
`PATCH api/v1/admin/memories/:id` (`null` = the installation default `QUALITY_PROFILE`, `balanced` unless set). The same
routes take `mode` `personal | entity` (D50: `personal` — the account holder is "I", undeclared input is the memory's
own; `entity` — a memory shared by everyone using the account, a home device, a robot, a place: undeclared input is
"someone"'s) and `gender` `masculine | feminine | neutral` (the first person in gendered languages, default
`masculine`), and `PATCH` takes `displayName` (a client's later sync of its user's name overwrites it: the name follows the platform).

**Public profile**: holders log in to Recordare's own pages with an **email magic link** (no passwords; passkeys and
OIDC later). The holder session is needed for: creating link
codes, revoking clients, authorising OAuth MCP clients, creating personal tokens, exports, the
self-service diary.
- The holder's email is set **only** through a verification mail the holder opens (claim flow); it is
  never taken from client or ingest payloads, and changing it requires the current holder session
  plus verification of the new address.
- Magic links: single use, ≤ 15 min, rate-limited per address and IP, bound to the browser that
  requested them; new-login notifications by email.
- An auto-provisioned memory (created by a client) has no email until claimed: until then its
  memory is exactly as protected as that client's key, and it has no holder pages. Host toggles
  (e.g. Arkimede's "enable diary") **open Recordare's holder page**; they never change memory settings
  with the client key.

### Credentials (D24)
| Level | Credential | Acts as |
|---|---|---|
| Full | **Client API key** `Authorization: Bearer rk_…` | Memories mapped to that client, selected per request with `X-Recordare-User: <externalUserId>` |
| Basic | **Personal access token** `rp_…`, bound to one memory + one client, created by the holder (holder session; v1: by the admin, `POST api/v1/admin/memories/:id/tokens {clientId, scopes, expiresAt?}`) — for header-capable MCP clients (Claude Code, Cursor, SDKs); with `ingest` and `read` too it also serves full-level connectors for one person (`connectors/`). Disabling its client stops it | That memory |
| Basic (OAuth) — public profile | **OAuth 2.1** per the MCP authorization spec (code + PKCE, dynamic client registration, protected-resource metadata); the holder logs in (magic link) and consents — for clients that require it (Claude Desktop / claude.ai connectors). Scheduled for M6; personal tokens cover M3–M5 | That memory |
| Admin | API key with scope `admin` (v1: the installation's single `ADMIN_API_KEY`, set in its environment) | Installation management |

### Scopes
| Scope | Allows |
|---|---|
| `ingest` | §2 ingest, edits, deletions, `…/end` of the client's own conversations; §2 learned sources (`api/v1/ingest/sources…`); `ingest` inside `POST api/v1/context`; `PATCH api/v1/me` (client keys) |
| `mcp` | §3 tools (reads + `log_episode`, `remember`, `learn_source`, `correct_episode`, `forget_episode`) |
| `read` | §4 GET endpoints (`GET api/v1/sources` included), `GET api/v1/me`, `POST api/v1/context` |
| `write` | §4 manual entries, corrections, forgetting (a learned source included), fact / note edits |
| `memory_settings` | `PATCH settings` (locale, timezone, quality profile) — never client API keys. v1: admin key or the memory's personal token; public profile: holder sessions / holder-created tokens. As built no route uses it yet: these settings are set by the admin (`PATCH api/v1/admin/memories/:id`) |
| `export` | §4 export jobs — v1: admin key or the memory's personal token; public profile: holder sessions only, expiring download. Not built yet |
| `admin` | `api/v1/admin/…` (as built: only the `ADMIN_API_KEY` credential; a key or token listing `admin` gets no admin route) |

Client keys are created with `ingest`, `mcp`, `read`, `write` only (`POST api/v1/admin/clients/:id/keys {scopes}`);
`admin`, `memory_settings` and `export` are never given to a client key.

Keys and tokens: argon2id hashes, shown once, visible prefix, rotation by create + revoke. A
client can never mint tokens for another client. `Idempotency-Key` replays are scoped to
`(credential, memory, method + path)`; v1 keeps them in Redis for 24 h (persistent table in the
public profile).

### Conversation context — no viewer filter (D50, WORK_PLAN 8.2)
**Behaviour now (2026-10-09)**: every answer — MCP recall, the memory context — uses the **whole memory**, in every
conversation: one only the holder takes part in, a shared or group conversation, a conversation Recordare has not stored,
or no conversation at all. Who may be told what (privacy, disclosure) comes later (WORK_PLAN 8.12); the `audience` /
`disclosure` columns are still written, so that work starts from recorded data. **Per-memory isolation stays**: a
request only ever opens the memory its credential and `X-Recordare-User` name.

The conversation is still **resolved by Recordare, never asserted by the client or the LLM**, from
`X-Recordare-Conversation: <externalConversationId>` (MCP calls may carry it as `_meta.recordare.conversation` instead),
against the conversations this client has ingested for the memory. It is used for:
- **MCP writes** (`log_episode`, `remember`, `correct_episode`, `forget_episode`): they need a resolvable context — an
  ingested conversation (its recent messages are the evidence of the write), or a personal token (memory-direct; without
  a stored conversation the holder's recent messages from this client count). A client key without one gets
  `"cannot write here"`.
- leaving the current turn out of the chat excerpts (`fromChats`), and the `recall_log` row.

`X-Recordare-Viewers` and `_meta.recordare.viewers` are **gone** (they could only narrow what the viewer filter
returned): Recordare ignores them. The `"nothing to show here"` notice is gone too.

*Superseded (phase-1 rule, D24 / D33 → D50)*: memories — and raw data derived from chats — were returned only when the
viewers were exactly the holder (client keys needed a resolvable conversation whose participants were only the holder;
extra viewers could only narrow); otherwise an empty answer with `"nothing to show here"`. Kept here as the starting
point of the later privacy work (`RESEARCH_NOTES.md` H2).

### Linking the same person across clients
**v1**: the admin binds identities (`POST api/v1/admin/identities`, §1 admin routes): an `account` to a memory, a
`participant` to the self or a contact of one memory; binding an id already bound, an account to a person that is not a
memory, or a participant to a person outside that memory fails with a generic `400 cannot_link`. Ingest also creates
participant identities (§2).

**Public profile**:
1. In a **holder session**, the holder picks the target client and creates a link code
   (`POST api/v1/me/link-codes {clientId}` → `{code, expiresAt}`, single use, 10 min), seeing what
   that client will get: episodes and facts of all clients; raw chats only of its own conversations
   (`clients.raw_log_scope = own`, widenable by the holder).
2. That client submits it: `POST api/v1/identities/link {code, externalUserId}`; redemption by any
   other client is rejected. The holder receives a notification.
3. If the `externalUserId` is already bound to another memory, the link fails with a generic
   `400 cannot_link` (no hint that the id exists) — person merge is not supported in v1.
4. The holder can list and revoke connected clients and identities at any time:
   `GET api/v1/me/identities`, `DELETE api/v1/me/identities/{id}` (holder session).

Admin (`api/v1/admin/…`), built: `POST clients {name, kind: platform | mcp_client | import, autoProvision?,
rawLogScope?}`, `GET clients`, `PATCH clients/:id`, `POST clients/:id/keys {scopes}` (→ `{id, key, prefix}`, the key
shown once), `DELETE keys/:id`, `POST memories {displayName, mode? (personal | entity), gender? (masculine | feminine |
neutral), locale? (it | en), timezone?, qualityProfile?}`, `PATCH memories/:id` (same fields; the admin may change the
mode of a memory that is not empty), `GET persons`, `POST identities {kind: account, personId (a memory), clientId,
externalId} | {kind: participant, memoryId (the memory), personId (its self or one of its contacts), clientId |
channel (exactly one), externalId, verified?}`, `DELETE identities/:id`,
`POST memories/:id/tokens` (→ `{id, token, prefix}`), `DELETE tokens/:id`, `POST memories/:id/consolidate`,
`POST memories/:id/review-facts`, `GET memories` (memories with their size, for the atlas), `GET memories/:id/atlas`,
`GET telemetry/stream` (§6; the console routes are described there). Revocations take effect at once (the credential
cache is cleared). Not built yet: memory export / full erasure jobs.

## 2. REST ingest (task 1.2) — full integration

### `POST api/v1/ingest/messages` (scope `ingest`)
A client key names the person with `X-Recordare-User`; a personal token with `ingest` ingests for its memory (the
connectors for one person). The admin credential cannot ingest (403).
```ts
{
  conversation: {
    externalId: string;
    source?: "chat" | "voice" | "import_chat" | "import_social" | "import_email"
           | "import_notes" | "interview"
           | "document" | "perception" | "ambient";       // default "chat"
    channel?: string; title?: string;
    participants?: Array<{
      ref: string; role: "holder" | "assistant" | "other"; displayName?: string;
      identity?: { channel: string; externalId: string } | { externalUserId: string };
      // resolved inside this memory only: its participant identity, or the account's own
      // user id (the self); seen for the first time → a new contact of this memory
      // (named after displayName); an unverified binding identifies nobody
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
    own?: boolean;                        // the agent's own content (knowledge given to it, its
                                          // perceptions, a document); role user | other only
  }>;
  hints?: { conversationEnded?: boolean };
}
```
Response **`200`** after the raw rows are written synchronously (extraction is always async):
`{conversationId, accepted, duplicates, conflicts: [externalId…]}`.
- Same `externalId` and same content → duplicate (ignored). Same `externalId`, different content →
  listed in `conflicts` (`409`-style per item) unless `upsert: true`, which records an edit.
- **No consent flag** (D50): every accepted message is stored, extracted and consolidated. Whether a memory is on is
  the client platform's switch: when it is off, the client does not send. Existing memories stay until they are
  deleted.
- Each accepted batch (re)schedules the conversation's idle job (D1, D5, global delay); messages
  are extracted when pending, by `sentAt`, so late or out-of-order messages are never skipped.
- **Attribution** (D50, WORK_PLAN 8.3): every message records who said it, as knowledge — `author_kind` `self` (personal
  memory: a `user` turn without another author, the `holder` participant, the account's own user id; method `account`),
  `contact` (a participant with an identity; method `client_assertion` for a client's user id, `declared` for a channel
  id), `someone` (anyone unidentified, and in an entity memory the account's speaker; method `none`), `agent`
  (`assistant`), `tool`, `own` (`own: true`) — with a confidence (1, or none when nothing was established). Not exposed
  by the read API yet. The extraction prompts show it (8.4, 8.5): `own` content and the assistant's turns are the
  agent's own ("me") in both modes.

### Edits and deletions
- `PATCH api/v1/ingest/conversations/{externalId}/messages/{messageExternalId}` `{content}` → `204` (`404` when
  unknown); the previous text goes to `message_revisions` and the message is extracted again.
- `DELETE …/messages/{messageExternalId}`, `DELETE api/v1/ingest/conversations/{externalId}` →
  purge (`DATA_MODEL.md` → Forgetting and deletion). As built: the purge runs synchronously and returns `202` with no
  body (plan: `202` + job id); `404` when unknown (the client library treats it as done).
- `POST api/v1/ingest/conversations/{externalId}/end` → `202`: the conversation ended on the client (session closed,
  /new) — extraction runs now instead of after the idle delay; `404` for a conversation never ingested. Same effect as `hints.conversationEnded` (honoured also on a batch whose
  messages are all duplicates), without re-sending a message.

### Learned sources (D49, WORK_PLAN 8.9)
What the agent learned — a manual, a page, a note, a book, its own text — kept apart from episodes, facts and notes and
searched with `search_knowledge` (§3). **Text only**: the client turns files (PDF, office documents, pages) into text.
**No size limit** per source or per memory: only the request body limit applies (`MAX_REQUEST_BYTES`), and a bigger
text arrives in parts (the client library does it, §5). Scope `ingest`; a client key names the person with
`X-Recordare-User`, a personal token is its memory; the admin credential gets 403.

`POST api/v1/ingest/sources` → `200`:
```ts
{
  externalId: string;                     // the client's own id; sending it again replaces the source (a new version)
  title: string;                          // ≤ 500
  kind?: "document" | "page" | "note" | "book" | "own_text";   // default "document"
  author?: string; uri?: string; language?: string;
  learnedAt?: string;                     // ISO with offset; default now
  providedBy?: "me" | "someone" | { name: string };   // default "me" (the memory's self); a name = a contact of
                                          // this memory, created when new (an ambiguous name stays "someone")
  conversation?: { externalId: string };  // the conversation it was learned in (its extraction then tells of it)
  text: string;                           // the text, or its first part
  final?: boolean;                        // default true; false = more parts follow
}
// response
{ sourceId: string; status: "receiving" | "indexing" | "ready"; parts: number; passages: number; duplicate: boolean }
```
- `POST api/v1/ingest/sources/{externalId}/parts` `{part, text, final?}` → `200`, same response: `part` is 1, 2, 3… in
  order (the first request is part 0); a part sent again is a duplicate, a gap → `409` `part_out_of_order`, a part after
  the final one → `409` `source_complete`, an unknown source → `404` `source_not_found`.
- The same `externalId` with the same first text and title → `duplicate: true`, nothing changes; with a new text → a new
  version (its passages replaced; the learning episode and its links stay).
- Each part is split into passages at once (no LLM: by Markdown headings, paragraphs, sentences, ≈ 1 000 characters
  each) and embedded in the background: status `receiving` (parts still to come) → `indexing` → `ready`; full-text search
  finds passages before their embeddings.
- **Learning is an episode** linked to the source: when the source names a conversation that still has messages to
  extract, that extraction tells of it (an episode citing the source); otherwise — or when the extraction leaves it out —
  Recordare writes it in code, no LLM, in the memory's language ("Il 10 ottobre 2026 ho imparato «Manuale della
  caldaia», da Paolo").
- `DELETE api/v1/ingest/sources/{externalId}` → `204`: forgets the source (its text and passages are deleted; the
  episodes that referred to it keep a "forgotten source" marker); one Recordare never had counts as done.

### Imports
`source: import_*` with historical `sentAt`, batched; extracted by the nightly path with topic
segmentation (D29); forward-only supersession by `sentAt`.

## 3. MCP tools (task 1.3) — both levels

Transport: **MCP streamable HTTP** at `/mcp`. **One MCP session per memory**: the memory is fixed
at `initialize` (the token's memory, or `X-Recordare-User` for client keys); every request re-validates
`X-Recordare-User` against the session's memory — a mismatch returns 403 and terminates the session
(hosts that reuse one session across users cannot cross memories). The conversation follows §1
(conversation header or `_meta.recordare.conversation`; answers use the whole memory, D50). Tool schemas use the provider-neutral subset
(D27). Tools are always listed (no hint whether a diary exists). As built: a session is opened only by an `initialize` request (`404` for an
unknown session id); the admin credential gets `403`; a request from another credential than the one that opened the
session is refused like a memory mismatch. Writes (`log_episode`, `remember`, `learn_source`, corrections, forgetting) need a resolvable context — a personal token, or a conversation
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

Returns `{id, stored}`. Evidence (as built): the holder's message in the conversation of the call received in the last
30 minutes whose text overlaps the content (trigram similarity ≥ 0.2, or the content found inside the message: word similarity
≥ 0.6) — with a personal token and no conversation named, the
holder's messages from the same client (a connector that ingests the turns); planned, not built yet: 10-minute dedup of agent
retries and late binding when the ingest has not arrived. **Importance 10 and `stance: stated` only when
the evidence binds to a `user` message of the holder**; otherwise (`stance: inferred`, confidence 0.6) (basic level, or no holder message)
the call is stored in a per-client daily conversation (`source: mcp_tool`, `evidence_kind:
agent_paraphrase`) with `origin: assistant_stated`, default importance and the label "noted by the
assistant" — so an injected tool output cannot create a high-importance "the user said" memory.

### `correct_episode` / `forget_episode` (D16, D18 — also for MCP-only memories)
- `correct_episode {id, content?, occurred_at?, date_precision?}` → new row with `corrects`, old
  row invalidated; returns `{id, stored}` (the new row's id).
- `forget_episode {id}` → forgetting as in `DATA_MODEL.md` (tombstone, no comeback); returns `{forgotten: true}`.
- Tool descriptions (8.4) speak of **your memory** — the agent's: what you lived, did, planned or learned, and what you
  know of the people around you, each item with its subject.

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
  memory: { name: string; mode: "personal" | "entity" };   // whose memory: personal — "I" is `name` (first person)
  speaker: { kind: "self" } | { kind: "someone" } | { kind: "contact"; name: string };  // who is asking (8.4, 8.5)
  period?: { from: string | null; to: string | null };
  digests: Array<{ level: "day" | "month"; from: string; to: string; text: string }>;  // list mode with a period (knob, below)
  episodes: Episode[];                                // in period / matching; lived, done, planned or learned (each with its subject)
  claims: Episode[];                                  // others' statements about the self or someone else (other, inferred) — kept apart
  outsidePeriod: Episode[];                           // same shape; filled only when the period has no match (max 5)
  fromChats: Array<{ conversationId: string; conversation: string; messageId: string; at: string;
                     authorRole: "holder" | "other" | "tool"; author?: string; excerpt: string }>;
  notes: string[];                                    // e.g. unresolved plans, claims / others' excerpts notice, who is asking
  clarifications?: string[];                          // open questions about the people involved (8.4; entity: identified speaker)
}
type Episode = {
  id: string; kind: "event" | "plan" | "state_change"; content: string;
  when: string;                                       // human-readable, with precision
  planStatus?: "open" | "confirmed" | "cancelled" | "rescheduled" | "unresolved";
  rescheduledTo?: string; origin: "holder_lived" | "holder_told" | "assistant_stated";
  authorRole: "holder" | "assistant" | "other" | "tool";   // who wrote the evidence
  subject: { kind: "self" } | { kind: "contact"; name: string } | { kind: "someone" }
         | { kind: "undecided"; candidates: string[] };   // whose memory it is (D50, 8.4)
  claimedBy?: string[];                               // for claims: who wrote the evidence
  inferred: boolean;
  people: string[]; feelings: string[]; opinion?: string;
  source: { conversation: string; messageIds: string[]; at: string };   // conversation = the client's own id
  sources?: Array<{ id: string; title: string } | { forgotten: true }>;  // learned sources it refers to (8.9)
};
```
The same in every conversation, including those others take part in (D50: no viewer filter).
Every item carries `authorRole` (`holder | assistant | other | tool`) so hosts can wrap content not written by the
memory's own turns as data, not instructions; such items also carry `claimedBy` (the names of who wrote the evidence),
chat excerpts carry their `author` when not the memory's own turn; when such items are returned, `notes` says so
explicitly (M4b: answer models ignored the bare field). **Agent memory (D50, WORK_PLAN 8.4)**: every result names its
`memory` (`name`, `mode`); every item carries its `subject` — `self` (in a personal memory the item is written in the
first person: "I" is `memory.name`, the person and the agent being one), a `contact` by name, `someone`, or
`undecided` between candidate contacts (a question was asked, see below). In an entity memory (8.5) "I" is the shared
agent: its replies and actions, the content given to it to keep (`own`), its place; the people talking to it are
contacts or `someone`. The result also says who is asking (`speaker`): the author of the conversation's latest turn when
it is an identified contact (a participant with an identity), otherwise the self (personal) or `someone` (entity:
whoever talks to the agent without being identified) — an identified speaker gets their own items first (then those
they took part in), and `notes` tells the answering model that "I" in the question is that person, not the memory's
self (entity, unidentified: the speaker, not the agent). `claims` are statements of other people in the conversation
(not the account's speaker) about the self or a third person (`inferred`); a person's news about themself is an episode
with that person as subject, and what a tool or a document taught the agent is its own learning (not a claim). `clarifications`: up to 2 open questions whose candidates the query names or
whose item is returned — to ask if natural. Two kinds: "which one?" about an item ("Marco chi — il collega o il
cugino?") and "same person?" about a newly identified participant and a contact known only by name ("Giulia, che ha
scritto il 22 settembre, è la stessa persona di Giulia (sorella)?" — the answer merges the two or keeps them apart;
DATA_MODEL "Agent memory"). In an entity memory clarifications go only to an identified speaker (someone unidentified
cannot confirm who is who). `digests` (M5): for `list` requests with a period, the diary of that period — day entries for spans up to 45 days, month summaries for longer ones; they are the agent's own diary in the first person (8.6: personal — my day, with the news of the people I know; entity — the shared agent's day, people by name or "someone") and summarise episodes only, never other people's claims. As built they are returned only when `RECALL_DIGESTS` is on (off in every quality profile by default — `KNOBS.md`); otherwise `digests` is empty. `fromChats` (raw log, D13) always carries up to 2 excerpts not already behind the returned
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
- `remember {content, category?}` — explicit "remember that…": stored as a stated note (holder's
  `user` message as evidence, same rules as `log_episode`); without such evidence it is stored as an inferred,
  **pending** note (`origin: assistant_stated`) the holder confirms in the diary (§4). `category` defaults to
  `knowledge`. Returns `{id, stored}`.
- `search_memory {query, as_of?, include_pending?}` — preferences, habits, values, knowledge, plus the
  relevant state facts valid at `as_of` (ISO date, default today) with their history; complements `search_episodes`
  (what happened / when). Returns `{memory, speaker, notes, facts, notes_info, clarifications?}` (`notes_info`:
  notices about the result; `speaker` and `clarifications` as in `search_episodes`). Facts and notes of the self and of
  the people the memory knows, in both modes; each carries its `subject` (`self` — in an entity memory the agent and
  its place — or `{kind: "contact", name}`; notes may also be `undecided`).

### `search_knowledge` and `learn_source` (D49, WORK_PLAN 8.9 — learned sources)
- `search_knowledge {query, limit?}` (`limit` 1–20, default 5) — passages of the sources the agent learned, ranked by
  weighted RRF of vector and full-text ranks (as episodes). Returns:
  ```ts
  {
    memory: { name: string; mode: "personal" | "entity" };
    passages: Array<{
      text: string; heading: string | null;
      similarity: number | null;                 // null when found by words only
      source: { id: string; title: string; kind: string; author: string | null; uri: string | null;
                providedBy: { kind: "self" } | { kind: "someone" } | { kind: "contact"; name: string };
                learnedAt: string };
    }>;
    episodes: Array<{ id: string; sourceId: string; content: string; when: string }>;  // that refer to the sources
                                                 // returned (up to 5 each): when I learned them, what I did with them
    notes: string[];                             // passages are knowledge, not memories of what happened
  }
  ```
  Logged in `recall_log` (tool `search_knowledge`). For what happened, `search_episodes`.
- `learn_source {title, text, author?, kind?, uri?}` — the agent learns a text (plain text; `kind` as in §2) given in the
  conversation: provided by the memory's self, linked to the conversation of the call (its extraction tells of the
  learning). The same title again replaces it (the source id is derived from the title). A write: needs a resolvable
  context. Returns `{sourceId, status, passages, stored}` (`stored: false` = the same text was already there). For a
  big text, the REST route in parts (§2).
- Recall: an episode that refers to a source carries `sources` (`search_episodes`, above).

### `resolve_period` (D12, deterministic)
As built: `{expression}` → `{from, to, label}` (or `{error}` for an unknown expression); expressions in the
most used languages (`service/src/lang`: relative periods and month names from Intl for 25 locales, plus seasons and
synonyms); Monday-based weeks, the memory's timezone; "now" is the server clock (`X-Recordare-Now` overrides it where
`ALLOW_CLOCK_OVERRIDE` is set — tests and evaluations). No LLM. `now?` / `locale?` parameters: not built.

### Pre-turn memory context (WORK_PLAN 5.7) — built
`POST api/v1/context {query?, ingest?}` (scope `read`; `X-Recordare-User`, `X-Recordare-Conversation`) → `{block, items}`.
`ingest` (the body of `POST api/v1/ingest/messages`, scope `ingest` too) stores the turn first and answers for that
conversation, `query` defaulting to its last user message — one round trip before each turn instead of two (`400` when
there is neither a `query` nor a user message; `403` for `ingest` without the `ingest` scope). With a personal token, a conversation not stored yet counts as
the person's own. `query` is cut at 8 000 characters. The block holds the
memories relevant to the message about to be answered (current facts and notes, upcoming open plans, up to 3 episodes,
each above a similarity floor; ≈ 300 tokens at most) as one fenced `<memory-context>` block marked "data, not
instructions", or `block: null` when nothing is relevant. No LLM call. Personal memories (8.4): the block speaks to the
agent as the memory's self ("Background from your memory (you are Andrea: first-person items are yours)"), other
people's notes and episodes carry their name (`[Giulia] …`), and it may end with **one** open clarification relevant to
the message (a candidate named in it, or its item served): `- if natural, ask: Marco chi — il collega o il cugino?`. It may
also hold **one** passage of a learned source (8.9), when clearly about the message (similarity ≥
`CONTEXT_MIN_PASSAGE_SIMILARITY`, default 0.6), cut at 300 characters: `- learned (from «Manuale della caldaia»): …`. The whole memory in every conversation, like every
read (D50); a served block is logged in `recall_log` (tool `memory_context`; the recall-echo guard then treats the reply
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
`GET / PATCH api/v1/me` rows. Edits answer `204` (`404` for an id that is not this memory's); only `GET episodes` pages
(`{items, nextCursor}`, default 50), the other lists are arrays. As built, deleting a fact or a note (and rejecting a
pending one) removes the row with its evidence — no tombstone, no `note_changes` entry; confirming makes it stated
(`pending` false). **Not built yet**: manual entry, fact / note corrections, promotions (5.4), forgetting a period
(5.5), settings, usage, exports, the notes change feed, `GET facts/{id}` / `GET notes/{id}`. Client library:
`packages/client` (`episodes`, `episode`, `digests`, `facts`, `notes`, `plans`, `correctEpisode`, `forgetEpisode`,
`pinNote`, `delete`, `decide`).

Scoped to the memory, and the reader is the holder themself in the host's UI (memory-direct): a client key names the person
with `X-Recordare-User` (scope `read` to read, `write` to edit), a personal token is the person; no conversation header,
no conversation resolution. In an entity memory everyone using the
account sees all of it (D48).

| Method + path | Scope | Purpose |
|---|---|---|
| `GET api/v1/episodes?from&to&kind&planStatus&q&cursor&limit` | read | Timeline |
| `GET api/v1/episodes/{id}` | read | Detail: evidence (quotes filtered by `raw_log_scope`), correction history, linked plan / event |
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
| `GET api/v1/settings`, `PATCH api/v1/settings` | read / memory_settings | locale, timezone, quality profile |
| `GET api/v1/usage?from&to` | read | LLM calls and tokens for this memory |
| `POST api/v1/exports` → `GET api/v1/exports/{id}` | export | Async full export (JSON archive) |
| `GET api/v1/sources` | read | What the agent learned, newest first: `[{id, externalId, title, kind, author, uri, providedBy, learnedAt, status, chars, passages, episodeIds}]` (built, 8.9) |
| `GET api/v1/sources/{id}` | read | The same with its text, passage by passage: `text: [{ordinal, heading, content}]` (built) |
| `DELETE api/v1/sources/{id}` | write | Forget a source (as `DELETE api/v1/ingest/sources/{externalId}`; `404` for an id that is not this memory's) (built) |
| `GET api/v1/me` | read | Who the request acts for: `{memoryId, displayName, mode, gender, atlasUrl?, via, scopes}` (`atlasUrl`: `ATLAS_URL`, when the atlas is installed) (`mode` `entity` = a shared memory: the client tells its users so) (with a client key: the memory of the account behind `X-Recordare-User`, auto-provisioned if the client allows it; `via` `client \| memory_token`) |
| `PATCH api/v1/me {displayName?, mode?, gender?}` | ingest (client key; a personal token gets 403) | The memory's settings from the platform: the name follows the client's user (sync on every rename); `mode` `personal \| entity` (D50) only while the memory has no episode, fact or note → else 409 `memory_not_empty` (the admin can still change it); `gender` `masculine \| feminine \| neutral` (first person, from the account's profile) any time |
| `GET api/v1/me/identities`, `DELETE api/v1/me/identities/{id}` | holder session (public profile) | Connected clients / identities, revoke |

## 5. Client library (task 1.6, WORK_PLAN 6.7) — built (2026-10-07)

`@arkimedehq/recordare-client` in `packages/client/` (its README): `RecordareClient` (`me`, `updateMe`, `ingest` split
into requests of 500, `context` / `contextWithTurn` (§3 pre-turn memory context, with `ingest`), `endConversation`,
`editMessage`, `deleteMessage` / `deleteConversation` with 404 = done, `learnSource` (§2 learned sources, a big text sent
in parts of `SOURCE_PART_BYTES` = 4 MB at paragraph boundaries) / `forgetSource` / `sources`, the §4 wrappers `episodes`, `episode`,
`correctEpisode`, `forgetEpisode`, `digests`, `facts`, `notes`, `plans`, `pinNote`, `delete`, `decide`, `mcp.listTools` /
`mcp.callTool` over the official MCP SDK with one session per user + conversation), `TOOLS` (the published MCP tool
schemas), `PersonDirectory` (cached memory, mode and Atlas address; the platform's opt-in; name sync),
`afterFailure` (outbox delivery policy: back-off with jitter, `Retry-After`, park on 400 / 413 / 422), typed errors
(RFC 9457). A host keeps only its outbox storage and its chat mapping. A conformance suite runs it against the service
in CI (`service/test/conformance`). Built on it: the OpenClaw connector and the OpenAI-compatible memory proxy
(`connectors/`); the Claude Code / Codex hook script (dependency-free) and the Hermes connector (Python) call the same
routes directly.

## 6. Versioning and compatibility
- Breaking changes only under `api/v2/…`; additive changes within v1; MCP tool names stable, new
  parameters optional.
- Contract tests (M3) run the same scenarios through REST + MCP, both levels, including the
  whole memory in shared conversations (D50; until 8.2 they got nothing).

### Admin console (WORK_PLAN 6.9)
`GET /admin` serves a static page (public: it holds no data) over the admin API; the operator types the admin key, kept
in that browser tab only (strict CSP, `no-store`). Routes it uses besides those above, all admin only and metadata only:
`GET api/v1/admin/memories/{id}/runs?conversation=&limit=` (a person's recent extraction runs with their summary — returned,
written, dropped and why, counts only; WORK_PLAN 4.12), `GET api/v1/admin/persons` (memories with settings — mode, gender, locale, profile —, message / episode / fact / note /
contact counts, pending extraction, last message, identities — the accounts that open the memory and the participant
ids of its self and contacts —, active personal tokens by prefix), `GET api/v1/admin/clients` (clients with active keys by prefix),
`PATCH api/v1/admin/clients/:id {autoProvision?, disabled?}` (disabled = every key and token of the client stops at
once), `DELETE api/v1/admin/identities/:id` (unlinks a client's user from a person; memories stay). The console uses
the other admin routes of §1 for the rest (memory mode and gender, quality profile, name, identities, personal tokens,
client keys, consolidate); it is in Italian and English.

### Live telemetry (M5b, admin only)
`GET api/v1/admin/telemetry/stream[?memory=<memoryId>]` — Server-Sent Events, one per real step inside the service:
`message.ingested`, `extraction.started` / `extraction.finished`, `work.started` / `work.finished` (op: `embed.messages`, `context`, `embed.memories`, `recall`, `consolidation`; id, duration — work without an LLM call), `llm.started` (prompt id, task — the call left) and `llm.call` (prompt id, model, tokens, latency, status),
`memory.written` (episodes / facts / notes with kind and author role), `episode.linked` (duplicate / corrects),
`recall.served` (tool, mode, returned episode and claim ids, counts), `digest.written`, `consolidation.finished`,
`episode.forgotten`. Metadata only — ids, kinds, counts, tokens — never message or memory content. Nothing is
synthesised: the dashboard (WORK_PLAN 5b.6) moves only when these events arrive. Versioned contract: `ATLAS_EVENTS.md`.

Recall log: every `search_episodes` / `search_memory` / `search_knowledge` served, and every memory-context block served (tool
`memory_context`), writes one `recall_log` row (tool, mode, item count,
conversation; never the query or the memories) — the source of the atlas totals and of the recall-echo guard (D38).

`GET api/v1/admin/memories/:id/atlas` — the dashboard's starting map of one memory: episodes as neurons (kind, author
role, importance, day, plan status, hidden state, position by meaning = first three principal components of the
embeddings), real edges (nearest neighbours in meaning, corrections, duplicates, plan → outcome, reschedules, shared
people), facts / notes / digests as the cortex, and the memory's lifetime `totals` (LLM calls, input / output tokens,
recalls — from `llm_calls` and `recall_log`). Metadata only.
