# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Build conversations.json, questions.json and gold.json of blind set #11 (entity memory) from the _*.py sources."""
import json
from pathlib import Path

from _gold import EPISODES, FACTS, NOTES, NOT_MEMORIES
from _questions import QUESTIONS
from _sessions import SESSIONS, SOURCES

HERE = Path(__file__).resolve().parent
ENTITY = "ciclofficina_raggio"


def message(t: tuple) -> dict:
    if t[0] == "u":
        return {"role": "user", "content": t[1]}
    if t[0] == "o":
        return {"role": "user", "content": t[1], "own": True}
    if t[0] == "a":
        return {"role": "assistant", "content": t[1]}
    raise ValueError(t)


def entries() -> list[dict]:
    """Conversations and learned / forgotten sources together, in ts order."""
    out = [{"id": s["id"], "user": ENTITY, "ts": s["ts"], "messages": [message(m) for m in s["messages"]]}
           for s in SESSIONS]
    out += [{"type": src["type"], "id": src["id"], "user": ENTITY,
             **{k: v for k, v in src.items() if k not in ("type", "id")}} for src in SOURCES]
    return sorted(out, key=lambda e: e["ts"])


def questions() -> list[dict]:
    return [{k: q[k] for k in ("id", "category", "asked_at", "q", "expected", "must_not")} for q in QUESTIONS]


def main() -> None:
    conv = {
        "_note": ("Blind synthetic dataset #11 (fictional people and business), entity memory: the counter assistant "
                  "of Ciclofficina Raggio, a neighbourhood bike repair shop in Trento, used by the owner, the mechanic "
                  "and customers. Timestamps are Europe/Rome (DST ends 2032-10-31). Every session is a separate "
                  "conversation that starts with nobody identified; people speak only as role 'user' and identify "
                  "themselves in the text (or never do); a speaker may hand the tablet to someone else. Messages with "
                  "own: true are the shop's own content (price list, hours). Entries with type 'source' are texts the "
                  "agent learns; 'forget_source' removes one."),
        "users": {ENTITY: ("Entity under test: Ciclofficina Raggio, Trento (owner Ettore, mechanic Giada; customers "
                           "Marco Tomasi, Marco Dallapiccola, Rhys, Katharina, Bruna and unidentified people); the "
                           "memory belongs to the shop's assistant")},
        "genders": {ENTITY: "neutral"},
        "entities": [ENTITY],
        "sessions": entries(),
    }
    (HERE / "conversations.json").write_text(json.dumps(conv, ensure_ascii=False, indent=1) + "\n")
    q = {
        "_note": ("Blind set #11 (entity memory). Questions asked of the shop assistant (entity 'ciclofficina_raggio') "
                  "at asked_at by someone unidentified (systems ingest only entries up to asked_at). expected = "
                  "reference answer; what someone who never identified said must be reported as 'not known who', "
                  "never attributed to a named person; a Marco without surname is not attributable to either Marco. "
                  "must_not = statements that must not be asserted as true."),
        "user": ENTITY,
        "questions": questions(),
    }
    (HERE / "questions.json").write_text(json.dumps(q, ensure_ascii=False, indent=1) + "\n")
    gold = {"user": ENTITY, "episodes": EPISODES, "facts": FACTS, "notes": NOTES, "not_memories": NOT_MEMORIES}
    (HERE / "gold.json").write_text(json.dumps(gold, ensure_ascii=False, indent=1) + "\n")
    print(f"sessions={len(SESSIONS)} sources={sum(s['type'] == 'source' for s in SOURCES)} "
          f"forgets={sum(s['type'] == 'forget_source' for s in SOURCES)} questions={len(q['questions'])} "
          f"episodes={len(EPISODES)} facts={len(FACTS)} notes={len(NOTES)}")


if __name__ == "__main__":
    main()
