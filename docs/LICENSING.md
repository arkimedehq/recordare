# Licensing policy for reused ideas, code, prompts and data

Recordare is licensed **AGPL-3.0** (`LICENSE`). Anything we take from other sources must be
compatible with it and with a possible commercial service on top. Not legal advice: before a
public or commercial release, have a lawyer review this file and `THIRD_PARTY_NOTICES.md`.

## Rules

1. **Ideas, algorithms, data-model concepts** (e.g. bi-temporal facts, plan statuses, audience
   check `V ⊆ Aud`) are not protected by copyright: we may implement them in our own code, and
   we cite the source in the docs (`docs/literature/`, `ENGINE_IDEAS.md`). Patents are a separate
   matter — see rule 6.
2. **Code** may be copied or adapted only from sources whose licence allows it and is compatible
   with AGPL-3.0:
   - **MIT, BSD, Apache-2.0**: allowed. Keep the original copyright notice and licence text,
     add an entry to `THIRD_PARTY_NOTICES.md`, mark modified files ("Adapted from <project>,
     <licence>; modified"). Apache-2.0 also requires carrying the upstream `NOTICE` file if one
     exists (Graphiti and Memobase have none as of 2026-10-02).
   - **GPL-3.0 / AGPL-3.0**: allowed (same family), with notices.
   - **No licence, "all rights reserved", non-commercial (CC BY-NC), research-only, or unclear**:
     **do not copy**. Reimplement from the idea in our own words, without looking at the code
     while writing it.
3. **Prompt text** counts as text / code:
   - from Apache-2.0 / MIT projects (Graphiti, Memobase, Mem0, A-MEM…): reuse allowed with
     attribution in `THIRD_PARTY_NOTICES.md` and a comment at the prompt;
   - from **papers**: copyright depends on the paper's licence (arXiv default licence grants
     no reuse rights; CC BY allows reuse with attribution). Default: **rewrite in our own
     words**; short quotations in docs only, with citation.
4. **Datasets and benchmarks** used in our eval suite:
   - allowed for internal evaluation if the licence permits that use;
   - **do not redistribute** or ship them unless the licence allows it;
   - **non-commercial** data (e.g. **LoCoMo, CC BY-NC 4.0**) may be used only for research
     comparisons, never as part of the product or a paid service, and not committed to this repo.
   - Our own datasets (`spikes/memory-eval/dataset*/`) are original and ours.
5. **Model weights** (local LLMs, embeddings, TTS voices, fine-tunes): check the weights' licence
   before supporting or distributing them — several are non-commercial or have use restrictions.
   Record supported models and their licences in the supported-models table (D27).
6. **Patents**: Apache-2.0 includes a patent grant from contributors; MIT / BSD do not say;
   papers may describe patented methods. Before a commercial release, run a freedom-to-operate
   check on the core mechanisms (temporal facts, plan lifecycle, disclosure filtering).
7. **Every reuse is recorded when it happens** — no "we'll add attribution later".

## Known source licences (checked 2026-10-02)

| Source | Licence | Use |
|---|---|---|
| Graphiti (`getzep/graphiti`) | Apache-2.0 | ideas; prompt wording reusable with attribution |
| Memobase (`memodb-io/memobase`) | Apache-2.0 | ideas; prompt wording reusable with attribution |
| Mem0 (`mem0ai/mem0`) | Apache-2.0 | ideas; spike baseline (`mem0ai` 2.2.1, dependency only) |
| Cognee (`topoteretes/cognee`) | Apache-2.0 (has a `NOTICE.md`, checked 2026-10-04) | spike baseline (`cognee` 1.6.0, dependency only) |
| A-MEM (`agiresearch/A-mem`, `WujiangXu/A-mem-sys`) | MIT | ideas |
| STALE (`icedreamc/STALE`) | MIT | ideas, eval design |
| LongMemEval (`xiaowu0162/LongMemEval`) | MIT | eval design; data usable per its licence |
| LoCoMo (`snap-research/locomo`) | **CC BY-NC 4.0** | research comparison only, not in product / repo |
| Penfield LoCoMo audit (`dial481/locomo-audit`) | licence file present, not checked | methodology only |
| PIS, StateMemBench, Authorization Before Context, Collaborative Memory, TSM, MemIR, LightMem, MemDelta, HaluMem | papers (code not released or not checked) | ideas only — reimplement, do not copy text |
