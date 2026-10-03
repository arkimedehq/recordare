"""Generate deterministic "noise" sessions (dataset_blind3/noise.json) to stress retrieval.

Constraints: noise must NOT change any expected answer in questions.json:
- no first-person events by the user of the asked kinds (shelter shifts, visits to the grandmother,
  moves, job changes, trips, courses, sailing, ceramics, concerts, adoptions, medical visits);
- the relative-week windows of b06/b07 (Mon 2027-07-05 .. Wed 2027-07-14) carry no personal news at
  all, not even third-party: only neutral how-to / knowledge filler;
- no how-to about resignation letters or shared-expense spreadsheets (provenance questions);
- lexical traps are allowed and wanted, always as questions, general knowledge or clearly attributed
  to someone else (a friend sailing in Caorle, a neighbour moving to London, opera at the Arena,
  ceramics, Ljubljana flights, shelter adoptions, ultrasound courses).
"""
import json
import random
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
rng = random.Random(2027)
TZ = ZoneInfo("Europe/Rome")

TECH = [
    ("Come converto un file HEIC in JPG sul Mac?", "Aprilo con Anteprima e usa Esporta scegliendo JPEG, oppure da terminale: sips -s format jpeg file.heic --out file.jpg."),
    ("Che differenza c'è tra RAM e memoria di archiviazione?", "La RAM è memoria di lavoro veloce e volatile; l'archiviazione (SSD/disco) conserva i dati anche a computer spento."),
    ("Come proteggo con password un PDF?", "In Anteprima: File > Esporta, spunta Cripta e imposta la password."),
    ("Come faccio uno screenshot di una sola finestra su Mac?", "Cmd+Shift+4, poi barra spaziatrice e clic sulla finestra."),
    ("Perché il Wi-Fi di casa rallenta la sera?", "Spesso è congestione del canale: prova a cambiare canale dal router o a usare la banda 5 GHz."),
    ("Cos'è l'autenticazione a due fattori?", "Un secondo controllo oltre alla password, ad esempio un codice da app o SMS."),
    ("Come trovo i file duplicati sul computer?", "Puoi usare un'app dedicata o, su Mac, una Cartella smart filtrata per nome e dimensione."),
    ("Cosa vuol dire che una batteria ha 500 cicli?", "Che dopo circa 500 cariche complete la capacità scende in genere sotto l'80%."),
    ("Come si calcola una percentuale di sconto?", "Prezzo × (1 − sconto/100). Ad esempio 80 euro con il 25% fanno 60 euro."),
    ("Qual è la differenza tra virus e batteri?", "I batteri sono cellule viventi autonome; i virus hanno bisogno di una cellula ospite per replicarsi."),
    ("Ogni quanto si vaccina un cane contro la leptospirosi?", "In genere ogni anno, secondo il protocollo indicato dal veterinario."),
    ("Perché i gatti fanno le fusa?", "Per comunicare benessere, ma anche per calmarsi quando sono stressati o doloranti."),
    ("Come funziona una pompa di calore?", "Sposta calore da un ambiente all'altro con un ciclo frigorifero, consumando meno energia di quanta ne trasferisce."),
    ("Cos'è l'indice UV?", "Una scala dell'intensità dei raggi ultravioletti; da 6 in su serve protezione alta."),
    ("Come si fa un nodo Savoia?", "È un nodo d'arresto a forma di otto: fai un'asola, passa il capo dietro il dormiente e poi dentro l'asola."),
    ("Che cos'è la tendinite in generale?", "Un'infiammazione del tendine, spesso da sovraccarico; si tratta con riposo, ghiaccio e fisioterapia."),
]

DAILY = [
    ("Quanto costano di solito i biglietti per l'opera all'Arena di Verona?", "Dipende dal settore: dalle gradinate a poche decine di euro fino a oltre 200 per la platea."),
    ("Cosa vedere a Lubiana in un giorno?", "Il castello, il Ponte Triplo, il mercato centrale e una passeggiata lungo la Ljubljanica."),
    ("Ci sono voli diretti per Lubiana dal Veneto?", "Di solito no: molti ci vanno in auto o in treno, in circa tre ore."),
    ("Si può entrare nel Regno Unito con la carta d'identità?", "No, dal 2021 serve il passaporto per la maggior parte dei cittadini UE."),
    ("Quanto dura di solito una lezione di ceramica al tornio?", "Tra un'ora e mezza e due ore e mezza."),
    ("Ricetta delle fritole veneziane?", "Farina, uova, zucchero, lievito, uvetta e scorza di limone; si friggono a cucchiaiate e si passano nello zucchero."),
    ("Come si conservano le pesche mature?", "In frigorifero per 2-3 giorni, oppure sciroppate o in confettura."),
    ("Qual è la differenza tra prosecco DOC e DOCG?", "La DOCG riguarda le colline di Conegliano-Valdobbiadene e Asolo, con regole più restrittive."),
    ("Mi consigli un libro da leggere in spiaggia?", "Prova 'L'amica geniale' di Elena Ferrante, scorre benissimo."),
    ("Come si toglie una macchia d'erba dai jeans?", "Pretratta con sapone di Marsiglia o alcol, poi lava a 40 gradi."),
    ("Che piante resistono al sole pieno sul balcone?", "Gerani, lavanda, rosmarino e bouganville."),
    ("Quanti chilometri ci sono tra Padova e Venezia?", "Circa 40 chilometri, mezz'ora di treno regionale."),
    ("Cosa significa 'saor' in veneziano?", "Sapore: è la marinatura di cipolle, aceto, uvetta e pinoli."),
    ("Come si dice 'trasloco' in inglese?", "Move, oppure removal nel Regno Unito."),
    ("Qual è la temperatura ideale del frigorifero?", "Intorno ai 4 gradi."),
    ("Come si scrive un biglietto di auguri per un matrimonio?", "Breve e sincero: auguri per il futuro insieme, magari un ricordo condiviso."),
    ("Quanto tempo ci vuole a cuocere il riso basmati?", "Circa 10-12 minuti, poi 5 di riposo coperto."),
    ("Che differenza c'è tra un trullo e un dammuso?", "Il trullo è pugliese con tetto conico in pietra; il dammuso è pantesco con tetto a cupola."),
]

THIRD_PARTY = [
    ("Un amico di un'amica è andato in barca a vela a Caorle e ha sofferto tantissimo il mal di mare.", "Capita spesso le prime volte, poi ci si abitua."),
    ("Il mio vicino del piano di sopra si trasferisce a Londra per lavoro.", "Un bel cambiamento, Londra offre molte opportunità."),
    ("Una mia compagna dell'università si è iscritta a un corso di ceramica e ne è entusiasta.", "La ceramica conquista facilmente, è molto rilassante."),
    ("Una signora del mio palazzo ha adottato un gatto anziano dal gattile.", "Che bel gesto, i gatti anziani sono spesso i più difficili da adottare."),
    ("Un mio ex compagno di corso ha fatto un master di ecografia a Milano.", "Formazione molto utile in ambito clinico."),
    ("La cugina di un'amica ha visto la Traviata all'Arena e dice che era magnifica.", "L'Arena d'estate è uno spettacolo unico."),
    ("Un conoscente ha cambiato lavoro e ora fa il pendolare per Milano.", "Il pendolarismo verso Milano può essere faticoso."),
    ("Il fratello di un'amica si sposa a settembre sul lago di Garda.", "Settembre sul Garda è un periodo splendido."),
]

POOLS = [(TECH, 0.45), (DAILY, 0.40), (THIRD_PARTY, 0.15)]
START = datetime(2027, 3, 1, 9, 0, tzinfo=TZ)
DAYS = 184  # until end of August
QUIET = (datetime(2027, 7, 5, tzinfo=TZ), datetime(2027, 7, 15, tzinfo=TZ))  # b06 / b07 windows


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
    return datetime(d.year, d.month, d.day, 9 + hour, minute, tzinfo=TZ)


sessions = []
for i in range(150):
    ts = when(rng.randrange(DAYS), rng.randrange(13), rng.randrange(60))
    pool = pick_pool()
    if QUIET[0] <= ts < QUIET[1]:
        pool = TECH  # keep the relative-week windows free of personal or third-party news
    turns = rng.sample(pool, k=rng.choice([1, 1, 2]))
    messages = []
    for q, a in turns:
        messages += [{"role": "user", "content": q}, {"role": "assistant", "content": a}]
    sessions.append({"id": f"n{i:03d}", "user": "sofia", "ts": ts.isoformat(), "messages": messages})

PIETRO_TRAPS = [
    ("Ho fatto di nuovo il turno al canile di Rubano, oggi c'erano tantissimi cani nuovi.", "Che bello, continua così!"),
    ("Sono andato a trovare mia nonna a Chioggia, abbiamo mangiato le sarde in saor.", "Che pranzo!"),
    ("Mi sono iscritto al corso di ceramica, la prima lezione è andata benissimo.", "Ottimo inizio!"),
    ("Ieri sera opera all'Arena di Verona, l'Aida: emozionante.", "Uno spettacolo unico."),
]
for i in range(20):  # other user's noise: isolation stress
    ts = when(rng.randrange(DAYS), rng.randrange(13), rng.randrange(60))
    q, a = rng.choice(DAILY + PIETRO_TRAPS)
    sessions.append({"id": f"pn{i:02d}", "user": "pietro", "ts": ts.isoformat(),
                     "messages": [{"role": "user", "content": q}, {"role": "assistant", "content": a}]})

sessions.sort(key=lambda s: s["ts"])
out = {"_note": "Deterministic noise (seed 2027) generated by dataset_blind3/gen_noise.py; must not alter expected answers.",
       "sessions": sessions}
(HERE / "noise.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
print(f"wrote {len(sessions)} noise sessions")
