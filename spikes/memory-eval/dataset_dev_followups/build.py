# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""dev_followups (D55 F2b, extract.v22): something a person started and left to finish — the laundry to hang, a roast in
the oven — becomes, a few hours later, the agent's question; what ends on its own, is finished in the same conversation,
is trivial, a routine or someone else's job does not. Fictional content. Writes conversations.json and
initiatives_gold.json in dev_initiatives' format (initiative_eval.py; run with SWEEP_HOURS=9,12,15,18,21)."""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
R, L = "+02:00", "+01:00"


def s(sid, user, ts, msgs):
    return {"id": sid, "user": user, "ts": ts, "messages": [{"role": r, "content": c} for r, c in msgs]}


SESSIONS = [
    s("e1", "elena", f"2026-09-02T10:00:00{R}", [("user", "Ho appena messo la lavatrice con i jeans, poi li stendo."), ("assistant", "Va bene!")]),
    s("e2", "elena", f"2026-09-04T18:30:00{R}", [("user", "Ho messo l'arrosto in forno, un'ora e mezza a 180 gradi."), ("assistant", "Buona cena!")]),
    s("e3", "elena", f"2026-09-07T09:00:00{R}", [("user", "Ho compilato metà del modulo ISEE, va spedito entro venerdì 11."), ("assistant", "Ok, ce la farai.")]),
    s("e4", "elena", f"2026-09-08T11:00:00{R}", [("user", "Messo la lavastoviglie."), ("assistant", "Perfetto.")]),
    s("e5", "elena", f"2026-09-09T08:00:00{R}", [("user", "Ho messo la lavatrice delle lenzuola."), ("assistant", "Ok!"),
                                                 ("user", "Fatto, lenzuola già stese sul terrazzo, c'è un bel sole."), ("assistant", "Ottimo.")]),
    s("e6", "elena", f"2026-09-15T20:00:00{R}", [("user", "Stasera guardo un film e poi a letto."), ("assistant", "Buona visione!")]),
    s("t1", "tom", f"2026-09-03T08:30:00{L}", [("user", "Bread dough is proving, should be ready to bake in about two hours."), ("assistant", "Lovely.")]),
    s("t2", "tom", f"2026-09-12T14:00:00{L}", [("user", "Left the paint stripper on the old door, it needs scraping off in three hours."), ("assistant", "Got it.")]),
    s("t3", "tom", f"2026-09-14T09:00:00{L}", [("user", "The kitchen tap is dripping, the plumber is coming tomorrow to fix it."), ("assistant", "Good that it's sorted.")]),
    s("t4", "tom", f"2026-09-16T19:00:00{L}", [("user", "I always water the plants on Sunday evenings."), ("assistant", "Noted.")]),
    s("c1", "casa_bellini", f"2026-09-05T16:00:00{R}", [("user", "Sono Paolo. Ho messo i panni in lavatrice, poi li stendo io."), ("assistant", "Va bene Paolo.")]),
    s("c2", "casa_bellini", f"2026-09-13T17:00:00{R}", [("user", "Sono Anna, ho messo la torta in forno, quaranta minuti."), ("assistant", "Che profumo, Anna!")]),
    s("c3", "casa_bellini", f"2026-09-14T21:00:00{R}", [("user", "Ho acceso la lavastoviglie."), ("assistant", "Ok.")]),
    s("c4", "casa_bellini", f"2026-09-18T10:00:00{R}", [("user", "Sono Paolo: ho iniziato a pitturare la ringhiera, la finisco domani."), ("assistant", "Buon lavoro.")]),
]


def e(i, by, day, who, desc):
    return {"id": i, "kind": "ask", "by": by, "due_day": day, "for": who, "desc": desc}


def t(i, desc, why):
    return {"id": i, "desc": desc, "why": why}


GOLD = {
    "elena": {"expected": [
        e("e-ask-laundry", 1, "2026-09-02", "holder", "Ask Elena whether she hung the jeans from the washing machine she started at 10"),
        e("e-ask-roast", 1, "2026-09-04", "holder", "Ask Elena whether she took the roast out of the oven (put in at 18:30 for an hour and a half)"),
        e("e-ask-isee", 1, "2026-09-10", "holder", "Ask Elena whether she finished and sent the ISEE form, due by Friday Sep 11 (asked the day before)"),
    ], "traps": [
        t("e-trap-dishwasher", "Ask Elena whether she emptied or ran the dishwasher", "a dishwasher ends on its own [ends on its own]"),
        t("e-trap-sheets", "Ask Elena whether she hung the sheets", "finished in the same conversation [done]"),
        t("e-trap-film", "Ask Elena whether she watched the film", "trivial [trivial]"),
    ]},
    "tom": {"expected": [
        e("t-ask-bread", 1, "2026-09-03", "holder", "Ask Tom whether he baked the bread (dough proving, ready in about two hours from 8:30)"),
        e("t-ask-door", 2, "2026-09-12", "holder", "Ask Tom whether he scraped the paint stripper off the old door (three hours after 14:00)"),
    ], "traps": [
        t("t-trap-tap", "Ask Tom whether the tap got fixed", "the plumber will take care of it [someone else]"),
        t("t-trap-plants", "Ask or remind Tom about watering the plants", "a routine he does anyway [routine]"),
    ]},
    "casa_bellini": {"expected": [
        e("c-ask-paolo", 1, "2026-09-05", "Paolo", "Ask Paolo whether he hung the laundry he put in the machine at 16"),
        e("c-ask-anna", 2, "2026-09-13", "Anna", "Ask Anna whether she took the cake out of the oven (forty minutes from 17:00)"),
        e("c-ask-railing", 2, "2026-09-19", "Paolo", "Ask Paolo whether he finished painting the railing, as he said he would the next day"),
    ], "traps": [
        t("c-trap-dishwasher", "Ask someone about the dishwasher started at 21:00", "ends on its own, and nobody is identified [ends on its own]"),
    ]},
}

(HERE / "conversations.json").write_text(json.dumps({
    "_note": "dev_followups (D55 F2b): things left to finish; see build.py.",
    "users": {"elena": "Elena, Bologna", "tom": "Tom, London", "casa_bellini": "Casa Bellini, Firenze"},
    "genders": {"elena": "feminine", "tom": "masculine", "casa_bellini": "feminine"},
    "entities": ["casa_bellini"],
    "sessions": SESSIONS,
}, ensure_ascii=False, indent=1) + "\n")
(HERE / "initiatives_gold.json").write_text(json.dumps({
    "_note": "Follow-ups expected by a checkpoint (by, 1-based) with the local day they are due and whom they are for; traps must not exist. The judge sees `desc` only.",
    "timezone": "Europe/Rome",
    "checkpoints": ["2026-09-10T22:00:00+02:00", "2026-09-20T22:00:00+02:00"],
    "memories": GOLD,
}, ensure_ascii=False, indent=1) + "\n")
print(f"{len(SESSIONS)} sessions, {sum(len(g['expected']) for g in GOLD.values())} expected, {sum(len(g['traps']) for g in GOLD.values())} traps")
