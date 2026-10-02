# Memory engine evaluation — results (2026-10-02)

Setup: same LLM for every phase (DeepSeek `deepseek-flash`, temperature 0), same answer
prompt and LLM judge for every system; local multilingual embeddings
(`paraphrase-multilingual-MiniLM-L12-v2`, 384 dims). Dataset: 15 Italian sessions of `luca`
+ 2 of `elena`, 18 questions. "Noise" = +150 deterministic filler sessions for `luca`
(+20 for `elena`) with lexical traps (`gen_noise.py`).

## Scores

| System | Dataset | Accuracy | Ingest | Retrieval p50 | Notes |
|---|---|---|---|---|---|
| **A — baseline** (BM25 + vector over raw messages, RRF top-8) | base | **86%** | 1 s, 0 LLM calls | 7 ms | Fails only period questions (no date filter) |
| **A — baseline** | base + noise (187 sessions) | **56%** | 1 s, 0 LLM calls | — | Falls into traps: "Che macchina ho?" → coffee machine; March ski trip pushed out of top-8 |
| **B — Graphiti** (FalkorDB 4.22) | base | **53%** | 532 s (≈31 s/session) | 33 ms | See failure analysis |
| **C — Memobase** 0.0.42 | base | **3–19%** | 16–125 s | 27–35 ms | Extraction silently empty — see below |

Graphiti / Memobase with noise not run: both already lose to the baseline on the clean set;
Graphiti ingest of 187 sessions ≈ 1.5 h.

## Failure analysis

**Graphiti — event/state confusion (structural).** Graphiti's temporal model assumes facts
are *states* that supersede each other. Episodic events are not states:
- "went skiing at Cervinia (17 Jan)" was marked *"no longer valid from 7 Feb"* because the
  user skied at Livigno on 7 Feb; the March trip was then missing from the top results →
  "last time I skied" answered 7 Feb (wrong), "how many times" answered 2.
- Conversely a real state change was *not* invalidated: "Che macchina ho?" → "Tesla **and**
  Golf".
- Facts are extracted in mixed Italian/English, one fact per relation: many near-duplicate
  facts compete for the top-K.
- Operational: DeepSeek in `json_object` mode sometimes echoes the JSON schema instead of an
  instance — Graphiti crashes without retry (patched in the spike with a validating client);
  FalkorDB 6.0 (released 2026-10-01) breaks Graphiti's fulltext index creation (pinned 4.22).

**Memobase — silent pipeline failure.** Per-session flushes skip buffers < 256 tokens
(by design); with proper buffering the server runs `summary_entry_chats` but never proceeds
to profile/event extraction, without errors, with `deepseek-flash`. Rigid prompt-format
pipeline + reasoning model = silent empty memory. Project activity is slowing (last push
2026-01). Not retried with another model.

## Decision (per README decision rule)

Neither B nor C passes the must-haves (accuracy clearly above baseline A). →
**build our design (D)**, carrying these lessons:

1. **Events are not states.** Episodes never invalidate each other; only *state facts*
   (car, address, job) get validity / supersession (`validUntil`, `invalidatedAt` — D10/D21).
   Keep the two kinds separate (episodic table vs semantic notes).
2. **Date filter is the biggest lever** where the baseline fails (period questions) —
   confirms LongMemEval and D12 (`from` / `to`, list mode, digests).
3. **Raw log must stay searchable** (D13 fallback): the baseline is a strong floor on
   point lookups and provenance.
4. **Noise kills naive top-K**: the clean set flatters any system; always evaluate with noise.
5. **Robust LLM I/O**: validate structured output against the schema and retry; tolerate
   reasoning models (empty content when `max_tokens` is low).

Next: prototype D in this spike (episode extraction with dates + importance, digests,
`search_episodes` with date filter + raw-log fallback) and compare against A on base + noise.
