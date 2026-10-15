# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Consistency checks for the `ambient` dev set: file shape, evalkit loaders, ids, Europe/Rome offsets, weekday/date
mentions, sources, ambient roles and declared voices, questions asked after their evidence.
Run: python check.py (exit code 1 on failure)."""
import json
import os
import re
import sys
from collections import Counter
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
ROME = ZoneInfo("Europe/Rome")
USER = "stefano"
SOURCES = {"chat", "voice", "ambient", "document", "perception", "interview", "import_chat", "import_social",
           "import_email", "import_notes"}  # as the service's ingest accepts them (no mcp_tool)
CATEGORIES = {"heard", "garbled", "background", "misattributed", "confirmed", "unconfirmed", "control"}
IDENTITIES = {"Leo": "leo-ferri", "Rosanna": "rosanna-ferri"}
ERRORS: list[str] = []


def err(msg: str) -> None:
    ERRORS.append(msg)


IT_DAYS = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"]
IT_MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre",
             "ottobre", "novembre", "dicembre"]
IT_RE = re.compile(rf"\b({'|'.join(IT_DAYS)})\s+(\d{{1,2}})°?\s+({'|'.join(IT_MONTHS)})", re.I)


def year_of(month: int) -> int:
    return 2027 if month == 1 else 2026  # the set runs October 2026 – January 2027


def check_weekdays(text: str, where: str) -> int:
    n = 0
    for m in IT_RE.finditer(text):
        wd, d, mo = IT_DAYS.index(m.group(1).lower()), int(m.group(2)), IT_MONTHS.index(m.group(3).lower()) + 1
        real = date(year_of(mo), mo, d)
        n += 1
        if real.weekday() != wd:
            err(f"{where}: '{m.group(0)}' is a {IT_DAYS[real.weekday()]}")
    return n


def check_ts(ts: str, where: str) -> datetime:
    dt = datetime.fromisoformat(ts)
    local = dt.replace(tzinfo=None).replace(tzinfo=ROME)
    if local.utcoffset() != dt.utcoffset():
        err(f"{where}: offset {dt.utcoffset()} but Europe/Rome is {local.utcoffset()} at {ts}")
    return dt


def main() -> None:
    os.environ["EVAL_DATASET"] = HERE.name
    from evalkit.common import eval_user, load_questions, load_sessions  # noqa: E402
    from _questions import QUESTIONS  # noqa: E402
    from _sessions import SESSIONS  # noqa: E402

    sessions, questions, user = load_sessions(), load_questions(), eval_user()
    conv = json.loads((HERE / "conversations.json").read_text())
    if set(conv) != {"_note", "users", "genders", "sessions"} or USER not in conv["users"] or user != USER:
        err(f"conversations.json keys {sorted(conv)} / questions user {user}")

    # sessions
    ids = [s["id"] for s in sessions]
    if ids != [f"s{i:02d}" for i in range(1, len(ids) + 1)] or ids != [s["id"] for s in conv["sessions"]]:
        err("session ids are not s01..sNN in chronological order")
    by_id, n_wd, prev = {}, 0, None
    for s, src in zip(conv["sessions"], SESSIONS):
        dt = check_ts(s["ts"], s["id"])
        if prev and dt <= prev:
            err(f"{s['id']}: not chronological")
        prev = by_id[s["id"]] = dt
        if s["user"] != USER or s.get("source") not in SOURCES:
            err(f"{s['id']}: user {s['user']} / source {s.get('source')}")
        roles = Counter(m["role"] for m in s["messages"])
        authors = {m["author"] for m in s["messages"] if m.get("author")}
        declared = {p["name"]: p.get("identity") for p in s.get("participants", [])}
        for i, m in enumerate(s["messages"]):
            n_wd += check_weekdays(m["content"], f"{s['id']}#{i}")
            if m["role"] not in ("user", "assistant", "other") or (m.get("author") and m["role"] != "other"):
                err(f"{s['id']}#{i}: role {m['role']} author {m.get('author')}")
        if s["source"] == "ambient":
            if roles["assistant"]:
                err(f"{s['id']}: the assistant speaks in an ambient session")
            if authors != set(declared):
                err(f"{s['id']}: authors {sorted(authors)} != declared participants {sorted(declared)}")
            for name, ident in declared.items():
                if IDENTITIES.get(name) != ident:
                    err(f"{s['id']}: {name} declared with identity {ident}")
            if not roles["user"]:
                err(f"{s['id']}: the holder is never heard")
        else:
            if roles["other"] or declared or s["messages"][0]["role"] != "user":
                err(f"{s['id']}: a chat must be the holder and the assistant only")
    first = min(by_id.values())

    # questions
    qids = [q["id"] for q in questions]
    if qids != [f"q{i:02d}" for i in range(1, len(qids) + 1)]:
        err("question ids are not q01..qNN in order")
    cats = Counter(q["category"] for q in questions)
    if set(cats) != CATEGORIES:
        err(f"categories {sorted(cats)} != {sorted(CATEGORIES)}")
    ev = {q["id"]: q["ev"] for q in QUESTIONS}
    for q in questions:
        if set(q) != {"id", "category", "asked_at", "q", "expected", "must_not"}:
            err(f"{q['id']}: keys {sorted(q)}")
        at = check_ts(q["asked_at"], q["id"])
        if at <= first:
            err(f"{q['id']}: asked before the first session")
        if not ev[q["id"]]:
            err(f"{q['id']}: no evidence sessions")
        for sid in ev[q["id"]]:
            if sid not in by_id:
                err(f"{q['id']}: unknown evidence session {sid}")
            elif by_id[sid] >= at:
                err(f"{q['id']}: evidence {sid} is not before asked_at")
        n_wd += check_weekdays(q["expected"] + " " + q["q"], q["id"])
    # an unconfirmed item has no chat among its evidence; a confirmed one has one
    src = {s["id"]: s["source"] for s in conv["sessions"]}
    for q in QUESTIONS:
        chats = [sid for sid in q["ev"] if src.get(sid) == "chat"]
        if q["category"] == "unconfirmed" and chats:
            err(f"{q['id']}: unconfirmed but evidence has chats {chats}")
        if q["category"] == "confirmed" and not (chats and any(src.get(sid) == "ambient" for sid in q["ev"])):
            err(f"{q['id']}: confirmed needs an ambient and a chat session")

    amb = sum(1 for s in conv["sessions"] if s["source"] == "ambient")
    print(f"sessions={len(sessions)} (ambient {amb}, chat {len(sessions) - amb}) questions={len(questions)} "
          f"weekday-mentions-checked={n_wd}")
    print("categories:", dict(sorted(cats.items())))
    if ERRORS:
        print(f"\n{len(ERRORS)} ERROR(S):")
        for e in ERRORS:
            print(" -", e)
        sys.exit(1)
    print("OK")


if __name__ == "__main__":
    main()
