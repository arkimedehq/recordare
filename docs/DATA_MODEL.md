# Data model v1

Status: **M1 contract draft** (2026-10-03). Postgres 16 + pgvector. Implements D6–D30
(`EPISODIC_MEMORY_TODO.md`), the identity model of `API.md` and the vision's provenance /
disclosure rules. Every field that phase 1 does not use yet is still created now (D28) so later
phases need no migration of memories.

Conventions: `uuid` primary keys (v7, time-ordered); `timestamptz` everywhere; enums as Postgres
enums; soft history instead of updates for memory rows (append + link, never rewrite — D29);
`owner_id` on every memory row (one memory per owner, D22) and every query filtered by it.

## Overview

```
Identity      persons ─ person_aliases       clients ─ api_keys ─ access_tokens
              external_identities (client user ids, channel bindings)
              owners (a person who has a memory) ─ relationships ─ grants
Layer 0       conversations ─ conversation_participants ─ messages
Layer 1       episodes ─ episode_evidence ─ episode_people ─ plan_events
Layer 2       digests ─ digest_sources
Layer 3       facts ─ fact_evidence ─ fact_derivations
Engine        extraction_runs ─ run_outputs     llm_calls     jobs (BullMQ, not in Postgres)
Research      autonomy_settings (reserved)      snapshots (reserved)
```

## Shared columns and enums

**Provenance** (on episodes, facts, digests):

| Column | Type | Notes |
|---|---|---|
| `origin` | enum `owner_lived \| owner_told \| assistant_stated \| twin_experienced` | Who lived / said it (D28, D30, H3). `owner_told` = something the owner reports about others, and messages written by others inside the owner's imports |
| `stance` | enum `stated \| inferred` | Inferred items stay pending / low confidence (D29) |
| `confidence` | real 0–1 | Extractor confidence; inferred < 1 |
| `extraction_run_id` | uuid null | Which run produced it (null for manual entries) |

**Disclosure** (on episodes, facts, digests):

| Column | Type | Notes |
|---|---|---|
| `disclosure` | enum `owner \| inner \| friends \| acquaintances \| public` | Tier ceiling; default `owner` (vision tiers) |
| `audience` | uuid[] (person ids) | Humans present when it was recorded — immutable (D29, Authorization Before Context); always includes the owner. Assistants / the twin are not persons and are not listed |
| `confidence_of` | uuid null (person id) | Set when the content is a third party's confidence ("Marco told me…"): disclosable at most to owner + that person unless granted |

Admission rule (phase 3, enforced in code before prompt assembly): viewer set `V` ⊆ `audience`
**and** every viewer's tier ≥ `disclosure` (or an explicit grant). Derived rows (digests, facts
derived from episodes) take `audience = ∩ sources` and `disclosure = most restrictive source`;
a derived row without sources fails closed. Missing and forbidden rows return the same "not found".

**Time** (on episodes and facts): world time vs knowledge time (D28, Zep):

| Column | Type | Notes |
|---|---|---|
| `occurred_at` / `valid_from` | timestamptz null | When it happened / became true (world) |
| `occurred_until` / `valid_to` | timestamptz null | Multi-day events / end of validity |
| `date_precision` | enum `minute \| day \| month \| year \| approximate \| unknown` | Never fake precision ("2020" ≠ 1 Jan) |
| `time_expression` | text null | Original wording ("sabato scorso"), kept for audit (D29) |
| `recorded_at` | timestamptz | When Recordare learned it (ingestion / extraction) |
| `expired_at` | timestamptz null | When Recordare stopped believing it (superseded / corrected) |

**Embeddings**: `embedding vector(N)`, `embedding_model text`, `embedding_text text` (the
document embedded: content + retrieval keys). N fixed per installation (D27: model + dimension
stored; changing model = re-embed job). HNSW index (`vector_cosine_ops`).

## Identity

### persons
Any human the installation knows: owners and their contacts.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `display_name` | text | |
| `kind` | enum `human \| synthetic` | `synthetic` = simulated agent in research mode (vision → Research mode) |
| `created_at` | timestamptz | |

### person_aliases
Names as mentioned ("Marco", "mio cognato", "Marco (cognato)"), per owner — resolution of
mentions to persons (Graphiti-style, LLM only when ambiguous).

`id, owner_id, person_id, alias text, alias_norm text (trigram index), source enum
(extracted|manual), created_at`

### owners
A person who has a memory (one memory per owner, D22).

| Column | Type | Notes |
|---|---|---|
| `person_id` | uuid PK → persons | |
| `locale` | text | `it` / `en` (prompts, digests) |
| `timezone` | text | IANA, for date resolution |
| `episodic_enabled` | bool, default false | D4 |
| `settings` | jsonb | Idle delay override, digest levels… (validated by schema) |
| `created_at` | timestamptz | |

### clients
A platform integration (an Arkimede installation, a Claude Desktop setup, a bot).

`id, name, kind enum (platform|mcp_client|import|simulator), auto_provision bool (unknown
`X-Recordare-User` creates the owner), created_at, disabled_at`

### api_keys
Client credentials for the *full* integration (ingest + MCP + read API on behalf of mapped users).

`id, client_id, prefix text (shown), hash text (argon2id), scopes text[]
(ingest, mcp, read, write, admin), created_at, last_used_at, revoked_at`

### access_tokens
Personal tokens for the *basic* integration (MCP only): bound to one owner and one client (D24).
Issued either directly (header-capable MCP clients) or as OAuth 2.1 access / refresh tokens by
Recordare's MCP authorization server (`kind enum (personal|oauth_access|oauth_refresh)`).

`id, owner_id, client_id, kind, prefix, hash, scopes text[], created_at, expires_at, last_used_at,
revoked_at`; `oauth_clients(id, client_id, redirect_uris text[], registered_at)` for MCP dynamic
client registration.

### external_identities
How the outside world refers to a person.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `person_id` | uuid → persons | |
| `kind` | enum `client_user \| channel` | `client_user` = user id inside a client; `channel` = binding used to identify interlocutors (vision: tier from channel binding only) |
| `client_id` | uuid null | For `client_user` |
| `channel` | text null | `telegram`, `phone`, `email`, `whatsapp`, … for `channel` |
| `external_id` | text | Client user id / Telegram id / E.164 phone / email |
| `verified_at` | timestamptz null | Unverified bindings never raise a tier |
| `created_at` | timestamptz | |

Unique `(kind, client_id, external_id)` and `(kind, channel, external_id)`.

### relationships and grants (phase 3, created now)
`relationships(id, owner_id, person_id, tier enum, label text ("cognato"), valid_from, valid_to,
created_at)` — tier history is bi-temporal so "what could X see on date D" is answerable.
`grants(id, owner_id, person_id, scope enum (memory|item|action), target_id uuid null,
effect enum (allow|deny), valid_from, valid_to, created_at)` — per-person exceptions.

## Layer 0 — raw log

### conversations
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `owner_id` | uuid | |
| `client_id` | uuid | |
| `external_id` | text | Unique per `(client_id, owner_id, external_id)` |
| `source` | enum `chat \| voice \| import_chat \| import_social \| import_email \| import_notes \| interview \| simulation` | Import source (vision → Sources of the self-model) |
| `channel` | text null | `arkimede`, `telegram`, `whatsapp`, … |
| `title` | text null | |
| `started_at`, `last_message_at` | timestamptz | |
| `episodes_cursor` | uuid null → messages | D1/D22 service-side cursor: last message processed by extraction |
| `idle_job_at` | timestamptz null | When the idle extraction is due |
| `deleted_at` | timestamptz null | Deletion request received (rows purged by job) |

### conversation_participants
`conversation_id, person_id null, role enum (owner|assistant|twin|other), display_name,
external_ref text null, joined_at` — the audience of every message is derived from here.

### messages
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `conversation_id` | uuid | |
| `owner_id` | uuid | Denormalised for filtering |
| `external_id` | text | Unique per conversation (idempotent ingest) |
| `role` | enum `user \| assistant \| system \| other` | `other` = another human in group chats / imports |
| `author_person_id` | uuid null | Resolved author |
| `content` | text | Verbatim |
| `sent_at` | timestamptz | Reference time for date resolution (never ingestion time) |
| `received_at` | timestamptz | Ingestion time |
| `edited_at` | timestamptz null | Edits keep the previous text in `message_revisions` |
| `tsv` | tsvector | FTS ('simple' + unaccent), GIN index |
| `embedding` | vector(N) null | Only for the raw-log fallback (D13); computed lazily |

`message_revisions(message_id, content, replaced_at)` keeps edit history; a deleted message is
purged and every row citing it is re-evaluated (see Deletion).

## Layer 1 — episodes

### episodes
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `owner_id` | uuid | |
| `kind` | enum `event \| plan \| state_change \| thought \| goal` | `thought` / `goal` = twin's own reflection and goals (research mode, origin `twin_experienced`) |
| `content` | text | Self-contained sentence, absolute dates (D23 rules) |
| *time columns* | | `occurred_at`, `occurred_until`, `date_precision`, `time_expression`, `recorded_at`, `expired_at` |
| `place` | text null | |
| `importance` | smallint 1–10 | |
| `valence` | smallint −2…2 null | D21 |
| `feelings` | text[] | D21 |
| `opinion` | text null | D21 |
| `keywords`, `context`, `tags` | text[], text, text[] | Retrieval keys from the same extraction call (D29) |
| `plan_status` | enum `open \| confirmed \| cancelled \| rescheduled \| unresolved` null | Plans only (D10, D28); `unresolved` = date passed without confirmation |
| `plan_status_at` | timestamptz null | |
| `rescheduled_to` | uuid null → episodes | New plan row (D29) |
| `confirmed_by` | uuid null → episodes | Event that confirms the plan |
| `corrects` | uuid null → episodes | This row corrects an earlier one (old one was never true) |
| `invalidated_at` | timestamptz null | Set on the corrected / cancelled-as-wrong row (no rewrite) |
| `access_count`, `last_accessed_at` | int, timestamptz | Recall reinforcement (ranking only) |
| *provenance* | | `origin`, `stance`, `confidence`, `extraction_run_id` |
| *disclosure* | | `disclosure`, `audience`, `confidence_of` |
| *embedding* | | `embedding`, `embedding_model`, `embedding_text` |
| `deleted_at` | timestamptz null | User-driven deletion (D16), purged by job |

Indexes: `(owner_id, occurred_at)`, `(owner_id, kind, plan_status)`, HNSW on `embedding`,
GIN on `tags` / `keywords`, FTS on `content`.

### episode_evidence
Evidence-bound extraction (D29, MemIR): each episode cites the messages it comes from; the
quote is validated in code against `messages.content` before insert.

`episode_id, message_id, quote text null, created_at` — at least one row per extracted episode
(manual `log_episode` entries cite the tool-call message when available).

### episode_people
`episode_id, alias text (as mentioned), person_id null (resolved later), role text null`

### plan_events
Typed plan patches emitted by the extractor; transitions applied in code (D29, PIS).

`id, plan_id → episodes, patch enum (open|confirm|cancel|reschedule|amend|expire),
evidence_message_id null, new_plan_id null, note text, created_at, extraction_run_id`
(`expire` = the job that turns a past, unconfirmed plan into `unresolved`).

## Layer 2 — digests

### digests
`id, owner_id, level enum (day|month), period_start date, period_end date, content text,
version int, superseded_at timestamptz null, embedding…, disclosure, audience,
extraction_run_id, created_at` — a recomputed digest is a new version; the old one is
superseded, not overwritten.

### digest_sources
`digest_id, episode_id` (day) or `digest_id, source_digest_id` (month) — required: labels
propagate from sources (D29).

## Layer 3 — facts

### facts
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `owner_id` | uuid | |
| `subject_person_id` | uuid null | Whom the fact is about (null = the owner) |
| `key` | text | Normalised snake_case slot ("car", "address", "employer") |
| `value` | text | |
| `status` | enum `current \| superseded \| corrected \| unknown_current` | D29 (STALE) |
| *time columns* | | `valid_from`, `valid_to`, `date_precision`, `time_expression`, `recorded_at`, `expired_at` |
| `supersedes` | uuid null → facts | Previous value, true until `valid_from` |
| `corrects` | uuid null → facts | Previous value, never true |
| `verdict` | enum `new \| keep \| stale \| replace \| corrects \| unknown` | The extractor's write-time verdict that produced this row (D29) |
| `needs_recheck` | bool | Set by code when a fact it is derived from changes (flag only) |
| `support_count` | int | Restatements counted, not stored as new rows (Graphiti) |
| `pending` | bool | Inferred or promoted facts awaiting owner confirmation (D20) |
| *provenance*, *disclosure*, *embedding* | | As above |

Supersession is forward-only by world / message time: a row may supersede another only if its
`valid_from` ≥ the other's (imports never overwrite newer facts — D29).

`fact_evidence(fact_id, message_id null, episode_id null, quote)`;
`fact_derivations(fact_id, derived_from_fact_id)` (StateMemBench `derivedFrom`).

## Engine bookkeeping

### extraction_runs
`id, owner_id, conversation_id null, kind enum (episodes|facts|digest|consolidation|reflection),
window_from_message_id, window_to_message_id, model text, provider text, prompt_version text,
status enum (running|done|failed), error text null, started_at, finished_at`
`run_outputs(run_id, table_name, row_id)` — the changelog of a run (Memobase `profile_delta`):
"why does the twin believe X".

### llm_calls
Per-call accounting (cost principles, D27): `id, owner_id null, client_id null, run_id null,
prompt_id text, provider, model, input_tokens, cached_input_tokens, output_tokens, latency_ms,
status, created_at`. Aggregated per owner / client / day for budgets and the CI cost gate.

## Research mode (reserved, created now)

`autonomy_settings(owner_id, mode enum (assistant|research), reflection_schedule jsonb,
initiative_level enum (off|l1|l2|full), money_access jsonb null (account ref, per-transaction cap,
period budget, merchant categories), kill_switch_at timestamptz null, updated_at)`
`snapshots(id, owner_id, label, taken_at, storage_ref)` — restart a "life" from a point.
Twin thoughts and goals are `episodes` with `kind thought|goal`, `origin twin_experienced`.

## Deletion (D16)

- Deleting a message, conversation or period sets `deleted_at` and enqueues a purge job.
- The job removes the raw rows, then every episode / fact / digest whose evidence becomes empty;
  rows with remaining evidence get `needs_recheck` (facts) or are re-extracted (episodes);
  affected digests get a new version or are removed; embeddings removed with their rows.
- Deletion is physical for user-requested forgetting (privacy), unlike corrections and
  supersessions, which keep history.

## What is written in phase 1

Everything above except: `relationships` / `grants` contents and the admission rule (phase 3),
`twin_experienced` origin and `thought` / `goal` kinds (research mode / phase 4), `autonomy_settings`
and `snapshots` contents. Phase 1 fills `audience` and `disclosure = owner` on every row, so phase 3
starts with correct data.
