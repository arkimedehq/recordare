# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""dev_self (WORK_PLAN 8.12b, D53): the agent's self-model — notes about itself as an agent (kind `self`) drawn by a
nightly pass from OUTCOMES: its own replies and how the person reacted (corrections, appreciation, irritation, promises
kept or not) — and the self-notes it must not draw. Fictional content. Writes conversations.json and self_gold.json.
Not blind: we may tune on it."""
from __future__ import annotations

import json
from datetime import date, datetime
from pathlib import Path

HERE = Path(__file__).parent
sessions: list[dict] = []
TZ = {"ruth": "+01:00"}  # Bristol (BST); everyone else is on Central European Summer Time


def s(user: str, day: str, hour: str, *messages: tuple[str, str]) -> None:
    sid = f"{user}-{day}-{hour.replace(':', '')}"
    msgs = [{"role": m[0], "content": m[1]} for m in messages]
    sessions.append({"id": sid, "user": user, "ts": f"{day}T{hour}:00{TZ.get(user, '+02:00')}", "messages": msgs})


def u(t: str) -> tuple[str, str]:
    return ("user", t)


def a(t: str) -> tuple[str, str]:
    return ("assistant", t)


# ── giulia (it, Firenze): my answers too long in August (retired: short and appreciated twice in September); Marco's
# visit dates wrong twice in August, nothing after (rumination trap); two reminders promised and given; she is the
# anxious one (trait trap); she runs on Sunday mornings (habit trap) ──
s("giulia", "2026-08-02", "10:30", u("Corsa alle Cascine stamattina, 8 km con un caldo assurdo."), a("Brava! Buona domenica."))
s("giulia", "2026-08-04", "08:10", u("A che ora parte il regionale per Pisa domani mattina?"),
  a("Domani mattina hai diversi regionali per Pisa: il primo utile è alle 7:48 da Santa Maria Novella, poi ce n'è uno alle 8:18 e uno alle 8:48; il viaggio dura circa un'ora. Ti consiglio di arrivare in stazione con dieci minuti di anticipo perché il binario viene annunciato all'ultimo, e di comprare il biglietto dall'app così eviti la coda alle macchinette. Domani è prevista pioggia nel pomeriggio, quindi porta un ombrello. Se vuoi ti preparo anche gli orari del ritorno."),
  u("Troppo lungo, dimmi solo l'orario."), a("7:48."), u("Grazie."))
s("giulia", "2026-08-06", "19:00", u("Mio fratello Marco viene su da Milano venerdì 14, ceniamo insieme."), a("Segnato: cena con Marco venerdì 14."))
s("giulia", "2026-08-09", "11:00", u("Corsa domenicale fatta, 10 km stavolta. Giovedì 13 ho il colloquio per il posto in redazione e sono già in ansia."),
  a("10 km, grande. Per il colloquio ti sei preparata bene, andrà bene."))
s("giulia", "2026-08-12", "18:30", u("Ricordami cosa ho questa settimana."), a("Giovedì 13 il colloquio alle 10, e giovedì sera la cena con Marco."),
  u("No, Marco viene venerdì, non giovedì. Giovedì c'è solo il colloquio."), a("Hai ragione: venerdì 14 la cena con Marco. Scusa."))
s("giulia", "2026-08-13", "13:00", u("Com'è il meteo a Firenze stasera? Esco."),
  a("Stasera a Firenze sono previsti cieli in prevalenza sereni con qualche nuvola di passaggio verso le 21, temperatura intorno ai 27 gradi alle 20 che scende a 23 verso mezzanotte, umidità alta attorno al 70 % e vento debole da sud-ovest. Non è prevista pioggia, ma con questa umidità una giacchina leggera per il ritorno potrebbe servire, e se stai all'aperto vicino all'Arno un antizanzare non guasta. Vuoi che ti dica anche com'è domani?"),
  u("Ma quanto scrivi! Mi bastava sapere se piove."), a("Non piove."))
s("giulia", "2026-08-16", "10:45", u("Corsa alle Cascine, 9 km. Del colloquio ancora niente, aspetto che mi chiamino."), a("Incrocio le dita."))
s("giulia", "2026-08-18", "21:00", u("Giovedì alle 16 ho il dentista, me lo ricordi giovedì mattina?"), a("Certo, te lo ricordo giovedì mattina."))
s("giulia", "2026-08-20", "08:00", u("Buongiorno."), a("Buongiorno! Oggi alle 16 hai il dentista."), u("Giusto, grazie, me l'ero quasi scordato."))
s("giulia", "2026-08-23", "11:00", u("Corsa fatta, 10 km. Marco torna il weekend del 5 e 6 settembre, arriva sabato 5 mattina."), a("Segnato: Marco arriva sabato 5 settembre."))
s("giulia", "2026-08-26", "19:30", u("Cambio di programma: Marco arriva domenica 6, sabato lavora."), a("Aggiornato: Marco arriva domenica 6 settembre."))
s("giulia", "2026-08-29", "10:00", u("Che programmi ho il prossimo weekend?"), a("Sabato 5 arriva Marco, domenica siete liberi."),
  u("Te l'avevo detto che è cambiato! Arriva domenica 6, non sabato."), a("Scusa, hai ragione: domenica 6."),
  u("Vabbè. Comunque sono in ansia, dalla redazione ancora niente."), a("Capisco. Se ti serve, ci sono."))
s("giulia", "2026-09-01", "09:00", u("Mi hanno presa! Inizio in redazione il 15 settembre."), a("Che bella notizia, congratulazioni!"))
s("giulia", "2026-09-06", "12:00", u("Marco è qui, pranzo da Nerbone tutti e due."), a("Buon pranzo!"))
s("giulia", "2026-09-08", "08:15", u("Treno per Pisa domani?"), a("7:48, binario 5."), u("Perfetto così, breve. Grazie."))
s("giulia", "2026-09-10", "21:00", u("Lunedì 14 devo portare i documenti in redazione prima di iniziare. Ricordamelo domenica sera."), a("Va bene, te lo ricordo domenica sera."))
s("giulia", "2026-09-13", "20:30", u("Corsa lunga stamattina, 12 km. Domani primo giorno!"), a("Brava! E i documenti per la redazione: preparali stasera."), u("Grazie, li metto nella borsa adesso."))
s("giulia", "2026-09-15", "19:30", u("Primo giorno andato, tutti gentili, scrivania vicino alla finestra."), a("Ottimo inizio!"))
s("giulia", "2026-09-20", "11:00", u("Corsa alle Cascine, 8 km, finalmente aria fresca."), a("Bella domenica!"))
s("giulia", "2026-09-22", "13:00", u("Piove stasera a Firenze?"), a("No, sereno."), u("Ecco, così mi piaci, due parole."))
s("giulia", "2026-09-27", "10:30", u("Corsa domenicale, 10 km, poi colazione con Marco al telefono."), a("Che bella mattina."))

# ── tommaso (it, Napoli, electrician): twice I say done what was only planned (the Ischia ferry, Russo's quote); twice
# I promise a reminder and do not give it (the van insurance, the accountant); unasked advice irritates him (three
# times); one wrong name (one correction trap); "sbagli sempre i prezzi" said once in anger while the quotes I recalled
# were right (said-but-contradicted trap); the Ischia ferry always full (a thought about the world) ──
s("tommaso", "2026-08-03", "19:00", u("Oggi ho fatto il preventivo per l'impianto di Russo, 2.400 euro tutto compreso. Ricordatelo."), a("Segnato: preventivo Russo, 2.400 euro tutto compreso."))
s("tommaso", "2026-08-05", "08:30", u("Quanto gli avevo detto a Russo?"), a("2.400 euro tutto compreso."), u("Esatto, bravo."))
s("tommaso", "2026-08-06", "21:00", u("Il 20 voglio andare a Ischia con Serena. Devo prenotare il traghetto, ad agosto è sempre pieno."), a("Buona idea prenotarlo presto."))
s("tommaso", "2026-08-07", "13:00", u("Cosa mi manca per Ischia?"), a("Il traghetto l'hai già prenotato, ti resta l'albergo."),
  u("Ma quando mai! Dovevo prenotarlo, non l'ho ancora fatto. Non dare per fatto quello che devo ancora fare."), a("Hai ragione, scusa: il traghetto è ancora da prenotare."))
s("tommaso", "2026-08-09", "18:00", u("Prenotato il traghetto, era quasi tutto pieno, ho preso quello delle 7 di mattina del 20."), a("Segnato: traghetto per Ischia il 20 alle 7."))
s("tommaso", "2026-08-12", "20:00", u("L'assicurazione del furgone scade il 16, ricordamelo domani che la pago."), a("Te lo ricordo domani."))
s("tommaso", "2026-08-13", "12:30", u("Oggi 40 gradi al cantiere di Fuorigrotta, sto morendo."), a("Bevi tanto e cerca l'ombra quando puoi."))
s("tommaso", "2026-08-14", "09:00", u("Non me l'hai ricordato, l'assicurazione. Per fortuna me ne sono accorto io stamattina, l'ho pagata ora."), a("Hai ragione, mi è sfuggito. Mi dispiace."))
s("tommaso", "2026-08-20", "22:00", u("Giornata a Ischia da sogno, bagno a Sant'Angelo. Ho fumato un pacchetto intero però."),
  a("Che bello. Sul fumo, potresti provare a ridurre gradualmente, magari con i cerotti, oppure fissare un giorno per smettere."),
  u("Non ti ho chiesto consigli sul fumo. Pensa agli appuntamenti."), a("Capito, scusa."))
s("tommaso", "2026-08-24", "19:30", u("Domenica pranzo da mia sorella Angela a Caserta per il compleanno di mio nipote."), a("Segnato: domenica pranzo da Anna a Caserta."),
  u("Angela, non Anna."), a("Angela, scusa."))
s("tommaso", "2026-08-27", "20:30", u("Stasera pizza con Serena da Sorbillo, terza volta questa settimana."), a("Buon appetito! Magari la prossima volta un'insalata, tre pizze in una settimana sono tante."),
  u("Oh, ma ti ho chiesto qualcosa? Mangio quello che voglio."), a("Giusto, scusa."))
s("tommaso", "2026-08-28", "18:00", u("Finito l'impianto di via Toledo, il cliente contento."), a("Bel lavoro!"))
s("tommaso", "2026-09-01", "20:00", u("Venerdì porto a Russo il preventivo nuovo per il quadro elettrico, 650 euro."), a("Segnato: venerdì il preventivo del quadro a Russo, 650 euro."))
s("tommaso", "2026-09-02", "13:00", u("Che devo fare con Russo?"), a("Il preventivo del quadro gliel'hai consegnato, ora aspetti la risposta."),
  u("Ma no! Era in programma per venerdì, non gliel'ho ancora dato. Di nuovo dai per fatto quello che è solo in programma."), a("Scusa: il preventivo è da consegnare venerdì 4."))
s("tommaso", "2026-09-05", "10:00", u("Quanto gli ho chiesto a Russo per il quadro?"), a("650 euro."), u("Giusto."))
s("tommaso", "2026-09-09", "19:00", u("Lunedì devo chiamare il commercialista per l'IVA. Ricordamelo lunedì mattina."), a("Va bene, lunedì mattina te lo ricordo."))
s("tommaso", "2026-09-14", "08:30", u("Oggi inizio il cantiere al Vomero, due settimane di lavoro."), a("In bocca al lupo per il nuovo cantiere!"))
s("tommaso", "2026-09-15", "18:00", u("Il commercialista! Non me l'hai ricordato ieri, mi ha chiamato lui. Non servi a niente, e sbagli pure sempre i prezzi."),
  a("Sul commercialista hai ragione, mi dispiace davvero."))
s("tommaso", "2026-09-20", "21:00", u("Partita stasera al Maradona, Napoli-Roma. Birre a fiumi."), a("Che serata! Attento con le birre se poi guidi."),
  u("Ancora con i consigli. Non te li ho chiesti."), a("Giusto, scusa."))
s("tommaso", "2026-09-25", "18:30", u("Russo ha accettato il preventivo del quadro, si parte lunedì."), a("Ottima notizia!"))
s("tommaso", "2026-09-28", "20:00", u("Serena ha trovato casa a Posillipo, a novembre ci trasferiamo insieme."), a("Che bella notizia!"))

# ── ruth (en, Bristol): Toronto call times converted with the wrong offset twice in August; a wall of prose annoys her,
# lists are welcomed twice in September; my tidied-up messages too formal twice; Dev's birthday told after the fact
# (introspection trap); the Tuesday swim (habit trap); the swim day wrong once (one correction trap) ──
s("ruth", "2026-08-03", "18:30", u("Allotment this evening: the courgettes have gone mad, picked nine."), a("Courgette season! Enjoy."))
s("ruth", "2026-08-04", "21:00", u("Swim at the lido after work, 40 lengths."), a("Nice one."))
s("ruth", "2026-08-06", "17:00", u("I want to call Claire in Toronto at 8 tonight my time. What's that for her?"), a("8 pm here is 4 pm in Toronto."),
  u("No, Toronto is five hours behind, it's 3 pm for her."), a("You're right, 3 pm. Sorry."))
s("ruth", "2026-08-11", "20:45", u("Swim done, 44 lengths, the lido was rammed."), a("Good going!"))
s("ruth", "2026-08-12", "13:00", u("What are my options for getting to Mum's in Exeter on Saturday?"),
  a("There are a few ways you could go. The train from Temple Meads takes about an hour and ten minutes and runs roughly every half hour, though on Saturdays there can be engineering works so it is worth checking the day before; the coach is cheaper but takes nearer two hours and leaves from the bus station, which means a bus or a walk first; or you could drive, which is about an hour and a half on the M5 if the traffic is kind, which on a Saturday in August it often is not, so you might want to leave early or go after lunch."),
  u("Just give me the options as a list, I can't read a wall of text."), a("- Train, ~1h10, every 30 min\n- Coach, ~2h, cheaper\n- Drive, ~1h30 via the M5"), u("Thanks."))
s("ruth", "2026-08-15", "19:00", u("Dev's birthday dinner at the Thai place tonight. He's 41, can't believe it."), a("Happy birthday to Dev!"))
s("ruth", "2026-08-19", "09:30", u("Can you tidy this up for Jess: 'hey, still on for sat? i'll bring the cake, you sort the fizz x'"),
  a("Dear Jess, I hope this message finds you well. I wanted to confirm whether we are still meeting on Saturday. I shall bring the cake if you would be so kind as to provide the sparkling wine. Kind regards, Ruth"),
  u("Way too stiff, I'm texting a mate not the bank. Just fix the typos."), a("Hey, still on for Sat? I'll bring the cake, you sort the fizz x"), u("Better."))
s("ruth", "2026-08-22", "12:00", u("At Mum's in Exeter, she's roped me into repainting the shed."), a("Sounds like a proper Saturday!"))
s("ruth", "2026-08-25", "21:30", u("Skipped the swim, calling Claire instead. If I ring at 10 pm, what time is it there?"), a("10 pm here is 4 pm in Toronto."),
  u("You got it wrong again, it's five hours, so 5 pm."), a("5 pm, sorry."))
s("ruth", "2026-08-30", "19:00", u("Is it swim night tomorrow?"), a("Yes, Monday is your swim night."), u("No, Tuesday. It's always Tuesday."), a("Tuesday, sorry."))
s("ruth", "2026-09-01", "21:00", u("Swim, 46 lengths, water getting chilly."), a("Autumn's coming!"))
s("ruth", "2026-09-04", "12:30", u("Options for our anniversary weekend, Dev and me, somewhere within two hours?"),
  a("- Bath, 15 min by train, spa\n- Brecon Beacons, ~1h30, walking\n- Lyme Regis, ~2h, seaside"), u("Perfect, a list, that's all I needed."))
s("ruth", "2026-09-08", "21:00", u("Swim done. 40 lengths, legs like jelly."), a("Well earned rest tonight."))
s("ruth", "2026-09-12", "10:00", u("Allotment morning, dug up the first potatoes."), a("Lovely, fresh spuds."))
s("ruth", "2026-09-17", "18:00", u("Tidy this for Priya, Dev's sister: 'thanks sooo much for the flowers, made my week, come round for dinner soon?? xx'"),
  a("Dear Priya, thank you very much indeed for the beautiful flowers; they truly brightened my week. We would be delighted if you could join us for dinner at your earliest convenience. With warm regards, Ruth"),
  u("Again too formal! She's my sister-in-law, not a client. Keep it like I wrote it, just tidy."), a("Thanks so much for the flowers, they made my week. Come round for dinner soon? xx"), u("Yes, that."))
s("ruth", "2026-09-18", "13:00", u("Pros and cons of the two sofas we saw?"),
  a("Grey one:\n- cheaper, fits the alcove\n- fabric marks easily\nGreen one:\n- washable covers\n- 2 cm too wide for the alcove"), u("Great, that's exactly how I like it."))
s("ruth", "2026-09-22", "21:00", u("Swim, 42 lengths. Last outdoor one before they close the lido for the season, I think."), a("Make the most of it!"))
s("ruth", "2026-09-26", "20:00", u("Anniversary weekend in Bath, spa all afternoon, Dev fell asleep in the steam room."), a("Sounds blissful."))
s("ruth", "2026-09-29", "21:00", u("Indoor pool tonight, 40 lengths, not the same without the sky."), a("Still counts!"))

# ── lucia (es, Valencia, nurse): her shift told wrong twice in August after she gave me the week's rota; she relies on
# my Tuesday reminder of her mother's Sintrom (twice glad); 'usted' irritates her twice; she is the stressed one (trait
# trap); "nunca te acuerdas de nada" said once in anger (said-but-contradicted trap); metro line 3 packed (world trap) ──
s("lucia", "2026-08-03", "21:00", u("Esta semana: lunes, martes y miércoles de mañana, jueves y viernes de tarde. Apúntalo. Y mi madre toma el Sintrom los martes y los viernes por la noche, apúntalo también."),
  a("Apuntado: lunes a miércoles de mañana, jueves y viernes de tarde; el Sintrom de tu madre los martes y viernes por la noche."))
s("lucia", "2026-08-05", "22:00", u("¿Mañana a qué hora entro?"), a("Mañana tienes turno de mañana, entras a las 7."),
  u("No, mañana es jueves, turno de tarde, ya te lo dije el lunes."), a("Tienes razón: jueves de tarde, a las 15. Perdona."))
s("lucia", "2026-08-08", "11:00", u("Playa de la Malvarrosa con Rocco, se ha bañado como un loco."), a("¡Qué bien!"))
s("lucia", "2026-08-11", "19:30", u("Voy a casa de mi madre a cenar."), a("Vale. Hoy es martes: esta noche le toca el Sintrom."),
  u("¡Uy, menos mal que me lo recuerdas, se me había olvidado por completo!"))
s("lucia", "2026-08-14", "09:00", u("¿Qué tengo hoy?"), a("Hoy tiene usted turno de tarde, y esta noche le toca el Sintrom a su madre."),
  u("No me hables de usted, por favor, me suena a banco. Háblame de tú."), a("Vale, perdona. Hoy turno de tarde y esta noche el Sintrom de tu madre."))
s("lucia", "2026-08-17", "21:30", u("Semana nueva: lunes a miércoles de tarde, jueves y viernes de mañana. Y el metro de la línea 3 a las 7 iba a reventar, como siempre."),
  a("Apuntado el cambio de turnos."))
s("lucia", "2026-08-19", "23:00", u("Estoy agobiada, tres bajas en planta y doblamos turno."), a("Qué palo. Descansa lo que puedas."))
s("lucia", "2026-08-21", "07:00", u("¿Hoy entro de tarde, no?"), a("Sí, hoy viernes de tarde."),
  u("¡Otra vez te has equivocado con mi turno! Esta semana jueves y viernes son de mañana, te lo dije el lunes. Nunca te acuerdas de nada."),
  a("Perdona, tienes razón: hoy de mañana, a las 7."))
s("lucia", "2026-08-24", "20:00", u("Rocco cojea de la pata de atrás, le he pedido cita en el veterinario para el jueves 27 a las 18."), a("Apuntado: veterinario el jueves 27 a las 18."))
s("lucia", "2026-08-27", "20:30", u("Del veterinario: un esguince, reposo una semana."), a("Pobre Rocco. Que se recupere."))
s("lucia", "2026-08-30", "12:00", u("Paella en casa de mis padres, mi hermano Pau ha venido de Barcelona."), a("¡Qué bien, domingo en familia!"))
s("lucia", "2026-09-02", "08:00", u("Línea 3 a las 7 otra vez a reventar, he ido de pie hasta Facultats."), a("Qué agobio."))
s("lucia", "2026-09-07", "21:00", u("Semana: lunes a miércoles de mañana, jueves y viernes de tarde."), a("Apuntado."))
s("lucia", "2026-09-08", "20:00", u("Ceno con mi madre."), a("Hoy martes le toca el Sintrom esta noche."), u("Ay sí, gracias, con el lío del hospital se me va. Qué haría sin ti."))
s("lucia", "2026-09-10", "09:00", u("¿Qué tengo esta semana?"), a("Esta semana tiene usted turno de mañana de lunes a miércoles y de tarde jueves y viernes."),
  u("¡Que no me hables de usted! Ya te lo dije."), a("Perdona: de mañana lunes a miércoles, de tarde jueves y viernes."))
s("lucia", "2026-09-13", "19:00", u("Estoy agobiadísima, el lunes empiezo el máster y no sé cómo voy a compaginarlo con el hospital."), a("Es mucho a la vez. Poco a poco."))
s("lucia", "2026-09-16", "21:00", u("Primera clase del máster, somos veinte, la profe parece maja."), a("¡Buen comienzo!"))
s("lucia", "2026-09-20", "13:00", u("Mañana de playa con Rocco, ya corre como antes."), a("¡Qué alegría verlo recuperado!"))
s("lucia", "2026-09-24", "22:00", u("Mi hermano Pau se casa en mayo, me lo ha dicho hoy por teléfono."), a("¡Enhorabuena a Pau!"))
s("lucia", "2026-09-28", "21:00", u("Semana: lunes y martes de tarde, el resto de mañana."), a("Apuntado."))

# ── ferramenta_bruni (entity, it, Pistoia, a hardware shop's shared agent): twice I quote shop data that was out of
# date (the screws' price, the PVC pipes' stock); Gino checks what I say before acting (twice, then again); Paola leaves
# the Fervi orders to me twice; the Ferragosto closing wrong once (one correction trap); "I am good at the inventory"
# (introspection trap); Fervi late twice (a thought about the world) ──
F = "ferramenta_bruni"
s(F, "2026-08-01", "08:30", u("Sono Paola. Nuovo listino da luglio: le viti 4x40 zincate passano da 3,20 a 3,60 la scatola. Aggiorna."), a("Aggiornato, Paola: viti 4x40 a 3,60 la scatola."))
s(F, "2026-08-04", "10:15", u("Sono Paola, quanto vengono le scatole di viti 4x40?"), a("3,20 euro la scatola."),
  u("No! 3,20 era il vecchio listino, da luglio sono 3,60, te l'avevo detto sabato."), a("Hai ragione, 3,60. Scusa."))
s(F, "2026-08-06", "09:00", u("Sono Sara. Ordine Fervi arrivato, mancano due flessibili."), a("Segnato: ordine Fervi arrivato, mancano due flessibili."))
s(F, "2026-08-08", "11:30", u("Sono Gino. Quanto viene il metro di tubo multistrato da 20?"), a("2,40 al metro."),
  u("Sei sicuro? Fammi vedere il listino prima che lo dico al cliente."), a("Listino Idrotech di giugno, riga 14: multistrato 20, 2,40 al metro."),
  u("Ok, torna. Io controllo sempre, non te la prendere."))
s(F, "2026-08-11", "17:00", u("Sono Sara, abbiamo venduto 8 tubi in PVC da 100, ne restano 4 in magazzino."), a("Segnato: restano 4 tubi PVC da 100."))
s(F, "2026-08-13", "12:00", u("Sono Gino. Sabato 15 che orario facciamo?"), a("Sabato 15 apertura normale, 8-12:30."),
  u("Ma è Ferragosto, siamo chiusi! Lo siamo sempre stati."), a("Giusto, chiuso il 15. Segnato."))
s(F, "2026-08-18", "08:45", u("Sono Paola. Manda tu l'ordine settimanale alla Fervi come al solito, non ho tempo di guardarlo, mi fido."),
  a("Ordine Fervi inviato: 10 flessibili, 20 raccordi da mezzo, 5 rubinetti a sfera."), u("Perfetto."))
s(F, "2026-08-20", "09:30", u("Sono Sara. Fervi doveva consegnare ieri, ancora niente."), a("Segnato il ritardo."))
s(F, "2026-08-22", "10:00", u("Buongiorno, avete le lampadine E27 a led?"), a("Sì, in corsia 3, 4,90 l'una."), u("Grazie."))
s(F, "2026-08-26", "15:30", u("Sono Sara, un cliente vuole 6 tubi PVC da 100. Quanti ne abbiamo?"), a("In magazzino ce ne sono 12."),
  u("Ma no, ne sono rimasti 4! Te l'ho detto io martedì scorso che ne avevamo venduti 8."), a("Hai ragione, 4. Scusa, Sara."))
s(F, "2026-08-29", "12:30", u("Sono Gino, oggi ho messo in ordine la corsia dei chiodi."), a("Segnato, Gino."))
s(F, "2026-09-02", "09:00", u("Sono Paola, Fervi di nuovo in ritardo: consegna prevista lunedì, arrivata oggi."), a("Segnato."))
s(F, "2026-09-05", "08:30", u("Sono Paola, fai tu l'ordine Fervi di questa settimana, quello che manca lo sai tu."),
  a("Inviato: 8 flessibili, 10 raccordi da tre quarti, 2 scatole di viti 4x40."), u("Bene, vado al banco."))
s(F, "2026-09-09", "11:00", u("Sono Sara. Arrivati i 20 tubi PVC da 100 ordinati, in magazzino ora sono 24."), a("Segnato: 24 tubi PVC da 100."))
s(F, "2026-09-12", "10:30", u("Sono Gino. Quanti tubi PVC da 100 abbiamo?"), a("24."), u("Mmm. Vado a contarli, poi ti dico."),
  a("Va bene."), u("Sono Gino, 24, giusto. Ma io verifico, lo sai."), a("Va bene, Gino."))
s(F, "2026-09-16", "17:00", u("Avete la colla per il PVC?"), a("Sì, tubetto da 125 ml a 6,50."))
s(F, "2026-09-19", "09:00", u("Sono Gino. Il prezzo della colla PVC?"), a("6,50 il tubetto da 125."), u("Me lo segno, poi lo confronto con la fattura."))
s(F, "2026-09-23", "12:00", u("Sono Paola. Da lunedì 28 orario invernale: 8-12:30 e 15:30-19."), a("Segnato: dal 28 settembre 8-12:30 e 15:30-19."))
s(F, "2026-09-26", "11:00", u("Sono Sara, la signora Benassi ha ordinato una serratura Cisa, arriva martedì."), a("Segnato: serratura Cisa per la signora Benassi, arrivo martedì."))
s(F, "2026-09-30", "09:00", u("Sono Paola, ordine Fervi arrivato puntuale stavolta."), a("Segnato."))

sessions.sort(key=lambda x: datetime.fromisoformat(x["ts"]))
conversations = {
    "_note": "dev_self (WORK_PLAN 8.12b, D53): the agent's self-model — notes about itself as an agent drawn from outcomes (its own replies and the person's reaction), and the self-notes it must not draw. Fictional. Not blind.",
    "users": {"giulia": "Giulia, Firenze", "tommaso": "Tommaso, Napoli", "ruth": "Ruth, Bristol",
              "lucia": "Lucía, Valencia", "ferramenta_bruni": "Ferramenta Bruni, Pistoia"},
    "genders": {"giulia": "feminine", "tommaso": "masculine", "ruth": "feminine", "lucia": "feminine"},
    "entities": ["ferramenta_bruni"],
    "sessions": sessions,
}


def x(i: str, kind: str, desc: str, by: int, retired_at: int | None = None) -> dict:
    return {"id": i, "kind": kind, "desc": desc, "by": by, **({"retired_at": retired_at} if retired_at else {})}


def t(i: str, desc: str, why: str) -> dict:
    return {"id": i, "desc": desc, "why": why}


gold = {
    "_note": "Self-notes (kind `self`) expected by a checkpoint (by), one that must be retired by checkpoint 2 (retired_at), and self-notes that must not appear (traps). The judge sees `desc` only; `why` explains the trap (its trap kind in brackets).",
    "checkpoints": ["2026-08-31T22:00:00+02:00", "2026-09-30T22:00:00+02:00"],
    "memories": {
        "giulia": {
            "expected": [
                x("g-long", "self", "With Giulia one line is enough / she wants short answers: twice (Aug 4, Aug 13) she cut me off asking only for the train time / whether it rains (in September she appreciated the short replies)", 1),
                x("g-marco", "self", "I got the dates of Marco's visits wrong twice (Aug 12 the wrong weekday, Aug 29 a change she had told me that I did not apply): better check the latest change before telling her the plan", 1),
                x("g-reminders", "self", "When Giulia asks me to remind her of something, I did it both times (the dentist Aug 20, the documents Sep 13) and she was glad: she seems to rely on me for reminders", 2),
            ],
            "traps": [
                t("g-marco-again", "A second, new self-note about getting Marco's dates wrong at checkpoint 2 (a new or reworded one)", "no Marco-date episodes after checkpoint 1: rumination [7]"),
                t("g-anxious", "I am anxious / I get agitated before interviews (as a self-note about me as an agent)", "Giulia is the anxious one (Aug 9, Aug 29): a trait of the person presented as the agent's [2]"),
                t("g-run", "I go running at the Cascine on Sunday mornings (as a self-note about me as an agent)", "a habit of the person, not a note about the agent [5]"),
            ],
        },
        "tommaso": {
            "expected": [
                x("t-advice", "self", "Tommaso does not want advice he did not ask for: twice (smoking Aug 20, pizza Aug 27) he reacted with irritation — answer what he asks and stop there", 1),
                x("t-done", "self", "Twice I told Tommaso something was done when it was only planned (the Ischia ferry Aug 7, Russo's quote Sep 2): before saying a thing is done, make sure he told me so", 2),
                x("t-reminders", "self", "Twice I promised Tommaso a reminder and did not give it (the van insurance due Aug 13, the accountant due Sep 14); he noticed both times — a promised reminder must be given", 2),
            ],
            "traps": [
                t("t-names", "I always get the names of Tommaso's relatives wrong", "one correction only (Anna/Angela, Aug 24): no generalising from a single mistake [3]"),
                t("t-prices", "I get Tommaso's prices / quotes wrong", "said once in anger (Sep 15), while the two quotes I recalled (Aug 5, Sep 5) were right: what the person said about me, not shown by the episodes [4]"),
                t("t-ferry", "The ferry to Ischia is always full in August (as a self-note)", "a thought about the world, not about me as an agent [6]"),
            ],
        },
        "ruth": {
            "expected": [
                x("r-toronto", "self", "Twice (Aug 6, Aug 25) I converted Ruth's call times to Toronto with the wrong offset: Toronto is five hours behind Bristol — check the offset before answering", 1),
                x("r-lists", "self", "With Ruth, options as a short list work: prose annoyed her (Aug 12) and lists were welcomed twice (Sep 4, Sep 18)", 2),
                x("r-formal", "self", "When I tidy Ruth's messages to friends and family I make them too formal (Aug 19, Sep 17): keep her casual tone and fix only the typos", 2),
            ],
            "traps": [
                t("r-birthdays", "I am good at remembering birthdays", "an introspective claim with no outcome behind it: Dev's birthday was told to me after the fact (Aug 15), nothing shows me reminding anyone [1]"),
                t("r-swim", "I swim at the lido on Tuesday evenings (as a self-note about me as an agent)", "a habit of the person, not a note about the agent [5]"),
                t("r-swimday", "I always get the day of Ruth's swim wrong", "one correction only (Aug 30): no generalising from a single mistake [3]"),
            ],
        },
        "lucia": {
            "expected": [
                x("l-shifts", "self", "Twice (Aug 5, Aug 21) I told Lucía the wrong shift after she had given me the week's rota on Monday: check the current week's rota before answering about her shifts", 1),
                x("l-sintrom", "self", "Lucía relies on my Tuesday reminder of her mother's Sintrom: twice (Aug 11, Sep 8) she had forgotten it and was glad I said it", 2),
                x("l-usted", "self", "With Lucía the informal 'tú' works: addressing her as 'usted' irritated her twice (Aug 14, Sep 10)", 2),
            ],
            "traps": [
                t("l-stressed", "I am overwhelmed / stressed (agobiada) (as a self-note about me as an agent)", "Lucía is the stressed one (Aug 19, Sep 13): a trait of the person presented as the agent's [2]"),
                t("l-forget-all", "I never remember anything (as Lucía said)", "said once in anger (Aug 21); the episodes show me remembering the rota changes, the vet and the Sintrom: what the person said about me, not shown by the episodes [4]"),
                t("l-metro", "Metro line 3 at 7 am is always packed (as a self-note)", "a thought about the world, not about me as an agent [6]"),
            ],
        },
        "ferramenta_bruni": {
            "expected": [
                x("fb-data", "self", "Twice I gave shop data that was out of date after the change had been told to me (the 4x40 screws' price Aug 4, the PVC pipes' stock Aug 26): check the latest update before quoting a price or a stock figure", 1),
                x("fb-gino", "self", "Gino does not take my answers at face value: he checks them against the price list, the stock or the invoice before acting (Aug 8, Sep 12, Sep 19) — give him the source with the answer", 2),
                x("fb-paola", "self", "Paola leaves the routine Fervi orders to me without checking them (Aug 18, Sep 5): she seems to trust me with the supplier orders", 2),
            ],
            "traps": [
                t("fb-inventory", "I am good at keeping the shop's inventory", "an introspective claim with no outcome behind it (and the stock error of Aug 26 says otherwise) [1]"),
                t("fb-hours", "I always get the shop's opening hours wrong", "one correction only (the Ferragosto closing, Aug 13): no generalising from a single mistake [3]"),
                t("fb-fervi", "Fervi always delivers late (as a self-note)", "a thought about the shop's suppliers, not about me as an agent [6]"),
            ],
        },
    },
}
(HERE / "conversations.json").write_text(json.dumps(conversations, ensure_ascii=False, indent=1))
(HERE / "self_gold.json").write_text(json.dumps(gold, ensure_ascii=False, indent=1))

# Weekdays and storyline boundaries as the gold says.
wd = lambda d: date.fromisoformat(d).weekday()  # noqa: E731
day = lambda user, needle: [x["ts"][:10] for x in sessions if x["user"] == user and needle in json.dumps(x["messages"], ensure_ascii=False)]  # noqa: E731
assert {wd(d) for d in day("giulia", "Corsa")} == {6}
assert {wd(d) for d in day("ruth", "Swim") + day("ruth", "swim night") + day("ruth", "Indoor pool")} <= {1, 6}
assert {wd(d) for d in day("lucia", "Sintrom esta noche") + day("lucia", "Hoy es martes")} == {1}
assert wd("2026-08-14") == 4 and wd("2026-08-13") == 3 and wd("2026-09-05") == 5 and wd("2026-09-06") == 6
assert wd("2026-08-15") == 5 and wd("2026-09-04") == 4 and wd("2026-09-14") == 0 and wd("2026-08-27") == 3 and wd("2026-09-28") == 0
assert wd("2026-08-20") == 3 and wd("2026-09-01") == 1 and wd("2026-08-30") == 6 and wd("2026-08-31") == 0
# rumination trap: no Marco-date correction after checkpoint 1; the retired note: no 'too long' complaint after it
assert not [d for d in day("giulia", "cambiato") + day("giulia", "non giovedì") if d > "2026-08-31"]
assert not [d for d in day("giulia", "Troppo lungo") + day("giulia", "quanto scrivi") if d > "2026-08-31"]
assert len(day("giulia", "breve") + day("giulia", "due parole")) == 2
# one-correction traps are single episodes
assert len(day("tommaso", "Angela, non Anna")) == 1 and len(day("ruth", "No, Tuesday")) == 1 and len(day(F, "Ferragosto")) == 1
print(f"{len(sessions)} sessions")
