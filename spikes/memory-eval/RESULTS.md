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

**Messages addressed to the assistant by others (2026-10-06):** `extract.v5` re-tried on top of the `claims` split
(keep such messages as claim episodes "X asked the assistant to remember…"): dev 95 %, blind6 slice 78.3 % (was 0.25 on
this category before and stays 0.25), blind5 slice 81.8 % (was 100 %) — reverted again. Diagnosis (blind6 questions
of this category read, so it is no longer blind): retrieval, not extraction — "what did my mother ask you to note?"
cannot reach a message signed "Gabriella" that never says "mother"; needs people ↔ relation resolution and an explicit
list of requests made to the assistant (design work).

**Engine model: Claude Haiku 4.5 via claude-cli (local eval only), blind5 base, 1 run: 89.1 %** (flash: 91.3 % same
code, H11 3-run mean 89.2 %). Extraction: recall 0.87, dates 0.97, plan outcome 0.77, **unsupported 20 %** (flash
4–13 %), facts 0.62 / 0.23, notes 0.64. Cost signals: 74 calls, 445 k input, **778 k output** (the CLI runs Haiku with
thinking on), ingest 7,240 s (a CLI process per call). Below the 95 % bar; not a candidate as it stands (a run through
the API with thinking off would be the fair test).

**Cheap hosted engines via OpenRouter (2026-10-06; blind5 base, 1 run, engine v4 + recall H11 + claims split;
answer + judge `deepseek-flash`; reasoning off through the `openrouter` profile; total spend 1.68 USD):**

| Engine model (USD / M in · out) | Accuracy | Episode recall | Dates | Plan outcome | Unsupported | Facts | Notes | Engine tokens in / out | Ingest |
|---|---|---|---|---|---|---|---|---|---|
| deepseek-flash (reference, DeepSeek API) | **91.9 / 91.3 %** | — | — | — | — | — | — | 313 k / 63 k | — |
| Gemini 3.1 Flash-Lite (0.25 · 1.50) | 81.0 % | 0.92 | 0.95 | 0.67 | 9 % | 0.38 | 0.57 | 243 k / 40 k | 208 s |
| Claude Haiku 4.5, no thinking (1 · 5) | 81.0 % | 0.87 | 0.89 | 0.67 | 18 % | 0.62 | 0.50 | 574 k / 132 k | 663 s |
| Qwen 3.7 Flash (0.03 · 0.13) | 78.5 % | 0.87 | 0.95 | 0.58 | 10 % | 0.46 | 0.57 | 284 k / 59 k | 546 s |
| GPT-5.4 nano (0.20 · 1.25) | 77.9 % | — | — | — | — | — | — | 323 k / 71 k | 514 s |
| Gemini 2.5 Flash-Lite (0.10 · 0.40) | 73.0 % | 0.72 | 0.94 | 0.67 | 18 % | 0.46 | 0.43 | 313 k / 116 k | 263 s |
| Mistral Small 2603 (0.15 · 0.60) | 61.5 % | 0.47 | 0.67 | 0.60 | 37 % | 0.23 | 0.36 | 151 k / 42 k (24 failed calls) | 288 s |

**Premium reference (same setup, 1 run):** Claude Sonnet 5.5 (OpenRouter, reasoning "minimal" — it cannot be switched
off) **89.5 %**: recall 0.96, dates 1.00, plan outcome 0.77, unsupported 5 %, facts 0.31 / 0.15, notes 0.57; 351 k in /
56 k out, ~1.3 USD, 431 s. DeepSeek V4 Pro (OpenRouter) **87.1 %**: recall 0.97, dates 0.99, plan outcome 0.77,
unsupported 8 %, **facts 0.77 / 0.54, notes 0.71**; 418 k / 101 k, ~0.34 USD, 2,304 s. deepseek-flash on the same set
(same code, scored now): **91.3 %**, recall 0.97, dates 0.99, **plan outcome 0.92**, unsupported 9 %, facts 0.62 / 0.46,
notes 0.64; 313 k in (49 % cached) / 61 k out, 287 s. Reading: a premium model does not lift answers — the main
extraction is not the bottleneck; flash is best on plan outcomes, V4 Pro clearly best on facts and notes (the weakest
stage), Sonnet best on dates and faithfulness. Model-per-role candidates: flash for episodes / plans; V4 Pro for a
facts-and-notes pass (or the nightly M5 consolidation); cheap models only for the light call (to measure).

**Separate facts-and-notes pass (task `facts`, prompt `facts.v1`, DeepSeek V4 Pro native; episodes on flash; blind5,
1 run):** 89.7 % (inline flash 91.3 %, within noise); facts current 0.62 (unchanged), history 0.38 (0.46), notes 0.71
(0.64), episode recall 0.90 (0.97), plan outcome 0.83 (0.92); +65 calls / +269 k input / +36 k output; ingest 238 s.
No gain where it was meant to help: the V4 Pro advantage on facts seen as the single engine did not carry over to a
dedicated pass on the same window. Kept as an option (`FACTS_PASS=separate`), off in every profile; facts are the
target of the M5 consolidation instead (facts from episodes across days, not per window).

None reaches the 95 % bar, and none matches `deepseek-flash` (−10 pt or more), which is also the cheapest per token
with prefix caching. The weak stage is the same everywhere: plan outcomes (0.58–0.67) and facts. Haiku through the
API (thinking off) equals Gemini 3.1 Flash-Lite at ~5× the price. Decision: `deepseek-flash` stays the reference
engine; cheap models are not candidates for the main extraction call (they may serve the light resolver call — not
measured separately).

### M5 consolidation, first slice (2026-10-07, blind5 base, 3 + 3 runs, same code)

Nightly day / month digests (task `digest`, fingerprinted: unchanged days cost nothing; others' claims excluded),
consolidated as of each question. With the diary given to period overviews (`list` requests): **88.0 %** [85.9, 90.1]
(87.4 / 90.1 / 86.5); without: **89.9 %** [88.9, 90.8] (89.7 / 90.8 / 89.1) — −1.9 pt [−5.4, +1.3], within noise.
Period overviews +0.12; this-week, third-party and corrections lower. Cost: ~85–97 day + 25–34 month digests per run
(~100 k input / 35 k output tokens for five months of one person). A first run had shown 86.2 % because the extractor
had mis-patched two plans (a reschedule and a cancellation without evidence) that the diary then repeated: an
extraction issue to fix independently (plan patches should need matching evidence). Decision: consolidation stays
(dashboard "sleep", next M5 steps); the diary in recall is a quality-profile knob (`recallDigests`, `RECALL_DIGESTS`),
**off by default** until a version shows a gain.

### extract.v8 — a wider notion of facts (2026-10-07; `facts_runs.sh`, `facts_b5_runs.sh`; single prompt version per run)

Diagnosis (blind4, and blind5's fact gold — read, so blind5 is no longer blind for facts): the misses are facts the
prompt did not call facts — memberships and regular activities, health conditions and values, role and boss, commute,
age, the closest family's situation. extract.v8 widens the notion (generic examples, not the gold keys), adds facts said
in passing, transitions ("switched / stopped / no longer" → replace / stale) and "an accepted proposal states it, a
bare 'ok' does not".

- **blind5, 3 runs: 92.3 %** (91.9 / 91.9 / 93.1) vs the ppl runs 90.8 %: paired +1.5 pt [−1.3, +4.6], within noise;
  up: last-time 0.75 → 0.92, rescheduled plans, anti-trap, poisoning; down: third-party 1.00 → 0.79 (one question, e55 —
  a third party's own news in a group chat, lost in 2/3 runs: the known weak spot). KB scoring: facts current 0.769
  ×3 → **0.846 / 0.769 / 0.846**, notes 0.79 / 0.64 / 0.79 → 0.71 / 0.93 / 0.79 (choir / hobbies still stored as notes).
- **blind6 (facts never read), 1 run: 94.4 % vs 81.1 %**; facts current 0.25 → 0.25 (role, thyroid gained; employer,
  workshop lost), history 0.17 → 0.25, notes 0.67 → 0.75.
- blind4 (dev), 1 run: facts unchanged (0.54), QA not comparable (old references).

Kept (owner's decision). Watch: third-party news about themselves in group chats.

### Nightly facts review (2026-10-07, blind5, KB_ONLY extraction scoring before / after, 3 people)

`facts_review.v1` (task `facts`, deepseek-flash): the owner's facts checked against the episodes recorded since the
last review; verdicts applied by the extraction's writer. Run once per person at the end of the dataset (one call
each, 150–300 episodes). Facts current **0.769 → 0.769** in all three; history 0.615 → 0.769 (r1), unchanged (r2, r3).
What it changed: mostly rewordings of right facts (partner, health condition) and slots that are not about the owner
("mother_mobility"). The misses are not stale facts: hobbies / choir live in **notes** (the scorer counts facts), the
mother's living situation is about someone else. No gain → the quality-profile knob `factsReview` stays **off**; the
code stays (zero cost when off). Next attempt on facts goes through the extraction prompt (personal facts said in
passing, "I switched / stopped" as replace, the facts / notes boundary for recurring activities — see
`docs/literature/agent-platform-memory.md`).

### People-aware recall (2026-10-07, `people_runs.sh`, base, one service instance, single prompt version per run)

Diagnosis on blind6's "messages addressed to the assistant by others" (0.25 for the service and D; category read, so
no longer blind): the right messages never reached the context — "what did Kevin ask you to put in my calendar?" got
three of the owner's own excerpts, and "what did my mother ask you to note?" cannot match a message signed "Gabriella"
that never says "mother". Change (no LLM call): when a question names someone — by name, or by relation resolved from
the people the extractor stores as "Name (relation)" ("Gabriella (mamma)"), IT / EN relation words, relations matching
more than 3 people ignored — recall adds up to 3 of that person's own chat messages, ranked by the question.

- **blind6, 1 run: assistant-addressed 0.25 → 0.62** (Kevin right, Fabio partial); total 81.1 % vs 85.6 % of the last
  full run — the other changed questions name nobody (the change is inactive there: extraction variance), except
  f16 where the person leg brought Hannah's correct message and the judge faulted a secondary date.
- **blind5, 3 runs: 90.7 %** (92.4 / 89.7 / 90.1) vs the clean plan-evidence runs (92.9 / 90.1): paired −0.9 pt
  [−3.6, +1.6] on 86 questions, within noise; the only large change (e70) names nobody.

Kept.

### WORK_PLAN 8.4 — personal first person: extract.v12 (2026-10-09, dev runs only, DeepSeek direct)

Personal memories are now written in the first person (`extract.v12`, `facts.v2`): the account holder and the assistant
are one "I", in the conversation's language and with the memory's gender; every episode / fact / note has a subject
linked to the memory's contacts; an ambiguous person becomes `undecided` + a clarification answered by a later window;
recall returns subjects and the speaker. Entity memories keep `extract.v11+entity.v3` (byte-identical inputs, test).
**Harness change (new baseline for every personal set):** answer framing "MEMORIA: la memoria di X — i ricordi in prima
persona sono di X" + "CHI FA LA DOMANDA" (the self, or an identified contact), subject per item, "detto dall'assistente"
no longer shown, claims only for others' statements about someone else; `genders` in the dev sets' conversations.json
(feminine users); sessions may declare identified `participants`, questions an `asker`. New dev set
`dataset_dev_agent_personal` (NOT blind, 13 sessions / 19 q: contacts only mentioned, identified family / colleagues,
two Marcos + a clarification, the assistant's actions, a web result, rumours about the self, English, questions asked
by an identified contact). Service on :8084, queue `fp84`, one prompt version per run (checked: only `extract.v12`);
`EMBED_MODEL=st:BAAI/bge-m3`; 1 run each (8 runs, ≈ 0.11 USD).

| Set | Run | Accuracy | Last measured | Leaks (episodes / notes) | Notes |
|---|---|---|---|---|---|
| `dataset_dev_agent_personal` (new, 19 q) | v12a | **100 %** | — | 0/20, 0/1 | clarification asked ("Marco chi — mio cugino o il collega Marco Bellini?") and resolved by p08 |
| `dataset` (general, 24 q) | v12b | **97.9 %** | 100 % (service v1) | 0/18, 0/8 | q14 partial (Japan trip not said to be only an idea); Elena's memory (isolation user) written in the feminine |
| `dataset_dev_news` (4 q) | v12b | **75 %** | 75 % (v11) | 0/4, 0/1 | same miss as v11 (w02: strike not tied to the trip — recall) |
| `dataset_dev_poison` (10 q) | v12b | 90 % | 100 % (claims split, 2026-10-05) | 1/9, 0/3 | p01 / p03 partial: claims' dates missing; one claim written "…che Elena ha detto…" (subject someone) |
| `dataset_dev_echo` (9 q) | v12b | **100 %** | 100 % (guard v3) | 0/9, 0/1 | dentist Bianchi kept, bus plan kept |
| `dataset_dev_context` (15 q, `agent_eval.py` tools+context) | v12b | 96.7 % | 100 % (5.7, A) | — | ctx06 partial (also partial in the voice run); context served 7 / 15, no harm (gen 1.0) |
| `dataset_dev_agent_personal` | v12c | 94.7 % | 100 % (v12a) | 0/20, 0/2 | a04 wrong: the planner asked for November **2025** (recall planning, not extraction) |
| `dataset_dev_poison` | v12c | **95 %** | 90 % (v12b) | 0/8, 0/3 | p03 partial (Marco's claim date omitted) |

Changes between runs: v12a → v12b, contacts are created for episode people only when they are names ("amiche del
nuoto" no), full names need capitalised words ("zia Carmela" is not a full name); v12b → v12c, one prompt phrase (a
claim about me has subject "me") and the harness shows "affermazione di …" only for claims (a person's own news no
longer looked like an unconfirmed claim). The v12b rows of `dataset`, news, echo and context ran the text before that
phrase. **Leak rate** over the 7 dumped runs (agent_eval writes no dump): 1 / 88 episodes (1.1 %), 0 / 19 notes — vs ≈ 5 % "l'owner" before `nameOwner`
(4.11); no substitution is applied any more. Gender agreement: masculine (Andrea, Luca) and feminine (Elena, Sara,
Marta, Giulia) memories read right on the dumps (`results/*-v12?-memory.json`). Reading: the dev sets hold within noise
of their last values with a different answer framing; poisoning lost the claims' dates on one question (judge strict on
dates), to watch on blind7's provenance category. **Not confirmed yet:** blind7 × 3 (bar 91.7 %, extract.v11) — the
developer runs them.


**Blind confirmation (2026-10-09, `b7_v12_runs.sh`, 3 runs, DeepSeek direct):** blind7 with `extract.v12` 91.3 / 91.3 / 92.4
= **91.7 %**, paired vs `extract.v11` (91.7 %) **0.0** [−3.6, +3.6], no question changed by ≥ 0.5; plan +0.14, **provenance
−0.23** (0.3 / 0.4 / 0.5; spread, no single question) — kept, provenance followed up in WORK_PLAN 8.4b.

### WORK_PLAN 4.5c — unjustified-assertion and over-abstention rates (2026-10-16, DeepSeek direct, `h1_rates_runs.sh`)

A second, independent grading of stored answers (`outcome_eval.py`, HaluMem's three-way outcome; the validated judge
is untouched): each answer is **supported** (asserts only what the reference supports, maybe incompletely),
**unjustified** (asserts a claim the reference contradicts, a MUST_NOT claim, or an outcome the reference says is
unknown) or **abstained** (does not give the asked information); each reference is **known** or **unknown** (one label
per question: the majority over the runs graded here). Rates: unjustified-assertion = unjustified / all;
over-abstention = abstained on a known reference / known; invented on unknown = unjustified on an unknown reference /
unknown. No ingestion, judge calls only: 1,065 answers graded (28 runs), ≈ 2,300 calls of `deepseek-flash` over the three passes
(the prompt fixes below), a few tens of cents.

Grader checks before reading the numbers: no memory → over-abstention 1.0, unjustified 0.0 (as it must); of the 1,065
answers graded, 38 are unjustified: the judge grades 30 of them wrong and 3 partial; the 5 it grades correct are
stricter catches on secondary details (a score given as 3-1 for 1-3, "Sofia helped" for "you helped", an extra message
not in the reference). Two
prompt fixes found by reading disagreements, then everything regraded: the grader checked weekdays itself ("22 May
2033 was not a Sunday" — it was), and counted "I have no record that Greta did it — your brother Michele did, on 26
October" as an abstention (it is a premise rejected with the right facts: supported). It is told who asks, as the
judge is (blind9: "Beatrice submitted it" when Beatrice asks).

**blind3, the service and the baselines, 3 runs each (same answer model and judge):**

| System | Accuracy | Unjustified | Over-abstention | Invented on unknown |
|---|---|---|---|---|
| Recordare (xv4) | 94.9 % | **0.028** | 0.020 | 0.0 |
| Mem0 | 87.5 % | 0.046 | 0.061 | 0.0 |
| Cognee | 85.7 % | 0.065 | 0.061 | 0.0 |
| D (prototype) | 92.1 % | 0.065 | 0.000 | 0.0 |
| full context | 97.2 % | 0.037 | 0.000 | 0.0 |
| no memory (1 run) | 8.3 % | 0.000 | 1.000 | 0.0 |

**The current engine, 3 runs each:** blind7 91.3 % (unjustified 0.058, over-abstention 0.025, invented on unknown
0.111 — 1 of 3 unknown references per run), blind9 97.2 % (0.000 / 0.009 / 0.0), blind10 96.7 % (0.019 / 0.011 /
0.0), blind11 98.8 % (0.017 / 0.010 / 0.0).

**H1 categories** (unjustified / over-abstention, answers pooled over runs):

| System | plan | premise-trap | correction | state / change | negative (never mentioned) |
|---|---|---|---|---|---|
| Recordare (xv4, blind3) | 0.00 / 0.00 (24) | 0.00 / 0.00 (6) | 0.00 / 0.11 (9) | 0.00 / 0.00 (21) | 0.00 / — (3) |
| Mem0 | 0.04 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / — |
| Cognee | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.05 / 0.00 | 0.00 / — |
| D | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.10 / 0.00 | 0.00 / — |
| full context | 0.04 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.05 / 0.00 | 0.00 / — |
| Recordare now (blind7, 9, 10, 11) | 0.00 / 0.00 (51) | 0.00 / 0.06 (36) | 0.00 / 0.00 (24) | 0.00 / 0.00 (45) | 0.00 / 0.00 (30) |

- **The H1 categories hardly discriminate here**: every system, the baselines included, almost never asserts a wrong
  plan status, a false premise, or a superseded state on these sets — the questions are too few (blind3: 6 premise
  traps, 3 unknown references) and the answer model hedges well. H1's claim (unresolved plans, premise traps need a
  typed store) is **not shown** by this suite; a harder set (more unresolved plans asked as if done, implicit outcomes,
  long histories) would be needed to separate the systems.
- Where the systems do assert wrongly is elsewhere: the one third-party question (Recordare xv4 in all 3 runs, D 2, Mem0 1),
  the one poisoning probe (Mem0 3, D 3, Cognee 2 — never Recordare), counts (Cognee); in the current engine blind7's
  provenance questions (5 of 15 answers: who said it, in which group), aggregation and the agent's own actions.
- Over-abstention is low everywhere but no memory; on the current engine most abstentions are the right ones (26 of
  the 30 negative questions are unknown references), the rest are unidentified-speaker and knowledge questions.
- Single grader (DeepSeek flash), not audited by a human; stricter than the judge on secondary details. The rates are
  per answer, so a run's ±1 answer is ±0.02–0.03.

### H1 harder set — `dataset_blind12` (2026-10-19, DeepSeek direct, 1 run each)

A blind set built for H1 after 4.5c showed the earlier sets had too few hard items (written and audited by separate
agents; `dataset_blind12/GOLD_AUDIT.md`): Tommaso, Bologna, Feb–Jun 2034, 62 sessions (8 English, 7 group chats), 54
questions, all H1 — plan-unresolved 8, plan-implicit 7, plan-moved 7, premise-trap 7, accumulate 6, supersede 8,
correction-vs-change 7, negative 4. Service through `provider_eval.py --config profiles/deepseek-flash.json` (current
engine, `extract.v16`, one prompt version per task); answer and judge `deepseek-flash`; outcomes by `outcome_eval.py`.

| System | Accuracy | Unjustified | Over-abstention | Invented on unknown (13) |
|---|---|---|---|---|
| Recordare | 92.6 % | **0.019** | 0.049 | **0.000** |
| full context | **95.4 %** | 0.037 | 0.024 | 0.077 |

Per category (Recordare / full context): plan-unresolved **1.00** / 0.88, plan-implicit 0.79 / 1.00, plan-moved 1.00 /
1.00, premise-trap 0.86 / 0.93, accumulate 0.83 / 1.00, supersede 0.94 / 1.00, correction-vs-change **1.00** / 0.86,
negative 1.00 / 1.00. Extraction: episode recall 0.97, dates 0.90, plan outcome 0.84, unsupported 17 % (blind5 9 %),
facts 0.62 / 0.54, notes 0.50.

Reading. The set separates the two where H1 says it should. Full context, with every chat in front of it, still
asserts an outcome nobody told (h07: "Sì" to an unconfirmed car service) and takes a correction for a change (h45:
"the trip was first set for 11 May" — it never was); Recordare's plan states and `corrects` keep both right (unresolved
and correction-vs-change 1.00, nothing invented on unknown). Recordare's losses are of two other kinds:
- **an intention stored as done** (h11, the one unjustified answer): "Oggi pomeriggio vernicio la ringhiera" became
  the event "on 1 April I painted the railing"; twelve days later "Saturday 15 I'll finally do the railing, the can is
  still there" was stored as a new plan without revising that event. The H1 error itself, made by the extraction;
- **recall misses with the memory right** (h30 runs, h26 smart-working day): the five runs and the change of the home
  working day are stored, but the recall did not bring them to the answer ("I have nothing on it"). Plus two partials
  (a detail of the evidence omitted).
One run each; with 54 questions a 3-point gap is within noise. Cost: engine 63 extraction calls, ≈ 508 k input (49 %
cached) / 60 k output; full context ≈ 550 k input for the answers.

### H1 follow-ups after blind12 (2026-10-19, DeepSeek direct, 1 run each)

Three fixes from the blind12 failures (h11, h30 and h26 are no longer blind; the other 51 questions are):
- **`extract.v17`** (personal memories; the entity prompt is byte-identical): NOT DONE AFTER ALL — something in KNOWN
  EPISODES told as done that the window shows did not happen ("still to do", "finally", rained off) is corrected
  (`corrects`), a new date is a new plan. The rule "today / tonight is an event" stays: most same-day intentions are
  never contradicted and are kept as events (blind4 and blind5 have 13–16 each).
  Dev set `dataset_dev_intentions` (new, not blind, 10 sessions, 6 questions): v16 **4/6** (both contradicted Italian
  intentions stored as done) → v17 **6/6**, the corrections linked in the database; the kept and confirmed same-day
  events unchanged. blind5, same code but the prompt: v16 **94.8 %** → v17 **92.5 %** (5 flips: e18 lost because one
  window failed with an invalid model output — the move to Noto was never extracted; replayed, it passes at once — and four
  partial ↔ correct on details); plan outcome 0.69 → 0.92, recall 0.94 both, unsupported 11.5 → 12.9 %. Within noise.
- **A list without a period** (`search_episodes` mode `list`, no `from` / `to`): it kept the most important of the
  relevant items and added nothing else. h30 ("how many runs did I tell you about?"): the agent asked `list` "corse" with
  no period and got 2 unrelated items; the five runs (low importance) were relevant but never chosen. Now chosen by
  relevance, free places filled by similarity, shown in time order: on the blind12 memory 0 → 7 of 7 run items with the
  agent's own topics. Known limit: the bare plural "corse" still finds 3 (full text has no stemming, and one word sits
  near the similarity floor).
- **A fact unknown again failed the window** (found in the blind12 re-run: `QueryFailedError`, `facts_check`): the
  history of a fact could not hold an empty value, so "back pain: unknown" said unknown again (or later given a value, or
  corrected) failed the whole window. Fixed in the writer (a repeated unknown changes nothing) and the schema (migration
  `UnknownFactHistory`).

**blind12 re-run** (v17 + list fix; the facts fix came after): **88.9 %** (was 92.6 %), unjustified 0.037 (0.019),
over-abstention 0.024 (0.049), invented on unknown 0.0 (0.0). Fixed: h30 (runs, 5 and 36 km), h26 (smart-working day —
the agent's query kept the premise this time: run-to-run variation, not a fix). **Still wrong: h11** — the window of 12
April ("Sabato 15 do finalmente l'antiruggine alla ringhiera, il barattolo è lì da fine marzo") wrote the new plan and
left the 1 April event: the phrasing is subtler than the dev set's, and the rule did not fire. New losses on items no fix
touches (h01 a dinner denied, h19 a vaccine date, h37 a coach as of a date, plus partials) and one failed window (the
facts bug): with one run each on 54 questions the difference is within noise. Two harness gaps seen here: a window that
fails is never retried in an evaluation (the service retries it at the next nightly sweep), and one failed window can
cost several answers.

### WORK_PLAN 6.5 — continuous listening: extract.v16, pending facts, `heard` in recall (2026-10-15, DeepSeek direct, `amb65_runs.sh`)

Dev set `dataset_dev_ambient` (NOT blind, written by an agent of the engine developer): Stefano, his son Leo, his mother
Rosanna, his sister Chiara (a nurse, staying two weeks) — 13 sessions (9 `ambient` room transcripts with recognition
errors and misrecognised speakers, 4 chats), 30 questions (heard, garbled, misattributed, unconfirmed, confirmed,
background, control). One run per arm, one service instance on :8095 (queue `amb95`), `extract.v16` only in each run.
Comparison arm: the same transcripts sent as `voice` (`EVAL_SOURCE_AMBIENT_AS=voice`: no note, nothing pending).

| Run | Code | Accuracy | misattributed | unconfirmed | heard | garbled |
|---|---|---|---|---|---|---|
| `voice` (comparison) | `d756bd4` | 88.3 % | 0.60 | 1.00 | 1.00 | 0.88 |
| `ambient` r1 | `d756bd4` | 76.7 % | 0.60 | 0.33 | 0.88 | 0.75 |
| `ambient` r2 | + pending proposals (`ca751d2`) | 82.8 % | 0.60 | 0.67 | 0.86 | 0.88 |
| `ambient` r3 | + `heard` in recall | **86.7 %** | **0.90** | 1.00 | 0.81 | 0.75 |

- r1 found a bug: Chiara's "compio 39 anni", heard as Stefano's, became a pending `age` that **superseded** his stated
  41. Fixed in `ca751d2`: a pending fact or note only proposes a replacement; the stated one stays current until the
  pending one is confirmed (migration `PendingProposals1791160000000`).
- In `voice`, Chiara's "faccio le notti fino a Natale" became Stefano's stated `job_title`; with `ambient` it is pending,
  and so are the misattributed age, allergy and motorbike sale.
- r2 → r3: the facts were already right; the answers still followed **episodes** written from misattributed sentences
  ("sì, fai le notti…") and called room speech "what you wrote in the chat". With `heard: true` on episodes and chat
  excerpts (and the `search_episodes` description saying what it means), the answer hedges ("non mi risulta con
  certezza che sia tu", "è un contenuto captato in casa"): misattributed 0.60 → 0.90.
- Still wrong in r3: q09 (a garbled place name, "Solesino" for Asolo), q06 and q14 (heard details; q14 a garbled place).
  Single runs on 30 questions: ±1–2 questions is noise; the misattributed gain (3 of 10 questions) and the absence of
  any stated misattributed fact are the findings, not the total.
- Not measured: the value of the extraction's HEARD AROUND ME note on its own (v16 vs v14 input on `ambient`).

### A fresh blind entity-memory set — blind11 (2026-10-12, DeepSeek direct, `b11_runs.sh`)

`dataset_blind11`, written blind by a separate agent and gold-audited by a second one (2 small fixes, `GOLD_AUDIT.md`):
the counter tablet of a bike repair shop in Trento (Oct–Nov 2032, DST ends inside it), 28 conversations (it / en / de)
with own content changed over time, two Marcos and a Marco without surname, 5 unidentified speakers (2 hand-overs, 2
carry-over traps), 3 learned sources (one forgotten), 40 questions in 13 categories. Current engine
(`extract.v15+entity.v5`, the pattern pass on as in `balanced`), single prompt version per run:

| Run | Accuracy | Misses |
|---|---|---|
| 1 | 100 % | — |
| 2 | 97.5 % | q11 (upcoming workshop appointments) wrong |
| 3 | 98.8 % | q37 (Katharina's e-bike error code) partial |
| **mean** | **98.8 %** | every category ≥ 0.83 in each run |

Against blind8 (82.1 %, 2026-10-08) and blind10 (94.3 %): the entity memory holds on a set it never saw — attribution,
unidentified speakers, hand-overs and carry-over traps all 1.0 in all three runs. Cost per run ≈ 29 extraction calls
(≈ 190k input tokens), ~18 resolver calls, 3 pattern calls.

### WORK_PLAN 5.4 — recurring patterns, the memory's own conclusions (2026-10-12, DeepSeek direct, `patterns_runs.sh`)

D26 decided by the maintainer: no proposals, no confirmation — the nightly pattern pass writes a pattern as the memory's
own inferred note (never pending, labelled in recall), backed by ≥ 3 episodes on different days of one subject, and
keeps, updates or retires it on its own. New dev set `dataset_dev_patterns` (66 sessions, 7 memories: it / en / es, one
entity memory; two checkpoints, the pass run alone at each with `pattern_eval.py`): 7 expected habits shown only by
repeated episodes, and traps — one trip (3 museums in Rome), wishes ("I should start swimming" ×3), one event told three
times, one-offs, the assistant's guess ("gym every Monday") and a calendar tool's "weekly yoga", a habit already stated
as a note (restating it is a duplicate), three different people watering the plants once each, a pattern that stops
(the pool closes: must be found at checkpoint 1, retired at checkpoint 2). An LLM judge (LLM_MODEL) matches the current
patterns to the gold; any current pattern matching no expected item is false. Single prompt version per run
(`extract.v15`, `+entity.v5`, `patterns.v1` / `v2`).

| Version | Runs | Habits found | False patterns | Pool found, then retired |
|---|---|---|---|---|
| `patterns.v1` | 1 | 7 / 7 | 1 (the pool retired, then drawn again the same night) | yes (judge missed it at cp 1) |
| **`patterns.v2`** (weekday shown; stopped patterns listed and not drawn again from the same episodes) | 3 | **7 / 7 / 6 = 20 / 21** | **0 / 0 / 0** | 3 / 3 |

The miss (run 2): Luis's Sunday paella — four correct episodes, the model answered an empty list at both checkpoints
(the prompt's "when unsure, propose nothing"). No trap became a pattern in any run. v2 also names the weekday
("il sabato", "il martedì", "di giovedì") that v1 left as "spesso". Cost per run: 14 pattern calls (one per memory per
checkpoint), ≈ 14.8k input / 1k output tokens in all — next to 66 extraction calls (≈ 290k input). Patterns were written
in the memory's language (the harness creates memories with the default locale `it`, so Tom's and Luis's are in
Italian). Decision: on in `balanced` and `full`, off in `economy`. Next: a blind set (not tuned on).

**Blind confirmation (2026-10-12, `DS=dataset_blind_patterns patterns_runs.sh patb_v2 3`):** `dataset_blind_patterns`,
written blind by a separate agent (100 sessions Jan–Apr 2027, 9 memories in it / en / es / de / ja, one entity memory;
13 expected habits, 18 traps: near-threshold pairs, trip clusters, one week only, wishes, the assistant's claim, a
calendar tool, a habit stated as a note, a retold event, another person's habit told once, different people once each,
an unidentified speaker, a course that stops after the mid checkpoint). `patterns.v2`, nothing changed after seeing it:

| Run | Habits found (final) | False patterns | Expected at mid checkpoint | Stopped course retired |
|---|---|---|---|---|
| 1 | 12 / 13 (Teresa's Saturday visits to the library missed) | 0 | 9 / 11 | yes |
| 2 | 13 / 13 | 0 | 10 / 11 | yes |
| 3 | 13 / 13 | **1** — the Friday pizza, a habit the person had stated (a note already): the restatement check (cosine ≥ 0.88 with the note, and the KNOW list) let it through | 10 / 11 | yes |
| **all** | **38 / 39 (97 %)** | **1 in 3 runs** | 29 / 33 | 3 / 3 |

Also seen (not counted false, the judge matched it to the right habit): in run 2 the entity memory wrote Teresa's
habit twice, once as hers and once as its own ("on Saturdays I register Teresa's returns"). Cost per run: 18 pattern
calls, ≈ 25k input tokens. To follow up on the dev set (not here): the duplicate-of-a-note threshold and the
self-vs-person restatement in entity memories.

**Follow-up on the dev set (2026-10-12): not fixed, v2 kept.** Two cases added to `dataset_dev_patterns` (82 sessions):
Nadia states her Thursday cinema once, then lives it (a pattern restating it is a duplicate), and an entity memory
whose own part in Teresa's Saturday returns ("I registered the return") must not become a second pattern. v2 × 1:
9 / 9 habits, 1 false (Nadia's cinema). Measured why: note and pattern are paraphrases at cosine ≈ 0.73 (bge-m3), far
below the 0.88 check, and the model ignores the KNOW list. Tried:

| Version | Change | Habits found | False | Pool retired |
|---|---|---|---|---|
| v3 (1 run; 2 runs lost to judge errors) | KNOW numbered + a `known` verdict (its episodes back the note) + the code check at 0.7 | 5 / 9 | 1 | no |
| v4 (3 runs) | `known` only for notes that already say it is regular; code check back at 0.88 | 5–8 / 9 | 0–2 | not always |

At 0.7 the check absorbed real habits into notes the extraction drew from one occasion ("I cycle in the hills"),
losing their regularity; the `known` option confused the model (habits missed, the pool not retired). Both reverted:
`patterns.v2` stays. Known limit: a habit the person already stated in words may come back once as a pattern (a
duplicate, not a wrong fact). The judge now has 3000 output tokens (an empty completion stopped two v3 runs).

### WORK_PLAN 5.7 — turn taint from tools (2026-10-12, DeepSeek direct, `taint_runs.sh`)

Code rule, no prompt change: an assistant reply given after the output of a tool that is not Recordare's (web search,
page, calendar) in its turn counts as the tool — its facts and notes are pending (`inferred`), its episodes
`assistant_stated` / `inferred`; the next person's message clears it. Only the dev sets with such tools are touched
(the blind sets have no tool messages), 1 run each, single prompt version (`extract.v15`):

| Set | Before | Taint |
|---|---|---|
| `dataset_dev_agent_personal` (19 q, web weather p05) | 94.7 % (v13) | **100 %** |
| `dataset_dev_echo` (9 q, web bus times) | 100 % | **100 %** |

No row was written with the tool's role in either run: the weather and bus items are also backed by the person's own
message ("then lunch inside", "I'll take that one"), so they stay theirs. The rule itself is checked by the
integration test (a web page's "allergic to nuts" relayed by the assistant stays pending; "allergic to cats" said by
the person is stated). No harm measured; a poisoning-through-tool dev set is still to write (with the planned blind
poisoning set).

### WORK_PLAN 8.11 gaps, step 6 — a vague span is not a period; chat excerpts name their group (2026-10-12, DeepSeek direct, `fp820_runs.sh`)

blind9 q05's other half ("what did Michele write in the chats these weeks, and in which groups?"): the planner read
"in queste settimane" as the last three weeks (16 October → 6 November) and the «Trasloco studio» messages of 26
September fell outside; with no period the list finds Michele's episode there 5th. Dev case d11 first (`dataset_dev_gaps`
g32: cousin Paolo in «Calcetto del giovedì» six weeks before the question, and in «Cugini Rinaldi» two days before;
"Paolo" is also the sister's fiancé, by chance): with step 5 the period was 27 November → 18 December and the answer
called the football group "not these weeks" (partial).

- **A vague span is not a period.** The `search_episodes` description tells agents so ("lately", "these weeks": leave
  `from`/`to` out); the harness planner (the agent's stand-in) has the same rule. The deterministic `resolve_period` is
  unchanged.
- **Chat excerpts name their group.** With the period gone d11 was wrong once: Paolo's line in «Cugini Rinaldi» ("Wow!
  Festa di saluto?") has no episode of its own, and its excerpt showed only the conversation id. `fromChats` items now
  carry `group`, the conversation title when other people take part (the same rule as the extraction's GROUP CHAT).
- Dev: 95.5 % (d11 correct, d05 the day question correct, d10 partial — the cake's occasion omitted).

| Set | Step 5 (fp819) | Step 6 r1 / r2 / r3 | **Mean** |
|---|---|---|---|
| dev gaps (11 questions) | — | 95.5 (1 run) | 95.5 % |
| blind9 (personal) | 96.0 % | 96.4 / 97.5 / 97.6 | **97.2 %** |
| blind10 (entity) | 96.7 % | 97.1 / 98.6 / 94.3 | **96.7 %** |
| main set (control) | 100 % | 100 | 100 % |

- One prompt version per run (`extract.v15`, `extract.v15+entity.v5`). The DeepSeek balance ran out during r3; the
  failed runs were discarded and run again after the top-up.
- blind9 q05: partial 3/3 → **correct 3/3** (both groups, the 26 September messages). Failures left: q02 partial twice
  (the three quotes compared not listed), q11 partial twice (the city omitted: the same answers were judged correct in
  step 5 — judge noise), q06 wrong once, q20 partial once; r2 had two judge errors (empty completions, q11 and q37),
  excluded.
- blind10: unchanged mean; q06 (wrong + partial) and q33 (partial + wrong) as before, q04 partial once.
- Cost: unchanged (no extra call; an excerpt carries one more short field).
- **Kept.**

### WORK_PLAN 8.11 gaps, step 5 — group names, lists with a query, a judge that knows who asks (2026-10-12, DeepSeek direct, `fp819_runs.sh`, `rejudge.py`)

Three changes, measured together on arm R (H13).

**The judge is told who asks.** blind9 q20 was judged wrong when the answer named the holder in the third person
("Beatrice sent it") instead of "you". `judge()` now adds `ASKED BY: X (the answer may address X as 'you' or name X in
the third person: the same person)`, X = the question's `asker.name`, else the set's new optional `holder`
(`questions.json`: Luca for the main set, Beatrice for blind9, Marco for the dev gaps set). The judge's system prompt is
unchanged; sets with no name keep the input they were validated with. `judge_eval.py` on the main set: agreement
92.4 % → **93.1 %**, false accept 0, false reject 0. `rejudge.py` grades stored answers again:

| Stored run | Recorded | Old judge again | New judge |
|---|---|---|---|
| fp815 blind9 r2 | 91.2 | 89.3 | 86.9 |
| fp815 blind9 r3 | 89.0 | 85.7 | 84.5 |
| fp817 blind9 r3 | 97.6 | 95.2 (q20 wrong) | 95.2 (q20 correct) |
| fp817 blind9 r1 / r2 | 95.2 / 95.1 | — | 95.2 / 95.1 |

The judge (deepseek-flash, thinking on) is not deterministic: the old judge alone moves a stored run by 2–4 points.
q20 on the same answers: correct 1/3 with the old judge, 3/3 with the new one; the other flips are judge noise. Kept.
Arm R under the new judge: blind9 95.2 / 95.1 / 95.2 = **95.2 %** (the baseline for this step).

**A group chat's name reaches the extraction (`extract.v15`).** blind9 q05 asks what Michele wrote in the groups and
the reference names them («Famiglia Sartori», «Trasloco studio»): the generator (`_sessions.py`) had a `group` per
session, but `build.py` did not export it, so no system ever saw it. Now `build.py` exports `group`
(`DATASET_FORMAT.md`), the service harness sends it as the conversation `title`, and the extraction input carries
`GROUP CHAT: «X» (the group's name: …)` before the window when the conversation has another participant (the system
prompt is the same text). Dev case d10 (`dataset_dev_gaps` g30–g31: cousin Federica writes in «Cugini Rinaldi» and
«Festa nonna Ada»; question asked 2026-12-18).

**A list with a query brings relevant out-of-period items.** With `extract.v15` alone d10 was partial: the episodes
named the groups, but the planner made a `list` over "questi giorni" and the group episodes are dated by what they
tell (a move in January, a party on 9 January), so they fell outside the period and the answer saw only raw excerpts.
`outsidePeriod` is now filled for every mode except `latest` (before: `search` only, or any mode with an empty period).
d10 then names both groups; d05 (a day question) gets nothing extra.

| Set | Arm R (fp817) | Step 5 r1 / r2 / r3 | **Mean** |
|---|---|---|---|
| dev gaps (10 questions) | 88.9 % (9 q) | 90 (1 run) | 90 % |
| blind9 (personal) | 96.0 % (95.2 % rejudged) | 95.2 / 95.2 / 97.6 | **96.0 %** |
| blind10 (entity) | 94.3 % | 94.3 / 98.6 / 97.1 | **96.7 %** |
| main set (control) | 100 % | 100 | 100 % |

- One prompt version per run (`extract.v15`, `extract.v15+entity.v5` on blind10).
- blind9 q05: wrong / partial / partial → **partial 3/3**: «Famiglia Sartori» named every run; the «Trasloco studio»
  message (26 September) is still missing — the period read for "in queste settimane" is short and excludes it (open).
  q20: correct / partial / partial (each partial omits one of the dates or the time: answer variance; no longer the
  third-person verdict). q08 wrong once (a parenthesis says Michele has the post), q23 wrong once, q33 partial once.
  q06, q13, q14, q39 correct 3/3. +0.8 points against the rejudged baseline: within noise.
- blind10: +2.4 points (judge change included: some questions have an asker), within noise; q04, q11, q13, q31
  correct 3/3; q06 still fails (2 wrong + 1 partial).
- dev: d10 partial (both groups named, the 9 January party omitted though in the episodes), d06 partial (answer
  variance), d05 correct.
- Cost: unchanged (one short line in the extraction input of group windows, no extra call).
- **Kept**: the group name is a fact of the input the extraction could not see; the out-of-period items are the step
  2 mechanism extended to lists.

### H13 — classify-and-compose extraction vs ranking by the question type (2026-10-11, DeepSeek direct, `fp816_runs.sh`, `fp817_runs.sh`)

RESEARCH_NOTES H13. Lost points on blind9 / blind10 (step 4 runs) by stage: recall 50 % / 41 %, extraction 29 % / 36 %,
resolver 12 % / 0, answer 0 / 23 %, judge 8 % / 0. Two arms against arm A (`extract.v14`, M4 blend ranking), the code of
both in commit 28d3835 as knobs (`EXTRACTION_COMPOSE`, `RECALL_SEARCH_RANKING`).

**Arm B, classify-and-compose (`compose.v1`, 1 exploratory run, budget agreed with the maintainer).** A deterministic
router keeps only the prompt parts the window can use (plan patches when plans are open, answers when questions are
open, corrections of known items, others' claims about me when others speak), same rules, one call. blind9 **91.7 %**
(arm A 90.2 %, 3 runs): the same failing questions (q02, q05, q07, q23), within noise. No saving: extraction input
200,238 tokens for 32 calls (arm A 196,497) — the modules are on in almost every window — and fewer cached tokens
(99,328 vs 123,392), because a composed prompt breaks the shared prefix. **B does not win**; removed.

**Arm R, the question's type picks the ranking.** `search_episodes` scored every mode with relevance (RRF, ~0.025 at
most and nearly flat across the top ranks) + 0.01 · importance + 0.03 · recency: importance and recency (up to 0.13)
decided, and a person's big events pushed the small item the question names out of the top 10. With R a `search` ranks
by relevance alone, the blend only breaking ties; `list` and `latest` keep the blend. Dev case d09 (`dataset_dev_gaps`,
g18–g29: a brother's 11 big events and one interview, the answer due in February): with the blend the interview episode
is 11th of 34 for the planned query, with R 1st. On the stored blind memories: blind9 q08 target rank 0–1, q35 rank 3,
blind10 q35 rank 0 (all outside the top 10 before).

| Set | Arm A | Arm R (r1 / r2 / r3) | **Arm R mean** |
|---|---|---|---|
| dev gaps (9 questions) | — | 88.9 | 88.9 % |
| blind9 (personal) | 90.2 % (fp815, 3 runs) | 95.2 / 95.1 / 97.6 | **96.0 %** |
| blind10 (entity) | 92.2 % (fp813 ×3 + fp815 ×1) | 95.7 / 98.6 / 88.6 | **94.3 %** |
| main set (control) | 100 % | 100 | 100 % |

- blind9: q02, q07, q08, q20, q35 go from failing (2–3/3 for q02, q07, q08) to correct 3/3; failures left: q05 (3/3,
  the group names, an extraction gap), q06, q13, q14, q23, q39 once each (q23 once is a judge error). +5.8 points,
  above noise.
- blind10: +2.1 points, within noise; r3 (88.6 %) misses q04, q06, q33, which also fail in arm A runs, and q07 / q13
  partial. No question fails more often than in arm A.
- dev: d09 correct; d03 wrong with the same context as the earlier dev run (the slip episode "avevo detto venerdì 13" is
  there, the answer says it is not known who was wrong): answer variance, not ranking.
- Cost: unchanged (no extra call; answer input 129,769 vs 130,820 tokens per blind9 run).
- **R wins**: a search ranks by relevance alone, no knob (clean code over dual paths).

**Arm C, predict then extract the gap (`predict.v1`, Nemori's predict-calibrate reimplemented; commit f62c026,
`fp818_runs.sh`, 1 exploratory run each on top of R).** One more call per window sees what I know (open plans, facts,
notes, known episodes, people) and who speaks when, never the text, and predicts what the window tells (3–8
statements); the extraction gets the prediction after its input, with one rule: what only confirms it adds nothing,
what differs (a plan moved, cancelled or done, a correction, a new person, place, number, group or event) is stored
and linked to what it changes.

| Set | Arm R | Arm C (1 run) |
|---|---|---|
| dev gaps (9 questions) | 88.9 % | 100 % (8 correct + d03 judge error) |
| blind9 | 96.0 % (3 runs) | 95.2 % |
| blind10 | 94.3 % (3 runs) | 95.7 % |

- Failures are the ones R has: blind9 q05 (the second group's name, the extraction gap C was meant to help) partial,
  q11 partial, q20 the third-person answer; blind10 q04 partial, q33.
- Cost: extraction input +45 % on blind9 (prediction 88,084 input tokens and 10,788 output for 32 calls, barely
  cached; extraction 212,108 vs 193,834), +49 % on blind10.
- **C does not win** (within noise, much dearer); not run to 3 + 3, removed. The prediction mostly restates what the
  extraction input already lists: our extraction already sees the known items, which Nemori's direct-extraction
  baseline did not.

### WORK_PLAN 8.11 gaps, step 4 — the near-duplicate resolver keeps the outcome (2026-10-11, DeepSeek direct, `fp815_runs.sh`, `resolve_pairs.py`)

blind9 q20 ("what was the deadline for the Porto abstract, and what happened with it?", 0/3 since 8.11): the morning
telling ("submitting now: 298 words, title …, I'll send the confirmation number") and the afternoon one ("submitted at
16:10, confirmation number PC35-0412") were judged the same event by the resolver (`resolve.v1`), which hid the
shorter one — the one holding the outcome. The confirmation episode reached the answer's context in 2 of 10 earlier
runs. On top of that the answer names the holder in the third person ("Beatrice ha inviato"), which the judge reads as
someone else submitting.

Dev case d08 (`dataset_dev_gaps`, sessions g16–g17: "sending the application today, 12 pages, I'll pass you the
protocol number" → "sent at 15:40, protocol 2026/0871-B"). Through the full harness the old resolver kept both in 2
runs (the pair was not its candidate or was called distinct); called directly on the stored pair, `resolve.v1` says
"duplicate" 10/10, so the old code hides the protocol telling.

Fix, `resolve.v2`: "duplicate" names the telling to keep (`keep`: NEW / EXISTING, the one that says everything the
other says; length only as a fallback); the same event where each telling has something of its own is "distinct" and
both stay visible. Direct calls on dev pairs, v1 → v2: the d08 pair duplicate 10/10 → distinct 10/10; a plain
duplicate (one covers the other) duplicate → duplicate, keep the fuller one, whether NEW or EXISTING; a correction
corrects → corrects; plan and outcome, the same run on two days: distinct → distinct; a duplicate across languages
duplicate → duplicate.

| Set | Runs | Mean | Before |
|---|---|---|---|
| dev gaps (8 questions) | 100 | 100 % | — |
| blind9 (personal) | 90.5 / 91.2 / 89.0 | **90.2 %** | 90.1 % (step 2) |
| blind10 (entity, control) | 92.9 | 92.9 % | 91.9 % (step 3) |

- **q20:** the confirmation episode is visible and in the context in 3/3 runs (was 2/10); every answer has the
  deadlines, the date and PC35-0412. Verdicts: correct, wrong ("Beatrice ha inviato"), judge error (the same third
  person). The rest of the miss is the voice of the answer, and a judge that does not know the holder's name.
- Other changes (q01 c→w once: the moved vet booking, stored the same way as in the old runs; q08, q23) are answer
  variance, not resolver links.
- blind9 r1 stopped on a connection error after 2 questions (`fp815_blind9_r1_connerr.log`) and was run again.

### WORK_PLAN 8.11 gaps, step 3 — the entity agent's own actions (2026-10-11, DeepSeek direct, `fp813_runs.sh`)

blind10 q04 ("what did you do for the Brandts before they arrived?", 0/3 in every earlier batch) had two causes:
- **Attribution.** A booking dictated by a staff member ("Ora una prenotazione: …" → "Prenotato") was stored as
  "Benedetta ha registrato la prenotazione" (every run since 8.11).
- **Dropped episodes.** In 1 run of 3 the German session of the guests lost its 3 episodes and 3 facts
  (`person_not_named`): the staff's role facts put Benedetta & co. in the window's PEOPLE I KNOW (C1…) although the
  conversation never names them, and the model gave C1 as the subject of the guests' episodes, which the writer rightly
  rejected.

Dev case first, `dataset_dev_gaps_entity` e06 (sessions r08–r11: the manager introduces the staff, Gianni hands over
the winter hours as own content and then a booking, the guests write in German). With entity.v4, over 4 runs:
attribution "Gianni mi ha dato la prenotazione" 2/4; guests' episodes dropped 1/4 (logged once: subject C1 = Paola,
people ["Anna Hofer"]).

Fixes:
- `entity.v5`: what I did with what a person handed me or asked of me is my action, in the first person, with who asked
  ("ho registrato la prenotazione …, su richiesta di Nadia"); a C-number only for the person the item is about.
- Writer: an episode whose subject is a listed contact the window never names, while its people name exactly one person
  in the window, gets that person as subject. Facts have no people, so they are still dropped.

| Set | r1 / r2 / r3 | **Mean** | Step 2 | Bar |
|---|---|---|---|---|
| `dataset_dev_gaps_entity` (dev, 6 q) | 100 / 100 / 100 | **100 %** | — | — |
| `dataset_dev_gaps` (dev, 7 q, control) | 100 | **100 %** | 100 % | — |
| `dataset_blind10` (entity, 35 q) | 88.6 / 95.7 / 91.4 | **91.9 %** | 93.3 % | 91.4 % (blind8) |
| `dataset_blind9` (personal, 42 q, control) | 94.0 | **94.0 %** (1 run) | 90.1 % | 90.9 % (blind7) |

One prompt version per kind in every run (`extract.v14+entity.v5`, `extract.v14`).

On the dev set the booking is "ho registrato … su richiesta di Gianni" in 3/3 runs and the guests' episodes are kept in
3/3. On blind10:
- **Fixed:** q04 0/3 → 2 correct + 1 partial; the booking is "su richiesta di Benedetta ho registrato la prenotazione"
  in 3/3, and the 27 March episodes are kept.
- **Worse:**
  - q06 ccc → www: "Su richiesta di Benedetta ho bloccato il B6 …: Nico deve sistemarla" now reads as a message to pass
    to Nico; the answer lists it, plus once a veranda outcome not found. A closer look: the stored episodes are right
    and equivalent in old and new runs (both Marta messages, the veranda check, the B6 block with who asked), and an
    old run (fp812r r1) also listed B6 as a message and was judged correct. The miss is in the answer (B6 counted
    twice, a date, once the outcome and Marta's name not used) and the judge's strictness, not in extraction; no
    change made (an answer-prompt rule for it would be tuned on the blind set).
  - q33 ccc → wpw: the bike question is stored as "un ospite" in old and new runs alike; the answer named Katrin once,
    recall missed it once — variance.
- The rest is run-to-run variance.

Net −1.4 on the mean, within noise. Facts are still dropped on a wrong C-number (1–2 a run on the dev set).

### WORK_PLAN 8.11 gaps, step 2 — out-of-period items ranked by relevance (2026-10-10, DeepSeek direct, `fp812r_runs.sh`)

The next fix of the section below (blind9 q40): the out-of-period items of a period `search` are ranked by relevance
alone, no longer by the general score (relevance + importance + recency), where any big recent event pushed out the one
the question names. Recall only; extraction unchanged (`extract.v14`).

Dev case first: `dataset_dev_gaps` d07 (a cancelled booking at the Osteria dei Poeti asked on the wrong date, among
eight bigger dinners, sessions g08–g15). With 5 distractor dinners the old ranking still let the booking in (5th of
5, correct); with 8 it left it out (partial) — the mechanism of q40 reproduced. New ranking: d07 correct, the whole dev
set 7/7. Control on the main set `dataset` (1 run, `fp812_dataset`, extract.v14 with the step-1 recall, before this
change): **100 %** (fp84b 100, fp86 97.9, fp89 95.8): the out-of-period items do not hurt day questions.

| Set | r1 / r2 / r3 | **Mean** | Step 1 | 8.11 (v0.2.0) | Bar |
|---|---|---|---|---|---|
| `dataset_dev_gaps` (dev, 7 q) | 100 | **100 %** | — | — | — |
| `dataset_blind9` (personal, 42 q) | 89.3 / 91.7 / 89.3 | **90.1 %** | 88.8 % | 81.6 % | 90.9 % (blind7) |
| `dataset_blind10` (entity, 35 q) | 94.3 / 91.4 / 94.3 | **93.3 %** | 91.4 % | 89.8 % | 91.4 % (blind8) |

One prompt version per kind in every run. blind9 q40 fixed (0/3 → 3/3). The other changes against step 1 are not on
period searches (no `PERIODO CERCATO` in their context), so they are run-to-run variance of extraction and answer:
blind9 q05 (the second group of Michele's chats missing, pww → www), q35 (1 wrong of 3: "no actual use of the
contract"); blind10 q09 (the Brandts' check-out payment not found in 1 run), q15 (the total paid not summed, 2
partial), q24 (the aperitivo cancelled for rain not found, 2 partial); better: blind10 q12, q13, q25, q27, q33. Still
failing as before: blind9 q20 (0/3), blind10 q04 (0/3, who acts when staff ask the entity agent).

### WORK_PLAN 8.11 gaps — fixes measured (2026-10-10, DeepSeek direct, `fp812_dev.sh`, `fp812_runs.sh`)

Fixes of the gaps found on blind9 / blind10 (section below), checked first on two new dev sets written by the engine
developer (`dataset_dev_gaps`, personal, 6 q; `dataset_dev_gaps_entity`, entity, 5 q; NOT blind), then on the blind sets:
- `extract.v14` (both modes): my own slips in the first person ("ho sbagliato…: avevo detto X, invece è Y", never "I
  corrected the assistant"); the options compared stay next to the choice; a step of an open plan done before its date
  is an `amend` of the plan.
- Recall: a period `search` brings up to 3 relevant episodes from outside the period (`outsidePeriod`, marked); a chat
  excerpt behind an invalidated episode carries the correction (`fromChats[].correctedBy`).

One instance on :8092, queue `fp812`; every run one prompt version per kind (`extract.v14`, `extract.v14+entity.v4`).

| Set | r1 / r2 / r3 | **Mean** | 8.11 (v0.2.0) | Bar |
|---|---|---|---|---|
| `dataset_dev_gaps` (dev, 6 q) | 100 | **100 %** | — | — |
| `dataset_dev_gaps_entity` (dev, 5 q) | 100 | **100 %** | — | — |
| `dataset_blind9` (personal, 42 q) | 86.9 / 90.5 / 89.0 | **88.8 %** | 81.6 % | 90.9 % (blind7) |
| `dataset_blind10` (entity, 35 q) | 88.6 / 94.3 / 91.4 | **91.4 %** | 89.8 % | 91.4 % (blind8) |

Fixed (3/3 correct now): blind9 q03 (the table booked before Thursday, was 0/3), q13 (Priya's send-by date, was 0/3),
q17, q06; blind10 q26 (the corrected chat excerpt, was 3 partial), q08. Better: blind9 q02 (the three quotes, 2/3),
q08; blind10 q27 (the agent's slip, 2/3). Still failing:
- blind9 q40 (0/3, premise trap "the dinner of 19 October"): no episode in the period; the 5 out-of-period items are
  ranked by the general score, where importance and recency outweigh relevance, so the Osteria del Grillo episodes
  (stored and relevant) lose to more important dinners. Ranking the out-of-period items by relevance alone is the next
  fix — found on a blind set, so it needs a dev case before it is measured again.
- blind9 q23 (the agent's slip on the course dates, 1/3 correct): the stored text is now the agent's own slip, but
  the answer still hedges on who was wrong.
- blind9 q20 (0/3): the answer says "Beatrice ha inviato" in the third person and misses the confirmation number.
- blind10 q04 (0/3, was 1/3): the booking the agent made at Benedetta's request is stored as "Benedetta ha registrato
  la prenotazione" in 5 of 6 runs, old and new — who acts when a staff member asks the agent to do it (entity mode).
- blind10 q13 (Katrin reporting the allergy in a call, speaker change): variance, as before.

### WORK_PLAN 8.11 — fresh blind sets for the agent memory (2026-10-10, DeepSeek direct, 3 runs each, `fp811_runs.sh`)

Two sets written blind by separate agents from `DATASET_FORMAT.md` only, re-read by a second agent (`GOLD_AUDIT.md` in
each), committed before any run: `dataset_blind9` (personal: Beatrice, a physiotherapist in Trento, 2034; group chats
with declared participants, questions asked by identified contacts, learned sources; 42 questions) and
`dataset_blind10` (entity: a campsite's front-desk agent, Umbria 2034; unidentified and self-introduced speakers, own
content, learned sources; 35 questions). Engine of v0.2.0 (`extract.v13`, `+entity.v4` on the entity set), one instance
on :8091, queue `fp811`; every run carries one prompt version per kind (checked).

| Set | r1 / r2 / r3 | **Mean** | Bar (previous blind set) |
|---|---|---|---|
| `dataset_blind9` (personal, 42 q) | 82.9 / 83.3 / 78.6 | **81.6 %** | 90.9 % (blind7) |
| `dataset_blind10` (entity, 35 q) | 85.3 / 92.9 / 91.2 | **89.8 %** | 91.4 % (blind8) |

Judge errors (empty completion, excluded from the score): blind9 r1 q35, blind10 r1 / r3 q06 (both answers named the
two messages from Marta Venturi). 1.0 in every run on both sets: knowledge, knowledge-provenance, negative; blind9 also
temporal and state-now; blind10 own-content and same-name.

The entity set is within noise of its bar; the personal set is ~9 pt below. Failures, read against the stored memory
(not the gold: the audits marked none of these questions weak, except q05 as long):
- **The period filter hides earlier actions about the asked day** (blind9 q03, 3/3 wrong; q40). "Ho un tavolo
  prenotato per giovedì?" resolves to the period 12 Oct; the booking episode ("ho prenotato… ha confermato via mail",
  5 Oct) is outside it, only the plan "ho detto che prenoto io" is inside, so the answer says the booking is still to
  be made. The plan was not linked to the booking that fulfilled it (no `confirmed_by`).
- **The agent's own mistakes** (blind9 q23, 2/3 wrong; blind10 q27, 2/3 wrong). Personal: stored as "ho corretto
  l'assistente" — in a first-person memory where the agent is "I", the answer reads it as Beatrice correcting someone
  else. Entity: the 8 April slip (Chiara's correction) is not stored at all.
- **Detail of the agent's own turns collapses into the decision** (blind9 q02, 3/3 partial): the three quotes the
  agent compared are gone, only "ho scelto Linea Studio" is kept.
- **Raw chat passages outlive a correction** (blind10 q26, 3/3 partial): the B4 episode is invalidated and Ottavio's
  correction (B3) is stored, but the recalled raw message of 16 March says B4 and the answer reports a discrepancy.
- **Group chats** (blind9 q05, q07): Michele's message in the «Trasloco studio» group is attributed to the family chat
  or missed; group names are not in the context; "posso usarlo" is kept unresolved (the Sonotherm 300).
- **Asker framing** (blind9 q13, 3/3 wrong): Priya asks; the episode says "io scrivo le descrizioni dei casi" and the
  answer mixes the two "I"; her own send-by date (25 Oct) is not recalled.
- Variance on aggregation and claims (blind10 q08: one of two deposits in 2/3 runs; blind9 q08 r2 took Ennio's claim as
  fact).

Not tuned on these sets: they stay blind for later comparisons. The fixes are proposals for the maintainer (period
filter vs actions done earlier; plan → fulfilling action link; the agent's own slips in the first person; raw passages
behind invalidated episodes), each to be measured on a dev set first.

### WORK_PLAN 8.9 — learned sources (2026-10-10, DeepSeek direct, 1 run each)

New dev set `dataset_dev_knowledge` (NOT blind): Chiara learns five texts (a boiler manual from her brother, her
grandmother's recipe from her mother, her lease, her photography notes, a resignation draft later forgotten) around six
conversations; 15 questions. The harness learns `{"type": "source"}` entries through `POST api/v1/ingest/sources`,
forgets `forget_source` ones, and adds `search_knowledge` to the recall when a dataset has sources. One instance on
:8089, queue `fp89`, migrations applied.

| Set | 8.9 | Previous |
|---|---|---|
| `dataset_dev_knowledge` (new, 15 q) | **96.7 %** (k04 partial: "what did I learn on 7 October" named the notes, not their content) | — |
| `dataset` (control, no sources) | 95.8 % (q14 partial as in v12b; q18 partial: "con Sara" omitted — the stored episode has it) | 100 % / 97.9 % |

All five sources ready (4 / 1 / 1 / 1 passages), each with its learning episode in Italian ("Il 3 ottobre 2026 ho
imparato «Manuale della caldaia ecoTEC», da Paolo."); the forgotten draft left its episode with the marker and was not
answered from ("non è più disponibile"). Provenance right (Paolo / the mother, with the date). The two sources that came
with a conversation got code-written episodes: in the dataset they arrive after their conversation was already extracted
(the harness ends each conversation), so the extraction-link path is covered only by the integration test — a dev case
for it is a follow-up. The memory-context passage floor (0.6) is not measured yet (agent_eval with sources: later).

### WORK_PLAN 8.6 — the agent's diary and facts review v2 (2026-10-09, DeepSeek direct, dev sets, 1 run each)

`digest.day.v2` / `digest.month.v2` (first person, memory's language and gender; sources: own items, a person's news
about themself, a tool's teaching — never others' inferred claims; items labelled by subject) and `facts_review.v2`
(every subject, ME / PEOPLE I KNOW). One instance on :8088, queue `fp88`, started with `RECALL_DIGESTS=true
FACTS_REVIEW=true` (the harness consolidates as of every question); compared with the knobs-off runs of the same
extraction prompt (8.4b).

| Set | Knobs on (8.6) | Knobs off |
|---|---|---|
| `dataset` (24 q) | 97.9 % (q14 partial: a trip idea read as a plan — as in v12b) | 100 % (v13) |
| `dataset_dev_agent_personal` (19 q) | 94.7 % (a16: no lunch plan extracted — as with the knobs off) | 94.7 % (v13) |

25 day + 10 month digests written, 0 leaks, 0 failures; they read in the first person with the contacts' news ("il 9
Giulia ha vinto la gara regionale di nuoto…", "il 10 il collega Marco Bellini mi ha detto che…"), plan outcomes kept
("Non so ancora se l'intervento sia avvenuto"); a few add a mild comment ("È stato un impegno nuovo"). The facts review
made 9 calls (~2 k input tokens each) and proposed no change: the extraction already had the facts. No gain → both
knobs stay off; the code is kept (zero cost when off; the diary is still written at night for the Diary / Atlas).

### WORK_PLAN 8.5 — entity agent: extract.v13+entity.v4 (2026-10-09, DeepSeek direct)

Entity memories move to the D50 model: "I" is the shared agent (its replies and actions, own content, its place), the
people talking to it are contacts by name or "someone" until the conversation identifies them; the prompt is built from
the personal v13 sections (personal prompts byte-identical) plus entity intro / voice / identification / episode / fact /
safety sections; one ContactBook for both modes; recall returns the speaker (`someone` for an unidentified entity
speaker), clarifications only to an identified speaker, claims by the personal rule. One instance on :8087, queue `fp87`.
Harness: entity names read as names ("Casa Bellandi"), `own: true` messages, entity framing in the first person.

| Set | Run | 8.5 | Previous |
|---|---|---|---|
| `dataset_dev_entity_own` (new, NOT blind: a bike shop's shared assistant, 15 q — own price list and owner's note, the assistant's reminder and rental extension, unidentified speakers, a hand-over, two Marcos, an English customer) | 1 | **100 %** | — |
| `dataset_dev_entity` (11 q) | 1 | **100 %** | 95.5 % |
| `dataset_dev_poison` (personal control, prompt byte-identical) | 1 | 90 % | 100 % (v13) — p01 / p03 partial: the answers omit the claims' dates; the stored claims are the same dated ones |

Memory read on the dev dump: first person for the agent ("Gianni mi ha caricato il listino…", "gli ho messo un
promemoria alle 17:30", "le ho prolungato il noleggio"), "qualcuno in ciclofficina…" for unidentified speakers (repair,
Saturday shifts), the two Marcos kept apart (Marco Ferri the supplier, Marco of the gravel group); one inferred note
wrong ("Luca fa parte del gruppo gravel"). **Blind confirmation** (`b8_v4_runs.sh`, 3 runs): 90.3 / 93.5 / 90.3 =
**91.4 %** (bar 82.1 %), paired vs the entity.v3 runs +0.091 [−0.011, +0.204], p(better) 0.95; by category
unidentified +0.89, carry-over +0.22, hand-over +0.08, attribution −0.22, correction −0.11; changed questions e04 +1.0,
e06 +1.0, e05 +0.67, e01 −0.67 (two runs answered that no appointment was found: recall, not extraction).

### WORK_PLAN 8.4b — provenance after the first person: extract.v13 (2026-10-09, DeepSeek direct)

Cause (dev set `dataset_dev_poison`, not blind, read on the v12 dumps): others' claims about me lost the date they were
made and sometimes the self ("Ho saputo da Paolo che Elena ha detto…", subject `someone`, the self named in the third
person); one claim (Marco's 80 euro) wrote no episode at all. Fix, personal memories only (entity prompt byte-identical):
`extract.v13` — a claim about me is ONE episode, subject "me", origin "told", on the date it was said, first person,
with that absolute date, the claimant and where ("Il 7 marzo 2026 Paolo ha scritto nella chat di famiglia che io lascio
l'ospedale…"); "X says I told them…" stays X's claim. Recall note and harness header no longer say claims are "about
others" (they include claims about me). One instance on :8086, queue `fp86`, migrations applied.

| Set | Run | v13 | Previous |
|---|---|---|---|
| `dataset_dev_poison` (10 q) | 1 | **100 %** | 90 % / 95 % (v12b / v12c) |
| `dataset` (24 q) | 1 | **100 %** | 97.9 % (v12b) |
| `dataset_dev_agent_personal` (19 q) | 1 | 94.7 % | 100 % / 94.7 % (v12a / v12c) — a16 wrong: the family-chat window wrote no lunch plan (extraction variance; v12c missed a04 instead) |

Claims now stored as wanted: "Il 12 marzo 2026 Marco ha scritto in chat che io gli devo 80 euro per il regalo di Chiara e
che sono allergica alle noci" (subject self, inferred). **Blind confirmation** (`b7_v13_runs.sh`, 3 runs): 90.2 / 89.1 /
93.5 = **90.9 %** (bar 91.7 %): paired vs v12 −0.007 [−0.054, +0.054], vs v11 −0.007 [−0.062, +0.047], both within
noise; **provenance 0.6 / 0.6 / 0.6** (v12 0.3 / 0.4 / 0.5: +0.2; vs v11 −0.03, recovered); changed questions vs v12:
g26 (provenance) +1.0, g18 (state-change, "where do I live now") −0.5 — the answer was right in substance in every run,
judged wrong once for adding the planned move date.

### WORK_PLAN 4.10 — news received as a memory: extract.v11 (2026-10-08, DeepSeek direct)

Rule added to the extraction prompt: news the owner received (assistant, tool result, someone else) is a low-importance
event — "<owner> learned that …" — only when it touches their life (an open plan, a person they know, something they own)
or when they react to it; trivia and general answers stay in the chat log. Dev set `dataset_dev_news` (not blind, 7
sessions, 4 questions): linked news (rain on a trip day + "I'll take the umbrella", a train strike on the trip day, a
colleague's new job) vs trivia (a capital, a recipe, university courses, a race result). Two instances per comparison
(rule 9); local migrations applied first (a first attempt ran without the new `extraction_runs.summary` column: every
extraction failed — discarded).

| Prompt | Dev set (1 run) | blind7 (3 runs) | Paired vs v8 |
|---|---|---|---|
| `extract.v8` | 62.5 % (rain not stored) | 91.3 % (88.0 / 92.4 / 93.5, 4.8) | — |
| `extract.v10` (rule) | 75 % | 88.4 % (83.7 / 87.0 / 94.6) | −2.9 [−8.0, +1.4]; provenance −0.17, temporal −0.11 |
| **`extract.v11`** (+ others' claims about the owner are not news; both dates kept) | **75 %** | **91.7 %** (91.3 / 92.4 / 91.3) | **+0.4** (within noise); provenance ±0 |

Kept: `extract.v11`. Both v10 and v11 store exactly the linked news (with the learning date and the news' own date) and
none of the trivia; the remaining dev miss ("is there a problem with my Saturday trip?") is recall, not extraction (the
strike episode exists but was not tied to the trip). v10's loss matched its mechanism: a rumour about the owner in a group
is "news touching their life" — v11 excludes it. Notes: DeepSeek returned a few empty judge completions and one
consolidation exceeded the harness's 60 s timeout (now 600 s) during the v10 runs; the affected attempt was resumed.

### WORK_PLAN 5.7 — memory context: sentences and named periods (2026-10-08, blind7, agent mode, DeepSeek direct)

Probes on a live memory (bge-m3, `probe_ctx` in the scratchpad): questions in other languages land 0.45–0.59 on the
right Italian memories (cross-language is fine), unrelated ones ≤ 0.34; the misses came from the floors (episodes
0.55: the right episode sat at 0.50–0.54) and from period questions ("cosa ho fatto sabato scorso?" → 0.33). Changes:
each sentence of the message is matched on its own (an item matches by its best one, so "…? Rispondi in una frase."
no longer dilutes the question), and a period the message names (period expressions and weekdays, all languages via
`src/lang`) adds that period's episodes with a lower bar (0.35).

Exploration, 1 run (`ctx57_runs.sh`): tools only 89.1 %; new code with the current floors (A) 92.4 %, with lower
floors 0.45 / 0.48 / 0.42 (B) 91.3 % — dev context set A 100 %, B 96.7 %, no harm on either (gen 1.0). Lower floors
rejected.

Decision, 3 runs each (`ctx57_decide.sh`, `agent_eval.py --variants tools+context`, two instances, rule 9):

| Memory context | Runs | Mean | Context served |
|---|---|---|---|
| old (main) | 89.1 / 91.3 / 95.7 | 92.0 % | 37 / 37 / 40 of 46 |
| new (sentences + named periods) | 95.7 / 91.3 / 90.2 | 92.4 % | 38 / 39 / 40 of 46 |

Parity on blind7 (within noise; the agent calls the tools in ≈ 96 % of the questions, so the block rarely decides the
answer there); the new code is kept because it fixes the misses seen in the probes and in the connectors (instruction
suffixes, period questions, all languages) at no cost. Floors stay as they were; they are now knobs
(`CONTEXT_MIN_*_SIMILARITY`).

### WORK_PLAN 4.8 — fresh blind sets, released engine (2026-10-08, DeepSeek direct, 3 runs each)

Two new sets written blind by separate agents (no access to the service code, RESULTS or other datasets' gold), each
re-read by a second agent before any run (blind7: 2 questions reworded; blind8: 3 session details fixed, no gold change).
The engine developer has read only these aggregates and per-category scores. Service `deepseek-flash`, base (no noise),
default quality profile, consolidation on; one prompt version per run (`b7_runs.sh`, `b8_runs.sh`).

| Set | Content | Prompt | Runs | Mean | SD |
|---|---|---|---|---|---|
| `dataset_blind7` | Giacomo, pharmacist, Bergamo 2033: 31 sessions (8 group chats, ~20 % EN), 46 questions | `extract.v8` | 88.0 / 92.4 / 93.5 | **91.3 %** | 2.9 |
| `dataset_blind8` | entity memory: a household's kitchen assistant, Ravenna 2033: 20 sessions, 31 questions | `extract.v8+entity.v3` | 86.7 / 79.0 / 80.6 | **82.1 %** | 4.1 |

Per category (three runs):
- blind7: plan, negative, recall-echo 1.0 in every run; premise-trap 1.0 / 0.9 / 0.9; state-change 1.0 / 0.83 / 1.0;
  temporal 0.83 / 1.0 / 1.0; aggregation 0.8 / 1.0 / 1.0; assistant-addressed 0.88 / 0.75 / 0.75; **provenance
  0.4 / 0.8 / 0.7** (the weakest, as on blind6).
- blind8: correction, negative, place, premise-trap, state-now 1.0 in every run; plan 1.0 / 0.88 / 1.0; hand-over
  1.0 / 0.75 / 0.75; attribution 0.5 / 0.67 / 0.67; carry-over 1.0 / 0.33 / 0.67; **unidentified 0.0 / 0.33 / 0.0**.

Reading: on a person's memory the released engine holds about 91 % on unseen data (blind5's last 3 runs: 90.7 %). The
entity memory is weaker than its dev set suggested (95.5 %, 1 run, written by the engine developer): what someone says
without identifying themselves still gets attributed to a named person, and similar facts of different people get
swapped. Entity memory stays **experimental** until fixed and measured on another blind entity set.

### WORK_PLAN 4.11 — plan guard and "l'owner" (2026-10-08, blind5, DeepSeek direct)

Two defects found through the Diary: a plan **confirmed before its date**, and memories saying **"l'owner"** (≈ 5.7 % of
episodes, 5.3 % of notes in the local database).

| Version | Runs | Mean | "owner" in episodes / notes | Plans confirmed before their date |
|---|---|---|---|---|
| v8 (reference, earlier days) | 91.9 / 91.9 / 93.1 | **92.3 %** | ≈ 5–6 % | not checked |
| v9 = owner name in the prompt (`extract.v9`, `facts.v2`) + plan guard | 90.2 / 91.4 / 88.5 | **90.0 %** | 0 / 0 | 0 |
| **v8 prompt + name substituted in code + plan guard** | 90.8 | — | 0 / 0 | 0 |

- Naming the person in the prompt cost ≈ 2 points (all three v9 runs below v8's worst; spread, no question worse every
  time; one run also lost a window to two invalid outputs). Kept out: back to `extract.v8`.
- The code-side substitution fixes the wording without touching extraction; 90.8 % is −1.5 pt from v8's mean on one
  run, within the noise of this set (≈ 1.3 questions), with a clean run. Kept, with the plan guard (code only; it did
  not fire on this set).
- An OpenRouter run of v9 (88.5 %) is discarded: 12 % invalid outputs on extraction (2 failed windows).

### Pre-turn memory context (WORK_PLAN 5.7, 2026-10-07, dev set `dataset_dev_context` — NOT blind, written by the engine developer)

`agent_eval.py`: the answer model is an **agent** (DeepSeek `deepseek-flash`, function calling) with Recordare's read
tools over MCP and a neutral system prompt; it decides by itself whether to call them. Variant `tools+context` adds the
`<memory-context>` block (`POST api/v1/context`, MEMORY_CONTEXT=1) to the system prompt. 15 questions: 7 where memory
helps but is not asked for (ctx), 2 explicit recalls (rec), 6 with nothing to do with memory (gen, no-harm). 1 run.

| Variant | All | ctx (implicit) | rec | gen (no-harm) | Tool use | Block served |
|---|---|---|---|---|---|---|
| tools | 93.3 % | 0.857 | 1.00 | 1.00 | 9 / 15 | — |
| tools+context | **100 %** | **1.00** | 1.00 | 1.00 | 9 / 15 | 7 / 15 |

- Gains on 2 questions (ctx02 a vegetarian, shellfish-free dish; ctx05 red wine for Luca and something alcohol-free for
  Sara): partial → correct. No harm: no block was served for any gen question (the thresholds kept them empty), and the
  answers stayed correct.
- The expected main benefit did **not** show with this model: DeepSeek flash called the memory tools on every personal
  question even without the block (tool use 9 / 15 in both variants, all the personal ones), so the block added
  completeness, not recall that would otherwise be missing; it did not save tool calls either.
- Misses of the block: ctx01 (gift for the sister) and ctx03 (headache → no ibuprofen) got no block — the memories sit
  below the 0.5 / 0.55 similarity floors for those phrasings.
- Within noise on 15 questions; stays **off by default**. Next: the same run with a less tool-eager model (where the
  benefit is expected), and a blind set before any default change.

**Run 2 — the voice agent's real prompt** (Arkimede's "Voce" agent on Kinox: same model, its own 1.3 k-character
system prompt via `AGENT_SYSTEM_FILE`; agent, judge and the service's extraction through OpenRouter,
`~deepseek/deepseek-flash-latest`). 1 run:

| Variant | All | ctx (implicit) | rec | gen (no-harm) | Tool use | Block served |
|---|---|---|---|---|---|---|
| tools | 90.0 % | 0.786 | 1.00 | 1.00 | 9 / 15 | — |
| tools+context | **93.3 %** | **0.857** | 1.00 | 1.00 | **5 / 15** | 8 / 15 |

- With the voice prompt the block **replaces tool calls**: 4 questions answered from the block alone (ctx01, ctx02,
  ctx07, rec02) — for a voice assistant each avoided round is an LLM call plus an MCP call less before the answer.
- Accuracy +3.3 pt (ctx06 partial → correct); ctx02 and ctx05 partial in both (short voice answers leave out half of
  the reference). No harm again: no block on gen questions.
- Within noise; a measured reason to offer it where latency matters (voice). Still off by default.

### Entity memory (D48, 2026-10-07, dev set `dataset_dev_entity` — NOT blind, written by the engine developer)

One shared home device (owner `casa`, kind `entity`), 5 sessions, 11 questions: purchases and facts of named family
members, a fact of the place, a speaker switch inside a chat ("ora ti passo Marta"), a correction, and an
**unidentified speaker** saying "my boss is promoting me". Service, `deepseek-flash`, 1 run each (exploring):

| Run | Prompt | Accuracy | What went wrong |
|---|---|---|---|
| entity1 | `entity.v1` | 90.9 % | the unidentified promotion became an episode **and** a fact of Andrea (identity carried over from the morning chat) |
| entity2 | `entity.v2` (+ "every conversation starts with nobody identified", named-in-window guard) | 81.8 % | no Andrea episode any more; the promotion became a fact of the **entity** (subject null); the harness showed facts without their person, so Nunzia's car read as Andrea's |
| entity3 | `entity.v3` (+ "subject null only for the entity or place") + harness renders `[about]` | **95.5 %** | memory clean (no promotion fact; "qualcuno in casa"); n06 partial on the answer's wording |

Kept `entity.v3`. Person memories are untouched (the rules are appended only for entity owners). Watch: a blind entity
set before relying on it for a whole family.

### Recall echoes (2026-10-07, dev set `dataset_dev_echo` — NOT blind, written by the engine developer; `echo_runs.sh`)

In a live Arkimede test the assistant's answers from memory are ingested like any reply. Risk: a recall becomes a new
memory, a wrong one confirmed by a plain "ok". Dev set: 9 sessions / 9 questions — a correct recall confirmed, a wrong
recall corrected, a wrong recall left uncorrected ("your dentist is Dr Rossi" → "Ok", the real one is Bianchi), a recall
the owner completes with a new detail, an accepted recommendation, and a recall plus a web search in the same turn (bus
times). Measured with one service per version (separate ports and queue prefixes), 3 runs each:

| Version | Runs | Accuracy | Memory |
|---|---|---|---|
| no guard (extract.v6) | 3 | 79 % (75 / 87.5 / 75) | "dentist = Dr Rossi" in 3/3 runs |
| prompt rule + "answering from memory" label (extract.v7) | 1, contaminated (see below) | — | dropped: the label made the recall look authoritative |
| guard v1 (names said only in a reply answering from memory) | 3 | 96 % | dentist right; the bus plan lost in 1/3 (news from the web dropped) |
| guard v2 (+ non-memory tool output counts as a source) | 3 | 96 % | bus kept 3/3; "dentist unknown" in 1/3 (a fact change from a question + echo) |
| **guard v3** (+ a fact change needs an asserting sentence about it) | 3 | **100 %** (3/3) | dentist Bianchi 3/3, bus 3/3, camosci 3/3 |

The guard is code, the prompt is unchanged; it acts only when a reply answers from memory (a Recordare read tool in the
turn, or a recall served in that conversation): the blind sets have neither (no tool messages; evaluation recalls use a
personal token without a conversation), so their behaviour is unchanged by construction.

**Contamination found and fixed.** A stopped service instance kept consuming the extraction queue with old code (an
open telemetry SSE stream kept its HTTP server closing forever, so its queue workers never stopped). Fixed in the
service (streams end before shutdown, hard exit after 30 s) and in the method (evaluation budget rule 9). Affected:
the v7 echo run above (discarded) and **run 1 of the plan-evidence measurement** below (6 of 60 extractions by an older
instance). Corrected plan-evidence numbers: clean runs 2 and 3 = 92.9 / 90.1 % (mean 91.5 %, conclusion unchanged);
the extraction scores reported from run 1 are replaced by run 2's: **plan outcome 0.77** (not 1.00), episode recall
0.97, dates 0.97, unsupported 7.6 %, facts current 0.77, notes 0.79 — so the plan-outcome gain is not shown on this
set; the fix stays for the verified errors it removes.

### Plan patches need evidence about the plan (2026-10-08, blind5 base, 3 runs, `pev_runs.sh`)

Diagnosis on the non-blind sets (blind3 / 4 / 6, 228 distinct plan patches): plans closed by unrelated messages (a
concert "cancelled" by a first-day-at-work message, a dental appointment "confirmed" by a physiotherapy session), moved
plans keeping the old date in their text (the extractor then moved them again), and a failed car inspection recorded
as "cancelled". Fix: a patch needs evidence sharing a name / place / keyword with the plan or embedding similarity
≥ 0.37 (bge-m3; wrong patches 0.27–0.36, right ones without a shared word 0.38+ — calibrated on those sets), a repeated
reschedule is ignored, a moved plan always carries the new date in its text; `extract.v6` (cancel only when the plan
will not happen, a bad outcome is a confirm). Result: **91.3 %** (90.8 / 92.9 / 90.1) vs m5off **89.9 %** — paired
+1.5 pt [−2.1, +5.4], within noise, no regression; rescheduled plans +0.22, unresolved −0.22, 4 questions changed
(2 up, 2 down). ~~Extraction (run 1): plan outcome 1.00~~ — run 1 was contaminated (see "Recall echoes" above); run 2:
plan outcome 0.77, episode recall 0.97, dates 0.97, unsupported 7.6 %. Kept.

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
