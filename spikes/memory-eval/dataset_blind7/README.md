# Blind dataset 7 — general coverage (Giacomo, Bergamo, 2033)

Blind evaluation set with **general coverage**: temporal reasoning, plans and their fate, state changes and
corrections, aggregation across sessions, provenance in group chats, messages addressed to the assistant by others,
recall echoes, premise traps and negatives. Fictional content only. Written blind: without reading the service code,
`RESULTS.md`, `systems/`, logs or results, or the questions / gold of any other dataset (format taken only from
`dataset_blind6`'s `build.py`, `check.py`, `gen_noise.py`, `README.md`, the structure of its `_sessions.py`, and
`evalkit/common.py`; the gold field names from `extraction_eval.py`). No LLM or paid API was called to write it.

## Person
Giacomo Brambati, 38, pharmacist at Farmacia Santa Grata, Bergamo (owner Paola Cortinovis; colleagues Samuele Rota,
Irene Pesenti). Rented flat in via Borgo Palazzo with partner Martina Locatelli (freelance graphic designer); grey 2014
Fiat Punto at the start. Parents Rosanna and Ezio (Clusone), brother Federico (Milan, wife Anna). Amateur volleyball
with Smash Seriate (Tiziano, Pietro, Omar); Erasmus friends from Valencia 2015 (Claire, Pieter, Joanna).
Period: Mon 7 Feb – Mon 23 May 2033, Europe/Rome (DST starts Sun 27 Mar 2033: `+01:00` up to s15, `+02:00` from s16).
User id `giacomo`.

## Counts
- `conversations.json`: 31 sessions — 23 owner↔assistant, **8 group chats** (Famiglia Brambati ×2, Smash Seriate ×3,
  Farmacia Santa Grata ×2, Valencia Erasmus 2015 (EN) ×1); 5 sessions mostly in English (s07, s17, s21, s22, s28) plus
  English lines inside an Italian group chat (s13) — about 20 % English.
- `questions.json`: 46 questions (`g01`–`g46`), 5 of them in English; asked on Tue 1 Mar (g01), Wed 20 Apr (g10) and
  Wed 25 May 2033 (all others).

| category | n | what it tests |
|---|---|---|
| temporal | 6 | dates from relative words ("ieri", "ieri sera", "domenica scorsa"), ordering of two events, durations |
| plan | 7 | plan done (confirmed only after its date), cancelled, rescheduled then done, rescheduled and still open, outcome never reported, partial repayment, "what is still pending" at question time; one asked mid-period |
| state-change | 6 | current value after a change (car, job, home), value as of a past date (via `asked_at` or in the question), an owner's self-correction |
| aggregation | 5 | counting / listing across sessions (matches and results, donations, trips, stages of a purchase, friends met) |
| provenance | 5 | claims by others about the owner: denied, never confirmed, second-hand ("X says that Y said"); a claim by others later confirmed by the owner |
| assistant-addressed | 4 | others asking the assistant to record something: true and confirmed, denied by the owner, amended by the owner |
| recall-echo | 4 | the assistant recalls something wrong; the owner corrects it (3) or ignores it (1) |
| premise-trap | 5 | the question presupposes something false: a cancelled event, a postponed event, a hotel that never existed, a denied rumour, a future birth |
| negative | 4 | never recorded |

## Patterns covered (session ids)
- a) plans: done and confirmed after the date (s03→s18, s19→s24, s05→s06, s11→s15, s02→s14); cancelled (s08→s11);
  rescheduled and still open (s16→s23→s31); rescheduled then done (s28→s29→s31); never followed up (s24); partial
  repayment with an open remainder (s14→s23); open decision (s29).
- b) state changes: car (s01, s08, s10, s14, s15), job (s05, s06, s11, s15, s18, s19, s24, s25), home purchase without
  the move yet (s01, s12, s16, s23, s31); owner's self-correction of a date (s01→s10).
- c) relative dates: s05, s06, s08, s11, s12, s14, s15, s18, s22, s24, s25, s26, s29, s31.
- d) aggregation: volleyball results in owner chats and group chats (s03, s06, s13, s20, s26); donations (s05, s30);
  trips (s03, s07, s22, s29, s31); house purchase (s12, s16, s23).
- e) provenance: second-hand rumours (s02 / s27), unconfirmed team claim (s04, s20), denied work rumour (s09, s19),
  denied sale rumour (s27), unconfirmed second-hand claim (s27), claim by others confirmed by the owner (s09).
- f) messages to the assistant by others: Rosanna s02, Omar s04, Paola s09, Joanna s17 (EN, `@assistant`), Samuele s19.
- g) recall echoes in assistant turns: confirmed (s11, s30), corrected (s15, s23, s26), ignored wrong recall (s21).
- h) others' own news: s02, s04, s09, s13, s17, s27.
- i) owner-only controls: s01, s03, s05–s08, s10–s12, s14–s16, s18, s21–s26, s28–s31.

## Gold (`gold.json`)
39 episodes (33 owner, 6 third-party; each with `kind` event | plan | state_change, date, `date_precision`,
sessions, people, and `plan_outcome` confirmed | cancelled | rescheduled | unresolved for plans), 6 facts with
history, 6 notes, and `not_memories` listing every unconfirmed or denied claim by others, every message addressed to
the assistant by someone else (check.py enforces it) and every wrong assistant recall. Third-party news is an `event`
dated the day it was said. Author's self-audit of every expected answer against the sessions: `GOLD_AUDIT.md`.

## Noise (`noise.json`, `gen_noise.py`, seed 2033)
44 sessions inside the main period, generated deterministically (no LLM): 16 off-topic chats of Giacomo (recipes,
trivia, writing help — no fact asked about), 16 of **ottorino**, whose first-person life mirrors the claims, rumours
and wrong recalls about Giacomo and supplies values for the negative questions (must never surface for Giacomo), and
12 of **loredana** (unrelated). No noise changes an expected answer.

## Files and checks
`_sessions.py`, `_questions.py` (with `ev` evidence sessions), `_gold.py` → `build.py` writes the JSON files;
`gen_noise.py` writes `noise.json` (run after `build.py`). `check.py` verifies: evalkit loaders and `eval_user`;
JSON keys of every question; unique ids (sessions + noise, questions `g01..g46` in order, episodes); main sessions in
chronological order; every timestamp's offset equals Europe/Rome at that local time (DST); every "weekday + day +
month" mention (IT and EN) in messages, questions and gold matches 2033; each question asked after all its evidence
sessions; ≥ 3 questions per category; gold session references (episodes, facts, notes, not_memories) exist; episode
kinds, plan outcomes and date precision valid; fact histories ordered with a current last value; noise within the
period and without group messages.

```
uv run --directory <abs path to spikes/memory-eval> python dataset_blind7/build.py
uv run --directory <abs path to spikes/memory-eval> python dataset_blind7/gen_noise.py
uv run --directory <abs path to spikes/memory-eval> python dataset_blind7/check.py
```

## Notes for graders
- The assistant stays silent in group chats; in private chats it acknowledges the owner's statements, so some answers
  can also be found in assistant turns — and some assistant turns are deliberately wrong (recall echoes).
- In `expected`, the text before the bracket «(Dettagli secondari, non richiesti: …)» / «(Secondary details, not
  required: …)» is the key answer; the bracket is extra true context that must not be required.
- `must_not` lists claims that must not be asserted as true; several also act as isolation guards against
  ottorino's noise.
