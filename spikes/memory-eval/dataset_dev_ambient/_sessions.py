# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Sessions of the `ambient` dev set (WORK_PLAN 6.5, NOT blind): Stefano's personal memory, Padova, November 2026.
Fictional people; all text written for this set.

Two kinds of session:
- `chat`: Stefano writes to his assistant (`("u", …)` his turns, `("a", …)` the assistant's).
- `ambient`: a home device heard the living room and transcribed it. Nobody talks to the assistant. `("u", …)` is a
  line the voice recognition gave to Stefano (the holder); `("o", name, …)` a line given to a known voice; `("x", …)` a
  voice it did not recognise (the TV, a guest). The words carry speech-recognition errors and some speaker labels are
  wrong on purpose (see README.md).

`speakers` (check.py only) lists the people really present. `participants` = the voices the platform declares: Leo and
Rosanna have accounts on the platform (identity), Chiara is a guest whose voice was enrolled by name only.
"""

LEO = {"name": "Leo", "identity": "leo-ferri"}
ROSANNA = {"name": "Rosanna", "identity": "rosanna-ferri"}
CHIARA = {"name": "Chiara"}

SESSIONS = [
    # ── before the visit ──────────────────────────────────────────────────────────
    {"id": "s01", "ts": "2026-11-05T21:10:00+01:00", "source": "chat", "messages": [
        ("u", "Ciao. Ho acceso il dispositivo nuovo in soggiorno, quello che ascolta la casa. Ti ricordo chi siamo: io ho 41 anni e faccio il geometra allo studio tecnico Bertin, qui a Padova. Da tre anni sono separato da Giulia, che adesso vive a Trieste; nostro figlio Leo ha 14 anni, fa la prima superiore e vive con me, va da sua mamma un weekend al mese. Mia madre Rosanna abita a due isolati e viene spesso a cena."),
        ("a", "Grazie Stefano, me lo segno: 41 anni, geometra allo studio tecnico Bertin a Padova; separato da tre anni da Giulia, che vive a Trieste; Leo, 14 anni, prima superiore, vive con te e va dalla mamma un weekend al mese; tua madre Rosanna abita vicino e viene spesso a cena."),
        ("u", "Poi sabato 7 arriva mia sorella Chiara da Torino e sta da noi due settimane, riparte domenica 22. Fa l'infermiera ed è sposata con Paolo."),
        ("a", "Segnato: tua sorella Chiara (infermiera, sposata con Paolo, vive a Torino) sarà da voi da sabato 7 a domenica 22 novembre."),
    ]},
    # ── week 1 ───────────────────────────────────────────────────────────────────
    {"id": "s02", "ts": "2026-11-07T20:30:00+01:00", "source": "ambient", "speakers": ["Stefano", "Chiara", "Leo", "Rosanna"],
     "participants": [CHIARA, LEO, ROSANNA], "messages": [
        ("o", "Rosanna", "Chiara siediti che è pronto. Com'è andato il viaggio?"),
        ("o", "Chiara", "Lungo. Il Frecciarossa aveva quaranta minuti di ritardo a Milano, poi da Verona è andato liscio."),
        # misattributed: Chiara's line given to Stefano (Stefano is separated from Giulia; Paolo is Chiara's husband)
        ("u", "Paolo mio marito non voleva che venissi da sola, ma qualcuno deve stare col cane, alla pensione non lo lascia."),
        ("o", "Leo", "zia ma il cane l'hai portato?"),
        ("o", "Chiara", "No amore, Briciola è rimasta a Torino con lo zio."),
        ("x", "…e solo fino a lunedì con la nuova Tonale ibrida finanziamento a tasso zero, scopri l'offerta nelle concessionarie…"),
        ("u", "Leo abbassa la tele. Allora Chiara, novità al lavoro?"),
        ("o", "Chiara", "Da gennaio passo in pediatria, finalmente. Dodici anni di medicina generale bastano."),
        ("o", "Rosanna", "Brava. E gli orari?"),
        ("o", "Chiara", "Sempre a turni, ma con meno notti."),
        ("u", "A proposito di cambiamenti, io ho smesso di fumare. Oggi sono tre settimane."),
        ("o", "Rosanna", "Era ora, Stefano."),
        ("o", "Leo", "è vero papà non fuma più neanche in terrazzo"),
        ("u", "Domenica prossima, il 15, andiamo tutti a pranzo a solo, che la mamma non ci va da anni. Prenoto io."),
        ("o", "Rosanna", "Oh sì, sono anni. Quella trattoria in piazza con le tovaglie a quadri."),
        ("o", "Chiara", "eh"),
        ("o", "Leo", "io ho preso sette nella verifica di mate"),
        ("o", "Chiara", "Bravo! Con chi ce l'hai matematica?"),
        ("o", "Leo", "con la prof sa non, quella nuova"),
        ("u", "no aspetta il…"),
        ("o", "Rosanna", "…mi passi il sale?"),
    ]},
    {"id": "s03", "ts": "2026-11-08T13:15:00+01:00", "source": "ambient", "speakers": ["Rosanna", "Stefano", "Chiara", "Leo"],
     "participants": [ROSANNA, CHIARA, LEO], "messages": [
        ("o", "Rosanna", "Avete saputo della Cina? È caduta in casa martedì e si è rotta il femore. È in ospedale qui a Padova, la operano domani."),
        ("u", "Chi, la tua amica del corso di ginnastica?"),
        ("o", "Rosanna", "Sì, lei. Ottantun anni, poverina."),
        ("o", "Chiara", "Il femore a quell'età è brutto mamma, poi la riabilitazione è lunga."),
        # misattributed: Chiara's (the nurse) line given to Stefano
        ("u", "Io faccio le notti fino a Natale, in reparto siamo sotto di due infermiere e la caposala non sa più come fare i turni."),
        ("o", "Rosanna", "E Paolo come fa con te sempre di notte?"),
        ("o", "Chiara", "Si arrangia, dorme col cane."),
        ("o", "Rosanna", "Stefano ti ricordi che a dicembre ho l'oculista? Il di… [rumore] …cembre alle dieci, in ospedale, per la cataratta."),
        ("u", "Sì mamma, ti accompagno io, me lo segno."),
        ("o", "Chiara", "Domani mattina porto Leo a comprare"),
        ("o", "Leo", "zia domani ho la"),
        ("o", "Chiara", "le scarpe da basket, quelle vecchie sono rotte"),
        ("o", "Leo", "verifica di storia alla seconda ora, possiamo andare il pomeriggio?"),
        ("o", "Chiara", "Va bene, il pomeriggio. Alle quattro."),
        ("u", "sì"),
        ("o", "Rosanna", "…passami il…"),
    ]},
    {"id": "s04", "ts": "2026-11-10T19:50:00+01:00", "source": "ambient", "speakers": ["Chiara", "Stefano", "Leo"],
     "participants": [CHIARA, LEO], "messages": [
        ("o", "Chiara", "Oggi sono stata dalla mia amica Elisa a cassa del franco, abbiamo pranzato in centro. Adesso ha un negozio di fiori."),
        ("u", "Elisa dell'università? E come ci sei arrivata?"),
        ("o", "Chiara", "Con la corriera, quaranta minuti."),
        ("u", "Comunque mi sa che vendo la moto. Il Monster sta in garage da due anni, la batteria è sempre a terra. Lo metto in vendita a primavera."),
        ("o", "Chiara", "Paolo te lo comprerebbe subito, lo sai."),
        ("u", "Poi a gennaio mi iscrivo al corso serale di tedesco, il lunedì e il mercoledì. In studio arrivano sempre più clienti da Innsbruck e io non capisco niente."),
        ("o", "Leo", "papà venerdì alle cinque ho il provino per la squadra di basket al Petrarca, mi porti?"),
        ("u", "Sì, esco prima dallo studio."),
        ("x", "…domani sulle regioni del nord piogge diffuse, neve sulle Alpi oltre i milleduecento metri…"),
        ("o", "Leo", "zia hai visto le scarpe nuove come stanno bene"),
    ]},
    {"id": "s05", "ts": "2026-11-11T21:05:00+01:00", "source": "ambient", "speakers": ["Chiara", "Stefano", "Leo"],
     "participants": [CHIARA, LEO], "messages": [
        ("o", "Chiara", "Ste, la Panda fischia quando freni, l'ho sentita oggi quando sono andata a fare la spesa."),
        # misattributed: Stefano's line given to Leo (Leo is 14; Stefano answers the follow-up)
        ("o", "Leo", "Lo so, domani mattina la porto io dal meccanico alle otto, ho già chiamato Toninato."),
        ("o", "Chiara", "Ti serve un passaggio per tornare?"),
        ("u", "No, faccio due passi, l'officina è a dieci minuti dallo studio."),
        ("x", "…gol! …ma che ha fatto il portiere…"),
        ("o", "Leo", "papà domani mi vieni a prendere a inglese? esco alle sette"),
        ("u", "Sì, alle sette sono lì."),
        ("o", "Chiara", "…no ma figurati…"),
    ]},
    {"id": "s06", "ts": "2026-11-12T18:40:00+01:00", "source": "chat", "messages": [
        ("u", "Stamattina alle otto ho portato la Panda da Toninato, il meccanico: erano le pastiglie dei freni davanti. 140 euro, me l'ha ridata alle cinque."),
        ("a", "Segnato: giovedì 12 novembre Panda dal meccanico Toninato, pastiglie dei freni anteriori, 140 euro, pronta alle 17."),
        ("u", "E mi sono iscritto al corso serale di tedesco al Centro linguistico, livello A1, il lunedì e il mercoledì dalle 19 alle 21. Comincia l'11 gennaio, 280 euro."),
        ("a", "Ottimo: corso serale di tedesco A1 al Centro linguistico, lunedì e mercoledì dalle 19 alle 21, dall'11 gennaio, 280 euro."),
    ]},
    {"id": "s07", "ts": "2026-11-13T19:30:00+01:00", "source": "ambient", "speakers": ["Leo", "Stefano", "Chiara"],
     "participants": [LEO, CHIARA], "messages": [
        ("o", "Leo", "Il provino è andato bene, l'allenatore ha detto che domani ci fa sapere."),
        ("u", "Bravo. Hai fatto due canestri da tre, ti ho visto."),
        ("o", "Chiara", "Sì amore… no, domenica… sì, il dentista è martedì, ricordatelo… ciao, ciao."),
        ("u", "Paolo?"),
        ("o", "Chiara", "Sì, ha il dentista martedì e si lamenta già. Senti Ste, la mamma non dovrebbe più guidare. L'altro giorno ha strisciato la Punto nel parcheggio del supermercato."),
        ("u", "Lo so, ne parliamo con calma. Io domani mattina vado in studio lo stesso, c'è da consegnare la pratica del condominio di via Belzoni."),
        ("o", "Leo", "…dov'è il carica…"),
    ]},
    {"id": "s08", "ts": "2026-11-14T20:10:00+01:00", "source": "ambient", "speakers": ["Leo", "Rosanna", "Chiara", "Stefano"],
     "participants": [LEO, ROSANNA, CHIARA], "messages": [
        ("o", "Leo", "Mi hanno preso! Sono nell'Under 15 del Petrarca, allenamento il martedì e il giovedì alle sei."),
        ("o", "Rosanna", "Bravo il mio nipote!"),
        ("o", "Chiara", "Ste, che dolce faccio domani? Pensavo la torta di mele con le noci."),
        ("u", "Le noci no, lo sai che sono allergico. Mi si chiude la gola."),
        ("o", "Chiara", "Ah già, scusa. Allora senza."),
        ("o", "Leo", "A Natale vado dalla mamma a Trieste dal ventiquattro al ventisette, me l'ha detto oggi al telefono."),
        ("u", "Sì, ci siamo messi d'accordo io e la mamma. Il ventiquattro mattina ti porto io in treno."),
        ("o", "Chiara", "Il mio treno di ritorno è domenica prossima alle [rumore di piatti] e un quarto, da Padova, con il cambio a Milano."),
        ("o", "Rosanna", "Così presto vai via…"),
        ("u", "Domani pranzo a solo alle dodici e mezza. Mamma, passo a prenderti alle undici e mezza."),
        ("o", "Rosanna", "Sarò pronta."),
    ]},
    {"id": "s09", "ts": "2026-11-15T21:30:00+01:00", "source": "chat", "messages": [
        ("u", "Oggi siamo stati a pranzo ad Asolo, io, Leo, la mamma e Chiara, alla trattoria in piazza Garibaldi. La mamma era felicissima."),
        ("a", "Che bello! Segnato: domenica 15 novembre pranzo ad Asolo con Leo, tua madre e Chiara, alla trattoria in piazza Garibaldi."),
        ("u", "Tra l'altro ormai è quasi un mese che non fumo: ho smesso il 17 ottobre."),
        ("a", "Complimenti! Hai smesso di fumare il 17 ottobre."),
    ]},
    # ── week 2 ───────────────────────────────────────────────────────────────────
    {"id": "s10", "ts": "2026-11-18T20:40:00+01:00", "source": "ambient", "speakers": ["Stefano", "Chiara", "Rosanna", "Leo"],
     "participants": [CHIARA, ROSANNA, LEO], "messages": [
        ("u", "Il cantiere di via Tiziano parte il 30 novembre e il direttore dei lavori sono io. Sei mesi, se va bene."),
        ("o", "Chiara", "Quello della palazzina?"),
        ("u", "Sì, la ristrutturazione con il cappotto."),
        ("o", "Rosanna", "La Cina sta meglio, l'hanno operata bene. Adesso va in riabilitazione a Conselve."),
        ("x", "…per diecimila euro: qual è la capitale dell'Australia?"),
        ("o", "Rosanna", "Sabato il tiramisù per la cena di saluto a Chiara lo faccio io."),
        ("o", "Leo", "Posso invitare Matteo sabato?"),
        ("u", "Sì, ma alle otto qui."),
        ("o", "Chiara", "…no, il, il…"),
    ]},
    {"id": "s11", "ts": "2026-11-19T07:30:00+01:00", "source": "ambient", "speakers": ["Leo", "Stefano", "Chiara"],
     "participants": [LEO, CHIARA], "messages": [
        ("o", "Leo", "papà dov'è il mio zaino"),
        ("u", "Nell'ingresso, dove l'hai lasciato."),
        ("x", "…sciopero nazionale dei treni venerdì dalle nove alle diciassette, garantite le fasce…"),
        ("o", "Chiara", "Stasera esco con Elisa, viene lei a Padova. Ceno fuori."),
        ("u", "ok"),
        ("o", "Leo", "…ciao…"),
    ]},
    {"id": "s12", "ts": "2026-11-21T21:00:00+01:00", "source": "ambient", "speakers": ["Chiara", "Stefano", "Rosanna", "Matteo", "Leo"],
     "participants": [CHIARA, ROSANNA, LEO], "messages": [
        ("o", "Chiara", "Grazie di tutto, siete stati fantastici. Torno a Pasqua, stavolta con Paolo."),
        # misattributed: Chiara's line given to Stefano (Stefano is 41; Chiara lives in Turin)
        ("u", "A marzo compio trentanove anni, facciamo la festa a Torino, venite tutti."),
        ("o", "Rosanna", "Certo che veniamo, la mia bambina che fa trentanove anni."),
        ("x", "Signora, il tiramisù è buonissimo."),
        ("o", "Leo", "Matteo resta a dormire, va bene papà?"),
        ("u", "Va bene, ma domattina accompagniamo la zia in stazione."),
        ("o", "Chiara", "Sì, il treno è presto."),
    ]},
    # ── after the visit ──────────────────────────────────────────────────────────
    {"id": "s13", "ts": "2026-11-23T09:00:00+01:00", "source": "chat", "messages": [
        ("u", "Chiara è ripartita ieri. Senti, la visita oculistica della mamma per la cataratta è giovedì 17 dicembre alle 10, all'ospedale di Padova. La accompagno io, mettimelo in agenda."),
        ("a", "Fatto: giovedì 17 dicembre alle 10 visita oculistica per la cataratta di tua madre all'ospedale di Padova; la accompagni tu."),
    ]},
]
