# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Sessions of blind set #10 — entity memory: the reception assistant of Camping Il Ginepro, a small family-run
campsite on Lake Trasimeno (Castiglione del Lago), pre-season and Easter 2034. Fictional people, business and rules.

Every conversation is separate and starts with nobody identified. Message tuples: ("u", text) = whoever is talking
to the assistant, ("a", text) = the assistant, ("o", text) = content handed to the assistant to keep as its own
(written with `own: true`, role user). `speakers` (README / check.py only, not written to conversations.json) lists
who speaks, in order; None = a speaker who never identifies; a hand-over inside a session shows as two entries.
Learned sources (`SOURCES`) are written as `type: "source"` entries, merged with the conversations by `ts`.

Europe/Rome: +01:00 up to Sat 25 Mar 2034, +02:00 from Sun 26 Mar 2034 (DST starts at 02:00 that day).
"""

SESSIONS = [
    # ── March: pre-season ───────────────────────────────────────────────────────
    {"id": "s01", "ts": "2034-03-13T10:00:00+01:00", "speakers": ["Ottavio"], "messages": [
        ("u", "Buongiorno, sono Ottavio Rondelli, il titolare del Camping Il Ginepro, a Castiglione del Lago, sul Trasimeno. Da oggi ti usiamo in reception, quindi ti presento la squadra: mia moglie Benedetta segue le prenotazioni e i conti, mia figlia Chiara gestisce il bar e il check-in in stagione, mio genero Nico fa la manutenzione. Da aprile arriva anche Samira, la stagionale delle pulizie."),
        ("a", "Buongiorno Ottavio, piacere. Mi segno la squadra: Benedetta (prenotazioni e conti), Chiara (bar e check-in), Nico (manutenzione), Samira stagionale alle pulizie da aprile. Cosa mi dice del campeggio?"),
        ("u", "Abbiamo 40 piazzole numerate da 1 a 40, di cui le stagionali sono la 1, la 2 e la 3, sei bungalow da B1 a B6 — B1, B2 e B3 sono da due posti, B4, B5 e B6 da quattro — bar con tabaccheria, piscina e la spiaggetta sul lago. La stagione apre venerdì 7 aprile, il Venerdì Santo, e chiude a fine ottobre."),
        ("a", "Segnato: 40 piazzole (1, 2 e 3 stagionali), bungalow B1–B3 da due posti e B4–B6 da quattro, bar con tabaccheria, piscina, spiaggia; apertura venerdì 7 aprile 2034, chiusura a fine ottobre."),
        ("o", "Orari di apertura 2034 (dal giorno di apertura): reception 8:00–13:00 e 15:00–20:00 tutti i giorni; bar 7:30–23:00; piscina 10:00–19:00 dal 1° giugno al 10 settembre. Regola della casa: silenzio dalle 23:00 alle 7:30, niente auto in movimento dentro il campeggio in quelle ore."),
        ("a", "Li tengo come i miei orari e il mio regolamento: reception 8–13 e 15–20, bar 7:30–23, piscina 10–19 dal 1° giugno al 10 settembre; silenzio dalle 23:00 alle 7:30 senza auto in movimento."),
        ("u", "Bene. E ricordami lunedì 20 marzo alle 8 di chiamare il fornitore del GPL per il pieno dei serbatoi prima dell'apertura."),
        ("a", "Promemoria impostato: lunedì 20 marzo alle 8:00, chiamare il fornitore del GPL per il pieno dei serbatoi."),
    ]},
    {"id": "s02", "ts": "2034-03-14T16:30:00+01:00", "speakers": ["Benedetta"], "messages": [
        ("u", "Ciao, sono Benedetta, la moglie di Ottavio. Ti do il listino 2034: tienilo tu come listino ufficiale."),
        ("a", "Ciao Benedetta. Dimmi pure, lo registro come il mio listino."),
        ("o", "LISTINO 2034. Bassa stagione: dall'apertura al 31 maggio e dall'11 settembre alla chiusura, esclusa la settimana di Pasqua. Alta stagione: settimana di Pasqua (dal 7 all'11 aprile) e dal 1° giugno al 10 settembre. Prezzi a notte, bassa / alta: piazzola (tenda, roulotte o camper, elettricità inclusa) 14 / 19 €; adulto 8 / 10 €; bambino 4–12 anni 5 / 6 €, sotto i 4 anni gratis; cane 3 €; bungalow 2 posti (B1–B3) 65 / 85 €; bungalow 4 posti (B4–B6) 85 / 110 €. Biancheria da letto inclusa nei bungalow, asciugamani 5 € a set. Tassa di soggiorno 1 € ad adulto a notte, massimo 5 notti."),
        ("a", "Listino 2034 registrato come mio listino: piazzola 14/19, adulto 8/10, bambino 4–12 anni 5/6, cane 3, bungalow 2 posti 65/85, bungalow 4 posti 85/110, asciugamani 5 € a set, tassa di soggiorno 1 € ad adulto a notte per massimo 5 notti; alta stagione nella settimana di Pasqua (7–11 aprile) e dal 1° giugno al 10 settembre."),
        ("u", "Ora una prenotazione: famiglia Brandt di Friburgo, due adulti e due bambini, bungalow B4 da venerdì 7 a mercoledì 12 aprile, cinque notti. Hanno già versato una caparra di 150 euro con bonifico, arrivato ieri."),
        ("a", "Prenotato: bungalow B4 per la famiglia Brandt (Friburgo, 2 adulti + 2 bambini) da venerdì 7 a mercoledì 12 aprile 2034, 5 notti; caparra di 150 € ricevuta con bonifico lunedì 13 marzo."),
        ("u", "E metti il B6 come non prenotabile fino al 15 aprile: c'è un'infiltrazione dal tetto, Nico deve sistemarla."),
        ("a", "Fatto: B6 bloccato, non prenotabile fino al 15 aprile per l'infiltrazione dal tetto."),
    ]},
    {"id": "s03", "ts": "2034-03-16T11:00:00+01:00", "speakers": ["Nico"], "messages": [
        ("u", "Ciao, sono Nico, il genero di Ottavio, manutenzione. Ti passo il manuale degli scaldabagni dei bungalow, i Thermolux AQ-80, così quando uno segna un errore sai cosa dire a chi è in reception. Te lo allego adesso."),
        ("a", "Ciao Nico, perfetto: lo imparo appena arriva e lo terrò come il manuale degli scaldabagni Thermolux AQ-80 dei bungalow."),
        ("u", "Poi segna che oggi ho sostituito l'anodo dello scaldabagno del B4, era consumato."),
        ("a", "Segnato: giovedì 16 marzo hai sostituito l'anodo dello scaldabagno del B4."),
        ("u", "E ho un lavoro grosso: ridipingere la recinzione della piscina. Conto di finirla entro venerdì 31 marzo."),
        ("a", "Segnato il piano: recinzione della piscina ridipinta entro venerdì 31 marzo."),
    ]},
    # unidentified, right after Nico (carry-over trap)
    {"id": "s04", "ts": "2034-03-16T17:45:00+01:00", "speakers": [None], "messages": [
        ("u", "Buonasera, volevo sapere se avete posto a Pasqua per una tenda, due adulti e una bambina di sette anni, e abbiamo un cane, Birillo, un meticcio tranquillo. Da venerdì 7 a lunedì 10 aprile."),
        ("a", "Buonasera. Per la settimana di Pasqua, dal mio listino: piazzola 19 € a notte, adulti 10 € ciascuno, bambina 6 €, cane 3 €, cioè 48 € a notte più la tassa di soggiorno di 1 € ad adulto a notte. Posso chiederle con chi parlo, per segnare la richiesta?"),
        ("u", "Preferisco non lasciare il nome adesso, prima devo sentire mio marito. Vi richiamo."),
        ("a", "Va bene, allora non blocco nessuna piazzola: per prenotare mi servirà un nome. Resto a disposizione."),
        ("u", "Grazie. Ah, Birillo può venire in spiaggia?"),
        ("a", "Per la spiaggia del lago non ho ancora il regolamento, chieda pure in reception quando richiama. Dentro il campeggio i cani sono ammessi, 3 € a notte."),
    ]},
    {"id": "s05", "ts": "2034-03-20T08:15:00+01:00", "speakers": ["Ottavio"], "messages": [
        ("u", "Buongiorno, sono Ottavio. Ho visto il promemoria del GPL: ho appena chiamato, il pieno lo fanno giovedì 23 marzo in mattinata. Segnalo come fatto."),
        ("a", "Buongiorno Ottavio. Promemoria chiuso: fornitore del GPL chiamato, consegna prevista giovedì 23 marzo in mattinata."),
        ("u", "Poi passa un messaggio a Chiara: il tecnico della macchina del caffè viene giovedì 23 marzo alle 10, deve esserci lei al bar."),
        ("a", "Messaggio per Chiara registrato: il tecnico della macchina del caffè viene giovedì 23 marzo alle 10:00 e deve esserci lei al bar. Glielo riferisco appena si presenta."),
        ("u", "E conferma che Samira inizia lunedì 3 aprile, contratto fino al 30 settembre."),
        ("a", "Segnato: Samira inizia lunedì 3 aprile 2034 con contratto fino al 30 settembre."),
    ]},
    {"id": "s06", "ts": "2034-03-21T18:00:00+01:00", "speakers": ["Fiona"], "messages": [
        ("u", "Hello! I'm Fiona Hadley, from Leeds. We'd like to book a pitch for our campervan from Friday 14 April to Tuesday 18 April, that's four nights, two adults and our dog Pip."),
        ("a", "Hello Fiona. Pitch 17 is free for those dates: I've booked it for you from Friday 14 April to Tuesday 18 April 2034, four nights, two adults and Pip. That's low season, after Easter week: pitch 14 €, adults 8 € each, dog 3 €, so 33 € a night plus tourist tax of 1 € per adult per night."),
        ("u", "Lovely. Do we need to pay a deposit?"),
        ("a", "No deposit for a pitch; you pay at check-out. I've noted no advance payment."),
        ("u", "One more thing: my husband Rob is coeliac, so if your bar does breakfast we'd need gluten-free bread."),
        ("a", "Noted: Rob is coeliac. I'll flag the gluten-free request for the bar, though I can't promise it yet."),
    ]},
    {"id": "s07", "ts": "2034-03-23T14:00:00+01:00", "speakers": ["Benedetta"], "messages": [
        ("u", "Ciao, sono Benedetta. Ti carico il contratto con il Panificio Sabatini per il pane e i cornetti della stagione: imparalo, così sai giorni e orari di consegna quando qualcuno chiede."),
        ("a", "Ciao Benedetta, va bene: appena arriva lo imparo come il mio contratto di fornitura del pane 2034."),
        ("u", "Poi segna che stamattina è venuto il tecnico della macchina del caffè come previsto, ha cambiato la guarnizione della caldaia e la macchina va. 180 euro, pagati con bonifico."),
        ("a", "Segnato: giovedì 23 marzo il tecnico ha riparato la macchina del caffè (guarnizione della caldaia), 180 € pagati con bonifico. Il piano del tecnico è concluso."),
        ("u", "E il GPL? Lo hanno portato?"),
        ("a", "Ottavio mi aveva detto che il pieno era previsto per stamattina; non ho ancora conferma che sia stato fatto."),
        ("u", "Sì, è arrivato alle 9, segnalo pure."),
        ("a", "Segnato: pieno di GPL consegnato giovedì 23 marzo alle 9."),
    ]},
    {"id": "s08", "ts": "2034-03-25T10:00:00+01:00", "speakers": ["Marta Venturi"], "messages": [
        ("u", "Buongiorno, sono Marta Venturi, quella della roulotte sulla stagionale 3. Volevo dirvi che vengo ad aprire la roulotte sabato 1° aprile, prima dell'apertura, come ogni anno."),
        ("a", "Buongiorno Marta. Segnato: arrivo sabato 1° aprile per aprire la roulotte sulla piazzola stagionale 3."),
        ("u", "Ho fatto ieri il bonifico della prima rata della stagionale, 400 euro su 1.800."),
        ("a", "Segnato: prima rata della stagionale 2034, 400 € con bonifico di venerdì 24 marzo, su un totale di 1.800 €."),
        ("u", "E dite a Nico di dare un'occhiata alla veranda della roulotte prima che arrivi, l'inverno scorso si era strappata."),
        ("a", "Messaggio per Nico registrato: controllare la veranda della roulotte sulla stagionale 3 prima di sabato 1° aprile."),
    ]},
    # DST starts this morning: +02:00 from here
    {"id": "s09", "ts": "2034-03-26T10:00:00+02:00", "speakers": ["Marta Olivetti"], "messages": [
        ("u", "Buongiorno, sono Marta Olivetti, chiamo da Arezzo. Vorrei un bungalow per due persone per Pasqua, da sabato 8 a lunedì 10 aprile."),
        ("a", "Buongiorno Marta. Il B2, bungalow da due posti, è libero: prenotato da sabato 8 a lunedì 10 aprile 2034, due notti, due adulti. In settimana di Pasqua il B2 costa 85 € a notte più 1 € a notte di tassa di soggiorno per adulto."),
        ("u", "Perfetto. Posso pagare una caparra con carta?"),
        ("a", "Sì, le mando il link di pagamento: caparra di 100 €."),
        ("u", "Fatto, pagata adesso. Una cosa: sono intollerante al lattosio, se al bar fate colazione ditemelo per il latte."),
        ("a", "Caparra di 100 € ricevuta con carta oggi, domenica 26 marzo. Segnato: Marta Olivetti è intollerante al lattosio, lo segnalo al bar."),
    ]},
    # German, hand-over Katrin → Jonas
    {"id": "s10", "ts": "2034-03-27T17:00:00+02:00", "speakers": ["Katrin", "Jonas"], "messages": [
        ("u", "Guten Tag, hier ist Katrin Brandt aus Freiburg. Wir haben den Bungalow B4 vom 7. bis 12. April gebucht. Ist Bettwäsche inklusive?"),
        ("a", "Guten Tag, Frau Brandt. Ja: laut meiner Preisliste ist Bettwäsche im Bungalow inklusive, Handtücher kosten 5 € pro Set. Ihre Buchung B4 von Freitag, 7. April bis Mittwoch, 12. April mit 150 € Anzahlung ist bestätigt."),
        ("u", "Gut. Bitte notieren Sie: unser Sohn Till, 9 Jahre, hat eine Nussallergie. Und wir kommen mit zwei Autos, wir brauchen also einen zweiten Parkplatz."),
        ("a", "Notiert: Till (9) hat eine Nussallergie, das gebe ich an die Bar weiter. Ein zweiter Stellplatz ist reserviert, auf dem Parkplatz P2 am Eingang."),
        ("u", "Danke. Ich gebe an meinen Mann weiter."),
        ("u", "Hallo, ich bin Jonas Brandt. Wir kommen am Freitag erst gegen 21:30 an, die Rezeption schließt ja um 20 Uhr. Geht das?"),
        ("a", "Hallo Herr Brandt. Ja: ich habe die späte Ankunft am Freitag, 7. April gegen 21:30 notiert. Der Schlüssel liegt im Schlüsselkasten neben der Rezeption, den Code schicke ich Ihnen am Ankunftstag."),
        ("u", "Super. Kann man bei euch Fahrräder leihen?"),
        ("a", "Nein, Fahrradverleih steht nicht auf meiner Preisliste; in Castiglione del Lago gibt es aber Verleihe. Soll ich sonst noch etwas notieren?"),
        ("u", "Nein, danke, bis Freitag."),
    ]},
    {"id": "s11", "ts": "2034-03-29T11:30:00+02:00", "speakers": ["Chiara"], "messages": [
        ("u", "Ciao, sono Chiara, dal bar. Grazie del messaggio sul tecnico, c'ero. Ti do la procedura di check-in: tienila come la tua procedura."),
        ("a", "Ciao Chiara. Dimmi, la registro come la mia procedura di check-in."),
        ("o", "PROCEDURA CHECK-IN: 1) documento d'identità di ogni ospite, anche i bambini; 2) registrazione degli alloggiati entro 24 ore dall'arrivo; 3) braccialetto colorato a ogni ospite (verde piazzole, blu bungalow); 4) consegna di mappa e regolamento; 5) per i bungalow cauzione di 50 € in contanti, restituita al check-out dopo il controllo; 6) tessera del cancello carraio, una per equipaggio, 10 € di cauzione; 7) il saldo si paga al check-out, con carta o contanti."),
        ("a", "Procedura di check-in registrata come mia: documenti di tutti, alloggiati entro 24 ore, braccialetti verde/blu, mappa e regolamento, cauzione bungalow 50 € in contanti, tessera del cancello con 10 € di cauzione, saldo al check-out."),
        ("u", "Poi ha chiamato Marta, vuole aggiungere una notte."),
        ("a", "Quale Marta? Marta Venturi della stagionale 3 o Marta Olivetti del B2?"),
        ("u", "La Olivetti, quella del bungalow. Resta fino a martedì 11 aprile invece di lunedì 10."),
        ("a", "Fatto: prenotazione di Marta Olivetti nel B2 estesa da sabato 8 a martedì 11 aprile, tre notti."),
        ("u", "Ultima cosa: venerdì 7 aprile alle 18:30 facciamo l'aperitivo di apertura al bar, segnalo."),
        ("a", "Segnato: aperitivo di apertura al bar venerdì 7 aprile alle 18:30."),
    ]},
    # unidentified, right after Chiara (carry-over trap)
    {"id": "s12", "ts": "2034-03-30T20:30:00+02:00", "speakers": [None], "messages": [
        ("u", "Senti, il cancello lato lago non chiude bene, ho messo il lucchetto nostro, quello con la chiave rossa. La chiave è nel cassetto della reception."),
        ("a", "Segnato: cancello lato lago difettoso, chiuso con il lucchetto a chiave rossa, chiave nel cassetto della reception. Con chi parlo?"),
        ("u", "Lascia stare chi sono. Domani mattina porto io il trattorino dal meccanico, torna la settimana prossima."),
        ("a", "Va bene, lo segno senza nome: domani, venerdì 31 marzo, il trattorino va dal meccanico e torna la settimana prossima."),
    ]},
    # hand-over Nico → Ottavio, with a correction of Nico's statement
    {"id": "s13", "ts": "2034-03-31T12:00:00+02:00", "speakers": ["Nico", "Ottavio"], "messages": [
        ("u", "Ciao, sono Nico. La recinzione della piscina non la finisco oggi, mi manca la seconda mano su due lati: la chiudo martedì 4 aprile."),
        ("a", "Segnato: recinzione della piscina spostata da oggi, venerdì 31 marzo, a martedì 4 aprile."),
        ("u", "Poi ho controllato la veranda della roulotte della Venturi, è a posto, tiene."),
        ("a", "Grazie: veranda della stagionale 3 controllata, in ordine. Lo riferisco a Marta Venturi."),
        ("u", "Ti passo Ottavio che vuole dirti una cosa."),
        ("u", "Sono Ottavio. Nico, l'anodo che hai cambiato il 16 era quello del B3, non del B4: nel B4 ci ho guardato io ieri ed è ancora quello vecchio."),
        ("u", "Hai ragione, era il B3, mi ero confuso con il numero. Correggi pure."),
        ("a", "Corretto: l'anodo sostituito giovedì 16 marzo è quello dello scaldabagno del B3; il B4 ha ancora l'anodo vecchio."),
    ]},
    # ── April: opening ──────────────────────────────────────────────────────────
    {"id": "s14", "ts": "2034-04-01T15:00:00+02:00", "speakers": ["Marta Venturi"], "messages": [
        ("u", "Buongiorno, sono Marta Venturi, sono arrivata e ho aperto la roulotte. La veranda è a posto, Nico l'aveva controllata, grazie."),
        ("a", "Bentornata Marta. Segnato: arrivata sabato 1° aprile, roulotte aperta, veranda in ordine."),
        ("u", "Due cose. Primo: ho ricontrollato il bonifico della prima rata, erano 450 euro, non 400 come ti avevo detto."),
        ("a", "Corretto: prima rata della stagionale 2034 di 450 € con bonifico di venerdì 24 marzo, non 400."),
        ("u", "Secondo: sulla piazzola 3 l'acqua esce con pochissima pressione. Dillo a Nico."),
        ("a", "Messaggio per Nico registrato: bassa pressione dell'acqua sulla piazzola stagionale 3."),
        ("u", "E resto fino a fine ottobre come sempre, con la seconda rata a giugno e la terza a settembre."),
        ("a", "Segnato: stagionale fino a fine ottobre, seconda rata a giugno, terza a settembre."),
    ]},
    {"id": "s15", "ts": "2034-04-03T09:00:00+02:00", "speakers": ["Benedetta"], "messages": [
        ("u", "Ciao, sono Benedetta. Abbiamo ritoccato il listino: questo sostituisce quello del 14 marzo dall'apertura di venerdì 7 aprile."),
        ("a", "Ciao Benedetta. Dimmi le voci nuove: aggiorno il mio listino."),
        ("o", "LISTINO 2034 AGGIORNATO (valido dal 7 aprile): cane 4 € a notte (prima 3); adulto in alta stagione 11 € (prima 10), in bassa resta 8; bungalow 4 posti in alta stagione 115 € (prima 110), in bassa resta 85. Tutto il resto come nel listino del 14 marzo: piazzola 14/19, bambino 4–12 anni 5/6, bungalow 2 posti 65/85, asciugamani 5 € a set, tassa di soggiorno 1 € ad adulto a notte per massimo 5 notti."),
        ("a", "Listino aggiornato e sostituito: cane 4 €, adulto 8/11, bungalow 4 posti 85/115; il resto invariato. Il listino del 14 marzo non vale più dal 7 aprile."),
        ("u", "Ai Brandt, che hanno prenotato prima del ritocco, teniamo il prezzo confermato di 110 a notte."),
        ("a", "Segnato: per la famiglia Brandt resta il prezzo confermato di 110 € a notte."),
        ("u", "Il B6 è sistemato, Nico ha rifatto la guaina sabato: rimettilo prenotabile da subito."),
        ("a", "Fatto: blocco del B6 tolto, da oggi lunedì 3 aprile è di nuovo prenotabile."),
        ("u", "E Samira ha iniziato stamattina come previsto."),
        ("a", "Segnato: Samira ha iniziato lunedì 3 aprile."),
    ]},
    {"id": "s16", "ts": "2034-04-05T18:30:00+02:00", "speakers": ["Priya"], "messages": [
        ("u", "Hi, I'm Priya Shah, I'm cycling around Umbria. Could I have a tent pitch for one night, Saturday 8 April to Sunday 9 April? Just me."),
        ("a", "Hi Priya. Yes: pitch 24 is booked for you, Saturday 8 April to Sunday 9 April 2034, one night, one adult. It's Easter week, so high season: pitch 19 € plus adult 11 €, 30 € plus 1 € tourist tax, 31 € in all, payable on arrival."),
        ("u", "Great. I'm vegan — does the bar do any vegan breakfast?"),
        ("a", "Noted that you're vegan. The bar's bread and torta al testo come from the local bakery; I'll pass the request to the bar, I can't promise a vegan option yet."),
        ("u", "No worries. Can I swim in the lake in April?"),
        ("a", "From the lake rules I have: swimming is allowed only in the zones marked with yellow buoys, and the lifeguard service runs from 1 June to 15 September, 10 to 18. In April there is no lifeguard, so swim at your own risk and never under a red flag."),
    ]},
    # German: Jonas arrives late on opening day
    {"id": "s17", "ts": "2034-04-07T21:40:00+02:00", "speakers": ["Jonas"], "messages": [
        ("u", "Hallo, Jonas Brandt hier, wir sind gerade angekommen. Den Code für den Schlüsselkasten haben wir bekommen, der Schlüssel war da. Danke!"),
        ("a", "Willkommen, Herr Brandt. Ich notiere die Ankunft: Freitag, 7. April um 21:40, Bungalow B4, Familie Brandt. Bitte morgen früh in der Rezeption die Ausweise vorzeigen und die Kaution von 50 € in bar hinterlegen."),
        ("u", "Machen wir. Das zweite Auto steht auf P2, wie besprochen. Und wie heißt das WLAN?"),
        ("a", "Das WLAN heißt Ginepro-Ospiti, das Passwort steht auf der Karte im Bungalow. Zweites Auto auf P2 ist notiert."),
        ("u", "Noch etwas: der Boiler im Bad zeigt E5 an. Ist das ein Problem?"),
        ("a", "Nein: laut dem Handbuch des Thermolux AQ-80 ist E5 der automatische Anti-Legionellen-Zyklus, kein Fehler; er dauert etwa zwei Stunden."),
        ("u", "Gut zu wissen, danke. Gute Nacht."),
    ]},
    {"id": "s18", "ts": "2034-04-08T11:00:00+02:00", "speakers": ["Chiara"], "messages": [
        ("u", "Ciao, sono Chiara. Aggiornamento del primo weekend: i Brandt hanno fatto i documenti e lasciato la cauzione di 50 € stamattina. Marta Olivetti è arrivata adesso nel B2, cauzione lasciata, e Priya, la ciclista, è sulla 24 e ha già pagato le sue 31 € con carta."),
        ("a", "Segnato: Brandt registrati con cauzione di 50 €; Marta Olivetti nel B2 da oggi sabato 8 aprile fino a lunedì 10, cauzione lasciata; Priya sulla piazzola 24, 31 € pagati con carta."),
        ("u", "No, la Olivetti sta fino a martedì 11, non lunedì 10: te l'ho detto io mercoledì 29 marzo che ha aggiunto una notte."),
        ("a", "Hai ragione, scusa: Marta Olivetti nel B2 da sabato 8 a martedì 11 aprile, tre notti. Corretto."),
        ("u", "Poi il panificio stamattina non ha portato i cornetti, solo il pane. Che si fa secondo il contratto?"),
        ("a", "Secondo il contratto con il Panificio Sabatini i prodotti mancanti o non conformi segnalati entro le 10:00 vengono accreditati; una mancata consegna completa dà uno sconto del 20 % sulla fattura del giorno. Segno l'accredito dei cornetti di oggi."),
        ("u", "Ok. L'aperitivo di ieri è saltato, pioveva a dirotto, non lo recuperiamo."),
        ("a", "Segnato: aperitivo di apertura di venerdì 7 aprile cancellato per la pioggia, non recuperato."),
        ("u", "Ricordami lunedì 10 alle 17 di preparare la griglia per la Pasquetta."),
        ("a", "Promemoria impostato: lunedì 10 aprile alle 17:00, preparare la griglia per la Pasquetta."),
    ]},
    # unidentified English-speaking guest, right after Chiara (carry-over trap)
    {"id": "s19", "ts": "2034-04-10T09:30:00+02:00", "speakers": [None], "messages": [
        ("u", "Hi, sorry — the showers in toilet block B only have cold water this morning. And I left a blue towel on the chair by the bar last night, if anyone finds it."),
        ("a", "Thanks for telling me, I'll report the cold water in block B to maintenance and keep an eye out for a blue towel. Who should I say reported it, and which pitch are you on?"),
        ("u", "Doesn't matter, I'm leaving today anyway."),
        ("a", "All right, noted without a name: cold water in block B this morning, and a blue towel left by the bar."),
    ]},
    {"id": "s20", "ts": "2034-04-12T10:15:00+02:00", "speakers": ["Benedetta"], "messages": [
        ("u", "Ciao, sono Benedetta. I Brandt sono partiti stamattina: saldo 410 euro con carta, cinque notti a 110 più dieci di tassa di soggiorno meno la caparra; cauzione restituita."),
        ("a", "Segnato: check-out della famiglia Brandt mercoledì 12 aprile, saldo 410 € con carta (5 notti × 110 € + 10 € di tassa − 150 € di caparra), cauzione di 50 € restituita."),
        ("u", "Marta ha pagato ieri il saldo e ha riavuto la cauzione."),
        ("a", "Quale Marta, Olivetti o Venturi?"),
        ("u", "La Olivetti: 161 euro con carta, tre notti a 85 più sei di tassa meno i 100 di caparra. La Venturi non deve niente fino alla rata di giugno."),
        ("a", "Segnato: check-out di Marta Olivetti martedì 11 aprile, saldo 161 € con carta, cauzione restituita. Marta Venturi è in regola fino alla seconda rata di giugno."),
        ("u", "Poi Fiona Hadley ha scritto una mail: arrivano sabato 15 invece di venerdì 14, partenza sempre martedì 18. Aggiorna la piazzola 17."),
        ("a", "Aggiornato: piazzola 17 per gli Hadley da sabato 15 a martedì 18 aprile, tre notti invece di quattro."),
    ]},
    {"id": "s21", "ts": "2034-04-13T19:00:00+02:00", "speakers": ["Wouter"], "messages": [
        ("u", "Good evening, I'm Wouter de Vries, from Utrecht. I'd like a pitch for a small tent, Friday 28 April to Sunday 30 April, two nights, one adult. I'll arrive by bike."),
        ("a", "Good evening Wouter. Pitch 9 is booked for you from Friday 28 April to Sunday 30 April 2034, two nights, one adult: low season, pitch 14 € plus adult 8 €, 22 € a night plus 1 € tourist tax per night, 46 € in all, payable at check-out."),
        ("u", "Perfect. Do I need to pay anything now?"),
        ("a", "No, nothing in advance for a pitch."),
        ("u", "And can I fish in the lake? I have a Dutch licence."),
        ("a", "From the lake rules I have: fishing needs an Italian type B licence plus the provincial permit, and it is closed from 1 to 31 May for the spawning season; late April is open. Your Dutch licence alone won't be enough — ask the tourist office in town."),
    ]},
    # English, hand-over Fiona → Rob
    {"id": "s22", "ts": "2034-04-15T17:30:00+02:00", "speakers": ["Fiona", "Rob"], "messages": [
        ("u", "Hi, it's Fiona Hadley, we've just arrived on pitch 17. Lovely spot."),
        ("a", "Welcome, Fiona! Check-in noted: Saturday 15 April, pitch 17, two adults and Pip, until Tuesday 18 April. Please show your passports at reception and collect your gate card, 10 € deposit."),
        ("u", "Will do. I'll hand you to Rob, he has questions about food."),
        ("u", "Hi, I'm Rob. Does the bar have gluten-free bread for breakfast? I'm the coeliac one."),
        ("a", "Hi Rob. The bakery's contract has no gluten-free products in its list; packaged rice bread can be ordered three days in advance. So not tomorrow, but I can ask the bar to order it for Tuesday if you like."),
        ("u", "Not worth it for one morning, thanks. Can Pip go on the lake beach?"),
        ("a", "Per the lake rules, yes, but only on the stretch of beach set aside for dogs, on a lead; Pip can't swim where people bathe."),
        ("u", "Good to know. One last thing: remind us on Monday 17 April at 9 to settle up at reception, we leave early Tuesday."),
        ("a", "Reminder set: Monday 17 April at 9:00, settle the bill at reception. Three nights at 34 € — pitch 14, two adults 16, Pip 4 — plus 6 € tourist tax: 108 € in all."),
    ]},
    {"id": "s23", "ts": "2034-04-18T09:00:00+02:00", "speakers": ["Ottavio"], "messages": [
        ("u", "Buongiorno, sono Ottavio. Gli Hadley sono partiti alle 8, hanno pagato 108 euro in contanti e riconsegnato la tessera del cancello."),
        ("a", "Segnato: check-out degli Hadley martedì 18 aprile, 108 € in contanti, tessera del cancello restituita."),
        ("u", "Nico ha finito la recinzione della piscina martedì 4 aprile come aveva detto, puoi chiudere quel piano."),
        ("a", "Chiuso: recinzione della piscina ridipinta, finita martedì 4 aprile."),
        ("u", "Giovedì 20 aprile alle 10 viene l'ispezione dell'ASL per la piscina, prima dell'apertura della vasca. Segnalo e tieni pronta la scheda di autocontrollo che ti ho dato."),
        ("a", "Segnato: ispezione ASL della piscina giovedì 20 aprile alle 10:00; ho la scheda di autocontrollo della piscina che mi hai dato giovedì 13 aprile."),
        ("o", "Nuova regola della casa dal 18 aprile: il cancello carraio chiude alle 23:00 e riapre alle 7:00; dopo le 23 si entra solo a piedi dal cancelletto pedonale con il codice. E la reception al pomeriggio apre alle 16:00 invece che alle 15:00, fino alle 20:00 come prima."),
        ("a", "Aggiornati il mio regolamento e i miei orari: cancello carraio chiuso 23:00–7:00, dopo le 23 ingresso pedonale con il codice; reception 8:00–13:00 e 16:00–20:00 dal 18 aprile."),
    ]},
]

SOURCES = [
    {"type": "source", "id": "k-caldaia", "ts": "2034-03-16T11:20:00+01:00", "kind": "document",
     "provided_by": "Nico", "conversation": "s03", "author": "Thermolux (fictional manufacturer)",
     "title": "Thermolux AQ-80 — manuale d'uso e manutenzione (scaldabagno elettrico 80 L)",
     "text": """# Thermolux AQ-80 — manuale d'uso e manutenzione

## Dati tecnici
Scaldabagno elettrico ad accumulo da 80 litri, resistenza 1500 W, termostato regolabile da 30 a 75 °C.
Temperatura consigliata: 55 °C (modalità eco). Funzione anti-legionella automatica: una volta a settimana
l'acqua viene portata a 65 °C per circa due ore.

## Codici di errore sul display
- E1: riscaldamento a secco o assenza d'acqua. Spegnere, riempire il serbatoio, riaccendere.
- E2: sovratemperatura. Attendere il raffreddamento; se ricompare, far verificare il termostato.
- E3: guasto del sensore del termostato. Tenere premuto il tasto RESET per 5 secondi; se l'errore ricompare
  entro 24 ore, chiamare l'assistenza tecnica.
- E5: ciclo anti-legionella in corso. Non è un guasto: dura circa due ore, poi il display torna normale.

## Manutenzione
- Anodo di magnesio: controllo ogni 12 mesi; sostituzione quando è consumato oltre il 50 %.
- Decalcificazione del serbatoio: ogni 24 mesi; ogni 12 mesi con acqua dura.
- Valvola di sicurezza: prova trimestrale sollevando la leva fino a far uscire un po' d'acqua.
- Svuotamento invernale: chiudere l'ingresso dell'acqua, aprire un rubinetto dell'acqua calda, aprire il
  rubinetto di scarico alla base. Non riaccendere mai l'apparecchio con il serbatoio vuoto.

## Garanzia
5 anni sul serbatoio, 2 anni sulle parti elettriche. La garanzia decade se l'anodo non viene controllato.
"""},
    {"type": "source", "id": "k-pane", "ts": "2034-03-23T14:30:00+01:00", "kind": "document",
     "provided_by": "Benedetta", "conversation": "s07",
     "title": "Contratto di fornitura pane e prodotti da forno 2034 — Panificio Sabatini / Camping Il Ginepro",
     "text": """# Contratto di fornitura 2034 — Panificio Sabatini

Fornitore: Panificio Sabatini, Castiglione del Lago. Cliente: Camping Il Ginepro.
Durata: dal 7 aprile al 30 settembre 2034.

## Consegne
Tutti i giorni tranne il lunedì, entro le 7:15, al bar del campeggio. Nei giorni festivi infrasettimanali,
compreso lunedì 10 aprile (Pasquetta), la consegna è garantita con l'orario della domenica (entro le 7:45).

## Prezzi
- Pane casereccio: 3,60 €/kg
- Filoncini: 0,60 € l'uno
- Cornetti vuoti: 0,95 € l'uno; farciti: 1,10 €
- Torta al testo: 2,80 € a pezzo
- Pizza al taglio: 9,50 €/kg
Ordine minimo: 20 € al giorno. Le variazioni all'ordine si comunicano via WhatsApp entro le 18:00 del giorno
precedente.

## Resi, mancate consegne, pagamenti
Prodotti mancanti o non conformi segnalati entro le 10:00 del giorno stesso vengono accreditati nella fattura
successiva. Mancata consegna completa: sconto del 20 % sulla fattura del giorno. Fatturazione quindicinale,
pagamento a 30 giorni con bonifico. Recesso con 15 giorni di preavviso scritto da entrambe le parti.

## Prodotti speciali
Nessun prodotto senza glutine a listino. Su richiesta, con 3 giorni di anticipo, pane di riso confezionato
(certificato senza glutine) a 4,20 € a confezione.
"""},
    {"type": "source", "id": "k-lago", "ts": "2034-04-04T09:00:00+02:00", "kind": "page",
     "title": "Lago Trasimeno — regole per balneazione, navigazione, pesca e cani (estratto 2034 per gli ospiti)",
     "text": """# Regole del lago — estratto 2034 per gli ospiti del campeggio

## Balneazione
Consentita solo nelle zone segnalate con boe gialle. Servizio di salvamento dal 1° giugno al 15 settembre,
dalle 10 alle 18. Vietato bagnarsi di notte e con bandiera rossa. In caso di avviso di fioritura algale il
divieto temporaneo è esposto in bacheca e sulla spiaggia.

## Navigazione
Entro 300 metri dalla riva solo remi, vela o motore elettrico. Motori a scoppio oltre i 300 metri, velocità
massima 10 nodi. Varo dei natanti solo dagli scivoli autorizzati; quello di Castiglione del Lago è al porto.

## Pesca
Servono la licenza di tipo B e il permesso provinciale. Pesca vietata dal 1° al 31 maggio (fermo biologico).
Misure minime: persico reale 18 cm, luccio 60 cm, carpa 30 cm. Vietata la pesca nelle zone di balneazione.

## Cani
Ammessi sulla spiaggia solo nel tratto attrezzato "Spiaggia dei Platani", all'estremità nord del lido, al
guinzaglio e con la museruola al seguito. Vietato il bagno dei cani nelle zone di balneazione delle persone.

## Divieti
Fuochi e barbecue sulla spiaggia, campeggio libero sulle rive, raccolta di canne e piante acquatiche,
alimentazione degli uccelli acquatici.
"""},
    {"type": "source", "id": "k-piscina", "ts": "2034-04-13T10:00:00+02:00", "kind": "document",
     "provided_by": "Ottavio",
     "title": "Scheda di autocontrollo piscina — requisiti igienico-sanitari per le piscine delle strutture ricettive (riassunto per il gestore)",
     "text": """# Scheda di autocontrollo piscina — riassunto per il gestore

## Parametri dell'acqua
- Cloro libero: 0,7–1,5 mg/L. Cloro combinato: massimo 0,4 mg/L.
- pH: 6,5–7,5.
- Temperatura dell'acqua non superiore a 30 °C per le vasche scoperte.
- Trasparenza: il fondo della vasca deve essere visibile in ogni punto.

## Controlli
Cloro e pH misurati almeno tre volte al giorno (apertura, metà giornata, chiusura) e annotati sul registro dei
controlli con ora e firma dell'operatore. Analisi microbiologiche di laboratorio una volta al mese nel periodo
di apertura. Il registro va conservato per due anni e mostrato all'ispezione.

## Affollamento
Massimo un bagnante ogni 2 m² di superficie d'acqua: con una vasca di 150 m² il massimo è di 75 bagnanti
contemporanei.

## Obblighi del gestore
Doccia obbligatoria prima dell'ingresso in vasca; divieto di ingresso ai minori di 12 anni non accompagnati;
cartellonistica con orari, regole e profondità; assistente bagnanti obbligatorio per vasche con superficie
oltre 400 m² o profondità oltre 1,40 m; cassetta di pronto soccorso e telefono di emergenza a bordo vasca.

## Ricambio e filtri
Reintegro di acqua nuova pari almeno al 5 % del volume al giorno; controlavaggio dei filtri una volta a
settimana, annotato sul registro.
"""},
]
