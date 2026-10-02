# MemDelta: Controlled Baselines and Hidden Confounds in Agent Memory Evaluation (Kuan Wang, 2026, arXiv:2606.29914)
Read: arXiv abstract page and arXiv HTML (via a fetch tool returning extracted passages, not raw full text; tables below are from those extracts). Code/Data: no repository linked; uses public LongMemEval-S.

## Problem
Reported gains of memory systems conflate several variables: the retrieval quality, the embedding model, the reader LLM and the write-path cost. Papers compare a fancy system against a weak or unspecified baseline, so "the memory architecture helps" is not established.

## Method (how the analysis works)
Single-variable isolation protocol on LongMemEval-S (500 questions; 39-66 sessions, ~115k tokens each). Strategies:
- S0 question only (lower bound); S_rand random ~5K-token chunks (separates "relevant" from "any context");
- S2 agent self-memory scratchpad (4,096-token budget, ~250 LLM calls to write);
- S4 verbatim RAG with all-MiniLM-L6-v2 (384d); S4b verbatim RAG with OpenAI text-embedding-3-small (1536d);
- S1 full conversation in context; S3 Mem0 v2.0 extraction pipeline (embeddings: ada-002).
Reader models: GPT-4o-mini (n=500), Claude Sonnet (n=300-500), Gemini 2.5 Flash (n=100). Judge: binary GPT-4o-mini that sees only ground truth and the answer (not the memory/context). Statistics: McNemar paired test, 95% bootstrap CIs (2,000 resamples), alpha 0.05.

## Key findings (with numbers)
- Embedding swap alone (S4 -> S4b): 47.2% -> 53.4% (+6.2pp, p=0.004). By type: temporal +10.5, multi-session +11.3, SS-user +11.4, knowledge-update 0.0, SS-assistant -5.4, SS-preference -10.0. So the effect is type-dependent and can be negative.
- RAG vs full context is model-dependent: GPT-4o-mini S1 49.8% vs S4 47.2% (n.s.); Claude Sonnet RAG 44.7% vs full 14.0% (Sonnet refused 63% of full-context queries; at 47K tokens refusal drops to 41% and accuracy rises to 38%); Gemini 2.5 Flash full 70% vs RAG 56%. Rankings flip across model families.
- Self-memory scratchpad is worse than plain retrieval: 42.0% (n=100), -5.2pp vs S4; multi-session 3.3%; write cost ~90 min, ~250 calls, $0.34.
- Mem0 v2.0 on a matched n=88 subset (68 SS-user, 20 multi-session): 72.7% vs cloud RAG 73.9% (McNemar p=1.0) at ~50x write-path cost (~120 min, 1,000+ calls, $0.50+ per instance). Multi-session: Mem0 20% vs RAG 25%. Parity on only 2 of 6 types, and temporal/KU were excluded for cost.
- Per type, GPT-4o-mini: knowledge-update favours full context (71.8% vs 62.8% RAG), because "most recent" needs seeing everything; SS-preference 40% (S4), 30% (S4b), 13% full.

## Evaluation practices worth copying
- Always include a named verbatim-RAG baseline and report its embedding model; test sensitivity to swapping it.
- Include a random-chunk control (S_rand) and a no-context control (S0) to detect leakage / answerability from priors.
- At least two reader-model families; report whether rankings persist.
- Report write-path cost (LLM calls, wall time, dollars) next to accuracy; matched-instance comparisons for costly systems.
- Paired significance tests and CIs; judge sees only gold and answer.
- Truncation/length control to separate "cannot do the task" from "refuses at long context".

## Limitations
- Mem0 on only 88 instances and 2 of 6 types; Sonnet runs partial.
- Single synthetic dataset; real-world generalisation untested.
- S4b vs S3 use different OpenAI embeddings, so the embedding control is approximate.
- One judge (GPT-4o-mini) for all models; human spot checks recommended but not done.

## Implications for Recordare
- CHANGE (important): our noise scores are single runs on 24-28 questions; RESULTS.md itself puts variance at +-4 points (one question = 3.6-4.2 points). Add paired comparison (McNemar or bootstrap over questions) and N>=3 seeds before any "D beats X" claim; flag differences under the noise floor automatically in the harness (3.4, 4.6). This is the main ruling that our current decisions (D23 gaps of +8..+25 points) are fine for large gaps but not for fine prompt tuning.
- ADOPT (important): keep embedding model constant across systems, and report it. RESULTS.md round 1 used MiniLM and round 2 bge-m3 (baseline 56 -> 67%), a confound the paper quantifies at 6.2pp; never compare rows across rounds.
- ADOPT: add S0 (no memory) and random-context controls to the suite; our questions are in Italian with synthetic lives, so a no-memory run should score ~0% on specifics and also reveals judge leniency.
- ADOPT: write-path cost columns (calls, tokens in/out per message, wall time, dollars) per run; we already have per-call `USAGE` accounting; make it a first-class result and the CI budget gate of 4.4c. Compare D's cost against a plain RAG baseline, not only quality (Mem0 ~50x for parity).
- ADOPT: a full-context baseline for small datasets (our base set of 17 sessions fits in context); it tells us when memory is unnecessary. Use at least two reader model families in the provider matrix (4.5b); the ranking may flip.
- ADOPT: matched-subset reporting when expensive systems cannot run everything.
- Watch: knowledge-update and "latest" questions favour seeing everything; keep a `latest` mode and a KU category in 4.4b.
- AVOID: self-written scratchpad/summary memory as an alternative design (-5pp vs RAG, collapses on multi-session); supports D13's raw-log fallback.
