# Data model v1

Status: **M1 contracts, revision 3** (2026-10-03): consistency + security reviews applied; tables
of the **public** deployment profile (`API.md` §0, D33) are marked and not built in v1.
Postgres 16 + pgvector ≥ 0.8. Implements D6–D32 (`EPISODIC_MEMORY_TODO.md`), the identity model of
`API.md` and the vision's provenance / disclosure rules.

Rule for what exists in v1 (D28 refined): **columns on memory rows** that later phases need
(`audience`, `disclosure`, `confidence_of`, `origin`, `stance`, …) are created and filled now,
because adding them later means a backfill. **Whole tables and enum values** that only later
phases use are deferred — adding them later is purely additive (see the last section).

Conventions: `uuid` v7 primary keys; `timestamptz` everywhere; Postgres enums; memory rows are
append + link, never rewritten (D29); `owner_id` on every memory row and every query filtered by
it; FKs `ON DELETE` behaviour stated per table.

## Overview

```
Identity      persons ─ person_aliases       clients ─ api_keys ─ access_tokens ─ oauth_clients
              external_identities ─ link_codes   owners ─ owner_sessions   idempotency_keys
Layer 0       conversations ─ conversation_participants ─ messages ─ message_revisions
Layer 1       episodes ─ episode_evidence ─ episode_people ─ plan_events ─ episode_promotions
Layer 2       digests ─ digest_sources
Layer 3       fact_slots ─ facts ─ fact_evidence     notes ─ note_evidence ─ note_changes
Engine        extraction_runs ─ run_outputs   llm_calls   forget_tombstones   read_audit
```

## Shared columns

**Provenance** (episodes, facts, digests):

| Column | Type | Notes |
|---|---|---|
| `origin` | enum `owner_lived \| owner_told \| assistant_stated` | Who lived / said it (D28, D30, H3). `owner_told` = what the owner reports about others, and messages written by others inside the owner's imports. `twin_experienced` is added with the twin phases |
| `stance` | enum `stated \| inferred` | Inferred items stay low-confidence / pending (D29) |
| `author_role` | enum `owner \| assistant \| other \| tool` | Who wrote the evidence. Items whose only evidence comes from `other` / `tool` messages (group members, tool outputs, imported mail bodies) are extraction context, never `stance: stated`: at most `inferred` (facts: `pending`) — poisoning guard; recall labels them |
| `confidence` | real 0–1 | |
| `extraction_run_id` | uuid null → extraction_runs (`SET NULL`) | null for manual entries |

**Disclosure** (episodes, facts, digests):

| Column | Type | Notes |
|---|---|---|
| `disclosure` | enum `owner \| inner \| friends \| acquaintances \| public`, default `owner` | Tier ceiling (vision tiers) |
| `audience` | uuid[] (person ids), GIN index | Humans present when it was recorded — immutable (D29); always contains the owner. **Only identities verified for this owner** enter it; assistants are not persons |
| `audience_unverified` | text[] | Display names of present participants without a verified identity (never used to disclose) |
| `confidence_of` | uuid null (person id) | A third party's confidence ("Marco told me…"): at most owner + that person, unless granted (phase 3) |

**Read rule, enforced in code in every read path from v1** (`API.md` §1 viewer context): rows are
returned only if the viewer set `V` ⊆ `audience` and every viewer's tier ≥ `disclosure`. In phase 1
there are no tiers yet, so effectively: **rows are returned only when the viewers are exactly the
owner**; any other viewer set gets nothing (shared conversations see no diary). Derived rows take
`audience = ∩ sources`, `disclosure = most restrictive source`; a derived row without sources fails
closed. Missing and forbidden rows return the same "not found".

**Time.** Dates with coarse precision are stored as the **start of the period in the owner's
timezone** plus `date_precision` (day → local midnight, month → first day, year → 1 January);
range queries match by **overlap** of `[occurred_at, occurred_until or end of period]` with the
requested range.

| Column | Type | Notes |
|---|---|---|
| `occurred_at` / `valid_from` | timestamptz null | World time |
| `occurred_until` / `valid_to` | timestamptz null | Multi-day events / end of validity |
| `date_precision` | enum `minute \| day \| month \| year \| approximate \| unknown` | Never fake precision |
| `time_expression` | text null | Original wording ("sabato scorso") |
| `recorded_at` | timestamptz | When Recordare learned it |

**Embeddings**: `embedding vector(N)`, `embedding_model text`, `embedding_text text`. N fixed per
installation (D27). HNSW (`vector_cosine_ops`) queried with `owner_id` filter and pgvector
iterative scan (`hnsw.iterative_scan = relaxed_order`) so per-owner recall holds in multi-owner
installs; partition by owner if an install grows large.

## Identity

### persons
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `owner_scope` | uuid null → owners | **null for owners themselves; set for contacts** — a contact belongs to one owner's memory, never shared across owners |
| `display_name` | text | |
| `kind` | enum `human` | `synthetic` (research simulator) added with track R |
| `created_at` | timestamptz | |

Person merge is **not supported in v1** (an attempt to link an identity already bound to another
owner is rejected); a future merge must remap `audience` arrays and FKs in one transaction.

### person_aliases
`id, owner_id, person_id, alias text, alias_norm text (pg_trgm GIN), source enum
(extracted|manual), created_at` — mention resolution, LLM only when ambiguous.

### owners
| Column | Type | Notes |
|---|---|---|
| `person_id` | uuid PK → persons | |
| `email` | text unique null | Owner login (magic link, `API.md` §1) — used by the public profile only |
| `locale`, `timezone` | text | |
| `episodic_enabled` | bool, default false | D4 — changed only by the owner (owner session or owner-scoped token) |
| `episodic_enabled_at`, `episodic_enabled_by` | timestamptz, text | Consent record (who / which client UI) |
| `quality_profile` | text null (`economy` / `balanced` / `full`) | D35; null = installation default (`QUALITY_PROFILE`) |
| `created_at` | timestamptz | |

Idle delay is a global setting (D5), not per owner.

### owner_sessions (public profile)
`id, owner_id, created_at, expires_at, revoked_at, user_agent` — the owner's own login session on
Recordare's pages (consent, link codes, OAuth authorisation, self-service diary).

### clients
`id, name, kind enum (platform|mcp_client|import), auto_provision bool, raw_log_scope enum
(own|all, default own), created_at, disabled_at` — `raw_log_scope = own`: the raw-log fallback of
this client only searches conversations this client ingested (episodes / facts are shared across
the owner's clients; raw chats are not, unless the owner widens it).

### api_keys
`id, client_id, prefix, hash (argon2id), scopes text[], created_at, last_used_at, revoked_at`
(scope table: `API.md` §1).

### access_tokens and oauth_clients (oauth parts: public profile)
`access_tokens(id, owner_id, client_id, kind enum (personal|oauth_access|oauth_refresh), prefix,
hash, scopes text[], created_at, expires_at, last_used_at, revoked_at)`;
`oauth_clients(id, client_id, redirect_uris text[], registered_at)` (MCP dynamic registration).

### external_identities
`id, owner_scope null, person_id, kind enum (client_user|channel), client_id null, channel text
null, external_id, verified_at null, created_at`; unique `(kind, client_id, external_id)` and
`(owner_scope, kind, channel, external_id)` — channel bindings of contacts are scoped to one owner's
memory (client A cannot attach owner B's Telegram id to A's memories). Only verified bindings
identify interlocutors and enter `audience`.

### link_codes (public profile)
`id, owner_id, client_id (the only client allowed to redeem), code_hash, expires_at, used_at,
created_at`.

### idempotency_keys (public profile; v1 keeps replay keys in Redis for 24 h)
`credential_id, owner_id, method_path, key, response_hash, response_body, created_at` — unique on
the first four; 24 h retention.

## Layer 0 — raw log

### conversations
| Column | Type | Notes |
|---|---|---|
| `id`, `owner_id`, `client_id` | uuid | Unique `(client_id, owner_id, external_id)` |
| `external_id` | text | |
| `source` | enum `chat \| voice \| mcp_tool \| import_chat \| import_social \| import_email \| import_notes \| interview` | `mcp_tool` = synthetic conversation holding basic-level tool calls |
| `channel`, `title` | text null | |
| `started_at`, `last_message_at` | timestamptz | |
| `idle_job_at` | timestamptz null | When the idle extraction is due |
| `deleted_at` | timestamptz null | |

### conversation_participants
`conversation_id, person_id null, role enum (owner|assistant|other), display_name, ref text,
joined_at` — source of every row's `audience` and of the viewer set for reads in this conversation.

### messages
| Column | Type | Notes |
|---|---|---|
| `id`, `conversation_id`, `owner_id` | uuid | Unique `(conversation_id, external_id)`; index `(owner_id, sent_at)` |
| `external_id` | text | |
| `role` | enum `user \| assistant \| tool \| other` | `system` messages are **not ingested** (they can carry secrets); `tool` = tool calls / results of agentic clients (D30) |
| `tool_name` | text null | For `role = tool` |
| `author_person_id` | uuid null | |
| `author_ref` | text null | The client's participant ref; names unverified group members for extraction |
| `content` | text | Verbatim |
| `content_hash` | bytea | Detects re-sends with changed content (`API.md` §2) |
| `sent_at` | timestamptz | Reference time for date resolution |
| `received_at` | timestamptz | |
| `extracted_run_id` | uuid null → extraction_runs | **null = pending extraction**; the idle / nightly jobs take pending messages by `sent_at`, so late-arriving messages (imports, out-of-order batches) are never skipped |
| `edited_at` | timestamptz null | Previous text in `message_revisions(message_id, content, replaced_at)` |
| `tsv` | tsvector | 'simple' + unaccent, GIN |
| `embedding` | vector(N) null | Raw-log fallback only (D13), lazy |

## Layer 1 — episodes

### episodes
| Column | Type | Notes |
|---|---|---|
| `id`, `owner_id` | uuid | |
| `kind` | enum `event \| plan \| state_change` | `thought` / `goal` added with track R |
| `content` | text | Self-contained, absolute dates |
| *time* | | `occurred_at`, `occurred_until`, `date_precision`, `time_expression`, `recorded_at` |
| `place` | text null | |
| `importance` | smallint 1–10 | |
| `valence` | smallint −2…2 null | D21 |
| `feelings`, `opinion` | text[], text null | D21 |
| `keywords`, `context`, `tags` | text[], text, text[] | Retrieval keys, same extraction call (D29) |
| `plan_status` | enum `open \| confirmed \| cancelled \| rescheduled \| unresolved` null | Plans only. Cancellation lives **only** here (a cancelled plan was a real plan) |
| `plan_status_at` | timestamptz null | |
| `rescheduled_to` | uuid null → episodes (`SET NULL`) | |
| `confirmed_by` | uuid null → episodes (`SET NULL`) | |
| `corrects` | uuid null → episodes (`SET NULL`) | This row corrects an earlier one |
| `invalidated_at` | timestamptz null | **Only for corrections**: set on the row that was wrong |
| `duplicate_of` | uuid null → episodes (`SET NULL`) | Consolidation dedup link (same event in several chats); duplicates are hidden from recall |
| `linked_notes` | text[] | External refs to semantic notes (A-MEM ids while it lives in the client — D19, D31) |
| `access_count`, `last_accessed_at` | int, timestamptz | Ranking only |
| *provenance*, *disclosure*, *embedding* | | |
| `deleted_at` | timestamptz null | Forgetting in progress (purged by job) |

Indexes: `(owner_id, occurred_at) WHERE deleted_at IS NULL AND invalidated_at IS NULL AND
duplicate_of IS NULL`, `(owner_id, kind, plan_status)`, HNSW `embedding`, GIN `tags`, `keywords`,
FTS on `content`.

### episode_evidence
`episode_id (CASCADE), message_id (CASCADE), evidence_kind enum (message|agent_paraphrase),
quote text null, created_at` — every episode has ≥ 1 row; the quote is validated in code against
the message before insert (D29). `agent_paraphrase` = basic-level `log_episode` without a
user message to cite (the agent's wording, kept distinguishable). Late binding: a full-level
`log_episode` whose conversation message has not arrived yet gets its evidence row when it lands.

### episode_people
`episode_id (CASCADE), alias text, person_id null, role text null`

### plan_events
`id, plan_id → episodes (CASCADE), patch enum (open|confirm|cancel|reschedule|amend|expire),
evidence_message_id null (SET NULL), new_plan_id null, note, created_at, extraction_run_id` —
typed patches; transitions in code (D29); `expire` = job turning past unconfirmed plans into
`unresolved`.

### episode_promotions (D20)
`id, owner_id, pattern text, episode_ids uuid[], proposed_note_ref text null, status enum
(proposed|confirmed|rejected), created_at, updated_at` — recurring patterns proposed as
semantic notes; exposed to clients as pending proposals (D26).

## Layer 2 — digests

### digests
`id, owner_id, level enum (day|month), period_start date, period_end date, content, version int,
superseded_at null, embedding…, disclosure, audience, extraction_run_id, created_at`; partial
unique `(owner_id, level, period_start) WHERE superseded_at IS NULL`. Phase 3 will need
per-audience digests (the intersection rule makes mixed-audience days owner-only).

### digest_sources
`digest_id (CASCADE), episode_id (CASCADE) | source_digest_id (CASCADE)` — required.

## Layer 3 — facts (D31: state slots with value chain)

Recordare facts are **state slots** with their history ("my car", "where I live", "employer",
"children"). Durable preferences and free-form semantic notes stay in the client's own semantic
memory (A-MEM in Arkimede) until the A-MEM migration phase.

### fact_slots
Slot schema per installation (Memobase idea), extended by extraction with new keys (snake_case,
reused via the key list given to the extractor).

`key text PK, description text, cardinality enum (single|multi), update_policy text
(merge instruction for the extractor), default_disclosure enum, created_at` — supersession
applies only to `single` slots; `multi` slots accumulate (children, hobbies), and items leave only
by explicit statement.

### facts
| Column | Type | Notes |
|---|---|---|
| `id`, `owner_id` | uuid | |
| `subject_person_id` | uuid null | null = the owner |
| `key` | text → fact_slots | |
| `value` | text **null** | null only for `unknown_current` |
| `status` | enum `current \| superseded \| corrected \| unknown_current` | `unknown_current` is a **new row** (value null) that supersedes the stale one: "the current value is not known" (D29, STALE) |
| *time* | | `valid_from`, `valid_to`, `date_precision`, `time_expression`, `recorded_at` |
| `expired_at` | timestamptz null | When Recordare stopped believing it |
| `supersedes`, `corrects` | uuid null → facts (`SET NULL`) | |
| `verdict` | enum `new \| keep \| stale \| replace \| corrects \| unknown` | Write-time verdict (D29) |
| `support_count` | int | Restatements counted (Graphiti) |
| `pending` | bool | Inferred / promoted, awaiting owner confirmation; excluded from recall unless asked |
| *provenance*, *disclosure*, *embedding* | | |
| `deleted_at` | timestamptz null | |

Partial unique `(owner_id, subject_person_id, key) WHERE status = 'current' AND key is single`
(enforced via trigger on `fact_slots.cardinality`). Supersession forward-only by world / message
time. `derivedFrom` / `needsRecheck` (D29) are deferred until something produces derived facts.

`fact_evidence(fact_id CASCADE, message_id null CASCADE, episode_id null CASCADE, quote)`.

### notes (D34)
Semantic notes: who the owner is, beyond state slots.

| Column | Type | Notes |
|---|---|---|
| `id`, `owner_id` | uuid | |
| `category` | enum `preference \| habit \| value \| relationship \| knowledge \| profile \| constraint` | |
| `content` | text | Short, self-contained sentence |
| `keywords`, `context`, `tags` | text[], text, text[] | Retrieval keys (same extraction call) |
| `pinned` | bool | Always part of the stable context block (owner's choice) |
| `status` | enum `current \| superseded \| corrected` | History kept, never rewritten |
| `supersedes`, `corrects` | uuid null → notes (`SET NULL`) | |
| `support_count` | int | Restatements counted |
| `pending` | bool | Inferred notes await confirmation; excluded from recall unless asked |
| *time* | | `valid_from`, `recorded_at` |
| *provenance*, *disclosure*, *embedding* | | |
| `deleted_at` | timestamptz null | |

`note_evidence(note_id CASCADE, message_id null CASCADE, episode_id null CASCADE, quote)`;
`note_changes(seq bigserial, owner_id, note_id uuid, change enum (created|updated|corrected|
confirmed|forgotten), at)` — the change feed clients use to keep copies aligned (forgotten notes are
purged, the feed keeps only their id).

## Engine bookkeeping

### extraction_runs
`id, owner_id, conversation_id null, kind enum (extraction|digest|consolidation), window_from
timestamptz, window_to timestamptz, model, provider, prompt_version, status enum
(running|done|failed), error text null (no user content), started_at, finished_at` — one
`extraction` run per window produces episodes, plan patches and fact candidates (D32).
`run_outputs(run_id CASCADE, table_name, row_id)` — changelog; rows removed by the purge job.

### llm_calls
`id, owner_id null, client_id null, run_id null, prompt_id, provider, model, input_tokens,
cached_input_tokens, output_tokens, latency_ms, status, created_at` — no prompt or completion
text stored. Aggregated per owner / client / day for budgets and the CI cost gate.

### forget_tombstones (D16)
`id, owner_id, scope enum (episode|period|conversation|message), episode_fingerprint bytea null,
period_from, period_to, conversation_id null, created_at` — checked **before inserting any
episode or fact** (nightly sweep, re-extraction, dedup), so forgotten content never comes back.

### read_audit (public profile)
`id, owner_id, client_id, actor enum (client|owner|admin), viewer_ids uuid[], viewer_source enum
(conversation|owner_direct|added_viewers), endpoint, row_ids uuid[], created_at` — which memories
were returned to whom and how the viewer set was determined (vision principle 5, M7). Retention
configurable.

## Forgetting and deletion (D16)

- **Forget an episode**: tombstone + delete the episode, its evidence rows, people, plan events,
  promotions referencing it; the correction chain (`corrects` in both directions) is forgotten
  with it; the day and month **digests that used it are recomputed** (text and embedding);
  **facts whose evidence intersects its messages are re-verdicted or deleted**; its evidence
  messages are **excluded from the raw-log fallback by message id** (not by fuzzy fingerprint) and
  purged if the owner chooses "forget the conversation too".
- **Forget a period** `[from, to]`: tombstone; matches episodes by `occurred_at` **and** raw
  messages by `sent_at`; raw messages in the period are **purged by default** (`keepRaw: true`
  to keep them); digests of the period are recomputed or removed.
- **Delete a message / conversation** (client request): purge raw rows and revisions; for every
  episode / fact citing it, **drop the evidence row**; a row left without evidence is deleted;
  no re-extraction (it could rewrite memories).
- The purge job also removes: `messages.embedding`, `message_revisions` (also on forget-period),
  `embedding_text`, quotes, `run_outputs` rows. Queued jobs carry **ids only, never content**;
  `extraction_runs.error` and `llm_calls` never contain user content.
- (Public profile) **Backups**: forgotten rows disappear from backups within a configured window (default 30 days,
  shown to the owner). **LLM provider logs** are outside Recordare's control: the owner page states
  which provider processes their data and its retention policy (D27 provider profile).
- Corrections and supersessions keep history; forgetting is physical.

## Deferred (additive later, no migration of memories)

Tables: `relationships` and `grants` (phase 3), `autonomy_settings` and `snapshots` (track R),
`fact_derivations` + `needs_recheck` (when derived facts exist). Enum values: `origin =
twin_experienced`, `kind = thought | goal`, `persons.kind = synthetic`, `conversations.source =
simulation`, participant role `twin`. Their design is recorded in `DIGITAL_TWIN_VISION.md`
(research mode, money knob) and `literature/README.md`.
