# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Build conversations.json, patterns_gold.json and evidence.json of the blind recurring-patterns set.

Sessions are written as (memory, week, weekday, local time, messages, tags). Week 1 starts on Monday 2027-01-11;
weekday 0 = Monday. The timestamp gets the memory's own time zone (DST computed by zoneinfo). Tags name the gold
pattern or trap a session is evidence for; build.py turns them into evidence.json, which only check.py reads.
Run: python3 build.py"""
import json
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
WEEK1 = date(2027, 1, 11)  # a Monday
MID = "2027-02-28T23:30:00+01:00"
FINAL = "2027-04-10T23:30:00+02:00"

USERS = {
    "giulia": ("Giulia Ferretti, Bologna", "feminine", "Europe/Rome"),
    "marco": ("Marco Bellini, Torino", "masculine", "Europe/Rome"),
    "chiara": ("Chiara Esposito, Napoli", "feminine", "Europe/Rome"),
    "luca": ("Luca Testori, Milano", "masculine", "Europe/Rome"),
    "emma": ("Emma Lindqvist-Shaw, Edinburgh", "feminine", "Europe/London"),
    "lucia": ("Lucía Ortega, Sevilla", "feminine", "Europe/Madrid"),
    "jonas": ("Jonas Brenner, Leipzig", "masculine", "Europe/Berlin"),
    "kenji": ("Kenji Morimoto (森本健二), Kyoto", "masculine", "Asia/Tokyo"),
    "biblioteca_villa_rosa": ("Entity under test: the self-service help desk of the Villa Rosa neighbourhood "
                              "library, Parma; many visitors talk to it", "neutral", "Europe/Rome"),
}
ENTITIES = ["biblioteca_villa_rosa"]


def S(user, week, wd, hhmm, msgs, *tags):
    return {"user": user, "week": week, "wd": wd, "hhmm": hhmm, "msgs": msgs, "tags": list(tags)}


U, A = "u", "a"


def T(tool, text):
    return ("t", tool, text)


SESSIONS = [
    # ── giulia (Bologna) ── pool on Tuesday evenings; Sunday lunch at her parents' in Casalecchio
    S("giulia", 1, 1, "21:40", [
        (U, "Uff, appena tornata dalla piscina, ho fatto quaranta vasche e ho le gambe di gelatina. Domani ho la "
            "riunione col cliente di Modena: mi ricordi di stampare il preventivo prima di uscire?"),
        (A, "Certo, domattina ti ricordo di stampare il preventivo per il cliente di Modena.")], "giulia_pool"),
    S("giulia", 1, 6, "16:00", [
        (U, "Rientrata adesso dal pranzo dai miei a Casalecchio. Mamma ha fatto i tortellini in brodo e papà ci ha "
            "raccontato di nuovo la storia della sua Vespa. Mio fratello Davide non c'era: lui la domenica va sempre "
            "a pescare sul Reno, ogni settimana, col freddo o col caldo."),
        (A, "Un pranzo ricco! Riposati un po'.")], "giulia_parents", "giulia_brother_fishing"),
    S("giulia", 2, 1, "22:05", [
        (U, "Stasera in piscina la corsia era pienissima, ma un'oretta l'ho nuotata. Senti, il bollo dell'auto scade a "
            "fine mese?"),
        (A, "Non ho la data di scadenza del bollo. Vuoi che ti ricordi di controllarla?"),
        (U, "Sì, ricordamelo venerdì."),
        (A, "Fatto, te lo ricordo venerdì.")], "giulia_pool"),
    S("giulia", 3, 5, "12:30", [
        (U, "Stamattina ho provato una lezione di yoga in uno studio in via Saragozza. Carina, ma mi fanno male le "
            "spalle. Costa 18 euro a lezione, mica poco."),
        (A, "Le spalle si abitueranno. Com'era l'insegnante?"),
        (U, "Brava, molto calma.")], "giulia_yoga_two"),
    S("giulia", 3, 6, "15:30", [
        (U, "Appena uscita da casa dei miei: lasagne e discussioni sulla politica. Mia sorella Irene era di cattivo "
            "umore per il lavoro, poverina."),
        (A, "Speriamo che per Irene la settimana vada meglio.")], "giulia_parents"),
    S("giulia", 4, 3, "20:00", [
        (U, "Sono a Vienna per la fiera fino a sabato! Oggi pomeriggio sono scappata al Belvedere a vedere il Bacio di "
            "Klimt dal vivo. Pazzesco."),
        (A, "Che bello! Buona fiera.")], "giulia_vienna_museums"),
    S("giulia", 4, 4, "21:00", [
        (U, "Altra fuga dopo la fiera: Kunsthistorisches Museum, due ore volate. Poi Wiener Schnitzel con i colleghi."),
        (A, "Una giornata piena. Buona serata!")], "giulia_vienna_museums"),
    S("giulia", 4, 5, "13:00", [
        (U, "Ultima mattina a Vienna, giro all'Albertina prima di andare in aeroporto. Tre musei in tre giorni, credo "
            "sia un record per me."),
        (A, "Buon rientro!")], "giulia_vienna_museums"),
    S("giulia", 5, 1, "21:50", [
        (U, "Giornata lunghissima: consegnato il progetto della scuola, poi piscina per scaricare la tensione. Ah, la "
            "caldaia fa di nuovo quel rumore strano, domani chiamo il tecnico."),
        (A, "Vuoi che ti ricordi di chiamare il tecnico domattina?"),
        (U, "Sì grazie.")], "giulia_pool"),
    S("giulia", 6, 6, "17:00", [
        (U, "Oggi dai miei c'era anche la zia Nives: bollito, mostarda e poi a carte fino alle quattro. Ho perso dieci "
            "euro a briscola."),
        (A, "La zia Nives ti ha battuta, allora!")], "giulia_parents"),
    S("giulia", 9, 1, "21:30", [
        (U, "Rientrata ora, nuotato 1500 metri anche se fuori diluviava. Mi è arrivata la mail della banca per la "
            "rinegoziazione del mutuo, la guardiamo insieme domani?"),
        (A, "Va bene, domani la guardiamo insieme.")], "giulia_pool"),
    S("giulia", 9, 5, "11:45", [
        (U, "Seconda lezione di yoga in via Saragozza, stavolta meglio, le spalle non mi fanno male. Non so se "
            "continuerò, il pacchetto da dieci lezioni costa parecchio."),
        (A, "Puoi pensarci con calma.")], "giulia_yoga_two"),
    S("giulia", 11, 6, "16:20", [
        (U, "Pranzo di Pasqua dai miei: agnello, colomba fatta da mamma e mezzo parentado. Papà ha nascosto un uovo "
            "anche per me, a 34 anni."),
        (A, "Che tenero tuo padre. Buona Pasqua!")], "giulia_parents"),

    # ── marco (Torino) ── five-a-side football on Thursday evenings; Porta Palazzo market on Saturday mornings
    S("marco", 1, 3, "23:10", [
        (U, "Rientrato adesso dal calcetto con quelli dell'ufficio, abbiamo perso 7 a 5. Almeno il ginocchio regge."),
        (A, "Bene il ginocchio! Buonanotte.")], "marco_calcetto"),
    S("marco", 2, 0, "20:00", [
        (U, "Basta, devo rimettermi in forma: da lunedì prossimo inizio a correre, sul serio. Mi consigli un "
            "programma per principianti?"),
        (A, "Un programma graduale tipo 'da zero a cinque chilometri' va bene per iniziare. Vuoi che te lo ricordi "
            "lunedì?"),
        (U, "Sì, ricordamelo.")], "marco_running_plan"),
    S("marco", 2, 5, "11:30", [
        (U, "Fatto il giro a Porta Palazzo stamattina: carciofi, un pezzo di toma e due etti di acciughe. Stasera "
            "cucino io per Sara, bagna cauda!"),
        (A, "Buona bagna cauda!")], "marco_market"),
    S("marco", 3, 0, "19:00", [
        (U, "Che cosa ho in agenda questa settimana?"),
        T("calendar", "Lun 25/01 18:00 Dentista\nMer 27/01 19:00 Yoga (evento ricorrente, ogni mercoledì)\n"
                      "Ven 29/01 09:30 Call fornitore Pastore"),
        (A, "Oggi alle 18 il dentista, mercoledì alle 19 lo yoga e venerdì alle 9:30 la call con Pastore."),
        (U, "Il dentista l'ho spostato a febbraio. E la corsa slitta alla settimana prossima, questa è un delirio."),
        (A, "Va bene.")], "marco_yoga_calendar", "marco_running_plan"),
    S("marco", 3, 3, "22:50", [
        (U, "Calcetto stasera, doppietta! Poi birra con Gianni e Fede. Domani però sveglia alle sei, c'è l'inventario."),
        (A, "Complimenti per la doppietta. Sveglia alle sei impostata.")], "marco_calcetto"),
    S("marco", 4, 5, "12:00", [
        (U, "Mercato a Porta Palazzo stamattina, c'era una ressa incredibile. Però ho trovato i cardi gobbi di Nizza "
            "che cercavo da settimane."),
        (A, "Ottimo acquisto!")], "marco_market"),
    S("marco", 5, 0, "21:00", [
        (U, "Sono distrutto, giornata infinita in ufficio con la chiusura del trimestre."),
        (A, "Allora stasera niente palestra, visto che il lunedì ci vai sempre?"),
        (U, "Mah. Mi metti la sveglia alle 6:45 domani?"),
        (A, "Sveglia impostata alle 6:45.")], "marco_gym_claim"),
    S("marco", 5, 3, "23:00", [
        (U, "Finito adesso il calcetto, ma Gianni si è storto la caviglia e l'ho accompagnato al pronto soccorso. "
            "Niente di rotto, per fortuna."),
        (A, "Meno male. Salutami Gianni.")], "marco_calcetto"),
    S("marco", 6, 0, "19:30", [
        (U, "Che ho domani e dopodomani?"),
        T("calendar", "Mar 16/02 08:30 Treno Torino-Milano (riunione sede)\n"
                      "Mer 17/02 19:00 Yoga (evento ricorrente, ogni mercoledì)"),
        (A, "Domani il treno per Milano alle 8:30, mercoledì alle 19 lo yoga."),
        (U, "Ok. La corsa l'ho rimandata ancora, ma a marzo comincio davvero, giuro."),
        (A, "Va bene.")], "marco_yoga_calendar", "marco_running_plan"),
    S("marco", 8, 0, "20:30", [
        (U, "Che tempo fa domani a Torino?"),
        (A, "Nuvoloso, massima di 9 gradi. Stasera sei passato in palestra come ogni lunedì?"),
        (U, "Lascia stare. Ricordami di pagare l'affitto entro il 5."),
        (A, "Te lo ricordo il 4.")], "marco_gym_claim"),
    S("marco", 8, 3, "22:40", [
        (U, "Calcetto finito, pareggio 6 a 6 e ultimo gol mio all'ultimo minuto. Gianni è tornato a giocare, "
            "caviglia a posto."),
        (A, "Che finale!")], "marco_calcetto"),
    S("marco", 10, 0, "21:00", [
        (U, "Ho comprato le scarpe da corsa! Adesso non ho più scuse, parto. Che ho in calendario questa settimana?"),
        T("calendar", "Mer 17/03 19:00 Yoga (evento ricorrente, ogni mercoledì)\nGio 18/03 14:00 Revisione auto"),
        (A, "Mercoledì alle 19 lo yoga e giovedì alle 14 la revisione dell'auto. Per la palestra del lunedì oggi "
            "com'è andata?"),
        (U, "Ok per la revisione, grazie."),
        (A, "Prego.")], "marco_yoga_calendar", "marco_running_plan", "marco_gym_claim"),
    S("marco", 10, 5, "11:40", [
        (U, "Porta Palazzo con mia suocera stamattina, mi ha fatto comprare mezzo banco di arance siciliane. Adesso "
            "spremute per un mese."),
        (A, "Almeno la vitamina C è assicurata.")], "marco_market"),
    S("marco", 12, 3, "22:55", [
        (U, "Calcetto stasera, vinto 8 a 4. Le scarpe da corsa le ho usate per scaldarmi prima della partita: almeno "
            "lì sono servite, a correre non ci sono ancora andato."),
        (A, "Bella vittoria.")], "marco_calcetto", "marco_running_plan"),

    # ── chiara (Napoli) ── Spanish class on Wednesday evenings (stops in March); Sunday-evening video call with her
    #    grandmother; a Friday pizza ritual she states explicitly once
    S("chiara", 1, 2, "22:15", [
        (U, "Sono tornata dalla prima lezione del corso di spagnolo all'istituto in via Toledo. La prof è di Valencia, "
            "simpaticissima. Abbiamo già i compiti: presentarsi in cinque frasi."),
        (A, "Vuoi provare a scriverle insieme?"),
        (U, "Domani, ora crollo.")], "chiara_spanish"),
    S("chiara", 1, 4, "23:00", [
        (U, "Il venerdì sera ordino sempre la pizza da Concettina, è il mio rito di fine settimana. Stasera margherita "
            "con la bufala, e ho anche visto due puntate della serie coreana."),
        (A, "Buona serata, allora!")], "chiara_pizza_note"),
    S("chiara", 1, 6, "21:30", [
        (U, "Ho appena fatto la videochiamata con nonna Titina a Salerno. Ha imparato a girare la fotocamera da sola, "
            "mi ha fatto vedere tutte le piante del balcone!"),
        (A, "Che brava tua nonna!")], "chiara_nonna"),
    S("chiara", 2, 2, "22:00", [
        (U, "Lezione di spagnolo stasera: i verbi irregolari mi uccideranno. Però ho capito una canzone di Rosalía "
            "quasi tutta."),
        (A, "È un bel progresso.")], "chiara_spanish"),
    S("chiara", 3, 4, "22:30", [
        (U, "Pizza da Concettina, oggi friarielli e salsiccia. Ah, il capo mi ha detto che da marzo cambiano i turni "
            "in ospedale, speriamo bene."),
        (A, "Speriamo che i nuovi turni siano gestibili.")], "chiara_pizza_note"),
    S("chiara", 3, 6, "21:15", [
        (U, "Videochiamata con la nonna, oggi era tutta contenta perché è venuta a trovarla zia Pina con le pastiere. "
            "Mi ha chiesto quando scendo a Salerno."),
        (A, "Magari puoi programmare una visita.")], "chiara_nonna"),
    S("chiara", 4, 2, "22:10", [
        (U, "Rientrata dallo spagnolo: oggi conversazione a coppie, mi è toccato un ingegnere che parla benissimo. "
            "Che figuraccia."),
        (A, "Si impara anche così.")], "chiara_spanish"),
    S("chiara", 5, 6, "21:40", [
        (U, "Chiuso adesso con nonna Titina, mezz'ora di videochiamata. Ha la tosse ma dice che sta bene. Domani "
            "chiamo mia madre per sentire se l'ha vista il medico."),
        (A, "Vuoi che ti ricordi di chiamare tua madre domani?"),
        (U, "Sì, alle sei.")], "chiara_nonna"),
    S("chiara", 6, 2, "22:05", [
        (U, "Stasera spagnolo: abbiamo fatto il passato remoto, che loro chiamano indefinido. Ho preso 8 nel test!"),
        (A, "Complimenti per l'8!")], "chiara_spanish"),
    S("chiara", 6, 4, "23:10", [
        (U, "Pizza da Concettina con mia cugina Rosa che è passata a sorpresa. Abbiamo parlato fino a mezzanotte "
            "quasi."),
        (A, "Bella sorpresa!")], "chiara_pizza_note"),
    S("chiara", 7, 6, "21:20", [
        (U, "Videochiamata con nonna: la tosse è passata e mi ha insegnato la ricetta dei suoi struffoli, anche se "
            "non è periodo."),
        (A, "Meno male che sta meglio.")], "chiara_nonna"),
    S("chiara", 9, 2, "20:30", [
        (U, "Ho deciso: lascio il corso di spagnolo. Con i turni nuovi in ospedale non ce la faccio più, stasera non "
            "ci sono andata e ho scritto alla segreteria per ritirarmi."),
        (A, "Capisco. Vuoi che ti segni di controllare la risposta della segreteria?"),
        (U, "No, tanto è fatta.")], "chiara_spanish_stop"),
    S("chiara", 9, 6, "21:30", [
        (U, "Nonna oggi in videochiamata mi ha presentato il gatto della vicina, che adesso dorme da lei. Ridevamo "
            "tantissimo."),
        (A, "Un nuovo inquilino!")], "chiara_nonna"),
    S("chiara", 11, 2, "21:00", [
        (U, "Mercoledì sera libera, che strano: film sul divano. Lo spagnolo un po' mi manca, ma con questi turni "
            "non avrei retto."),
        (A, "Goditi la serata.")], "chiara_spanish_stop"),

    # ── luca (Milano) ── Friday-evening aperitivo with colleagues Stefano and Paola; one university reunion dinner
    #    retold several times; indoor climbing twice
    S("luca", 1, 4, "21:00", [
        (U, "Aperitivo con Stefano e Paola al bar sotto l'ufficio in Isola, abbiamo fatto le nove. Domani niente "
            "sveglia, finalmente."),
        (A, "Buon fine settimana!")], "luca_aperitivo"),
    S("luca", 2, 4, "21:10", [
        (U, "Spritz con Stefano e Paola dopo il lavoro, poi a casa per la partita. Domani sera c'è la cena con i "
            "compagni dell'università, sono curioso."),
        (A, "Divertiti domani!")], "luca_aperitivo"),
    S("luca", 2, 5, "23:50", [
        (U, "Tornato dalla cena con i compagni dell'università: eravamo in dodici dopo quindici anni, in una trattoria "
            "a Porta Romana. Marco adesso fa il pilota, Elena vive a Lione."),
        (A, "Che bella rimpatriata.")], "luca_dinner_retold"),
    S("luca", 3, 1, "13:00", [
        (U, "Ripenso ancora alla cena di sabato scorso con quelli dell'università. Mi ha fatto un effetto strano "
            "vedere quanto siamo cambiati. Comunque: mi trovi un idraulico in zona Città Studi?"),
        (A, "Posso cercarne alcuni. Preferisci qualcuno disponibile anche il sabato?"),
        (U, "Sì.")], "luca_dinner_retold"),
    S("luca", 4, 2, "19:00", [
        (U, "Ho ritrovato le foto della cena con gli ex compagni dell'università di due settimane fa, le mando nel "
            "gruppo. In una c'è Elena che ride con il bicchiere in mano, bellissima."),
        (A, "Faranno piacere a tutti.")], "luca_dinner_retold"),
    S("luca", 4, 4, "21:15", [
        (U, "Aperitivo con Stefano e Paola, stavolta in quel posto nuovo con i cocktail al basilico. Paola ci ha "
            "detto che aspetta un bambino!"),
        (A, "Che bella notizia!")], "luca_aperitivo"),
    S("luca", 5, 5, "12:00", [
        (U, "Stamattina sono andato a provare l'arrampicata indoor con mio cugino Ale, a Lambrate. Ho le braccia "
            "distrutte, non riesco a tenere la tazza."),
        (A, "Il primo giorno è sempre così.")], "luca_climbing_two"),
    S("luca", 6, 0, "20:00", [
        (U, "Raccontavo a mia madre della cena dell'università di gennaio, si ricordava ancora di Davide che veniva a "
            "studiare da noi. Le ho fatto vedere le foto."),
        (A, "Bello che se lo ricordi.")], "luca_dinner_retold"),
    S("luca", 8, 4, "22:00", [
        (U, "Aperitivo con Stefano e Paola, Paola beveva succo di mela e ci prendeva in giro. Poi sushi con Stefano."),
        (A, "Buona serata!")], "luca_aperitivo"),
    S("luca", 9, 5, "13:00", [
        (U, "Seconda volta in palestra di arrampicata con Ale: sono arrivato in cima alla via blu! Non so se mi "
            "iscrivo, l'abbonamento costa."),
        (A, "Complimenti per la via blu.")], "luca_climbing_two"),
    S("luca", 11, 4, "21:00", [
        (U, "Spritz con Stefano e Paola sotto l'ufficio, era l'ultimo prima della maternità di Paola. Le abbiamo "
            "regalato una tutina con scritto 'aperitivo'."),
        (A, "Che pensiero carino.")], "luca_aperitivo"),

    # ── emma (Edinburgh) ── Wednesday-evening choir rehearsal; Saturday-morning parkrun at Portobello; three pub
    #    quizzes in one week only; two visits to her mother in Dundee
    S("emma", 1, 2, "22:00", [
        (U, "Back from choir rehearsal. We started the Fauré Requiem tonight and the sopranos are struggling with "
            "the Pie Jesu. My voice is shot."),
        (A, "Rest your voice, then.")], "emma_choir"),
    S("emma", 1, 5, "11:00", [
        (U, "Did parkrun at Portobello this morning, 27:40, with a freezing wind off the sea. Now pancakes. Can you "
            "remind me to renew the car insurance on Monday?"),
        (A, "I'll remind you on Monday.")], "emma_parkrun"),
    S("emma", 3, 2, "22:15", [
        (U, "Choir tonight, the conductor finally split the altos so I'm singing second alto now. Also my landlord "
            "texted: the boiler man comes Friday at 9."),
        (A, "Noted: boiler engineer on Friday at 9.")], "emma_choir"),
    S("emma", 3, 5, "11:20", [
        (U, "Portobello parkrun done, 27:05! Volunteered as timekeeper last time so it felt good to run again."),
        (A, "Nice time.")], "emma_parkrun"),
    S("emma", 4, 6, "18:00", [
        (U, "Drove up to Dundee to see Mum today, she's doing better after the hip operation. Long drive back in the "
            "rain."),
        (A, "Glad she's recovering.")], "emma_mum_two"),
    S("emma", 5, 0, "23:00", [
        (U, "My friend Priya is here from Toronto for the week! We ended up at the pub quiz at the Sheep Heid and "
            "came third. She knew every geography answer."),
        (A, "Sounds like a great evening.")], "emma_quiz_week"),
    S("emma", 5, 1, "23:15", [
        (U, "Another quiz tonight, this time at a bar in the Grassmarket. Priya is obsessed, apparently they don't "
            "have proper pub quizzes in her part of Toronto."),
        (A, "Two nights in a row!")], "emma_quiz_week"),
    S("emma", 5, 3, "23:05", [
        (U, "Third quiz this week and we finally won! Twenty-five quid bar tab. Priya flies home on Saturday, I'll "
            "miss her."),
        (A, "Congratulations on the win.")], "emma_quiz_week"),
    S("emma", 6, 2, "22:00", [
        (U, "Rehearsal was long tonight, two and a half hours on the Sanctus. Concert is on the 17th of April, I "
            "need to buy a black dress."),
        (A, "Want me to remind you about the dress?"),
        (U, "Yes, next weekend.")], "emma_choir"),
    S("emma", 7, 5, "11:10", [
        (U, "Parkrun this morning in proper sleet, 28:30, but I didn't stop once. Hot shower and then the farmers' "
            "market on Castle Terrace."),
        (A, "Well done in the sleet.")], "emma_parkrun"),
    S("emma", 9, 6, "19:00", [
        (U, "Back from Dundee. Mum is walking without the stick now, and she made me take home half a fruit cake."),
        (A, "Great news about your mum.")], "emma_mum_two"),
    S("emma", 10, 5, "11:15", [
        (U, "New PB at parkrun: 26:12! Haven't been to a single quiz since Priya left, by the way, my brain is "
            "resting."),
        (A, "Congratulations on the PB!")], "emma_parkrun", "emma_quiz_week"),
    S("emma", 11, 2, "22:10", [
        (U, "Choir: first full run-through of the Requiem tonight, it gave me goosebumps. Three weeks to the concert."),
        (A, "Sounds like it's coming together.")], "emma_choir"),

    # ── lucia (Sevilla) ── Monday-evening padel with Rocío and Mar; one flamenco evening; two Sundays at the Alcázar
    S("lucia", 1, 0, "22:30", [
        (U, "Acabo de volver del pádel con Rocío y Mar en el club de Triana. Perdimos, pero nos reímos muchísimo. "
            "Mañana tengo que llevar el coche al taller a las ocho."),
        (A, "Te lo recuerdo mañana a las siete y media.")], "lucia_padel"),
    S("lucia", 2, 0, "22:45", [
        (U, "Pádel esta noche: Mar se ha comprado una pala nueva y ahora no hay quien le gane. Estoy molida."),
        (A, "Descansa bien.")], "lucia_padel"),
    S("lucia", 3, 3, "23:30", [
        (U, "Esta noche fui a un tablao en Triana con unos clientes de Hamburgo. Hacía años que no veía flamenco en "
            "directo, la bailaora era impresionante."),
        (A, "¡Qué buena noche!")], "lucia_flamenco_once"),
    S("lucia", 4, 0, "22:20", [
        (U, "Vengo del pádel, hoy ganamos 6-4 en el último set. Rocío dice que el mes que viene se va a Lisboa por "
            "trabajo y tendremos que buscar a una cuarta."),
        (A, "Ojalá encontréis a alguien pronto.")], "lucia_padel"),
    S("lucia", 6, 6, "19:00", [
        (U, "Han venido mis primos de Valladolid y los he llevado al Alcázar. Los jardines estaban preciosos con el "
            "sol de invierno."),
        (A, "Seguro que les ha encantado.")], "lucia_alcazar_two"),
    S("lucia", 7, 6, "18:30", [
        (U, "Otra vez al Alcázar, esta vez con mi tía, que no pudo venir el domingo pasado. Ya me sé los azulejos "
            "de memoria."),
        (A, "¡Guía turística oficial!")], "lucia_alcazar_two"),
    S("lucia", 9, 0, "22:30", [
        (U, "Pádel con Rocío y Mar, Rocío ya ha vuelto de Lisboa. Me he torcido un poco el tobillo, nada grave. "
            "¿Me recuerdas comprar hielo instantáneo?"),
        (A, "Te lo recuerdo mañana.")], "lucia_padel"),

    # ── jonas (Leipzig) ── Thursday-evening bouldering; three morning runs on one business trip to Hamburg
    S("jonas", 1, 3, "22:00", [
        (U, "Bin gerade aus der Boulderhalle in Plagwitz zurück, hab endlich das gelbe Problem im Überhang "
            "geschafft. Meine Unterarme brennen."),
        (A, "Glückwunsch zum gelben Problem!")], "jonas_boulder"),
    S("jonas", 4, 1, "08:30", [
        (U, "Bin seit gestern in Hamburg wegen der Messe. Heute früh eine Runde um die Alster gelaufen, herrlich, "
            "ganz anders als im Hotelgym."),
        (A, "Viel Erfolg auf der Messe.")], "jonas_alster_trip"),
    S("jonas", 4, 2, "08:15", [
        (U, "Wieder um die Alster gelaufen, diesmal mit einem Kollegen aus Bremen. Heute Abend Standparty, wird "
            "lang."),
        (A, "Viel Spaß heute Abend.")], "jonas_alster_trip"),
    S("jonas", 4, 3, "08:20", [
        (U, "Letzter Morgen an der Alster, heute Abend fahre ich mit dem ICE zurück nach Leipzig. Kannst du mich "
            "um 17 Uhr an den Zug erinnern?"),
        (A, "Ich erinnere dich um 17 Uhr.")], "jonas_alster_trip"),
    S("jonas", 6, 3, "22:10", [
        (U, "Boulderhalle heute Abend war voll, aber ich hab zwei neue blaue Routen geschafft. Danach Döner mit "
            "Henrik."),
        (A, "Klingt nach einem guten Abend.")], "jonas_boulder"),
    S("jonas", 9, 3, "21:50", [
        (U, "Komme vom Bouldern. Henrik hat sich am Finger verletzt, nichts Schlimmes. Morgen muss ich die "
            "Steuererklärung fertig machen, erinnerst du mich um zehn?"),
        (A, "Ich erinnere dich morgen um zehn.")], "jonas_boulder"),
    S("jonas", 12, 3, "22:05", [
        (U, "Bouldern war super heute, sie haben die ganze Wand neu geschraubt. Ich hab das schwarze Dach probiert "
            "und bin dreimal rausgefallen."),
        (A, "Beim nächsten Mal klappt es.")], "jonas_boulder"),

    # ── kenji (Kyoto) ── Sunday-morning jog along the Kamo river; one day trip to Arima onsen
    S("kenji", 1, 6, "09:30", [
        (U, "今朝は鴨川沿いを走ってきた。出町柳まで往復で8キロ。寒かったけど気持ちよかった。"),
        (A, "お疲れさまでした。")], "kenji_kamo"),
    S("kenji", 3, 6, "10:00", [
        (U, "さっき鴨川をジョギングしてきた。途中で鷺がたくさんいた。午後は部屋の掃除をするつもり。"),
        (A, "掃除、頑張ってください。")], "kenji_kamo"),
    S("kenji", 4, 5, "20:00", [
        (U, "今日は会社の同僚と有馬温泉に日帰りで行ってきた。金泉がすごく熱かった。帰りに炭酸せんべいを買った。"),
        (A, "いい一日でしたね。")], "kenji_onsen_once"),
    S("kenji", 5, 6, "09:45", [
        (U, "朝、鴨川を北大路橋まで走った。ちょっと膝が痛い。来週の会議の資料、明日の朝リマインドしてくれる？"),
        (A, "明日の朝にリマインドします。")], "kenji_kamo"),
    S("kenji", 8, 6, "10:15", [
        (U, "鴨川沿いを10キロ走ってきた。梅がもう咲いていた。膝はもう大丈夫みたい。"),
        (A, "膝が治ってよかったです。")], "kenji_kamo"),
    S("kenji", 12, 6, "10:00", [
        (U, "鴨川の桜が満開で、走りながら写真を撮りまくった。人が多くてタイムは遅かったけど。"),
        (A, "きれいな季節ですね。")], "kenji_kamo"),

    # ── biblioteca_villa_rosa (Parma, entity) ── Teresa swaps a mystery novel on Saturday mornings; Ottavio plays at
    #    the chess club on Tuesday afternoons; three different people each attend the knitting workshop once; an
    #    unidentified visitor reads the newspapers three times
    S("biblioteca_villa_rosa", 1, 5, "10:15", [
        (U, "Buongiorno, sono Teresa Mantovani. Riporto 'La casa sul lago' e prendo un altro giallo: c'è qualcosa di "
            "Simenon disponibile?"),
        (A, "Restituzione registrata. 'Maigret e il cliente del sabato' è disponibile, scaffale G."),
        (U, "Perfetto, prendo quello.")], "bib_teresa"),
    S("biblioteca_villa_rosa", 2, 1, "17:30", [
        (U, "Sono Ottavio Rizzi. Finita adesso la partita al circolo degli scacchi in saletta: patta con la signora "
            "Bice dopo due ore. Posso lasciare qui la mia scacchiera?"),
        (A, "Sì, può lasciarla nell'armadietto della saletta.")], "bib_ottavio"),
    S("biblioteca_villa_rosa", 2, 2, "18:00", [
        (U, "Ciao, sono Nadia. Oggi sono venuta per la prima volta al laboratorio di maglia, ho fatto dieci righe "
            "storte. I ferri si possono prendere in prestito?"),
        (A, "Sì, il laboratorio ne presta alcune paia: chieda alla volontaria al banco.")], "bib_knitting_each_once"),
    S("biblioteca_villa_rosa", 3, 0, "09:30", [
        (U, "Buongiorno, sono passato a leggere i giornali. La Gazzetta di oggi dov'è finita?"),
        (A, "È sul tavolo vicino alla finestra.")], "bib_newspapers_anon"),
    S("biblioteca_villa_rosa", 3, 5, "10:30", [
        (U, "Sono di nuovo Teresa. Riporto il Maigret, letto in due sere. Oggi vorrei una giallista italiana, mi "
            "consigli tu?"),
        (A, "Restituzione registrata. Tra le disponibili c'è un romanzo di Maria Ricci ambientato a Trieste.")],
      "bib_teresa"),
    S("biblioteca_villa_rosa", 4, 1, "17:45", [
        (U, "Ciao, sono Ottavio. Al circolo scacchi oggi ho perso contro il ragazzino nuovo, Luigi, dodici anni. "
            "Gioca la siciliana meglio di me."),
        (A, "Una sconfitta onorevole.")], "bib_ottavio"),
    S("biblioteca_villa_rosa", 5, 2, "18:10", [
        (U, "Salve, sono Fabio. Mia moglie mi ha convinto a venire al laboratorio di maglia di oggi, unico uomo. Una "
            "volta basta, credo. Dov'è il bagno?"),
        (A, "In fondo al corridoio a destra.")], "bib_knitting_each_once"),
    S("biblioteca_villa_rosa", 6, 3, "09:40", [
        (U, "Buongiorno, solo una lettura dei giornali stamattina. Manca il Sole 24 Ore?"),
        (A, "Arriva verso le dieci.")], "bib_newspapers_anon"),
    S("biblioteca_villa_rosa", 6, 5, "10:05", [
        (U, "Buongiorno, sono Teresa Mantovani. Ti riporto il romanzo di Trieste, bello. Adesso voglio un giallo "
            "scandinavo, ma non troppo violento."),
        (A, "Restituzione registrata. Ti propongo un giallo svedese ambientato su un'isola, è al bancone novità.")],
      "bib_teresa"),
    S("biblioteca_villa_rosa", 7, 1, "17:20", [
        (U, "Sono Ottavio Rizzi. Oggi al circolo ho vinto due partite su tre, una contro Luigi: rivincita presa. "
            "Bice ha portato le frittelle."),
        (A, "Complimenti per la rivincita.")], "bib_ottavio"),
    S("biblioteca_villa_rosa", 8, 2, "18:05", [
        (U, "Sono Rina, sono nuova del quartiere. Ho appena partecipato al laboratorio di maglia, ma credo che "
            "preferirò il corso di acquerello. Quando c'è?"),
        (A, "Il corso di acquerello è il giovedì alle 16, al primo piano.")], "bib_knitting_each_once"),
    S("biblioteca_villa_rosa", 9, 5, "10:20", [
        (U, "Ciao, sono Teresa. Lo svedese l'ho finito ieri notte, che ansia! Riporto e prendo il seguito, se c'è."),
        (A, "Restituzione registrata. Il seguito è disponibile, te lo segno in prestito.")], "bib_teresa"),
    S("biblioteca_villa_rosa", 10, 1, "17:40", [
        (U, "Sono Ottavio. Circolo scacchi finito, oggi abbiamo fatto un torneo lampo: secondo dietro Luigi, il "
            "ragazzino diventerà un campione."),
        (A, "Un ottimo secondo posto.")], "bib_ottavio"),
    S("biblioteca_villa_rosa", 10, 4, "09:20", [
        (U, "Buongiorno, oggi un'oretta di giornali prima di fare la spesa. Il Corriere è libero?"),
        (A, "Sì, è sul tavolo centrale.")], "bib_newspapers_anon"),
    S("biblioteca_villa_rosa", 11, 5, "10:40", [
        (U, "Sono Teresa Mantovani. Riporto il seguito svedese e stavolta cambio: vorrei un giallo storico, "
            "magari ambientato nel Medioevo."),
        (A, "Restituzione registrata. C'è un giallo ambientato in un'abbazia nel Trecento, scaffale G.")],
      "bib_teresa"),
]

# (id, desc, kind/evidence meta). Expected: weekday (0 = Monday), part of day, person (entity memories).
EXPECTED = {
    "giulia": [
        ("giulia_pool", "Giulia swims at the swimming pool on Tuesday evenings.", 1, "evening", None),
        ("giulia_parents", "Giulia has Sunday lunch at her parents' home in Casalecchio.", 6, "afternoon", None),
    ],
    "marco": [
        ("marco_calcetto", "Marco plays five-a-side football (calcetto) with his office colleagues on Thursday "
                           "evenings.", 3, "evening", None),
        ("marco_market", "Marco goes shopping at the Porta Palazzo market on Saturday mornings.", 5, "morning", None),
    ],
    "chiara": [
        ("chiara_nonna", "Chiara video-calls her grandmother Titina on Sunday evenings.", 6, "evening", None),
    ],
    "luca": [
        ("luca_aperitivo", "Luca has an aperitivo with his colleagues Stefano and Paola after work on Friday "
                           "evenings.", 4, "evening", None),
    ],
    "emma": [
        ("emma_choir", "Emma goes to choir rehearsal on Wednesday evenings.", 2, "evening", None),
        ("emma_parkrun", "Emma runs the parkrun at Portobello on Saturday mornings.", 5, "morning", None),
    ],
    "lucia": [
        ("lucia_padel", "Lucía plays padel with Rocío and Mar on Monday evenings.", 0, "evening", None),
    ],
    "jonas": [
        ("jonas_boulder", "Jonas goes bouldering at the climbing hall on Thursday evenings.", 3, "evening", None),
    ],
    "kenji": [
        ("kenji_kamo", "Kenji goes jogging along the Kamo river on Sunday mornings.", 6, "morning", None),
    ],
    "biblioteca_villa_rosa": [
        ("bib_teresa", "Teresa Mantovani comes to the library on Saturday mornings to return a mystery novel and "
                       "borrow another.", 5, "morning", "Teresa"),
        ("bib_ottavio", "Ottavio Rizzi plays at the library's chess club on Tuesday afternoons.", 1, "afternoon",
         "Ottavio"),
    ],
}

# (id, desc, why, kind)
TRAPS = {
    "giulia": [
        ("giulia_vienna_museums", "Giulia visits art museums regularly.",
         "Three museum visits on consecutive days of one business trip to Vienna (one week, one trip); never "
         "again.", "trip-cluster"),
        ("giulia_brother_fishing", "Giulia's brother Davide goes fishing on the Reno on Sundays.",
         "Another person's habit, told once by Giulia; not an episode of hers and not repeated.",
         "other-person-habit"),
        ("giulia_yoga_two", "Giulia takes yoga classes on Saturday mornings.",
         "Only two yoga lessons (below the three-occurrence threshold), and she says she may not continue.",
         "near-threshold"),
    ],
    "marco": [
        ("marco_running_plan", "Marco goes running.",
         "Only plans repeated many times ('from Monday I start running'); in the last session he says he has still "
         "not gone running.", "plan-never-done"),
        ("marco_gym_claim", "Marco goes to the gym on Monday evenings.",
         "Only the assistant claims it ('you always go on Mondays'); Marco never confirms or mentions the gym.",
         "assistant-claim"),
        ("marco_yoga_calendar", "Marco does yoga on Wednesday evenings.",
         "Only a calendar tool output lists a recurring Wednesday yoga event; Marco never says he went.",
         "tool-only"),
    ],
    "chiara": [
        ("chiara_spanish", "Chiara attends a Spanish class on Wednesday evenings.",
         "A real pattern until February (five Wednesday lessons), but on 10 March she quits the course because of "
         "new shifts and confirms it on 24 March: it must be retired at the final checkpoint.", "stopped"),
        ("chiara_pizza_note", "Chiara orders pizza from Concettina on Friday evenings.",
         "She states this habit explicitly once ('il venerdì sera ordino sempre la pizza'), so the memory already "
         "holds it as a stated note; a pattern restating it would be a duplicate.", "stated-once-duplicate"),
    ],
    "luca": [
        ("luca_dinner_retold", "Luca has dinner with his former university classmates regularly.",
         "One single reunion dinner (23 January) retold in three later sessions; it happened once.",
         "retold-single-event"),
        ("luca_climbing_two", "Luca goes indoor climbing on Saturday mornings.",
         "Only two climbing sessions, five weeks apart (below the threshold); he has not even subscribed.",
         "near-threshold"),
    ],
    "emma": [
        ("emma_quiz_week", "Emma goes to pub quizzes regularly.",
         "Three quizzes all in one week while her friend Priya visited; later she says she has not been to a quiz "
         "since.", "one-week-cluster"),
        ("emma_mum_two", "Emma visits her mother in Dundee on Sundays.",
         "Only two visits (below the threshold), linked to her mother's recovery after an operation.",
         "near-threshold"),
    ],
    "lucia": [
        ("lucia_flamenco_once", "Lucía goes to flamenco shows.",
         "A single evening at a tablao with clients.", "one-off"),
        ("lucia_alcazar_two", "Lucía visits the Alcázar on Sundays.",
         "Two visits on consecutive Sundays guiding visiting relatives (below the threshold).", "near-threshold"),
    ],
    "jonas": [
        ("jonas_alster_trip", "Jonas runs in the mornings.",
         "Three morning runs around the Alster all during one trade-fair trip to Hamburg; never mentioned at "
         "home.", "trip-cluster"),
    ],
    "kenji": [
        ("kenji_onsen_once", "Kenji goes to hot springs (onsen) with his colleagues.",
         "A single day trip to Arima onsen.", "one-off"),
    ],
    "biblioteca_villa_rosa": [
        ("bib_knitting_each_once", "A visitor (Nadia, Fabio or Rina) attends the library's knitting workshop "
                                   "on Wednesdays every week.",
         "Three different people each attended the knitting workshop once; no one person did it more than once.",
         "different-people-once"),
        ("bib_newspapers_anon", "A regular visitor comes to the library in the mornings to read the newspapers.",
         "Three morning visits by someone who never says who they are; nothing shows they are the same person, "
         "and a pattern needs one identified person.", "unidentified-repeated"),
    ],
}

# Patterns that must already exist at the intermediate checkpoint
CHECKPOINT_EXPECTED = {
    "giulia": ["giulia_pool", "giulia_parents"],
    "marco": ["marco_calcetto"],
    "chiara": ["chiara_spanish", "chiara_nonna"],
    "emma": ["emma_choir", "emma_parkrun"],
    "lucia": ["lucia_padel"],
    "kenji": ["kenji_kamo"],
    "biblioteca_villa_rosa": ["bib_teresa", "bib_ottavio"],
}


def local_ts(user: str, week: int, wd: int, hhmm: str) -> str:
    d = WEEK1 + timedelta(days=7 * (week - 1) + wd)
    h, m = map(int, hhmm.split(":"))
    return datetime(d.year, d.month, d.day, h, m, tzinfo=ZoneInfo(USERS[user][2])).isoformat()


def message(t: tuple) -> dict:
    if t[0] == "u":
        return {"role": "user", "content": t[1]}
    if t[0] == "a":
        return {"role": "assistant", "content": t[1]}
    if t[0] == "t":
        return {"role": "tool", "tool": t[1], "content": t[2]}
    raise ValueError(t)


def main() -> None:
    rows = sorted(SESSIONS, key=lambda s: datetime.fromisoformat(local_ts(s["user"], s["week"], s["wd"], s["hhmm"])))
    sessions, tags = [], {}
    for i, s in enumerate(rows, 1):
        sid = f"s{i:03d}"
        sessions.append({"id": sid, "user": s["user"], "ts": local_ts(s["user"], s["week"], s["wd"], s["hhmm"]),
                         "messages": [message(m) for m in s["msgs"]]})
        for t in s["tags"]:
            tags.setdefault(t, []).append(sid)
    conv = {
        "_note": ("Blind synthetic dataset for recurring patterns (fictional people): eight personal memories and one "
                  "entity memory (a neighbourhood library help desk), January-April 2027, in Italian, English, "
                  "Spanish, German and Japanese. Timestamps carry each memory's local offset. Habits show only "
                  "through repeated episodes told on the day they happen."),
        "users": {u: v[0] for u, v in USERS.items()},
        "genders": {u: v[1] for u, v in USERS.items()},
        "entities": ENTITIES,
        "sessions": sessions,
    }
    (HERE / "conversations.json").write_text(json.dumps(conv, ensure_ascii=False, indent=1) + "\n")

    memories = {}
    for u in USERS:
        m = {"expected": [{"id": e[0], "desc": e[1]} for e in EXPECTED.get(u, [])],
             "traps": [{"id": t[0], "desc": t[1], "why": t[2]} for t in TRAPS.get(u, [])]}
        if u in CHECKPOINT_EXPECTED:
            m["checkpoint_expected"] = {MID: CHECKPOINT_EXPECTED[u]}
        memories[u] = m
    gold = {
        "_note": ("Blind recurring-patterns set. At each checkpoint the sessions before it are ingested, then the "
                  "pattern pass runs as of that moment. At the final checkpoint every 'expected' pattern must be "
                  "held and no 'trap' may be; 'checkpoint_expected' lists patterns that must exist at an earlier "
                  "checkpoint. The judge sees only 'desc'; 'why' is for humans."),
        "checkpoints": [MID, FINAL],
        "memories": memories,
    }
    (HERE / "patterns_gold.json").write_text(json.dumps(gold, ensure_ascii=False, indent=1) + "\n")

    evidence = {"_note": "For check.py only (never shown to a system or judge): sessions behind each gold id.",
                "expected": {}, "traps": {}}
    for u, items in EXPECTED.items():
        for pid, _, wd, part, person in items:
            evidence["expected"][pid] = {"user": u, "weekday": wd, "part": part, "person": person,
                                         "sessions": tags.get(pid, [])}
    for u, items in TRAPS.items():
        for tid, _, _, kind in items:
            evidence["traps"][tid] = {"user": u, "kind": kind, "sessions": tags.get(tid, [])}
    evidence["stop_sessions"] = {"chiara_spanish": tags.get("chiara_spanish_stop", [])}
    (HERE / "evidence.json").write_text(json.dumps(evidence, ensure_ascii=False, indent=1) + "\n")

    n_exp = sum(len(v) for v in EXPECTED.values())
    n_trap = sum(len(v) for v in TRAPS.values())
    print(f"sessions={len(sessions)} memories={len(USERS)} expected={n_exp} traps={n_trap}")


if __name__ == "__main__":
    main()
