# Agent-platform memory — how the platforms do it, and what Recordare should borrow (survey, 2026-10-07)

Read: source code from shallow clones made on 2026-10-07: Hermes Agent `a50406d9`, OpenClaw `8f436000`, Honcho
`ae4a157`, letta-code `4b028fa`, Mem0 `0516f19`, LangMem `48e3c11`. Files read are named in each section. Official
docs: Hermes (memory and memory-providers pages), OpenClaw (`docs/concepts/memory*.md`, `dreaming.md`, in-repo),
Claude Code (`code.claude.com/docs/en/memory`). These were read through a fetch tool that returns extracted
passages: Zep, Supermemory and Cognee docs. ChatGPT's help centre returned 403, so its section relies on secondary
sources (press coverage of the October 2025 update) and should be re-checked before anyone quotes it. Builds on
`../ENGINE_IDEAS.md` (Memobase, Graphiti, OpenHuman, Open Dots) and the cards `mem0-production-memory.md` and
`zep-temporal-kg.md`. Recordare's spike already benchmarked Mem0, Cognee, Graphiti and Memobase (`RESULTS.md`), so
this survey is about **design ideas**, not new scores.

Licences decide what we may copy (`../LICENSING.md`). MIT: Hermes, OpenClaw, LangMem. Apache-2.0: Letta, Mem0, Graphiti,
Cognee. **AGPL-3.0: Honcho**, which is the same family as ours, so its prompt text may be reused with notices.
Proprietary: Claude Code, ChatGPT, Zep Cloud, Supermemory's service. From these we take ideas only.

## 1. The systems

**Hermes Agent (Nous Research, MIT)** —
[memory](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory),
[providers](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory-providers),
[repo](https://github.com/NousResearch/hermes-agent). Built-in memory is two small files the agent writes itself:
`MEMORY.md` (the agent's notes about its environment, 2,200 chars) and `USER.md` (who the user is, 1,375 chars). They
are injected into the system prompt as a **frozen snapshot** at session start ("never changes mid-session", so the
prefix cache survives). Writes become visible only in the next session. The agent has one `memory` tool
(`tools/memory_tool.py`) with add / replace / remove, applied as an atomic batch checked against the character
limit. A full store returns an error that makes the agent consolidate in the same call. The tool description says
to save only "facts that apply to EVERY session regardless of task" and to SKIP "task progress, completed-work logs,
temporary TODO state". Procedures go to **skills**, not memory. Every 10 turns (`nudge_interval`) a **background
review fork** (`agent/background_review.py`) replays the conversation on a cheaper auxiliary model that reuses the
same prefix cache, and asks "should any skill/memory be saved". Its prompt routes each fact to exactly one store
("One fact goes to ONE store, never both"). Writes are scanned for injection and exfiltration patterns. Optional
`write_approval` stages them for human review. `session_search` gives full-text search over past sessions.
External providers implement `MemoryProvider` (`agent/memory_provider.py`) with these hooks:
- `system_prompt_block` (static);
- `prefetch` / `queue_prefetch`: recall for the next turn is computed in the background after the current one;
- `sync_turn`: after each turn, with `turn_author`;
- `on_session_end`, `on_pre_compress` (rescue facts before compaction), `on_memory_write` (mirror built-in writes),
  `on_delegation`.
Recall is skipped for trivial prompts (`is_trivial_prompt`: greetings, slash commands). Recalled text is wrapped in a
`<memory-context>` fence with a "NOT new user input" note, and `sanitize_context` strips fences and notes so recalled
text does not come back as new input. Everything handed to a provider goes through a secret scrub first
(`_redact_for_provider`). Providers receive `agent_context` (`primary | cron | subagent`) and should "skip automatic
writes for the non-primary values". The bundled `holographic` provider keeps a SQLite fact store with a **trust score**
that the agent trains through a `fact_feedback` tool (helpful / unhelpful).

**OpenClaw (MIT)** — [repo](https://github.com/openclaw/openclaw), `docs/concepts/memory-architecture.md`,
`dreaming.md`, `extensions/memory-core/`. This is the most elaborate design surveyed, and the closest to ours in spirit
("Writing is the hard part", "Deterministic gates, model judgment inside them", "The write path is the security
boundary"). Memory lives in tiers:
- **instructions**: `AGENTS.md`, written by humans only;
- **curated core**: `MEMORY.md` + `USER.md`, budgeted and injected at session start;
- **episodic**: dated daily notes `memory/YYYY-MM-DD.md` + session transcripts, reached through search only;
- **prospective**: standing intents + cron;
- **review**: `DREAMS.md`, which humans read and is never injected.

**Provenance** is kept in SQLite columns that prose cannot forge. Origin class is `owner | agent | untrusted | system`,
and "it is never defaulted to `owner`". Each entry also records the session kind, an observed timestamp and a
supersession key. Hygiene rules built on top of that:
- cron, heartbeat and sub-agent sessions never produce durable candidates;
- **recall-loop prevention**: injected memory is "structurally marked and never re-extracted";
- **turn taint**: once a tool returns network-sourced content, the rest of that turn's assistant output is
  `untrusted` (the taint clears on the next user message).

**Dreaming** is the only writer of the curated core. It runs as a nightly cron in three phases: light (stage),
REM (themes) and deep (promote). Deep ranks candidates by relevance 0.30, recall frequency 0.24, query diversity 0.15,
recency 0.15, multi-day recurrence 0.10 and conceptual richness 0.06. Untrusted and system candidates are removed
before any prompt is built. A tool-free call then returns **operations, not prose** (`added | merged | superseded`
with the exact prior entries, `dreaming-consolidation.ts`). Code validates them: sources preserved, budget respected,
bounded loss of prior entries, optimistic concurrency on a content hash. The file's previous version (pre-image) is
saved, and invalid output falls back to append-only. Recall runs in two lanes:
- Lane 1 needs zero LLM calls. It injects the curated files and ranks hybrid search by a 30-day recency half-life ×
  write-time importance. Writers attach **trigger phrases** to curated entries; the incoming message is matched against
  them (score ≥ 0.65, at most 3 per turn).
- Lane 2 is a blocking recall sub-agent ("active memory"). It runs only when the message shows recall intent *and*
  lane 1 found nothing strong.

`USER.md` holds imperative **directives** ("Always / Never / Prefer") with an observed date and a status (active or
superseded), updated in place. The reason given is PrefEval: models stop applying a preference that merely sits in
context. **Standing intents** are compiled out of the model: "remind me Friday" becomes a cron job. Event-conditioned
intents are SQLite rows with keywords, embedding, scope, expiry, a fire budget (3) and a cooldown (24 h), matched by a
deterministic prefilter. A pre-compaction **memory flush** turn saves unwritten context to the daily note.
`memory forget` removes entries derived from chosen sessions and keeps those sessions out of future ingestion.
Plugins: `memory-lancedb` (auto-recall / auto-capture over LanceDB), `memory-wiki` (claims with evidence,
contradiction and freshness reports), and a Honcho plugin.

**Claude Code (Anthropic, proprietary)** — [docs](https://code.claude.com/docs/en/memory). It has two layers.
`CLAUDE.md` holds human-written instructions (user / project / org scope), delivered as a user message after the
system prompt. **Auto memory** is written by the model into `~/.claude/projects/<repo>/memory/`. That folder holds a
`MEMORY.md` index (one line per memory; the first 200 lines or 25 KB are loaded every session) plus one topic file per
memory with a `type` of `user | feedback | project | reference`. Topic files are read on demand. The harness stamps a
`modified` timestamp on each write and warns when the index nears its limit. Claude "skips anything it can derive from
the codebase" and anything `CLAUDE.md` already says. There is no background consolidation; the user edits through
`/memory`.

**ChatGPT (OpenAI, proprietary)** — the [Memory FAQ](https://help.openai.com/en/articles/8590148-memory-faq) was
not readable (403); this section uses secondary sources such as
[TechRadar](https://www.techradar.com/ai-platforms-assistants/chatgpt/chatgpt-is-smarter-now-that-its-learned-to-forget-a-huge-memory-upgrade-is-coming)
and needs re-checking. ChatGPT has **saved memories** (discrete facts, explicit or model-initiated, listed and
deletable) and **chat-history reference** (themes from past chats, not itemised). Since the October 2025 update,
**automatic memory management** keeps memories "top of mind" by recency and frequency of mention and moves the rest
"to the background" instead of deleting them. Users can see and override priorities. Temporary chats neither read nor
write memory.

**Letta / MemGPT (Apache-2.0)** — [letta-code](https://github.com/letta-ai/letta-code) (the old server repo is
archived), MemGPT ([arXiv:2310.08560](https://arxiv.org/abs/2310.08560)), sleep-time compute
([arXiv:2504.13171](https://arxiv.org/abs/2504.13171)). The classic design has three parts: **core memory** blocks
(persona / human, character-limited, always in context, edited by the agent with tools), **archival memory** (a vector
store reached through tools) and **recall memory** (conversation search). Sleep-time agents edit the shared blocks
asynchronously. letta-code now keeps memory as a **git-backed Markdown filesystem**: root files are core (always in
context), child directories are deferred (read on demand by description), and `ARCHIVE.md` holds retired context. A
**reflection subagent** (`src/agent/subagents/builtin/reflection-v2.md`) is triggered by `step-count` or by a
`compaction-event`. It reads one or several transcripts and orders candidate learnings as "mistakes and corrections"
first, then preferences, new facts, contradictions and reusable procedures. It applies filters (lasting or ephemeral,
already captured, generalisable, "convert any relative dates") and **commits** the change to git with the child and
parent agent ids. "If new information contradicts existing memory, fix the stale entry at the source."

**Mem0 (Apache-2.0)** — [repo](https://github.com/mem0ai/mem0), `mem0/configs/prompts.py`,
`docs/migration/platform-v2-to-v3.mdx`. The v3 algorithm **dropped ADD / UPDATE / DELETE / NOOP**. Extraction is now one
**ADD-only** pass (`ADDITIVE_EXTRACTION_PROMPT`): "nothing is overwritten or deleted". Each new memory links to related
existing ones through `linked_memory_ids` (same entity, updated preference, continuation, contradiction). Currency is
handled at retrieval by multi-signal ranking (semantic + BM25 + an entity boost from a built-in entity graph; no
external graph store). Prompt ideas worth noting:
- extract **incidental facts inside requests** ("Do NOT let the request overshadow the facts");
- capture **transitions** (the new state *and* what it replaces; flag trials or temporary changes);
- the observation date is the only temporal anchor;
- extract from assistant turns only what is new (recommendations, plans, agreements), never echoes;
- "When in doubt, extract".
This is the same direction we took in D28 / D29 (append-only + value chains), reached independently.

**Zep / Graphiti (Graphiti Apache-2.0; Zep Cloud proprietary)** — [concepts](https://help.getzep.com/concepts); see
`zep-temporal-kg.md`. It is a bi-temporal knowledge graph: episodes provide provenance, facts are edges with
`valid_at / invalid_at`, and custom entity and edge types act as an ontology. The cloud product adds a per-thread
**context block** and a **user summary** steered by up to five owner-written instructions. Nothing new beyond the card
and `ENGINE_IDEAS.md`.

**Honcho (Plastic Labs, AGPL-3.0)** — [repo](https://github.com/plastic-labs/honcho). It models peers: each
*observer* holds its own representation of each *observed* peer, which is literal theory of mind ("Alice's view of
Bob"). The pieces:
- **Deriver** (`src/deriver/prompts.py`): extracts atomic explicit facts per message batch. Messages are tagged
  `peer=…, target=true|false`. Facts about the target come only from the target's messages ("never derive a fact about
  the target peer from what another peer said"). One rule: "When the target peer answers a question or accepts a
  proposal … the details … count as stated by the target peer. A bare acknowledgement ('ok', 'thanks') does not."
- **Peer card**: a compact identity store of at most 40 entries with the prefixes `IDENTITY / ATTRIBUTE / RELATIONSHIP /
  INSTRUCTION`. Stability rule: "If the value plausibly changes within six months … it does not belong on the card".
  INSTRUCTION entries are written "only when explicit; never inferred". Others' statements about the target count only
  "with the target observee's assent".
- **Dreamer** (`src/dreamer/`): runs per peer pair when due. An optional **surprisal** prefilter picks unusual
  observations. A *deduction* specialist handles knowledge updates, implications and contradictions; an *induction*
  specialist finds patterns from at least 2 sources, with confidence set by evidence count (2 = low, 3–4 = medium,
  5+ = high). Every conclusion must cite `source_ids` and invented ids are discarded. The deduction specialist also
  deletes outdated observations.
- **Dialectic** (`src/dialectic/`): an agentic Q&A endpoint over the memory, with tools such as `search_memory`,
  `get_reasoning_chain`, `search_messages_temporal` and `get_messages_by_date_range`.

**Supermemory (hosted, proprietary)** —
[graph memory](https://supermemory.ai/docs/concepts/graph-memory). It separates documents (sources of truth) from
memories (extracted facts). Relations are **updates** (`isLatest` flips, history kept for audit), **extends** (adds
detail, both remain valid) and **derives** (inferred from patterns). Forgetting has three forms: time-based (temporary
facts expire), contradiction, and noise filtering. Profiles are split into static and dynamic parts.

**Cognee (Apache-2.0)** — [memify](https://docs.cognee.ai/core-concepts/main-operations/memify). `cognify`
(classify → chunk → extract → summarise → store) builds a graph. `memify` enriches an existing graph without
re-reading sources (entity consolidation, cross-connections, triplet embeddings). We measured it already: it is the
closest to plain RAG (`RESULTS.md` 4b.5).

**LangMem (LangChain, MIT)** — [repo](https://github.com/langchain-ai/langmem). Memory is typed as semantic (facts,
profile), episodic ("successful interactions as learning examples") and procedural (system-prompt optimisation from
feedback: `create_prompt_optimizer`). The memory manager prompt (`knowledge/extraction.py`) asks for confidence
("p(x)"), and to retain "surprising (pattern deviation) and persistent (frequently reinforced)" information.
`ReflectionExecutor(after_seconds=…)` **debounces** background extraction: a new message reschedules the run, which is
our idle trigger (D1).

## 2. Comparison with Recordare

| | Recordare (now) | Hermes | OpenClaw | Claude Code | ChatGPT | Letta | Mem0 v3 | Honcho |
|---|---|---|---|---|---|---|---|---|
| **Memory kinds** | Raw log, episodes (event / plan / state change), plans with lifecycle, state facts (value chain), notes, day / month digests | 2 small curated files; skills; session search | Curated core, directive user model, daily notes, transcripts, standing intents, wiki claims | Instruction files + typed topic notes | Saved facts, chat-history reference, profile | Core blocks, archival, recall; skills | Flat fact strings + entity graph | Explicit / deductive / inductive observations, peer card, per observer–observed pair |
| **Write trigger** | Idle window + nightly (digests, facts review) | Agent tool any time + review fork every 10 turns + provider sync per turn | Agent notes, pre-compaction flush, session end; nightly dreaming promotes | Model during session | Model during chat; background management | Agent tools; reflection on step count / compaction | Per `add` call | Per message batch; dreams when due |
| **Write decider** | Background extractor (1 call), code applies verdicts; agent tools for explicit writes | Agent + background fork (LLM) | Agent for episodic; **code gates + LLM ops** for core | Model | Model | Agent / reflection subagent | LLM (add-only) | Deriver LLM; dream agents |
| **Time model** | Event time + precision + original expression; record time; bi-temporal facts; as-of queries | Session time only | Observed timestamp + supersession key; dated daily files | `modified` stamp | Recency of mention | Commit history | Observation date in text; `created_at` | Message time; "knowledge updates" deductions |
| **Provenance** | Evidence message ids validated in code; origin `owner_lived / owner_told / assistant_stated`; author role; claims kept apart; audience set (D29) | Store target; profile scope | **Origin class column (owner / agent / untrusted / system), session kind, turn taint** | None | None visible | Git author per reflection | Actor / role metadata | Peer and target flags; `source_ids` on deductions |
| **Corrections** | `corrects` vs `supersedes`, never rewrite; plan patches need evidence; recall-echo guard | Replace by substring (destructive) | Supersede by lineage; pre-image kept; append fallback | Edit file | Model updates / user deletes | Edit at source + git history | ADD only; ranking prefers new | Deduction deletes outdated |
| **Recall / injection** | MCP tools (`search_episodes` modes, `search_facts` as-of, `search_memory`); claims / chat excerpts / people legs; no LLM at read | Frozen snapshot + per-turn provider prefetch (background) | Lane 1 zero-LLM (curated + triggers + ranked search); lane 2 escalation sub-agent | Index always + on-demand files | Always-on profile + history reference | Core always; tools for the rest | Search API; host injects | Dialectic Q&A (LLM), peer card, context |
| **Consolidation** | Nightly digests (fingerprinted), nightly facts review (1 call / owner with news) | Review fork; size cap forces merges | Dreaming light / REM / deep with deterministic gates | None | Priority management | Reflection subagent | None (retrieval-time) | Deduction + induction dreams |
| **Privacy** | Consent rules, disclosure tiers, audience sets, forget with tombstones, raw-log scope per client | Injection scan, secret scrub, approval option | Taint quarantine, admission policy, forget by session, redaction before ingestion | Local files | Temporary chat, delete | Local / cloud | Delete API, expiry | Per-pair scoping |

Overall, no platform has event time, plan lifecycle or owner-vs-others provenance at our level. OpenClaw is the
only one with structural provenance, and its rules (never default to owner, quarantine untrusted, keep recall
loops out) match what our poisoning and echo work found empirically. Platforms invest where we have not yet:
**injection** (prefetch, budgets, triggers, prefix caching) and **use-driven curation** (recall frequency,
feedback, priority).

## 3. Ideas worth adopting (ranked)

### 1. Fenced, structurally marked recall in the connector contract (recall-loop prevention by construction)
- **What**: everything Recordare injects into a host prompt (prefetch block, tool results) carries a machine marker,
  and ingest removes or marks those spans before extraction. Session kind (`primary | cron | subagent | heartbeat`)
  travels with each turn, and non-interactive sessions never produce owner memories.
- **From**: Hermes `build_memory_context_block` / `sanitize_context` and `agent_context`
  (`agent/memory_manager.py`, `agent/memory_provider.py`); OpenClaw "recall-loop prevention" and "session-kind
  gating" (`memory-architecture.md`).
- **Why us**: the recall-echo guard (`RESULTS.md`, "Recall echoes") works when a Recordare *tool* is in the turn. The
  6.6 connectors will mostly inject memory *before* the turn (prefetch), where the echo signal is weaker: the reply
  repeats injected text and no tool call shows it. A Claude Code subagent or a Hermes cron run would also feed
  "assistant said" content about the owner.
- **Fit**: ingest contract (`API.md` §2: optional `injected_spans` or a fence convention, `session_kind`); the echo
  guard treats a fenced span exactly like a recall served; extraction ignores turns whose `session_kind` is not
  interactive (or keeps them as `assistant_stated` without facts).
- **Cost**: 0 LLM calls.
- **Measure**: the echo dev set re-run with a prefetch-injection variant (the same 9 cases, recall served by
  injection instead of tool); target is the same 100 %. Plus a regression run on blind5 (no change expected by
  construction).

### 2. Two-lane recall for connectors: a zero-LLM prefetch brief, with escalation to the tools
- **What**: a `prefetch(query, conversation)` endpoint that returns a compact, budgeted block. It holds (a) a stable
  **brief** (owner card + current facts + open plans of the next days), injected once per session in the system part
  so prefix caching keeps it, and (b) at most 3 per-turn items whose stored `context` field matches the message
  strongly. It is skipped for trivial prompts. Deep recall stays in the MCP tools, and the brief tells the agent when
  to call them (past, period and "when did I…" questions).
- **From**: OpenClaw lane 1 / lane 2 and trigger injection (score ≥ 0.65, ≤ 3 per turn); Hermes frozen snapshot,
  `queue_prefetch` (recall for turn n+1 computed after turn n) and `is_trivial_prompt`; Claude Code index-plus-on-demand.
- **Why us**: the H11 work showed that answers depend on what recall hands over (blind4: extraction 0.96–0.99 recall,
  answers 80.8 %). Hermes and OpenClaw clients will mostly *not* call tools unprompted, so the prefetch path decides
  quality. Our extractor already writes a `context` sentence ("when this memory is useful to recall") per episode and
  note. Today it is only embedded with the content, while OpenClaw uses the same idea as an injection trigger.
  `ENGINE_IDEAS.md` already lists "a ready-to-inject context brief" (OpenHuman); this gives it a concrete shape.
- **Fit**: read API + connectors (6.6); deterministic ranking, viewer context applied first (D29), claims never in the
  brief.
- **Cost**: 0 LLM calls at read (rule D12 kept); the brief is built from data that already exists.
- **Measure**: a harness planner variant "prefetch only, no tool calls" against the current tool planner on blind5,
  3 runs, plus injected tokens per question. A blind set where the agent must *not* need memory (trivial turns)
  checks that injection does not distract.

### 3. Extraction prompt: incidental facts inside requests, and transitions
- **What**: two rules. (a) A help request is not an episode, but the personal facts it carries as context are ("my
  knee hurts again, which exercises…", "since I moved in with Luca…"): record them as facts or notes with evidence.
  (b) When the owner switches, stops or replaces something, the fact verdict is `replace` with the old value as target,
  and a trial or temporary change is said as such.
- **From**: Mem0 `ADDITIVE_EXTRACTION_PROMPT` ("Extract Incidental Facts, Not Just Requests", transitions paragraph),
  Apache-2.0, so wording is reusable with attribution. Honcho's rule that answering or accepting a proposal counts as
  stating its details (AGPL-3.0, reusable with notice) completes (a) for assistant proposals.
- **Why us**: facts are the weakest stage (current 0.62–0.77, history 0.38–0.54 on blind5). The misses named in
  `RESULTS.md` are exactly these: salary, knee, "lives with", a relative's city. Implicit changes sit at 0.67 for every
  system. Our prompt says "Help requests … are NOT episodes", and the model may read that as "ignore the message".
- **Fit**: `extraction.prompt.ts` (extract.v7 candidate), no schema change.
- **Cost**: 0 extra calls, a few hundred prompt tokens (cached).
- **Measure**: `extraction_eval.py` facts and notes scores + blind5 3 runs (paired). Keep only if facts improve with no
  answer regression. extract.v5 shows that "more stored" can hurt, so check the unsupported rate too.

### 4. Turn taint from network tools
- **What**: when a turn contains a tool result from the network (web search, fetch, browser), the assistant text after
  it in that turn is marked as tool-derived. Items extracted from it can be `assistant_stated` episodes ("the assistant
  found the bus times") but never owner facts or notes, and they are not "the owner said".
- **From**: OpenClaw "Content origin also propagates within a turn" (`memory-architecture.md`).
- **Why us**: guard v2 already counts non-memory tool output as a source for the echo case. Poisoning is the category
  every system fails (blind5 0.17–0.33 before the claims split), and agentic clients (Hermes, Claude Code) are
  tool-heavy, so a web page that says "the user is allergic to…" is a realistic channel.
- **Fit**: ingest (tool messages already have `authorRole tool`); one rule in the writer: an item whose only evidence
  is assistant text after a tool result gets origin `assistant_stated` and no fact or note verdicts.
- **Cost**: 0 LLM calls.
- **Measure**: a small dev poisoning-via-tool set (not blind) plus a fresh blind poisoning set already planned in
  `RESULTS.md`; blind5 regression.

### 5. A nightly "pattern" pass for notes: induction with evidence counts
- **What**: once per owner per night with new episodes (the same gate as the facts review), propose **inferred notes**
  (habits, recurring people, paused activities, preferences shown by behaviour) only when supported by ≥ 2 episodes.
  Each note carries the episode ids, `stance: inferred` and confidence from the evidence count (2 = low, 3–4 = medium,
  5+ = high). New inferred notes stay `pending` until the owner confirms, as `ENGINE_IDEAS` rejection 6 already
  requires.
- **From**: Honcho `InductionSpecialist` (`src/dreamer/specialists.py`, AGPL-3.0); Graphiti "never manufacture pattern
  language from a single occurrence" (already adopted for digests); LangMem "persistent (frequently reinforced)".
- **Why us**: notes score 0.64–0.79, and the named misses are cross-session by nature ("work colleagues, a paused
  habit"): a single window cannot see them, but a nightly view of 30 days can. The facts review is the same pattern
  for facts (one call per owner per night, verdicts applied by code). It also feeds H9 (companion: "three months ago
  you said…") and H12 (resting-state thinking).
- **Fit**: M5 consolidation, next to `facts-review.service.ts`; output = note verdicts with episode evidence
  validated in code (invented ids discarded, as Honcho does).
- **Cost**: ≤ 1 call per owner-night with news; behind a quality-profile knob (D35), off until measured.
- **Measure**: notes score (`extraction_eval.py`) and the share of inferred notes judged unsupported; blind5
  answers on preference / habit questions.

### 6. Owner card with a stability rule and explicit instructions
- **What**: a derived, bounded **owner card** (≤ 40 lines) built from current facts and stated notes. It uses typed
  prefixes (identity, attribute, relationship, instruction to the assistant), takes only values stable for about six
  months, and writes instructions only when the owner said them explicitly. Preferences are written as directives
  ("Prefers…", "Never…") with their observed date. The card is the core of the prefetch brief (idea 2).
- **From**: Honcho `PEER_CARD_SYSTEM_SECTION` (AGPL-3.0); OpenClaw `USER.md` directive contract (citing PrefEval);
  Supermemory static and dynamic profile.
- **Why us**: today a client gets the owner only by querying; there is no compact "who is this person". Directive
  form addresses preference adherence, which our eval does not yet measure. The six-month rule keeps volatile
  states (mood, current trip) out of the always-on part.
- **Fit**: derived artefact (D29: source ids, audience = intersection), rebuilt nightly only when its inputs
  changed (fingerprint, as the digests do), so no LLM call when nothing changed. Deterministic rendering first; an LLM
  rewrite only if measured better.
- **Cost**: 0 calls (deterministic) or ≤ 1 per owner-night with changes.
- **Measure**: a small preference-adherence probe set (the agent must apply a stated preference without being asked)
  and the brief's token size.

### 7. Use signals for ranking and for the brief, never for truth
- **What**: use `recall_log` (already in the data model) as a signal: items served often and for varied queries rank
  higher in the brief and in `latest` / `search` ties. Items untouched for months stay stored but leave the brief
  ("background", as ChatGPT does it). Optionally, host feedback ("this memory was wrong / useful") through a tool.
- **From**: OpenClaw deep ranking (frequency 0.24, query diversity 0.15); ChatGPT automatic memory management
  (recency + frequency, user override); Hermes holographic `fact_feedback` trust score.
- **Why us**: the brief needs a selection rule other than "most important", and digests showed that more context is
  not better (diary in recall: −1.9 pt, within noise).
- **Fit**: ranking only; it never changes status, supersession or confidence (a recalled-often wrong fact must not
  become truer).
- **Cost**: 0 LLM calls.
- **Measure**: needs longitudinal traffic. Simulate it with the eval's question stream, or defer until Arkimede usage
  exists (open question).

### 8. Requests to the assistant as standing intents (prospective memory)
- **What**: some messages are instructions for later, not memories: "next time we talk about the house remind me of
  the notary", "when Marco writes, tell him…", "remember to ask me about the exam". Store them as **intents** with
  trigger keywords, an optional embedding, scope (person, conversation), expiry, a fire budget and a cooldown. They are
  matched deterministically at prefetch and fire as a hidden note to the agent. Time-based ones go to the host's
  scheduler.
- **From**: OpenClaw standing intents (`docs/concepts/standing-intents.md`; TriggerBench arXiv:2606.23459 as cited
  there).
- **Why us**: the "messages addressed to the assistant" category (0.25 → 0.62) and the vision's initiative L1 both
  need an explicit list of requests made to the assistant. `RESULTS.md` already names "an explicit list of requests
  made to the assistant" as needed design work. Plans are for things the owner lives; intents are for things the
  assistant must do, which keeps the plan lifecycle clean.
- **Fit**: a new extraction output kind (or a `remember` / `intent` tool), a table with lifecycle in code
  (pending → armed → fired → done / cancelled / expired), prefetch (idea 2).
- **Cost**: 0 extra calls (same extraction call); matching without an LLM.
- **Measure**: blind6 assistant-addressed slice (no longer blind; use a fresh one) and an intent-firing dev set.

### 9. Owner review surface for what the night changed
- **What**: a short "what I learned / changed" digest per night (facts replaced, notes inferred, plans closed),
  with one-tap confirm or reject. Rejections become corrections.
- **From**: OpenClaw `DREAMS.md` and Dreams UI; Hermes `write_approval` and `/journey`; ChatGPT memory management UI.
- **Why us**: inferred notes (idea 5) and facts-review changes are exactly the items the consent rules want an owner
  to see. The diary API (D18) and the atlas (5b) already exist as surfaces.
- **Fit**: read API + Arkimede diary tab; data from `extraction_runs` / `run_outputs` (already the changelog).
- **Cost**: 0 LLM calls.
- **Measure**: product metric (confirm / reject rates), not the eval.

### 10. Pre-compaction and session-switch hooks in connectors
- **What**: the Hermes connector implements `on_pre_compress` and `on_session_switch` so that turns are ingested raw
  *before* the host compresses or truncates them. It may also return Recordare's episode list for that span, to
  improve the host's summary.
- **From**: Hermes `on_pre_compress`; OpenClaw memory flush; Letta `compaction-event` trigger.
- **Why us**: compaction is where host transcripts lose detail. If the connector syncs after compaction, our raw log
  (Layer 0, the provenance anchor) receives a summary instead of messages.
- **Fit**: connector code only (6.6); ingest is idempotent by message id.
- **Cost**: 0.
- **Measure**: connector integration test (a compacted long session must still yield its episodes).

## 4. Ideas we should not adopt

- **Agent-written bounded memory files as the store** (Hermes `MEMORY.md` / `USER.md`, Claude Code auto memory, Letta
  core blocks). Capacity errors force lossy rewrites, substring replace destroys history, and there is no event time
  or evidence. They are fine as a *client's* scratchpad; Recordare mirrors from them (Hermes `on_memory_write`) only
  as `assistant_stated` input, never as owner facts.
- **Deleting outdated observations** (Honcho deduction "DELETE the outdated observation immediately"; Letta "fix the
  stale entry at the source"). This conflicts with append-only + `corrects` / `supersedes` (D28, D29) and with
  "why does the twin believe X".
- **"When in doubt, extract"** (Mem0). We measured that more stored claims hurt (extract.v5 rejected twice:
  72.7 % vs 81.8 % on the slices). Our unsupported rate (4–13 %) is the metric that counts.
- **Logical implications as stored memories** (Honcho: "works at Google" → "employed in tech"). This is noise for
  recall, and invents facts the owner never stated. Inference stays at answer time.
- **LLM at read time on the default path** (Honcho dialectic, OpenClaw lane-2 sub-agent, LangMem query generation).
  It breaks D12 / "no LLM at recall" and adds latency. A *synthesised answer* stays an optional extra for simple
  clients (`ENGINE_IDEAS` OpenHuman item 3). An escalation lane lives in the host agent (it calls our tools), not in
  Recordare.
- **Exponential recency decay as the default rank** (OpenClaw 30-day half-life). It is wrong for a life memory ("when
  did I first…", legacy mode); we have explicit `latest` / period modes. Acceptable only inside the brief selection
  (idea 7).
- **Recall frequency as promotion to truth** (OpenClaw deep gate). Usage measures usefulness, not correctness; for a
  twin a frequently recalled wrong fact must stay wrong. Use it for ranking only (idea 7).
- **Skills / procedural memory and prompt optimisation** (Hermes skills, Letta skills, LangMem optimizer). This is
  the host agent's job, not the person's memory. The twin's "Mind" pillar (decision patterns) comes later and from
  owner data, not from agent trajectories.
- **Mem0 v3's "currency only at retrieval"**. Our value chains with explicit status are measured better for
  "state now" and corrections (blind4 / 5 categories); ranking alone left old values visible (blind3 noise
  corrections before extract.v4).
- **Separate per-observer representations everywhere** (Honcho). The model is right for the twin's disclosure (H2:
  "what Marco knows about the owner") but premature now; our audience sets (D29) already record who was present.
  Revisit in phase 3.
- **Content scanning as the main poisoning defence** (Hermes injection scan). It helps as a cheap filter, but OpenClaw's
  own reasoning (and ours: the claims split, not detection, fixed poisoning) favours provenance. Possible as an extra
  cheap gate on `remember` / `log_episode`.

## 5. Open questions

1. **Prefetch vs tools**: with connectors injecting a brief, do answer models still call `search_episodes` when they
   need to? OpenClaw escalates in the host; our harness always lets the planner call tools. We need a planner variant
   that mimics a lazy host (idea 2).
2. **Brief budget and churn**: how many tokens can the brief take before it distracts (diary in recall: no gain)?
   And how often may it change without breaking the hosts' prefix caches (Hermes freezes it per session)?
3. **Fence convention**: XML-like fence (Hermes), metadata spans in the ingest payload, or both? Hosts that persist
   the injected system prompt into their own transcript (OpenClaw does not, Hermes strips it) decide this.
4. **Intents vs plans**: one table with a `kind`, or a separate store? The lifecycle code differs (fire budget,
   cooldown) but the evidence and patch rules are the same.
5. **Owner card vs notes**: is the card a view over facts and notes (deterministic) or its own curated artefact with
   a nightly LLM pass? Measure the deterministic view first.
6. **Use signals without traffic**: idea 7 needs real recall logs. Is the Arkimede dogfooding period enough, or do we
   simulate recall traffic in the eval?
7. **Re-check secondary sources** before quoting externally: ChatGPT (403 on the help centre), Supermemory and Zep
   (fetch summaries only).
