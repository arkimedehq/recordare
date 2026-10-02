# LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive Memory (Wu, Wang, Yu, Zhang, Chang, Yu; ICLR 2025; arXiv:2410.10813)
Read: arXiv HTML (via a fetch tool that returns extracted passages, not raw full text; the figure/table numbers below come from those extracts) plus the judge script `src/evaluation/evaluate_qa.py` from the repo. Exact judge prompt wording was only partly visible (quoted fragments only). Code/Data: https://github.com/xiaowu0162/LongMemEval

## Problem
Prior long-term-memory benchmarks (LoCoMo etc.) use human-human chit-chat, short histories, and test mostly plain recall. LongMemEval targets a user-assistant setting with long, task-oriented histories and five abilities: information extraction, multi-session reasoning, temporal reasoning, knowledge updates, abstention.

## Method (how the benchmark works)
- 500 hand-curated questions, built from a human ontology of 164 user attributes in five categories (demographics, lifestyle, situational context, life events, belongings). LLMs write attribute-focused background; humans filter and rewrite seed questions.
- Seven types: single-session-user, single-session-assistant, single-session-preference, multi-session (MR), knowledge-update (KU), temporal-reasoning (TR), plus abstention (ABS, 30 questions made by modifying other types into questions about never-mentioned information).
- Evidence statements are embedded indirectly in task-oriented dialogues (self-chat simulation), then humans screen them. Most questions need evidence from several sessions (up to six).
- History = evidence sessions shuffled with filler (25% ShareGPT, 25% UltraChat, 50% simulated sessions). Timestamps: pre-defined evidence timestamps act as anchors, others are assigned around them (otherwise random in May 2023).
- Two scales: LongMemEval_S (~115k tokens, ~50 sessions) and LongMemEval_M (500 sessions, ~1.5M tokens).
- Unified framework: indexing (history -> key/value items), retrieval (dense, Stella V5 1.5B), reading (LLM). Four control points: value granularity, key expansion, query (time-aware), reading strategy. Metrics: Recall@k / NDCG@k for retrieval, QA accuracy end-to-end.
- Judge: GPT-4o (gpt-4o-2024-08-06), temperature 0, max_tokens 10, answer parsed by "yes" in output; **separate prompt per question type**; reported >97% agreement with human experts (30 questions per type sampled).

## Key findings (with numbers)
- Long-context LLMs on _S lose accuracy vs oracle evidence: GPT-4o 0.606 (-30.3%), Llama 3.1 70B 0.334, Llama 3.1 8B 0.454, Phi-3 variants 0.34-0.38.
- Commercial assistants in an online, session-by-session pilot (97 questions, 3-6 session histories): ChatGPT 0.577 vs 0.918 offline (-37%), Coze 0.330 (-64%). ChatGPT overwrote crucial information; Coze failed to record indirectly stated facts.
- Value granularity: round-level (turn pairs) beats session-level for GPT-4o; fact-only values hurt overall through information loss, but help multi-session reasoning.
- Key expansion (Recall@5, sessions / rounds): K=V 0.706 / 0.582; K=V+fact 0.732 / 0.644; K=V+summary 0.689; K=V+keyphrase 0.710; keys of facts alone 0.642 / 0.530; keyphrase alone 0.482 / 0.282. Document expansion with extracted user facts: +9.4% average recall, +5.4% final accuracy across models.
- Time-aware query expansion (LLM extracts a time range, index filtered by timestamp): temporal subset Recall@5 0.421 -> 0.451 (rounds, K=V), up to +11.3% with K=V+fact; Llama 8B as time extractor hallucinates or misses cues.
- Reading: Chain-of-Note + JSON-structured reading prevents up to a 10-point drop for GPT-4o; not universally helpful (Llama 70B drops with CoN).
- Token budget matters: Llama 8B degrades beyond ~3k retrieved tokens, GPT-4o keeps improving beyond 20k.

## Evaluation practices worth copying
- Per-type judge prompts with explicit edge rules: TR "do not penalize off-by-one errors in number of days/weeks/months"; KU "correct if the response contains previous information along with the updated answer, as long as the updated answer is the required one"; preference "does not need to reflect all rubric points, only use the user's personal info correctly"; ABS "yes if the model identifies the question as unanswerable".
- Report accuracy per question type, not only overall; report retrieval recall separately from QA accuracy, so retrieval and reading faults are separable.
- Oracle-evidence run (reader given only gold sessions) as an upper bound that isolates the reader.
- Test both offline reading and true online memory (assistant ingests turn by turn).
- Meta-evaluate the judge against humans per type.

## Limitations
- Synthetic, English, task-oriented dialogues; filler is generic chat, so distractors are not lexical traps for a specific user.
- _S (115k tokens) now fits in modern context windows (see MemDelta, Penfield), so it does not force retrieval.
- Judge is binary and "yes"-parsed with max_tokens 10 (no reason given); no adversarial judge validation, only agreement with humans on sampled real outputs.
- Paper does not list limitations explicitly; commercial study is small (97 questions, short histories).

## Implications for Recordare
- ADOPT (important): per-category reporting in our suite. Today RESULTS.md reports a single percentage over 24-28 questions; add category tags (lookup, multi-session aggregation, temporal, update/correction, abstention, plan status) to questions.json and report per category (tasks 3.4, 4.4b, 4.5c).
- ADOPT (important): an explicit abstention / unanswerable category. Our judge has `must_not`, but there is no "never mentioned" question set with a dedicated rule; H1's unjustified-assertion and over-abstention rates (4.5c) should use the LongMemEval ABS framing, split from "unknown outcome of a plan".
- ADOPT: separate retrieval metric (Recall@k of gold episodes/messages) next to QA accuracy, so a regression can be localised to encoding vs recall vs reading (4.6). We already have `emb_eval.py` for embeddings only.
- ADOPT: per-type judge rules. Our single JUDGE_SYSTEM applies `must_not` to any mention, which RESULTS.md already shows under-scores correct answers (flash "wrong" artefacts). Adopt the KU rule (old value mentioned alongside the correct current one is fine) and an off-by-one rule for durations; keep strict `must_not` only where the old value is asserted as current.
- ADOPT: oracle-context run (gold episodes given to the answerer) as the upper bound for 4.6.
- Validates D12/D13 design: time-aware range filter (+6.8..11.3% recall on temporal), fact-augmented keys (episode text plus extracted facts as the embedded document), round/turn-level raw log fallback; avoid fact-only storage (information loss) - supports keeping the raw log (D13).
- CHANGE: our judge uses `max_tokens=3000` with a reason; fine, but add a human-labelled calibration set (see penfield-locomo-audit.md).
- AVOID: using LongMemEval_S as our main bar; use it only as an external sanity run (it fits in context).
