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
| "sono Eriona" in chat or by voice | the person | medium (anyone can say it) |
| voiceprint | the agent (e.g. Wyoming / Home Assistant) | the agent's, sent as a number |
| face | the agent (camera) | the agent's, sent as a number |

- **Thresholds by sensitivity**: a harmless initiative ("did you hang the laundry?") needs medium confidence; one drawn
  from a private memory (D52) or about someone's personal matters needs high confidence; an unidentified person never
  learns the content.
- **Unknown speaker** while an initiative waits for someone: the agent may ask "are you Eriona?" (no content revealed) —
  the same mechanism as clarifications (vision L1). The answer is an identity of medium confidence, and a memory.
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
- **v2** — the moment's context (busy, talking with others, just declined something).
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
- **Voice: spontaneous announcement at every presence** (decided; how is still to be designed, F5). With others in the
  room the agent first says only an opening that reveals nothing ("Chloé, I have something for you — want to hear
  it?"), in the memory's language; if the person answers yes, it says the initiative; otherwise it stays pending (not
  `ignored`). The presence impulse will need to say whether others are present; the opening sentence comes from
  `service/src/lang` (every language). Still to reason about with the maintainer: when an announcement is welcome, how
  the answer is heard, what counts as said.

Contract changes (additive, to build): `channels: [kind…]` in order on the initiative (feed, webhook, presence, context)
in place of the single `channel` chosen at creation; the outcome carries `channel`; the per-client declaration stays as
the list of kinds a client may have at all (what it can never reach is never offered).

## 6. Learning by asking (entity memory)

An entity memory starts empty and must come to **know** the people and the world around it, then act on its own.
Besides reminding and following up, it **asks**:
- **who** — "how should I call you?", "is this Eriona?" (identity, §3);
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
  - **Messaging, universally (decided 2026-11-05, way B)**: a skill declares itself a channel to the user in its
    `SKILL.md` — e.g. `user-channel: {kind: messaging, script: scripts/send_message.js}` plus how to tell whether a user
    is linked — and Arkimede calls that script directly with the text, no model in between (certain outcome, no cost).
    Any messaging skill (Telegram, WhatsApp, Signal, e-mail) joins with two lines; `telegram-bot` first (its
    `send_message` already reaches the linked user). With several, the user's preferred one (a setting), else the first
    linked. The delivered message is also written in the Arkimede chat the bot uses, so the reply arrives with its
    context and reaches Recordare as a turn. Rejected: delivery through an agent run (way A: an LLM call per message,
    the tool and the outcome not certain).
- **OpenClaw**: in-turn already (`before_prompt_build`). Push by a webhook route (`registerHttpRoute`, `auth: "plugin"`)
  or the feed from the plugin's service (`registerService`); delivery as a system event on the person's session plus a
  heartbeat wake (`enqueueSystemEvent`, `requestHeartbeat` with `target: "last"`), confirmed by `message_sent`; channels
  `messaging: always`; presence from `message_received` and the sessions' `lastInteractionAt`. A raw channel send from a
  non-channel plugin is not verified.
- **Hermes Agent**: in-turn already (`prefetch`). Push without code through the gateway's webhook platform (Standard
  Webhooks accepted, `deliver_only`, one chat per route, `mirror_to_session`; needs `events`; the template's field
  syntax to verify on a running gateway), or with a small plugin shipped beside the provider (`inject_message` on the
  person's gateway session, the feed polled by one thread); presence from `on_turn_start` and the gateway hooks.
- **Any other platform**: `INTEGRATION.md` §4d, updated with channels, presence impulses and outcomes with context.

## 9. Phases

| Phase | What | Where |
|---|---|---|
| **F0** | literature (H14: interruptibility, notification timing, proactive LLM agents, curiosity / active learning); D55; this spec — **done 2026-11-04** (sources, verdict and design consequences in H14) | docs |
| **F1** | contract: channels, presence impulse, timing / window / channel / identity / `source`, `offered`, `events`; the in-turn channel with identity thresholds; "are you …?" for an unknown speaker — **built 2026-11-04** (the window is `dueAt` / `expiresAt` until F2; the shared Claude Code / Codex hook's `lookups` line comes with F3) | Recordare |
| **F2** | timing v0 (classes, windows by rules and by the model, a decision on three triggers: the clock, an impulse, a turn); the new source "something left unfinished"; questions to people (§6); dev sets with timelines (timing) and a growing household (learning by asking) — **F2a built 2026-11-04**: the clock's cost-sensitive gate with rule windows, timed reminders at their minute, `initiative.deliver`, every decision logged; F2b **built 2026-11-04**: `dataset_dev_timing` + four timing rules, the model's hours (`initiative.v3`), things left to finish (`extract.v23`), questions routed to who could know (deterministic; the growing-household curve with simulated answers is still owed) | Recordare + evaluation |
| **F3** | clients: Arkimede first (receiver, chat + notification, Telegram opt-in, impulses from Voce), then OpenClaw and Hermes — **in progress**: the client library's `InitiativeInbox` (0.8.0: webhooks, presence, the feed, once each, outcomes reported); the Claude Code / Codex hook asks for look-ups (0.8.0); Arkimede (2026-11-05, Arkimede 0.6.0): webhook receiver + feed through `InitiativeInbox`, delivery in a dedicated chat with a notification, a presence impulse when the user opens the app, a reminder already scheduled reported `done`, connection and webhook secret from its settings. Still owed: the channel chosen at delivery (§5b: Recordare, the client library), Arkimede's `user-channel` skills (§8: Telegram first), push for OpenClaw and Hermes | clients |
| **F4** | timing v1: learning from outcomes; measured on the dev set and on Kinox | Recordare |
| **F5** | voiceprint and face in Arkimede (Home Assistant, camera), announce by voice at every presence, with the opening when others are present (§5b, to design); impulses from Voce; timing v2 | Arkimede, Recordare |

Cost (D35): economy — rules for windows and channels, no LLM; balanced — the model's window in the existing
`initiative` call; full — the same with reasoning. Learning from outcomes costs no LLM call.
