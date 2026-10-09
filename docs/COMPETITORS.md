# Recordare and the other memory systems for AI agents — comparison (2026-10-09)

*Italian version: [COMPETITORS_it.md](COMPETITORS_it.md). The English document is the reference.*

This document compares Recordare with the main memory systems for AI agents as of 9 October 2026, after Recordare's
change of direction in **D50** (`EPISODIC_MEMORY_TODO.md`): every memory belongs to an agent / account. In
**personal** mode the memory speaks in the first person, so the agent becomes an indirect digital twin of the person
who talks to it. In **entity** mode undeclared speakers are "someone" unless input is marked as the agent's own. There
is no consent flag and, for now, no viewer filter.

It builds on two earlier surveys, `literature/agent-platform-memory.md` (source code read on 2026-10-07) and
`literature/human-memory-and-agent-architectures.md` (2026-10-09), and on `ENGINE_IDEAS.md`. The scores of Recordare
and of the market systems we ran ourselves come from `spikes/memory-eval/RESULTS.md` and are quoted with their dates
and caveats. No new evaluation was run for this document.

## 0. Method and limits

- **Checked on the web on 2026-10-09**, mostly through a fetch tool that returns extracted passages rather than raw
  pages. Primary pages read: the GitHub READMEs of Mem0, Graphiti, Honcho, Supermemory, MemOS and Hindsight; Mem0's
  platform changelog; Zep's concepts page; Letta's "our next phase" post; Cognee's 1.0 announcement; the Hermes
  memory-providers page; Claude Code's memory page; the Claude Managed Agents memory page; Supermemory's LongMemEval
  report; the LongMemEval repo. Everything else comes from press coverage or other secondary sources, and it is
  marked as such where it matters.
- **Could not be verified**:
  - OpenAI's own "Dreaming" post and the ChatGPT Memory FAQ. The help centre returned 403 in the earlier survey; this
    time only press coverage was read.
  - Honcho's own benchmark numbers. The README links an evals page, but no number was read from a primary source.
  - Whether Supermemory's local binary contains the whole engine as open source. The repo was reported as MIT, but
    the README does not say what the binary contains.
  - The licences of MemoryOS and of the BEAM dataset.
  - Google's July 2026 Memory Bank features. Only one secondary article was read.
  - The exact current release numbers of most projects. The README pages often do not show them.
- **Vendor benchmark numbers are claims.** They use different answer models, judges, retrieval budgets and even
  metrics: Supermemory reports retrieval recall, most others report QA accuracy. They are listed in §4 to show the
  landscape, never to rank systems against Recordare.

## 1. The systems, as of October 2026

**Mem0** (Apache-2.0; OSS library, self-hosted server, hosted platform) —
[repo](https://github.com/mem0ai/mem0), [changelog](https://docs.mem0.ai/changelog/platform.md),
[research](https://mem0.ai/research-5).
- **April 2026**: a new algorithm. Extraction is one ADD-only pass, so nothing is overwritten or deleted. Entity linking
  is built in, with no external graph store. Retrieval fuses semantic, BM25 and entity signals.
- **May 2026** (platform): "Temporal Reasoning" ranks time-aware queries ("last week", "upcoming", "as of …") and
  accepts a `reference_date`. "Memory Decay" adds a recency bias at search time that "never filters a candidate out".
- **Scoping**: `user_id`, `agent_id` and `run_id`, plus actor / role metadata on messages.
- **Vendor scores**: LoCoMo 91.6–92.5, LongMemEval 93.4–94.4, BEAM 1M 64.1, BEAM 10M 48.6. The README and the
  migration page give slightly different numbers.

**Zep / Graphiti** (Graphiti Apache-2.0; Zep Cloud proprietary) — [Graphiti](https://github.com/getzep/graphiti),
[Zep concepts](https://help.getzep.com/concepts),
[OSS strategy](https://blog.getzep.com/announcing-a-new-direction-for-zeps-open-source-strategy/).
- **Graphiti**: a temporal "context graph". Facts carry validity windows, old facts are invalidated rather than
  deleted, episodes give provenance, ontologies are custom (Pydantic), and retrieval is hybrid. It runs on Neo4j,
  FalkorDB or Neptune, and offers an MCP server and a REST API.
- **Zep Community Edition** is no longer maintained.
- **Zep Cloud**: a graph per user, standalone graphs for shared context, a context block per thread, and a user
  summary steered by up to five instructions.
- **Scores**: the Zep paper reported 71.2 % on LongMemEval with gpt-4o. Competitors quote that number.

**Letta (ex MemGPT)** (Apache-2.0) — [our next phase](https://www.letta.com/blog/our-next-phase),
[Letta Code](https://www.letta.com/blog/letta-code).
- **16 March 2026**: Letta re-centres on **Letta Code**, a model-agnostic harness. Memory becomes a git-backed Markdown
  filesystem ("MemFS" / context repositories), and sleep-time reflection moves to the client.
- **Retired by mid-April**: the server-side memory tools, templates, identity systems and server-side MCP.
- **Since then**: the Letta Code app shipped on 6 April 2026. A TypeScript Agents SDK was announced in August 2026
  (secondary source).
- **Memory model**: it is the **agent's** own. An agent persists, learns and keeps its identity across model changes.

**Supermemory** (repo reported as MIT; hosted API and a local single binary) —
[repo](https://github.com/supermemoryai/supermemory),
[LongMemEval report](https://supermemory.ai/research/longmembench).
- **Model**: documents (sources of truth) are separate from memories (extracted facts). Relations are `updates`,
  `extends` and `derives`. Automatic forgetting covers expired, contradicted and noisy facts. Profiles are split into
  static and dynamic parts.
- **Inputs**: files of many kinds (PDF, images, video, code) and connectors (Drive, Gmail, Notion, OneDrive, GitHub).
- **Interfaces**: an MCP server.
- **Scores**: LongMemEval-S **Recall@20** of 97 % (95 % at Recall@15 on the README), against 71.2 % for Zep and
  60.2 % for full context. These are retrieval recall figures set beside other systems' QA accuracy: different
  metrics.

**Honcho (Plastic Labs)** (AGPL-3.0, self-hostable; server 3.3.0) — [repo](https://github.com/plastic-labs/honcho).
- **Peers**: every participant, human or AI, is a **peer**. Observation is configurable, which gives
  observer → observed representations (theory of mind).
- **Isolation**: **workspaces** are the multi-tenant boundary. **Scopes**, which are new, are named groups of sessions
  that bound what chat, representation and search can see.
- **Background work**: a **deriver** extracts facts and builds summaries, peer cards and dreams. A **dialectic** Q&A
  endpoint has four effort levels.
- **Scores**: it claims a "Pareto frontier" on LongMemEval, LoCoMo and BEAM (numbers not verified). Hindsight's blog
  reports Honcho at **40.6 % on BEAM 10M**.
- **Integrations**: Hermes, OpenClaw, Claude Code and any MCP client.

**Memobase** (Apache-2.0) — [repo](https://github.com/memodb-io/memobase). A user profile made of slots, plus an
event timeline with two dates, per-user buffers and an MCP server. A secondary source puts its last push at
11 January 2026. We measured it in October 2026.

**Cognee** (Apache-2.0) — [1.0 announcement](https://www.cognee.ai/cognee-1-0-announcement).
- **1.0** (26 June 2026): a memory API of `remember / recall / forget / improve`, a single-Postgres option, a Rust core
  for edge use, MCP, and the COGX export format.
- **v1.4.0** (July 2026) followed, according to a secondary source.
- **Score**: BEAM-100k 79 % against a 73.4 % baseline (vendor). It is graph-centred and close to RAG in our
  measurement.

**LangMem (LangChain)** (MIT) — [repo](https://github.com/langchain-ai/langmem). Semantic, episodic and procedural
memory (prompt optimisation), with debounced background extraction. A secondary source reports PyPI 0.0.30 (October
2025) as the latest release and a repo still active in June 2026. It is pre-1.0.

**MemOS (MemTensor)** (Apache-2.0) — [repo](https://github.com/MemTensor/MemOS).
- **Releases**: 2.0 "Stardust" on 5 January 2026; v2.0.22 on 3 July 2026.
- **Features**: memories as an inspectable graph, multimodal input (text, images, tool traces, personas), "multi-cube"
  isolation with controlled sharing, and feedback in natural language.
- **Plugins**: official ones for OpenClaw (March 2026) and Hermes (April 2026). The `memos-local-plugin 2.0` (May
  2026) adds traces, policies, world models and skills.
- **Scores**: LoCoMo 88.83, LongMemEval 89.20 (vendor).

**MemoryOS (BAI-LAB)** (licence not verified) — [repo](https://github.com/BAI-LAB/MemoryOS). The research system of
the EMNLP 2025 oral paper: short-, mid- and long-term tiers, a FIFO dialogue chain and segmented pages. It has an MCP
server. Its LoCoMo result is reported relative to baselines (+49 % F1 on GPT-4o-mini).

**Hindsight (Vectorize)** (MIT) — [repo](https://github.com/vectorize-io/hindsight),
[BEAM post](https://hindsight.vectorize.io/blog/2026/04/02/beam-sota). Added because it became a common provider in
2026 (Hermes ships it).
- **Memory types**: world facts, experiences, observations (consolidated beliefs) and mental models.
- **Operations**: retain, recall (semantic, keyword, graph and temporal in parallel) and reflect.
- **Score**: **BEAM 10M 64.1 %** (vendor, 2 April 2026).

**ChatGPT memory (OpenAI)** (proprietary) — secondary sources
([PCWorld](https://www.pcworld.com/article/3158111/chatgpt-new-dreaming-feature-makes-it-way-better-at-remembering-you.html),
[iClarified](https://www.iclarified.com/96981/chatgpt-can-now-reference-all-your-past-chats)).
- **Before**: saved memories plus reference to the whole chat history.
- **4–5 June 2026, "Dreaming" (V3)**: a background process reads across past chats and keeps a **synthesised memory
  state** that is injected at the start of each chat. Users can read and edit a memory summary, and Plus / Pro get
  twice the capacity.
- **Controls**: users can switch back to saved memories, opt out, or use temporary chats.
- **Score**: OpenAI reportedly states factual recall of 82.8 %, against 41.5 % in 2024 (internal eval, press reports).

**Claude memory (Anthropic)** (proprietary) — three products.
- **Claude app**: memory of past chats; open to free users since 2 March 2026, with an import prompt for other
  assistants' memories and a "see what Claude learned about you" view
  ([9to5Mac](https://9to5mac.com/2026/03/02/free-claude-users-can-now-use-memory-and-import-context-from-rivals/)).
- **Claude Code** ([docs](https://code.claude.com/docs/en/memory)): `CLAUDE.md` holds human instructions (org,
  project and user scope). **Auto memory** is written by the model: a `MEMORY.md` index (the first 200 lines / 25 KB
  are loaded each session) plus topic files of type `user | feedback | project | reference`. It is machine-local and
  per repository, and subagents can keep their own.
- **Claude Managed Agents memory stores** ([docs](https://platform.claude.com/docs/en/managed-agents/memory); public
  beta since April 2026):
  - stores are workspace-scoped collections of text documents, mounted as directories in the agent's sandbox, with
    `read_only` or `read_write` access;
  - every change is an immutable version **attributed to the session**, kept 30 days, and versions can be redacted;
  - "dreaming" sessions consolidate a store into a **new** store;
  - the docs warn that prompt injection can write into a read-write store.

**Google Gemini** (proprietary) — sources:
[Android Authority](https://www.androidauthority.com/google-gemini-personal-intelligence-rollout-3632287),
[9to5Google](https://9to5google.com/2026/02/26/gemini-past-chats-free/),
[Google blog](https://blog.google/intl/en-mena/product-updates/explore-get-answers/ai-memories-chat-history-to-gemini/).
- **"Personal context"**: memory of past chats, on by default and possible to switch off.
- **"Personal Intelligence"** (14 January 2026, US AI Pro / Ultra): reasons across Gmail, Photos and YouTube. Off by
  default, and each app is authorised separately.
- **Since March 2026**: temporary chats and memory import.
- **For developers**: Google's agent platform added an `IngestEvents` API, **Memory Profiles** and revision controls
  (TTL, labels) to its Memory Bank in July 2026. That is one secondary source
  ([agentmarketcap](https://agentmarketcap.ai/blog/2026/07/28/gemini-agent-memory-managed-infrastructure)); not
  verified.

**OpenClaw** (MIT) — repo docs (survey of 2026-10-07),
[release 2026.4.12](https://newreleases.io/project/npm/openclaw/release/2026.4.12),
[memory-core](https://docs.openclaw.ai/es/plugins/reference/memory-core.md).
- **Tiered memory**: `AGENTS.md`, curated `MEMORY.md` / `USER.md`, dated daily notes, standing intents and
  `DREAMS.md`.
- **Provenance**: structural, with an origin class `owner | agent | untrusted | system` that is "never defaulted to
  owner", plus turn taint after network tools.
- **Dreaming**: light, REM and deep phases (2026.4.5). Code validates the LLM's operations.
- **Active Memory** (2026.4.12): an optional recall sub-agent that runs before the reply.
- **Plugins**: memory-lancedb, memory-wiki, Honcho, MemOS, ReMe and Recordare's own connector.

**Hermes Agent (Nous Research)** (MIT) —
[providers](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory-providers).
- **Built-in memory**: `MEMORY.md` + `USER.md`, frozen per session, with a background review fork.
- **External providers**: nine are listed (Honcho, OpenViking, Mem0, Hindsight, Holographic, RetainDB, ByteRover,
  Supermemory, Memori). Only one is active at a time, always alongside the built-in memory, and everything handed to a
  provider is secret-scrubbed first.
- Recordare's connector is a provider of this kind.

**Research reference** — **Collaborative Memory** (Rezazadeh et al., arXiv:2505.18279; `literature/collaborative-memory.md`):
multi-user, multi-agent memory.
- **Model**: a private tier per user and a shared tier.
- **Provenance**: immutable on every fragment (time, originating user, contributing agents, resources).
- **Permissions**: time-varying, checked at read time.
- No code was released.

## 2. Comparison table

Abbreviations: Ep = episodic, Fact-h = facts with history, Pref = preferences / notes, Proc = procedural,
Prosp = prospective (plans / intents with a lifecycle), Docs = documents / knowledge. "Recordare (D50)" is the planned
state of WORK_PLAN M8 (steps 8.3–8.12), not built yet beyond 8.1–8.2.

### 2a. What is stored, about whom, and how it is trusted

| System | Whose memory | Speaker identity / source monitoring | Kinds | Time model | Provenance / poisoning guards | Consolidation |
|---|---|---|---|---|---|---|
| **Recordare (today)** | One memory per person; entity memory for shared devices (D48, experimental) | `author_role`, origin `owner_lived / owner_told / assistant_stated`, others' claims kept apart, named-in-window guard for entity speakers | Ep (event / plan / state change), Fact-h (value chains), Pref (notes), Prosp (owner's plans with lifecycle); raw log forever; no Proc, no Docs (D49 proposal) | Bi-temporal; event time + **precision** + original expression; facts **as of** a date; `corrects` vs `supersedes` | Evidence ids validated in code; LLM never deletes; recall-echo guard; plan patches need evidence; tombstones | Idle window + nightly day / month digests (fingerprinted, zero calls when nothing new) |
| **Recordare (D50)** | **The agent's**: one per client account, personal or entity mode | Planned: subject on every item, attribution **method + confidence**, `own` marker, "someone" + re-attribution | + D49 sources (Docs), later reflection, Proc notes, the agent's own intents, perception | Unchanged | Unchanged + reality monitoring kept in data while text is first person | + digests in the agent's voice |
| Mem0 | User-centric with `user_id` / `agent_id` / `run_id` scopes | Actor / role metadata; no third-party role (our adapter had to prefix names) | Flat fact strings + entity links; Pref | Observation date in text; platform: temporal ranking + `reference_date` (May 2026) | ADD-only (nothing deleted); currency only at retrieval | None (retrieval-time ranking, decay bias) |
| Zep / Graphiti | User graph per user + shared graphs | Entities resolved; episodes as provenance; no speaker-trust model | Facts as graph edges, entities, episodes, summaries | **Bi-temporal** edges (`valid_at / invalid_at` + record time) | Invalidation not deletion; LLM decides contradictions (all facts treated as states) | Incremental; communities / summaries |
| Letta | **Agent-centric** (agent's blocks / MemFS) | Git author per reflection; none per speaker | Core blocks, archival, recall; skills (Proc) | Commit history | Git history; edits at source | Reflection subagent / sleep-time on step count or compaction |
| Supermemory | User / container-scoped | Not documented | Memories + **documents** (multimodal), static / dynamic profile | `isLatest` on updates; time-based expiry | History kept for audit; contradiction handling | Automatic forgetting; derived relations |
| Honcho | **Peer-centric**: every participant (human or AI) is a peer; observer → observed | Facts about a peer only from that peer's messages; accepted proposals count; peer cards | Explicit / deductive / inductive observations, peer cards, summaries | Message time; deductions handle updates | `source_ids` required on deductions; invented ids dropped; deletes outdated observations | Dreaming (deduction + induction) per peer pair |
| Memobase | User profile | None beyond user | Profile slots + event timeline | Mention time vs event time (as text) | Overwrites on update | Buffer flush; profile merge |
| Cognee | Datasets / knowledge graphs | None | Docs-centred graph, `improve` | Temporal search as a separate pipeline | — | `memify` / `improve` |
| LangMem | Namespaces (user or agent) | None | Semantic, episodic, **Proc** (prompt optimiser) | `created_at` | — | Debounced background reflection |
| MemOS | MemCubes per user / agent, multi-cube sharing | Not documented | Text, multimodal, tool traces, skills, personas | Not documented | Feedback / correction in language | Scheduler; skill evolution (local plugin) |
| Hindsight | Memory banks (details not verified) | Not documented | World facts, experiences, observations, mental models | Temporal retrieval strategy | Not documented | Reflect |
| ChatGPT | User account | None (one user) | Saved memories + synthesised memory state from chats | Recency of mention | User can read / edit the summary | **Dreaming V3** (background synthesis) |
| Claude (app / Code / Managed Agents) | Account; per repo (Code); per store chosen by the developer (Managed Agents) | Code: none; Managed Agents: versions attributed to the session | Code: instructions + typed notes; Managed Agents: free-form files | `modified` stamp; versions (30 days) | Managed Agents: `read_only` mounts, immutable versions, redact | Code: none; Managed Agents: "dreaming" into a new store |
| Gemini | User account | None | Past-chat profile, preferences, connected-app data | Not documented | Per-app authorisation for connected data | Periodic profile summary |
| OpenClaw | Agent workspace (`USER.md` about the user) | **Origin class `owner / agent / untrusted / system`**, session kind, **turn taint** | Curated core, directives, daily notes, **standing intents** (Prosp), wiki claims | Observed timestamp + supersession key | Never defaults to owner; untrusted removed before dreaming; recall-loop prevention | Nightly dreaming with code-validated ops |
| Hermes | Agent profile (`MEMORY.md` agent, `USER.md` user) | `turn_author`, `agent_context` (primary / cron / subagent) to providers | Two small files + skills (Proc) + session search | Session time | Injection / exfiltration scan, secret scrub, optional write approval | Review fork every 10 turns |

### 2b. How it is reached, isolated, run and measured

| System | Recall interfaces | Multi-agent / multi-tenant | Sensors / multimodal | Languages | Privacy / consent | Self-hosting / licence | Cost model | Published evaluations |
|---|---|---|---|---|---|---|---|---|
| **Recordare** | MCP tools (7), REST ingest, pre-turn memory context (zero LLM), read API (Diary), TS client library; connectors for Claude Code, Codex, OpenClaw, Hermes, OpenAI-compatible proxy | One installation, memories isolated (tested); private profile only: trusted admin, no OAuth | Text only; voice via the client's transcription | Memories in the configured locale; period resolver for 25 languages; measured mostly in Italian with English sessions | **No consent flag since D50**; deployer informs people (GDPR); forgetting with tombstones; no viewer filter for now | **AGPL-3.0**, self-hosted only (Docker; ≈ 6 GB RAM standalone) | One extraction call per idle window, zero when idle, prefix caching (67–71 % cached); quality profiles economy / balanced / full | Own blind sets only (31–87 q each), 3 runs, paired CIs, controls; **no LoCoMo / LongMemEval / BEAM** |
| Mem0 | SDK, REST, MCP (OpenMemory), host injects | `user_id` / `agent_id` / `run_id`; platform projects | Images on platform (not checked this round) | Our run: memories stored in English | Delete API, expiry | Apache-2.0 OSS + hosted | One LLM call per `add`; platform priced by usage | LoCoMo, LongMemEval, BEAM (vendor) |
| Zep / Graphiti | SDK, REST, MCP (Graphiti), context block | Users, standalone graphs | Business data / JSON | Mixed-language facts in our run | Cloud controls | Graphiti Apache-2.0; Zep Cloud proprietary | 8–12 calls per session in our 2026-10-02 trace (Graphiti) | LongMemEval 71.2 % (paper, gpt-4o) |
| Letta | Agent tools, files; Letta Code app / SDK | Agents, subagents | — | Model-dependent | Local / cloud | Apache-2.0 | Agent-driven | Not checked |
| Supermemory | API, MCP, connectors, profile endpoint | Containers | **Files: PDF, images, video, code** | Not documented | Not checked | Repo MIT; hosted + local binary | Hosted pricing (not checked) | LongMemEval-S Recall@20 97 % (vendor, retrieval metric) |
| Honcho | SDK, REST, MCP, dialectic chat, peer card, context | **Workspaces (multi-tenant), peers, scopes** | — | Model-dependent | Scopes as visibility boundaries | **AGPL-3.0**, self-host + cloud | Deriver + dreamer + LLM at read (dialectic) | Claims on LongMemEval / LoCoMo / BEAM; BEAM 10M 40.6 % (reported by Hindsight) |
| Memobase | SDK, REST, MCP, context packer | Users | — | Prompts en / zh | — | Apache-2.0 | Buffered batches | LoCoMo (vendor, older) |
| Cognee | SDK, MCP, recall | Datasets | Many file formats | Not documented | Forget op | Apache-2.0 + cloud | Graph build per ingest | BEAM-100k 79 % (vendor) |
| LangMem | Python SDK over LangGraph store | Namespaces | — | Model-dependent | — | MIT | Background calls | Not checked |
| MemOS | API, cloud / local plugins | Multi-cube | Text, images, tool traces | zh / en communities | — | Apache-2.0 + cloud | Vendor claims token savings | LoCoMo 88.83, LongMemEval 89.20 (vendor) |
| Hindsight | API, 60+ integrations, Hermes provider | Banks | Not checked | Not checked | — | MIT + cloud | Not checked | BEAM 10M 64.1 % (vendor) |
| ChatGPT | Always-on injection | Per account; projects | Chat (images in chats) | Many | Opt-out, temporary chat, editable summary | Proprietary | In the subscription | Internal recall 82.8 % (press) |
| Claude | Code: files loaded at start; Managed Agents: mounted files | Managed Agents: up to 8 stores per session | — | Many | Code: local files; Managed Agents: redact, read-only | Proprietary | In the subscription / API | None found |
| Gemini | Always-on personal context; connected apps | Per account | Photos / Gmail / YouTube via Personal Intelligence | Many | Connected apps off by default; temporary chats | Proprietary | In the subscription | None found |
| OpenClaw | Lane-1 injection (zero LLM), lane-2 Active Memory sub-agent, plugins | Per agent | — | Model-dependent | Forget by session, redaction, taint quarantine | MIT | Nightly dreaming | Not found |
| Hermes | Frozen snapshot + provider prefetch | Per profile; one provider at a time | — | Model-dependent | Secret scrub, write approval | MIT | Review fork on a cheap model | Not found |

## 3. Dimension by dimension

**Whose memory.** The market splits three ways.
- **User-centric**: Mem0, Zep, Memobase, Supermemory, ChatGPT, Claude and Gemini. The memory is *about* a user, keyed
  by a user id.
- **Agent-centric**: Letta, Hermes and OpenClaw. The memory is the agent's own notebook, and the user is one topic in
  it (`USER.md`, a human block).
- **Peer-centric**: Honcho. Every participant, human or AI, is a peer, and memory is a view of one peer by another.

Pre-D50 Recordare was user-centric with unusually strong provenance. D50 moves it to the agent-centric group, with a
user-centric memory inside, in Huang et al.'s terms (`human-memory-and-agent-architectures.md` §2.6). Personal mode
adds a twist not seen elsewhere in the products surveyed: the agent's "I" **is** the account holder, so the agent's
memory reads as the holder's own diary. We found no product that writes the memory in the first person of the user.
This is a product observation, not a novelty claim: Letta's agents and ChatGPT's synthesised state are close in
spirit, and nobody has checked the literature for it yet.

**Identity and source monitoring.**
- **Honcho**: "never derive a fact about the target peer from what another peer said".
- **OpenClaw**: an origin class plus turn taint.
- **Pre-D50 Recordare**: `origin` / `author_role`, claims kept apart, the named-in-window guard.

These three are the only systems we found that treat **who said it** as a first-class field. Mem0 has actor
metadata but no third-party role (in our adapter, group chats had to be flattened into named user messages). The
consumer assistants model a single user. D50's planned additions are an attribution **method and confidence**
(declared, voiceprint, face, inferred), an "unknown speaker" that can be re-attributed later, and an `own` marker for
the agent's perceptions and knowledge. These go beyond what the surveyed products document, but the Collaborative
Memory paper already stores immutable per-fragment provenance (originating user and agent) and checks permissions at
read time.

**Kinds of memory.**
- **Recordare covers well**: episodes with event time, facts with value chains, notes, and the owner's plans with a
  lifecycle.
- **Recordare lacks**:
  - procedural memory (Letta, Hermes, LangMem and MemOS have skills or prompt optimisation);
  - documents / knowledge: Supermemory, Cognee and MemOS ingest files; D49 is only a proposal;
  - the agent's own intents (OpenClaw's standing intents);
  - reflection (Honcho induction, Hindsight's "mental models", Letta sleep-time).
- **Plan lifecycle**: we found none with an outcome-unknown state for the user's own past plans (H1, "partially novel,
  narrow").

**Time.** Two families have real bi-temporal facts: Graphiti / Zep and Recordare. Since May 2026 Mem0's platform ranks
time-aware queries with a reference date, but this is retrieval ranking, not stored validity. Recordare is the only
one surveyed that stores **date precision** and the original time expression on episodes, and answers "as of" a date
from stored validity.

**Provenance and poisoning.** The systems that hold up rely on structure, not detection:
- OpenClaw's origin class;
- Honcho's `source_ids`;
- Managed Agents' read-only mounts and versions;
- Recordare's code-validated evidence and claims split.

In our measurements both Mem0 and Cognee attributed a group member's claim to the owner (blind3 b34, 0/3).
Anthropic's documentation states the risk plainly: an injection into a read-write store "later sessions then read …
as trusted memory".

**Consolidation.** "Dreaming" is now mainstream: ChatGPT (June 2026), Claude Managed Agents, OpenClaw and Honcho all
have it.
- **Rewriting kind**: ChatGPT's synthesised memory state.
- **Non-destructive kind**: Managed Agents dream into a new store; OpenClaw keeps a pre-image and validates operations
  in code.
- **Recordare's**: chronological digests that make zero LLM calls when nothing is new. Its measured value for answers
  is nil so far (digests in recall −1.9 pt, within noise).

**Recall interfaces.** Every serious system now offers MCP, and most offer a pre-turn injection (Zep's context block,
ChatGPT, Hermes prefetch, OpenClaw lane 1, Recordare's memory context). An LLM at read time is common: Honcho
dialectic, OpenClaw Active Memory, Hindsight reflect. Recordare deliberately keeps it out (D12). Recordare's REST
ingest plus five connectors is broad. Its client library is TypeScript only, and the Hermes connector is Python.

**Multi-tenant and multi-agent.**
- **Honcho**: workspaces, peers and scopes.
- **Mem0**: user / agent / run scopes.
- **MemOS**: multi-cube sharing.
- **Managed Agents**: several stores per session.
- **Recordare**: isolated memories in one installation, but only the private profile (trusted admin, no OAuth, no read
  audit). D50 makes isolation simpler (one account = one memory) and removes the cross-platform "one person = one
  memory" link.

**Sensors and multimodal input.** Supermemory, MemOS, Cognee and Gemini (through connected apps) take non-text input.
Recordare is text only. D50's "robot with cameras" is not built: the perceptual layer is in M8 step 12 ("later").

**Languages.** Recordare is the only system here whose evaluation sets are mainly Italian with English sessions mixed
in. Mem0 stored Italian conversations as English memories in our run, and Memobase's prompts are en / zh only. The
other systems do not document language behaviour.

**Privacy and consent.**
- **Consumer assistants**: user-facing controls (opt-out, temporary chats, editable summaries).
- **Infrastructure**: delete APIs, redaction (Managed Agents), scopes (Honcho).
- **Recordare after D50**: no consent flag and no viewer filter. The deployer is responsible, and `audience` /
  `disclosure` are still recorded for later. In practice this is now **less** protective than Honcho's scopes for
  multi-person settings, and close to the infrastructure products' "the developer decides".

**Self-hosting and licence.** Fully self-hostable with an open licence: Mem0, Graphiti, Letta, Honcho, Memobase,
Cognee, LangMem, MemOS, Hindsight, OpenClaw, Hermes and Recordare. Supermemory's repo is reported MIT, but the
contents of its binary are unverified. Honcho and Recordare are both **AGPL-3.0**, the only copyleft ones, which also
means Honcho's prompt text is reusable by us with notices (`LICENSING.md`).

**Cost.**
- **Recordare's design** is frugal: one call per idle window, zero calls when idle, and no LLM at read. Measured
  ingest for one person over five months (232 sessions) was about 1 M input tokens, two thirds cached (WORK_PLAN,
  evaluation budget).
- **Mem0 in our runs**: 1.77 M engine input tokens for one noise run of blind3, against 731 k for Recordare v4
  (`RESULTS.md` 4b.5).
- **Honcho**: spends at read time (dialectic).
- **Graphiti**: needed 8–12 calls per session in our 2026-10-02 run.

## 4. Evaluations

### 4.1 What we measured ourselves (`spikes/memory-eval/RESULTS.md`)

Common setup: answer and judge `deepseek-flash` (the same model, a known weakness), embeddings `bge-m3`, engines on
DeepSeek with reasoning off. Sets of 24–87 questions, so gaps under about 5 points are noise.

| Date | Set | Result | Caveats |
|---|---|---|---|
| 2026-10-02 | Round 2, 24 q, noise (187 sessions) | Prototype D 96 %, Memobase 0.0.42 88 %, Graphiti 0.30 81 %, raw-log baseline 67 % | D got three prompt iterations after seeing base results; Graphiti and Memobase as shipped; 1 run |
| 2026-10-02 | Held-out (written blind to D), noise | D 86 %, Memobase 61 %, baseline 50 % | Graphiti not re-run; 1 run |
| 2026-10-03/05 | `dataset_blind3`, 36 q, 3 runs | Base / noise: Mem0 2.2.1 87.5 / 88.4 %; Cognee 1.6.0 85.7 / 83.8 %; service v2 (blind) 86.0 % base; service v4 94.9 / 95.4 % (**post-hoc**, set already read); full context 97.2 %; no memory 8.3 % | v4 − Mem0 within noise; v4 − Cognee +11.6 pt on noise (significant). Mem0 ran its v3 ADD-only pipeline **without** its spaCy entity boost, with the session date passed as observation date, and stored memories in English |
| 2026-10-05 | `dataset_blind4`, 84 q, 3 runs | Base / noise: service v4 80.8 / 79.8 %; Mem0 78.0 / 79.3 %; D 88.3 %; full context 89.9 % | v4 vs Mem0 within noise; the honest correction of blind3's 95 % |
| 2026-10-05→08 | `dataset_blind5`, 87 q | Service 89.2 % (later 90.7 %), D 91.7 %, full context 91.4 % | No market baseline run on it |
| 2026-10-08 | `dataset_blind7` (46 q) / `dataset_blind8` (entity, 31 q), 3 runs | Released service 91.3 % / **82.1 %** | No market baseline; entity memory experimental |

Conclusions we can actually draw:
1. On the sets where both ran, Recordare's service was **at Mem0's level** (within noise). It was ahead of Cognee on
   noise, and ahead of Memobase and Graphiti in the earlier, smaller rounds.
2. Mem0 and Cognee failed the same structural probes every time: period questions and a third party's claim about the
   owner.
3. **No market system has been run on the sets that matter for D50**: multi-speaker attribution (blind6, blind8) and
   the coming agent sets. The Mem0 we measured is the OSS library. The platform's May 2026 temporal ranking was not
   tested.

### 4.2 Published benchmark claims (vendor numbers; not comparable with each other or with §4.1)

| System | LoCoMo | LongMemEval | BEAM |
|---|---|---|---|
| Mem0 (April 2026 algorithm) | 91.6–92.5 | 93.4–94.4 | 1M 64.1, 10M 48.6 |
| MemOS | 88.83 | 89.20 | — |
| Supermemory | claimed | Recall@20 97 % (retrieval, not QA) | — |
| Zep | — | 71.2 % (gpt-4o, paper) | — |
| Hindsight | — | claimed SOTA (Jan 2026) | 10M 64.1 % |
| Honcho | claimed | claimed | 10M 40.6 % (reported by Hindsight) |
| Cognee | — | — | 100k 79 % |

Caveats on the benchmarks themselves:
- **LoCoMo**: 6.4 % of its answer key is wrong, and its published judge accepted 63 % of deliberately wrong answers
  (`literature/penfield-locomo-audit.md`). Its licence is CC BY-NC.
- **LongMemEval-S**: about 115 k tokens fit in today's context windows, so it measures context efficiency more than
  retrieval. A cleaned version came out in September 2025 and LongMemEval-V2 ("agentic context") in May 2026. MIT
  licence.
- **BEAM**: built for 1M–10M tokens, where context stuffing fails. Its licence was not verified.
- **None of these measures the questions D50 raises**: who said what among several speakers, the agent's own versus
  others' memories, a first-person rendering.

## 5. Where Recordare differs — today and after D50

### Honest strengths
- **Time and plan semantics.** Event time with precision, as-of facts, `corrects` vs `supersedes`, and plans whose
  outcome stays unknown. Only Graphiti / Zep is comparable on bi-temporal facts, and none of the systems surveyed has
  the plan lifecycle.
- **Provenance enforced in code.** Evidence ids are checked against the raw log, the LLM never deletes, others' claims
  are kept apart, and there is the recall-echo guard (79 % → 100 % on its dev set). OpenClaw and Honcho share this
  philosophy; most others do not.
- **Measurement discipline.** Blind sets written by separate agents, three runs, paired intervals, no-memory and
  full-context controls, and market baselines in the same harness. Vendors publish single numbers on public
  benchmarks.
- **Cheap by construction**, with no LLM at read, and **any provider**.
- **Open and self-hosted (AGPL)**, with connectors to OpenClaw, Hermes, Claude Code and Codex, and an OpenAI-compatible
  proxy.

### Weaknesses and gaps
- **No public-benchmark number.** Recordare cannot be placed next to Mem0, MemOS, Hindsight or Zep at all, and its own
  sets are small (31–87 questions).
- **Entity / multi-speaker memory is the weak spot**: 82.1 % on blind8, where unidentified speakers get attributed to
  named people. D50 makes this mode central.
- **Missing kinds of memory**: no documents (D49 not built), no procedural memory, no reflection, no agent intents, no
  multimodal input. Supermemory, MemOS and Cognee ingest files; Letta and Hermes keep skills.
- **Not production-hardened for strangers**: private profile, trusted admin, no OAuth. Honcho has workspaces and
  scopes; Mem0, Zep and Supermemory have hosted multi-tenant platforms.
- **No privacy layer after D50.** Without consent and without a viewer filter, a family member asking the agent gets
  answers from everything. Honcho's scopes and Managed Agents' read-only stores give developers boundaries that
  Recordare currently does not.
- **Local models are not supported at quality**: 60–83 %, under the 95 % bar. Several competitors advertise local
  modes, but their quality with local models is unmeasured by us.
- **Single maintainer and one real client.** The others have communities and integrations at scale.

### What others do better (worth learning from)
- **Injection and curation by use**: OpenClaw's two lanes and triggers, Hermes' prefetch, ChatGPT's recency /
  frequency management, Mem0's decay as a ranking bias that never filters.
- **Profiles that users can read and edit**: ChatGPT's editable memory summary, Supermemory's static / dynamic profile,
  Honcho's peer cards, Google's Memory Profiles.
- **Version audit and redaction**: Managed Agents (immutable versions attributed to the session, redact), Google's
  revision controls.
- **Visibility boundaries as data**: Honcho's scopes, Collaborative Memory's permission graphs checked at read time.
- **Documents beside memories**: Supermemory and Cognee.

### Closest to the D50 vision, and how D50 differs

| System | What is close | How D50 differs |
|---|---|---|
| **Honcho** | Every participant is a peer; facts about a peer only from that peer; the agent itself can be a peer that observes the others | Honcho stores **per-pair** representations (A's view of B) and answers through an LLM at read time. D50 keeps **one** memory per agent with a subject on every item, renders it in the first person (personal mode), has no LLM at read, keeps an append-only history (Honcho's deduction deletes outdated observations) and has an explicit event-time model |
| **Letta / Letta Code** | Memory belongs to a persistent agent that keeps its identity across models; sleep-time reflection | Letta's memory is files the agent edits itself (lossy rewrites, no event time, no per-speaker attribution); D50 keeps extraction-by-service with evidence and attribution |
| **Collaborative Memory** (paper) | Immutable provenance per fragment (originating user, contributing agent), multiple users of the same agents, read-time permission checks | It is a research design with private and shared tiers and LLM redaction; D50 has one tier and **no permission check yet** (no viewer filter). Collaborative Memory's read-time check is the natural shape for D50's later privacy step |
| **OpenClaw** | Agent-owned memory with origin classes and turn taint | OpenClaw never defaults content to the owner; D50's personal mode **does** default undeclared content to the self, which needs OpenClaw-style taint to keep tool and web text out of "I" |
| **Claude Managed Agents** | Stores owned by the deployment, attached per session, versions attributed to the session | Free-form files written by the agent; attribution is to a session, not to a speaker; no semantics of time or plans |
| **Mem0 (`agent_id`, actor metadata)** | Agent scope next to user scope | Scopes, not attribution inside one memory; no third-party role |

Literature status: `human-memory-and-agent-architectures.md` §2.6 says an *agent-centric memory that contains
user-centric memory with attribution* is named as under-studied (Huang et al., 2026), and is not proven new. Honcho
and Collaborative Memory are close. The first-person "indirect twin" rendering and attribution method / confidence
as data have not been checked against the literature. **No novelty is claimed here.**

## 6. Recommendations for M8

1. **Make attribution data, borrowing Honcho's rules (AGPL, reusable with notice) and Collaborative Memory's
   provenance (idea, cited).** Add `attributed_to`, `attribution_method`, `attribution_confidence` and re-attribution
   links on every item (audit Q2–Q6, gap 3 of the literature card). Keep Honcho's deriver rule: no fact about a
   person from another speaker's words, unless that person assents. Store originating speaker and contributing agent
   immutably, so a later privacy step can check at read time without a migration.
2. **Treat first person as rendering, never as provenance.** Keep `origin` / `author_role` apart in the data
   (perceived vs generated, the reality-monitoring split), as the literature card argues. Avoid the memory-file style
   (Letta, Claude Code, Hermes `MEMORY.md`), where an agent writes "I" with no source, and avoid ChatGPT-style
   synthesised state that replaces items.
3. **Borrow OpenClaw's turn taint before personal mode defaults undeclared text to the self** (MIT, idea and wording
   with notice). In D50 personal mode the default is "mine". Text from web, tool or file results must therefore never
   become first-person memory unless it is marked `own` (D49 sources). Anthropic's warning about injection into
   read-write stores is the same risk. Measure it with a small dev set of injections through tools, then the blind
   poisoning categories.
4. **Add redaction / erasure by contact, now that consent is gone.** Managed Agents can redact versions; Google's
   Memory Bank has revision TTLs (unverified). Recordare needs "forget everything about Marta" (episodes naming her,
   her facts, her raw-log lines) as an append-only tombstone operation. Without consent this is the deployer's main
   tool for GDPR erasure requests. It costs zero LLM calls, so it can ship without evaluation (tests only).
5. **Design the later privacy step on scopes, not on prompts.** Honcho's scopes (session groups that bound recall) and
   Collaborative Memory's read-time check over stored provenance both fit data Recordare already records (`audience`,
   `disclosure`). Record the decision in D50's "later" list, so M8's schema (8.3, 8.10) does not close the door.
6. **A self card and contact cards as derived, deterministic views** (agent-platform idea 6; Honcho peer card, ChatGPT
   editable summary, Supermemory static / dynamic profile, Google Memory Profiles). In D50 terms: "who I am" for the
   self and one card per contact, built from current facts and stated notes with source ids, readable and correctable
   in the Diary. Zero LLM calls when built deterministically. Measure with the memory-context dev set.
7. **D49 sources: keep Supermemory's separation of documents vs memories and its `updates / extends / derives`
   relations as the model** (idea, cited). Do not adopt Cognee-style graph building at ingest (we measured it as
   closest to RAG, and it is costly per document).
8. **Avoid**: an LLM at read on the default path (Honcho dialectic, OpenClaw Active Memory); deleting outdated items
   (Honcho deduction, Letta "fix at source"); recency decay or recall frequency as truth (ranking only, as Mem0's decay
   and OpenClaw's deep gate show); "when in doubt, extract" (Mem0; our extract.v5 lost points twice).
9. **Rerun one measured comparison, at a stated budget: Mem0 OSS on the new agent sets (8.11), base only, 3 runs.**
   Mem0 is the system our service tied with, and its `agent_id` / actor scopes are the market's default answer to
   "agent memory". Evaluation rule 3 allows a re-run because the question is new: attribution among several speakers
   was never measured for it. The cost is high: Mem0 took 56 % of the spend of the 2026-10-04→05 round, and 1.77 M
   input tokens per noise run on blind3. Base only, no noise, and state the budget and check the balance before
   running (rule 8). Add **Honcho as one exploratory run** (1 run, the entity set) only if the Mem0 result leaves the
   attribution question open: it is the closest design, it is AGPL, and it can be self-hosted.
10. **Get one public-benchmark data point, cheaply, for comparability only:** LongMemEval-S *cleaned* (MIT), a
    stratified subset of about 100 questions, personal mode, 1 run, no tuning on it. Each question has its own history
    of about 115 k tokens, so 100 questions mean roughly 11–12 M extraction input tokens. That is about ten times one
    blind run, so state and approve the budget first. Do not use LoCoMo (CC BY-NC, a 6.4 % wrong key, a lenient
    judge). Report the number with the caveat that LongMemEval measures single-user memory, not D50's attribution.

## Sources

Repository documents: `EPISODIC_MEMORY_TODO.md` (D48–D50), `AGENT_MEMORY_AUDIT.md`, `WORK_PLAN.md` (M8, evaluation
budget), `ENGINE_IDEAS.md`, `literature/agent-platform-memory.md`, `literature/human-memory-and-agent-architectures.md`,
`literature/collaborative-memory.md`, `literature/penfield-locomo-audit.md`, `literature/longmemeval.md`,
`spikes/memory-eval/RESULTS.md`, `spikes/memory-eval/systems/mem0_sys.py`.

Web (read 2026-10-09):
- Mem0: [repo](https://github.com/mem0ai/mem0), [platform changelog](https://docs.mem0.ai/changelog/platform.md), [research](https://mem0.ai/research-5)
- Zep / Graphiti: [Graphiti repo](https://github.com/getzep/graphiti), [Zep concepts](https://help.getzep.com/concepts), [OSS direction](https://blog.getzep.com/announcing-a-new-direction-for-zeps-open-source-strategy/)
- Letta: [our next phase](https://www.letta.com/blog/our-next-phase), [Letta Code](https://www.letta.com/blog/letta-code), [Letta Code app](https://www.letta.com/blog/introducing-the-letta-code-app/)
- Supermemory: [repo](https://github.com/supermemoryai/supermemory), [LongMemEval report](https://supermemory.ai/research/longmembench)
- Honcho: [repo](https://github.com/plastic-labs/honcho)
- Memobase: [repo](https://github.com/memodb-io/memobase), [secondary status](https://gittrend.io/repo/memodb-io/memobase)
- Cognee: [1.0 announcement](https://www.cognee.ai/cognee-1-0-announcement)
- LangMem: [repo](https://github.com/langchain-ai/langmem), [secondary status](https://rywalker.com/research/langmem)
- MemOS: [repo](https://github.com/MemTensor/MemOS); MemoryOS: [repo](https://github.com/BAI-LAB/MemoryOS)
- Hindsight: [repo](https://github.com/vectorize-io/hindsight), [BEAM post](https://hindsight.vectorize.io/blog/2026/04/02/beam-sota)
- ChatGPT: [PCWorld on Dreaming](https://www.pcworld.com/article/3158111/chatgpt-new-dreaming-feature-makes-it-way-better-at-remembering-you.html), [iClarified](https://www.iclarified.com/96981/chatgpt-can-now-reference-all-your-past-chats)
- Claude: [Claude Code memory](https://code.claude.com/docs/en/memory), [Managed Agents memory](https://platform.claude.com/docs/en/managed-agents/memory), [9to5Mac on free memory and import](https://9to5mac.com/2026/03/02/free-claude-users-can-now-use-memory-and-import-context-from-rivals/)
- Gemini: [Android Authority on Personal Intelligence](https://www.androidauthority.com/google-gemini-personal-intelligence-rollout-3632287), [9to5Google on past chats](https://9to5google.com/2026/02/26/gemini-past-chats-free/), [Google blog on import](https://blog.google/intl/en-mena/product-updates/explore-get-answers/ai-memories-chat-history-to-gemini/), [agentmarketcap on Memory Bank](https://agentmarketcap.ai/blog/2026/07/28/gemini-agent-memory-managed-infrastructure)
- OpenClaw: [release 2026.4.12](https://newreleases.io/project/npm/openclaw/release/2026.4.12), [memory-core](https://docs.openclaw.ai/es/plugins/reference/memory-core.md)
- Hermes: [memory providers](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory-providers)
- Benchmarks: [LongMemEval repo](https://github.com/xiaowu0162/LongMemEval); LoCoMo audit as in `literature/penfield-locomo-audit.md`
