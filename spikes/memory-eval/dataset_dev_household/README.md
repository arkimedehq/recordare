# dataset_dev_household — the growing household (D55 F2b)

An entity memory (`casa_neri`) and a family of four over 14 days from Monday 5 October 2026 (+02:00): Paolo (46),
Marta (44), Luca (16), Giada (9), each recognised by voice (`<name>-voice`, a platform identity). All names are invented.

- `world.json`: the household's 30 facts (`f01`–`f30`), each with the members who know it (`knowers`); members with
  their voice id, a short profile and their patience (questions a day they answer).
- `conversations.json`: 14 days × 3 sessions of everyday talk at home; the facts surface in passing, some never.
- `build.py` writes both.

Run with `household_eval.py` (`EVAL_DATASET=dataset_dev_household`, `HOUSEHOLD_DAYS=<n>` for a pilot, `RUN_TAG`).
Scored: questions a day against facts known (and partial), questions per fact learned, and the errors that must stay
zero — a question to someone who could not know, the same fact asked again of the same person after an answer.
Results: `../RESULTS.md`, "The growing household".
