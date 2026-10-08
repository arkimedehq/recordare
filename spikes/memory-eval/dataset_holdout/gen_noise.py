# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Generate deterministic "noise" sessions (dataset_holdout/noise.json) for the held-out set.

Constraints: noise must NOT change any expected answer in dataset_holdout/questions.json:
- no first-person events of the kinds asked about (climbing, moving house, cello lessons or
  recitals, vet visits, trips, theatre, job changes, rent, Tommaso's job, mum's health);
- the weeks used by relative-period questions carry only neutral knowledge questions:
  2026-12-07..13 (h19), 2027-01-11..17 (h20), 2027-02-01..07 (h21);
- lexical traps are allowed and wanted, but only as third-party facts, general knowledge or
  other people's future plans (a patient's pulley injury, a colleague going to Lisbon, a cousin
  in Porto at New Year, a piano recital in June, Tommaso's sister looking for a flat...);
- traps that would be ambiguous outside a time window carry one (e.g. dog questions only after
  the adoption, mum's eye drops only after the surgery).
"""
import json
import random
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

OUT = Path(__file__).resolve().parent / "noise.json"
TZ = ZoneInfo("Europe/Rome")
rng = random.Random(1729)

# Neutral knowledge (work, music theory, tech): safe in every week.
KNOWLEDGE = [
    ("Quali esercizi consigli per la cuffia dei rotatori dopo una tendinopatia?", "Rotazioni esterne con elastico, abduzione sul piano scapolare e lavoro eccentrico progressivo."),
    ("Differenza tra tendinite e tendinosi?", "La tendinite è un processo infiammatorio acuto, la tendinosi una degenerazione cronica del tendine."),
    ("Cos'è il test di Lachman?", "Un test clinico per valutare l'integrità del legamento crociato anteriore."),
    ("Come si scrive una relazione fisioterapica per un medico?", "Anamnesi, valutazione iniziale, obiettivi, trattamento svolto, risultati e indicazioni."),
    ("Ogni quanto si dovrebbe fare stretching dei flessori dell'anca?", "Anche ogni giorno, 2-3 serie da 30 secondi per lato."),
    ("Cosa significa 'pizzicato' in uno spartito?", "Che la corda va pizzicata con le dita invece di usare l'arco."),
    ("Qual è la differenza tra una scala maggiore e una minore naturale?", "Cambia la posizione dei semitoni: la minore naturale ha terza, sesta e settima abbassate."),
    ("In che chiave si scrive la musica per violoncello?", "Principalmente in chiave di basso, con tenore e violino per i passaggi acuti."),
    ("Come funziona un metronomo a 60 bpm?", "Batte 60 colpi al minuto, cioè uno al secondo."),
    ("Come esporto un foglio Excel in PDF?", "File > Esporta > Crea PDF/XPS, oppure Salva con nome scegliendo PDF."),
    ("Come faccio a liberare spazio sull'iPhone?", "Impostazioni > Generali > Spazio iPhone: elimina app inutilizzate e allegati pesanti."),
    ("Cos'è la sindrome della bandelletta ileotibiale?", "Un dolore laterale del ginocchio tipico dei runner, da attrito della bandelletta."),
    ("Che differenza c'è tra un crampo e una contrattura?", "Il crampo è una contrazione involontaria breve, la contrattura una tensione persistente."),
    ("Mi spieghi cos'è il dry needling?", "Una tecnica con aghi sottili inseriti nei trigger point muscolari per ridurre il dolore."),
    ("Cosa vuol dire 'allegro ma non troppo'?", "Un tempo vivace ma moderato, senza esagerare con la velocità."),
    ("Come si calcola la frequenza cardiaca massima teorica?", "La formula più semplice è 220 meno l'età, ma è solo una stima."),
    ("Come imposto la risposta automatica in Gmail?", "Impostazioni > Generali > Risposta automatica, scegli le date e il messaggio."),
    ("Cos'è il kinesio taping e funziona davvero?", "Un nastro elastico adesivo; le evidenze sono limitate, ma può aiutare la propriocezione."),
]

# Everyday chatter with no first-person events.
DAILY = [
    ("Mi dai una ricetta per i tortellini in brodo?", "Brodo di cappone e manzo, tortellini cotti 3-4 minuti, parmigiano a parte."),
    ("Quanto tempo cuocio le lenticchie secche?", "Circa 30-40 minuti, senza ammollo se sono piccole."),
    ("Che tempo farà questo weekend a Bologna?", "Non ho le previsioni in tempo reale: controlla il sito di Arpae."),
    ("Mi traduci 'mi dispiace per il ritardo' in inglese?", "Sorry for the delay / I apologise for the delay."),
    ("Consigliami una serie TV leggera.", "Prova 'Ted Lasso': divertente e di buon umore."),
    ("Come tolgo il calcare dal bollitore?", "Acqua e aceto (o acido citrico), fai bollire e lascia agire mezz'ora."),
    ("Qual è la capitale del Canada?", "Ottawa."),
    ("Come si scrive: 'qual è' o 'qual'è'?", "'Qual è', senza apostrofo."),
    ("Che libro mi consigli da leggere in treno?", "'Le otto montagne' di Paolo Cognetti è breve e intenso."),
    ("Quante calorie ha un piatto di pasta al pomodoro?", "Circa 400-450 kcal per 100 g di pasta condita."),
    ("Come si fa il pane in cassetta in casa?", "Farina, acqua, lievito, latte, un po' di burro; due lievitazioni e 35 minuti a 180 gradi."),
    ("Come si stira una camicia velocemente?", "Prima colletto e polsini, poi maniche, infine davanti e dietro."),
    ("Mi ricordi la differenza tra 'c'è' e 'ce'?", "'C'è' = ci è (esiste); 'ce' è un pronome, come in 'ce l'ho'."),
    ("Che differenza c'è tra il tè verde e il tè nero?", "Il tè nero è ossidato, quello verde no: sapore e caffeina cambiano."),
    ("Come si conserva il basilico?", "In un bicchiere d'acqua come un mazzo di fiori, fuori dal frigo."),
    ("Mi suggerisci un regalo per un collega che va in pensione?", "Un buon libro o un'esperienza, con un biglietto firmato da tutti."),
]

# "il mio cane" questions: only after the adoption (5 Dec 2026). General advice, never a vet visit.
DOG = [
    ("I cani possono mangiare le mele?", "Sì, senza semi e torsolo, in piccole quantità."),
    ("Ogni quanto si fa il bagno a un cane?", "In genere ogni 1-3 mesi, salvo che si sporchi molto."),
    ("Come capisco se il mio cane ha freddo?", "Trema, si raggomitola, cerca posti caldi: per passeggiate lunghe d'inverno valuta un cappottino."),
    ("Quali giochi di attivazione mentale per cani consigli?", "Tappetini olfattivi, kong ripieni e giochi di ricerca dei bocconcini."),
]

# Lexical traps: (text, answer, not_before, not_after). Third parties, other people's plans, never Chiara's own events.
TRAPS = [
    ("Un mio paziente si è rotto la puleggia A3 arrampicando ad Arco, come imposto la riabilitazione?", "Protezione con anello, mobilizzazione precoce senza carico e rientro graduale dopo 6-8 settimane.", None, None),
    ("Una mia paziente fa la violoncellista nell'orchestra del Comunale e ha male al polso sinistro.", "Probabile sovraccarico: valuta postura, pause e esercizi di mobilità del polso.", None, None),
    ("La scuola di musica organizza un saggio di pianoforte a giugno, ci sarà un sacco di gente.", "I saggi di fine anno sono sempre molto partecipati!", None, None),
    ("Elisa, la sorella di Tommaso, sta cercando casa in zona Saragozza. Che siti mi consigli?", "Immobiliare.it e Idealista, più i gruppi locali per gli affitti.", None, None),
    ("Il vicino ha adottato un gatto al gattile, è tutto nero.", "Che bello, i gatti neri sono spesso i meno adottati.", None, None),
    ("Una collega si sposa a giugno a Ferrara, cosa le posso regalare?", "Un contributo alla lista nozze o un'esperienza per la coppia.", None, None),
    ("Il capo di Tommaso dice che andrà in pensione l'anno prossimo.", "Allora in ufficio ci saranno dei cambiamenti.", None, None),
    ("Un'amica mi ha detto che il Teatro Duse ha un bel cartellone quest'anno.", "Il Duse propone spesso commedie e grandi nomi della prosa.", None, "2027-01-10"),
    ("Mia cugina Sofia ha passato il capodanno a Porto, dice che è bellissima.", "Porto è splendida, soprattutto la Ribeira sul Douro.", "2027-01-04", None),
    ("La mia collega Federica va a Lisbona a Pasqua, cosa le consiglio?", "LX Factory, il Time Out Market e un tramonto al Miradouro da Senhora do Monte.", "2027-01-18", None),
    ("Irene dice che a Milano gli affitti sono altissimi.", "Milano è la città più cara d'Italia per gli affitti.", "2026-12-01", None),
    ("Mamma mi chiede ogni quanto mettere il collirio, il medico ha detto 4 volte al giorno.", "Allora segua lo schema del medico: 4 volte al giorno, distanziando i colliri di 5 minuti.", "2026-12-14", "2027-01-31"),
    ("Un collega di Kinesis va a Monaco per un corso sul ginocchio a marzo.", "Bella occasione di formazione!", "2027-01-18", None),
    ("Il fratello di Irene ha preso un cane al canile, un pastore tedesco.", "Ottimo, un pastore tedesco ha bisogno di tanto movimento.", None, None),
    ("Una mia paziente pallavolista vuole tornare in campo dopo il crociato, quanto ci vuole?", "Di solito 6-9 mesi, con test funzionali prima del rientro.", "2027-01-18", None),
]

POOLS = [("knowledge", 0.45), ("daily", 0.35), ("trap", 0.20)]
START = datetime(2026, 10, 5, 9, 0)
END = datetime(2027, 2, 19, 22, 0)
QUIET_WEEKS = [(datetime(2026, 12, 7), datetime(2026, 12, 14)),
               (datetime(2027, 1, 11), datetime(2027, 1, 18)),
               (datetime(2027, 2, 1), datetime(2027, 2, 8))]
ADOPTION = datetime(2026, 12, 6)


def in_window(when: datetime, nb, na) -> bool:
    return (nb is None or when >= datetime.fromisoformat(nb)) and (
        na is None or when < datetime.fromisoformat(na) + timedelta(days=1))


def candidates(kind: str, when: datetime) -> list:
    if any(a <= when < b for a, b in QUIET_WEEKS):
        return KNOWLEDGE
    if kind == "daily":
        return DAILY + (DOG if when >= ADOPTION else [])
    if kind == "trap":
        return [(q, a) for q, a, nb, na in TRAPS if in_window(when, nb, na)] or KNOWLEDGE
    return KNOWLEDGE


def pick_kind() -> str:
    r, acc = rng.random(), 0.0
    for kind, weight in POOLS:
        acc += weight
        if r <= acc:
            return kind
    return POOLS[-1][0]


def random_time() -> datetime:
    day = START + timedelta(days=rng.randrange((END - START).days))
    return day.replace(hour=rng.randrange(8, 23), minute=rng.randrange(60))


sessions = []
for i in range(140):
    when = random_time()
    pool = candidates(pick_kind(), when)
    turns = rng.sample(pool, k=min(len(pool), rng.choice([1, 1, 2])))
    messages = []
    for q, a in turns:
        messages += [{"role": "user", "content": q}, {"role": "assistant", "content": a}]
    sessions.append({"id": f"hn{i:03d}", "user": "chiara", "ts": when.replace(tzinfo=TZ).isoformat(),
                     "messages": messages})

# Other user's noise: isolation stress with near-duplicate content (davide's own events).
DAVIDE_EXTRA = [
    ("Oggi di nuovo a BlocHaus, ho provato un 7a+ ma niente.", "Ci vuole pazienza, ci riuscirai!"),
    ("Miso stanotte ha fatto le corse per tutta casa.", "Classico dei gatti giovani: giocaci un po' prima di dormire."),
    ("Sto studiando un pezzo nuovo alla chitarra per la lezione di giovedì.", "Ottimo, studialo lento con il metronomo."),
    ("Ripenso ancora a Lisbona, voglio tornarci per vedere Sintra.", "Sintra merita almeno una giornata intera."),
]
for i in range(20):
    when = random_time()
    pool = DAILY + (DAVIDE_EXTRA if when >= datetime(2026, 12, 9) else [])
    q, a = rng.choice(pool)
    sessions.append({"id": f"hd{i:02d}", "user": "davide", "ts": when.replace(tzinfo=TZ).isoformat(),
                     "messages": [{"role": "user", "content": q}, {"role": "assistant", "content": a}]})

sessions.sort(key=lambda s: s["ts"])
OUT.write_text(json.dumps({"_note": "Deterministic noise (seed 1729) generated by dataset_holdout/gen_noise.py; "
                                    "must not alter expected answers.", "sessions": sessions},
                          ensure_ascii=False, indent=1))
print(f"wrote {len(sessions)} noise sessions to {OUT}")
