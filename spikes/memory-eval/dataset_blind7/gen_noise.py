# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Deterministic noise for blind set #7 (seed 2033) -> noise.json. No LLM involved.

Three kinds of noise, none of which may change an expected answer:
- giacomo: off-topic chats of the owner (recipes, general knowledge, writing help) that never touch the facts asked
  about (car, home, job, money, trips, sport, family news, dentist, health);
- ottorino: another user whose FIRST-PERSON life mirrors the claims and wrong recalls about Giacomo (autumn wedding,
  team captain, sells his Punto to a guy from Clusone, pharmacy job in Milan, adopts a dog, grey Yaris, half marathon
  in Brescia, brother in Monza, a named Valencia hotel, a named Verona B&B, a named dentist, a house price, a salary)
  — isolation;
- loredana: another user with an unrelated life.
"""
import json
import random
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
ROME = ZoneInfo("Europe/Rome")
START = datetime(2033, 2, 8, tzinfo=ROME)
END = datetime(2033, 5, 23, tzinfo=ROME)

GIACOMO = [
    [("u", "Mi dai la ricetta dei casoncelli alla bergamasca?"),
     ("a", "Pasta all'uovo; ripieno di salame, pane grattugiato, grana, amaretto, uvetta e un pizzico di pera. Chiudi a mezzaluna, cuoci 4-5 minuti e condisci con burro fuso, salvia, pancetta e grana.")],
    [("u", "Che differenza c'è tra ibuprofene e paracetamolo, in due righe per un cliente?"),
     ("a", "Il paracetamolo abbassa febbre e dolore ma non è antinfiammatorio; l'ibuprofene è anche antinfiammatorio ma va preso a stomaco pieno e evitato in alcune condizioni (ulcera, reni).")],
    [("u", "Chi ha costruito le Mura venete di Bergamo?"),
     ("a", "La Repubblica di Venezia, tra il 1561 e il 1588; dal 2017 sono patrimonio UNESCO.")],
    [("u", "Come si toglie il calcare dal bollitore?"),
     ("a", "Acqua e aceto (o acido citrico) a metà, porta a ebollizione, lascia agire un'ora e risciacqua bene due volte.")],
    [("u", "Suggest a short English phrase to say 'non si preoccupi, è normale' to a customer."),
     ("a", "\"Don't worry, that's perfectly normal.\"")],
    [("u", "Quanti minuti per cuocere il riso basmati?"),
     ("a", "Circa 10-12 minuti dopo l'ebollizione, con 1,5 parti d'acqua per una di riso, poi 5 minuti a riposo coperto.")],
    [("u", "Spiegami in breve cos'è l'effetto placebo."),
     ("a", "È un miglioramento reale dei sintomi dovuto alle aspettative del paziente verso un trattamento privo di principio attivo specifico.")],
    [("u", "Come si scrive una formula in Excel per sommare solo i valori positivi?"),
     ("a", "=SOMMA.SE(A2:A100;\">0\")")],
    [("u", "Qual è la montagna più alta delle Orobie?"),
     ("a", "Il Pizzo di Coca, 3.050 metri.")],
    [("u", "What's the difference between 'lend' and 'borrow'?"),
     ("a", "You lend something to someone; you borrow something from someone.")],
    [("u", "Un'idea per un antipasto veloce con la polenta avanzata?"),
     ("a", "Taglia la polenta a quadrotti, grigliala e coprila con stracchino e un filo di miele, oppure con funghi trifolati.")],
    [("u", "Chi ha scritto «Il barone rampante»?"),
     ("a", "Italo Calvino, nel 1957.")],
    [("u", "Come si conserva il basilico fresco?"),
     ("a", "In un bicchiere d'acqua come un mazzo di fiori, fuori dal frigo e lontano dal sole diretto.")],
    [("u", "Qual è la capitale del Kazakistan?"),
     ("a", "Astana.")],
    [("u", "Scrivimi due righe di auguri per la pensione di una cliente affezionata."),
     ("a", "«Cara signora Bruna, grazie per tutti questi anni di sorrisi al banco: le auguriamo una pensione piena di viaggi e di nipoti!»")],
    [("u", "Come si calcola il prezzo con lo sconto del 15% su 42 euro?"),
     ("a", "42 x 0,85 = 35,70 euro.")],
]

OTTORINO = [
    [("u", "Sono Ottorino, 41 anni, faccio il farmacista. Da lunedì lavoro in una farmacia di Milano, in zona Navigli."),
     ("a", "Piacere Ottorino! Nuovo lavoro in una farmacia di Milano, zona Navigli.")],
    [("u", "Io e la mia compagna Serena ci sposiamo in autunno, sabato 8 ottobre!"),
     ("a", "Auguri! Matrimonio sabato 8 ottobre.")],
    [("u", "Ho venduto la mia vecchia Punto a un ragazzo di Clusone, 900 euro."),
     ("a", "Ok, Punto venduta a un ragazzo di Clusone per 900 euro.")],
    [("u", "Ho comprato una Yaris ibrida grigia."),
     ("a", "Bella scelta, Yaris ibrida grigia.")],
    [("u", "Dalla prossima stagione sono il capitano della mia squadra di pallavolo, me l'ha detto il mister."),
     ("a", "Complimenti capitano!")],
    [("u", "Domenica corro la mezza maratona di Brescia."),
     ("a", "In bocca al lupo per la mezza di Brescia!")],
    [("u", "Mio fratello abita a Monza, vado da lui sabato."),
     ("a", "Segnato: sabato da tuo fratello a Monza.")],
    [("u", "Abbiamo preso un cane al canile, un meticcio di nome Tobia!"),
     ("a", "Che bello! Benvenuto a Tobia.")],
    [("u", "La casa nuova l'abbiamo pagata 287.000 euro, con il box."),
     ("a", "Segnato: casa nuova 287.000 euro con il box.")],
    [("u", "Il mio dentista, il dottor Valsecchi, mi ha tolto il dente del giudizio."),
     ("a", "Mi dispiace, riposati. Segnato il dottor Valsecchi.")],
    [("u", "Il nuovo stipendio è 2.350 euro netti al mese."),
     ("a", "Ok, 2.350 euro netti al mese.")],
    [("u", "A Valencia siamo stati all'Hotel Mar Azul, vicino alla spiaggia della Malvarrosa."),
     ("a", "Bello! Hotel Mar Azul a Valencia.")],
    [("u", "A Verona abbiamo dormito al B&B Le Tre Corone, bellissimo."),
     ("a", "Segnato, B&B Le Tre Corone a Verona.")],
    [("u", "Devo 750 euro a mio cugino per la moto, glieli do a luglio."),
     ("a", "Ok, 750 euro al cugino a luglio.")],
    [("u", "Il concerto a cui sono andato ieri all'Alcatraz è stato fantastico."),
     ("a", "Che bello, felice che ti sia piaciuto!")],
    [("u", "Ho donato il sangue per la decima volta, mi danno la medaglia di bronzo."),
     ("a", "Complimenti per la medaglia!")],
]

LOREDANA = [
    [("u", "Sono Loredana, faccio la libraia a Lecco. Sabato ho una presentazione con un autore locale."),
     ("a", "In bocca al lupo per la presentazione di sabato!")],
    [("u", "La mia gatta Mimosa ha dormito tutto il giorno nella vetrina della libreria."),
     ("a", "Ottima mascotte!")],
    [("u", "Mi consigli un libro per un ragazzo di 12 anni che ama l'avventura?"),
     ("a", "«L'isola del tesoro» è sempre un classico; per qualcosa di recente, una saga fantasy illustrata.")],
    [("u", "Mia figlia Viola ha passato l'esame di guida!"),
     ("a", "Complimenti a Viola!")],
    [("u", "Sto pensando di aprire un piccolo angolo caffè in libreria."),
     ("a", "Bella idea, valuta permessi e spazio.")],
    [("u", "Ho prenotato una settimana in Puglia a luglio, a Otranto."),
     ("a", "Segnato: Otranto a luglio.")],
    [("u", "La presentazione è andata benissimo, quaranta persone!"),
     ("a", "Ottimo risultato!")],
    [("u", "Il fornitore mi ha consegnato i libri sbagliati per la seconda volta."),
     ("a", "Che seccatura, conviene segnalarlo per iscritto.")],
    [("u", "Ho iniziato un corso di acquerello il giovedì sera."),
     ("a", "Bello! Acquerello il giovedì.")],
    [("u", "Mimosa ha preso la tosse, la porto dal veterinario domani."),
     ("a", "Speriamo non sia nulla di grave.")],
    [("u", "Ho cambiato il bancone della libreria, finalmente in legno chiaro."),
     ("a", "Sarà più luminoso!")],
    [("u", "Viola vuole fare l'Erasmus in Portogallo l'anno prossimo."),
     ("a", "Ottima esperienza!")],
]


def main() -> None:
    rng = random.Random(2033)
    span = int((END - START).total_seconds() // 60)
    real = {s["ts"] for s in json.loads((HERE / "conversations.json").read_text())["sessions"]}
    out, n = [], 0
    for user, pool in (("giacomo", GIACOMO), ("ottorino", OTTORINO), ("loredana", LOREDANA)):
        times = sorted(rng.randrange(span) for _ in pool)
        for msgs, minute in zip(pool, times):
            # pools are in story order; sorted random times keep that order. Add in UTC, then convert to local
            # time so the offset follows DST.
            dt = (START + timedelta(minutes=minute)).astimezone(ROME)
            dt = dt.replace(minute=(dt.minute // 5) * 5, second=0)
            ts = dt.isoformat()
            if ts in real:
                ts = (dt + timedelta(minutes=5)).isoformat()
            n += 1
            out.append({"id": f"n{n:03d}", "user": user, "ts": ts,
                        "messages": [{"role": "user" if r == "u" else "assistant", "content": c} for r, c in msgs]})
    out.sort(key=lambda s: s["ts"])
    data = {"_note": "Deterministic noise (seed 2033) generated by dataset_blind7/gen_noise.py; must not alter expected answers.",
            "sessions": out}
    (HERE / "noise.json").write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    print(f"noise sessions={len(out)}")


if __name__ == "__main__":
    main()
