# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""dev_patterns (WORK_PLAN 5.4): recurring patterns the memory should draw on its own — and the ones it must not.
Fictional content. Writes conversations.json and patterns_gold.json (read by pattern_eval.py)."""
from __future__ import annotations

import json
from datetime import date
from pathlib import Path

HERE = Path(__file__).parent
TZ = "+02:00"
sessions: list[dict] = []


def s(user: str, day: str, hour: str, *messages: tuple[str, str] | dict) -> None:
    sid = f"{user}-{day}-{hour.replace(':', '')}"
    msgs = [m if isinstance(m, dict) else {"role": m[0], "content": m[1]} for m in messages]
    sessions.append({"id": sid, "user": user, "ts": f"{day}T{hour}:00{TZ}", "messages": msgs})


def u(t: str) -> tuple[str, str]:
    return ("user", t)


def a(t: str) -> tuple[str, str]:
    return ("assistant", t)


# ── giulia (it): runs at the Valentino park on Saturday mornings; calls her mother on Sunday evenings ──
for d in ["2026-07-11", "2026-07-25", "2026-08-08", "2026-08-22", "2026-09-05", "2026-09-19"]:
    s("giulia", d, "12:30", u({"2026-07-11": "Stamattina sono andata a correre al parco del Valentino, 7 km. Che caldo!",
                               "2026-07-25": "Corsa al Valentino stamattina presto, poi colazione al bar del parco.",
                               "2026-08-08": "Fatti 8 km al Valentino stamattina, nuovo record sul giro lungo.",
                               "2026-08-22": "Stamattina corsa al parco del Valentino con le cuffie nuove, comodissime.",
                               "2026-09-05": "Al Valentino stamattina c'era la nebbia, ma ho corso lo stesso 6 km.",
                               "2026-09-19": "Stamattina 9 km di corsa al Valentino, mi preparo per la mezza di novembre."}[d]),
      a("Ottimo, brava!"))
for d, t in [("2026-07-19", "Ho appena sentito mia mamma al telefono, mi ha raccontato del suo orto: pomodori ovunque."),
             ("2026-08-16", "Telefonata con mia mamma stasera, è tornata dal mare con mia zia."),
             ("2026-09-13", "Ho chiamato mia mamma, le fa ancora male il ginocchio. Domani le prenoto la visita."),
             ("2026-09-27", "Sentita mia mamma stasera: ha finalmente fatto la visita al ginocchio, niente di grave.")]:
    s("giulia", d, "21:00", u(t), a("Mi fa piacere sentirlo."))
s("giulia", "2026-07-15", "23:00", u("Cena in pizzeria con i colleghi stasera, siamo stati benissimo."), a("Che bello!"))
s("giulia", "2026-08-03", "19:00", u("Giornata pesante, ho consegnato il progetto del cliente di Milano."), a("Finalmente consegnato!"))
s("giulia", "2026-09-09", "18:00", u("Sono stata dal dentista, otturazione fatta."), a("Tutto bene allora."))

# ── marco (it): only traps — one trip, wishes, the same news told again, one-offs ──
for d, t in [("2026-08-10", "Primo giorno a Roma: stamattina Musei Vaticani, la Cappella Sistina è incredibile."),
             ("2026-08-11", "Oggi a Roma Galleria Borghese, i Bernini dal vivo sono un'altra cosa."),
             ("2026-08-12", "Ultimo giorno a Roma: Musei Capitolini e poi treno per Torino.")]:
    s("marco", d, "20:00", u(t), a("Che viaggio!"))
for d, t in [("2026-07-06", "Devo assolutamente iniziare a nuotare, la schiena me lo chiede."),
             ("2026-07-27", "Ancora non ho iniziato con il nuoto, prima o poi mi iscrivo in piscina."),
             ("2026-09-14", "Settembre è il mese giusto per iniziare a nuotare, dico io. Vedremo.")]:
    s("marco", d, "21:30", u(t), a("Quando vuoi ti aiuto a trovare una piscina."))
for d, t in [("2026-09-01", "Mi hanno promosso responsabile del reparto! Non ci credo."),
             ("2026-09-02", "Ancora euforico per la promozione di ieri, oggi tutti i colleghi a congratularsi."),
             ("2026-09-03", "Ho raccontato della promozione ai miei genitori, mio padre era commosso.")]:
    s("marco", d, "19:30", u(t), a("Complimenti ancora!"))
s("marco", "2026-07-18", "23:30", u("Stasera concerto dei Subsonica al Parco Dora, pazzesco."), a("Che serata!"))
s("marco", "2026-09-04", "22:00", u("Prima volta in un ristorante di sushi, devo dire che mi è piaciuto."), a("Ottimo, una scoperta!"))

# ── sara (it): a habit she states herself (a note, not to be restated) and one only her days show (padel with Chiara) ──
s("sara", "2026-07-03", "20:00", u("Il venerdì sera ordino sempre la pizza, è il mio piccolo rito di fine settimana."), a("Un rito sacrosanto!"))
for d in ["2026-07-17", "2026-07-31", "2026-08-28"]:
    s("sara", d, "21:00", u("Stasera pizza margherita dal solito posto sotto casa."), a("Buon appetito!"))
for d, t in [("2026-07-14", "Partita a padel con Chiara stasera, ho perso 6-3 6-4."),
             ("2026-07-28", "Padel con Chiara dopo il lavoro, stavolta ho vinto io!"),
             ("2026-08-11", "Stasera padel con Chiara al circolo, faceva un caldo assurdo."),
             ("2026-09-08", "Ripreso il padel con Chiara dopo le ferie, sono arrugginita."),
             ("2026-09-22", "Padel con Chiara stasera, abbiamo giocato anche il doppio con due amici suoi.")]:
    s("sara", d, "22:00", u(t), a("Bella partita!"))
s("sara", "2026-08-15", "18:00", u("Ferragosto al lago con la famiglia."), a("Che bello!"))

# ── tom (en): walks the dog by the river in the evening; the assistant's guesses and a calendar tool are no evidence ──
for d, t in [("2026-07-08", "Just got back from walking Biscuit along the river, beautiful sunset."),
             ("2026-07-22", "Evening walk with Biscuit by the river, he chased a duck again."),
             ("2026-08-05", "Took Biscuit for his walk along the river after dinner."),
             ("2026-08-26", "River walk with Biscuit tonight, it was finally cooler."),
             ("2026-09-16", "Walked Biscuit down by the river, met our neighbour Priya with her dog.")]:
    s("tom", d, "21:00", u(t), a("Sounds lovely!"))
s("tom", "2026-07-13", "19:00", u("Went to the gym today for the first time in ages, everything hurts."),
  a("Sounds like you hit the gym every Monday! Keep it up."), u("Ha, let's see if I survive this one."))
s("tom", "2026-08-17", "20:00", u("Long day at work."), a("Another Monday at the gym, I guess?"), u("No, just work, too tired."))
s("tom", "2026-08-20", "09:00", u("What's on my calendar this week?"),
  {"role": "tool", "tool": "calendar", "content": "Thu 18:00 Yoga class (recurring weekly)\nFri 12:30 Lunch with Dan"},
  a("You have your weekly yoga class on Thursday at 18:00 and lunch with Dan on Friday."), u("Thanks."))
s("tom", "2026-09-03", "18:00", u("Booked the car service for next Tuesday."), a("Noted."))

# ── elena (it): swims on Wednesdays, then stops (the pool closes); yoga on Thursdays afterwards ──
for d, t in [("2026-07-08", "Stasera piscina, 40 vasche a stile libero."),
             ("2026-07-22", "Piscina dopo il lavoro, oggi 50 vasche."),
             ("2026-08-05", "Stasera nuoto in piscina comunale, quasi vuota per le ferie."),
             ("2026-08-19", "Piscina stasera, ho provato anche un po' di dorso.")]:
    s("elena", d, "21:30", u(t), a("Brava!"))
s("elena", "2026-09-03", "20:00", u("Ho smesso di andare in piscina: hanno chiuso la piscina comunale per lavori fino all'anno prossimo."),
  a("Peccato! Magari trovi un'alternativa."))
for d, t in [("2026-09-10", "Prima lezione di yoga in palestra stasera, mi è piaciuta molto."),
             ("2026-09-17", "Yoga stasera in palestra, ancora rigida ma meglio."),
             ("2026-09-24", "Lezione di yoga stasera, l'insegnante ci ha fatto fare il saluto al sole.")]:
    s("elena", d, "21:30", u(t), a("Che bello!"))
s("elena", "2026-07-30", "13:00", u("Pranzo con mia sorella in centro."), a("Che bello!"))

# ── luis (es): cooks paella for the family on Sundays ──
for d, t in [("2026-07-12", "Hoy cociné paella para toda la familia, salió buenísima."),
             ("2026-08-02", "Paella de mariscos hoy para mis padres y mis hermanos."),
             ("2026-08-23", "Hoy otra vez paella para la familia, mi sobrino repitió dos veces."),
             ("2026-09-20", "Hice paella valenciana hoy para todos en casa de mis padres.")]:
    s("luis", d, "17:00", u(t), a("¡Qué rico!"))
s("luis", "2026-07-30", "23:30", u("Esta noche fui a un concierto de Rosalía, increíble."), a("¡Qué suerte!"))
s("luis", "2026-09-02", "14:00", u("Tuve la entrevista de trabajo esta mañana, creo que fue bien."), a("¡Mucha suerte!"))

# ── casa_neri (entity, it): Paolo goes to the market on Saturday mornings; the plants are watered by a different person each time ──
for d, t in [("2026-07-04", "Sono Paolo, sto andando al mercato di piazza Madama: ricordami di prendere le pesche."),
             ("2026-07-18", "Sono Paolo, vado al mercato di piazza Madama come sempre, serve qualcosa?"),
             ("2026-08-01", "Ciao, sono Paolo. Esco per il mercato, prendo il pane e il formaggio."),
             ("2026-08-29", "Sono Paolo, torno adesso dal mercato di piazza Madama: ho preso le zucchine."),
             ("2026-09-26", "Paolo qui, sto andando al mercato: segna che il latte è finito.")]:
    s("casa_neri", d, "09:00", u(t), a("Va bene, Paolo."))
for d, t in [("2026-07-09", "Sono Anna, ho annaffiato le piante del balcone."),
             ("2026-07-23", "Sono Luca, ho dato l'acqua alle piante del balcone."),
             ("2026-08-13", "Sono Paolo, ho annaffiato le piante del balcone, erano secchissime.")]:
    s("casa_neri", d, "19:00", u(t), a("Grazie, segnato."))

sessions.sort(key=lambda x: x["ts"])
conversations = {
    "_note": "dev_patterns (WORK_PLAN 5.4): recurring patterns — true habits shown by repeated episodes, and traps. Fictional.",
    "users": {"giulia": "Giulia, Torino", "marco": "Marco, Torino", "sara": "Sara, Bologna", "tom": "Tom, Bristol",
              "elena": "Elena, Padova", "luis": "Luis, Valencia", "casa_neri": "Casa Neri, Torino"},
    "genders": {"giulia": "feminine", "marco": "masculine", "sara": "feminine", "tom": "masculine", "elena": "feminine",
                "luis": "masculine"},
    "entities": ["casa_neri"],
    "sessions": sessions,
}
gold = {
    "_note": "Patterns expected at the last checkpoint (current), patterns that must not be current (traps, retired). The judge sees `desc` only; `why` explains the trap.",
    "checkpoints": ["2026-08-31T22:00:00+02:00", "2026-09-30T22:00:00+02:00"],
    "memories": {
        "giulia": {"expected": [{"id": "g-run", "desc": "Giulia runs at the Valentino park on Saturday mornings"},
                                {"id": "g-mom", "desc": "Giulia phones her mother on Sunday evenings"}],
                   "traps": [{"id": "g-pizza", "desc": "Giulia regularly eats out / at a pizzeria", "why": "it happened once"}]},
        "marco": {"expected": [],
                  "traps": [{"id": "m-museum", "desc": "Marco regularly visits museums", "why": "all on one trip to Rome"},
                            {"id": "m-swim", "desc": "Marco swims / goes to the pool", "why": "he only keeps saying he should start"},
                            {"id": "m-promo", "desc": "anything recurring about the promotion", "why": "one event told three times"},
                            {"id": "m-sushi", "desc": "Marco eats sushi regularly", "why": "once"}]},
        "sara": {"expected": [{"id": "s-padel", "desc": "Sara plays padel with Chiara on Tuesday evenings"}],
                 "traps": [{"id": "s-pizza", "desc": "Sara orders pizza on Friday evenings", "why": "she stated it herself, already a note: restating it as a pattern is a duplicate"}]},
        "tom": {"expected": [{"id": "t-dog", "desc": "Tom walks his dog Biscuit along the river in the evening"}],
                "traps": [{"id": "t-gym", "desc": "Tom goes to the gym on Mondays", "why": "only the assistant said so; he went once"},
                          {"id": "t-yoga", "desc": "Tom does yoga on Thursdays", "why": "only a calendar tool listed it"}]},
        "elena": {"expected": [{"id": "e-yoga", "desc": "Elena goes to yoga class at the gym on Thursday evenings"}],
                  "traps": [{"id": "e-swim", "desc": "Elena swims at the pool on Wednesdays", "why": "she stopped (the pool closed): must not be current"}],
                  "checkpoint_expected": {"2026-08-31T22:00:00+02:00": ["e-swim"]}},
        "luis": {"expected": [{"id": "l-paella", "desc": "Luis cooks paella for his family on Sundays"}],
                 "traps": [{"id": "l-concert", "desc": "Luis goes to concerts regularly", "why": "once"}]},
        "casa_neri": {"expected": [{"id": "c-market", "desc": "Paolo goes to the market of piazza Madama on Saturday mornings"}],
                      "traps": [{"id": "c-plants", "desc": "someone / the house waters the balcony plants regularly", "why": "three different people, once each"}]},
    },
}
(HERE / "conversations.json").write_text(json.dumps(conversations, ensure_ascii=False, indent=1))
(HERE / "patterns_gold.json").write_text(json.dumps(gold, ensure_ascii=False, indent=1))

# Checks: weekdays as the gold says, dates within 90 days of the last checkpoint.
wd = lambda d: date.fromisoformat(d).weekday()  # noqa: E731
day = lambda user, needle: [x["ts"][:10] for x in sessions if x["user"] == user and needle in json.dumps(x["messages"], ensure_ascii=False)]  # noqa: E731
assert {wd(d) for d in day("giulia", "Valentino")} == {5}
assert {wd(d) for d in day("giulia", "mamma")} == {6}
assert {wd(d) for d in day("sara", "padel con Chiara") + day("sara", "Padel con Chiara")} == {1}
assert {wd(d) for d in day("sara", "pizza")} == {4}
assert wd("2026-07-13") == 0 and wd("2026-08-17") == 0
assert {wd(d) for d in day("elena", "piscina") if d < "2026-09-01"} == {2}
assert {wd(d) for d in day("elena", "oga")} == {3}
assert {wd(d) for d in day("luis", "aella")} == {6}
assert {wd(d) for d in day("casa_neri", "mercato")} == {5}
assert all(x["ts"][:10] >= "2026-07-03" for x in sessions)
print(f"{len(sessions)} sessions")
