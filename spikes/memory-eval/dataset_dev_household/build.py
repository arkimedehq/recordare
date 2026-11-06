# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""dev_household (D55 F2b §6, the growing-household curve): an entity memory, Casa Neri, meets a family of four over two
weeks. Fictional content. `world.json` is the household's hidden truth — 30 facts, each known by some of its members —;
`conversations.json` the days' talk with the agent (things named, rarely explained); `household_eval.py` plays each
evening: the members come home (recognised by their voice), the memory's questions for them are said, a model plays the
member — answering only from what they know, "non lo so" otherwise, letting questions go past their patience — and the
answers go back into the memory. Run: python build.py"""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
TZ = "+02:00"
ALL = ["Paolo", "Marta", "Luca", "Giada"]

MEMBERS = {
    "Paolo": {"voice": "paolo-voice", "patience": 2, "about": "Paolo, 46, elettricista, il padre"},
    "Marta": {"voice": "marta-voice", "patience": 2, "about": "Marta, 44, infermiera, la madre"},
    "Luca": {"voice": "luca-voice", "patience": 1, "about": "Luca, 16, il figlio, risponde a monosillabi"},
    "Giada": {"voice": "giada-voice", "patience": 1, "about": "Giada, 9, la figlia, chiacchierona"},
}

# The household's truth: what the memory could come to know, and who knows it.
WORLD = [
    ("f01", "Marta è la moglie di Paolo", ALL),
    ("f02", "Luca è il figlio di Paolo e Marta e ha 16 anni", ALL),
    ("f03", "Giada è la figlia di Paolo e Marta e ha 9 anni", ALL),
    ("f04", "Nonna Rosa è la madre di Marta", ALL),
    ("f05", "Nonna Rosa vive a Pistoia", ["Paolo", "Marta"]),
    ("f06", "Luca gioca a basket, allenamenti il martedì e il giovedì alle 18", ["Luca", "Paolo", "Marta"]),
    ("f07", "Giada fa nuoto il lunedì e il mercoledì pomeriggio", ["Giada", "Marta"]),
    ("f08", "Marta lavora come infermiera all'ospedale di Prato", ["Marta", "Paolo"]),
    ("f09", "Marta fa i turni di notte una settimana al mese", ["Marta"]),
    ("f10", "Paolo fa l'elettricista", ["Paolo", "Marta"]),
    ("f11", "Paolo esce di casa alle 7 del mattino", ["Paolo", "Marta"]),
    ("f12", "Tobia è il cane di famiglia", ALL),
    ("f13", "Tobia lo porta fuori la sera Luca", ["Luca", "Paolo"]),
    ("f14", "Giada è allergica alle noci", ["Marta", "Paolo", "Giada"]),
    ("f15", "Il compleanno di Giada è il 3 dicembre", ["Marta", "Paolo", "Giada"]),
    ("f16", "Zio Franco è il fratello di Paolo", ["Paolo"]),
    ("f17", "Zio Franco abita a Firenze", ["Paolo"]),
    ("f18", "Simone è il migliore amico di Luca", ["Luca"]),
    ("f19", "Luca vuole studiare ingegneria all'università", ["Luca", "Marta"]),
    ("f20", "La spesa grande si fa il sabato mattina", ["Marta", "Paolo"]),
    ("f21", "Il riscaldamento si accende alle 6:30", ["Paolo"]),
    ("f22", "Elena è la maestra di Giada", ["Giada", "Marta"]),
    ("f23", "Giada va a scuola a piedi con Luca", ["Luca", "Giada"]),
    ("f24", "Marta non beve caffè dopo le 15", ["Marta"]),
    ("f25", "Paolo tifa Fiorentina", ["Paolo", "Luca"]),
    ("f26", "L'auto di famiglia è una Panda rossa", ["Paolo", "Marta"]),
    ("f27", "Il venerdì sera la famiglia mangia la pizza", ALL),
    ("f28", "Luca ha il patentino per lo scooter", ["Luca", "Paolo"]),
    ("f29", "Micia è la gatta della vicina che entra in giardino", ["Giada"]),
    ("f30", "Marta canta nel coro della parrocchia il giovedì sera", ["Marta", "Paolo"]),
]

# Two weeks of talk, from Monday 5 October 2026: things named, rarely explained (a few said outright).
DAYS = [
    [("Paolo", "07:00", "Accendi il riscaldamento, oggi fa freddo. Io esco, ci vediamo stasera."),
     ("Giada", "16:30", "Sono tornata dal nuoto! Tobia mi ha leccato tutta."),
     ("Marta", "20:30", "Domani sera arriva la nonna, prepariamo il letto nella stanza degli ospiti.")],
    [("Luca", "17:15", "Esco, ho allenamento. Torno per cena."),
     ("Marta", "19:00", "La nonna è arrivata, ha portato le sue frittelle. Giada, niente torta con le noci, mi raccomando."),
     ("Giada", "21:00", "Domani Elena ci porta al museo!")],
    [("Paolo", "06:55", "Ho lasciato la Panda a Marta, prendo il furgone."),
     ("Giada", "17:00", "Oggi in piscina ho fatto la virata!"),
     ("Luca", "21:00", "Porto fuori Tobia e poi vado da Simone a fare i compiti.")],
    [("Marta", "14:30", "Ho fatto la notte, vado a dormire un po'. Niente caffè per me."),
     ("Luca", "17:20", "Allenamento, poi pizza con la squadra. Avvisa la mamma."),
     ("Marta", "20:45", "Stasera c'è prova del coro, torno alle 23.")],
    [("Giada", "16:00", "Stasera pizza? Io la voglio con le patatine!"),
     ("Paolo", "19:30", "Franco ha chiamato, domenica viene a pranzo."),
     ("Marta", "20:00", "La nonna riparte domattina, la accompagna Paolo.")],
    [("Marta", "09:00", "Andiamo a fare la spesa grande, serve la lista."),
     ("Luca", "15:00", "Prendo lo scooter e vado al campetto."),
     ("Giada", "18:00", "Micia è entrata di nuovo in giardino, Tobia impazzisce!")],
    [("Paolo", "12:30", "Franco è arrivato, apparecchia per sei."),
     ("Paolo", "18:00", "Bella partita oggi, abbiamo vinto due a zero!"),
     ("Marta", "21:30", "Domani ricomincio con i turni di notte, tutta la settimana.")],
    [("Giada", "16:30", "Nuoto finito. Elena ha detto che a dicembre facciamo la recita."),
     ("Marta", "19:30", "Esco per il turno, a domattina."),
     ("Luca", "21:10", "Porto fuori Tobia.")],
    [("Luca", "17:10", "Vado all'allenamento."),
     ("Paolo", "19:30", "Marta stanotte lavora, cucino io. Giada, niente noci nell'insalata."),
     ("Giada", "20:30", "Mancano due mesi al mio compleanno!")],
    [("Giada", "16:40", "Oggi in piscina gara con Sara, ho vinto io!"),
     ("Luca", "20:00", "Simone ha detto che domani ci danno i risultati della verifica."),
     ("Paolo", "21:30", "Domattina esco alle 7 come sempre, sveglia alle 6:15.")],
    [("Luca", "17:15", "Allenamento. Il coach dice che sabato gioco titolare."),
     ("Marta", "15:00", "Ultima notte di turno, poi riposo."),
     ("Paolo", "20:40", "Marta stasera non va al coro, è stanca.")],
    [("Giada", "16:00", "Venerdì! Pizza stasera?"),
     ("Luca", "18:30", "Ho preso otto nella verifica di matematica. Mamma dice che ingegneria fa per me."),
     ("Marta", "20:00", "Pizza per tutti, ordino io.")],
    [("Marta", "09:30", "Spesa grande, e domenica viene la nonna."),
     ("Luca", "17:00", "Abbiamo vinto la partita, ho segnato dodici punti!"),
     ("Giada", "19:00", "Micia ha portato un topolino, che schifo!")],
    [("Paolo", "11:00", "La nonna arriva con il treno da Pistoia, la vado a prendere."),
     ("Paolo", "16:00", "Che delusione la Fiorentina oggi."),
     ("Marta", "21:00", "Settimana prossima porto Giada dall'allergologo per le noci.")],
]


def t(day: int, hhmm: str) -> str:
    return f"2026-10-{5 + day:02d}T{hhmm}:00{TZ}"


sessions = []
for d, day in enumerate(DAYS):
    for k, (who, hhmm, text) in enumerate(day):
        sessions.append({"id": f"h{d + 1:02d}{k + 1}", "user": "casa_neri", "ts": t(d, hhmm), "day": d + 1,
                         "participants": [{"name": who, "identity": MEMBERS[who]["voice"]}],
                         "messages": [{"role": "other", "author": who, "content": text}, {"role": "assistant", "content": "Va bene."}]})

(HERE / "conversations.json").write_text(json.dumps({
    "_note": "dev_household (D55 F2b §6): an entity memory meets a family over two weeks; see build.py.",
    "users": {"casa_neri": "Casa Neri, Prato"}, "genders": {"casa_neri": "feminine"}, "entities": ["casa_neri"],
    "sessions": sessions}, ensure_ascii=False, indent=1) + "\n")
(HERE / "world.json").write_text(json.dumps({
    "_note": "The household's hidden truth: each fact and who knows it (the members' knowledge in the simulation).",
    "start": t(0, "00:00"), "days": len(DAYS), "timezone": "Europe/Rome", "members": MEMBERS,
    "facts": [{"id": i, "fact": f, "knowers": k} for i, f, k in WORLD]}, ensure_ascii=False, indent=1) + "\n")
print(f"{len(sessions)} sessions over {len(DAYS)} days, {len(WORLD)} facts")
