# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Build conversations.json, questions.json and gold.json of blind set #10 (entity memory with own content and
learned sources) from the _*.py sources."""
import json
from pathlib import Path

from _gold import EPISODES, FACTS, NOTES, NOT_MEMORIES, SOURCES as GOLD_SOURCES
from _questions import QUESTIONS
from _sessions import SESSIONS, SOURCES

HERE = Path(__file__).resolve().parent
ENTITY = "camping_il_ginepro"
SOURCE_KEYS = ("type", "id", "ts", "title", "text", "kind", "author", "provided_by", "conversation")


def message(t: tuple) -> dict:
    if t[0] == "u":
        return {"role": "user", "content": t[1]}
    if t[0] == "a":
        return {"role": "assistant", "content": t[1]}
    if t[0] == "o":
        return {"role": "user", "content": t[1], "own": True}
    raise ValueError(t)


def entries() -> list[dict]:
    convs = [{"id": s["id"], "user": ENTITY, "ts": s["ts"], "messages": [message(m) for m in s["messages"]]}
             for s in SESSIONS]
    sources = []
    for k in SOURCES:
        src = {"type": "source", "id": k["id"], "user": ENTITY}
        src.update({key: k[key] for key in SOURCE_KEYS if key in k and key not in ("type", "id")})
        sources.append(src)
    return sorted(convs + sources, key=lambda e: e["ts"])


def questions() -> list[dict]:
    return [{k: q[k] for k in ("id", "category", "asked_at", "q", "expected", "must_not")} for q in QUESTIONS]


def main() -> None:
    conv = {
        "_note": ("Blind synthetic dataset #10 (fictional people and business), entity memory: the reception assistant "
                  "of Camping Il Ginepro, a small family-run campsite on Lake Trasimeno (Castiglione del Lago), "
                  "pre-season and Easter 2034. Timestamps are Europe/Rome (DST starts Sun 26 Mar 2034). Every "
                  "conversation is separate and starts with nobody identified; people speak only through role 'user' "
                  "messages and identify themselves in the text (or never do); a speaker may hand the chat to someone "
                  "else mid-conversation. Messages with 'own': true are content handed to the assistant to keep as its "
                  "own (price list, hours, rules, procedure). Entries with 'type': 'source' are texts the assistant "
                  "learns (a manual, a contract, rules), in time order with the conversations."),
        "users": {ENTITY: ("Entity under test: Camping Il Ginepro, Castiglione del Lago — the family (Ottavio, Benedetta, "
                           "Chiara, Nico), staff and guests share one reception assistant; the memory belongs to the "
                           "campsite")},
        "genders": {ENTITY: "masculine"},
        "entities": [ENTITY],
        "sessions": entries(),
    }
    (HERE / "conversations.json").write_text(json.dumps(conv, ensure_ascii=False, indent=1) + "\n")
    q = {
        "_note": ("Blind set #10 (entity memory with own content and learned sources). Questions asked to the campsite "
                  "assistant (entity 'camping_il_ginepro') by someone unidentified at asked_at (systems ingest only "
                  "entries up to asked_at). 'Tu' / 'you' is the assistant, which answers in the first person. expected "
                  "= reference answer; facts said by someone who never identified must be reported as 'not known "
                  "who', never attributed to a named person. must_not = statements that must not be asserted."),
        "user": ENTITY,
        "questions": questions(),
    }
    (HERE / "questions.json").write_text(json.dumps(q, ensure_ascii=False, indent=1) + "\n")
    gold = {"user": ENTITY, "episodes": EPISODES, "facts": FACTS, "notes": NOTES, "not_memories": NOT_MEMORIES,
            "sources": GOLD_SOURCES}
    (HERE / "gold.json").write_text(json.dumps(gold, ensure_ascii=False, indent=1) + "\n")
    n_src = sum(1 for e in conv["sessions"] if e.get("type") == "source")
    print(f"entries={len(conv['sessions'])} (conversations {len(conv['sessions']) - n_src}, sources {n_src}) "
          f"questions={len(q['questions'])} episodes={len(EPISODES)} facts={len(FACTS)} notes={len(NOTES)}")


if __name__ == "__main__":
    main()
