# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Generate deterministic "noise" sessions (dataset_blind4/noise.json) to stress retrieval.

Constraints: noise must NOT change any expected answer in questions.json:
- no first-person events by Tommaso of the asked kinds (bike rides, physiotherapy, dentist, courses,
  job, moves, trips, pets, car, family events, parties, dinners, concerts, vet visits);
- the relative-week windows of the this-week / last-week questions carry no personal or third-party
  news at all, only neutral knowledge / coding filler (see QUIET);
- no help requests matching the provenance questions (birthday speeches, cover letters, interview
  questions, fixed vs variable mortgages, VLOOKUP / CERCA.VERT, airline complaints);
- nothing about a housewarming party (plan-unresolved question);
- lexical traps are wanted, always as general questions or clearly attributed to someone else
  (a colleague's Punto, a neighbour's beagle, someone's wedding in September, a Conero climb time,
  Lisbon / Rotterdam / Val di Fassa knowledge, knee replacement recovery in general);
- a second user, 'giorgio', tells first-person events that mirror Tommaso's (isolation check).
"""
import json
import random
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
rng = random.Random(2028)
TZ = ZoneInfo("Europe/Rome")

TECH = [
    ("Come si scrive un ciclo for in Python che salta gli elementi pari?", "for x in lista:\n    if x % 2 == 0:\n        continue\n    print(x)"),
    ("Che differenza c'è tra TCP e UDP?", "TCP garantisce consegna e ordine dei pacchetti; UDP è più leggero e veloce ma senza garanzie."),
    ("What does 'git rebase' do compared to 'git merge'?", "Rebase replays your commits on top of another branch, giving a linear history; merge keeps both histories and adds a merge commit."),
    ("Perché il cielo è blu?", "Per la diffusione di Rayleigh: la luce blu, a lunghezza d'onda corta, viene diffusa dall'atmosfera più di quella rossa."),
    ("Chi ha scritto I Malavoglia?", "Giovanni Verga, nel 1881."),
    ("Qual è la capitale dell'Australia?", "Canberra, non Sydney."),
    ("What is a TEU in shipping?", "Twenty-foot Equivalent Unit: the standard measure of container capacity, one 20-foot container."),
    ("Cos'è un'API REST?", "Un'interfaccia che espone risorse via HTTP con metodi come GET, POST, PUT e DELETE."),
    ("Come si calcola l'area di un cerchio?", "π per il raggio al quadrato."),
    ("How do I convert a string to a date in JavaScript?", "new Date('2028-01-15') for ISO strings; for other formats parse the parts manually or use a library."),
    ("Che cos'è l'inflazione?", "L'aumento generale dei prezzi nel tempo, che riduce il potere d'acquisto della moneta."),
    ("Cosa significa SQL JOIN?", "Combina righe di due tabelle in base a una colonna comune; INNER JOIN tiene solo le corrispondenze."),
    ("Perché la batteria del telefono si scarica di più al freddo?", "Le reazioni chimiche della batteria al litio rallentano a basse temperature."),
    ("What's the difference between RAM and ROM?", "RAM is volatile working memory; ROM is non-volatile and holds firmware."),
    ("Come funziona una diga idroelettrica?", "L'acqua accumulata scende attraverso le turbine, che azionano un generatore."),
    ("Quanti secondi ci sono in un giorno?", "86.400."),
    ("Che cos'è un anno bisestile?", "Un anno di 366 giorni, con il 29 febbraio: divisibile per 4, ma non per 100 salvo che per 400."),
    ("How does HTTPS protect data?", "It encrypts traffic with TLS, so third parties cannot read or alter it in transit."),
    ("Cos'è un algoritmo di ordinamento stabile?", "Uno che mantiene l'ordine relativo degli elementi uguali, come il merge sort."),
    ("Come si dice 'magazzino' in inglese?", "Warehouse."),
    ("Che cos'è la fotosintesi?", "Il processo con cui le piante usano luce, acqua e CO2 per produrre zuccheri e ossigeno."),
    ("Which is bigger, a kilobyte or a kibibyte?", "A kibibyte (1024 bytes) is slightly bigger than a kilobyte (1000 bytes)."),
]

DAILY = [
    ("Quanto costa in media un volo per Lisbona dall'Italia?", "Con le low cost si trovano andata e ritorno tra 60 e 200 euro, a seconda della stagione."),
    ("Cosa vedere a Rotterdam in un giorno?", "Le case cubo, il Markthal, il ponte Erasmus e il porto con un giro in battello."),
    ("Quali sono le piste più belle della Val di Fassa?", "Il giro del Sellaronda, le piste del Belvedere a Canazei e la Marmolada."),
    ("Come si prepara il brodetto all'anconetana?", "Si usano almeno nove tipi di pesce, soffritto, pomodoro e aceto, cotti a strati senza mescolare."),
    ("Quanto dura in genere la riabilitazione dopo una protesi al ginocchio?", "Di solito da due a tre mesi per tornare a camminare bene, con fisioterapia quotidiana all'inizio."),
    ("Come vola una mongolfiera?", "L'aria all'interno del pallone viene scaldata dal bruciatore: essendo più leggera dell'aria esterna, fa salire il pallone."),
    ("Quanto vive in media un gatto domestico?", "Tra i 12 e i 18 anni, spesso di più se vive in casa."),
    ("Che carattere ha un beagle?", "Socievole, curioso, molto guidato dall'olfatto e piuttosto goloso."),
    ("What's the best time of year to visit Sintra?", "Spring or early autumn: fewer crowds and mild weather."),
    ("Qual è la differenza tra bici gravel e bici da corsa?", "La gravel ha copertoni più larghi e geometria più comoda per sterrati; la corsa è più leggera e aerodinamica su asfalto."),
    ("Come si pulisce la catena della bici?", "Sgrassatore, spazzolino, risciacquo, asciugatura e poi lubrificante goccia a goccia."),
    ("Quanto è lunga una mezza maratona?", "21,0975 km."),
    ("Che cosa sono i vincisgrassi?", "Una lasagna tipica marchigiana con ragù di carni miste e besciamella."),
    ("What does 'saudade' mean?", "A Portuguese word for a deep, nostalgic longing for something or someone absent."),
    ("Come si conservano le olive all'ascolana crude?", "In freezer, ben distanziate su un vassoio, poi in sacchetti; si friggono ancora congelate."),
    ("Qual è la differenza tra un'ibrida e un'ibrida plug-in?", "L'ibrida si ricarica da sola in frenata; la plug-in ha una batteria più grande da ricaricare alla presa."),
    ("Quanto costa in media una pulizia dei denti?", "In uno studio privato tra 60 e 120 euro."),
    ("Come si dice 'trasloco' in spagnolo?", "Mudanza."),
    ("Quali sono le spiagge più belle del Conero?", "Le Due Sorelle, Mezzavalle, Portonovo e San Michele a Sirolo."),
    ("Come si toglie il pelo di gatto dal divano?", "Con un guanto di gomma umido o un rullo adesivo."),
]

THIRD_PARTY = [
    ("Un mio collega ha venduto la sua vecchia Punto e si è preso una Panda.", "Una scelta pratica per la città."),
    ("Il vicino di sotto ha adottato un beagle, abbaia tutto il giorno.", "I beagle sono vocali, soprattutto i primi mesi."),
    ("La sorella di un collega si sposa a settembre in un agriturismo vicino a Urbino.", "Settembre è un mese bellissimo per un matrimonio in campagna."),
    ("Un amico di un amico dice di fare la salita del Conero in 22 minuti.", "Un tempo notevole per un amatore."),
    ("Una collega si è trasferita a Senigallia, dice che il lungomare è stupendo.", "La spiaggia di velluto è famosa."),
    ("Un conoscente si è rotto la clavicola cadendo in bici sul Conero.", "Le cadute in discesa sono frequenti, auguri a lui."),
    ("La figlia della mia vicina fa un corso di spagnolo a Valencia.", "Valencia è perfetta per studiare spagnolo."),
    ("Il cugino di un amico lavora al porto di Rotterdam.", "È il porto più grande d'Europa."),
]

POOLS = [(TECH, 0.45), (DAILY, 0.40), (THIRD_PARTY, 0.15)]
START = datetime(2028, 1, 10, tzinfo=TZ)
DAYS = 162  # until 2028-06-19
QUIET = [  # relative-week windows of the this-week / last-week questions (end exclusive)
    (datetime(2028, 2, 14, tzinfo=TZ), datetime(2028, 2, 21, tzinfo=TZ)),
    (datetime(2028, 2, 28, tzinfo=TZ), datetime(2028, 3, 4, tzinfo=TZ)),
    (datetime(2028, 3, 20, tzinfo=TZ), datetime(2028, 3, 23, tzinfo=TZ)),
    (datetime(2028, 4, 24, tzinfo=TZ), datetime(2028, 5, 2, tzinfo=TZ)),
    (datetime(2028, 5, 8, tzinfo=TZ), datetime(2028, 5, 13, tzinfo=TZ)),
    (datetime(2028, 5, 22, tzinfo=TZ), datetime(2028, 5, 30, tzinfo=TZ)),
]


def pick_pool() -> list:
    r, acc = rng.random(), 0.0
    for pool, weight in POOLS:
        acc += weight
        if r <= acc:
            return pool
    return POOLS[-1][0]


def when(day: int, hour: int, minute: int) -> datetime:
    # wall-clock local time in Europe/Rome, so the offset follows DST (+01:00 / +02:00)
    d = (START + timedelta(days=day)).date()
    return datetime(d.year, d.month, d.day, 8 + hour, minute, tzinfo=TZ)


def quiet(ts: datetime) -> bool:
    return any(a <= ts < b for a, b in QUIET)


sessions = []
for i in range(150):
    ts = when(rng.randrange(DAYS), rng.randrange(15), rng.randrange(60))
    pool = TECH if quiet(ts) else pick_pool()
    turns = rng.sample(pool, k=rng.choice([1, 1, 2]))
    messages = []
    for q, a in turns:
        messages += [{"role": "user", "content": q}, {"role": "assistant", "content": a}]
    sessions.append({"id": f"n{i:03d}", "user": "tommaso", "ts": ts.isoformat(), "messages": messages})

GIORGIO_TRAPS = [
    ("Oggi giro in bici fino a Portonovo, 50 km, gambe a pezzi.", "Bel giro!"),
    ("Ho fatto la devitalizzazione stamattina, 300 euro.", "Riposati e mangia morbido."),
    ("Ho adottato un gattino rosso dal gattile, si chiama Arancio.", "Benvenuto Arancio!"),
    ("Sono tornato da Lisbona, ho chiesto alla mia ragazza di sposarmi e ha detto sì.", "Congratulazioni!"),
    ("Ho cambiato lavoro, da lunedì sono in un'azienda di Osimo.", "In bocca al lupo per il nuovo inizio!"),
    ("Mi sono trasferito a Senigallia, finalmente vicino al mare.", "Che bel cambiamento."),
    ("Ho preso una Yaris ibrida rossa, consuma pochissimo.", "Ottima scelta per la città."),
    ("Ho lasciato il corso di fotografia, non avevo tempo.", "Magari lo riprendi più avanti."),
]
for i in range(20):  # other user's noise: isolation stress
    ts = when(rng.randrange(DAYS), rng.randrange(15), rng.randrange(60))
    q, a = rng.choice(GIORGIO_TRAPS + DAILY)
    sessions.append({"id": f"gn{i:02d}", "user": "giorgio", "ts": ts.isoformat(),
                     "messages": [{"role": "user", "content": q}, {"role": "assistant", "content": a}]})

sessions.sort(key=lambda s: s["ts"])
out = {"_note": "Deterministic noise (seed 2028) generated by dataset_blind4/gen_noise.py; must not alter expected answers.",
       "sessions": sessions}
(HERE / "noise.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
print(f"wrote {len(sessions)} noise sessions")
