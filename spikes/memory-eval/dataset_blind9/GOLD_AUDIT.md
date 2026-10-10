# Gold audit — blind dataset 9 (personal agent memory, Beatrice, Trento 2034)

Independent audit of `dataset_blind9/` (written by another agent). Not committed.

## Method
- Read only `spikes/memory-eval/DATASET_FORMAT.md` and the files in `dataset_blind9/` (README, `_sessions.py`,
  `_questions.py`, `_gold.py`, `build.py`, `check.py`, generated JSON). Nothing under `service/`, `packages/`,
  `connectors/`, `systems/`, `docs/`, results, logs or other datasets was opened.
- For each question: re-derived the answer from the sessions and sources in `ts` order, as of `asked_at` (corrections,
  cancellations, later changes, the forget entry); checked every date/weekday against the 2034 calendar
  (independently with Python, besides `check.py`); checked `must_not` against `expected` and the history; for `asker`
  questions, checked that "I" resolves to the asker; for knowledge questions, that the answer is in the source text
  only (SOURCE_ONLY tokens) and, for the forgotten source, that the forget entry (30 Oct 18:25) lies after `k-alarm`
  (27 Sep) and before `asked_at` (6 Nov).
- Checked `gold.json` episodes / facts / notes / not_memories against the sessions, and README counts against the files.
- Re-ran `build.py` and `check.py` after the edits: **OK**.

## Per-question verdicts

| id | verdict | note |
|---|---|---|
| q01 | OK | Booking 28 Sep 17:30 → moved to Fri 29 Sep 18:00 → done (14.2 kg); dates right. |
| q02 | OK | Three quotes; Linea Studio chosen; 395 after the 11 Oct correction; `must_not` targets the current cost only. |
| q03 | OK | As of Tue 10 Oct the table (Thu 12 Oct 20:00) is still booked; cancelled only on 11 Oct. |
| q04 | OK | Cancelled Wed 11 Oct (Dario ill). "The dinner did not take place" is the natural reading. |
| q05 | fixed | Long list without essentials: key answer reduced to the two groups and the main items; the rest moved to secondary details. |
| q06 | OK | Stefano: drill, extension cords, pizza. |
| q07 | OK | Pietro (display name only) identified via s09; Sonotherm request, Greta's yes, things on Thu 12 Oct (said, not confirmed — phrased as "ha detto"). |
| q08 | OK | Ennio's claim unconfirmed; Michele's two denials (23 Sep, 20 Oct). |
| q09 | OK | Denied by the holder on 20 Oct. |
| q10 | OK | Greta's 9 Oct claim premature; ordered (reported) 18 Oct, delivered 30 Oct. |
| q11 | OK | Asker Michele, 29 Sep: Sat 30 Sep 8:30 via Suffragio 8. |
| q12 | OK | Asker Michele, 20 Oct: Thu 26 Oct 9:00, polo universitario Rovereto; thesis defence kept secondary. |
| q13 | OK | Asker Priya, 10 Oct: methods and statistics by Wed 25 Oct. |
| q14 | OK | Asker Inés, 30 Oct: Fri 3 Nov, 15:40 Verona / 18:20 Trento, guest room, until Sun 5 Nov. |
| q15 | note | Asker Stefano: Wed 1 Nov, head of elderly-care area. Only the plan is evidenced (s11, s27); no session after 1 Nov confirms he started — accepted as the obvious reading. |
| q16 | fixed | Asker Stefano about the holder: train times moved from the key answer to secondary details (the question asks only when and where). |
| q17 | OK | Premise "25 Oct" rejected: Thu 26 Oct 9:00 (asked 24 Oct, before the exam). |
| q18 | fixed | Teacher, participants and train times moved to secondary details; key = module 1 done 14–15 Oct, module 2 ahead 11–12 Nov. |
| q19 | OK | Due and delivered Mon 30 Oct. |
| q20 | fixed | "Beatrice is the presenting author" was in the key answer, but only Jonas agreed (Priya never answered): moved to secondary details as "offered, Jonas agreed", with word count and results date. |
| q21 | fixed | "graduatoria uscita il 18 ottobre": the sessions only say it was out when the holder told on 18 Oct — reworded. |
| q22 | OK | 6 years (born April 2028), corrected 30 Sep. |
| q23 | OK | Agent's wrong recall on 11 Oct (21–22 Oct) corrected to 14–15 Oct. |
| q24 | OK | As of 10 Oct: Mon/Wed/Fri + Sat morning; Greta's 9 Oct claim about Saturdays was denied. |
| q25 | OK | From 23 Oct: Mon–Thu + Sat morning, home visits Friday. |
| q26 | OK | As of 10 Oct: Fri 27 Oct (extension came 25 Oct). |
| q27 | OK | Art. 6: six months, PEC or registered letter — source only. |
| q28 | OK | E3 = overheating, switch off, wait 10 min — source only; question in English, source in Italian. |
| q29 | OK | 12-week protocol as in the handout. |
| q30 | OK | 220 °C, 25 min, no stirring, 5 min rest — source only. |
| q31 | OK | 2,340 EUR by 30 Nov — the holder's own notes. |
| q32 | OK | Forgotten source: forget (30 Oct) after the source (27 Sep) and before the question; expects "not known any more"; `must_not` holds the codes. |
| q33 | OK | Greta, by email on the evening of Mon 9 Oct (`provided_by`, no conversation). |
| q34 | OK | Inés, Tue 17 Oct; cooked Sun 29 Oct for Mirella and Gianpaolo. |
| q35 | fixed | Key = pasted Thu 21 Sep, used Tue 17 Oct citing art. 7; the plumber outcome (20 Oct, 480 EUR) moved to secondary details. |
| q36 | note | 28 days (2 Oct → 30 Oct). "Primo giorno nello studio nuovo" could be read as the move day (30 Sep → 30 days), but s09 literally says "Primo giorno nello studio nuovo" on 2 Oct, so 28 is the answer. |
| q37 | fixed | The long week answer: rewritten as a key set (water heater 17/20, bed + grant + flowers 18, birthday 21, lunch 22; "most of them, nothing outside the week") with the other items as secondary details. Still the weakest question (open aggregation). |
| q38 | OK | Two trips (22 Oct lunch, 26 Oct dinner); the 26 Oct presence is confirmed afterwards in s25. |
| q39 | OK | Premise trap: Greta is the physio colleague; Michele passed on 26 Oct. |
| q40 | OK | Premise trap: no dinner on 19 Oct; booking for 12 Oct cancelled 11 Oct. |
| q41 | OK | Plate never said. |
| q42 | OK | Pietro's rent never said. |

## Gold notes
- **g-e21 / g-e22, `speaker: Inés`** — defensible: the recipe and the visit plan are her statements (s16); the holder's
  cooking (s25) and the visit's course (s31) are added in the same episode. A checker that keys on speaker should
  accept "Beatrice" for the s25 / s31 parts.
- **Insurance premium as one value** (fact `studio insurance` = 395 with the correction noted; 385 in `not_memories`)
  — acceptable; an extraction that keeps a two-value history (385 → 395 from 11 Oct) is equally right.
- **Michele's job claim vs his own episode** — consistent: g-e25 holds Michele's own statement (interview, ranking in
  December); `not_memories` holds Ennio's claim that he has the job. No contradiction.
- **g-e27** — fixed: "Pietro brought his things on Thu 12 Oct" asserted an event nobody confirmed; now "said he would".
- **g-e20** — fixed: "Beatrice is the presenting author" → "offered to be the presenting author (Jonas agreed)".
- g-e14 / g-e15 date the bed order and the grant ranking to 18 Oct, the day the holder reported them (the sessions do
  not say the exact day); harmless at day precision.
- g-e23 (trip to Rovereto 26 Oct) lists only s25 as evidence; s23 (the plan, "Ci sono") is also relevant. Not changed.
- g-e26 / fact `Stefano's job`: the 1 Nov start is a stated plan, not confirmed afterwards (same caveat as q15).

## Fixes made (before → after)
1. q05 `expected`: one flat list of every Michele message → key answer (two groups; exam Thu 26 Oct corrected from the
   25th; interview only, ranking in December; passed 29/30; 8:30 by the 7:40 train with gloves) + secondary details
   (polo universitario, thesis 15 Nov 10:00, Al Borgo dinner, ok for 22 Oct, number of boxes).
2. q16 `expected`: "…a Verona (corso, Omboni); treni già prenotati: …" → "Sabato 11 e domenica 12 novembre 2034 a
   Verona." + course name, teacher and trains as secondary details.
3. q18 `expected`: teacher, 18 participants and module-2 trains moved into secondary details.
4. q20 `expected`: "(298 words; Beatrice is the presenting author; results expected in January)" in the key answer →
   secondary details "298 words; Beatrice offered to be the presenting author and Jonas agreed; results expected in
   January".
5. q21 `expected`: "(graduatoria uscita il 18 ottobre)" → "(graduatoria uscita, me l'hai detto il 18 ottobre)".
6. q35 `expected`: plumber outcome (20 Oct, 480 EUR by the landlord) moved into secondary details.
7. q37 `expected`: day-by-day list of everything → "main facts (most of them, nothing outside the week)" key set +
   secondary details for the rest.
8. `_gold.py` g-e27: "Pietro brought his things on Thu 12 Oct" → "Pietro said he would bring his things on Thu 12 Oct".
9. `_gold.py` g-e20: "Beatrice is the presenting author" → "Beatrice offered to be the presenting author (Jonas agreed)".

No question added or removed; `_sessions.py` unchanged. README counts and categories match the files (42 questions,
13 categories with the stated counts, 4 EN / 2 ES questions, 32 sessions with 12 group chats, 6 sources + 1 forget,
28 episodes / 11 facts / 7 notes).

## Remaining caveats for readers of the results
- **q37** (week 16–22 Oct) is an open aggregation: judge leniency matters; a partial but correct list should pass,
  an answer that adds out-of-week events (the course itself, the Grillo dinner) should fail.
- **q15** and the gold's Stefano job change assume the announced 1 Nov start happened.
- **q36** depends on reading "first day in the new studio" as 2 Oct (the session's own words), not the move day.
- **q05** remains a long recall question across two groups; it tests attribution more than completeness.
- `asked_at` for most questions is Mon 6 Nov 08:00, the day of the Fedrizzi appointment (11:00): nothing asks about it,
  so no ambiguity, but an answer mentioning it as "today, ahead" is correct.
