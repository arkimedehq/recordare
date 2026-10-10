# Dev sets — the 8.11 gaps (NOT blind)

Written by the engine developer after the blind9 / blind10 measurement (WORK_PLAN 8.11), to check the fixes of the gaps
found there without tuning on the blind sets. `dataset_dev_gaps` (personal: Marco, Bologna, November 2026; 7 sessions,
6 questions) and `dataset_dev_gaps_entity` (entity: a mountain hut's shared agent; 7 sessions, 5 questions).

What they exercise:
- a step of a plan done before its date, asked about the plan's day ("Ho un tavolo prenotato per giovedì?", "C'è un
  pulmino prenotato per sabato?") — the period filter and the plan's amend;
- the agent's own slip, corrected in the conversation ("Ti sei mai sbagliato…?");
- the options the agent compared next to the choice (gyms, firewood suppliers);
- a fact corrected later whose first message is still in the chat log (tyres; the boiler filter's room);
- controls: a day question (d05: out-of-period items must not leak into it), a premise trap, own content.

Not blind: never use them to confirm a decision.
