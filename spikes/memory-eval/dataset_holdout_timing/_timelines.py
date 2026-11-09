# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""holdout_timing (D55 F2b / F4 / F6, RESEARCH_NOTES H14): a held-out set of timelines for initiative timing, written
blind — from INITIATIVES_DELIVERY.md, API.md §4b and KNOBS.md, never from the implementation — by an author other than
the one who tuned the policies. Do not tune on it. Same schema as dataset_dev_timing (timing_eval.py reads both).

Fictional content. Times in Rome (CEST, +02:00), Monday 19 – Saturday 24 October 2026: after the runner's fixed
message date (2026-10-18 12:00) and before daylight saving ends (2026-10-25 03:00 CEST). Each item is an intent as the
extraction would write it (the runner writes every item as a request) or a plan the sweep asks about; `gold` gives the
acceptable windows (`via` when only a presence or a turn may deliver it, `channel` when the channel is determined,
`opened` when only the opening may be said first) or `deliver: false`. `why` states the rule in one line; "(judgement)"
marks a gold where the docs are silent and the author chose what a thoughtful person would expect."""

TZ = "+02:00"


def t(day: int, hhmm: str) -> str:
    return f"2026-10-{day:02d}T{hhmm}:00{TZ}"


def room(day: int, hhmm: str, place: str, people: list, **extra) -> dict:
    """A presence impulse for a room with a voice point, as a Home Assistant host describes it."""
    return {"at": t(day, hhmm), "type": "presence", "channel": extra.pop("channel", "voice"), "place": place, "people": people, **extra}


BRUNO, NIVES, OTTAVIA = "person.bruno_l", "person.nives_l", "person.ottavia_l"

MEMORIES = [
    {
        # Personal memory: chat and messaging that always reach Ilaria. Timed reminders (one at a time she chose in the
        # quiet hours), flexible requests within the day's hours, the daily limit and "already given today", owed
        # requests at their last chance, a plan asked about two days after it.
        "id": "ilaria", "name": "Ilaria", "mode": "personal",
        "channels": [{"kind": "chat", "reach": "always"}, {"kind": "messaging", "reach": "always"}],
        "people": [],
        "messages": [],
        "items": [
            {"id": "i1", "content": "prendere il collirio", "due": t(19, "08:15"), "until": t(19, "20:00"), "timed": True,
             "gold": {"windows": [[t(19, "08:15"), t(19, "08:30")]]},
             "why": "a reminder asked for 08:15: given at 08:15, not later in the day"},
            {"id": "i3", "content": "rinnovare l'abbonamento della piscina", "due": t(19, "00:00"), "until": t(20, "00:00"),
             "gold": {"windows": [[t(19, "09:00"), t(19, "22:00")]]},
             "why": "a request for the day with no time, i1 already given: within the day's hours, before the quiet hours at "
                    "22 (judgement: an owed request at its last chance up to 22:00 is acceptable)"},
            {"id": "i2", "content": "svegliare Corrado per il treno", "due": t(20, "06:30"), "until": t(20, "12:00"), "timed": True,
             "gold": {"windows": [[t(20, "06:30"), t(20, "06:45")]]},
             "why": "she asked for 06:30, inside the quiet hours: a time the person chose goes anyway"},
            {"id": "i4", "content": "spedire il pacco alla zia Teresa", "due": t(21, "09:00"), "until": t(21, "21:00"),
             "gold": {"windows": [[t(21, "09:00"), t(21, "21:00")]]},
             "why": "a request owed today: given during the day (first, or at its last chance after others)"},
            {"id": "i5", "content": "disdire la palestra", "due": t(21, "09:00"), "until": t(21, "21:00"),
             "gold": {"windows": [[t(21, "09:00"), t(21, "21:00")]]},
             "why": "a request owed today: given during the day (first, or at its last chance after others)"},
            {"id": "i6", "content": "togliere il pane dal forno", "due": t(21, "12:00"), "until": t(21, "18:00"), "timed": True,
             "gold": {"windows": [[t(21, "12:00"), t(21, "12:15")]]},
             "why": "asked for 12:00: at its time, however many things she got today"},
            {"id": "i7", "content": "prenotare il ristorante per sabato", "due": t(21, "15:00"), "until": t(22, "21:00"),
             "gold": {"windows": [[t(22, "09:00"), t(22, "21:00")]]},
             "why": "Wednesday already brings her three things (the daily limit, 3) and this one may wait: given Thursday "
                    "in the day, not Wednesday"},
        ],
        "plans": [
            {"id": "i8", "content": "Cena di compleanno di Corrado", "at": t(20, "20:00"),
             "gold": {"windows": [[t(22, "10:00"), t(22, "20:00")], [t(23, "10:00"), t(23, "20:00")], [t(24, "10:00"), t(24, "20:00")]],
                      "channel": "chat"},
             "why": "asking how Tuesday's dinner went: two days after it at the earliest, in the ask hours (10–20), by chat — "
                    "an ask never interrupts by message"},
        ],
        "events": [],
    },
    {
        # Personal memory whose client declares no channel: only the turn reaches Davide (the memory context before each
        # turn). The contents are English (the runner has no per-memory locale: the language only varies the text).
        "id": "davide", "name": "Davide", "mode": "personal",
        "channels": [],
        "people": [],
        "messages": [],
        "items": [
            {"id": "d1", "content": "send the birthday card to aunt Wilma", "due": t(19, "09:00"), "until": t(20, "09:00"),
             "gold": {"windows": [[t(19, "23:10"), t(19, "23:20")]], "via": ["turn"], "channel": "turn"},
             "why": "no channel reaches him but the turn: said when he writes at 23:10 — quiet hours do not apply in the turn, "
                    "and he asks what he forgot (judgement)"},
            {"id": "d2", "content": "take the bread out of the freezer", "due": t(20, "07:00"), "until": t(20, "12:00"), "timed": True,
             "gold": {"windows": [[t(20, "07:40"), t(20, "07:50")]], "via": ["turn"], "channel": "turn"},
             "why": "a timed reminder no channel reaches at 07:00: at his first turn before it expires (07:40), ahead of "
                    "anything without a time"},
            {"id": "d3", "content": "renew the parking permit", "due": t(20, "10:00"), "until": t(21, "10:00"),
             "gold": {"windows": [[t(20, "12:30"), t(20, "12:40")]], "via": ["turn"], "channel": "turn"},
             "why": "not at the 09:00 turn (not due yet); due at 10:00: the next turn, 12:30"},
        ],
        "plans": [],
        "events": [
            {"at": t(19, "23:10"), "type": "turn", "conversation": "davide-chat", "text": "Can't sleep. Anything I forgot today?"},
            {"at": t(20, "07:40"), "type": "turn", "conversation": "davide-chat", "text": "Morning! Coffee first, then the day."},
            {"at": t(20, "09:00"), "type": "turn", "conversation": "davide-chat", "text": "On the train now, what's the weather like?"},
            {"at": t(20, "12:30"), "type": "turn", "conversation": "davide-chat", "text": "Lunch break. Anything for me?"},
        ],
    },
    {
        # Entity memory: Casa Lombardi, chat and messaging declared, voice in the kitchen, the study, the living room and the
        # garage; Ottavia, Bruno and Nives known by their Home Assistant person, only Ottavia with a Telegram address.
        # Covers: messaging only to a real address, the shared chat never used for one person, "at home" giving nothing,
        # quiet hours for voice, arrival vs refresh, the 30-minute pace, an unnamed person and an unsure recognition, a
        # private item needing a sure one, the opening with others present, and timing v2 (a refusal, an ignore, busy,
        # talking, a chosen time while busy).
        "id": "casa_lombardi", "name": "Casa Lombardi", "mode": "entity",
        "channels": [{"kind": "chat", "reach": "always"}, {"kind": "messaging", "reach": "always"}, {"kind": "voice", "reach": "presence"}],
        "people": [{"name": "Ottavia", "ha": OTTAVIA, "telegram": "tg-4711"},
                   {"name": "Bruno", "ha": BRUNO},
                   {"name": "Nives", "ha": NIVES}],
        "messages": [
            {"id": "m-nives-private", "conversation": "nives-chat", "author": "Nives", "private": True,
             "text": "Ricordami giovedì di ritirare gli esami del sangue."},
        ],
        "items": [
            {"id": "l2", "content": "chiudere l'acqua del giardino", "for": "Bruno", "due": t(19, "17:00"), "until": t(20, "17:00"), "timed": True,
             "gold": {"windows": [[t(19, "18:20"), t(19, "18:35")]], "via": ["presence"], "channel": "voice"},
             "why": "asked for 17:00, but Bruno has no messaging address and is only 'at home': no message, never the shared "
                    "chat; said at his first room presence (the kitchen at 18:20)"},
            {"id": "l3", "content": "sistemare la mensola dello studio", "for": "Bruno", "due": t(19, "20:00"), "until": t(20, "21:00"),
             "gold": {"windows": [[t(20, "09:10"), t(20, "09:25")]], "via": ["presence"], "channel": "voice"},
             "why": "flexible: not at his arrivals at 22:30 or 07:30 (quiet hours apply to voice), said at his arrival in "
                    "the study at 09:10"},
            {"id": "l4", "content": "comprare le lampadine", "for": "Bruno", "due": t(20, "09:30"), "until": t(20, "21:00"),
             "gold": {"windows": [[t(20, "10:30"), t(20, "10:45")]], "via": ["presence"], "channel": "voice"},
             "why": "not at his kitchen arrival at 09:35 (25 minutes after l3: the 30-minute pace) nor the 09:50 refresh; "
                    "said at his living-room arrival at 10:30"},
            {"id": "l5", "content": "prenotare il tagliando dell'auto", "for": "Ottavia", "due": t(21, "09:00"), "until": t(21, "21:00"),
             "gold": {"windows": [[t(21, "09:00"), t(21, "21:00")]], "channel": "messaging"},
             "why": "a request for Ottavia, never in a room that day, with a Telegram address: by message during the day"},
            {"id": "l6", "content": "restituire il trapano al vicino", "for": "Bruno", "due": t(21, "09:00"), "until": t(21, "20:00"),
             "gold": {"deliver": False},
             "why": "for Bruno, no address, never present that day: never on the shared chat, never by message — lapses"},
            {"id": "l12", "content": "potare le rose", "for": "Nives", "due": t(21, "08:00"), "until": t(21, "21:00"),
             "gold": {"windows": [[t(21, "09:00"), t(21, "09:15")]], "via": ["presence"], "channel": "voice"},
             "why": "Nives walks into the kitchen at 09:00: said at her arrival (she declines it at 09:04)"},
            {"id": "l13", "content": "lavare il tappeto del bagno", "for": "Nives", "due": t(21, "09:30"), "until": t(21, "21:00"),
             "gold": {"windows": [[t(21, "12:20"), t(21, "12:35")]], "via": ["presence"], "channel": "voice"},
             "why": "she declined something at 09:04: not at her living-room arrival at 10:30 (within 3 hours), said at her "
                    "kitchen arrival at 12:20"},
            {"id": "l8", "content": "ritirare gli esami del sangue", "for": "Nives", "message": "m-nives-private",
             "due": t(22, "09:00"), "until": t(22, "12:00"),
             "gold": {"windows": [[t(22, "10:40"), t(22, "10:55")]], "via": ["presence"]},
             "why": "from her private message: not to someone unnamed (09:30), not to a 0.7 recognition (10:00); given to the "
                    "sure one (0.92, the study camera, 10:40)"},
            {"id": "l7", "content": "firmare il modulo della gita", "for": "Nives", "due": t(22, "14:00"), "until": t(22, "21:00"),
             "gold": {"windows": [[t(22, "16:00"), t(22, "16:15")]], "via": ["turn"], "channel": "turn", "opened": [t(22, "16:00"), t(22, "16:05")]},
             "why": "she walks into the living room with someone the house cannot name: only the opening; her \"yes\" at "
                    "16:02 gets it in the turn"},
            {"id": "l11", "content": "chiamare il notaio", "for": "Ottavia", "due": t(23, "10:00"), "until": t(23, "18:00"), "timed": True,
             "gold": {"windows": [[t(23, "10:00"), t(23, "10:15")]], "channel": "messaging"},
             "why": "asked for 10:00 while a client says she is busy: a time she chose goes anyway, by message to her address"},
            {"id": "l10", "content": "rispondere alla mail dell'amministratore", "for": "Ottavia", "due": t(23, "09:00"), "until": t(23, "21:00"),
             "gold": {"windows": [[t(23, "11:30"), t(23, "21:00")]], "channel": "messaging"},
             "why": "flexible while she is busy (08:50 – 11:30): held on every channel, by message once she is free"},
            {"id": "l9", "content": "chiamare l'assicurazione", "for": "Bruno", "due": t(23, "17:00"), "until": t(23, "21:00"),
             "gold": {"windows": [[t(23, "18:03"), t(23, "18:20")]], "via": ["turn"], "channel": "turn", "opened": [t(23, "18:03"), t(23, "18:05")]},
             "why": "he arrives in the living room at 18:00 while people are talking (and at 18:01): no opening; at 18:03 "
                    "nobody talking — his arrival still owed — the opening; his \"yes\" gets it (judgement: an arrival held "
                    "over two impulses stays owed)"},
            {"id": "l14", "content": "pulire la griglia del barbecue", "for": "Bruno", "due": t(24, "09:00"), "until": t(24, "20:00"),
             "gold": {"windows": [[t(24, "10:00"), t(24, "10:15")]], "via": ["presence"], "channel": "voice"},
             "why": "Bruno walks into the kitchen at 10:00: said at his arrival (he ignores it, reported at 10:03)"},
            {"id": "l15", "content": "gonfiare le gomme della bici", "for": "Bruno", "due": t(24, "10:30"), "until": t(24, "20:00"),
             "gold": {"windows": [[t(24, "11:20"), t(24, "11:35")]], "via": ["presence"], "channel": "voice"},
             "why": "he let l14 go right after it was said: not at his garage arrival at 10:40 (the pace is over, the 1-hour "
                    "pause is not), said at his kitchen arrival at 11:20"},
        ],
        "plans": [],
        "events": [
            # Monday: Bruno at home (nothing), then the kitchen; a living-room arrival in the quiet hours.
            {"at": t(19, "17:05"), "type": "presence", "channel": "home", "people": [[BRUNO, 1.0]], "ttl": 3600,
             "expect": {"initiative": False},
             "why": "Bruno only 'at home' while l2 is owed: at home is not enough to speak"},
            room(19, "18:20", "Cucina", [[BRUNO, 0.9]]),
            room(19, "18:40", "Cucina", [[BRUNO, 0.9]], left=True),
            room(19, "22:30", "Soggiorno", [[BRUNO, 0.9]], expect={"initiative": False},
                 why="an arrival in the quiet hours while l3 (flexible) is due: held"),
            room(19, "22:50", "Soggiorno", [[BRUNO, 0.9]], left=True),
            # Tuesday: arrival at 07:30 (quiet), arrival in the study, the pace, a refresh, an arrival after the pace.
            room(20, "07:30", "Cucina", [[BRUNO, 0.9]]),
            room(20, "07:50", "Cucina", [[BRUNO, 0.9]], left=True),
            room(20, "09:10", "Studio", [[BRUNO, 0.9]]),
            room(20, "09:25", "Studio", [[BRUNO, 0.9]], left=True),
            room(20, "09:35", "Cucina", [[BRUNO, 0.9]], expect={"initiative": False},
                 why="an arrival 25 minutes after l3 was said: within the 30-minute pace, l4 waits"),
            room(20, "09:50", "Cucina", [[BRUNO, 0.9]]),
            room(20, "10:00", "Cucina", [[BRUNO, 0.9]], left=True),
            room(20, "10:30", "Soggiorno", [[BRUNO, 0.9]]),
            room(20, "10:50", "Soggiorno", [[BRUNO, 0.9]], left=True),
            # Wednesday: Nives declines at 09:04; the 3-hour pause.
            room(21, "09:00", "Cucina", [[NIVES, 0.9]]),
            {"at": t(21, "09:04"), "type": "outcome", "content": "potare le rose", "status": "declined"},
            room(21, "09:20", "Cucina", [[NIVES, 0.9]], left=True),
            room(21, "10:30", "Soggiorno", [[NIVES, 0.9]], expect={"initiative": False},
                 why="an arrival 86 minutes after a refusal: the 3-hour pause holds l13"),
            room(21, "11:15", "Soggiorno", [[NIVES, 0.9]], left=True),
            room(21, "12:20", "Cucina", [[NIVES, 0.9]]),
            room(21, "12:40", "Cucina", [[NIVES, 0.9]], left=True),
            # Thursday: someone unnamed, Nives unsure, Nives sure; the opening with someone else in the room.
            {"at": t(22, "09:30"), "type": "presence", "channel": "voice", "place": "Cucina", "someone": 1, "ttl": 300,
             "expect": {"initiative": False, "askWho": True},
             "why": "someone the house cannot name while l8 waits for Nives: nothing told, the agent may ask who it is"},
            room(22, "10:00", "Cucina", [[NIVES, 0.7]], ttl=300, expect={"initiative": False},
                 why="Nives at 0.7: enough for a harmless item, not for one from a private message (0.85)"),
            room(22, "10:40", "Studio", [[NIVES, 0.92]], channel="camera"),
            room(22, "10:55", "Studio", [[NIVES, 0.92]], channel="camera", left=True),
            room(22, "16:00", "Soggiorno", [[NIVES, 0.9]], someone=1, expect={"initiative": False, "opening": True},
                 why="Nives arrives where someone else is: only the opening, which reveals nothing"),
            {"at": t(22, "16:02"), "type": "turn", "conversation": "soggiorno-lombardi", "author": "Nives", "text": "Sì, dimmi."},
            # Friday: Ottavia busy in a meeting (home presence), free at 11:30; Bruno arrives where people are talking.
            # busy 08:50–11:30: renewed every hour, as a client would (ttlSeconds is at most 3600).
            {"at": t(23, "08:50"), "type": "presence", "channel": "home", "people": [[OTTAVIA, 1.0]], "busy": True, "ttl": 3600},
            {"at": t(23, "09:50"), "type": "presence", "channel": "home", "people": [[OTTAVIA, 1.0]], "busy": True, "ttl": 3600},
            {"at": t(23, "10:50"), "type": "presence", "channel": "home", "people": [[OTTAVIA, 1.0]], "busy": True, "ttl": 3600},
            {"at": t(23, "11:30"), "type": "presence", "channel": "home", "people": [[OTTAVIA, 1.0]], "busy": False, "ttl": 3600},
            room(23, "18:00", "Soggiorno", [[BRUNO, 0.9]], someone=1, talking=True, expect={"initiative": False, "opening": False},
                 why="Bruno arrives while people in the room are talking: no opening in the middle of it"),
            room(23, "18:01", "Soggiorno", [[BRUNO, 0.9]], someone=1, talking=True),
            room(23, "18:03", "Soggiorno", [[BRUNO, 0.9]], someone=1, expect={"initiative": False, "opening": True},
                 why="two minutes without talking: his arrival, still owed, brings the opening (judgement)"),
            {"at": t(23, "18:04"), "type": "turn", "conversation": "soggiorno-lombardi-ven", "author": "Bruno", "text": "Dimmi pure."},
            # Saturday: Bruno ignores l14 right after it is said; the 1-hour pause.
            room(24, "10:00", "Cucina", [[BRUNO, 0.9]]),
            {"at": t(24, "10:03"), "type": "outcome", "content": "pulire la griglia del barbecue", "status": "ignored"},
            room(24, "10:20", "Cucina", [[BRUNO, 0.9]], left=True),
            room(24, "10:40", "Garage", [[BRUNO, 0.9]], expect={"initiative": False},
                 why="an arrival 40 minutes after an initiative he let go at once: the 1-hour pause holds l15"),
            room(24, "10:55", "Garage", [[BRUNO, 0.9]], left=True),
            room(24, "11:20", "Cucina", [[BRUNO, 0.9]]),
            room(24, "11:40", "Cucina", [[BRUNO, 0.9]], left=True),
        ],
    },
]

START = t(19, "06:00")
END = t(24, "20:30")
TICK_MINUTES = 15
