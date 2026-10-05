# dataset_blind5 — gold audit (independent second reader)

Audit of `questions.json` / `gold.json` / `noise.json` against `conversations.json`, done blind: no engine
code, prompts, results, other datasets' questions or gold were read. Read only `evalkit/common.py`
(loaders, answer and judge prompts), the `--noise` handling of `run_eval.py`, and `docs/RESEARCH_NOTES.md` § H1.

## Method

1. Read all 60 sessions in order with the computed weekday of every timestamp (Europe/Rome; DST from
   Sunday 25 March 2029 verified: `+01:00` before, `+02:00` after). Every relative or partial date in the
   dialogue ("ieri sera, martedì", "sabato prossimo, il 12", "da lunedì", "venerdì mamma è tornata") was
   resolved against the 2029 calendar (printed with `calendar.month`) and cross-checked with the later
   session that confirms it (e.g. baby shower Sun 18 → Sat 17; lesson 3 "on Sunday" told Tue 5 June → 3 June;
   Giulia "ieri sera alle 23:40" told Sat 28 April 09:30 → Fri 27 April; Irina "domani, lunedì" → 18 June).
2. Read all 87 questions. For each: the set of sessions with `ts ≤ asked_at` was taken as the only
   knowledge (mid-period questions: 38; end-of-period at 10 July 22:00: 49), and `expected` / `must_not`
   were checked for correctness, completeness, ambiguity and category. Relative weeks are Monday-based
   relative to `asked_at`; the six windows were recomputed by hand and compared with `QUIET` in
   `gen_noise.py` and with the ESSENTIAL / SECONDARY items.
3. Counts recounted from the sessions: sailing lessons (20 May, 27 May, 3 June, 10 June, 8 July = 5;
   17 June cancelled, 24 June skipped, 1 July in Dublin; 3 of 8 left), book-club meetings attended
   (6 March, 3 April, 8 May = 3; February cancelled, 5 June skipped), Don Saro dinners (8 March, 9 May = 2),
   Greek-theatre shows (Medea 26 May with Lina, Edipo re 8 June with Enzo = 2).
4. Group chats (s14, s30, s32): roles `other` + `author` for the other speakers, Nunzia's own lines as
   `user`, no assistant turns; Nunzia never replies to Rita's Malta claim or Tano's claims.
5. Noise: `noise.json` saved aside, `gen_noise.py` re-run, `cmp` → byte-identical (seed 2029). All user
   turns of the noise were grepped for the sensitive lexicon (Excel / email / speech / interview / packing,
   Federfarma / Marzamemi / Consoli, blood type / football / siblings, allergy / debts, and the owner's
   event vocabulary): the first-person hits are all in `carmelo` sessions (isolation users); Nunzia's
   noise is general knowledge, tech filler or remarks clearly attributed to other people, and the quiet
   windows hold only tech filler (also checked by `check.py`).
6. `gold.json`: every episode's date, kind, outcome and sessions were matched session by session
   (all 60 sessions are covered by at least one episode, fact or not-memory); facts' world-time history,
   notes and not-memories compared with the dialogue.
7. `build.py` re-run before any edit: it reproduced the three JSON files byte for byte, so the Python sources
   were edited and the JSON rebuilt (sources and JSON remain consistent). Then `gen_noise.py`, `check.py`
   (OK, 116 weekday mentions checked) and the loaders (`60 87 nunzia`).

## Findings — questions (87 checked)

All 87 `expected` answers are correct for the knowledge available at `asked_at`; dates and weekdays are
right; categories fit. Points verified in particular:

- Twice-rescheduled visit (e38, e75, e29, e79): 6 Mar 10:30 → 20 Mar 11:00 (conference) → 3 Apr 9:00
  (flu), took place 3 April; ramipril from 4 April ("a partire da domani" said on 3 April).
- Unresolved plans (e41, e42, e43, e74; e16/e18 overviews): Federfarma 26 May, Marzamemi 16 June and the
  Carmen Consoli concert 22 June are never resolved in any later session; both outcomes are in `must_not`.
- Corrections as known at `asked_at`: e09 (16 March) correctly keeps the baby shower "indicated for Sunday
  18" (corrected 17 March); e46 (20 March) has the correction; e44 (30 April 10:00) uses the 26 April price
  correction; e45 (1 June) uses the 8 May name correction; e73 (10 May) gives €12,800.
- Implicit changes (e47, e48, e49): hedged inference accepted, over-claiming rejected; the evidence cited
  (19 April last rehearsal, 21 June "il giovedì sera lo passo da lei", 10 July intercom, 5 July photo) is
  in the sessions.
- Provenance (e68–e71): request dates 10 Feb, 27 Feb, 28 Mar, 23 May match; e70/e71 `must_not` block the
  event dates (6 April interview, 2 June party).
- Poisoning probes (e82–e84): Rita's claim and Tano's message are unconfirmed in s30; e82 at 1 May says
  "about to start in Noto" (start 2 May) — correct at that date.
- Premise traps (e72–e75), negatives (e85–e87: no blood type, team or sibling of Nunzia anywhere in her
  sessions or her noise), cross-language (e79–e81), last-time (e05–e08: 10 June lesson, 8 May book club,
  19 April rehearsal, 9 May Don Saro) all check out.
- Relative weeks: e09 (12–18 Mar: s14 of Sun 11 March and the 8 March dinner fall in the previous week),
  e10 (7–13 May: shelter visit 5 May excluded), e11 (18–24 Jun: mother home on Fri 15 June excluded; s52 at
  22:15 ≤ asked_at 23:30), e12 (19–25 Mar), e13 (9–15 Apr: job call Mon 16 April 19:30 is "this week"),
  e14 (2–8 Jul: engagement 29 June excluded) — all consistent.
- Timing edge cases: e33 asked 20 May 10:00 (first lesson at 19:00 not yet known — fine, not needed);
  e54 asked 1 April 10:00 (s21 at 21:00 not needed); e60 asked 5 May 10:00 (s36 at 18:00 not needed).

## Changes (2, both `must_not`; sources edited in `_questions.py`, JSON rebuilt)

| id | before | after | why |
|---|---|---|---|
| e17 | `a febbraio tu ed Enzo vi siete messi insieme` | `a febbraio tu ed Enzo eravate già una coppia (il primo bacio e lo «stiamo insieme» sono dell'8 marzo; a febbraio vi siete solo conosciuti e avete preso un caffè)` | The old wording was loose: a correct February summary ("hai iniziato a frequentare / uscire con Enzo") could be read by the judge as asserting it. The claim to reject is the relationship status, which starts 8 March; the new text says exactly that. |
| e58 | `l'hai trovato noioso perché non succede niente (era il giudizio di Lina su Lessico famigliare)` | `Lina lo ha trovato noioso / non le è piaciuto (Lina lo adora)` | Nunzia's own verdict on Il Gattopardo ("lento, troppe descrizioni, fatica ad arrivare in fondo") is near-synonymous with "noioso": a correct paraphrase could trip the old `must_not`. The intended trap (mixing up Lina's and Nunzia's opinions) is kept with a claim that is genuinely false: Lina adores the book. |

No question was dropped or rewritten; no question was made easier (both edits narrow a `must_not` to a
claim that is actually false, leaving `expected` untouched).

## gold.json

No change needed. Verified: 71 episodes (dates, kinds, `plan_outcome`, sessions — e.g. g-e03 Dublin
rescheduled 7–14 Jun → 28 Jun–5 Jul and taken; g-e06 visit rescheduled twice; g-e41/g-e53/g-e56
unresolved; g-e23/g-e27/g-e58 cancelled; g-e02 February book club = Tue 6 Feb; g-e38 mother to Villa Mimosa
from Mon 30 April; g-e59 mother home Fri 15 June), 13 facts with world-time history (employer to 30 Apr /
from 2 May; home from 23 Jun; car from 26 Apr; pets accumulate; relationship from 8 Mar with inferred
cohabitation from 10 Jul; medication from 4 Apr; choir inferred stop; deputy `corrected_from` Ferro),
7 notes (birth year 1971 consistent with 58 on 9 May 2029), 9 not-memories (help-request contents, the two
group-chat claims, other users, Nunzia's off-topic noise).

## noise.json

Regenerated and byte-identical. No noise session can change an answer: Nunzia's 130 sessions contain no
first-person event or state; `carmelo` (25) carries the mirrored first-person traps and `giada` (15) an
unrelated life, both under other user ids; the six relative-week windows contain only tech filler.

## Residual doubts (not changed)

- Overviews e15 (8 ESSENTIAL items), e16 (7) and e18 (6) are demanding; they follow the dataset's own
  ESSENTIAL / SECONDARY convention and are correct, so they were left as written. Expect `partial`
  verdicts for systems that recall most but not all essential items.
- e29 (`Da quando prendo il ramipril?`): the reference says 4 April (first tablet) and mentions the
  3 April prescription; an answer "dal 3 aprile" should be judged correct or partial thanks to the
  parenthesis, but it is a judge call.
- e01 places the surgery at the Avola hospital: the dialogue says she wrote from the Avola hospital on
  11 April and stayed there on 13 April, so the location is implied rather than stated; it is not a key
  fact of the question (the date is).
- e17 `must_not` "la visita cardiologica è già stata fatta" relies on the judge treating "visita prenotata
  per il 6 marzo" as not asserting it happened (the judge prompt covers this: future / history roles are
  not violations).

## Final counts

60 sessions (+170 noise: 130 nunzia, 25 carmelo, 15 giada), 87 questions (63 IT / 24 EN; 38 mid-period,
49 at 10 July 22:00), 24 categories each with ≥ 3 questions, 71 gold episodes, 13 facts, 7 notes,
9 not-memories. `check.py`: OK. Loaders: `60 87 nunzia`.
