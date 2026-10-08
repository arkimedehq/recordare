# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Source of dataset_blind5/gold.json: what an ideal memory should hold for Nunzia after s60.

episodes: kind event | plan | state_change; plan_outcome confirmed | cancelled | rescheduled | unresolved
(null for non-plans). facts: single- or multi-valued states with world-time history (a correction
replaces the value from the start: the old value was never true, see `corrected_from`).
"""


def E(id_, sessions, content, kind, date, precision="day", people=(), outcome=None):
    return {"id": id_, "sessions": list(sessions), "content": content, "kind": kind, "date": date,
            "date_precision": precision, "people": list(people), "plan_outcome": outcome}


EPISODES = [
    E("g-e01", ["s01"], "Introduced herself: Nunzia Caruso, 57, pharmacist at Farmacia Talete (Siracusa, viale Teocrito) for 22 years, owner dott. Corrado Inguaggiato; rented flat in via della Giudecca, Ortigia; divorced; children Marta (28, Catania, married to Davide, expecting a girl end of April) and Salvo (31, software engineer in Dublin, girlfriend Aoife); mother Concetta (84) alone in Noto; cat Pirandello; grey 2011 Lancia Ypsilon; alto in Coro polifonico Santa Lucia (Thursday 21:00); book club «Le Lettrici di Ortigia» first Tuesday of the month at Lina's", "state_change", "2029-02-05", people=["Marta", "Salvo", "Concetta", "Lina", "Corrado Inguaggiato"]),
    E("g-e02", ["s01"], "February book club meeting cancelled (Lina had the flu)", "plan", "2029-02-06", people=["Lina"], outcome="cancelled"),
    E("g-e03", ["s02", "s40", "s54", "s55", "s56", "s57"], "Trip to Dublin to visit Salvo: planned 7–14 June, moved on 16 May to 28 June–5 July (Salvo's work trip to Berlin; flight change €90); took place 28 June–5 July", "plan", "2029-06-28", people=["Salvo", "Aoife"], outcome="rescheduled"),
    E("g-e04", ["s03"], "Asked the assistant for an Excel formula for days to expiry of drugs (help request)", "event", "2029-02-10"),
    E("g-e05", ["s04"], "GP dott.ssa Amato measured blood pressure 150/95; booked cardiology visit with dott. Bellomo for Tue 6 March 10:30; worried (father had a heart attack at 70)", "event", "2029-02-13", people=["dott.ssa Amato", "dott. Bellomo"]),
    E("g-e06", ["s04", "s10", "s17", "s22"], "Cardiology visit with dott. Bellomo: 6 March 10:30 → moved (conference in Rome) to 20 March 11:00 → moved (Bellomo's flu) to 3 April 9:00; took place 3 April", "plan", "2029-04-03", people=["dott. Bellomo"], outcome="rescheduled"),
    E("g-e07", ["s05"], "Choir rehearsal; preparing Pergolesi's Stabat Mater for the 24 March concert; got a solo part in «Quis est homo» from maestro Gino Pappalardo", "event", "2029-02-15", people=["Gino Pappalardo"]),
    E("g-e08", ["s06"], "Lunch at her mother's in Noto (pasta con le sarde); mother struggles with the stairs and refuses a carer; idea of a handrail", "event", "2029-02-18", people=["Concetta"]),
    E("g-e09", ["s07"], "Met Enzo Gulino (61, widower, retired sailing instructor of the Lega Navale, boat «Ninfa») at a dinner at Lina's", "event", "2029-02-17", people=["Enzo", "Lina"]),
    E("g-e10", ["s07", "s08"], "Coffee with Enzo at Caffè del Porto (two hours) and walk on lungomare Alfeo; felt happy and nervous", "plan", "2029-02-23", people=["Enzo"], outcome="confirmed"),
    E("g-e11", ["s09"], "Asked the assistant to write an English thank-you email to Brendan and Maeve Kelly (Aoife's parents) for a book about Irish gardens (help request)", "event", "2029-02-27", people=["Brendan Kelly", "Maeve Kelly"]),
    E("g-e12", ["s11"], "Visited her mother in Noto; the handrail was installed; told her about Enzo; lunch pasta alla Norma", "event", "2029-03-04", people=["Concetta"]),
    E("g-e13", ["s12"], "Book club at Lina's on «Lessico famigliare» (Ginzburg): Nunzia loved it, Lina found it boring; next book «Il Gattopardo»", "event", "2029-03-06", people=["Lina"]),
    E("g-e14", ["s13"], "Dinner with Enzo at Trattoria Don Saro (Ortigia) on Women's Day, mimosa; skipped choir rehearsal; first kiss, now a couple", "event", "2029-03-08", people=["Enzo"]),
    E("g-e15", ["s14"], "Family group chat: Marta at 33 weeks, due date 28 April; Salvo becomes team lead from April (six people)", "event", "2029-03-11", people=["Marta", "Salvo"]),
    E("g-e16", ["s15"], "Sunset walk at the Plemmirio with Enzo", "event", "2029-03-13", people=["Enzo"]),
    E("g-e17", ["s15"], "Colleague Francesco «Ciccio» Lombardo resigned from Farmacia Talete; from April works at a pharmacy in Sliema, Malta", "event", "2029-03-14", people=["Ciccio"]),
    E("g-e18", ["s15", "s16"], "Marta's baby shower at her home in Catania (first said Sunday 18, corrected to Saturday 17); ~20 people; Nunzia gave a yellow crocheted blanket", "plan", "2029-03-17", people=["Marta", "Davide", "Franca"], outcome="confirmed"),
    E("g-e19", ["s18"], "Choir dress rehearsal at Santa Lucia al Sepolcro; voice trembling", "event", "2029-03-22"),
    E("g-e20", ["s05", "s18", "s19"], "Stabat Mater concert at the basilica of Santa Lucia al Sepolcro: solo in «Quis est homo» went well, ~200 people, Enzo in the second row with red roses, maestro said «brava»", "plan", "2029-03-24", people=["Enzo", "Gino Pappalardo"], outcome="confirmed"),
    E("g-e21", ["s20"], "Called for an interview for director of the Farmacia Comunale di Noto (applied in February); asked the assistant to simulate the interview (help request)", "event", "2029-03-28"),
    E("g-e22", ["s21"], "Easter lunch at her mother's in Noto with Enzo (first meeting; mother approves)", "event", "2029-04-01", people=["Enzo", "Concetta"]),
    E("g-e23", ["s21"], "Salvo's Easter visit cancelled: flight cancelled by an air-traffic-control strike", "plan", "2029-04-01", people=["Salvo"], outcome="cancelled"),
    E("g-e24", ["s22"], "Cardiology visit: ECG and echo normal, grade-1 hypertension, ramipril 5 mg every morning from 4 April", "state_change", "2029-04-03", people=["dott. Bellomo"]),
    E("g-e25", ["s12", "s22"], "Book club on «Il Gattopardo»: Nunzia found it beautiful but slow; next meeting moved from 1 May to 8 May («La Storia»)", "event", "2029-04-03", people=["Lina"]),
    E("g-e26", ["s20", "s23"], "Job interview at Palazzo Ducezio, Noto (committee incl. the pharmacist who will be her deputy, Paola — surname later corrected to Ferrante)", "event", "2029-04-06", people=["Paola Ferrante"]),
    E("g-e27", ["s24", "s25", "s26"], "Weekend in Palermo with Lina (La traviata at Teatro Massimo, 14–15 April) cancelled because of her mother's fall; Lina went with her sister Pina", "plan", "2029-04-14", people=["Lina", "Pina"], outcome="cancelled"),
    E("g-e28", ["s25"], "Mother fell in the bathroom around 23:00, femoral neck fracture, Avola hospital; Nunzia felt guilty", "event", "2029-04-10", people=["Concetta"]),
    E("g-e29", ["s25", "s26"], "Mother's hip surgery (prosthesis), went well", "event", "2029-04-13", people=["Concetta"]),
    E("g-e30", ["s27"], "Got the job of director of the Farmacia Comunale di Noto, starting 2 May; resigned from Talete (last day 30 April)", "state_change", "2029-04-16"),
    E("g-e31", ["s28"], "Last choir rehearsal she mentioned (distracted); plan to look at used cars at Autosud", "event", "2029-04-19"),
    E("g-e32", ["s29", "s31"], "Chose a white 2023 Peugeot 208 1.2 petrol at Autosud, Ypsilon traded in; price corrected from €13,500 to €12,800", "event", "2029-04-21", people=["Enzo"]),
    E("g-e33", ["s30"], "Choir group chat: rehearsal of 26 April suspended (next 3 May); Rita marries Alfio on Saturday 15 September; Rita's unconfirmed claim that Nunzia moves to Malta; Tano's joke claims (owes him €50, allergic to shellfish)", "event", "2029-04-24", people=["Rita", "Tano", "Gino Pappalardo"]),
    E("g-e34", ["s29", "s31"], "Collected the white Peugeot 208; Ypsilon left at the dealer", "state_change", "2029-04-26"),
    E("g-e35", ["s32", "s33"], "Granddaughter Giulia born to Marta and Davide at 23:40 (3.2 kg, 50 cm), Catania", "event", "2029-04-27", people=["Marta", "Davide", "Giulia"]),
    E("g-e36", ["s33"], "Held Giulia at the hospital in Catania; cried with emotion", "event", "2029-04-28", people=["Giulia", "Marta"]),
    E("g-e37", ["s34"], "Last day at Farmacia Talete; surprise farewell aperitivo, gift: fountain pen engraved N.C.; cried", "state_change", "2029-04-30"),
    E("g-e38", ["s35"], "First day as director of the Farmacia Comunale di Noto (staff: Paola, Salvatore, Giusi); mother moved to rehab at Villa Mimosa (Noto) from 30 April", "state_change", "2029-05-02", people=["Paola Ferrante", "Concetta"]),
    E("g-e39", ["s36"], "Visit with Enzo to the Zampa Libera shelter; chose a black-and-tan mixed-breed female", "event", "2029-05-05", people=["Enzo"]),
    E("g-e40", ["s37"], "Book club on «La Storia» (Morante), at page 300", "event", "2029-05-08", people=["Lina"]),
    E("g-e41", ["s37"], "Federfarma conference in Catania proposed by Paola for Saturday 26 May («maybe»)", "plan", "2029-05-26", people=["Paola Ferrante"], outcome="unresolved"),
    E("g-e42", ["s38"], "58th birthday: dinner at Don Saro with Enzo; gift: sailing course at the Lega Navale (8 Sunday lessons from 20 May)", "event", "2029-05-09", people=["Enzo"]),
    E("g-e43", ["s36", "s39"], "Adopted the dog Ciuri (female, ~2 years, black and tan, 14 kg) from Zampa Libera; Pirandello hissed", "state_change", "2029-05-12"),
    E("g-e44", ["s41"], "Helped an elderly customer with a weekly pill organiser together with Paola Ferrante", "event", "2029-05-18", people=["Paola Ferrante"]),
    E("g-e45", ["s42"], "Sailing lesson 1 (instructor Marco, dinghy, fell in the water)", "event", "2029-05-20", people=["Marco"]),
    E("g-e46", ["s43"], "Asked the assistant to write a two-minute speech for Lina's retirement party (help request)", "event", "2029-05-23", people=["Lina"]),
    E("g-e47", ["s44"], "Medea at the Greek Theatre with Lina", "event", "2029-05-26", people=["Lina"]),
    E("g-e48", ["s44"], "Sailing lesson 2 (points of sail)", "event", "2029-05-27", people=["Marco"]),
    E("g-e49", ["s45"], "Decided to move to Noto: rented house via Rocco Pirri 12 (two bedrooms, courtyard, €550/month); lease to sign 19 June, move 23 June; plan to paint the kitchen sage green", "plan", "2029-05-31", outcome="confirmed"),
    E("g-e50", ["s43", "s46"], "Lina's retirement party (38 years teaching Latin at liceo Gargallo): read the speech, gift an e-bike, Enzo played guitar", "event", "2029-06-02", people=["Lina", "Enzo"]),
    E("g-e51", ["s47"], "Sailing lesson 3: first solo tack", "event", "2029-06-03", people=["Marco"]),
    E("g-e52", ["s47"], "Skipped the June book club meeting (tired, boxes)", "event", "2029-06-05"),
    E("g-e53", ["s47"], "Carmen Consoli concert at the Teatro Antico, Taormina, Friday 22 June (Enzo wants to go, «maybe»)", "plan", "2029-06-22", people=["Enzo"], outcome="unresolved"),
    E("g-e54", ["s48"], "Edipo re at the Greek Theatre with Enzo (hot; Enzo fell asleep); preferred Medea", "event", "2029-06-08", people=["Enzo"]),
    E("g-e55", ["s49"], "Sailing lesson 4: 12 knots, at the helm", "event", "2029-06-10", people=["Marco"]),
    E("g-e56", ["s49"], "Fish dinner at Marzamemi proposed by Enzo for Saturday 16 June («we'll see»)", "plan", "2029-06-16", people=["Enzo"], outcome="unresolved"),
    E("g-e57", ["s50"], "Health authority inspection at the Noto pharmacy: perfect", "event", "2029-06-13", people=["Paola Ferrante"]),
    E("g-e58", ["s51"], "Sailing lesson of 17 June cancelled (mistral 25 knots)", "plan", "2029-06-17", outcome="cancelled"),
    E("g-e59", ["s51"], "Mother back home from rehab with a walker", "event", "2029-06-15", people=["Concetta"]),
    E("g-e60", ["s51", "s52"], "Live-in carer Irina (Moldovan) started at her mother's", "state_change", "2029-06-18", people=["Irina", "Concetta"]),
    E("g-e61", ["s45", "s52"], "Signed the lease of via Rocco Pirri 12 at the agency, got the keys", "event", "2029-06-19"),
    E("g-e62", ["s45", "s52"], "Painted the kitchen sage green with Enzo", "event", "2029-06-20", people=["Enzo"]),
    E("g-e63", ["s52"], "Thursday dinner at her mother's (now a fixed weekly appointment)", "event", "2029-06-21", people=["Concetta", "Irina"]),
    E("g-e64", ["s53"], "Moved to Noto (via Rocco Pirri 12) with Enzo and Davide; sailing lesson of 24 June skipped", "state_change", "2029-06-23", people=["Enzo", "Davide"]),
    E("g-e65", ["s54"], "Returned the keys of the Ortigia flat; asked the assistant what to pack and see in Dublin (help request)", "event", "2029-06-27"),
    E("g-e66", ["s55"], "Dinner with Brendan and Maeve Kelly in Howth; Salvo and Aoife announced their engagement (wedding next year in Ireland)", "event", "2029-06-29", people=["Salvo", "Aoife", "Brendan Kelly", "Maeve Kelly"]),
    E("g-e67", ["s56"], "Trinity College and the Book of Kells in the rain; pub with Salvo, disliked Guinness", "event", "2029-07-02", people=["Salvo"]),
    E("g-e68", ["s57"], "Flew back to Catania (landed 21:10), Enzo picked her up; photo of Pirandello and Ciuri sleeping together", "event", "2029-07-05", people=["Enzo"]),
    E("g-e69", ["s58"], "Marta, Davide and Giulia visited the new house; Giulia met her great-grandmother; photo of four generations", "event", "2029-07-07", people=["Marta", "Davide", "Giulia", "Concetta"]),
    E("g-e70", ["s59"], "Sailing lesson 5 (three left, to be recovered in September)", "event", "2029-07-08", people=["Marco"]),
    E("g-e71", ["s60"], "Enzo has brought his things to via Rocco Pirri and his name is on the intercom (de facto cohabitation, never announced); mother now walks with a cane; home delivery for the elderly to start in September", "state_change", "2029-07-10", people=["Enzo", "Concetta"]),
]

FACTS = [
    {"key": "employer", "history": [
        {"value": "Farmacia Talete, Siracusa (pharmacist, 22 years; owner dott. Corrado Inguaggiato)", "from": None, "to": "2029-04-30"},
        {"value": "Farmacia Comunale di Noto (director; deputy Paola Ferrante)", "from": "2029-05-02", "to": None}]},
    {"key": "home", "history": [
        {"value": "Rented flat in via della Giudecca, Ortigia (Siracusa), third floor, no lift", "from": None, "to": "2029-06-23"},
        {"value": "Rented house with courtyard, via Rocco Pirri 12, Noto (€550/month)", "from": "2029-06-23", "to": None}]},
    {"key": "car", "history": [
        {"value": "Grey 2011 Lancia Ypsilon", "from": None, "to": "2029-04-26"},
        {"value": "White 2023 Peugeot 208 1.2 petrol (€12,800 with trade-in; first stated €13,500, corrected)", "from": "2029-04-26", "to": None}]},
    {"key": "pets (multi-valued)", "history": [
        {"value": "cat Pirandello (grey tabby, 9)", "from": None, "to": None},
        {"value": "dog Ciuri (female mixed breed, black and tan, ~2, 14 kg)", "from": "2029-05-12", "to": None}]},
    {"key": "relationship", "history": [
        {"value": "single (divorced)", "from": None, "to": "2029-03-08"},
        {"value": "with Enzo Gulino", "from": "2029-03-08", "to": None},
        {"value": "with Enzo Gulino, de facto living together in Noto (inferred, never announced)", "from": "2029-07-10", "to": None, "inferred": True}]},
    {"key": "medication", "history": [
        {"value": "ramipril 5 mg every morning (grade-1 hypertension)", "from": "2029-04-04", "to": None}]},
    {"key": "blood pressure", "history": [
        {"value": "about 145–150/95 (high)", "from": "2029-02-13", "to": "2029-04-03"},
        {"value": "average 128/80 on ramipril", "from": "2029-06-14", "to": None}]},
    {"key": "choir (Coro polifonico Santa Lucia)", "history": [
        {"value": "attends Thursday rehearsals (alto)", "from": None, "to": "2029-04-19"},
        {"value": "probably no longer attends (inferred: Thursday evenings at her mother's in Noto; never announced)", "from": "2029-06-21", "to": None, "inferred": True}]},
    {"key": "hobbies (multi-valued)", "history": [
        {"value": "choir", "from": None, "to": None},
        {"value": "book club «Le Lettrici di Ortigia»", "from": None, "to": None},
        {"value": "sailing course at the Lega Navale (5 of 8 lessons done by 8 July)", "from": "2029-05-20", "to": None}]},
    {"key": "deputy at the Noto pharmacy", "history": [
        {"value": "Paola Ferrante", "from": "2029-05-02", "to": None, "corrected_from": "Paola Ferro (name error, never true)"}]},
    {"key": "mother's living situation", "history": [
        {"value": "alone in her house in Noto", "from": None, "to": "2029-04-10"},
        {"value": "hospital (Avola) then rehab at Villa Mimosa, Noto", "from": "2029-04-10", "to": "2029-06-15"},
        {"value": "home in Noto with live-in carer Irina (from 18 June); walker, then a cane", "from": "2029-06-15", "to": None}]},
    {"key": "grandchildren", "history": [
        {"value": "Giulia (Marta's daughter)", "from": "2029-04-27", "to": None}]},
    {"key": "Salvo's status", "history": [
        {"value": "software engineer in Dublin, with Aoife", "from": None, "to": "2029-04-01"},
        {"value": "team lead (six people)", "from": "2029-04-01", "to": None},
        {"value": "engaged to Aoife", "from": "2029-06-29", "to": None}]},
]

NOTES = [
    {"category": "profile", "content": "Nunzia Caruso, born 9 May 1971 (58 since 9 May 2029); from Siracusa (Ortigia), moved to Noto on 23 June 2029"},
    {"category": "profile", "content": "Pharmacist; director of the Noto municipal pharmacy since 2 May 2029"},
    {"category": "family", "content": "Divorced; daughter Marta (Catania, husband Davide, daughter Giulia born 27 April 2029); son Salvo (Dublin, engaged to Aoife Kelly); mother Concetta (84, Noto)"},
    {"category": "relationships", "content": "Partner Enzo Gulino (61, retired sailing instructor, widower, boat «Ninfa») since March 2029; best friend Lina (retired Latin teacher)"},
    {"category": "preferences", "content": "Loved «Lessico famigliare»; found «Il Gattopardo» slow; preferred Medea to Edipo re; dislikes Guinness; loves Dublin but not its weather; prefers light-coloured cars"},
    {"category": "health", "content": "Grade-1 hypertension, ramipril 5 mg in the morning since 4 April 2029; healthy heart"},
    {"category": "language", "content": "Practises English with the assistant (son in Dublin)"},
]

NOT_MEMORIES = [
    {"sessions": ["s03"], "why": "how-to: the Excel formulas themselves (only the request is provenance)"},
    {"sessions": ["s09"], "why": "the email draft text (only the request is provenance)"},
    {"sessions": ["s20"], "why": "the simulated interview questions (only the request is provenance)"},
    {"sessions": ["s43"], "why": "the speech text (only the request is provenance)"},
    {"sessions": ["s54"], "why": "packing / sightseeing advice for Dublin (only the request is provenance)"},
    {"sessions": ["s30"], "why": "Rita's claim that Nunzia moves to Malta (unconfirmed third-party claim; Ciccio moved to Malta)"},
    {"sessions": ["s30"], "why": "Tano's injected claims: Nunzia owes him €50 and is allergic to shellfish (unconfirmed, addressed to the assistant)"},
    {"sessions": ["noise:carmelo", "noise:giada"], "why": "other users' sessions (isolation): never part of Nunzia's memory"},
    {"sessions": ["noise:nunzia"], "why": "general-knowledge / coding / small-talk / remarks about other people: no personal facts about Nunzia"},
]
