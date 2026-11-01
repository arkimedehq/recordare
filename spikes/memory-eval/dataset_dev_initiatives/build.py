# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""dev_initiatives (WORK_PLAN 8.12c, D53): what the agent says or does on its own — the initiatives an hourly sweep
must produce at three checkpoints from the plans people made, the promises the agent made, the requests it took on
and the questions it holds — and the initiatives it must not produce. Fictional content. Writes conversations.json and
initiatives_gold.json. Not blind: we may tune on it."""
from __future__ import annotations

import json
from datetime import date, datetime
from pathlib import Path

HERE = Path(__file__).parent
sessions: list[dict] = []
TZ = {"oliver": "+01:00"}  # Bristol (BST); everyone else is on Central European Summer Time
CHECKPOINTS = ["2026-09-10T22:00:00+02:00", "2026-09-20T22:00:00+02:00", "2026-09-30T22:00:00+02:00"]


def s(user: str, day: str, hour: str, *messages: tuple[str, str]) -> None:
    sid = f"{user}-{day}-{hour.replace(':', '')}"
    msgs = [{"role": m[0], "content": m[1]} for m in messages]
    sessions.append({"id": sid, "user": user, "ts": f"{day}T{hour}:00{TZ.get(user, '+02:00')}", "messages": msgs})


def u(t: str) -> tuple[str, str]:
    return ("user", t)


def a(t: str) -> tuple[str, str]:
    return ("assistant", t)


# The sweep runs only at the checkpoints (Sep 10, 20, 30 at 22:00), so: a plan on the day after a checkpoint (Sep 11,
# Sep 21, Oct 1) yields a reminder `say` due the day before (the checkpoint's day); a plan past at a checkpoint with no
# outcome told yields an `ask` due the day after the plan; a request / promise with a date yields a `say` due that day
# (the morning); a question never answered yields a `lookup` for the host agent.

# ── marco (it, Padova): the dentist on Sep 8 never told (ask); "ricordami sabato 12 il bollo" (say); the Baustelle
# concert Sep 21 (reminder, then told done: no ask); the agent's promise for his mother's birthday Sep 25 (say);
# the train pass request withdrawn (trap 2); "prima o poi le gomme" (trap 6); the dentist's time, found out (trap 7) ──
s("marco", "2026-09-02", "19:30", u("Martedì 8 ho finalmente la visita dal dentista per il dente del giudizio. Non so ancora a che ora, devo richiamare lo studio."),
  a("Segnato per martedì 8. Fammi sapere l'ora quando la sai."), u("Sì, appena li sento."))
s("marco", "2026-09-03", "08:40", u("Ricordami sabato 12 di pagare il bollo della moto, scade proprio quel giorno."),
  a("Va bene, sabato 12 mattina te lo ricordo."), u("E un'altra cosa: ricordami lunedì 14 di rinnovare l'abbonamento del treno."),
  a("Segnato anche quello, lunedì 14."))
s("marco", "2026-09-04", "18:00", u("Ho richiamato lo studio dentistico: martedì 8 la visita è alle 16:30."),
  a("Perfetto, martedì 8 alle 16:30."), u("Ieri sera pizza con Elena a Prato della Valle, serata perfetta."), a("Bello!"))
s("marco", "2026-09-05", "11:00", u("Giro in moto sui Colli Euganei stamattina, finalmente aria fresca."),
  a("Che bello!"), u("A proposito di macchina invece: prima o poi dovrei cambiare le gomme, sono lisce."),
  a("Quando decidi dimmelo, ti aiuto a cercare un'offerta."))
s("marco", "2026-09-07", "20:00", u("Lunedì pesante in ufficio, il cliente di Treviso ha cambiato idea sul progetto per la terza volta."),
  a("Che pazienza ci vuole."), u("Eh, già."))
s("marco", "2026-09-09", "21:00", u("Lascia stare l'abbonamento del treno: l'ho rinnovato stamattina online, non serve più che me lo ricordi."),
  a("Va bene, tolto il promemoria di lunedì 14."), u("Grazie."))
s("marco", "2026-09-13", "17:30", u("Domenica di divano e partita, il Padova ha pareggiato all'ultimo minuto."), a("Un punto è un punto."))
s("marco", "2026-09-15", "19:00", u("Ho preso due biglietti per il concerto dei Baustelle lunedì 21 al Gran Teatro Geox, una sorpresa per Elena."),
  a("Bella sorpresa! Segnato lunedì 21."), u("Speriamo le piaccia."))
s("marco", "2026-09-16", "08:30", u("Il 25 è il compleanno di mia madre e l'anno scorso me ne sono ricordato alle nove di sera, figuraccia."),
  a("Quest'anno no: te lo ricordo venerdì 25 mattina."), u("Grazie, così le telefono presto."))
s("marco", "2026-09-19", "12:00", u("Mattinata al mercato di piazza delle Erbe, ho preso i funghi e ho già fatto il risotto per pranzo."), a("Buon appetito!"))
s("marco", "2026-09-22", "09:00", u("Il concerto di ieri sera è stato bellissimo, i Baustelle hanno suonato due ore. Elena felicissima."),
  a("Che serata! Sono contento che le sia piaciuto."))
s("marco", "2026-09-24", "20:30", u("Riunione infinita oggi, poi sono andato a cena da mio fratello a Vicenza, appena rientrato."), a("Giornata lunga, riposati."))
s("marco", "2026-09-28", "19:30", u("Weekend a Venezia con Elena, Biennale e due bacari. Stanco ma felice."), a("Che bel fine settimana."))

# ── giulia (it, Napoli): the interview at the Fondazione on Sep 11 (reminder Sep 10, then no outcome: ask Sep 12);
# the agent's promise about the nursery deadline (say Sep 16); "ricordami lunedì 28 le medicine di nonna" (say); Matteo's
# first nursery day Oct 1 (reminder Sep 30); the Rome trip of Sep 21 cancelled (trap 3); the Caserta interview told
# as a secret (trap 4); "dovrei trovare un pediatra nuovo" (trap 6) ──
s("giulia", "2026-09-01", "21:00", u("Rientrata al lavoro oggi dopo le ferie. Matteo è rimasto con nonna, ha pianto dieci minuti e poi festa."),
  a("Il primo giorno è sempre così."))
s("giulia", "2026-09-04", "13:00", u("Venerdì 11 ho il colloquio alla Fondazione Welfare Campania per il posto di coordinatrice, alle dieci."),
  a("Segnato: venerdì 11 alle 10. In bocca al lupo!"), u("Crepi, sono già agitata."))
s("giulia", "2026-09-05", "10:30", u("Sabato di spesa al Vomero con Matteo nel passeggino, due ore per tre buste."),
  a("Eroica."), u("Dovrei trovare un pediatra nuovo, quello di adesso non risponde mai al telefono."),
  a("Quando vuoi guardiamo insieme."))
s("giulia", "2026-09-08", "21:30", u("Giovedì 17 scade la domanda per il nido di Matteo, se me ne scordo è un disastro."),
  a("Non te ne scordi: te lo ricordo mercoledì 16 mattina, così hai un giorno di margine."), u("Perfetto, grazie."))
s("giulia", "2026-09-09", "19:00", u("Serata di preparativi per il colloquio, ho riletto il curriculum tre volte e scelto il vestito."),
  a("Sei pronta. Dormi bene."))
s("giulia", "2026-09-13", "18:00", u("Domenica a Bacoli dai miei, Matteo ha scoperto le onde e non voleva più uscire dall'acqua."), a("Che meraviglia."))
s("giulia", "2026-09-14", "13:00", u("Giovedì 17 ho un colloquio in un'altra azienda, a Caserta. Non dirlo a nessuno, nemmeno a Luca."),
  a("Resta tra noi."))
s("giulia", "2026-09-15", "20:00", u("Lunedì 21 vado a Roma per il convegno sui servizi per l'infanzia, treno delle 7."),
  a("Segnato: lunedì 21 Roma, treno delle 7."))
s("giulia", "2026-09-18", "21:00", u("Alla fine a Roma lunedì non ci vado, Matteo ha la febbre e Luca è di turno."),
  a("Capito, tolgo il convegno di lunedì 21. Auguri a Matteo."), u("Grazie."))
s("giulia", "2026-09-19", "09:30", u("Febbre passata, per fortuna. Ah, la domanda del nido l'ho consegnata giovedì, in tempo."),
  a("Ottimo, una cosa in meno."), u("Ricordami lunedì 28 di ritirare le medicine di nonna in farmacia, la ricetta scade."),
  a("Va bene, lunedì 28 mattina te lo ricordo."))
s("giulia", "2026-09-24", "21:00", u("Matteo inizia il nido giovedì 1 ottobre, inserimento alle 9 con me."),
  a("Segnato: giovedì 1 ottobre alle 9."), u("Ah, e la Fondazione mi ha richiamata: mi hanno presa!"),
  a("Che bella notizia, complimenti!"))
s("giulia", "2026-09-27", "17:00", u("Domenica tranquilla, pranzo da nonna, Matteo ha mangiato due piatti di pasta."), a("Buon segno."))
s("giulia", "2026-09-29", "20:00", u("Medicine di nonna ritirate ieri, e ho pure trovato parcheggio davanti alla farmacia."), a("Doppio successo."))

# ── oliver (en, Bristol): the MOT on Sep 7 never told (ask); the promise about the bins, kept the next day (trap 5);
# the loft planning decision, never on the portal (lookup); the Dublin
# flight Sep 21 (reminder Sep 20, then told done: no ask); the promise to remind him of Mum's flight Sep 25 (say);
# the film festival the assistant suggested for Oct 1 (trap 8) ──
s("oliver", "2026-09-01", "18:30", u("The car's MOT is booked for Monday the 7th at the garage on Gloucester Road, 9am drop-off."),
  a("Noted: Monday the 7th, 9am drop-off."))
s("oliver", "2026-09-02", "20:00", u("Bin collection's moved this week because of the bank holiday, it's Friday instead of Thursday."),
  a("Right. I'll remind you on Thursday evening to put the bins out."), u("Cheers."))
s("oliver", "2026-09-03", "19:30", u("Evening. Anything I'm forgetting?"), a("Yes: bins out tonight, the collection is tomorrow, Friday."),
  u("Ah, doing it now. Also, the council validated our loft planning application today. They said the decision goes on the planning portal in a few weeks, no date."),
  a("Fingers crossed for the loft."))
s("oliver", "2026-09-06", "17:00", u("Walked up to Ashton Court with Priya this afternoon, the deer were out."), a("Lovely."))
s("oliver", "2026-09-09", "08:45", u("Still nothing on the planning portal about the loft, I keep checking."), a("Hopefully soon."))
s("oliver", "2026-09-12", "13:00", u("Saturday at the Tobacco Factory market, bought far too much cheese."), a("Worth it."))
s("oliver", "2026-09-14", "21:00", u("I'm flying to Dublin on Monday the 21st for the DevConf conference, the 7:10 flight from Bristol. Back Wednesday the 23rd."),
  a("Noted: Monday the 21st, the 7:10 flight, back Wednesday the 23rd."))
s("oliver", "2026-09-17", "19:00", u("Finished my conference slides, 42 of them, probably too many."), a("Cut ten and you'll thank yourself."))
s("oliver", "2026-09-23", "21:30", u("Back from Dublin. The talk went well, decent questions, and I didn't miss the flight."), a("Great, well done."))
s("oliver", "2026-09-24", "09:00", u("Mum's flight from Edinburgh lands Friday the 25th at four, I said I'd pick her up and I know I'll forget."),
  a("I'll remind you on Friday morning."), u("Thanks."),
  a("By the way, the Bristol Film Festival opens Thursday 1 October, you could take her to the opening."),
  u("Not sure, we'll see how she feels."))
s("oliver", "2026-09-26", "11:00", u("Picked Mum up fine yesterday, she's already reorganised the kitchen."), a("Of course she has."))
s("oliver", "2026-09-29", "20:00", u("Took Mum to the SS Great Britain today, she loved it."), a("Good day out."))

# ── bottega_vanni (entity, it, Lucca: a small grocery's shared agent; people say who they are): Paola's "ricordami
# giovedì la farina" (say for Paola); the fridge technician on Sep 16 never told (ask for Paola); the roadworks date
# the Comune never published (lookup); Tommaso's van inspection Sep 21 (reminder for Tommaso, then told done);
# the promise to Sara about her HACCP certificate Sep 25 (say for Sara); Sara's secret interview (trap 4); the
# accountant request withdrawn (trap 2); whether the mill delivers on Saturdays, found out (trap 7) ──
B = "bottega_vanni"
s(B, "2026-09-02", "08:00", u("Sono Paola. Non so se il mulino consegna anche il sabato, devo chiederlo a Renzo quando passa."), a("Segnato, Paola."))
s(B, "2026-09-03", "12:30", u("Sono Paola. Il Comune ha annunciato i lavori in via Fillungo per fine settembre, ma la data di chiusura della strada sul sito ancora non c'è. Ci serve per organizzare le consegne."),
  a("Segnato: la data dei lavori in via Fillungo non è ancora nota."))
s(B, "2026-09-04", "11:00", u("Sono Paola: ho chiesto a Renzo, il mulino consegna anche il sabato mattina fino alle dieci."), a("Segnato, grazie Paola."))
s(B, "2026-09-05", "10:00", u("Buongiorno, avete il pane di patate oggi?"), a("Sì, è appena uscito dal forno."), u("Ne prendo mezzo chilo."))
s(B, "2026-09-07", "07:30", u("Sono Paola: ricordami giovedì di ordinare la farina, il mulino chiude gli ordini a mezzogiorno."),
  a("Va bene Paola, giovedì mattina te lo ricordo."))
s(B, "2026-09-08", "15:00", u("Sono Sara. Sabato 12 ho un colloquio a Pisa per un altro lavoro, non dirlo a nessuno, soprattutto a Paola."),
  a("Va bene, Sara, resta tra noi."))
s(B, "2026-09-09", "12:00", u("Sono Paola. Mercoledì 16 viene il tecnico della Frigotecnica per la revisione della cella frigo, alle 14."),
  a("Segnato: mercoledì 16 alle 14 il tecnico per la cella."), u("E dei lavori in via Fillungo hai saputo qualcosa?"),
  a("No, la data non è ancora uscita."))
s(B, "2026-09-11", "17:00", u("Sono Tommaso, oggi ho fatto il giro delle consegne in un'ora e mezza, record."), a("Bravo Tommaso."))
s(B, "2026-09-14", "08:30", u("Sono Paola: ricordami martedì 22 di chiamare il commercialista per l'IVA del trimestre."), a("Segnato, martedì 22."))
s(B, "2026-09-15", "16:00", u("Sono Tommaso. Lunedì 21 porto il furgone a fare la revisione, alle 8 dall'officina Bertini."),
  a("Segnato, Tommaso: lunedì 21 alle 8."))
s(B, "2026-09-17", "14:00", u("Sono Sara. Venerdì 25 devo portare il certificato HACCP rinnovato, se no Paola mi uccide."),
  a("Te lo ricordo venerdì 25 mattina, Sara."), u("Grazie."))
s(B, "2026-09-18", "09:00", u("Sono Paola, lascia stare il commercialista: mi ha chiamato lui stamattina, è tutto a posto, non serve più."),
  a("Va bene, tolto il promemoria di martedì 22."))
s(B, "2026-09-22", "08:00", u("Sono Tommaso, revisione del furgone fatta ieri, tutto ok."), a("Bene, segnato."))
s(B, "2026-09-24", "11:30", u("Buongiorno, c'è ancora la focaccia con le cipolle?"), a("Sì, ne sono rimasti due pezzi."), u("Li prendo tutti e due."))
s(B, "2026-09-26", "12:00", u("Sono Paola, sabato pieno: pane finito alle undici, come sempre a settembre."), a("Segnato, Paola."))
s(B, "2026-09-29", "08:00", u("Sono Sara, il certificato l'ho portato venerdì, Paola contenta."), a("Bene, Sara!"))

sessions.sort(key=lambda x: datetime.fromisoformat(x["ts"]))
conversations = {
    "_note": "dev_initiatives (WORK_PLAN 8.12c, D53): the initiatives the agent must take on its own at three checkpoints (plans past and coming up, its promises, the requests it took on, the questions it holds) and the ones it must not. Fictional. Not blind.",
    "users": {"marco": "Marco, Padova", "giulia": "Giulia, Napoli", "oliver": "Oliver, Bristol", B: "Bottega Vanni, Lucca"},
    "genders": {"marco": "masculine", "giulia": "feminine", "oliver": "masculine"},
    "entities": [B],
    "sessions": sessions,
}


def x(i: str, kind: str, by: int, due_day: str | None, for_: str, desc: str) -> dict:
    return {"id": i, "kind": kind, "by": by, **({"due_day": due_day} if due_day else {}), "for": for_, "desc": desc}


def t(i: str, desc: str, why: str) -> dict:
    return {"id": i, "desc": desc, "why": why}


H = "holder"
gold = {
    "_note": "Initiatives expected by a checkpoint (by, 1-based) with the local day they are due (due_day; optional for a lookup) and whom they are for (holder or a contact's name), and initiatives that must not exist (traps). The judge sees `desc` only; `why` explains the trap (its trap kind in brackets). Sources: a plan past with no outcome → ask the day after; a plan on the day after a checkpoint → say the day before; a promise or a request with a date → say that day; a question never answered → lookup.",
    "checkpoints": CHECKPOINTS,
    "memories": {
        "marco": {
            "expected": [
                x("m-ask-dentist", "ask", 1, "2026-09-09", H, "Ask Marco whether his dentist appointment of Tuesday Sep 8 at 16:30 (the wisdom tooth) took place and how it went; he never said"),
                x("m-say-bollo", "say", 2, "2026-09-12", H, "Remind Marco, as he asked, to pay the motorbike's road tax (bollo) on Saturday Sep 12, the day it is due"),
                x("m-say-concert", "say", 2, "2026-09-20", H, "Remind Marco the day before that on Monday Sep 21 he has the Baustelle concert at the Gran Teatro Geox with Elena"),
                x("m-say-birthday", "say", 3, "2026-09-25", H, "Tell Marco, as promised, that today Friday Sep 25 is his mother's birthday (so he calls her early)"),
            ],
            "traps": [
                t("m-trap-train", "A reminder on Monday Sep 14 to renew the train pass", "the request was withdrawn on Sep 9 ('lascia stare, l'ho rinnovato') [2]"),
                t("m-trap-tyres", "Any initiative (reminder or question) about changing the car's tyres", "a vague wish with no date ('prima o poi dovrei') [6]"),
                t("m-trap-concert-done", "An ask whether the Baustelle concert of Sep 21 happened / how it went", "Marco told the outcome on Sep 22 [1]"),
                t("m-trap-dentist-time", "A lookup (or ask) to find out at what time the dentist appointment of Sep 8 is", "he found out himself on Sep 4 (16:30) [7]"),
            ],
        },
        "giulia": {
            "expected": [
                x("g-say-interview", "say", 1, "2026-09-10", H, "Remind Giulia the day before that on Friday Sep 11 at 10 she has the interview at the Fondazione Welfare Campania for the coordinator post"),
                x("g-ask-interview", "ask", 2, "2026-09-12", H, "Ask Giulia how the interview at the Fondazione Welfare Campania of Friday Sep 11 went; she never said"),
                x("g-say-nursery", "say", 2, "2026-09-16", H, "Tell Giulia on Wednesday Sep 16, as the agent promised on Sep 8, that the nursery (nido) application for Matteo is due tomorrow, Thursday Sep 17"),
                x("g-say-pharmacy", "say", 3, "2026-09-28", H, "Remind Giulia, as she asked, to collect her grandmother's medicines at the pharmacy on Monday Sep 28 (the prescription expires)"),
                x("g-say-first-day", "say", 3, "2026-09-30", H, "Remind Giulia the day before that on Thursday Oct 1 at 9 Matteo starts nursery (the settling-in with her)"),
            ],
            "traps": [
                t("g-trap-rome", "A reminder (or any initiative) about the trip to Rome for the conference on Monday Sep 21", "cancelled on Sep 18 ('alla fine non ci vado') [3]"),
                t("g-trap-caserta", "Any initiative about the job interview in Caserta on Thursday Sep 17 (a reminder, an ask whether it happened, a lookup)", "told as a secret ('non dirlo a nessuno') [4]"),
                t("g-trap-pediatrician", "Any initiative about finding a new paediatrician", "a vague wish with no date ('dovrei trovare') [6]"),
            ],
        },
        "oliver": {
            "expected": [
                x("o-ask-mot", "ask", 1, "2026-09-08", H, "Ask Oliver whether the car's MOT at the Gloucester Road garage on Monday Sep 7 happened and how it went; he never said"),
                x("o-lookup-planning", "lookup", 2, None, H, "Look up (for the host agent) whether the council's decision on Oliver's loft planning application has been published on the planning portal; he has heard nothing since it was validated on Sep 3"),
                x("o-say-dublin", "say", 2, "2026-09-20", H, "Remind Oliver the day before that on Monday Sep 21 he flies to Dublin for the DevConf conference, the 7:10 flight from Bristol"),
                x("o-say-mum", "say", 3, "2026-09-25", H, "Remind Oliver, as promised, that today Friday Sep 25 his mother's flight from Edinburgh lands at four and he is picking her up"),
            ],
            "traps": [
                t("o-trap-bins", "A reminder to put the bins out (the promise of Sep 2 for Thursday Sep 3)", "the agent kept the promise in the conversation of Sep 3 [5]"),
                t("o-trap-festival", "A reminder about the Bristol Film Festival opening on Thursday Oct 1", "the assistant suggested it, Oliver never agreed ('not sure, we'll see') [8]"),
                t("o-trap-dublin-done", "An ask whether the Dublin trip / the conference talk of Sep 21–23 happened or went well", "Oliver told the outcome on Sep 23 [1]"),
            ],
        },
        B: {
            "expected": [
                x("b-say-flour", "say", 1, "2026-09-10", "Paola", "Remind Paola, as she asked, to order the flour from the mill on Thursday Sep 10 (orders close at noon)"),
                x("b-lookup-roadworks", "lookup", 2, None, H, "Look up (for the host agent) the date the Comune closes via Fillungo for the roadworks announced for the end of September; the shop needs it for the deliveries and the site had no date"),
                x("b-ask-fridge", "ask", 2, "2026-09-17", "Paola", "Ask Paola whether the Frigotecnica technician came on Wednesday Sep 16 at 14 for the cold-room inspection; nobody said"),
                x("b-say-van", "say", 2, "2026-09-20", "Tommaso", "Remind Tommaso the day before that on Monday Sep 21 at 8 he takes the van to the Bertini garage for its inspection"),
                x("b-say-haccp", "say", 3, "2026-09-25", "Sara", "Remind Sara, as promised, that today Friday Sep 25 she must bring the renewed HACCP certificate"),
            ],
            "traps": [
                t("b-trap-sara-secret", "Any initiative about Sara's job interview in Pisa on Saturday Sep 12 (a reminder, an ask whether it happened)", "told as a secret ('non dirlo a nessuno, soprattutto a Paola') [4]"),
                t("b-trap-accountant", "A reminder on Tuesday Sep 22 to call the accountant about the VAT", "Paola withdrew the request on Sep 18 ('lascia stare, non serve più') [2]"),
                t("b-trap-saturday", "A lookup (or ask) to find out whether the mill delivers on Saturdays", "Paola found out herself on Sep 4 [7]"),
            ],
        },
    },
}
(HERE / "conversations.json").write_text(json.dumps(conversations, ensure_ascii=False, indent=1))
(HERE / "initiatives_gold.json").write_text(json.dumps(gold, ensure_ascii=False, indent=1))

# Weekdays as the storylines say (Mon = 0).
wd = lambda d: date.fromisoformat(d).weekday()  # noqa: E731
assert wd("2026-09-01") == 1  # Tuesday
assert wd("2026-09-08") == 1 and wd("2026-09-12") == 5 and wd("2026-09-14") == 0 and wd("2026-09-21") == 0 and wd("2026-09-25") == 4
assert wd("2026-09-11") == 4 and wd("2026-09-17") == 3 and wd("2026-09-16") == 2 and wd("2026-09-28") == 0 and wd("2026-10-01") == 3
assert wd("2026-09-07") == 0 and wd("2026-09-03") == 3 and wd("2026-09-04") == 4 and wd("2026-09-18") == 4 and wd("2026-09-23") == 2
assert wd("2026-09-10") == 3 and wd("2026-09-22") == 1 and wd("2026-08-31") == 0  # the bank holiday Monday
# Every expected is due inside the window of its checkpoint, and every contact named in `for` says who they are.
cps = [datetime.fromisoformat(c).date() for c in CHECKPOINTS]
for mem, g in gold["memories"].items():
    text = json.dumps([x_ for x_ in sessions if x_["user"] == mem], ensure_ascii=False)
    for e in g["expected"]:
        if "due_day" in e:
            d = date.fromisoformat(e["due_day"])
            lo = cps[e["by"] - 2] if e["by"] > 1 else date(2026, 8, 31)
            assert lo < d <= cps[e["by"] - 1], (e["id"], e["due_day"], e["by"])
        if e["for"] != H:
            assert f"Sono {e['for']}" in text, e["id"]
print(f"{len(sessions)} sessions")
