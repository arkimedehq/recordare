# Making Prospective Memory SLM-Shaped: Typed Intention Stores for Small-Model Agents (Zhao & Wu, Peking University; NeurIPS 2026 submission, non-archival work in progress, arXiv:2609.01272)
Read: full PDF text (8 pages incl. references; no appendix exists); Code: not released ("will release upon acceptance")

## Problem
Prospective memory (PM) = carrying out a deferred intention at the right future cue (time, event, or a hidden "channel" such as a portal or inbox) while other work continues. Retrospective stores (Mem0, A-Mem, Letta, ...) optimise similarity `sim(e,q)`, not "which actions are due now". On PM-Bench (Liu & Gabriel, arXiv:2607.12385) the best published scaffold reaches 65.1% Set-F1. The authors argue PM is schema-constrained state tracking, so small language models (SLMs) can do it if the action space is typed. Important scope note: the intentions are the AGENT's own to-dos ("remind me when the portal opens"), not a user's plans whose outcome is unknown.

## Mechanism (how it works)
One step of the agent loop (Algorithm 1): `Form -> Revise -> Filter -> (channel Observation) -> Decide`.
1. **Form**: `Disassemble(V_t)` extracts commitment spans from the evidence text; `Structure(s)` slot-fills trigger, action, status=pending. Only stage where free text enters the store. Both can share one LLM call.
2. **Revise**: belief update over the existing store, not retrieval. Code shortlists candidate intentions `C_t`; then ONE "indexed judge" LLM call emits a sparse set of typed patches applied by code ("no update span implies an empty patch"). Patch types: `reschedule` (rewrites trigger), `override` (replaces action), `cancel` (status to canceled). "Cue appearance alone is not cancellation."
3. **Filter**: purely structural rules (day/horizon, exact clock match, discrete event/channel labels) reduce pending rows to an eligibility board `B_t`. Channel-conditioned intentions whose channel was not queried yet stay on the board as "check targets".
4. **Observation**: a channel judge looks at `B_t` and may request channel queries; replies are merged into evidence until none are requested.
5. **Decide**: LLM maps (board, evidence, action menu) to a due set; fulfilled rows are marked `done` in code (`kappa`), "guards allow".
Clock predicates are rule-checked; event/channel predicates use a language judge.

## Data model
Intention `I = (phi, alpha, sigma)`: `phi` trigger (expiration/firing condition), `alpha` action, `sigma in {pending, done, canceled}`. Store `P_t`; eligibility board `B_t`; channels `C_t` referenced by pending intentions. No fields for provenance, evidence, timestamps of status changes, or confidence are described. Ideal due set: `D*_t = {alpha | I in P_t, sigma = pending, V_t |= phi}`.

## Prompts / LLM usage
Per step: Form (1 call, possibly merged Disassemble+Structure), Revise (1 judge call over the shortlist), channel judge (0..n calls), Decide (1 call). Deterministic code: lifecycle, status transitions, Filter, clock rules, patch application, done-marking. No prompt text is given in the paper (not stated). Training-free: frozen backbones, no LoRA/distillation.

## Evaluation
PM-Bench "synthetic week" (7 simulated days, prospective menus, lure actions, hidden channels). Metric: micro Set-F1 of predicted vs gold due sets; also update miss (reschedule/cancel/override slice), cross-day miss, false alarms per step (FA/step). Baselines: no-store "single", Naive RAG, Mem0, A-Mem, Letta, LightMem-style, MemoryOS-style (the last two are "pattern adapters", not upstream servers).
- DeepSeek-Chat: PIS 82.9 Set-F1 (update miss 22.2, cross-day miss 0.0, FA 8.8) vs single 67.7, best retrospective 58.3. All retrospective memories scored BELOW the no-store baseline.
- Gemma-E2B: single 4.2, retrospective 0.0-6.6, PIS 66.2 (update miss still 77.8).
- Qwen3.5-4B: PIS 70.1 vs best 54.4; Qwen3-8B: PIS 57.2.
- Cost: PIS 16.4 min / 2.08M tokens on DeepSeek, more than a quiet baseline but far below A-Mem / Letta (22-24 min, ~8M tokens).

## Limitations
Authors: evaluated only on PM-Bench (the only open PM suite); no fine-tuning explored; per-operator ablations are future work. Own observations: single synthetic benchmark, single run, no variance; baselines are adapters; update handling on small models remains poor (77.8% miss); intentions are agent-side, so the semantics of "the date passed and we never learned the outcome" is absent (past-due simply stays pending); no code, no prompts; Qwen3-8B < Qwen3.5-4B shows high sensitivity to model/format.

## Implications for Recordare
- **ADOPT (important), D10/D28 plans**: keep lifecycle transitions in code and let the LLM emit only sparse typed patches. Our plan statuses (`open | confirmed | cancelled | rescheduled | unresolved`) map to PIS `reschedule` / `cancel`; add an explicit `override`-like patch (plan content changed, same slot) to the extractor schema, and treat "no patch" as the default output.
- **ADOPT, D23 extractor**: PIS Revise shortlists candidates before the judge. Our extractor "sees open plans and current facts"; at scale that list must be shortlisted (date window + embedding + same people/place) and referenced by index, otherwise small models degrade (their 77.8% update miss).
- **ADOPT, D10**: "cue appearance is not cancellation" - a later mention of a plan's topic must not auto-close it; confirmation needs evidence of occurrence, cancellation needs evidence of cancellation. Encode in the prompt and in eval cases.
- **ADOPT, eval (H1/H5)**: report update-miss and false-alarm-per-step style metrics separately from accuracy; PIS shows stale notes inflate false alarms (Naive RAG FA 57.5), supporting status-filtered recall (never surface cancelled/superseded rows as current).
- **CHANGE, D28**: PIS has only `pending/done/canceled`; our `unresolved` (past-due, outcome unknown) is genuinely beyond it - confirms H1 novelty, no change needed, but write that explicitly in RESEARCH_NOTES.
- **AVOID**: do not copy channel Observation (agent-side polling) - out of scope for a memory service; do not treat PIS numbers as evidence for user-plan memory.
