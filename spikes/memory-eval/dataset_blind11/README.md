# Blind set #11 — entity memory: a neighbourhood bike repair shop

## Setting
**Ciclofficina Raggio**, a fictional neighbourhood bike repair shop in via Santa Croce 41, Trento (real town, fictional
business and people). A tablet assistant sits on the counter; the memory belongs to the shop (entity
`ciclofficina_raggio`, "Ciclofficina Raggio"). It talks to the owner **Ettore Zanella**, the mechanic **Giada
Pedrotti** and the customers: **Marco Tomasi** (road bike, then a mountain bike) and **Marco Dallapiccola** (cargo bike)
— two Marcos —, **Rhys Morgan** (Welsh postdoc, English), **Katharina Moser** (new in town, German), **Bruna Ioriatti**
(Volta M3 e-bike), and several people who never say who they are. Ettore hands the agent the shop's price list and
opening hours as its own content and later changes both (new prices from 1 November, winter hours from 2 November). The
agent books repairs, sets and cancels reminders, relays messages, collects sign-ups for a group ride (moved, then done)
and a kids' course (cancelled), and learns three texts: an e-bike motor service manual (from Giada), a cargo-bike bonus
page (from Ettore) and a supplier's catalogue (from Ettore, later forgotten at his request).

Period: Monday 4 October – Monday 8 November 2032, Europe/Rome (+02:00 until Saturday 30 October, +01:00 from Sunday
31 October, when DST ends).

## Blindness
Written blind for WORK_PLAN 8.11: the writer did not read anything under `service/`, `packages/`, `connectors/`, `docs/`,
`spikes/memory-eval/systems/`, `RESULTS.md`, other sets' `GOLD_AUDIT.md`, `results/`, any `*.log`, nor any other
dataset's content (dev and blind sets, in particular not `dataset_blind10/` nor `dataset_blind8/` sessions or
questions). Read: `DATASET_FORMAT.md`, `evalkit/common.py` (loaders) and only the code structure of `dataset_blind6/`
and `dataset_blind8/` `build.py` / `check.py` / `_*.py` (format and tooling), plus the gold field names
`extraction_eval.py` reads. No people, places, stories or questions are reused; no corpus was copied from elsewhere.
Keep it blind: do not tune prompts on it.

## Files
- `_sessions.py` — 28 conversations (`SESSIONS`, with `speakers` and `lang` used only by the tooling) and the learned
  sources (`SOURCES`: 3 `source`, 1 `forget_source`).
- `_questions.py` — 40 questions (`ev` = evidence entries, `lang`; both used only by the tooling).
- `_gold.py` — what the memory should hold: `EPISODES` (with `speaker`, `people`, `kind`, `date`, `plan_outcome`),
  `FACTS` (value history), `NOTES`, `NOT_MEMORIES` (claims superseded or wrongly attributable).
- `build.py` → `conversations.json`, `questions.json`, `gold.json`.
- `check.py` — shape, evalkit loaders, ids, Europe/Rome offsets (DST), weekday + date mentions (Italian, English,
  German), messages one second apart with entries never overlapping, `own` flags, sources (handed over after their
  conversation, `provided_by` speaks there) and forgets (after their source), self-identification of every named
  speaker (and no stray one), every question asked after all its evidence, gold references. Runs with plain `python3`
  (stubs `openai` / `dotenv` when absent) or in the spike's venv.

Run: `python3 build.py && python3 check.py`.

## Format
As `DATASET_FORMAT.md`: entity memory (`entities: ["ciclofficina_raggio"]`), everyone speaks as `role: "user"`, people
identify only in the text ("sono Giada", "I'm Rhys", "Ich bin Katharina") or never; `own: true` on the four messages
with the shop's price list, hours, price update and winter hours; `type: "source"` / `"forget_source"` entries in time
order with the conversations. Questions have no `asker` (someone unidentified at the counter).

## Counts
- Conversations: 28 (Italian 23, English 3, German 2); 5 with an unidentified speaker, 2 of them hand-overs from a named
  speaker (Giada → a customer, Ettore → a customer); 1 with a "Marco" who never gives his surname.
- Sources: 3 learned (manual, bonus page, supplier catalogue) + 1 forgotten (the catalogue, on 25 October).
- Questions: 40 (Italian 35, English 4, German 1).
- Gold: 25 episodes, 6 facts, 8 notes, 7 not-memories.

## Categories — what each tests
| Category | n | What it tests |
|---|---|---|
| own-content | 3 | the shop's own price list / hours as now (after the November update), and a price never given |
| state-as-of | 3 | the value at an earlier date vs now (price mid-October, hours on 30 October before winter hours, the ride date before it was moved) |
| plan | 4 | a plan moved then done (group ride), cancelled (kids' course), ahead (inventory closure, cargo delivery) |
| own-action | 6 | the agent's bookings (agenda ahead), a reminder set then cancelled by someone else, a booking cancelled, a booking moved and done, relayed messages |
| attribution | 3 | who did / said / joined what (who repaired the e-bike, a price only reported second-hand, the final ride list and who withdrew) |
| source | 5 | content of learned texts, who gave each one, a fact asked before the source was forgotten, and after (not known any more) |
| unidentified | 2 | statements by people who never identified stay unattributed |
| carry-over | 2 | an unidentified conversation right after a named customer's must not be attributed to that customer |
| hand-over | 3 | a named speaker passes the tablet mid-conversation: what follows belongs to the unnamed person |
| same-name | 2 | two Marcos kept apart; a "Marco" without surname is attributable to neither |
| correction | 2 | correction by another person (a bill), self-correction plus a corrected agent recall (an appointment time) |
| premise-trap | 3 | questions with a false premise (wrong owner of a bike, an e-bike that does not exist, a withdrawal by the wrong person) |
| negative | 2 | never said / never recorded |

## Patterns covered
Own content updated twice (prices, hours) with effective dates; a self-correction inside own content (Saturday closing);
DST change inside the period; a reminder set by one person and cancelled by another; a booking moved, one cancelled,
one ahead; relayed messages in both directions; a group ride moved and done; a course cancelled; carry-over traps after
two different named customers; hand-overs to unnamed customers; an unnamed customer paying and booking for a relative;
two people with the same first name plus an ambiguous one; a price reported second-hand (Rhys quoting Ettore); a source
forgotten after a question was asked of it; mixed-language conversations (the agent answers in the speaker's language).
