# Dev sets — the 8.11 gaps (NOT blind)

Written by the engine developer after the blind9 / blind10 measurement (WORK_PLAN 8.11), to check the fixes of the gaps
found there without tuning on the blind sets. `dataset_dev_gaps` (personal: Marco, Bologna, November 2026; 15 sessions,
7 questions) and `dataset_dev_gaps_entity` (entity: a mountain hut's shared agent; 11 sessions, 6 questions).

What they exercise:
- a step of a plan done before its date, asked about the plan's day ("Ho un tavolo prenotato per giovedì?", "C'è un
  pulmino prenotato per sabato?") — the period filter and the plan's amend;
- the agent's own slip, corrected in the conversation ("Ti sei mai sbagliato…?");
- the options the agent compared next to the choice (gyms, firewood suppliers);
- a fact corrected later whose first message is still in the chat log (tyres; the boiler filter's room);
- a place asked on the wrong date among many bigger dinners (d07, sessions g08–g15): the out-of-period items must be
  ranked by relevance, not importance or recency (the old ranking left the cancelled booking out: partial);
- the entity agent's own actions at a staff member's request (e06, sessions r08–r11): a booking handed over in the same
  conversation as own content ("Ti passo una prenotazione…" → "Prenotato") is mine, "su richiesta di Gianni", not
  "Gianni mi ha dato la prenotazione" (old prompt: 2 of 4 runs); the guests' episodes in German must survive the staff
  contacts listed by their role facts (C1 = Paola given as the subject of Anna Hofer's episodes: dropped, 1 of 4 runs);
- controls: a day question (d05: out-of-period items must not leak into it), a premise trap, own content.

Not blind: never use them to confirm a decision.
