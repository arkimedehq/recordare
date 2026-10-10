# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Build conversations.json, questions.json and gold.json of blind set #9 (personal agent memory with declared
group-chat participants, identified askers and learned sources) from the _*.py sources."""
import json
from pathlib import Path

from _gold import EPISODES, FACTS, NOTES, NOT_MEMORIES
from _questions import QUESTIONS
from _sessions import SESSIONS, SOURCES

HERE = Path(__file__).resolve().parent
USER = "beatrice"
SOURCE_KEYS = ("type", "id", "ts", "title", "text", "kind", "author", "provided_by", "conversation", "source")


def message(t: tuple) -> dict:
    if t[0] == "u":
        return {"role": "user", "content": t[1]}
    if t[0] == "a":
        return {"role": "assistant", "content": t[1]}
    if t[0] == "o":
        return {"role": "other", "author": t[1], "content": t[2]}
    raise ValueError(t)


def session(s: dict) -> dict:
    out = {"id": s["id"], "user": USER, "ts": s["ts"]}
    if "participants" in s:
        out["participants"] = s["participants"]
    out["messages"] = [message(m) for m in s["messages"]]
    return out


def source(k: dict) -> dict:
    out = {key: k[key] for key in SOURCE_KEYS if key in k}
    out["user"] = USER
    return out


def entries() -> list[dict]:
    """Sessions and sources interleaved by ts (stable: a source right after its conversation keeps that order)."""
    return sorted([session(s) for s in SESSIONS] + [source(k) for k in SOURCES], key=lambda e: e["ts"])


def questions() -> list[dict]:
    out = []
    for q in QUESTIONS:
        d = {k: q[k] for k in ("id", "category", "asked_at")}
        if "asker" in q:
            d["asker"] = q["asker"]
        d.update({k: q[k] for k in ("q", "expected", "must_not")})
        out.append(d)
    return out


def main() -> None:
    conv = {
        "_note": ("Blind synthetic dataset #9 (fictional people): the personal agent memory of Beatrice (Trento, "
                  "autumn 2034). Timestamps are Europe/Rome (DST ends Sun 29 Oct 2034). Role 'other' = someone else "
                  "writing in a group chat (see 'author'); a session's 'participants' declares which authors are "
                  "identified contacts (same 'identity' = same person across sessions), the others are known by display "
                  "name only. Entries with 'type': 'source' are learned texts; 'forget_source' removes one."),
        "users": {USER: "Beatrice Sartori, Trento"},
        "genders": {USER: "feminine"},
        "entities": [],
        "sessions": entries(),
    }
    (HERE / "conversations.json").write_text(json.dumps(conv, ensure_ascii=False, indent=1) + "\n")
    q = {
        "_note": ("Blind set #9 (personal agent memory). Questions asked of Beatrice's memory at asked_at (systems ingest "
                  "only entries up to asked_at). Without 'asker' the holder asks; with 'asker' an identified contact asks "
                  "and 'I' in the question is that contact. expected = reference answer; must_not = claims that must not "
                  "be asserted. Claims by others never confirmed by the holder are reported as such; the forgotten "
                  "source's content must not be recalled."),
        "user": USER,
        "questions": questions(),
    }
    (HERE / "questions.json").write_text(json.dumps(q, ensure_ascii=False, indent=1) + "\n")
    gold = {"user": USER, "episodes": EPISODES, "facts": FACTS, "notes": NOTES, "not_memories": NOT_MEMORIES}
    (HERE / "gold.json").write_text(json.dumps(gold, ensure_ascii=False, indent=1) + "\n")
    print(f"sessions={len(SESSIONS)} sources={len(SOURCES)} questions={len(q['questions'])} episodes={len(EPISODES)}")


if __name__ == "__main__":
    main()
