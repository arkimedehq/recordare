# Data model v1

Status: **M1 contracts, revision 3** (2026-10-03): consistency + security reviews applied; tables
of the **public** deployment profile (`API.md` §0, D33) are marked and not built in v1.
Built (2026-10-08): migrations in `service/src/db/migrations` (initial schema to `NoConsent`) match this document;
tables of the public profile are not created, tables marked **created, unused yet** exist without code using them.
Postgres 16 + pgvector ≥ 0.8. Implements D6–D32 (`EPISODIC_MEMORY_TODO.md`), the identity model of
`API.md` and the vision's provenance / disclosure rules.

Rule for what exists in v1 (D28 refined): **columns on memory rows** that later phases need
(`audience`, `disclosure`, `confidence_of`, `origin`, `stance`, …) are created and filled now,
because adding them later means a backfill. **Whole tables and enum values** that only later
phases use are deferred — adding them later is purely additive (see the last section).

Conventions: `uuid` primary keys (v7 planned; as built `gen_random_uuid()`, v4); `timestamptz` everywhere; Postgres enums; memory rows are
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
Engine        extraction_runs ─ run_outputs   llm_calls   recall_log   forget_tombstones   read_audit
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

**Read rule: none for now (D50, WORK_PLAN 8.2, 2026-10-09).** Every answer uses the whole memory, in every
conversation; `disclosure`, `audience` and `audience_unverified` are **still written** (recorded data for the later
privacy / disclosure work, WORK_PLAN 8.12) but **no read path filters on them**. Per-memory isolation stays (every read
is scoped to one `owner_id`). *Superseded (phase-1 rule)*: rows were returned only if the viewer set `V` ⊆ `audience`
and every viewer's tier ≥ `disclosure` — with no tiers yet, only when the viewers were exactly the owner (shared
conversations saw no diary); derived rows took `audience = ∩ sources`, `disclosure = most restrictive source` (still how
they are written).

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
installs; partition by owner if an install grows large. <!-- verify: hnsw.iterative_scan is not set anywhere in
service/src (main) — not built yet? -->

## Identity

### persons
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `owner_scope` | uuid null → owners | **null for owners themselves; set for contacts** — a contact belongs to one owner's memory, never shared across owners |
| `display_name` | text | An owner auto-provisioned by a client is first named after the client's user id; the client then keeps it in sync (`PATCH api/v1/me`) |
| `kind` | enum `human \| entity` | `entity` (D48): an owner that is a shared device, robot or place — an **entity memory** everyone using the account reads and writes. `synthetic` (research simulator) added with track R |
| `created_at` | timestamptz | |

Person merge is **not supported in v1** (an attempt to link an identity already bound to another
owner is rejected); a future merge must remap `audience` arrays and FKs in one transaction.

### person_aliases — created, unused yet
`id, owner_id, person_id, alias text, alias_norm text (pg_trgm GIN), source enum
(extracted|manual), created_at` — mention resolution, LLM only when ambiguous. Today people are kept as
"Name (relation)" strings on episodes (`episode_people.alias`), which people-aware recall reads (D39).

### owners
| Column | Type | Notes |
|---|---|---|
| `person_id` | uuid PK → persons | |
| `email` | text unique null | Owner login (magic link, `API.md` §1) — used by the public profile only |
| `locale`, `timezone` | text | Defaults `it`, `Europe/Rome`; the admin API accepts `it` / `en`. The locale only formats dates and recall notices: the deterministic language helpers (periods, months, relations, owner naming — `service/src/lang`, 25 most used languages) apply all languages at once |
| `consolidated_at` | timestamptz null | Last nightly consolidation (M5) |
| `facts_reviewed_upto` | timestamptz null | Watermark of the nightly facts review (WORK_PLAN 5.6, on the recording clock) |
| `quality_profile` | text null (`economy` / `balanced` / `full`) | D35; null = installation default (`QUALITY_PROFILE`) |
| `created_at` | timestamptz | |

Idle delay is a global setting (D5), not per owner. No consent columns (D50): migration `NoConsent` dropped
`episodic_enabled`, `episodic_enabled_at`, `episodic_enabled_by` and `ingest_refused_at` — every memory stores what its
client sends; the on/off switch belongs to the client platform.

### owner_sessions (public profile)
`id, owner_id, created_at, expires_at, revoked_at, user_agent` — the owner's own login session on
Recordare's pages (link codes, OAuth authorisation, self-service diary).

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
hash, scopes text[], created_at, expires_at, last_used_at, revoked_at)` — as built the `kind` enum holds only
`personal` (the OAuth values come with the public profile);
`oauth_clients(id, client_id, redirect_uris text[], registered_at)` (MCP dynamic registration).

### external_identities
`id, owner_scope null, person_id, kind enum (client_user|channel), client_id null, channel text
null, external_id, verified_at null, created_at`; unique `(kind, client_id, external_id)` and
`(owner_scope, kind, channel, external_id)` (as built: partial unique indexes `(client_id, external_id) WHERE kind =
'client_user'` and `(owner_scope, channel, external_id) WHERE kind = 'channel'`, a null `owner_scope` counting as one
value) — channel bindings of contacts are scoped to one owner's
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
joined_at` — source of every row's `audience` (recorded; no read filters on it since D50).

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
| `tsv` | tsvector | Generated `to_tsvector('simple', content)`, GIN (the `unaccent` extension is created but not used yet) |
| `embedding` | vector(N) null | Raw-log fallback only (D13); computed asynchronously after ingest, for non-assistant messages |

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
| `deleted_at` | timestamptz null | Forgetting in progress (purged by job). As built forgetting deletes the rows at once and the column is never set (reads still filter on it) |

Indexes: `(owner_id, occurred_at) WHERE deleted_at IS NULL AND invalidated_at IS NULL AND
duplicate_of IS NULL`, `(owner_id, kind, plan_status)`, HNSW `embedding`, GIN `tags`, `keywords`,
FTS on `content`.

### episode_evidence
`episode_id (CASCADE), message_id (CASCADE), evidence_kind enum (message|agent_paraphrase),
quote text null, created_at` — every episode has ≥ 1 row; the quote is validated in code against
the message before insert (D29). `agent_paraphrase` = basic-level `log_episode` without a
user message to cite (the agent's wording, kept distinguishable). Late binding: a full-level
`log_episode` whose conversation message has not arrived yet gets its evidence row when it lands (not built yet).

### episode_people
`episode_id (CASCADE), alias text, person_id null, role text null`

### plan_events
`id, plan_id → episodes (CASCADE), patch enum (open|confirm|cancel|reschedule|amend|expire),
evidence_message_id null (SET NULL), new_plan_id null, note, created_at, extraction_run_id` —
typed patches; transitions in code (D29). As built, `unresolved` is computed at read time (a past plan never
confirmed is shown as unresolved); no job writes it and the `expire` patch is unused. Patches need evidence about
that plan (D37).

### episode_promotions (D20) — created, unused yet (WORK_PLAN 5.4)
`id, owner_id, pattern text, episode_ids uuid[], proposed_note_ref text null, status enum
(proposed|confirmed|rejected), created_at, updated_at` — recurring patterns proposed as
semantic notes; exposed to clients as pending proposals (D26).

## Layer 2 — digests

### digests
`id, owner_id, level enum (day|month), period_start date, period_end date, content, version int,
superseded_at null, embedding…, disclosure, audience, extraction_run_id, source_hash, created_at`; `source_hash` =
fingerprint of the items the digest was written from (a day is rewritten only when it changes — M5); partial
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
| `subject_person_id` | uuid null | null = the owner. **Entity memories (D48)**: the person the fact is about (a contact of that memory, found by name or created by the writer); null = the entity itself. Never set in a person's memory |
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
purged, the feed keeps only their id). As built the extraction writes `created` / `updated` / `corrected` and
`remember` writes `created`; deleting, confirming or rejecting a note through the read API (`API.md` §4) writes no entry,
and the feed route (`GET api/v1/notes/changes`) is not built yet.

## Engine bookkeeping

### extraction_runs
`id, owner_id, conversation_id null, kind enum (extraction|digest|consolidation), window_from
timestamptz, window_to timestamptz, model, provider, prompt_version, status enum
(running|done|failed), error text null (no user content), started_at, finished_at` — one
`extraction` run per window produces episodes, plan patches and fact candidates (D32). `summary jsonb null`
(WORK_PLAN 4.12, migration `RunSummary`): `{returned: {episodes, plan_patches, facts, notes}, written: {table: n},
dropped: {kind: {reason: n}}}` — what the model returned, what was written, what the code-side rules dropped and why
(`no_evidence`, `forgotten`, `recall_echo`, `person_not_named`, `not_about_plan`, `confirm_before_date`, `no_change`,
`not_reasserted_after_recall`, …); counts only, never text, so forgetting stays complete.
`run_outputs(run_id CASCADE, table_name, row_id)` — changelog; rows removed by the purge job.

### llm_calls
`id, owner_id null, client_id null, run_id null, prompt_id, provider, model, input_tokens,
cached_input_tokens, output_tokens, latency_ms, status, created_at` — no prompt or completion
text stored. Aggregated per owner / client / day for budgets and the CI cost gate.

### recall_log
`id bigserial, owner_id → persons (CASCADE), tool, mode null, items, conversation_id null → conversations (SET NULL),
served_at` — one row per recall served (`search_episodes`, `search_memory`, a pre-turn memory-context block:
`memory_context`), metadata only: never the query, never the memories;
`conversation_id` tells the extraction which conversations had a recall served (recall-echo guard, D38). Lifetime totals for the operators' dashboard;
the public profile's `read_audit` (below) extends it with client, viewers and returned row ids.

### forget_tombstones (D16)
`id, owner_id, scope enum (episode|period|conversation|message), episode_fingerprint bytea null,
message_ids uuid[] (the forgotten evidence messages, hidden from chat search), period_from, period_to,
conversation_id null, created_at` — checked **before inserting any
episode or fact** (nightly sweep, re-extraction, dedup), so forgotten content never comes back.

### read_audit (public profile)
`id, owner_id, client_id, actor enum (client|owner|admin), viewer_ids uuid[], viewer_source enum
(conversation|owner_direct|added_viewers), endpoint, row_ids uuid[], created_at` — which memories
were returned to whom and how the viewer set was determined (vision principle 5, M7). Retention
configurable.

## Forgetting and deletion (D16)

Built (2026-10-08): forget an episode (MCP `forget_episode`, `DELETE api/v1/episodes/{id}`), the synchronous message
/ conversation purge, and deleting a fact or a note from the diary (`DELETE api/v1/facts/{id}` / `notes/{id}`, also a
rejected pending one: the row and its evidence are deleted, no tombstone — <!-- verify: a deleted fact / note can be
extracted again from the same messages; intended? -->). Not built yet (WORK_PLAN 5.5): forget a period, re-verdict of
facts on forgotten evidence, deletion of episodes left without evidence.

- **Forget an episode**: tombstone + delete the episode, its evidence rows, people, plan events,
  promotions referencing it; the correction chain (`corrects` in both directions) is forgotten
  with it (as built: also duplicates, the confirming event and reschedules); the day and month **digests that used
  it are superseded** and rewritten by the next consolidation;
  **facts whose evidence intersects its messages are re-verdicted or deleted** (not built yet); its evidence
  messages are **excluded from the raw-log fallback by message id** (not by fuzzy fingerprint) and
  purged if the owner chooses "forget the conversation too".
- **Forget a period** `[from, to]`: tombstone; matches episodes by `occurred_at` **and** raw
  messages by `sent_at`; raw messages in the period are **purged by default** (`keepRaw: true`
  to keep them); digests of the period are recomputed or removed.
- **Delete a message / conversation** (client request): purge raw rows and revisions; for every
  episode / fact citing it, **drop the evidence row**; a row left without evidence is deleted (not built yet);
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
