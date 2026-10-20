# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Dev set (not blind): lists kept in memory — created, added to, items removed, bought, replaced by a new list, an item
changed — the way a person keeps a shopping list or a packing list in their head (maintainer, 2026-10-20). Fictional
holder Giulia, Torino, November 2034; mostly Italian, one English turn.

    python dataset_dev_lists/build.py      # also writes dataset_dev_lists_entity (Arkimede's entity mode)
    uv run python provider_eval.py --config profiles/deepseek-flash.json --dataset dataset_dev_lists --tag lists
"""
import json
from pathlib import Path

HERE = Path(__file__).parent
TZ = "+01:00"


def s(sid: str, ts: str, *turns: tuple[str, str]) -> dict:
    return {"id": sid, "user": "giulia", "ts": f"2034-11-{ts}:00{TZ}",
            "messages": [{"role": r, "content": c} for r, c in turns]}


SESSIONS = [
    s("s01", "06T09:00", ("user", "Crea la lista della spesa: frutta e verdura."),
      ("assistant", "Fatto, ho creato la lista della spesa: frutta, verdura.")),
    s("s02", "07T18:30", ("user", "Aggiungi alla lista della spesa la carne."),
      ("assistant", "Aggiunta. Lista della spesa: frutta, verdura, carne.")),
    s("s03", "08T19:00", ("user", "Togli la verdura dalla lista della spesa, l'ha già presa Marco. E aggiungi il latte, due litri."),
      ("assistant", "Fatto: lista della spesa con frutta, carne e latte (2 litri).")),
    s("s04", "11T12:00", ("user", "Ho fatto la spesa: ho preso tutto tranne il latte, era finito."),
      ("assistant", "Bene! Allora resta solo il latte (2 litri).")),
    s("s05", "13T09:00", ("user", "Nuova lista della spesa per questa settimana: pane, uova e il latte che non avevo trovato."),
      ("assistant", "Ok, nuova lista della spesa: pane, uova, latte.")),
    s("s06", "14T10:00", ("user", "Also add batteries to the shopping list, AA ones."),
      ("assistant", "Added AA batteries. Shopping list: bread, eggs, milk, AA batteries.")),
    s("s07", "15T21:00", ("user", "Per il viaggio a Lisbona del 1° dicembre fammi una lista di cose da portare: passaporto, adattatore, caricabatterie, ombrello."),
      ("assistant", "Ecco la lista per Lisbona: passaporto, adattatore, caricabatterie, ombrello.")),
    s("s08", "17T08:15", ("user", "Dalla lista per Lisbona togli l'ombrello, danno bel tempo. Aggiungi la crema solare."),
      ("assistant", "Fatto: passaporto, adattatore, caricabatterie, crema solare.")),
    s("s09", "24T13:40", ("user", "Brutta sorpresa: il passaporto è scaduto. Per Lisbona userò la carta d'identità, mettila nella lista al posto del passaporto."),
      ("assistant", "Sostituito: carta d'identità, adattatore, caricabatterie, crema solare.")),
    # Not lists: a request that tells something about my life (v18), and things kept over time that are not shopping.
    s("s10", "16T08:30", ("user", "Segna che ho pagato l'affitto di novembre, 850 euro."),
      ("assistant", "Segnato: affitto di novembre pagato, 850 €.")),
    s("s11", "18T17:00", ("user", "Per la festa di compleanno di Leo del 30 novembre gli invitati sono Sara, Paolo e i Rinaldi."),
      ("assistant", "Ok: invitati alla festa di Leo del 30 novembre — Sara, Paolo, i Rinaldi.")),
    s("s12", "19T09:10", ("user", "Ricordami la riunione con il commercialista lunedì 27 alle 10."),
      ("assistant", "Promemoria impostato: riunione con il commercialista lunedì 27 novembre alle 10.")),
    s("s13", "20T21:30", ("user", "Aggiungi Chiara agli invitati della festa di Leo, e togli Paolo che è in trasferta."),
      ("assistant", "Fatto: Sara, i Rinaldi e Chiara.")),
    s("s14", "21T12:00", ("user", "Sposta la riunione con il commercialista a mercoledì 29 alle 15."),
      ("assistant", "Spostata a mercoledì 29 novembre alle 15.")),
    s("s15", "25T11:00", ("user", "Ho comprato tutto quello che c'era nella lista della spesa."),
      ("assistant", "Perfetto, la lista della spesa è vuota.")),
]

QUESTIONS = [
    {"id": "l01", "category": "list-add", "asked_at": f"2034-11-08T08:00:00{TZ}", "q": "Mandami la lista della spesa.",
     "expected": "Frutta, verdura e carne (la carne aggiunta il 7 novembre).", "must_not": ["latte"]},
    {"id": "l02", "category": "list-remove", "asked_at": f"2034-11-09T08:00:00{TZ}", "q": "Cosa c'è nella lista della spesa?",
     "expected": "Frutta, carne e latte (2 litri); la verdura è stata tolta perché l'ha già presa Marco.",
     "must_not": ["la verdura è da comprare"]},
    {"id": "l03", "category": "list-bought", "asked_at": f"2034-11-11T20:00:00{TZ}", "q": "Cosa mi resta da comprare?",
     "expected": "Solo il latte (2 litri): il resto l'hai preso l'11 novembre, il latte era finito.",
     "must_not": ["frutta da comprare", "carne da comprare"]},
    {"id": "l04", "category": "list-new", "asked_at": f"2034-11-14T20:00:00{TZ}", "q": "Lista della spesa?",
     "expected": "Pane, uova, latte e pile stilo AA (la nuova lista del 13 novembre, con le pile aggiunte il 14).",
     "must_not": ["carne", "frutta", "verdura"]},
    {"id": "l05", "category": "list-change", "asked_at": f"2034-11-25T10:00:00{TZ}", "q": "Cosa devo portare a Lisbona?",
     "expected": "Carta d'identità (al posto del passaporto, scaduto), adattatore, caricabatterie e crema solare; l'ombrello è stato tolto.",
     "must_not": ["ombrello", "passaporto da portare"]},
    {"id": "l06", "category": "list-history", "asked_at": f"2034-11-25T10:05:00{TZ}", "q": "Quando avevo aggiunto la carne alla lista della spesa?",
     "expected": "Il 7 novembre 2034.", "must_not": []},
    {"id": "l07", "category": "list-history", "asked_at": f"2034-11-25T10:10:00{TZ}", "q": "Chi aveva preso la verdura?",
     "expected": "Marco (per questo l'avevi tolta dalla lista l'8 novembre).", "must_not": []},
    {"id": "l08", "category": "list-history", "asked_at": f"2034-11-25T10:15:00{TZ}", "q": "Perché avevo tolto l'ombrello dalla lista per Lisbona?",
     "expected": "Perché davano bel tempo (lo hai tolto il 17 novembre, aggiungendo la crema solare).", "must_not": []},
    {"id": "l09", "category": "request-fact", "asked_at": f"2034-11-25T10:20:00{TZ}", "q": "Ho pagato l'affitto di novembre?",
     "expected": "Sì, 850 € (segnato il 16 novembre).", "must_not": ["non risulta"]},
    {"id": "l10", "category": "kept-change", "asked_at": f"2034-11-25T10:25:00{TZ}", "q": "Chi viene alla festa di Leo?",
     "expected": "Sara, i Rinaldi e Chiara; Paolo è stato tolto perché è in trasferta (20 novembre).",
     "must_not": ["Paolo viene"]},
    {"id": "l11", "category": "request-fact", "asked_at": f"2034-11-25T10:30:00{TZ}", "q": "Quando ho la riunione con il commercialista?",
     "expected": "Mercoledì 29 novembre 2034 alle 15 (spostata da lunedì 27 alle 10).", "must_not": ["lunedì 27 alle 10 è confermata"]},
    {"id": "l12", "category": "list-empty", "asked_at": f"2034-11-25T20:00:00{TZ}", "q": "C'è ancora qualcosa da comprare nella lista della spesa?",
     "expected": "No: il 25 novembre hai comprato tutto quello che c'era (pane, uova, latte, pile AA); la lista è vuota.",
     "must_not": ["pane da comprare", "latte da comprare"]},
]

NOTE = ("Dev set (not blind): things kept and changed over time (a shopping list, a packing list, guests, an appointment "
        "moved, a payment marked) — add, remove, bought, a new list, an item changed, emptied. Holder Giulia, Torino, "
        "November 2034.")


def write(out: Path, entity: bool) -> None:
    """entity: the same conversations in an entity memory (Arkimede's mode), Giulia saying who she is in each one."""
    out.mkdir(exist_ok=True)
    sessions = SESSIONS
    if entity:
        sessions = [{**x, "user": "assistente", "messages": [{**x["messages"][0], "content": "Sono Giulia. " + x["messages"][0]["content"]},
                                                                *x["messages"][1:]]} for x in SESSIONS]
    meta = ({"users": {"assistente": "L'assistente di casa di Giulia"}, "entities": ["assistente"]} if entity
            else {"users": {"giulia": "Giulia, Torino"}, "genders": {"giulia": "feminine"}})
    (out / "conversations.json").write_text(json.dumps({"_note": NOTE, **meta, "sessions": sessions}, ensure_ascii=False, indent=1))
    (out / "questions.json").write_text(json.dumps(
        {"_note": NOTE, "user": "assistente" if entity else "giulia", "holder": "Giulia",
         "questions": QUESTIONS}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    write(HERE, entity=False)
    write(HERE.parent / "dataset_dev_lists_entity", entity=True)
    print(f"{len(SESSIONS)} sessions, {len(QUESTIONS)} questions (personal and entity)")
