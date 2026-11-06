# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""dev_timing (D55 F2b, RESEARCH_NOTES H14): timelines replayed against the service with a moving clock — no LLM.
Fictional content. Times in Rome (CEST, +02:00), Monday 19 – Wednesday 21 October 2026. Each item is an intent as the
extraction would write it (or a plan the initiative sweep asks about); `gold` says when delivering it is acceptable
(`windows`, local ISO pairs; `via` when it must come through a presence or a turn, never a push on a shared channel) or
that it must not be delivered at all (`deliver: false`)."""

TZ = "+02:00"


def t(day: int, hhmm: str) -> str:
    return f"2026-10-{day:02d}T{hhmm}:00{TZ}"


MEMORIES = [
    {
        "id": "giulia", "name": "Giulia", "mode": "personal",
        "channels": [{"kind": "chat", "reach": "always"}, {"kind": "messaging", "reach": "always"}],
        "people": [],
        "messages": [],
        "items": [
            {"id": "g1", "content": "prendere la pillola", "due": t(19, "09:00"), "until": t(20, "09:00"), "timed": True,
             "gold": {"windows": [[t(19, "09:00"), t(19, "09:30")]]},
             "why": "a reminder asked for 09:00: at 09:00, on the channel noticed now"},
            {"id": "g2", "content": "chiamare l'idraulico", "due": t(19, "00:00"), "until": t(20, "00:00"),
             "gold": {"windows": [[t(19, "09:00"), t(19, "21:00")]]},
             "why": "a reminder for the day, no time: during the day, not at dawn"},
            {"id": "g4", "content": "spegnere il forno", "due": t(19, "23:00"), "until": t(20, "23:00"), "timed": True,
             "gold": {"windows": [[t(19, "23:00"), t(19, "23:30")]]},
             "why": "asked for 23:00: the person chose the time, quiet hours or not"},
            {"id": "g5", "content": "comprare il regalo per Anna", "due": t(20, "00:00"), "until": t(21, "00:00"),
             "gold": {"windows": [[t(20, "08:00"), t(20, "21:00")]]},
             "why": "a reminder for the day; Giulia writes at 08:30: the turn is a fine moment"},
        ],
        "plans": [
            {"id": "g3", "content": "Visita dal dentista", "at": t(17, "10:00"),
             "gold": {"windows": [[t(19, "10:00"), t(19, "20:00")], [t(20, "10:00"), t(20, "20:00")], [t(21, "10:00"), t(21, "20:00")]]},
             "why": "asking how a visit went: in the day, not first thing in the morning"},
        ],
        "events": [
            {"at": t(20, "08:30"), "type": "turn", "conversation": "giulia-chat", "text": "Buongiorno! Che giornata mi aspetta?"},
        ],
    },
    {
        "id": "casa_rossi", "name": "Casa Rossi", "mode": "entity",
        "channels": [{"kind": "chat", "reach": "always"}, {"kind": "voice", "reach": "presence"}],
        "people": [{"name": "Eriona", "voice": "eriona-vp"}, {"name": "Luca", "voice": "luca-vp"}],
        "messages": [
            {"id": "m-panel", "conversation": "panel", "text": "Ricordami di comprare il latte."},
            {"id": "m-private", "conversation": "eriona-chat", "author": "Eriona", "text": "Ricordami la visita dal ginecologo.", "private": True},
        ],
        "items": [
            {"id": "c1", "content": "stendere i panni", "for": "Eriona", "due": t(19, "10:00"), "until": t(19, "21:00"),
             "gold": {"windows": [[t(19, "10:00"), t(19, "21:00")]], "via": ["presence", "turn"]},
             "why": "for Eriona in a shared home: only when she is recognised (13:00), not to a stranger, not when unsure"},
            {"id": "c2", "content": "comprare il latte", "message": "m-panel", "due": t(19, "09:00"), "until": t(19, "21:00"),
             "gold": {"windows": [[t(19, "09:00"), t(19, "21:00")]]},
             "why": "asked at the kitchen panel by someone unknown: back on the panel during the day"},
            {"id": "c3", "content": "portare fuori il cane", "for": "Luca", "due": t(20, "18:00"), "until": t(21, "18:00"), "timed": True,
             "gold": {"deliver": False},
             "why": "for Luca, who never shows up: never pushed on the shared panel"},
            {"id": "c4", "content": "visita dal ginecologo", "for": "Eriona", "message": "m-private", "due": t(20, "09:00"), "until": t(20, "21:00"),
             "gold": {"windows": [[t(20, "10:30"), t(20, "10:45")]], "via": ["presence"]},
             "why": "from a private message: only to a sure recognition (the camera at 10:30), not the unsure voice at 10:00"},
        ],
        "plans": [],
        "events": [
            {"at": t(19, "11:00"), "type": "presence", "voice": "stranger-vp", "confidence": 0.9, "channel": "voice"},
            {"at": t(19, "12:00"), "type": "presence", "voice": "eriona-vp", "confidence": 0.5, "channel": "voice"},
            {"at": t(19, "13:00"), "type": "presence", "voice": "eriona-vp", "confidence": 0.9, "channel": "voice"},
            {"at": t(20, "10:00"), "type": "presence", "voice": "eriona-vp", "confidence": 0.8, "channel": "voice"},
            {"at": t(20, "10:30"), "type": "presence", "voice": "eriona-vp", "confidence": 0.95, "channel": "camera"},
        ],
    },
    {
        # D55 §5c (built 2026-11-05, measured 2026-11-06): presence by place from Home Assistant — a room with a voice point,
        # arrival vs refresh, the 30-minute voice pace, quiet hours for voice, the opening when others are in the room
        # (then the person's "yes" in a turn), the clock reading live presences, "at home" alone never enough to speak.
        "id": "casa_bianchi", "name": "Casa Bianchi", "mode": "entity",
        "channels": [{"kind": "chat", "reach": "always"}, {"kind": "messaging", "reach": "always"}, {"kind": "voice", "reach": "presence"}],
        "people": [{"name": "Eriona", "ha": "person.eriona"}, {"name": "Luca", "ha": "person.luca", "telegram": "4242002"}],
        "messages": [],
        "items": [
            {"id": "b1", "content": "annaffiare le piante", "for": "Eriona", "due": t(20, "07:00"), "until": t(20, "21:00"),
             "gold": {"windows": [[t(20, "08:30"), t(20, "08:45")]], "via": ["presence"], "channel": "voice"},
             "why": "Eriona walks into the kitchen at 08:30: said at her arrival, by the kitchen's voice"},
            {"id": "b2", "content": "comprare il pane", "for": "Eriona", "due": t(20, "07:00"), "until": t(20, "21:00"),
             "gold": {"windows": [[t(20, "09:20"), t(20, "09:35")]], "via": ["presence"], "channel": "voice"},
             "why": "not at the refresh (08:40), not at her return at 08:55 (within 30 minutes of b1), not at the refresh at "
                    "09:05; said at her arrival at 09:20, the pace over"},
            {"id": "b4", "content": "chiamare la nonna", "for": "Eriona", "due": t(20, "22:30"), "until": t(21, "21:00"),
             "gold": {"windows": [[t(21, "08:30"), t(21, "08:45")]], "via": ["presence"], "channel": "voice"},
             "why": "she walks into the living room at 23:00, in the quiet hours: held; said at her arrival the next morning"},
            {"id": "b5", "content": "spegnere il forno", "for": "Eriona", "due": t(20, "23:15"), "until": t(21, "23:15"), "timed": True,
             "gold": {"windows": [[t(20, "23:15"), t(20, "23:30")]], "channel": "voice"},
             "why": "asked for 23:15 while she is in the living room: said at 23:15 by its voice, quiet hours or not (she chose the time)"},
            {"id": "b6", "content": "ritirare il pacco", "for": "Eriona", "due": t(20, "14:00"), "until": t(20, "21:00"),
             "gold": {"windows": [[t(20, "15:00"), t(20, "15:15")]], "via": ["turn"], "channel": "turn", "opened": [t(20, "15:00"), t(20, "15:05")]},
             "why": "she walks into the living room where Luca is: only the opening; her \"yes\" in the next turn gets it"},
            {"id": "b7", "content": "prendere le medicine", "for": "Eriona", "due": t(20, "18:00"), "until": t(21, "18:00"), "timed": True,
             "gold": {"windows": [[t(20, "18:00"), t(20, "18:15")]], "channel": "voice"},
             "why": "asked for 18:00 and she is in the kitchen then: the clock reads her live presence and says it there"},
            {"id": "b8", "content": "pagare la bolletta", "for": "Luca", "due": t(20, "12:00"), "until": t(21, "12:00"), "timed": True,
             "gold": {"windows": [[t(20, "12:00"), t(20, "12:15")]], "channel": "messaging"},
             "why": "Luca is only known to be at home (no room): no voice; asked for 12:00, so by message to his address"},
            {"id": "b9", "content": "portare la bici dal meccanico", "for": "Luca", "due": t(20, "09:00"), "until": t(20, "21:00"),
             "gold": {"windows": [[t(20, "09:00"), t(20, "21:00")]], "channel": "messaging"},
             "why": "a request for Luca with no time, only at home: by message during the day, never at night"},
        ],
        "plans": [],
        "events": [
            {"at": t(20, "08:30"), "type": "presence", "channel": "voice", "place": "Cucina", "people": [["person.eriona", 0.9]]},
            {"at": t(20, "08:40"), "type": "presence", "channel": "voice", "place": "Cucina", "people": [["person.eriona", 0.9]]},
            {"at": t(20, "08:45"), "type": "presence", "channel": "voice", "place": "Cucina", "people": [["person.eriona", 0.9]], "left": True},
            {"at": t(20, "08:55"), "type": "presence", "channel": "voice", "place": "Cucina", "people": [["person.eriona", 0.9]]},
            {"at": t(20, "09:05"), "type": "presence", "channel": "voice", "place": "Cucina", "people": [["person.eriona", 0.9]]},
            {"at": t(20, "09:10"), "type": "presence", "channel": "voice", "place": "Cucina", "people": [["person.eriona", 0.9]], "left": True},
            {"at": t(20, "09:20"), "type": "presence", "channel": "voice", "place": "Cucina", "people": [["person.eriona", 0.9]]},
            {"at": t(20, "11:30"), "type": "presence", "channel": "home", "people": [["person.luca", 1.0]], "ttl": 3600},
            {"at": t(20, "14:30"), "type": "presence", "channel": "voice", "place": "Cucina", "someone": 1,
             "expect": {"initiative": False, "askWho": True},
             "why": "someone the house cannot name in the kitchen while b6 waits for Eriona: nothing told, the agent may ask who it is"},
            {"at": t(20, "15:00"), "type": "presence", "channel": "voice", "place": "Soggiorno", "people": [["person.eriona", 0.9], ["person.luca", 0.9]],
             "expect": {"initiative": False, "opening": True}},
            {"at": t(20, "15:02"), "type": "turn", "conversation": "soggiorno", "author": "Eriona", "text": "Sì, dimmi pure."},
            {"at": t(20, "17:50"), "type": "presence", "channel": "voice", "place": "Cucina", "people": [["person.eriona", 0.9]]},
            {"at": t(20, "17:58"), "type": "presence", "channel": "voice", "place": "Cucina", "people": [["person.eriona", 0.9]]},
            {"at": t(20, "23:00"), "type": "presence", "channel": "voice", "place": "Soggiorno", "people": [["person.eriona", 0.9]]},
            {"at": t(20, "23:08"), "type": "presence", "channel": "voice", "place": "Soggiorno", "people": [["person.eriona", 0.9]]},
            {"at": t(20, "23:30"), "type": "presence", "channel": "voice", "place": "Soggiorno", "people": [["person.eriona", 0.9]], "left": True},
            {"at": t(21, "08:30"), "type": "presence", "channel": "voice", "place": "Soggiorno", "people": [["person.eriona", 0.9]]},
        ],
    },
    {
        # D55 F4 (2026-11-06): outcomes reported as a person behaves — Sara ignores what the kitchen's voice says in the
        # morning and takes it in the evening (`behavior`: by part of the day). Timing v1 should learn it; v0 cannot.
        "id": "casa_verdi", "name": "Casa Verdi", "mode": "entity",
        "channels": [{"kind": "chat", "reach": "always"}, {"kind": "voice", "reach": "presence"}],
        "people": [{"name": "Sara", "ha": "person.sara"}],
        "behavior": {"morning": "ignored", "afternoon": "said", "evening": "said", "night": "ignored"},
        "messages": [],
        "items": [
            {"id": "v1", "content": "innaffiare l'orto", "for": "Sara", "due": t(19, "07:00"), "until": t(19, "21:30"),
             "gold": {"windows": [[t(19, "08:30"), t(19, "21:30")]], "via": ["presence"], "channel": "voice"},
             "why": "a flexible request for the day; Sara is in the kitchen at 08:30 and at 19:00 — she ignores the morning voice, answers the evening one"},
            {"id": "v2", "content": "comprare le uova", "for": "Sara", "due": t(20, "07:00"), "until": t(20, "21:30"),
             "gold": {"windows": [[t(20, "08:30"), t(20, "21:30")]], "via": ["presence"], "channel": "voice"},
             "why": "a flexible request for the day; Sara is in the kitchen at 08:30 and at 19:00 — she ignores the morning voice, answers the evening one"},
            {"id": "v3", "content": "portare i libri in biblioteca", "for": "Sara", "due": t(21, "07:00"), "until": t(21, "21:30"),
             "gold": {"windows": [[t(21, "08:30"), t(21, "21:30")]], "via": ["presence"], "channel": "voice"},
             "why": "a flexible request for the day; Sara is in the kitchen at 08:30 and at 19:00 — she ignores the morning voice, answers the evening one"},
            {"id": "v4", "content": "pulire il filtro", "for": "Sara", "due": t(22, "07:00"), "until": t(22, "21:30"),
             "gold": {"windows": [[t(22, "08:30"), t(22, "21:30")]], "via": ["presence"], "channel": "voice"},
             "why": "a flexible request for the day; Sara is in the kitchen at 08:30 and at 19:00 — she ignores the morning voice, answers the evening one"},
            {"id": "v5", "content": "chiamare il veterinario", "for": "Sara", "due": t(23, "07:00"), "until": t(23, "21:30"),
             "gold": {"windows": [[t(23, "08:30"), t(23, "21:30")]], "via": ["presence"], "channel": "voice"},
             "why": "a flexible request for the day; Sara is in the kitchen at 08:30 and at 19:00 — she ignores the morning voice, answers the evening one"},
            {"id": "v6", "content": "ritirare la giacca", "for": "Sara", "due": t(24, "07:00"), "until": t(24, "21:30"),
             "gold": {"windows": [[t(24, "08:30"), t(24, "21:30")]], "via": ["presence"], "channel": "voice"},
             "why": "a flexible request for the day; Sara is in the kitchen at 08:30 and at 19:00 — she ignores the morning voice, answers the evening one"},
        ],
        "plans": [],
        "events": [
            {"at": t(19, "08:30"), "type": "presence", "channel": "voice", "place": "Cucina", "people": [["person.sara", 0.9]]},
            {"at": t(19, "08:45"), "type": "presence", "channel": "voice", "place": "Cucina", "people": [["person.sara", 0.9]], "left": True},
            {"at": t(19, "19:00"), "type": "presence", "channel": "voice", "place": "Cucina", "people": [["person.sara", 0.9]]},
            {"at": t(19, "19:15"), "type": "presence", "channel": "voice", "place": "Cucina", "people": [["person.sara", 0.9]], "left": True},
            {"at": t(20, "08:30"), "type": "presence", "channel": "voice", "place": "Cucina", "people": [["person.sara", 0.9]]},
            {"at": t(20, "08:45"), "type": "presence", "channel": "voice", "place": "Cucina", "people": [["person.sara", 0.9]], "left": True},
            {"at": t(20, "19:00"), "type": "presence", "channel": "voice", "place": "Cucina", "people": [["person.sara", 0.9]]},
            {"at": t(20, "19:15"), "type": "presence", "channel": "voice", "place": "Cucina", "people": [["person.sara", 0.9]], "left": True},
            {"at": t(21, "08:30"), "type": "presence", "channel": "voice", "place": "Cucina", "people": [["person.sara", 0.9]]},
            {"at": t(21, "08:45"), "type": "presence", "channel": "voice", "place": "Cucina", "people": [["person.sara", 0.9]], "left": True},
            {"at": t(21, "19:00"), "type": "presence", "channel": "voice", "place": "Cucina", "people": [["person.sara", 0.9]]},
            {"at": t(21, "19:15"), "type": "presence", "channel": "voice", "place": "Cucina", "people": [["person.sara", 0.9]], "left": True},
            {"at": t(22, "08:30"), "type": "presence", "channel": "voice", "place": "Cucina", "people": [["person.sara", 0.9]]},
            {"at": t(22, "08:45"), "type": "presence", "channel": "voice", "place": "Cucina", "people": [["person.sara", 0.9]], "left": True},
            {"at": t(22, "19:00"), "type": "presence", "channel": "voice", "place": "Cucina", "people": [["person.sara", 0.9]]},
            {"at": t(22, "19:15"), "type": "presence", "channel": "voice", "place": "Cucina", "people": [["person.sara", 0.9]], "left": True},
            {"at": t(23, "08:30"), "type": "presence", "channel": "voice", "place": "Cucina", "people": [["person.sara", 0.9]]},
            {"at": t(23, "08:45"), "type": "presence", "channel": "voice", "place": "Cucina", "people": [["person.sara", 0.9]], "left": True},
            {"at": t(23, "19:00"), "type": "presence", "channel": "voice", "place": "Cucina", "people": [["person.sara", 0.9]]},
            {"at": t(23, "19:15"), "type": "presence", "channel": "voice", "place": "Cucina", "people": [["person.sara", 0.9]], "left": True},
            {"at": t(24, "08:30"), "type": "presence", "channel": "voice", "place": "Cucina", "people": [["person.sara", 0.9]]},
            {"at": t(24, "08:45"), "type": "presence", "channel": "voice", "place": "Cucina", "people": [["person.sara", 0.9]], "left": True},
            {"at": t(24, "19:00"), "type": "presence", "channel": "voice", "place": "Cucina", "people": [["person.sara", 0.9]]},
            {"at": t(24, "19:15"), "type": "presence", "channel": "voice", "place": "Cucina", "people": [["person.sara", 0.9]], "left": True},
        ],
    },
]

START = t(19, "06:00")
END = t(24, "23:45")
TICK_MINUTES = 15
