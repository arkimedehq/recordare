# Integrating a client platform (M6)

> Since D50 (2026-10-09) Recordare has no consent flag: every memory stores what its client sends; the on/off switch
> belongs to the client platform (WORK_PLAN 8.1).

How an agent platform (Arkimede first, any other after) uses Recordare as its users' memory, at the **full level**
(client API key, REST ingest + MCP). Contracts: `API.md`; events for the optional live view: `ATLAS_EVENTS.md`.

Infrastructure (standalone, or co-hosted with Arkimede on a small server): `DEPLOYMENT.md`.

**Use the client library** (`packages/client`, WORK_PLAN 6.7): it does sections 2–4 below the same way for every
platform — person and name sync, ingest, deletions, MCP recall with the right headers, the outbox delivery
policy — and passes the conformance suite. A platform keeps only its outbox storage and its chat mapping.

**Ready-made connectors** (`connectors/`, full level, §4c): Claude Code, Codex, OpenClaw, Hermes Agent, and an
OpenAI-compatible memory proxy for platforms without plugin hooks (AnythingLLM, Open WebUI, LibreChat).

## 1. Set-up (admin, once)
1. Create the client: `POST api/v1/admin/clients {name, kind: "platform", autoProvision: true}`.
2. Create its key: `POST api/v1/admin/clients/{id}/keys {scopes: ["ingest", "mcp", "read", "write"]}` (`write` for the person's own edits in a diary UI) — shown once; store it
   as a secret of the platform.
3. **The on/off switch is yours** (D50): Recordare has no consent flag and stores whatever your platform sends. Give
   your users (or your admins) a per-user memory switch and send nothing while it is off. Informing the people around
   the agent — and any legal basis, e.g. under the GDPR — is the duty of whoever deploys the platform, not a Recordare
   setting.

## 2. People
- Every request names the platform's user: `X-Recordare-User: <the platform's own user id>`. With `autoProvision`
  the person is created at first contact; `GET api/v1/me` returns `memoryId` — store it next to your user (it ties
  your telemetry to the person: OpenTelemetry attribute `recordare.memory_id`).
- Name the person after your user and keep it in sync (client key only): `PATCH api/v1/me {displayName}` whenever the user renames their
  profile (the name follows the platform). The user's choice of memory mode goes the same way: `PATCH api/v1/me
  {mode: personal | entity}` (D50 — `entity` for a shared account everyone uses: a home device, a robot, a place),
  accepted only while the memory is empty (409 `memory_not_empty`); and the first person's grammatical gender from the
  user's profile, any time: `PATCH api/v1/me {gender: masculine | feminine | neutral}` (default masculine). The client
  library's `PersonDirectory` keeps the name and the gender in sync with the profile on every lookup. `GET
  api/v1/me` returns `mode` and `gender` (show a shared memory as such) and `atlasUrl` when Recordare Atlas is installed
  (link it for your admins only: it shows every person's activity).
- **Erasing a user's memory** (WORK_PLAN 8.13): when you delete an account, or the user asks, `DELETE
  api/v1/me?confirm=<memoryId>` (library `eraseMemory(user, memoryId)`) erases their whole memory at once and for good.
  It needs a key with the `erase` scope (the admin gives it only when asked: keep it on the key of your account
  deletion path). Stop sending that user's messages first: with `autoProvision` a later ingest starts a new, empty
  memory (late edits, deletions and ends do not: they answer 404, which the library treats as done). Memories about someone else are never erased in bulk: forget them one by one (§4).
- **Two kinds of identity** (D50, WORK_PLAN 8.3): `X-Recordare-User` is an **account** identity — it opens the memory of
  that user's account. A participant's `identity` in an ingest (`{externalUserId}` for one of your users, `{channel,
  externalId}` for a channel id) is a **participant** identity — it names a contact *inside the memory being written*
  (created on first sight, named after its `displayName`) and never opens a memory. So the same user of yours can be
  one memory's account and a contact in another (a person talking to a shared device's memory): send their id as the
  participant's `identity` and their name as `displayName`. Binding by hand: `POST api/v1/admin/identities` (`API.md` §1).
- **Linking the holder's channel identity** (D51): in a personal memory, a channel sender speaks as "I" only once the
  holder links it — never inferred from names or content. The holder makes a one-time code (`POST api/v1/me/link-codes`
  → `RCD-XXXX-XXXX`, ten minutes; library `linkCode(user)`; or the console's "Link code"), sends it to the agent from that
  channel in a direct chat, then confirms the claim (`GET api/v1/me/identities` → `pending`, `POST
  …/pending/{id}/confirm`, or reject; library `holderIdentities`, `confirmHolderClaim`, `rejectHolderClaim`) within seven
  days; from then on (not retroactively) that identity is the memory's self; `unlinkHolderIdentity` undoes it. Send the
  message as usual, with the sender as a participant with its `identity`, and set `conversation.direct` when you know it
  (`false` for a group: a code there claims nothing). Recordare never stores the code's message; your model still sees
  it, so when `isLinkCode(text)` add `LINK_CODE_INSTRUCTION` for the model instead of a memory context (it replies that
  the code was received, without repeating it). A platform whose users are account identities (Arkimede) does not need it.

## 3. Ingest — never block the chat
- Send every persisted message (user, assistant, other participants, tool output) with `POST api/v1/ingest/messages`,
  with stable `externalId`s (idempotent: a retry never duplicates) and the conversation's participants.
- Recordare records who said each message (D50): your user's turns are the memory's own in a personal memory and
  "someone"'s in an entity memory unless the participant carries an identity; the assistant's are the agent's.
  Content that is the **agent's own** — knowledge you give it, what a device perceives, a document — goes with
  `own: true` on the message (`user` or `other` role), with `source: document | perception | ambient` when that is the
  conversation's nature. (Until WORK_PLAN 8.4 the extraction reads own content like your user's turns.) A text the
  agent should keep as knowledge to look things up in (a manual, a document) is a learned source instead (§3b).
- **Private messages** (D52): when your platform knows something is private — a chat the user marked private, a
  message they flagged — send `private: true` on the message or `conversation.private: true` on the request; the
  agent's replies that follow are private too. It is told only to whoever said it (and to the holder of a personal
  memory); `setMessagePrivate` (library) makes it private or public again. Recordare works out who is asking from the
  conversation (the latest person's turn), so ingest the turn before recalling for it (`contextWithTurn`, or flush your
  outbox) — in a shared chat a stale turn would read as the previous speaker. In an entity memory your diary UI reads the
  public only: private things are the agent's and the person's who said them.
- **Continuous listening** (a home device that hears the room, D45, WORK_PLAN 6.5): send the transcript as a
  conversation with `source: "ambient"` — the person whose memory it is as `user`, the others as `other` participants
  (with an identity when your voice recognition knows them), never `own`. The extraction is told it reads speech heard
  in the room (recognition errors, speakers possibly wrong); episodes are written as usual, but every fact and note
  heard there stays **pending** — hidden from recall unless asked for — until its person says it again in a chat or by
  voice to the assistant, or confirms it in the diary: a misrecognised voice must not make someone else's words theirs.
  Recall marks what was heard (`heard: true` on episodes and chat excerpts; "heard in the room" in the memory
  context), so the agent tells it as heard at home. When several people with a memory are in the room, send the
  transcript once to `POST api/v1/ingest/room` (client `ingestRoom`) with the speakers (their user id, or a voice
  profile) and the recipients — the people present whose memory is on: each memory gets it with its own words as
  `user` turns and the others as contacts (`API.md` §2 Room transcripts).
- Use an **outbox**: write the message to your own table first, send asynchronously, retry with back-off; a Recordare
  outage must never fail or slow the chat. Edits and deletions follow (`API.md` §2).
- When a conversation ends on your side (session closed, /new), say so: `POST api/v1/ingest/conversations/{id}/end`
  (or `hints.conversationEnded` on the last batch) — extraction then runs at once instead of after the idle delay.

## 3b. Learned sources (D49, WORK_PLAN 8.9)
What the agent learns — a manual, a page, a note, a book, a text of the person — kept apart from what happened and
searched with `search_knowledge` (`API.md` §2, §3).
- **Text only**: your platform turns files (PDF, office documents, web pages, transcripts) into text before sending.
- **No size limit** per source or per memory: `learnSource(user, {externalId, title, text, …})` in the client library
  sends a big text in parts automatically (4 MB each, cut at paragraph boundaries; `POST api/v1/ingest/sources` +
  `…/parts`). The same `externalId` again replaces the source (a new version); the same text again is a duplicate.
- **Who gave it**: `providedBy` `"me"` (default: the memory's self — your user in a personal memory, the agent in an
  entity one), `"someone"`, or `{name}` (a contact of the memory, created when new).
- **Conversation link**: pass `conversation: {externalId}` when the source was given in a conversation you ingest —
  that conversation's extraction then tells of the learning; without it Recordare writes the learning episode itself
  ("On 10 October 2026 I learned “…”").
- **Forgetting**: `forgetSource(user, externalId)` (`DELETE api/v1/ingest/sources/{externalId}`), or from the person's
  diary `DELETE api/v1/sources/{id}`; the text and its passages are deleted, the episodes keep a "forgotten source"
  marker. `sources(user)` (`GET api/v1/sources`) lists what the agent learned.
- **Do not send your RAG's search results** (or a knowledge base the agent merely consults) as sources: Recordare is
  what the agent *learned*. At most expose `learn_source` / call `learnSource` for what the person explicitly asks the
  agent to learn.

## 4. The memory-first contract (D54) and recall — MCP
**Required of every client, for every agent that uses Recordare** (maintainer, 2026-11-03): the memory is the agent's
own mind, not a tool among others — when it reasons it is always shaped by what it remembers, unless asked not to be.
How to use it is written once in Recordare and every client follows it:
1. **The charter in the system prompt**: `GET api/v1/charter` (library `charter()`) → `{charter, version}`; put the text
   in the agent's system prompt, in its stable part (prefix caching), and re-read it only when `version` changes. MCP
   hosts that pass a server's `instructions` to the model get the same text at `initialize`. A host that gives the
   agent no memory tools asks for `?tools=false` (library `charter({ tools: false })`): the charter then never tells it
   to search with tools it does not have.
2. **The memory context before every turn** of every agent — sub-agents, delegates and team members included:
   `POST api/v1/context` (or `{ingest}`, one round trip with the turn), the block appended at the end of the system
   prompt after the charter, never stored as a message. The self card is on by default: leave it on (an agent always
   knows who it is).
3. **The memory tools available** to the agent (§4 below: `search_memory`, `search_episodes`, `resolve_period`,
   `search_knowledge`, the writes), whatever other tools it has — the charter tells it to search its memory first.
4. **A fallback when Recordare does not answer**: the turn goes on without the block (or with the client's own memory,
   if it has one); never block the chat.
5. **Off only explicitly**: the person's (or the admin's) switch for the memory (D50: the client's on/off is the only
   one); an agent with no memory is a deliberate choice, not a default.

- Register Recordare's MCP endpoint (`/mcp`) in your MCP client with the key and `X-Recordare-User`.
- **Always send `X-Recordare-Conversation: <externalConversationId>`**: no longer for visibility — answers use the
  whole memory in every conversation, shared ones included (D50; privacy comes later) — but MCP writes need it as their
  evidence (with a client key a write without a resolvable conversation gets `"cannot write here"`; a personal token
  writes as the person), and recall leaves the current turn out of the chat excerpts (`API.md` §1).
  `X-Recordare-Viewers` is gone: Recordare ignores it.
- Before every answer (the contract above): `POST api/v1/context {query}` returns what came to mind as a fenced
  block for the end of the system prompt (`API.md` §3, WORK_PLAN 5.7) — the agent may answer without a tool call.
  `POST api/v1/context {ingest}` (scopes `read` + `ingest`; client library `contextWithTurn`) stores the user's turn
  and returns its context in one call — one round trip before each turn instead of two. The self card opens the
  block by default (D54; `card: false`, library `context(…, { card: false })`, turns it off). For a Diary page, `GET api/v1/cards`
  (library `cards`) gives who I am and a card per contact, each line linked to its detail.
- Tools: `search_episodes`, `search_memory` (facts and notes), `search_knowledge` (learned sources), `resolve_period`,
  `log_episode`, `correct_episode`, `forget_episode`, `remember`, `learn_source` (§3b). A platform that already ingests every turn may leave `log_episode` out (the
  connectors do); tool schemas: `TOOLS` in the client library.
- The person's own diary in your UI (`API.md` §4, e.g. the Arkimede Diary): timeline, episode detail, day / month
  diary, facts, notes, plans, and the person's edits (correct, forget, pin, confirm / reject what is pending) — scope
  `read`, `write` for edits; memory-direct (no conversation header). Among the notes, the memory's own conclusions
  (D26, D53): recurring patterns (`pattern: true`) and the agent's thoughts (`thought: true`; `category` `insight` /
  `question` / `opinion`) — show them as the agent's own ("a habit I noticed", "a thought of mine"), never as something
  the person said; there is nothing to confirm, the person may forget one (`DELETE api/v1/notes/{id}`).

## 4b. Standard MCP clients — Claude Code (basic level, WORK_PLAN 6.1)
A client that only speaks MCP (no ingest) uses a **personal token** bound to one person and one client:
```bash
# admin, once: a client for it and the person's token (scope mcp)
curl -H "authorization: Bearer $ADMIN_API_KEY" -H 'content-type: application/json' \
  -d '{"name":"Claude Code","kind":"mcp_client"}' $RECORDARE_URL/api/v1/admin/clients
curl -H "authorization: Bearer $ADMIN_API_KEY" -H 'content-type: application/json' \
  -d '{"clientId":"<client id>","scopes":["mcp"]}' $RECORDARE_URL/api/v1/admin/memories/<memory id>/tokens
# the person, in Claude Code (scope local = this project only; user = every project)
claude mcp add --transport http --scope user recordare $RECORDARE_URL/mcp --header "Authorization: Bearer rp_…"
```
- With a personal token reads are memory-direct (no conversation header needed).
- **Writes wait for the person**: such a client sends no conversation, so Recordare has none of the person's own words
  behind what the agent writes. `log_episode` is stored as stated by the assistant (inferred), `remember` as a pending
  note that recall shows only with `include_pending`; the person confirms it in their diary (read API §4, e.g. the
  Arkimede Diary). This is the poisoning guard (API.md §3), kept on purpose; a client that also ingests the
  conversation (Arkimede) gets confirmed memories — and so does a personal-token client that ingests the person's turns
  (the connectors, §4c): without a conversation named, the person's own messages from the same client in the last 30
  minutes are the evidence.
- Smoke test of the basic level (use a test person: it writes one episode, then forgets it, and one pending note):
  `RECORDARE_URL=… RECORDARE_TOKEN=rp_… npm run smoke:mcp` in `service/`. Tested with Claude Code 2026-10-08.
- Claude Desktop: its remote connectors expect OAuth, which v1 does not provide (D33); a local bridge that adds the
  header (e.g. `mcp-remote` with `--header`) should work but is untested.

## 4c. Connectors (full level, WORK_PLAN 6.6)
`connectors/` holds ready-made full-level clients, each with its README (English and Italian): **Claude Code** (plugin)
and **Codex** (installer) with shared capture hooks, **OpenClaw** (native plugin), **Hermes Agent** (memory provider),
and an **OpenAI-compatible memory proxy** (AnythingLLM, Open WebUI, LibreChat). Each one captures the turns, adds the
memory context before each turn (`POST api/v1/context`, with `ingest` where the turn is stored in the same call), ends
the conversation with `…/end` and, except the proxy, exposes the MCP tools (as `recordare_*` in OpenClaw and Hermes;
`search_knowledge` and `learn_source` not yet — a follow-up).
**One memory per agent** (D50): an agent platform's agent has one memory — a **personal token** with `mcp`, `ingest`,
`read` (client of kind `mcp_client`), or a **client key** with the same scopes (the proxy needs only `ingest` + `read`)
and the agent's account in its settings (`X-Recordare-User`). The people who talk to the agent (OpenClaw senders, Hermes
gateway users, the proxy's platform users) are **participants** with an identity, recognised inside that memory as its
contacts, and their turns are sent as role `other` with their author; the account holder (listed in each connector's
settings) is the memory's "I". One memory per person stays a setting (`memoryPer: "user"`, `RECORDARE_MEMORY_PER=user`,
`MEMORY_PER=user`). The holder's own channel identity is linked either by the connector's explicit list of the holder's
senders (`selfSenders`, `RECORDARE_SELF_IDS`, `SELF_USERS`) or by a link code the holder sends in a direct chat and
confirms (D51, §2): OpenClaw, Hermes and the proxy send a code to Recordare at once and tell the model what it is;
OpenClaw and Hermes mark direct chats (`conversation.direct`), the proxy cannot. Claude Code and Codex: the personal token's memory (its
user is the holder; no link code needed). Mode and gender of a memory are set by the
admin or with `PATCH api/v1/me` (a client key, or the memory's personal token with `ingest`), not by the connectors. A
known participant who shows up under a new name on the channel keeps their contact; the new name becomes an alias.

## 4d. Initiatives — what the agent says on its own (D53, WORK_PLAN 8.12c)
> **D55** (F1 built 2026-11-04; `INITIATIVES_DELIVERY.md`): Recordare decides who, when and on which channel. Your platform
> (a) declares its channels once (admin `PATCH api/v1/admin/clients/{id} {channels}`); (b) does nothing more for the
> in-turn channel — the memory context you already ask for before every turn (§4) carries the initiative due for whoever
> is talking (send `initiatives: {lookups: true}` when your agent has tools); (c) sends a **presence impulse** when it
> recognises someone (`client.presence(user, {channel, person?, confidence})` — your voiceprint or face model's score; an
> account is 1; add `busy: true` while you know the person is occupied — a call, a meeting, do-not-disturb — and `talking: true`
> while people in the place are talking, if you can tell) and speaks the `initiative` it gets back, or asks "is it you?" for `askWho`; (d) reports outcomes with
> `channel` and `reaction`; (e) delivers on the webhook event `initiative.deliver` (Recordare chose the moment; deliver
> on `data.channel`), takes the other events as information, and recognises a reminder it scheduled itself by `source`. The
> library's `InitiativeInbox` does (c)–(e) in one piece: you only write how you deliver one. The steps below still hold for push delivery.

> **Channels and presence by place** (D55 §5b–§5c, 2026-11-05): an initiative carries `channels` — the acceptable ones in
> order (`voice`, `messaging` only for a request or a promise, `chat`) — deliver on the first that reaches the person
> **now** on your side, and report the channel you used; `for.addresses` tells where to find the person (their verified
> identities: a Home Assistant person, a Telegram chat — bind them in the console). Send presence **by place**:
> `{channel, place, people: [{identity, confidence}], someone}` — everyone you recognise in the room and how many you
> cannot name, `home` for "at home" (not enough to speak). An arrival may get anything due, a refresh only a timed
> request or promise; with others in the room you get `opening`: say only that and listen — the person's "yes" is a turn
> of theirs, and the memory context gives you the initiative then. Bind the voice point that spoke to the conversation for
> a few minutes so the reply lands with it. With the client library: `deliver` returns `{outcome, channel}`,
> `addressesOn` finds the person on a channel, and `open` says the opening (`packages/client/README.md`).

Recordare pushes what the agent decided to say, ask or look up (`API.md` §4b). Your platform delivers it **when the
person is there** (presence is yours: a chat open now, a recognised voice in the room, someone at the panel), reports
what became of it, and runs the look-ups with its own tools.
1. Register a webhook for your client (admin): `POST api/v1/admin/clients/{id}/webhooks {url}` — keep the `whsec_`
   secret it returns. Or poll the feed (`client.initiatives(user, {since})`, every few minutes, a cursor per user) when
   your platform cannot receive calls; both carry the same objects.
2. On a delivery, verify it (`verifyWebhook(rawBody, headers, secret)` from the library — Standard Webhooks; answer 2xx
   at once, work afterwards) and read `data.user` (your id for the person) and `data.for` (whom it is for; null: the
   holder, or anyone for a shared agent's memory).
3. Deliver it when that person is present, in your channels — a message of the agent in the chat marked as its own
   initiative, a card on a panel, speech if you have a voice — and never after `expiresAt`. A `lookup` is for your agent:
   run it (a web search, a look at the room) and give the result back as a learned source (`learnSource`) or a
   perception; the agent's question then closes.
4. Report the outcome: `client.reportInitiative(user, id, 'said' | 'asked' | 'ignored' | 'declined' | 'done' | 'failed')`.
   It steers the agent: declined is final, ignored is offered once more a week later, then dropped.
   **A reminder your own tools already scheduled** (the agent set an automation in the same conversation): report
   `done` instead of saying it twice — but only when your task is for the same person (`data.for`: it names them or
   reaches one of their addresses) and is still to run or ran near the initiative's time. Your explicit, confirmed task
   is the truth (its time wins); a task that failed or was deleted covers nothing, so deliver the initiative: it is the
   safety net that keeps a reminder from being lost.
5. Quiet hours (`quietFrom` / `quietTo`, admin `PATCH api/v1/admin/memories/{id}`) and the daily limit per person
   (`INITIATIVE_DAILY_LIMIT`) are Recordare's; your own do-not-disturb and rate limits are welcome on top.

## 5. Observability (optional)
Recordare Atlas shows Recordare's own work from its telemetry stream; your agents (LLM calls, tools) appear when you
export OpenTelemetry GenAI traces to the atlas (`recordare-atlas` README) — metadata only, with `recordare.memory_id`
on the spans.
