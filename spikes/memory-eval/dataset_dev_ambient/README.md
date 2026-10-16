# Dev set — continuous listening (`ambient`, NOT blind)

WORK_PLAN 6.5 (3): the dev set measured before continuous listening is enabled. Personal memory of Stefano (41,
surveyor, Padova), November 2026, fictional people. Sources: `_sessions.py`, `_questions.py`; `python build.py` writes
`conversations.json` and `questions.json`, `python check.py` validates them (run both with the spike's `uv run`).

## Shape
- 13 sessions: 9 `ambient` (a living-room device's transcripts; nobody talks to the assistant) and 4 `chat` (Stefano
  writing to his assistant). The household: Stefano (holder, `user`), his son Leo (14) and his mother Rosanna (declared
  with platform identities `leo-ferri`, `rosanna-ferri`), his sister Chiara (a nurse from Turin, visiting 7–22 November;
  a guest voice known by name only); unrecognised voices (TV, Leo's friend Matteo) are `other` without author.
- 30 questions: heard 8, garbled 8, background 1, misattributed 5, confirmed 2, unconfirmed 3, control 3; asked at
  four moments (10, 14, 20 and 24 November), so a garbled detail is asked before and after a chat resolves it.

## What it exercises
- **Wrong speaker labels** (the gold never makes them the holder's): «Paolo mio marito…» given to Stefano, who is
  separated from Giulia (s02, q18–q19); the night shifts of a nurse given to Stefano, a surveyor (s03, q20); «a marzo
  compio trentanove anni, festa a Torino» given to Stefano, who is 41 (s12, q21); the reverse — Stefano's «domani la
  porto io dal meccanico» given to Leo, who is 14, then confirmed by Stefano in a chat (s05–s06, q22).
- **Speech-recognition errors**: a place heard as common words («a solo» = Asolo, resolved by a chat: q09 before,
  q10 after; «cassa del franco», never resolved: q14); a name heard as a common word («la Cina», q15; «la prof sa non»,
  q16); a day lost to noise («Il di… [rumore] …cembre», q11 before the chat, q12 after); an hour lost to noise («alle
  [rumore di piatti] e un quarto», q13); overlapping talk cut in pieces (s03, q02); fragments and filler; TV lines
  (an ad, the weather, a quiz, train-strike news; q17).
- **Pending until confirmed**: facts heard in the room and said again in a chat (quit smoking: s02 → s09, q23; German
  course: s04 → s06, q24; the Panda: q22; the eye exam: q12), and facts heard only in the room (selling the motorbike
  q25, walnut allergy q26, the via Tiziano site q27). For those three the gold accepts an answer that reports them as
  said / heard at home, with or without "not confirmed": the episodes hold them even while the facts stay pending.
- Controls from the chats (q28–q30), including that the misattributed nurse lines do not leak into Stefano's job.

## What the service's dump should show (`dump()`, facts / notes `pending`)
Pending after the run: the motorbike, the walnut allergy, the via Tiziano site (and anything else drawn from the room
only). Not pending: the quit date (17 October) and the German course, if the chats' extraction kept the same item
(a `keep` on a fact heard in the room confirms it). Never a fact of Stefano's: married to Paolo, night shifts, 39 in
March.

## How to run (paid run: the maintainer decides)
```
EVAL_DATASET=dataset_dev_ambient RUN_TAG=ambient uv run --directory <spike> python run_eval.py --system service
EVAL_DATASET=dataset_dev_ambient RUN_TAG=as-voice EVAL_SOURCE_AMBIENT_AS=voice uv run --directory <spike> python run_eval.py --system service
```
The second arm sends the same transcripts as `voice` (no ambient note, nothing pending).

Not blind: never use it to confirm a decision.
