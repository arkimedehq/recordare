# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Conversations of blind set #12 (personal memory, H1-heavy): Tommaso Rinaldi, Bologna, February–June 2034
(fictional people). Europe/Rome (DST starts Sunday 26 March 2034: +01:00 before, +02:00 from that day).

Session fields used by build.py / check.py: `lang` ("it" | "en"); optional `group` (the group chat's name) and
`participants` (declared group-chat authors). Message tuples: ("u", text) the holder, ("a", text) the agent,
("o", author, text) someone else writing in a group chat.
"""

CALCETTO = {"group": "Calcetto del giovedì", "participants": [
    {"name": "Simone", "identity": "simone-calcetto"},
    {"name": "Marco", "identity": "marco-bellini"},
    {"name": "Davide", "identity": "davide-calcetto"}]}
LICEO = {"group": "Amici del liceo", "participants": [
    {"name": "Giulia", "identity": "giulia-liceo"},
    {"name": "Andrea", "identity": "andrea-liceo"},
    {"name": "Stefano", "identity": "stefano-liceo"}]}

SESSIONS = [
    {"id": "s01", "ts": "2034-02-06T08:40:00+01:00", "lang": "it", "messages": [
        ("u", "Buongiorno! Mi metti un promemoria fisso per gli allenamenti di Pietro? Martedì e giovedì alle 17:30 al "
              "campo della Barca, li tiene il mister Ruggeri. Il martedì lo porto io, il giovedì Chiara."),
        ("a", "Fatto: promemoria ricorrente il martedì e il giovedì alle 17 per l'allenamento di Pietro delle 17:30 al "
              "campo della Barca con il mister Ruggeri; il martedì tocca a te, il giovedì a Chiara."),
        ("u", "Perfetto. Altra cosa: è arrivata la fattura di Iliad, sempre 9,99 € al mese. Va bene così, segnalami solo "
              "se un mese cambia."),
        ("a", "Ok, tengo come riferimento 9,99 € al mese per la tua linea Iliad e ti avviso se una fattura è diversa."),
        ("u", "Grazie. Oggi giornata piena: riunione di avanzamento alle 10 e poi pranzo con Federica per parlare del "
              "budget di primavera."),
        ("a", "In bocca al lupo. Vuoi che ti prepari una scaletta per la riunione delle 10?"),
        ("u", "No, ce l'ho già. A dopo."),
    ]},
    {"id": "s02", "ts": "2034-02-08T21:10:00+01:00", "lang": "it", "messages": [
        ("u", "Mi sono pesato stasera: 88 kg. Troppi. Mi do un obiettivo: 82 kg entro l'estate."),
        ("a", "Segnato: 88 kg oggi, obiettivo 82 kg entro l'estate. Vuoi che ogni tanto ti chieda il peso?"),
        ("u", "Sì, ma senza assillarmi. Ho anche rinnovato l'abbonamento annuale alla Palestra Ercole in via Andrea "
              "Costa, così non ho scuse."),
        ("a", "Ottimo. Ci vai di solito la sera?"),
        ("u", "Lunedì e mercoledì dopo il lavoro, se riesco. Adesso però divano e libro: sto leggendo 'La casa sul "
              "canale', mi mancano un centinaio di pagine."),
        ("a", "Buona lettura!"),
    ]},
    {"id": "s03", "ts": "2034-02-10T13:00:00+01:00", "lang": "it", "messages": [
        ("u", "Oggi lavoro da casa come tutti i venerdì, quindi approfitto per le prenotazioni. Venerdì 17 febbraio "
              "sono dieci anni di matrimonio con Chiara: ho prenotato da Kumo, il giapponese in via del Pratello, alle "
              "20:30."),
        ("a", "Che bel traguardo! Segno la cena per l'anniversario da Kumo venerdì 17 febbraio alle 20:30. Serve la "
              "babysitter?"),
        ("u", "Sì, ho già scritto a Giorgia, viene lei dalle 20. Ricordamelo giovedì così le confermo."),
        ("a", "Ti ricordo giovedì 16 febbraio di confermare Giorgia per venerdì dalle 20."),
        ("u", "Poi Chiara a pranzo mi ha buttato lì l'idea di una settimana in Sardegna a giugno. Io non sono convinto, "
              "i prezzi sono folli. Ci pensiamo."),
        ("a", "Ok, la tengo come idea da valutare. Se vuoi più avanti ti preparo un confronto di costi."),
        ("u", "Più avanti, magari."),
    ]},
    {"id": "s04", "ts": "2034-02-13T19:00:00+01:00", "lang": "it", "messages": [
        ("u", "Oggi sono andato all'AVIS a donare il sangue. Tutto liscio, mi hanno dato pure la colazione."),
        ("a", "Bravo! Per la prossima donazione di sangue intero devono passare almeno 90 giorni, quindi da metà maggio."),
        ("u", "Esatto. Ieri sera ho finito 'La casa sul canale', bello il finale ma lento a metà."),
        ("a", "Hai già il prossimo?"),
        ("u", "Sì, 'Le stagioni di Ottavio', me l'ha prestato Luca. Ah, e oggi Marco è passato a prendere la mia tenda "
              "da campeggio, la usa per un weekend in Appennino con i suoi figli."),
        ("a", "Ok, la tenda da campeggio è in prestito a Marco."),
    ]},
    {"id": "s05", "ts": "2034-02-15T18:30:00+01:00", "lang": "it", "messages": [
        ("u", "Spese della giornata: ho preso gli scarpini nuovi a Pietro, 45 €, i vecchi gli stavano stretti. E ho "
              "pagato la retta di febbraio della danza di Anna, 45 € come al solito."),
        ("a", "Segnati: scarpini da calcio per Pietro 45 € e retta di febbraio della danza di Anna 45 €."),
        ("u", "Domenica 19 invece siamo a Modena per i 70 anni di Giovanna, la mamma di Chiara. Pranzo a casa loro, ci "
              "sarà tutto il parentado."),
        ("a", "Bello. Vuoi un'idea per il regalo?"),
        ("u", "Ci ha già pensato Chiara, un weekend alle terme per lei e Franco. Senti, la schiena mi fa male da giorni, "
              "ho prenotato dal dottor Zaccaria lunedì 20 alle 11."),
        ("a", "Segno la visita dal dottor Zaccaria lunedì 20 febbraio alle 11. Nel frattempo evita di sollevare pesi."),
        ("u", "Facile a dirsi con due bambini."),
    ]},
    {"id": "s06", "ts": "2034-02-18T10:15:00+01:00", "lang": "it", "messages": [
        ("u", "Anna stanotte ha avuto la febbre a 38,5, adesso è a 37,8. Il pediatra al telefono dice paracetamolo e "
              "riposo. Mi ricordi la dose indicativa per il suo peso? Pesa 23 kg."),
        ("a", "L'indicazione abituale è circa 15 mg per kg a dose, quindi per 23 kg circa 345 mg, a distanza di almeno "
              "6 ore e non più di 4 dosi al giorno; vale comunque quello che dice il pediatra e il foglietto del "
              "prodotto che avete."),
        ("u", "Coincide con quello che ha detto lui. Ieri sera niente Kumo ovviamente: abbiamo disdetto il tavolo e "
              "preso due pizze da asporto, festeggiamo un'altra volta."),
        ("a", "Peccato, ma era la scelta giusta. Vuoi che ti ricordi di riprenotare quando Anna sta meglio?"),
        ("u", "No, lascia stare per ora. Speriamo che domani stia bene per Modena."),
        ("a", "Speriamo. Un abbraccio ad Anna."),
    ]},
    {"id": "s07", "ts": "2034-02-20T08:05:00+01:00", "lang": "it", "messages": [
        ("u", "Ha chiamato lo studio di Zaccaria: oggi il dottore non c'è, la visita per la schiena è spostata a "
              "giovedì 23 alle 10."),
        ("a", "Aggiornato: visita dal dottor Zaccaria giovedì 23 febbraio alle 10."),
        ("u", "Intanto sabato sera, mentre Anna dormiva, ho prenotato Lisbona con Chiara: si parte sabato 22 aprile e si "
              "torna martedì 25 aprile, che è festivo. Voli presi, 312 € in due, e un hotel piccolo all'Alfama."),
        ("a", "Che bello! Segno Lisbona da sabato 22 a martedì 25 aprile, hotel all'Alfama. I bambini?"),
        ("u", "Da mia mamma Rosa. Ah, la mia carta d'identità scade a marzo: ho preso appuntamento all'anagrafe venerdì "
              "24 febbraio alle 9:10 per rifarla."),
        ("a", "Bene, per Lisbona serve valida. Segno l'anagrafe venerdì 24 febbraio alle 9:10; porta una fototessera "
              "recente."),
    ]},
    {"id": "s08", "ts": "2034-02-22T21:30:00+01:00", "lang": "it", "messages": [
        ("u", "Buone notizie: la schiena è passata del tutto, credo fosse solo la postura. Ho chiamato lo studio e ho "
              "annullato la visita di domani da Zaccaria."),
        ("a", "Ottimo. Tolgo la visita di domani dall'agenda."),
        ("u", "In compenso mi fa male un dente, la dottoressa Fabbri dice che va devitalizzato. Appuntamento lunedì 27 "
              "alle 15."),
        ("a", "Segno la dottoressa Fabbri lunedì 27 febbraio alle 15. A volte servono due sedute."),
        ("u", "Lei dice una sola. Speriamo."),
    ]},
    {"id": "s09", "ts": "2034-02-23T12:40:00+01:00", "lang": "it", "messages": [
        ("u", "Correggo una cosa su Lisbona: i voli sono costati 412 € in due, andata e ritorno, non 312. Avevo letto "
              "male la cifra sul riepilogo, il prezzo è sempre stato quello."),
        ("a", "Corretto: voli per Lisbona 412 € in due, andata e ritorno."),
        ("u", "A lavoro invece abbiamo fissato la demo per Varesi Logistica: mercoledì 8 marzo alle 14:30, da loro. Devo "
              "preparare l'ambiente di prova con Luca."),
        ("a", "Segno la demo per Varesi Logistica mercoledì 8 marzo alle 14:30. Vuoi un promemoria per l'ambiente di "
              "prova qualche giorno prima?"),
        ("u", "Sì, lunedì 6 marzo mattina."),
        ("a", "Fatto."),
    ]},
    {"id": "s10", "ts": "2034-02-26T18:00:00+01:00", "lang": "it", "messages": [
        ("u", "Ieri Pietro ha giocato contro il Corticella e ha segnato un gol! Abbiamo pareggiato 2-2."),
        ("a", "Bravo Pietro! Chissà com'era contento."),
        ("u", "Adesso però spesa per la settimana. Mi fai una lista? Pasta, latte, yogurt per i bambini, frutta, "
              "detersivo per piatti, e qualcosa per le cene veloci."),
        ("a", "Ecco: pasta, latte, yogurt bianco e alla frutta, mele, banane, arance, detersivo per piatti, uova, "
              "piadine, stracchino, verdure surgelate, tonno. Aggiungo altro?"),
        ("u", "Caffè. E i biscotti che piacciono ad Anna, quelli al cacao."),
        ("a", "Aggiunti caffè e biscotti al cacao."),
    ]},
    {"id": "s11", "ts": "2034-03-01T20:45:00+01:00", "lang": "it", **CALCETTO, "messages": [
        ("o", "Simone", "Ragazzi, il calendario è uscito: la FINALE del torneo la giochiamo giovedì 16 marzo alle 21 al "
                        "campo Dozza, contro i Bradipi. Tutti presenti?"),
        ("o", "Davide", "Presente!"),
        ("u", "Ci sono, ovviamente."),
        ("o", "Marco", "Ci sono. E già che ci siamo: venerdì 7 aprile faccio 40 anni, festa all'Osteria del Moro dalle "
                       "20. Siete tutti invitati, mogli e mariti compresi."),
        ("o", "Simone", "Grande Marco, segnato!"),
        ("u", "Ci saremo io e Chiara, grazie!"),
        ("o", "Davide", "Contate anche me."),
    ]},
    {"id": "s12", "ts": "2034-03-01T21:20:00+01:00", "lang": "it", "messages": [
        ("u", "Ricordami un po' di cose. È arrivata la lettera dell'amministratore Ferri: assemblea condominiale "
              "martedì 14 marzo alle 21, nella sala della parrocchia."),
        ("a", "Segnata: assemblea condominiale martedì 14 marzo alle 21 nella sala della parrocchia."),
        ("u", "Poi domenica 5 marzo pranzo da mia sorella Elisa a Ferrara, partiamo verso le 11."),
        ("a", "Segno: domenica 5 marzo pranzo da Elisa a Ferrara, partenza verso le 11."),
        ("u", "E oggi ho preso i parastinchi a Pietro, 12 €. Ha perso i suoi negli spogliatoi, per l'ennesima volta."),
        ("a", "Magari stavolta scriviamoci sopra il nome."),
        ("u", "Col pennarello indelebile, giuro."),
    ]},
    {"id": "s13", "ts": "2034-03-02T19:30:00+01:00", "lang": "en", "messages": [
        ("u", "On the 18:10 train back from Milan. First day at the Milan office this year, long but useful: we closed "
              "the scope for the Varesi integration."),
        ("a", "Glad it went well. Anything from today's meeting you want me to keep?"),
        ("u", "Just that the Milan team wants weekly syncs on Tuesdays at 11. And remind me tomorrow to send the "
              "minutes to Federica."),
        ("a", "Noted: weekly sync with the Milan team on Tuesdays at 11, and a reminder tomorrow morning to send "
              "Federica the minutes."),
        ("u", "Thanks. I'll be home around 20:30, Chiara's making lasagne."),
        ("a", "Enjoy dinner!"),
    ]},
    {"id": "s14", "ts": "2034-03-03T22:00:00+01:00", "lang": "it", "messages": [
        ("u", "Stasera abbiamo aperto il Lambrusco che ci hanno regalato alla festa dei 70 anni di Giovanna a Modena. "
              "Buonissimo, devo chiedere a Franco dove lo prende."),
        ("a", "Me lo segno: chiedere a Franco dove compra quel Lambrusco."),
        ("u", "Brutta notizia invece: Elisa ha l'influenza, domenica niente Ferrara. Ci ha detto di andare domenica 12."),
        ("a", "Peccato. Sposto il pranzo da Elisa a domenica 12 marzo."),
        ("u", "Sì. Dille di riguardarsi... no scherzo, glielo scrivo io."),
        ("a", "Meglio da te. Buona serata!"),
    ]},
    {"id": "s15", "ts": "2034-03-04T11:00:00+01:00", "lang": "it", "messages": [
        ("u", "Sono tornato a correre! 5 km ai Giardini Margherita, piano piano. Le gambe sono di legno."),
        ("a", "Ottimo inizio. Vuoi un programma per aumentare gradualmente?"),
        ("u", "Sì, ma semplice: una corsa a settimana, aggiungo un km ogni volta."),
        ("a", "Perfetto, così arrivi a 10 km in un paio di mesi senza farti male."),
        ("u", "Altra cosa: il lavello della cucina perde. Ho sentito Sandro, l'idraulico: passa martedì 7 in mattinata. "
              "Chiara lavora, quindi aspetto io a casa."),
        ("a", "Segno: Sandro l'idraulico martedì 7 marzo in mattinata per la perdita del lavello; resti a casa tu."),
        ("u", "Martedì faccio smart working allora, lo chiedo a Federica."),
        ("a", "Buona idea."),
    ]},
    {"id": "s16", "ts": "2034-03-06T13:10:00+01:00", "lang": "it", "messages": [
        ("u", "Pausa pranzo. Ti dico solo che da quando la Fabbri mi ha fatto la devitalizzazione il dente non mi fa più "
              "male per niente, finalmente mangio da tutte e due le parti."),
        ("a", "Che sollievo!"),
        ("u", "Al lavoro invece Varesi ha chiesto di spostare la demo: non più mercoledì 8 ma mercoledì 15 marzo, stessa "
              "ora. Luca è contento, ha più tempo per l'ambiente di prova."),
        ("a", "Aggiornato: demo per Varesi Logistica mercoledì 15 marzo alle 14:30."),
        ("u", "E venerdì 10 accompagno mia mamma a fare gli esami del sangue al poliambulatorio Saragozza, alle 7:30. "
              "Ricordamelo giovedì sera, che devo anche dirle di stare a digiuno."),
        ("a", "Segno: venerdì 10 marzo alle 7:30 accompagni tua mamma agli esami del sangue al poliambulatorio "
              "Saragozza. Ti ricordo giovedì 9 sera di dirle del digiuno."),
    ]},
    {"id": "s17", "ts": "2034-03-09T19:00:00+01:00", "lang": "it", "messages": [
        ("u", "Sono un po' arrabbiato: il lavello perde ancora. Sandro non si è fatto vivo e non risponde, sto ancora "
              "aspettando che mi richiami. Ho messo una bacinella sotto."),
        ("a", "Che seccatura. Vuoi che ti cerchi un altro idraulico in zona se Sandro non richiama?"),
        ("u", "Aspetto fino a lunedì, di solito è affidabile. Poi: l'amministratore ha spostato l'assemblea "
              "condominiale a martedì 21 marzo, la sala della parrocchia il 14 è occupata."),
        ("a", "Aggiornato. Sempre alle 21?"),
        ("u", "Sì, stessa ora e stesso posto. Ah, oggi ho prestato il trapano a Gianni del terzo piano, deve montare "
              "delle mensole."),
        ("a", "Ok: trapano in prestito a Gianni del terzo piano."),
    ]},
    {"id": "s18", "ts": "2034-03-11T10:30:00+01:00", "lang": "it", "messages": [
        ("u", "Seconda corsa: 6 km, sempre ai Giardini. Meglio di sabato scorso."),
        ("a", "Bravo, progressione rispettata."),
        ("u", "Elisa ha ancora la febbre, quindi domani salta di nuovo Ferrara. Facciamo sabato 25 marzo, così si "
              "riposa bene."),
        ("a", "Spostato ancora: pranzo da Elisa a Ferrara sabato 25 marzo."),
        ("u", "Lunedì poi porto Anna dall'oculista, il dottor Melandri, alle 16:40: la maestra dice che strizza gli "
              "occhi quando legge alla lavagna."),
        ("a", "Segno: lunedì 13 marzo alle 16:40 Anna dall'oculista, dottor Melandri. Porta il libretto sanitario."),
        ("u", "Ok. Speriamo niente occhiali, ci tiene troppo a non averli."),
        ("a", "Incrocio le dita per lei."),
    ]},
    {"id": "s19", "ts": "2034-03-13T21:00:00+01:00", "lang": "it", "messages": [
        ("u", "Novità nel calcio di Pietro: il mister Ruggeri lascia, si trasferisce a Imola per lavoro. Stasera ha "
              "salutato tutti alla riunione con i genitori. Dalla prossima settimana arriva uno nuovo, mi pare si "
              "chiami Bonetti."),
        ("a", "Peccato, Pietro gli era affezionato? Segno che Ruggeri lascia e che il nuovo allenatore è Bonetti."),
        ("u", "Molto, era quasi in lacrime. Cambiano anche i giorni di allenamento, ma ce li dicono la settimana "
              "prossima."),
        ("a", "Ok, aspetto i nuovi giorni prima di cambiare il promemoria."),
        ("u", "Chiara ti saluta. Stiamo guardando un documentario sui fari, bellissimo."),
        ("a", "Salutala! Buona visione."),
    ]},
    {"id": "s20", "ts": "2034-03-14T18:00:00+01:00", "lang": "it", **CALCETTO, "messages": [
        ("o", "Simone", "Ragazzi brutte notizie: giovedì 16 il campo Dozza ce l'hanno tolto per un altro torneo. La "
                        "finale slitta a giovedì 23 marzo, stessa ora, le 21."),
        ("o", "Davide", "Ok per me."),
        ("u", "Va bene anche per me."),
        ("o", "Marco", "Ci sono, il 23 va bene."),
        ("o", "Simone", "Perfetto, allora giovedì 23 alle 21. Maglie blu."),
    ]},
    {"id": "s21", "ts": "2034-03-15T12:30:00+01:00", "lang": "it", "messages": [
        ("u", "Mattinata surreale: la demo di oggi con Varesi è saltata ancora, il loro direttore è a Roma. Nuova data "
              "martedì 21 marzo alle 10."),
        ("a", "Aggiornato: demo per Varesi Logistica martedì 21 marzo alle 10."),
        ("u", "Almeno Luca è contento. Poi con Chiara ieri sera abbiamo deciso: la Sardegna a giugno lasciamo perdere, "
              "costa troppo. Ci basta Lisbona ad aprile."),
        ("a", "Capito, niente Sardegna quest'anno."),
        ("u", "Per l'estate al massimo qualche giorno al mare a Cesenatico, ma niente di deciso."),
        ("a", "Ok, lo tengo come idea."),
    ]},
    {"id": "s22", "ts": "2034-03-16T18:45:00+01:00", "lang": "it", "messages": [
        ("u", "Finalmente! Sandro stamattina è passato e ha cambiato il sifone del lavello. 90 € e niente più perdite."),
        ("a", "Ottimo, risolto."),
        ("u", "Sabato 18 siamo a cena da Marco e Serena. Mi ricordi domani di passare dalla pasticceria Lanzoni a "
              "prendere il tiramisù? L'ho già ordinato."),
        ("a", "Ti ricordo venerdì 17 marzo di ritirare il tiramisù alla pasticceria Lanzoni per la cena di sabato da "
              "Marco e Serena."),
        ("u", "Grazie. Stasera niente calcetto, la finale è spostata al 23."),
        ("a", "Allora serata libera."),
    ]},
    {"id": "s23", "ts": "2034-03-20T08:30:00+01:00", "lang": "it", "messages": [
        ("u", "Sabato Pietro ha fatto doppietta! Due gol contro il San Donato, vinto 3-1."),
        ("a", "Fantastico! Due gol in una partita."),
        ("u", "E una correzione: il nuovo mister non si chiama Bonetti, si chiama Bonacini, Paolo Bonacini. Avevo "
              "capito male io la settimana scorsa."),
        ("a", "Corretto: il nuovo allenatore di Pietro è Paolo Bonacini."),
        ("u", "Gli allenamenti adesso sono lunedì e mercoledì alle 17:30, sempre alla Barca. Cambia il promemoria. Il "
              "lunedì lo porta Chiara, il mercoledì io."),
        ("a", "Fatto: promemoria allenamenti il lunedì e il mercoledì alle 17:30 alla Barca; lunedì Chiara, mercoledì "
              "tu."),
        ("u", "Ieri volevo fare la terza corsa ma diluviava, niente. Ci riprovo domenica prossima."),
        ("a", "Ok, la prossima settimana allora."),
    ]},
    {"id": "s24", "ts": "2034-03-21T19:40:00+01:00", "lang": "it", **CALCETTO, "messages": [
        ("o", "Simone", "Ragazzi, mazzata: il campo Dozza è allagato e la federazione non ha altre date. La finale è "
                        "annullata, il torneo finisce qui: coppa ai Bradipi per la classifica del girone."),
        ("o", "Davide", "Ma dai!! Che rabbia."),
        ("o", "Marco", "Peccato, ci tenevo."),
        ("u", "Che peccato. Vabbè, ci rifacciamo col torneo di settembre."),
        ("o", "Simone", "Giovedì 23 ci vediamo lo stesso per una birra al Moro, chi c'è?"),
        ("u", "Io ci sono."),
    ]},
    {"id": "s25", "ts": "2034-03-22T13:00:00+01:00", "lang": "it", "messages": [
        ("u", "La demo di ieri con Varesi è andata benissimo, il direttore ha detto che firmano entro aprile. Federica è "
              "al settimo cielo."),
        ("a", "Complimenti a te e a Luca!"),
        ("u", "Ieri sera poi assemblea condominiale: hanno approvato il rifacimento del tetto, 1.400 € a famiglia in due "
              "rate."),
        ("a", "Sai già le scadenze delle rate?"),
        ("u", "Giugno e novembre. E ciliegina: Chiara ha preso una multa per la ZTL con la sua Yaris, 83 €. Era entrata "
              "in via Indipendenza per lasciare un pacco."),
        ("a", "Che sfortuna. Se la paga entro 5 giorni dalla notifica di solito c'è lo sconto del 30%."),
        ("u", "Glielo dico, grazie."),
    ]},
    {"id": "s26", "ts": "2034-03-25T20:30:00+01:00", "lang": "it", "messages": [
        ("u", "Siamo appena tornati da Ferrara, da Elisa. Finalmente! Pranzo lungo e poi giro in bici sulle mura con i "
              "bambini. Elisa sta benone adesso."),
        ("a", "Che bella giornata. Mi fa piacere che si sia ripresa."),
        ("u", "Una cosa pratica: la mamma dal 1° aprile affitta il garage di via Saragozza, quindi oggi ho spostato la "
              "Punto vecchia nel posto auto del condominio, il numero 14."),
        ("a", "Segnato: la Punto ora è nel posto auto condominiale n. 14."),
        ("u", "Prima o poi la devo vendere, la uso due volte all'anno."),
        ("a", "Quando vuoi ti aiuto a preparare l'annuncio."),
    ]},
    {"id": "s27", "ts": "2034-03-26T12:00:00+02:00", "lang": "it", "messages": [
        ("u", "Terza corsa: 7 km! Con l'ora legale mi sono svegliato tardissimo, ma ce l'ho fatta prima di pranzo."),
        ("a", "Bravo, stai tenendo il programma."),
        ("u", "Il ginocchio destro un po' si lamenta però."),
        ("a", "Se il fastidio resta qualche giorno, meglio una settimana di pausa o farlo vedere. Intanto ghiaccio e "
              "stretching."),
        ("u", "Ok, vediamo."),
    ]},
    {"id": "s28", "ts": "2034-03-28T18:20:00+02:00", "lang": "it", "messages": [
        ("u", "Due cambi in arrivo. Primo: in azienda cambiano lo smart working. Da lunedì 3 aprile il giorno da casa "
              "non è più il venerdì ma il lunedì, per tutti."),
        ("a", "Segnato: dal 3 aprile lavori da casa il lunedì; il venerdì sei in ufficio."),
        ("u", "Secondo: lascio Iliad e passo a Kena, 7,99 € al mese con più giga. La portabilità è fissata per lunedì 3 "
              "aprile."),
        ("a", "Ok. Tieni la vecchia SIM finché quella nuova non si attiva."),
        ("u", "Sì sì."),
    ]},
    {"id": "s29", "ts": "2034-03-28T21:30:00+02:00", "lang": "it", "messages": [
        ("u", "Chiara mi dice che da aprile la scuola di danza di Anna aumenta la retta: da 45 a 50 € al mese."),
        ("a", "Aggiornato: retta di danza di Anna 50 € al mese da aprile."),
        ("u", "E la nostra babysitter Giorgia parte per l'Erasmus a Valencia. Dal 3 aprile viene Irina, una "
              "studentessa di infermieristica, stessi orari: martedì e giovedì pomeriggio."),
        ("a", "Segnato: da aprile la babysitter è Irina, martedì e giovedì pomeriggio. Vuoi che salvi il suo numero?"),
        ("u", "Te lo mando dopo. Mi spiace per Giorgia, i bambini la adoravano."),
        ("a", "Potranno salutarla in videochiamata ogni tanto."),
    ]},
    {"id": "s30", "ts": "2034-03-29T21:00:00+02:00", "lang": "it", **CALCETTO, "messages": [
        ("o", "Marco", "Ragazzi, devo darvi una brutta notizia: la festa di venerdì 7 aprile salta. Mio padre è in "
                       "ospedale da ieri, niente di gravissimo ma non me la sento. La rifaremo più avanti, vi faccio "
                       "sapere."),
        ("o", "Simone", "Ci mancherebbe Marco, forza a tuo padre!"),
        ("o", "Davide", "Un abbraccio, Marco."),
        ("u", "Forza Marco, un abbraccio a te e a tuo papà. Se serve qualcosa chiama."),
        ("o", "Marco", "Grazie ragazzi."),
    ]},
    {"id": "s31", "ts": "2034-03-30T20:10:00+02:00", "lang": "en", "messages": [
        ("u", "Back from Milan again, second time at the Milan office this year. Big news: the Dublin office wants me "
              "there in May, Monday 15 to Wednesday 17 May, for the platform kickoff."),
        ("a", "Exciting! Noted: Dublin from Monday 15 to Wednesday 17 May."),
        ("u", "Since I'll be in Milan more often, I bought a 10-entry card at FitHub, the gym in Porta Romana right next "
              "to the office. Obviously I'm keeping my Ercole membership in Bologna, this is just for Milan days."),
        ("a", "Got it: FitHub in Milan on office days, on top of Palestra Ercole in Bologna."),
        ("u", "And I finished 'Le stagioni di Ottavio' on the train. Great book, I'll give it back to Luca tomorrow."),
        ("a", "Glad you liked it."),
    ]},
    {"id": "s32", "ts": "2034-04-01T09:30:00+02:00", "lang": "it", "messages": [
        ("u", "Oggi pomeriggio vernicio la ringhiera del balcone, è tutta arrugginita. Ieri ho comprato l'antiruggine e "
              "due pennelli."),
        ("a", "Buon lavoro! Carteggia bene la ruggine prima e copri il pavimento."),
        ("u", "Sì, Chiara mi ha già dato i giornali vecchi. Stamattina invece portiamo i bambini al mercato."),
        ("a", "Buona giornata allora."),
    ]},
    {"id": "s33", "ts": "2034-04-02T19:00:00+02:00", "lang": "it", "messages": [
        ("u", "Oggi prima partita con il mister Bonacini e Pietro ha segnato di nuovo: un gol contro la Fortitudo, abbiamo "
              "vinto 2-0."),
        ("a", "Che inizio con il nuovo mister!"),
        ("u", "Gianni mi ha riportato il trapano stamattina, con una bottiglia di vino per ringraziare."),
        ("a", "Gentile Gianni."),
        ("u", "Domani primo giorno di smart working di lunedì, strano."),
        ("a", "Ti abitui presto."),
    ]},
    {"id": "s34", "ts": "2034-04-04T09:00:00+02:00", "lang": "it", "messages": [
        ("u", "La portabilità è andata: il numero ora è su Kena, funziona tutto. Ho buttato la SIM Iliad."),
        ("a", "Perfetto."),
        ("u", "Oggi pomeriggio primo giorno di Irina con i bambini, speriamo bene."),
        ("a", "Incrocio le dita, poi dimmi com'è andata."),
        ("u", "Ah, Federica mi chiede una stima per il progetto Varesi entro venerdì. Mi ricordi giovedì?"),
        ("a", "Ti ricordo giovedì 6 aprile la stima per Varesi da consegnare a Federica entro venerdì 7."),
    ]},
    {"id": "s35", "ts": "2034-04-09T11:30:00+02:00", "lang": "it", "messages": [
        ("u", "Stamattina quarta corsa, 8 km, ginocchio a posto. Sono contento."),
        ("a", "Ottimo, e il ginocchio regge."),
        ("u", "Ho mollato 'Nebbia sul Reno' a metà, troppo lento. Non lo finisco."),
        ("a", "Capito. Vuoi un consiglio per il prossimo?"),
        ("u", "Ho già in mente un giallo in inglese che mi ha consigliato Owen, 'The Quiet Harbour'."),
        ("a", "Bella scelta per tenere allenato l'inglese."),
    ]},
    {"id": "s36", "ts": "2034-04-10T18:00:00+02:00", "lang": "it", "messages": [
        ("u", "Lunedì da casa, comodo. Intanto ho preparato i documenti per Lisbona: io viaggio con la carta d'identità "
              "nuova, Chiara con il passaporto. Il check-in si apre 48 ore prima, giusto?"),
        ("a", "Di solito sì, ma dipende dalla compagnia: controlla l'email di conferma. Ti metto un promemoria per "
              "giovedì 20 aprile sera?"),
        ("u", "Sì, perfetto."),
        ("a", "Fatto."),
        ("u", "Poi vorrei cambiare il materasso, il nostro ha dodici anni. Mi fai una lista di cosa guardare?"),
        ("a", "Rigidità adatta al peso di entrambi, materiali (memory, molle insacchettate, lattice), prova in negozio "
              "di almeno dieci minuti, periodo di prova a casa, garanzia e politica di reso."),
        ("u", "Ottimo, ne parlo con Chiara."),
    ]},
    {"id": "s37", "ts": "2034-04-12T20:00:00+02:00", "lang": "it", "messages": [
        ("u", "Settimana piena. Sabato 15 do finalmente l'antiruggine alla ringhiera del balcone, il barattolo è lì da "
              "fine marzo che mi guarda."),
        ("a", "Segno sabato 15 aprile per la ringhiera. Se piove?"),
        ("u", "Se piove si vedrà. Poi mercoledì 19 alle 16:30 ho il colloquio con la maestra di Pietro, la maestra "
              "Gentili. E giovedì 20 alle 17 vado dal commercialista Gualandi per la dichiarazione dei redditi, devo "
              "portare le spese mediche e le ricevute della danza."),
        ("a", "Segnati: mercoledì 19 aprile alle 16:30 colloquio con la maestra Gentili; giovedì 20 aprile alle 17 "
              "commercialista Gualandi, con spese mediche e ricevute della danza."),
        ("u", "E prima di partire devo portare la mamma a fare la spesa grossa, ma quello lo organizzo con lei."),
        ("a", "Ok, fammi sapere quando."),
    ]},
    {"id": "s38", "ts": "2034-04-13T21:00:00+02:00", "lang": "it", **LICEO, "messages": [
        ("o", "Giulia", "Gente! Rimpatriata della 5ªC, vent'anni dopo... più o meno. Propongo venerdì 28 aprile alle "
                        "20:30 alla Trattoria del Portico. Chi c'è?"),
        ("o", "Andrea", "Io!"),
        ("u", "Ci sono anch'io, finalmente!"),
        ("o", "Stefano", "Il 28 sono in trasferta, ma provo."),
        ("o", "Giulia", "Allora prenoto per una dozzina, poi aggiusto."),
    ]},
    {"id": "s39", "ts": "2034-04-18T21:15:00+02:00", "lang": "it", "messages": [
        ("u", "Peso di oggi: 84 kg. Da 88 a febbraio non è male."),
        ("a", "Meno 4 kg in due mesi, ottimo!"),
        ("u", "A questo punto alzo l'asticella: nuovo obiettivo 80 kg. Ce la posso fare entro settembre."),
        ("a", "Aggiornato: obiettivo 80 kg entro settembre."),
        ("u", "Altra cosa: martedì 2 maggio alle 9:30 Anna ha il richiamo del vaccino all'ASL di via Montebello. La "
              "porta Chiara ma ricordamelo il giorno prima."),
        ("a", "Segno il richiamo di Anna martedì 2 maggio alle 9:30, con promemoria lunedì 1 maggio."),
        ("u", "Il primo maggio è festa e non guardo il telefono, ricordamelo domenica 30 aprile."),
        ("a", "Giusto, promemoria domenica 30 aprile."),
    ]},
    {"id": "s40", "ts": "2034-04-20T22:00:00+02:00", "lang": "en", "messages": [
        ("u", "Writing in English, just had a call with the Dublin people. The Dublin trip moves: not 15 to 17 May any "
              "more, now Monday 29 to Wednesday 31 May, they need more time to set up the platform team."),
        ("a", "Updated: Dublin from Monday 29 to Wednesday 31 May."),
        ("u", "Also Owen texted, he's back from Canada. We'll do a proper video call on Thursday 4 May at 8pm to catch "
              "up."),
        ("a", "Noted: video call with Owen on Thursday 4 May at 20:00."),
        ("u", "And next Thursday, 27 April, I'm in Milan again for the Varesi rollout planning."),
        ("a", "Noted: Milan office on Thursday, 27 April."),
        ("u", "Check-in for Lisbon done, by the way. Seats together."),
        ("a", "Great, all set for Saturday."),
    ]},
    {"id": "s41", "ts": "2034-04-21T19:00:00+02:00", "lang": "it", "messages": [
        ("u", "Domani si parte! Mi aiuti con la lista per la valigia? Quattro giorni, clima mite."),
        ("a", "Ecco: documenti (la tua carta d'identità, il passaporto di Chiara), carte di pagamento, caricabatterie "
              "(in Portogallo le prese sono come le nostre), scarpe comode per le salite dell'Alfama, una giacca "
              "leggera per la sera, k-way, occhiali da sole, medicinali di base."),
        ("u", "Ottimo. I bambini li porto dalla mamma domattina alle 7."),
        ("a", "Buon viaggio a tutti e due!"),
    ]},
    {"id": "s42", "ts": "2034-04-26T21:00:00+02:00", "lang": "it", **LICEO, "messages": [
        ("o", "Giulia", "Cambio di programma: il 28 metà di voi non può. Spostiamo la rimpatriata a venerdì 5 maggio, "
                        "stessa ora e stesso posto."),
        ("o", "Stefano", "Grazie Giulia, il 5 ci sono di sicuro."),
        ("u", "Va bene anche per me."),
        ("o", "Andrea", "Ok!"),
    ]},
    {"id": "s43", "ts": "2034-04-26T21:40:00+02:00", "lang": "en", "messages": [
        ("u", "Tomorrow's Milan trip is off: the Varesi people are coming to Bologna instead, so we'll meet them at our "
              "office."),
        ("a", "Okay, no Milan tomorrow; Varesi meeting in Bologna."),
        ("u", "Better for me honestly, three hours of train saved. Can you remind me at 8:30 to print the rollout "
              "plan?"),
        ("a", "Sure, reminder tomorrow at 8:30."),
    ]},
    {"id": "s44", "ts": "2034-04-27T20:30:00+02:00", "lang": "it", "messages": [
        ("u", "Oggi ho preso a Pietro la borsa nuova per il calcio, 25 €, la vecchia ha la cerniera rotta. E ad Anna le "
              "scarpette da danza, 30 €."),
        ("a", "Segnati entrambi."),
        ("u", "Domenica 30 andiamo all'Ikea di Casalecchio con Chiara a prendere la libreria per la camera di Pietro, "
              "quella bianca alta. Ricordami di misurare la parete sabato."),
        ("a", "Segno: domenica 30 aprile Ikea di Casalecchio per la libreria bianca della camera di Pietro, e sabato 29 "
              "aprile ti ricordo di misurare la parete."),
        ("u", "Grazie. Stanchissimo, buonanotte."),
        ("a", "Buonanotte!"),
    ]},
    {"id": "s45", "ts": "2034-05-01T18:00:00+02:00", "lang": "it", "messages": [
        ("u", "SMS dell'ASL: il richiamo di Anna di domani è spostato a martedì 9 maggio, stessa ora, 9:30. Chissà "
              "perché."),
        ("a", "Aggiornato: richiamo del vaccino di Anna martedì 9 maggio alle 9:30."),
        ("u", "Poi è arrivato l'avviso della scuola: la gita di Anna allo zoo è giovedì 11 maggio. Bisogna dare 15 € e "
              "il pranzo al sacco."),
        ("a", "Segno: gita allo zoo di Anna giovedì 11 maggio, 15 € e pranzo al sacco."),
        ("u", "Oggi giornata di festa tranquilla, siamo stati al parco tutto il pomeriggio."),
        ("a", "Ci voleva."),
    ]},
    {"id": "s46", "ts": "2034-05-03T21:00:00+02:00", "lang": "it", "messages": [
        ("u", "Stasera ho messo sul NAS tutte le foto di Lisbona, la cartella si chiama '2034-04 Lisbona'. Più di 600 "
              "foto, Chiara dice che devo fare una selezione."),
        ("a", "600 sono tante. Vuoi un'idea per organizzarle?"),
        ("u", "Dopo. Disastro invece: la lavatrice è morta, perde acqua da sotto. Ne ho ordinata una nuova da Euronics, "
              "la consegnano mercoledì 10 maggio in mattinata con ritiro della vecchia."),
        ("a", "Segno la consegna della lavatrice nuova mercoledì 10 maggio in mattinata."),
        ("u", "Fino ad allora lavanderia a gettoni, che gioia."),
        ("a", "Coraggio, è solo una settimana."),
    ]},
    {"id": "s47", "ts": "2034-05-03T21:30:00+02:00", "lang": "it", **LICEO, "messages": [
        ("o", "Giulia", "Ultimo cambio, lo giuro: la Trattoria del Portico il 5 è chiusa per un evento privato. "
                        "Rimpatriata venerdì 12 maggio, alle 20:30, sempre lì."),
        ("o", "Andrea", "Ok, il 12."),
        ("o", "Stefano", "Ci sono."),
        ("u", "Ok Giulia, ci provo, vi faccio sapere."),
    ]},
    {"id": "s48", "ts": "2034-05-05T13:00:00+02:00", "lang": "it", "messages": [
        ("u", "Ho riletto l'avviso della scuola: la gita di Anna è venerdì 12 maggio, non giovedì 11. Avevo letto male "
              "io, la data è sempre stata il 12."),
        ("a", "Corretto: la gita allo zoo di Anna è venerdì 12 maggio."),
        ("u", "Oggi tra l'altro sono in ufficio, è venerdì, e c'è un silenzio strano: mezzo team è in ferie per il "
              "ponte."),
        ("a", "Almeno lavori in pace."),
        ("u", "Vero. Stasera pizza con i bambini, Chiara ha il turno lungo in farmacia."),
        ("a", "Buona pizza!"),
    ]},
    {"id": "s49", "ts": "2034-05-07T12:00:00+02:00", "lang": "en", "messages": [
        ("u", "Fifth run this morning: 10 km! Goal reached, I did the long loop up to San Michele in Bosco."),
        ("a", "Congratulations, 10 km!"),
        ("u", "Now I'll just keep it up, one or two runs a week."),
        ("a", "Sounds like a good plan."),
    ]},
    {"id": "s50", "ts": "2034-05-09T13:00:00+02:00", "lang": "it", "messages": [
        ("u", "Anna ha fatto il richiamo stamattina, brava, neanche una lacrima. Chiara dice che stasera magari ha "
              "qualche linea di febbre."),
        ("a", "Brava Anna! Se sale la febbre, paracetamolo come l'altra volta in base al peso."),
        ("u", "Sì. Domani poi aspetto la lavatrice."),
        ("a", "In bocca al lupo con la consegna."),
    ]},
    {"id": "s51", "ts": "2034-05-11T20:00:00+02:00", "lang": "en", "messages": [
        ("u", "Third time in Milan this year, just back. Used my FitHub card at lunch, nice gym."),
        ("a", "Nice."),
        ("u", "Tomorrow evening Chiara is at her mother's in Modena, so I'm home with the kids: I'll probably skip the "
              "school reunion."),
        ("a", "Understood. Want me to tell Giulia?"),
        ("u", "No, I'll write to her myself."),
    ]},
    {"id": "s52", "ts": "2034-05-12T18:30:00+02:00", "lang": "it", "messages": [
        ("u", "Sono di nuovo alla lavanderia a gettoni, con due borsoni. Ho chiamato Euronics: dicono che la lavatrice "
              "ce la portano la settimana prossima, non sanno ancora il giorno."),
        ("a", "Che seccatura. Vuoi che ti ricordi di richiamarli lunedì se non si fanno vivi?"),
        ("u", "Sì, lunedì mattina."),
        ("a", "Fatto."),
    ]},
    {"id": "s53", "ts": "2034-05-13T10:00:00+02:00", "lang": "it", "messages": [
        ("u", "Ieri sera alla fine niente rimpatriata: Chiara era a Modena e io a casa con i bambini. Giulia mi ha "
              "mandato le foto, sembravano tutti invecchiati tranne lei."),
        ("a", "Peccato, magari alla prossima."),
        ("u", "Oggi Pietro gioca alle 15 contro il Granarolo, vado a vederlo."),
        ("a", "Buona partita!"),
    ]},
    {"id": "s54", "ts": "2034-05-15T19:30:00+02:00", "lang": "it", "messages": [
        ("u", "Oggi niente donazione: all'AVIS mi hanno trovato l'emoglobina un po' bassa e mi hanno rimandato a casa. "
              "Mi hanno dato del ferro, riprovo a fine mese."),
        ("a", "Peccato, ma meglio così. Quando vuoi riprovare?"),
        ("u", "Mercoledì 31 maggio, la mattina presto. Domani invece alle 8:30 porto la Panda da Bertolini per il "
              "tagliando, ricordamelo stasera alle 22 che devo svuotare il bagagliaio."),
        ("a", "Segnati: domani, martedì 16 maggio alle 8:30, tagliando della Panda all'officina Bertolini, con "
              "promemoria stasera alle 22; e mercoledì 31 maggio mattina nuovo tentativo all'AVIS."),
        ("u", "Grazie. Ah, Euronics ha richiamato: la lavatrice arriva venerdì."),
        ("a", "Bene, segno la consegna venerdì 19 maggio."),
    ]},
    {"id": "s55", "ts": "2034-05-18T22:00:00+02:00", "lang": "en", "messages": [
        ("u", "Finished 'The Quiet Harbour' tonight. Owen was right, the twist in the last chapter is brilliant."),
        ("a", "Want a similar recommendation?"),
        ("u", "Maybe later. I'm going to bed, early start tomorrow."),
        ("a", "Good night!"),
    ]},
    {"id": "s56", "ts": "2034-05-20T14:00:00+02:00", "lang": "it", "messages": [
        ("u", "Giornata di cambiamenti: la lavatrice nuova è arrivata ieri e va benissimo, silenziosissima."),
        ("a", "Finalmente! Addio lavanderia."),
        ("u", "E ho venduto la Punto a Simone del calcetto, 1.200 €. È venuto a prenderla stamattina dal posto auto, "
              "passaggio di proprietà fatto in agenzia."),
        ("a", "Segnato: la Punto è venduta a Simone."),
        ("u", "Stasera io e Chiara usciamo a cena: viene Giorgia a stare coi bambini, è tornata da Valencia per il "
              "weekend. Irina aveva un esame."),
        ("a", "Che bello rivederla. Buona serata!"),
    ]},
    {"id": "s57", "ts": "2034-05-22T21:00:00+02:00", "lang": "en", "messages": [
        ("u", "Dublin update: it slips again. The platform team isn't ready, so now it's Monday 12 to Wednesday 14 "
              "June. Flights already changed by our travel office."),
        ("a", "Updated: Dublin from Monday 12 to Wednesday 14 June."),
        ("u", "Chiara is not thrilled, it's the week of Pietro's end-of-season party. Nothing I can do."),
        ("a", "Maybe you can join by video for a few minutes."),
    ]},
    {"id": "s58", "ts": "2034-05-23T08:00:00+02:00", "lang": "it", "messages": [
        ("u", "Peso di stamattina: 82,5 kg."),
        ("a", "Ottimo, sei a 2,5 kg dall'obiettivo."),
        ("u", "Continuo così, senza fretta."),
        ("a", "Bella costanza."),
    ]},
    {"id": "s59", "ts": "2034-05-25T18:00:00+02:00", "lang": "it", "messages": [
        ("u", "SMS di Kena: dal 1° giugno l'offerta passa da 7,99 a 8,99 € al mese. Potrei recedere gratis, ma per un "
              "euro non cambio di nuovo operatore, resto."),
        ("a", "Segnato: resti con Kena, 8,99 € al mese dal 1° giugno."),
        ("u", "Stasera cucino io, pensavo a un risotto agli asparagi."),
        ("a", "Ottima idea per la stagione."),
    ]},
    {"id": "s60", "ts": "2034-05-29T12:00:00+02:00", "lang": "it", "messages": [
        ("u", "Lunedì da casa, pausa pranzo veloce. Mi dai un'idea per una cena per otto sabato sera? Vengono Elisa e "
              "suo marito Nicola con i bambini."),
        ("a", "Una teglia di lasagne al pesto, roast beef freddo con patate al forno e per dolce una crostata di "
              "frutta: si prepara quasi tutto il venerdì sera."),
        ("u", "Mi piace. Il roast beef lo prendo dal macellaio di via San Felice."),
        ("a", "Ordinalo qualche giorno prima."),
    ]},
    {"id": "s61", "ts": "2034-05-31T10:30:00+02:00", "lang": "it", "messages": [
        ("u", "Fatto, oggi all'AVIS mi hanno fatto donare: emoglobina tornata a posto col ferro."),
        ("a", "Benissimo!"),
        ("u", "Ora caffè e cornetto offerti e poi in ufficio."),
        ("a", "Meritati."),
    ]},
    {"id": "s62", "ts": "2034-06-02T11:00:00+02:00", "lang": "it", "messages": [
        ("u", "Festa della Repubblica, tutti a casa. Andiamo a fare un picnic ai Prati di Mugnano coi bambini. Cosa "
              "porto?"),
        ("a", "Telo, acqua in abbondanza, panini o piadine, frutta già tagliata, crema solare, un pallone per Pietro e "
              "qualcosa per Anna, sacchetti per i rifiuti."),
        ("u", "Il pallone Pietro non lo dimentica neanche se volesse."),
        ("a", "Buon picnic!"),
    ]},
]
