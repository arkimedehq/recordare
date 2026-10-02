# HaluMem: Evaluating Hallucinations in Memory Systems of Agents (Chen, Niu, Li, Liu, Zheng, Tang, Li, Xiong, Li; arXiv:2511.03506, v3)
Read: arXiv HTML v3 (via a fetch tool returning extracted passages, not raw full text; metric formulas and tables are from those extracts; judge prompts not seen). Code/Data: https://github.com/MemTensor/HaluMem ; https://huggingface.co/datasets/IAAR-Shanghai/HaluMem

## Problem
End-to-end QA accuracy hides where a memory system fails. A wrong answer may come from extraction (omission or fabrication), from updating (stale or hallucinated edits), or from retrieval/answering. HaluMem measures hallucination per memory operation.

## Method (how the benchmark works)
- Two datasets: HaluMem-Medium (20 users, 30,073 turns, ~160k tokens/user, 69 sessions/user) and HaluMem-Long (~1M tokens/user, 121 sessions, padded with irrelevant ELI5 and generated dialogues). Both: 14,948 memory points, 3,467 QA pairs.
- Six-stage synthetic pipeline: persona (Persona Hub) -> life skeleton -> event flow -> session summaries with annotated memory points (content, type, importance) -> multi-turn session generation with adversarial content and verification -> questions. Manual check of 700 sessions: 95.7% correct, relevance 9.58/10, consistency 9.45/10.
- Memory-point types: persona 9,116; event 4,550; relationship 1,282; update 3,122; distractor 2,648 (false memories the system should not store).
- Question types (3,467): basic fact recall 746, multi-hop 198, dynamic update 180, memory boundary 828 (unknown info), memory conflict 769, generalization and application 746.
- Three tasks with gold at every step (the system's stored memories are inspected after each session):
  1. Extraction: Memory Recall (1/0.5/0 per point), Weighted Recall (by importance), Memory Accuracy (score over all extracted memories), Target Memory Precision, False Memory Resistance (distractors not stored), F1 of recall and target precision.
  2. Updating: accuracy, hallucination rate, omission rate (over target updates; top-10 retrieved memories).
  3. QA: accuracy, hallucination rate, omission rate (top-20 memories).
- Scoring by GPT-4o with prompt templates.

## Key findings (with numbers)
- Medium: recall below 60% for most systems: Mem0 42.9%, Mem0-Graph 43.3%, Memobase 14.6%, Supermemory 41.5%, MemOS 74.1% (Zep exposes no memory inspection, so QA only). Target precision high (86-92%) but memory accuracy only 32-62%, i.e. many extracted memories are wrong or untargeted. FMR 45-81%.
- QA accuracy Medium: Mem0 53.0, Mem0-Graph 54.7, Memobase 35.3, MemOS 67.2, Supermemory 54.1, Zep 55.5. Long: Mem0 28.1, Mem0-Graph 32.4, Memobase 33.6, MemOS 64.4, Supermemory 53.8, Zep 50.2. Recall collapses on Long for Mem0/Memobase (3-6%).
- Updating: accuracy drops sharply; omission rates exceed 50% for several systems.
- Errors propagate: QA accuracy tracks upstream extraction quality. Systems do best on boundary and conflict questions, worst on multi-hop, dynamic update, generalization.
- Event memories are the weakest type for most systems (Mem0 event accuracy 29.7% vs persona 33.7%; MemOS 63.4 / 59.8).
- Cost: dialogue-processing time Medium Mem0 ~2,810 min, Memobase 433, Supermemory 369, MemOS 1,049; the fastest systems extract the least.

## Evaluation practices worth copying
- Score each pipeline stage against gold memory points, with 1 / 0.5 / 0 partial credit and importance weights.
- Three-way outcome for answers: correct / hallucinated / omitted (not just right or wrong).
- Distractor memory points as an explicit negative class (false memory resistance).
- Memory-boundary questions (unknown info) and conflict questions (user states something incompatible with memory) as separate categories.
- Cross-check extraction recall against precision, since a system can look precise by extracting little.

## Limitations
- Fully synthetic, LLM-generated users with templated life trajectories; memory-point gold is fixed to one granularity, so systems with different schemas (episodes vs atomic facts) are matched via an LLM judge.
- Needs access to the system's stored memories (Zep not evaluable on extraction).
- GPT-4o as sole scorer; no reported human audit of scorer errors or adversarial judge testing.
- Extracted figures here come from a summarising fetch; exact judge prompts and score aggregation details should be checked in the repo before reuse.

## Implications for Recordare
- ADOPT (important): per-stage evaluation, not only end-to-end QA. Today the harness only scores final answers, so a regression in episode extraction is indistinguishable from a recall or answering regression. Add an extraction check against gold episode/plan annotations per dataset session (task 4.4b, 4.6): episode recall, target precision, false-memory resistance on distractors, plan-update accuracy/omission/hallucination.
- ADOPT (important): three-way answer outcome correct / hallucinated (asserted unsupported or contradicted fact) / omitted ("Non mi risulta" when memory had it). This is exactly H1's unjustified-assertion and over-abstention rates (4.5c); our judge's correct/partial/wrong conflates them and `must_not` mixes hallucination with benign mention.
- ADOPT: distractor items in the dataset (look-alike content of another person, already present for `davide`/`elena`; add false statements, hypotheticals, things the user denies, and third-party facts) to measure false-memory resistance; verify per-person isolation as a test.
- ADOPT: separate update-operation tests (reschedule, cancel, correction) with omission vs hallucination counts, aligning with D28 plan statuses and `corrects` / `supersedes`.
- ADOPT: report ingest time and tokens per message as in their efficiency table; note that the quickest systems extract least, so cost and recall must be shown together.
- Caution: HaluMem shows low extraction recall is the dominant failure; our D episodes extractor is judged only via QA, so recall of extraction is currently unmeasured. Long-context padding (their Long set) supports our noise-set approach.
- AVOID: assuming a single memory granularity for gold; annotate gold as free-text facts with dates and match by judge, so engine variants (Memobase-like, D) stay comparable.
