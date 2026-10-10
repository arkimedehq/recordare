# Blind dataset 10 — entity memory with own content and learned sources (Camping Il Ginepro, 2034)

Blind evaluation set for the **entity memory** of a small business: the reception assistant of a family-run
campsite on Lake Trasimeno that the family, the staff and the guests all talk to. The memory belongs to the entity
(`camping_il_ginepro`): the assistant remembers in the first person what it did ("I booked B4 for the Brandts")
and what it was handed to keep as its own (price list, hours, rules, check-in procedure — `own: true` messages),
learns texts (`type: "source"` entries), and must attribute every statement to the right person — or to nobody
when the speaker never identified. Fictional people, business, rules and documents; the town is real, nothing
else is.

## Blindness
Written without reading the service code (`service/`, `packages/`, `connectors/`), the harness (`systems/`),
`RESULTS.md`, any `results/` or log, `docs/`, or any other dataset's content (dev sets included). Read only:
`DATASET_FORMAT.md` (the format spec), `evalkit/common.py` (loaders), `dataset_blind6/` and `dataset_blind8/`
`build.py` / `check.py` / `README.md` and the code structure of their `_sessions.py` / `_questions.py` /
`_gold.py` (format and tooling only — no people, places, stories or questions reused), and the gold field names
`extraction_eval.py` reads (`episodes`, `facts`, `notes`). No LLM was used to write it.

## Setting
**Camping Il Ginepro**, Castiglione del Lago (Umbria): 40 pitches (1–3 seasonal), bungalows B1–B3 (2 places) and
B4–B6 (4 places), bar with tobacconist, pool, lake beach; season opens Good Friday 7 April 2034. Family: **Ottavio
Rondelli** (owner), **Benedetta** (wife, bookings and accounts), **Chiara** (daughter, bar and check-in), **Nico**
(son-in-law, maintenance); Samira (seasonal cleaner, mentioned only). Guests and contacts: **Marta Venturi**
(regular, caravan on seasonal pitch 3) and **Marta Olivetti** (Arezzo, bungalow B2) — the same-name pair; the
**Brandt** family from Freiburg (Katrin, Jonas, son Till with a nut allergy; German); **Fiona and Rob Hadley**
from Leeds (campervan, dog Pip, Rob coeliac; English); **Priya Shah** (cyclist, vegan; English); **Wouter de
Vries** (Utrecht, cyclist; English). Three unidentified speakers (Easter enquiry with the dog Birillo, the
padlocked gate, the cold showers).
Period: Mon 13 Mar – Tue 18 Apr 2034 (questions up to Sun 23 Apr), Europe/Rome; DST starts Sun 26 Mar 2034:
`+01:00` up to s08, `+02:00` from s09 (which is at 10:00 on the transition day).

## Format
`conversations.json` = `{"_note", "users": {"camping_il_ginepro": …}, "genders": {"camping_il_ginepro":
"masculine"}, "entities": ["camping_il_ginepro"], "sessions"}`; `sessions` holds 23 conversations (`s01`–`s23`)
and 4 learned sources (`type: "source"`, ids `k-…`) in `ts` order. Messages are `role: user | assistant`, plus
`own: true` on the 5 user messages that hand the assistant its own content (hours and quiet rule s01, price list
s02, check-in procedure s11, updated price list s15, gate rule and new reception hours s23). Sources: `k-caldaia`
(water-heater manual, `provided_by` Nico, `conversation` s03), `k-pane` (bread supply contract, Benedetta, s07),
`k-lago` (lake rules, no `provided_by` = learned by the memory itself), `k-piscina` (pool self-control sheet,
Ottavio, no conversation). `questions.json` / `gold.json` carry `"user": "camping_il_ginepro"`. No `asker`
field: every question comes from someone unidentified; "tu" / "you" is the assistant.

## Counts
- 23 conversations: 15 Italian, 5 English (s06, s16, s19, s21, s22), 2 German (s10, s17) — plus s19's
  unidentified English guest; **3 hand-overs** (s10 Katrin→Jonas, s13 Nico→Ottavio, s22 Fiona→Rob), **3 fully
  unidentified** (s04, s12, s19), each right after an identified conversation (carry-over traps s03→s04,
  s11→s12, s18→s19).
- 4 learned sources; no forget.
- 35 questions (`q01`–`q35`): 29 Italian, 4 English (q12, q14, q19, q30), 2 German (q09, q33). Asked: q02 Thu 30
  Mar, q29 Wed 5 Apr, q31 Tue 11 Apr, all others Sun 23 Apr 2034 20:00.

| category | n | what it tests |
|---|---|---|
| own-content | 3 | reception hours now (changed 18 Apr), dog price as of 30 Mar (old list), 4-place bungalow price now vs the replaced list |
| agent-action | 3 | what the assistant did for the Brandts (booking, deposit, allergy note, parking, late arrival), the B6 block it set and later undone, the messages it relayed to Nico and their fate |
| attribution | 3 | whose dietary need (four people), whose deposit (two of six parties), the Brandts' bungalow and balance (German; 410 €, not 435) |
| unidentified | 5 | Birillo enquiry, padlocked gate / mower, cold showers (English) → "not known who", each a carry-over trap; two hand-overs: who said what in the Brandt call, who asked about gluten-free bread (Rob, not Fiona) |
| same-name | 2 | Marta Olivetti's nights and total vs Marta Venturi's instalments — facts must not merge |
| knowledge | 4 | heater error codes E3/E5, bakery delivery days / time / order deadline, dogs on the lake beach (English), pool chlorine / pH / check frequency |
| knowledge-provenance | 2 | who gave the heater manual and when (Nico, 16 Mar); who gave the lake rules (nobody — learned by itself, 4 Apr) |
| plan | 3 | pool fence (moved then done), opening aperitivo (cancelled), Wouter's booking (ahead) |
| correction | 3 | Ottavio correcting Nico (anode B3 not B4), Chiara correcting the assistant's recall (Olivetti until 11 not 10), Marta Venturi's self-correction (450 not 400) |
| state-now | 3 | Hadleys' arrival as of 5 Apr (Fri 14) vs at the end (Sat 15, 3 nights, 108 € cash; English), who is in the bungalows as of 11 Apr |
| premise-trap | 2 | the Hadleys' deposit (none), bikes rented by the Brandts (German; no rental) |
| negative | 2 | bakery phone number (not in the contract), water pressure on pitch 3 (no outcome) |

## Patterns covered (entry ids)
- Own content and its changes: hours + quiet rule s01 → reception 16–20 and gate rule s23; price list s02 →
  updated list s15 (dog 3→4, adult high 10→11, 4-place bungalow high 110→115; the Brandts keep 110); check-in
  procedure s11.
- Agent actions in the first person: bookings (Brandt s02, Hadley s06, Olivetti s09, Priya s16, Wouter s21),
  reminders (GPL s01→s05, grill s18, settle-up s22), relayed messages (to Chiara s05→s11; to Nico s08→s13/s14,
  s14), settings (B6 blocked s02, unblocked s15 — the undone action; late arrival + key box s10→s17).
- Attribution across people: deposits (Brandt 150 transfer, Olivetti 100 card, none for pitches; Venturi's
  450 is an instalment), dietary needs (Till, Rob, Olivetti, Priya), bungalows / pitches, balances (410, 161,
  108, 31).
- Unidentified: s04, s12, s19 (the assistant asks who is speaking and gets no name; its turns never name anyone).
- Hand-overs: s10 (German), s13 (with a correction of the first speaker), s22 (English).
- Same name: s11 and s20 ("Quale Marta?"), s08/s14 vs s09/s18/s20.
- Learned sources: k-caldaia used in s17 (E5), k-pane in s18 (missing cornetti) and s22 (gluten-free), k-lago in
  s16 (swimming), s21 (fishing), s22 (dogs); k-piscina referenced in s23 (ASL inspection).
- Plan fates: done (GPL s01→s05→s07, technician s05→s07→s11, Samira s05→s15, Venturi arrival s08→s14, Brandt stay
  s02→s17→s20, Olivetti s09→s20, Priya s16→s18, Hadleys s06→s22→s23), moved then done (fence s03→s13→s23;
  Hadleys 14→15 Apr s20), cancelled (aperitivo s11→s18), ahead / no outcome (Wouter s21, ASL inspection s23,
  water pressure s14).
- Corrections: of another person (s13), of the assistant (s18), of oneself (s14).
- Reports about others: Benedetta on the technician, GPL, check-outs and Fiona's email (s07, s20); Ottavio on
  Nico's fence and the Hadleys' payment (s23); Chiara on the first weekend (s18).

## Gold (`gold.json`)
33 episodes, each with `speaker` (None for the 3 unidentified sessions) and `people` (`self` marks content that
belongs to the campsite itself: own lists, rules, procedures, the assistant's actions); 18 facts with history
(price-list items, reception hours, B6 availability, the three changed bookings, the 400→450 instalment, the
B4→B3 anode, the fence deadline); 8 notes; `sources` (provenance of the four learned texts: `provided_by`,
`conversation`, `learned`, key points); `not_memories` with the superseded values and the attribution /
carry-over / hand-over / same-name guards.

## Files and checks
`_sessions.py` (`SESSIONS` with a `speakers` list per session — not written to the JSON — and `SOURCES`),
`_questions.py` (with `ev` evidence entries, sessions or sources), `_gold.py` → `build.py` writes the JSON files.
`check.py` verifies: exact file shape (keys; entity in `users`, `genders` and `entities`; every entry's `user` is
the entity; only user/assistant roles, `own: true` only on user messages, at least 3 of them; source keys and
kinds, `provided_by` a known person, at least one source with `provided_by` and one with `conversation`;
questions/gold user); entries written in `ts` order; evalkit loaders; ids `s01..`, `q01..` in order, `k-` sources;
every timestamp's offset equals Europe/Rome at that local time (DST); every weekday + date mention (IT / EN / DE,
also bare "lunedì 10" and ranges "da venerdì 7 a mercoledì 12 aprile") matches 2034; every named speaker
identifies in the text (IT "sono", EN "I'm / it's", DE "hier ist / ich bin / … hier") and no unlisted or
mentioned-only person does; unidentified sessions are pure and the assistant names nobody in them; hand-overs
have two different people; each source with a `conversation` comes after that session's last message; each
question asked after all its evidence, non-empty `must_not`; all categories present with their minimum counts;
gold keys, kinds, dates, speakers, people and sessions consistent; every unidentified session has an unidentified
episode; gold `sources` match the dataset's provenance. No noise file.

```
uv run --directory <abs path to spikes/memory-eval> python dataset_blind10/build.py
uv run --directory <abs path to spikes/memory-eval> python dataset_blind10/check.py
```

## Notes for graders
- For the unidentified and carry-over questions the key answer is "not known who"; naming any person (even
  "probably") fails. The assistant's turns in s04, s12, s19 name nobody.
- Amounts follow the price lists: the Brandts' 410 € uses the held price of 110 (Benedetta, s15), not the new
  115; the Hadleys' 108 € and Priya's 31 € use the updated list (dog 4, adult high 11); Wouter's 46 € the low
  season.
- `expected` follows the blind6/8 convention: text before «(Dettagli secondari, non richiesti: …)» is the key
  answer.
- q31 (as of 11 Apr, 20:00) expects Marta Olivetti's stay to have ended that day with the check-out not yet
  reported (Benedetta reports it on 12 Apr): an answer saying she checked out on 11 Apr is also acceptable.
