# holdout_timing — when to deliver an initiative, held out (D55 F2b / F4 / F6, RESEARCH_NOTES H14)

**Held out: do not tune timing policies, rules or knobs on it.** `dataset_dev_timing` was written by the developer who
tuned timing v0–v2 on it, so it cannot tell whether the policies generalise. This set was written **blind** by a
separate author, from the documented rules only — `docs/INITIATIVES_DELIVERY.md` §4–§5c (timing classes, channels
chosen at delivery, presence and voice, v1 / v2), `docs/API.md` §4b, `docs/KNOBS.md` — and common sense about when an
assistant should speak; never from `service/src/`. New households, people and situations; no case copied from the dev set.

Same schema and runner as the dev set: `TIMING_DATASET=dataset_holdout_timing uv run --directory <spike> python
timing_eval.py` (service set-up in `timing_eval.py`'s docstring). No LLM call, deterministic. Times in Rome (CEST,
+02:00), Monday 19 – Saturday 24 October 2026: after the runner's fixed message date (18 October, 12:00) and before
daylight saving ends (25 October).

Three memories, 25 items, 10 event checks:

| Memory | Mode, channels | Items | Checks | What it exercises |
|---|---|---|---|---|
| **Ilaria** | personal; chat + messaging always | 7 + 1 plan | 0 | timed reminders at their minute (one at 06:30, in the quiet hours, she chose); a flexible request within the day's hours; owed requests at their last chance; something already given today and the daily limit (3) pushing a fourth request to the next day; a plan asked about two days after it, in the ask hours, by chat (an ask never goes by message) |
| **Davide** | personal; no channel declared (only the turn) | 3 | 0 | delivery in the turn: quiet hours do not apply there; a timed reminder no channel reaches goes at the first turn before it expires, ahead of what has no time; nothing before it is due. Contents in English (the runner has no per-memory locale) |
| **Casa Lombardi** | entity; chat + messaging always, voice on presence; three people by Home Assistant person, one with a Telegram address | 14 | 10 | messaging only to a real address; one person's item never on the shared chat (one must not be delivered at all); `home` gives nothing; quiet hours for voice; arrival vs refresh; the 30-minute voice pace; someone unnamed (ask who, name no one) and an unsure recognition get nothing; a private item needs a sure recognition; the opening with others present and the "yes" in a turn; v2: the 3-hour pause after a refusal, the 1-hour pause after an ignore, `busy` holding a flexible request on every channel while a chosen time goes anyway, `talking` holding the opening |

Each item's `why` states its rule in one line; "(judgement)" marks the golds where the docs are silent and the author
chose what a thoughtful person would expect (four: Ilaria's last chance up to 22:00, Davide told at 23:10 in his own
turn, and Bruno's arrival held over two impulses during a conversation — item and event check). Windows are wide
except for timed reminders and presence-triggered deliveries, whose moment the timeline fixes.

Scored per item as the dev set (`in_window`, `outside`, `wrong_trigger`, `wrong_channel`, `no_opening`, `lapsed`,
`rightly_silent`, `wrong_delivery`) and per event check. Fictional content. `python build.py` writes `timelines.json`;
`python check.py` verifies it.
