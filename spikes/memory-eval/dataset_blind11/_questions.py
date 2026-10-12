# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Questions of blind set #11 (entity memory, Ciclofficina Raggio). Fields used by build.py / check.py only: `ev`
(evidence sessions / sources; every question is asked after all of them) and `lang` (language of the question).
Questions carry no `asker`: they come from someone unidentified at the counter."""

OCT20 = "2032-10-20T12:00:00+02:00"  # before Ettore moves the group ride (s17, 18:10)
OCT30 = "2032-10-30T11:00:00+02:00"  # Saturday, summer hours still valid
END = "2032-11-08T18:00:00+01:00"

QUESTIONS = [
    # ── own content and its changes ────────────────────────────────────────────────────────────────
    {"id": "q01", "category": "own-content", "lang": "it", "asked_at": END, "ev": ["s01", "s17"],
     "q": "Quanto costa oggi un tagliando base?",
     "expected": "50 €: è il prezzo dal 1° novembre 2032 (aggiornamento del listino dato da Ettore il 20 ottobre); "
                 "prima costava 45 €.",
     "must_not": ["Il tagliando base oggi costa 45 €"]},
    {"id": "q02", "category": "own-content", "lang": "it", "asked_at": END, "ev": ["s01", "s21"],
     "q": "Che orari fa la ciclofficina adesso? E il sabato fino a che ora è aperta?",
     "expected": "Orari invernali dal 2 novembre 2032: lunedì 15:00–18:30 (mattina chiuso); da martedì a venerdì "
                 "9:00–12:30 e 15:00–18:30; sabato 9:00–12:30 e 15:00–18:00; domenica chiuso. Il sabato chiude "
                 "alle 18:00.",
     "must_not": ["Oggi chiude alle 19:00", "Il sabato chiude alle 18:30", "Il sabato chiude alle 19:00"]},
    {"id": "q03", "category": "own-content", "lang": "it", "asked_at": END, "ev": ["s01"],
     "q": "Fate un prezzo per tenere la bici in deposito durante l'inverno?",
     "expected": "Non è mai stato dato un prezzo per il deposito invernale. Il listino prevede solo che le bici non "
                 "ritirate entro 10 giorni dall'avviso di fine lavoro paghino 2 € al giorno.",
     "must_not": ["C'è una tariffa di deposito invernale"]},

    # ── state as of a date vs now ──────────────────────────────────────────────────────────────────
    {"id": "q04", "category": "state-as-of", "lang": "de", "asked_at": OCT30, "ev": ["s01", "s21"],
     "q": "Bis wann ist die Werkstatt heute geöffnet?",
     "expected": "Fino alle 19:00: oggi, sabato 30 ottobre 2032, valgono ancora gli orari normali (sabato 9:00–12:30 "
                 "e 15:00–19:00, quindi pausa tra le 12:30 e le 15:00). Gli orari invernali, con chiusura del sabato "
                 "alle 18:00, partono dal 2 novembre.",
     "must_not": ["Oggi chiude alle 18:00", "Oggi chiude alle 18:30"]},
    {"id": "q05", "category": "state-as-of", "lang": "it", "asked_at": END, "ev": ["s01", "s17"],
     "q": "Quanto costava la sostituzione di una camera d'aria a metà ottobre, e quanto costa adesso?",
     "expected": "A metà ottobre 12 € (camera compresa); dal 1° novembre 2032 costa 14 €.",
     "must_not": ["A metà ottobre costava 14 €", "Adesso costa 12 €"]},
    {"id": "q06", "category": "state-as-of", "lang": "it", "asked_at": OCT20, "ev": ["s06"],
     "q": "Quando si fa il giro sociale della bottega?",
     "expected": "Domenica 24 ottobre 2032, partenza alle 8:30 dalla ciclofficina, fino al lago di Caldonazzo e "
                 "ritorno (circa 50 km).",
     "must_not": ["Il giro è domenica 7 novembre"]},

    # ── plans: moved, cancelled, done, ahead ───────────────────────────────────────────────────────
    {"id": "q07", "category": "plan", "lang": "it", "asked_at": END, "ev": ["s06", "s17", "s28"],
     "q": "Il giro sociale si è fatto? Quando e com'è andato?",
     "expected": "Sì, ma non il 24 ottobre: il 20 ottobre Ettore l'ha spostato per la pioggia prevista a domenica 7 "
                 "novembre 2032, e si è fatto quel giorno: nove partecipanti, rientro verso le 14:00; Marco "
                 "Dallapiccola ha forato a Pergine e Giada gli ha riparato la foratura.",
     "must_not": ["Il giro si è fatto il 24 ottobre", "Il giro è stato annullato", "Ha forato Marco Tomasi"]},
    {"id": "q08", "category": "plan", "lang": "it", "asked_at": END, "ev": ["s18", "s19", "s22"],
     "q": "Il corso sulle forature per i bambini si è fatto?",
     "expected": "No. Giada l'aveva organizzato per mercoledì 27 ottobre 2032 alle 17:00 (gratuito, massimo 8 "
                 "bambini); il 26 ottobre lo ha annullato lei perché c'erano solo 2 iscritti (Leo e Mia). Forse si "
                 "rifà in primavera.",
     "must_not": ["Il corso si è fatto il 27 ottobre", "L'ha annullato Ettore"]},
    {"id": "q09", "category": "plan", "lang": "en", "asked_at": END, "ev": ["s28"],
     "q": "Is the shop open on Monday 15 November?",
     "expected": "No: the shop is closed for inventory on Monday 15 and Tuesday 16 November 2032 (Ettore said so on "
                 "7 November).",
     "must_not": ["The shop is open on Monday 15 November"]},
    {"id": "q10", "category": "plan", "lang": "it", "asked_at": END, "ev": ["s21", "s28"],
     "q": "Quando arriva la cargo elettrica di Marco Dallapiccola, e quanto la paga?",
     "expected": "Mercoledì 10 novembre 2032 (Ettore l'ha detto il 25 ottobre e confermato il 7 novembre). Costa "
                 "3.900 €; Ettore gli fa la fattura intestata per il bonus «Cargo in città», che vale al massimo "
                 "300 €.",
     "must_not": ["La cargo elettrica l'ha ordinata Marco Tomasi", "È già stata consegnata"]},

    # ── the agent's own actions ────────────────────────────────────────────────────────────────────
    {"id": "q11", "category": "own-action", "lang": "it", "asked_at": END, "ev": ["s07", "s15", "s21", "s26", "s28"],
     "q": "Quali appuntamenti in officina ci sono in agenda da oggi in poi?",
     "expected": "Uno solo: il tagliando base sulla mountain bike di Marco Tomasi, sabato 13 novembre 2032 alle 10:00 "
                 "(50 €). (Inoltre: la cargo elettrica di Marco Dallapiccola arriva mercoledì 10 novembre e la "
                 "bottega è chiusa per inventario lunedì 15 e martedì 16 novembre.)",
     "must_not": ["Marco Dallapiccola ha un appuntamento per i freni", "Rhys ha un appuntamento"]},
    {"id": "q12", "category": "own-action", "lang": "it", "asked_at": END, "ev": ["s06", "s09", "s11"],
     "q": "C'è ancora il promemoria per ordinare le pastiglie dei freni a disco?",
     "expected": "No. Ettore l'aveva chiesto l'8 ottobre per martedì 12 ottobre; il 12 ottobre Giada l'ha fatto "
                 "cancellare perché le pastiglie le aveva già ordinate lei lunedì 11 ottobre da Ricambi Adige. L'ho "
                 "riferito a Ettore il 13 ottobre.",
     "must_not": ["Il promemoria è ancora attivo", "Le pastiglie le ha ordinate Ettore"]},
    {"id": "q13", "category": "own-action", "lang": "it", "asked_at": END, "ev": ["s07", "s15"],
     "q": "Lo spurgo del freno della cargo di Marco Dallapiccola l'abbiamo fatto noi?",
     "expected": "No. Era prenotato (il 9 ottobre) per martedì 19 ottobre 2032 alle 15:00; il 18 ottobre Marco "
                 "Dallapiccola l'ha fatto cancellare perché glielo aveva spurgato un amico meccanico.",
     "must_not": ["Lo spurgo è stato fatto il 19 ottobre in officina"]},
    {"id": "q14", "category": "own-action", "lang": "en", "asked_at": END, "ev": ["s05", "s12", "s14"],
     "q": "When did Rhys get his full service done, and how did he pay?",
     "expected": "It was booked for Thursday 14 October 2032 at 10:00; Rhys moved it (he had a seminar) to Saturday "
                 "16 October at 9:30, and it was done on 16 October: 80 €, paid by card. Ettore advised him to "
                 "change the chain in spring.",
     "must_not": ["The service was done on 14 October", "He paid in cash"]},
    {"id": "q15", "category": "own-action", "lang": "it", "asked_at": END, "ev": ["s10", "s11"],
     "q": "Che messaggio aveva lasciato Bruna Ioriatti per Ettore, e gliel'hai riferito?",
     "expected": "Il 12 ottobre Bruna ha chiesto di dire a Ettore che giovedì 14 ottobre nel pomeriggio avrebbe "
                 "lasciato l'e-bike (il display dava l'errore E07); le avevo prenotato la diagnosi alle 15:30. Ho "
                 "riferito il messaggio a Ettore mercoledì 13 ottobre.",
     "must_not": ["Il messaggio non è stato riferito"]},
    {"id": "q16", "category": "own-action", "lang": "it", "asked_at": END, "ev": ["s16", "s18", "s22"],
     "q": "Chi aveva riservato un cestino a Katharina, e l'ha poi ritirato?",
     "expected": "Giada. Il 19 ottobre Katharina mi ha lasciato un messaggio per Giada (venerdì sarebbe passata a "
                 "prendere il cestino riservato), che ho riferito a Giada il 21 ottobre; Katharina l'ha ritirato "
                 "venerdì 22 ottobre (lo ha detto Giada il 26 ottobre).",
     "must_not": ["Il cestino l'aveva riservato Ettore"]},

    # ── attribution across people ──────────────────────────────────────────────────────────────────
    {"id": "q17", "category": "attribution", "lang": "it", "asked_at": END, "ev": ["s10", "s14", "s18"],
     "q": "Chi ha riparato l'e-bike di Bruna, che problema aveva e quanto ha pagato?",
     "expected": "Giada: il magnete del sensore di velocità del motore Volta M3 era spostato (errore E07); l'ha "
                 "riallineato lunedì 18 ottobre 2032. Bruna ha pagato i 60 € della diagnosi e l'ha già ripresa.",
     "must_not": ["L'ha riparata Ettore", "Era la batteria"]},
    {"id": "q18", "category": "attribution", "lang": "it", "asked_at": END, "ev": ["s05", "s23"],
     "q": "Quanto costano da voi le gomme invernali?",
     "expected": "Non sono nel listino della bottega. L'unica cifra è quella riferita da Rhys il 28 ottobre: Ettore "
                 "gli aveva fatto un preventivo di 70 € per un paio, montate. Ettore non l'ha mai detto direttamente.",
     "must_not": ["Le gomme invernali costano 70 € da listino"]},
    {"id": "q19", "category": "attribution", "lang": "it", "asked_at": END,
     "ev": ["s07", "s09", "s12", "s23", "s24", "s27"],
     "q": "Chi si era iscritto al giro sociale, e chi si è cancellato?",
     "expected": "Per il giro del 7 novembre erano iscritti tramite me Marco Dallapiccola, Giada, Katharina Moser e "
                 "Bruna Ioriatti (aggiunta da Giada il 6 novembre), più Ettore che guidava il giro. Rhys Morgan si era "
                 "iscritto il 14 ottobre ma si è cancellato il 28 ottobre (il 7 era a Cardiff).",
     "must_not": ["Marco Tomasi si era iscritto", "Rhys ha partecipato al giro"]},

    # ── knowledge from sources and who gave it ─────────────────────────────────────────────────────
    {"id": "q20", "category": "source", "lang": "it", "asked_at": END, "ev": ["s02", "k-volta-m3", "s06", "k-bonus-cargo"],
     "q": "Chi ha dato alla bottega il manuale del motore Volta M3, e chi la pagina del bonus per le cargo?",
     "expected": "Il manuale del Volta M3 l'ha dato Giada il 5 ottobre 2032; la pagina del bonus «Cargo in città» "
                 "l'ha data Ettore l'8 ottobre 2032.",
     "must_not": ["Il manuale l'ha dato Ettore", "La pagina del bonus l'ha data Giada"]},
    {"id": "q21", "category": "source", "lang": "it", "asked_at": END, "ev": ["k-volta-m3"],
     "q": "Cosa significa il codice E07 sul motore Volta M3, e cosa bisogna controllare?",
     "expected": "Manca il segnale del sensore di velocità: controllare che il magnete sul raggio sia allineato al "
                 "sensore sul fodero e a non più di 15 mm; finché il segnale non torna l'assistenza si interrompe. "
                 "Risolta la causa, il codice si cancella tenendo premuti + e − per 5 secondi.",
     "must_not": ["E07 indica la batteria scarica", "E07 è il sensore di coppia"]},
    {"id": "q22", "category": "source", "lang": "en", "asked_at": END, "ev": ["k-bonus-cargo"],
     "q": "What is the most the cargo bike bonus pays, and can I get it for a used cargo bike?",
     "expected": "30 % of the purchase price, up to 300 €. Only new cargo bikes (pedal or e-assist) bought between 1 "
                 "September and 30 November 2032 from a shop based in Trentino qualify, for residents of Trento, one "
                 "per household, applying online by 15 December 2032 with an invoice in the applicant's name. Used "
                 "cargo bikes are not eligible.",
     "must_not": ["Used cargo bikes are eligible", "The maximum is 1,170 €"]},
    {"id": "q23", "category": "source", "lang": "it", "asked_at": OCT20, "ev": ["s11", "k-ricambi-adige"],
     "q": "In quanti giorni consegna Ricambi Adige, e sopra che cifra la spedizione è gratis?",
     "expected": "Secondo il listino d'autunno 2032 di Ricambi Adige (dato da Ettore il 13 ottobre): gli ordini sul "
                 "portale entro le 12:00 arrivano in 2 giorni lavorativi; la spedizione è gratuita sopra i 150 € "
                 "d'ordine (altrimenti 9 €).",
     "must_not": ["Consegna in 3 giorni"]},
    {"id": "q24", "category": "source", "lang": "it", "asked_at": END,
     "ev": ["k-ricambi-adige", "s21", "forget-k-ricambi-adige"],
     "q": "Qual è il codice cliente della bottega su Ricambi Adige?",
     "expected": "Non lo so più: era nel listino d'autunno di Ricambi Adige che Ettore mi aveva dato il 13 ottobre, "
                 "ma il 25 ottobre mi ha chiesto di dimenticarlo perché il fornitore aveva cambiato listino e "
                 "condizioni; il nuovo catalogo non mi è ancora arrivato.",
     "must_not": ["RA-2291"]},

    # ── unidentified speakers, carry-over traps, hand-overs ────────────────────────────────────────
    {"id": "q25", "category": "unidentified", "lang": "it", "asked_at": END, "ev": ["s08", "s13"],
     "q": "Chi ha lasciato la city bike rossa col cestino il 9 ottobre?",
     "expected": "Non si sa: chi l'ha lasciata (foratura alla ruota posteriore, ritiro previsto venerdì 15 ottobre) "
                 "non ha detto il nome né lasciato un numero. Il 15 ottobre l'ha ritirata una signora, anche lei "
                 "senza nome, che ha detto che la bici era sua.",
     "must_not": ["L'ha lasciata Bruna", "L'ha lasciata Katharina", "L'ha lasciata Giada"]},
    {"id": "q26", "category": "unidentified", "lang": "it", "asked_at": END, "ev": ["s19", "s22"],
     "q": "Come si chiama il genitore che ha iscritto Leo e Mia al corso per bambini?",
     "expected": "Non si sa: il 21 ottobre un genitore ha iscritto i figli Leo (8 anni) e Mia (10 anni) senza dire "
                 "il proprio nome né lasciare un numero. Il corso è stato poi annullato da Giada.",
     "must_not": ["È Marco Dallapiccola", "È Marco Tomasi"]},
    {"id": "q27", "category": "carry-over", "lang": "it", "asked_at": END, "ev": ["s03", "s04"],
     "q": "Marco Tomasi ha segnalato che il cambio della sua bici salta?",
     "expected": "No, non risulta. Il 5 ottobre, pochi minuti dopo la conversazione di Marco Tomasi, qualcuno in una "
                 "conversazione separata ha segnalato il cambio che salta sul pignone più grande, ma non ha detto il "
                 "nome: non si può attribuire a Marco Tomasi.",
     "must_not": ["Sì, Marco Tomasi ha segnalato che il cambio salta"]},
    {"id": "q28", "category": "carry-over", "lang": "it", "asked_at": END, "ev": ["s07", "s08", "s13"],
     "q": "La city bike rossa col cestino è di Marco Dallapiccola?",
     "expected": "Non risulta: il 9 ottobre, poco dopo la conversazione di Marco Dallapiccola, una persona che non ha "
                 "detto il nome ha lasciato la city bike rossa; il 15 ottobre l'ha ritirata una signora senza nome "
                 "che ha detto che era sua. Nulla la collega a Marco Dallapiccola (che ha una cargo bike verde).",
     "must_not": ["La city bike rossa è di Marco Dallapiccola"]},
    {"id": "q29", "category": "hand-over", "lang": "it", "asked_at": END, "ev": ["s13"],
     "q": "Chi ha pagato la riparazione della city bike rossa, quanto e come?",
     "expected": "La signora a cui Giada ha passato il tablet il 15 ottobre 2032, che ha detto che la bici era sua: "
                 "12 € in contanti (camera d'aria posteriore). Il suo nome non è mai stato detto.",
     "must_not": ["L'ha pagata Giada", "L'ha pagata Bruna"]},
    {"id": "q30", "category": "hand-over", "lang": "it", "asked_at": END, "ev": ["s25"],
     "q": "Chi ha chiesto se il bonus vale per una cargo usata?",
     "expected": "Un signore a cui Ettore ha passato il tablet il 2 novembre 2032, che non ha detto il nome. Gli ho "
                 "risposto di no (il bonus vale solo per cargo nuove) e ha detto che lasciava perdere.",
     "must_not": ["L'ha chiesto Ettore", "L'ha chiesto Marco Dallapiccola"]},
    {"id": "q31", "category": "hand-over", "lang": "it", "asked_at": END, "ev": ["s13"],
     "q": "Per chi era la regolazione freni prenotata per martedì 26 ottobre?",
     "expected": "Per la bici del figlio della signora della city bike rossa: l'ha prenotata lei il 15 ottobre (Giada "
                 "le aveva passato il tablet), martedì 26 ottobre 2032 alle 10:00, regolazione freni 15 €. Il nome non "
                 "è mai stato detto: l'appuntamento è segnato come «la signora della bici rossa».",
     "must_not": ["Era per Giada", "Era per Marco Dallapiccola"]},

    # ── two people with the same first name ────────────────────────────────────────────────────────
    {"id": "q32", "category": "same-name", "lang": "it", "asked_at": END, "ev": ["s20", "s21"],
     "q": "Di chi è il casco blu dimenticato in bottega?",
     "expected": "Di un cliente che il 23 ottobre si è presentato solo come «Marco», senza cognome: non si sa se sia "
                 "Marco Tomasi o Marco Dallapiccola. Il casco è blu con una striscia gialla; Ettore ha detto che è "
                 "nel retro e glielo danno quando ripassa.",
     "must_not": ["Il casco è di Marco Tomasi", "Il casco è di Marco Dallapiccola"]},
    {"id": "q33", "category": "same-name", "lang": "it", "asked_at": END, "ev": ["s03", "s07", "s26"],
     "q": "Quale dei due Marco ha la cargo bike, e quale la bici da corsa?",
     "expected": "La cargo bike (verde, con cui porta a scuola i figli Greta e Pietro) è di Marco Dallapiccola, che "
                 "ha anche ordinato una cargo elettrica per la moglie; la bici da corsa grigia è di Marco Tomasi, che "
                 "ha anche una mountain bike.",
     "must_not": ["La cargo bike è di Marco Tomasi", "La bici da corsa è di Marco Dallapiccola"]},

    # ── corrections ────────────────────────────────────────────────────────────────────────────────
    {"id": "q34", "category": "correction", "lang": "it", "asked_at": END, "ev": ["s11", "s14", "s22"],
     "q": "Quanto ha pagato Marco Tomasi per il lavoro di ottobre sulla bici da corsa?",
     "expected": "79 €: tagliando base 45 € + cassetta 11-32 34 €. Ettore aveva detto cassetta 38 € (83 € in tutto), "
                 "ma il 26 ottobre Giada, che ha fatto lo scontrino, ha corretto: 34 €, totale 79 €. Ha ritirato la "
                 "bici giovedì 14 ottobre.",
     "must_not": ["Ha pagato 83 €", "La cassetta costava 38 €"]},
    {"id": "q35", "category": "correction", "lang": "it", "asked_at": END, "ev": ["s16", "s18", "s22"],
     "q": "A che ora era l'appuntamento di Katharina venerdì 22 ottobre, e per che lavoro?",
     "expected": "Alle 17:00, regolazione del cambio sulla sua bici da trekking. Katharina aveva detto prima le 16 "
                 "(e prima ancora i freni) e si è corretta subito; il 21 ottobre avevo detto per errore le 16:00 a "
                 "Giada e mi sono corretto. Il lavoro è stato fatto quel venerdì alle 17.",
     "must_not": ["L'appuntamento era alle 16:00", "Era per i freni"]},

    # ── premise traps ──────────────────────────────────────────────────────────────────────────────
    {"id": "q36", "category": "premise-trap", "lang": "it", "asked_at": END, "ev": ["s05", "s07", "s14"],
     "q": "Quando ha ritirato Rhys la sua cargo bike?",
     "expected": "Rhys non ha una cargo bike: ha una gravel, che ha ripreso sabato 16 ottobre 2032 dopo il tagliando "
                 "completo. La cargo bike è di Marco Dallapiccola.",
     "must_not": ["Rhys ha ritirato la cargo bike"]},
    {"id": "q37", "category": "premise-trap", "lang": "it", "asked_at": END, "ev": ["s10", "s16"],
     "q": "Che codice d'errore dava l'e-bike di Katharina?",
     "expected": "Katharina non ha un'e-bike: ha una bici da trekking, a cui è stato regolato il cambio il 22 "
                 "ottobre. Il codice E07 era sull'e-bike (motore Volta M3) di Bruna Ioriatti.",
     "must_not": ["L'e-bike di Katharina dava E07"]},
    {"id": "q38", "category": "premise-trap", "lang": "en", "asked_at": END, "ev": ["s23"],
     "q": "Why did Marco Tomasi drop out of the group ride?",
     "expected": "He didn't: Marco Tomasi never signed up for the group ride. The one who dropped out was Rhys Morgan, "
                 "on 28 October, because on 7 November he would be in Cardiff visiting his parents.",
     "must_not": ["Marco Tomasi dropped out"]},

    # ── negative: never said ───────────────────────────────────────────────────────────────────────
    {"id": "q39", "category": "negative", "lang": "it", "asked_at": END, "ev": ["s04"],
     "q": "Che lavoro abbiamo fatto sul cambio che saltava, segnalato il 5 ottobre?",
     "expected": "Non risulta nessun lavoro: chi l'ha segnalato (senza dire il nome) ha detto che sarebbe passato in "
                 "settimana con la bici, ma non è mai stato registrato né il passaggio né una riparazione.",
     "must_not": ["Il cambio è stato regolato"]},
    {"id": "q40", "category": "negative", "lang": "it", "asked_at": END, "ev": ["s16", "s22"],
     "q": "Quanto ha pagato Katharina il cestino che ha ritirato?",
     "expected": "Non è mai stato detto: si sa solo che Giada glielo aveva riservato e che Katharina l'ha ritirato "
                 "venerdì 22 ottobre.",
     "must_not": []},
]
