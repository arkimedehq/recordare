# Episodic memory — design TODO

Status: **design / discussion**. Nothing implemented yet. Engine evaluation done
(`spikes/memory-eval/RESULTS.md`, round 2 + held-out): a prototype of this design (D) beat
Memobase, Graphiti and the raw baseline; D23 (approved) builds it.

This is **phase 1** of the digital twin vision (`DIGITAL_TWIN_VISION.md`): episodic
memory is the foundation the twin's memory, self-model and initiative build on.

## Problem

The current Arkimede memory (A-MEM, see Arkimede `docs/MEMORY.md`) is **semantic**: durable facts about the
user (preferences, profile, constraints, knowledge), retrieved top-K and injected into
the prompt. Extraction deliberately discards one-off events.

We want an **episodic** memory: "what happened and when", e.g. *"today I went skiing
in the mountains"*. Such a record is irrelevant to almost every turn, but must be
recallable on demand, possibly once, months later:

- "when was the last time I went skiing?"
- "what did I do last week?"
- "how many times did I go to the mountains this winter?"

Guiding rule: **store everything, inject nothing automatically, retrieve on request.**

## Cognitive model (reference)

The design follows how human memory works: the brain is always listening but does
**not** store everything — it is a cascade of filters.

| Human memory | Role | Arkimede counterpart |
|---|---|---|
| Sensory memory (~250 ms visual, ~3 s auditory) | Raw buffer, almost everything lost | **Raw message log** — here we beat the brain: everything is kept verbatim, forever |
| Attention / working memory (~4 items) | Gate: only attended items get encoded | Chat context window |
| Hippocampal encoding | Fast, fragile binding of *what / where / when / who* | **Episode extraction** (on chat idle) |
| Amygdala tagging, novelty, self-relevance | Decides what gets consolidated more strongly | **Importance score** assigned at encoding |
| Sleep consolidation (replay → neocortex) | Extracts gist, links to existing knowledge, episodes become semantic knowledge ("semanticization") | **Nightly consolidation job**: daily digests, links, promotion of recurring patterns to semantic notes |
| Retrieval strengthens memory (spacing effect) | Recalled memories last longer | `accessCount` / `lastAccessedAt` boost ranking |
| Forgetting (detail first, then event; gist survives) | Active and useful: avoids drowning in detail, enables generalization | **No deletion**: older periods are served by digests, detail demoted in ranking; raw log stays as ground truth |
| Reconsolidation (memories rewritten on recall → false memories) | Human flaw | **Deliberately NOT copied**: no rewriting, every episode keeps provenance (consistent with A-MEM conservative evolution) |

## Prior art

The layered design is in line with the state of the art; nothing below changes the
direction, but several items bring concrete refinements (see next subsection).

| Work | What it does | Relevance for us |
|---|---|---|
| **Zep / Graphiti** (open source, [arXiv 2501.13956](https://arxiv.org/abs/2501.13956)) | Every input enters as a non-lossy **episode**; entities/relations extracted into a temporal knowledge graph. **Bi-temporal** model (event time vs ingestion time); facts carry `valid_from` / `valid_to` / `invalid_at` — superseded facts are invalidated, not deleted. | Closest system. Raw episode layer = our Layer 0. Bi-temporal + validity adopted. Graph DB (Neo4j/FalkorDB) + Python service not adopted. |
| **MemoryBank** (AAAI 2024, [arXiv 2305.10250](https://arxiv.org/abs/2305.10250)) | Hierarchy: **daily event summaries** → global summaries → user personality profile. **Ebbinghaus forgetting curve**: strength decays with time, reinforced on retrieval, pruned below threshold. | Validates digests (Layer 2) and access boost. We use strength for ranking only, never pruning. |
| **Letta (ex MemGPT) — sleep-time compute** ([blog](https://www.letta.com/blog/sleep-time-compute/)) | Second "sleep" agent works during downtime: re-reads conversations, reorganizes memory; claims up to 5× less test-time compute. | Validates nightly / idle consolidation. |
| **Active Dreaming Memory**, **HEMA** ([arXiv 2504.16754](https://arxiv.org/abs/2504.16754)) | Complementary Learning Systems theory: fast hippocampal store + slow neocortical store; offline "sleep" consolidates episodic traces into semantic rules, dedups redundant traces. | Validates episode → semantic promotion and dedup in consolidation. |
| **Pink et al., "Episodic Memory is the Missing Piece for Long-Term LLM Agents"** (2025, [arXiv 2502.06975](https://arxiv.org/abs/2502.06975)) | Five properties of episodic memory: long-term storage, explicit reasoning, single-shot learning, instance-specific, contextualized. | Checklist for the episode data model — our fields cover all five. |
| **LongMemEval** (ICLR 2025, [arXiv 2410.10813](https://arxiv.org/abs/2410.10813)) | Benchmark + ablations on memory pipelines. **Time-aware query expansion** (index by event date, LLM extracts time range from the question) → **+11.4% recall** on temporal questions. Best value granularity = **single round**, not session. **Fact-augmented keys**: search on short extracted facts pointing to the raw text. | Strongest empirical guidance: date filter, per-event granularity, episode-as-key with provenance to raw round. |
| **Generative Agents** (Park et al., Stanford 2023) | Memory stream ranked by **recency + importance + relevance**; periodic **reflection** synthesizes higher-level insights. | Ranking formula + reflection = consolidation. |
| **ES-Mem** ([arXiv 2601.07582](https://arxiv.org/abs/2601.07582)) | Event segmentation of long dialogues into coherent event units. | Possible approach for splitting a chat into episodes. |
| **Omi** (open source), **Limitless** (products) | Always-on wearable capture → transcripts, "memories", daily summaries. | Consumer version of "always listening"; Omi code worth a look for capture/summary UX. |
| **Mem0** | Fact-extraction memory layer. | Overlaps with existing A-MEM; not adopted. |

Caveat on benchmarks (LoCoMo, LongMemEval, BEAM): every vendor publishes numbers
where it wins (e.g. Mem0 self-reported ~94% vs ~49% in independent runs). Use them
as direction, not truth; evaluate on our own conversations.

### Refinements adopted from prior art
1. **Bi-temporal episodes** (Zep): `occurredAt` (event time) distinct from `createdAt`
   (ingestion time); `validUntil` / `invalidatedAt` for plans that are superseded or
   cancelled ("I'm going to Rome next week" → later cancelled).
2. **Time-range filter at query time** (LongMemEval): the agent fills `from` / `to`
   in the tool call, resolving relative expressions via `get_current_datetime`.
3. **Per-event / per-round granularity** (LongMemEval), not per chat; episode = short
   key, `messageId` = pointer to the raw round.
4. **Ebbinghaus-style strength for ranking only** (MemoryBank): decays with time,
   reinforced on recall; never deletes.

### Build vs reuse
Build on the existing stack (Postgres FTS, vector store, RRF, BullMQ, summarizer):
only tables and jobs are missing. Graphiti/Zep would add a graph DB + Python service
(heavy, also on small home deployments); Mem0 overlaps A-MEM. Take the ideas, not
the dependencies.

## What exists today (in Arkimede)

- Arkimede `search_conversations` (`backend/src/user-memory/user-memory.service.ts` → `searchConversations`): FTS over
  `messages.tsv` ('simple' config, OR-tokenized), scoped to accessible chats, returns
  `ts_headline` snippets. Already finds the raw message, with limits:
  - lexical only — "snow" does not match "skiing";
  - no time filter — "what did I do in February?" is unanswerable;
  - snippets of raw chat, noisy, not a clean event;
  - the record dies with the chat (deleting a chat deletes the memory);
  - voice chats (OpenAI-compat shim, origin `voice`) are stateless → never stored.
- Automatic extraction (`memoryExtractionPrompt`, summarizer model, threshold-based)
  already reads every new turn → a natural hook for extracting events at ~zero
  extra cost.

## Proposed direction: layered memory

```
Layer 0  raw log        messages (all, verbatim)              ← exists
Layer 1  episodes       one row per event, importance, date   ← encoding
Layer 2  digests        day → (week) → month summaries        ← consolidation
Layer 3  semantic notes durable facts (A-MEM user_memory)     ← exists; fed by promotion
```

### 1. Encoding (hippocampus)
- Trigger: on **chat idle** (not only the N-message threshold — a short chat with a
  single "today I went skiing" must not be lost), plus explicit capture.
- The summarizer extracts episodes **broadly** (first-person events, events of
  people close to the user, plans) — the importance score decides weight, not an
  a-priori exclusion.
- Each episode: `content`, `occurredAt` + `datePrecision` (day / month / approximate),
  `who` / `where` (optional), `importance` (1–10), `kind` (event / plan),
  provenance `chatId` / `messageId`.
- Relative dates ("today", "last Sunday") resolved against the **message timestamp**,
  not the extraction time.
- Importance heuristics: emotional charge, novelty vs routine, self-relevance;
  explicit "remember that…" → max importance.
- Separate LLM call and cursor from fact extraction (see D2).

### 2. Consolidation (sleep)
- Nightly BullMQ job per user with new episodes (zero LLM calls if nothing new).
- Replays the day's episodes and:
  - writes a **daily digest** (Layer 2); weekly/monthly digests roll up from daily;
  - links episodes to related semantic notes / earlier episodes;
  - detects **recurring patterns** ("skied 4 weekends this winter") and proposes them
    as semantic notes — always `pending`, never auto-confirmed (existing A-MEM rule);
  - dedups the same event mentioned in several chats (link, not rewrite).
- Max one pass, no cascades (same constraint as A-MEM evolution).

### 3. Retrieval (recall)
- Episodes and digests are **never auto-injected**: `retrieve()` and the pinned prefix
  are untouched. No prompt growth, no cache invalidation.
- Ranking = **relevance** (hybrid FTS + vector, existing RRF) **+ recency + importance**
  (+ access boost on the episode itself; boosting linked semantic notes is v2, D19).
- Query routing by question shape:
  - point lookup ("when did I go skiing?") → episodes;
  - period overview ("what did I do in October?") → digests, then episodes on demand;
  - aggregate ("how many times…") → list mode by date range with a cap;
  - nothing found → fallback to `search_conversations` (raw log).
- Each recall updates `accessCount` / `lastAccessedAt`.

### 4. Forgetting
- Nothing is deleted automatically. Ageing = detail demoted in ranking, older periods
  answered primarily from digests; raw log and episodes remain reachable.
- User-driven deletion only (single episode, "forget this period").

## Decisions

### D1 — Extraction trigger: idle debounce + nightly sweep (2026-10-01)
- Context: today extraction runs only at end of turn in the chat flow
  (Arkimede `backend/src/messages/messages.controller.ts` → `maybeExtractOnTurn`) when ≥ `autoMemoryThreshold`
  (default 6, user + assistant) new messages accumulated since
  `chat.memoryUpToMessageId`. A chat tail below threshold is **never** analyzed —
  a gap that already affects facts today.
- **Idle debounce**: on each persisted message, (re)schedule a per-chat BullMQ delayed
  job (jobId = chatId, replaced on every new message), delay configurable (~15 min).
  On fire: extract the unprocessed tail regardless of threshold.
- **Nightly sweep**: before consolidation, process every chat tail left unprocessed
  (lost jobs, restarts). Safety net, not the primary path.

### D2 — Facts and episodes: two separate LLM calls (2026-10-01)
- The existing fact-extraction prompt and flow stay **untouched** (zero regression
  risk on fact quality); episodes get their own prompt.
- Separate cursor: new `chats.episodesUpToMessageId` (fact cursor
  `memoryUpToMessageId` unchanged).
- Accepted cost: one extra summarizer call per extraction window.

### D3 — Idle/nightly path also extracts facts from tails (2026-10-01)
- Closes the existing gap: fact tails below threshold are analyzed on idle / nightly
  (gated by `autoMemoryEnabled`, as today). Additive change: at most more `pending`
  proposals, still confirmed by the user. End-of-turn threshold path unchanged.

### D4 — Separate per-user toggle `episodicMemoryEnabled`, default off (2026-10-01)
- A diary is more sensitive than durable facts → explicit opt-in, independent of
  `autoMemoryEnabled`.

### D5 — Idle delay: global `app_config` value, default 15 min (2026-10-01)
- Admin-editable, no per-user override.
- Episode pass skipped (zero LLM calls) when the tail contains no user message.

### D6 — Dedicated tables `user_episodes` + `user_digests` (2026-10-01)
- `user_memory` untouched: no existing query (retrieve, pinned, evolution, prune,
  graph, list) needs an exclusion filter. Own data model (dated, bi-temporal,
  importance, no scope/evolution). Reuse RRF + embedding helpers.

### D7 — One vector collection `user_episodes` (2026-10-01)
- Episodes and digests together, payload `{userId, level: 'episode'|'digest', ...}`;
  filter by `level` when needed.

### D8 — Digest levels: day + month (2026-10-01)
- "Last week" is answered from 7 daily digests; monthly digests roll up from dailies.

### D9 — Extracted episodes are auto-confirmed (2026-10-01)
- Stored immediately, visible / editable / deletable in the timeline. Never
  auto-injected, so a wrong episode only surfaces when explicitly asked.
- Promotions of recurring patterns to semantic notes stay `pending` (A-MEM rule).

### D10 — A past plan stays a plan unless confirmed (2026-10-01)
- `kind='plan'` + `validUntil`. When the date passes, consolidation does **not**
  turn it into an event; only a later mention confirming it ("Rome was great")
  creates the event (linked to the plan). A contradicting mention sets
  `invalidatedAt`. Recall shows unconfirmed past plans as such — no invention.

### D11 — Explicit capture via dedicated tool `log_episode` (2026-10-01)
- e.g. "note that today I serviced the car". Params: `content`, optional
  `occurredAt` / `datePrecision`, `kind` (event|plan).
- Loaded only when `episodicMemoryEnabled` (class B, like `save_memory`) → zero
  prompt cost for users without the diary. Explicit capture → max importance.

### D12 — Dedicated tool `search_episodes` (2026-10-01)
- Symmetric to `log_episode`, same `episodicMemoryEnabled` gate; `search_memory`
  untouched. Params: `query`, optional `from` / `to`, `mode: 'search' | 'list'`
  (list = chronological by date range, capped, for "what did I do in October?" /
  "how many times…"). Period questions read digests first, episodes on demand.

### D13 — Automatic fallback to the raw log (2026-10-01)
- When episodes/digests return nothing relevant, `search_episodes` queries the raw
  message log (`searchConversations`) and returns those hits marked as
  "from chats". The agent does not need to chain a second tool.

### D14 — Ranking weights are code constants (2026-10-01)
- recency / importance / relevance (+ access boost) with fixed, tested values;
  made configurable only if a real need appears.

### D15 — Episodes are personal only (2026-10-01)
- No team/org scope; the diary is never shared; consolidation never crosses users.

### D16 — Kept forever, user-driven deletion only (2026-10-01)
- No TTL. User deletes single episodes or a period ("forget March"); affected
  digests are recomputed (or deleted) accordingly; vector entries removed.

### D17 — Voice deferred to voice-chat persistence (2026-10-01)
- Out of v1. Arrives with the backlog item "optional persistence of voice chats", so
  voice goes through exactly the same path (persisted messages → idle → extraction,
  provenance, raw-log fallback). No second capture path.

### D18 — Diary timeline as a tab in Settings → Memory (2026-10-01)
- Next to List / Graph: "Diary" view, day digest on top and episodes underneath,
  month navigation, filters, edit (content / date / importance), delete,
  "forget this period".

### D19 — Recall boost of linked semantic notes: deferred to v2 (2026-10-01)
- What it is: when `search_episodes` returns an episode linked (by consolidation) to
  semantic notes, those notes get a recall boost and rank slightly higher in future
  automatic retrieval (associative reactivation).
- Why deferred: today `retrieve()` ranking is **stateless** (FTS + vector → RRF →
  `MIN_VECTOR_SCORE` cutoff → `RETRIEVE_TOP_K`). The boost needs new state on
  `user_memory` (`recallCount` / `lastRecalledAt` or a side table) **and** changes
  which notes get injected in every chat — the core of a working, e2e-verified
  memory, through a side door, with effects hard to test. Conflicts with D6.
- v2 direction: design recall reinforcement as a feature of semantic memory itself
  (boost on `search_memory` / automatic retrieval hits), then let episodes feed it.
- v1 prepares the data: episode → note links are stored **on the episode side**
  (`user_episodes.linkedNoteIds`); `user_memory` is not modified.

### D20 — No re-proposal of rejected patterns: `episode_promotions` (2026-10-01)
- Problem: if the user rejects a pattern promotion ("Skis regularly in winter"), the
  next nightly consolidation sees the same episodes and proposes it again — forever.
- Table `episode_promotions(id, userId, pattern, proposedNoteId, episodeIds,
  status: proposed|confirmed|rejected, createdAt, updatedAt)`, episode side.
- Status is inferred, no hook in `user_memory`: at the next consolidation, if
  `proposedNoteId` no longer exists and was never confirmed → `rejected`; if it is
  `confirmed` → `confirmed`.
- A rejected pattern is not re-proposed unless supported by significant **new**
  evidence (new episodes beyond the original `episodeIds`, threshold TBD at
  implementation).
- `user_memory` only receives the `pending` note insert, via the same path as
  automatic extraction (origin label "from diary"). No dedicated promotions UI in v1.

### D21 — Episodes capture emotions and opinions (2026-10-01)
- Driven by the digital twin goal: "great day", "the hut was disappointing" are part
  of who the owner is, not noise.
- Episode fields: `valence` (-2..+2), `feelings` (short free tags), `opinion`
  (optional one-line stance expressed by the owner). Emotional charge also feeds
  `importance` (amygdala tagging).
- Future-proofing for phase 3 (disclosure): episodes involving third parties keep
  `people` (names as mentioned) so a disclosure level can be applied later.

### D22 — Built as a standalone service in its own repository: Recordare (2026-10-01)
- See `DIGITAL_TWIN_VISION.md` → Architecture. Arkimede is the first client
  (REST ingest + MCP); other platforms via MCP (basic) or ingest + SDK (full).
- Impact on earlier decisions (substance unchanged, location changes):
  - D1/D2: idle debounce and cursors live in the service, on **ingested
    conversations** (not on Arkimede `chats`); `episodesUpToMessageId` becomes a
    service-side cursor. D3 (fact tails) stays in Arkimede while A-MEM lives there.
  - D6/D7: tables and vector collection live in the service's own DB.
  - D11/D12: `log_episode` / `search_episodes` exposed as MCP tools; Arkimede consumes
    them through its existing MCP client.
  - D13: fallback searches the service's **own raw log** of ingested messages.
  - D4/D5: toggle and idle delay become service settings (per user / global).
- A-MEM stays in Arkimede for now; migration is a later phase.

### D23 — Engine: build our design (D) in the service (approved 2026-10-02)
- Evidence (`spikes/memory-eval/RESULTS.md`, round 2, bge-m3, 24 questions): under noise
  D 96% vs Memobase 88%, Graphiti 81%, raw baseline 67%; with a local `qwen3:8b` D 73% vs
  Memobase 65%. Gap comes from the data model (event dates + date filter, plan status,
  emotions, fact history), not from embeddings.
- Held-out check (separate dataset written blind to D's prompts): D 91% / 86% (base / noise)
  vs Memobase 75% / 61% — the gap widened; D's misses are recorded as design gaps in
  `ENGINE_IDEAS.md`.
- Borrowed ideas (Memobase, Graphiti), rejected ones and cost principles: `ENGINE_IDEAS.md`.
- Engine model in our test setup: `deepseek-flash`, reasoning off — same quality as
  `deepseek-v4-pro` on the held-out set, much cheaper (any provider allowed, see D27). Rule: at equal quality the cheaper option wins; never trade
  quality for cost.
- Consequences: no Python / Memobase sidecar; engine in TypeScript behind an internal port;
  spike prompts (`systems/d_sys.py`) are the starting point for the service prompts.
- Additions learned from the prototype:
  - explicit weekday → date calendar in extraction and planning prompts (date resolution);
  - the extractor sees open plans and current facts (plan confirmation / cancellation,
    fact supersession) — the D10 mechanism works as designed;
  - a lived state change ("sold the Golf, now a Tesla") is both an episode and a fact;
  - undated reported news → message date with precision `approximate`;
  - restated unchanged facts are dropped (noise repeats the same news);
  - `search_episodes` accepts `from` / `to` from the agent, plus a deterministic resolver for
    common period expressions so small agent models do not compute calendars.

### D27 — Any LLM / embedding provider; DeepSeek and Ollama are only our test setups (2026-10-02)
- Recordare must work with any LLM: hosted (OpenAI, Anthropic, Google, Mistral, DeepSeek,
  OpenRouter, Groq, …), self-hosted (vLLM, LM Studio, Ollama) or the host platform's own gateway
  (e.g. Arkimede's OpenAI-compatible shim). We test with DeepSeek (cloud) and Ollama (local) for
  convenience; nothing in the engine may depend on them.
- `LlmPort` adapters chosen by configuration: **OpenAI-compatible** (covers most providers and
  local servers) and **native Anthropic**; native Gemini only if its OpenAI-compatible endpoint
  falls short.
- **Provider profile = configuration, not code**: how to switch reasoning off (DeepSeek
  `thinking`, OpenAI / Ollama `reasoning_effort`, Qwen `/no_think`, Anthropic off by default),
  structured output support (`json_schema` → `json_object` → prompt-only with tolerant parsing
  and one repair retry), token-limit parameter (`max_tokens` vs `max_completion_tokens`),
  temperature support, prompt caching (automatic prefix vs explicit `cache_control`), usage
  fields for accounting.
- **Provider-neutral prompts and schemas**: one prompt set for all providers (IT/EN), no vendor
  tags; JSON schemas in the common subset (flat objects, enums, no `oneOf` / format keywords);
  output always validated in code.
- **Model roles configured independently**: extraction, light tasks (digests, dedupe), embeddings
  — each can use a different provider (e.g. local embeddings + hosted extraction).
- **Embeddings**: any OpenAI-compatible `/v1/embeddings` or local server; model and dimension
  fixed per installation and stored with each vector; changing model = re-embed job (as Arkimede).
- **Certification**: a provider / model is "supported" when it passes the eval suite (base +
  held-out) within a set margin of the reference and its structured output validates; a CLI
  command runs the suite against a given configuration; results kept in a supported-models table.
  At equal quality the cheaper model wins.

### D28 — Phase-1 data model reserves the fields the research hypotheses need (2026-10-02)
- From `RESEARCH_NOTES.md` (H1–H3): adding these later would mean migrating episodes, so they
  exist from v1 even where phase 1 only writes defaults.
- Plans: status `open | confirmed | cancelled | rescheduled | unresolved` (a past plan never
  confirmed becomes `unresolved` → answered "I don't know if it happened"), `rescheduledTo`,
  status date and evidence episode (extends D10).
- Episode kind `event | plan | state-change`; facts bi-temporal on both axes: world time
  (`validFrom` / `validTo`) and knowledge time (`recordedAt` / `expiredAt`).
- `corrects` (the old value was never true) distinct from `supersedes` (true until t); both keep
  the old row (no rewrite).
- `origin: owner_lived | owner_told | twin_experienced` on episodes and facts (phase 1 writes
  the first two), plus the conversation's interlocutor and audience.
- `disclosure` label on episodes, facts and digests (default `owner`); derived artefacts keep
  their source ids so labels can propagate (most restrictive wins).
- `stated | inferred` on facts; inferred ones stay pending (see `ENGINE_IDEAS.md`).

### D29 — Data model and recall additions from the literature review (approved 2026-10-02)
- Source: `literature/README.md` (synthesis of 15 deep-read sources); extends D28.
- **Audience set**: every episode, fact, digest and profile entry stores the resolved person ids
  present when it was recorded (immutable), next to the `disclosure` tier; permissions are
  evaluated at read time against current policy; grants are data with validity intervals;
  missing and forbidden items return the same "not found".
- **Derived artefacts carry source ids**; derived audience = intersection of the sources';
  an artefact without source ids fails closed.
- **Facts**: status `current | superseded | corrected | unknown_current`; per touched fact the
  extractor gives a verdict `keep | stale | replace | corrects | unknown` over a shortlisted
  candidate set; `derivedFrom` + deterministic `needsRecheck` (flag only, never auto-rewrite);
  supersession forward-only by event / message time (imports never overwrite newer facts);
  `stated | inferred` + confidence.
- **Plans**: the LLM emits sparse typed patches `confirm | cancel | reschedule | amend`;
  transitions happen in code; a later mention is not a cancellation; open plans shortlisted
  (date window + embedding + people) and referenced by index.
- **Evidence-bound extraction**: every episode / fact / plan patch cites message ids, validated
  in code against Layer 0; the original time expression is stored next to the resolved date.
- **Retrieval keys** (keywords, one-line context, tags) come from the same extraction call.
- **Recall**: `search_episodes` mode `latest`; with a date range, in-range first; value chain per
  fact slot; statuses always shown; premise check for presupposed states; long tails segmented
  by topic before extraction, never truncated; per-window claim cap.

### D30 — Assistant turns are extracted too, with their own origin (approved 2026-10-02)
- Derived memories that ignore the assistant lose what it said or did (Zep's
  single-session-assistant regression) — for agentic clients that is the agent's actions and the
  recommendations the user accepted.
- Assistant turns are always extraction context, and assistant-stated items are extracted with
  `origin: assistant_stated` (extends D28's `owner_lived | owner_told | twin_experienced`),
  never merged with owner-lived memories; recall labels them ("the assistant suggested / did").

### D31 — Recordare facts are state slots with a value chain (2026-10-03; notes part superseded by D34)
- Layer 3 in Recordare = **state slots** ("car", "address", "employer", "children") with their
  history, cardinality `single` (supersede) or `multi` (accumulate), slot schema with merge policy
  and default disclosure (`DATA_MODEL.md` → fact_slots).
- Durable preferences and free-form semantic notes stay in the client's semantic memory (A-MEM in
  Arkimede) until the A-MEM migration — no second, competing note store. Episodes link to notes by
  external ref (`linked_notes`, D19); promotions go to the client as proposals (D20, D26).

### D32 — One extraction call per window (amends D2) (2026-10-03)
- One engine call per idle window extracts episodes, plan patches and fact candidates (as the D
  prototype did, at prototype-level quality); a second call only when deterministic gates leave
  ambiguous fact candidates to resolve (`ENGINE_IDEAS.md` cost rule). D2's "two calls" was written
  when facts lived only in A-MEM; A-MEM's own extraction in Arkimede stays untouched (its call is
  Arkimede's, not Recordare's).

### D33 — Deployment profiles: v1 home / research, hardening deferred (2026-10-03)
- The owner's guidance: stay on the twin; when more security is needed, put firewalls and
  hardening in front. v1 = **home / research profile**: admin-created owners, client keys, personal
  tokens, simple scopes, per-owner isolation.
- Kept in v1 because they are part of the twin, not security add-ons: viewer context resolved by
  Recordare (knowing what to tell whom — disclosure pillar), `author_role` provenance (principle 3,
  memory quality), consent flag (D4), forgetting that sticks (D16).
- Deferred to the **public profile** (M7 / public release): owner login and pages, OAuth for MCP,
  owner-driven linking and revocation UI, read audit, persistent idempotency, backup / provider
  retention policy, network protection. Specified in `API.md` §0 so enabling them needs no data
  migration.

### D34 — Recordare is complete; A-MEM stays in Arkimede; the user chooses (2026-10-03)
- **Recordare owns a complete personal memory**: episodes, plans, digests, state facts **and
  semantic notes** (preferences, habits, values, relationships, knowledge), extracted in the same
  single call (D32). It works fully with any client, Arkimede or not. Replaces D31's "notes stay in
  A-MEM" (D31's state slots remain).
- **A-MEM stays in Arkimede unchanged in its logic** (it also serves team and org scopes).
- **Copies flow one way, by user choice**: Arkimede, when Recordare is connected, shows Recordare's
  notes and lets the user copy a note into A-MEM (personal or team) — by rule (e.g. a category) or
  manually per note, never by blanket prompting. A copy keeps a reference to the Recordare note;
  Recordare exposes a change feed (`GET api/v1/notes/changes?since=`) so Arkimede updates or
  removes copies when the note changes or is forgotten. Copying into team / org widens the audience
  → always an explicit user action, recorded.
- **Arkimede side (M6, its own repo, additive)**: today one per-user toggle (`autoMemoryEnabled`)
  governs extraction, injection and tools together. It is split into independent per-user choices:
  personal notes memory (extraction + use), team / org notes (use), Recordare (connected or not).
  Users without Recordare get the same flexibility. If a user enables both personal A-MEM extraction
  and Recordare notes, duplicates are possible: the UI warns, it does not forbid (user's choice).

## Open questions (to discuss)

None — all resolved in D1–D34 (D24–D26: see `WORK_PLAN.md`). To define with the new repo (`arkimedehq/recordare`, NestJS): 
ingest API contract, MCP tool schemas, auth / identity mapping. Next step: implementation slices.

## Non-goals (for now)
- Embedding every raw message (cost, noise, no event-time semantics).
- Automatic injection of episodes based on date ("one year ago today…").
- Rewriting episodes on recall (no reconsolidation).
- Diary export (JSON / Markdown) — later.
- Dedicated UI for consolidation pattern promotions (panel with supporting episodes,
  "don't propose again"): in v1 they appear as ordinary `pending` notes in the
  existing Memory list with an origin label; re-proposal handled by D20.
- Recall boost of linked semantic notes (D19) — v2.

## Regression checklist (when implementing)
- Existing semantic retrieval, pinned prefix, evolution, prune and graph must be
  unaffected — enumerate every query on `user_memory`.
- Existing threshold-based fact extraction unchanged in output when episodes are on.
- Existing `search_conversations` / `search_memory` behaviour unchanged for current
  arguments (new params additive and optional).
- Cross-provider: tool schemas and prompt changes valid on all LLM providers.
- Consolidation job: zero LLM calls when there is nothing new.
