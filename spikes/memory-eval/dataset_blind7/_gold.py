# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Gold annotations of blind set #7 (what a perfect extractor would store for Giacomo).

episodes: id, kind (event | plan | state_change), date (ISO day or None), date_precision, content, sessions, people,
          plan_outcome (plans only: confirmed | cancelled | rescheduled | unresolved).
facts: key + history of values (from / to, ISO dates; to=None = current).
notes: stable knowledge (category + content).
not_memories: claims and messages that must NOT become memories of the owner (unconfirmed or denied claims of others,
              requests to the assistant by others, wrong assistant recalls), with the reason.
Third-party news is an `event` dated the day it was said.
"""


def ep(i, kind, date, content, sessions, people=(), outcome=None, precision="day"):
    e = {"id": f"e{i:02d}", "kind": kind, "date": date, "date_precision": precision, "content": content,
         "sessions": list(sessions), "people": list(people)}
    if kind == "plan":
        e["plan_outcome"] = outcome
    return e


EPISODES = [
    ep(1, "event", "2033-02-12", "Smash Seriate beat Volley Dalmine 3-1 at home; Giacomo played all four sets.", ["s03"]),
    ep(2, "plan", "2033-02-26", "Weekend in Verona with Martina on 26-27 Feb for her birthday; done (B&B near Piazza "
       "delle Erbe, Arena, osteria).", ["s03", "s07"], ["Martina"], "confirmed"),
    ep(3, "plan", "2033-04-03", "Run the Mezza di Bergamo half marathon (goal under 1h55); done in 1h52'40\".",
       ["s03", "s11", "s18"], outcome="confirmed"),
    ep(4, "event", "2033-02-15", "Dentist: cavity filled.", ["s05"]),
    ep(5, "event", "2033-02-16", "Blood donation at AVIS (morning, before work).", ["s05"]),
    ep(6, "plan", "2033-02-28", "Apply for the hospital-pharmacist call at Papa Giovanni XXIII (deadline Mon 28 Feb); "
       "application sent Sun 20 Feb.", ["s05", "s06"], outcome="confirmed"),
    ep(7, "event", "2033-02-19", "Smash Seriate lost 1-3 away at Treviglio (league leaders).", ["s06"]),
    ep(8, "event", "2033-03-02", "Rear-ended in via Corridoni in the evening coming home from the pharmacy; Giacomo fine "
       "(stiff neck), Punto's rear destroyed, other driver at fault.", ["s08"]),
    ep(9, "plan", "2033-03-12", "Lampioni Gialli concert at Alcatraz, Milan, with Martina; cancelled by the band hours "
       "before (singer's laryngitis), 2 x 38 euro refunded.", ["s08", "s11"], ["Martina"], "cancelled"),
    ep(10, "plan", "2033-03-15", "Regional course on vaccinations in pharmacies, Milan, all day; done, now qualified.",
       ["s09", "s12"], ["Paola Cortinovis"], "confirmed"),
    ep(11, "event", "2033-03-10", "Insurance assessor: Punto not worth repairing, to be scrapped; other party's "
       "insurer pays 2,100 euro market value.", ["s10"]),
    ep(12, "plan", "2033-03-24", "Job interview at Papa Giovanni XXIII on Thu 24 Mar at 10; done, went well.",
       ["s11", "s15"], outcome="confirmed"),
    ep(13, "event", "2033-03-16", "Offer for the three-room flat in via Pignolo (top floor, small terrace) accepted.",
       ["s12"], ["Martina"]),
    ep(14, "event", "2033-03-19", "Smash Seriate beat Stezzano 3-0; Giacomo MVP with 14 points.", ["s13"]),
    ep(15, "plan", "2033-03-20", "Lunch for Ezio's 70th birthday at agriturismo Il Castagneto, Clusone (requested by "
       "Rosanna); happened, everyone there incl. Federico and Anna.", ["s02", "s14"], ["Ezio", "Rosanna", "Federico",
       "Anna", "Martina"], "confirmed"),
    ep(16, "state_change", "2033-03-21", "Bought a used 2029 Toyota Yaris hybrid, blue, 14,500 euro; Federico lent "
       "1,500 euro for the deposit.", ["s14", "s15"], ["Federico"]),
    ep(17, "event", "2033-03-25", "Picked up the Yaris; the Punto went to the scrapyard.", ["s15"]),
    ep(18, "event", "2033-03-28", "Signed the preliminary contract (compromesso) for via Pignolo.", ["s16"], ["Martina"]),
    ep(19, "plan", "2033-04-28", "Deed (rogito) for via Pignolo, first set for Thu 28 Apr; postponed to Fri 24 Jun "
       "(mortgage approval delayed).", ["s16", "s23"], ["Martina"], "rescheduled"),
    ep(20, "plan", "2033-04-30", "Move to via Pignolo, first set for the weekend of 30 Apr; postponed to Sat 2 Jul.",
       ["s16", "s23", "s31"], ["Martina"], "rescheduled"),
    ep(21, "state_change", "2033-04-04", "Hired as hospital pharmacist at Papa Giovanni XXIII (call on Fri 1 Apr); "
       "resigned from Farmacia Santa Grata on 4 Apr, last day Sat 30 Apr, start Mon 2 May.", ["s18", "s19"],
       ["Paola Cortinovis"]),
    ep(22, "event", "2033-04-09", "Smash Seriate beat Osio 3-2 (tie-break 15-13).", ["s20"]),
    ep(23, "plan", "2033-04-14", "Erasmus reunion in Valencia 14-17 Apr with Claire, Pieter, Joanna in a flat in Ruzafa "
       "booked by Claire; done (City of Arts and Sciences, Albufera paella, Turia park).", ["s07", "s17", "s21", "s22"],
       ["Claire", "Pieter", "Joanna"], "confirmed"),
    ep(24, "event", "2033-04-16", "Called his mother from the Albufera for her birthday; friends sang on video.",
       ["s22"], ["Rosanna"]),
    ep(25, "event", "2033-04-21", "Repaid Federico the first instalment, 750 euro, by bank transfer.", ["s23"],
       ["Federico"]),
    ep(26, "plan", "2033-06-30", "Repay Federico the second 750-euro instalment in June.", ["s14", "s23"], ["Federico"],
       "unresolved", precision="month"),
    ep(27, "plan", "2033-04-29", "Farewell dinner with Santa Grata colleagues (Irene's proposal) on Fri 29 Apr; "
       "happened in a trattoria, gift: a lab coat embroidered «dottor Galenica».", ["s19", "s24"],
       ["Paola Cortinovis", "Samuele Rota", "Irene Pesenti"], "confirmed"),
    ep(28, "plan", "2033-05-12", "Dentist check-up after the filling, Thu 12 May at 18; outcome never reported.",
       ["s24"], outcome="unresolved"),
    ep(29, "event", "2033-05-02", "First day at the Papa Giovanni XXIII hospital pharmacy (oncology compounding).",
       ["s25"]),
    ep(30, "event", "2033-05-07", "Smash Seriate lost the playoff semifinal 0-3 to Treviglio; season over.", ["s26"]),
    ep(31, "plan", "2033-05-15", "Bike trip to Monte Isola (Lake Iseo) with Martina, set for Sun 15 May; rained off, "
       "done Sun 22 May (lunch in Carzano, Ceriola sanctuary).", ["s28", "s29", "s31"], ["Martina"], "rescheduled"),
    ep(32, "plan", None, "Decide in September whether to keep playing volleyball next season.", ["s29"],
       outcome="unresolved"),
    ep(33, "event", "2033-05-20", "Second blood donation of the year at AVIS (lunch break).", ["s30"]),
    # third-party news (dated when said)
    ep(34, "event", "2033-02-10", "Federico and Anna expect a baby, due end of August.", ["s02"], ["Federico", "Anna"]),
    ep(35, "event", "2033-02-14", "Pietro broke his wrist skiing at Foppolo, out six weeks.", ["s04"], ["Pietro"]),
    ep(36, "event", "2033-03-07", "Irene Pesenti announced she marries Matteo in June.", ["s09"], ["Irene Pesenti"]),
    ep(37, "event", "2033-03-19", "Tiziano moves to Lugano for work from 2 Apr, commuting, staying in the team.",
       ["s13"], ["Tiziano"]),
    ep(38, "event", "2033-03-29", "Pieter promoted to head of the port logistics team in Rotterdam.", ["s17"],
       ["Pieter"]),
    ep(39, "event", "2033-05-11", "Federico and Anna's baby is a girl, to be named Bianca.", ["s27"],
       ["Federico", "Anna"]),
]

FACTS = [
    {"key": "car", "history": [
        {"value": "grey 2014 Fiat Punto", "from": None, "to": "2033-03-25", "sessions": ["s01", "s08", "s10", "s15"]},
        {"value": "blue 2029 Toyota Yaris hybrid (used)", "from": "2033-03-25", "to": None, "sessions": ["s14", "s15"]},
    ]},
    {"key": "employer", "history": [
        {"value": "pharmacist at Farmacia Santa Grata, Bergamo", "from": None, "to": "2033-04-30", "sessions": ["s01", "s18"]},
        {"value": "hospital pharmacist at Papa Giovanni XXIII, Bergamo", "from": "2033-05-02", "to": None,
         "sessions": ["s18", "s25"]},
    ]},
    {"key": "home", "history": [
        {"value": "rented flat in via Borgo Palazzo, Bergamo, with Martina", "from": None, "to": None,
         "sessions": ["s01", "s23"]},
    ]},
    {"key": "mother_birthday", "history": [
        {"value": "16 April (first stated as 14 April, corrected)", "from": None, "to": None, "sessions": ["s01", "s10"]},
    ]},
    {"key": "debt_to_federico", "history": [
        {"value": "1,500 euro", "from": "2033-03-21", "to": "2033-04-21", "sessions": ["s14"]},
        {"value": "750 euro (second instalment due in June)", "from": "2033-04-21", "to": None, "sessions": ["s23"]},
    ]},
    {"key": "work_schedule", "history": [
        {"value": "Mon-Fri 8-16 plus one Saturday morning a month", "from": "2033-05-02", "to": None, "sessions": ["s25"]},
    ]},
]

NOTES = [
    {"category": "people", "content": "Partner Martina Locatelli, freelance graphic designer.", "sessions": ["s01"]},
    {"category": "people", "content": "Parents Rosanna and Ezio live in Clusone; brother Federico (software developer) "
     "lives in Milan with his wife Anna.", "sessions": ["s01", "s23"]},
    {"category": "people", "content": "Erasmus friends from Valencia 2015: Claire (Dublin), Pieter (Rotterdam), Joanna "
     "(Kraków); next reunion planned in Kraków next year.", "sessions": ["s07", "s22"]},
    {"category": "routine", "content": "Plays amateur CSI volleyball with Smash Seriate: training Wednesday evening, "
     "matches on Saturday; teammates Tiziano, Pietro, Omar.", "sessions": ["s01", "s04"]},
    {"category": "routine", "content": "Runs three times a week with a long run on Sunday; donates blood at AVIS.",
     "sessions": ["s03", "s05", "s30"]},
    {"category": "work", "content": "Qualified to vaccinate in pharmacies (course of 15 March 2033).", "sessions": ["s12"]},
]

NOT_MEMORIES = [
    {"sessions": ["s02", "s27"], "content": "Giacomo and Martina marry in autumn (Ezio citing zia Lucia).",
     "why": "claim by others, denied by the owner on 11 May"},
    {"sessions": ["s02"], "content": "Rosanna asks the assistant to remind Giacomo of the 20 March lunch.",
     "why": "message to the assistant by someone else (the owner confirmed attending; the lunch is an episode)"},
    {"sessions": ["s04"], "content": "Omar: Giacomo owes him a beer (asked the assistant to record it).",
     "why": "message to the assistant by someone else; denied by the owner, confirmed paid by Tiziano"},
    {"sessions": ["s04", "s20"], "content": "Giacomo will be team captain next season (Tiziano).",
     "why": "claim by others, never confirmed; owner unsure whether he will play"},
    {"sessions": ["s09"], "content": "Paola asks the assistant to remind everyone of the inventory on Sat 26 March 14:00.",
     "why": "message to the assistant by someone else (a work event, not a plan stated by the owner)"},
    {"sessions": ["s09", "s19"], "content": "Giacomo is leaving for a pharmacy / job in Milan (Samuele).",
     "why": "claim by others, denied twice by the owner"},
    {"sessions": ["s17"], "content": "Joanna asks the assistant to remember that Giacomo brings one bottle of Valcalepio "
     "and the casoncelli recipe.", "why": "message to the assistant by someone else; owner amended to two bottles"},
    {"sessions": ["s19"], "content": "Samuele: Giacomo leaves him his road bike (asked the assistant to record it).",
     "why": "message to the assistant by someone else; denied by the owner"},
    {"sessions": ["s15"], "content": "The Yaris is grey (assistant's wrong recall).", "why": "corrected by the owner: blue"},
    {"sessions": ["s21"], "content": "The half marathon was in Brescia (assistant's wrong recall).",
     "why": "wrong recall, ignored by the owner; it was the Mezza di Bergamo"},
    {"sessions": ["s23"], "content": "Federico lives in Monza (assistant's wrong recall).",
     "why": "corrected by the owner: Milan"},
    {"sessions": ["s26"], "content": "The semifinal was against Dalmine (assistant's wrong recall).",
     "why": "corrected by the owner: Treviglio"},
    {"sessions": ["s27"], "content": "Giacomo sold the Punto to a young man from Clusone (zia Lucia via Rosanna).",
     "why": "claim by others, denied: the Punto was scrapped"},
    {"sessions": ["s27"], "content": "Giacomo and Martina want to get a dog after the move (Rosanna citing Federico).",
     "why": "claim by others, never confirmed by the owner"},
]
