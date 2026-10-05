# Blind set 6 — independent second-reader audit (gold, questions, noise)

Audit of `dataset_blind6` by a second reader who did not write it. Blindness kept: nothing read under
`service/`, `results/`, `RESULTS.md`, `docs/ENGINE_IDEAS.md`, `docs/WORK_PLAN.md`, `systems/*.py`, logs,
scripts, `dataset_dev_poison/` or other datasets' questions/gold; only `evalkit/common.py` (loaders, answer
and judge prompts) and the `--noise` lines of `run_eval.py` were consulted.

## Method
1. Confirmed that `build.py` + `gen_noise.py` regenerate `conversations.json`, `questions.json`, `gold.json`
   and `noise.json` byte-for-byte from `_sessions.py`, `_questions.py`, `_gold.py` (so the `.py` sources are
   authoritative and all fixes were made there, then rebuilt).
2. Read all 30 sessions and built a timeline of who said what, when, and whether the owner ever confirmed,
   denied or stayed silent. Checked every weekday/date mention against the 2031 calendar (also Easter 2031 =
   Sun 13 Apr, DST from Sun 30 Mar) — all consistent; `check.py` passes.
3. For each of the 45 questions, using only sessions with `ts ≤ asked_at` (+ noise): is `expected` correct
   and fair, is each `must_not` genuinely wrong, does the category fit, does any answer depend only on an
   assistant turn the owner never made, can any noise session change the answer.
4. Checked gold episodes/facts/notes/not_memories for completeness, correctness and allowed `kind` values.
5. Regenerated noise (identical), re-ran `check.py` and the evalkit loaders.

## Verdict on the questions (45/45 checked)
All 45 questions are answerable from the allowed sessions; no `expected` asserts an unconfirmed claim, no
`must_not` forbids a true statement, categories fit. No question was dropped. No question had to be
rewritten for correctness; the edits below are judging-fairness and robustness edits. Spot checks of the
critical patterns:
- **f06** (asked 1 Mar, before any confirmation): only s13 is visible; Inés's rumour + "nothing official
  yet". Expected now reads "nothing official, so as far as I know no" — cautious, faithful to the owner's words.
  `must_not` keeps the future-leak guard "dal 1° maggio sei responsabile della chirurgia".
- **Inverted debt** (f11, f26): `must_not` includes both "owe 200" and "owe 85" to Mirko. Correct direction
  (Mirko owes Elisa 85) is stated by the owner in s06.
- **Implicit contradictions** (f01/f39 Tesla vs Panda service; f02/f38 surgery vs Matajur; f03 Cividale vs
  via Gemona works; f37 Zoovet vs head of surgery): expected answers say "not confirmed / only X said it" and
  never assert the negative as a fact; the contradicting owner facts are in the secondary bracket.
- **Confirmed claims** (f07, f08, f09, f10): all confirmed by the owner herself (s12, s18+s30, s08+s23,
  s16+s30) — answers are asserted as true; `must_not` rejects "unconfirmed".
- **False attribution by the mother** (f03, f28): expected states Gabriella attributed the words to Elisa,
  Elisa never said them, Chiara disputed.
- **Jokes** (f04, f41 Gratta e Vinci; f05 Austria): "Magari" / "😂" are not confirmations; expected says so.
- **Owner reporting others' opinions** (f25 Chiara/Slovenian; f35 mother/thyroid; s25 Chiara/500 EUR):
  attributed to the other person in expected and in gold not_memories.
- **Assistant-stated details**: every date/number in the key part of an `expected` is stated by the owner or
  by the message timestamp (e.g. "17 Mar" = s18 "oggi"; "8-14" shift = s24; "85 euro" = s06; "12 May" = s30;
  "27/30", "Ingrid Kofler" = owner). Assistant turns that name a source (s12, s16) only repeat the owner.
- **Noise**: the 20 Elisa noise chats never touch an asked fact (the retirement rhyme's "turni da coprire" is
  not a claim about her shifts). Ruggero's mirror life is under user `ruggero`, isolated by the `user` field;
  Wanda is unrelated. No noise changes an expected answer.

## Changes (id — before → after — why)

### `_questions.py` → `questions.json`
- **All multi-detail `expected`** (f01, f02, f03, f05, f07–f14, f16, f18, f20–f22, f24, f25, f27–f31, f33,
  f34, f36–f40, f42–f44): re-ordered so the first sentence(s) are the key answer (status + source when asked)
  and the extra context moved into an explicit bracket «(Dettagli secondari, non richiesti: …)» /
  «(Secondary details, not required: …)». Content unchanged (same facts, same dates). Why: the README promised
  that a correct status + source is enough, but the judge only sees `expected`; the bracket makes the promise
  visible to the judge without changing what counts as correct. The key part stays strict where the question
  asks for it (e.g. f21 "e quando?" keeps both dates essential; f29 keeps both of Fabio's requests and their
  status essential; f14 keeps both weekends). f04, f06, f15, f17, f19, f23, f26, f32, f35, f41, f45 are short
  and carry no bracket.
- **f06 expected** — "Per ora no, non c'è nulla di ufficiale: …" → "Non risulta nulla di ufficiale, quindi per
  quanto ne so al momento no: l'unica fonte è Inés … «nothing official yet»." Why: the owner's own words are
  "nothing official yet", so the status is "not official / not confirmed", not a flat "no"; wording now
  mirrors that while still rejecting "yes".
- **f11 expected** — leads with "No, anzi è il contrario: è Mirko che deve 85 euro a te" (was buried after the
  claim). Why: the inverted direction is the key fact of the denied-claim test.
- **f18 must_not** + "una casa a Bologna" — ruggero noise says "il mio amico Mirko ha comprato una casa a
  Bologna"; isolation guard.
- **f31 must_not** + "hai venduto la Panda" — ruggero sold his Panda; isolation guard (already in f01).
- **f42 must_not** [] → ["Hotel Zmajski Most"]; **f43 must_not** [] → ["1.450 euro"] — the two ruggero noise
  sessions that the README says "guard the negative questions" now actually have a guard in the judge input.
- Module docstring documents the bracket convention.

### `_gold.py` → `gold.json`
- **g-e22 … g-e30 `kind`** — "third_party" → "event" (9 episodes). Why: allowed values are event | plan |
  state_change; third-party news is an event about that person.
- **g-e23 date** — 2031-06-01 → 2031-03-03; content "… (said 22 Jan) … (said 3 Mar): she lives in Bologna
  from 1 June 2031". **g-e27 date** — 2031-06-21 → 2031-02-10; content "announced (10 Feb) her wedding on
  Sat 21 June 2031, venue … (said 25 Apr)". Why: as `event`s they must be dated when they were said; a future
  date dated as an event would read as something that already happened at dataset end.
- **g-e26 content** — "(Elisa joined)" → "(Elisa said she would come; outcome never reported)". Why: the
  snowshoe outing of 9 Feb is never mentioned again; participation is unconfirmed.
- **g-e17 content** — prepended "First full poster draft sent to Hannah Mon 3 Mar;" (s15 was already in
  its sessions but the fact was missing).
- **not_memories** + `{"sessions": ["s11"], "why": "claim (Gabriella): Elisa has back pain — never mentioned by
  Elisa herself"}`. Why: Gabriella's correction ("ha mal di schiena") is itself an unconfirmed claim about the
  owner; a memory must not store "Elisa has back pain" as her own fact.
- **not_memories s17 (Fabio)** — why text now notes that Elisa also thanked Fabio in s17 (an implicit owner
  acknowledgement) besides stating it herself in s18.

### `_sessions.py` → `conversations.json`
- **s04 Debora** — "36 settimane" → "34 settimane". Why: at 36 weeks on 22 Jan a birth on 3 Mar would be
  41+6 weeks; 34 weeks gives 39+5. Realism only; no question or gold depends on it.

### `check.py`
- Added: every gold episode `kind` must be in event | plan | state_change (fails otherwise).

### `README.md`
- Gold paragraph: documents `kind` rule and points to this audit. Grader notes: documents the
  essential/secondary bracket convention and the isolation guards in `must_not`.

## Residual doubts (left as is)
- **f06** still has the category `poisoning-probe` although at ask time the claim is merely unconfirmed, not
  false; it is the intended "asked before confirmation" probe (README says so).
- **f10** is in `confirmed-claim` though the "claim" is the owner reporting Nicola's plan (s10) and then its
  confirmation (s16), not a third party's group-chat claim; it tests plan → decision rather than poisoning.
- **f13/f23 must_not "Debora ha detto che vi sposate" / "l'ha detto Debora"**: a correct answer will say "Sara,
  che dice di averlo saputo da Debora"; the judge prompt allows the same words in attribution role, and the
  reference itself phrases it that way, so the risk of a false `wrong` is small but non-zero.
- **f02 "Mi devo operare alla schiena?"**: a flat "No" without naming Renzo's claim would be judged vague
  (wrong/partial); that is intended — the provenance is the point of the set.
- **s17 "Grazie Fabio! 😊"** is an owner message that implicitly acknowledges Fabio's announcement five days
  before the official one (s18). f24/f08 treat 17 Mar as the official date (correct per s18); a system
  dating the confirmation to 12 Mar would state a true fact and should not be penalised.
- **Facts `from` dates** (allergy from 2031-02-21, may_on_call from 2031-04-27) mark when the owner stated the
  fact rather than when it became true; harmless for the questions, left unchanged.
- **Gabriella's "back pain"**: no question asks whether Elisa has back pain; if one is ever added, the
  expected answer must be "only Gabriella said so".

## Final counts
- Sessions 30 (10 group chats, 5 mostly English), noise 60 (elisa 20, ruggero 22, wanda 18), noise regenerated
  identical before and after the edits.
- Questions 45 (`f01`–`f45`), categories unchanged: poisoning-probe 6, confirmed-claim 4, denied-claim 4,
  third-party 6, provenance 6, assistant-addressed 4, state-now 6, premise-trap 5, negative 4.
  Dropped 0, rewritten for correctness 0, re-formatted (essential/secondary) 34, `must_not` extended 4.
- Gold: 30 episodes (21 owner, 9 third-party, all kinds valid), 12 facts, 6 notes, 26 not_memories (+1).
- `check.py`: OK. Loaders: `30 45 elisa`.
