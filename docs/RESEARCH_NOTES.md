# Research notes — hypotheses register

Status: **open register** (started 2026-10-02; statuses checked against `spikes/memory-eval/RESULTS.md` on
2026-10-08, after the v0.1.0 release). Where Recordare might contribute something new to
agent memory, beyond integrating known ideas. Each hypothesis has: the claim (narrowed after the
literature review), closest prior work, a verdict, how we would measure it, and what the phase-1
data model must already store so the experiment stays possible without migrations.

Literature review: 2026-10-02, three parallel searches (2023 → Oct 2026). Many 2026 items are
recent preprints, not peer-reviewed; several were read at abstract level only. Marks:
**[A]** abstract / HTML read, **[S]** search snippet only — verify before citing in anything
public. Rule: never claim novelty without re-checking this table.

Overall picture: phase 1 is ~85–90 % integration of known ideas (see `ENGINE_IDEAS.md`). The
genuinely open ground is narrow and lies mostly in the twin phases: disclosure for a personal
twin, holder vs twin provenance, and unresolved user plans.

## Summary

| Id | Hypothesis (narrowed) | Verdict | Phase |
|---|---|---|---|
| H1 | Unresolved **user** plans as epistemically unknown; event-accumulate vs state-supersede vs correction, tested jointly | Partially novel (narrow) | 1 |
| H2 | Disclosure for a personal twin: graded social tiers, third-party confidences, label propagation, adversarial interlocutors, prompt-only vs pre-retrieval filtering compared | Partially novel (mechanism published, combination + evaluation open) | 3 |
| H3 | Source monitoring for twins: holder-lived / holder-told / twin-experienced never mixed | Partially novel (narrow) | 3–4 |
| H4 | Legacy mode as enforceable mechanisms (frozen persona, executor state machine, pre-authorised actions) | Principles done; engineering open | 8 |
| H5 | Cost-aware memory (gates, cost per item) | Already done / crowded — engineering only | 1 |
| H6 | Eval method: blind held-out set by a separate agent; over-strict judge artefacts | Partially novel, modest (methods appendix) | 1 |
| H7 | Distilling the extraction engine into a small local model closes most of the local-model gap | To test (engineering hypothesis); the gap is now measured (below) | after M4 |
| H8 | Twin style: per-person fine-tuning vs few-shot retrieval of the holder's own messages | To test | 2 |
| H13 | Classify-and-compose extraction (a message-type router picks rule modules for one extraction call) and failure-driven module growth ("learning from surprise"), compared with the monolithic prompt on blind sets, with cost | Known, partially novel (narrow): the controlled monolithic-vs-composed comparison | 1 / R |
| H12 | Resting-state thinking ("default mode"): a budgeted background process that replays recent episodes, links them, keeps open loops (unresolved plans, promises), prepares questions / proposals and updates the self-model improves recall and initiative without confabulation | To design with M5 / track R | 5 / R |
| H11 | Retrieval beyond a single embedding: cross-encoder reranking, bge-m3 sparse vectors, a people / entity index improve recall on negations, exact details and "everything about X" | To test (engineering); recall fixes and a people-aware leg measured, reranker / sparse vectors not yet | 1 / 3 |
| H10 | Autonomous evolution: a twin free in thought and action drifts from its holder in measurable ways; lives from the same start diverge | To review (literature not yet searched) | R |
| H9 | Twin as a reflective companion of its holder (dialogue with oneself; non-sycophantic, evidence from own memories) | To review (literature not yet searched) | 4 |

## H1 — Plans, unknown outcomes, events vs states, corrections

**Claim (narrowed).** Existing agent-memory systems and benchmarks treat plans either as the
agent's own to-dos (trigger → done) or as ordinary facts. None represents a **user's plan whose
date passed without confirmation as "unknown whether it happened"** (to be answered "I don't
know if you went", not "you went" nor "not mentioned"), and none tests **event accumulation,
state supersession and retroactive correction together**, including correction (the old value
was never true) vs change (it was true until t).

**Closest prior work.**
- PM-Bench, Liu & Gabriel, COLM 2026, arXiv:2607.12385 [A] — prospective memory benchmark
  (Virtual Week), cancellations / reschedules / overrides; agent-side tasks, no unknown outcome.
- PIS — Typed Intention Stores, Zhao & Wu, arXiv:2609.01272 [A, PDF] — intentions with status
  pending / done / canceled, lifecycle in code; closest architecture; no expired-unknown state.
- StateMemBench, Fan et al. (UIUC), arXiv:2608.19652 [A] — evolving state, anti-trap and
  accumulation probes; no explicit event/state typing, no plan outcomes.
- STALE, arXiv:2605.06527 [A] — implicit conflicts, premise resistance.
- LongMemEval arXiv:2410.10813, LoCoMo arXiv:2402.17753, BEAM arXiv:2510.27246, TReMu
  arXiv:2502.01630 — abstention = information never mentioned (not unresolved plans).
- TSM (Temporal Semantic Memory) arXiv:2601.07468 [A] — event time vs dialogue time, durative states.
- Zep / Graphiti arXiv:2501.13956, Mem0 arXiv:2504.19413 — bi-temporal / CRUD updates; every
  fact a state.
- Linguistic precedents: TimeML (OCCURRENCE / STATE / I_STATE / I_ACTION); FactBank (Saurí &
  Pustejovsky) factuality value CTu "certain but unknown output" [S].
- Cognitive science: output monitoring, Scullin, Bugg & McDaniel 2011 [S]; Virtual Week paradigm.

**Verdict.** Partially novel, narrow. Do not claim "plan lifecycle" (PM-Bench, PIS exist).

**Measure.** Benchmark categories (multi-session haystacks, LongMemEval-style for
comparability): (a) plan resolution — confirmed / cancelled / rescheduled / unresolved, asked
after the date, incl. implicit confirmations; (b) premise traps ("how was Rome?" when cancelled
or unresolved); (c) paired accumulate vs supersede items with anti-trap controls; (d) correction
vs change, bi-temporal "as told" vs "as true" questions. Metrics: closed-pool grading
(correct / stale-or-assumed / abstained), **unjustified-assertion rate**, **over-abstention
rate**, Set-F1 for lists, cost per user. Baselines: full context, plain RAG, Mem0,
Zep/Graphiti, Memobase, Letta, A-Mem, a PIS-style typed store. Our two datasets already contain
seeds of (a)–(d). Since then the blind sets 3–7 carry plan categories (confirmed / cancelled / rescheduled /
unresolved, premise traps) and the service is measured on them (RESULTS.md). The two rates (4.5c, 2026-10-16, a second
grading of stored answers): on blind3 Recordare asserts least without support (0.028; Mem0 0.046, Cognee 0.065, D 0.065,
full context 0.037), but on the H1 categories themselves every system is near zero — these sets do not show H1; a
harder set (unresolved plans asked as if done, implicit outcomes, long histories) is needed, and Zep/Graphiti, Letta,
A-Mem and a PIS-style store are still to compare. That set, `dataset_blind12` (2026-10-19, 54 H1 questions, 1 run):
full context 95.4 % but asserts an unconfirmed outcome and takes a correction for a change (invented on unknown 0.077);
Recordare 92.6 %, nothing invented on unknown, unresolved plans and correction vs change all right; its own H1 error is
a same-day intention stored as done. Mem0 on the same set (3 runs): 93.2 % ± 4.3, but unjustified 0.093 and invented
on unknown 0.128 (in every run) — plans kept as events. First sign that the typed plan states help where full context and a fact store
fail; one run each.

**Phase-1 data model must store.** Plan status `open | confirmed | cancelled | rescheduled |
unresolved` (+ `rescheduledTo`, status date, evidence episode); episode kind
`event | plan | state-change`; facts with world time (`validFrom` / `validTo`) **and**
knowledge time (`recordedAt` / `expiredAt`); `corrects` (never true) distinct from `supersedes`
(true until t). — Built in phase 1 (`plan_status` with these values, `corrects` / `supersedes`, bi-temporal facts).

## H2 — Disclosure-aware memory for a personal twin

**Status: deferred (D50, maintainer 2026-10-09).** Answers use the whole memory in every conversation for now (WORK_PLAN
8.2); privacy and disclosure come later (8.12). The research below stays as the starting point of that work.

**Claim (narrowed).** Pre-context filtering by authenticated audience is published; what is open
is the **combination** for a personal twin: graded social tiers + per-person grants, provenance
of third-party confidences ("Marco told me X" → disclosable to holder and Marco only), label
propagation to derived artefacts (digests, notes, profile take the most restrictive source
label), tier only from channel binding (fail closed to public), and an **evaluation** that
compares prompt-only defences with pre-retrieval filtering on leakage and utility under
adversarial interlocutors.

**Closest prior work.**
- "Authorization Before Context", Sibo Liu, arXiv:2608.17148 [A, HTML] — **closest**: write-time
  audience tags, viewer set from channel metadata, fail to public; sets not tiers, no third-party
  handling, no adversaries, no prompt-only comparison, no code.
- AirGapAgent, Bagdasarian et al. (Google), arXiv:2405.05175 [S] — restrict data before the agent
  meets the third party (LLM minimiser, not labels).
- Collaborative Memory arXiv:2505.18279 [A]; AIM / MUMBench arXiv:2609.12320 [A] — multi-user
  memory with ACL / private-public; enterprise or two-level.
- CIMemories (Meta, ICLR 2026) arXiv:2511.14937 [A]; MuPPET arXiv:2606.23217 [A] (multi-party
  memory leakage 23–70 %, prompt-only defences); ConFaIde arXiv:2310.17884 [A]; PrivacyLens
  arXiv:2409.00138 [S]; SOTOPIA-ToM arXiv:2605.02307 [A].
- Third parties: IDP-Bench arXiv:2606.09908 [A] (evaluation only); audience labels: CIDER
  arXiv:2608.09164 [A].
- Adversarial: ConVerse arXiv:2511.05359 [A]; FLOWSEAL arXiv:2609.14003 [A]; MAGPIE
  arXiv:2510.15186 [S].
- Information-flow control: FIDES arXiv:2505.23643 [S], CaMeL arXiv:2503.18813 [S].
- Social delegates: "AI Delegates with a Dual Focus" (Microsoft) arXiv:2409.17642 [A].

**Verdict.** Partially novel. The mechanism alone is not new; the twin-specific combination and
its evaluation are.

**Measure.** Leakage: forbidden item in context, output leakage (exact / paraphrase), inference
leakage (combining allowed memories), existence leakage ("I can't tell you about the
surgery"). Utility: accuracy on allowed items, over-refusal. Adversaries: impersonation claims,
context hijacking, cooperative lures, multi-session probing, collusion of two low-tier users,
mixed-tier group chats. Baselines: no protection / prompt-only tiers / CI-reasoning prompt /
output filter / pre-retrieval filter / filter + prompt, on several LLMs incl. small local ones.
Weak spot to measure: **write-time labelling accuracy** (the filter is only as good as labels).

**Phase-1 data model must store.** `people` on episodes (D21) with resolved person ids later;
`source` of each memory (who told it, in which conversation, with which audience present);
a `disclosure` label column (default `holder`) on episodes, facts and digests; derived artefacts
keep the ids of their sources so labels can propagate. — Built in phase 1: `disclosure` (default `holder`) and
`audience` columns; reads followed a viewer rule (what is said in a conversation others take part in did not leak to
them) until D50 removed it (8.2) — the columns are still written. Tiers are not used yet (phase 3).

## H3 — Source monitoring: holder-lived vs twin-experienced

**Claim (narrowed).** Provenance-typed memory is an active 2026 topic, but nothing separates the
**principal's lived memories** from the **proxy's own interaction memories**, with the rule that
the twin never presents the latter as the former (and holder-told ≠ holder-lived).

**Closest prior work.** MemIR — typed memory against provenance-role collapse, arXiv:2605.25869
[A]; Reality Monitoring in LLMs arXiv:2607.23927 [A]; Mnemonic Sovereignty survey
arXiv:2604.16548 [A]; EP-Mem / EP-Bench arXiv:2609.35233 [A]; AirGapAgent; Park et al. 2024
arXiv:2411.10109 [S]; Second Me arXiv:2503.08102 [S]; TwinVoice arXiv:2510.25536 [S];
Johnson, Hashtroudi & Lindsay 1993 (source monitoring, classic).

**Verdict.** Partially novel, narrow (expect "MemIR + EP-Mem applied to twins").

**Measure.** Misattribution traps ("did you promise Marco the house?" when the twin, not the
holder, discussed it); rate of twin-experienced content asserted as holder's; holder digest
accuracy.

**Phase-1 data model must store.** `origin: holder_lived | holder_told | twin_experienced` on every
episode / fact (phase 1 writes only the first two) and the interlocutor of the conversation. — Built: phase 1 writes
`holder_lived`, `holder_told` and `assistant_stated` (assistant turns, D30); `twin_experienced` waits for phases 3–4.
<!-- verify: the origin enum has no `twin_experienced` value yet (InitialSchema) — added when the twin speaks to others -->

## H4 — Legacy mode

**Claim.** Principles are published; enforceable mechanisms are not: frozen persona with a
separate post-mortem log, executor activation as a state machine, pre-authorised action lists,
grief safeguards as policies, the art. 2-terdecies written prohibition as a field.

**Prior work.** Hollanek & Nowaczyk-Basińska, Philosophy & Technology 2024,
doi:10.1007/s13347-024-00744-w [S, press release read]; Morris & Brubaker, "Generative Ghosts",
CHI 2025, arXiv:2402.01662 [A]; Spitale & Germani arXiv:2511.20094 [A]; Manning et al.
arXiv:2605.21390 [A]; GDPR recital 27; Italian privacy code art. 2-terdecies.

**Verdict.** Principles done; engineering contribution only. Revisit in phase 8.

## H5 — Cost-aware memory

**Verdict.** Already done / crowded: MemDelta arXiv:2606.29914 [A], MERIT arXiv:2609.05441 [A],
Zero-Mem arXiv:2607.29377 [A], LightMem arXiv:2510.18866 [S], Sleep-time compute
arXiv:2504.13171 [S], Mem0 arXiv:2504.19413 [A]. We report write-path and read-path tokens / $
per stored item and per query as engineering results, citing these. No research claim.

## H6 — Evaluation methodology

**Verdict.** General critique done (Zep vs Mem0 dispute; Penfield Labs LoCoMo audit — 6.4 % wrong
gold answers, lenient judges; Thakur et al. arXiv:2406.12624 [S]; MemDelta). Partially novel and
modest: the **blind held-out set written by a separate agent** that never saw the prompts, and
the **over-strict judge** artefact (must-not rules penalising correct answers), the reverse of the
usual leniency. Measure judge false negatives against human labels; multiple seeds; full-context
and grep / RAG baselines. Methods appendix, not a headline. — Applied in phase 1: blind sets 3–8 written and re-read by
separate agents, 3 runs each with paired bootstrap; a seen set overstated the service (blind3 post-hoc 94.9 % → fresh
blind4 80.8 %), which is the evidence for the method (RESULTS.md).

## H7 — Distilled local extraction model

**Claim.** A 4–8 B open model fine-tuned (LoRA) on extraction outputs of a stronger model
(teacher: the certified cloud model) recovers most of the 12–23 points the local `qwen3:8b`
loses on the eval suite, at zero per-call cost and with data staying local. Measured since on the service (blind3,
1 run each, RESULTS.md 4b.4): `qwen3:8b` 59.7 %, Qwen3.5-9B 73.6 %, gpt-oss 20B 83.3 % against ~95 % for
`deepseek-flash` — a larger gap than the spike's, mostly extraction coverage and dates, not JSON validity.

**Prerequisites.** Stable extraction schema (after M4); training data only synthetic or
consented; per-run logging of extraction inputs / outputs (M3–M4). **Measure**: eval suite
(base + held-out, noise), local vs teacher vs untuned local; tokens/s on the reference box.
Supports D27 (one more certified model, never a requirement).

## H8 — Twin style: per-person fine-tuning vs retrieval

**Claim.** For reproducing the holder's writing style, few-shot retrieval of the holder's own
messages may reach most of the quality of a per-person LoRA without its costs (retraining,
per-person artefact that is an impersonation kit to protect). Compare in phase 2 with a
Park-style agreement harness and style metrics (blind human / LLM pairwise preference).
Prior work to review then: Second Me arXiv:2503.08102, TwinVoice arXiv:2510.25536, persona
consistency literature.

## H9 — The twin as a reflective companion of its holder

**Claim.** A twin talking with its own holder as a companion ("dialogue with oneself") is useful
when it is *not* an echo: it disagrees with evidence from the holder's own memories, surfaces
recurring patterns, and checks decisions against stated values. Measure against a sycophantic
baseline: holder-rated usefulness, agreement rate, and whether challenges cite real memories.
Risks: emotional dependency, reinforcing biases. **Prior work to search** (not yet reviewed):
"future self" chat studies (e.g. MIT Media Lab *Future You*, 2024 — verify), self-reflection and
journaling agents, LLM sycophancy literature, digital-twin companionship studies.

## H10 — Autonomous evolution of a twin

**Claim / questions.** A twin with self-directed reflection, its own goals and initiative without
confirmation (vision → Research mode) evolves: how far and how fast it drifts from its holder, which
goals it forms, how it handles its own errors, and whether several lives started from the same
twin diverge. **Measure** in a simulated agent society: Park-style agreement with the holder over
simulated time, opinion / value stability, goal logs, error taxonomy and recurrence, divergence
between lives (same seed vs different seeds). **Prior work to search** (not yet reviewed):
Generative Agents (Park et al. 2023) and agent societies / simulations, open-ended and
self-motivated agents, persona drift in long-running LLM agents, value drift.

## H11 — Retrieval beyond a single embedding

**Why.** An embedding is an index, not the memory: it blurs numbers, dates and names, puts negations
next to affirmations ("went to Porto" ≈ "never went to Porto"), does not understand time, scores
similar-but-irrelevant items high (a colleague's ski trip vs the holder's), and under-scores the
same event told briefly vs in detail (observed: ~0.6 similarity between the two tellings of the
orthopaedist visit). Recordare already keeps the memory structured (dates, statuses, history) and
fuses full-text + vector; the spike showed structure matters more than the embedding model.

**Candidates (each measured on the eval suite, N ≥ 3 runs, before adoption):**
1. **Cross-encoder reranking** of the top 20–30 candidates (e.g. `bge-reranker-v2-m3`, pairs with
   bge-m3; local, tens of ms) — reads query and memory together: negations, details.
2. **bge-m3 sparse (lexical) vectors** next to the dense ones — lexical precision with learned
   term weights, one model.
3. **People / entity index** (phase 3 `people`, aliases) — "everything about Marco" as an exact
   lookup instead of a similarity.
4. Optional, later: multi-vector (late interaction) representations for long episodes.

**Measure:** recall@k of gold episodes and QA accuracy per category (negation / detail / people),
latency and cost; adopt only with a significant gain at acceptable latency.

**Measured so far (RESULTS.md):** the first step was not a new representation but recall policy (relevant episodes
first, chat excerpts kept, period lists): blind4 80.8 % → 86.9 % (1 run), confirmed on a fresh blind5 at 89.2 % (3 runs,
within noise of prototype D). A lightweight form of candidate 3 — people named by a question, by name or relation,
add their own messages, no LLM call — lifted blind6's "messages addressed to the assistant by others" 0.25 → 0.62
(1 run) and was kept. Candidates 1, 2 and 4 are not measured yet.

## H12 — Resting-state thinking ("the mind never stops")

**Inspiration.** When we are not focused on a task the brain's default mode network replays
autobiographical memories, links them, simulates the future, thinks about self and others, keeps
pending intentions alive and consolidates while awake (hippocampal replay), not only in sleep.
Recordare today encodes on input (idle extraction) and consolidates at night (M5: daily and monthly digests,
built); a third, **resting** mode is missing.

**Two modes (D35):** *economy* — gated and budgeted (no new material / no open loops → no call;
open loops computed deterministically); *full* — no cost ceiling: regular replay of recent and
older memories, linking, proposals and self-model updates, for users who choose maximum quality
(e.g. strong local models).

**Design sketch:**
1. Replay recent episodes and link them to older ones (`linked` episodes / notes).
2. Maintain **open loops**: past plans without outcome, promises, waiting-for items → questions for
   the holder ("did you go to Rome in the end?").
3. Prepare **proposals** for the holder (initiative L1).
4. Update the **self-model**: recurring opinions, values, concerns → `inferred` notes, pending.
5. In research mode: the twin's own reflections and goals (`thought` / `goal`, `twin_experienced`).
Guardrails: every reflection is `inferred` with its source memories; never rewrites the past.

**Measure:** open-loop recall (unresolved plans surfaced), usefulness of proposals (holder rating),
cost per day, false-reflection rate. **Prior work to review:** Letta sleep-time compute
(arXiv:2504.13171), Generative Agents reflection (Park et al. 2023), default mode network /
awake replay literature.

## H13 — Classify-and-compose extraction, learning from surprise

**Inspiration (maintainer, 2026-10-11).** Human understanding improves through schemas that assimilate the familiar and
change on the unfamiliar (Piaget), prediction-error learning, fast episodic and slow statistical memory with replay
(complementary learning systems), and chunking with practice. Proposal: (a) classify the message / window and use
prompts specialised for the matched types instead of one monolithic prompt; (b) messages outside the known types, or
got wrong, drive the generation of new prompt modules.

**Where it stands in Recordare.** One extraction call per window (D32; the round-2 spike: single-call D beat Graphiti's
multi-prompt pipeline); the prompt is already written in sections (`extraction.prompt.ts`) but always sent whole
(~4,000 fixed tokens); entity memories add a module chosen by metadata. The blind set → failure analysis → dev case →
`extract.vN` cycle is a manual, failure-driven prompt optimisation; (b) would automate part of it.

**Failure analysis first (2026-10-11, blind9 fp815 ×3, blind10 fp813 ×3 + fp815 ×1, lost points):** recall 50 % /
41 %, extraction 29 % / 36 %, resolver 12 % / 0, answer 0 / 23 %, judge 8 % / 0. Of 10 extraction failures, 7 would
plausibly be helped by a message type (group chat folded into the holder's plan, a reschedule read as a correction, a
cancellation not linked to its plan, a foreign-language request dropped); 3 need per-message speaker tracking instead.
Upper bound for (a) with the current model: about 2 points.

**Literature (verified; [A] abstract read, [S] snippet only).**
- Decomposition / routing: Decomposed Prompting (Khot et al., ICLR 2023, arXiv:2210.02406) [A]; Mixture-of-Prompts
  (Wang et al., ICML 2024, arXiv:2407.00256: demos clustered into experts, inputs routed) [A]; IFScale (Jaroslawicz et
  al., arXiv:2507.11538: instruction following falls with instruction density, more for small models) [A].
- Automatic prompt optimisation: ProTeGi (Pryzant et al., EMNLP 2023, arXiv:2305.03495, failure critiques as textual
  gradients) [A]; OPRO (Yang et al., ICLR 2024, arXiv:2309.03409) [A]; Promptbreeder (Fernando et al., ICML 2024,
  arXiv:2309.16797) [A]; MIPRO / DSPy (Opsahl-Ong et al., EMNLP 2024, arXiv:2406.11695) [A]; TextGrad (Yuksekgonul et
  al., Nature 2025, arXiv:2406.07496) [A]; GEPA (Agrawal et al., arXiv:2507.19457) [A]; ACE (Zhang et al.,
  arXiv:2510.04618: brevity bias and context collapse of rewritten prompts) [A]. Risks: overfitting of optimised prompts
  (TextReg, arXiv:2605.21318) [A]; memory poisoning through ordinary queries (MINJA, NeurIPS 2025, arXiv:2503.03704) [A].
- Memory systems: Mem0 (extract, then ADD / UPDATE / DELETE); Memory-R1 (arXiv:2508.19828) [A]; MIRIX (arXiv:2507.07957:
  a meta manager routes input to six type managers; no routing ablation) [A]; **MemSkill** (Zhang et al.,
  arXiv:2602.02474) [A] — the closest prior work to both parts: a controller selects memory skills per span for one
  executor call, a designer clusters hard cases and proposes ≤ 3 skill edits per round with rollback; AutoMem
  (arXiv:2607.01224) [A]; MemEvolve (arXiv:2512.18746) [A]; LangMem's prompt optimiser [S].
- Surprise and schemas: **Nemori** (Ma et al., arXiv:2508.03341) [A] predicts an episode from existing knowledge and
  extracts only the gap (LoCoMo 52.0 → 65.0 against direct extraction, ~39 % fewer tokens) — the strongest measured
  surprise mechanism; SAGE (arXiv:2605.30711, novelty-gated adds) [A]; EM-LLM (ICLR 2025, arXiv:2407.09450, surprise
  segmentation) [A]; SCG-MEM (arXiv:2604.20117) and CAM (NeurIPS 2025, arXiv:2510.05520), schema memories [A];
  Auto-Dreamer (arXiv:2605.20616, learned offline consolidation) [A]; HippoRAG (NeurIPS 2024, arXiv:2405.14831) [A].

**Verdict.** Known (MoP, MIRIX, MemSkill for (a); MemSkill, AutoMem, ProTeGi / GEPA / ACE for (b); Nemori, SAGE, EM-LLM
for surprise at write time). Narrow open ground: a controlled monolithic-vs-composed comparison (same model, same rules,
blind sets, cost per window, strong and local models); surprise defined as type novelty or extraction failure feeding
an offline, human-gated module generator; composing while keeping one call. Methods / engineering, not a headline.

**Test plan.** Arm A: `extract.v14` (existing measurements). Arm B: base + modules chosen by a deterministic router, one
call (D32 kept; base as a cacheable prefix), with the router's miss rate. Arm C: Nemori-style predict-then-extract-the-
gap (a second call: `full` profile, D35). 3 runs per arm on blind9 and blind10 with `deepseek-flash`, 1 run of B vs A
with a local model (where IFScale predicts the gain). Offline module learning (GEPA / ProTeGi style, dev cases only,
module length capped, per-module prompt version, maintainer review, no user traffic) only if B wins. Results in
`spikes/memory-eval/RESULTS.md`.

**Results (2026-10-11, `spikes/memory-eval/RESULTS.md` "H13").** Arm B (`compose.v1`, 1 exploratory run): blind9
91.7 % vs 90.2 %, the same failing questions, no token saving (the modules are on in almost every window) and less
prefix caching — **B does not win**, removed; the offline module learner is therefore not built. Since recall lost the
most points, an arm R was added: a `search_episodes` search ranks by relevance alone (importance and recency had
outweighed it and pushed small items out of the top 10): blind9 **96.0 %** (+5.8, 3 runs), blind10 **94.3 %** (+2.1,
within noise), main set 100 %, no extra cost — **R wins**, now the behaviour.
Arm C (`predict.v1`, a call that predicts the window from what I know, never its text; the extraction gets the
prediction): 1 exploratory run each, blind9 95.2 % and blind10 95.7 % against R's 96.0 / 94.3 %, the same failures,
+45–49 % extraction input — **C does not win**, removed. Our extraction already sees the known items (plans, facts,
notes, related episodes), which Nemori's baseline did not, so the prediction adds little.

