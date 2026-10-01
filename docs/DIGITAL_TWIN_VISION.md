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
| **1. Episodic memory** | Diary, digests, consolidation (`EPISODIC_MEMORY_TODO.md`, D1–D20) + emotions / opinions on episodes | — |
| **2. Self-model** | Guided voice interview, imports, style profile, values / opinions / decision patterns, autobiographical narrative; evaluation harness | 1 |
| **3. Contacts & disclosure** | Contact registry with channel binding, tiers, disclosure levels on memories, twin-lived memory store | 1 |
| **4. Twin interface** | Persona agent answering others (Telegram first), AI disclosure, owner review of conversations | 2, 3 |
| **5. Initiative L1** | Inform & propose to the owner (heartbeat + scheduling) | 1, 3 |
| **6. Voice** | Owner voice model (Piper fine-tune, local), twin voice channel with deepfake disclosure | 4 |
| **7. Initiative L2** | Act toward third parties: permission matrix, audit, kill switch | 4, 5 |
| **8. Legacy mode** | Executors, activation, freeze, pre-authorized actions, retirement | 4, 7 |
| **A-MEM migration** | Move Arkimede semantic memory into Recordare; Arkimede becomes a pure client | 1 (any time after) |

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
