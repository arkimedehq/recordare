# Digital twin — vision

Status: **vision / roadmap**. Phase 1 design lives in
`EPISODIC_MEMORY_TODO.md`.

## Goal

Recreate a user's memory and persona so that an LLM-driven agent can act as their
**digital twin**: whoever talks to it (or is contacted by it) should perceive the
user's knowledge, way of thinking, style and voice. The twin does not only answer:
it also takes initiative.

## Scope decided with the owner (2026-10-01)

| Dimension | Decision |
|---|---|
| **Audience** | Mainly family and friends; not excluded: anyone |
| **When** | Always — while the owner is alive (delegate / assistant) **and** after (legacy) |
| **Initiative** | Two levels: **L1 inform & propose**, **L2 act** |

## Pillars

| Pillar | Captures | Today |
|---|---|---|
| **Memory** | Semantic facts (A-MEM), episodes (diary), autobiographical narrative | Facts done; episodes designed (phase 1); narrative missing |
| **Style** | How the owner writes and speaks: lexicon, sentence length, irony, idioms | Missing — derivable from the owner's own messages |
| **Mind** | Values, opinions, decision patterns ("what would they do?") | Missing |
| **Relationships & disclosure** | Who is who, and **what the owner would tell whom** | Missing — most delicate pillar |
| **Voice** | Owner's timbre and prosody | Piper in stack; needs a voice trained on the owner |
| **Initiative** | Acting without being asked | Building blocks: auto-scheduling, heartbeat idea, bidirectional Telegram, flows |

## Key design principles

1. **The twin only knows what reaches it.** Unlike the brain, Arkimede does not record
   what is never said. Sources: everyday chats (episodic memory), **guided interviews**
   (Park et al. 2024: ~2 h voice interview → agents reproduce survey answers at 85% of
   the participants' own two-week consistency, Big Five at 0.80 correlation), imports
   (email, chats, notes via existing skills).
2. **Disclosure is part of memory.** Humans know what to tell whom; the twin must too.
   Every memory has a disclosure level; every interlocutor has a tier; the twin only
   uses what the interlocutor's tier allows.
3. **Owner-lived vs twin-lived memories never mix.** What the twin experiences while
   talking to others ("Marco asked about the house") is stored as twin experience,
   with provenance, never as something the owner lived or said.
4. **Declared, not deceptive.** The twin may sound and think like the owner, but it
   presents itself as *"the digital twin of <owner>"*. EU AI Act art. 50 (applies from
   2026-08-02): people must be informed they interact with an AI system unless obvious;
   a cloned voice is a deepfake and must be disclosed at first exposure.
5. **Treat the twin as a high-value secret.** Full memory + cloned voice = perfect
   impersonation kit. Voice model and memory are protected like credentials; the
   cloned voice is never an authentication factor; only the account owner's own voice
   can be cloned (consent).
6. **Evaluate, don't assume.** Park-style harness: ask the owner and the twin the same
   questions, measure agreement over time.

7. **A companion, not an echo.** A twin that thinks like the owner tends to agree with the
   owner and reinforce their biases. In companion mode it may — and should — disagree, using the
   owner's own memories as evidence ("three months ago you said the opposite"), point out
   recurring patterns and check decisions against the owner's stated values.
8. **Only consenting people are modelled.** The twin is built from the owner's own data with
   their consent. Cloning a third party (from web content or anything else) without their consent
   is out of scope and blocked by design; legacy mode uses only what the owner authorised while
   alive.

## Interaction modes (decided 2026-10-03)

The tier says *what* the twin may disclose; the mode says *what role* it plays.

| Mode | With | Role |
|---|---|---|
| **Companion (mirror)** | The owner | A second self: knows the owner from the inside, talks with them as a partner / close friend would; reflective, can challenge (principle 7). Owner–digital dialogue with oneself |
| **Proxy (declared)** | Others | Speaks and reasons like the owner, presented as "the digital twin of <owner>" (principle 4); disclosure by tier |

Both modes can take initiative (see Initiative levels): proposals to the owner (L1), actions
toward others only within the permission matrix, with confirmation where required (L2).
Risks to design for: emotional dependency (especially in companion and legacy mode) and
sycophancy.

## Sources of the self-model (decided 2026-10-03)

People often say more about themselves online than at home, so the owner's digital footprint is
a primary source, next to everyday chats and guided interviews:
- **Own public footprint**: the owner's social posts, video / audio transcripts, forum and blog
  contributions — imported only after verifying the accounts are the owner's (platform login /
  official data export), with explicit consent per source.
- **Own private exports**: chat histories (WhatsApp, Telegram), email, notes — via official
  exports. Messages written by other people inside them are third-party data: stored with
  `origin: owner_told`-style provenance and the conversation's audience, disclosure owner-only by
  default, never used to model those people.
- **Guided interviews** (Park et al. 2024: ~2 h interview → 85 % of participants' own
  consistency) remain the densest source for values and decision patterns, which public content
  shows only partially (a curated public persona, little about unseen situations).

Not in scope: building a twin of someone else from web content (principle 8).

## Interlocutor tiers (draft)

| Tier | Who | Default disclosure |
|---|---|---|
| `owner` | The user | Everything |
| `inner` | Close family | Broad personal life, no third-party confidences |
| `friends` | Friends | Shared experiences, opinions, general life |
| `acquaintances` | Known contacts (clients, colleagues…) | Professional / public-ish topics |
| `public` | Unknown / unverified | Public profile only |

Identity of the interlocutor comes from a **channel binding** (Telegram id, phone
number, authenticated account), never from what they claim or from their voice.
Unknown = `public`.

## Initiative levels

| Level | Example | Guardrails |
|---|---|---|
| **L1 inform & propose** | "Tomorrow is Marco's birthday — shall I send wishes?" (to the owner) | Owner-facing only; heartbeat gate (no LLM call if nothing to say) |
| **L2 act** | Sends the wishes to Marco as the twin | Permission matrix per contact × action type; disclosure as twin; audit log; rate limits; global kill switch; owner digest of actions taken |

## Research mode: full autonomy (decided 2026-10-03)

Recordare is also a study: how does a digital twin evolve when it is **free in thought and
action**, like a person — choosing what to think about, what to do and whom to talk to, and
allowed to make mistakes? Research mode is a configuration of the same service, not a separate
product.

**What is free**
- **Thought**: self-directed reflection without any prompt (it decides when and about what to
  think: re-reading its memories, forming opinions, planning); it can set its **own goals**.
- **Action**: initiative without per-action confirmation — it starts conversations, takes
  decisions and uses its tools on its own schedule (no L1/L2 confirmation gates in this mode).
- **Evolution**: memory, opinions and personality may change through its own experiences
  (twin-lived memories, principle 3) — including drifting away from the owner.
- **Errors**: allowed and kept as data, not prevented; the twin may learn from them or not.

**Where it runs**
1. **Simulated world first**: a society of agents playing family, friends, colleagues and
   strangers, each with its own memory, plus simulated tools and time. Reproducible, several
   "lives" of the same twin from different starting points can be compared, mistakes cost nobody
   anything.
2. **Real world by steps**: the owner's own channels and tools, then people who agreed to take
   part, widening the scope as results justify it.

**Minimal floor (also the instruments of the experiment)**
- Complete log of thoughts, decisions and actions (nothing to study without it).
- Kill switch / pause, and snapshots to restart a life from any point.
- Toward real people the twin presents itself as an AI (EU AI Act art. 50; otherwise it deceives
  people who did not choose to take part).
- **Money and accounts behind a knob** (default off): the owner may grant the twin access to
  their own limited accounts — e.g. a prepaid card or a sub-account with a per-transaction cap,
  a budget per period, allowed merchant categories — and let it buy on their behalf. Every
  transaction is logged and notified; the grant can be revoked at any time. Third parties'
  money or accounts are never in scope.

**Research questions** (see `RESEARCH_NOTES.md` H10): how far and how fast does an autonomous
twin drift from its owner (Park-style agreement over time)? Which goals does it form? How does it
handle and learn from its errors? Do different lives of the same twin diverge, and on what?

## Legacy mode (after the owner)

"Always" includes after the owner's death. Draft:
- **Digital executor(s)** designated by the owner while alive; they activate legacy
  mode (no automatic dead-man's switch by default).
- **Persona frozen** at activation: core memory, style and mind no longer evolve;
  the twin keeps per-contact conversational memory (twin-lived, see principle 3).
- **Initiative in legacy**: L2 actions limited to those **pre-authorized by the owner**
  while alive (e.g. yearly wishes to the children); anything else becomes a proposal
  to the executor.
- **Dignified retirement**: executor can pause or retire the twin; contacts can opt
  out of being contacted.
- Legal: Italian privacy code art. 2-terdecies — rights over a deceased person's data
  can be exercised by those with an interest, unless the person forbade it in
  writing; the owner's written instructions should be captured in the product.

## Name: Recordare (decided 2026-10-01)

The twin service is called **Recordare** — repository `arkimedehq/recordare`, npm scope
`@arkimedehq/*`.

- Latin imperative *"remember!"*; etymology *re-* + *cor*, "bring back to the heart"
  (for the Romans memory lived in the heart — cf. *by heart*, *par cœur*). Also the
  *Recordare* of Mozart's Requiem.
- Availability check (2026-10-01): npm free; `recordare.it` / `.ai` / `.dev` free
  (`.com` taken); 7 unrelated minor GitHub repos.
- Trademarks (WIPO Global Brand Database, 14 hits): **no active mark in class 9 or 42**
  — the two Recordare LLC (MusicXML) US marks in 9 / 35-41-42 ended in 2013-2014.
  Active marks only in distant classes (5 pharma, 36, 45, 41 photography, 33 spirits).
  Formal clearance by an IP attorney still recommended before filing.
- Rejected along the way (conflicts or crowding): Palimpsest, Arenario, Arricordu
  (French *RICORDU* class 9), Siracusia (French *SYRACUSE* by Archimed, classes 9/42),
  Akousma / Sempervivum / Eurialo (class 42 marks), Mnemonia / Mnemode (crowded
  *mnemo-* memory projects), Episteme, Arka, Thot(h), Ricordami (existing Italian apps).
  Aretusa was the runner-up (no class 9 mark, weak distinctiveness).
- Side note: the parent brand **Arkimede** has a similarity with **ARCHIMED** (French
  knowledge-management software company, marks in classes 9/42) — worth an IP check.

## Architecture (decided 2026-10-01)

**Standalone service (Recordare) in its own repository**, usable by any agentic platform;
Arkimede is the first client (like piper / whisper services).

```
Arkimede ───────REST ingest + MCP──┐
Claude Desktop / Code, Cursor ─MCP─┼──► Recordare ─────► own DB (Postgres + vector)
Other platforms ──REST / MCP / SDK─┘        ├─ scheduler (consolidation, initiative)
                                            ├─ channels (Telegram, …)
                                            └─ OpenAI-compatible LLM / embedding / TTS
```

- **One memory per person**, whatever platform they use — the reason a
  library-embedded-in-each-host model was rejected (it splits memory across DBs).
- **Clean internal core**: pure domain core separated from adapters (storage, LLM,
  embeddings, vector, queue, clock) — a library can be extracted later if needed.
- **Two integration levels**:
  - *Basic* (MCP only, any MCP client): explicit tools (`log_episode`,
    `search_episodes`, …). No passive extraction, no automatic context injection.
  - *Full* (MCP + REST ingest + SDK/middleware): the host pushes conversation messages
    (enables passive extraction, idle trigger, raw-log fallback), passes interlocutor
    identity (disclosure), and can inject pinned/retrieved memory into its prompts.
- The service keeps its **own raw log** (Layer 0) of ingested messages — provenance
  and fallback point there, not to the host's tables.
- Own auth: per-client API keys + cross-platform identity mapping (same person on
  Arkimede and Claude Desktop = one twin).
- LLM / embedding / TTS via OpenAI-compatible endpoints (can point to Arkimede's shim
  or any provider).
- Licence: AGPL — network use obliges publishing the service's code only, not the
  clients'.
- Existing A-MEM semantic memory stays in Arkimede for now (no regression); migrating
  it into the service is a later roadmap phase.

## Roadmap (draft)

| Phase | Content | Depends on |
|---|---|---|
| **1. Episodic memory** | Diary, digests, consolidation (`EPISODIC_MEMORY_TODO.md`, D1–D47) + emotions / opinions on episodes — **implemented** (2026-10-07; open items in `WORK_PLAN.md`) | — |
| **2. Self-model** | Guided voice interview, imports (own public footprint + private exports), style profile, values / opinions / decision patterns, autobiographical narrative; evaluation harness | 1 |
| **3. Contacts & disclosure** | Contact registry with channel binding, tiers, disclosure levels on memories, twin-lived memory store | 1 |
| **4. Twin interface** | Companion mode with the owner; proxy mode answering others (Telegram first), AI disclosure, owner review of conversations | 2, 3 |
| **5. Initiative L1** | Inform & propose to the owner (heartbeat + scheduling) | 1, 3 |
| **6. Voice** | Owner voice model (Piper fine-tune, local), twin voice channel with deepfake disclosure | 4 |
| **7. Initiative L2** | Act toward third parties: permission matrix, audit, kill switch | 4, 5 |
| **8. Legacy mode** | Executors, activation, freeze, pre-authorized actions, retirement | 4, 7 |
| **R. Research mode** | Autonomous loop (self-directed reflection, own goals, initiative without confirmation), simulated agent society, life snapshots, drift metrics | 1, 2 (sim can start with phase-1 memory) |
| **A-MEM migration** | Move Arkimede semantic memory into Recordare; Arkimede becomes a pure client | 1 (any time after) |
| **G. Agent memory** (future, noted 2026-10-07) | Recordare as the memory of an **agent** rather than of one person — e.g. a family's shared Arkimede building its own history and personality. See below | 1, 3 |

### Future direction G — Recordare as the memory of an agent

The owner of a memory can be an **agent persona** (e.g. "the family's Arkimede") instead of a person: Recordare then
remembers the agent's own life — what each family member told it, what it did for them, its open promises and plans —
and, through consolidation, **who it is** (its self-model / personality: habits, preferences learned, its relation
with each person; always `inferred` and traceable to the memories behind it, as in H12). Complementary to the
default design (every family member has their own twin; the agent reads the memory of whoever is speaking): both can
coexist on the same installation.

**First step built (D48, 2026-10-07): entity memory** — an owner of kind `entity` (a shared device, a robot, a
place) that everyone using it reads and writes; identification only says whose a memory is; facts carry the person
they are about. Disclosure inside it (intimate items for their person only) comes later.

What works already: episodes with dates, plans, corrections, provenance; nightly consolidation; verified persons;
others' claims kept apart. What changes:
1. **Who speaks in the first person** — today the owner writes as the user and the assistant is someone else; for an
   agent owner the agent's turns are its own words and the family members are other (verified) persons.
2. **Who may see what** — the delicate part: what Marco told the agent must not surface in an answer to Giulia. Each
   memory is visible to its `audience` (who was present or it was shared with), plus a **household** disclosure tier
   next to private; per-audience digests (already anticipated in DATA_MODEL). The same rules are needed for the twin
   speaking to third parties (phase 3), so the work is shared.
3. **Self-model notes** describe the agent, not a person; never stated, always inferred and pending.
4. **Consent** of every family member that the agent remembers; extra care for minors.

### Around the memory: reach, voice at home, observability (noted 2026-10-07)

- **Connectors for agent platforms** (WORK_PLAN 6.6, D43): Recordare in any agent platform with one install — each
  connector captures the turns into ingest and gives the agent the memory (MCP tools and / or a recall injected
  before the turn); uniform contract and a conformance suite, not a uniform mechanism.
- **talkiosk** (own repo, WORK_PLAN 5b.10 / 6.5, D45): a home device (Raspberry Pi with a screen) with a voice that
  talks to Arkimede. Continuous listening is opt-in: voiceprints stay on the device, unknown voices are discarded, no
  audio is stored, and each recognised person's words go into **their own** memory; facts and notes about the owner
  heard ambiently stay pending until the owner confirms them. Prepares the voice channel of phase 6.
- **Recordare Atlas** (own optional repo `arkimedehq/recordare-atlas`, D42): the observability companion — a live
  brain view of Recordare and of its clients' agents, metadata only; Recordare works without it, and telemetry is
  never a memory channel.

## Open questions

- [ ] Voice: Piper fine-tune (hours of clean audio + GPU training, fully local) vs
      zero-shot cloning models (check weight licences — several are non-commercial,
      relevant for an AGPL product with paid services).
- [ ] Disclosure levels on memories: assigned at extraction by the LLM, by the owner,
      or default by category + owner override?
- [ ] Twin-lived memories: does the owner get a digest of conversations the twin had
      on their behalf (while alive)? Leaning: yes, daily.
- [ ] Legacy activation: executor only, or executor + confirmation by a second person?
- [ ] Minors among contacts: extra restrictions?
- [ ] Psychological safeguards for grieving contacts (frequency limits, clear
      reminders, opt-out) — see research on "deadbots" / griefbots.
