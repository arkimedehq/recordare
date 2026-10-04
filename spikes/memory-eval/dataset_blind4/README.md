# Blind dataset #4

Synthetic, fictional. No real people. Written blind, without looking at the engine or at earlier results (see "Blindness" below).

## The person

**Tommaso** (user `tommaso`, timezone Europe/Rome) turns 40 on 9 March 2028. He starts in Ancona as a logistics coordinator at a port shipping agency and moves to a manufacturing company in Osimo (Marche). Over the period he gets engaged to his girlfriend Marta, a primary-school teacher, and moves in with her. He keeps a cat (Mirtillo), adopts a kitten (Zenzero), and later also lives with Marta's beagle (Bricco). He rides a road bike on Sundays with his friend Stefano, attends a Spanish course and a photography course, and has recurring back pain. His family: his parents in Jesi (his father has knee surgery), his sister Francesca in Bologna (her second child is born), and his brother Nicola, who moves to Rotterdam.

Period: **10 Jan – 9 Jun 2028**. It spans the DST change on Sun 26 Mar 2028 and the leap year.

## Files

| file | content |
|---|---|
| `conversations.json` | 62 sessions: 59 one-to-one with the assistant, 3 group chats (`role: other` + `author`). About 19 % are in English (12 sessions). |
| `questions.json` | 84 questions (24 English, 60 Italian), asked as `tommaso`. Some are asked mid-period (e.g. 16 Feb, 3 Mar, 12 Mar, 1 May, 8 May). |
| `gold.json` | 72 episodes (event / plan / state_change, with plan outcomes), 13 facts with full history, 9 notes, 11 not_memories |
| `noise.json` | 170 noise sessions from `gen_noise.py` (seed 2028): 150 off-topic `tommaso` sessions and 20 sessions by user `giorgio` (isolation traps) |

## Questions per category

| category | n |
|---|---|
| point-temporal | 4 |
| last-time | 3 |
| this-week | 3 |
| last-week | 3 |
| period-overview | 3 |
| state-now | 4 |
| state-at-date | 3 |
| state-change-date | 3 |
| plan-confirmed | 3 |
| plan-cancelled | 3 |
| plan-rescheduled | 4 |
| plan-unresolved | 4 |
| correction | 4 |
| implicit-change | 3 |
| count | 4 |
| third-party | 3 |
| emotion (emotion / opinion) | 3 |
| small-detail | 4 |
| provenance | 4 |
| premise-trap | 4 |
| anti-trap | 3 |
| cross-language | 4 |
| poisoning-probe | 4 |
| negative | 4 |
| **total** | **84** |

## Phenomena

- **Plans**
  - Confirmed: interview, Lisbon trip, Easter lunch, farewell dinner, photo exhibition.
  - Cancelled: ski weekend, cheering at a friend's half marathon, Spanish class dinner.
  - Rescheduled once: 40th party (11 → 18 Mar), move (13 → 20 May).
  - Rescheduled twice: root canal (15 Feb → 24 Feb → 8 Mar).
  - Unresolved, the date passes in silence: concert on 8 Apr, kitten vaccine booster, dinner with ex-colleagues on 1 Jun, housewarming on 17 Jun.
- **Casual corrections**
  - Dentist bill: 280 → 320 €.
  - Boss's name: Gatti → Galli.
  - February LDL: 168 → 186 (digits swapped).
  - One question asks for the "as told" value next to the "as true" value.
- **Real state changes**
  - Job: Adriatica → Valmusone.
  - Home and city: Ancona → Osimo.
  - Relationship: girlfriend → engaged → living together.
  - Age: 39 → 40.
  - LDL and back health.
- **Multi-valued facts that accumulate:** pets (1 → 2 → 3), courses (1 → 2 → 1 → 0), nieces and nephews (1 → 2).
- **Implicit changes:**
  - Car: Punto → Yaris, never announced.
  - What happened to the Punto: it was valued by the dealer.
  - Commute time.
- **Third-party life events:** the brother's job abroad, the sister's baby, the father's surgery, a friend's new bike, a friend withdrawing from a race, a colleague's maternity leave.
- **Group chats:**
  - Family, cycling group and work group.
  - Unconfirmed claims about the owner:
    - Lidia's (a relative) "wedding in September";
    - a "19-minute Conero record" on a day the owner was resting;
    - a "doubled salary".
  - Legitimate news that third parties post about themselves.
- **Recurring activities to count:**
  - Five bike rides.
  - Physiotherapy: four sessions in February plus one in May.
  - Distractors: one ride claimed by someone else, one ride skipped.
- **Help requests** (only their provenance is memorable): birthday speech, cover letter, interview questions (EN), mortgages, VLOOKUP, airline complaint (EN), Lisbon itinerary (EN).
- **Cross-language:** events told in English and asked in Italian, and the other way round.
- **Premise traps:** the cancelled ski weekend, buying the flat, finishing the course, surgery attributed to the wrong person, a party on its original date.
- **Anti-traps:** two separate Portonovo rides, dental cleaning vs root canal, Easter vs the Bologna visit to the newborn, Valentine's dinner vs the party venue.
- **Negatives:** facts never mentioned (Marta's surname, Stefano's job, the vet's name, Marta's birthday gift).

## Noise

`gen_noise.py` adapts the idea of set 3's generator, not its content:

- general knowledge and coding questions;
- daily questions with lexical traps (Lisbon, Rotterdam, Val di Fassa, knee rehab, beagles, hybrids, the Conero);
- attributed third-party remarks (a colleague's Punto, a neighbour's beagle, someone's September wedding, someone's Conero time).

User `giorgio` reports first-person events that mirror Tommaso's: a Portonovo ride, a root canal, a kitten, a proposal in Lisbon, a job in Osimo, a Yaris, quitting a course.

The relative-week windows of the this-week and last-week questions contain only neutral filler. There are no help requests that overlap the provenance questions, and nothing mentions a housewarming.

## Checks performed

- The evalkit loaders load the set: `EVAL_DATASET=dataset_blind4` gives 62 sessions and 84 questions, with user `tommaso`.
- Every ISO offset matches Europe/Rome DST (+01:00 until 25 Mar, +02:00 from 26 Mar). This was checked for conversations, noise and `asked_at`.
- Every weekday written next to a date (IT and EN) in sessions, questions and gold matches the 2028 calendar. Relative references ("domenica scorsa", "Thursday", etc.) were checked by hand.
- The sessions each expected answer depends on are all dated on or before its `asked_at`. Session, noise and question ids are unique.

## Blindness

The author did not read:

- `service/`, `systems/*.py`;
- `results/`, `RESULTS.md`;
- `docs/ENGINE_IDEAS.md`;
- the questions and gold of `dataset/`, `dataset_holdout/` and `dataset_blind3/`, and `GOLD_AUDIT.md`.

To match formats only, the author looked at:

- the top-level keys and the first message of set 3's `conversations.json`;
- the `_note` and the first question of set 3's `questions.json`;
- the keys and first item of set 3's `gold.json`;
- set 3's `gen_noise.py`;
- `evalkit/common.py` (`load_sessions`, `load_questions`, `eval_user`);
- `docs/RESEARCH_NOTES.md` H1, to pick the phenomena.

The person, places, storylines and noise content are all new.
