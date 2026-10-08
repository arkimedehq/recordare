# Blind set 8 — gold self-audit

Self-audit by the author (no second reader yet). Blindness kept: nothing read under `service/`, `results/`,
`RESULTS.md`, `systems/`, logs, `dataset_dev_entity/` or other datasets' sessions/questions/gold; only the
format files listed in the README.

## Method
1. `build.py` regenerates the three JSON files from the `.py` sources; `check.py` passes (offsets, weekday
   mentions, entity shape, speakers, evidence before `asked_at`).
2. For every question: re-read only the sessions with `ts < asked_at`; checked that the key answer follows
   from them alone, that no `must_not` forbids a true statement, and that no unidentified fact can be
   pinned on a person from the text (removed one hint: in s14 the speaker originally said they were missing
   the train, which pointed at the commuter Tommaso; now just "sono in ritardo").

## Per question
- e01 (10 Oct): s01 Paolo's dentist 6 Oct; s07 moved to 13 Oct; s04 Silvia books Irene's orthodontist 12 Oct. Silvia has no dentist. ✓
- e02: only s07 is a purchase by Paolo (drill, "ieri" = 5 Oct); bike = Tommaso, shoes = Silvia, knee pads = Irene, air fryer = unidentified. ✓
- e03: only Tommaso says he is vegetarian (s03); nobody else states a diet of that kind. ✓
- e04: s02 speaker never identifies ("che importa"). ✓
- e05: s10 speaker never identifies ("Lascia stare"). ✓
- e06: booking in s10 (unidentified); s18 Paolo only reports the service done. ✓
- e07: s12 unidentified ("dopo"), the morning after Paolo's s11; no identification later. ✓
- e08: s14 unidentified, after s13 (Aoife, Tommaso); no hint left. ✓
- e09: s19 unidentified ("lo dico io agli altri"), after s18 (Paolo). ✓
- e10: s08 Latin 8 said by Irene before the hand-over. ✓
- e11: s08 coriander said by Franca after the hand-over; Irene's dislikes (s05) are mushrooms. ✓
- e12: s01 half marathon said by Silvia after Paolo passed the device; switch in s09. ✓
- e13: s13 Aoife states tree-nut allergy before the hand-over; Tommaso changes the wifi after it. ✓
- e14: s07 Mosaico-2033!, s13 PinetaBlu-77, no later change. ✓
- e15: s04 120 EUR on Sat 1 Oct, s09 corrected to 135 EUR. ✓
- e16: s10 booking Mon 24 Oct, s18 done, 210 EUR with winter tyres. ✓
- e17: s13 band cancelled the tour, refund. ✓
- e18: s15 lunch of Thu 20 Oct cancelled (flu), no new date. ✓
- e19: s11 provisional crown, definitive on 3 Nov; s20 Silvia: done "ieri" (4 Nov → 3 Nov). ✓
- e20: s15 Franca: last Friday (14 Oct), Paolo drove, new lenses, check in a year. ✓
- e21: s05 Irene allergic; s06 Franca says Tommaso; s09 Silvia corrects. ✓
- e22: s03 350 → s17 320. ✓
- e23: s01 half marathon → s09 10 km, same Sun 13 Nov; s20 confirms 10 km. ✓
- e24 (12 Oct 21:00): s07 is the last word; s11 (13 Oct) not visible. ✓
- e25 (20 Oct 09:00): s09 and s13 say until 30 Oct; the change (s17, 25 Oct) is not visible. ✓
- e26: on 10 Oct the password set on 6 Oct (s07) was in force; changed on 16 Oct. ✓
- e27: s17 flight moved to Fri 28 Oct; s18 Paolo took her to Bologna that Friday. ✓
- e28: no dentist for Silvia anywhere. ✓
- e29: the Cesenatico tournament is Irene's (s05, s16); Tommaso plays no tournament. ✓
- e30: only the Latin grade is recorded (s08). ✓
- e31: number plate never said. ✓

## Known limits
- Self-audit only; a second-reader audit is recommended before the first run.
- Small set (31 questions); premise-trap and negative have 2 questions each.

## Second reader (2026-10-08)
Independent audit of all 31 questions against the sessions only (read only files in this directory; no LLM or
paid API called). Every key answer re-derived from the sessions with `ts < asked_at`; weekdays, relative
expressions ("ieri", "venerdì", "sabato") and DST offsets re-checked; each unidentified / carry-over session
re-read for clues that would let a reader pin the speaker by elimination.

Changes:
1. **s01 (affects e09, carry-over)**: removed Paolo's "ci lavoro da vent'anni" (and "20 years" from g-e01). With
   only Paolo and Silvia having a job in the sessions (Tommaso student, Irene 15, Franca 79), a 20-year tenure
   made a fixed-term → permanent contract implausible for Paolo and pointed at Silvia by elimination; the s19
   speaker must stay undecidable. Now Paolo and Silvia are equally plausible, which keeps the carry-over trap.
2. **s13 (affects e17)**: on Sun 16 Oct Tommaso said the concert "di sabato" *salta* and "sabato sono a casa",
   but the concert was Sat 15 Oct, the day before. Rephrased in the past ("Il concerto di ieri … è saltato …
   ieri sono rimasto a casa"); the assistant turn now says "di ieri, sabato 15 ottobre". Gold and expected
   answer unchanged.
3. **s20**: on Fri 4 Nov, "ricordami sabato sera" naturally means Sat 5 Nov while the assistant read Sat 12 Nov;
   made explicit ("la sera prima della gara, sabato 12"). Not used by any question; consistency only.

Checked and left as is: remaining unidentified sessions (s02 fine — a driver, still several candidates; s10; s12
— "mia sorella" excludes nobody uniquely; s14 — Italian speaker, still several candidates) give no identifying
clue. `build.py` + `check.py`: OK.
