# Dev set — the agent's initiatives (8.12c, NOT blind)

For the initiative sweep of WORK_PLAN 8.12c (D53): after the sessions up to a checkpoint are ingested and extracted,
the hourly sweep runs as of the checkpoint and produces the **initiatives** the agent takes on its own — `say`, `ask`
or `lookup`, for a person or the holder, with a due time. Fictional content. `build.py` writes `conversations.json`
and `initiatives_gold.json`; `check.py` verifies them.

Four memories, 2026-09-01 … 2026-09-30, 54 sessions; checkpoints 2026-09-10, 2026-09-20 and 2026-09-30 at 22:00
(+02:00). In `initiatives_gold.json` each expected initiative has `kind`, `by` (the checkpoint, 1-based, by which it
must exist), `due_day` (the local day it is due; absent for a lookup), `for` (`holder` or a contact's name) and `desc`
(what it must say, judge-readable). Each trap ends its `why` with its kind in brackets.

## The five sources and how the sweep sees them
The sweep runs only at the checkpoints, so the gold expects:
1. a **plan** past at a checkpoint with no outcome told → an `ask` due the day after the plan;
2. a **plan** on the day after a checkpoint (Sep 11, Sep 21, Oct 1) → a reminder `say` due the day before (the
   checkpoint's day); a plan further ahead yields nothing yet;
3. a **promise** the agent made ("te lo ricordo venerdì 25 mattina") → a `say` due that day;
4. a **request** the person made ("ricordami sabato 12 di pagare il bollo") → a `say` due that day;
5. a **question** the agent holds, never answered (a council decision, a roadworks date) → a `lookup` for the host.

Every due time falls in the morning, outside the quiet hours (22–8); no item tests the move to 8:00.

Traps: [1] a plan confirmed as done later (no ask); [2] a request withdrawn (no say); [3] a plan cancelled (no
reminder); [4] a private plan, "non dirlo a nessuno" (nothing); [5] a promise the agent already kept in a later
conversation (no say); [6] a vague wish with no date (nothing); [7] a question the person answered later (no lookup);
[8] something the assistant suggested that the person never agreed to (no reminder).

## Memories
- **marco** (personal, Italian, Padova; 13 sessions). The dentist on Sep 8, never told → *ask* Sep 9 by 1. "Ricordami
  sabato 12 il bollo" → *say* Sep 12 by 2. The Baustelle concert Sep 21 → reminder *say* Sep 20 by 2, told done on
  Sep 22 → trap [1]. The agent promises to remind him of his mother's birthday → *say* Sep 25 by 3. The train-pass
  request withdrawn → trap [2]; "prima o poi le gomme" → trap [6]; the dentist's time, found out → trap [7].
- **giulia** (personal, Italian, Napoli; 13 sessions). The interview at the Fondazione on Sep 11 → reminder *say*
  Sep 10 by 1, then no outcome → *ask* Sep 12 by 2 (the outcome arrives only on Sep 24). The agent's promise about the
  nursery deadline → *say* Sep 16 by 2. "Ricordami lunedì 28 le medicine di nonna" → *say* Sep 28 by 3. Matteo's
  first nursery day Oct 1 → reminder *say* Sep 30 by 3. The Rome trip of Sep 21 cancelled → trap [3]; the Caserta
  interview told as a secret → trap [4]; "dovrei trovare un pediatra" → trap [6].
- **oliver** (personal, English, Bristol, +01:00; 12 sessions). The MOT on Sep 7, never told → *ask* Sep 8 by 1. The
  loft planning decision, never on the portal → *lookup* by 2. The Dublin flight Sep 21 → reminder *say* Sep 20 by 2, told done Sep 23 → trap [1]. The agent promises to
  remind him of Mum's flight → *say* Sep 25 by 3. The bins promise kept the next day → trap [5]; the film festival
  the assistant suggested → trap [8].
- **bottega_vanni** (entity, Italian, a Lucca grocery's shared agent; people say "Sono Paola"; 16 sessions). Paola's
  "ricordami giovedì di ordinare la farina" → *say* Sep 10 for Paola by 1. The roadworks date the Comune never
  published → *lookup* for the holder by 2. The fridge technician on Sep 16, never told → *ask* Sep 17 for Paola by 2.
  Tommaso's van inspection Sep 21 → reminder *say* Sep 20 for Tommaso by 2 (told done Sep 22). The agent's promise to
  Sara about her HACCP certificate → *say* Sep 25 for Sara by 3. Sara's secret interview → trap [4]; the accountant
  request withdrawn → trap [2]; whether the mill delivers on Saturdays, found out → trap [7].

Totals: 18 expected (12 say, 4 ask, 2 lookup; 4 by checkpoint 1, 9 by 2, 5 by 3), 13 traps (kinds 1–8, each at least
once).

Not blind: never use it to confirm a decision.
