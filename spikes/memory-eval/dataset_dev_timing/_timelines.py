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
]

START = t(19, "06:00")
END = t(21, "23:45")
TICK_MINUTES = 15
