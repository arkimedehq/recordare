# dataset_dev_learned_initiatives — initiatives from learned knowledge and the learning loop (WORK_PLAN 8.16 F3, D57)

Not blind (a dev set); invented household, invented sites. One entity memory, Italian, Europe/Rome. People: Sofia
(household, a verified identity) and Matteo (a son who talks to the agent and takes bus 90; not verified).

What it measures, on the real extraction and wording model:
- something read that touches a known life and is ahead becomes an initiative for that person, with its source:
  asked as unchecked from an untrusted site (the bus strike, k1), told from the agent's own tool once the memory is past
  its first stage (the gym, k2);
- news touching nobody and an instruction hidden in a page make no initiative (k3, k4);
- the learning loop, one question at a time to the household member trusted most: a page contradicting the pharmacy's
  hours Sofia gave is asked about with both versions (k5); Sofia holds to hers — the page's version leaves, the page
  loses trust (k6–k8); a failed step of a procedure read is asked about (k9) and Sofia's answer becomes the household's
  way of it (k10); knowledge of the place read and pending is asked about (k11) and Sofia's yes confirms it (k12);
- three questions to the agent afterwards (q1–q3).

Steps beyond messages: `{"run": …}` reports a run of a procedure, `{"sweep": at}` runs the initiative sweep as of that
moment, a message `{"initiative": kind}` is the agent saying the initiative it was given (reported asked).

Run with the service's `LEARNING_OWN_TOOLS=^calendario` and `LEARNING_STAGE_YOUNG=3`:

    EVAL_DATASET=dataset_dev_learned_initiatives uv run python learning_eval.py
