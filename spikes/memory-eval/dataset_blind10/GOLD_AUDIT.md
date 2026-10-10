# Gold audit — blind set 10 (Camping Il Ginepro, entity memory)

Independent audit of `dataset_blind10/` (written by another agent). Audit date: 2026-10-10.

## Method
- Read only `DATASET_FORMAT.md` and the files in `dataset_blind10/` (`README.md`, `_sessions.py`, `_questions.py`,
  `_gold.py`, `build.py`, `check.py`). No service, harness, results, docs or other dataset was opened.
- For each question: replayed the history up to `asked_at`, checking corrections, cancellations, the price-list
  replacement (given 3 Apr, valid from 7 Apr) and as-of values; recomputed every amount; checked every weekday
  against 2034 (Good Friday 7 Apr, Easter Monday 10 Apr; DST from Sun 26 Mar, `+02:00` from s09).
- Checked ambiguity (a second reasonable answer the judge would fail), `must_not` truth as of `asked_at`, speaker
  identification and hand-overs, and that knowledge questions need the source text rather than chat.
- Amounts recomputed: s04 19+2×10+6+3 = 48 €/night; s06 14+2×8+3 = 33 €/night (old list, low season); Brandt
  5×110+10−150 = 410 € (total 560 €); Olivetti 3×85+6−100 = 161 € (total 261 €); Priya 19+11+1 = 31 €; Hadleys
  3×(14+16+4)+6 = 108 €; Wouter 2×(14+8)+2 = 46 €; Venturi 1,800−450 = 1,350 € remaining. All correct.
- Price-list window 3–7 Apr: the new list replaces the old one "dall'apertura di venerdì 7 aprile", so it governs
  stays from 7 Apr; quotes made 3–6 Apr for stays after 7 Apr (Priya, s16) correctly use it. No question asks a
  price inside that window (q02 is as of 30 Mar, q03 as of 23 Apr).
- Re-ran `build.py` and `check.py` after the fixes: OK.

## Per question

| id | verdict | note |
|---|---|---|
| q01 | OK | 8–13 / 16–20 from 18 Apr; old 15–20 correctly in the past. |
| q02 | OK | As of 30 Mar only the 14 Mar list exists: dog 3 €. |
| q03 | OK | 115 now, 110 before; Brandt exception in details. |
| q04 | fixed | Content right; added the key-box code received on arrival day to the secondary details. |
| q05 | OK | Unblocked 3 Apr (the block would have expired 15 Apr anyway; the question tests the undone action). |
| q06 | fixed | In s19 the assistant promised to report cold water in block B to maintenance (= Nico): a third reasonable item; now accepted, still "not known who". |
| q07 | OK | Four people, sources of each statement correct. |
| q08 | fixed | Added that the Hadleys' 10 € gate-card deposit (s22 "deposit") is a cauzione, not a caparra. |
| q09 | OK | B4, 410 € by card; 560 € total; must_not 435 / 575 are the 115-based traps. |
| q10 | OK | s04 unidentified; assistant names nobody. |
| q11 | fixed | Expected asserted the mower went to the mechanic; only announced as a plan — reworded. |
| q12 | OK | Easter Monday = Mon 10 Apr 2034; s19 unidentified. |
| q13 | OK | Katrin → Jonas hand-over matches the text. |
| q14 | OK | Rob asked (and set the reminder); Fiona only announced arrival. |
| q15 | fixed | The extra night was relayed by Chiara on 29 Mar (Marta called earlier, date unknown) — wording made precise. |
| q16 | OK | 450 paid, 1,350 remaining in two instalments (amounts not stated). |
| q17 | fixed (session) | s17 quoted the E3 procedure from the manual; removed that sentence so E3 is answerable only from `k-caldaia` (E5 stays in s17, as the README describes). |
| q18 | OK | Source-only; Easter Monday exception correct. |
| q19 | fixed (session) | s22 repeated the whole dog rule (Spiaggia dei Platani, north end, muzzle); shortened so "where exactly" needs `k-lago`. |
| q20 | OK | Source-only. |
| q21 | OK | Nico, Thu 16 Mar, s03. |
| q22 | fixed | Made robust: correct = no person recorded as giver + 4 Apr; "nobody", "learned by myself" or "not recorded who" all accepted. |
| q23 | OK | Moved then done 4 Apr (reported 18 Apr). |
| q24 | OK | Cancelled, not rescheduled. |
| q25 | OK | Still ahead as of 23 Apr. |
| q26 | OK | B3 (other-person correction). |
| q27 | OK (session fix) | Chiara's "mercoledì scorso" (said on Sat 8 Apr, most naturally = Wed 5 Apr) changed to "mercoledì 29 marzo", matching s11 and the expected. |
| q28 | OK | Self-correction 400 → 450. |
| q29 | OK | As of 5 Apr: Fri 14–Tue 18, 4 nights. |
| q30 | OK | Sat 15–Tue 18, 3 nights, 108 € cash. |
| q31 | fixed | As of 11 Apr 20:00: expected now accepts both "today is her last day / check-out not yet reported" and "she left today". |
| q32 | fixed | Gate-card cauzione noted as acceptable; must_not narrowed to "caparra per la prenotazione". |
| q33 | OK | No bike rental; Jonas only asked. |
| q34 | OK | Contract has no phone number. |
| q35 | OK | No outcome recorded. |

## Gold notes
- Episodes, speakers and `people` match the sessions; the three unidentified sessions have `speaker: None`
  episodes; source provenance matches the entries.
- `g-e31`: the dog-beach detail updated to the shortened s22 text.
- `g-e27` (cornetti): Chiara reports the missing cornetti at 11:00, while the contract credits items reported by
  10:00; the assistant (and the gold) still note a credit. Not a question target; left as is (possibly reported to
  the bakery earlier by Chiara), but an extraction that records "not creditable, reported late" should not be
  penalised.
- `g-e17` / not_memories: the assistant's wrong recall in s18 (Olivetti to Mon 10) is correctly excluded and
  corrected the same session.
- Facts' price-list history uses valid time (old list to 7 Apr, new from 7 Apr) although the update was given on
  3 Apr — consistent with the list's text.

## Fixes (before → after)
1. `_sessions.py` s18: "te l'ho detto io mercoledì scorso" → "te l'ho detto io mercoledì 29 marzo".
2. `_sessions.py` s17: removed "Nur bei E3 müsste man RESET fünf Sekunden gedrückt halten." (q17 leak).
3. `_sessions.py` s22: dog rule with Spiaggia dei Platani / north end / muzzle → "only on the stretch of beach set
   aside for dogs, on a lead; Pip can't swim where people bathe" (q19 leak); `_gold.py` g-e31 aligned.
4. q04: secondary details + key-box code received on arrival day.
5. q06: accepts the s19 cold-water report to maintenance (unidentified, no outcome).
6. q08: secondary details + the Hadleys' 10 € gate-card cauzione is not a caparra.
7. q11: "il trattorino è andato dal meccanico" → announced plan, no later confirmation.
8. q15: "ne ha aggiunta una il 29 marzo" → "l'aggiunta di una notte me l'ha riferita Chiara il 29 marzo".
9. q22: "Nessuno: … l'ho appreso da solo" → "Nessuna persona risulta avermelo dato … 4 aprile", with accepted
   phrasings listed.
10. q31: Olivetti line accepts both readings explicitly.
11. q32: must_not "hanno versato una caparra" → "… per la prenotazione"; details note the gate-card cauzione.

No question added or removed. README counts and categories still match (35 questions; 33 episodes, 18 facts,
8 notes). `check.py`: OK.

## Remaining caveats for readers of the results
- q04, q06, q07, q08 have long key answers (many items); a partially complete answer may be judged as partially
  wrong depending on the judge's strictness.
- q17: the E5 half is also in the s17 chat (in German); only the E3 half is source-only.
- q16: "how much remains" is computed (1,350 €), never stated; instalment sizes unknown.
- q31: the occupant of B2 on 11 Apr evening is genuinely uncertain in the history; both readings are accepted.
- q11 / q10 / q12: any named person (even hedged) fails by design.
