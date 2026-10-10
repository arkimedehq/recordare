# Changelog

All notable changes to Recordare. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/) (0.x: the API may still change between minor versions).
Italian: [CHANGELOG_it.md](CHANGELOG_it.md).

## [Unreleased]

### Added
- **News received as a memory** (`extract.v11`): news that touches the person's life (an open plan, a person they know,
  something they own, or a reaction) becomes a low-importance episode with both dates; trivia stays in the chat log.
- **Memory context**: each sentence of a message is matched on its own, and a period the message names (any supported
  language, weekdays included) adds that period's episodes; floors are knobs (`CONTEXT_MIN_*_SIMILARITY`).
- **Languages**: `service/src/lang` — period expressions and month / weekday names from Intl for 25 of the most used
  languages; relation tables and third-person stand-ins for the self (leak detector, 8.4) for many.
- **Connector calls**: `POST api/v1/ingest/conversations/{id}/end`; `POST api/v1/context {ingest}` (store the turn and get
  its context in one call); personal tokens read before their conversation is stored; `TOOLS` (MCP tool schemas) in the
  client library; the connectors use them.
- **Diagnostics**: every extraction run keeps a summary (returned, written, dropped and why — counts only);
  `GET api/v1/admin/owners/{id}/runs`.

### Changed
- **No consent flag any more** (D50, WORK_PLAN 8.1) — **breaking**. Recordare always stores, extracts and consolidates
  what a client sends (still zero LLM calls when there is nothing to do); the on/off switch belongs to the client
  platform, and informing the people around the agent is the deployer's duty. Migration `NoConsent1791060000000` drops
  `owners.episodic_enabled`, `episodic_enabled_at`, `episodic_enabled_by` and `ingest_refused_at`; `stored` is removed
  from the ingest result; `episodicEnabled` is removed from `GET api/v1/me` and from the admin API (with
  `episodicEnabledAt` and `waitingForConsentSince`); the console's consent switch and "waiting for consent" chip are
  gone; MCP writes no longer answer "memory is off". Client library: `ConsentState`, `PersonDirectory.knownOff()` and
  `status()`, `MeResponse.episodicEnabled` and `IngestResult.stored` removed.
- **No viewer filter any more** (D50, WORK_PLAN 8.2). MCP recall (`search_episodes`, `search_memory`) and the memory
  context (`POST api/v1/context`) answer with the whole memory in every conversation — shared and group conversations,
  conversations not stored yet, no conversation, extra viewers — instead of nothing; privacy and disclosure come later.
  `X-Recordare-Viewers` / `_meta.recordare.viewers` are ignored and the `"nothing to show here"` notice is gone.
  `audience` / `disclosure` are still recorded; one memory still never sees another's data. The conversation header is
  still resolved: MCP writes bind their evidence to it.
- **Memory identity** (D50, WORK_PLAN 8.3) — **breaking**. A memory belongs to a client account; the people it knows
  are contacts of that memory only. Migration `MemoryIdentity1791070000000`: `persons.kind` becomes `owners.mode`
  (`personal | entity`) with `owners.gender` (`masculine | feminine | neutral`, default masculine); every person that is
  not a memory is a contact of exactly one memory (`full_name`, `relation`, names in `person_aliases`), and the contacts
  a memory was missing are created (e.g. a person with their own memory who also talks to a shared device);
  `external_identities.kind` becomes `account` (was `client_user`: opens a memory) or `participant` (was `channel`, now
  also a client's participant id: names a contact inside one memory, created by ingest on first sight); every message
  records who said it (`author_kind` `self | contact | someone | agent | own | tool`, `attribution_method`,
  `attribution_confidence`); episodes, facts and notes record whose they are (`subject_kind`, `subject_person_id`,
  `subject_candidates`); a `clarifications` table is created for later. API: `GET / PATCH api/v1/me` and the admin
  owner routes take `mode` and `gender` instead of `kind`; `POST api/v1/admin/identities` takes `kind: account |
  participant`; ingest accepts `own: true` on a message (the agent's own content) and the sources `document`,
  `perception`, `ambient`. The console shows mode, gender, contacts and identity kinds. Client library: `MemoryKind` →
  `MemoryMode` + `MemoryGender`, `Me.kind` → `mode` / `gender`, `MeSettings.kind` → `mode` / `gender`, `Person.kind` →
  `mode`, `IngestMessage.own`, the new sources. The extraction prompts and their inputs are unchanged.
- **Personal first person** (D50, WORK_PLAN 8.4) — **breaking for MCP results**. A personal memory is written in the
  first person (`extract.v12`, `facts.v2`), in the conversation's language and with the memory's gender: the account
  holder and the assistant are one "I". Every episode, fact and note gets a subject linked to the memory's contacts
  (created when a person is only mentioned, merged only when clear); an ambiguous person ("which Marco?") is stored as
  undecided with a clarification that a later conversation answers or that expires after 14 days; a participant identity
  seen for the first time binds to a known contact only when its full name matches exactly one contact without an
  identity — on a first name alone it becomes a new contact with a "same person?" clarification, whose "yes" merges the
  two contacts (migration `ContactClarification1791080000000`: `clarifications.contact_id`). `search_episodes` / `search_memory` return
  `memory {name, mode}` (was `owner {name}`), each item's `subject` (facts: `subject` replaces `about`), `speaker` (who is
  asking; an identified speaker gets their own items first) and `clarifications`; in a personal memory `claims` are
  others' statements about someone else (a person's own news is theirs, a tool's output is the agent's learning). The
  memory context speaks to the agent as the memory's self, names other people's items and may offer one question
  ("if natural, ask: …"). Tool descriptions speak of "your memory". `nameOwner` is replaced by a leak detector (counts in
  the run summary). A personal window with only other people speaking now costs an extraction call. Entity memories are
  unchanged until 8.5. Client library: `TOOLS` regenerated.
- **Others' claims about the self, dated** (WORK_PLAN 8.4b, `extract.v13`): in a personal memory what someone else says
  about the self is one first-person episode with the date it was said, who said it and where; recall no longer
  describes claims as being about others only.
- **Entity agent** (D50, WORK_PLAN 8.5) — **breaking for MCP results of entity memories**. An entity memory (a shared
  device, place, robot or service) is the agent's own memory in the first person (`extract.v13+entity.v4`,
  `facts.v2+entity.v4`): its replies and actions and the content given to it (`own`) are "I"; the people talking to it
  are contacts by name, `someone` until the conversation identifies them. Subjects, contacts and clarifications work as
  in personal memories (a "which Marco?" question is offered only to an identified speaker); `speaker` is in every
  result (`someone` for an unidentified speaker of an entity memory); `claims` follow the personal rule. Blind8:
  82.1 % → 91.4 % (3 runs).
- **The agent's diary** (WORK_PLAN 8.6, `digest.day.v2` / `digest.month.v2`, `facts_review.v2`): the nightly day and month
  digests are written in the first person of the memory's self (personal: my day, with the news of the people I know;
  entity: the shared agent's day), never from other people's claims; a new prompt version rewrites every day once. The
  nightly facts review covers every subject (the self's and the contacts' facts). Both stay off in recall / by default
  (no gain measured).
- **Learned sources** (D49, WORK_PLAN 8.9): the agent's semantic memory — texts it learns (manuals, documents, pages,
  notes; text only, the client converts files) kept apart from what it lived, with no size limit (sent in parts),
  passages embedded in the background, who gave them and when, and the learning as an episode linked both ways (written
  by the extraction of its conversation, or in code in the memory's language). New REST routes (`api/v1/ingest/sources`,
  `api/v1/sources`), MCP tools `search_knowledge` and `learn_source`, `sources` on episodes, one passage in the memory
  context; forgetting a source leaves a marker on its episodes. Client library: `learnSource` (automatic parts),
  `forgetSource`, `sources`; `TOOLS` regenerated. Requests bigger than `MAX_REQUEST_BYTES` (16 MB) get 413, malformed
  JSON 400 (they were 500).
- **Connectors: one memory per agent, people as participants** (D50) — **breaking for multi-person set-ups**. OpenClaw:
  the Gateway's agent has one memory (a personal token, or a client key with `defaultUser`); every sender is a
  participant with the channel identity `<channel>:<senderId>` and their channel name, the account holder is listed in
  `selfSenders` (CLI and Control UI turns are theirs); the `users` map is now `memoryPer: "user"`. Hermes Agent: one
  memory for the agent (a personal token, or a client key with a fixed `RECORDARE_USER`); gateway users and each turn's
  author in shared sessions are participants (`<platform>:<user id>`, their name), the account holder in
  `RECORDARE_SELF_IDS`; per-user memories with `RECORDARE_MEMORY_PER=user`, the alias map gives a person one id across
  platforms. OpenAI-compatible proxy: one memory per proxy (`RECORDARE_USER` or the personal token), platform users as
  participants with their names (Open WebUI user name, LibreChat `X-Recordare-User-Name`, AnythingLLM marker `name=`),
  the account holder in `SELF_USERS`; `MEMORY_PER=workspace` (one memory per AnythingLLM workspace) or `user` (the
  previous behaviour). Other people's turns are sent as role `other` with their author, so they are never read as the
  account holder's words. Claude Code / Codex: unchanged (the personal token's memory), wording only. Upgrading with a
  per-person mapping: set `memoryPer: "user"` / `RECORDARE_MEMORY_PER=user` / `MEMORY_PER=user`.

### Fixed
- A short fact inside a long message of the person counts as their words; "il proprietario" is replaced by the name.

## [0.1.0] — 2026-10-08

First public release: the **private profile** (an installation run by someone its users trust — README → Limits).

### Memory engine
- **Raw log**: REST ingest of chats (idempotent, edits and deletions, group chats with participants and authors),
  per-conversation idle trigger and nightly consolidation; nothing is processed without the person's consent.
- **Episodes**: one LLM extraction call per conversation window (`extract.v8`) — events, plans with their outcome
  (done, cancelled, moved, open, unresolved), state changes, people, places, feelings; bi-temporal (when it happened,
  when it was learned) with date precision; provenance (`author_role`, `stance`) keeps what the person lived apart from
  what others claim; corrections link to the version they replace; forgetting sticks.
- **Facts** with history and validity (as-of questions), **notes** (preferences, habits, knowledge), **daily and
  monthly digests**.
- Guards measured on blind sets: claims of others never become the person's facts; a group message addressed to the
  assistant by someone else is not the person's request; a plan cannot be confirmed before its date; an assistant's
  recall echoed back is not new evidence; the person's name instead of "the owner".
- **Entity memory** (experimental): one memory for a shared device or account (a household's kitchen assistant);
  facts carry the person they are about; who speaks is only who identifies in the conversation.
- **Quality profiles** `economy | balanced | full` (cost against quality), per installation with a per-person override.
- Any LLM provider (OpenAI-compatible, Anthropic, Claude CLI; provider profiles for their quirks) and any
  OpenAI-compatible embedding endpoint (measured with BAAI/bge-m3).

### Interfaces
- **MCP** (Streamable HTTP): `search_episodes`, `search_memory`, `resolve_period`, `log_episode`, `remember`,
  `correct_episode`, `forget_episode`; client keys acting for their users, or personal tokens (Claude Code — INTEGRATION
  §4b, `npm run smoke:mcp`).
- **Viewer context** on every read: what is said in a conversation others take part in never leaks to them.
- **Memory context** `POST api/v1/context`: the memories relevant to the next answer as one fenced block, no LLM call.
- **Read API** (the person's diary): timeline, episode detail with evidence, digests, facts as of a date, notes, plans,
  and the person's edits (correct, forget, pin, confirm, reject).
- **Admin API** and **admin console** (`/admin`): people, consent, memory kind, clients, keys, tokens.
- **Client library** `@arkimedehq/recordare-client` (`packages/client`): delivery with retries, people directory, MCP
  sessions, RFC 9457 errors; conformance suite against the service. Published on npm
  (`@arkimedehq/recordare-client`), with the OpenClaw plugin (`@arkimedehq/openclaw-recordare`); the OpenAI-compatible proxy
  as an image (`ghcr.io/arkimedehq/recordare-openai-proxy`).
- Telemetry contract for the optional live view **Recordare Atlas** (`arkimedehq/recordare-atlas`, metadata only).

### Installation
- `deploy/install.sh` (guided, or `--yes` non-interactive), `deploy/update.sh`, `deploy/backup.sh`.
- Profiles: **standalone** (own Postgres + pgvector, Redis, text-embeddings-inference with bge-m3; ≈ 6 GB RAM) and
  **co-hosted** with Arkimede (own database and Redis db on Arkimede's services). Both tested end to end.

### Quality (DeepSeek `deepseek-flash`, 3 runs each, `spikes/memory-eval/RESULTS.md`)
- Fresh blind set written by a separate agent: **91.3 %** (person memory, 46 questions); entity memory 82.1 %.
- Earlier blind sets: 90.7 % (blind5); on par with a full-context baseline and ahead of Mem0 on blind4.

### Clients
- **Arkimede**: ingest, recall tools, memory context per agent, the Diary, memory kind and consent in its settings.
- **Connectors at the full level** (capture + memory context before each turn + memory tools), in `connectors/`, each
  smoke-tested for real: **Claude Code** plugin (`/plugin marketplace add arkimedehq/recordare`), **Codex** (hooks +
  MCP installer), **OpenClaw** plugin, **Hermes Agent** memory provider, and an **OpenAI-compatible memory proxy** for
  platforms without hooks (AnythingLLM tested; Open WebUI and LibreChat by the same mechanism).
- **Any MCP client** at the basic level with a personal token (e.g. Claude Desktop through a local bridge, untested);
  an agent's writes count as the person's only when their own recent words say it.

### Known limits
- No owner login, OAuth or read audit yet (public profile deferred, D33); plain HTTP on a trusted network only.
- Entity memory: a speaker who never identifies may still be attributed to a named person.
- Claude Desktop / claude.ai: basic level only (no hooks to capture the conversation); Desktop needs OAuth or a local
  bridge (untested). The memory context misses questions with instruction suffixes, other languages or periods
  (WORK_PLAN 6.6b) — the memory tools do not.
