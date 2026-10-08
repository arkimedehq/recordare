# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Generate deterministic "noise" sessions (dataset_blind5/noise.json) to stress retrieval and isolation.

Constraints: noise must NOT change any expected answer in questions.json:
- Nunzia's noise has no first-person events or states (no job, home, car, pets, health, family events,
  trips, shows, sailing, choir, book club, dinners); remarks about other people are clearly attributed;
- the relative-week windows of the this-week / last-week questions (QUIET) carry only neutral
  knowledge / coding filler, for every user;
- no help requests matching the provenance questions (spreadsheets / Excel, emails or letters,
  speeches, job interviews, packing or travel advice for Ireland);
- nothing about the unresolved plans (Federfarma conference, Marzamemi dinner, Carmen Consoli concert),
  nor about the negative questions (blood type, football teams, siblings), nor allergies or debts;
- lexical traps are wanted, as general questions or clearly attributed to someone else (a customer's
  hip fracture, a neighbour's dog, sailing knowledge, Greek-theatre history, Dublin facts);
- a second user, 'carmelo', tells first-person events that mirror Nunzia's (isolation check), and a
  third user, 'giada', has an unrelated life.
"""
import json
import random
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
rng = random.Random(2029)
TZ = ZoneInfo("Europe/Rome")

TECH = [
    ("Come si inverte una lista in Python?", "Con lista[::-1] ottieni una copia invertita; lista.reverse() la inverte sul posto."),
    ("Che differenza c'è tra RAM e memoria di massa?", "La RAM è veloce e volatile, serve ai programmi in esecuzione; la memoria di massa (SSD, disco) conserva i dati anche a computer spento."),
    ("What is a JSON file?", "A text format for structured data made of key-value pairs and arrays, easy to read for humans and machines."),
    ("Come funziona il Wi-Fi?", "Il router trasmette dati via onde radio a 2,4 o 5 GHz; i dispositivi le ricevono con un'antenna."),
    ("Che cos'è un indirizzo IP?", "Un numero che identifica un dispositivo in una rete, come un indirizzo postale per i pacchetti di dati."),
    ("How many bytes are in a megabyte?", "One million bytes in decimal units; 1,048,576 in binary units (a mebibyte)."),
    ("Che cos'è la crittografia end-to-end?", "Un sistema in cui solo mittente e destinatario possono leggere i messaggi: nemmeno il servizio che li trasporta ha le chiavi."),
    ("Cos'è il cloud?", "Server remoti accessibili via internet dove si salvano dati o si eseguono programmi."),
    ("What does CPU stand for?", "Central Processing Unit, the chip that executes program instructions."),
    ("Come si scrive una funzione in JavaScript?", "function somma(a, b) { return a + b; } oppure con la freccia: const somma = (a, b) => a + b;"),
    ("Cos'è un bug informatico?", "Un errore in un programma che lo fa comportare in modo inatteso; il nome viene da una falena trovata in un computer nel 1947."),
    ("Che differenza c'è tra http e https?", "Https cifra i dati scambiati con il sito tramite TLS; http li trasmette in chiaro."),
    ("What is an algorithm?", "A finite sequence of well-defined steps to solve a problem, like a recipe."),
    ("Perché il telefono si scalda quando lo ricarico?", "La ricarica produce calore nella batteria e nel circuito; con la ricarica rapida è normale che sia tiepido."),
    ("Cos'è un QR code?", "Un codice a barre bidimensionale che contiene testo, spesso un indirizzo web, leggibile con la fotocamera."),
    ("Come funziona il GPS?", "Il ricevitore calcola la posizione misurando il tempo che impiegano i segnali di almeno quattro satelliti."),
    ("Quanti bit ci sono in un byte?", "Otto."),
    ("What is two-factor authentication?", "A login that needs two proofs, for example a password plus a code sent to your phone."),
    ("Che cos'è un file PDF?", "Un formato di documento che mantiene la stessa impaginazione su qualsiasi dispositivo."),
    ("Come si calcola la percentuale di sconto?", "Prezzo × sconto ÷ 100 è il risparmio; sottrailo dal prezzo per avere il prezzo finale."),
    ("Che cos'è il pi greco?", "Il rapporto tra circonferenza e diametro di un cerchio, circa 3,14159."),
    ("Quanti giorni ha un anno bisestile?", "366."),
    ("Why is the sea salty?", "Rivers carry dissolved minerals from rocks into the sea, and evaporation leaves the salts behind."),
    ("Chi ha inventato la stampa a caratteri mobili in Europa?", "Johannes Gutenberg, intorno al 1450."),
    ("Che cos'è un vulcano attivo?", "Un vulcano che ha eruttato in tempi storici o mostra attività; l'Etna è uno dei più attivi al mondo."),
    ("How far is the Moon from the Earth?", "About 384,000 km on average."),
]

GENERAL = [
    ("Quanto dura in media la riabilitazione dopo una frattura del femore negli anziani?", "Di solito da uno a tre mesi, con fisioterapia graduale; molto dipende dall'età e dall'intervento."),
    ("Quali sono le andature principali nella vela?", "Bolina, traverso, lasco e poppa, a seconda dell'angolo rispetto al vento."),
    ("Quando è stato costruito il Teatro Greco di Siracusa?", "Nel V secolo a.C., poi ampliato nel III secolo a.C. sotto Ierone II."),
    ("What is the Book of Kells?", "An illuminated manuscript of the Gospels made around the year 800, kept at Trinity College Dublin."),
    ("Che cos'è il barocco di Noto?", "Lo stile con cui Noto fu ricostruita dopo il terremoto del 1693; il centro è patrimonio UNESCO."),
    ("Come si fa la granita di mandorla?", "Latte di mandorla, acqua e zucchero in freezer, mescolando ogni mezz'ora per formare i cristalli."),
    ("Perché il maestrale è così forte in Sicilia?", "È un vento di nord-ovest che si incanala tra le isole e il mare aperto, spesso con raffiche oltre 30 nodi."),
    ("Che cosa vuol dire «ciuri» in siciliano?", "Fiore."),
    ("Who wrote «The Leopard»?", "Giuseppe Tomasi di Lampedusa; it was published posthumously in 1958."),
    ("Quanto vive un gatto soriano?", "In media 13-17 anni, di più se vive in casa."),
    ("Come si toglie il calcare dal bollitore?", "Acqua e aceto o acido citrico, si porta a ebollizione e si risciacqua bene."),
    ("Qual è la differenza tra la cassata e i cannoli?", "La cassata è una torta di ricotta, pan di Spagna e marzapane; i cannoli sono cialde fritte ripiene di ricotta."),
    ("What does «team lead» mean?", "A person who coordinates a small team's work while often still doing hands-on tasks."),
    ("Quanti abitanti ha Noto?", "Circa 24.000."),
    ("Che cos'è la pressione arteriosa massima e minima?", "La massima (sistolica) è la pressione quando il cuore si contrae; la minima (diastolica) quando si rilassa."),
    ("Come si chiama il vento caldo che arriva dall'Africa?", "Scirocco."),
    ("Quando si fanno le rappresentazioni classiche al Teatro Greco?", "In genere da maggio a luglio, ogni anno, con tragedie e commedie antiche."),
    ("What's the weather usually like in Ireland in summer?", "Mild, 15–20 °C, with frequent showers and long daylight hours."),
    ("Come si conserva il basilico?", "In un bicchiere d'acqua come i fiori, oppure tritato con olio in freezer."),
    ("Chi era Santa Lucia?", "Una martire di Siracusa del IV secolo, patrona della città, festeggiata il 13 dicembre."),
    ("Qual è la differenza tra una deriva e un cabinato?", "La deriva è una piccola barca senza cabina con chiglia mobile; il cabinato ha una cabina e una chiglia fissa."),
    ("Come si fa il pesce spada alla ghiotta?", "Tranci di pesce spada cotti in sugo di pomodoro con capperi, olive, cipolla e uvetta."),
    ("Che cos'è la scala Mercalli?", "Una scala che misura l'intensità di un terremoto dagli effetti osservati."),
    ("Quali sono le isole Eolie?", "Lipari, Vulcano, Salina, Stromboli, Panarea, Filicudi e Alicudi."),
]

OTHERS = [  # remarks clearly about other people
    ("Una cliente oggi mi ha raccontato che sua suocera si è rotta il polso cadendo dal tram a Catania.", "Mi dispiace per lei, le cadute negli anziani sono frequenti."),
    ("Il vicino del piano di sotto ha preso un cucciolo di labrador, lo sento abbaiare la notte.", "I cuccioli all'inizio piangono, poi si abituano."),
    ("Una signora in fila alla posta diceva che suo nipote si sposa in Irlanda.", "I matrimoni in Irlanda hanno tradizioni molto sentite."),
    ("Il marito della parrucchiera ha comprato una barca a vela e non sa ancora portarla.", "Sarà il momento di un corso!"),
    ("Una conoscente si lamentava che il suo cardiologo le ha cambiato appuntamento tre volte.", "Capita, purtroppo le agende sono piene."),
    ("Ho sentito che il figlio della fruttivendola ha aperto una gelateria a Sliema.", "Malta attira tanti giovani siciliani."),
    ("Un tizio al bar diceva che il traffico sulla statale per Noto d'estate è infernale.", "Con i turisti d'estate aumenta molto."),
    ("La mia vicina di ombrellone ha detto che sua figlia ha partorito due gemelli.", "Doppia gioia!"),
]

SMALLTALK = [
    ("Raccontami una barzelletta.", "Perché il libro di matematica è triste? Perché ha troppi problemi."),
    ("Che tempo fa in genere a Siracusa a marzo?", "Mite, tra 10 e 19 gradi, con qualche giornata di vento."),
    ("Dimmi una curiosità sugli animali.", "Le lontre marine si tengono per mano mentre dormono per non allontanarsi."),
    ("Consigliami un film italiano classico.", "«Il sorpasso» di Dino Risi, del 1962."),
    ("What's a good word to describe a sunny day?", "Radiant, glorious, or simply «gorgeous»."),
    ("Dimmi un proverbio siciliano.", "«Cu nesci, arrinesci»: chi parte, riesce."),
]

CARMELO = [  # mirrors of Nunzia's events (isolation traps)
    "Mia madre è caduta stanotte e si è rotta il femore, la operano venerdì.",
    "Oggi ho adottato una cagnolina meticcia dal canile, l'ho chiamata Ciuri.",
    "Ho comprato una Peugeot 208 bianca usata, l'ho pagata 13.000 euro.",
    "Mi sono trasferito a Noto, ho preso casa vicino alla cattedrale.",
    "Stamattina lezione di vela alla Lega Navale, sono caduto in acqua.",
    "Sono diventato nonno! La bambina si chiama Giulia.",
    "Sono allergico ai crostacei, ieri sera ho rischiato con un risotto.",
    "Il mio gruppo sanguigno è A positivo, me l'hanno ricordato alla donazione.",
    "Io tifo Catania da sempre, domenica vado allo stadio.",
    "Ieri sera ho visto la Medea al Teatro Greco con mia moglie, spettacolare.",
    "Sono stato al concerto di Carmen Consoli a Taormina, splendido.",
    "Siamo andati a Marzamemi a mangiare il pesce, ottimo.",
    "Il cardiologo mi ha prescritto il ramipril, una compressa la mattina.",
    "Ho tre sorelle e un fratello, a Pasqua eravamo in venti.",
    "Ho lasciato il coro, non avevo più tempo il giovedì.",
    "Sono stato una settimana a Dublino da mio figlio, pioveva sempre.",
]

GIADA = [
    "Sto scrivendo la tesi sull'urbanistica di Bologna, mi aiuti a trovare un titolo?",
    "Ho corso 10 km stamattina ai Giardini Margherita, nuovo record personale.",
    "Mi sono iscritta a un corso di ceramica il mercoledì sera.",
    "Il mio coinquilino ha lasciato di nuovo i piatti nel lavandino.",
    "Ho passato l'esame di statistica con 28!",
    "Sto pensando di fare l'Erasmus a Lisbona l'anno prossimo.",
]

START = datetime(2029, 2, 5, tzinfo=TZ)
DAYS = 156  # until 2029-07-10
QUIET = [  # relative-week windows of the this-week / last-week questions (end exclusive)
    (datetime(2029, 3, 12, tzinfo=TZ), datetime(2029, 3, 17, tzinfo=TZ)),
    (datetime(2029, 3, 19, tzinfo=TZ), datetime(2029, 3, 26, tzinfo=TZ)),
    (datetime(2029, 4, 9, tzinfo=TZ), datetime(2029, 4, 17, tzinfo=TZ)),
    (datetime(2029, 5, 7, tzinfo=TZ), datetime(2029, 5, 13, tzinfo=TZ)),
    (datetime(2029, 6, 18, tzinfo=TZ), datetime(2029, 6, 22, tzinfo=TZ)),
    (datetime(2029, 7, 2, tzinfo=TZ), datetime(2029, 7, 9, tzinfo=TZ)),
]
POOLS = [(TECH, 0.40), (GENERAL, 0.35), (OTHERS, 0.12), (SMALLTALK, 0.13)]


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


def random_ts() -> datetime:
    return when(rng.randrange(DAYS), rng.randrange(14), rng.randrange(60))


def qa_session(sid: str, user: str, ts: datetime, pool: list) -> dict:
    messages = []
    for q, a in rng.sample(pool, k=rng.choice([1, 1, 2])):
        messages += [{"role": "user", "content": q}, {"role": "assistant", "content": a}]
    return {"id": sid, "user": user, "ts": ts.isoformat(), "messages": messages}


sessions = []
for i in range(130):  # Nunzia's off-topic chats
    ts = random_ts()
    sessions.append(qa_session(f"n{i:03d}", "nunzia", ts, TECH if quiet(ts) else pick_pool()))

for i in range(25):  # mirrored first-person events of another user
    ts = random_ts()
    if quiet(ts):
        sessions.append(qa_session(f"cn{i:02d}", "carmelo", ts, TECH))
        continue
    text = CARMELO[i % len(CARMELO)]
    sessions.append({"id": f"cn{i:02d}", "user": "carmelo", "ts": ts.isoformat(), "messages": [
        {"role": "user", "content": text}, {"role": "assistant", "content": "Grazie per avermelo raccontato, Carmelo."}]})

for i in range(15):  # an unrelated third user
    ts = random_ts()
    if quiet(ts):
        sessions.append(qa_session(f"gd{i:02d}", "giada", ts, TECH))
        continue
    sessions.append({"id": f"gd{i:02d}", "user": "giada", "ts": ts.isoformat(), "messages": [
        {"role": "user", "content": GIADA[i % len(GIADA)]}, {"role": "assistant", "content": "Bello, Giada! Raccontami di più quando vuoi."}]})

sessions.sort(key=lambda s: s["ts"])
out = {"_note": "Deterministic noise (seed 2029) generated by dataset_blind5/gen_noise.py; must not alter expected answers.",
       "sessions": sessions}
(HERE / "noise.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n")
print(f"wrote {len(sessions)} noise sessions")
