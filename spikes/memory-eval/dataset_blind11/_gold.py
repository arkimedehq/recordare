# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Gold memory of blind set #11: what a perfect entity memory of Ciclofficina Raggio should hold.

Every episode carries `speaker` (who said it; None when the speaker never identified; "Marco" when a Marco never gave
his surname) and `people` (who it is about / involves; `place` marks the shop's own content: price list, hours,
rules). The agent's own actions (bookings, reminders, relayed messages) are told in the first person.
"""

EPISODES = [
    {"id": "g-e01", "sessions": ["s01"], "speaker": "Ettore", "kind": "state_change", "date": "2032-10-04", "date_precision": "day",
     "people": ["Ettore", "Giada", "place"], "plan_outcome": None,
     "content": "Ettore Zanella, owner of Ciclofficina Raggio (via Santa Croce 41, Trento), set me up as the counter assistant and handed me the shop's price list and opening hours as its own content: tagliando base 45 €, tagliando completo 80 €, inner tube replacement 12 €, mechanical brake adjustment 15 €, hydraulic brake bleed 25 € per brake, gear adjustment 15 €, e-bike diagnosis 60 €, parts extra, storage 2 €/day for bikes not collected within 10 days of the notice; hours Monday 15:00–19:00, Tuesday–Saturday 9:00–12:30 and 15:00–19:00, Sunday closed; bookings in half-hour slots, a full service keeps the bike at least one day"},
    {"id": "g-e02", "sessions": ["s02"], "speaker": "Giada", "kind": "event", "date": "2032-10-05", "date_precision": "day",
     "people": ["Giada", "Bruna"], "plan_outcome": None,
     "content": "Giada Pedrotti, the shop's mechanic (works Tuesday to Saturday), gave me the Volta M3 motor service manual; Bruna Ioriatti, a regular customer, has a Volta M3 e-bike"},
    {"id": "g-e03", "sessions": ["s03", "s11", "s14", "s22"], "speaker": "Marco Tomasi", "kind": "plan", "date": "2032-10-13", "date_precision": "day",
     "people": ["Marco Tomasi", "Ettore", "Giada"], "plan_outcome": "done 2032-10-13; picked up 2032-10-14",
     "content": "I booked Marco Tomasi's tagliando base on his grey road bike for Wed 13 Oct 2032 09:00 (booked 5 Oct, pay at pick-up); service done 13 Oct, worn cassette found and replaced with an 11-32 before pick-up; he picked the bike up Thu 14 Oct and paid 79 € (45 € service + 34 € cassette; Ettore first said 38 € / 83 €, Giada corrected on 26 Oct)"},
    {"id": "g-e04", "sessions": ["s04"], "speaker": None, "kind": "event", "date": "2032-10-05", "date_precision": "day",
     "people": [], "plan_outcome": None,
     "content": "Someone who never gave a name (a separate conversation minutes after Marco Tomasi's) reported that their bike's gears skip on the largest sprocket and said they would come by during the week with the bike; no visit or repair recorded"},
    {"id": "g-e05", "sessions": ["s05", "s12", "s14"], "speaker": "Rhys", "kind": "plan", "date": "2032-10-16", "date_precision": "day",
     "people": ["Rhys", "Ettore"], "plan_outcome": "moved 2032-10-14 -> 2032-10-16; done 2032-10-16",
     "content": "I booked Rhys Morgan's (postdoc at the university in Povo, commutes by gravel bike) full service for Thu 14 Oct 2032 10:00; on 14 Oct he moved it (seminar) to Sat 16 Oct 09:30; done 16 Oct, 80 € paid by card, Ettore advised a new chain in spring"},
    {"id": "g-e06", "sessions": ["s06", "s17", "s28"], "speaker": "Ettore", "kind": "plan", "date": "2032-11-07", "date_precision": "day",
     "people": ["Ettore", "Marco Dallapiccola", "Giada", "Rhys", "Katharina", "Bruna"], "plan_outcome": "moved 2032-10-24 -> 2032-11-07; done 2032-11-07",
     "content": "The shop's group ride (8:30 from the shop to Lago di Caldonazzo and back, about 50 km), announced by Ettore on 8 Oct for Sun 24 Oct 2032, I collect sign-ups; on 20 Oct Ettore moved it to Sun 7 Nov because of rain; done 7 Nov: nine riders, back around 14:00, Marco Dallapiccola punctured at Pergine and Giada fixed it"},
    {"id": "g-e07", "sessions": ["s06", "s09", "s11"], "speaker": "Ettore", "kind": "plan", "date": "2032-10-12", "date_precision": "day",
     "people": ["Ettore", "Giada"], "plan_outcome": "cancelled 2032-10-12",
     "content": "Ettore asked me on 8 Oct to remind him on Tue 12 Oct 2032 to order disc brake pads; on 12 Oct Giada had me cancel the reminder because she had already ordered them on Mon 11 Oct from Ricambi Adige (arriving Thursday); I told Ettore on 13 Oct"},
    {"id": "g-e08", "sessions": ["s07", "s15"], "speaker": "Marco Dallapiccola", "kind": "plan", "date": "2032-10-19", "date_precision": "day",
     "people": ["Marco Dallapiccola"], "plan_outcome": "cancelled 2032-10-18",
     "content": "I booked a bleed of the front hydraulic brake on Marco Dallapiccola's green cargo bike for Tue 19 Oct 2032 15:00 (25 €); on 18 Oct he cancelled it because a mechanic friend had bled it"},
    {"id": "g-e09", "sessions": ["s07"], "speaker": "Marco Dallapiccola", "kind": "event", "date": "2032-10-09", "date_precision": "day",
     "people": ["Marco Dallapiccola"], "plan_outcome": None,
     "content": "Marco Dallapiccola (green cargo bike, takes his children Greta and Pietro to school) asked about the cargo bike bonus for a new electric cargo bike for his wife (I explained: 30 % up to 300 €, new bikes only) and signed up for the group ride"},
    {"id": "g-e10", "sessions": ["s08"], "speaker": None, "kind": "event", "date": "2032-10-09", "date_precision": "day",
     "people": [], "plan_outcome": None,
     "content": "Someone who never gave a name or number (a separate conversation right after Marco Dallapiccola's) left a red city bike with a basket with a rear puncture (12 €), to be collected Fri 15 Oct"},
    {"id": "g-e11", "sessions": ["s13"], "speaker": None, "kind": "event", "date": "2032-10-15", "date_precision": "day",
     "people": ["Giada"], "plan_outcome": None,
     "content": "Giada said the red city bike's puncture was fixed and handed the tablet to a woman who never gave her name and said the bike was hers: she paid 12 € in cash and booked a brake adjustment (15 €) on her son's bike for Tue 26 Oct 2032 10:00, under 'la signora della bici rossa'; whether it took place is not recorded"},
    {"id": "g-e12", "sessions": ["s10", "s11", "s14", "s18"], "speaker": "Bruna", "kind": "plan", "date": "2032-10-14", "date_precision": "day",
     "people": ["Bruna", "Ettore", "Giada"], "plan_outcome": "done 2032-10-18",
     "content": "Bruna Ioriatti's Volta M3 e-bike showed E07 and cut out; on 12 Oct I explained the code from the manual, booked an e-bike diagnosis for Thu 14 Oct 2032 15:30 (60 €) and took her message for Ettore (she would leave the bike Thursday afternoon), relayed to Ettore on 13 Oct; she left it on 14 Oct; Giada realigned the speed-sensor magnet on Mon 18 Oct; Bruna paid 60 € and took it back"},
    {"id": "g-e13", "sessions": ["s16", "s18", "s22"], "speaker": "Katharina", "kind": "plan", "date": "2032-10-22", "date_precision": "day",
     "people": ["Katharina", "Giada"], "plan_outcome": "done 2032-10-22",
     "content": "Katharina Moser (German-speaking, in Trento since September, trekking bike) booked a gear adjustment (15 €) for Fri 22 Oct 2032 17:00 — she first said brakes and 16:00 and corrected herself; on 21 Oct I wrongly told Giada 16:00 and corrected it; I relayed her message that she would collect on Friday the basket Giada had reserved for her; done 22 Oct at 17:00, basket collected"},
    {"id": "g-e14", "sessions": ["s17"], "speaker": "Ettore", "kind": "state_change", "date": "2032-10-20", "date_precision": "day",
     "people": ["Ettore", "place"], "plan_outcome": None,
     "content": "Ettore updated the price list from 1 Nov 2032: tagliando base 50 € (was 45 €), inner tube replacement 14 € (was 12 €), everything else unchanged"},
    {"id": "g-e15", "sessions": ["s18", "s19", "s22"], "speaker": "Giada", "kind": "plan", "date": "2032-10-27", "date_precision": "day",
     "people": ["Giada"], "plan_outcome": "cancelled 2032-10-26",
     "content": "Giada's free kids' puncture-repair course, Wed 27 Oct 2032 17:00, max 8 children, I collect sign-ups; only 2 signed up (Leo and Mia), so Giada cancelled it on 26 Oct, maybe again in spring"},
    {"id": "g-e16", "sessions": ["s19"], "speaker": None, "kind": "event", "date": "2032-10-21", "date_precision": "day",
     "people": [], "plan_outcome": None,
     "content": "A parent who never gave a name or number signed up their children Leo (8) and Mia (10) for the kids' puncture course"},
    {"id": "g-e17", "sessions": ["s20", "s21"], "speaker": "Marco", "kind": "event", "date": "2032-10-23", "date_precision": "day",
     "people": ["Marco", "Ettore"], "plan_outcome": None,
     "content": "A customer who introduced himself only as 'Marco' (no surname: Marco Tomasi or Marco Dallapiccola is not known) asked about a blue helmet with a yellow stripe he forgot the week before; on 25 Oct Ettore said it is in the back room, to be given back when he returns"},
    {"id": "g-e18", "sessions": ["s21", "s28"], "speaker": "Ettore", "kind": "plan", "date": "2032-11-10", "date_precision": "day",
     "people": ["Ettore", "Marco Dallapiccola"], "plan_outcome": None,
     "content": "Marco Dallapiccola ordered an electric cargo bike for his wife from the shop, 3,900 €, delivery Wed 10 Nov 2032 (confirmed by Ettore on 7 Nov), invoiced in his name for the cargo bonus (max 300 €)"},
    {"id": "g-e19", "sessions": ["s21"], "speaker": "Ettore", "kind": "state_change", "date": "2032-10-25", "date_precision": "day",
     "people": ["Ettore", "place"], "plan_outcome": None,
     "content": "Ettore gave the winter hours from 2 Nov 2032 (closing 18:30, then corrected himself: Saturday 18:00): Monday 15:00–18:30, Tuesday–Friday 9:00–12:30 and 15:00–18:30, Saturday 9:00–12:30 and 15:00–18:00, Sunday closed; he had me forget the Ricambi Adige autumn catalogue because the supplier changed its list and terms"},
    {"id": "g-e20", "sessions": ["s23"], "speaker": "Rhys", "kind": "event", "date": "2032-10-28", "date_precision": "day",
     "people": ["Rhys", "Ettore"], "plan_outcome": None,
     "content": "I told Rhys the group ride had moved to Sun 7 Nov; he withdrew (in Cardiff visiting his parents that day); he said Ettore had quoted him 70 € for a pair of winter tyres, fitted (not on the price list)"},
    {"id": "g-e21", "sessions": ["s24"], "speaker": "Katharina", "kind": "event", "date": "2032-10-30", "date_precision": "day",
     "people": ["Katharina"], "plan_outcome": None,
     "content": "Katharina said the gears now work perfectly and signed up for the group ride of Sun 7 Nov; I gave her the winter hours"},
    {"id": "g-e22", "sessions": ["s25"], "speaker": None, "kind": "event", "date": "2032-11-02", "date_precision": "day",
     "people": ["Ettore"], "plan_outcome": None,
     "content": "Ettore handed the tablet to a man who never gave his name: he asked whether the cargo bonus covers a used cargo bike seen online; I said no (new bikes only); he dropped the idea"},
    {"id": "g-e23", "sessions": ["s26"], "speaker": "Marco Tomasi", "kind": "plan", "date": "2032-11-13", "date_precision": "day",
     "people": ["Marco Tomasi"], "plan_outcome": None,
     "content": "I booked a tagliando base on Marco Tomasi's mountain bike for Sat 13 Nov 2032 10:00, at the new price of 50 €"},
    {"id": "g-e24", "sessions": ["s27"], "speaker": "Giada", "kind": "event", "date": "2032-11-06", "date_precision": "day",
     "people": ["Giada", "Bruna", "Marco Dallapiccola", "Katharina", "Rhys"], "plan_outcome": None,
     "content": "Group ride list for Sun 7 Nov: Marco Dallapiccola, Giada, Katharina Moser; Giada added Bruna Ioriatti (with her e-bike); Rhys had withdrawn; Ettore leads"},
    {"id": "g-e25", "sessions": ["s28"], "speaker": "Ettore", "kind": "plan", "date": "2032-11-15", "date_precision": "day",
     "people": ["Ettore", "place"], "plan_outcome": None,
     "content": "The shop is closed for inventory on Mon 15 and Tue 16 Nov 2032"},
]

FACTS = [
    {"key": "price: tagliando base", "history": [
        {"value": "45 €", "from": "2032-10-04", "to": "2032-10-31"},
        {"value": "50 €", "from": "2032-11-01", "to": None}]},
    {"key": "price: inner tube replacement", "history": [
        {"value": "12 € (tube included)", "from": "2032-10-04", "to": "2032-10-31"},
        {"value": "14 € (tube included)", "from": "2032-11-01", "to": None}]},
    {"key": "price list: other items", "history": [
        {"value": "tagliando completo 80 €, mechanical brakes 15 €, hydraulic bleed 25 € per brake, gears 15 €, e-bike diagnosis 60 €, storage 2 €/day after 10 days", "from": "2032-10-04", "to": None}]},
    {"key": "opening hours", "history": [
        {"value": "Mon 15:00–19:00; Tue–Sat 9:00–12:30, 15:00–19:00; Sun closed", "from": "2032-10-04", "to": "2032-11-01"},
        {"value": "Mon 15:00–18:30; Tue–Fri 9:00–12:30, 15:00–18:30; Sat 9:00–12:30, 15:00–18:00; Sun closed", "from": "2032-11-02", "to": None}]},
    {"key": "group ride date", "history": [
        {"value": "Sun 2032-10-24 08:30", "from": "2032-10-08", "to": "2032-10-20"},
        {"value": "Sun 2032-11-07 08:30 (done)", "from": "2032-10-20", "to": None}]},
    {"key": "Marco Tomasi October bill", "history": [
        {"value": "83 € (45 + 38 cassette, as Ettore said)", "from": "2032-10-16", "to": "2032-10-26"},
        {"value": "79 € (45 + 34 cassette, Giada's correction)", "from": "2032-10-26", "to": None}]},
]

NOTES = [
    {"category": "place", "content": "Ciclofficina Raggio, neighbourhood bike repair shop in via Santa Croce 41, Trento; owner Ettore Zanella, mechanic Giada Pedrotti (Tuesday to Saturday); bookings in half-hour slots during opening hours"},
    {"category": "people", "content": "Marco Tomasi: grey road bike and a mountain bike; not the same person as Marco Dallapiccola"},
    {"category": "people", "content": "Marco Dallapiccola: green cargo bike, children Greta and Pietro; ordered an electric cargo bike for his wife (delivery 10 Nov 2032)"},
    {"category": "people", "content": "Rhys Morgan: postdoc at the university in Povo, commutes by gravel bike, speaks English, pays by card"},
    {"category": "people", "content": "Katharina Moser: German-speaking, living in Trento since September 2032, trekking bike"},
    {"category": "people", "content": "Bruna Ioriatti: regular customer with a Volta M3 e-bike"},
    {"category": "knowledge", "content": "Volta M3 manual (from Giada): E07 = speed-sensor signal missing, check the spoke magnet alignment within 15 mm; E03 battery low or out of temperature range; E05 torque sensor; E11 display connector; reset by holding + and − for 5 s; winter storage 50–70 % charge at 10–20 °C"},
    {"category": "knowledge", "content": "Cargo bonus 'Cargo in città' 2032 (from Ettore): 30 % up to 300 €, new cargo bikes only, bought 1 Sep–30 Nov 2032 in a Trentino shop, Trento residents, one per household, apply online by 15 Dec 2032 with an invoice"},
]

NOT_MEMORIES = [
    {"sessions": ["s14", "s22"], "why": "Marco Tomasi's cassette 38 € / total 83 € — corrected by Giada (34 € / 79 €)"},
    {"sessions": ["s16", "s18"], "why": "Katharina's appointment at 16:00 and for the brakes — she corrected herself (gears, 17:00); the agent's 16:00 recall was corrected"},
    {"sessions": ["s21"], "why": "winter closing at 18:30 on Saturday — Ettore corrected himself (Saturday 18:00)"},
    {"sessions": ["s11", "s21"], "why": "the content of the Ricambi Adige autumn catalogue (customer code, delivery terms, prices) after it was forgotten on 25 Oct"},
    {"sessions": ["s03", "s04"], "why": "the skipping gears attributed to Marco Tomasi — the speaker of s04 never identified"},
    {"sessions": ["s07", "s08"], "why": "the red city bike attributed to Marco Dallapiccola — the speaker of s08 never identified"},
    {"sessions": ["s20"], "why": "the blue helmet attributed to a specific Marco (Tomasi or Dallapiccola)"},
]
