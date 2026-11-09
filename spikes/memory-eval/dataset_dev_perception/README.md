# dataset_dev_perception — perceptions (WORK_PLAN 8.12e)

Dev set, not blind (written with the feature, 2026-11-09). Invented household: an entity memory "Casa" (Europe/Rome),
Viola and Tommaso with voice and face identities. `timeline.json`: the introductions, six perceptions posted as of their
time (one a repeat), one message telling what a perception was, two phases (a consolidation as of that day, the count of
perceived episodes left, questions). `questions.json` only exists for the judge (no holder: an entity memory).

Run (a service with `ALLOW_CLOCK_OVERRIDE=true` and a short `IDLE_DELAY_SECONDS`, migrations applied):

    EVAL_DATASET=dataset_dev_perception uv run python perception_eval.py

Covers: when / who seen, a stranger never named, seen vs told, nothing invented about what was not seen, a perception
forgotten after its keep time while what a person said about it and a long-kept one stay. Results: RESULTS.md.
