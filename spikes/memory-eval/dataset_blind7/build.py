# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Build conversations.json, questions.json and gold.json of blind set #7 from the _*.py sources."""
import json
from pathlib import Path

from _gold import EPISODES, FACTS, NOTES, NOT_MEMORIES
from _questions import QUESTIONS
from _sessions import SESSIONS

HERE = Path(__file__).resolve().parent
USER = "giacomo"


def message(t: tuple) -> dict:
    if t[0] == "u":
        return {"role": "user", "content": t[1]}
    if t[0] == "a":
        return {"role": "assistant", "content": t[1]}
    if t[0] == "o":
        return {"role": "other", "author": t[1], "content": t[2]}
    raise ValueError(t)


def sessions() -> list[dict]:
    return [{"id": s["id"], "user": USER, "ts": s["ts"], "messages": [message(m) for m in s["messages"]]}
            for s in SESSIONS]


def questions() -> list[dict]:
    return [{k: q[k] for k in ("id", "category", "asked_at", "q", "expected", "must_not")} for q in QUESTIONS]


def main() -> None:
    conv = {
        "_note": ("Blind synthetic dataset #7 (fictional people), general coverage. Timestamps are Europe/Rome. "
                  "Messages with role 'other' are group-chat messages written by someone else (see 'author'); the "
                  "owner's own messages in group chats have role 'user'."),
        "users": {
            "giacomo": "Primary user under test",
            "ottorino": ("Second user (noise only), isolation check: first-person events mirroring the claims and "
                         "wrong recalls about Giacomo (autumn wedding, team captain, Punto sold in Clusone, job in "
                         "Milan, a dog, grey Yaris, half marathon in Brescia, brother in Monza, named hotel / B&B / "
                         "dentist, house price, salary); must never surface in Giacomo's answers"),
            "loredana": "Third user (noise only), unrelated life; must never surface in Giacomo's answers",
        },
        "sessions": sessions(),
    }
    (HERE / "conversations.json").write_text(json.dumps(conv, ensure_ascii=False, indent=1) + "\n")
    q = {
        "_note": ("Blind set #7 (general coverage). Questions asked as user 'giacomo' at asked_at (systems ingest "
                  "only sessions up to asked_at). expected = reference answer; the text before the bracket "
                  "«(Dettagli secondari, non richiesti: …)» / «(Secondary details, not required: …)» is the key "
                  "answer. Claims of other people never confirmed by the owner must be reported as such. "
                  "must_not = claims that must not be asserted as true."),
        "user": USER,
        "questions": questions(),
    }
    (HERE / "questions.json").write_text(json.dumps(q, ensure_ascii=False, indent=1) + "\n")
    gold = {"user": USER, "episodes": EPISODES, "facts": FACTS, "notes": NOTES, "not_memories": NOT_MEMORIES}
    (HERE / "gold.json").write_text(json.dumps(gold, ensure_ascii=False, indent=1) + "\n")
    print(f"sessions={len(conv['sessions'])} questions={len(q['questions'])} episodes={len(EPISODES)}")


if __name__ == "__main__":
    main()
