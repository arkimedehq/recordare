# Blind set: recurring patterns

Measures the nightly **recurring-patterns** pass: does it find the true habits (recall) and never invent false ones
(precision)? A pattern needs at least three episodes on different days of the same person.

## Setting
Fictional people only, written by hand for this set. 100 sessions, 11 Jan – 4 Apr 2027 (all within the 90 days before
the final checkpoint), in Italian, English, Spanish, German and Japanese. Timestamps carry each memory's local offset
(Europe/Rome, London, Madrid, Berlin switch to summer time on 28 March 2027; Kyoto is +09:00). Habits are shown
only through episodes told on the day they happen (varied wording, often among other news), never stated as habits.
Assistant replies are short and never restate a habit (except the deliberate false claims of `marco_gym_claim`).

Checkpoints: `2027-02-28T23:30+01:00` (mid) and `2027-04-10T23:30+02:00` (final).

## Blindness
Written without reading `service/`, `packages/`, `connectors/`, `docs/`, `spikes/memory-eval/systems/`, `RESULTS.md`,
`results/`, any `*.log`, any other dataset's content (in particular `dataset_dev_patterns/`) or `pattern_eval.py`.
Only `DATASET_FORMAT.md` and the tooling structure of `dataset_blind8/build.py` / `check.py` were read. Do not tune
prompts on this set.

## Memories
| memory | kind | language | expected | traps |
|---|---|---|---|---|
| giulia (Bologna) | personal | it | pool on Tuesday evenings; Sunday lunch at her parents' | museums on one Vienna trip (trip cluster); brother's Sunday fishing, told once (another person's habit); two yoga lessons (near-threshold) |
| marco (Torino) | personal | it | calcetto on Thursday evenings; Porta Palazzo market on Saturday mornings | "I'll start running" repeated, never done (plan); "you always go to the gym on Mondays" said only by the assistant; Wednesday yoga only in calendar tool output |
| chiara (Napoli) | personal | it | Sunday-evening video call with her grandmother | Wednesday Spanish class: a pattern at mid checkpoint, quit on 10 March, must be retired at the end (stopped); Friday pizza stated explicitly once ("ordino sempre…") + episodes — already a note, a pattern would duplicate it |
| luca (Milano) | personal | it | Friday-evening aperitivo with Stefano and Paola | one reunion dinner retold three times; two climbing sessions (near-threshold) |
| emma (Edinburgh) | personal | en | choir on Wednesday evenings; parkrun on Saturday mornings | three pub quizzes in one week only; two visits to her mother (near-threshold) |
| lucia (Sevilla) | personal | es | padel on Monday evenings | one flamenco evening (one-off); two Sundays at the Alcázar (near-threshold) |
| jonas (Leipzig) | personal | de | bouldering on Thursday evenings | three morning runs on one Hamburg trip (trip cluster) |
| kenji (Kyoto) | personal | ja | jogging along the Kamo river on Sunday mornings | one onsen day trip (one-off) |
| biblioteca_villa_rosa (Parma) | entity | it | Teresa swaps a mystery on Saturday mornings; Ottavio at the chess club on Tuesday afternoons (both identify themselves: "sono Teresa", "sono Ottavio") | three different people at the knitting workshop once each; an unidentified visitor reading newspapers three times |

13 expected patterns, 18 traps. `checkpoint_expected` (mid) lists the patterns with at least three occurrences by
then, including `chiara_spanish`.

## Files
- `build.py` → `conversations.json`, `patterns_gold.json`, `evidence.json` (session ids behind each gold id and the
  trap kind; for `check.py` only, never shown to a system or the judge).
- `check.py` verifies shape, ids, offsets, the 90-day window, tool-output dates, and that each expected pattern has
  ≥ 3 sessions of its memory on different days, on its weekday and part of day (by the identified person for the
  entity), and each trap matches its kind.

Run: `python3 build.py && python3 check.py`.
