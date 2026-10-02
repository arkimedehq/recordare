# Literature — reading cards and synthesis

Deep readings (full paper, appendices, code where released) done 2026-10-02 to check our design
before M1. One card per source, fixed structure (problem, mechanism, data model, LLM usage,
evaluation, limitations, implications for Recordare). Several cards were read through a fetch
tool that returns extracted passages — each card's `Read:` line says so; re-check numbers before
quoting them externally. Licences of reusable code: `../LICENSING.md`.

## Index

| Card | Source | Topic |
|---|---|---|
| [pis-typed-intention-stores](pis-typed-intention-stores.md) | Zhao & Wu, arXiv:2609.01272 | Plan / intention lifecycle in code |
| [statemembench-state-tracking](statemembench-state-tracking.md) | Fan et al., arXiv:2608.19652 | Evolving state, anti-traps, derived facts |
| [stale-implicit-conflict](stale-implicit-conflict.md) | Chao et al., arXiv:2605.06527 | Implicit invalidation, premise resistance |
| [zep-temporal-kg](zep-temporal-kg.md) | Rasmussen et al., arXiv:2501.13956 | Bi-temporal facts |
| [mem0-production-memory](mem0-production-memory.md) | Chhikara et al., arXiv:2504.19413 | ADD/UPDATE/DELETE pipeline, cost numbers |
| [amem-zettelkasten](amem-zettelkasten.md) | Xu et al., arXiv:2502.12110 | Notes, links, evolution (Arkimede's A-MEM) |
| [tsm-temporal-semantic-memory](tsm-temporal-semantic-memory.md) | Su et al., arXiv:2601.07468 | Event time vs dialogue time |
| [memir-typed-memory](memir-typed-memory.md) | Jin et al., arXiv:2605.25869 | Evidence-bound typed memory |
| [lightmem-efficient-memory](lightmem-efficient-memory.md) | Fang et al., arXiv:2510.18866 | Batching, topic segmentation, cost |
| [authorization-before-context](authorization-before-context.md) | Liu, arXiv:2608.17148 | Audience check before the prompt |
| [collaborative-memory](collaborative-memory.md) | Rezazadeh et al., arXiv:2505.18279 | Multi-user permissions, provenance |
| [longmemeval](longmemeval.md) | Wu et al., arXiv:2410.10813 | Benchmark, ablations, judge |
| [memdelta](memdelta.md) | Wang, arXiv:2606.29914 | Confounds, controls, write-path cost |
| [halumem](halumem.md) | Chen et al., arXiv:2511.03506 | Per-operation hallucination eval |
| [penfield-locomo-audit](penfield-locomo-audit.md) | Penfield Labs, 2026 | Wrong gold answers, lenient judges |

## Synthesis — what changes in our design

### Confirmed (keep)
- Event time vs ingestion time + date-range filter (LongMemEval, TSM, Zep); `datePrecision`
  avoids Zep's false precision ("2020" → 1 Jan).
- Append-only with `supersedes` / `corrects`; never let the LLM delete or rewrite (Mem0, A-MEM,
  LightMem Tokyo/Kyoto case, MemIR's 32 % contradiction score).
- Raw log + labelled fallback (LongMemEval: fact-only storage loses information; MemDelta:
  scratchpad memory < RAG; Zep loses assistant-side content).
- Batching per idle window is where the cost savings are (LightMem); no graph DB (Mem0g, Zep).
- `unresolved` for user plans goes beyond the closest work (PIS has pending / done / canceled).

### Data model additions (proposed D29 — extends D28)
1. **Audience set** on every episode, fact, digest and profile entry: resolved person ids present
   when it was recorded (immutable), next to the `disclosure` tier; permissions evaluated at
   read time against current policy; grants as data with validity intervals; lookups return the
   same "not found" for missing and forbidden items. *(Liu; Collaborative Memory)*
2. **Derived artefacts carry source ids**; derived audience = intersection of the sources'; an
   artefact without source ids fails closed. *(Liu)*
3. **Facts**: status `current | superseded | corrected | unknown_current` (old value unsafe, new
   unknown); write-time verdict per touched fact `keep | stale | replace | corrects | unknown`
   over a shortlisted candidate set; `derivedFrom` + deterministic `needsRecheck` propagation
   (flag only, never auto-rewrite); supersession forward-only by event / message time, so
   imports cannot overwrite newer facts; `stated | inferred` + confidence. *(STALE,
   StateMemBench, LightMem)*
4. **Plans**: LLM emits sparse typed patches (`confirm | cancel | reschedule | amend`), lifecycle
   transitions in code; "a later mention is not a cancellation"; open plans shortlisted (date
   window + embedding + people) and referenced by index. *(PIS)*
5. **Evidence-bound extraction**: each episode / fact / plan patch cites message ids, validated in
   code against Layer 0 (rejected otherwise); the original time expression is stored next to the
   resolved date. *(MemIR, Zep)*
6. **Retrieval keys** (keywords, one-line context, tags) produced in the same extraction call
   and embedded with the content; no extra call per item. *(A-MEM, LongMemEval fact-augmented keys)*

### Engine and recall
- `search_episodes` mode **`latest`**; with a date range, rank **in-range first** (hard time
  prior) *(TSM)*; for fact slots return the **value chain** (initial → revisions → current, with
  dates) *(StateMemBench)*; status always shown (cancelled / unresolved / superseded never
  presented as current) and a **premise check** for presupposed states *(STALE, PIS)*.
- Long tails (nightly sweep, imports, legacy) **segmented by topic** (adjacent-turn embedding
  similarity) before extraction, never truncated *(LightMem)*; per-window claim cap *(MemIR)*;
  extraction context = rolling summary + last messages *(Mem0)*.
- Deterministic period parsing with an IT/EN test corpus *(TSM)*.
- Avoid: token compression (LLMLingua) in v1, GMM clustering / per-turn graphs (TSM), read-time
  LLM selection (MemIR), LLM-decided disclosure or redaction (Collaborative Memory), neighbour
  rewriting (A-MEM), periodic index rebuilds.

### Evaluation (becomes the regression suite)
- **Statistics**: N ≥ 3 runs, paired tests (bootstrap / McNemar), automatic noise-floor flag;
  constant, reported embedding model. Our D23 gaps (+8…+25) stand; fine-grained claims
  (e.g. flash = v4-pro) are "within noise", not "proven equal". *(MemDelta)*
- **Controls and baselines**: no-memory, random-context, full-context, plain RAG, oracle
  context (upper bound), Mem0 OSS next to Memobase. *(MemDelta, Mem0, Zep, LongMemEval)*
- **Outcomes**: correct / hallucinated / omitted instead of correct / partial / wrong, per
  category (incl. abstention, plan status, knowledge update); retrieval recall reported
  separately; **per-stage extraction eval** against gold episodes / plan updates with
  distractors. *(HaluMem, LongMemEval)*
- **Judge**: adversarial validation (false-accept and false-reject rates on vague, wrong and
  correct-plus-extra answers), per-type rules (old value mentioned next to the current one is
  fine), judge model different from the answering model, human-labelled calibration set.
  *(Penfield audit, LongMemEval)*
- **Gold audit** by a second reader (dates, weekdays, year boundary, who is who). *(Penfield)*
- **New probe types**: anti-traps (unchanged facts that must not be invalidated), implicit
  changes without negation cues, premise-resistance triplets. *(StateMemBench, STALE)*
- **Cost columns** per run: calls and tokens per message, tokens injected per query, p50 / p95
  latency. *(Mem0, MemDelta, LightMem)*

### Open question for the owner
- **Assistant turns**: derived memories lose what the assistant said (Zep's
  single-session-assistant regression). For agentic clients this matters (the agent's actions,
  recommendations the user accepted). Options: (a) assistant turns only as context, (b) also
  extract assistant-stated items with their own origin (`assistant_stated`), never mixed with
  owner-lived memories. Proposal: (b), consistent with H3 provenance.
