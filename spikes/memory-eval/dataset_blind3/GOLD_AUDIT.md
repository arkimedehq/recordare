# Blind set #3 — independent gold audit

Method: every session in conversations.json read in full; all dates, weekdays, Monday-based weeks and
Europe/Rome DST offsets recomputed with python (all 206 session timestamps have the correct offset; 36
sofia sessions + 170 noise sessions, ids unique). Each question checked against the sessions ingested
up to its `asked_at`, plus noise.json / gen_noise.py (no noise item changes an expected answer; noise
traps are all questions, general knowledge or clearly attributed to a third party; sofia noise in the
b06/b07 window Mon 5 - Wed 14 July is only tech filler).

## Summary

Questions (36): OK 30, FIX 6 (all applied), AMBIGUOUS 0, MUST_NOT-TOO-STRICT 0.
Gold items: episodes 44 (OK 42, FIX 2), facts 10 (OK 8, FIX 2) + 1 fact added, notes 15 (OK 13, FIX 2),
not_memories 5 (OK 5).

All weekday/date claims in questions and gold verified (e.g. 10 Jul Sat, 8 Jul Thu, 11 Mar Thu, 14 Jun Mon,
19 Jun Sat, 1 Jun Tue, 29 Apr Thu / 30 Apr Fri, 1 Aug Sun, 1 Jul Thu; b06 week = Mon 12 Jul, b07 week = Mon 5 - Sun 11 Jul).
Plan outcomes known at asked_at checked: b08/b15 (asked 1 May 10:00) correctly exclude s14 (1 May 12:00);
b25 (7 May) correctly includes s14; b10 (20 May) sees s15 reschedule only; b20 (20 Jul) sees s25-s27, not p04.

## Non-OK questions (all fixed in questions.json)

| id | problem | evidence | replacement (expected) |
|---|---|---|---|
| b04 | "(da sola)" unsupported | s06: only "Domenica sono andata a Chioggia a trovare nonna Ida" — no companion info either way | "3 volte: domenica 21 marzo, domenica 16 maggio (con Davide) e domenica 25 luglio 2027 (con Davide e Brina)." |
| b14 | refund stated as done | s12: "Mi rimborsano i 150 euro" (present/future, no confirmation of the refund) | "Niente: il corso di sabato 24 aprile 2027 è stato annullato (docente malato) e i 150 euro ti vengono rimborsati." |
| b16 | "a Padova" for via Savonarola never stated | s09, s20: "in via Savonarola", city never named (s16 "Da Padova" refers to her via Belzoni period) | "Con Davide nel suo appartamento in via Savonarola, dal 1° giugno 2027 (hai lasciato il bilocale di via Belzoni)." |
| b18 | same | same | "Da Davide, in via Savonarola (dal 1° giugno al 1° agosto 2027)." |
| b20 | same | same | "...Tu abiti con Davide in via Savonarola; il trasloco ad Abano è previsto per il 1° agosto." |
| b26 | "ha iniziato a luglio" unsupported | s08: "Inizia a luglio" (future); s25 only says she moved on Thu 1 July, never that she started | "...Verona (notizia di aprile; doveva iniziare a luglio) e si è trasferita a Verona giovedì 1 luglio 2027, ..." |

Residual notes on OK questions (no change):
- b06/b07 assume Monday-based weeks (as specified); a Sunday-based reading would not change either answer.
- b34 must_not "affermare che Sofia ha detto di trasferirsi a Londra": a correct answer naturally says "Giorgio ha scritto che
  l'avresti detto"; the judge rules (reported/negated use is not a violation) cover it, so kept.
- Noise: sofia asks general questions about flights to Ljubljana, Arena ticket prices, ceramics lesson duration (all questions,
  none asserts a personal event), so b15/b32/b13 stay valid.

## Gold fixes (all applied to gold.json)

| item | problem | evidence | new text |
|---|---|---|---|
| episode g-e09 | "(alone)" unsupported | s06 gives no companion info | "Visit to grandmother Ida in Chioggia; she cooked sarde in saor" |
| episode g-e14 | refund overstated | s12 "Mi rimborsano" | "Ultrasound course in Bologna cancelled (teacher ill); 150 EUR to be refunded" |
| episode g-e26 | city not stated | s09/s20 | "Moved in with Davide in via Savonarola (last boxes on 1 June; keys of via Belzoni returned on 2 June)" |
| fact home (interval 2) | same | same | "Davide's flat in via Savonarola" |
| fact partner | "38 since 13 July" invented | s27 only: "ieri sera abbiamo festeggiato i 38 anni di Davide" (celebration on 13 Jul, birthday date unknown) | "Davide (hydraulic engineer at the Consorzio di bonifica; turned 38 around 13 July 2027, celebrated on the 13th)" |
| note relationship (Friends) | "best friend" unsupported | s05/s21/s23 never say it | "Friends: Marta (friend, married Simone), Giorgio, Lorenzo; Ilaria is her former colleague at Arcella and a friend" |
| note knowledge (spreadsheet) | "keep" overstates | s22: "I'll build it tonight" (intent only) | "Sofia and Davide set up (planned 14 June) a shared household-expense spreadsheet split by income" |
| fact ADDED sister_chiara_city | important changing state missing (b26) | s01 "qui a Padova", s08, s25 (moved Thu 1 Jul) | Padova (to 2027-07-01) then Verona, studio flat near Castelvecchio (from 2027-07-01) |

Checked and left as is: all other episode dates/precisions/plan_outcomes (g-e01 approximate month, g-e07/e13 cancelled,
g-e10 rescheduled:2027-06-05, g-e18 rescheduled:2027-05-27, g-e28/e30/e34 unresolved, g-e43 confirmed), all other fact intervals
(employer, last_day_at_previous_job, salary, home, lives_with, rent, pets, hotel cost, knee), not_memories.
Judgement calls kept: g-e42 date "2027-08" approximate (s30, 12 Aug; "we've just moved" supports August, true offer date unknown);
last_day_at_previous_job `from` 2027-04-26 is the correction date (acceptable bitemporal reading).
Minor details deliberately not in gold (low value): 5-minute walk to work from Abano (s29), Pepe with the neighbour during
Puglia (s31), Pepe hiding after the move (s20), resignation request / spreadsheet request (provenance only, per not_memories).
