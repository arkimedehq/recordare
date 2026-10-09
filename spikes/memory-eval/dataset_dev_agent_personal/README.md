# Dev set — personal agent memory (WORK_PLAN 8.4, D50)

**Not blind**: written by the engine developer to iterate on the first-person prompt (`extract.v12`) and the recall by
subject. Never report it as a blind result; the confirmation is blind7 × 3 (bar 91.7 %, extract.v11).

## Memory
Andrea's agent (personal mode, masculine): the person and the assistant are one "I". Period: Mon 7 – Sat 26 September
2026, Europe/Rome. User id `andrea`.

## What it covers (13 sessions, 19 questions)
- **People only mentioned** → contacts with a relation: sister Giulia, cousin Marco (p01), girlfriend Sara (p07).
- **Identified participants** (`participants: [{name, identity}]`: the client declares who they are) → the same contacts
  of the memory: Giulia and mother Rosa in the family group (p02), Marco Bellini in the office group (p09), Giulia alone
  with the agent (p10). Since the owner's decision of 2026-10-09 Giulia's identity no longer binds to the Giulia known
  only by name (p01): it is a new contact with a "same person?" clarification (asked at p02's ingest, shown in p02's own
  OPEN QUESTIONS); only an answer from a window merges the two. Nothing in the set states it outright (Rosa's "Brava amore
  mio", "Ci sono mamma" only suggest it): a02 / a15 ("la sorella") now depend on the model answering it, a13 / a14
  (Giulia's own items, all from her identity) do not; Marco Bellini (p09) still binds (full name, p03).
- **Two Marcos**: the cousin (p01) and the colleague Marco Bellini (p03, full name); an ambiguous "Marco" (p06) →
  `undecided` + a clarification, answered by a later session (p08, "mio cugino Marco, quello dell'incidente").
- **The assistant's actions** in the first person (p04: booking, calendar), a plan confirmed later (p07).
- **External content**: a web search result linked to a plan (p05) vs trivia (Canberra, not stored).
- **Others' claims about me**: a rumour from Rosa (p02), Luca known only by name about a Tesla (p11, denied).
- **English** session (p13).
- **Questions by an identified speaker** (`asker`): Giulia asks about herself (a13, a14) — "I" in the question is Giulia;
  a premise trap for the undeclared speaker (a15: Andrea does not go to the concert).

## Format
As the other sets (`conversations.json`, `questions.json`), plus two optional fields read by `systems/service_sys.py`:
session `participants` (identified people; others in group chats stay known by display name only) and question `asker`
(the question is ingested as that person's turn in a conversation of its own, and the recall runs there).
