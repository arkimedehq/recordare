# Digital twin — vision

Status: **vision / roadmap**. Phase 1 (episodic memory) is built and released as v0.1.0 (public 2026-10-08); its
design lives in `EPISODIC_MEMORY_TODO.md`, its status in `WORK_PLAN.md`.

> Since D50 (2026-10-09) Recordare has no consent flag: every memory stores what its client sends; the on/off switch
> belongs to the client platform. Older consent text below is marked superseded.

## Goal

Recreate a user's memory and persona so that an LLM-driven agent can act as their
**digital twin**: whoever talks to it (or is contacted by it) should perceive the
user's knowledge, way of thinking, style and voice. The twin does not only answer:
it also takes initiative.

## Scope decided with the maintainer (2026-10-01)

| Dimension | Decision |
|---|---|
| **Audience** | Mainly family and friends; not excluded: anyone |
| **When** | Always — while the holder is alive (delegate / assistant) **and** after (legacy) |
| **Initiative** | Two levels: **L1 inform & propose**, **L2 act** |

## Pillars

| Pillar | Captures | Today |
|---|---|---|
| **Memory** | Semantic facts and notes, episodes (diary), autobiographical narrative | Episodes, plans, facts with history, notes and digests built (phase 1, v0.1.0); narrative missing |
| **Style** | How the holder writes and speaks: lexicon, sentence length, irony, idioms | Missing — derivable from the holder's own messages |
| **Mind** | Values, opinions, decision patterns ("what would they do?") | Missing |
| **Relationships & disclosure** | Who is who, and **what the holder would tell whom** | Missing — most delicate pillar |
| **Voice** | Holder's timbre and prosody | Piper in stack; needs a voice trained on the holder |
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
3. **Holder-lived vs twin-lived memories never mix.** What the twin experiences while
   talking to others ("Marco asked about the house") is stored as twin experience,
   with provenance, never as something the holder lived or said.
4. **Declared, not deceptive.** The twin may sound and think like the holder, but it
   presents itself as *"the digital twin of <holder>"*. EU AI Act art. 50 (applies from
   2026-08-02): people must be informed they interact with an AI system unless obvious;
   a cloned voice is a deepfake and must be disclosed at first exposure.
5. **Treat the twin as a high-value secret.** Full memory + cloned voice = perfect
   impersonation kit. Voice model and memory are protected like credentials; the
   cloned voice is never an authentication factor; only the account holder's own voice
   can be cloned, by their own choice.
6. **Evaluate, don't assume.** Park-style harness: ask the holder and the twin the same
   questions, measure agreement over time.

7. **A companion, not an echo.** A twin that thinks like the holder tends to agree with the
   holder and reinforce their biases. In companion mode it may — and should — disagree, using the
   holder's own memories as evidence ("three months ago you said the opposite"), point out
   recurring patterns and check decisions against the holder's stated values.
8. **The deployer informs the people around the agent.** Recordare has no consent flag (D50, 2026-10-09): every
   memory stores what its client sends, and the on/off switch belongs to the client platform. Whoever deploys the
   agent tells the people around it that it remembers, and holds the legal basis (e.g. under the GDPR); extra care
   for minors. Cloning a third party (from web content or anything else) behind their back stays out of scope; legacy
   mode uses only what the holder authorised while alive. *(Superseded wording, before D50: "Only consenting people are
   modelled" — the twin built from the holder's own data with their consent, a consent flag in Recordare.)*

## Interaction modes (decided 2026-10-03)

The tier says *what* the twin may disclose; the mode says *what role* it plays.

| Mode | With | Role |
|---|---|---|
| **Companion (mirror)** | The holder | A second self: knows the holder from the inside, talks with them as a partner / close friend would; reflective, can challenge (principle 7). Holder–digital dialogue with oneself |
| **Proxy (declared)** | Others | Speaks and reasons like the holder, presented as "the digital twin of <holder>" (principle 4); disclosure by tier |

Both modes can take initiative (see Initiative levels): proposals to the holder (L1), actions
toward others only within the permission matrix, with confirmation where required (L2).
Risks to design for: emotional dependency (especially in companion and legacy mode) and
sycophancy.

## Sources of the self-model (decided 2026-10-03)

People often say more about themselves online than at home, so the holder's digital footprint is
a primary source, next to everyday chats and guided interviews:
- **Own public footprint**: the holder's social posts, video / audio transcripts, forum and blog
  contributions — imported only after verifying the accounts are the holder's (platform login /
  official data export), with explicit consent per source.
- **Own private exports**: chat histories (WhatsApp, Telegram), email, notes — via official
  exports. Messages written by other people inside them are third-party data: stored with
  `origin: holder_told`-style provenance and the conversation's audience, disclosure holder-only by
  default, never used to model those people.
- **Guided interviews** (Park et al. 2024: ~2 h interview → 85 % of participants' own
  consistency) remain the densest source for values and decision patterns, which public content
  shows only partially (a curated public persona, little about unseen situations).

Not in scope: building a twin of someone else from web content (principle 8).

## Interlocutor tiers (draft)

| Tier | Who | Default disclosure |
|---|---|---|
| `holder` | The user | Everything |
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
| **L1 inform & propose** | "Tomorrow is Marco's birthday — shall I send wishes?" (to the holder) | Holder-facing only; heartbeat gate (no LLM call if nothing to say) |
| **L2 act** | Sends the wishes to Marco as the twin | Permission matrix per contact × action type; disclosure as twin; audit log; rate limits; global kill switch; holder digest of actions taken |

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
  (twin-lived memories, principle 3) — including drifting away from the holder.
- **Errors**: allowed and kept as data, not prevented; the twin may learn from them or not.

**Where it runs**
1. **Simulated world first**: a society of agents playing family, friends, colleagues and
   strangers, each with its own memory, plus simulated tools and time. Reproducible, several
   "lives" of the same twin from different starting points can be compared, mistakes cost nobody
   anything.
2. **Real world by steps**: the holder's own channels and tools, then people who agreed to take
   part, widening the scope as results justify it.

**Minimal floor (also the instruments of the experiment)**
- Complete log of thoughts, decisions and actions (nothing to study without it).
- Kill switch / pause, and snapshots to restart a life from any point.
- Toward real people the twin presents itself as an AI (EU AI Act art. 50; otherwise it deceives
  people who did not choose to take part).
- **Money and accounts behind a knob** (default off): the holder may grant the twin access to
  their own limited accounts — e.g. a prepaid card or a sub-account with a per-transaction cap,
  a budget per period, allowed merchant categories — and let it buy on their behalf. Every
  transaction is logged and notified; the grant can be revoked at any time. Third parties'
  money or accounts are never in scope.

**Research questions** (see `RESEARCH_NOTES.md` H10): how far and how fast does an autonomous
twin drift from its holder (Park-style agreement over time)? Which goals does it form? How does it
handle and learn from its errors? Do different lives of the same twin diverge, and on what?

## Legacy mode (after the holder)

"Always" includes after the holder's death. Draft:
- **Digital executor(s)** designated by the holder while alive; they activate legacy
  mode (no automatic dead-man's switch by default).
- **Persona frozen** at activation: core memory, style and mind no longer evolve;
  the twin keeps per-contact conversational memory (twin-lived, see principle 3).
- **Initiative in legacy**: L2 actions limited to those **pre-authorized by the holder**
  while alive (e.g. yearly wishes to the children); anything else becomes a proposal
  to the executor.
- **Dignified retirement**: executor can pause or retire the twin; contacts can opt
  out of being contacted.
- Legal: Italian privacy code art. 2-terdecies — rights over a deceased person's data
  can be exercised by those with an interest, unless the person forbade it in
  writing; the holder's written instructions should be captured in the product.

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
    identity (disclosure), and can inject pinned/retrieved memory into its prompts. Built for Arkimede and, through
    connectors, for Claude Code, Codex, OpenClaw, Hermes Agent and an OpenAI-compatible memory proxy.
- The service keeps its **own raw log** (Layer 0) of ingested messages — provenance
  and fallback point there, not to the host's tables.
- Own auth: per-client API keys + cross-platform identity mapping (same person on
  Arkimede and Claude Desktop = one twin).
- LLM / embedding / TTS via OpenAI-compatible endpoints (can point to Arkimede's shim
  or any provider).
- Licence: AGPL — network use obliges publishing the service's code only, not the
  clients'.
- Existing A-MEM semantic memory stays in Arkimede (no regression). Since D34 (2026-10-03) Recordare holds its own
  complete memory, notes included, and users copy notes into A-MEM by choice — no migration planned.

## Roadmap (draft)

| Phase | Content | Depends on |
|---|---|---|
| **1. Episodic memory** | Diary, digests, consolidation (`EPISODIC_MEMORY_TODO.md`, D1–D48) + emotions / opinions on episodes; language rules for the most used languages — **released as v0.1.0** (public 2026-10-08; open items in `WORK_PLAN.md`) | — |
| **2. Self-model** | Guided voice interview, imports (own public footprint + private exports), style profile, values / opinions / decision patterns, autobiographical narrative; evaluation harness | 1 |
| **3. Contacts & disclosure** | Contact registry with channel binding, tiers, disclosure levels on memories, twin-lived memory store | 1 |
| **4. Twin interface** | Companion mode with the holder; proxy mode answering others (Telegram first), AI disclosure, holder review of conversations | 2, 3 |
| **5. Initiative L1** | Inform & propose to the holder (heartbeat + scheduling) | 1, 3 |
| **6. Voice** | Holder voice model (Piper fine-tune, local), twin voice channel with deepfake disclosure | 4 |
| **7. Initiative L2** | Act toward third parties: permission matrix, audit, kill switch | 4, 5 |
| **8. Legacy mode** | Executors, activation, freeze, pre-authorized actions, retirement | 4, 7 |
| **R. Research mode** | Autonomous loop (self-directed reflection, own goals, initiative without confirmation), simulated agent society, life snapshots, drift metrics | 1, 2 (sim can start with phase-1 memory) |
| **G. Agent memory** (future, noted 2026-10-07) | Recordare as the memory of an **agent** rather than of one person — e.g. a family's shared Arkimede building its own history and personality. See below | 1, 3 |

### Future direction G — Recordare as the memory of an agent

A memory can belong to an **agent persona** (e.g. "the family's Arkimede") instead of a person: Recordare then
remembers the agent's own life — what each family member told it, what it did for them, its open promises and plans —
and, through consolidation, **who it is** (its self-model / personality: habits, preferences learned, its relation
with each person; always `inferred` and traceable to the memories behind it, as in H12). Complementary to the
default design (every family member has their own twin; the agent reads the memory of whoever is speaking): both can
coexist on the same installation.

**First step built (D48, 2026-10-07): entity memory** — a memory of kind `entity` (a shared device, a robot, a
place) that everyone using it reads and writes; identification only says whose a memory is; facts carry the person
they are about. Released as **experimental** in v0.1.0 (82.1 % on a blind entity set, against 91.3 % for a person's
memory: speakers who never identify themselves are the weak spot). Disclosure inside it (intimate items for their
person only) comes later.

What works already: episodes with dates, plans, corrections, provenance; nightly consolidation; verified persons;
others' claims kept apart. What changes:
1. **Who speaks in the first person** — today the holder writes as the user and the assistant is someone else; for an
   agent memory the agent's turns are its own words and the family members are other (verified) persons.
2. **Who may see what** — the delicate part: what Marco told the agent must not surface in an answer to Giulia. Each
   memory is visible to its `audience` (who was present or it was shared with), plus a **household** disclosure tier
   next to private; per-audience digests (already anticipated in DATA_MODEL). The same rules are needed for the twin
   speaking to third parties (phase 3), so the work is shared.
3. **Self-model notes** describe the agent, not a person; never stated, always inferred and pending.
4. **Informing** every family member that the agent remembers — the deployer's duty, not a Recordare consent flag
   (D50 supersedes "consent of every family member"); extra care for minors.

### Around the memory: reach, voice at home, observability (noted 2026-10-07)

- **Connectors for agent platforms** (WORK_PLAN 6.6, D43): Recordare in any agent platform with one install — each
  connector captures the turns into ingest and gives the agent the memory (MCP tools and / or a recall injected
  before the turn); uniform contract and a conformance suite, not a uniform mechanism. Built at the full level
  (2026-10-08): Claude Code, Codex, OpenClaw, Hermes Agent and an OpenAI-compatible memory proxy for platforms without
  hooks; Claude Desktop / claude.ai stay at the basic level (MCP only).
- **Continuous listening from a home voice device** (WORK_PLAN 6.5, D45): a client device with a voice that talks to an
  agent platform. Continuous listening is opt-in: voiceprints stay on the device, unknown voices are discarded, no
  audio is stored, and each recognised person's words go into **their own** memory; facts and notes about the holder
  heard ambiently stay pending until the holder confirms them. Prepares the voice channel of phase 6.
- **Recordare Atlas** (own optional repo `arkimedehq/recordare-atlas`, D42): the observability companion — a live
  brain view of Recordare and of its clients' agents, metadata only; Recordare works without it, and telemetry is
  never a memory channel. Its interface is in English and Italian, has a light mode for low-power GPUs and a
  recorder for its demo animation.

## Open questions

- [ ] Voice: Piper fine-tune (hours of clean audio + GPU training, fully local) vs
      zero-shot cloning models (check weight licences — several are non-commercial,
      relevant for an AGPL product with paid services).
- [ ] Disclosure levels on memories: assigned at extraction by the LLM, by the holder,
      or default by category + holder override?
- [ ] Twin-lived memories: does the holder get a digest of conversations the twin had
      on their behalf (while alive)? Leaning: yes, daily.
- [ ] Legacy activation: executor only, or executor + confirmation by a second person?
- [ ] Minors among contacts: extra restrictions?
- [ ] Psychological safeguards for grieving contacts (frequency limits, clear
      reminders, opt-out) — see research on "deadbots" / griefbots.
