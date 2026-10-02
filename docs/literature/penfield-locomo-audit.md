# We audited LoCoMo: 6.4% of the answer key is wrong and the judge accepts up to 63% of intentionally wrong answers (Penfield Labs, Apr 2026, github.com/dial481/locomo-audit)
Read: the dev.to post (via a fetch tool returning extracted passages, not raw full text), the audit repo README (structure and findings summary), and search-result snippets; I did not run the scripts or read individual error packages or judge prompts. Code/Data: https://github.com/dial481/locomo-audit (CC BY-NC 4.0, includes LoCoMo10 with SHA256, audit packages, judge stress test, full-context baseline runs); post https://dev.to/penfieldlabs/we-audited-locomo-64-of-the-answer-key-is-wrong-and-the-judge-accepts-up-to-63-of-intentionally-33lg

## Problem
LoCoMo (arXiv:2402.17753) is the most quoted long-term-memory benchmark; vendors publish scores on it (EverMemOS, Mem0, Zep, ...) and disputes follow. The audit asks whether the answer key is right and whether the LLM judge can tell right from wrong.

## Method (how the analysis works)
- Manual and scripted audit of all 1,540 scored questions (the 446 adversarial category-5 questions are unevaluated in the EverMemOS setup because of broken multiple-choice formatting) against the source conversations.
- Impact analysis of errors on five published systems with Wilson score confidence intervals.
- Adversarial judge test: for every one of 1,540 questions an intentionally wrong but topically adjacent answer was generated and scored with the published judge setup (gpt-4o-mini, published prompts; roughly 1,485 judge calls).
- Independent full-context baselines (4 runs) and a methodology review of prompts, token costs and reproducibility.

## Key findings (with numbers)
- 99 of 1,540 questions (6.4%) have score-corrupting wrong gold answers, so the ceiling for a perfect system is about 93.6% (93.57%). Categories: hallucinated facts in the key (e.g. "Ferrari 488 GTB" where the conversation only says "this beauty" and a "red sports car" caption), incorrect temporal reasoning (24+ date-arithmetic errors, e.g. "last Saturday" resolved to the wrong day), speaker-attribution errors (24 questions).
- The judge accepted 62.81% of intentionally wrong answers. Specific wrong facts (wrong name or date) were caught about 89% of the time, but vague answers that name the right topic without specifics passed about 67%. This rewards weak retrieval that finds the right conversation but extracts nothing.
- Category sizes differ 8.8x (96-841 questions); 56% of adjacent-system comparisons are statistically indistinguishable at 95%; open-domain needs a 15+ point gap to separate two systems.
- Token-cost claims do not match the paper's own table (2,298 claimed vs 6,669 average, so reduction vs full context is 67%, not 89%); third parties report 38.38% vs a claimed 92.32%.
- LongMemEval-S (~115K tokens) fits in modern context windows: full-context baseline 60.2% vs 84.2% for an observational-memory system, so it measures context efficiency more than retrieval.
- Quote: "When a judge accepts 63% of intentionally wrong answers, score differences below that threshold are not interpretable."

## Evaluation practices worth copying
Six requirements the authors list: (1) corpus larger than the context window; (2) a judge stronger than gpt-4o-mini; (3) adversarial judge validation (feed it wrong answers); (4) realistic, conversation-based ingestion; (5) published pipeline disclosure: ingestion method, embedding model, generation prompt, judge model and prompt, number of runs, standard deviation; (6) ground-truth verification (compare with the ~3.3% label error of major ML benchmarks, Northcutt et al. 2021). Also: Wilson intervals per category; verify the dataset hash; use the same answer pipeline for all systems.

## Limitations
- Audit text is by a vendor-adjacent lab; the adversarial answers are one generation style (topical but wrong), the acceptance rate depends on that style and on the gpt-4o-mini judge.
- Category-5 adversarial questions are not audited, and the audit does not propose a corrected benchmark.
- My reading is from summaries; per-error evidence is in the repo.

## Implications for Recordare
- ADOPT (important): adversarial judge validation as a standing test (4.6 / 3.4). For each question generate (a) topical-but-vague, (b) specific-but-wrong (wrong date, old value of an updated fact, other person's fact), (c) correct-plus-extra-claim answers, and require the judge to reject (a) and (b) and accept correct paraphrases. Report judge false-accept and false-reject rates. Our judge is the same deepseek-flash as the answerer and was only checked ad hoc (flash "wrong" artefacts); we know false rejects exist (must_not over-strictness, in RESEARCH_NOTES H6) but have never measured false accepts, which would invalidate "partial" and "correct" scores.
- ADOPT (important): verify our gold. A second reader (not the author) checks each `expected` against the sessions, especially date arithmetic ("last Saturday", weekday resolution, year boundary in the holdout) and speaker/person attribution (luca vs elena/davide look-alikes). A 6.4% gold error rate inflates apparent gaps; our datasets are small enough to audit fully.
- ADOPT: fix the whole answer pipeline across systems (already done: identical answer + judge in common.py) and publish ingestion path, embedding model, prompts, judge model and number of runs in each RESULTS entry, with CIs; flag differences below the noise floor (our own measured +-4 points).
- ADOPT: require specifics in `expected` (names, dates, counts), because vague-but-topical answers pass lenient judges; judge prompt should demand the specific fact, with "partial" only for explicit partial facts.
- CHANGE: the judge model should be different from (and at least as strong as) the answering/engine model where budget allows; run the judge with several samples or a stronger model on disagreements.
- AVOID: using LoCoMo or LongMemEval-S headline numbers to compare ourselves with vendors; use them only as sanity runs. Keep our blind held-out discipline (RESULTS held-out check) as the stronger guard against overfitting, and re-write a new blind set when prompts change substantially (4.4b).
