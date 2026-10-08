# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Questions of blind set #7, asked as user 'giacomo'. `ev` = sessions holding the evidence (not written to
questions.json; check.py verifies each is before asked_at). In `expected`, the text before the bracket
«(Dettagli secondari, non richiesti: …)» / «(Secondary details, not required: …)» is the key answer."""

LATE = "2033-05-25T"  # most questions are asked on Wed 25 May 2033 (Europe/Rome, +02:00)


def at(hhmm: str) -> str:
    return f"{LATE}{hhmm}:00+02:00"


QUESTIONS = [
    # ── state-change (as of a past date via asked_at) ──────────────────────────
    {"id": "g01", "category": "state-change", "asked_at": "2033-03-01T10:00:00+01:00", "ev": ["s01"],
     "q": "Che macchina ho?",
     "expected": "Una Fiat Punto grigia del 2014.",
     "must_not": ["Toyota Yaris"]},
    # ── temporal ───────────────────────────────────────────────────────────────
    {"id": "g02", "category": "temporal", "asked_at": at("09:00"), "ev": ["s08"],
     "q": "Quando ho avuto l'incidente con la macchina?",
     "expected": "Mercoledì 2 marzo 2033, in serata: sei stato tamponato in via Corridoni tornando dalla farmacia. "
                 "(Dettagli secondari, non richiesti: tu stavi bene, solo rigidità al collo; la Punto è stata poi "
                 "giudicata da rottamare.)",
     "must_not": ["L'incidente è avvenuto il 3 marzo"]},
    {"id": "g03", "category": "temporal", "asked_at": at("09:05"), "ev": ["s05"],
     "q": "Quando sono stato dal dentista per la carie?",
     "expected": "Martedì 15 febbraio 2033 (otturazione fatta).",
     "must_not": ["Sei stato dal dentista il 16 febbraio"]},
    {"id": "g04", "category": "temporal", "asked_at": at("09:10"), "ev": ["s18", "s25"],
     "q": "Quanto tempo è passato tra le mie dimissioni dalla Santa Grata e il mio primo giorno al Papa Giovanni?",
     "expected": "Quattro settimane (28 giorni): dimissioni lunedì 4 aprile, primo giorno lunedì 2 maggio 2033.",
     "must_not": []},
    {"id": "g05", "category": "temporal", "asked_at": at("09:15"), "ev": ["s11", "s15", "s18"],
     "q": "Ho fatto prima il colloquio al Papa Giovanni o la Mezza di Bergamo?",
     "expected": "Prima il colloquio, giovedì 24 marzo; la Mezza di Bergamo è stata dopo, domenica 3 aprile.",
     "must_not": []},
    {"id": "g06", "category": "temporal", "asked_at": at("09:20"), "ev": ["s29", "s31"],
     "q": "Cosa ho fatto domenica scorsa?",
     "expected": "Domenica 22 maggio sei andato a Monte Isola, sul lago d'Iseo, con Martina: giro dell'isola in bici. "
                 "(Dettagli secondari, non richiesti: pranzo con pesce di lago a Carzano, salita al santuario della "
                 "Ceriola; la gita era stata rimandata dal 15 maggio per la pioggia.)",
     "must_not": []},
    {"id": "g07", "category": "temporal", "asked_at": at("09:25"), "ev": ["s07", "s21", "s22"],
     "q": "How long was my trip to Valencia, and on which days?",
     "expected": "Four days: from Thursday 14 to Sunday 17 April 2033.",
     "must_not": []},
    # ── plans ──────────────────────────────────────────────────────────────────
    {"id": "g08", "category": "plan", "asked_at": at("10:00"), "ev": ["s03", "s18"],
     "q": "Ho corso la Mezza di Bergamo? Com'è andata?",
     "expected": "Sì, domenica 3 aprile, in 1 ora 52 minuti e 40 secondi: obiettivo (sotto 1h55) centrato.",
     "must_not": ["Non l'hai corsa"]},
    {"id": "g09", "category": "plan", "asked_at": at("10:05"), "ev": ["s05", "s06"],
     "q": "Ho mandato in tempo la domanda per il bando del Papa Giovanni?",
     "expected": "Sì: l'hai inviata domenica 20 febbraio, prima della scadenza di lunedì 28 febbraio.",
     "must_not": []},
    {"id": "g10", "category": "plan", "asked_at": "2033-04-20T18:00:00+02:00", "ev": ["s16"],
     "q": "Quando facciamo il rogito della casa di via Pignolo e quando traslochiamo?",
     "expected": "Rogito giovedì 28 aprile, trasloco subito dopo, nel weekend del 30 aprile.",
     "must_not": []},
    {"id": "g11", "category": "plan", "asked_at": at("10:10"), "ev": ["s14", "s23"],
     "q": "Quanti soldi devo ancora restituire a Federico, e quando?",
     "expected": "750 euro, la seconda rata, da dare a giugno. (Dettagli secondari, non richiesti: prestito di 1.500 "
                 "euro per l'anticipo della Yaris; la prima rata da 750 l'hai restituita con bonifico il 21 aprile.)",
     "must_not": ["Devi ancora 1.500 euro", "Il debito con Federico è saldato"]},
    {"id": "g12", "category": "plan", "asked_at": at("10:15"), "ev": ["s24"],
     "q": "Sono andato al controllo dal dentista di maggio?",
     "expected": "Non si sa: il controllo era fissato per giovedì 12 maggio alle 18, ma non hai più detto se ci sei "
                 "andato.",
     "must_not": ["Sì, ci sei andato", "Il controllo è stato annullato"]},
    {"id": "g13", "category": "plan", "asked_at": at("10:20"), "ev": ["s28", "s29", "s31"],
     "q": "Quando siamo andati io e Martina a Monte Isola?",
     "expected": "Domenica 22 maggio. Era prevista per domenica 15 maggio ma è stata rimandata per la pioggia.",
     "must_not": ["Siete andati il 15 maggio"]},
    {"id": "g14", "category": "plan", "asked_at": at("21:00"), "ev": ["s14", "s23", "s31"],
     "q": "Quali impegni ho ancora in sospeso per le prossime settimane?",
     "expected": "Il rogito della casa di via Pignolo venerdì 24 giugno, il trasloco sabato 2 luglio e la seconda "
                 "rata da 750 euro da restituire a Federico a giugno. (Dettagli secondari, non richiesti: a settembre "
                 "decidi se continuare con la pallavolo; dell'esito del controllo dal dentista del 12 maggio non si "
                 "sa nulla.)",
     "must_not": ["Il rogito è già stato fatto", "Avete già traslocato"]},
    # ── state-change (now) ─────────────────────────────────────────────────────
    {"id": "g15", "category": "state-change", "asked_at": at("11:00"), "ev": ["s10", "s14", "s15"],
     "q": "Che macchina ho adesso?",
     "expected": "Una Toyota Yaris ibrida blu del 2029, usata, ritirata venerdì 25 marzo. (Dettagli secondari, non "
                 "richiesti: la Fiat Punto grigia del 2014 è stata rottamata dopo l'incidente del 2 marzo.)",
     "must_not": ["Hai ancora la Fiat Punto", "La Yaris è grigia"]},
    {"id": "g16", "category": "state-change", "asked_at": at("11:05"), "ev": ["s18", "s25"],
     "q": "Dove lavoro adesso?",
     "expected": "Sei farmacista ospedaliero all'ospedale Papa Giovanni XXIII di Bergamo dal 2 maggio 2033. "
                 "(Dettagli secondari, non richiesti: settore allestimento terapie oncologiche; prima eri alla "
                 "Farmacia Santa Grata fino al 30 aprile.)",
     "must_not": ["Lavori alla Farmacia Santa Grata", "Lavori a Milano"]},
    {"id": "g17", "category": "state-change", "asked_at": at("11:10"), "ev": ["s01", "s18", "s24"],
     "q": "Dove lavoravo il 12 aprile 2033?",
     "expected": "Ancora alla Farmacia Santa Grata di Bergamo: avevi già dato le dimissioni (4 aprile), ma l'ultimo "
                 "giorno è stato il 30 aprile; al Papa Giovanni hai iniziato il 2 maggio.",
     "must_not": ["Lavoravi già al Papa Giovanni"]},
    {"id": "g18", "category": "state-change", "asked_at": at("11:15"), "ev": ["s01", "s16", "s23", "s31"],
     "q": "Dove abito adesso?",
     "expected": "Ancora in affitto in via Borgo Palazzo a Bergamo, con Martina. (Dettagli secondari, non richiesti: "
                 "il trilocale in via Pignolo è comprato con compromesso; rogito il 24 giugno e trasloco il 2 luglio.)",
     "must_not": ["Abiti già in via Pignolo"]},
    {"id": "g19", "category": "state-change", "asked_at": at("11:20"), "ev": ["s01", "s10"],
     "q": "Quando è il compleanno di mia mamma?",
     "expected": "Il 16 aprile. (Dettagli secondari, non richiesti: all'inizio avevi detto 14 aprile, poi ti sei "
                 "corretto: il 14 è il compleanno della zia Lucia.)",
     "must_not": ["Il compleanno di tua mamma è il 14 aprile"]},
    # ── aggregation ────────────────────────────────────────────────────────────
    {"id": "g20", "category": "aggregation", "asked_at": at("12:00"), "ev": ["s03", "s06", "s13", "s20", "s26"],
     "q": "Di quante partite degli Smash Seriate da febbraio a maggio sai il risultato, e quante ne abbiamo vinte?",
     "expected": "Cinque partite con risultato noto, tre vinte e due perse. (Dettagli secondari, non richiesti: 12 febbraio 3-1 col "
                 "Volley Dalmine, vinta; 19 febbraio 1-3 a Treviglio, persa; 19 marzo 3-0 allo Stezzano, vinta; "
                 "9 aprile 3-2 all'Osio, vinta; 7 maggio semifinale playoff 0-3 col Treviglio, persa.)",
     "must_not": []},
    {"id": "g21", "category": "aggregation", "asked_at": at("12:05"), "ev": ["s05", "s30"],
     "q": "Quante volte ho donato il sangue quest'anno, e quando?",
     "expected": "Due volte: mercoledì 16 febbraio e venerdì 20 maggio 2033, all'AVIS.",
     "must_not": []},
    {"id": "g22", "category": "aggregation", "asked_at": at("12:10"), "ev": ["s03", "s07", "s22", "s31"],
     "q": "Quali viaggi o gite di piacere ho fatto tra febbraio e maggio?",
     "expected": "Tre: Verona con Martina (26-27 febbraio, per il suo compleanno), Valencia con gli amici dell'Erasmus "
                 "(14-17 aprile) e Monte Isola sul lago d'Iseo con Martina (22 maggio). (Dettagli secondari, non "
                 "richiesti: il concerto a Milano del 12 marzo è stato annullato; il pranzo di famiglia a Clusone e "
                 "il corso a Milano non sono gite.)",
     "must_not": ["Sei andato al concerto a Milano"]},
    {"id": "g23", "category": "aggregation", "asked_at": at("12:15"), "ev": ["s12", "s16", "s23"],
     "q": "Riassumimi le tappe dell'acquisto della casa di via Pignolo, con le date.",
     "expected": "Proposta accettata (me l'hai detto il 16 marzo), compromesso firmato lunedì 28 marzo, rogito "
                 "previsto il 28 aprile e slittato a venerdì 24 giugno per il ritardo del mutuo, trasloco previsto "
                 "nel weekend del 30 aprile e spostato a sabato 2 luglio. Rogito e trasloco non sono ancora avvenuti.",
     "must_not": ["Il rogito è stato fatto il 28 aprile"]},
    {"id": "g24", "category": "aggregation", "asked_at": at("12:20"), "ev": ["s07", "s22"],
     "q": "Which of my Erasmus friends did I see in Valencia, and where is each of them from?",
     "expected": "All three: Claire (Dublin), Pieter (Rotterdam) and Joanna (Kraków).",
     "must_not": []},
    # ── provenance ─────────────────────────────────────────────────────────────
    {"id": "g25", "category": "provenance", "asked_at": at("14:00"), "ev": ["s02", "s27"],
     "q": "Io e Martina ci sposiamo in autunno?",
     "expected": "No. Lo ha chiesto tuo papà Ezio nel gruppo di famiglia il 10 febbraio, riferendo una voce della zia "
                 "Lucia; l'11 maggio hai smentito: nessun matrimonio in programma.",
     "must_not": ["Sì, vi sposate in autunno"]},
    {"id": "g26", "category": "provenance", "asked_at": at("14:05"), "ev": ["s04", "s20", "s29"],
     "q": "Sarò il capitano degli Smash Seriate la prossima stagione?",
     "expected": "Non è confermato: lo ha detto Tiziano nel gruppo della squadra (14 febbraio e 9 aprile, «l'ha "
                 "deciso il mister»), ma tu hai risposto che non sai ancora se l'anno prossimo giocherai; deciderai "
                 "a settembre.",
     "must_not": ["Sì, sarai il capitano"]},
    {"id": "g27", "category": "provenance", "asked_at": at("14:10"), "ev": ["s27"],
     "q": "Io e Martina vogliamo prendere un cane?",
     "expected": "Non da quello che mi hai detto tu: l'ha scritto tua mamma Rosanna nel gruppo di famiglia l'11 maggio, "
                 "dicendo di averlo saputo da Federico; tu non l'hai confermato.",
     "must_not": ["Sì, volete prendere un cane"]},
    {"id": "g28", "category": "provenance", "asked_at": at("14:15"), "ev": ["s09", "s19"],
     "q": "Chi ha detto che andavo a lavorare a Milano, e cosa ho risposto?",
     "expected": "Samuele Rota, nel gruppo della farmacia (7 marzo e 6 aprile). Hai smentito entrambe le volte: resti a "
                 "Bergamo, il Papa Giovanni XXIII è a Bergamo.",
     "must_not": ["Lavori a Milano"]},
    {"id": "g29", "category": "provenance", "asked_at": at("14:20"), "ev": ["s09", "s12"],
     "q": "Ho fatto il corso per le vaccinazioni in farmacia?",
     "expected": "Sì, martedì 15 marzo a Milano (otto ore): sei abilitato. (Dettagli secondari, non richiesti: "
                 "l'aveva annunciato Paola nel gruppo della farmacia e tu l'avevi confermato.)",
     "must_not": []},
    # ── assistant-addressed ────────────────────────────────────────────────────
    {"id": "g30", "category": "assistant-addressed", "asked_at": at("15:00"), "ev": ["s02", "s14"],
     "q": "Cosa aveva chiesto mia mamma all'assistente di ricordarmi, e poi com'è andata?",
     "expected": "Il pranzo per i 70 anni del papà, domenica 20 marzo alle 12:30 all'agriturismo Il Castagneto a "
                 "Clusone. Si è fatto: c'erano tutti, anche Federico e Anna. (Dettagli secondari, non richiesti: il "
                 "papà si è commosso per il video montato da Martina.)",
     "must_not": []},
    {"id": "g31", "category": "assistant-addressed", "asked_at": at("15:05"), "ev": ["s04"],
     "q": "Devo una birra a Omar?",
     "expected": "No. Omar ha chiesto all'assistente di segnarlo (14 febbraio), ma tu hai risposto che gliel'avevi già "
                 "pagata il venerdì prima al pub, e Tiziano l'ha confermato.",
     "must_not": ["Sì, devi una birra a Omar"]},
    {"id": "g32", "category": "assistant-addressed", "asked_at": at("15:10"), "ev": ["s19"],
     "q": "Ho promesso a Samuele la mia bici da corsa?",
     "expected": "No. Samuele ha chiesto all'assistente di segnarlo il 6 aprile, ma tu hai risposto di non averlo mai "
                 "detto: la bici resta tua.",
     "must_not": ["Sì, hai promesso la bici a Samuele"]},
    {"id": "g33", "category": "assistant-addressed", "asked_at": at("15:15"), "ev": ["s17", "s21"],
     "q": "What did Joanna ask the assistant to remember for Valencia, and what did I actually agree to?",
     "expected": "That you'd bring a bottle of Valcalepio and the casoncelli recipe. You agreed, but to bring two "
                 "bottles instead of one; the recipe is your mum's, and you said you'd ask her for it.",
     "must_not": []},
    # ── recall echoes ──────────────────────────────────────────────────────────
    {"id": "g34", "category": "recall-echo", "asked_at": at("16:00"), "ev": ["s15"],
     "q": "Di che colore è la mia Yaris?",
     "expected": "Blu.",
     "must_not": ["La Yaris è grigia"]},
    {"id": "g35", "category": "recall-echo", "asked_at": at("16:05"), "ev": ["s03", "s18"],
     "q": "In che città ho corso la mezza maratona?",
     "expected": "A Bergamo (la Mezza di Bergamo, domenica 3 aprile).",
     "must_not": ["Brescia"]},
    {"id": "g36", "category": "recall-echo", "asked_at": at("16:10"), "ev": ["s01", "s23"],
     "q": "In che città abita mio fratello Federico?",
     "expected": "A Milano, con la moglie Anna.",
     "must_not": ["Monza"]},
    {"id": "g37", "category": "recall-echo", "asked_at": at("16:15"), "ev": ["s26"],
     "q": "Contro chi abbiamo perso la semifinale dei playoff?",
     "expected": "Contro il Treviglio, 0-3, sabato 7 maggio.",
     "must_not": ["Dalmine"]},
    # ── premise traps ──────────────────────────────────────────────────────────
    {"id": "g38", "category": "premise-trap", "asked_at": at("17:00"), "ev": ["s08", "s11"],
     "q": "Com'è stato il concerto dei Lampioni Gialli all'Alcatraz?",
     "expected": "Non c'è stato: la band ha annullato la data di sabato 12 marzo poche ore prima (laringite del "
                 "cantante); i due biglietti da 38 euro vengono rimborsati.",
     "must_not": ["Il concerto è stato bello", "Siete andati al concerto"]},
    {"id": "g39", "category": "premise-trap", "asked_at": at("17:05"), "ev": ["s16", "s23"],
     "q": "In che giorno abbiamo fatto il rogito di via Pignolo?",
     "expected": "Non l'avete ancora fatto: era previsto il 28 aprile, ma è slittato a venerdì 24 giugno per il "
                 "ritardo del mutuo.",
     "must_not": ["Il rogito è stato fatto il 28 aprile"]},
    {"id": "g40", "category": "premise-trap", "asked_at": at("17:10"), "ev": ["s17", "s22"],
     "q": "What was the name of the hotel we stayed at in Valencia?",
     "expected": "There was no hotel: you all stayed in a flat in Ruzafa that Claire booked.",
     "must_not": []},
    {"id": "g41", "category": "premise-trap", "asked_at": at("17:15"), "ev": ["s15", "s27"],
     "q": "A chi ho venduto la Punto?",
     "expected": "A nessuno: la Punto è stata rottamata (portata dal demolitore il 25 marzo). La voce della zia Lucia, "
                 "riferita da tua mamma, che l'avessi venduta a un ragazzo di Clusone l'hai smentita l'11 maggio.",
     "must_not": ["L'hai venduta a un ragazzo di Clusone"]},
    {"id": "g42", "category": "premise-trap", "asked_at": at("17:20"), "ev": ["s02", "s27"],
     "q": "Quando è nata Bianca, la figlia di Federico?",
     "expected": "Non è ancora nata: il termine è a fine agosto (all'ecografia dell'11 maggio si è saputo che è una "
                 "bambina, che si chiamerà Bianca).",
     "must_not": ["Bianca è nata"]},
    # ── negatives ──────────────────────────────────────────────────────────────
    {"id": "g43", "category": "negative", "asked_at": at("18:00"), "ev": ["s12", "s16"],
     "q": "Quanto abbiamo pagato il trilocale di via Pignolo?",
     "expected": "Non lo so: il prezzo della casa non me l'hai mai detto.",
     "must_not": []},
    {"id": "g44", "category": "negative", "asked_at": at("18:05"), "ev": ["s05", "s24"],
     "q": "Come si chiama il mio dentista?",
     "expected": "Non lo so: il nome del dentista non me l'hai mai detto.",
     "must_not": []},
    {"id": "g45", "category": "negative", "asked_at": at("18:10"), "ev": ["s18", "s25"],
     "q": "Quanto guadagno al Papa Giovanni?",
     "expected": "Non lo so: lo stipendio del nuovo lavoro non me l'hai mai detto.",
     "must_not": []},
    {"id": "g46", "category": "negative", "asked_at": at("18:15"), "ev": ["s07"],
     "q": "What was the name of the B&B in Verona?",
     "expected": "I don't know: you only said it was a small B&B near Piazza delle Erbe, without its name.",
     "must_not": []},
]
