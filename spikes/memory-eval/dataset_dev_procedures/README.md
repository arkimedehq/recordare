# dataset_dev_procedures — procedures kept whole (WORK_PLAN 8.16 F2b–F2c, D57)

Not blind (written with the feature). An invented household and invented sites (`*-esempio.it`): an entity memory "Casa"
(Europe/Rome) with procedures from sources switched on (`proceduresFromSources`); Sofia (voice bound, a verified identity:
household); a guest nobody recognised.

Nine conversations over two days, ingested as of their own time and extracted by the service, and one source sent alone:
a how-to read in a page because the household asked for the task (making the bed), Sofia's way of the pillow, the
dishwasher taught in words, how cheese is made asked out of curiosity (no procedure), the garage gate told by the guest
(pending), a washing-machine filter page with an order hidden among its steps (left out; no intent), the boiler manual
sent in conversation for a task (mode B2, recognised by the extraction: `sources_for_task`), an article sent for
curiosity (not read), a vacuum guide sent with `forTask` (B2, explicit).

Run with `EVAL_DATASET=dataset_dev_procedures uv run python learning_eval.py` against a service with
`ALLOW_CLOCK_OVERRIDE=true` and a short `IDLE_DELAY_SECONDS`; ten database checks and six questions (memory context and the
read tools, `search_knowledge` included). Results in `RESULTS.md`.
