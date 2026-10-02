# StateMemBench: Can Agent Memory Systems Track Evolving State? (Fan, Liu, Yang, Ouyang, Han; UIUC, 2026, arXiv:2608.19652)
Read: full PDF text (main paper plus appendices incl. prompts E.1-E.3, wrapper F, limitations H); Code: no repository URL found in the paper (benchmark and annotation kit are stated as "released with the benchmark", no link read)

## Problem
Recall benchmarks (LoCoMo, LongMemEval) do not test whether memory reflects the CURRENT state after facts, rules and decisions are revised across sessions. "State drift": the relevant fact is in context but the agent acts on a stale or incomplete version. Drift is shown to persist under perfect retrieval: on LongMemEval oracle (recall = 1.0), 44.4% (16/36) of DeepSeek-V4-Flash failures are drift; multi-session questions drift ~3x as often as knowledge-update ones (71.4% vs 25.0%). Enabling reasoning did not help (84.0% to 76.0%, n=50).

## Mechanism (StateMem, three stages)
1. **Ingestion**: a `TurnEncoder` makes ONE LLM call per conversation turn, given the compact rendering of all active units; it outputs `add` and `supersede` operations ("Look ACTIVELY for supersession patterns: actually, instead, no longer, switched to...").
2. **Update**: the store applies flagged supersessions (old unit status `superseded`, replacement added active). A deterministic `Rechecker` walks dependency graph `G=(U,E)`: every unit with an edge to a unit whose status just changed gets `needs_recheck` (O(|E|), zero LLM calls).
3. **Test time**: a deterministic renderer groups active units (including `needs_recheck`, shown with the trigger that flagged them) into "BINDING", "PREFERENCES (yield if necessary)", "NEEDS RECHECK" blocks, adds dates as recency markers and a "today" anchor; ONE answer call with a recompute guidance prompt ("A unit flagged NEEDS RECHECK is STALE ... RECOMPUTE it").

## Data model
State unit `u = (id, content, priority, source, deps)`: `priority in {hard, soft}`; `source` = originating turn and speaker; typed links `derived_from` (value computed from another unit) and `coupled_with` (validity depends on another unit's status); optional `triggers` with kinds `date_passed | entity_closed | supersession_announced | cascade`; free-form `type`, `scope`, `source_type in {user, action, tool_result}`. Status: active / `superseded` (kept for audit, withheld from answers) / `needs_recheck` (active but flagged). Units stamped with turn date when available.

## Prompts / LLM usage
Ingestion 1 call/turn; update 0 calls; answer 1 call. Optional `PolicyEncoder` once per scenario. Wrapper variant: 0 extra calls, replaces the backend's answer call with a fused "Trace then Resolve" call (trace capped at 250 words: initial value, each revision, current value per slot, with turn numbers; four precedence rules: later supersedes earlier, standing rules outrank instances, derived quantities recomputed not quoted, a fact is retired only by explicit supersession or expiry). All temperature 0, reasoning off.

## Evaluation
Benchmark: 234 multi-session scenarios (Set A 190 short, ~165 turns; Set B 44 long fused, ~600 turns, 3 probes), 322 closed-pool probes; domains research, shopping, personal finance. Scenarios are symbolic event programs replayed by a deterministic evaluator, rendered by an LLM. Failure modes by construction: status, salience, sequence, compound, plus anti-trap (anchored value stays correct; tests over-invalidation). Closed-pool grading separates "drift answer" from "other".
- DeepSeek-V4-Flash gold rate: StateMem 0.363 vs Dense 0.205, A-Mem 0.199, Mem0 0.177, long-context 0.149, LightMem 0.012, MemoryOS 0.025. Qwen-3.5-9B: StateMem 0.233 vs GraphRAG 0.224 (not significant), Mem0 0.149.
- Ablation (DeepSeek): extraction-only 0.174; + supersession 0.298 (largest step); no dependency propagation 0.373 (propagation over-fires on anti-traps, -12.5pp); no recompute guidance 0.301.
- Recall benchmarks: LongMemEval 0.656 (best memory system), temporal-reasoning 0.624 vs long-context 0.391.
- Wrapper on six backends: +32 to +67 points; matched control attributes +15 to +32 to structure. A question-blind summary is worse than none.

## Limitations
Authors: synthetic data; traps come from the same "lazy reader" policy family StateMem counters, so margins are an upper bound; short scenarios (3k-15k tokens); dependencies are stated explicitly, not inferred. Own: absolute accuracy stays low (0.36); one run per cell; full active state is rendered, so it does not scale without slicing; per-turn LLM call is costly; judge agreement across model families only kappa 0.37.

## Implications for Recordare
- **ADOPT (important), D28 facts**: supersession marking is the single biggest gain; keep `supersedes` and make the extractor see current facts (already in D23) with explicit cue phrases ("actually", "no longer", "switched to") in the prompt.
- **ADOPT (important), D28**: add `derivedFrom` (fact ids) plus a deterministic `needsRecheck` flag on facts, propagated by code when a source fact is superseded/corrected; recompute at answer time via flagged render. Absent from D28 today (derived values like "monthly savings", "days off left" go stale).
- **ADOPT, D12 / recall**: return the value chain per slot (initial, each revision, current, dates) instead of only the current value; the wrapper's trace beat plain context. `search_episodes` for fact slots should render superseded history compactly with dates.
- **ADOPT, eval (H1/H6)**: add anti-trap cases (unchanged fact restated, scoped exception that must NOT invalidate) and closed-pool drift labelling to our held-out set; track over-invalidation, not only accuracy. Our D23 "restated unchanged facts are dropped" needs such a test.
- **ADOPT**: failure taxonomy status / salience / sequence / compound as eval tags.
- **CHANGE**: propagation should be conservative (it hurt anti-traps): mark `needs_recheck`, never auto-rewrite.
- **AVOID**: per-turn LLM ingestion (conflicts with D1 idle+nightly batching); rendering all units into every prompt.
