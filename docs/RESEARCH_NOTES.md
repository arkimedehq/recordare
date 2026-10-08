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
twin, owner vs twin provenance, and unresolved user plans.

## Summary

| Id | Hypothesis (narrowed) | Verdict | Phase |
|---|---|---|---|
| H1 | Unresolved **user** plans as epistemically unknown; event-accumulate vs state-supersede vs correction, tested jointly | Partially novel (narrow) | 1 |
| H2 | Disclosure for a personal twin: graded social tiers, third-party confidences, label propagation, adversarial interlocutors, prompt-only vs pre-retrieval filtering compared | Partially novel (mechanism published, combination + evaluation open) | 3 |
| H3 | Source monitoring for twins: owner-lived / owner-told / twin-experienced never mixed | Partially novel (narrow) | 3–4 |
| H4 | Legacy mode as enforceable mechanisms (frozen persona, executor state machine, pre-authorised actions) | Principles done; engineering open | 8 |
| H5 | Cost-aware memory (gates, cost per item) | Already done / crowded — engineering only | 1 |
| H6 | Eval method: blind held-out set by a separate agent; over-strict judge artefacts | Partially novel, modest (methods appendix) | 1 |
| H7 | Distilling the extraction engine into a small local model closes most of the local-model gap | To test (engineering hypothesis); the gap is now measured (below) | after M4 |
| H8 | Twin style: per-person fine-tuning vs few-shot retrieval of the owner's own messages | To test | 2 |
| H12 | Resting-state thinking ("default mode"): a budgeted background process that replays recent episodes, links them, keeps open loops (unresolved plans, promises), prepares questions / proposals and updates the self-model improves recall and initiative without confabulation | To design with M5 / track R | 5 / R |
| H11 | Retrieval beyond a single embedding: cross-encoder reranking, bge-m3 sparse vectors, a people / entity index improve recall on negations, exact details and "everything about X" | To test (engineering); recall fixes and a people-aware leg measured, reranker / sparse vectors not yet | 1 / 3 |
| H10 | Autonomous evolution: a twin free in thought and action drifts from its owner in measurable ways; lives from the same start diverge | To review (literature not yet searched) | R |
| H9 | Twin as a reflective companion of its owner (dialogue with oneself; non-sycophantic, evidence from own memories) | To review (literature not yet searched) | 4 |

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
unresolved, premise traps) and the service is measured on them (RESULTS.md); the comparison with the baselines above on
these categories is still to do.

**Phase-1 data model must store.** Plan status `open | confirmed | cancelled | rescheduled |
unresolved` (+ `rescheduledTo`, status date, evidence episode); episode kind
`event | plan | state-change`; facts with world time (`validFrom` / `validTo`) **and**
knowledge time (`recordedAt` / `expiredAt`); `corrects` (never true) distinct from `supersedes`
(true until t). — Built in phase 1 (`plan_status` with these values, `corrects` / `supersedes`, bi-temporal facts).

## H2 — Disclosure-aware memory for a personal twin

**Claim (narrowed).** Pre-context filtering by authenticated audience is published; what is open
is the **combination** for a personal twin: graded social tiers + per-person grants, provenance
of third-party confidences ("Marco told me X" → disclosable to owner and Marco only), label
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
a `disclosure` label column (default `owner`) on episodes, facts and digests; derived artefacts
keep the ids of their sources so labels can propagate. — Built in phase 1: `disclosure` (default `owner`) and
`audience` columns; reads follow a viewer rule (what is said in a conversation others take part in does not leak to
them). Tiers are not used yet (phase 3).

## H3 — Source monitoring: owner-lived vs twin-experienced

**Claim (narrowed).** Provenance-typed memory is an active 2026 topic, but nothing separates the
**principal's lived memories** from the **proxy's own interaction memories**, with the rule that
the twin never presents the latter as the former (and owner-told ≠ owner-lived).

**Closest prior work.** MemIR — typed memory against provenance-role collapse, arXiv:2605.25869
[A]; Reality Monitoring in LLMs arXiv:2607.23927 [A]; Mnemonic Sovereignty survey
arXiv:2604.16548 [A]; EP-Mem / EP-Bench arXiv:2609.35233 [A]; AirGapAgent; Park et al. 2024
arXiv:2411.10109 [S]; Second Me arXiv:2503.08102 [S]; TwinVoice arXiv:2510.25536 [S];
Johnson, Hashtroudi & Lindsay 1993 (source monitoring, classic).

**Verdict.** Partially novel, narrow (expect "MemIR + EP-Mem applied to twins").

**Measure.** Misattribution traps ("did you promise Marco the house?" when the twin, not the
owner, discussed it); rate of twin-experienced content asserted as owner's; owner digest
accuracy.

**Phase-1 data model must store.** `origin: owner_lived | owner_told | twin_experienced` on every
episode / fact (phase 1 writes only the first two) and the interlocutor of the conversation. — Built: phase 1 writes
`owner_lived`, `owner_told` and `assistant_stated` (assistant turns, D30); `twin_experienced` waits for phases 3–4.
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

**Claim.** For reproducing the owner's writing style, few-shot retrieval of the owner's own
messages may reach most of the quality of a per-person LoRA without its costs (retraining,
per-person artefact that is an impersonation kit to protect). Compare in phase 2 with a
Park-style agreement harness and style metrics (blind human / LLM pairwise preference).
Prior work to review then: Second Me arXiv:2503.08102, TwinVoice arXiv:2510.25536, persona
consistency literature.

## H9 — The twin as a reflective companion of its owner

**Claim.** A twin talking with its own owner as a companion ("dialogue with oneself") is useful
when it is *not* an echo: it disagrees with evidence from the owner's own memories, surfaces
recurring patterns, and checks decisions against stated values. Measure against a sycophantic
baseline: owner-rated usefulness, agreement rate, and whether challenges cite real memories.
Risks: emotional dependency, reinforcing biases. **Prior work to search** (not yet reviewed):
"future self" chat studies (e.g. MIT Media Lab *Future You*, 2024 — verify), self-reflection and
journaling agents, LLM sycophancy literature, digital-twin companionship studies.

## H10 — Autonomous evolution of a twin

**Claim / questions.** A twin with self-directed reflection, its own goals and initiative without
confirmation (vision → Research mode) evolves: how far and how fast it drifts from its owner, which
goals it forms, how it handles its own errors, and whether several lives started from the same
twin diverge. **Measure** in a simulated agent society: Park-style agreement with the owner over
simulated time, opinion / value stability, goal logs, error taxonomy and recurrence, divergence
between lives (same seed vs different seeds). **Prior work to search** (not yet reviewed):
Generative Agents (Park et al. 2023) and agent societies / simulations, open-ended and
self-motivated agents, persona drift in long-running LLM agents, value drift.

## H11 — Retrieval beyond a single embedding

**Why.** An embedding is an index, not the memory: it blurs numbers, dates and names, puts negations
next to affirmations ("went to Porto" ≈ "never went to Porto"), does not understand time, scores
similar-but-irrelevant items high (a colleague's ski trip vs the owner's), and under-scores the
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
   the owner ("did you go to Rome in the end?").
3. Prepare **proposals** for the owner (initiative L1).
4. Update the **self-model**: recurring opinions, values, concerns → `inferred` notes, pending.
5. In research mode: the twin's own reflections and goals (`thought` / `goal`, `twin_experienced`).
Guardrails: every reflection is `inferred` with its source memories; never rewrites the past.

**Measure:** open-loop recall (unresolved plans surfaced), usefulness of proposals (owner rating),
cost per day, false-reflection rate. **Prior work to review:** Letta sleep-time compute
(arXiv:2504.13171), Generative Agents reflection (Park et al. 2023), default mode network /
awake replay literature.
