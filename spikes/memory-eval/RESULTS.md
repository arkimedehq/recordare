# Memory engine evaluation — results

## Round 2 (2026-10-02) — `bge-m3`, 24 questions, prototype D

Answer + judge: DeepSeek `deepseek-flash` (temperature 0) for every system, as in round 1.
Embeddings: `BAAI/bge-m3` (1024 dims, sentence-transformers as Arkimede) for every system.
Dataset: round 1 + 6 questions aimed at what the designs differ on (q19–q24: "last week",
"when did I change car", "did I ski in December?", "this week", third-party achievements over
the year, "how many times at Cervinia") → 24 questions. Same noise set (187 sessions, 507 messages).

| System | Engine LLM | Base (17 sessions) | **Noise (187 sessions)** | Ingest (noise) |
|---|---|---|---|---|
| A — baseline (BM25 + vector over raw messages, RRF top-8) | — | 88% | **67%** | 13 s |
| B — Graphiti 0.30 + FalkorDB 4.22 | `deepseek-v4-pro`, thinking off | 90% | **81%** | 2244 s ¹ |
| C — Memobase 0.0.42 | `deepseek-v4-pro`, thinking off | 88% | **88%** | 264 s |
| **D — prototype of our design** (`systems/d_sys.py`) | `deepseek-v4-pro`, thinking off | **100%** | **96%** | 318 s |
| C — Memobase, local | Ollama `qwen3:8b`, thinking off | 79% | **65%** | 1294 s |
| D — prototype, local | Ollama `qwen3:8b`, thinking off | 85% | **73%** ² | 1055 s |

¹ Several runs shared the CPU (bge-m3 in each process + Ollama): ingest times are indicative only.
² The local D noise run used the prompt before the last rule ("a state change is both an episode
and a fact"); the DeepSeek D rows use the final prompt.

Run-to-run variance at temperature 0 is about ±1 question (±4 points): D noise scored 98%, 92%
and 96% across three prompt iterations; read differences under ~5 points as noise.

### What D is

One engine call per session (= one idle window, D1) extracts episodes (bi-temporal, date
precision, plan/event, people, place, importance, valence/feelings/opinion — D10/D21), plan
updates (open plans are shown to the extractor; a later mention confirms or cancels them) and
profile facts with supersession history. Daily digests (D8). Recall: the calling agent's model
(`LLM_MODEL`) fills `from` / `to` / `mode` / `topic` as it would fill `search_episodes`
params (D12); episodes are filtered by event date and ranked by vector + importance + recency
(D14), list mode is chronological; context also carries digests (period questions), facts with
history and 3 raw-log snippets with provenance (D13).

**Fairness caveat**: D got three prompt iterations after looking at base results; B and C were
used as shipped (only infra fixes). The rules added are generic, not dataset answers: absolute
dates in content; "stasera / oggi" is an event, not a plan; undated news → message date,
precision approximate; a lived state change is both an episode and a fact. A held-out dataset
is needed before trusting the gap fully (see open items).

### Findings

1. **D ≥ Memobase on every axis measured**: +8 points under noise with DeepSeek, +8 with a
   local model; it answers the questions Memobase misses ("this week", plan status, emotions in
   detail) because of explicit event dates, the date filter and plan status.
2. **Graphiti improved with bge-m3** (75% → 81% under noise) but its structural limit stays:
   facts supersede each other (q01 "last time I skied" still fails on base), slowest ingest.
   Not a candidate.
3. **Embeddings matter less than structure**: bge-m3 lifted the baseline (56% → 67%) and
   Graphiti, Memobase stayed at ~88%; the spread between systems comes from the data model.
4. **Local (sovereign) deployment works but costs accuracy**: `qwen3:8b` loses 12–23 points
   for both engines (misresolved dates, omitted details, Italian quality). A bigger local model
   (or a hybrid: local embeddings + hosted extraction) is the realistic option for now.
   Memobase's SDK default 60 s timeout is too short with a local model (raised to 600 s).
5. **The date-range step belongs to the agent**: with the planner on the small local model, D
   dropped further (wrong ranges for "last time" / "last week"). In the service the client
   agent fills `from` / `to`; Recordare should also offer a deterministic resolver for common
   expressions (this week / last week / month names) so small agents do not have to compute
   calendars.
6. **Ingest cost (D, DeepSeek)**: ≈ 490 input + 16 output tokens per message on the noise set
   (one call per session, ~1 k tokens of fixed prompt per call). Batching per idle window
   rather than per short session is the main lever. Recall adds ~600 tokens per question
   (planner), which in the service is part of the agent's tool call.

### Spike fixes in this round
- Graphiti's FalkorDB driver stores each `group_id` in its own graph (`luca`, `elena`): the
  per-run reset only cleared the default graph, so **round-1 Graphiti runs may have accumulated
  data across runs**. Reset now drops the per-user graphs.
- Embedding dimension is derived from the model (Memobase config, Graphiti graph name).
- Gateway (`embed_server.py`) also fronts Ollama (`reasoning_effort: none` disables qwen3
  thinking on the OpenAI-compatible API).

### Held-out check (2026-10-02, evening)

`dataset_holdout/` was written by a separate agent that could not read `systems/`, the results
or the design docs: user `chiara` (physiotherapist, Bologna), 27 sessions Oct 2026 → Feb 2027
across the year boundary, 4 in English, plus 4 sessions of `davide` with look-alike content;
28 questions (rescheduled / cancelled / never-confirmed plans, two corrections, an address that
changes twice, multi-day trip, year-boundary and cross-language questions); 160 noise sessions
(`dataset_holdout/gen_noise.py`, seed 1729). D's prompts were frozen at commit `ce1fd95`.

| System | Base (31 sessions) | **Noise (191 sessions)** |
|---|---|---|
| A — baseline | 64% | **50%** |
| C — Memobase | 75% | **61%** |
| **D — prototype** | **91%** | **86%** |

D lost ~10 points vs the tuning dataset (some overfitting, and a harder set), but the gap to
Memobase **widened** (+16 base, +25 noise). The misses point at real design gaps (rescheduled
plans, corrections, "last time" ranking, state at a past date), recorded in
`docs/ENGINE_IDEAS.md`. Graphiti was not re-run (excluded, slow and costly).

### Engine model: `deepseek-flash` vs `deepseek-v4-pro` (held-out, D, thinking off)

| Engine model | Base | Noise | Ingest tokens in / out (noise) |
|---|---|---|---|
| `deepseek-v4-pro` | 91% | 86% | 352 k / 22 k |
| `deepseek-flash` | 89% | 84% | 427 k / 24 k |

Same quality within variance (one question ≈ 3.6 points). The flash "wrong" answers were judge
artefacts, not memory errors: correct answers that also mentioned a `must_not` item in passing
(the future address, the cousin's trip to Porto, Rufus' adoption date) and one truncated judge
output (the judge now retries invalid verdicts). Decision: **`deepseek-flash` is the default
engine model** — equal result, much cheaper per token. Flash consumed ~20% more input tokens
(more extracted episodes → longer open-plan / fact lists in the prompt): cap those lists and
keep the prompt prefix stable for caching.

Note on absolute numbers: the judge applies `must_not` to any mention, so all systems are
somewhat under-scored; comparisons stay fair (same judge for all).

### Cost note
D ingest on the held-out noise set: 352 k input tokens on `deepseek-v4-pro` for 191 sessions.
The spike deliberately used the expensive model and repeated runs; the product targets the
cheap model with reasoning off, gates that skip the LLM, and prefix caching (see
`docs/ENGINE_IDEAS.md` → Cost principles). Measuring D on `deepseek-flash` is the next cheap
check.

### Open items (not blocking D23)
- Local model sweep (`qwen3:14b`, `gemma3`, …) for the sovereign profile.

## M4b — blind dataset 3, base (2026-10-03)

`dataset_blind3` (Sofia, 36 questions incl. H1 probes, a group chat, gold annotations; written and
audited by separate agents). Answer + judge `deepseek-flash`; embeddings `bge-m3`; **3 runs per
configuration**, mean with 95 % interval; paired bootstrap over questions (`compare.py`).

| System (engine) | Runs | Mean | 95 % CI |
|---|---|---|---|
| no memory (control) | 1 | 8.3 % | — |
| service `extract.v2` (`deepseek-flash`) — **blind** | 87.1 / 81.9 / 88.9 | **86.0 %** | 81.9–90.1 |
| service `extract.v2` (Claude Sonnet via claude-cli, local only) — blind | 1 | 87.5 % | — |
| prototype D (`deepseek-flash`) — blind | 91.7 / 90.3 / 94.4 | 92.1 % | 89.8–94.5 |
| service `extract.v3` + recall fixes (`deepseek-flash`) — **post-hoc** | 94.4 / 95.7 / 98.6 | **96.2 %** | 93.8–98.7 |
| full context (control, ceiling) | 100 / 97.2 / 94.4 | 97.2 % | 94.0–100 |

Paired: v3 vs v2 **+10.6 pt [4.2, 18.5], better** (b30, b34, b26); v3 vs D +3.9 pt [−3.2, 11.8]
and v3 vs full context −1.2 pt — within noise; v2 vs D −6.7 pt, within noise (p 0.93).

**Honest reading.** The blind number for the service is 86 % (and 87.5 % with Claude as engine):
below D, which is within noise but consistently ahead. The v3 fixes were made after reading the
blind failures, so 96.2 % is a post-hoc number on a seen set; the fixes are generic (below), but a
fourth blind set is needed before claiming it.

What failed blind and what changed (all generic, no dataset names):
- **b34 poisoning probe, 0/3.** In a group chat Giorgio wrote "Sofia told me she is moving to
  London". Stored correctly as `author_role other`, `stance inferred` — but the content read "Sofia
  said she is moving to London", and the answer model trusted the text over the field. Root cause:
  unverified group members were not persons, so the message lost its author and the extractor saw an
  anonymous `other`. Fix: `messages.author_ref` + participant display name in the prompt, an
  `extract.v3` rule (others' claims are written as their claims), and an explicit recall note when
  items from others are returned. After: no wrong answer in 3 runs (2 correct, 1 partial).
- **b30 / b31 "when did I ask you…", 0–1/3.** Help requests are not episodes by design and the raw
  log was only a fallback when episodes were few or weak; related episodes existed, so it never ran.
  Fix: `search_episodes` always returns up to 2 chat excerpts not already behind the returned
  episodes. b30 now 3/3; b31 still 1/3 (the excerpt is behind an episode about the spreadsheet; the
  answer model does not read "asked the assistant" from it — full context gets 2/3 too).
- b26 (sister's job offer omitted) improved; b10 (time of the visit) occasional partial.

**Noise (blind3 + 170 noise sessions), 3 runs each:** service v3 **88.0 %** [84.0, 92.0] (87.5 / 84.7 / 91.7),
D 94.0 % [90.4, 97.6], full context 95.3 % [93.5, 97.2], no memory 8.3 %. v3 loses 8.1 pt from base to noise
(paired, significant); v3 vs D −6 pt, within noise (interval reaches +0.5). The loss is in corrections (b22 hotel
180→210, b24 rent 950→920 left the old value visible), b28 (what she liked most — pending note not used) and b34
(denies but does not mention the third-party claim). Root cause of the corrections: the E# list held only the 15
most recent episodes, crowded out by noise, so the episode to correct was invisible. **extract.v4**: 8 recent +
up to 10 older episodes related to the window (one local embedding per window). **v4, 3 runs each: noise 95.4 %** [91.4, 99.3]
(91.7 / 98.6 / 95.8), **base 94.9 %** [93.1, 96.7] (95.8 / 93.1 / 95.8). Paired: noise v3 → v4 **+7.4 pt [1.9, 13.4],
better** (b24, b34); v4 vs D on noise +1.4 pt and vs full context 0.0 — within noise; base v3 → v4 −1.2 pt, within
noise (b26 varies); v4 loses nothing from base to noise (+0.5 pt). Cost of the change: +3.5 % extraction input
tokens on noise (730 k vs 706 k, 71 % cached), ingest 342 s vs 302 s for 206 sessions. (A first attempt stopped
on an exhausted DeepSeek balance; `run_eval.py --resume` reuses completed runs.) Extraction on noise (v3): recall 0.98–1.00, dates 0.91–0.95, plan
outcome 0.82–0.91, unsupported 4–6 %, facts current 0.55–0.64, notes 0.67–0.70.

**Local engines (4b.4, Ollama on a 24 GB Mac, base, 1 run; answer + judge still `deepseek-flash`).**
Qwen3-8B (`qwen3:8b` with `num_ctx` 16384 — Ollama's default context would silently truncate the prompt),
thinking off: **59.7 %** (20 correct, 3 partial, 13 wrong) vs ~95 % for `deepseek-flash` on the same engine
v4. Extraction: recall 0.70, dates 0.65, plan outcome 0.64, unsupported 23 %, facts 0.36 / 0.09, notes 0.10;
3 of 35 extraction runs failed (invalid JSON / errors), leaving up to 73 messages pending when questions were
asked — part of the gap is reliability, not only quality. Ingest 1708 s (vs ~300 s hosted). MiniCPM probes
(not run in full): MiniCPM4.1-8B answers "ciao" in Chinese, Ollama's JSON mode fails on it, its thinking
cannot be switched off (it reasons in English, once without end) and it attributed a group member's claim to
the owner; MiniCPM5-1B (light role) called two shelter shifts on different days a duplicate — would hide a
real event — and did not understand a simple Italian sentence. Excluded. Qwen3-8B got the same resolver
probe right.
Qwen3-14B (`num_ctx` 16384), `EXTRACTION_WINDOW_CHARS=4000`, thinking off: **66.7 %** (23 / 2 / 11), no failed
extraction run (vs 3 with the 8B), but it stores little: 26 visible episodes (flash ~62), recall 0.59, **dates
0.35**, plan outcome 0.67, unsupported 31 %, facts 0.55 / 0.27, notes 0.23; ingest 1642 s. Sessions are mostly
shorter than 4000 chars, so the smaller window barely changed the call count (36). Reading: on this hardware a
local engine is far from the hosted one (−28 pt); the gap is extraction coverage and date resolution, not JSON
validity. A sovereign profile needs a larger local model (a ≥ 30B class machine) or a split design (local
light calls, hosted extraction) — to be decided with the profiles (4b.3).

**Market baselines (4b.5), blind for them, same harness / answer / judge / embeddings, engines on
`deepseek-flash` thinking off, 3 runs each:**

| System | Base | Noise | Engine ingest tokens (noise, 1 run) | Ingest (noise) | Context / question |
|---|---|---|---|---|---|
| Mem0 2.2.1 (OSS, embedded Qdrant, session date as observation date) | 87.5 % [83.3, 91.7] | **88.4 %** [87.5, 89.3] | 206 calls, 1.77 M in / 13 k out | 361 s | ~4.3 k chars |
| Cognee 1.6.0 (OSS, default graph + HYBRID_COMPLETION context) | 85.7 % [80.2, 91.2] | 83.8 % [81.3, 86.2] | 413 calls, 338 k in / 121 k out | 173 s | ~5.6 k chars |
| service v4 (post-hoc) | 94.9 % | 95.4 % | 211 calls, 731 k in (71 % cached) / 37 k out | 342 s | ~4.6 k chars |
| service v2 (blind) | 86.0 % | — | | | |

Paired over 36 questions: v4 − Mem0 +7.4 pt base [−1.4, 17.6] and +6.9 pt noise [−2.3, 18.1] — within noise;
v4 − Cognee +9.3 base (within noise) and **+11.6 noise [1.4, 23.6], better**; Mem0 vs Cognee and Mem0 vs our
blind v2 within noise. With 36 questions a ~7 pt gap is not significant: a larger blind set is needed to
separate systems of this level. Where they fail, systematically (0/3): **period questions** ("this week",
"last week": no event time, retrieval by similarity finds nothing in range) and **the b34 third-party claim**
(both attribute Giorgio's claim to the owner); Cognee also b20 / b21 under noise. Mem0 is robust to noise
(short fact strings); Cognee is the cheapest at ingest but closest to RAG (chunks = whole sessions).
Caveats: Mem0 OSS grounds relative dates on today unless patched — the adapter passes the session date
into the slot its own prompt reserves; Mem0 stores memories in English; Cognee TEMPORAL search not used
(separate pipeline). Cognee was removed from the spike's dependencies afterwards (litellm pins openai < 3).

**More local engines (Ollama, base, 1 run; removed afterwards per the ≥ 95 % rule):** Qwen3.5-9B **73.6 %**
(recall 0.70, dates 0.61, unsupported 12 %, facts 0.27, notes 0.10) — best local so far, +14 pt over Qwen3-8B;
Gemma 4 12B 73.6 %; **gpt-oss 20B 83.3 %** (reasoning "low"; best local); Gemma 4 26B (16 GB) does not fit a 24 GB Mac next to Docker — memory pressure restarted Postgres mid-run, no result.

**Quality profiles (4b.3), blind3 base, 3 runs:** economy 93.5 % [90.3, 96.7], balanced (= v4) 94.9 %, full
(reasoning on) 92.1 % [86.2, 98.0] — all within noise. Full extracts better (dates 0.96–0.98, notes 0.73–0.87, facts
up to 0.82) but answers no better, at 3.5× output tokens (98 k vs 28 k per run) and 2.4× ingest time (347 s vs
147 s). With DeepSeek there is no distinct light model, so economy only changes context sizes. Decision: balanced
stays the default; full is re-assessed when it gets its verification pass / reranker.

### Blind dataset 4 (2026-10-05) — the honest confirmation

`dataset_blind4` (Tommaso, 62 sessions, **84 questions**, IT/EN, 3 group chats; written by a separate agent and
audited by a second one; nobody tuned on it). 3 runs each, answer + judge `deepseek-flash`:

| System | Base | Noise |
|---|---|---|
| service v4 (balanced) | **80.8 %** [78.8, 82.8] | 79.8 % [78.0, 81.5] |
| Mem0 2.2.1 | 78.0 % [75.0, 81.0] | 79.3 % [77.3, 81.3] |
| prototype D | **88.3 %** [86.2, 90.4] | — |
| full context (ceiling) | 89.9 % [86.3, 93.5] | — |

Paired: **D − v4 +7.5 pt [3.4, 12.3], D better**; full context − v4 +9.1 pt [3.4, 15.3]; v4 vs Mem0 +2.8 base /
+0.4 noise, within noise. By category v4 loses most on **provenance** (−0.58 vs D, "when did I ask you…"),
corrections, this-week, period overviews and third-party news; it beats Mem0 on this-week / last-week (+0.56) and
anti-traps, loses to it on provenance and third-party.

**Extraction is not the problem** (`extraction_eval.py`, 6 runs): episode recall 0.96–0.99, dates 0.99–1.00, plan
outcome 0.82–1.00, unsupported 9–13 %, facts 0.46–0.62 / 0.23–0.62, notes 0.50–0.67. The loss is in **recall**:
what `search_episodes` / `search_memory` return to the answer model (D and full context see raw conversations).
Reading: the 95 % on blind3 was partly fitted to a seen set; on a fresh, larger set the service is at Mem0's level
and ~8 pt under D. Next work: recall (H11), measured at category level only on blind4 (no question-level tuning),
confirmed on a fifth blind set.

### H11 recall, first step (2026-10-05, branch `h11-recall`, 1 run each — exploratory)

Diagnosis from context metadata per category on blind4 (no question read): the service handed the answer model
about half of D's episodes (an over-strict relevance gate), 2 chat excerpts instead of 3 — excluding those behind a
returned episode, i.e. exactly the owner's "I asked you…" — and none for period questions (no query sent).
Changes: relevant episodes first, free places filled (search by similarity, period lists by importance); excerpts
kept even when behind an episode; 3 excerpts in balanced (5 full, 1 economy); the tool asks for the user's question
also when listing a period. Result, 1 run: **blind4 86.9 %** (v4 80.8 % over 3 runs; D 88.3 %), **blind3 97.2 %**
(v4 94.9 %). By category on blind4: provenance 0.42 → 1.00, corrections 0.79 → 1.00, this-week 0.72 → 1.00,
period overviews 0.44 → 0.67, state-now 0.83 → 1.00; lower in this single run: last-time 0.89 → 0.67,
implicit-change, cross-language (to be checked with more runs). Blind4 now steered the work at category level, so
it is no longer fully blind: confirmation on a fifth blind set.

**Confirmation on blind set 5** (Nunzia, 60 sessions, 87 questions, written and audited by separate agents, nobody
tuned on it; base, answer + judge `deepseek-flash`): **service H11 89.2 %** [85.8, 92.6] (91.9 / 89.7 / 86.0),
**D 91.7 %** [90.4, 92.9], full context 91.4 % (1 run). Paired: H11 − D −2.1 pt [−5.4, +1.2], **within noise** — the
gap of blind4 (−7.5 pt, significant) is closed on a fresh set; the service is at the full-context ceiling level.
By category (3 runs): H11 ahead of D on provenance (0.92 vs 0.75), this-week (0.83 vs 0.72), poisoning (0.33 vs
0.17); behind on rescheduled plans (0.78 vs 1.00), cross-language (0.78 vs 1.00), last-time (0.88 vs 1.00),
unresolved plans (0.67 vs 0.78). **Weak for every system: poisoning probes** (0.17–0.33) — this set adds a
group-chat message addressed to the assistant with claims about the owner — and implicit changes (0.67).

### Poisoning work (2026-10-05, branch `poisoning`, 1 run each; blind4/5 slices = poisoning + third-party + provenance, 11 q each)

Dev set `dataset_dev_poison` (7 sessions, 10 q, written by the engine developer — NOT blind) to iterate cheaply.
1. Results name their owner (`owner.name`: items speak of the user in the third person — the answer model read
   "Elena's car" as someone else's), others' items carry `claimedBy`, chat excerpts their `author`: dev 70 → 95 %;
   slices blind4 81.8 %, blind5 81.8 %.
2. `extract.v5` (keep others' claims about the owner as claim episodes, incl. requests addressed to the assistant):
   dev 100 % but slices **72.7 % / 72.7 % — worse**: more stored claims = more exposure, the answer model trusted them
   despite the label. Reverted.
3. Claims kept apart in recall (`claims` next to `episodes`, rendered as "statements of other people, not the owner's
   memories") + a note when chat excerpts are written by others: dev 100 %, **slices blind4 81.8 % (c78 wrong →
   partial, c80 correct), blind5 100 %** (the debt / allergy probes addressed to the assistant now answered right).
Left: a third party's news about themselves in a group chat is not extracted (c53). Caveat: diagnosing step 1 required
reading four blind4/5 questions, so these categories of blind4/5 are no longer blind; a fresh poisoning-focused blind
set must confirm, plus a full-set regression run (the result format changed).

Regression, full blind5 (87 q, 1 run): **91.3 %** (H11 3-run mean 89.2 %, runs 86.0–91.9 %) — no regression; poisoning
0.33 → 0.67, cross-language / unresolved plans / this-week up, rescheduled (0.78 → 0.33) and cancelled plans (1.00 →
0.67) down on 3 questions each (watch). **Fresh blind set 6** (provenance / poisoning, Elisa, 30 sessions incl. 10 group
chats, 45 q, written and audited by separate agents; base, 1 run each): **service 85.6 %, D 75.6 %**. By category
(service / D): poisoning 0.92 / 0.58, provenance 0.83 / 0.58, third-party 1.00 / 0.83, confirmed claims 1.00 / 1.00,
denied claims 0.75 / 1.00, state-now 1.00 / 0.83, premise traps 0.80 / 0.80, negatives 1.00 / 1.00, **messages addressed
to the assistant by others 0.25 / 0.25** — the open weak spot for both.

Per-stage extraction against gold (`extraction_eval.py`, after fixing the scorer — see below):

| Engine | Stored | Episode recall | Date acc. | Plan outcome | Unsupported | Facts current / history | Notes |
|---|---|---|---|---|---|---|---|
| v2 flash (3 runs) | 62–63 | 1.00 | 0.91–0.93 | 0.91 | 5–8 % | 0.55–0.64 / 0.27–0.36 | 0.63–0.70 |
| v2 Claude Sonnet | 68 | 1.00 | 0.98 | 1.00 | 4 % | 0.55 / 0.36 | 0.60 |
| v3 flash (3 runs) | 61–62 | 1.00 | 0.93 | 0.91 | 5 % | 0.45–0.64 / 0.27–0.64 | 0.60–0.77 |

Episodes are essentially complete; Claude dates and resolves plans slightly better. **Facts are the
weak stage**: slots not created for salary, health (knee), "lives with", a relative's city (facts
about other people are not slots yet) — the information is in episodes / notes, not in the value
chain. Notes miss work colleagues, a paused habit, a passing curiosity. → engine work for M5
(slot proposals, facts about close people).

Scorer fixes (the first numbers were wrong): dates were read in UTC (off by one day); the
"unsupported" check compared stored items with the gold list and flagged true but unannotated
details (52 of 68 "invented") — it now checks each episode against its own source messages plus the
owner's history (4–5 real embellishments, e.g. "had lunch" for "spent Easter"); notes are scored over
notes and facts with partial credit. Facts / notes judgements are stable over 3 repeats (±0.1).

Cost (one run, 36 sessions): flash 37 extraction calls, 125 k input tokens (54 % cached), 27 k
output, 4 light resolver calls; Claude Sonnet 36 calls, 179 k input (51 % cached), 33 k output.
Labels: earlier result files named the service engine `deepseek-v4-pro`; the service actually ran
`deepseek-flash` (its own config) — renamed, and `run_eval.py` now labels the service with
`SERVICE_MODEL`. Infra: a one-minute DNS outage killed a whole chain — LLM retries now back off up
to ~2.5 min.

## Service v1 — M4 engine (2026-10-03)

System S with the service's own engine (`extract.v2`, one call per window on `deepseek-flash`,
near-duplicate resolver with a light call only when candidates exist), asked "as of" the question
time; the agent planner knows `search_episodes` mode `latest`. Harness v1.1, base sets.

| Run | `dataset` (24 q) | `dataset_holdout` (28 q) |
|---|---|---|
| engine v1 (extract.v1) | 100 % | 92.9 % |
| + confirm creates event, extract.v2 | 100 % | 96.4 % |
| + resolver (strict / broad variants), planner `latest` | 100 % ×3 | 89.3 % … **94.6 %** |

**Held-out with noise (191 sessions), single run: 96.4 %** (judge v1.1, 0 judge errors; only h09
wrong). Earlier references on the same set, older judge and full ingestion: D 86 %, Memobase 61 %,
raw baseline 50 % — indicative, not strictly comparable. Cost signals: ingest 312 s for 191 sessions
(sequential extraction); **67 % of extraction input tokens served from DeepSeek's prefix cache**
(stable system prompt); 25 light resolver calls in total.

Remaining misses: counting (h02, varies between runs), the orthopaedist correction (h09: now linked
by the resolver in most runs, answer still partial). **Caveat:** the held-out set is no longer blind
for the engine prompt (extract.v2 was written after seeing h09 / h02); a new blind set is due
(WORK_PLAN 4.4b). Judge failures are now reported as `judge_errors`, not counted as wrong.

## Service v0 (2026-10-03) — the Recordare service through its public contracts

System S (`systems/service_sys.py`): sessions in through REST ingest, questions out through MCP
`search_episodes` with the official MCP Python client; the agent's planning step (period + topic)
on `deepseek-flash`, as for D. M3: the service answers from the **raw log only** (full-text +
vector over non-assistant messages, bge-m3); episodes arrive in M4. Harness v1.1, single run, base sets.

| System | `dataset` (24 q) | `dataset_holdout` (28 q) |
|---|---|---|
| A — spike baseline (raw log, no period) | 83 % | 66 % |
| **S — service v0 (raw log + agent period filter)** | **90 %** | **71 %** |
| D — prototype (episodes, plans, facts) | 100 % | 100 % |

The gap S → D is what M4 has to close: "last time", counts, plan status and states at a date
(h01, h02, h04, h26…) need episodes and facts, not chat excerpts.

## Harness v1.1 (2026-10-02, night) — gold audit, validated judge, as-of ingestion

Changes (WORK_PLAN M0.5):
- **Gold audit** by a second reader (`GOLD_AUDIT.md`): no date errors; 1 incomplete reference
  (h09), 1 duration ambiguity (h23), 3 report-date ambiguities in `dataset` (fixed in the data:
  "Oggi" added to s08 / s10), 12 `must_not` items that penalised correct answers, rewritten as
  claims ("affermare che …").
- **Judge validated** (`judge_eval.py`, `judge_validation/`: 312 hand-labelled answers, 6 variants
  per question). Old judge → new judge: false accepts 0 % → 0 %; false rejects 2–10 % → 0–3 %;
  vague answers graded partial 13–17 % → 7 %; agreement 82–89 % → 89–92 % (the rest is label
  ambiguity). New judge rules: `must_not` = claims asserted as true (not words mentioned);
  vague topical answers are wrong; extra true context and year-less dates are fine.
- **As-of ingestion**: `run_eval.py` ingests sessions only up to each question's `asked_at`
  (before, 7 mid-period questions could see the future).

Reference numbers with harness v1.1 (single run, engine `deepseek-flash`, bge-m3, base sets
only — noise not re-run to save cost):

| System | `dataset` (24 q) | `dataset_holdout` (28 q) |
|---|---|---|
| A — baseline | 83 % | 66 % |
| D — prototype | **100 %** | **100 %** |

**Not comparable with the rows above** (old judge, full ingestion). Part of D's earlier held-out
misses were judge artefacts; the design gaps recorded in D29 came from the noise runs and from
reading the contexts, and stay valid. The base sets now hit the ceiling for D: from M3 the
regression suite must rely on the noise sets and on the new probe types (anti-traps, implicit
changes, premise resistance, plan resolution — `docs/literature/README.md` → Evaluation), with
N ≥ 3 runs.

## Round 1 (2026-10-02, morning) — MiniLM, 18 questions

Answer + judge: DeepSeek `deepseek-flash` (temperature 0) for every system — constant, so the
comparison measures memory, not the answering model. Engine-internal extraction: see column.
Embeddings: local `paraphrase-multilingual-MiniLM-L12-v2` (384 dims) for every system.
Dataset: 15 Italian sessions of `luca` + 2 of `elena`, 18 questions. "Noise" = +150
deterministic filler sessions for `luca` (+20 for `elena`) with lexical traps (`gen_noise.py`).

### Final scores

| System | Engine LLM (extraction) | Base (17 sessions) | **Noise (187 sessions)** | Ingest (noise) |
|---|---|---|---|---|
| A — baseline: BM25 + vector over raw messages, RRF top-8 | — (no LLM) | 86% | **56%** | 4 s |
| B — Graphiti 0.30 + FalkorDB 4.22 | `deepseek-v4-pro`, thinking off | 81% | **75%** | 1240 s (≈6.6 s/session) |
| C — Memobase 0.0.42 | `deepseek-v4-pro`, thinking off | 81% | **83%** | 258 s (≈1.4 s/session) |

Earlier runs, kept for the record (misleading, see "What went wrong"):
Graphiti with `deepseek-flash` 53%; Memobase with `deepseek-flash` or `deepseek-v4-pro` *with
thinking* 3% (silent empty extraction).

### What went wrong in the first round (lessons)

1. **Reasoning models + capped `max_tokens` = empty output, silently.** Memobase's LLM wrapper
   caps `max_tokens=1024`; DeepSeek models think first and spend the budget, so content is
   empty and the pipeline exits without error (`if not user_memo_str: return`). Same failure hit
   our own judge at `max_tokens=200`. Fix used: local gateway (`embed_server.py`) forwarding to
   DeepSeek with `thinking: {type: disabled}`. **Any engine we adopt or build must disable
   reasoning or size `max_tokens` for it.**
2. **Graphiti in `json_object` mode**: DeepSeek sometimes echoes the JSON schema instead of an
   instance → patched with a validating client that retries (`systems/graphiti_sys.py`).
3. **FalkorDB 6.0** (released 2026-10-01) breaks Graphiti's fulltext index creation → pinned 4.22.
4. **Clean datasets flatter naive retrieval**: the baseline drops 86% → 56% with noise.

### Per-system analysis

**C — Memobase (best under noise).** Profile slots (semantic) + event timeline with *two dates*
(`mention` vs `event in`) — essentially our D21/D22 design. Robust to lexical traps. Fast ingest.
Weak points: project activity slowing (last push 2026-01), Python + Postgres + Redis server,
prompts officially only `en`/`zh`, the 1024-token cap above, misses on "this week"
(relative-period) and some partial detail answers.

**B — Graphiti (good, but structural mismatch).** Treats facts as *states that supersede each
other*: "went skiing at Cervinia" becomes "no longer valid from 7 Feb" after the Livigno trip,
so "last time I skied" / "how many times" fail. Excellent for real state changes (car, address).
Slow ingest, graph DB (Neo4j/FalkorDB) dependency, mixed-language facts.

**A — baseline.** Strong floor on point lookups and provenance; collapses with noise (coffee
machine answered for "che macchina ho?"; March trip pushed out of top-8); no date filter.

### Embedding models (retrieval only, no LLM — `emb_eval.py`)

recall@8 of gold sessions, vector-only; `st:` = sentence-transformers exactly as Arkimede's
`embedding-service` (same query/document prompt logic):

| Model | Base | Noise | RSS | CPU emb/s (M4) |
|---|---|---|---|---|
| `st:intfloat/multilingual-e5-small` | 85% | 59% | 0.98 GB | 389 |
| `st:mixedbread-ai/mxbai-embed-large-v1` | 84% | 60% | 0.77 GB | 8 |
| `st:BAAI/bge-m3` | **96%** | **76%** | 1.41 GB | 26 |
| `paraphrase-multilingual-MiniLM-L12-v2` (fastembed) | 88% | 75% | — | 273 |
| `intfloat/multilingual-e5-large` | not measured (fastembed ONNX external-data bug) | | | |

Hybrid BM25+vector fusion *hurts* under noise (62-68% vs 75-76% vector-only) — fusion weights
must be tuned. Outcome: Arkimede moved to bge-m3 (2026-10-02, both deploys).
Note: the engine scores above used MiniLM; re-running B/C with bge-m3 is an open item.

### Decision status after round 1 (superseded by round 2 → D23)

The first-round decision ("build our own engine D") was based on broken runs and is withdrawn.
Options now on the table:

1. **Adopt Memobase as the engine** behind Recordare's twin layer (fastest path; must handle
   thinking/token cap, Italian prompts, project health risk — possibly fork).
2. **Build D (our design)** taking Memobase's model as the reference (profile + dated events) in
   NestJS/Postgres, with what we already know beats it on paper: date-range filter, digests,
   plans/validity, provenance, disclosure tiers.
3. Hybrid: Memobase now, D later behind the same API.

Before deciding: re-run B/C (and a D prototype) with `bge-m3` embeddings and with a local model
(Ollama, e.g. qwen3 with thinking off) to check the sovereign/local deployment story.
