# Zep: A Temporal Knowledge Graph Architecture for Agent Memory (Rasmussen, Paliychuk, Beauvais, Ryan, Chalef — Zep AI, arXiv preprint Jan 2025, arXiv:2501.13956)
Read: full arXiv HTML (v1, all sections + appendix prompts); the Zep-vs-Mem0 dispute from the Mem0 paper (full text) and Zep's rebuttal blog post (summary via fetch only). Graphiti code not re-read here (already studied, see ENGINE_IDEAS.md); Code: https://github.com/getzep/graphiti (the experiment notebooks are promised "publicly available", not checked).

## Problem
RAG assumes a static corpus. Agents need memory over continuously changing data (conversations plus business data), with facts that change over time, at low latency and cost. MemGPT-style paging and plain RAG do not track when a fact was true.

## Mechanism (how it works)
1. Input arrives as **episodes** (message, text or JSON). A message carries speaker and a reference timestamp.
2. Entity extraction: current message plus the last n=4 messages (two turns) go to the LLM; the speaker is always extracted. A "reflexion"-style second pass reduces hallucinated or missed entities. An entity summary is also produced.
3. Entity resolution: embed the entity name (1024-d), cosine search plus full-text search over existing entity names and summaries, then an LLM duplicate check (returns `is_duplicate`, uuid, fullest name). Writes use predefined Cypher, not LLM-generated queries.
4. Fact extraction: facts only between extracted entities, `relation_type` in ALL_CAPS plus a detailed fact sentence; the same fact may link several entity pairs (hyper-edges).
5. Fact dedup: hybrid search restricted to edges between the same entity pair, then LLM check.
6. Temporal extraction: LLM resolves relative dates against the reference timestamp into `valid_at` / `invalid_at`.
7. Invalidation: the LLM compares the new edge with semantically related existing edges; for temporally overlapping contradictions the old edge's `t_invalid` is set to the new edge's `t_valid`. On the ingestion timeline "new information always wins".
8. Communities: label propagation (chosen over Leiden because it extends incrementally: a new node joins the plurality community of its neighbours); periodic full refresh needed because drift accumulates. Community summaries are map-reduce; community names embedded for search.
9. Retrieval = search (cosine, BM25, BFS) -> rerank (RRF, MMR, episode-mentions, node-distance, cross-encoder) -> constructor (string template: facts with date ranges plus entity summaries).

## Data model (fields, statuses, stores)
Graph G = (N, E) with three subgraphs: episode (raw non-lossy, bidirectional index episode <-> derived edges), semantic entity (entities, facts), community. Bi-temporal: timeline T (event time) and T' (ingestion order). Each fact edge stores four timestamps: `t'_created`, `t'_expired` (system) and `t_valid`, `t_invalid` (world). The paper's HTML lost the symbols, but the text states this. Entities have name, summary, 1024-d name embedding; communities have summary and embedded name. Store: Neo4j (Lucene for BM25). Context template: "FACT (Date range: from - to)", with the instruction "If the fact is about an event, the event takes place during this time".

## Prompts / LLM usage
Per message: at least entity extraction, reflection, entity resolution (per entity), fact extraction, fact resolution (per fact), temporal extraction, plus invalidation checks, plus community summary updates. The paper gives no call count; cost was observed by us at 8-12 calls per session (ENGINE_IDEAS.md). Deterministic: embeddings, search, Cypher writes, community assignment. Appendix excerpts: "DO NOT create nodes for temporal information like dates, times or years (these will be added to edges later)"; "IMPORTANT: Only extract time information if it is part of the provided fact"; "Do not infer dates from related events"; "If only year is mentioned, use January 1st". No retrieval-time LLM except the optional cross-encoder.

## Evaluation
- DMR (MemGPT, 500 conversations, 5 sessions x 12 messages): Zep 94.8% (gpt-4-turbo) vs MemGPT 93.4% (their figure), full-conversation 94.4%; with gpt-4o-mini Zep 98.2% vs full-context 98.0%. The authors themselves call DMR inadequate: tiny, fits in context, ambiguous questions.
- LongMemEval_S (~115k tokens): gpt-4o-mini 55.4% -> 63.8% (+15.2%), gpt-4o 60.2% -> 71.2% (+18.5%); latency 31.3 s -> 3.2 s (mini), 28.9 s -> 2.58 s (4o); context 115k -> 1.6k tokens. Largest gains: single-session-preference, multi-session, temporal-reasoning (gpt-4o: 45.1% -> 62.4%). Regressions: single-session-assistant (-17.7% 4o, -9% mini); knowledge-update with mini -3%.
- Setup caveats: retrieved top 20 edges/entities, bge-m3 for embedding and reranking, gpt-4o-mini for graph construction, GPT-4o judge with LongMemEval prompts; latency measured from a Boston laptop to AWS us-west-2. Communities and BFS were not exercised.
- **Dispute (LoCoMo):** the Mem0 paper reports Zep J = 65.99 overall, 600k+ tokens per memory graph, and "hours" of delay before retrieval became correct. Zep's rebuttal (blog, not independently verified) claims Mem0 assigned the user role to both speakers, appended timestamps to message text instead of `created_at`, and ran searches sequentially; Zep reports 75.14% +/- 0.17 and p95 search 0.632 s. Treat both as vendor claims. The asynchronous-construction observation (memory not immediately queryable) is plausible and matches how the pipeline is built.

## Limitations
Authors: DMR weak; single-session-assistant regression; weaker models understand temporal data less; MemGPT could not be run on LME; community and BFS features not evaluated; fine-tuned extraction models and ontologies left as future work. Ours: no ablation of the temporal graph versus plain fact retrieval; no cost or call count; invalidation compares only semantically similar edges and always favours the newest ingested information (no event versus state distinction, no correction versus change); fact timestamps are "valid_at/invalid_at" only, with no precision field, so "March" becomes 1 March 00:00; single-user-oriented speaker handling.

## Implications for Recordare
- **Important, confirm D28:** the four-timestamp split (world `validFrom/validTo`, knowledge `recordedAt/expiredAt`) is exactly what the paper uses; keep our extra `corrects` vs `supersedes`, which the paper does not have. Apply it only to state facts (ENGINE_IDEAS rejection 1 stands).
- **Important, ADOPT:** add a `datePrecision` to every date (D21/D28 episode and fact fields). The paper's "year -> 1 January 00:00" rule is a source of false precision that our `datePrecision` avoids.
- ADOPT: pass the message reference timestamp to the extractor and forbid inferring dates from other events ("only dates directly stated"); extend the D23 date-calendar prompt with this wording.
- ADOPT (small): the context-constructor template that prints each fact with its date range, plus the line that an event "takes place during this time"; reuse it for `search_episodes` output (D12).
- ADOPT: episode <-> derived item bidirectional index (our `linkedNoteIds` plus provenance ids, D19/D28) so a fact can be cited back to the raw round.
- AVOID: communities / label propagation (periodic refresh required, no measured benefit in the paper); our daily/monthly digests (D8) cover the "global view" need.
- CHANGE nothing in D2: the paper's evidence that a graph helps is thin (benchmarks fit in context; no ablation), while its own table shows full-context beats Zep on DMR and single-session-assistant. Keep Layer 0 raw fallback (D13); the single-session-assistant regression shows derived memory loses assistant-side content. Decide explicitly whether Recordare extracts from assistant turns (important for agentic clients).
- Evaluation hygiene (H6): never trust a competitor's reproduction of our system or ours of theirs; document exact configuration (roles, timestamps field, parallelism) when comparing.
