# Beyond Dialogue Time: Temporal Semantic Memory for Personalized LLM Agents (Su et al., ICT-CAS / Meituan, ACL 2026 per the repo README; arXiv v2 Sep 2026, arXiv:2601.07468)
Read: full PDF text (all sections, appendix, all tables, judge prompts) plus the repo README via a summarising fetch only (source files and prompts in the repo were NOT inspected); Code: https://github.com/cosmicexotic/TSM (released, v0.1.1, `main_time.py`, `graphiti_extractor.py`, `temporal_extraction.py`, `temporal_filter.py`; the README says live benchmark runs were not re-done for the public release)

## Problem
(1) *Temporal inaccuracy*: memories are organised by dialogue time, not event time (talking on May 28 about a trip on May 29). (2) *Temporal fragmentation*: point-wise entries lose durations and persistent states (a week of Tokyo-trip mentions stays disconnected).

## Mechanism (how it works — concrete, step by step)
1. **Episodic layer = temporal knowledge graph (TKG)**, built "following Zep": per chat turn (with a window of the preceding n turns) entities and relations are extracted; facts are `(e_s, r, e_o, t)`; each entity has a canonical name and an LLM-written summary. The TKG is explicitly *an index, not retrievable content*, with a bidirectional index fact -> originating chat turns.
2. **Durative layer**: the TKG is cut into fixed monthly slices; within each slice entities are clustered with a Gaussian Mixture Model over name embeddings; per cluster an LLM writes a **Topic** summary (from entity summaries) and a **Persona** summary (from the turns mentioning those entities), each with slice timestamp and embedding.
3. **Query time**: `ParseTime(q, t_now)` (spaCy, deterministic) gives a semantic-time range T_q. Dense top-K (K=25) over topics + personas + raw turns; topics/personas are then filtered by `tau(m) in T_q` (post-retrieval); raw turns are never filtered. TKG facts with `t in T_q` are mapped back to their chat turns and used to promote those turns. Final order is lexicographic: (indicator in-range, similarity).
4. **Update**: online, per fact one of `DUPLICATE`, `ADD`, `INVALIDATE`, `UPDATE`, comparing semantics and time with existing edges; facts get `valid_time` / `invalid_time`. Offline "sleep-time" re-clustering and re-summarisation of topics/personas monthly or when accumulated turns exceed a threshold.

## Data model (fields, types, statuses, stores; quote exact field names)
- TKG fact `(e_s, r, e_o, t)`; entity `e = (n_e, s_e)`; edge fields `valid_time`, `invalid_time`. Stored in Neo4j (repo has Neo4j utilities).
- `Topic_z = {tau_k, s_z, c_z}`, `Persona_z = {tau_k, p_z, u_z}` (slice id, text, embedding). Raw: chat turn with dialogue timestamp.
- No importance, status, origin, precision or disclosure fields. "Point-like vs durative" is only the split between TKG facts and monthly topic/persona summaries; no explicit interval type.

## Prompts / LLM usage (number of calls, what is LLM vs deterministic code; short excerpts of key prompt wording if available)
Extraction/update prompts are **not given** in the paper (only judge prompts, Appendix A.4). LLM calls: per-turn entity/relation extraction (only user messages used "for efficiency"), per-edge update decision, per-cluster Topic and Persona summarisation, one answer call. Calls per turn: not stated. Deterministic: spaCy time parsing, GMM, temporal filter, lexicographic rerank.

## Evaluation (datasets, metrics, baselines, key numbers incl. tokens / API calls / latency)
LongMemEval_S (500 q, ~115k tokens) and LoCoMo; GPT-4.1-mini judge; single run; GPT-4o-mini and Qwen3-30B-A3B backbones. LongMemEval_S, GPT-4o-mini: TSM 74.80 overall vs A-MEM 62.60, Naive RAG 61.0, Zep 60.2, Full Text 56.8; Temporal 69.92 (A-MEM 47.36), Multi-session 69.17, Knowledge-update 80.77, Single-preference 40.00 (worst category). LoCoMo overall 76.69 (GPT-4o-mini), but Full Text beats TSM with Qwen (74.87 vs 71.23); the LoCoMo per-category table looks corrupted (Full Text row repeats LongMemEval numbers), so ignore it. Ablation: no temporal -2.0 (Temporal -6.0); no persona/summary -1.4 (Preference -16.7). Cost (Table 4): TSM 2,065k total tokens, recall P50/P95 1.57 / 2.39 s; sleep-time variant 1,960k. Baseline rows are copied from LightMem, whose own total is about 28k online / 111k with offline update, so TSM is roughly 20-70x more expensive.

## Limitations (as admitted by authors + your own observations)
Authors: fixed monthly granularity; personalisation only; single run. Ours: (a) the TKG alone is insufficient — their own case study shows no graph fact answered the question, raw turns were needed; (b) the filter is month-grained and whether `tau(m)` containment or overlap is meant is not stated; (c) time ablation is only -2.0, so much of the gain comes from durative summaries; (d) Persona inferences carry no stated/inferred flag; (e) no plan/event distinction.

## Implications for Recordare
- **Adopt (confirms D1-D12)**: separating event time from dialogue time with a query-side time range is the paper's core and matches our `occurredAt` + `search_episodes from/to`. Independent confirmation of LongMemEval's time-aware query expansion.
- **Adopt, D12 (important)**: keep time parsing deterministic (they use spaCy). Our "deterministic period resolver" is the right call; add a unit test corpus of relative expressions in IT and EN, and use the *message* timestamp as reference, as they do for LoCoMo.
- **Adopt, D12 ranking**: they rank by (in-range, similarity) lexicographically (hard time prior). When a range is given, in-range-first is simpler than our additive recency+importance+relevance score and easy to test.
- **Change, D8 digests**: their monthly topic/persona consolidation helped Multi-session and Preference questions (-16.7 on Preference without it). Our day/month digests are chronological; consider an optional *thematic* month summary (topic clusters) for preference/aggregate queries. Not for v1; record as an eval hypothesis.
- **Avoid**: GMM clustering and per-turn graph extraction — about 20-70x LightMem's cost for +6 points on one benchmark; contradicts our cost principles (ENGINE_IDEAS). Their update ops (DUPLICATE/ADD/INVALIDATE/UPDATE) are Graphiti's and share its flaw (facts treated as states), already rejected.
- **Observation, D28**: no plan/event split, date precision or status in TSM; our model is richer. Their entity/turn index is weaker than our Layer 0 pointers.
