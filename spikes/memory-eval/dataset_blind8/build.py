# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Build conversations.json, questions.json and gold.json of blind set #8 (entity memory) from the _*.py sources."""
import json
from pathlib import Path

from _gold import EPISODES, FACTS, NOTES, NOT_MEMORIES
from _questions import QUESTIONS
from _sessions import SESSIONS

HERE = Path(__file__).resolve().parent
ENTITY = "casa_bellandi"


def message(t: tuple) -> dict:
    if t[0] == "u":
        return {"role": "user", "content": t[1]}
    if t[0] == "a":
        return {"role": "assistant", "content": t[1]}
    raise ValueError(t)


def sessions() -> list[dict]:
    return [{"id": s["id"], "user": ENTITY, "ts": s["ts"], "messages": [message(m) for m in s["messages"]]}
            for s in SESSIONS]


def questions() -> list[dict]:
    return [{k: q[k] for k in ("id", "category", "asked_at", "q", "expected", "must_not")} for q in QUESTIONS]


def main() -> None:
    conv = {
        "_note": ("Blind synthetic dataset #8 (fictional people), entity memory (D48): the shared kitchen voice "
                  "assistant of a household in Ravenna. Timestamps are Europe/Rome. Every session is a separate "
                  "conversation and starts with nobody identified; people speak only through role 'user' messages "
                  "and identify themselves in the text (or never do); a speaker may hand the device to someone "
                  "else mid-conversation."),
        "users": {ENTITY: ("Entity under test: the Bellandi household (Paolo, Silvia, Tommaso, Irene, grandmother "
                           "Franca; guest Aoife) sharing one kitchen assistant; memory belongs to the household")},
        "entities": [ENTITY],
        "sessions": sessions(),
    }
    (HERE / "conversations.json").write_text(json.dumps(conv, ensure_ascii=False, indent=1) + "\n")
    q = {
        "_note": ("Blind set #8 (entity memory). Questions asked to the household assistant (entity 'casa_bellandi') at "
                  "asked_at (systems ingest only sessions up to asked_at). expected = reference answer; facts said by "
                  "someone who never identified must be reported as 'not known who', never attributed to a named "
                  "person. must_not = statements that must not be asserted."),
        "user": ENTITY,
        "questions": questions(),
    }
    (HERE / "questions.json").write_text(json.dumps(q, ensure_ascii=False, indent=1) + "\n")
    gold = {"user": ENTITY, "episodes": EPISODES, "facts": FACTS, "notes": NOTES, "not_memories": NOT_MEMORIES}
    (HERE / "gold.json").write_text(json.dumps(gold, ensure_ascii=False, indent=1) + "\n")
    print(f"sessions={len(conv['sessions'])} questions={len(q['questions'])} episodes={len(EPISODES)}")


if __name__ == "__main__":
    main()
