# dev_timing — when to deliver an initiative (D55 F2b, RESEARCH_NOTES H14)

Timelines replayed against a running service with a moving clock (`timing_eval.py`): **no LLM call**, deterministic.
Two memories over Monday 19 – Wednesday 21 October 2026 (Rome): Giulia (personal; chat and messaging that always reach
her) and Casa Rossi (entity; a shared kitchen panel, voice on presence; Eriona and Luca known by their voice). Nine
items — intents as the extraction writes them, one plan the sweep asks about — each with a gold: the acceptable
windows (and the trigger, when only a presence or a turn may deliver it) or "must not be delivered". Events: a turn of
Giulia's, five presence impulses (a stranger, Eriona unsure, Eriona sure, Eriona by voice and by camera).

Scored per item: `in_window`, `outside` (a needless interruption), `wrong_trigger`, `lapsed`, `rightly_silent`,
`wrong_delivery`. Fictional content. `python build.py` writes `timelines.json`; `python check.py` verifies it.
Written by the developer who tuned timing v0 on it: a held-out set is still owed.
