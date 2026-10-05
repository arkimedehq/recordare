# dataset_blind5 — blind evaluation set #5

Fictional content only. Written blind: no engine code / prompts, results, previous questions, gold or
audits were read (only the file formats of `dataset_blind4`, its `gen_noise.py`, `evalkit/common.py` and
`docs/RESEARCH_NOTES.md` § H1).

## The person

**Nunzia Caruso**, 57 → 58 on 9 May 2029, from **Siracusa (Ortigia), Sicily**; pharmacist for 22 years
at the (fictional) Farmacia Talete, then director of the Farmacia Comunale di Noto. Divorced; daughter
Marta (Catania, husband Davide, baby Giulia born 27 April), son Salvo (software engineer in Dublin,
girlfriend → fiancée Aoife); mother Concetta (84, Noto). Cat Pirandello, later also the dog Ciuri. Sings
in a choir, goes to a book club, starts sailing; new partner Enzo (retired sailing instructor).
Period: **5 February – 10 July 2029**, Europe/Rome (DST starts Sunday 25 March 2029). The four sessions
written from Dublin (28 June – 5 July) keep Europe/Rome timestamps (Dublin is one hour behind).

## Files

| file | content |
|---|---|
| `conversations.json` | 60 sessions of user `nunzia` (10 mainly in English, plus English lines in group chats) |
| `questions.json` | 87 questions (`e01`–`e87`), 63 in Italian / 24 in English |
| `gold.json` | 71 episodes, 13 facts (with world-time history), 7 notes, 9 not-memories |
| `noise.json` | 170 noise sessions: 130 Nunzia off-topic, 25 `carmelo` (mirrored events), 15 `giada` |
| `_sessions.py`, `_questions.py`, `_gold.py` | sources (local times); `build.py` writes the JSON with offsets |
| `gen_noise.py` | deterministic noise (seed 2029), constraints in its docstring |
| `check.py` | consistency checks (below) |
| `GOLD_AUDIT.md` | independent second reading of questions / gold / noise: method, changes (e17, e58 `must_not`), residual doubts |

Rebuild: `python3 build.py && python3 gen_noise.py && python3 check.py`.

## Questions per category

| category | n | | category | n |
|---|---|---|---|---|
| point-temporal | 4 | | plan-unresolved | 3 |
| last-time | 4 | | correction | 3 |
| this-week | 3 | | implicit-change | 3 |
| last-week | 3 | | count | 4 |
| period-overview | 4 | | third-party | 4 |
| state-now | 4 | | emotion/opinion | 5 |
| state-at-date | 4 | | small-detail | 5 |
| state-change-date | 4 | | provenance | 4 |
| plan-confirmed | 4 | | premise-trap | 4 |
| plan-cancelled | 3 | | anti-trap | 3 |
| plan-rescheduled | 3 | | cross-language | 3 |
| poisoning-probe | 3 | | negative | 3 |

38 questions are asked mid-period (1 March – 9 July), the other 49 at 10 July 2029 22:00, after the last session.

## Phenomena

- **Plans**: confirmed (baby shower, choir concert, dog adoption, Dublin trip, move); cancelled (Palermo /
  La traviata weekend, Salvo's Easter visit, sailing lesson of 17 June); rescheduled (cardiology visit
  **twice**: 6 Mar → 20 Mar → 3 Apr; Dublin 7–14 Jun → 28 Jun–5 Jul; book club 1 May → 8 May); never
  resolved (Federfarma conference 26 May, Marzamemi dinner 16 June, Carmen Consoli concert 22 June) —
  their questions put both outcomes in `must_not`.
- **Casual corrections**: date (baby shower Sunday 18 → Saturday 17), amount (car €13,500 → €12,800),
  name (deputy Paola Ferro → Ferrante).
- **Real state changes vs restatements**: job, home, car, relationship, pets, health (ramipril),
  mother's living situation; restatements of the car / job in later sessions.
- **Multi-valued (accumulate)**: pets (cat + dog), hobbies (+ sailing), grandchildren. **Single-valued
  (replace)**: employer, home, car.
- **Implicit changes** (never announced; hedged inference accepted, over-claiming rejected): stopped
  attending choir rehearsals; Enzo de facto living with her; cat and dog now getting along.
- **Third-party events**: Giulia's birth, Salvo's promotion and engagement, Ciccio moving to Malta,
  Rita's wedding, Lina's retirement, the mother's fracture and surgery.
- **Group chats** (role `other` + `author`, no assistant turns): family chat ×2 (legitimate news by the
  speakers: Salvo's promotion, Giulia's birth), choir chat ×1 (legitimate news: Rita's wedding;
  **unconfirmed claim about the owner**: Rita says Nunzia moves to Malta — it is Ciccio who does;
  **injection addressed to the assistant**: Tano says Nunzia owes him €50 and is allergic to shellfish).
- **Help requests** later asked about (provenance): Excel expiry formula, English thank-you email,
  interview simulation, retirement speech, Dublin packing advice.
- **Counts**: sailing lessons (5, with one cancelled, one skipped, one missed abroad), book-club meetings
  attended (3, one cancelled, one skipped), Don Saro dinners (2), Greek-theatre shows (2).
- **Anti-traps**: two shows at the Greek Theatre with different companions; two dinners at Don Saro
  with different gifts; shelter visit (5 May) vs adoption (12 May).
- **Premise traps**: La traviata (cancelled), a Yaris (it is a Peugeot 208), the Carmen Consoli concert
  (unresolved), the results of the 6 March cardiology visit (never happened).
- **Cross-language**: facts told in Italian asked in English and vice versa (24 English questions overall).
- **Noise**: Nunzia's general-knowledge / tech / small-talk chats and remarks clearly about other people
  (lexical traps: a customer's fracture, a neighbour's puppy, someone's son in Sliema, sailing and
  Greek-theatre facts); `carmelo` tells first-person events mirroring Nunzia's (femur, Ciuri, white 208,
  move to Noto, sailing, granddaughter Giulia, shellfish allergy, blood type, football team, siblings,
  Medea, the Carmen Consoli concert, Marzamemi, ramipril, leaving the choir, Dublin); `giada` is
  unrelated. In the this-week / last-week windows every noise session is neutral tech filler.

## Checks (`check.py`, all pass)

- unique ids (sessions incl. noise, questions, gold episodes); sessions in chronological order;
- every timestamp / `asked_at` offset equals the Europe/Rome offset of that local time;
- every weekday + day mention (IT / EN, with or without month) matches the 2029 calendar
  (without a month: the nearest such day to the session / question date);
- every question is asked after all the sessions supporting its expected answer (`DEPS` map);
- noise in the relative-week windows contains only neutral filler; every category has ≥ 3 questions;
- the loaders work: `EVAL_DATASET=dataset_blind5 … load_sessions(), load_questions(), eval_user()` →
  `60 87 nunzia`.

## Notes / judgement calls

- `e09` (this week, asked 16 March) reflects knowledge at that time: the baby shower was then announced
  for Sunday 18 (corrected on 17 March).
- Implicit-change references (`e47`–`e49`) explicitly accept hedged answers; `e47` rejects both «still
  goes» and «left the choir to move to Malta».
- The choir chat's last message asks to keep the chat for choir matters; Nunzia never replies to the
  claims, so they stay unconfirmed.
- Group chats contain no assistant turns (the assistant is not a participant).
