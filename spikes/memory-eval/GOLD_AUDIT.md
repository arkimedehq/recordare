# Gold-answer audit (task M0.5.1, independent second reader)

Scope: `dataset/` (user luca, isolation user elena, 24 questions) and `dataset_holdout/` (user chiara, isolation user davide, 28 questions), their `noise.json` and both `gen_noise.py`. Judging rules read from `evalkit/common.py` (LLM judge: "wrong" if the answer contains any MUST_NOT item; so an LLM-judged negation such as "non sei andata a X" is probably tolerated, but history mentions of a must_not value are a real risk).
All weekdays and relative dates below were computed with python (never by hand). Relative expressions were resolved against the MESSAGE timestamp, weeks are Monday-based. All timestamp offsets in both `conversations.json` files are correct for Europe/Rome (checked around the DST changes of 2026-10-25 and 2026-03-29, and the year boundary).

## 1. Summary

| Dataset | Questions | OK | FIX | AMBIGUOUS | MUST_NOT-TOO-STRICT |
|---|---|---|---|---|---|
| dataset (luca) | 24 | 20 | 0 | 3 (q17, q19, q20) | 1 (q21) |
| dataset_holdout (chiara) | 28 | 17 | 1 (h09) | 1 (h23) | 9 (h04, h05, h07, h08, h10, h14, h15, h18, h20) |

No date-arithmetic error was found in any `expected`. The real defects are: one incomplete `expected` (h09, a second orthopaedist visit is omitted), one duration ambiguity (h23), event-date vs report-date ambiguity in luca's dataset, and a number of `must_not` strings that a correct answer can mention naturally.

## 2. Per-dataset tables

### 2.1 dataset (luca)

Computed weekdays used: 2026-01-12 Mon, 01-17 Sat, 01-27 Tue, 02-03 Tue, 02-04 Wed, 02-07 Sat, 02-14 Sat, 02-20 Fri, 02-21 Sat, 03-02 Mon, 03-07 Sat, 03-10 Tue, 03-12 Thu, 03-19 Thu, 03-21 Sat, 03-28 Sat, 04-01 Wed. DST switch is 2026-03-29, after every conversation message; asked_at 2026-04-01 has +02:00 (correct).

| id | verdict | evidence | proposed change |
|---|---|---|---|
| q01 | OK | s11 (Sun 2026-03-08) "Ieri di nuovo a Cervinia, con Marco e Giulia" -> Sat 2026-03-07. Nothing later. | - |
| q02 | OK | s02 (Sun 01-18) "Ieri ... Cervinia" -> Sat 01-17; s06 (Sun 02-08) "Sabato ... Livigno" -> Sat 02-07; s11 -> Sat 03-07. 3 trips. e01 (elena, Feb 15 "Ieri" = Feb 14) is the leak behind must_not "14 febbraio"/"con le amiche". Noise only has Paolo (third party) skiing at Bormio. | - |
| q03 | OK | Marco = "mio cognato" (s02); also on 03-07 (s11). | - |
| q04 | OK | Feb events: 02-07 Livigno (s06), 02-14 dinner (s07, "Stasera", a same-evening plan never explicitly confirmed afterwards but never cancelled), 02-20 Giulia's win (s08). Roma trip (Tue 02-03/Wed 02-04) cancelled in s05. Complete. | - |
| q05 | OK | s04 (Tue 01-27) "La settimana prossima ... martedì e mercoledì" -> Tue 02-03 and Wed 02-04; s05 (Sun 02-01) "Roma salta, il cliente ha rimandato a data da destinarsi". | - |
| q06 | OK | s12 (Tue 03-10) "giovedì della settimana prossima alle 15" -> Thu 03-19 (assistant confirms "giovedì 19 marzo"); s13 (Fri 03-20) "Fatto il dentista ieri: un'otturazione". | - |
| q07 | OK | s10 (03-02) Tesla Model 3 in leasing, Golf sold. Same report-date caveat as q20 (see there). | - |
| q08 | OK | s01 (Mon 01-12) "mi sono appena preso una Golf usata, grigia, del 2019"; still owned until s10. | - |
| q09 | OK | s06. | - |
| q10 | OK | s02 only (January). | - |
| q11 | OK | s08 (Fri 02-20). Same report-date caveat (win date = message date, no "oggi"), low risk because the question does not ask for the date. | - |
| q12 | OK | 2026-02-07 is a Saturday; s06 "Sabato sono stato a Livigno ... da solo". | - |
| q13 | OK | s14 "l'anno prossimo, magari ad aprile" (sent 2026-03-25) -> April 2027; never confirmed. Noise only has "documentario sul Giappone" (not a trip). | - |
| q14 | OK | Japan idea (s14), Roma cancelled (s05). Noise: "mostra su Caravaggio a Roma" is third-party, not a trip. | - |
| q15 | OK | s15 (Sat 03-28) "Oggi pomeriggio ... 52 minuti". | - |
| q16 | OK | s03 Thu 2026-01-22 21:00. | - |
| q17 | AMBIGUOUS (low) | asked Sat 2026-02-21 -> week Mon 02-16..Sun 02-22. Only s08 (Fri 02-20) falls in it. But s08 says "Giulia ha vinto la gara" without "oggi": the race may have been on any earlier day (the win could belong to the previous week, e.g. the weekend 02-14/15). The gold assumes event date = message date. | Preferred fix in the data (additive, keeps expected unchanged): in s08 write "Oggi Giulia ha vinto ..." (or "Stamattina ..."). Alternative: reword expected: "Venerdì 20 febbraio hai raccontato che Giulia ha vinto la gara regionale di nuoto nei 50 stile." |
| q18 | OK | s07 "ristorante Il Pescatore a Varese" with Sara (note: same-evening plan, not confirmed afterwards; accepted). | - |
| q19 | AMBIGUOUS (low) | asked Thu 2026-03-12 -> "settimana scorsa" = Mon 03-02..Sun 03-08 (Monday-based). Items: s10 (Mon 03-02) and s11 (Sat 03-07, "Ieri" from Sun 03-08). Two weaknesses: (a) "Ho venduto la Golf" (s10) has no day marker, the sale may predate 03-02; (b) a "last 7 days" reading (03-05..03-12) would drop the car and add nothing else. Noise also puts third-party chatter in this week (n093 Mar 3 sister in Torino/Marco's job; n053 Mar 4 Paolo skiing at Bormio). | Fix s10 as for q20 (add "Oggi"); expected: "Nella settimana da lunedì 2 a domenica 8 marzo: lunedì 2 marzo hai venduto la Golf e preso in leasing una Tesla Model 3; sabato 7 marzo sci a Cervinia con Marco e Giulia (prima pista nera di Giulia)." |
| q20 | AMBIGUOUS (low) | s10 (Mon 2026-03-02 13:00) "Ho venduto la Golf, ora ho una Tesla Model 3 presa in leasing": the change happened on or before 03-02, the message gives no day. Gold "Il 2 marzo" is the report date. | Data fix: s10 first user message -> "Oggi ho venduto la Golf, ora ho una Tesla Model 3 presa in leasing." (expected unchanged). Or expected: "Lo hai comunicato il 2 marzo 2026: venduta la Golf, presa una Tesla Model 3 in leasing." Also reword must_not "Panda" -> "attribuire all'utente una Panda come auto" (the Panda is the neighbour's car in noise; harmless to a correct answer, but explicit is safer). |
| q21 | MUST_NOT-TOO-STRICT | expected is right (no December ski in memory; memory starts 2026-01-12). Noise (n096, n109, n137, n053) deliberately contains "Il mio collega Paolo è andato a sciare a Bormio": a correct and helpful answer can say "Non risulta; hai solo detto che il tuo collega Paolo è stato a Bormio", which contains the must_not "Bormio". | must_not: `["sì, a dicembre", "affermare che l'utente è andato a sciare a Bormio"]` |
| q22 | OK | asked Sat 2026-03-21 -> week 03-16..03-22; s13 (Fri 03-20) "dentista ieri" -> Thu 03-19. Nothing else in the week. | - |
| q23 | OK | s08 + s11 ("prima pista nera"). | - |
| q24 | OK | s02 (01-17) + s11 (03-07). | - |

### 2.2 dataset_holdout (chiara)

Computed weekdays used: 2026-10-10 Sat, 10-19 Mon, 10-22 Thu, 10-28 Wed, 11-02 Mon, 11-03 Tue, 11-21 Sat, 11-27 Fri, 11-30 Mon, 12-03 Thu, 12-05 Sat, 12-09 Wed, 12-10 Thu, 12-11 Fri, 12-12 Sat, 12-18 Fri, 12-28 Mon, 12-30 Wed, 2027-01-02 Sat, 01-10 Sun, 01-11 Mon, 01-15 Fri, 01-17 Sun, 01-22 Fri, 02-04 Thu, 02-06 Sat, 02-10 Wed, 02-20 Sat, 2027-09-18 Sat. Offsets: +02:00 up to c05 (Oct 23), +01:00 from c06 (Oct 30), all correct.

| id | verdict | evidence | proposed change |
|---|---|---|---|
| h01 | OK | c25 (Sat 2027-02-06) "Oggi sono tornata a BlocHaus ... primo 6c"; nothing later. must_not "7a" = davide's d01/noise. | - |
| h02 | OK | c01 "sabato vado ad arrampicare" + c02 (Sun 10-11) "Ieri a BlocHaus" -> Sat 10-10; c06 (Fri 10-30) "Mercoledì sera a BlocHaus" -> Wed 10-28; c12 (Thu 12-03) "today I went to BlocHaus"; c25 -> Sat 02-06. 4 sessions. (Count is "as recorded"; unavoidable.) | - |
| h03 | OK | c23 (Sun 01-17) "abitiamo in via Andrea Costa 41, terzo piano. Io, Tommaso e Rufus". | - |
| h04 | MUST_NOT-TOO-STRICT | expected fine (c10 Sat 11-21 "da oggi sto da Tommaso, in via Saragozza 88 ... fino a gennaio"). A correct answer will often say "(prima eri in via Mascarella)" or "da gennaio via Andrea Costa" (the expected itself says "fino al 17 gennaio 2027"). Both strings are also valid history. | must_not: `["affermare che all'inizio di dicembre abitavi in via Mascarella", "affermare che all'inizio di dicembre abitavi in via Andrea Costa"]` |
| h05 | MUST_NOT-TOO-STRICT | expected fine (c10, Sat 2026-11-21 19:30 "Ho lasciato via Mascarella e da oggi sto da Tommaso"). "1° febbraio" is davide's lease (d03) and is a good leak trap. "17 gennaio" is a natural mention ("fino al 17 gennaio, quando ti trasferisci in via Andrea Costa"). | must_not: `["1° febbraio", "indicare il 17 gennaio come data in cui hai lasciato via Mascarella"]` |
| h06 | OK | c15 (Thu 12-10) "spostano a venerdì 15 gennaio" (Fri 2027-01-15); c21 (Thu 01-14) "domani sera c'è il saggio"; c22 (Sat 01-16) "Ieri sera il saggio ... Il Cigno ... c'era anche mamma". must_not "chitarra" = davide's d03. | - |
| h07 | MUST_NOT-TOO-STRICT (low) | c14 (Wed 12-09) "Trento lo annulliamo ... L'hotel ci rimborsa la caparra"; trip Sat 12-12/Sun 12-13 (c13). "rinviato" can occur in a correct answer ("annullato, non rinviato"). | must_not: `["sì, siete andati", "presentare la gita come solo rinviata e ancora in programma"]` |
| h08 | MUST_NOT-TOO-STRICT | expected fine: c23 (Sun 01-17) "Venerdì prossimo ... La Locandiera" -> Fri 2027-01-22; no follow-up anywhere (noise has none). A natural answer is "non so se ci sei andata o se è stato annullato", which contains "è stato annullato". | must_not: `["sì, ci sei andata", "affermare che la serata è stata annullata"]` |
| h09 | FIX (+ MUST_NOT-TOO-STRICT) | Two orthopaedist visits exist: c06/c07/c08: first visit Tue 2026-11-03 (corrected from Mon 11-02), diagnosis "lesione parziale della puleggia A2, anulare sinistro"; c12 (Thu 12-03) "The orthopaedist cleared me on Monday at the follow-up visit" -> Mon 2026-11-30 (h15's expected already uses "via libera dell'ortopedico il 30 nov"). The question "Che giorno sono stata dall'ortopedico" is therefore incomplete in the gold; a correct answer that also mentions the 30 Nov follow-up is penalised as "extra", one giving only 30 Nov could be defended. Also must_not "lunedì 2 novembre" appears verbatim in the gold's own explanation ("non lunedì 2") so a correct answer that states the correction would be marked wrong. | expected: `Martedì 3 novembre 2026 per la visita con diagnosi: lesione parziale della puleggia A2 dell'anulare sinistro (non lunedì 2: la visita era stata spostata all'ultimo). C'è stata anche una visita di controllo lunedì 30 novembre 2026, con il via libera per tornare ad arrampicare.` must_not: `["indicare lunedì 2 novembre come data della visita (senza la correzione a martedì 3)"]` |
| h10 | MUST_NOT-TOO-STRICT | c16 (Tue 12-15) "dice che ha più o meno 4 anni, non 2". Correct answers naturally say "il canile diceva che aveva 2 anni, ma ne ha circa 4"; "ha 2 anni" matches "diceva che ha 2 anni". | must_not: `["indicare 2 anni come età attuale di Rufus"]` |
| h11 | OK | c11 (Tue 11-24) "il 9 dicembre la operano di cataratta all'occhio destro, a Ferrara"; c14 (Wed 12-09) "stamattina l'hanno operata ... andato tutto bene", "Sono a Ferrara da mamma". must_not "12 gennaio" = davide's mother (d04, Wed 01-13 "ieri"). | - |
| h12 | OK | c26 (Thu 2027-02-11) "ieri Tommaso è stato promosso capo progetto" -> Wed 02-10. Note: noise (hn046 etc.) has "Il capo di Tommaso dice che andrà in pensione l'anno prossimo": third-party, not Tommaso's news; does not change the gold. | - |
| h13 | OK | c18 (Thu 12-31) "yesterday Belém" -> Wed 12-30; "found them too sweet. A bit overrated"; "40-minute queue". d02 (davide: "i dolci più buoni del mondo ... dodici") is the leak. | - |
| h14 | MUST_NOT-TOO-STRICT | expected fine: c19 (Sat 2027-01-02) "a mezzanotte, in Praça do Comércio ... Tommaso si è inginocchiato"; c18. must_not "Porto" is a substring of "Portogallo" ("Lisbona, in Portogallo") and of any "non a Porto" remark; noise hn052/hn083 ("Mia cugina Sofia ha passato il capodanno a Porto") lets a good answer mention the cousin. | must_not: `["affermare che hai passato capodanno a Porto"]` |
| h15 | MUST_NOT-TOO-STRICT (low) | Every item verified: 12-03 climbing (c12, +30 Nov clearance), 12-05 adoption (c13 "Ieri" from Sun 12-06), 12-09 Ferrara + Trento cancelled (c14), 12-10 saggio moved (c15), 12-15 vet (c16), 12-23 last day (c17), 12-24..26 Ferrara (c17, c18), 12-28 Lisbon until 01-02 (c17, c18, c19). Complete. A correct answer will say "il saggio previsto per il 18 dicembre è stato spostato", which can trip "saggio il 18 dicembre". | must_not: `["sei andata a Trento", "indicare il saggio come tenuto il 18 dicembre"]` |
| h16 | OK | c05 (Fri 10-23) "Affitto 1.150 euro al mese, spese condominiali escluse"; "900" = davide's d03. | - |
| h17 | OK | c20 Sun 2027-01-10 (voltura, subentro, torta di mele; "Domani inizio a Kinesis" -> Mon 01-11). | - |
| h18 | MUST_NOT-TOO-STRICT | expected fine (only Lisbon, 12-28..01-02). Noise hn052 (2027-01-20), hn083 (02-14) say "Mia cugina Sofia ha passato il capodanno a Porto", so the natural correct answer "Tu no; è stata a Porto tua cugina Sofia per capodanno" contains "capodanno a Porto". | must_not: `["affermare di essere stata a Porto"]` |
| h19 | OK | asked Fri 2026-12-11 -> week Mon 12-07..Sun 12-13: c14 (Wed 12-09) and c15 (Thu 12-10) only. Adoption (Sat 12-05, reported Sun 12-06) is in the previous week (a "last 7 days" reading would include it, but the Monday-based rule and the must_not wording cover this). | - |
| h20 | MUST_NOT-TOO-STRICT | asked Wed 2027-01-20 -> week Mon 01-11..Sun 01-17: Kinesis start (c20/c21), saggio Fri 01-15 (c21/c22), move Sun 01-17 (c23). Complete. "La Locandiera" (Fri 01-22) was mentioned in c23 (inside that week) and is a pending plan two days after asked_at: a helpful correct answer may add "e venerdì avete in programma La Locandiera". | must_not: `["Lisbona", "La Locandiera presentata come già vista o avvenuta la settimana scorsa"]` |
| h21 | OK | asked Wed 2027-02-10 -> week Mon 02-01..Sun 02-07: c25 (Sat 02-06) "giovedì a lezione abbiamo iniziato il brano nuovo" -> Thu 02-04; BlocHaus Sat 02-06. Promotion (Wed 02-10) and villa (Mon 02-08) are reported on 02-11, after asked_at. | - |
| h22 | OK | c08 (Sun 11-08) "Inizio lunedì 11 gennaio", "ultimo giorno lì sarà il 23 dicembre"; c17 (Wed 12-23) "Oggi ultimo giorno"; c20 "Domani inizio a Kinesis" (Sun 01-10); c21 "quarto giorno". | - |
| h23 | AMBIGUOUS | Dates verified (Mon 2026-12-28 "We landed on Monday" c18; Sat 2027-01-02 "Tornati ... oggi pomeriggio" c19). Duration: calendar span 12-28..01-02 = 6 days, 5 nights; Chiara herself says "cose da non perdere in 5 giorni?" (c17). Both "5 giorni" and "6 giorni" are defensible, so a correct answer saying 5 days/5 nights is judged against "6 giorni". | expected: `Dal 28 dicembre 2026 (lunedì) al 2 gennaio 2027 (sabato): 5 notti, 6 giorni di calendario, a cavallo di capodanno.` |
| h24 | OK | c13 (Sun 12-06) "Ieri abbiamo adottato un cane dal canile di Bologna" -> Sat 12-05. | - |
| h25 | OK | asked Thu 2026-11-05 (c08 of Nov 8 not yet visible): c07 (Wed 11-04) "Stop arrampicata per 4-6 settimane e un anello di protezione", violoncello ok. "tre settimane" = davide's shoulder (d04, 2027, future at that date). Note: noise hn121 (11-03), hn046 (10-08) "rientro dopo 6-8 settimane" for a patient's A3 injury is a deliberate trap; "6-8 settimane" could optionally be added to must_not. | - |
| h26 | OK | Cigno (c09, c22), scala di Re maggiore (c09), Minuetto in sol (c25, Thu 02-04). "Romance" = davide's guitar piece (d03). | - |
| h27 | OK | c20 (Sun 01-10, anxiety the evening before), c21 (Thu 01-14, "quarto giorno", 12 pazienti, "distrutta, però felice"). Gold is a subset of what is said, none of it wrong. | - |
| h28 | OK | c26 (Thu 02-11) "sabato 18 settembre 2027" (2027-09-18 is a Saturday); c19 proposal at midnight, Praça do Comércio. | - |

## 3. Noise findings

No noise session changes or contradicts an `expected`. Checked by script: every noise user message in holdout belongs to the generator's pools; no trap/dog/"mamma collirio" item violates its not_before/not_after window; none falls inside the three quiet weeks (2026-12-07..13, 2027-01-11..17, 2027-02-01..07).

Observations (none requires a gold change; the first two require attention in the generators or harness):

1. `dataset/gen_noise.py`: all noise timestamps use the fixed offset +01:00 (`TZ = timezone(timedelta(hours=1))`) even for dates after the DST change of 2026-03-29. Affected: n024 (2026-03-30T20:07+01:00 is really 21:07 Rome). Harmless for current questions; fix with `ZoneInfo("Europe/Rome")` as `dataset_holdout/gen_noise.py` already does.
2. `dataset/gen_noise.py` protects only the q17 week from personal third-party news (`Q17_WEEK`, end exclusive at 02-22 00:00). The q19 week (2026-03-02..08) and q22 week (2026-03-16..22) are not protected: n093 (Mar 3, "Mia sorella si è trasferita a Torino", "Marco dice che vuole cambiare lavoro") and n053 (Mar 4, "Il mio collega Paolo è andato a sciare a Bormio") fall inside the q19 week. They are third-party and do not alter the gold, but they are bait for over-inclusion in a "what did I do last week" answer; if the intent is clean periods, add these weeks to the quiet list. The docstring also still says "18 questions" (now 24).
3. Both datasets contain noise sessions timestamped AFTER the question's `asked_at` (e.g. q17 asked 2026-02-21 10:00 vs n115 at 02-21 18:36; q19, q22; holdout h19, h20, h21, h25 have a lot). Content is neutral, but the harness must ingest only sessions with ts <= asked_at, otherwise questions with an early asked_at could see later facts (e.g. h25 would see c08 correction and davide's d04 "tre settimane"; h21 would see the promotion).
4. Deliberate third-party traps that interact with `must_not` strings (see verdicts): Paolo at Bormio (q21), neighbour's Panda (q20), cousin Sofia in Porto at New Year (h14, h18), patient with A3 pulley / "6-8 settimane" (h09, h25), "capo di Tommaso in pensione" (h12), "saggio di pianoforte a giugno" (h06, h15), cat adopted by the neighbour (h24).
5. Isolation users: elena's e01 (Cervinia with friends, Feb 14) and davide's d01..d04 are consistent with the must_not leak strings. `hd` noise (davide) such as "ho provato un 7a+" and "Ripenso ancora a Lisbona" cannot affect chiara's gold.

## 4. Suggested edit order

1. h09 (expected + must_not), h23 (expected).
2. All MUST_NOT-TOO-STRICT rewordings (q21, h04, h05, h07, h08, h10, h14, h15, h18, h20).
3. luca dataset: add "Oggi" to s08 and s10 (additive, fixes q17/q19/q20 and q07/q11 caveats) and add the "Monday-based week" wording to q19's expected.
