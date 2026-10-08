# Recordare

*Recordare*: Latin for "remember!" (*re-* + *cor*, "bring back to the heart").

Recordare is a standalone **long-term memory service for AI agents**. It keeps one memory per person: what they
lived, planned, said and were told, with dates, sources and history. It is the foundation of a declared **digital
twin** of that person. Any agent platform can use it through **MCP** (any MCP client) or through **MCP + REST ingest**
(the platform pushes its conversations and Recordare extracts the memory in the background).
[Arkimede](https://github.com/arkimedehq/arkimede) is the first client.

> **Status (2026-10-07).** Phase 1 (episodic memory) is implemented in `service/` (NestJS, Postgres + pgvector,
> BullMQ). It covers the raw log, episodes, plans, facts, notes, nightly digests, MCP recall and write tools, the
> admin API and live telemetry. Arkimede is integrated. Next: the read API, the client library and connectors
> ([work plan](docs/WORK_PLAN.md)). Entity memory (D48, below) is built and measured on a dev set. Recordare is not
> published yet.

*Italian version: [README_it.md](README_it.md). Every project document has an Italian copy (`*_it.md`); the English
one is the reference.*

## In plain words

AI assistants usually forget everything when a conversation ends. Recordare gives them a **long-term memory**, close
to a human one. While you talk with your assistant, it keeps a kind of diary: **what happened and when** ("on Saturday
I was in Bologna with Marco"), **what you plan** ("I see the dentist on Thursday" — and if you never say how it went,
it does not assume you went), **how your life is now and how it changed** (your car, where you live, your job, with
their history), and **your tastes and habits**. Every night, as we do while sleeping, it tidies up its memories and
writes a summary of the day and the month, so the assistant can answer "what did I do last week?" or "when did I change
car?".

It is careful about **who said what**: what you say counts as your memory, what someone else tells you stays theirs,
and what the assistant only guessed never becomes a fact. You can correct a memory, and what you ask it to forget does
not come back. Each person has their **own private memory**; a device the whole family uses (the home voice assistant)
can have a **shared memory**, where whoever introduces themselves signs their own memories. Nothing starts without
**consent**. Recordare works with any assistant and any AI model; Arkimede is the first to use it.

## What kind of memory it is

Recordare is modelled on human episodic memory: encode while you live, consolidate while you sleep, recall by time
and by cue. It is not a vector store of chat snippets.

```
Layer 0  raw log     every ingested message, verbatim: provenance and fallback for everything above
Layer 1  episodes    one row per event / plan / state change: event date + precision, people, place,
                     importance, feelings and opinions, evidence message ids
Layer 2  digests     day and month diaries, written by the nightly consolidation
Layer 3  facts       state slots with a value chain ("lives in" Turin → Bologna, with dates)
         notes       durable knowledge: preferences, habits, values, relationships
```

- **Time works both ways (bi-temporal).** Episodes have an event time with a precision (day, month or approximate)
  plus the original expression ("last Sunday"), resolved against the message timestamp. Facts carry world time
  (`valid_from` / `valid_to`) and knowledge time (when Recordare learned it). Facts can be queried **as of** a date
  ("where did I live in early December?"). A correction (`corrects`: the value was never true) differs from a change
  (`supersedes`: true until *t*). Nothing is overwritten.
- **Plans have a lifecycle.** A plan is `open | confirmed | cancelled | rescheduled | unresolved`. A plan whose date
  has passed stays a plan until something confirms it, so recall answers "I don't know whether you went", never "you
  went".
- **Provenance on every memory.** Each memory records who said it: the owner, the assistant, another person or a
  tool (`author_role`). It also records its origin (`owner_lived`, `owner_told`, `assistant_stated`) and cites
  evidence message ids. Another person's claim ("Giorgio says Sofia is moving to London") is stored as that person's
  claim, never as the owner's fact.
- **Viewer context on every read.** Recordare resolves who will see a result from the conversation's participants;
  neither the client nor the LLM can assert it. In phase 1, memories are returned only when the viewer is the owner.
  Missing and forbidden items look the same. Each memory already stores its audience and a disclosure label, so
  graded disclosure (phase 3) needs no migration.
- **Consent per person.** A client's API key can never turn a person's memory on. Consent comes from the admin (home
  profile) or the owner, and clients send nothing before consent.
- **Forgetting that sticks.** Forgetting an episode leaves a tombstone. Extraction, re-extraction and consolidation
  check tombstones before writing, so forgotten content does not come back. The digests that used the episode are
  rewritten. (Forgetting a whole period is designed but not built yet.)
- **Nightly consolidation.** A job per person writes the day and month diaries. It makes zero LLM calls when
  nothing is new.
- **Quality / cost profiles** (D35): `economy | balanced | full`, per installation with a per-person override. Cost
  is the owner's choice, and quality is never traded silently. Each profile is measured.
- **Any LLM / embedding provider** (D27): any OpenAI-compatible server (DeepSeek, OpenAI, OpenRouter, Ollama, vLLM, …)
  or native Anthropic, with a model per task. DeepSeek and local Ollama are only our test setups.
- **One memory per person, across platforms.** One person using Arkimede and Claude Code has a single memory.

### MCP tools (as built)

`search_episodes` (modes `search | list | latest`, date range, automatic fallback to the raw log, chat excerpts),
`search_memory` (notes and facts, optionally as of a date), `resolve_period` (deterministic IT/EN period parser:
"last week", month names), `log_episode`, `remember`, `correct_episode`, `forget_episode`. No LLM runs at read time:
the calling agent fills the parameters. Contracts: [API](docs/API.md), [data model](docs/DATA_MODEL.md).

## The most important points

1. **The LLM proposes; code decides.** Extraction makes one LLM call per idle conversation window. The call returns
   episodes, typed plan patches (`confirm | cancel | reschedule | amend`), fact verdicts
   (`keep | replace | corrects | stale | unknown`) and notes. Code validates the evidence ids against the raw log and
   applies the lifecycle rules. The LLM never deletes or rewrites a memory.
2. **Guards against self-poisoning, in code** (D37, D38):
   - A plan patch applies only if its evidence talks about that plan.
   - An item the assistant said while answering *from memory* is not written back as new evidence (the recall-echo
     guard).
   - After a recall, a fact changes only when someone asserts the change.
   - Claims by other people are kept apart from the owner's facts.
3. **People-aware recall** (D39). A question that names someone, by name or by a stored relation ("my sister"), also
   retrieves that person's own messages, with no extra LLM call.
4. **Cheap by construction** (economy defaults). One extraction call per window, deterministic gates before any LLM
   call, reasoning off, stable prompt prefixes for provider caching, and zero calls when there is nothing to do.
   On the measured runs, 67–71 % of extraction input tokens were served from DeepSeek's prefix cache.
5. **Measured on blind data.** Evaluation datasets are written and audited by separate agents that never see the
   prompts. Runs are repeated three times and compared with paired tests. Each run includes no-memory and
   full-context controls and market baselines. Numbers are quoted with their dataset and caveats (next section).

### Measured results (from [RESULTS.md](spikes/memory-eval/RESULTS.md))

Answer and judge model: `deepseek-flash`. Embeddings: `bge-m3`. Bracketed ranges are 95 % intervals.

| Dataset | Result |
|---|---|
| Spike round 2, noise (187 sessions) | Our design's prototype (D) 96 %; Memobase 88 %; Graphiti 81 %; raw-log baseline 67 % |
| Held-out set (written blind to D's prompts), noise | D 86 %; Memobase 61 %; baseline 50 % |
| `dataset_blind4` (84 q, nobody tuned on it), base | Service v4 80.8 %; Mem0 78.0 %; D 88.3 %; full context (ceiling) 89.9 %. This was the honest correction of the 95 % measured on a set that had already been seen |
| `dataset_blind5` (87 q, fresh), base, 3 runs | Service (recall work H11) 89.2 % [85.8, 92.6]; D 91.7 %; full context 91.4 %. The gap is within noise |
| `dataset_blind3`, quality profiles | Economy 93.5 %, balanced 94.9 %, full 92.1 %, all within noise. Measured after the set had been read, so not blind |
| Recall-echo dev set (not blind) | 79 % without the guard → 100 % with guard v3 (3 runs each) |

What these numbers do **not** show: the blind sets are small (36–87 questions), so gaps under about 5 points are
noise. Several blind sets were later read while fixing failures, and the docs mark which. Local 8–20B engines score
60–83 %, below the project's 95 % bar for a supported engine model.

## What is new, and what is not

The project rule is **never claim novelty without re-checking the literature**
([research notes](docs/RESEARCH_NOTES.md), [literature cards](docs/literature/README.md)). Phase 1 is roughly
85–90 % **integration of known ideas**, borrowed with citation:

| Idea | Source |
|---|---|
| Bi-temporal facts that expire instead of being deleted | Zep / Graphiti |
| Slot-based profile facts, batched merge, mention time vs event time | Memobase |
| Notes with retrieval keys | A-MEM |
| Typed intention lifecycle in code | PIS |
| Evidence-bound extraction | MemIR |
| Event time vs dialogue time | TSM, LongMemEval |
| Batching per idle window | LightMem |

Rejected: treating every fact as a state, graph pipelines, destructive updates, discarding the raw log
([engine ideas](docs/ENGINE_IDEAS.md)).

What is new is narrower:

- **The combination, in one service, behind any agent platform.** We surveyed Hermes, OpenClaw, Letta, Mem0, Honcho,
  Claude Code and ChatGPT ([agent-platform memory](docs/literature/agent-platform-memory.md)). None of them combines
  event time, a plan lifecycle and owner-vs-others provenance at this level. OpenClaw is the only one with structural
  provenance, and its rules match what our poisoning and echo experiments found. Those platforms are ahead of us on
  context injection and use-driven curation.
- **Open research ground** (the hypotheses register, verdict "partially novel, narrow"):
  - **H1 — unresolved user plans.** A user's plan whose date passed without confirmation is stored as *unknown*.
    It is tested together with event accumulation, state supersession, and correction vs change. A plan lifecycle
    alone is *not* new (PM-Bench, PIS).
  - **H2 — disclosure for a personal twin.** Graded social tiers, third-party confidences, labels that propagate to
    digests and notes, and an evaluation of prompt-only defences against pre-retrieval filtering with adversarial
    interlocutors. The filtering mechanism itself is published ("Authorization Before Context"); the twin-specific
    combination and its evaluation are open.
  - **H3 — source monitoring for twins.** The owner's lived memories, what the owner was told, and what the twin
    itself experienced never mix.
  - Smaller items: blind evaluation sets written by a separate agent, and over-strict judge artefacts (H6, a methods
    note). Resting-state thinking that keeps open loops alive (H12, to design). Legacy mode as enforceable mechanisms
    (H4, engineering only). Cost-aware memory (H5) is already a crowded topic: we report costs and claim nothing.

## Entity memory (D48)

An owner can also be an **entity**: a shared device, a home robot, a place. Everyone who uses the entity reads and
writes its memory. Identification ("sono Andrea"; later a voiceprint) only says **whose** a memory is. Within the
entity's memory, facts carry the person they are about, and a fact from an unidentified speaker is not stored as
anyone's fact. Identification never grants access: a person's *own* memory is reached only through a secure client
identity bound by the admin. A code guard records a fact about a person, or an episode naming one, only if the
conversation names that person (no identity carried over from other chats). The person chooses the kind on their
platform (Arkimede: memory settings) while the memory is empty. Measured on a non-blind dev set only (95.5 %, 1 run,
[RESULTS.md](spikes/memory-eval/RESULTS.md)).

## Beyond phase 1

The [vision](docs/DIGITAL_TWIN_VISION.md) adds the next phases:

- a self-model (style, values, decision patterns);
- contacts and disclosure tiers;
- the twin interface: companion mode with the owner, declared proxy toward others (EU AI Act art. 50);
- initiative: inform and propose (L1), then act within a permission matrix (L2);
- the owner's voice;
- legacy mode;
- a research mode on autonomous twins.

Only consenting people are modelled.

Around the memory:
- **Recordare Atlas** ([`arkimedehq/recordare-atlas`](https://github.com/arkimedehq/recordare-atlas), optional, its
  own repo): a live "brain" view of Recordare and its clients' agents. It shows metadata only, and every animation
  is a real event ([contract](docs/ATLAS_EVENTS.md)). Recordare works without it.
- **talkiosk** (own repo): a home voice device talking to Arkimede. Continuous listening is opt-in and puts each
  recognised person's words into their own memory.
- **Connectors** for other agent platforms, sharing one client library and one conformance suite (planned).

## Limits of this version (private profile, D33)

Recordare v1 is the **private (home / research) profile**: an installation run by someone the users trust (a family,
a lab, a small team), not a public service for strangers.
- The admin creates people and client keys; there is no owner login, no OAuth for MCP, no self-service linking UI
  and no read audit yet.
- The admin and the client platforms are trusted: a client key acts for any of its users, and the operator of the
  server can read the database.
- Plain HTTP on a trusted network only; anything reachable from outside needs HTTPS and a firewall in front
  ([DEPLOYMENT.md](docs/DEPLOYMENT.md)).
- Each person's memory is isolated from the others' (tested), but a memory written by an LLM can be wrong: people
  see and correct it in their diary.

Hardening for a public deployment is specified in [API.md](docs/API.md) §0 and deferred (the public profile).

## Quick start (development)

```bash
docker compose up -d db redis          # Postgres + pgvector on :5433, Redis on :6380
cd service && cp .env.example .env     # set ADMIN_API_KEY, LLM_* and EMBEDDING_*
npm install
npm run build && npm run migration:run # needs DATABASE_URL and EMBEDDING_DIM in the environment
npm run start:dev
```

Before every commit, run `npm run typecheck`, `npm run lint` and `npm test` (CI runs the same three). The
[service README](service/README.md) covers the layout and how to choose an LLM provider or model per task. Two more
guides: [integrating a client platform](docs/INTEGRATION.md) and [deployment](docs/DEPLOYMENT.md) (standalone, or
co-hosted with Arkimede on a small server).

## Repository layout

| Path | What |
|---|---|
| `service/` | The Recordare service (NestJS, TypeScript) |
| `spikes/memory-eval/` | Evaluation harness and datasets: engine comparison, blind sets, results ([RESULTS.md](spikes/memory-eval/RESULTS.md)) |
| `docs/` | Vision, design decisions D1–D48 ([episodic memory design](docs/EPISODIC_MEMORY_TODO.md)), [work plan](docs/WORK_PLAN.md), contracts, research notes, literature cards |
| `docker-compose.yml` | Local development stack (Postgres + pgvector, Redis, service) |
| `CLAUDE.md` | Context and conventions for development sessions |

## Related repositories

- [Arkimede](https://github.com/arkimedehq/arkimede): agent platform, the first client.
- [Recordare Atlas](https://github.com/arkimedehq/recordare-atlas): optional live brain view.
- talkiosk: home voice device talking to Arkimede (own repo).

## Licence

[AGPL-3.0-or-later](LICENSE) © 2026 Andrea Genovese. Third-party notices: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md);
reuse policy: [docs/LICENSING.md](docs/LICENSING.md).
