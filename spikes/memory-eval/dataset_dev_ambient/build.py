# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Build conversations.json and questions.json of the `ambient` dev set (WORK_PLAN 6.5) from the _*.py sources."""
import json
from pathlib import Path

from _questions import QUESTIONS
from _sessions import SESSIONS

HERE = Path(__file__).resolve().parent
USER = "stefano"


def message(t: tuple) -> dict:
    if t[0] == "u":
        return {"role": "user", "content": t[1]}
    if t[0] == "a":
        return {"role": "assistant", "content": t[1]}
    if t[0] == "o":  # a voice the platform recognised
        return {"role": "other", "author": t[1], "content": t[2]}
    if t[0] == "x":  # a voice nobody recognised (TV, a guest)
        return {"role": "other", "content": t[1]}
    raise ValueError(t)


def sessions() -> list[dict]:
    return [{"id": s["id"], "user": USER, "ts": s["ts"], "source": s["source"],
             **({"participants": s["participants"]} if s.get("participants") else {}),
             "messages": [message(m) for m in s["messages"]]} for s in SESSIONS]


def questions() -> list[dict]:
    return [{k: q[k] for k in ("id", "category", "asked_at", "q", "expected", "must_not")} for q in QUESTIONS]


def main() -> None:
    conv = {
        "_note": ("Ambient dev set (WORK_PLAN 6.5, NOT blind, fictional people): Stefano's personal memory, Padova, "
                  "November 2026. Sessions with source 'ambient' are a home device's transcripts of the living room "
                  "(nobody talks to the assistant; speech-recognition errors and some wrong speaker labels on "
                  "purpose); sessions with source 'chat' are Stefano writing to his assistant. Timestamps are "
                  "Europe/Rome."),
        "users": {USER: "Stefano, Padova"},
        "genders": {USER: "masculine"},
        "sessions": sessions(),
    }
    (HERE / "conversations.json").write_text(json.dumps(conv, ensure_ascii=False, indent=1) + "\n")
    q = {
        "_note": ("Ambient dev set (NOT blind). Questions asked by Stefano at asked_at (systems ingest only sessions up "
                  "to asked_at). expected = reference answer: a garbled word gives the plain meaning and 'not known' "
                  "for an unrecoverable name / number; a misattributed line is the other person's; what was heard "
                  "in the room and never confirmed is right when reported as said / heard at home. must_not = "
                  "statements that must not be asserted."),
        "user": USER,
        "holder": "Stefano",
        "questions": questions(),
    }
    (HERE / "questions.json").write_text(json.dumps(q, ensure_ascii=False, indent=1) + "\n")
    print(f"sessions={len(conv['sessions'])} questions={len(q['questions'])}")


if __name__ == "__main__":
    main()
