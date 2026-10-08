# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Gold memory of blind set #8: what a perfect entity memory of the Bellandi household should hold.

Every episode carries `speaker` (who said it, or None when the speaker never identified) and `people`
(who it is about / involves; `place` marks a fact about the home or the shared car). An unidentified
statement is a valid memory but must stay unattributed.
"""

EPISODES = [
    {"id": "g-e01", "sessions": ["s01"], "speaker": "Paolo", "kind": "state_change", "date": "2033-09-26", "date_precision": "day",
     "people": ["Paolo", "Silvia", "Tommaso", "Irene", "Franca", "place"], "plan_outcome": None,
     "content": "Paolo Bellandi (52, shift supervisor in port logistics, Ravenna) introduced the household: wife Silvia (pharmacist), son Tommaso (20, engineering in Bologna, commuter), daughter Irene (15, liceo, volleyball), his mother Franca (79, living with them for two years); house in via dei Mosaici 12, Ravenna (two floors, garage); one shared car, grey 2027 Skoda Octavia station wagon"},
    {"id": "g-e02", "sessions": ["s01", "s07", "s11", "s20"], "speaker": "Paolo", "kind": "plan", "date": "2033-09-26", "date_precision": "day",
     "people": ["Paolo"], "plan_outcome": "moved 2033-10-06 -> 2033-10-13 (provisional crown); definitive crown done 2033-11-03",
     "content": "Paolo's dentist appointment (dott. Gualtieri, crown on a molar) Thu 6 Oct 2033 17:30; the practice moved it to Thu 13 Oct 17:30 (provisional crown); definitive crown Thu 3 Nov 17:30, done (reported by Silvia on 4 Nov)"},
    {"id": "g-e03", "sessions": ["s01", "s09", "s20"], "speaker": "Silvia", "kind": "plan", "date": "2033-09-26", "date_precision": "day",
     "people": ["Silvia"], "plan_outcome": "changed 2033-10-10 to the 10 km; race on 2033-11-13 still ahead",
     "content": "Silvia (pharmacist at the Farmacia Comunale of viale Alberti, shifts) enrolled in the Ravenna half marathon of Sun 13 Nov 2033 (said after Paolo handed the device over); on 10 Oct switched to the 10 km of the same day because of her knee; tapering on 4 Nov"},
    {"id": "g-e04", "sessions": ["s02"], "speaker": None, "kind": "event", "date": "2033-09-27", "date_precision": "day",
     "people": ["place"], "plan_outcome": None,
     "content": "An unidentified speaker got a 42 EUR parking fine with the shared Skoda (loading zone, via Mazzini) on Tue 27 Sep 2033; asked to be reminded to pay it on Friday and added oat milk to the shopping list"},
    {"id": "g-e05", "sessions": ["s03", "s17"], "speaker": "Tommaso", "kind": "event", "date": "2033-09-29", "date_precision": "day",
     "people": ["Tommaso"], "plan_outcome": None,
     "content": "Tommaso bought a used aluminium Bianchi road bike from a seller in Faenza for 320 EUR (first said 350, corrected on 25 Oct); kept in the garage on the right"},
    {"id": "g-e06", "sessions": ["s03", "s13"], "speaker": "Tommaso", "kind": "plan", "date": "2033-10-15", "date_precision": "day",
     "people": ["Tommaso", "Davide"], "plan_outcome": "cancelled (band cancelled the tour, tickets refunded; said 2033-10-16)",
     "content": "Tommaso's trip to Milan for the Neon Harbour concert with his friend Davide on Sat 15 Oct 2033 — cancelled by the band"},
    {"id": "g-e07", "sessions": ["s03", "s17"], "speaker": "Tommaso", "kind": "event", "date": "2033-10-25", "date_precision": "day",
     "people": ["Tommaso"], "plan_outcome": "done",
     "content": "Tommaso retook Analisi 2 on Tue 25 Oct 2033 and passed with 26"},
    {"id": "g-e08", "sessions": ["s04", "s09"], "speaker": "Silvia", "kind": "event", "date": "2033-10-01", "date_precision": "day",
     "people": ["place"], "plan_outcome": None,
     "content": "Annual boiler service on Sat 1 Oct 2033: flue gas fine, certificate renewed, 135 EUR incl. a gasket kit (first said 120, corrected on 10 Oct); next service due October 2034"},
    {"id": "g-e09", "sessions": ["s04"], "speaker": "Silvia", "kind": "event", "date": "2033-10-01", "date_precision": "day",
     "people": ["Silvia"], "plan_outcome": None,
     "content": "Silvia bought new running shoes, 140 EUR"},
    {"id": "g-e10", "sessions": ["s04", "s11"], "speaker": "Silvia", "kind": "plan", "date": "2033-10-12", "date_precision": "day",
     "people": ["Irene", "Silvia"], "plan_outcome": "done (reported by Paolo 2033-10-13; next check in two months)",
     "content": "Irene's orthodontist check (dott.ssa Pasini, braces) Wed 12 Oct 2033 15:00, Silvia took her; braces adjusted, next check in two months"},
    {"id": "g-e11", "sessions": ["s05", "s16"], "speaker": "Irene", "kind": "plan", "date": "2033-10-22", "date_precision": "day",
     "people": ["Irene"], "plan_outcome": "done: second place",
     "content": "Irene's volleyball tournament in Cesenatico with the Robur Under 16, Sat 22 Oct 2033 (minibus at 8): second place, final lost at the tie-break against Rimini; Irene named best setter"},
    {"id": "g-e12", "sessions": ["s06", "s15"], "speaker": "Franca", "kind": "plan", "date": "2033-10-14", "date_precision": "day",
     "people": ["Franca", "Paolo"], "plan_outcome": "done",
     "content": "Franca's eye check at the hospital Fri 14 Oct 2033 9:00, Paolo drove her: all fine, new glasses lenses, next check in a year"},
    {"id": "g-e13", "sessions": ["s07"], "speaker": "Paolo", "kind": "event", "date": "2033-10-05", "date_precision": "day",
     "people": ["Paolo", "Irene"], "plan_outcome": None,
     "content": "Paolo bought a cordless drill-driver at Brico for 89 EUR, to put up shelves in Irene's room"},
    {"id": "g-e14", "sessions": ["s07", "s13"], "speaker": "Paolo", "kind": "state_change", "date": "2033-10-06", "date_precision": "day",
     "people": ["place", "Paolo", "Tommaso"], "plan_outcome": None,
     "content": "Home wifi (network CasaBellandi) password: set to Mosaico-2033! by Paolo on 6 Oct 2033; changed to PinetaBlu-77 by Tommaso on 16 Oct (Paolo had left the old one on a post-it on the fridge)"},
    {"id": "g-e15", "sessions": ["s08"], "speaker": "Irene", "kind": "event", "date": "2033-10-08", "date_precision": "day",
     "people": ["Irene"], "plan_outcome": None,
     "content": "Irene got 8 in a Latin test (highest in class) and bought new volleyball knee pads, 25 EUR, with her pocket money (before handing the device to her grandmother)"},
    {"id": "g-e16", "sessions": ["s08", "s15"], "speaker": "Franca", "kind": "plan", "date": "2033-10-20", "date_precision": "day",
     "people": ["Franca", "Lucia"], "plan_outcome": "cancelled 2033-10-19 (Lucia has the flu; no new date)",
     "content": "Franca's lunch with her friend Lucia from the club, Thu 20 Oct 2033 (cappelletti) — cancelled because Lucia has the flu, to be redone later, no date (said after Irene handed the device over)"},
    {"id": "g-e17", "sessions": ["s09", "s13", "s17", "s18"], "speaker": "Silvia", "kind": "plan", "date": "2033-10-16", "date_precision": "day",
     "people": ["Aoife", "Silvia", "Tommaso", "Paolo"], "plan_outcome": "stay shortened: left 2033-10-28 instead of 2033-10-30",
     "content": "Guest Aoife (daughter of Silvia's cousin, from Cork, remote graphic designer) staying from Sun 16 Oct 2033 in Tommaso's room (Tommaso on the sofa bed), planned until Sun 30 Oct; on 25 Oct she moved her flight to Fri 28 Oct (Bologna, 14:10); Paolo drove her to Bologna airport on the 28th; she left a drawing of the house, hung in the living room"},
    {"id": "g-e18", "sessions": ["s10"], "speaker": None, "kind": "event", "date": "2033-10-12", "date_precision": "day",
     "people": ["place"], "plan_outcome": None,
     "content": "An unidentified speaker bought an air fryer on offer for 79 EUR and put it on top of the fridge"},
    {"id": "g-e19", "sessions": ["s10", "s18"], "speaker": None, "kind": "plan", "date": "2033-10-24", "date_precision": "day",
     "people": ["place", "Paolo"], "plan_outcome": "done 2033-10-24 (reported by Paolo 2033-10-31)",
     "content": "Skoda service at officina Casadei Mon 24 Oct 2033 8:30, booked by an unidentified speaker on 12 Oct; done: service plus winter tyres, 210 EUR in total (reported by Paolo)"},
    {"id": "g-e20", "sessions": ["s12"], "speaker": None, "kind": "plan", "date": "2033-10-17", "date_precision": "day",
     "people": [], "plan_outcome": None,
     "content": "An unidentified speaker (morning after Paolo's conversation) joined the Virtus Fit gym in via Cesarea, 45 EUR/month from Mon 17 Oct 2033, and asked a reminder to buy a present for their sister's birthday on Wed 19 Oct"},
    {"id": "g-e21", "sessions": ["s14"], "speaker": None, "kind": "event", "date": "2033-10-17", "date_precision": "day",
     "people": ["place"], "plan_outcome": None,
     "content": "An unidentified speaker lost the spare garage keys in the town centre on the afternoon of 17 Oct 2033; to-do: have a copy made at the hardware store"},
    {"id": "g-e22", "sessions": ["s19"], "speaker": None, "kind": "event", "date": "2033-11-01", "date_precision": "day",
     "people": [], "plan_outcome": None,
     "content": "An unidentified speaker (morning after Paolo's conversation) announced their contract is renewed and becomes permanent from January 2034"},
]

FACTS = [
    {"key": "household", "history": [{"value": "Paolo, Silvia, Tommaso, Irene, Franca; via dei Mosaici 12, Ravenna", "from": None, "to": None}]},
    {"key": "shared car", "history": [{"value": "grey 2027 Skoda Octavia station wagon; serviced 2033-10-24 with winter tyres", "from": None, "to": None}]},
    {"key": "wifi password (CasaBellandi)", "history": [
        {"value": "Mosaico-2033!", "from": "2033-10-06", "to": "2033-10-16"},
        {"value": "PinetaBlu-77", "from": "2033-10-16", "to": None}]},
    {"key": "boiler last service", "history": [{"value": "2033-10-01, 135 EUR (first said 120); next due October 2034", "from": "2033-10-01", "to": None}]},
    {"key": "Irene allergy", "history": [{"value": "kiwi (Irene, 2 Oct; Franca wrongly said Tommaso, Silvia corrected 10 Oct)", "from": None, "to": None}]},
    {"key": "Tommaso diet", "history": [{"value": "vegetarian since July 2033; no allergies", "from": "2033-07", "to": None}]},
    {"key": "Silvia race 13 Nov 2033", "history": [
        {"value": "half marathon", "from": "2033-09-26", "to": "2033-10-10"},
        {"value": "10 km", "from": "2033-10-10", "to": None}]},
    {"key": "Paolo dentist", "history": [
        {"value": "Thu 6 Oct 17:30", "from": "2033-09-26", "to": "2033-10-06"},
        {"value": "Thu 13 Oct 17:30", "from": "2033-10-06", "to": "2033-10-13"},
        {"value": "definitive crown Thu 3 Nov 17:30", "from": "2033-10-13", "to": "2033-11-03"},
        {"value": "done", "from": "2033-11-03", "to": None}]},
    {"key": "Aoife stay", "history": [
        {"value": "16-30 Oct 2033", "from": "2033-10-10", "to": "2033-10-25"},
        {"value": "16-28 Oct 2033 (left)", "from": "2033-10-25", "to": None}]},
    {"key": "Tommaso bike price", "history": [
        {"value": "350 EUR (as first said)", "from": "2033-09-29", "to": "2033-10-25"},
        {"value": "320 EUR", "from": "2033-10-25", "to": None}]},
]

NOTES = [
    {"category": "people", "content": "Paolo Bellandi, 52, shift supervisor in port logistics; dentist dott. Gualtieri"},
    {"category": "people", "content": "Silvia, Paolo's wife, pharmacist (Farmacia Comunale, viale Alberti), runner; 10 km on 13 Nov 2033"},
    {"category": "people", "content": "Tommaso, 20, engineering in Bologna, vegetarian since July 2033, no allergies, Bianchi road bike"},
    {"category": "people", "content": "Irene, 15, liceo, volleyball (Robur Under 16), allergic to kiwi, dislikes mushrooms, orthodontist dott.ssa Pasini"},
    {"category": "people", "content": "Franca, 79, Paolo's mother, lives with the family; drinks barley coffee (orzo), cannot stand coriander"},
    {"category": "people", "content": "Aoife, daughter of Silvia's cousin, from Cork, graphic designer, tree-nut allergy; guest 16-28 Oct 2033"},
    {"category": "place", "content": "via dei Mosaici 12, Ravenna; wifi CasaBellandi / PinetaBlu-77; boiler serviced 1 Oct 2033; air fryer on top of the fridge"},
]

NOT_MEMORIES = [
    {"sessions": ["s06", "s09"], "why": "Franca's claim that Tommaso is allergic to kiwi — corrected by Silvia: it is Irene, Tommaso has no allergies"},
    {"sessions": ["s04", "s09"], "why": "boiler service cost 120 EUR — superseded by Silvia's own correction (135 EUR)"},
    {"sessions": ["s03", "s17"], "why": "bike price 350 EUR — superseded by Tommaso's own correction (320 EUR)"},
    {"sessions": ["s02"], "why": "attribution guard: the parking fine must not be attributed to any named person"},
    {"sessions": ["s10"], "why": "attribution guard: the air fryer purchase and the Skoda booking must not be attributed to any named person"},
    {"sessions": ["s11", "s12"], "why": "carry-over guard: the gym and the sister's birthday belong to an unidentified speaker, not to Paolo (s11)"},
    {"sessions": ["s13", "s14"], "why": "carry-over guard: the lost garage keys belong to an unidentified speaker, not to Tommaso or Aoife (s13)"},
    {"sessions": ["s18", "s19"], "why": "carry-over guard: the permanent contract belongs to an unidentified speaker, not to Paolo (s18)"},
    {"sessions": ["s01"], "why": "hand-over guard: the half marathon is Silvia's, not Paolo's"},
    {"sessions": ["s08"], "why": "hand-over guard: Latin grade and knee pads are Irene's; the Lucia lunch and coriander are Franca's"},
    {"sessions": ["s13"], "why": "hand-over guard: tree-nut allergy is Aoife's; concert cancellation and the wifi change are Tommaso's"},
    {"sessions": ["s17"], "why": "hand-over guard: exam and bike correction are Tommaso's; the earlier flight is Aoife's"},
]
