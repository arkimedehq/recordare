# Changelog

All notable changes to Recordare. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/) (0.x: the API may still change between minor versions).
Italian: [CHANGELOG_it.md](CHANGELOG_it.md).

## [Unreleased]

### Added
- **Learning from outside** (WORK_PLAN 8.16 F1, D57, `docs/literature/learning-from-outside.md`): an entity memory keeps by
  itself the lasting knowledge it reads or is told — a web search's answer, a page, what a household member teaches — as a
  `knowledge` note with who brought it and how far to trust it, decided in code: read in a page → the new origin `learned`,
  pending and said with its source until a trusted person or a second independent source confirms it (the same page again
  confirms nothing); a household member teaching about the place → kept at once; trust per informant learned from
  outcomes (`informants`); perishable news fades (`LEARNED_NEWS_KEEP_DAYS`), slowly changing knowledge is told as possibly
  out of date (`LEARNED_RECHECK_DAYS`); instructions inside what it reads never become an intent or a rule. On by
  default for entity memories (`learnFromOutside`, console; off: the previous prompt and rules); personal memories
  unchanged. Prompt `extract.v24+entity.v12+learn.v1`; migration `Learning1791340000000`; `search_memory` notes carry
  `learned`.

## [0.13.0] — 2026-11-09

**The agent remembers what its senses noticed — as seen, once, until it fades.** A client describes in words what a
camera, a microphone or a sensor noticed; Recordare remembers it as seen, not told, with who was recognised, and lets it
fade after a while. Client library and connectors 0.13.0 (`perceive`).

### Added
- **Perceptions** (WORK_PLAN 8.12e, D56, `API.md` §4c): `POST api/v1/perceptions` and the client library's `perceive` — what
  the agent's senses noticed (a camera, a microphone, a sensor, a photo), told in words by the client; Recordare never
  receives an image, a sound or a face. Remembered without the model as an episode of the new origin `perceived` (seen,
  not told), with who was recognised; a repeat within `PERCEPTION_DEDUP_MINUTES` (10) is one; it fades after
  `keepDays` / the memory's `perceptionKeepDays` (console) / `PERCEPTION_KEEP_DAYS` (14), forgotten by the nightly
  consolidation — what a person said about it and the memory's own patterns stay. Search marks it `seen`, the memory
  context says `seen by me`, the diary shows its sensor and when it fades. Migration `Perceptions1791330000000`.
  Dev set `dataset_dev_perception`: 8 / 8.

### Fixed
- A date known to the minute is described with its local time (it was shown as a day only, and the agent took the hour
  from a UTC instant).

## [0.12.1] — 2026-11-09

**A reminder owed on its last day is said even when the day's share is spent**, and the timing rules are written out
in detail. Service only; client library and connectors stay 0.12.0.

### Fixed
- A request or a promise on the last day of its window is no longer held by the daily limit: held, it lapsed unsaid,
  because the clock's last chance only sees initiatives already made (found writing the timing rules in detail,
  `API.md` §4b).

### Changed
- `API.md` §4b, "Timing rules in detail": the daily limit against the last chance, timed reminders and the limit, the
  last chance before the quiet hours, how `busy` ends, an arrival held more than once, when the pause after a refusal
  starts, `talking` (every flexible initiative, two or more people, 90 s), plans told ahead, messaging to the holder, a
  camera presence; the first cut's "when to deliver is the host's call" corrected (D55).

## [0.12.0] — 2026-11-09

**What the memory means to say reaches people on OpenClaw and Hermes too.** The OpenClaw plugin sends an initiative to
the person's last direct chat as a session notice, without the model (`initiatives: true`); Hermes takes it through a
ready gateway webhook route, with no code. A diary entry cut short is written anyway. Client library and connectors
0.12.0 (`for.addressOn`).

### Added
- **Initiatives pushed to OpenClaw and Hermes** (D55 F3). What the memory decides to say on its own now reaches people
  who are not talking to the agent, without the model:
  - **OpenClaw plugin** (`initiatives: true`, off by default): the plugin reads the initiatives feed every minute (no
    public address) and sends each one pushed on `messaging` as an OpenClaw session notice on the person's last direct
    chat — a contact by their addresses, the holder by `selfSenders` or the senders mapped to them; the agent is told
    what it said for its next turn. `said` / `asked` when the channel took it, otherwise `failed` (Recordare arms it
    again the next day). The senders' sessions and the feed position survive a restart (`recordare/push.json` in
    OpenClaw's state dir). Needs an OpenClaw with session notices.
  - **Hermes Agent**, no code: a ready gateway webhook route in direct delivery (`deliver_only`, Standard Webhooks
    signature, filters on the channel and on whom it is for, `mirror_to_session`) — `connectors/hermes/README.md`. No
    outcome is reported that way.
  - **`for.addressOn`** on an initiative: the first address on each channel (`{"telegram": "<chat id>"}`), for templates
    that cannot index a list. Additive; optional in the client library's type.
  - `INITIATIVES_DELIVERY.md` §8 corrected: OpenClaw removed the heartbeat wake the design planned; session notices
    replace it.

### Fixed
- **A diary entry cut short is written anyway** (found on Kinox: the shared agent's 2026-11-07 still failed with 1200
  tokens). A reply cut at the output budget is no longer "repaired" with the same budget, which cut it again: it is asked
  again once with twice the budget (every LLM adapter with a budget — OpenAI-compatible and Anthropic). The day diary
  (`digest.day.v3`) gets a word limit that grows with the day's items — 120 words up to 10 items, 10 more for each
  further one, at most 300 — instead of a fixed 120 the model ignored on a dense day. Every day diary is rewritten once
  with the new version.

## [0.11.0] — 2026-11-08

**The memory learns about the household, and waits for the right moment.** It asks who someone heard named is, of
whoever named them, and checks what it half-knows about a person (D55 F2b: one learning question a day at most). Timing
v2 (`INITIATIVE_TIMING=v2`) adds the moment's context: a pause after a refusal, a person a client says is busy, people
talking in the room. A reminder moved is said at the new time and one asked again is not said twice; a dense day gets its
diary entry. Client library and connectors 0.11.0 (`PresenceImpulse.busy` / `talking`).

### Added
- **Gaps: the memory asks who someone is** (D55 F2b). Someone heard named in its episodes but not known — no relation,
  nothing held about them, not a speaker of their own — is asked about once, of whoever named them most ("Who is
  Elena?", in the memory's language; no model). One question at a time per person; a card whose name already says who
  they are through someone known ("Luca's mom") is not asked about; never dropped as not worth it. Migration
  `IntentWho` (intent kind `who`, `intents.about_person_id`).
- **Confirmations: the memory checks what it half-knows** (D55 F2b). A note about a person heard once or guessed (a
  habit, a preference, their profile, a relation; at least a day old) is asked about once of who could know: "I
  understood this: … Is that right, or is there more?" (no model; every language). After the gaps; one learning
  question (a question about someone, a gap, a confirmation) at a time and at most one a day for each person; a guess
  the patterns pass rewrites every night is as old as its first version; never a note learnt from an answer to the
  memory's own question, a private one, or a version of a note already asked about. Migration `IntentConfirm` (intent kind `confirm`).
- **Timing v2: the moment's context** (D55 F6, `INITIATIVE_TIMING=v2`, v1 included). After a declined initiative or a
  negative reaction nothing flexible for that person for 3 hours, after one ignored soon after it was given for 1 hour;
  a presence impulse may say `busy` (a call, a meeting, do-not-disturb: nothing flexible on any channel until it ends) and
  `talking` (people in the place are talking: the opening waits for a pause); an arrival held for a busy person or a
  conversation stays owed; what was given with others is learnt apart from alone. A time the person chose goes anyway;
  every hold is logged with its reason, and `INITIATIVE_TIMING_SHADOW` logs v2's holds beside v0. New knobs
  `INITIATIVE_COOLDOWN_DECLINED_MINUTES`, `INITIATIVE_COOLDOWN_IGNORED_MINUTES`, `INITIATIVE_CONVERSATION_GAP_SECONDS`;
  client library `PresenceImpulse.busy` / `talking`. Migration `PresenceMoment`. Dev set `dataset_dev_timing` with Casa
  Neri: v2 28 / 28, v1 and v0 25 / 28.

### Changed
- Whom a question about a person goes to counts the episodes that only name them too, not just those about them.

### Fixed
- **A dense day gets its diary entry.** A day digest was cut at 600 tokens: a day full of concrete details, in Italian,
  ran past it, the repair was cut again, and the day was retried and failed every night (found on Kinox). The day digest
  now has 1200 tokens, like the month; a skipped digest logs why, not only the error's name.
- **A reminder moved is said at the new time, and one asked again is not said twice** (`extract.v24` / `entity.v12`;
  found on Kinox). The extraction now sees the reminders the memory still holds (MY REMINDERS, only when there are
  some): a move ("sposta alle 21", now or in a later conversation) takes the armed reminder to the new time, and a
  request for one already held — or one the agent answers is already set — adds none, whoever asks. In code, a
  request or promise matching an armed one of the same person within a week moves it; in a window, the time said
  last wins. Dev set `dataset_dev_initiatives` with the two cases: 13 / 15, no trap, no duplicate.

## [0.10.0] — 2026-11-06

**The memory learns when each person takes what it says.** Timing v1 (`INITIATIVE_TIMING=v1`) reads the outcomes a host
reports — said, asked, done, or ignored, declined — per person, part of the day and channel, and lets a flexible
initiative wait where it is usually let go; `INITIATIVE_TIMING_SHADOW` logs what it would decide beside v0 first. Two
faults found by the new presence-by-place cases are fixed: a reminder asked for a time is said at that time however
busy the day, and messaging goes only to a real address. Service only: the client library and the connectors stay 0.9.0.

### Added
- **Timing v1: the memory learns when each person takes what it says** (D55 F4, `INITIATIVE_TIMING=v1`). Every outcome
  a host reports (said, asked, done — or ignored, declined) is counted per person, part of the day and channel; where
  someone has often let it go (the kitchen's voice in the morning), a flexible initiative waits for a moment they do
  take it, and a channel clearly better for them is preferred. With few outcomes nothing changes (v0's guess is the
  prior); a time the person chose, the quiet hours, identity and the room rules are never touched. Measured on the
  timing dev set (a person who ignores the morning voice: ignored 6 → 3, the other cases unchanged).
  `INITIATIVE_TIMING_SHADOW` logs what v1 would decide beside v0, to compare before switching.

### Fixed
- **A reminder asked for a time is said at that time, however busy the day.** The daily limit of initiatives held back
  a timed request: asked for 18:00 after three other things that day, it waited for the next day. A time the person
  chose now passes the limit, as it already passed the quiet hours.
- **Messaging only to a real address.** A person recognised by their Home Assistant person, voiceprint or face counted
  as reachable by message; such identities now only recognise someone, and an initiative goes by messaging only to an
  address on another channel (a Telegram chat). Both found by the new presence-by-place cases of the timing dev set
  (D55 §5c: 17 / 17 after the fixes).

## [0.9.1] — 2026-11-06

### Changed
- **Asking who it is names no one.** With nobody identified and something waiting for someone, the memory context
  asks the agent to find out who it is talking with — no longer "are you Chloé?", which told whoever was there that
  something waited for Chloé. Charter `charter.v3`. A name said by the speaker ("sono Eriona") stays what it is: not an
  identity, since anyone can say it.

## [0.9.0] — 2026-11-06

**Initiatives where the person is: by message, by voice, in the room.** An initiative now carries the channels it may
go on, in order, and the person's addresses (their Telegram chat, their Home Assistant person), bound once from the
console; presence impulses describe a place — who is in the room, or just someone — so a timed reminder can be said
by the satellite of the room the person is in, with only an opening when others are there. The client library hands
the host the channel to use and the person's address. Two cards of the same person merge from the console. Hosts:
a reminder your own tools scheduled covers an initiative only for the same person; a failed one covers nothing.

### Added
- **Initiatives: the channel chosen at delivery, presence by place, voice** (D55 §5b–§5c). An initiative carries
  `channels` — the acceptable ones in order; messaging only for a request or a promise (it interrupts) — and
  `for.addresses`, the person's verified identities (a Home Assistant person, a Telegram chat), bound from the console
  (a memory's card: link an address to one of its people) or the admin API. Presence impulses describe a place
  (`people`, `someone`, the channel `home`); in a room an arrival may give anything due, a refresh only a timed request
  or promise; one spontaneous announcement per person every `INITIATIVE_VOICE_PACE_MINUTES` (30, on trial); the quiet
  hours hold voice too; with others in the room only an opening is said ("Chloé, I have something for you: do you want
  to hear it?", in every language) and the initiative waits for her "yes". The clock reads live presences: a timed
  request whose person is in a room goes by voice; in an entity memory, what is for one person goes only so or by
  messaging to an address of theirs.
- **Client library: channels, addresses and the opening in `InitiativeInbox`.** The types carry `channels`,
  `for.addresses`, presence by place (`people`, `someone`, `home`) and `opening`. `deliver(user, initiative, {via})` may
  return `{outcome, channel}` — the channel it reached the person on is reported; `addressesOn(initiative, 'telegram')`
  finds the person there. With others in the room the opening goes to the new `open(user, initiative, opening)` and
  never to `deliver`: the initiative is not taken, and comes back at a later presence (a host without `open` says
  nothing). A presence from a camera is reported as voice. Existing hosts work unchanged.

- **Merge two cards of the same person** (admin console, a memory's card → People): "Eriona" and "Eriona Rossi"
  become one — names, addresses, what the memory knows about her and what it means to tell her move to the card kept
  (`POST api/v1/admin/memories/:id/persons/:person/merge`). Each contact shows how many episodes name it, to choose.
  Merging no longer drops what was forgotten about the merged contact, nor their sources, promotions, intents,
  initiatives and presences; a person who holds a memory is never merged.

### Fixed
- **An initiative said days later no longer says "yesterday".** An ask about a plan is worded two days after it and may
  be said for a week: "Yesterday you had the geometry test" was false from the start (seen on a real memory). The wording
  (`initiative.v4`) now gets the days each initiative may be said on and names a day relative to today only when it is
  said today alone (a reminder on its day still says "today"); otherwise the weekday or the date. The service checks it
  too, in every language (Intl): a text that may be said on a later day and names one gives way to the service's own
  sentence, which names the day.

## [0.8.0] — 2026-11-05

**Delivering initiatives in one piece, every setting from the console.** The client library gains `InitiativeInbox`:
webhooks, presence impulses and the feed together, each initiative handed to the host once and its outcome reported —
a host writes only how it speaks one. The admin console sets everything a memory and a client have (language, time
zone, quiet hours, passes on demand, token scopes, erasure, raw-log scope, channels, webhooks), explains every field and
moves to the Atlas style. The Claude Code and Codex hooks ask for look-ups. No breaking change, no migration: upgrade the
service, then the client library (`InitiativeInbox`) and the connectors.

### Added
- **Claude Code / Codex hooks ask for look-ups** (`initiatives: {lookups: true}` in the memory context, D55): these
  agents have tools, so a look-up the memory wants done may be given to them in the turn.
- **The admin console explains every field** (Italian and English): what it does and when to change it, under each
  setting; a legend of key and token scopes and of webhook events; a short introduction to people and clients.
- **The admin console in the Atlas style**: dark panels with corner brackets, display caps, monospace data; each card
  folds to its name, chips and counters ("Open all" / "Close all"; a single card opens by itself); every explanation
  folds behind a small "?", all shown or hidden at once from the header (remembered in the browser). No external fonts
  (the page's CSP stays same-origin).
- **`InitiativeInbox`** in the client library: what every host does to deliver initiatives, once — webhooks verified (a
  repeated `webhook-id` ignored), presence impulses, the feed caught up from a cursor, each initiative handed to the
  host's `deliver` once, the outcome it returns reported; durable `seen` / `cursors` stores optional.
- **Every setting from the admin console** (`/admin`): per memory also the language, time zone and quiet hours, the
  nightly passes on demand (facts review, habits, thoughts, initiatives), a personal token's scopes, and erasing the whole
  memory (typing its name); per client the raw-log scope, the channels (D55: chat / messaging / voice, always or on
  presence), the webhooks (register with their events — the `whsec_` secret shown once —, list, remove) and the `erase`
  scope for keys. `PATCH api/v1/admin/clients/{id}` takes `rawLogScope`; `GET api/v1/admin/clients` lists each client's
  webhooks (never their secret).

### Fixed
- **Proxy image build**: the bundle is built once on the runner's own platform and copied into the amd64 and arm64
  images (the arm64 build under QEMU crashed in `npm ci` and hung the v0.7.0 job until its 6-hour limit; the 0.7.0 image
  was published by hand on 2026-11-05); the job stops after 30 minutes.

## [0.7.0] — 2026-11-04

**Initiatives decided by the memory** (D55): Recordare decides who receives an initiative, when and on which channel;
the agent gives it senses — presence impulses (who it sees or hears, how sure) — and declares its channels. Every
full-level client delivers initiatives in the turn with no code (the memory context carries the one due for whoever is
talking); a presence impulse is answered with what to say now; the clock pushes timed reminders at their minute and
flexible ones at a fitting hour (`initiative.deliver`), every decision logged; an entity memory gives a person's
initiative only to that person, recognised surely enough. New sources: things left to finish ("did you hang the
laundry?") and questions routed to who could know. And interactive embeddings never wait for background ones (the
memory context within a budget). No breaking change in the API (additive fields, a new status `offered`, a new event
`initiative.deliver`); behaviour changes: initiatives reach the agent in the turn, timed requests are kept in the quiet
hours. Upgrade the service first (migrations `InitiativeDelivery`, `InitiativeTiming`, `IntentFollowup` run at
start-up), then the client library (`presence()`, the new types) and the connectors. Quality (DeepSeek `deepseek-flash`,
`spikes/memory-eval/RESULTS.md`): blind12 95.7 % mean with `extract.v23`; dev sets — follow-ups 7–8 / 8, initiatives
11 / 14 with `initiative.v3`, timing 9 / 9 (tuned on it), questions routed with no false one.

### Added
- **Initiatives decided by Recordare: who, when, where** (D55, `docs/INITIATIVES_DELIVERY.md` F1). A presence impulse
  (`POST api/v1/presence`, library `presence()`) — the agent says whom it sees or hears, by what, how sure — is answered
  at once with the one initiative to deliver now, or, in an entity memory with nobody identified, whom to ask "is it
  you?" (nothing revealed). The memory context carries the initiative due for whoever is talking (the in-turn channel:
  every full-level client delivers initiatives with no code; look-ups only with `initiatives: {lookups: true}`). An
  initiative for a person reaches only that person, recognised with confidence ≥ 0.6, or ≥ 0.85 when it came from a
  private message; in an entity memory one for nobody in particular reaches anyone identified, or whoever talks in the
  conversation it came from. New status `offered`, closed by what the conversation's extraction sees (said, asked, done,
  declined) or lapsing as expired / ignored. Initiatives gain `timing` (timed / flexible), `window`, `channel`,
  `identity`, `source` (the client's ids of the messages they came from), `offeredAt`; outcomes take `channel` and
  `reaction` and keep the delay; clients declare their `channels`; webhooks take `events`. Memory charter `charter.v2`
  (how to use an initiative line). Migration `InitiativeDelivery`. Additive, no breaking change; a client library
  release is needed for `presence()` and the new types.
- **Timing v0: the clock chooses the moment** (D55 F2a). Pending initiatives with a channel that always reaches the person
  are pushed when it is time: a timed one at its minute (the memory is swept at that minute), a flexible one when a
  cost-sensitive gate passes (the worth × the hour's fit ÷ what the person already got today, against the kind's
  threshold), an owed one at its last chance; never in the quiet hours. Pushed ones go out as the new webhook event
  `initiative.deliver` (`pushedAt`); every decision — clock, presence, turn — is logged with its probability
  (`initiative_decisions`, migration `InitiativeTiming`).
- **Timing rules from `dataset_dev_timing`** (D55 F2b, a deterministic timeline set, `timing_eval.py`): a time the person
  chose is kept in the quiet hours; the last chance comes before them; owed initiatives come first in a turn or a
  presence; an entity memory never pushes a person's initiative on a shared channel; the memory context keeps the self
  card and an initiative when the embedding server is down. `INITIATIVE_TIMING=due` is the evaluation baseline. v0 9 / 9,
  due 8 / 9 on the set it was tuned on (RESULTS.md).
- **The model's hours** (`initiative.v3`, balanced and full): each worded initiative carries the local hours when saying
  it would be natural (the flour order before the mill's noon deadline, the bins in the evening); the clock uses them in
  place of the kind's default. `dataset_dev_initiatives`: 11 / 14 like v2 on the same extraction (RESULTS.md).
- **Things left to finish** (`extract.v23` / `entity.v11`, migration `IntentFollowup`): something a person started and
  must finish later (the laundry to hang, a roast in the oven, a form before its deadline) becomes, when it makes sense,
  the agent's own question for that person — closed when they say it is done; not what ends on its own, is finished in
  the conversation, is trivial, a routine or someone else's job. `dataset_dev_followups` 7–8 / 8; blind12 95.4 / 94.4 /
  97.2 % (the shorter v23 over v22's 94.1 % mean, h11 right again; RESULTS.md). The initiative sweep now also visits memories that only have
  initiatives waiting, so they close.
- **Questions to who could know** (D55 F2b step 4, `docs/INITIATIVES_DELIVERY.md` §6): a question the memory holds about a
  person is asked to that person when they talk to the agent, else to whoever told it most about them (the holder, or an
  identified contact in an entity memory; nobody identified: not asked), one at a time for each person, with a sure
  recognition when it is about someone else; questions about the world stay look-ups for the agent's tools. A question
  about a plan is left to the ask after its day only while the plan is open. `dataset_dev_asking`: 0 false, 0 traps in
  four runs (RESULTS.md).

### Fixed
- **The memory context no longer waits for background embeddings.** On a host sharing a CPU embedding server (one
  request at a time, e.g. Arkimede's), the turn just ingested — tool outputs of 4–8 000 characters — was embedded in
  one batch right when the next question came, and the context's query waited behind it: measured on Kinox
  (i3-1215U, bge-m3 on CPU), 4 970 ms instead of 110–150 ms, past the host's 2.5 s timeout. Embeddings now have a
  priority: interactive ones (memory context, recall tools, `remember`) are sent at once; background ones run one
  request at a time, in requests of at most `EMBEDDING_BACKGROUND_BATCH_CHARS` characters (default 2000), and start
  after a pause in the conversation (`EMBEDDING_QUIET_MS`, default 10 s; 60 s of waiting at most). Same case after:
  137 ms. Repeated queries come from a small cache, and the recall tools of one turn share one request for the same
  query. The memory context waits at most `CONTEXT_EMBEDDING_BUDGET_MS` (default 1.5 s) for its vectors, then serves the
  self card alone instead of making the host wait. `recall.served` (Atlas) carries `embedMs`, and `late` when the
  budget was missed. No API change. Behaviour change: during a conversation, a new message is vector-searchable up to a
  minute later (full-text finds it meanwhile); on a GPU or hosted embedding provider, raise
  `EMBEDDING_BACKGROUND_BATCH_CHARS` and set `EMBEDDING_QUIET_MS=0` (`docs/KNOBS.md`).

## [0.6.0] — 2026-11-03

**The agent's own mind** (D53, D54): the memory now thinks on its own — insights, questions and opinions drawn from what
the agent lived, what it learned about itself from its own replies, and how it does recurring tasks — and **pushes**:
initiatives (a request or promise with a date, the "how did it go?" after an appointment, a look-up for the host's own
tools) delivered by Standard Webhooks or read as a feed; a reminder only when asked. And the memory is the agent's mind,
not a tool among others: a memory charter for the system prompt (full, or context-only for hosts without memory tools),
the memory context worded as what came to mind and opened by the self card by default, every connector following the
memory-first contract (`INTEGRATION.md` §4). No breaking change in the API; behaviour changes: the self card is on by
default (`card: false` turns it off). Upgrade the service first (migrations `Thoughts`, `SelfNotes`, `Initiatives`,
`IntentMessages`, `InitiativeWorth`, `Procedures` run at start-up), then the client library (`charter()`,
`initiatives()`, `reportInitiative()`, `verifyWebhook()`) and the connectors. Quality (DeepSeek `deepseek-flash`,
`spikes/memory-eval/RESULTS.md`): blind12 97.2 % with `extract.v21`; dev sets — thoughts 11.8 / 14, self-model 13 / 15,
procedures 10–11 / 14, initiatives 11 / 14 with no false initiative.

### Added
- **The agent's own thoughts** (D53, WORK_PLAN 8.12a — the first step of the agent's own mind): a nightly thought pass
  draws insights, questions and opinions from what the agent lived (public episodes only), each resting on the episodes
  it cites; it runs only when the new episodes gathered enough importance, never thinks without new evidence (a question
  about something awaited apart), supports, weakens, revises and retires its thoughts as later episodes come in. They
  are notes with `thought: true` (categories `insight` / `question` / `opinion`), told as the agent's own thoughts in
  the recall tools, the memory context and the Diary (`GET api/v1/notes`), never as something said; an opinion may
  differ from what the holder says. Nothing to confirm (D26): a client may forget one (`DELETE api/v1/notes/{id}`).
  What the memory concludes by itself now has its own origin, `reflected` — the recurring patterns move to it (they
  were stored as lived by the holder). Quality-profile knob `thoughts` (on in balanced and full), `THOUGHTS` override,
  LLM task `thoughts`; admin `POST api/v1/admin/memories/{id}/thoughts` runs the pass alone. Migration `Thoughts`.
- **The agent's self-model** (D53, WORK_PLAN 8.12b): the thought pass also learns about the agent itself from its own
  replies and how the person reacted — a mistake to avoid ("I keep getting her shifts wrong: check the rota first"),
  what works with a person (short answers, lists, no unasked advice), a promise and what became of it, trust shown —
  never from introspection: notes of category `self` (`thought: true`), backed by those messages, the same outcome on
  two days; told in recall and the memory context as what it learned about itself, and in the self card as "about me as
  an agent" (`GET api/v1/cards`). Migration `SelfNotes`.
- **Initiatives — the memory pushes** (D53, WORK_PLAN 8.12c, first cut): what the agent decides to say, ask or look up on
  its own, from what it holds — an open plan past its date (an `ask` two days after), a promise or a request with a date
  (a `say` that day), a question it holds (a `lookup` for the host agent's own tools) — fired when due, after the memory's quiet
  hours (`quietFrom` / `quietTo`) and within a daily limit per person (`INITIATIVE_DAILY_LIMIT`), offered once and again a
  week later at most, lapsing quietly when nobody is there in time. Delivered by **Standard Webhooks** (admin
  `POST api/v1/admin/clients/{id}/webhooks`, a `whsec_` secret shown once, signed headers, retries, `410` disables,
  public https unless `WEBHOOK_ALLOW_PRIVATE`) and readable as a feed (`GET api/v1/initiatives`); the client reports what
  became of each (`POST api/v1/initiatives/{id}/outcome`) and the agent's intent follows. Library `initiatives`,
  `reportInitiative`, `verifyWebhook`. The host delivers when the person is present and runs the look-ups. Migrations
  `Initiatives`, `IntentMessages`, `InitiativeWorth`. The extraction (`extract.v21` / `entity.v9`, INTENTS) turns a promise
  of the agent or a request made to it with a date into an intent (withdrawn or done in the conversation, it closes); in
  balanced and full the model words each initiative and gives it a `worth` (`initiative.v2`, knob `initiativeWording`). An
  ask waits two days after the plan and is not made once they told how it went, nor for a plan nobody told ahead of its day
  (a decision is no appointment — the first live initiative); a request with a time keeps it. Recordare does its own work
  whatever the host's tools did: a reminder the host also scheduled is the host's to deduplicate. **A reminder only when
  asked**: a plan or an event only told is remembered, not reminded (no day-before reminder); an event told ahead of its
  day is an appointment, asked about after unless its outcome was told. Measured: dev_initiatives 11/14 in 3 runs, 0 false, no unasked reminder.
- **The agent's procedures** (D53, WORK_PLAN 8.12d): how it does a recurring task for a person or place, learned from an
  outcome on its own replies — taught, corrected, explicitly approved — as "when <situation>, <how I do it>" (notes of
  category `procedure`, `thoughts.v7`); one clear correction is enough; revised when the way changes; told in the memory
  context as "how I do it (learned)". Migration `Procedures`.
- The admin reads a memory's items (D52): `GET api/v1/admin/memories/{id}/episodes` (`source=own|claims`), `…/facts`,
  `…/notes` — the diary's lists read as the whole memory, private items marked whose they are — and forgets one
  (`DELETE …/episodes|facts|notes/{id}`). Admin key only; Recordare Atlas lists and forgets with them.

### Changed
- **The memory is the agent's mind — a memory-first contract for every client** (D54, WORK_PLAN 8.14): the memory
  charter, how an agent uses its memory (its own mind, reasoned from before answering, searched before other tools and
  before "I don't know"; "remember / memories" mean this memory, not files or photos), served by `GET api/v1/charter`
  (`{charter, version}`, for the agent's system prompt), as the MCP server's `instructions`, and named by the
  `<memory-context>` block; `?tools=false` gives the form for a host with only the context, no memory tools (never
  "search", rather "I don't remember"; the proxy's default, `MEMORY_TOOLS=true` for the full one). The block is now worded as what came to the agent's mind from its own memory (no longer "use it only if
  it helps"). The self card opens the block **by default** (`card: false` turns it off; ≈ 130–150 tokens). A short
  follow-up ("e lui?", any language, `CONTEXT_SHORT_QUERY_WORDS`) is matched with the person's previous turn too. The
  contract, required of every client (`INTEGRATION.md` §4): the charter in the system prompt, the context before every
  turn of every agent, the memory tools available, a fallback, off only explicitly. Library `charter()`; every connector
  follows it.

### Fixed
- The nightly pattern pass deleted the agent's thoughts written the night before as "weak patterns" (fewer than three
  episodes): its sync now looks only at patterns.
- In an entity memory, someone talking through a shared agent account (the platform sends the account's name as the
  holder participant's) was taken for the agent, which then quoted itself; such a speaker is now someone.
- An outcome told after the sweep's time no longer hides an ask (re-running an evaluation over a memory already holding
  later messages hid it).

## [0.5.0] — 2026-10-27

**Private memories**: a person can keep what they said between themselves and the agent — by a flag from the client
(a message, or a whole chat) or in their own words ("keep it between us") — and every read follows it: a private
memory is told only to whoever it belongs to and, in a personal memory, to the holder; the admin reads everything (D52).
No breaking change: the API only grows; upgrade the service first (the migration `PrivateMessages` runs at start-up),
then the client library and the connectors. Quality (DeepSeek `deepseek-flash`, `spikes/memory-eval/RESULTS.md`): the
blind sets within the noise of one run (blind12 95.4 %, blind5 90.7 %, entity blind11 95.0 %), no message made private
on them by mistake.

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
