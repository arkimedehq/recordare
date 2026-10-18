# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Build conversations.json, questions.json and gold.json of blind set #12 (personal memory, H1) from the _*.py
sources."""
import json
from pathlib import Path

from _gold import EPISODES, FACTS, NOTES, NOT_MEMORIES
from _questions import QUESTIONS
from _sessions import SESSIONS

HERE = Path(__file__).resolve().parent
HOLDER = "tommaso"


def message(t: tuple) -> dict:
    if t[0] == "u":
        return {"role": "user", "content": t[1]}
    if t[0] == "a":
        return {"role": "assistant", "content": t[1]}
    if t[0] == "o":
        return {"role": "other", "author": t[1], "content": t[2]}
    raise ValueError(t)


def session(s: dict) -> dict:
    out = {"id": s["id"], "user": HOLDER, "ts": s["ts"]}
    for k in ("group", "participants"):
        if k in s:
            out[k] = s[k]
    out["messages"] = [message(m) for m in s["messages"]]
    return out


def main() -> None:
    conv = {
        "_note": ("Blind synthetic dataset #12 (fictional people), personal memory built to probe H1: a user's plans "
                  "(unresolved, implicit outcomes, moved several times, premise traps), accumulating events vs "
                  "superseding states, correction vs change. Holder Tommaso Rinaldi, Bologna, February–June 2034; "
                  "mostly Italian, some English. Timestamps are Europe/Rome (DST starts 2034-03-26). Holder turns are "
                  "role 'user', the agent 'assistant', group-chat members 'other' with 'author'."),
        "users": {HOLDER: "Tommaso Rinaldi, Bologna"},
        "genders": {HOLDER: "masculine"},
        "entities": [],
        "sessions": sorted((session(s) for s in SESSIONS), key=lambda e: e["ts"]),
    }
    (HERE / "conversations.json").write_text(json.dumps(conv, ensure_ascii=False, indent=1) + "\n")
    q = {
        "_note": ("Blind set #12 (personal memory, H1). Questions asked by the holder Tommaso at asked_at (systems ingest "
                  "only sessions up to asked_at). expected = reference answer (in Italian; an unresolved plan's right "
                  "answer is that the outcome is not known); must_not = statements that must not be asserted as true."),
        "user": HOLDER,
        "holder": "Tommaso",
        "questions": [{k: x[k] for k in ("id", "category", "asked_at", "q", "expected", "must_not")} for x in QUESTIONS],
    }
    (HERE / "questions.json").write_text(json.dumps(q, ensure_ascii=False, indent=1) + "\n")
    gold = {"user": HOLDER, "episodes": EPISODES, "facts": FACTS, "notes": NOTES, "not_memories": NOT_MEMORIES}
    (HERE / "gold.json").write_text(json.dumps(gold, ensure_ascii=False, indent=1) + "\n")
    n_msg = sum(len(s["messages"]) for s in SESSIONS)
    print(f"sessions={len(SESSIONS)} messages={n_msg} questions={len(QUESTIONS)} episodes={len(EPISODES)} "
          f"facts={len(FACTS)} notes={len(NOTES)}")


if __name__ == "__main__":
    main()
