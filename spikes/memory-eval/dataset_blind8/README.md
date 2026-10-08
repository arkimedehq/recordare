# Blind dataset 8 — entity memory (Bellandi household, Ravenna, 2033)

Blind evaluation set for the **entity memory** (D48): one shared kitchen voice assistant that the whole
household talks to. The memory belongs to the entity (`casa_bellandi`); every fact and episode must be
attributed to the right person, and what is said by someone who never identifies must stay unattributed.
Fictional content only. Written without reading the service code, `RESULTS.md`, `systems/`, logs, results,
other datasets' sessions/questions/gold, or `dataset_dev_entity/` (format taken only from `dataset_blind6`'s
README, `build.py`, `check.py`, the code structure of `_sessions.py`, and `evalkit/common.py`).

## Household
Via dei Mosaici 12, Ravenna (two floors, garage); one shared car, a grey 2027 Skoda Octavia station wagon;
wifi network CasaBellandi. People: **Paolo Bellandi** (52, shift supervisor in port logistics), his wife
**Silvia** (pharmacist, runner), **Tommaso** (20, engineering student in Bologna), **Irene** (15, liceo,
volleyball), grandmother **Franca** (79, Paolo's mother). Guest: **Aoife** (daughter of Silvia's cousin, from
Cork, speaks English), 16–28 Oct. Mentioned only: Davide (Tommaso's friend), Lucia (Franca's friend),
dott. Gualtieri (dentist), dott.ssa Pasini (orthodontist), officina Casadei.
Period: Mon 26 Sep – Fri 4 Nov 2033, Europe/Rome (DST ends Sun 30 Oct 2033: `+02:00` up to s17, `+01:00`
from s18). Entity id `casa_bellandi`.

## Format
`conversations.json` = `{"_note", "users": {"casa_bellandi": …}, "entities": ["casa_bellandi"], "sessions"}`;
every session has `"user": "casa_bellandi"` and only `role: user | assistant` messages. Each session is a
separate conversation that starts with nobody identified; people identify themselves in the text ("sono
Paolo", "I'm Aoife") or never do. `questions.json` / `gold.json` carry `"user": "casa_bellandi"`.

## Counts
- `conversations.json`: 20 sessions — 11 with one identified speaker, **4 hand-overs** (s01 Paolo→Silvia,
  s08 Irene→Franca, s13 Aoife→Tommaso, s17 Tommaso→Aoife), **5 fully unidentified** (s02, s10, s12, s14,
  s19; the assistant asks who is speaking and gets no name). English: Aoife's parts of s13 and s17.
- `questions.json`: 31 questions (`e01`–`e31`): e01 asked Mon 10 Oct, e24 Wed 12 Oct, e25 Thu 20 Oct, all
  others Mon 7 Nov 2033. One question in English (e13).

| category | n | what it tests |
|---|---|---|
| attribution | 3 | whose appointment (dentist vs orthodontist), whose purchase (several purchases in the house), whose diet |
| unidentified | 3 | parking fine, air fryer, car-service booking said by someone who never identified → "not known who" |
| carry-over | 3 | unidentified speaker in the conversation right after an identified one (gym after Paolo, lost keys after Tommaso/Aoife, permanent contract after Paolo) → must not inherit the identity |
| hand-over | 4 | facts said before vs after the device is passed on (Latin grade / coriander, half marathon, tree-nut allergy vs wifi change) |
| place | 3 | facts about the home and the shared car (wifi now, boiler service, car service) |
| plan | 4 | per-person plans and their fate: cancelled (concert, lunch), moved then done (dentist), done (eye check) |
| correction | 3 | one person correcting another (kiwi allergy: Franca → Silvia), self-corrections (bike price, race distance) |
| state-now | 4 | as-of answers at mid-period dates (dentist on 12 Oct, Aoife's stay on 20 Oct, wifi on 10 Oct) and now (Aoife left) |
| premise-trap | 2 | question puts a fact on the wrong person (Silvia's dentist, Tommaso's tournament) |
| negative | 2 | never recorded (maths grade, number plate) |

## Patterns covered (session ids)
- a) similar facts across people: appointments (Paolo dentist s01/s07/s11/s20, Irene orthodontist s04/s11,
  Franca eye check s06/s15); purchases (bike s03, running shoes s04, drill s07, knee pads s08, air fryer s10);
  food (Tommaso vegetarian s03, Irene kiwi/mushrooms s05, Franca orzo/coriander s06/s08, Aoife tree nuts s13).
- b) unidentified speakers: s02, s10, s12, s14, s19; each right after an identified conversation for the
  carry-over traps (s11→s12, s13→s14, s18→s19).
- c) hand-overs: s01, s08, s13, s17.
- d) place / entity facts: wifi (s07 Paolo, s13 Tommaso), boiler (s04, corrected s09), car (s01, fine s02,
  booking s10, service done s18).
- e) plan fates: dentist moved + done (s01→s07→s11→s20), orthodontist done (s04→s11), concert cancelled
  (s03→s13), lunch cancelled (s08→s15), eye check done (s06→s15), tournament done (s05→s16), exam done
  (s03→s17), Aoife's stay shortened (s09→s17→s18), Silvia's race changed and still ahead (s01→s09→s20).
- f) corrections: of another person (s06 Franca's kiwi claim → s09 Silvia), own (s04→s09 boiler cost, s03→s17
  bike price, s01→s09 race distance).
- g) reports about others: Paolo on Irene's orthodontist (s11), Silvia on Paolo's crown (s20), Paolo on the car
  and on Aoife's departure (s18).

## Gold (`gold.json`)
22 episodes, each with `speaker` (None for the 5 unidentified sessions) and `people` (`place` marks a fact
about the home or car); 10 facts with history (wifi password, race, dentist, Aoife's stay, bike price, …);
7 notes; `not_memories` with the superseded values and the attribution / carry-over / hand-over guards.
Self-audit: `GOLD_AUDIT.md`.

## Files and checks
`_sessions.py` (with a `speakers` list per session, not written to the JSON), `_questions.py` (with `ev`
evidence sessions), `_gold.py` → `build.py` writes the JSON files. `check.py` verifies: exact entity file
shape (keys, entity in `users` and `entities`, every session's `user` is the entity, only user/assistant roles,
questions/gold user); evalkit loaders; ids `s01..`, `e01..` in order; every timestamp's offset equals
Europe/Rome at that local time (DST); every weekday + date mention (IT/EN, also bare "lunedì 24") matches
2033; every named speaker identifies in the text and no unlisted person does; unidentified sessions contain
no self-identification; each question asked after all its evidence; all categories present with ≥ 2
questions; gold sessions and speakers consistent; every unidentified session has an unidentified episode.
No noise file.

```
uv run --directory <abs path to spikes/memory-eval> python dataset_blind8/build.py
uv run --directory <abs path to spikes/memory-eval> python dataset_blind8/check.py
```

## Notes for graders
- The questions are asked to the household assistant by an unspecified member; "mio/tuo" is avoided.
- For unidentified and carry-over questions the key answer is "not known who"; naming any person (even with
  "probably") fails. The assistant turns never name an unidentified speaker.
- The assistant acknowledges what it hears, so some answers can also be found in assistant turns; in s06 it
  explicitly does not adopt Franca's kiwi claim.
- `expected` follows blind6's convention: text before «(Dettagli secondari, non richiesti: …)» is the key answer.
