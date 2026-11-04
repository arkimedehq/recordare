# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""dev_asking (D55 F2b step 4): the questions the memory holds (the thought pass) go to whoever could answer — the agent's
tools for the world, the person a question is about when they talk to the agent, else whoever told it most about them;
nobody identified, nobody asked. Fictional content. Writes conversations.json and initiatives_gold.json in
dev_initiatives' format (initiative_eval.py)."""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
R = "+02:00"


def s(sid, user, ts, msgs):
    return {"id": sid, "user": user, "ts": ts, "messages": [{"role": r, "content": c} for r, c in msgs]}


def v(sid, ts, who, text, reply):
    """A turn in the shared home by someone the agent recognises (voice: a platform identity), and its reply."""
    return {"id": sid, "user": "casa_neri", "ts": ts, "participants": [{"name": who, "identity": f"{who.lower()}-voice"}],
            "messages": [{"role": "other", "author": who, "content": text}, {"role": "assistant", "content": reply}]}


SESSIONS = [
    s("s1", "sara", f"2026-09-01T19:00:00{R}", [("user", "Mio fratello Luca domani ha il colloquio a Torino per il posto da ingegnere, è agitatissimo."), ("assistant", "In bocca al lupo a Luca!")]),
    s("s2", "sara", f"2026-09-02T21:00:00{R}", [("user", "Luca oggi ha fatto il colloquio a Torino, tre ore tra test e domande. Gli diranno qualcosa entro due settimane."), ("assistant", "Speriamo bene.")]),
    s("s3", "sara", f"2026-09-04T12:00:00{R}", [("user", "Ho sentito che il negozio di bici di via Roma forse chiude a fine mese, peccato."), ("assistant", "Sarebbe un peccato davvero.")]),
    s("s4", "sara", f"2026-09-06T10:00:00{R}", [("user", "Oggi giro in bici sui colli, poi pranzo da mamma."), ("assistant", "Bella giornata!")]),
    s("s5", "sara", f"2026-09-08T20:00:00{R}", [("user", "Luca è ancora in attesa per Torino, non si sa niente."), ("assistant", "L'attesa è la parte più dura.")]),
    # In the shared home the agent recognises Paolo and Marta by their voice (a platform identity); Ugo is mentioned by
    # someone it cannot name.
    v("c1", f"2026-09-01T18:00:00{R}", "Paolo", "Sabato Giada ha la gara di nuoto regionale a Firenze, i 100 stile.", "Forza Giada!"),
    v("c2", f"2026-09-02T20:00:00{R}", "Marta", "Da lunedì comincio una dieta nuova col nutrizionista, vediamo se tengo duro.", "Buona fortuna, Marta."),
    v("c3", f"2026-09-06T21:00:00{R}", "Paolo", "Giada oggi ha gareggiato a Firenze, aspettiamo le classifiche ufficiali.", "Che emozione!"),
    s("c4", "casa_neri", f"2026-09-07T19:00:00{R}", [("user", "Ugo ha venduto la macchina vecchia, dice che ne prende una elettrica."), ("assistant", "Interessante.")]),
    v("c5", f"2026-09-09T20:00:00{R}", "Marta", "Prima settimana di dieta fatta, ma che fatica la sera.", "Brava Marta, tieni duro."),
    v("c6", f"2026-09-10T08:00:00{R}", "Paolo", "Giada ha ancora la tosse da sabato, oggi resta a casa da scuola.", "Guarisca presto."),
]


def e(i, kind, who, desc):
    return {"id": i, "kind": kind, "by": 1, "for": who, "desc": desc}


def t(i, desc, why):
    return {"id": i, "desc": desc, "why": why}


GOLD = {
    "sara": {"expected": [
        e("s-ask-luca", "ask", "holder", "Ask Sara whether her brother Luca heard back about the engineering job in Turin (or how the interview went)"),
        e("s-lookup-bikes", "lookup", "holder", "Find out (with the agent's own tools) whether the bike shop in via Roma is closing at the end of the month"),
    ], "traps": [
        t("s-trap-ride", "Ask Sara how her bike ride on the hills or lunch at her mother's went", "small talk she settled herself [trivial]"),
    ]},
    "casa_neri": {"expected": [
        e("c-ask-giada", "ask", "Paolo", "Ask Paolo how Giada's regional swimming race in Florence went (the official results)"),
        e("c-ask-diet", "ask", "Marta", "Ask Marta how her new diet with the nutritionist is going"),
    ], "traps": [
        t("c-trap-giada-marta", "Ask Marta about Giada's race or her cough", "Marta never spoke of Giada: the wrong person [wrong person]"),
        t("c-trap-ugo", "Ask someone which electric car Ugo is buying", "only someone unidentified spoke of Ugo [nobody to ask]"),
    ]},
}

(HERE / "conversations.json").write_text(json.dumps({
    "_note": "dev_asking (D55 F2b step 4): whom the memory's questions go to; see build.py.",
    "users": {"sara": "Sara, Bologna", "casa_neri": "Casa Neri, Prato"},
    "genders": {"sara": "feminine", "casa_neri": "feminine"},
    "entities": ["casa_neri"],
    "sessions": SESSIONS,
}, ensure_ascii=False, indent=1) + "\n")
(HERE / "initiatives_gold.json").write_text(json.dumps({
    "_note": "Questions expected by the checkpoint, routed to whoever could answer (`for`); no due day (a question is due when the thought pass holds it). Traps must not exist. The judge sees `desc` only.",
    "timezone": "Europe/Rome",
    "checkpoints": ["2026-09-12T22:00:00+02:00"],
    "memories": GOLD,
}, ensure_ascii=False, indent=1) + "\n")
print(f"{len(SESSIONS)} sessions, {sum(len(g['expected']) for g in GOLD.values())} expected, {sum(len(g['traps']) for g in GOLD.values())} traps")
