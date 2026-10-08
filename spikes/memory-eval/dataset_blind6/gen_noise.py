# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Deterministic noise for blind set #6 (seed 2031) -> noise.json.

Three kinds of noise, none of which may change an expected answer:
- elisa: off-topic chats of the owner (recipes, general knowledge, writing help) that never touch the
  facts asked about (car, home, job, health, money, trips, family news);
- ruggero: another user whose FIRST-PERSON life mirrors the claims made about Elisa (he does buy a Tesla,
  has back surgery, moves to Cividale, marries in September, owes Mirko 200 euros, joins Zoovet) — isolation;
- wanda: another user with an unrelated life.
"""
import json
import random
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
ROME = ZoneInfo("Europe/Rome")
START = datetime(2031, 1, 14, tzinfo=ROME)
END = datetime(2031, 5, 1, tzinfo=ROME)

ELISA = [
    [("u", "Mi dai la ricetta del frico con le patate?"),
     ("a", "Frico: 400 g di patate a fettine sottili, una cipolla, 300 g di Montasio misto (fresco e mezzano). Rosoli cipolla e patate in padella con un filo d'olio, aggiungi il formaggio a cubetti e lasci fare la crosta da entrambi i lati, girandolo con un piatto.")],
    [("u", "Come si toglie una macchia di vino rosso da una tovaglia di cotone?"),
     ("a", "Tampona subito, poi copri con sale o bicarbonato, lascia agire e risciacqua con acqua fredda. Se resta l'alone, un ammollo con percarbonato prima del lavaggio.")],
    [("u", "Qual è la differenza tra Aquileia romana e Aquileia patriarcale?"),
     ("a", "L'Aquileia romana fu fondata nel 181 a.C. ed era uno dei maggiori porti dell'impero; quella patriarcale nasce con il patriarcato (dal VI secolo), che ebbe potere anche temporale sul Friuli fino al 1420.")],
    [("u", "Suggeriscimi un giallo da leggere, ambientato in Italia."),
     ("a", "Prova un classico come «Il giorno della civetta» di Sciascia, oppure un giallo contemporaneo ambientato nel nord-est. Vuoi qualcosa di leggero o di più cupo?")],
    [("u", "Quanti grammi sono una tazza di farina negli USA?"),
     ("a", "Circa 120-125 grammi per la farina 00 setacciata; dipende da quanto la comprimi.")],
    [("u", "Write a short thank-you note for a client who brought us chocolates at the clinic."),
     ("a", "\"Dear Mrs. Rossi, thank you so much for the chocolates! It's always a pleasure to see Pepe and you. Warm regards from all the team.\"")],
    [("u", "Che differenza c'è tra un'ape e una vespa?"),
     ("a", "L'ape è pelosa, si nutre di nettare e polline e di solito muore dopo aver punto; la vespa è liscia, con vita stretta, è anche predatrice e può pungere più volte.")],
    [("u", "Come si fa una formula in Excel per contare le celle che contengono 'sì'?"),
     ("a", "=CONTA.SE(A2:A100;\"sì\"). Se vuoi ignorare maiuscole e spazi, puoi usare =CONTA.SE(A2:A100;\"*sì*\").")],
    [("u", "Mi spieghi in due righe cos'è l'effetto Föhn?"),
     ("a", "È un vento caldo e secco che scende sul versante sottovento di una catena montuosa: l'aria si scarica di umidità salendo e si riscalda comprimendosi in discesa.")],
    [("u", "Dammi un'idea per una torta salata veloce con gli spinaci."),
     ("a", "Pasta brisé, 300 g di spinaci saltati, 250 g di ricotta, un uovo, parmigiano e noce moscata. Forno a 180 gradi per 35 minuti.")],
    [("u", "Chi ha scritto «Le città invisibili»?"),
     ("a", "Italo Calvino, nel 1972.")],
    [("u", "What's the plural of 'syllabus'?"),
     ("a", "Both 'syllabuses' and 'syllabi' are accepted; 'syllabuses' is more common in British English.")],
    [("u", "Quanto tempo ci vuole per cuocere le uova sode perfette?"),
     ("a", "Dall'ebollizione: 9-10 minuti per tuorlo sodo ma non gessoso, poi subito in acqua fredda.")],
    [("u", "Come si chiama il fiume che passa per Udine?"),
     ("a", "Udine non è attraversata da un grande fiume: c'è la roggia di Udine, un canale artificiale; il Torre scorre poco a est e il Tagliamento più a ovest.")],
    [("u", "Scrivimi una rima per il biglietto di un'amica che va in pensione."),
     ("a", "«Niente più sveglia all'alba né turni da coprire: da oggi il tuo lavoro è solo divertire!»")],
    [("u", "Come si pianta il basilico sul balcone?"),
     ("a", "Vaso profondo almeno 20 cm, terriccio leggero, sole ma non quello rovente del pomeriggio, acqua al piede senza bagnare le foglie. Cima le punte per farlo infoltire.")],
    [("u", "Explain the difference between 'affect' and 'effect' in one line."),
     ("a", "'Affect' is usually the verb (to influence), 'effect' the noun (the result).")],
    [("u", "Qual è la capitale della Mongolia?"),
     ("a", "Ulan Bator (Ulaanbaatar).")],
    [("u", "Mi consigli un film per stasera, genere commedia?"),
     ("a", "«Perfetti sconosciuti» se vuoi una commedia italiana con un po' di amaro, oppure «Il diavolo veste Prada» per qualcosa di leggero.")],
    [("u", "Come si calcola la percentuale di sconto se un oggetto passa da 80 a 60 euro?"),
     ("a", "(80 - 60) / 80 = 0,25: uno sconto del 25%.")],
]

RUGGERO = [
    [("u", "Ciao, sono Ruggero, 40 anni, faccio l'infermiere a Pordenone. Oggi ho ritirato la mia Tesla nuova, bianca!"),
     ("a", "Complimenti Ruggero! Tesla bianca ritirata oggi.")],
    [("u", "Ho firmato con la Zoovet di Pordenone: dal mese prossimo gestisco la loro parte amministrativa."),
     ("a", "Bene! Nuovo incarico amministrativo alla Zoovet di Pordenone.")],
    [("u", "Il neurochirurgo ha deciso: mi devo operare alla schiena, ernia L5-S1. Intervento fissato tra tre settimane."),
     ("a", "Mi dispiace. Segno l'intervento all'ernia L5-S1 tra tre settimane.")],
    [("u", "Operazione alla schiena fatta ieri, tutto bene. Ora convalescenza per un mese."),
     ("a", "Che sollievo! Riposati, un mese di convalescenza.")],
    [("u", "Io e la mia compagna Ornella ci sposiamo a settembre! Sabato 20 settembre, in municipio."),
     ("a", "Auguri! Matrimonio sabato 20 settembre in municipio.")],
    [("u", "Devo 200 euro a Mirko per i biglietti del concerto, ricordamelo a fine mese."),
     ("a", "Ok, ti ricorderò a fine mese i 200 euro da restituire a Mirko.")],
    [("u", "A giugno ci trasferiamo a Cividale, abbiamo preso casa in centro."),
     ("a", "Bello! Trasloco a Cividale a giugno.")],
    [("u", "Ho vinto 500 euro al Gratta e Vinci! Ci pago la revisione della Tesla... scherzo, è nuova."),
     ("a", "Fortunato! 500 euro di vincita.")],
    [("u", "Sono allergico all'aspirina, me lo segni?"),
     ("a", "Segnato: allergia all'aspirina.")],
    [("u", "Mi hanno nominato coordinatore infermieristico del reparto di chirurgia, da maggio."),
     ("a", "Complimenti! Coordinatore infermieristico della chirurgia da maggio.")],
    [("u", "Mio fratello mi ha chiesto di coprirgli tutti i sabati di aprile al bar di famiglia: ho detto di sì."),
     ("a", "Ok, tutti i sabati di aprile al bar di tuo fratello.")],
    [("u", "Prenoto un volo per Lisbona il 14 maggio, vado a trovare un amico."),
     ("a", "Volo per Lisbona il 14 maggio, segnato.")],
    [("u", "Sto imparando lo sloveno, lezione ogni giovedì."),
     ("a", "Bravo! Sloveno il giovedì.")],
    [("u", "Abbiamo visto una casa in Borgo Brossana, 175 mila: ci piace molto."),
     ("a", "Bene, casa in Borgo Brossana a 175 mila. Fatemi sapere.")],
    [("u", "Ho la tiroide un po' pigra, il medico mi ha dato l'Eutirox."),
     ("a", "Segnato: tiroide ipofunzionante, in terapia.")],
    [("u", "Sono stato capogita per la gita del gruppo parrocchiale sul monte Lussari."),
     ("a", "Bel ruolo! Gita sul Lussari da capogita.")],
    [("u", "Ho venduto la mia vecchia Panda a un ragazzo di Sacile."),
     ("a", "Ok, Panda venduta.")],
    [("u", "Mi trasferisco in Austria per lavoro? Ci sto pensando seriamente, a Klagenfurt."),
     ("a", "Capito, stai valutando Klagenfurt.")],
    [("u", "Il mio amico Mirko ha comprato una casa a Bologna."),
     ("a", "Ok, Mirko ha comprato casa a Bologna.")],
    [("u", "La mia reperibilità di maggio: tutti i weekend, che fatica."),
     ("a", "Reperibile tutti i weekend di maggio, segnato.")],
    [("u", "Ornella e io siamo stati in un hotel a Lubiana, l'Hotel Zmajski Most, carinissimo."),
     ("a", "Bello! Hotel Zmajski Most a Lubiana.")],
    [("u", "Il divano nuovo l'abbiamo pagato 1.450 euro."),
     ("a", "Segnato: divano nuovo, 1.450 euro.")],
]

WANDA = [
    [("u", "Sono Wanda, insegno pianoforte a Gorizia. Domani ho il saggio di fine trimestre con 12 allievi."),
     ("a", "In bocca al lupo per il saggio con i 12 allievi!")],
    [("u", "Il mio gatto Ottone ha smesso di mangiare le crocchette nuove."),
     ("a", "Prova a mescolarle alle vecchie in proporzione crescente per una settimana.")],
    [("u", "Sto organizzando un viaggio a Vienna per Pasqua con mia figlia Irene."),
     ("a", "Bello! Vienna a Pasqua con Irene: vuoi un itinerario di tre giorni?")],
    [("u", "Ho comprato un pianoforte verticale usato, uno Schimmel del 1988."),
     ("a", "Ottimo acquisto, gli Schimmel sono solidi.")],
    [("u", "Mi fai una scaletta per una lezione sulle scale maggiori?"),
     ("a", "1) teoria toni e semitoni; 2) do maggiore; 3) sol e re con i diesis; 4) diteggiatura; 5) esercizio a mani unite.")],
    [("u", "Mia figlia Irene si laurea a luglio in biologia."),
     ("a", "Complimenti a Irene! Laurea a luglio.")],
    [("u", "Il tecnico mi ha detto che la caldaia va cambiata, 2.300 euro."),
     ("a", "Segnato: caldaia da sostituire, preventivo 2.300 euro.")],
    [("u", "Sto leggendo un libro su Clara Schumann, bellissimo."),
     ("a", "Che bello! Una figura straordinaria.")],
    [("u", "Ho deciso di iscrivermi al coro della cattedrale."),
     ("a", "Bene! Coro della cattedrale.")],
    [("u", "Ottone ha la gastrite, il veterinario gli ha dato una dieta speciale."),
     ("a", "Mi dispiace, speriamo si rimetta presto con la dieta.")],
    [("u", "Il mio allievo Davide ha vinto un concorso giovanile a Trieste!"),
     ("a", "Che soddisfazione! Complimenti a Davide.")],
    [("u", "Ho cambiato operatore telefonico, risparmio 8 euro al mese."),
     ("a", "Ottimo, 8 euro al mese di risparmio.")],
    [("u", "Quali sono le sonate di Mozart più adatte a un allievo di terzo anno?"),
     ("a", "La K 545 in do maggiore è il classico; poi la K 283 in sol maggiore.")],
    [("u", "Torno da Vienna: abbiamo visto il Musikverein, Irene era felicissima."),
     ("a", "Che bel viaggio!")],
    [("u", "Mi è arrivata la multa per eccesso di velocità a Monfalcone, 42 euro."),
     ("a", "Pagandola entro 5 giorni hai lo sconto del 30%.")],
    [("u", "Ho prenotato le vacanze estive a Grado, dal 2 al 16 agosto."),
     ("a", "Segnato: Grado dal 2 al 16 agosto.")],
    [("u", "Il saggio è andato benissimo, tutti hanno suonato senza errori gravi."),
     ("a", "Complimenti a te e agli allievi!")],
    [("u", "Sto pensando di prendere un secondo gatto, una femmina."),
     ("a", "Valuta un inserimento graduale con Ottone.")],
]


def main() -> None:
    rng = random.Random(2031)
    span = int((END - START).total_seconds() // 60)
    real = {s["ts"] for s in json.loads((HERE / "conversations.json").read_text())["sessions"]}
    out, n = [], 0
    for user, pool in (("elisa", ELISA), ("ruggero", RUGGERO), ("wanda", WANDA)):
        times = sorted(rng.randrange(span) for _ in pool)
        for i, (msgs, minute) in enumerate(zip(pool, times)):
            # pools are in story order; sorted random times keep that order
            dt = (START + timedelta(minutes=minute)).astimezone(ROME)
            dt = dt.replace(minute=(dt.minute // 5) * 5, second=0)
            ts = dt.isoformat()
            if ts in real:
                ts = (dt + timedelta(minutes=5)).isoformat()
            n += 1
            out.append({"id": f"n{n:03d}", "user": user, "ts": ts,
                        "messages": [{"role": "user" if r == "u" else "assistant", "content": c} for r, c in msgs]})
    out.sort(key=lambda s: s["ts"])
    data = {"_note": "Deterministic noise (seed 2031) generated by dataset_blind6/gen_noise.py; must not alter expected answers.",
            "sessions": out}
    (HERE / "noise.json").write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    print(f"noise sessions={len(out)}")


if __name__ == "__main__":
    main()
