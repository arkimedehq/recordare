# Blind dataset 9 — personal agent memory (Beatrice, Trento, 2034)

Blind evaluation set for the **personal agent memory** (WORK_PLAN 8.11): the agent of one person remembers in the
first person — the holder's life and the agent's own actions are one "I" — across 1:1 conversations, group chats with
**declared** and display-name-only authors, questions asked by **identified contacts** about themselves, and
**learned sources** (one later forgotten). Fictional content only.

## Blindness statement
Written from `DATASET_FORMAT.md` (the format spec), `evalkit/common.py` (loaders) and the **tooling only** of
`dataset_blind6/` and `dataset_blind8/` (`build.py`, `check.py`, `README.md`, the code structure of `_sessions.py` /
`_questions.py` / `_gold.py` — people, places, stories and questions of those sets were not reused), plus the gold
field names read by `extraction_eval.py`. Not read: anything under `service/`, `packages/`, `connectors/`,
`spikes/memory-eval/systems/`, `RESULTS.md`, `results/`, logs, any other `dataset_*` folder (dev sets included),
`docs/`. No LLM or paid API was used to write it.

## Person
Beatrice Sartori (user id `beatrice`, **feminine**), 36, physiotherapist in Trento. Until the end of September at the
Poliambulatorio Clarina; from Mon 2 Oct 2034 her own studio in via Suffragio 8, shared with Greta Moser (physio) and
Pietro Valcanover (osteopath, Thursdays); landlord Renato Dallapiccola. Lives in via Grazioli 14 with partner
Stefano Bortolotti (Cooperativa Il Ponte) and the beagle Tango; grey 2029 Toyota Yaris hybrid. Brother Michele (29,
nursing student) in Rovereto with mother Loredana (65 on 21 Oct) and father Ennio. Thursday friends Noemi, Dario
(and Stefano); research group with Priya (Manchester) and Jonas (Oslo), in English; Pilates friends from Valencia
Inés and Rocío, in Spanish.

**Period**: Mon 18 Sep – Sun 5 Nov 2034, Europe/Rome. **DST ends Sun 29 Oct 2034**: `+02:00` up to s24,
`+01:00` from s25 (check.py verifies every offset).

## Format notes (see `DATASET_FORMAT.md`)
- `conversations.json`: `users`, `genders` (`beatrice: feminine`), `entities: []`, `sessions` = 32 conversations plus
  7 source entries interleaved by `ts`. Group-chat sessions carry `participants` for the **declared** authors
  (`michele-s`, `stefano-b`, `greta-m`, `priya-r`, `ines-v`); Loredana, Ennio, Noemi, Dario, Pietro, Jonas, Rocío are
  known by display name only. Michele is declared in two groups (Famiglia Sartori, Trasloco studio), Stefano in two
  (Trasloco studio, Compagnia del giovedì).
- Learned sources (`type: source`): `k-lease` (handed over by the holder in s03, `conversation`), `k-alarm` (from the
  landlord, handed over in s07), `k-sonotherm` (`provided_by: Greta`, by email, no session), `k-course` (handed over in
  s15, author dott.ssa Valeria Omboni), `k-recipe` (`provided_by: Inés`, pasted in s16, Spanish), `k-notes` (the
  holder's own notes, `own_text`, handed over in s18). `forget-k-alarm` (30 Oct) forgets the alarm instructions after
  the system was replaced.
- `questions.json`: 42 questions `q01`–`q42`; 7 carry an `asker` (identified contact: Michele ×2, Stefano ×3, Priya,
  Inés). Asked mostly Mon 6 Nov 2034; mid-period: 29 Sep (q11), 10 Oct (q03, q13, q24, q26), 20 Oct (q12), 24 Oct
  (q17), 30 Oct (q14).

## Counts
- 32 sessions: 20 holder↔agent, **12 group chats** (Famiglia Sartori ×3, Trasloco studio ×1, Compagnia del giovedì ×1,
  Studio Suffragio ×1, Rehab Research Group ×4 EN, Pilates Valencia 2033 ×2 ES). Languages: 24 Italian, **6 English**
  (s10, s22, s24, s26, s28, s29 — 19 %), **2 Spanish** (s16, s30). Sources: 4 Italian, 1 Spanish (+ the forgotten one).
- 42 questions: 36 Italian, 4 English (q13, q20, q28, q41), 2 Spanish (q14, q30).

| category | n | what it tests |
|---|---|---|
| agent-action | 4 | what the agent did, in the first person: vet booking (moved by the clinic, done), insurance comparison (premium later corrected), table booked (as-of 10 Oct: still booked) and later **cancelled** |
| declared-group | 3 | who said what: the same declared person (Michele) across two groups; Stefano (declared) vs Michele at the move; Pietro (display name only) |
| claim | 3 | unconfirmed (Ennio: Michele's job), denied by the holder (the shoulder), premature then confirmed (the electric bed) |
| asker-self | 5 | "I" = the asker: Michele (move time; exam date, must not be the holder's course), Priya (EN, her part of the abstract), Inés (ES, her arrival), Stefano (new role — wrong if read as the holder's new studio) |
| asker-other | 2 | Stefano about Beatrice's course module 2; Stefano's **premise trap** on Michele's exam date (25 vs 26 Oct) |
| plan | 3 | course module 1 done / module 2 ahead; bed delivery done; abstract deadline moved and submitted |
| correction | 3 | holder corrects another's statement (Noemi's 8,000 → 6,000), her own detail (Tango 5 → 6), the agent's wrong recall (course 21–22 → 14–15 Oct) |
| state-now | 3 | studio schedule as of 10 Oct and now (changed 23 Oct); abstract deadline as of 10 Oct |
| knowledge | 6 | lease notice period, Sonotherm E3 (EN), course protocol, recipe oven time (ES), tax advance from own notes, **forgotten** alarm code (must answer "not known any more") |
| knowledge-provenance | 3 | who gave the Sonotherm manual and when (contact, `provided_by`); the recipe's origin and what the holder cooked; when the lease was learned and used (art. 7 for the water heater) |
| temporal | 3 | days between studio opening and bed delivery (28); what happened in the week 16–22 Oct; how many trips to Rovereto (2) |
| premise-trap | 2 | exam attributed to Greta; dinner on the wrong date (19 Oct) |
| negative | 2 | number plate (EN); what Pietro pays for his room |

The minimum counts asked for (3/3/3/4/2/3/3/3/5/3/3/2/2) sum to 39, so the set has 42 questions rather than 36.

## Patterns covered (session ids)
- a) agent actions: vet booking s02 → moved s07 → done s08; insurance s05 → corrected s14; table s12 → cancelled s14;
  trains s12 / s32; rent reminder s08; message to the landlord citing the lease s17; flowers s18; reminders s24, s25.
- b) declared vs display-name authors: s04/s19/s23 (Michele declared; Loredana, Ennio not), s06 (Michele + Stefano),
  s11 (Stefano declared; Noemi, Dario not), s13 (Greta declared; Pietro not), s10/s22/s26/s29 (Priya declared; Jonas
  not), s16/s30 (Inés declared; Rocío not).
- c) claims: Ennio s04 (unconfirmed, Michele s04/s19), Noemi s11 (premature; corrected by the holder s18), Dario s11
  (Canary Islands, "Magari!"), Greta s13 (Saturdays — denied; the bed — premature, true from s18), Loredana s19
  (shoulder — denied), Loredana s04 (exam date — corrected by Michele).
- d) corrections: Tango's age s01 → s08; premium s05 → s14; agent's wrong recall s14; Noemi's figure s11 → s18.
- e) plans: course s12/s14/s15/s32; bed s13/s18/s25/s27; abstract s10/s22/s24/s26/s28/s29; mother's birthday
  s04/s18/s19/s20; Michele's exam s04/s19/s20/s23; Inés's visit s16/s30/s31/s32.
- f) state changes: schedule s09 → s21; Stefano's job s11 → s27; deadline s10 → s22.
- g) sources and their use: lease s03 → s17/s21; alarm s07 → forgotten s27; Sonotherm s13; handout s15 → s21; recipe
  s16 → s25; notes s18 → s31/s32.
- h) aggregation: week of 16–22 Oct (s15–s21); Rovereto trips (s20, s25).

## Gold (`gold.json`)
28 episodes (each with `sessions` — source ids allowed —, `speaker`, `people`, `kind`, `date`, `plan_outcome`,
`content`), 11 facts with history (workplace, schedule, Stefano's job, abstract deadline, alarm instructions
learned → forgotten, …), 7 notes, and `not_memories` listing every unconfirmed / denied claim, every superseded value,
the agent's wrong recall and the forgotten source's content.

Points a second reader may weigh differently: g-e21/g-e22 are attributed to `speaker: Inés` (her news) although
Beatrice's cooking / hosting is in the same episode; the insurance premium is modelled as one fact value with the
correction noted (not two history values); "Michele's job" is kept as an unconfirmed claim even though Michele himself
says the ranking comes in December (that part is his own statement and is in g-e25).

## Files and checks
`_sessions.py` (sessions, sources, `SOURCE_ONLY` tokens), `_questions.py` (with `ev` evidence ids and `asker`),
`_gold.py` → `build.py` writes `conversations.json`, `questions.json`, `gold.json`. `check.py` verifies: JSON shape per
`DATASET_FORMAT.md` (incl. `genders`, `entities`, `participants`, source fields); evalkit loaders and `eval_user`; ids in
order (`s01…`, `q01…`, `k-…`, `forget-<source>`); every offset equals Europe/Rome at that local time (DST); every
"weekday + day + month" mention (IT / EN / ES) and bare "weekday + day" (IT) matches 2034; declared participants write in
their session and keep one name per identity; every `asker` is declared somewhere; sources come after their
`conversation`'s last message and the forget entry after its source; source-only facts never appear in a chat
message; each question is asked after all its evidence; categories present with their minimum counts; `asker` iff
`asker-*`; gold references, kinds and `plan_outcome` iff plan; the forgotten source has a knowledge question and a
`not_memories` entry.

```
uv run --directory <abs path to spikes/memory-eval> python dataset_blind9/build.py
uv run --directory <abs path to spikes/memory-eval> python dataset_blind9/check.py
```
