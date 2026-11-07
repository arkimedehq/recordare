# Dev set — the agent's initiatives (8.12c, NOT blind)

For the initiative sweep of WORK_PLAN 8.12c (D53): after the sessions are ingested and extracted, the sweep produces
the **initiatives** the agent takes on its own — `say`, `ask` or `lookup`, for a person or the holder, with a due
time. The evaluator sweeps **once a day at 09:00 local between the checkpoints and at each checkpoint** (the real
system sweeps every hour). Fictional content. `build.py` writes `conversations.json` and `initiatives_gold.json`;
`check.py` verifies them.

Four memories, 2026-09-01 … 2026-09-30, 54 sessions; checkpoints 2026-09-10, 2026-09-20 and 2026-09-30 at 22:00
(+02:00). In `initiatives_gold.json` each expected initiative has `kind`, `by` (the first checkpoint on or after its
due day, 1-based), `due_day` (the local day it is due; absent for a lookup), `for` (`holder` or a contact's name) and
`desc` (what it must say, judge-readable). Each trap ends its `why` with its kind in brackets.

## The five sources and the gold's rules
1. Every **plan** with a date that is still open → one reminder `say` due the day before the plan.
2. Every **plan** whose end passed with no outcome told within two days → one `ask` due **two days after the plan's
   end** (a trip ends on its return day; people tell on their own the day after, so asking the next morning would be a
   nag); an outcome told on or before that day means no ask (Marco's concert, Tommaso's van, Oliver's Dublin trip and
   Mum's pick-up). A plan reminded and then asked about gets two expected items.
3. Every dated **promise** of the agent ("te lo ricordo venerdì 25 mattina") → one `say` due that day.
4. Every dated **request** to the agent ("ricordami sabato 12 di pagare il bollo") → one `say` due that day.
5. A **question** the agent holds, never answered (a council decision, a roadworks date) → one `lookup` for the host.

Judgement calls, so that the gold stays countable: a deadline or an anniversary is not a plan (Giulia's nursery
application "scade giovedì 17", Marco's mother's birthday: the agent's promise is their one source); an explicit dated
action is a plan even when a promise covers it too (Oliver picking Mum up on Sep 25, Sara's HACCP certificate on Sep 25:
reminder the day before, the promised say on the day, and for Sara an ask on Sep 27 since she tells only on Sep 29);
Oliver's Dublin trip runs Sep 21–23 ("back Wednesday the 23rd"), so its ask would fall on Sep 25 and the outcome told
on Sep 23 is in time (no ask: trap [1]). Every due time falls in the morning, outside the quiet hours (22–8); no item
tests the move to 8:00.

Traps: [1] a plan confirmed as done later (no ask); [2] a request withdrawn (no say); [3] a plan cancelled (no
reminder); [4] a private plan, "non dirlo a nessuno" (nothing); [5] a promise the agent already kept in a later
conversation (no say); [6] a vague wish with no date (nothing); [7] a question the person answered later (no lookup);
[8] something the assistant suggested that the person never agreed to (no reminder). Added 2026-11-07 (found on Kinox: a reminder said at
the time first given though the person moved it, and one said twice when asked again): [10] a request moved to
another day (Giulia's photos, Tuesday 22 → Wednesday 23: the say on the new day only); [11] a request asked again by
someone else and answered as already set (Tommaso asks for Paola's flour reminder: no second say). 57 sessions, 15
expected; earlier runs had 54 and 14.

## Memories
- **marco** (personal, Italian, Padova; 13 sessions; 5 expected). The dentist on Sep 8 → reminder *say* Sep 7 by 1,
  never told → *ask* Sep 10 by 1. "Ricordami sabato 12 il bollo" → *say* Sep 12 by 2. The Baustelle concert Sep 21 →
  reminder *say* Sep 20 by 2, told done on Sep 22 → trap [1]. The agent promises to remind him of his mother's
  birthday → *say* Sep 25 by 3. The train-pass request withdrawn → trap [2]; "prima o poi le gomme" → trap [6]; the
  dentist's time, found out → trap [7].
- **giulia** (personal, Italian, Napoli; 13 sessions; 5 expected). The interview at the Fondazione on Sep 11 →
  reminder *say* Sep 10 by 1, then no outcome → *ask* Sep 13 by 2 (the outcome arrives only on Sep 24). The agent's
  promise about the nursery deadline → *say* Sep 16 by 2. "Ricordami lunedì 28 le medicine di nonna" → *say* Sep 28
  by 3. Matteo's first nursery day Oct 1 → reminder *say* Sep 30 by 3. The Rome trip of Sep 21 cancelled on Sep 18 →
  trap [3]; the Caserta interview told as a secret → trap [4]; "dovrei trovare un pediatra" → trap [6].
- **oliver** (personal, English, Bristol, +01:00; 12 sessions; 6 expected). The MOT on Sep 7 → reminder *say* Sep 6
  by 1, never told → *ask* Sep 9 by 1. The loft planning decision, never on the portal → *lookup* by 2. The Dublin
  trip Sep 21–23 → reminder *say* Sep 20 by 2, told done Sep 23 → trap [1]. Picking Mum up on Sep 25 → reminder *say*
  Sep 24 by 3 and the promised *say* Sep 25 by 3 (outcome told Sep 26). The bins promise kept the next day → trap
  [5]; the film festival the assistant suggested → trap [8].
- **bottega_vanni** (entity, Italian, a Lucca grocery's shared agent; people say "Sono Paola"; 16 sessions; 8
  expected). Paola's "ricordami giovedì di ordinare la farina" → *say* Sep 10 for Paola by 1. The roadworks date the
  Comune never published → *lookup* for the holder by 2. The fridge technician on Sep 16 → reminder *say* Sep 15 for
  Paola by 2, never told → *ask* Sep 18 for Paola by 2. Tommaso's van inspection Sep 21 → reminder *say* Sep 20 for
  Tommaso by 2 (told done Sep 22). Sara's HACCP certificate on Sep 25 → reminder *say* Sep 24, the promised *say* Sep
  25 and an *ask* Sep 27, all for Sara by 3 (she tells on Sep 29). Sara's secret interview → trap [4]; the accountant
  request withdrawn → trap [2]; whether the mill delivers on Saturdays, found out → trap [7].

Totals: 24 expected (17 say, 5 ask, 2 lookup; 6 by checkpoint 1, 10 by 2, 8 by 3), 13 traps (kinds 1–8, each at
least once).

Not blind: never use it to confirm a decision.
