# API contracts v1

Status: **M1 contract draft, revision 2** (2026-10-03, after the consistency review).
Client-neutral: nothing here is specific to Arkimede. Data model: `DATA_MODEL.md`. Two integration
levels (vision → Architecture): **basic** = MCP tools only; **full** = REST ingest + MCP + read API
+ SDK.

Conventions: JSON over HTTPS; controllers hard-code `api/v1/…` (no global prefix); ISO 8601 with
offset; uuids; errors as RFC 9457 problem details (`{type, title, status, detail, code}`); zod
schemas are the single source of truth and generate `GET /api/v1/openapi.json` (M2); pagination
`?cursor&limit` → `{items, nextCursor}`; every non-idempotent POST accepts an `Idempotency-Key`
header (24 h replay window, same response returned).

## 1. Identity, authentication, viewer context (tasks 1.1, 1.5 → D24)

### Model
- **Person**: a human known to the installation. **Owner**: a person with a memory (one per
  person, whatever platform). Contacts are persons scoped to one owner's memory.
- **Client**: a platform integration (Arkimede installation, Claude Desktop setup, import tool).
- **External identity**: `client_user` (`clientId + externalUserId`) or `channel`
  (`telegram:…`, `phone:+39…`, `email:…`); only verified bindings identify interlocutors.

### Owner authentication
Owners log in to Recordare's own pages with an **email magic link** (no passwords; passkeys and
OIDC later). The owner session is needed for: giving consent (`episodicEnabled`), creating link
codes, authorising OAuth MCP clients, creating personal tokens, the self-service diary.

### Credentials (D24)
| Level | Credential | Acts as |
|---|---|---|
| Full | **Client API key** `Authorization: Bearer rk_…` | Owners mapped to that client, selected per request with `X-Recordare-User: <externalUserId>` |
| Basic | **Personal access token** `rp_…`, bound to one owner + one client, created by the owner (owner session) — for header-capable MCP clients (Claude Code, Cursor, SDKs) | That owner |
| Basic (OAuth) | **OAuth 2.1** per the MCP authorization spec (code + PKCE, dynamic client registration, protected-resource metadata); the owner logs in (magic link) and consents — for clients that require it (Claude Desktop / claude.ai connectors). Scheduled for M6; personal tokens cover M3–M5 | That owner |
| Admin | API key with scope `admin` | Installation management |

### Scopes
| Scope | Allows |
|---|---|
| `ingest` | §2 ingest, edits, deletions of the client's own conversations |
| `mcp` | §3 tools (read + `log_episode`, `correct_episode`, `forget_episode`) |
| `read` | §4 GET endpoints |
| `write` | §4 manual entries, corrections, forgetting, fact edits |
| `owner_settings` | `PATCH settings` incl. `episodicEnabled` — **only owner sessions and owner-created personal tokens**; never client API keys (consent, D4) |
| `export` | §4 export jobs |
| `admin` | `api/v1/admin/…` |

Keys and tokens: argon2id hashes, shown once, visible prefix, rotation by create + revoke. A
client can never mint tokens for another client.

### Viewer context (who will see the result) — every read
Every read (MCP tools, §4 GETs) declares who will see the answer:
- `X-Recordare-Conversation: <externalConversationId>` → viewers = participants of that ingested
  conversation; or
- `X-Recordare-Viewers: <comma-separated external identities>`; or
- nothing → viewers = the owner alone (personal token / owner session) — for client API keys the
  header is **required** on reads.

Rule (`DATA_MODEL.md` → read rule): in phase 1 memories are returned only when the viewers are
exactly the owner; otherwise the response is empty with `notes: ["memory not available in a shared
conversation"]`. Missing and forbidden items look the same.

### Linking the same person across clients
1. In an **owner session**, the owner creates a link code (`POST api/v1/me/link-codes` →
   `{code, expiresAt}`, single use, 10 min) and sees what client B will get: episodes and facts of
   all clients; raw chats only of B's own conversations (`clients.raw_log_scope = own`, widenable
   by the owner).
2. Client B submits it: `POST api/v1/identities/link {code, externalUserId}` with B's key.
3. If B's `externalUserId` is already bound to another owner (e.g. auto-provisioned), the link is
   rejected (`409 identity_bound`) — person merge is not supported in v1.

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
  consent).
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
at `initialize` (token owner, or `X-Recordare-User` for client keys) and cannot change within the
session; the viewer context comes from the headers of §1 or from `_meta.recordare.conversation` on
each call. Tool schemas use the provider-neutral subset (D27). Tools are listed only when the owner
has `episodicEnabled`; the server sends `notifications/tools/list_changed` when it changes.

### `log_episode` (D11)
| Param | Type | Notes |
|---|---|---|
| `content` | string, required | |
| `kind` | `"event" \| "plan"` | default `event` |
| `occurred_at`, `occurred_until` | string | ISO date / datetime resolved by the agent |
| `date_precision` | `"day" \| "month" \| "year" \| "approximate"` | |
| `people` | string[] | Names as mentioned |
| `place` | string | |

Returns `{id, stored}`. Importance 10, `stance: stated`. Dedup: the same content for the same owner
within 10 minutes returns the existing episode (agent retries). Evidence: the conversation message
(from `_meta.recordare.conversation` / header) — bound late if the ingest has not arrived yet; at
basic level, the call is stored in a per-client daily conversation (`source: mcp_tool`) with
`evidence_kind: agent_paraphrase`.

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
  people: string[]; feelings: string[]; opinion?: string;
  source: { conversationId: string; messageIds: string[]; at: string };
};
```
`fromChats` (raw-log fallback, D13) is filled when fewer than 3 episodes match or the best match
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

### `resolve_period` (D12, deterministic)
`{expression, now?, locale?}` → `{from, to, label}`; Monday-based weeks, owner's timezone; `now`
defaults to server time (override allowed for tests and historical questions). No LLM.

## 4. Read / write API for host UIs (task 1.4) — the diary (D18)

Scoped to the owner (`X-Recordare-User` + viewer context, personal token, or owner session).
The same pages are served by Recordare itself for owners without a host UI.

| Method + path | Scope | Purpose |
|---|---|---|
| `GET api/v1/episodes?from&to&kind&planStatus&q&cursor&limit` | read | Timeline |
| `GET api/v1/episodes/{id}` | read | Detail: evidence, correction history, linked plan / event |
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
| `GET api/v1/settings`, `PATCH api/v1/settings` | read / owner_settings | `episodicEnabled`, locale, timezone |
| `GET api/v1/usage?from&to` | read | LLM calls and tokens for this owner |
| `POST api/v1/exports` → `GET api/v1/exports/{id}` | export | Async full export (JSON archive) |

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
