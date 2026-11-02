# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""dev_procedures (WORK_PLAN 8.12d, D53): procedures — "when <situation>, I do it this way" — drawn by a nightly pass
from OUTCOMES: the agent's own replies and how the person reacted (a teaching or correction of how a task is done, an
explicit approval, a way that failed and a way that then worked), revised when the way changes — and the procedures it
must not draw (tastes, unconfirmed suggestions, one-off instructions, the person's habits, facts, failures never fixed,
superseded ways). Fictional content. Writes conversations.json and procedures_gold.json. Not blind: we may tune on it."""
from __future__ import annotations

import json
from datetime import date, datetime
from pathlib import Path

HERE = Path(__file__).parent
sessions: list[dict] = []
TZ = {"owen": "+01:00"}  # Leeds (BST); everyone else is on Central European Summer Time


def s(user: str, day: str, hour: str, *messages: tuple[str, str]) -> None:
    sid = f"{user}-{day}-{hour.replace(':', '')}"
    msgs = [{"role": m[0], "content": m[1]} for m in messages]
    sessions.append({"id": sid, "user": user, "ts": f"{day}T{hour}:00{TZ.get(user, '+02:00')}", "messages": msgs})


def u(t: str) -> tuple[str, str]:
    return ("user", t)


def a(t: str) -> tuple[str, str]:
    return ("assistant", t)


# ── chiara (it, Bologna, freelance translator): Lexis invoices taught (Sep 1); the weekly hours table approved (Sep 4);
# Fisiomed by e-mail failed, WhatsApp worked (Sep 7–9); the accountant's zip taught (Sep 28); she likes short messages
# (taste trap); "this time Marco in copy" (one-off trap); the session costs 45 euros (fact trap) ──
C = "chiara"
s(C, "2026-09-01", "09:00", u("Mi prepari la fattura per Lexis per la traduzione del manuale? 1.200 euro più IVA."),
  a("Ecco la bozza: fattura 14/2026, traduzione manuale tecnico, 1.200 euro + IVA 22 %. La mando al project manager di Lexis con l'importo nel corpo della mail?"),
  u("No, per Lexis si fa così: il loro numero d'ordine nell'oggetto della mail, la fattura solo come PDF allegato, e va all'amministrazione, non al project manager. Senza numero d'ordine non la pagano."),
  a("Capito: oggetto con il loro numero d'ordine, PDF allegato, indirizzata all'amministrazione. Il numero d'ordine è il 5531?"),
  u("Sì, 5531. Mandala."), a("Inviata all'amministrazione di Lexis, oggetto 'Fattura 14/2026 – PO 5531', PDF allegato."))
s(C, "2026-09-02", "18:30", u("Sei ore sul manuale tedesco oggi, ho gli occhi a pezzi."), a("Stasera niente schermi, allora."))
s(C, "2026-09-03", "10:00", u("Una cosa: a me i messaggi lunghi non piacciono, preferisco sempre due righe."), a("Va bene."))
s(C, "2026-09-04", "17:00", u("Fammi il riepilogo ore della settimana per Lexis: manuale 14 ore, glossario 3, revisione 5."),
  a("| Progetto | Ore |\n|---|---|\n| Manuale | 14 |\n| Glossario | 3 |\n| Revisione | 5 |\n| **Totale** | **22** |\n\nSettimana 31 agosto – 4 settembre."),
  u("Perfetto, fallo sempre così: tabella, totale in fondo e la settimana sotto."), a("Va bene, d'ora in poi così."))
s(C, "2026-09-07", "12:00", u("Ho di nuovo male alla spalla. Mi prenoti da Fisiomed per questa settimana?"),
  a("Ho scritto alla mail di Fisiomed chiedendo una seduta per giovedì o venerdì pomeriggio."), u("Ok, grazie."))
s(C, "2026-09-09", "19:00", u("Fisiomed ti ha risposto?"), a("No, nessuna risposta alla mail di lunedì."),
  u("Lo immaginavo. Scrivigli su WhatsApp alla reception: nome, cognome e due orari che mi vanno bene."),
  a("Scritto su WhatsApp alla reception: 'Buongiorno, sono Chiara Fabbri, vorrei una seduta per la spalla: giovedì 10 dopo le 17 o venerdì 11 mattina.'"))
s(C, "2026-09-09", "20:10", u("Hanno risposto subito: venerdì 11 alle 9. Visto? Per Fisiomed d'ora in poi WhatsApp, la mail non la legge nessuno."),
  a("Segnato: per prenotare da Fisiomed scrivo su WhatsApp alla reception, con nome, cognome e due orari."))
s(C, "2026-09-11", "11:00", u("Fatta la seduta, 45 euro. Mi hanno detto di farne altre due."), a("Bene. Quando vuoi le prenoto."))
s(C, "2026-09-11", "17:30", u("Riepilogo ore Lexis: manuale 12, revisione 6."),
  a("| Progetto | Ore |\n|---|---|\n| Manuale | 12 |\n| Revisione | 6 |\n| **Totale** | **18** |\n\nSettimana 7 – 11 settembre."), u("Grazie."))
s(C, "2026-09-13", "16:00", u("Giro sui colli con Paolo, siamo arrivati a San Luca a piedi."), a("Bella domenica!"))
s(C, "2026-09-16", "10:00", u("Fattura Lexis per il glossario, 300 euro più IVA, numero d'ordine 5590. Questa volta mettici in copia anche Marco, il loro project manager, che deve approvarla lui."),
  a("Inviata all'amministrazione di Lexis, oggetto 'Fattura 15/2026 – PO 5590', PDF allegato, Marco in copia."), u("Perfetto."))
s(C, "2026-09-18", "17:15", u("Riepilogo ore Lexis: manuale 10, glossario 4, revisione 4."),
  a("| Progetto | Ore |\n|---|---|\n| Manuale | 10 |\n| Glossario | 4 |\n| Revisione | 4 |\n| **Totale** | **18** |\n\nSettimana 14 – 18 settembre."), u("Ok."))
s(C, "2026-09-22", "09:30", u("Prenotami la seconda seduta da Fisiomed, va bene giovedì o venerdì mattina."),
  a("Scritto su WhatsApp alla reception: 'Buongiorno, sono Chiara Fabbri, vorrei la seconda seduta per la spalla: giovedì 24 o venerdì 25 mattina.'"),
  u("Già risposto: giovedì 24 alle 10. Grazie."))
s(C, "2026-09-25", "21:00", u("Cena da mia sorella, mi ha costretta a provare il suo tiramisù al pistacchio."), a("Com'era?"), u("Buonissimo, purtroppo."))
s(C, "2026-09-28", "11:00", u("Mi mandi al commercialista le fatture di settembre?"),
  a("Inviate al dottor Lenzi le tre fatture di settembre, tre PDF allegati alla mail."),
  u("Mi ha appena richiamata: le vuole in un unico file zip, ogni PDF chiamato numero_cliente, tipo '14_Lexis.pdf', ed entro il 5 del mese dopo. Rifalla così."),
  a("Rifatta: un solo zip 'Fatture_settembre_2026.zip' con 14_Lexis.pdf, 15_Lexis.pdf e 16_Studio Ferri.pdf, inviato al dottor Lenzi."),
  u("Ok, adesso va bene."))
s(C, "2026-09-29", "15:00", u("Fattura Lexis per la revisione, 450 euro più IVA, numero d'ordine 5612."),
  a("Pronta: oggetto 'Fattura 17/2026 – PO 5612', PDF allegato, all'amministrazione. Metto in copia Marco come l'altra volta?"),
  u("No, quella era solo per il glossario. Mandala normale."), a("Inviata all'amministrazione, senza copie."))

# ── davide (it, Torino, maître of a trattoria): the shift message per day, taught (Sep 3); the wine order to Enoteca
# Gallo approved (Sep 4); the kitchen printer: the driver failed, the FEED reset worked (Sep 12, again Sep 24); the
# confirmation for large tables taught (Sep 29); "send the shifts by e-mail too" (my suggestion, never confirmed); his
# Monday cellar inventory (habit trap); the dishwasher's E24 — the filter did not fix it (never fixed trap) ──
D = "davide"
s(D, "2026-09-01", "23:30", u("Serata pienissima, 80 coperti, sono distrutto."), a("Riposati, domani è martedì e si respira."))
s(D, "2026-09-03", "18:00", u("Scrivimi il messaggio dei turni per il gruppo dello staff, settimana dal 7: Luca lunedì, martedì e mercoledì, Sofia mercoledì, giovedì e venerdì, Ahmed venerdì, sabato e domenica, io sabato e domenica."),
  a("Turni settimana 7–13 settembre:\nLuca: lun, mar, mer\nSofia: mer, gio, ven\nAhmed: ven, sab, dom\nDavide: sab, dom"),
  u("No, così non lo legge nessuno. I turni si scrivono per giorno: una riga per ogni giorno, da lunedì a domenica, con chi lavora quel giorno."),
  a("Turni settimana 7–13 settembre:\nLun: Luca\nMar: Luca\nMer: Luca, Sofia\nGio: Sofia\nVen: Sofia, Ahmed\nSab: Ahmed, Davide\nDom: Ahmed, Davide"),
  u("Così sì. Mandalo nel gruppo."), a("Inviato nel gruppo dello staff."))
s(D, "2026-09-04", "11:00", u("Fai l'ordine dei vini all'Enoteca Gallo: 12 Barbera, 6 Dolcetto, 6 Arneis."),
  a("Ecco: 'Buongiorno, ordine Trattoria del Borgo (cliente 318):\n- BAR-21 Barbera d'Asti 2023 × 12\n- DOL-08 Dolcetto d'Alba 2024 × 6\n- ARN-03 Roero Arneis 2024 × 6\nConsegna martedì mattina entro le 11. Grazie.' Lo invio?"),
  u("Perfetto, è proprio come lo vuole Gallo: codici, quantità e consegna il martedì entro le 11. D'ora in poi fallo sempre così."),
  a("Inviato."))
s(D, "2026-09-06", "10:00", u("Domani come ogni lunedì alle 10 faccio l'inventario della cantina, poi pomeriggio libero."), a("Buon inventario!"))
s(D, "2026-09-08", "23:00", u("La lavastoviglie di casa dà errore E24, che faccio?"),
  a("E24 di solito è lo scarico: pulisci il filtro sul fondo e controlla che il tubo di scarico non sia piegato."), u("Provo domani."))
s(D, "2026-09-10", "18:00", u("Turni della settimana dal 14: Luca lunedì e martedì, Sofia da mercoledì a venerdì, Ahmed e io il weekend."),
  a("Turni settimana 14–20 settembre:\nLun: Luca\nMar: Luca\nMer: Sofia\nGio: Sofia\nVen: Sofia\nSab: Ahmed, Davide\nDom: Ahmed, Davide\n\nVuoi che lo mandi anche per email a tutti, così resta traccia?"),
  u("Mah, vediamo. Intanto mandalo nel gruppo."), a("Inviato nel gruppo."))
s(D, "2026-09-11", "09:30", u("Pulito il filtro e controllato il tubo: ancora E24."),
  a("Allora potrebbe essere la pompa di scarico: meglio chiamare un tecnico."), u("Uffa."))
s(D, "2026-09-12", "20:30", u("La stampante della cucina non riceve più le comande dal palmare! In pieno servizio!"),
  a("Prova a reinstallare il driver della stampante dal computer della cassa."),
  u("Fatto, niente, non stampa ancora."),
  a("Allora spegnila, aspetta 30 secondi e riaccendila tenendo premuto il tasto FEED finché non stampa la pagina di rete; poi sul palmare riseleziona la stampante."),
  u("Funziona! Ok, se ricapita si fa così, il driver lasciamolo stare."))
s(D, "2026-09-14", "17:00", u("Il tecnico della lavastoviglie viene il 2 ottobre, fino ad allora piatti a mano."), a("Segnato: tecnico della lavastoviglie il 2 ottobre."))
s(D, "2026-09-17", "18:00", u("Turni dal 21: Luca lunedì, martedì e mercoledì, Sofia giovedì e venerdì, Ahmed e io il weekend."),
  a("Turni settimana 21–27 settembre:\nLun: Luca\nMar: Luca\nMer: Luca\nGio: Sofia\nVen: Sofia\nSab: Ahmed, Davide\nDom: Ahmed, Davide"),
  u("Ok, mandalo."), a("Inviato nel gruppo."))
s(D, "2026-09-18", "11:00", u("Ordine Gallo: 12 Barbera e 12 Arneis."),
  a("Inviato: 'Buongiorno, ordine Trattoria del Borgo (cliente 318):\n- BAR-21 Barbera d'Asti 2023 × 12\n- ARN-03 Roero Arneis 2024 × 12\nConsegna martedì mattina entro le 11. Grazie.'"),
  u("Bene."))
s(D, "2026-09-21", "13:00", u("Inventario fatto, manca una cassa di Arneis, la riordino venerdì."), a("Segnato."))
s(D, "2026-09-24", "21:00", u("Stampante della cucina di nuovo bloccata."),
  a("Spegnila, aspetta 30 secondi, riaccendila tenendo premuto FEED fino alla pagina di rete, poi riseleziona la stampante dal palmare."),
  u("Ripartita. Grande."))
s(D, "2026-09-26", "16:00", u("Stasera matrimonio da 60 persone, tutta la sala riservata."), a("In bocca al lupo!"))
s(D, "2026-09-29", "10:30", u("Scrivi la conferma per la prenotazione Marchetti, sabato 3 ottobre, 14 persone alle 20."),
  a("'Gentile signor Marchetti, confermiamo la prenotazione per 14 persone sabato 3 ottobre alle 20. A presto, Trattoria del Borgo.'"),
  u("Per i gruppi sopra le 10 persone la conferma si scrive così: ci metti il menu fisso da 35 euro a testa, chiedi la caparra di 100 euro con l'IBAN del locale e chiedi conferma del numero esatto entro due giorni prima. Rifalla."),
  a("'Gentile signor Marchetti, confermiamo la prenotazione per 14 persone sabato 3 ottobre alle 20, con il nostro menu fisso da 35 euro a persona. Per bloccare il tavolo le chiediamo una caparra di 100 euro sull'IBAN del locale (IT00 X000 0000 0000 0000 0000 000) e la conferma del numero esatto entro giovedì 1 ottobre. A presto, Trattoria del Borgo.'"),
  u("Così. Mandala."))

# ── owen (en, Leeds, a weekend plant stall with Nadia): the market office's e-mail failed, the council form by
# Wednesday noon worked (Sep 2–9); the van loading order approved (Sep 5); the weekly summary for Nadia taught (Sep 6)
# and REVISED (Sep 20: Monday by 9, a spreadsheet, the pitch fee off); the extra herb crate (one-off trap); Nadia's
# number (fact trap) ──
O = "owen"
s(O, "2026-09-01", "19:00", u("Repotted forty succulents tonight, my back is killing me."), a("Forty! Rest it tonight."))
s(O, "2026-09-02", "10:00", u("Can you book our usual pitch at the Saturday market for this week?"),
  a("I've emailed the market office asking for pitch 14 for Saturday."), u("Cheers."))
s(O, "2026-09-04", "09:00", u("Did the market office reply?"), a("No reply yet to Wednesday's email."),
  u("Ugh. Turns out they don't read that inbox any more. Pitches go through the council's online booking form, and it has to be in by Wednesday noon for the Saturday or you lose it."),
  a("Understood: the council booking form, by Wednesday noon. This week's deadline has passed, though."),
  u("Yeah, we've lost Saturday. We'll do the Sunday car-boot instead."))
s(O, "2026-09-05", "17:00", u("Packing the van for the car-boot tomorrow, give me a loading list."),
  a("1. Folding tables, flat against the side\n2. Gazebo and weights\n3. Plant trays, tall ones at the cab end\n4. Empty crates on top of the trays' rack\n5. Cash tin and card reader last, on the passenger seat"),
  u("Spot on, that's exactly the order. Do it like that every week."))
s(O, "2026-09-06", "20:00", u("Write the weekly summary for Nadia."),
  a("Hi Nadia! Good weekend at the car-boot, we sold quite a lot, about £640 in total, the ferns went really well and the herbs too…"),
  u("No, she wants it like this: totals per plant type, cash and card on separate lines, and sent tonight, Sunday, as a text."),
  a("Hi Nadia — week to 6 Sep:\nSucculents £210\nHerbs £150\nFerns £280\nCash £260 / Card £380\nTotal £640"),
  u("That's it. Send it."), a("Sent."))
s(O, "2026-09-07", "08:30", u("Nadia's new number is 07700 900461 by the way, her old phone died."), a("Noted."))
s(O, "2026-09-09", "10:30", u("Book the pitch for Saturday."),
  a("Done through the council booking form at 10:25 — confirmation came back: pitch 14, Saturday 12 September."),
  u("Brilliant. That's the way then: the form, by Wednesday noon."))
s(O, "2026-09-11", "18:00", u("Loading list for tomorrow — and this week add an extra crate of herbs for the school fair stall Nadia's doing."),
  a("1. Folding tables\n2. Gazebo and weights\n3. Plant trays, tall ones at the cab end, plus the extra herb crate for the school fair\n4. Empty crates on top\n5. Cash tin and card reader last, on the passenger seat"),
  u("Good."))
s(O, "2026-09-13", "20:30", u("Summary for Nadia please."),
  a("Hi Nadia — week to 13 Sep:\nSucculents £180\nHerbs £230\nFerns £240\nCash £300 / Card £350\nTotal £650"), u("Lovely, send."))
s(O, "2026-09-16", "09:30", u("Pitch for Saturday?"), a("Booked on the council form at 9:28: pitch 14, Saturday 19 September."), u("Ta."))
s(O, "2026-09-18", "18:30", u("Loading list for tomorrow."),
  a("1. Folding tables\n2. Gazebo and weights\n3. Plant trays, tall ones at the cab end\n4. Empty crates on top\n5. Cash tin and card reader last, on the passenger seat"),
  u("No herb crate this time, right?"), a("Right, that was only for the school fair."))
s(O, "2026-09-20", "19:00", u("Summary for Nadia."),
  a("Hi Nadia — week to 20 Sep:\nSucculents £200\nHerbs £170\nFerns £250\nCash £240 / Card £380\nTotal £620\n\nShall I text it now?"),
  u("Hold on, change of plan from now on: Nadia does the books on Monday mornings now. Send it Monday by 9 instead, as a spreadsheet attached to an email, not a text, and take the £35 pitch fee off the total."),
  a("Got it: from now on, Monday by 9, an email to Nadia with a spreadsheet — one row per plant type, cash and card columns, the £35 pitch fee deducted, net total at the bottom. I'll send this week's tomorrow morning."),
  u("Yes."))
s(O, "2026-09-21", "08:50", u("Did the summary go to Nadia?"),
  a("Sent at 8:40: spreadsheet attached, net total £585 after the £35 pitch fee."),
  u("Great, she says it's much easier for her like that."))
s(O, "2026-09-23", "11:00", u("Pitch for Saturday, same as usual."), a("Booked on the council form at 10:58: pitch 14, Saturday 26 September."), u("Cheers."))
s(O, "2026-09-25", "19:00", u("Rain forecast for tomorrow, I'm bringing the big tarp."), a("Good call."))
s(O, "2026-09-27", "21:00", u("Best day of the season, sold out of ferns by eleven."),
  a("Brilliant! I'll send Nadia the spreadsheet tomorrow by 9."), u("Ta."))
s(O, "2026-09-28", "08:55", u("Summary gone?"), a("Sent at 8:35: spreadsheet attached, net total £710 after the £35 pitch fee."), u("Good."))

# ── falegnameria_ricci (entity, it, Lucca, a joinery workshop's shared agent; "Sono Gianni"): the Bertoni panel order
# taught (Sep 1) and REVISED (Sep 21: the customer portal by Wednesday noon); Marta's quotes taught (Sep 2); the
# evening summary for Gianni approved (Sep 16); "order every two weeks" (my suggestion, never confirmed); "this time to
# the Capannori site" (one-off trap); Gianni sharpens the blades on Saturday mornings (habit trap) ──
F = "falegnameria_ricci"
s(F, "2026-09-01", "08:30", u("Sono Gianni. Da oggi gli ordini dei pannelli a Legnami Bertoni li prepari tu. Si fa così: email all'indirizzo ordini di Bertoni, nell'oggetto il nostro codice cliente 2208, una riga per pannello con tipo, spessore e misure, e deve partire entro giovedì a mezzogiorno se vogliamo la consegna il lunedì."),
  a("Capito, Gianni: email agli ordini di Bertoni, codice 2208 nell'oggetto, una riga per pannello, entro giovedì a mezzogiorno per la consegna del lunedì."))
s(F, "2026-09-02", "11:00", u("Sono Marta. Prepara il preventivo per la signora Galli: armadio a muro in rovere, 2.800 euro."),
  a("Preventivo per la sig.ra Galli: armadio a muro in rovere, 2.800 euro IVA inclusa. Consegna entro fine ottobre. Marta"),
  u("No. I preventivi si fanno così: prezzo più IVA scritta a parte, validità 30 giorni, tempi di consegna in settimane dall'acconto, e firma 'Falegnameria Ricci', mai il mio nome."),
  a("Preventivo per la sig.ra Galli: armadio a muro in rovere, 2.800 euro + IVA 22 % (616 euro), totale 3.416 euro. Validità 30 giorni. Consegna in 6 settimane dall'acconto. Falegnameria Ricci"),
  u("Così. Mandalo."))
s(F, "2026-09-03", "10:00", u("Sono Gianni, fai l'ordine a Bertoni: 6 pannelli multistrato betulla 18 mm 250x122 e 4 MDF 10 mm 280x207."),
  a("Inviato agli ordini di Bertoni alle 10:02, oggetto 'Ordine cliente 2208':\n- Multistrato betulla 18 mm 250x122 × 6\n- MDF 10 mm 280x207 × 4\nConsegna lunedì 7."),
  u("Bene."))
s(F, "2026-09-05", "08:15", u("Sono Gianni. Il sabato mattina io affilo le lame della pialla e della sega, fino alle 10 sono di là."), a("Va bene, Gianni."))
s(F, "2026-09-07", "16:00", u("Buongiorno, fate anche cornici su misura?"), a("Sì, lavoriamo su misura: passi in laboratorio con le misure e le facciamo un preventivo."))
s(F, "2026-09-09", "12:00", u("Sono Gianni. Il trasporto di Bertoni ora costa 40 euro a consegna."),
  a("Potremmo fare l'ordine a Bertoni ogni due settimane invece che ogni settimana, così si paga un trasporto solo."),
  u("Vediamo, ci penso."))
s(F, "2026-09-10", "09:30", u("Sono Ilario. Gianni dice di ordinare a Bertoni 10 pannelli di abete lamellare 27 mm 300x60, e questa volta falli consegnare direttamente al cantiere della villa a Capannori, non qui."),
  a("Inviato agli ordini di Bertoni alle 9:33, oggetto 'Ordine cliente 2208':\n- Abete lamellare 27 mm 300x60 × 10\nConsegna lunedì 14 al cantiere della villa a Capannori."),
  u("Ok."))
s(F, "2026-09-14", "15:00", u("Sono Marta, preventivo per il signor Bini: libreria in noce 1.500 euro, consegna 4 settimane."),
  a("Preventivo per il sig. Bini: libreria in noce, 1.500 euro + IVA 22 % (330 euro), totale 1.830 euro. Validità 30 giorni. Consegna in 4 settimane dall'acconto. Falegnameria Ricci"),
  u("Perfetto, mandalo."))
s(F, "2026-09-16", "18:30", u("Sono Gianni, fammi il riepilogo della giornata, oggi ero fuori dai clienti."),
  a("Lavori finiti: armadio Galli montato; due cornici consegnate.\nIn corso: libreria Bini (taglio fatto), scala della villa di Capannori.\nDa ordinare: colla vinilica, 2 pannelli MDF 10 mm."),
  u("Bravo, così va benissimo: finiti, in corso, da ordinare. Fallo sempre così la sera."))
s(F, "2026-09-17", "10:15", u("Sono Gianni, ordine a Bertoni: 2 MDF 10 mm 280x207 e 3 multistrato betulla 18 mm."),
  a("Inviato agli ordini di Bertoni alle 10:17, oggetto 'Ordine cliente 2208':\n- MDF 10 mm 280x207 × 2\n- Multistrato betulla 18 mm 250x122 × 3\nConsegna lunedì 21 qui in laboratorio."),
  u("Bene."))
s(F, "2026-09-21", "09:00", u("Sono Gianni. Ha chiamato Bertoni: da questa settimana gli ordini non si mandano più per email, si fanno sul loro portale clienti col codice 2208, e la chiusura è il mercoledì a mezzogiorno, non più il giovedì. La consegna resta il lunedì."),
  a("Capito: da questa settimana gli ordini Bertoni sul portale clienti con il codice 2208, entro mercoledì a mezzogiorno, consegna il lunedì."))
s(F, "2026-09-23", "10:30", u("Sono Ilario, ordine per Bertoni: 4 pannelli di rovere 20 mm 250x60."),
  a("Fatto sul portale clienti di Bertoni alle 10:35, codice 2208: rovere 20 mm 250x60 × 4, conferma n. 7781, consegna lunedì 28."),
  u("Gianni dice ok."))
s(F, "2026-09-23", "18:45", u("Sono Gianni, riepilogo di oggi."),
  a("Lavori finiti: libreria Bini.\nIn corso: scala della villa di Capannori, tavolo Ferretti.\nDa ordinare: niente."),
  u("Ok."))
s(F, "2026-09-25", "11:00", u("Avete la cera d'api per mobili?"), a("Sì, barattolo da 500 ml a 14 euro, è sullo scaffale vicino al banco."))
s(F, "2026-09-29", "16:00", u("Sono Marta, preventivo per i Ferretti: tavolo in castagno 2,20 metri, 1.900 euro, consegna 5 settimane."),
  a("Preventivo per la famiglia Ferretti: tavolo in castagno 220 cm, 1.900 euro + IVA 22 % (418 euro), totale 2.318 euro. Validità 30 giorni. Consegna in 5 settimane dall'acconto. Falegnameria Ricci"),
  u("Perfetto."))
s(F, "2026-09-30", "09:15", u("Sono Ilario, Gianni dice di ordinare 2 pannelli MDF 10 mm."),
  a("Fatto sul portale clienti di Bertoni alle 9:18, codice 2208: MDF 10 mm 280x207 × 2, conferma n. 7840, consegna lunedì 5 ottobre."),
  u("Ok."))

sessions.sort(key=lambda x: datetime.fromisoformat(x["ts"]))
conversations = {
    "_note": "dev_procedures (WORK_PLAN 8.12d, D53): procedures ('when <situation>, I do it this way') drawn from outcomes — a teaching or correction, an explicit approval, a way that failed and one that worked — revised when the way changes, and the procedures that must not be drawn. Fictional. Not blind.",
    "users": {"chiara": "Chiara, Bologna", "davide": "Davide, Torino", "owen": "Owen, Leeds",
              "falegnameria_ricci": "Falegnameria Ricci, Lucca"},
    "genders": {"chiara": "feminine", "davide": "masculine", "owen": "masculine"},
    "entities": ["falegnameria_ricci"],
    "sessions": sessions,
}


def x(i: str, desc: str, by: int, retired_at: int | None = None) -> dict:
    return {"id": i, "kind": "procedure", "desc": desc, "by": by, **({"retired_at": retired_at} if retired_at else {})}


def t(i: str, desc: str, why: str) -> dict:
    return {"id": i, "desc": desc, "why": why}


gold = {
    "_note": "Procedures (kind `procedure`) expected by a checkpoint (by), the superseded form of a revised one that must be retired by checkpoint 2 (retired_at), and procedures that must not appear (traps). The judge sees `desc` only; `why` explains the trap (its trap kind in brackets).",
    "checkpoints": ["2026-09-15T22:00:00+02:00", "2026-09-30T22:00:00+02:00"],
    "memories": {
        "chiara": {
            "expected": [
                x("c-lexis-invoice", "When I send an invoice to Lexis: their purchase-order number in the e-mail subject, the invoice only as an attached PDF, addressed to Lexis's accounts department (not the project manager) — Chiara taught it on Sep 1 (without the PO number they do not pay)", 1),
                x("c-hours", "When I prepare the weekly hours summary for Lexis: a table with one row per project, the total at the bottom and the week's dates underneath — Chiara approved it explicitly on Sep 4 ('fallo sempre così')", 1),
                x("c-physio", "When I book a session at Fisiomed (the physio): write to the reception on WhatsApp with Chiara's name and surname and two slots that suit her — e-mail got no answer (Sep 7–9), WhatsApp was answered at once (Sep 9, again Sep 22)", 1),
                x("c-accountant", "When I send the month's invoices to the accountant (dottor Lenzi): one single zip file, each PDF named number_client (e.g. '14_Lexis.pdf'), by the 5th of the following month — separate PDFs were refused (Sep 28)", 2),
            ],
            "traps": [
                t("c-short", "Keep messages to Chiara to two lines (as a procedure)", "her taste about messages (Sep 3), a preference, not how to do a task [1]"),
                t("c-marco-cc", "When I invoice Lexis, put Marco (their project manager) in copy", "a one-off instruction for the glossary invoice (Sep 16); on Sep 29 she said it was only for that one [3]"),
                t("c-price", "When booking the physio: a session at Fisiomed costs 45 euros (as a procedure)", "a fact (Sep 11) written as a procedure [5]"),
            ],
        },
        "davide": {
            "expected": [
                x("d-shifts", "When I write the weekly shift message for the staff group: one line per day, Monday to Sunday, with who works that day (not one line per person) — Davide corrected it on Sep 3", 1),
                x("d-wine", "When I order wine from Enoteca Gallo: the customer number (318), one line per wine with its code and quantity, delivery on Tuesday morning by 11 — Davide approved it explicitly on Sep 4 ('d'ora in poi fallo sempre così')", 1),
                x("d-printer", "When the kitchen printer stops receiving orders from the handhelds: switch it off, wait 30 seconds, switch it on holding FEED until the network page prints, then reselect the printer on the handheld — reinstalling the driver did not work (Sep 12); the reset worked on Sep 12 and Sep 24", 1),
                x("d-groups", "When I write the confirmation for a booking of more than 10 people: include the fixed menu at 35 euros a head, ask for a 100-euro deposit to the restaurant's IBAN and for the exact number two days before — Davide taught it on Sep 29", 2),
            ],
            "traps": [
                t("d-email", "When I send the shift message, also send it by e-mail to everyone", "my own suggestion (Sep 10), answered 'mah, vediamo' and never confirmed [2]"),
                t("d-inventory", "On Mondays at 10 I do the cellar inventory (as a procedure of mine)", "Davide's own habit (Sep 6, Sep 21), not a way the agent does a task [4]"),
                t("d-e24", "When the home dishwasher shows error E24, clean the filter and check the drain hose — that fixes it", "it did not work (Sep 11); a technician is due on Oct 2: a failure never fixed, written as if it worked [6]"),
            ],
        },
        "owen": {
            "expected": [
                x("o-pitch", "When I book the Saturday market pitch: use the council's online booking form, by Wednesday noon for that Saturday — e-mailing the market office got no answer and the pitch was lost (Sep 2–4); the form worked (Sep 9, 16, 23)", 1),
                x("o-van", "When I give Owen the van loading list for the market: folding tables first, then gazebo and weights, plant trays (tall ones at the cab end), empty crates on top, cash tin and card reader last on the passenger seat — approved explicitly on Sep 5 ('do it like that every week')", 1),
                x("o-summary-old", "When I write the weekly summary for Nadia: totals per plant type, cash and card on separate lines, the total, sent as a text on Sunday evening — Owen taught it on Sep 6", 1, retired_at=2),
                x("o-summary", "When I send the weekly summary to Nadia: on Monday by 9, an e-mail with a spreadsheet attached (one row per plant type, cash and card columns, the £35 pitch fee deducted, net total) — changed on Sep 20, Nadia pleased on Sep 21", 2),
            ],
            "traps": [
                t("o-summary-text", "The weekly summary for Nadia is sent as a text on Sunday evening, with the gross total (as still current)", "the superseded form of the summary procedure, revised on Sep 20 [7]"),
                t("o-herbs", "When I give the van loading list, add an extra crate of herbs", "a one-off for the school fair (Sep 11); on Sep 18 'that was only for the school fair' [3]"),
                t("o-nadia-number", "To send Nadia something, use 07700 900461 (as a procedure)", "a fact (her new number, Sep 7) written as a procedure [5]"),
            ],
        },
        "falegnameria_ricci": {
            "expected": [
                x("fr-bertoni-old", "When I order panels from Legnami Bertoni: an e-mail to their orders address, customer code 2208 in the subject, one line per panel (type, thickness, size), sent by Thursday noon for Monday delivery — Gianni taught it on Sep 1", 1, retired_at=2),
                x("fr-bertoni", "When I order panels from Legnami Bertoni: on their customer portal with code 2208, by Wednesday noon, delivery on Monday (no longer by e-mail by Thursday) — changed by Gianni on Sep 21, done that way on Sep 23 and Sep 30", 2),
                x("fr-quotes", "When I write a customer quote for the workshop: price plus VAT written separately (and the total), valid 30 days, delivery time in weeks from the deposit, signed 'Falegnameria Ricci', never with Marta's name — Marta corrected it on Sep 2", 1),
                x("fr-evening", "When Gianni asks for the end-of-day summary: three sections — jobs finished, jobs in progress, materials to order — Gianni approved it explicitly on Sep 16 ('fallo sempre così la sera')", 2),
            ],
            "traps": [
                t("fr-bertoni-email", "Orders to Bertoni go by e-mail by Thursday noon (as still current)", "the superseded form of the Bertoni procedure, revised on Sep 21 [7]"),
                t("fr-fortnight", "Order from Bertoni every two weeks to pay one transport only", "my own suggestion (Sep 9), answered 'vediamo, ci penso' and never confirmed; weekly orders went on [2]"),
                t("fr-capannori", "Bertoni deliveries go to the Capannori villa site", "a one-off instruction for one order (Sep 10); the next ones were delivered to the workshop [3]"),
                t("fr-blades", "On Saturday mornings I sharpen the planer and saw blades (as a procedure of mine)", "Gianni's own habit (Sep 5), not a way the agent does a task [4]"),
            ],
        },
    },
}
(HERE / "conversations.json").write_text(json.dumps(conversations, ensure_ascii=False, indent=1))
(HERE / "procedures_gold.json").write_text(json.dumps(gold, ensure_ascii=False, indent=1))

# Weekdays and storyline boundaries as the gold says.
wd = lambda d: date.fromisoformat(d).weekday()  # noqa: E731
day = lambda user, needle: [x["ts"][:10] for x in sessions if x["user"] == user and needle in json.dumps(x["messages"], ensure_ascii=False)]  # noqa: E731
assert wd("2026-09-01") == 1 and wd("2026-09-02") == 2 and wd("2026-09-06") == 6 and wd("2026-09-07") == 0
assert {wd(d) for d in day(O, "council form")} == {2}  # pitches booked on Wednesdays, before noon
assert {wd(d) for d in day(D, "inventario")} <= {6, 0}
# revisions: the old forms only before the change, the new forms only after it
assert all(d < "2026-09-21" for d in day(F, "Ordine cliente 2208")) and all(d >= "2026-09-23" for d in day(F, "portale clienti di Bertoni"))
assert all(d < "2026-09-20" for d in day(O, "Lovely, send")) and all(d >= "2026-09-20" for d in day(O, "spreadsheet attached"))
# never fixed: no message says the dishwasher works again
assert not day(D, "lavastoviglie funziona")
# one-offs are single episodes, then contradicted
assert len(day(C, "Marco in copia")) == 1 and len(day(O, "school fair")) == 2 and len(day(F, "Capannori, non qui")) == 1
