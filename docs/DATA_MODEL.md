# Data model v1

Status: **M1 contracts, revision 3** (2026-10-03): consistency + security reviews applied; tables
of the **public** deployment profile (`API.md` §0, D33) are marked and not built in v1.
Built (2026-10-09): migrations in `service/src/db/migrations` (initial schema to `MemoryIdentity`) match this document;
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
              external_identities ─ link_codes   owners ─ owner_sessions   idempotency_keys   clarifications
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
| `owner_scope` | uuid null → owners | **null for a memory's own row; required for every other person (a contact)** — a contact belongs to one memory, never shared across memories (deferred constraint trigger `persons_scope_required`, checked at commit) |
| `display_name` | text | A memory auto-provisioned by a client is first named after the client's user id; the client then keeps it in sync (`PATCH api/v1/me`). A contact: the name it was first seen or mentioned with |
| `full_name` | text null | Contacts: the full name when known (8.3: column only, nothing fills it yet) |
| `relation` | text null | Contacts: the relation to the memory's self — sister, colleague, boss… (8.3: column only) |
| `created_at` | timestamptz | |

The memory's kind moved to `owners.mode` (migration `MemoryIdentity`, D50); `persons.kind` is gone.

Person merge is **not supported in v1** (an attempt to link an identity already bound to another
owner is rejected); a future merge must remap `audience` arrays and FKs in one transaction.

### person_aliases
`id, owner_id, person_id, alias text, alias_norm text (pg_trgm GIN), source enum
(extracted|manual|client), created_at`, unique `(person_id, alias_norm)` — the names of a contact (first name,
nicknames, "my sister"…). `alias_norm` = `lower(unaccent(btrim(alias)))`. As built (8.3) every contact has its display
name as an alias (`client` when created from a participant the client identified, `extracted` when the writer created
it by name); the writer's episode-subject rule reads them. Episodes still keep people as "Name (relation)" strings
(`episode_people.alias`), which people-aware recall reads (D39).

### owners
| Column | Type | Notes |
|---|---|---|
| `person_id` | uuid PK → persons | |
| `email` | text unique null | Owner login (magic link, `API.md` §1) — used by the public profile only |
| `locale`, `timezone` | text | Defaults `it`, `Europe/Rome`; the admin API accepts `it` / `en`. The locale only formats dates and recall notices: the deterministic language helpers (periods, months, relations, owner naming — `service/src/lang`, 25 most used languages) apply all languages at once |
| `consolidated_at` | timestamptz null | Last nightly consolidation (M5) |
| `facts_reviewed_upto` | timestamptz null | Watermark of the nightly facts review (WORK_PLAN 5.6, on the recording clock) |
| `quality_profile` | text null (`economy` / `balanced` / `full`) | D35; null = installation default (`QUALITY_PROFILE`) |
| `mode` | enum `personal \| entity`, default `personal` | D50: `personal` — undeclared input is the memory's self (the account holder is "I"); `entity` (D48) — a shared device, robot or place: undeclared input is "someone"'s. Changed by the client only while the memory is empty (`PATCH api/v1/me`), by the admin any time |
| `gender` | enum `masculine \| feminine \| neutral`, default `masculine` | The first person in gendered languages (D50; used from WORK_PLAN 8.4) |
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
`id, owner_scope null, person_id, kind enum (account|participant), client_id null, channel text
null, external_id, verified_at null, created_at` (migration `MemoryIdentity`, D50):
- **`account`** — a client's user id opens a memory: `client_id` set, `channel` and `owner_scope` null, the person is a
  memory's own row; unique `(client_id, external_id)`. The only kind `OwnerResolver` reads (`X-Recordare-User`).
- **`participant`** — inside the memory `owner_scope` (required), a client's participant id (`client_id`) or a channel
  id (`channel`, exactly one of the two) names the memory's self or one of its contacts; unique
  `(owner_scope, client_id, external_id)` and `(owner_scope, channel, external_id)`. Never opens a memory: the same
  client user id can be one memory's account and a participant (a contact) in another. Ingest creates one (verified)
  when it first sees a participant's identity; an unverified binding (admin, `verified: false`) identifies nobody.
Only verified bindings identify interlocutors and enter `audience`.

### link_codes (public profile)
`id, owner_id, client_id (the only client allowed to redeem), code_hash, expires_at, used_at,
created_at`.

### idempotency_keys (public profile; v1 keeps replay keys in Redis for 24 h)
`credential_id, owner_id, method_path, key, response_hash, response_body, created_at` — unique on
the first four; 24 h retention.

### Agent memory (D50, WORK_PLAN 8.3) — design approved 2026-10-09, built 2026-10-09 (migration `MemoryIdentity1791070000000`)
A memory belongs to an agent: one client account = one memory (today the `owners` row; renamed `memories` in 8.10).
- **`owners.mode`** `personal | entity` (from `persons.kind`: human → personal, entity → entity; changeable only while
  the memory is empty); **`owners.gender`** `masculine | feminine | neutral`, default **masculine**, for the first
  person in gendered languages (set by the client with `PATCH /me`). The memory's own person row (`persons`,
  `owner_scope` null) carries the name: in a personal memory it is the name of "I" — the account holder, who is both
  the user and the agent.
- **Contacts** = the people a memory knows: `persons` rows with `owner_scope` = that memory (required for every human
  that is not the memory itself). The same human in two memories is two unrelated contacts (memories are isolated). A
  contact is created when a client identifies a participant, when someone introduces themselves or is recognised (voice,
  face), and also when a person is only **mentioned** with a name ("my sister Giulia"). Contact fields: names
  (`person_aliases`: first name, nicknames, "my sister"…), `full_name` when known, `relation` to the memory's self
  (sister, colleague, boss…), and its identifiers (participant identities below).
- **Same name, two people** ("Marco"): resolved in this order — certain identifiers (client id, voiceprint, face) →
  full name → context (relation, place, people present). Merges happen only when clear (same name and relation);
  otherwise two contacts, mergeable by hand in the Diary — a wrong merge is worse than a duplicate.
- **`external_identities`** has two kinds: **account** (a client's user opens a memory — today's `client_user`) and
  **participant** (a client's participant id, a voiceprint id, a face id, a channel → a contact of one memory).
- **Messages** record who said them, as knowledge: `author_kind` `self | contact | someone | agent | own | tool`,
  `author_person_id` (the contact), `attribution_method` `account | declared | self_introduction | addressed_by_name |
  voiceprint | face | client_assertion | none`, `attribution_confidence` 0–1. In personal mode the person / assistant
  distinction is knowledge only: no logic uses it (D50).
- **Ingest**: a message may carry `own: true` (the agent's own: knowledge given to it, its perceptions, a document) →
  `author_kind = own`; conversation sources add `document`, `perception`, `ambient`.
- **Subject of every memory** (episodes, facts, notes): `subject_kind` `self | contact | someone | undecided` +
  `subject_person_id`; `undecided` keeps the **candidate contacts** — an ambiguous attribution is never guessed.
- **`clarifications`** (Recordare's first initiative, vision L1): `id, memory, question, candidates (contacts),
  episode / fact / note it concerns, status open | resolved | expired, created_at, resolved_at`. The memory context
  offers at most one relevant open question to the agent ("if natural, ask: which Marco — the colleague or the
  cousin?"); the answer resolves it at the next extraction by adding the attribution (the memory is not rewritten);
  unanswered questions expire; the Diary can resolve them by hand. Behaviour in 8.4 / 8.5 (prompt change, measured).
- Migration of existing data (backup first): personal — person messages `self`, assistant messages `agent`, episodes /
  notes / facts `self`; entity — messages `someone` unless an author is already known, episodes the contact when they
  name one known person, else `someone`, facts keep their subject; missing contacts created (e.g. Andrea inside the
  Arkim3de memory). The prompt and `origin` values do not change in 8.3 (first person arrives in 8.4).

**As built (8.3).** Tables and columns: `owners.mode` / `gender`; `persons.full_name` / `relation` and the scope
trigger; `person_aliases.source` + `client`; `external_identities.kind` `account | participant`; `messages.author_kind`
/ `attribution_method` / `attribution_confidence`; sources `document`, `perception`, `ambient`; `subject_kind`,
`subject_person_id`, `subject_candidates` on episodes, facts, notes; `clarifications`. Rules:
- *Ingest attribution* — `own: true` (only on `user` / `other` messages) → `own`; `tool` → `tool`; `assistant` → `agent`
  (method `client_assertion`, confidence 1); a message whose `authorRef` names a participant takes the participant's
  attribution; otherwise a `user` message is `self` in a personal memory (method `account`) and `someone` in an entity
  memory (method `none`), any other `someone`. Participants: `assistant` → agent; `owner` → `self` in a personal memory
  (implied when missing; an entity memory implies none); with an identity → resolved in this memory (the account's own
  user id → `self`; a participant identity → its person; first seen → a new contact + alias + verified participant
  identity; method `client_assertion` for a client's user id, `declared` for a channel id; an unverified binding →
  `someone`).
- *Subjects* — personal: every episode, fact, note is `self`. Entity: a fact with a subject → that `contact` (found by
  display name or created, as before), without one → `self` (the entity's own); an episode → the `contact` when its
  people name exactly one known contact (display name or alias, "(relation)" stripped; `episode_people.person_id` set
  for an unambiguous name), else `someone`; a note → `someone`. Never `undecided` yet. Explicit writes (`log_episode`,
  `remember`) follow the same rules; corrections and plan copies keep the subject of the row they derive from.
- *Prompts unchanged* — the extraction / facts / review inputs still label the account's speaker `owner` (personal) /
  `person` (entity): a message counts as the account's speaker's when its role is `user`, its author kind is `self` or
  `own`, or its `authorRef` is the conversation's `owner` participant (SQL `accountSpeaker`); the gate, `author_role` and
  the raw-log `authorRole` use the same test.
- *Backfill* — as the design above; in addition: persons of no memory (owner_scope null, not a memory) referenced in a
  memory become contacts there, then are deleted with their identities (also those referenced nowhere); an account id
  bound to a contact becomes a participant id of its memory; a channel id without scope is scoped to its person's
  memory; personal `user` messages without an author get the self; entity conversations' `owner` participant loses the
  entity as its person. `down` restores the previous shape (participant ids of a client are dropped; contacts stay).

**As built (8.4, personal first person — `extract.v12`, `facts.v2`; migration `ContactClarification1791080000000`).** Personal memories only; entity
memories keep the 8.3 rules and byte-identical prompt inputs until 8.5.
- *Voice* — every episode, note and plan of a personal memory is written in the **first person**, in the conversation's
  language, with `owners.gender` for agreement; the account holder's undeclared turns and the assistant's turns are both
  "I" with no distinction in the text (who said it stays in `messages.author_kind` / `author_role` / `origin`, as data).
  External content (web, tools, files) is something "I" learned (extract.v11's news rule and its exclusion of others'
  claims about the self are kept). The prompt gets the self's names (`ME`: display name + aliases, with the gender),
  `MEMORY LANGUAGE`, the contacts the window concerns (`PEOPLE I KNOW`, numbered C1…: named in the window, its
  participants, the subjects of listed facts, the candidates of open questions; at most 30) and the open questions (`OPEN
  QUESTIONS`, Q1…, at most 5). Speakers: `me`, `me (assistant)`, `me (own)`, `Name [C3]` (an identified contact),
  `other:Name` (a display name only), `someone`, `tool:x`. Current facts are listed for all subjects (`[me]` / `[Name]`).
- *Subjects* — the model names the subject of each episode, fact and note: `me`, a C-number, `Name (relation)` or
  `someone`, or `undecided` with candidate C-numbers and a question. The writer links names to contacts (`ContactBook`):
  the self's names → self; a single match → that contact unless the relation or the full name says otherwise (then a
  new contact — no wrong merge); several matches → narrowed by relation, then full name, else `undecided` with all of
  them; no match → a new contact (`relation`, `full_name` for two or more capitalised words, the first name as an alias).
  Episode people are linked the same way (only names create contacts: "amiche del nuoto" does not). Facts of `someone`
  or of an undecided person are dropped; notes of `someone` too.
- *Identified participants* (owner's decision 2026-10-09: a first name alone does not say that a participant is a
  contact known only by name — "mia sorella Giulia" and a Giulia writing in a group may be two people) — a participant
  identity seen for the first time **binds** to an existing contact only on strong evidence: its display name is a full
  name (two or more words) equal (case- and accent-insensitive) to the display name, full name or an alias of exactly one
  contact that has no identity yet. Otherwise a **new contact**; when exactly one contact without an identity shares the
  name (the participant's first name is one of its names, or — for a single-name participant — the first word of one;
  never a contact whose known full name differs from the participant's full name), a personal memory opens a **"same
  person?" clarification** (`clarifications.contact_id` = the new contact, `candidates` = the known one, no item; the
  question in Italian when the memory's locale is Italian, else English: "Giulia, che ha scritto il 22 settembre, è la
  stessa persona di Giulia (sorella)?", `created_at` = the batch's first message time). Several such contacts: a new
  contact and no question (no spam; the Diary can merge by hand). Entity memories never ask (until 8.5). Relation
  self-introductions ("sono Giulia, la sorella di Andrea") and recognised identifiers are other paths (not at ingest).
- *Provenance* — what others say about the self stays a claim (`stance = inferred`, facts pending); a person's own
  statement about themself is `stated` for that subject (Giulia's news, Giulia's facts); tool-only items stay
  `inferred`. The named-in-window guard applies to subjects (a contact must be named in the window or speak in it); the
  recall-echo guard and evidence rules are unchanged.
- *Clarifications* — an `undecided` episode or note gets a `clarifications` row (the model's question, or
  "Marco? Marco (cugino) / Marco Bellini (collega)" when it gave none; `created_at` = the window's last message time).
  Later windows see it under OPEN QUESTIONS; an answer (`answers: [{question, contact, evidence}]`) backed by a person's
  message (never an assistant reply or a tool) and naming one of the candidates resolves it — and any open question with
  the same text and candidates: the item's subject becomes that contact, unlinked episode people with that name are
  linked, `resolved_person_id` / `resolution` (the contact's name) / `resolved_at` are set; the memory's text is never
  rewritten. Open questions expire after 14 days (`CLARIFICATION_TTL_DAYS`, a constant): checked at extraction (as of
  the window), on read (as of the request) and by the nightly consolidation. A "same person?" question is listed as
  `Q1: <question> (about: C2 — the same person as C1?; answer C1 if yes, C2 if not)` (both contacts are in PEOPLE I
  KNOW) and answered the same way: the known contact → the two are **merged** (`resolution` `same person`); the new
  contact itself → they stay apart (`different person`). The Diary / admin will resolve through the same function
  (`resolveClarification`).
- *Merge* (`service/src/engine/contacts.ts` → `mergeContacts`, one place) — the new contact is merged into the known one:
  every reference moves (participant identities, aliases — duplicates dropped —, `conversation_participants`,
  `messages.author_person_id`, `episode_people`, `subject_person_id` / `confidence_of` / `subject_candidates` /
  `audience` on episodes, facts, notes (and `audience` on digests), clarification candidates / `resolved_person_id` /
  `contact_id`), `full_name` and `relation` are kept from the known contact or taken from the merged one; a single-value
  fact current for both keeps the more recent one (the older becomes `superseded`); an item undecided between the two
  becomes the merged contact's and an open question left with one candidate is resolved; then the merged row is
  deleted. The memory's text is never rewritten.
- *Gate* — a personal window costs a call when anyone but the assistant or a tool speaks (the self, a contact,
  someone, own content); an identified contact sent as `user` with its `authorRef` is that contact, not the self (SQL
  `memorySpeaker`, also used by the raw-log search and MCP writes).
- *Leak detector* (replaces 4.11's `nameOwner`, removed) — `extraction_runs.summary.leaks` counts the written episodes
  and notes that still speak of the self in the third person (one of its names, or a stand-in such as "the user",
  "l'utente", "the owner", "the assistant", in the most used languages: `service/src/lang/self.ts`); counts only, with
  `summary.clarifications` (`asked`, `resolved`) and `returned.answers`.

## Layer 0 — raw log

### conversations
| Column | Type | Notes |
|---|---|---|
| `id`, `owner_id`, `client_id` | uuid | Unique `(client_id, owner_id, external_id)` |
| `external_id` | text | |
| `source` | enum `chat \| voice \| mcp_tool \| import_chat \| import_social \| import_email \| import_notes \| interview \| document \| perception \| ambient` | `mcp_tool` = synthetic conversation holding basic-level tool calls; `document` / `perception` / `ambient` (D50): a document given to the agent, what a device perceives, continuous listening |
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
| `author_person_id` | uuid null | The memory's self (`self`) or the contact (`contact`); for `own` the participant that provided it, if any |
| `author_ref` | text null | The client's participant ref; names unverified group members for extraction |
| `author_kind` | enum `self \| contact \| someone \| agent \| own \| tool` | Who said it, as knowledge (D50): the memory's self, an identified contact, an unidentified someone, the assistant, the agent's own content (`own: true`), a tool |
| `attribution_method` | enum `account \| declared \| self_introduction \| addressed_by_name \| voiceprint \| face \| client_assertion \| none` | How it was established; as built only `account`, `declared`, `client_assertion`, `none` are written |
| `attribution_confidence` | real 0–1 null | null when nothing was established (`none`) |
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
| *subject* | | `subject_kind` enum `self \| contact \| someone \| undecided` (default `self`), `subject_person_id` uuid null → persons (`SET NULL`), `subject_candidates` uuid[] (the candidate contacts of an `undecided` row) — whose memory it is (D50, rules in "Agent memory"); same three columns on facts and notes |
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
| `subject_person_id` | uuid null | null = the memory's self. **Entity memories (D48)**: the person the fact is about (a contact of that memory, found by name or created by the writer); null = the entity itself. Never set in a personal memory |
| `subject_kind`, `subject_candidates` | | As on episodes (D50): `contact` with a subject, else `self` |
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
| *subject* | | `subject_kind`, `subject_person_id`, `subject_candidates` as on episodes (D50): `self` in a personal memory, `someone` in an entity memory |
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

### clarifications (D50, vision L1; behaviour WORK_PLAN 8.4)
`id, owner_id → owners (CASCADE), question text, candidates uuid[] (contacts), episode_id / fact_id / note_id null
(CASCADE; at most one), contact_id null → persons (CASCADE; migration `ContactClarification1791080000000`: the new
contact of a "same person?" question — then no item), status enum (open|resolved|expired) default open, resolution text
null (the answer as given: the chosen contact's name, or `same person` / `different person`), resolved_person_id null →
persons (SET NULL), created_at, resolved_at null (set exactly when not open)`; partial index `(owner_id, created_at)
WHERE status = 'open'`. A question Recordare wants answered ("which Marco — the colleague or the cousin?", "is this
Giulia my sister?"); the memory context offers at most one relevant open question, the answer adds the attribution (or
merges two contacts) at the next extraction, unanswered ones expire, the Diary resolves them by hand.

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
twin_experienced`, `kind = thought | goal`, `owners.mode = synthetic`, `conversations.source =
simulation`, participant role `twin`. Their design is recorded in `DIGITAL_TWIN_VISION.md`
(research mode, money knob) and `literature/README.md`.
