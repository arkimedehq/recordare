# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Dev set (not blind): plans about durable things — the car to the garage tomorrow, a move next month, a new job from
Monday, a dog I am thinking about, a visit booked — some carried out later, some never mentioned again (maintainer,
2026-10-22: a plan must never become a fact of something done). Fictional holder Marta, Torino, March–April 2035; mostly
Italian, one English turn.

    python dataset_dev_plan_facts/build.py      # also writes dataset_dev_plan_facts_entity (Arkimede's entity mode)
    uv run python provider_eval.py --config profiles/deepseek-flash.json --dataset dataset_dev_plan_facts --tag pf
"""
import json
from pathlib import Path

HERE = Path(__file__).parent
TZ = "+01:00"


def s(sid: str, ts: str, *turns: tuple[str, str]) -> dict:
    return {"id": sid, "user": "marta", "ts": f"2035-{ts}:00{TZ}",
            "messages": [{"role": r, "content": c} for r, c in turns]}


SESSIONS = [
    s("s01", "03-05T08:10", ("user", "Domattina alle 8 porto la Clio dal meccanico Ferraris per la revisione, ricordami di prendere il libretto."),
      ("assistant", "Promemoria: domani, 6 marzo alle 8, revisione della Clio dal meccanico Ferraris. Porta il libretto.")),
    s("s02", "03-07T19:00", ("user", "Il mese prossimo mi trasferisco a Bologna, il 12 aprile firmo il contratto d'affitto in via Mazzini."),
      ("assistant", "Che bel cambiamento! Ti segno la firma del contratto in via Mazzini il 12 aprile.")),
    s("s03", "03-09T21:30", ("user", "Sto pensando di prendere un cane, forse un beagle. Ma con il trasloco non so se è il momento."),
      ("assistant", "Un beagle è molto affettuoso ma ha bisogno di movimento. Puoi decidere con calma dopo il trasloco.")),
    s("s04", "03-10T12:00", ("user", "From Monday the 12th I start the new job at Lavazza as a product manager, I already handed in my notice at Iren."),
      ("assistant", "Congratulations on the new role at Lavazza! Good luck for Monday.")),
    s("s05", "03-13T20:15", ("user", "Primo giorno in Lavazza andato benissimo, il mio capo si chiama Davide Rinaldi."),
      ("assistant", "Che bello! Davide Rinaldi sembra un buon inizio.")),
    s("s06", "03-14T09:00", ("user", "Ho prenotato la visita dal dermatologo per il 28 marzo alle 17, per quel neo sulla spalla."),
      ("assistant", "Segnato: visita dermatologica il 28 marzo alle 17 per il neo sulla spalla.")),
    s("s07", "03-16T18:40", ("user", "Sabato vendo la moto a mio cugino Luca, ci siamo accordati per 2.800 euro."),
      ("assistant", "Ok, sabato 17 marzo vendita della moto a Luca per 2.800 €.")),
    s("s08", "03-18T10:30", ("user", "Fatto, la moto ora è di Luca, mi ha già fatto il bonifico."),
      ("assistant", "Perfetto, vendita conclusa.")),
    s("s09", "03-20T22:00", ("user", "Da aprile mi iscrivo al corso di ceramica del giovedì sera, al laboratorio Terra Cruda."),
      ("assistant", "Bella idea! Il corso di ceramica del giovedì al laboratorio Terra Cruda.")),
    s("s10", "03-22T13:00", ("user", "Pensavo di cambiare operatore del telefono e passare a Iliad, ma devo ancora vedere le offerte."),
      ("assistant", "Quando vuoi confrontiamo le offerte di Iliad con il tuo piano attuale.")),
]

QUESTIONS = [
    {"id": "f01", "category": "plan-unresolved", "asked_at": f"2035-04-02T10:00:00{TZ}", "q": "Ho fatto la revisione della Clio?",
     "expected": "Non risulta: la revisione dal meccanico Ferraris era prevista per il 6 marzo alle 8, ma poi non me ne hai più parlato, quindi non so se l'hai fatta.",
     "must_not": ["sì, hai fatto la revisione", "la Clio è stata revisionata", "non l'hai fatta"]},
    {"id": "f02", "category": "fact-stable", "asked_at": f"2035-04-02T10:05:00{TZ}", "q": "Che macchina ho?",
     "expected": "Una Renault Clio.", "must_not": []},
    {"id": "f03", "category": "plan-unresolved", "asked_at": f"2035-04-02T10:10:00{TZ}", "q": "Dove abito adesso?",
     "expected": "Non mi hai detto dove abiti ora (la città è Torino secondo il contesto); hai in programma di trasferirti a Bologna, con la firma del contratto in via Mazzini il 12 aprile, che non è ancora arrivata.",
     "must_not": ["abiti a Bologna", "abiti in via Mazzini"]},
    {"id": "f04", "category": "plan-done", "asked_at": f"2035-04-02T10:15:00{TZ}", "q": "Per chi lavoro e chi è il mio capo?",
     "expected": "Lavori in Lavazza come product manager dal 12 marzo 2035 (prima in Iren); il tuo capo è Davide Rinaldi.",
     "must_not": ["lavori in Iren"]},
    {"id": "f05", "category": "intention", "asked_at": f"2035-04-02T10:20:00{TZ}", "q": "Ho un cane?",
     "expected": "No, non risulta: il 9 marzo stavi solo pensando di prendere un beagle, forse dopo il trasloco.",
     "must_not": ["sì, hai un beagle", "hai un cane"]},
    {"id": "f06", "category": "plan-unresolved", "asked_at": f"2035-04-02T10:25:00{TZ}", "q": "Cosa ha detto il dermatologo del neo?",
     "expected": "Non lo so: la visita dal dermatologo era fissata per il 28 marzo alle 17 per il neo sulla spalla, ma non me ne hai più parlato.",
     "must_not": ["il dermatologo ha detto", "il neo è benigno"]},
    {"id": "f07", "category": "plan-done", "asked_at": f"2035-04-02T10:30:00{TZ}", "q": "Ho ancora la moto?",
     "expected": "No: l'hai venduta a tuo cugino Luca per 2.800 € (conclusa il 17-18 marzo, ha già fatto il bonifico).",
     "must_not": ["sì, hai ancora la moto"]},
    {"id": "f08", "category": "plan-unresolved", "asked_at": f"2035-04-20T10:00:00{TZ}", "q": "Sto facendo qualche corso?",
     "expected": "Avevi detto che da aprile ti saresti iscritta al corso di ceramica del giovedì sera al laboratorio Terra Cruda, ma non mi hai detto se hai iniziato.",
     "must_not": ["sì, frequenti il corso di ceramica", "frequenti il corso"]},
    {"id": "f09", "category": "intention", "asked_at": f"2035-04-02T10:35:00{TZ}", "q": "Che operatore telefonico ho?",
     "expected": "Non lo so: il 22 marzo pensavi di passare a Iliad ma dovevi ancora vedere le offerte; il tuo operatore attuale non me l'hai detto.",
     "must_not": ["hai Iliad", "sei passata a Iliad"]},
]

NOTE = ("Dev set (not blind): plans about durable things (car service, a move, a new job, a dog, a doctor's visit, a sale, "
        "a course, a phone operator) — some carried out, some never mentioned again; a plan must not become a fact of "
        "something done. Holder Marta, Torino, March–April 2035.")


def write(out: Path, entity: bool) -> None:
    """entity: the same conversations in an entity memory (Arkimede's mode), Marta saying who she is in each one."""
    out.mkdir(exist_ok=True)
    sessions = SESSIONS
    if entity:
        sessions = [{**x, "user": "assistente", "messages": [{**x["messages"][0], "content": "Sono Marta. " + x["messages"][0]["content"]},
                                                                *x["messages"][1:]]} for x in SESSIONS]
    meta = ({"users": {"assistente": "L'assistente di casa di Marta"}, "entities": ["assistente"]} if entity
            else {"users": {"marta": "Marta, Torino"}, "genders": {"marta": "feminine"}})
    (out / "conversations.json").write_text(json.dumps({"_note": NOTE, **meta, "sessions": sessions}, ensure_ascii=False, indent=1))
    (out / "questions.json").write_text(json.dumps(
        {"_note": NOTE, "user": "assistente" if entity else "marta", "holder": "Marta",
         "questions": QUESTIONS}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    write(HERE, entity=False)
    write(HERE.parent / "dataset_dev_plan_facts_entity", entity=True)
    print(f"{len(SESSIONS)} sessions, {len(QUESTIONS)} questions (personal and entity)")
