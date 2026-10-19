# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Dev set for same-day intentions (NOT blind, written by the engine developer after blind12 h11): an intention for
today stored as done must be corrected when a later message shows it did not happen; same-day plans nobody contradicts
stay events (the old rule); a confirmation keeps them. Writes conversations.json and questions.json."""
import json
from datetime import datetime

U = "marta"
S = [
    ("i01", "2026-11-07T10:00", [("user", "Oggi pomeriggio lavo la macchina, è piena di fango dopo la gita in montagna."), ("assistant", "Buon lavoro! Ti serve un promemoria?"), ("user", "No grazie.")]),
    ("i02", "2026-11-13T18:30", [("user", "Stasera vado al cinema con Paolo a vedere il nuovo film di Sorrentino."), ("assistant", "Buona visione!")]),
    ("i03", "2026-11-14T09:00", [("user", "Uffa, devo ancora lavare la macchina: sabato scorso alla fine ha piovuto tutto il pomeriggio. Ci riprovo domenica."), ("assistant", "Domenica 15 allora, speriamo nel sole.")]),
    ("i04", "2026-11-16T08:00", [("user", "Oggi pomeriggio monto la libreria nuova in salotto, quella bianca presa all'Ikea."), ("assistant", "Buon montaggio!")]),
    ("i05", "2026-11-17T09:15", [("user", "This afternoon I'm calling the bank about the mortgage rate."), ("assistant", "Good luck with the bank.")]),
    ("i06", "2026-11-18T12:00", [("user", "I still haven't called the bank, the branch closed early yesterday. I'll call on Friday."), ("assistant", "Friday 20 November, noted.")]),
    ("i07", "2026-11-19T19:30", [("user", "Stasera cena da mia sorella Giulia."), ("assistant", "Salutamela!")]),
    ("i08", "2026-11-21T08:00", [("user", "Stamattina vado a correre al Valentino."), ("assistant", "Buona corsa!"), ("user", "Tornata! 8 km, gambe a pezzi.")]),
    ("i09", "2026-11-22T11:00", [("user", "Giovedì da Giulia abbiamo fatto le lasagne, buonissime."), ("assistant", "Che bello!")]),
    ("i10", "2026-11-26T21:00", [("user", "Domenica finalmente monto la libreria, i pezzi sono ancora nello scatolone in corridoio."), ("assistant", "Domenica 29 allora.")]),
]
ASK = "2026-12-01T10:00:00+01:00"
Q = [
    ("d01", "intention-contradicted", "Ho lavato la macchina sabato 7 novembre?",
     "No: il 7 novembre volevi lavarla nel pomeriggio, ma il 14 novembre hai detto che quel sabato aveva piovuto tutto il pomeriggio e dovevi ancora lavarla; volevi riprovarci domenica 15 novembre, e non risulta se l'hai fatto.",
     ["la macchina è stata lavata il 7 novembre"]),
    ("d02", "intention-contradicted", "Quando ho montato la libreria nuova?",
     "Non risulta che tu l'abbia montata: il 16 novembre volevi montarla quel pomeriggio, ma il 26 novembre i pezzi erano ancora nello scatolone e dicevi che l'avresti montata domenica 29 novembre; non me ne hai più parlato.",
     ["la libreria è stata montata il 16 novembre", "la libreria è stata montata domenica 29 novembre"]),
    ("d03", "intention-contradicted", "Did I call the bank about the mortgage on 17 November?",
     "No: you meant to call that afternoon, but on 18 November you said you still hadn't called (the branch closed early) and would call on Friday 20 November; whether you did is not known.",
     ["the bank was called on 17 November"]),
    ("d04", "same-day-kept", "Cosa ho fatto venerdì 13 novembre sera?",
     "Sei andata al cinema con Paolo a vedere il nuovo film di Sorrentino.", []),
    ("d05", "same-day-confirmed", "Cosa abbiamo cucinato da Giulia, e quando?",
     "Le lasagne, giovedì 19 novembre 2026, a cena da tua sorella Giulia.", []),
    ("d06", "same-day-done", "Quanti km ho corso sabato 21 novembre, e dove?", "8 km, al parco del Valentino.", []),
]

def ts(s):  # Europe/Rome in November: +01:00
    return s + ":00+01:00"

sessions = [{"id": i, "user": U, "ts": ts(t), "messages": [{"role": r, "content": c} for r, c in m]} for i, t, m in S]
assert datetime.fromisoformat(ts("2026-11-07T10:00")).strftime("%A") == "Saturday"
assert datetime.fromisoformat(ts("2026-11-13T18:30")).strftime("%A") == "Friday"
assert datetime.fromisoformat(ts("2026-11-19T19:30")).strftime("%A") == "Thursday"
assert datetime(2026, 11, 29).strftime("%A") == "Sunday" and datetime(2026, 11, 20).strftime("%A") == "Friday"
json.dump({"_note": "Same-day intentions dev set (not blind, after blind12 h11).", "users": {U: "Marta, lives in Turin"},
           "genders": {U: "feminine"}, "sessions": sessions}, open("conversations.json", "w"), ensure_ascii=False, indent=1)
json.dump({"_note": "Questions for dataset_dev_intentions (not blind).", "user": U, "holder": "Marta",
           "questions": [{"id": i, "category": c, "asked_at": ASK, "q": q, "expected": e, "must_not": mn} for i, c, q, e, mn in Q]},
          open("questions.json", "w"), ensure_ascii=False, indent=1)
print("ok", len(sessions), len(Q))
