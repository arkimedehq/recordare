# dev_timing — when to deliver an initiative (D55 F2b, RESEARCH_NOTES H14)

Timelines replayed against a running service with a moving clock (`timing_eval.py`): **no LLM call**, deterministic.
Two memories over Monday 19 – Wednesday 21 October 2026 (Rome): Giulia (personal; chat and messaging that always reach
her) and Casa Rossi (entity; a shared kitchen panel, voice on presence; Eriona and Luca known by their voice). Nine
items — intents as the extraction writes them, one plan the sweep asks about — each with a gold: the acceptable
windows (and the trigger, when only a presence or a turn may deliver it) or "must not be delivered". Events: a turn of
Giulia's, five presence impulses (a stranger, Eriona unsure, Eriona sure, Eriona by voice and by camera).

A third memory (2026-11-06), **Casa Bianchi** (entity; voice in the kitchen and the living room, Eriona and Luca known by
their Home Assistant person, Luca with a Telegram address), measures D55 §5c: presence by place (`people`, `place`,
`someone`, `left`, the `home` channel), arrival vs refresh, the 30-minute voice pace, quiet hours for voice, the opening
when others are in the room and the person's "yes" in a turn, the clock reading live presences, messaging only to a
real address. Eight items (b1–b9) and two event checks (`expect` on a presence: nothing given and "who is it?" for
someone unnamed; only the opening with others there).

A fourth memory (2026-11-06), **Casa Verdi**, measures timing v1 (D55 F4): its `behavior` says how Sara takes what is
said by part of the day (the morning voice ignored, the evening one taken), and `timing_eval.py` reports each
initiative's outcome accordingly — the outcomes v1 learns from. Six days (19–24 October: daylight saving ends on the
25th and the set's times are fixed +02:00).

A fifth memory (2026-11-07), **Casa Neri**, measures timing v2 (D55 F6): a refusal reported as an `outcome` event (the
pause that follows), a client's `busy` on a presence (a call; the arrival stays owed, a chosen time goes anyway) and
`talking` (the opening waits for a pause). Five items (n1–n5), three event checks.

Scored per item: `in_window`, `outside` (a needless interruption), `wrong_trigger`, `wrong_channel`, `no_opening`,
`lapsed`, `rightly_silent`, `wrong_delivery`. Fictional content. `python build.py` writes `timelines.json`; `python check.py` verifies it.
Written by the developer who tuned timing v0 on it: a held-out set is still owed.
