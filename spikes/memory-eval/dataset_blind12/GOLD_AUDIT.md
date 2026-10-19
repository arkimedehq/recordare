# Gold audit — blind set #12

Independent audit, 2026-10-18. Auditor read only this folder, `DATASET_FORMAT.md`, `evalkit/common.py` (answer and
judge prompts), the `outcome_eval.py` docstring and `OUTCOME_SYSTEM`, and `docs/RESEARCH_NOTES.md` § H1.

## Method
1. Read all 62 sessions in order (`_sessions.py`), then each question with its evidence, using only sessions dated
   before its `asked_at`.
2. Every date / weekday in sessions and expected answers verified with Python `datetime` (all correct; DST offsets
   checked by `check.py`).
3. Counts recomputed (runs 5+6+7+8+10 = 36 km; Pietro's gear 45+12+25 = 82 €; goals 1+2+1 = 4; Milan trips and
   donations from the explicit "first / second / third time" and AVIS sessions).
4. For each question: is the expected answer the only one a careful reader can reach? Does a later session (before
   `asked_at`) muddy it? Does a `must_not` item forbid a correct phrasing (history, negation, extra context)?
5. Fixes applied in `_sessions.py` / `_questions.py` / `_gold.py`; `python3 build.py && python3 check.py` clean.

## Verdicts

| id | category | verdict | note |
|---|---|---|---|
| h01 | plan-unresolved | ok | s23–s25 (before 22 Mar 20:00) never mention the dinner |
| h02 | plan-unresolved | ok | s40 (evening of 20 Apr) is about Dublin only |
| h03 | plan-unresolved | ok | s19 (evening of 13 Mar) silent on the eye check |
| h04 | plan-unresolved | ok | s45 (1 May: park) does not mention Ikea |
| h05 | plan-unresolved | ok | |
| h06 | plan-unresolved | ok | |
| h07 | plan-unresolved | ok | s56 is about the Punto, not the Panda |
| h08 | plan-unresolved | fixed | flagged: s55 "Owen was right" refers to the book tip of 9 Apr (s35), before the call — no outcome, fair. `must_not` "Owen told you" / "Owen ti ha detto" would also hit the true history (Owen recommended the book); narrowed to the call |
| h09 | plan-implicit | ok | flagged: check-in done (s40), "domani si parte" (s41), 600 Lisbon photos on the NAS in folder "2034-04 Lisbona" (s46) — certain |
| h10 | plan-implicit | ok | s17 "Sandro non si è fatto vivo" 9 Mar; came 16 Mar (s22) |
| h11 | plan-implicit | ok | flagged: "Sabato 15 do *finalmente* l'antiruggine … il barattolo è lì da fine marzo che mi guarda" (s37) can only mean it was not done on 1 Apr; 15 Apr outcome correctly unknown |
| h12 | plan-implicit | ok | |
| h13 | plan-implicit | ok | flagged: "viaggio con la carta d'identità nuova" (10 Apr) entails the renewal before Lisbon; the expected answer does not claim it was done on 24 Feb |
| h14 | plan-implicit | ok | flagged: "il Lambrusco che ci hanno regalato alla festa dei 70 anni di Giovanna a Modena" (s14) — given *at* the party, so they were there |
| h15 | plan-implicit | ok | 19 May = Friday; s56 "arrivata ieri" on 20 May |
| h16 | plan-moved | ok | |
| h17 | plan-moved | ok | |
| h18 | plan-moved | ok | two moves |
| h19 | plan-moved | ok | |
| h20 | plan-moved | ok | |
| h21 | plan-moved | ok | |
| h22 | plan-moved | ok | |
| h23 | premise-trap | ok | |
| h24 | premise-trap | ok | |
| h25 | premise-trap | ok | |
| h26 | premise-trap | ok | 9 Jun 2034 = Friday; s48 / s60 confirm the new rule |
| h27 | premise-trap | fixed | `must_not` "avete speso" also matched the correct "non avete speso nulla"; narrowed |
| h28 | premise-trap | ok | flagged: the expected answer already says what Chiara paid is unknown; fair |
| h29 | premise-trap | ok | |
| h30 | accumulate | fixed | s49 (7 May): "I'll just keep it up, one or two runs a week" — asked 3 Jun, the true number of runs is unknown (likely > 5). Question reworded to the runs *told* ("Quante corse ti ho raccontato…"); expected adds that no later run was told. s35 / s49 got "stamattina" / "this morning" so the run dates are explicit |
| h31 | accumulate | ok | |
| h32 | accumulate | ok | |
| h33 | accumulate | ok | a January donation is excluded by the 90-day rule (s04); none possible after 31 May before 3 Jun |
| h34 | accumulate | fixed | s33 did not say when the Fortitudo match was (could be Sat 1 Apr) while expected / gold say Sun 2 Apr; s33 now starts "Oggi prima partita…" |
| h35 | accumulate | ok | explicit "first / second / third time this year" |
| h36 | supersede | ok | |
| h37 | supersede | fixed | `must_not` bare "Bonacini" / "lunedì e mercoledì" would hit true history ("later replaced by Bonacini"); scoped to 1 March |
| h38 | supersede | ok | |
| h39 | supersede | fixed | `must_not` bare "7,99 €" / "8,99 €" would hit true history; scoped to mid-March |
| h40 | supersede | ok | |
| h41 | supersede | ok | |
| h42 | supersede | ok | |
| h43 | supersede | ok | |
| h44 | correction-vs-change | ok | 11 May 2034 = Thursday, consistent misreading |
| h45 | correction-vs-change | ok | |
| h46 | correction-vs-change | ok | |
| h47 | correction-vs-change | ok | |
| h48 | correction-vs-change | ok | |
| h49 | correction-vs-change | ok | |
| h50 | correction-vs-change | ok | |
| h51 | negative | ok | |
| h52 | negative | ok | |
| h53 | negative | ok | |
| h54 | negative | fixed | `must_not` "AB" (a bare substring) replaced by full claims |

Totals: 46 ok, 8 fixed, 0 dropped. Categories unchanged: plan-unresolved 8, plan-implicit 7, plan-moved 7,
premise-trap 7, accumulate 6, supersede 8, correction-vs-change 7, negative 4.

## Changes
- `_sessions.py`: s33 "Oggi prima partita…"; s35 "Stamattina quarta corsa…"; s49 "Fifth run this morning…".
- `_questions.py`: h30 question and expected; `must_not` of h08, h27, h37, h39, h54.
- `_gold.py`: note on professionals — Zaccaria "(GP)" → "(doctor, back pain)" (GP was never said).

## Residual risks
- h32 asks which books he *finished*; only told books can be known. No forward reading plan is stated after 18 May,
  so "three" is the reasonable answer, but a system could hedge.
- h23: the reason for cancelling Kumo (Anna's fever) is implied by "ovviamente" in the same message, not stated
  outright; the key facts (not gone, table cancelled, pizzas) are explicit.
- h25 / h28 / h27 rely on the judge's negation rule for phrasings like "non avete visitato nulla".
- Gold: g-e57 (picnic on 2 Jun) is `open` though its day is the last of the period; no question depends on it.
- s48 calls 5 May a "ponte" (1 May was the Monday holiday); flavour only, no question depends on it.
