# Changelog

All notable changes to Recordare. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/) (0.x: the API may still change between minor versions).
Italian: [CHANGELOG_it.md](CHANGELOG_it.md).

## [Unreleased]

### Added
- Private messages (D52, first step): `private` on a message or a whole request (`conversation.private`); the agent's
  reply and tool turns after it follow, for the same person; `PATCH …/messages/{id} {private}` (library
  `setMessagePrivate`) makes it private or public again. Every read follows it (`API.md` §1): told only to whoever it
  belongs to — the speaker of the conversation's latest turn — and to a personal memory's holder; in an entity memory the
  account reads the public only. Episodes, facts and notes follow their messages (hidden when any message behind them is
  private to someone else); a correction keeps the privacy of what it corrects. The read API marks private
  items (`private: {by}`) and `GET api/v1/private` (library `privateItems`) lists them without their content for an
  entity memory's Diary; the diary and the recurring patterns are written from public memories only. A person asking in
  words that what they said stay between us makes their own messages private, and freeing it makes them public again
  (`extract.v20`, `entity.v8`: section PRIVATE).

### Fixed
- Editing, deleting or ending a conversation for a user without a memory no longer creates an empty one (`autoProvision`):
  it answers 404 like an unknown conversation, so a late deletion never brings an erased memory back.
- `search_episodes` in mode `list` without a `query` returned no episode: it now lists the period's episodes (or all
  of them), the important ones first.

## [0.4.0] — 2026-10-26

**Plans apart from facts, my own replies, cards and erasure**: a plan or a wish no longer becomes a fact or a done
event, the recall finds again what the agent itself replied earlier, the service's own sentences follow the memory's
language, the REST contract is published as OpenAPI, and two new controls — a card of who I am and of each contact, and
erasing a whole memory (new scope `erase`). No breaking change: the API only grows; upgrade the service first (the
migrations run at start-up), then the client library and the connectors. Quality (DeepSeek `deepseek-flash`,
`spikes/memory-eval/RESULTS.md`): LongMemEval-S, a 100-question sample, 83.5 % (76.0 % before D30 and `extract.v19`;
the whole history in the prompt 84.5 %), what the assistant said 0.82 (0.14); the blind sets within the noise of one run.

### Added
- **Cards** (WORK_PLAN 8.13): `GET api/v1/cards` — who I am and a card per contact, from the current facts and notes
  (with their ids, aliases, the last mention), no LLM; library `cards(user)`. The memory context can open with the self
  card (`POST api/v1/context {card: true}`, library `context(…, { card: true })`), off by default.
- **Erasing a whole memory** (WORK_PLAN 8.13): `DELETE api/v1/admin/memories/:id` and `DELETE api/v1/me` (new scope
  `erase`, for a client key or a personal token, given only when asked for), both with `?confirm=` the memory's id;
  library `eraseMemory(user, memoryId)`. Everything the memory holds goes in one transaction, with no tombstone; the LLM
  call log keeps its rows without the memory. Memories about someone else are forgotten one by one, never in bulk.
- **OpenAPI** (API.md): `GET api/v1/openapi.json`, no authentication — the REST contract as OpenAPI 3.1, generated from
  the routes: paths, scopes (`x-recordare-scopes`), path and query parameters and request bodies from the zod schemas
  that validate them, the JSON answers from the routes' response schemas (`@Returns`; the admin and Atlas answers are
  loose objects, not a stable contract), status codes and RFC 9457 errors. The tests check every answer they see against
  its schema, and the compiler checks the handlers and the client library's types against them.

### Changed
- **All languages in the service's own sentences** (WORK_PLAN 2.6): the recall tools' notes for the agent, unknown and
  approximate dates, weekday names and the "same person?" question follow the memory's language in the 25 most used
  languages (they were Italian or English); a memory's `locale` is any BCP 47 tag in the admin API too (was `it` / `en`).
- **Something told as done today that did not happen** (H1, `extract.v17`, personal memories): "this afternoon I paint
  the railing" is stored as done that day, as before; when a later message shows it did not happen ("Saturday I'll
  finally paint the railing, the can is still there"), the episode is now corrected instead of staying true. Entity
  memories keep their prompt.
- **What I told them earlier is found again** (D30): the recall also searches my own earlier replies (`fromChats` with
  `authorRole: "assistant"`), so "which beer did you recommend for that recipe?" finds the answer, which is in no
  episode; a reply of the conversation being served, or a short one (small talk, a confirmation), is not returned. A long message shows its passage that best matches
  the question instead of its first 400 characters. Every message now gets an embedding, and the hourly sweep queues
  the missing ones (replies stored before; migration `UnembeddedMessages`).
- **A plan is not how things are** (`extract.v19`, `entity.v7`): "next month I move to Bologna" stored the new address as
  the current one (with the plan in its value), and "from April I'm enrolling in the pottery class" became a note "I
  attend the pottery class"; a plan, an intention or a wish now changes no fact and makes no note until a later message
  tells it happened, and a fact's value is the state only. The separate facts pass (`factsPass: separate`) already had
  this rule.
- **Things kept and changed over time, and requests that tell a fact** (`extract.v18`, `entity.v6`): "add milk to the
  list", "move the meeting to Friday", "mark the rent as paid" were taken as requests for help and often not remembered;
  they are now remembered as what they say. A shopping list, the guests of a party, a packing list is one note with its
  whole current content, replaced at each change (the earlier content stays in its history), plus a small event per
  change with its date and reason; it used to be stored as plans. Managing the list stays the agent's job: Recordare only
  remembers it.
- **A list without a period** (`search_episodes` mode `list`, no `from` / `to`) selects by its topic, like a search, and
  fills free places by similarity; it used to keep the most important items among the relevant ones and to add nothing
  else, so "how many runs did I tell you about?" got none of the runs. Period lists are unchanged.

### Fixed
- One long message (a travel diary of 21 k characters pasted in a chat) failed its extraction: the episodes did not
  fit the fixed 6000-token output and were cut off. The output budget now grows with the window's text, up to 32000.
- A memory whose locale is regional (`it-IT`, as `PATCH settings` accepts) got those sentences and weekday names in
  English.
- A fact that was not known any more failed the whole extraction window when it was said unknown again, got a new value
  or was corrected (the database allowed no empty value in a fact's history); a repeated "unknown" now changes nothing,
  and the other two write history as they should (migration `UnknownFactHistory`).
- `provider_eval.py` (evaluation): runs with different tags on the same set no longer overwrite each other's summary.

### Removed
- **`packages/client/scripts/sync-to.sh`**: Arkimede installs `@arkimedehq/recordare-client` from npm instead of a
  synced copy of its sources.

## [0.3.0] — 2026-10-17

Memory **quality and control**: recall ranks by relevance, recurring habits, continuous listening in the room, forgetting
a period, the rest of the read API (manual entries, corrections, the notes change feed, settings, usage, exports), the
holder's channel identities by one-time code. No breaking change: the API only grows; upgrade the service first (the
migrations run at start-up), then the client library and the connectors. Quality (DeepSeek `deepseek-flash`,
`spikes/memory-eval/RESULTS.md`, 3 runs each): blind personal set 97.2 % (90.9 % in 0.2.0), blind entity sets 96.7 %
and 98.8 % (91.4 % in 0.2.0); the lowest unjustified-assertion rate of the systems compared on blind3 (WORK_PLAN 4.5c).

### Added
- **Continuous listening** (WORK_PLAN 6.5, D45): conversation source `ambient` for speech a home device hears in the
  room. The extraction is told it reads overheard speech (`extract.v16`, in those windows only); episodes are written as
  usual, every fact and note heard there stays pending until its person says it again in a chat or by voice to the
  assistant (or confirms it in the diary); recall marks episodes and chat excerpts heard there (`heard: true`; "heard in
  the room" in the memory context) and the `search_episodes` description tells the agent what that means; a link code
  heard there is never a claim. Dev set `dataset_dev_ambient`: 86.7 %, no misattributed sentence stored as a stated fact.
  **Room transcripts**: `POST api/v1/ingest/room` (client `ingestRoom`) sends one transcript to the memories of the
  people present — each gets its own words as `user` turns and the other speakers as contacts.
- **Cost budget in CI** (WORK_PLAN 4.4c): `service/test/cost/` measures, per quality profile, the LLM calls and input
  tokens of a reference day of one person (per idle window, per night, per month) and fails above `budget.json`; an
  intended rise is recorded in the same commit (`COST_BUDGET_UPDATE=1 npx vitest run test/cost`).
- **The rest of the read API** (WORK_PLAN 4.7, API.md §4): manual entry (`POST api/v1/episodes`, `POST api/v1/notes` —
  written by the person, stated), corrections of facts and notes (`POST …/{id}/corrections`, history kept), one fact or
  note with its evidence (`GET api/v1/facts/{id}`, `GET api/v1/notes/{id}`), the notes change feed
  (`GET api/v1/notes/changes?since`, for platforms keeping a copy; `replaces` names the note an updated or corrected one
  took the place of), settings (`GET` / `PATCH api/v1/settings`: locale,
  time zone, quality profile; changing them needs the memory's personal token), usage (`GET api/v1/usage`: LLM calls and
  tokens by prompt and day) and full exports (`POST api/v1/exports` → `GET …/{id}` → `GET …/{id}/archive`: one JSON
  archive, built in the background, kept 7 days; personal token). Client methods for all of them; migration
  `Exports1791140000000`.
- **Forget a period**: `POST api/v1/forget {from, to, keepRaw?}` (client `forgetPeriod`) forgets the episodes that took
  place in it and the raw messages sent in it (`keepRaw`: kept but hidden and never extracted again), with what only
  they supported; returns how much went (WORK_PLAN 5.5). Forgetting an episode now also takes the facts and notes its
  messages alone supported (not those another message also supports).
- **Recurring patterns** (WORK_PLAN 5.4, D26): the nightly consolidation draws the habits that show in the episodes of
  the last months ("I run at the park on Saturday mornings") and keeps them as the memory's own notes — inferred, never
  pending, nobody confirms them — backed by at least three episodes on different days; it strengthens, updates and
  retires them on its own, and a forgotten one does not come back from the same episodes. Notes carry `pattern`
  (`GET api/v1/notes`, `search_memory`; client `Note.pattern`); the memory context labels them. Quality-profile knob
  `patterns` (on in balanced / full; `PATTERNS` overrides it), LLM task `patterns` (`LLM_PATTERNS_*`), admin
  `POST api/v1/admin/memories/:id/patterns`; migration `Patterns1791130000000` (`episode_promotions` rebuilt,
  `memories.patterns_upto`, note change `retired`). Dev set: 20 of 21 habits, no false pattern (3 runs).
- **The holder's channel identities by one-time code** (D51, WORK_PLAN 8.7): in a personal memory the holder makes a
  code (`POST api/v1/me/link-codes` → `RCD-XXXX-XXXX`, ten minutes, one use; admin `POST api/v1/admin/memories/:id/link-codes`;
  console "Link code"), sends it to the agent from a channel in a direct chat — the message is never stored, it becomes a
  claim — and confirms it within seven days (`GET api/v1/me/identities`, `POST …/pending/{id}/confirm`, `DELETE
  …/pending/{id}`; admin `…/link-claims/:claim`, `linkClaims` in `GET admin/persons`; console "To confirm"): from then on
  that sender is the memory's "I" (earlier messages keep their attribution); `DELETE api/v1/me/identities/{id}` unlinks.
  Ingest field `conversation.direct` (a group never claims). Client library: `linkCode`, `holderIdentities`,
  `confirmHolderClaim`, `rejectHolderClaim`, `unlinkHolderIdentity`, `isLinkCode`, `LINK_CODE_INSTRUCTION`. OpenClaw,
  Hermes and the proxy send a code at once and tell the model what it is (OpenClaw and Hermes mark direct chats). Migration
  `HolderLinks1791150000000`.

### Changed
- A known participant who shows up under a new name on the channel (a nickname that became a full name) keeps their
  contact, and the new name is added to the contact's aliases, so a search by it finds them (WORK_PLAN 8.7).
- `PATCH api/v1/me` also accepts the memory's personal token (`ingest` scope): a host without user accounts (Claude Code,
  Codex, a connector on a personal token) sets the gender, and the mode while the memory is empty, without the admin
  (WORK_PLAN 8.7).
- Client library: `PersonDirectory` keeps the gender in sync with the platform's profile like the name
  (`PlatformUser.gender`; one `PATCH api/v1/me` carries both when both changed) (WORK_PLAN 8.7).
- OpenClaw plugin: captured messages that could not be sent wait in a queue on disk (`<OpenClaw state dir>/recordare/outbox`,
  owner-only, unsent batches only) and are retried for a few hours, across Gateway restarts — before, an in-memory queue
  gave up after about ten minutes and lost everything on restart (WORK_PLAN 6.6b (5)).
- `/mcp` answers plain JSON (`application/json`) instead of an event stream: a host or a script reads the answer
  without an SSE parser; clients still send `Accept: application/json, text/event-stream` (WORK_PLAN 6.6b (10)).
- Extraction prompt `extract.v14` (both modes, WORK_PLAN 8.11): the agent's own slips are stored in the first person
  ("I got the dates wrong: I said X, it is Y"), the options compared stay next to the choice, and a step of an open plan
  done before its date (a booking, tickets) amends the plan. Blind sets: personal 81.6 % → 90.1 %, entity 89.8 % → 93.3 %
  (`spikes/memory-eval/RESULTS.md`).
- `search_episodes`: a `search` with a period also returns up to 3 relevant episodes from outside it in `outsidePeriod`
  (before: only when the period had no match), ranked by relevance alone; chat excerpts behind a corrected episode carry `correctedBy`.
- Entity prompt `entity.v5` (WORK_PLAN 8.11): what the shared agent did with what someone handed it or asked of it (a
  booking taken, a payment recorded) is its own action, in the first person, with who asked — no longer "Benedetta
  registered the booking"; a C-number only for the person the item is about. The extraction writer gives an episode
  whose subject is a listed contact the conversation never names to the one person the episode names (before: the
  episode was dropped). Blind entity set: 91.9 % (3 runs; the booking question 0/3 → 2/3 + 1 partial).
- Near-duplicate resolver `resolve.v2`: of two tellings of the same event it hides the one the other fully covers, as
  the model names it (before: always the shorter one, so a later short message with the outcome — "sent at 16:10,
  confirmation number …" — was hidden); when each telling has something of its own, both stay visible.
- `search_episodes`: a `search` ranks by relevance alone; importance and recency only break ties (before: they
  outweighed relevance, so a person's big events pushed the small item the question names out of the results). Lists
  and `latest` keep the old order. Blind sets: personal 90.2 % → 96.0 %, entity 92.2 % → 94.3 % (3 runs each).
- Extraction prompt `extract.v15`: the extraction input of a group chat carries the group's name (the conversation
  `title`), so an episode told there says it was in that group. The system prompt is unchanged.
- `search_episodes`: a `list` with a query also returns up to 3 relevant episodes from outside the period in
  `outsidePeriod` (before: `search` only): what was said in the period is dated by what it tells (a move next month).
- `search_episodes`: chat excerpts (`fromChats`) carry `group`, the group chat's name, so what someone wrote no episode
  tells of still says in which group; the tool description tells agents that a vague span ("lately", "these weeks") is
  not a period. Blind personal set 96.0 % → 97.2 % (3 runs; the question on a brother's messages in two groups correct
  3/3).

### Fixed
- A pending fact or note that would replace or correct a stated one (someone else's claim, a tool's output, speech heard
  in the room) only proposes it: the stated item stays current until the pending one is confirmed, which retires it
  then (migration `PendingProposals1791160000000`; before, a sister's age heard as the holder's retired the holder's).
- Deleting a fact or a note (`DELETE api/v1/facts|notes/{id}`, or rejecting a pending one) leaves a tombstone (ids
  only: slot key or note category, subject, evidence messages), so a re-extraction of the same messages no longer writes
  it again; told again in a new message, it is learned (WORK_PLAN 4.13; migration `FactNoteTombstones1791110000000`).
- Vector searches filtered by memory scan HNSW indexes iteratively (`hnsw.iterative_scan = strict_order`, pgvector ≥ 0.8):
  on a large install a search could return fewer rows than asked once other memories filled the index (WORK_PLAN 4.14).
- Forgetting takes what only it supported (WORK_PLAN 5.5): deleting a message or a conversation, or forgetting an
  episode, deletes the episodes, facts and notes left without evidence (before: they stayed, backed by nothing); a plan
  confirmed, cancelled or rescheduled by a deleted message gets its earlier status back; a fact or a note that replaced
  an older one makes it current again; the digests built on what went are rewritten.
- Messages left unextracted (a failed extraction call, a lost idle job) no longer wait for the next message in their
  conversation: the nightly sweep extracts them before consolidating (WORK_PLAN 4.1).
- What the assistant relays from a tool (a web search, a page, a calendar) in that turn no longer becomes the person's
  stated fact or note: it is pending until confirmed, and an episode from it is the assistant's report (turn taint,
  WORK_PLAN 5.7). Before, a web page saying "X is allergic to nuts", repeated by the assistant, could be stored as the
  person's own.
- The same event told in two conversations extracted at the same time, or logged with `log_episode`, is no longer
  kept twice: the nightly consolidation checks the pairs no near-duplicate check could see, before writing the diary
  (WORK_PLAN 5.3; migration `EpisodeResolvedAt1791120000000`; the consolidation summary counts `duplicates`). When
  both tellings were never checked, the later recorded one is the one that may be hidden (it was decided by id order).

## [0.2.0] — 2026-10-10

The **agent memory** (D50): every memory belongs to an agent and is written in its first person — a person's own
assistant (personal) or an agent many people use (entity, "someone" until they say who they are); people are its
contacts; the agent learns sources (D49). **Breaking**: no consent state in Recordare (the client's switch is the only
one), "owner" renamed (memory / holder, below) — upgrade the client library and the connectors together with the
service. Quality (DeepSeek `deepseek-flash`, `spikes/memory-eval/RESULTS.md`): blind entity set 91.4 % (82.1 % in 0.1.0),
blind personal set 90.9 %, learned sources (dev set) 96.7 %.

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
  `GET api/v1/admin/memories/{id}/runs`.

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
  are contacts of that memory only. Migration `MemoryIdentity1791070000000`: `persons.kind` becomes `memories.mode`
  (`personal | entity`) with `memories.gender` (`masculine | feminine | neutral`, default masculine); every person that is
  not a memory is a contact of exactly one memory (`full_name`, `relation`, names in `person_aliases`), and the contacts
  a memory was missing are created (e.g. a person with their own memory who also talks to a shared device);
  `external_identities.kind` becomes `account` (was `client_user`: opens a memory) or `participant` (was `channel`, now
  also a client's participant id: names a contact inside one memory, created by ingest on first sight); every message
  records who said it (`author_kind` `self | contact | someone | agent | own | tool`, `attribution_method`,
  `attribution_confidence`); episodes, facts and notes record whose they are (`subject_kind`, `subject_person_id`,
  `subject_candidates`); a `clarifications` table is created for later. API: `GET / PATCH api/v1/me` and the admin
  memory routes take `mode` and `gender` instead of `kind`; `POST api/v1/admin/identities` takes `kind: account |
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
- **No "owner" any more** (D50, WORK_PLAN 8.10) — **breaking**: a memory is a memory, and the person a personal
  memory belongs to is its holder. Migration `Memories1791100000000` renames in place (no data changes beyond the
  renamed values): table `owners` → `memories`; every `owner_id` column and `persons.owner_scope` /
  `external_identities.owner_scope` → `memory_id`, with indexes and constraints renamed the same way (e.g.
  `facts_owner_key_idx` → `facts_memory_key_idx`); the enum value `owner` → `holder` for the participant role, the
  author role and the disclosure tier, origins `owner_lived` / `owner_told` → `holder_lived` / `holder_told`, the implied
  participant ref `owner` → `holder`; token scope `owner_settings` → `memory_settings`; extraction-run gate marker
  `gate:no-owner-message` → `gate:no-holder-message`. API: `ownerId` → `memoryId` everywhere (REST, `GET api/v1/me`,
  MCP, telemetry); ingest `participants[].role` and `authorRole` take `holder`; admin routes `api/v1/admin/owners…` →
  `api/v1/admin/memories…` (incl. `GET api/v1/admin/memories/:id/atlas`); telemetry stream `?owner=<id>` →
  `?memory=<id>`; `GET api/v1/me` `via` `owner_token` → `memory_token`; conversation resolution `owner_direct` →
  `memory_direct`. Atlas contract **v2** (`docs/ATLAS_EVENTS.md`): events carry `memoryId`, the snapshot `memory {id,
  name}`, the admin routes above. Client library: `memoryId` (e.g. `people.refresh()` → `{ memoryId, mode, atlasUrl }`),
  role `holder`; connectors send the account holder as participant `holder`. Clients and connectors 0.1.0 do not work
  with this version: upgrade them together with the service. The `X-Recordare-User` header and the prompts are
  unchanged.

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
