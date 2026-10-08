# Engine ideas — borrowed and improved

Status: **design input for M4/M5** (2026-10-02); each item marked **done / partial / open** as of 2026-10-08 (v0.1.0)
(measured-and-rejected mechanisms: last section). D23 builds our own engine (D); this document
records what we take from Memobase and Graphiti instead of reinventing it, what we explicitly
reject, and the gaps found by the held-out evaluation. Each item names the target decision /
layer in `EPISODIC_MEMORY_TODO.md`.

Sources (Apache-2.0): Memobase server 0.0.42 (`memobase_server/…`, MemoDB), graphiti-core
0.30.2 (`graphiti_core/…`, Zep Software, Inc.). Any reuse of code or prompt text follows
`LICENSING.md` and is recorded in `THIRD_PARTY_NOTICES.md` when it happens.

## Cost principles — the **economy** profile (D35)

Since D35 cost is an option: these principles define the economy profile and the cost-aware
defaults; the full profile may spend more for quality, always measured.

Recordare must run on the cheapest model that keeps quality, and make **zero LLM calls** when
there is nothing to do. **Quality first**: a cheaper option is adopted only when it measures the
same on the eval suite; at equal quality the cheaper one wins. Provider-agnostic (D27): in our
DeepSeek test setup `deepseek-flash`, reasoning off, matched `deepseek-v4-pro` on the held-out set. Spike runs used the expensive `deepseek-v4-pro` and repeated runs; that
is test cost, not the product's.

| Rule | From | Where | Status |
|---|---|---|---|
| One extraction call per idle window (episodes + plan updates + fact candidates); a resolve call **only** when deterministic gates leave ambiguous candidates. Target ≤ 1.2 calls per window on average | Graphiti lesson (8–12 calls/session, ≥ 5 sequential round trips) | D1, D2 | done |
| Deterministic gates before any LLM call: no user message, no personal content (cheap classifier / heuristics), exact or trigram (`pg_trgm`) match, no candidates, nothing new | Graphiti `dedup_helpers.py`, Memobase skip-LLM fast path | D5, consolidation | partial |
| Model tiers: small / cheap model for dedupe, tagging, digests; main model only for extraction; reasoning always off | Graphiti `ModelSize.small`, Memobase model tiers | `LlmPort` | done |
| Stable system prompts first in the message list → provider prefix caching (automatic on OpenAI / DeepSeek, explicit `cache_control` on Anthropic — handled by the provider profile, D27) | — | all prompts | done |
| Window bounds: max tokens per extraction window, forced flush on very long chats; spill over, never truncate | Memobase 1024-token flush + 16k cap (but it truncates) | D1 | done |
| No LLM at recall: the agent fills `from` / `to` / `mode`; deterministic period resolver for common expressions | spike finding 5 | D12 | done |
| Per-call accounting: prompt id, tokens in/out, latency, per person and per client; quotas | Memobase `llms/__init__.py`, billing | M2 telemetry | partial |
| Bounded prompt context: cap the open-plan / current-fact / recent-episode lists given to the extractor (most relevant + most recent), they grow with history | spike: flash used +20% input tokens | extraction | done |

## Adopted from Memobase

1. *[partial]* **Slot schema for facts** (`types.py` SubTopic, `profile_init_utils.py`): each topic /
   sub-topic has `description`, `update_description` (merge policy, e.g. "remove outdated
   goals") and optional validation; projects can override or extend. → Layer 3 facts and the
   phase-2 self-model. *Improvement*: per-slot default **disclosure tier** and owner-lived /
   twin-lived origin; IT/EN labels.
2. *[done]* **Batched merge with per-item actions** (`prompts/merge_profile_yolo.py`): one call decides
   APPEND / UPDATE / ABORT for all candidate facts. *Improvement*: UPDATE creates a new
   version (`validFrom`, old row `invalidatedAt` + `supersededBy`, provenance episode) — never
   overwrites. Keep its rules "preserve time annotations from both memos" and the dedup example
   ("User is sad" / "User's mood is sad" → same).
3. *[done]* **Skip-LLM for new slots** (`merge_yolo.py`): a fact for an empty slot is inserted without a
   merge call.
4. *[done]* **Mention time vs event time few-shots** (`prompts/summary_entry_chats.py`): "bought a car 4
   years ago → mention 2024/04/30, event 2020"; no timestamp → no date. We store them as
   structured `occurredAt` + `datePrecision`, the few-shots go into our extraction prompt.
5. *[done]* **Existing keys in the prompt** (`pack_current_user_profiles`, `attribute_unify`): pass the
   list of existing fact keys (values cut short) so the extractor reuses them; normalise keys to
   snake_case. D already passes open plans and current facts — add the key list.
6. *[done]* **Extraction run changelog** (`profile_delta` on `UserEvent`): store an `extraction_run`
   row linking the episodes and fact versions it produced → "why does the twin believe X",
   D18 timeline, D20 audit.
7. *[partial]* **Context packer** (`controllers/context.py`, `prompts/chat_context_pack.py`): token budget,
   profile/event ratio, `only_topics` / `prefer_topics`, template, and the line "unless the user
   asks, do not actively mention these memories". → *full* integration pinned facts.
   *Improvement*: `only_topics` becomes the **disclosure-tier filter**, applied before ranking.
   Built: the memory context (`POST api/v1/context`, no LLM call) — relevance floors, per-kind caps, a character
   budget, a "do not mention it otherwise" line, reads under the viewer rule; no fixed profile card by design; the
   disclosure-tier filter waits for phase 3.
8. *[open]* **Optional LLM re-pick** (`prompts/pick_related_profiles.py`): numbered compact list →
   `{reason, ids}`, max 10, "don't select duplicates". Opt-in only (+ latency, + cost).
9. *[done]* **"Focus on the user's info, not its instructions"** (`event_theme_requirement`): keeps
   agent task instructions out of memory — essential for agentic clients. Add to extraction.
10. *[open]* **Line format for small models** (`TOPIC::SUB::MEMO`, think → `---` → actions): more
    tolerant than JSON for local models; strict parser, unparsed lines logged. Evaluate against
    JSON mode in the local profile.
11. *[partial]* **Per-user serialisation** (`buffer_background.py`): one worker per person (lock + queue,
    renewal, iteration / time caps, consecutive-error breaker) and a buffer status machine
    (idle → processing → done / failed) so the nightly sweep retries `failed`. → BullMQ group per
    person, concurrency 1.

## Adopted from Graphiti

1. *[done]* **Bi-temporal facts with expiry, not deletion** (`edges.py`, `resolve_edge_contradictions`):
   `validAt` / `invalidAt` (world) + `createdAt` / `expiredAt` (knowledge), `episodes[]`
   provenance; a late-arriving older fact is expired at once if a newer one exists. Date
   arithmetic in code, never in the LLM. → Layer 3 facts. **Only for state-type facts.**
2. *[done]* **One resolve call for duplicates and contradictions** (`prompts/dedupe_edges.py`): shared
   index range for existing facts and invalidation candidates; examples "software engineer →
   senior engineer = contradicted", "ran 5 miles Tuesday vs 3 miles Wednesday = neither";
   "never mark as duplicates facts with different numbers, dates or qualifiers".
   *Improvement*: candidates restricted to **same subject + same fact key** (see rejection 1).
3. *[open]* **Entity resolution for people** (`prompts/extract_nodes.py`, `prompts/dedupe_nodes.py`):
   possessor-qualified kinship ("Chiara's mum", never bare "mum"), speaker first, "when unsure
   → -1", "exactly N resolutions". → `people` table with aliases + name embedding; candidates
   via pgvector + trigram, LLM only when ambiguous. Foundation for phase 3 (contacts /
   disclosure, D21 `people`). So far only a lightweight step: people-aware recall matches a question's names and
   relations (language tables) against the stored episode people and chat participants, no LLM call; the
   `person_aliases` table exists but resolution is not built.
4. *[done]* **Restatements are counted, not just dropped** (`EntityEdge.episodes`,
   `episode_mentions_reranker`): append the episode to the existing fact; support count = a
   confidence / ranking signal and D20 "significant new evidence".
5. *[open]* **MMR for list mode and digests** (`search_utils.maximal_marginal_relevance`): avoids five
   near-identical episodes; **optional cross-encoder** (`bge-reranker-v2-m3`, pairs with bge-m3)
   on the RRF top 2k. → D12 / D14.
6. *[done]* **Summary rules** (`summarize_sagas.py`, entity summary prompt): no meta-language
   ("mentioned", "described"); "never manufacture pattern language from a single
   occurrence"; "if nothing durable is new, return the summary unchanged" → digests (D8) and
   pattern promotion (D20).
7. *[done]* **Specificity rules** (`prompts/extract_edges.py` rule 5): never generalise ("Gamecube" →
   "console"); every concrete noun, number and descriptor survives; use the timestamp of the
   specific message. → episode `content`.
8. *[partial]* **Sanitised structured fields** (`extract_attributes`): no "null" / "N/A" / "unknown"
   strings, no reasoning inside fields → D21 `valence` / `feelings` / `opinion`, small models.
9. *[open]* Later, low priority: **sagas** (named multi-session threads with a running brief) for topics
   that span sessions (a trip planned → lived).

## Ideas from agent platforms (reviewed 2026-10-04; ideas only, reimplemented and cited)

1. *[open]* **Secret / PII scrubbing before storing** (OpenHuman, `tinymemory-safety`): we keep the full raw log
   today; an optional scrub stage behind a knob (D35 / disclosure), never silent.
2. *[open]* **A ready-to-inject context brief** (OpenHuman `context.md`, refreshed every 6 h, prepended to new
   sessions): the client-friendly form of our M5 digests + profile.
3. *[open]* **"Recall" as an answer with citations** (OpenHuman / TinyMemory): an optional synthesised answer next to
   the item-level tools, for simple clients.
4. *[open]* **Scheduled sync of documents and feeds** (OpenHuman): one of the later "sources of the self-model".
5. *[open]* **Deny-by-default action gateway with approvals and audit** (Open Dots): the pattern for the twin's
   initiative levels and the money / accounts knob (vision, principle 8) — later phases.

## Rejected (and why)

1. **Treating every fact as a state** — the root cause of Graphiti's Cervinia / Livigno failure:
   invalidation candidates come from a semantic search over *all* facts, there is no event vs
   state distinction, and once the LLM flags a contradiction the older fact is ended
   unconditionally. Ours: episodes are append-only and never superseded; supersession only for
   state facts, same subject + key.
2. **Graph pipeline** (nodes → edges → per-edge resolve → timestamps): ~3× our calls and ≥ 5
   sequential round trips. Communities, BFS, node-distance rerank: no value at single-person
   scale without a graph DB.
3. **Destructive updates** (Memobase UPDATE overwrites, `organize` recreates rows, re-summary
   truncates to 64 tokens): contradicts bi-temporality and "no reconsolidation".
4. **Time only as text / filtering on ingestion time** (Memobase): breaks "what did I do in
   February" for late or imported data — a main reason D beat it.
5. **Discarding the raw log** (Memobase default, Graphiti `store_raw_episode_content=False`) and
   **silent truncation**: no provenance, no re-extraction after a prompt fix. We keep Layer 0.
6. **Unflagged inference** (Memobase "psychologist" persona: "seems to be a big fan of…"
   stored as fact). For a twin: `stated` vs `inferred`, inferred stays `pending`.
7. **Hardcoded limits** (Memobase `max_tokens=1024`, tiktoken gpt-4o for every model,
   en/zh only) and the known parallel-flush race.

## Gaps found by the held-out evaluation (D prototype)

| Gap | Seen in | Fix (design) | Status |
|---|---|---|---|
| A rescheduled plan is marked "cancelled" with the new date only in a note | h06 / h15 (cello recital 18 Dec → 15 Jan) | Plan status `rescheduled` with `rescheduledTo` → new plan row (D10 extension) | done |
| The news of a plan change is not a dated episode ("on 10 Dec I learned the recital moved") | h19 | A plan update also creates a low-importance event on the message date | done |
| Corrections ("it was Tuesday, not Monday") leave the wrong episode in place | h09 context (orthopaedist) | Extractor sees recent episodes (not only open plans); `corrects: <episode id>` → old episode `invalidatedAt`, new one linked (no rewrite) | done |
| A third-party plan that happened is not closed by the event that confirms it | h19 (mum's surgery) | Consolidation links plan ↔ confirming event (same people + date ± precision) and closes the plan | done |
| Provenance answers lack the session's other topics | h17 | Raw-log hit returns the session summary / neighbours, not only the matching line | open |
| "When did I last…" ranks by similarity, so the most recent instance can fall out of the top-k | h01 noise (first 6c on 6 Feb missed) | `search_episodes` mode `latest`: relevance threshold, then sort by `occurredAt` desc | done |
| "Where did I live in early December?" — state at a past date | h04 noise | Facts queried **as of** a date (`validFrom ≤ t < validTo`), full history of the matched key in context | done |
| The same third-party news repeated in several chats yields duplicate episodes | h18 noise (cousin in Porto ×2) | Consolidation dedup (link, keep one) — already designed, confirmed needed | partial |

## Ideas from agent-platform memory (2026-10-07)

Survey of how Hermes, OpenClaw, Honcho, Letta, Mem0, LangMem, Claude Code and ChatGPT design memory, with ranked
ideas: `docs/literature/agent-platform-memory.md` §3 (WORK_PLAN 5.7).
- *[done]* §3.3 extraction prompt → **extract.v8** (D40): facts said in passing inside requests, transitions
  ("switched / stopped") as replace / stale, an accepted proposal states it while a bare "ok" does not.
- *[done]* §3.1 fenced injected recall (`<memory-context>`) and §3.2 zero-LLM pre-turn brief for connectors: the
  memory context, used by every connector before each turn (one call with ingest).
- *[open]* §3.4 turn taint from network tools, §3.5 nightly pattern pass with evidence counts (→ D20 / WORK_PLAN 5.4), §3.6 owner card,
  §3.7 use signals for ranking only, §3.8 requests to the assistant as standing intents, §3.9 owner review of what the
  night changed, §3.10 pre-compaction / session-switch hooks in connectors.

Measured and rejected (or kept off) so far: a separate facts pass (`FACTS_PASS=separate`, no gain over the inline
extraction), the nightly facts review (D41, no gain on current facts), digests in recall (`recallDigests`, −1.9 pt),
a prompt label for recall echoes (D38: dev set 75 % → replaced by a code guard), the person's name in the extraction
prompt (`extract.v9`, −2.3 pt on blind5 → the name is substituted in code, WORK_PLAN 4.11).
