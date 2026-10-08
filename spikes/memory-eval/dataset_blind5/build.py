# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Build conversations.json, questions.json and gold.json of dataset_blind5 from _sessions.py,
_questions.py and _gold.py (local Europe/Rome times -> ISO 8601 with the correct DST offset).

Run: python dataset_blind5/build.py   (then gen_noise.py and check.py)
"""
import json
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from _gold import EPISODES, FACTS, NOTES, NOT_MEMORIES  # noqa: E402
from _questions import QUESTIONS  # noqa: E402
from _sessions import SESSIONS  # noqa: E402

TZ = ZoneInfo("Europe/Rome")
USER = "nunzia"


def iso(local: str) -> str:
    return datetime.strptime(local, "%Y-%m-%d %H:%M").replace(tzinfo=TZ).isoformat()


def main() -> None:
    conversations = {
        "_note": ("Blind synthetic dataset #5 (fictional people). Timestamps are when the message was sent "
                  "(Europe/Rome, also for the sessions written from Dublin, which is one hour behind). Messages "
                  "with role 'other' are group-chat messages written by someone else (see 'author')."),
        "users": {
            "nunzia": "Primary user under test",
            "carmelo": "Second user (noise only), isolation check: first-person events mirroring Nunzia's; must never surface in Nunzia's answers",
            "giada": "Third user (noise only), unrelated life; must never surface in Nunzia's answers",
        },
        "sessions": [{"id": sid, "user": USER, "ts": iso(ts), "messages": msgs} for sid, ts, msgs in SESSIONS],
    }
    questions = {
        "_note": ("Blind set #5. Questions asked as user 'nunzia' at asked_at (systems ingest only sessions up to "
                  "asked_at). expected = reference answer (overviews: ESSENTIAL / SECONDARY items; implicit changes: "
                  "a hedged inference is correct); must_not = claims that must not be asserted as true."),
        "user": USER,
        "questions": [{"id": qid, "category": cat, "asked_at": iso(at), "q": q, "expected": exp, "must_not": mn}
                      for qid, cat, at, q, exp, mn in QUESTIONS],
    }
    gold = {"user": USER, "episodes": EPISODES, "facts": FACTS, "notes": NOTES, "not_memories": NOT_MEMORIES}
    for name, data in (("conversations.json", conversations), ("questions.json", questions), ("gold.json", gold)):
        (HERE / name).write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    print(f"{len(SESSIONS)} sessions, {len(QUESTIONS)} questions, {len(EPISODES)} gold episodes, {len(FACTS)} facts")


if __name__ == "__main__":
    main()
