# Initiatives on every client: who, when, where (D53, D55, WORK_PLAN 8.12c)

Status: **spec, decided** (D55, maintainer 2026-11-04); built in phases (§9). Italian:
[INITIATIVES_DELIVERY_it.md](INITIATIVES_DELIVERY_it.md). Contract today: `API.md` §4b; platform guide: `INTEGRATION.md`
§4d; research: `RESEARCH_NOTES.md` H14.

An initiative is something the agent decided to say, ask, look up or do on its own, for a person. Recordare creates
them; only the agent's body (the client) can speak. The aim stays the one of D50: **give a machine — a robot — a brain
of its own**. A brain does not wait to be asked: it reminds, follows up, and, above all in an entity memory, **asks to
learn** — as a child learns the people and the world around it, to become autonomous.

## 1. Why D53's split changes

D53 left *when* to the host ("deliver it when the person is present"). Observed on Kinox (2026-11-02 → 04): two
initiatives created, none delivered (no webhook, no feed reader, no connector delivering), both expired; in the same
conversation the host had scheduled its own reminder with its tools, so a delivered initiative would have reminded
twice. And the hard part — choosing the moment — cannot be the host's: every host would solve it differently, or not
at all. **D55**: Recordare decides **who, when and on which channel**; the agent gives it **senses** (who is there now,
how sure), **channels** (what it can reach), **delivery** and the **outcome**.

## 2. Roles

| Recordare (the mind) | The agent (the body) |
|---|---|
| creates initiatives and their timing (class, window) | declares its channels and how each reaches a person |
| decides who may receive one (identity, confidence, sensitivity) | sends **presence impulses**: who it sees or hears now, how sure (voiceprint, face, account), for how long |
| decides when and where (a moment, a channel), learns from outcomes | delivers in its channel, in its own voice |
| asks to learn (entity memory), retires questions when answered | runs look-ups with its tools (web, camera, microphone: D53) |
| never reads a sensor, never does biometrics | does biometrics on its side; sends only "it is Eriona, 0.9" |

## 3. Who — knowing the person

- **Personal memory**: an initiative is for the holder (or a contact the holder deals with through the agent); the
  account says who is talking. No identification problem.
- **Entity memory**: the agent talks with many people; an initiative for Eriona must reach Eriona. Every identity comes
  with its **source and confidence** (D50: declared, voiceprint, face, inferred):

| Source | Produced by | Confidence |
|---|---|---|
| platform account / channel sender (chat, messaging) | the platform | high |
| link code confirmed by the holder (D51) | Recordare + the person | high |
| "sono Eriona" in chat or by voice | nobody: anyone can say a name (maintainer, 2026-11-06) | none — remembered, never an identity |
| voiceprint | the agent (e.g. Wyoming / Home Assistant) | the agent's, sent as a number |
| face | the agent (camera) | the agent's, sent as a number |

- **Thresholds by sensitivity**: a harmless initiative ("did you hang the laundry?") needs medium confidence; one drawn
  from a private memory (D52) or about someone's personal matters needs high confidence; an unidentified person never
  learns the content.
- **Unknown speaker** while an initiative waits for someone: the agent may ask who it is talking with — naming no one
  (a name would tell whoever is there that something waits for that person; maintainer, 2026-11-06) and revealing no
  content — the same mechanism as clarifications (vision L1). The answer is remembered, not an identity: anyone can say
  a name.
- Biometric templates stay with the agent (vision: voiceprints on the device); Recordare stores who was recognised, by
  what, how sure — never a voice or a face.

## 4. When — two timing classes

- **Timed**: a request or promise with a time ("ricordami alle 9"), an appointment's reminder that was asked for. Due at
  that moment, on a channel that reaches the person **now**; if none does, at their first presence or turn before
  `expiresAt`.
- **Flexible**: a follow-up of something left unfinished ("Eriona ha messo i panni a lavare, deve stenderli" → after a
  few hours, "did you hang the laundry?"), how a visit went, a question the agent holds. A **window** (`notBefore`,
  `notAfter`), and inside it **Recordare chooses the moment** from:
  - signals: the person is present (an impulse), is talking (a turn), just arrived home;
  - their routines (the pattern pass, 5.4: "Eriona is home after 18:00");
  - outcomes of earlier initiatives (said, ignored, declined, an annoyed reply).

Choosing the moment is the core of the work, learned in steps (H14):
- **v0** — at creation the model proposes the window and a fitting moment ("a few hours later, when she is home"), in
  the same call that words the initiative today (`initiative` task); in economy, windows by kind from rules.
- **v1** — learning from outcomes per person × channel × time of day × time since the event: a simple bandit over time
  slots, its prior from v0.
- **v2** — the moment's context (busy, talking with others, just declined something) — **built 2026-11-07**
  (`INITIATIVE_TIMING=v2`, v1 included): after a declined initiative or a negative reaction nothing flexible for that
  person for 3 hours, after one ignored soon after it was given for 1 hour (in a room, a turn and the clock); a client's
  `busy` on a presence holds what is flexible on every channel (not in a turn: they are talking to the agent); a client's
  `talking` in a place, with two or more people there, holds every flexible initiative there — the opening included —
  for 90 seconds from the last one (several people named on a voice impulse describe the room, not a conversation); an arrival held for a busy person or a conversation stays owed (the next impulse there is still the
  arrival); v1's outcomes given with others (after an opening) are learnt apart from alone, and where they are usually
  let go the opening waits for the person alone. A time the person chose goes anyway; every hold logged with its reason
  (`features.moment`; in shadow beside v0). The exact rules (the daily limit against the last chance, how `busy` ends,
  when the pause starts…): `API.md` §4b, "Timing rules in detail".
- Measured on a dev set of **timelines** (events, presences, turns) with gold acceptable windows and a penalty for
  needless interruptions; observed on Kinox.

## 5. Where — channels, declared by the client

| Channel | Reaches the person | Rules |
|---|---|---|
| **in the turn** (the memory context) | while they are talking | best for flexible ones; interrupts nobody; quiet hours do not apply |
| **chat** | always (the message waits) | seen when they open it |
| **messaging** (Telegram, WhatsApp…) | always, and it interrupts | quiet hours, daily limit per person |
| **voice / room** | **only after a presence impulse** | identity above threshold; the impulse's short validity |

A client declares its channels once (admin, per client: `channels: [{kind: chat | messaging | voice, reach: always |
presence}]`). The in-turn channel needs no declaration: every full-level client already calls `POST api/v1/context`
before each turn (D54).

### 5b. The channel is chosen at delivery (maintainer, 2026-11-05)

Choosing the channel when an initiative is created (`pickChannel`: timed → messaging then chat, flexible → chat then
messaging; voice never) is wrong twice: what a client reaches differs per person (Andrea has Telegram, Chloé does not)
and per moment (voice reaches someone only while they are there). Decided:

- **Acceptable channels, in order, on the initiative; the channel is chosen at delivery.** Recordare says which channels
  are acceptable and in what order; the client delivers on the first one that reaches **that person now**, and reports
  the channel it used with the outcome. Once delivered on one channel the initiative is taken (exclusive, as `offered`
  today): never twice. Recordare need not know what Telegram is: the same contract fits any platform.
- **Messaging only for what was asked or promised at a time**: a timed reminder, a request the person made, a promise I
  made. Asks, follow-ups, questions and look-ups never interrupt by message: they wait for a turn, a presence or the
  chat. Quiet hours and the daily limit always apply; in a group conversation nothing private and nothing that needs
  `identity: high` — only a direct conversation with the person it is for.
  - Order for a timed reminder, a request, a promise: voice (if present) → messaging → chat.
  - Order for everything else: voice (if present) or the turn → chat.
- **A timed reminder is not lost**: if at its moment no channel reaches the person now, the next one in the order takes
  it (messaging, then chat, which always reaches). A flexible one waits for its moment; at the window's end, `ignored`.
- **The reply comes back as a turn.** The person answers where the message reached them; the client ingests the reply in
  the conversation that holds the delivered message (`source` points to the initiative), and the extraction closes it
  (done, answered, learned) with no extra LLM call, as in the turn (§7).
- **Voice: spontaneous announcement at every presence**, with an opening that reveals nothing when others are
  present: §5c.

Contract changes (additive, built 2026-11-05, `API.md` §4b): `channels: [kind…]` in order on the initiative (feed, webhook,
presence, context) beside `channel` (where it was offered or pushed); the outcome carries `channel`; the per-client declaration stays as
what the clock may push on (`channels` lists what the initiative accepts; the client uses those it has).

### 5c. Presence and voice (maintainer, 2026-11-05)

Worked out on the maintainer's home (Home Assistant with persons, cameras, a voice satellite in the kitchen; soon the
quacksat duck, a mobile voice satellite) but written as a **standard**: we do not know what users will have, so the
agent integrates as many devices as it can through one hub and the guide says what can be used (§5c.8).

**1. Who is the agent, who are the people.** The most used set-up is an **entity memory**: a new digital being with a
brain of its own (Arkim3de on Kinox), whose body is one account on the platform (Arkimede's Wyoming user). The people of
the house are **contacts of that memory**, not users of the platform: Chloé needs no Arkimede account. Every address of
a person is an identity on **their card in Recordare** — a verified participant identity: `homeassistant` /
`person.chloe`, `telegram` / her chat id, later a voiceprint or a face label — bound once from the console (the admin's
`POST api/v1/admin/identities`) or by a link code (D51). One list, used both ways: a presence impulse naming
`person.chloe` resolves to Chloé (as today), and an initiative for Chloé carries **her addresses per channel**, so the
body knows where to find her. The addresses are the agent's own (D50: the memory belongs to the agent), given back to
the body that registered them. Personal memories (a user's own) keep chat and messaging; voice at home for them can be
added later without changing this.

**2. Three levels of presence.**

| Level | Example source | Enough to speak? |
|---|---|---|
| **at home** | Home Assistant `person.*` is `home` (companion app, router, GPS) | no: keeps what is due ready |
| **in a room** | per-room Bluetooth (Bermuda, ESPresense), a face recognised by Frigate, the duck seeing someone | yes, if the room has a voice point and the identity is sure enough |
| **talking** | a voice turn on a satellite | already the in-turn channel |

An occupancy sensor without identity (mmWave, motion, Frigate's "person" without a face) is **someone** in the room:
it can lead to "who am I talking with?" (§3), never to the content.

**3. Everything from Home Assistant.** The platform reads presence from Home Assistant and speaks through it. MCP is not
enough: its tools are called by the model on request — presence must arrive by itself, with no model, and an
announcement must go to one chosen satellite, certain and free (Home Assistant's broadcast intent speaks on every
satellite). The **same URL and token** already configured for Home Assistant's MCP server open its **WebSocket API**:
the platform subscribes to the events (persons, area sensors, the duck's place) and calls the satellites' actions
directly. No new setting. Without Home Assistant a platform has chat, messaging and voice in the turn.

**4. Presence sources and voice points** — two registries the platform derives from Home Assistant, nothing to keep
by hand:
- **presence sources**: who is in which area and how sure, from any entity Home Assistant has (above);
- **voice points**: every `assist_satellite` entity with its area from Home Assistant; a **mobile** one takes its area
  from a sensor (the duck: `sensor.quacksat_where` / the MQTT `place`; quacksat already asks to name the duck's places
  after Home Assistant's areas, so the two match).

To reach a person by voice the platform uses **the voice point in the area where the person is** — a fixed satellite
before the duck; none there → the next channel in the order (§5b). Later the duck may walk to the person for a timed
reminder (`go_to`).

**5. Impulses and the moment.**
- The impulse describes **a place**, not one person: `{place, people: [{identity, confidence, by}], someone: n,
  ttlSeconds}`. Recordare sees whether others are there and decides on the opening (6) itself.
- **Changes, not states**: an impulse for someone with no live presence in that place is an **arrival** (a natural
  break: it may start a flexible initiative); a refresh only keeps the presence live.
- The **clock reads live presences** (today the `presences` table is written and never read): at a timed reminder's
  minute, a live room presence makes voice the first channel.
- **Pace**: at most one spontaneous announcement per person every **30 minutes** (on trial, to be corrected from
  outcomes); none while the platform says people there are talking with each other (built in v2: `talking`, 90 seconds,
  with two or more people in the place); quiet hours apply to voice too, except a
  timed reminder (asked for that moment).

**6. Saying it and hearing the answer.**
- **Alone in the room**: the voice point says the initiative **and then listens**, no wake word — on a Home Assistant
  satellite `assist_satellite.start_conversation` (to verify on the installed version; `announce` without listening as
  the fallback: the person answers with the wake word); on the duck the bridge speaks and opens the microphone (7).
- **The answer lands in the same conversation**: when it speaks, the platform writes the message in the person's chat
  and **binds that satellite to that chat for a few minutes** (Arkimede: `ConversationFocusService`, already used for
  satellites); the reply turn goes there, with the speaker known (the platform just addressed Chloé: medium
  confidence), reaches Recordare as a turn, and the extraction closes the initiative — answered, done, learned — with
  no extra call.
- **Others in the room**: only the opening, which reveals nothing — "Chloé, I have something for you: want to hear
  it?" (the memory's language, from `service/src/lang`, every language) — then listening. A "yes, tell me" is an
  ordinary turn of Chloé's: the memory context already carries the initiative for the identified speaker (in-turn
  channel), so the agent says it and listens again. "Later" or silence: it **stays pending** (not `ignored`) and comes
  back at a later presence, within the pace.
- **What counts as said**: the announcement played → said (`said` / `asked`, channel `voice`); an answer → closed by the
  extraction, as in chat; played and unanswered → an ask stays open to the end of its window, as in chat; an opening
  without a yes → not said, still pending.

**7. The duck (quacksat) with Arkimede as its bridge.** The duck runs quacksat's `agent` backend and Arkimede becomes its
bridge (quacksat's agent protocol v1: audio and events over WebSocket, the platform runs STT → LLM → TTS, several ducks
on one bridge by name). Owed on quacksat's side: a server-initiated announcement (protocol v1.2: `announce` from the
server, then `listen.start` to hear the answer — today `say` goes only from the duck to the server) and the place as an
event (it is already a Home Assistant sensor). Later the duck's camera with face recognition is a mobile presence source.

**8. What users can install** (the guide, from the minimum to the full set):
1. the Home Assistant companion app and one voice satellite (Voice PE or similar): presence at home, voice in the turn;
2. a satellite in every room people live in;
3. per-room Bluetooth (Bermuda with ESPHome proxies, or ESPresense) with a phone or a watch: who is in which room,
   without cameras, cheap;
4. Frigate with face recognition where there are cameras;
5. mmWave occupancy, to know someone is there even without a phone;
6. a mobile satellite (the quacksat duck).

**Contract changes** (additive, built 2026-11-05, `API.md` §4b): the initiative carries `for.addresses: [{channel, id}]` (the person's
identities); the presence impulse per place (`people[]`, `someone`); the opening sentence with the initiative when
others are present (`opening`); the outcome's `channel`; an initiative kept pending after an unanswered opening.

## 6. Learning by asking (entity memory)

An entity memory starts empty and must come to **know** the people and the world around it, then act on its own.
Besides reminding and following up, it **asks**:
- **who** — "how should I call you?", "who am I talking with?" (identity, §3);
- **about people** — relations, roles, preferences, routines it does not know yet ("who is Marta for you?", "does Leo
  have school on Saturdays?");
- **about the world** — what it saw or heard and could not place ("what was that noise at night?"), what a word means
  in this house.

A question the agent holds (D53 thoughts of kind `question`) gets an **answerer**: the world, through the agent's tools
(a `lookup`, as today), or **a person who could know** (an `ask`, delivered under §3–§5 to someone present). An answer
becomes a memory with its source; the thought pass retires the question. Rules: one question at a time per person, never
to an unidentified person when it reveals something, never nagging (an ignored question waits for new evidence, as D53),
and **fewer questions as it knows more** — measured as a curve over time (questions asked, answered, retired; what the
memory knows that it did not). In a personal memory the same mechanism asks the holder, sparingly.

**Gaps** (built 2026-11-06, no model): someone the memory has heard named but does not know — a person in its episodes
with no relation, nothing held about them (no fact, no note), and not a speaker of their own — is asked about **once**,
of whoever named them most: "Who is Elena?" (`whoIs` in every language of `service/src/lang/initiative.ts`; in balanced
and full the model words it). Same rules: one question at a time per person, a person who speaks is never asked about,
an answer or a "don't know" alike closes it for good, and it is closed before being asked when the gap closes (a
relation set, something learnt about them). Animals and things heard named (no person card) are not asked about yet.

**Confirmations** (built 2026-11-06, no model): a note about a person the memory guessed or heard once — a habit, a
preference, their profile, a relation, at least a day old — is asked about once of who could know: "I understood this:
Giada goes swimming on Wednesdays. Is that right, or is there more?" (`confirm` in every language; worded by the model in
balanced and full). After the gaps. A learning question — a question about someone, a gap, a confirmation — goes to each person one at a
time and at most once in 20 hours, whatever its kind (a child who answers once a day is not asked twice in an evening).
A note's versions count as one: a guess the patterns pass rewrites every night is as old as its first version, and a
confirmation asked about any version covers the later ones. Never a note learnt from an answer to the memory's own
question, or a private one. Facts
only in episodes, or never said aloud, are not reached this way.

**What it read, and learning from it** (8.16 F3, D57, built 2026-11-12, no model): in an entity memory that learns,
something read that touches a known life and is still ahead ("a bus strike tomorrow", Matteo takes the bus) goes to that
person with its source and the day it was read — told (`readSay`) when the source is trusted to teach and the memory is
past its first stage, else asked as unchecked (`readAsk`); a wording that loses the site is replaced by the sentence.
Learning questions to the household member the memory trusts most, after the gaps and before the confirmations, one at a
time as above: a contradiction between something read and what it holds (`contradiction`), a step of a procedure that
failed (`failedStep`), knowledge of the place read and pending (`checkRead`). Young (few things confirmed), the memory
asks up to twice a day per person.

## 7. The contract (changes, all additive)

- **Presence impulse** `POST api/v1/presence {user?, person: {ref | personId}, channel: voice | camera | chat | panel,
  confidence: 0–1, ttlSeconds, place?}` (scope `ingest`): Recordare records it (a short-lived presence, a sighting in
  the memory when wanted) and **answers at once** with the initiative to deliver now, if this is the moment — so the
  agent speaks without waiting for a webhook; `{initiative: null}` otherwise. A "left" impulse ends it.
- **Channels** declared per client (§5), admin API and console.
- **The initiative** gains `timing: timed | flexible`, `window: {notBefore, notAfter}`, `channel` (chosen),
  `identity: {required: medium | high}`, `source: {conversation, messageIds}` (the client's ids of the messages it came
  from — a host recognises its own scheduled reminder), and the status **`offered`** (delivered in a turn, waiting for
  what happens next).
- **In the turn**: `POST api/v1/context` adds at most one initiative due now for the identified speaker, as a line of
  the block (`- something I meant to tell you (my own initiative; say it if natural, once): …`; `ask`, and `lookup` only
  when the host's agent has tools: `initiatives: {lookups: true}` in the body); the response shape does not change.
- **Closing an offered initiative** with no extra LLM call: the conversation's extraction sees it done (INTENTS `done`),
  answered (a plan's outcome, a question's answer) or learned (`learn_source`); a client may report the outcome; nothing
  by the window's end → `ignored` (`expired` for a timed `say`).
- **Webhooks** gain `events` per endpoint (an endpoint delivering straight to a chat subscribes to
  `initiative.created` only).
- **Outcomes** carry their context (channel, delay since `dueAt`, how the person reacted): the data the timing learns
  from.
- **The charter** (`charter.v2`): a block line marked as my own initiative is something I meant to tell or ask — bring
  it up naturally, once; never as a list, never twice.

## 8. Clients

Path facts verified 2026-11-04 (connector code, OpenClaw 2026.10.10, hermes-agent main 2026-11-03, Arkimede `master`).

- **Every full-level client** (Claude Code, Codex, the OpenAI-compatible proxy behind AnythingLLM / Open WebUI /
  LibreChat, OpenClaw, Hermes, Arkimede): the in-turn channel works with no client code once Recordare has it. Claude
  Code and Codex can send `initiatives: {lookups: true}` (one line in the shared hook). The CLIs and the proxy have no
  other channel.
- **Arkimede** (independent project; npm client and these docs only). Its only channel that reaches a user unprompted
  is the scheduled-automation pattern (an assistant message in a chat → a notification row → Socket.IO push,
  `SchedulingService.deliverToChat`, `NotificationsGateway`); Telegram is a user-installed skill run inside an agent run;
  Wyoming is a server only (no announce); no raw body is kept for signature checks. To build: a public webhook receiver
  verified with `verifyWebhook` (raw body for that route; `WEBHOOK_ALLOW_PRIVATE` on a co-hosted Recordare) and the feed
  as fallback; channels declared `chat: always`, `messaging: always` (Telegram, opt-in), later `voice: presence`;
  **presence impulses** from Voce (the Wyoming user, `ConversationFocusService`), later voiceprint / face through Home
  Assistant or a camera; delivery in chat + notification; deduplication of a `say` against the user's own
  `scheduled_tasks` (`source`, ±2 h, shared words); outcomes reported.
  - **Messaging, universally (decided 2026-11-05, way B)**: a skill declares itself a channel in its `SKILL.md` —
    e.g. `user-channel: {kind: messaging, script: scripts/send_message.js}` — and Arkimede calls that script directly
    with **the text and an address**, no model in between (certain outcome, no cost). The address comes with the
    initiative (§5c.1: the person's identities on their card in Recordare — Chloé's Telegram chat id), so a contact of
    the entity memory needs no Arkimede account; for a user's personal memory the skill's own linked user is the
    address. Any messaging skill (Telegram, WhatsApp, Signal, e-mail) joins with two lines; `telegram-bot` first (its
    `send_message` reaches a linked user today: it gains the address). With several channels for a person, the first in
    a preference order (a setting), else the first the person has an address on. The delivered message is also written
    in the Arkimede chat the bot uses for that person, so the reply arrives with its context and reaches Recordare as a
    turn. Rejected: delivery through an agent run (way A: an LLM call per message, the tool and the outcome not
    certain).
  - **Presence and voice**: from Home Assistant over its WebSocket API with the MCP server's credentials, the two
    registries (presence sources, voice points), the reply bound to the chat, the duck with Arkimede as its bridge:
    §5c.
  - **Built in Arkimede (2026-11-06)**, as one host's way to do it (Arkimede's own docs are the reference):
    - **Home Assistant as a native integration** (its own URL and token, Settings → Integrations): the two registries,
      presence impulses to the entity memory (at home, in a room, someone), the voice channel on the room's satellite
      (`start_conversation`, else `announce`), and **a satellite spoken to as a presence in its room** — the speaker by
      elimination: the one person the room's sensors place there, else the one person at home (medium confidence),
      else someone; Recordare tells the first turn (an arrival) from the next ones (a refresh).
    - **One `telegram` skill** (replacing `telegram-bot` and `telegram-account`): an account in `personal` (the user's
      number) or `dedicated` mode (the agent's own) plus an optional bot; its listener hands **a contact's reply back
      to the memory**: the message is saved with its speaker (`{channel: telegram, externalId}`, resolved to the person
      whose card has that address) before the agent answers in a chat of that guest.
    - **What a guest may have the agent do**: words only (no tool at all, no live home context, the owner's memories
      kept private), unless the skill marks them authorized (`AUTHORIZED_CONTACTS`; on a personal account only what
      they address to the agent — a reply to it, or a message starting with its name). The agent is told who is
      speaking, never the owner.
    - **Deduplication, source of truth**: an explicit, confirmed host task is the truth (its time wins); it covers an
      initiative only for the same person (it names them or carries their address) and also when it already ran near
      the initiative's time; a failed or deleted task covers nothing — the memory's initiative is the safety net, so a
      reminder is neither said twice nor lost.
- **OpenClaw** (push built 2026-11-09, F3): in-turn already (`before_prompt_build`). Push from the plugin
  (`initiatives: true`): the feed read by the plugin's service every minute (no public address), delivery as an OpenClaw
  **session notice** with `deliver` (`captureSessionGeneration` + `postSessionNotice`: the text sent as it is on the
  session's channel, no model, a certain result, a `systemEvent` for the agent's next turn) on the person's last direct
  chat — a contact by `for.addresses` (the sender `<channel>:<id>` the plugin declares), the holder by `selfSenders` /
  the senders mapped to the user —; `said` / `asked` on `messaging`, otherwise `failed` (no direct chat seen, a failed send, a
  channel that cannot deliver; a reset session tried once more) — a pushed initiative is never offered again in a turn,
  so `failed` gives it back (its intent armed again the next day); channels `messaging: always`. Correction (verified
  2026-11-08 on OpenClaw main): the heartbeat wake this section planned (`requestHeartbeat`) was removed from the SDK, and
  a system event plus a wake would have run the model; session notices replace both. Not built: a webhook route
  (`registerHttpRoute`), presence impulses from chats (the turn covers them).
- **Hermes Agent** (push documented 2026-11-09, F3): in-turn already (`prefetch`). Push without code through the
  gateway's webhook platform — Standard Webhooks (`whsec_` decoded), `events: [initiative.deliver]` (Hermes reads the
  envelope's `type`), `filters` on `data.channel` and on whom it is for, `deliver_only` (zero model), `mirror_to_session`
  — with `chat_id: "{data.for.addressOn.telegram}"`: Hermes's templates walk objects only, so Recordare adds
  `for.addressOn` (the first address per channel); the holder's route goes to the platform's home channel. No outcome is
  reported (the initiative stays offered, then lapses, and teaches timing nothing). Rejected: a plugin with
  `inject_message` (an agent turn per message: the model, and no certainty the text is said).
- **Any other platform**: `INTEGRATION.md` §4d, updated with channels, presence impulses and outcomes with context.

## 9. Phases

| Phase | What | Where |
|---|---|---|
| **F0** | literature (H14: interruptibility, notification timing, proactive LLM agents, curiosity / active learning); D55; this spec — **done 2026-11-04** (sources, verdict and design consequences in H14) | docs |
| **F1** | contract: channels, presence impulse, timing / window / channel / identity / `source`, `offered`, `events`; the in-turn channel with identity thresholds; "are you …?" for an unknown speaker — **built 2026-11-04** (the window is `dueAt` / `expiresAt` until F2; the shared Claude Code / Codex hook's `lookups` line comes with F3) | Recordare |
| **F2** | timing v0 (classes, windows by rules and by the model, a decision on three triggers: the clock, an impulse, a turn); the new source "something left unfinished"; questions to people (§6); dev sets with timelines (timing) and a growing household (learning by asking) — **F2a built 2026-11-04**: the clock's cost-sensitive gate with rule windows, timed reminders at their minute, `initiative.deliver`, every decision logged; F2b **built 2026-11-04**: `dataset_dev_timing` + four timing rules, the model's hours (`initiative.v3`), things left to finish (`extract.v23`), questions routed to who could know (deterministic); **the growing-household curve measured 2026-11-06** (`dataset_dev_household`, gaps asked of who named them, §6; 0 wrong person, 0 nagging in 2 runs; `RESULTS.md`) | Recordare + evaluation |
| **F3** | clients: Arkimede first (receiver, chat + notification, Telegram opt-in, impulses from Voce), then OpenClaw and Hermes — **in progress**: the client library's `InitiativeInbox` (0.8.0: webhooks, presence, the feed, once each, outcomes reported); the Claude Code / Codex hook asks for look-ups (0.8.0); Arkimede (2026-11-05, Arkimede 0.6.0): webhook receiver + feed through `InitiativeInbox`, delivery in a dedicated chat with a notification, a presence impulse when the user opens the app, a reminder already scheduled reported `done`, connection and webhook secret from its settings. F3a built 2026-11-05 (Recordare: ordered `channels`, `for.addresses`, presence by place, the clock reading live presences, voice pace, the opening, addresses in the console). F3b built 2026-11-05 (client library: `channels`, `for.addresses`, `addressesOn`, the channel used returned by `deliver`, the opening to `open`; released in 0.9.0 on 2026-11-06). F3c built 2026-11-05 (Arkimede: messaging through a skill's `user-channel`, run with no model, the address in the script's `_config`; `telegram-bot` 1.3.0 — the linked user, a contact who started the bot — and `telegram-account` 1.1.0 — any contact, as the owner's own account; the reply of a contact without an Arkimede account does not come back yet). F3d built 2026-11-06 (Arkimede: one `telegram` skill, a contact's reply back to the memory with its speaker, words only unless authorized, deduplication with the host's task as the source of truth — §8). F3e built 2026-11-09 (OpenClaw push through session notices, the Hermes webhook route, `for.addressOn` — §8). Still owed: real-channel tests (6.6b (6)) | clients |
| **F4** | timing v1: learning from outcomes; measured on the dev set and on Kinox — **built 2026-11-06** (`INITIATIVE_TIMING=v1`: each person's accepted / rejected outcomes per part of the day and channel hold a flexible initiative back where it is ignored and prefer a channel clearly better; a chosen time, quiet hours, identity and §5c untouched; dev set Casa Verdi: ignored 6 → 3 with v0's other 17 cases unchanged; on Kinox in shadow first) | Recordare |
| **F5** | voiceprint and face in Arkimede (Home Assistant, camera), presence from Home Assistant (three levels), voice points, announce and listen at every presence, the opening when others are present, the duck with Arkimede as its bridge (§5c) — client work, not Recordare's: Recordare only receives presences, voice points and outcomes through the contract — **F5a built 2026-11-06** in Arkimede (Home Assistant native: presence at home and per room, voice points, the voice channel, a satellite turn as a presence; §8); still owed in Arkimede: voiceprint and face, the duck (F5b) | Arkimede |
| **F6** | timing v2: the moment's context (busy, talking with others, just declined something), from generic signals any client may send; measured on the dev set and on Kinox — **built 2026-11-07** (§4; dev set Casa Neri: v2 28 / 28 with 5 / 5 event checks, v1 and v0 25 / 28; on Kinox in shadow first) | Recordare |

Cost (D35): economy — rules for windows and channels, no LLM; balanced — the model's window in the existing
`initiative` call; full — the same with reasoning. Learning from outcomes costs no LLM call.
