# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Sessions and learned sources of blind set #9 — personal agent memory of Beatrice Sartori (fictional),
physiotherapist in Trento, 18 Sep – 5 Nov 2034. Fictional people, places and businesses.

Message tuples: ("u", text) = the holder, ("a", text) = the agent, ("o", author, text) = someone else in a
group chat. Session keys written to conversations.json: id, ts, messages, participants (declared group-chat
authors). Keys for README / check.py only: group, lang.

SOURCES are the learned sources (and the one forget entry), interleaved with the sessions by `ts` at build time.
Facts that must be answerable ONLY from a source (notice period, deposit, E3 code, protocol weeks, oven time,
tax advance, alarm code) never appear in a chat message — check.py enforces a token list (SOURCE_ONLY).
"""

SESSIONS = [
    # ── September ──────────────────────────────────────────────────────────────
    {"id": "s01", "ts": "2034-09-18T20:30:00+02:00", "lang": "it", "messages": [
        ("u", "Ciao! Da oggi sei il mio assistente personale, quindi ti racconto chi sono. Mi chiamo Beatrice Sartori, ho 36 anni e faccio la fisioterapista a Trento. Fino a fine mese lavoro al Poliambulatorio Clarina; da lunedì 2 ottobre apro uno studio mio in via Suffragio 8, insieme a Greta Moser, una collega fisioterapista. Abito in via Grazioli 14 con il mio compagno Stefano Bortolotti, che coordina i servizi della Cooperativa Il Ponte, e con Tango, il nostro beagle di 5 anni."),
        ("a", "Piacere, Beatrice! Mi segno: fisioterapista a Trento, al Poliambulatorio Clarina fino a fine settembre, poi dal 2 ottobre lo studio in via Suffragio 8 con Greta Moser. Casa in via Grazioli 14 con Stefano (coordinatore dei servizi alla Cooperativa Il Ponte) e il beagle Tango. Famiglia?"),
        ("u", "Mio fratello Michele ha 29 anni, vive a Rovereto con i miei e sta finendo infermieristica. Mia mamma Loredana compie 65 anni il 21 ottobre; mio papà si chiama Ennio. Io giro con una Toyota Yaris ibrida grigia del 2029. Ti aggiungo anche a qualche chat: la famiglia, lo studio, le amiche del giovedì, il gruppo di ricerca con Priya e Jonas (in inglese) e il gruppo delle ragazze del corso di Pilates di Valencia (in spagnolo)."),
        ("a", "Perfetto: Michele (29, infermieristica, a Rovereto con Loredana ed Ennio), compleanno di tua mamma il 21 ottobre, Yaris ibrida grigia del 2029. Seguirò anche i gruppi, tenendo distinto quello che dici tu da quello che scrivono gli altri."),
    ]},
    {"id": "s02", "ts": "2034-09-20T18:10:00+02:00", "lang": "it", "messages": [
        ("u", "Tango deve fare il richiamo del vaccino. Mi prenoti alla Clinica Veterinaria Adige, dal dottor Pedrotti, giovedì 28 settembre nel tardo pomeriggio?"),
        ("a", "Fatto: ho prenotato Tango alla Clinica Veterinaria Adige con il dottor Pedrotti per giovedì 28 settembre alle 17:30, richiamo del vaccino. Ti metto un promemoria la mattina stessa."),
        ("u", "Perfetto. Fagli anche pesare Tango, mi sembra ingrassato."),
        ("a", "Segnato: alla visita chiediamo anche il peso."),
    ]},
    {"id": "s03", "ts": "2034-09-21T21:00:00+02:00", "lang": "it", "messages": [
        ("u", "Oggi ho firmato il contratto di affitto dello studio con il signor Dallapiccola, il proprietario. Te lo incollo, così se mi serve una clausola me la ricordi tu."),
        ("a", "Va bene, lo imparo per intero."),
        ("u", "Soprattutto la parte sul recesso, sul deposito e sulle riparazioni: non voglio sorprese."),
        ("a", "Ricevuto: terrò a mente recesso, deposito e riparazioni, ma imparo tutto il testo."),
    ]},
    {"id": "s04", "group": "Famiglia Sartori", "lang": "it", "ts": "2034-09-23T10:40:00+02:00",
     "participants": [{"name": "Michele", "identity": "michele-s"}], "messages": [
        ("o", "Loredana", "Buongiorno famiglia! Per il mio compleanno facciamo pranzo qui a Rovereto domenica 22 ottobre, va bene a tutti? Il 21 è sabato e Michele lavora al bar."),
        ("o", "Michele", "Ok per il 22. Intanto segnatevi: giovedì 26 ottobre ho la prova finale, alle 9 al polo universitario di Rovereto. La tesi la discuto mercoledì 15 novembre."),
        ("o", "Loredana", "Il 25, non il 26! Me l'avevi detto mercoledì."),
        ("o", "Michele", "No mamma, giovedì 26. Il 25 è la sera che vengo a cena da voi."),
        ("u", "Ok per domenica 22, veniamo io e Stefano. E in bocca al lupo Miki, segnato il 26."),
        ("o", "Ennio", "Bravo Michele, e col posto all'ospedale di Rovereto siamo a cavallo!"),
        ("o", "Michele", "Papà, ho solo fatto il colloquio, la graduatoria esce a dicembre. Non dire in giro che ho il posto."),
        ("u", "Papà ottimista come sempre 😄"),
    ]},
    {"id": "s05", "ts": "2034-09-25T13:15:00+02:00", "lang": "it", "messages": [
        ("u", "Mi serve un'assicurazione RC e danni per lo studio. Puoi confrontare qualche offerta? Massimale almeno 500 mila."),
        ("a", "Ho confrontato tre preventivi con massimale 500 mila: AssiTrento 420 euro l'anno, Linea Studio 385 euro l'anno (include i danni da acqua), Alpiprotect 510 euro l'anno ma con massimale a un milione. A parità di copertura la più conveniente è Linea Studio."),
        ("u", "Vado con Linea Studio, 385. La attivo dal 1° ottobre."),
        ("a", "Segnato: polizza Linea Studio per lo studio, 385 euro l'anno, dal 1° ottobre."),
    ]},
    {"id": "s06", "group": "Trasloco studio", "lang": "it", "ts": "2034-09-26T19:20:00+02:00",
     "participants": [{"name": "Michele", "identity": "michele-s"}, {"name": "Stefano", "identity": "stefano-b"}],
     "messages": [
        ("u", "Ragazzi, trasloco sabato 30 settembre. Ho noleggiato il furgone da Autonoleggio Vela, lo ritiro alle 8. Ci troviamo alle 8:30 in via Suffragio 8."),
        ("o", "Stefano", "Ok. Porto io il trapano e le prolunghe. Il pranzo lo offro io, pizza per tutti."),
        ("o", "Michele", "Alle 8:30 ci sono, prendo il treno delle 7:40 da Rovereto. Porto i guanti da lavoro. Quante scatole sono?"),
        ("u", "Una ventina, più il lettino vecchio e la scrivania. Greta porta le sue cose la settimana dopo."),
        ("o", "Stefano", "Il furgone lo parcheggio nel cortile?"),
        ("u", "Sì, il signor Dallapiccola ci apre il cancello alle 8:30."),
    ]},
    {"id": "s07", "ts": "2034-09-27T17:45:00+02:00", "lang": "it", "messages": [
        ("u", "Mi ha chiamato la clinica veterinaria: il dottor Pedrotti giovedì non c'è, hanno spostato Tango a venerdì 29 settembre alle 18."),
        ("a", "Aggiornato: Tango dal dottor Pedrotti venerdì 29 settembre alle 18:00, non più giovedì 28 alle 17:30. Sposto anche il promemoria."),
        ("u", "Altra cosa: il signor Dallapiccola mi ha dato il foglio con le istruzioni dell'allarme dello studio. Te le incollo, imparale: se mi dimentico come si fa me lo dici tu."),
        ("a", "Certo, le imparo."),
    ]},
    {"id": "s08", "ts": "2034-09-30T20:10:00+02:00", "lang": "it", "messages": [
        ("u", "Trasloco fatto! Cinque ore, Michele e Stefano sono stati fantastici. E ieri ho portato Tango dal veterinario: vaccino fatto, pesa 14,2 chili, Pedrotti dice che è in forma. Prossimo richiamo tra un anno."),
        ("a", "Ottimo! Segno: trasloco dello studio completato oggi, sabato 30 settembre; vaccino di Tango fatto ieri, venerdì 29, 14,2 kg, prossimo richiamo a settembre 2035."),
        ("u", "Correggo una cosa che ti ho detto all'inizio: Tango ha 6 anni, non 5, è nato nell'aprile del 2028."),
        ("a", "Corretto: Tango ha 6 anni, nato nell'aprile 2028."),
        ("u", "E mettimi un promemoria per l'affitto dello studio: il 5 di ogni mese, bonifico al signor Dallapiccola."),
        ("a", "Fatto: promemoria ricorrente il 5 di ogni mese per il bonifico dell'affitto al signor Dallapiccola; il primo giovedì 5 ottobre."),
    ]},
    # ── October ────────────────────────────────────────────────────────────────
    {"id": "s09", "ts": "2034-10-02T19:30:00+02:00", "lang": "it", "messages": [
        ("u", "Primo giorno nello studio nuovo! Tre pazienti, per cominciare va bene. L'organizzazione: lunedì, mercoledì e venerdì sono in studio, martedì e giovedì faccio le visite a domicilio, il sabato mattina in studio. Greta copre gli altri giorni."),
        ("a", "Segnato: dal 2 ottobre in studio lunedì, mercoledì, venerdì e il sabato mattina; martedì e giovedì visite a domicilio."),
        ("u", "Il sabato mattina per ora lo tengo, poi vediamo. Ah, in studio c'è anche Pietro Valcanover, un osteopata: usa la stanza piccola il giovedì."),
        ("a", "Segnato: Pietro Valcanover, osteopata, nella stanza piccola il giovedì."),
    ]},
    {"id": "s10", "group": "Rehab Research Group", "lang": "en", "ts": "2034-10-04T17:00:00+02:00",
     "participants": [{"name": "Priya", "identity": "priya-r"}], "messages": [
        ("o", "Priya", "Hi both! The Porto congress (March 2035) has opened submissions: the abstract deadline is Friday 27 October. Shall we go for the case series?"),
        ("o", "Jonas", "Yes. I can write the background and the introduction."),
        ("u", "Great. I'll write the case descriptions and the discussion. Priya, can you take methods and statistics?"),
        ("o", "Priya", "Deal. Methods and statistics are mine, I'll send them to you both by Wednesday 25 October."),
        ("o", "Jonas", "Beatrice, how many cases do we have now?"),
        ("u", "Fourteen, all from my old clinic."),
    ]},
    {"id": "s11", "group": "Compagnia del giovedì", "lang": "it", "ts": "2034-10-05T21:40:00+02:00",
     "participants": [{"name": "Stefano", "identity": "stefano-b"}], "messages": [
        ("o", "Noemi", "Allora, giovedì prossimo cena? Ho voglia di Osteria del Grillo."),
        ("o", "Dario", "Giovedì 12 per me ok. Bea, prenoti tu che hai l'assistente che fa tutto 😄"),
        ("u", "Va bene, prenoto io per giovedì 12 ottobre alle 20. Siamo in cinque con Stefano e la sorella di Noemi?"),
        ("o", "Noemi", "Sì, Serena viene. A proposito Bea: mi hanno detto che hai vinto il bando della Provincia per gli studi nuovi, 8.000 euro! Brava!"),
        ("u", "Ma chi te l'ha detto?? La graduatoria non è ancora uscita, calma 😅"),
        ("o", "Dario", "E Stefano mi ha detto che a Natale andate alle Canarie."),
        ("u", "Magari! Non abbiamo prenotato niente, Dario inventa."),
        ("o", "Stefano", "Confermo che Dario inventa. Una cosa vera invece: dal 1° novembre divento responsabile dell'area anziani in cooperativa, non più coordinatore dei servizi."),
        ("u", "Questo è vero, ed è bravissimo ❤️"),
    ]},
    {"id": "s12", "ts": "2034-10-05T22:05:00+02:00", "lang": "it", "messages": [
        ("u", "Prenotami un tavolo all'Osteria del Grillo per giovedì 12 ottobre alle 20, cinque persone, a nome mio."),
        ("a", "Fatto: tavolo per cinque all'Osteria del Grillo giovedì 12 ottobre alle 20:00, a nome Sartori. Hanno confermato via mail."),
        ("u", "Poi mi serve il treno per il corso a Verona: sabato 14 ottobre andata presto, domenica 15 ritorno verso sera."),
        ("a", "Prenotati due regionali: sabato 14 ottobre Trento 7:04 → Verona Porta Nuova 8:12; domenica 15 ottobre Verona Porta Nuova 18:35 → Trento 19:46. Totale 26,40 euro, biglietti nella tua mail."),
    ]},
    {"id": "s13", "group": "Studio Suffragio", "lang": "it", "ts": "2034-10-09T13:20:00+02:00",
     "participants": [{"name": "Greta", "identity": "greta-m"}], "messages": [
        ("o", "Greta", "Ciao! Ho comprato il Sonotherm 300 per gli ultrasuoni, arriva mercoledì 11 ottobre. Bea, ti mando il manuale per mail stasera così lo impari anche tu."),
        ("u", "Grande, grazie! Sì, mandamelo."),
        ("o", "Pietro", "Posso usarlo anch'io il giovedì? Pago la mia parte."),
        ("o", "Greta", "Certo Pietro. Comunque ragazzi, Bea ha deciso di non prendere più pazienti il sabato, quindi il sabato la stanza grande è libera."),
        ("u", "Ferma, non è così: ho detto che ci penso. Per ora il sabato mattina continuo a lavorare e la stanza grande è mia."),
        ("o", "Greta", "Ok scusa, avevo capito male. E il lettino elettrico nuovo l'hai già ordinato, no?"),
        ("u", "Non ancora, aspetto il preventivo di Fisiomarket. Vi dico."),
        ("o", "Pietro", "Io porto le mie cose giovedì 12, ci vediamo."),
    ]},
    {"id": "s14", "ts": "2034-10-11T18:30:00+02:00", "lang": "it", "messages": [
        ("u", "Dario ha la febbre, la cena di domani salta. Cancelli la prenotazione all'Osteria del Grillo?"),
        ("a", "Fatto, ho cancellato il tavolo di giovedì 12 ottobre alle 20 all'Osteria del Grillo. Mi dispiace per Dario. Ti ricordo che il tuo corso a Verona è il weekend di sabato 21 e domenica 22 ottobre: vuoi che controlli i treni?"),
        ("u", "No, sbagli: il corso è sabato 14 e domenica 15 ottobre, questo weekend, e i treni li hai già prenotati tu. Il 21 ottobre è il compleanno di mia mamma."),
        ("a", "Hai ragione, scusa: modulo 1 del corso sabato 14 e domenica 15 ottobre a Verona, treni già prenotati; sabato 21 ottobre il compleanno di tua mamma Loredana, pranzo a Rovereto domenica 22."),
        ("u", "Esatto. Ah, l'assicurazione dello studio: ho riletto la polizza, Linea Studio costa 395 euro l'anno, non 385, c'è dentro anche la tutela legale."),
        ("a", "Corretto: Linea Studio, 395 euro l'anno con tutela legale."),
    ]},
    {"id": "s15", "ts": "2034-10-16T21:15:00+02:00", "lang": "it", "messages": [
        ("u", "Il corso a Verona è andato benissimo: Riabilitazione del pavimento pelvico, modulo 1, con la dottoressa Valeria Omboni, eravamo in 18. Il modulo 2 è sabato 11 e domenica 12 novembre, sempre a Verona."),
        ("a", "Segnato: modulo 1 fatto sabato 14 e domenica 15 ottobre con la dottoressa Omboni, 18 partecipanti; modulo 2 sabato 11 e domenica 12 novembre a Verona."),
        ("u", "Ti incollo la dispensa che ci ha dato la Omboni: imparala, mi serve con le pazienti."),
        ("a", "Va bene, la imparo."),
    ]},
    {"id": "s16", "group": "Pilates Valencia 2033", "lang": "es", "ts": "2034-10-17T14:05:00+02:00",
     "participants": [{"name": "Inés", "identity": "ines-v"}], "messages": [
        ("o", "Inés", "¡Hola chicas! Bea, ya tengo el vuelo: llego a Verona el viernes 3 de noviembre a las 15:40 y cojo el tren a Trento, llego a las 18:20. Me quedo hasta el domingo 5 de noviembre."),
        ("u", "¡Qué bien! Te espero en la estación. Duermes en nuestra habitación de invitados, Tango ya está avisado 🐶"),
        ("o", "Rocío", "Yo esta vez no puedo, tengo el bautizo de mi sobrina ese fin de semana. ¡Mandad fotos!"),
        ("o", "Inés", "Bea, te paso la receta del arroz al horno de mi abuela que me pediste, te la pego aquí abajo. Hazla con el horno bien caliente."),
        ("u", "¡Gracias! La guardo, quiero hacerla para los padres de Stefano."),
    ]},
    {"id": "s17", "ts": "2034-10-17T19:40:00+02:00", "lang": "it", "messages": [
        ("u", "Lo scaldabagno dello studio è morto, niente acqua calda. Scrivi tu al signor Dallapiccola? Il contratto dice che gli impianti sono a carico suo."),
        ("a", "Fatto: ho mandato un messaggio al signor Dallapiccola segnalando il guasto dello scaldabagno e citando l'articolo 7 del contratto (impianti e interventi sopra i 150 euro a carico del locatore), chiedendo un intervento entro la settimana. Ti metto un promemoria per venerdì 20 ottobre se non risponde."),
        ("u", "Perfetto, grazie."),
    ]},
    {"id": "s18", "ts": "2034-10-18T13:00:00+02:00", "lang": "it", "messages": [
        ("u", "Ho ordinato il lettino elettrico da Fisiomarket, 1.150 euro, consegna lunedì 30 ottobre. E notizia: è uscita la graduatoria del bando della Provincia, il contributo l'ho preso! Sono 6.000 euro, non 8.000 come diceva Noemi."),
        ("a", "Che bello! Segno: lettino elettrico Fisiomarket, 1.150 euro, consegna lunedì 30 ottobre; contributo della Provincia vinto, 6.000 euro."),
        ("u", "Poi mi ordini dei fiori per mia mamma? Consegna sabato 21 ottobre mattina a Rovereto, via Dante 7, un mazzo sui 45 euro, biglietto «Buon compleanno mamma, Bea e Stefano»."),
        ("a", "Fatto: ho ordinato da Fiorelli un mazzo autunnale da 45 euro con il biglietto, consegna sabato 21 ottobre tra le 9 e le 12 in via Dante 7 a Rovereto."),
        ("u", "Ultima cosa: lunedì 6 novembre alle 11 ho l'appuntamento con Fedrizzi, il commercialista. Ti incollo i miei appunti, tienimeli."),
        ("a", "Segnato l'appuntamento con Fedrizzi lunedì 6 novembre alle 11; imparo i tuoi appunti."),
    ]},
    {"id": "s19", "group": "Famiglia Sartori", "lang": "it", "ts": "2034-10-20T18:50:00+02:00",
     "participants": [{"name": "Michele", "identity": "michele-s"}], "messages": [
        ("o", "Loredana", "Bea, la Noemi mi ha detto che ti sei fatta male alla spalla, perché non me lo dici?"),
        ("u", "Mamma, non mi sono fatta male: avevo una contrattura al trapezio due settimane fa, già passata. Noemi esagera."),
        ("o", "Loredana", "Meno male. Allora domenica alle 12:30, faccio gli strangolapreti."),
        ("o", "Michele", "Io ci sono. Il colloquio all'ospedale l'ho fatto, ma la graduatoria esce a dicembre: papà, non dire niente a nessuno."),
        ("o", "Ennio", "Io non dico niente."),
        ("u", "Alle 12:30 ci siamo, portiamo noi il dolce."),
    ]},
    {"id": "s20", "ts": "2034-10-22T21:30:00+02:00", "lang": "it", "messages": [
        ("u", "Pranzo a Rovereto fatto, mamma felicissima: i fiori sono arrivati ieri mattina alle 10 e li ha adorati. Ieri ha compiuto 65 anni. Michele è tranquillo per giovedì, l'esame è alle 9."),
        ("a", "Bene! Segno: pranzo di compleanno a Rovereto oggi, domenica 22 ottobre; fiori consegnati ieri, sabato 21, alle 10; Michele pronto per la prova finale di giovedì 26 ottobre alle 9."),
        ("u", "Stefano ha guidato, io ho dormito al ritorno 😄"),
        ("a", "Meritato."),
    ]},
    {"id": "s21", "ts": "2034-10-23T19:00:00+02:00", "lang": "it", "messages": [
        ("u", "Da oggi cambio organizzazione: in studio da lunedì a giovedì, le visite a domicilio solo il venerdì. Il sabato mattina in studio resta."),
        ("a", "Aggiornato dal 23 ottobre: studio da lunedì a giovedì più il sabato mattina; visite a domicilio il venerdì. Prima era lunedì, mercoledì e venerdì in studio."),
        ("u", "Esatto. E lo scaldabagno: il signor Dallapiccola ha mandato l'idraulico venerdì 20 ottobre, sostituito, 480 euro pagati da lui. Oggi ho anche iniziato il protocollo della dispensa della Omboni con la prima paziente."),
        ("a", "Segnato: scaldabagno sostituito venerdì 20 ottobre a spese del locatore (480 euro); protocollo della dispensa iniziato oggi con la prima paziente."),
    ]},
    {"id": "s22", "group": "Rehab Research Group", "lang": "en", "ts": "2034-10-25T16:30:00+02:00",
     "participants": [{"name": "Priya", "identity": "priya-r"}], "messages": [
        ("o", "Priya", "Methods and statistics sent to you both, as promised. Also: the congress has just extended the abstract deadline to Friday 3 November."),
        ("o", "Jonas", "Thanks Priya. I'll finish the background by Monday 30 October."),
        ("u", "Thanks both! Cases and discussion are almost done. I'll submit the abstract on Thursday 2 November, so we keep a day of margin."),
        ("o", "Priya", "Perfect. Who's the presenting author?"),
        ("u", "I can do it, if you both agree."),
        ("o", "Jonas", "Agreed."),
    ]},
    {"id": "s23", "group": "Famiglia Sartori", "lang": "it", "ts": "2034-10-26T13:10:00+02:00",
     "participants": [{"name": "Michele", "identity": "michele-s"}], "messages": [
        ("o", "Michele", "PASSATA! Prova finale superata, 29/30. Stasera cena da Al Borgo a Rovereto alle 20, chi c'è?"),
        ("o", "Loredana", "Bravissimo!! Noi ci siamo, ovviamente."),
        ("u", "Grande Miki!! Ci sono: finisco in studio alle 18:30 e arrivo. Stefano ha una riunione, viene solo se finisce presto."),
        ("o", "Ennio", "Stasera pago io."),
        ("o", "Michele", "E la tesi mercoledì 15 novembre alle 10, poi ho finito davvero."),
    ]},
    {"id": "s24", "ts": "2034-10-28T10:00:00+02:00", "lang": "en", "messages": [
        ("u", "Let's work in English today, I'm writing the abstract. The case series: 14 cases, mean age 47, treated between January and July 2034, eight sessions each, pain on the NRS from a mean of 6.4 at baseline to 2.3 at discharge. Can you draft the case description paragraph, max 90 words?"),
        ("a", "Here is a draft (88 words): «Fourteen patients (mean age 47) treated at a single outpatient clinic between January and July 2034 for persistent pelvic pain received eight sessions of manual therapy and a supervised exercise programme. Pain, measured on the 0-10 NRS, fell from a mean of 6.4 at baseline to 2.3 at discharge. No adverse events were recorded. All patients completed the programme; two needed one additional session. Outcomes were collected at discharge by the treating physiotherapist, with no follow-up beyond discharge in this series.» Shall I adjust the tone?"),
        ("u", "Good, I'll edit it. Remind me on Thursday morning to submit: I want it done on Thursday 2 November, the extended deadline is Friday 3 November."),
        ("a", "Reminder set for Thursday 2 November at 9:00: submit the Porto abstract (deadline Friday 3 November)."),
    ]},
    {"id": "s25", "ts": "2034-10-29T20:40:00+01:00", "lang": "it", "messages": [
        ("u", "Oggi ho fatto l'arroz al horno della nonna di Inés per i genitori di Stefano, Mirella e Gianpaolo. Un successo, Mirella vuole la ricetta."),
        ("a", "Che bello! La ricetta l'ho imparata da Inés martedì 17 ottobre, quando te l'ha mandata nel gruppo di Valencia: te la rimando così la giri a Mirella."),
        ("u", "Sì, mandamela. Domani arriva il lettino, ricordamelo alle 8. E, per la cronaca, giovedì sera la cena di Michele a Rovereto è stata bellissima, c'era anche Stefano alla fine."),
        ("a", "Promemoria lunedì 30 ottobre alle 8: consegna del lettino elettrico Fisiomarket. Segnato anche: giovedì 26 ottobre sera cena a Rovereto da Al Borgo per la prova finale di Michele, con Stefano arrivato alla fine."),
    ]},
    {"id": "s26", "group": "Rehab Research Group", "lang": "en", "ts": "2034-10-30T09:30:00+01:00",
     "participants": [{"name": "Priya", "identity": "priya-r"}], "messages": [
        ("o", "Jonas", "Background sent, 180 words. Sorry for the length."),
        ("o", "Priya", "Thanks Jonas. Careful, the limit is 300 words for the whole abstract."),
        ("u", "I'll trim the background to 80 and keep the discussion short. Final version to you both on Wednesday evening."),
        ("o", "Priya", "Great, thanks Beatrice."),
    ]},
    {"id": "s27", "ts": "2034-10-30T18:20:00+01:00", "lang": "it", "messages": [
        ("u", "Lettino arrivato e montato, bellissimo. Altra novità: il signor Dallapiccola oggi ha fatto sostituire l'allarme dello studio con un sistema nuovo, le vecchie istruzioni non valgono più. Dimentica le istruzioni dell'allarme che ti avevo incollato a settembre, codice compreso. Il codice nuovo me lo dà a mano domani."),
        ("a", "Fatto: ho dimenticato le istruzioni del vecchio allarme, codice compreso. Quando avrai il nuovo codice, se preferisci non darmelo per iscritto."),
        ("u", "Giusto. Stefano mercoledì 1° novembre inizia nel ruolo nuovo, è agitato."),
        ("a", "Segnato: Stefano inizia come responsabile dell'area anziani mercoledì 1° novembre."),
    ]},
    # ── November ───────────────────────────────────────────────────────────────
    {"id": "s28", "ts": "2034-11-02T09:05:00+01:00", "lang": "en", "messages": [
        ("u", "Got your reminder, thanks. Submitting now: the final abstract is 298 words, title «Manual therapy and supervised exercise in persistent pelvic pain: a case series of 14 patients». I'll send you the confirmation number afterwards."),
        ("a", "Noted: submitting today, Thursday 2 November, 298 words. I'll record the confirmation number when you send it."),
    ]},
    {"id": "s29", "group": "Rehab Research Group", "lang": "en", "ts": "2034-11-02T16:30:00+01:00",
     "participants": [{"name": "Priya", "identity": "priya-r"}], "messages": [
        ("u", "Abstract submitted at 16:10, confirmation number PC35-0412. Thank you both!"),
        ("o", "Priya", "Brilliant, well done Beatrice! Fingers crossed, results in January."),
        ("o", "Jonas", "Great work. Porto in March, hopefully."),
    ]},
    {"id": "s30", "group": "Pilates Valencia 2033", "lang": "es", "ts": "2034-11-03T17:50:00+01:00",
     "participants": [{"name": "Inés", "identity": "ines-v"}], "messages": [
        ("o", "Inés", "¡Ya estoy en el tren desde Verona! Llego a las 18:20, quizá con un poco de retraso."),
        ("u", "Te espero en la estación de Trento, en la salida principal. Esta noche cena en casa; mañana castillo y mercado."),
        ("o", "Rocío", "¡Disfrutad! Fotos, por favor."),
        ("o", "Inés", "Rocío, el domingo salgo a las 16:05, así que hay tiempo para todo."),
    ]},
    {"id": "s31", "ts": "2034-11-04T22:30:00+01:00", "lang": "it", "messages": [
        ("u", "Giornata bellissima con Inés: Castello del Buonconsiglio, mercato in piazza Duomo, pranzo in centro e cena da noi. Domani la accompagno al treno delle 16:05. Lunedì invece ho Fedrizzi alle 11, ricordamelo."),
        ("a", "Segnato: sabato 4 novembre con Inés al Castello del Buonconsiglio e al mercato; domani, domenica 5 novembre, treno di Inés alle 16:05; promemoria per Fedrizzi lunedì 6 novembre alle 11."),
    ]},
    {"id": "s32", "ts": "2034-11-05T19:30:00+01:00", "lang": "it", "messages": [
        ("u", "Inés è partita alle 16:05, tutto bene. Mi prenoti i treni per il modulo 2 a Verona? Sabato 11 novembre stessi orari dell'altra volta, ritorno domenica 12 sera."),
        ("a", "Fatto: sabato 11 novembre Trento 7:04 → Verona Porta Nuova 8:12; domenica 12 novembre Verona Porta Nuova 18:35 → Trento 19:46. 26,40 euro, biglietti nella tua mail."),
        ("u", "Grazie. E domani Fedrizzi alle 11: gli appunti li hai tu."),
        ("a", "Sì, i tuoi appunti per Fedrizzi li ho dal 18 ottobre; te li rimando domattina alle 9."),
    ]},
]


# ── Learned sources (and the one forget entry) ──────────────────────────────────

LEASE = """# Contratto di locazione ad uso studio — via Suffragio 8, Trento

Locatore: Renato Dallapiccola. Conduttrice: Beatrice Sartori.

## Art. 1 — Oggetto
Locale di 58 m² al primo piano: due stanze, sala d'attesa e bagno, con uso del cortile per carico e scarico.

## Art. 2 — Durata
Sei anni dal 1° ottobre 2034, rinnovabili per altri sei salvo disdetta.

## Art. 3 — Canone
650 euro mensili, da versare con bonifico entro il giorno 5 di ogni mese. Dal secondo anno il canone è aggiornato al 75 % della variazione ISTAT.

## Art. 4 — Deposito cauzionale
1.950 euro, pari a tre mensilità, versati alla firma; restituiti entro 60 giorni dalla riconsegna dei locali, salvo danni.

## Art. 5 — Spese
Le spese condominiali (stimate in 70 euro al mese) sono a carico della conduttrice. Riscaldamento autonomo.

## Art. 6 — Recesso
La conduttrice può recedere in qualsiasi momento con preavviso di sei mesi, da comunicare via PEC o raccomandata.

## Art. 7 — Manutenzione
Le piccole riparazioni fino a 150 euro sono a carico della conduttrice. Gli interventi di importo superiore e quelli sugli impianti (caldaia, scaldabagno, impianto elettrico, infissi) sono a carico del locatore.

## Art. 8 — Destinazione
Uso studio professionale sanitario. La sublocazione parziale è consentita solo con consenso scritto del locatore.

## Art. 9 — Animali
È ammesso un cane di piccola o media taglia, purché non entri nelle stanze dei trattamenti.
"""

ALARM = """# Istruzioni allarme — studio via Suffragio 8

- Codice utente: 4471.
- Inserimento: premere ON, digitare 4471, attendere il doppio bip; si hanno 30 secondi per uscire e chiudere la porta.
- Disinserimento: digitare 4471 e premere OFF entro 20 secondi dall'ingresso.
- Codice di emergenza: 9900 (chiama la centrale operativa senza suono).
- Centrale operativa: 0461 55 12 12, attiva 24 ore su 24.
- Batteria tampone della centralina: sostituire ogni tre anni (ultima sostituzione marzo 2033).
"""

SONOTHERM = """# Sonotherm 300 — Manuale d'uso

## Caratteristiche
Apparecchio per terapia a ultrasuoni con testina da 5 cm². Frequenze 1 MHz e 3 MHz. Modalità continua e pulsata (duty cycle 20 % e 50 %).

## Parametri
- Modalità continua: intensità massima 2,0 W/cm².
- Modalità pulsata: intensità massima 3,0 W/cm².
- Durata consigliata: 5-10 minuti per zona; non superare 15 minuti per seduta.

## Uso
Applicare sempre gel conduttivo sulla pelle; muovere la testina lentamente in piccoli cerchi. Dopo ogni uso pulire la testina con un panno e alcol al 70 %.

## Controindicazioni
Non utilizzare su portatori di pacemaker, sugli occhi, sull'addome in gravidanza, su aree con tumori o infezioni attive, sulle cartilagini di accrescimento.

## Codici di errore
- E1: testina scollegata; controllare il connettore.
- E2: contatto insufficiente; aggiungere gel e riappoggiare la testina.
- E3: surriscaldamento della testina; spegnere l'apparecchio e attendere 10 minuti prima di riprendere.

## Manutenzione e garanzia
Calibrazione annuale presso un centro autorizzato. Garanzia 24 mesi dalla data di acquisto.
"""

COURSE = """# Riabilitazione del pavimento pelvico — modulo 1
Dispensa del corso (dott.ssa Valeria Omboni), Verona, 14-15 ottobre 2034

## Valutazione iniziale
Anamnesi e valutazione con lo schema PERFECT (Power, Endurance, Repetitions, Fast contractions, Every Contraction Timed). Registrare il grado di forza da 0 a 5.

## Protocollo base (12 settimane)
- Settimane 1-4: 3 serie da 10 contrazioni di 5 secondi, con 10 secondi di riposo tra una contrazione e l'altra, 3 volte al giorno.
- Settimane 5-12: contrazioni portate a 8 secondi; aggiungere 10 contrazioni rapide alla fine di ogni serie.
- Rivalutazione con lo schema PERFECT alla settimana 6 e alla settimana 12.

## Biofeedback
Dalla settimana 3 se la forza di contrazione è inferiore al grado 3. Controindicazioni al biofeedback intracavitario: gravidanza, infezioni in corso, prime sei settimane dopo il parto.

## Diario
La paziente compila un diario giornaliero (serie fatte, perdite, sintomi); si rivede a ogni seduta.
"""

RECIPE = """# Arroz al horno de la abuela de Inés

Para 4 personas.

## Ingredientes
400 g de arroz bomba, 300 g de costillas de cerdo troceadas, 2 morcillas de cebolla, 200 g de garbanzos cocidos, 1 patata grande, 1 tomate maduro, 1 cabeza de ajos entera, 1 cucharadita de pimentón dulce, azafrán, 800 ml de caldo de cocido (el doble que de arroz), aceite de oliva, sal.

## Preparación
1. Dorar en la cazuela de barro las costillas con un poco de aceite; apartar.
2. Freír la patata en rodajas y el tomate partido por la mitad; reservar.
3. Sofreír el arroz con el pimentón medio minuto, repartir las costillas, los garbanzos, las morcillas, la patata, el tomate y la cabeza de ajos en el centro.
4. Añadir el caldo muy caliente con el azafrán y la sal.
5. Meter en el horno precalentado a 220 °C durante 25 minutos, sin remover nunca.
6. Dejar reposar 5 minutos fuera del horno antes de servir.
"""

NOTES = """# Appunti per Fedrizzi — appuntamento lunedì 6 novembre

- Ricavi 2033: 41.200 euro; regime forfettario, coefficiente di redditività 78 %.
- Acconto da versare entro il 30 novembre: 2.340 euro (chiedere se si può ridurre viste le spese dello studio).
- Lettino elettrico 1.150 euro e Sonotherm (quota mia): nel forfettario non si deducono, chiedere conferma.
- Contributo della Provincia 6.000 euro: come si tassa nel forfettario?
- Cassa di previdenza: saldo 1.870 euro entro il 31 dicembre, verificare.
- Nuovo studio: codice ATECO da aggiornare? Comunicazione di inizio attività nella nuova sede.
- Canone studio 650 euro al mese: nel forfettario non si deduce, confermare.
- Se nel 2035 i ricavi superano 85.000 euro si esce dal forfettario: non è il caso, ma chiedere la soglia aggiornata.
"""

SOURCES = [
    {"type": "source", "id": "k-lease", "ts": "2034-09-21T21:05:00+02:00", "conversation": "s03",
     "title": "Contratto di locazione studio — via Suffragio 8", "kind": "document", "author": "Renato Dallapiccola",
     "text": LEASE},
    {"type": "source", "id": "k-alarm", "ts": "2034-09-27T17:50:00+02:00", "conversation": "s07",
     "title": "Istruzioni allarme studio via Suffragio 8", "kind": "note", "provided_by": "Renato Dallapiccola",
     "text": ALARM},
    {"type": "source", "id": "k-sonotherm", "ts": "2034-10-09T20:30:00+02:00", "provided_by": "Greta",
     "title": "Sonotherm 300 — Manuale d'uso", "kind": "document", "text": SONOTHERM},
    {"type": "source", "id": "k-course", "ts": "2034-10-16T21:20:00+02:00", "conversation": "s15",
     "title": "Riabilitazione del pavimento pelvico — dispensa modulo 1", "kind": "document",
     "author": "dott.ssa Valeria Omboni", "text": COURSE},
    {"type": "source", "id": "k-recipe", "ts": "2034-10-17T14:10:00+02:00", "conversation": "s16", "provided_by": "Inés",
     "title": "Arroz al horno de la abuela de Inés", "kind": "note", "text": RECIPE},
    {"type": "source", "id": "k-notes", "ts": "2034-10-18T13:10:00+02:00", "conversation": "s18",
     "title": "Appunti per Fedrizzi (commercialista), 6 novembre", "kind": "own_text", "text": NOTES},
    {"type": "forget_source", "id": "forget-k-alarm", "ts": "2034-10-30T18:25:00+01:00", "source": "k-alarm"},
]

# Tokens that must appear only in a source text, never in a chat message (check.py).
SOURCE_ONLY = ["4471", "9900", "0461 55 12 12", "1.950", "preavviso di sei mesi", "2.340", "41.200", "220 °C",
               "25 minutos", "surriscaldamento", "E3", "12 settimane", "PERFECT", "2,0 W/cm²"]
