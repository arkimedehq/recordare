# Mem0: Building Production-Ready AI Agents with Scalable Long-Term Memory (Chhikara, Khant, Aryan, Singh, Yadav — Mem0, arXiv preprint Apr 2025, arXiv:2504.19413)
Read: full arXiv PDF text (main text, appendices A-C) plus Zep's rebuttal blog (summary via fetch). The open-source repo https://github.com/mem0ai/mem0 was NOT inspected; Code: the paper says "https://mem0.ai/research"; no paper-specific code or extraction/update prompts are published in the paper.

## Problem
Fixed context windows make agents forget across sessions; even long windows are not enough because histories outgrow them and attention degrades on distant, irrelevant context. Goal: extract, consolidate and retrieve salient facts cheaply, with low latency and token cost.

## Mechanism (how it works)
**Mem0 (two phases, incremental):**
1. Extraction triggers on each new message pair (m_t-1, m_t), usually user plus assistant.
2. Prompt P = (conversation summary S, last m=10 messages, the new pair). S is refreshed asynchronously, off the hot path.
3. An LLM function phi(P) returns candidate facts Omega = {w1..wn}.
4. Update: for each candidate, retrieve the top s=10 similar memories by embedding; the LLM, via function calling ("tool call"), picks one of four operations: **ADD** (no equivalent exists), **UPDATE** (augment an existing memory), **DELETE** (contradicted), **NOOP**.
5. Algorithm 1 (appendix) executes them. UPDATE replaces the old memory only if the new fact has more information content; DELETE physically removes the contradicted memory.

**Mem0g (graph variant):** (1) an LLM entity extractor assigns types (Person, Location, Event...); (2) an LLM relationship generator emits triplets (source, relation, destination), e.g. `lives_in`, `prefers`, `happened_on`; (3) entities are embedded and matched to existing nodes above a threshold t, then created or reused; (4) a conflict-detection step plus an LLM "update resolver" marks obsolete relations **invalid rather than deleting them**, to allow temporal reasoning. Retrieval: entity-centric (find query entities, expand incoming and outgoing edges into a subgraph) plus semantic-triplet (embed the query, match textual encodings of all triplets over a threshold).

## Data model (fields, statuses, tables/stores)
Sparse in the paper. Mem0: natural-language memory strings with unique id, embeddings in a vector DB; the Algorithm records `(id, f, "ADD"|"UPDATE")` — i.e. an operation label, no validity interval. Mem0g: directed labelled graph G = (V, E, L); node = entity type, embedding e_v, creation timestamp t_v; edge = triplet with label; invalid flag on obsolete edges (field name not stated). Store: Neo4j for the graph. Vector DB not named. No event-time field is described; the temporal result relies on timestamps inside memory text and the answer prompt ("convert relative time references ... based on the memory timestamp", "if contradictory, prioritize the most recent memory").

## Prompts / LLM usage
All gpt-4o-mini, temperature 0. Per message pair: 1 extraction call, then 1 update call per candidate fact (top-10 similar memories each), plus periodic summary regeneration. Mem0g adds entity-extraction, relationship-generation and conflict-resolution calls. Deterministic code: retrieval, executing operations. The extraction and update prompts are NOT in the paper; only the judge, the answer prompt and the ChatGPT-memory baseline prompt are. The judge prompt tells the model to "be generous with your grading - as long as it touches on the same topic as the gold answer, it should be counted as CORRECT" (dates too: same date or period). The call count per message is not stated (our estimate: 1 + number of candidates).

## Evaluation
- Dataset: LoCoMo, 10 conversations (~26k tokens, ~200 questions each); the **adversarial category was excluded** (no gold answers); categories single-hop, multi-hop, temporal, open-domain. Metrics F1, BLEU-1, LLM-as-judge J (10 runs, mean +/- sd; the judge model is not named).
- J per category (Mem0 / Mem0g): single-hop 67.13 / 65.71; multi-hop 51.15 / 47.19; open-domain 72.93 / 75.71; temporal 55.51 / 58.13. Zep reported: 61.70 / 41.35 / 76.60 / 49.31. A-Mem re-run 39.79 / 18.85 / 54.05 / 49.91.
- Overall J: Mem0 66.88, Mem0g 68.44, Zep 65.99, LangMem 58.10, OpenAI memory 52.90, A-Mem 48.38, best RAG ~61 (chunk 256, k=2), **full-context 72.90**.
- Cost: memory tokens per query Mem0 1,764, Mem0g 3,616, Zep 3,911, full-context 26,031. Search p50/p95: Mem0 0.148/0.200 s, Mem0g 0.476/0.657 s, Zep 0.513/0.778 s. Total p95: Mem0 1.44 s vs full-context 17.1 s ("91% lower"). Stored memory per conversation: Mem0 ~7k tokens, Mem0g ~14k, Zep >600k.
- **Dispute:** Zep says its system was mis-run (user role for both speakers, timestamps appended to text, sequential search) and reports 75.14% J, above Mem0g's 68.44%. Our reading: the paper also says Mem0 loses to full-context by 6 points, and vendors both choose favourable settings; our own CLAUDE.md note ("~94% self-reported vs ~49% independent") applies. No ablation isolates the effect of ADD/UPDATE/DELETE.

## Limitations
Authors: graph adds latency; graphs did not help multi-hop or single-hop; future work on hierarchical memory and richer consolidation. Ours: facts are timeless strings (no event time, no precision); DELETE destroys history (contradicts the paper's own claim of "temporal consistency"); UPDATE rewrites in place; summary S is a second lossy layer; adversarial / unanswerable questions removed, so false-premise behaviour is untested; generous judge; LoCoMo fits in a context window; one run of ingestion per system; the update step is O(candidates) LLM calls.

## Implications for Recordare
- **Important, AVOID:** the ADD/UPDATE/DELETE/NOOP model applied to everything. DELETE and in-place UPDATE are what D28/D10 forbid; ours is append + supersede/correct. Take only the useful idea: a single small decision (add / same / supersedes / corrects / noop) per candidate, restricted by deterministic gates (ENGINE_IDEAS "one resolve call").
- ADOPT as a baseline in the eval suite (H6): run Mem0 (OSS) next to Memobase/Graphiti on our two datasets, with the LoCoMo-style generous judge replaced by our strict judge; always include **full-context and plain RAG baselines** — the paper shows full-context still wins on quality, so our claim must be cost-adjusted.
- ADOPT: report accuracy together with tokens injected per query, p50/p95 search latency and tokens stored per conversation (per-call accounting, M2). These three numbers made Mem0's case; use them.
- ADOPT (D1/D2): extraction context = a rolling conversation summary plus the last ~10 messages. We already pass the tail; consider the async summary to resolve pronouns and dates in short idle windows.
- CHANGE nothing in D8: dense natural-language memories without a graph beat or tied the graph variant on single- and multi-hop; supports "no graph DB" (D23 rejection 2).
- Note for D13: Mem0g's gain on temporal questions (+2.6 J) came from timestamped relations, i.e. event time matters; our `occurredAt` plus date filter is the stronger form of the same idea.
- Avoid copying its answer prompt shape ("answer < 5-6 words"), it inflates benchmark scores and does not reflect agent use.
