# Engine ideas — borrowed and improved

Status: **design input for M4/M5** (2026-10-02). D23 builds our own engine (D); this document
records what we take from Memobase and Graphiti instead of reinventing it, what we explicitly
reject, and the gaps found by the held-out evaluation. Each item names the target decision /
layer in `EPISODIC_MEMORY_TODO.md`.

Sources (Apache-2.0): Memobase server 0.0.42 (`memobase_server/…`, MemoDB), graphiti-core
0.30.2 (`graphiti_core/…`, Zep Software, Inc.). If prompt wording is copied, credit both in a
`NOTICE` file.

## Cost principles (requirement, not an optimisation)

Recordare must run on the cheapest model that keeps quality, and make **zero LLM calls** when
there is nothing to do. **Quality first**: a cheaper option is adopted only when it measures the
same on the eval suite; at equal quality the cheaper one wins. Provider-agnostic (D27): in our
DeepSeek test setup `deepseek-flash`, reasoning off, matched `deepseek-v4-pro` on the held-out set. Spike runs used the expensive `deepseek-v4-pro` and repeated runs; that
is test cost, not the product's.

| Rule | From | Where |
|---|---|---|
| One extraction call per idle window (episodes + plan updates + fact candidates); a resolve call **only** when deterministic gates leave ambiguous candidates. Target ≤ 1.2 calls per window on average | Graphiti lesson (8–12 calls/session, ≥ 5 sequential round trips) | D1, D2 |
| Deterministic gates before any LLM call: no user message, no personal content (cheap classifier / heuristics), exact or trigram (`pg_trgm`) match, no candidates, nothing new | Graphiti `dedup_helpers.py`, Memobase skip-LLM fast path | D5, consolidation |
| Model tiers: small / cheap model for dedupe, tagging, digests; main model only for extraction; reasoning always off | Graphiti `ModelSize.small`, Memobase model tiers | `LlmPort` |
| Stable system prompts first in the message list → provider prefix caching (automatic on OpenAI / DeepSeek, explicit `cache_control` on Anthropic — handled by the provider profile, D27) | — | all prompts |
| Window bounds: max tokens per extraction window, forced flush on very long chats; spill over, never truncate | Memobase 1024-token flush + 16k cap (but it truncates) | D1 |
| No LLM at recall: the agent fills `from` / `to` / `mode`; deterministic period resolver for common expressions | spike finding 5 | D12 |
| Per-call accounting: prompt id, tokens in/out, latency, per person and per client; quotas | Memobase `llms/__init__.py`, billing | M2 telemetry |
| Bounded prompt context: cap the open-plan / current-fact / recent-episode lists given to the extractor (most relevant + most recent), they grow with history | spike: flash used +20% input tokens | extraction |

## Adopted from Memobase

1. **Slot schema for facts** (`types.py` SubTopic, `profile_init_utils.py`): each topic /
   sub-topic has `description`, `update_description` (merge policy, e.g. "remove outdated
   goals") and optional validation; projects can override or extend. → Layer 3 facts and the
   phase-2 self-model. *Improvement*: per-slot default **disclosure tier** and owner-lived /
   twin-lived origin; IT/EN labels.
2. **Batched merge with per-item actions** (`prompts/merge_profile_yolo.py`): one call decides
   APPEND / UPDATE / ABORT for all candidate facts. *Improvement*: UPDATE creates a new
   version (`validFrom`, old row `invalidatedAt` + `supersededBy`, provenance episode) — never
   overwrites. Keep its rules "preserve time annotations from both memos" and the dedup example
   ("User is sad" / "User's mood is sad" → same).
3. **Skip-LLM for new slots** (`merge_yolo.py`): a fact for an empty slot is inserted without a
   merge call.
4. **Mention time vs event time few-shots** (`prompts/summary_entry_chats.py`): "bought a car 4
   years ago → mention 2024/04/30, event 2020"; no timestamp → no date. We store them as
   structured `occurredAt` + `datePrecision`, the few-shots go into our extraction prompt.
5. **Existing keys in the prompt** (`pack_current_user_profiles`, `attribute_unify`): pass the
   list of existing fact keys (values cut short) so the extractor reuses them; normalise keys to
   snake_case. D already passes open plans and current facts — add the key list.
6. **Extraction run changelog** (`profile_delta` on `UserEvent`): store an `extraction_run`
   row linking the episodes and fact versions it produced → "why does the twin believe X",
   D18 timeline, D20 audit.
7. **Context packer** (`controllers/context.py`, `prompts/chat_context_pack.py`): token budget,
   profile/event ratio, `only_topics` / `prefer_topics`, template, and the line "unless the user
   asks, do not actively mention these memories". → *full* integration pinned facts.
   *Improvement*: `only_topics` becomes the **disclosure-tier filter**, applied before ranking.
8. **Optional LLM re-pick** (`prompts/pick_related_profiles.py`): numbered compact list →
   `{reason, ids}`, max 10, "don't select duplicates". Opt-in only (+ latency, + cost).
9. **"Focus on the user's info, not its instructions"** (`event_theme_requirement`): keeps
   agent task instructions out of memory — essential for agentic clients. Add to extraction.
10. **Line format for small models** (`TOPIC::SUB::MEMO`, think → `---` → actions): more
    tolerant than JSON for local models; strict parser, unparsed lines logged. Evaluate against
    JSON mode in the local profile.
11. **Per-user serialisation** (`buffer_background.py`): one worker per person (lock + queue,
    renewal, iteration / time caps, consecutive-error breaker) and a buffer status machine
    (idle → processing → done / failed) so the nightly sweep retries `failed`. → BullMQ group per
    person, concurrency 1.

## Adopted from Graphiti

1. **Bi-temporal facts with expiry, not deletion** (`edges.py`, `resolve_edge_contradictions`):
   `validAt` / `invalidAt` (world) + `createdAt` / `expiredAt` (knowledge), `episodes[]`
   provenance; a late-arriving older fact is expired at once if a newer one exists. Date
   arithmetic in code, never in the LLM. → Layer 3 facts. **Only for state-type facts.**
2. **One resolve call for duplicates and contradictions** (`prompts/dedupe_edges.py`): shared
   index range for existing facts and invalidation candidates; examples "software engineer →
   senior engineer = contradicted", "ran 5 miles Tuesday vs 3 miles Wednesday = neither";
   "never mark as duplicates facts with different numbers, dates or qualifiers".
   *Improvement*: candidates restricted to **same subject + same fact key** (see rejection 1).
3. **Entity resolution for people** (`prompts/extract_nodes.py`, `prompts/dedupe_nodes.py`):
   possessor-qualified kinship ("Chiara's mum", never bare "mum"), speaker first, "when unsure
   → -1", "exactly N resolutions". → `people` table with aliases + name embedding; candidates
   via pgvector + trigram, LLM only when ambiguous. Foundation for phase 3 (contacts /
   disclosure, D21 `people`).
4. **Restatements are counted, not just dropped** (`EntityEdge.episodes`,
   `episode_mentions_reranker`): append the episode to the existing fact; support count = a
   confidence / ranking signal and D20 "significant new evidence".
5. **MMR for list mode and digests** (`search_utils.maximal_marginal_relevance`): avoids five
   near-identical episodes; **optional cross-encoder** (`bge-reranker-v2-m3`, pairs with bge-m3)
   on the RRF top 2k. → D12 / D14.
6. **Summary rules** (`summarize_sagas.py`, entity summary prompt): no meta-language
   ("mentioned", "described"); "never manufacture pattern language from a single
   occurrence"; "if nothing durable is new, return the summary unchanged" → digests (D8) and
   pattern promotion (D20).
7. **Specificity rules** (`prompts/extract_edges.py` rule 5): never generalise ("Gamecube" →
   "console"); every concrete noun, number and descriptor survives; use the timestamp of the
   specific message. → episode `content`.
8. **Sanitised structured fields** (`extract_attributes`): no "null" / "N/A" / "unknown"
   strings, no reasoning inside fields → D21 `valence` / `feelings` / `opinion`, small models.
9. Later, low priority: **sagas** (named multi-session threads with a running brief) for topics
   that span sessions (a trip planned → lived).

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

| Gap | Seen in | Fix (design) |
|---|---|---|
| A rescheduled plan is marked "cancelled" with the new date only in a note | h06 / h15 (cello recital 18 Dec → 15 Jan) | Plan status `rescheduled` with `rescheduledTo` → new plan row (D10 extension) |
| The news of a plan change is not a dated episode ("on 10 Dec I learned the recital moved") | h19 | A plan update also creates a low-importance event on the message date |
| Corrections ("it was Tuesday, not Monday") leave the wrong episode in place | h09 context (orthopaedist) | Extractor sees recent episodes (not only open plans); `corrects: <episode id>` → old episode `invalidatedAt`, new one linked (no rewrite) |
| A third-party plan that happened is not closed by the event that confirms it | h19 (mum's surgery) | Consolidation links plan ↔ confirming event (same people + date ± precision) and closes the plan |
| Provenance answers lack the session's other topics | h17 | Raw-log hit returns the session summary / neighbours, not only the matching line |
| "When did I last…" ranks by similarity, so the most recent instance can fall out of the top-k | h01 noise (first 6c on 6 Feb missed) | `search_episodes` mode `latest`: relevance threshold, then sort by `occurredAt` desc |
| "Where did I live in early December?" — state at a past date | h04 noise | Facts queried **as of** a date (`validFrom ≤ t < validTo`), full history of the matched key in context |
| The same third-party news repeated in several chats yields duplicate episodes | h18 noise (cousin in Porto ×2) | Consolidation dedup (link, keep one) — already designed, confirmed needed |
