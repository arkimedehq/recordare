# Gold audit — blind dataset #4

Independent second reading of `conversations.json`, `questions.json`, `gold.json`, `noise.json` and
`gen_noise.py`, done without reading `service/`, `systems/*.py`, `results/`, `RESULTS.md` or
`docs/ENGINE_IDEAS.md` (only `evalkit/common.py` — loaders and judge prompt — and
`docs/RESEARCH_NOTES.md` H1 were consulted).

## Method

1. Read all 62 sessions in full, in timestamp order, with the weekday of every `ts` recomputed by
   Python (Europe/Rome). Built a day-by-day timeline of every event, plan, change and correction.
2. For each of the 84 questions, listed the sessions with `ts <= asked_at` and checked: the expected
   answer against those sessions only; completeness vs. over-demand; ambiguity; every date and
   weekday in `expected` / `must_not` (recomputed with `datetime`, 2028 calendar; Easter 2028 =
   Sun 16 Apr confirmed); relative weeks as Monday-based weeks around `asked_at`; category fit;
   whether a `must_not` item is really wrong; how the judge prompt (`JUDGE_SYSTEM`) would grade a
   careful answer (key facts, extra true context allowed, must_not only when asserted).
3. Noise: regenerated `noise.json` from `gen_noise.py` (seed 2028) and compared byte-for-byte with
   the committed file (identical, 170 sessions); listed all `giorgio` sessions and all third-party
   `tommaso` noise with dates; listed every noise session falling inside the six relative-week
   windows; checked every ISO offset against Europe/Rome DST (all correct, +02:00 from 26 Mar).
4. Gold: every episode's sessions, date, kind and `plan_outcome` against the timeline; every fact
   history interval; notes and not_memories against what is actually said in the sessions.

## Result in short

The dataset is sound: no wrong date, weekday, count or plan outcome was found in any of the 84
questions, no expected answer depends on a session after its `asked_at`, no noise session changes
an answer, and the quiet windows of the this-week / last-week questions contain only knowledge /
coding filler. The changes below are wording and grading-fairness fixes plus a few gold details.
No question was dropped; no question's substance was changed.

## Changes to `questions.json`

| id | before | after | why |
|---|---|---|---|
| c14 (period-overview) | one flat list of 13 March items, all presented as reference facts | same content split into "Eventi principali" (interview, Zenzero, root canal, 40th birthday, offer, resignation, party, father's surgery, Lisbon booking) and "Dettagli secondari (non indispensabili)" (photo course, Yaris, vaccine, Portonovo ride, 320 € correction) | with 13 equal-weight items almost any answer would be graded `partial`; the judge needs to know which facts are key. Nothing added or removed. |
| c26 (state-change-date) | "L'ultima lezione frequentata è stata martedì 9 maggio 2028; lo ha comunicato il 16 maggio" | adds "Vanno bene sia il 9 sia il 16 maggio come data" | "quando ho smesso" is legitimately answered by either the last lesson (9 May) or the day he said he quit (16 May); the previous wording invited `partial` for a correct 16-May answer. |
| c38 (plan-unresolved) | must_not: described as happened / cancelled | + "presenting the farewell dinner of 27 April at Mario's as this dinner" | the obvious confusion a system can make; makes the trap explicit for the judge. |
| c39 (plan-unresolved) | must_not: sì fatto / no saltato | + "presentare il primo vaccino del 25 marzo o la visita dal veterinario di Bricco del 26 maggio come il richiamo" | both are vet visits in the record that are not the booster. |
| c40 (plan-unresolved) | must_not: describe the party as happened | + "presentare la cena con i genitori del 5 giugno come la festa di inaugurazione" | the parents' first dinner at the new flat (5 Jun) is the natural false match. |
| c45 (implicit-change) | "Una Toyota Yaris ibrida (provata il 12 febbraio; la usa almeno dal 7 marzo). La Punto non aveva passato la revisione." | lists the three pieces of evidence (12 Feb test drive, 7 Mar "con la Yaris", 20 Mar Punto valued 500 €), the failed inspection, and states that the change was never announced so a hedged inference ("a quanto pare / sembra la Yaris") is acceptable | the car change is implicit; a careful system that infers with a hedge must be graded correct, one that still asserts the Punto must be wrong (must_not unchanged). |
| c77 (poisoning-probe) | "una voce della zia Lidia nella chat di famiglia" | "un'affermazione di Lidia nella chat di famiglia, mai confermata da te" | Lidia's relation to Tommaso is never stated anywhere; "zia" was an invention of the gold. |

## Changes to `gold.json`

| item | before → after | why |
|---|---|---|
| notes / family | "younger brother Nicola" → "brother Nicola"; "aunt Lidia" → "Lidia (relative in the family chat, relation unstated)" | neither "younger" nor "aunt" is said in any session. |
| notes / people | "Stefano: best friend" → "Stefano: friend and cycling partner" | "best" never stated. |
| notes / plan | "Hot-air balloon flight voucher (Marta's 40th birthday gift)" → "… for two (Marta's gift for his 40th birthday)" | the old phrasing could be read as Marta's own birthday (and c84 relies on Marta's birthday never being mentioned). |
| not_memories / s16 | "aunt Lidia's claim" → "Lidia's claim in the family chat" | as above. |
| facts / car | Punto `to: 2028-03` → `2028-03-07`, value now records the failed inspection and the 500 € valuation; Yaris `from: 2028-03` → `2028-03-07` with "switch between 24 Feb and 7 Mar, first mentioned in use on 7 Mar" | the switch is bounded by the failed inspection (24 Feb) and the first use (7 Mar); "2028-03" alone was looser than the evidence. |
| g-e14 | content now "Blood test (drawn Fri 4 Feb, results on 8 Feb) …", sessions `s08,s11,s48` | s08 (31 Jan) says the test is on Friday = 4 Feb; the result was reported on 8 Feb. |
| g-e40 | adds "(the signing itself was never explicitly confirmed; the move went ahead)" | the 18 Apr lease signing is only announced the day before (s42); nothing confirms it directly. |
| g-e71 | `date_precision: day` → `approximate`; content "learned on race day, 26 Mar" | Ilaria's withdrawal is reported on 26 Mar; the day she withdrew is unknown. |

## Change to `README.md`

- "an aunt's 'wedding in September'" → "Lidia's (a relative) 'wedding in September'" (same reason).

## Checks that passed (no change needed)

- **Relative weeks** (Monday-based, recomputed): c08 28 Feb–3 Mar → s20, s21 only; c09 8–12 May →
  s48, s49; c10 20–22 Mar → s31; c11 14–20 Feb → s13–s16; c12 24–30 Apr → s44, s45 (the 30 Apr
  ride is reported only on 2 May, after `asked_at`, so correctly absent); c13 22–28 May → s54–s57.
  All six windows match the `QUIET` ranges of `gen_noise.py` and contain only `TECH` filler.
- **Plan outcomes**: confirmed (interview, Lisbon, Easter lunch, farewell dinner, exhibition, physio
  30 May, father's surgery), cancelled (ski, cheering Ilaria, Spanish dinner), rescheduled (party
  11→18 Mar, move 13→20 May, root canal 15 Feb→24 Feb→8 Mar), unresolved (concert 8 Apr, booster,
  dinner 1 Jun, housewarming 17 Jun) — all consistent with the sessions; nothing after `asked_at`
  resolves any of the unresolved ones.
- **Corrections**: 280→320 (20 Mar), Gatti→Galli (3 Apr), 168→186 (9 May). c16 (asked 1 Mar) rightly
  keeps 168 "as told then"; c44 asks for both values.
- **Counts**: rides 23 Jan, 27 Feb, 26 Mar, 9 Apr, 30 Apr = 5 (28 May skipped; 19 Mar only Walter's
  claim); physio 3, 8, 15, 22 Feb = 4 (+ 30 May); party 34; animals 3; March rides at 1 Apr = 1.
- **Provenance**: speech 26 Jan, cover letter 16 Feb, interview questions 27 Feb, mortgages 15 Mar,
  CERCA.VERT 6 Apr, complaint 25 Apr, Lisbon itinerary 1 Apr — unique in the record and absent from
  noise.
- **Poisoning probes**: September wedding (Lidia), 19-minute Conero (Walter; Tommaso was on the
  sofa on 19 Mar per s30), doubled salary (Gianni; +15% per s26) — never confirmed by the owner.
- **Negatives**: Marta's surname, Stefano's job, the vet's name, Marta's birthday — absent from all
  sessions and from noise.
- **Cross-language** pairs (c73–c76) are each told in one language and asked in the other.
- **Noise**: `giorgio` sessions mirror Tommaso's events (Portonovo ride 24 Feb and 29 Mar, root
  canal 300 € on 31 Jan, kitten Arancio 29 Feb, Lisbon proposal 11 Apr, Osimo job 4 Feb, dropped
  photo course 17 Apr, Senigallia move) — all isolated by `user`. Tommaso's third-party noise
  (colleague's Punto→Panda, neighbour's beagle, colleague's sister's September wedding, friend-of-
  friend's 22-minute Conero, acquaintance's clavicle on the Conero) is always attributed to someone
  else and never falls in a quiet window.
- **Gold episodes**: all 72 checked (sessions, dates, kinds, outcomes); no missing major event.
  Minor items intentionally not in gold: Galli sending the contract (15 Mar), handover to Gianni
  (3 Apr), night-photo lesson (30 Mar), Marta's school year ending (28 May).

## Residual doubts (left as is)

- **c12 must_not** "the proposal happened last week": the trip (22–25 Apr) straddles the two weeks.
  An answer that mentions the proposal as context of the return ("tornato da Lisbona, dove il 23
  …") is fine under the judge rule on extra true context; an answer that undates it ("la settimana
  scorsa ti sei fidanzato") would be marked wrong. Acceptable, but this is the strictest must_not.
- **c14 / c16 / c15** remain demanding overviews; `partial` will be common for any system. The
  main/secondary split in c14 reduces, not removes, this.
- **c07**: Tommaso flew from Bologna airport on 22 and 25 Apr. 14 May is still the last time, so the
  answer is unaffected; an answer mentioning the airport as earlier context is fine.
- **c45/c46**: the car change is deliberately implicit. The evidence (7 Mar "con la Yaris", 20 Mar
  500 € valuation "almeno qualcosa ci ho preso") is strong enough that asserting the Yaris is fair;
  the hedge clause protects cautious systems. "Traded in" in c46 stays marked as presumption.
- **Noise "Panda"**: the colleague's Punto→Panda appears on 13 and 18 Apr, two days before c45
  (15 Apr). A system that answers "Panda" would be wrong, correctly: the sentence is attributed.
- **g-e70** (Stefano's gravel) is dated at its announcement (23 Mar); the purchase date is unknown.

## Final counts

84 questions, unchanged per category: point-temporal 4, last-time 3, this-week 3, last-week 3,
period-overview 3, state-now 4, state-at-date 3, state-change-date 3, plan-confirmed 3,
plan-cancelled 3, plan-rescheduled 4, plan-unresolved 4, correction 4, implicit-change 3, count 4,
third-party 3, emotion/opinion 3, small-detail 4, provenance 4, premise-trap 4, anti-trap 3,
cross-language 4, poisoning-probe 4, negative 4. Dropped: 0. Rewritten: 0 (7 expected/must_not
edits). Gold: 72 episodes (45 event, 17 plan, 10 state_change; outcomes 7 confirmed, 3 cancelled,
3 rescheduled, 4 unresolved), 13 facts, 9 notes, 11 not_memories.

Loader check after the edits: `EVAL_DATASET=dataset_blind4 … load_sessions / load_questions` →
62 sessions, 84 questions, user `tommaso`.
