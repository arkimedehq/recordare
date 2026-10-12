# Gold audit — blind set #11 (Ciclofficina Raggio, entity memory)

Audited blind: read only `dataset_blind11/`, `DATASET_FORMAT.md` and `evalkit/common.py`. No evaluation was run.

## What was checked
For each of the 40 questions, against the sessions and sources before its `asked_at`:
1. the `expected` answer is fully supported by evidence before `asked_at`; the forgotten catalogue (`k-ricambi-adige`,
   forgotten 25 Oct 15:20) is used only by q23 (asked 20 Oct) and is "not known" in q24 (asked 8 Nov);
2. dates, weekdays, amounts, names and who-said-what in `expected` match the messages (every weekday in 2032 recomputed:
   e.g. "lunedì" said by Giada on Thu 21 Oct = 18 Oct; "giovedì" in s14/s22 = 14 / 21 Oct; "mercoledì" in s28 = 10 Nov);
3. every `must_not` claim is false in the sessions;
4. ambiguity: the two Marcos and the surname-less Marco (s20), unidentified speakers (s04, s08, s13 second half, s19,
   s25 second half) reported as "not known", "now" vs `asked_at` (END = Mon 8 Nov 18:00, OCT20 = Wed 20 Oct 12:00 before
   s17, OCT30 = Sat 30 Oct 11:00 before s24 and the winter hours);
5. nothing relies on information the memory could not know;
6. `gold.json` episodes / facts / notes / not-memories against the sessions (dates, speakers, people, own content).

Also: `asked_at` ordering vs evidence and Europe/Rome offsets (+02:00 up to Sat 30 Oct, +01:00 from Sun 31 Oct; all
session, source and question timestamps correct). `python3 build.py && python3 check.py` → OK.

## Changes
| Where | Before → after | Why |
|---|---|---|
| q04 `expected` | "Fino alle 19:00 (… sabato 9:00–12:30 e 15:00–19:00)" → same, plus "quindi pausa tra le 12:30 e le 15:00" | Asked at 11:00 on a Saturday: an answer "open until 12:30, then 15:00–19:00" is equally correct; the reference now says so explicitly so the judge does not read "12:30" as a contradiction. Clarification only. |
| gold `g-e03` content | "done 13 Oct, worn cassette replaced with an 11-32" → "service done 13 Oct, worn cassette found and replaced with an 11-32 before pick-up" | On 13 Oct Ettore said the cassette would be changed "appena arriva"; it was replaced by the pick-up on 14 Oct, not on 13 Oct. |

No question had a factual error in `expected` or `must_not`.

## Judged fine but borderline
- **q32 (blue helmet)**: "not known which Marco" is the right gold, but there is a weak lean: "la settimana scorsa" from
  Sat 23 Oct is 11–17 Oct, when Marco Tomasi was at the shop (13 and 14 Oct); Marco Dallapiccola talked to the agent on
  9 and 18 Oct. Presence cannot be inferred from conversations (the tablet is also used remotely, e.g. Rhys at 08:15
  before opening in s12), and the agent itself said it did not know. A hedged guess is not an assertion, so it does
  not hit `must_not`; a flat "it's Marco Tomasi's" is rightly wrong.
- **q27 / s04**: the unidentified speaker opens with "ancora una cosa che mi ero dimenticato" minutes after Marco
  Tomasi — a deliberate carry-over trap. `expected` starts with "No, non risulta"; an answer "not known, possibly him"
  should still be judged correct (it explains the unattributed report).
- **q25 / q28**: the person who left the red city bike (s08) and the woman who collected it saying it was hers (s13) may
  be the same person, but this is never stated; `expected` keeps them apart and mentions both.
- **q03**: a correct answer may quote the 2 €/day storage fee for uncollected bikes; `expected` mentions it, and the
  `must_not` targets only a *winter* storage tariff.
- **q10**: "quanto la paga" — 3,900 € is the price; an answer that adds "net 3,600 € after the bonus" is extra
  arithmetic, not a contradiction (the bonus is a refund by bank transfer, max 300 €).
- **q19 / g-e24**: "più Ettore che guida il giro" comes from the agent (s27), not from Ettore; it is extra context, not
  a key fact.
- **q39**: Katharina's gear adjustment (22 Oct) is another person's job (she is a woman, the s04 speaker is masculine,
  and she reported on 19 Oct); mentioning it as hers is fine.
- **Gold facts**: summer hours end 2032-11-01 while prices end 2032-10-31 — consistent with the effective dates (prices
  from 1 Nov, hours from 2 Nov).
