# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Consistency checks for blind set #7: loaders, ids, Europe/Rome offsets (DST), weekday/date mentions,
questions asked after their evidence, gold references. Run: python check.py (exit code 1 on failure)."""
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
YEAR = 2033
ERRORS: list[str] = []


def err(msg: str) -> None:
    ERRORS.append(msg)


IT_DAYS = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"]
EN_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
IT_MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre",
             "ottobre", "novembre", "dicembre"]
EN_MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october",
             "november", "december"]
IT_RE = re.compile(rf"\b({'|'.join(IT_DAYS)})\s+(\d{{1,2}})°?\s+({'|'.join(IT_MONTHS)})", re.I)
EN_RE = re.compile(rf"\b({'|'.join(EN_DAYS)})\s+(?:the\s+)?(\d{{1,2}})(?:st|nd|rd|th)?\s+(?:of\s+)?({'|'.join(EN_MONTHS)})", re.I)


def check_weekdays(text: str, where: str) -> int:
    n = 0
    for rx, days, months in ((IT_RE, IT_DAYS, IT_MONTHS), (EN_RE, EN_DAYS, EN_MONTHS)):
        for m in rx.finditer(text):
            wd, d, mo = days.index(m.group(1).lower()), int(m.group(2)), months.index(m.group(3).lower()) + 1
            n += 1
            if date(YEAR, mo, d).weekday() != wd:
                err(f"{where}: '{m.group(0)}' is a {days[date(YEAR, mo, d).weekday()]} in {YEAR}")
    return n


def check_ts(ts: str, where: str) -> datetime:
    dt = datetime.fromisoformat(ts)
    if dt.year != YEAR:
        err(f"{where}: year {dt.year}")
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
    noise = json.loads((HERE / "noise.json").read_text())["sessions"]
    gold = json.loads((HERE / "gold.json").read_text())
    conv = json.loads((HERE / "conversations.json").read_text())
    if user != "giacomo":
        err(f"eval_user = {user}")

    # ids
    ids = [s["id"] for s in sessions + noise]
    for k, c in Counter(ids).items():
        if c > 1:
            err(f"duplicate session id {k}")
    qids = [q["id"] for q in questions]
    for k, c in Counter(qids).items():
        if c > 1:
            err(f"duplicate question id {k}")
    if qids != [f"g{i:02d}" for i in range(1, len(qids) + 1)]:
        err("question ids are not g01..gNN in order")
    for k, c in Counter(e["id"] for e in gold["episodes"]).items():
        if c > 1:
            err(f"duplicate episode id {k}")

    # sessions: timestamps, roles, weekday mentions, chronological ids
    known_users = set(conv["users"])
    by_id, n_wd, prev = {}, 0, None
    for s in sessions + noise:
        dt = check_ts(s["ts"], s["id"])
        if s["user"] not in known_users:
            err(f"{s['id']}: unknown user {s['user']}")
        for i, m in enumerate(s["messages"]):
            if m["role"] not in ("user", "assistant", "other"):
                err(f"{s['id']}#{i}: role {m['role']}")
            if (m["role"] == "other") != ("author" in m):
                err(f"{s['id']}#{i}: author iff role other")
            n_wd += check_weekdays(m["content"], f"{s['id']}#{i}")
        by_id[s["id"]] = dt
    main_sessions = [s for s in conv["sessions"]]
    for s in main_sessions:
        if prev and datetime.fromisoformat(s["ts"]) <= prev:
            err(f"{s['id']}: not chronological")
        prev = datetime.fromisoformat(s["ts"])
    last_main = max(datetime.fromisoformat(s["ts"]) for s in main_sessions)
    first_main = min(datetime.fromisoformat(s["ts"]) for s in main_sessions)
    for s in noise:
        dt = datetime.fromisoformat(s["ts"])
        if not first_main <= dt <= last_main:
            err(f"{s['id']}: noise outside the main period")
        if any(m["role"] == "other" for m in s["messages"]):
            err(f"{s['id']}: noise must not contain group messages")

    # questions
    ev = {q["id"]: q["ev"] for q in QUESTIONS}
    cats = Counter(q["category"] for q in questions)
    for c, k in cats.items():
        if k < 3:
            err(f"category {c} has only {k} questions")
    for q in questions:
        if set(q) != {"id", "category", "asked_at", "q", "expected", "must_not"}:
            err(f"{q['id']}: keys {sorted(q)}")
        at = check_ts(q["asked_at"], q["id"])
        if at <= first_main:
            err(f"{q['id']}: asked before the first session")
        for sid in ev[q["id"]]:
            if sid not in by_id:
                err(f"{q['id']}: unknown evidence session {sid}")
            elif by_id[sid] >= at:
                err(f"{q['id']}: evidence {sid} ({by_id[sid]}) is not before asked_at {at}")
        n_wd += check_weekdays(q["expected"] + " " + q["q"], q["id"])

    # gold references
    main_ids = {s["id"] for s in main_sessions}
    for e in gold["episodes"]:
        for sid in e["sessions"]:
            if sid not in main_ids:
                err(f"{e['id']}: unknown session {sid}")
        if e["date"]:
            date.fromisoformat(e["date"])
        if e["kind"] not in ("event", "plan", "state_change"):
            err(f"{e['id']}: kind {e['kind']!r} not in event | plan | state_change")
        n_wd += check_weekdays(e["content"], e["id"])
        if (e["kind"] == "plan") != ("plan_outcome" in e):
            err(f"{e['id']}: plan_outcome iff kind plan")
        if e.get("plan_outcome") not in (None, "confirmed", "cancelled", "rescheduled", "unresolved"):
            err(f"{e['id']}: plan_outcome {e['plan_outcome']!r}")
        if e["date_precision"] not in ("day", "month"):
            err(f"{e['id']}: date_precision {e['date_precision']!r}")
        if not e["sessions"]:
            err(f"{e['id']}: no sessions")
    for f in gold["facts"]:
        prev_to = None
        for h in f["history"]:
            for sid in h["sessions"]:
                if sid not in main_ids:
                    err(f"fact {f['key']}: unknown session {sid}")
            for k in ("from", "to"):
                if h[k]:
                    date.fromisoformat(h[k])
            if h["from"] and h["to"] and h["from"] > h["to"]:
                err(f"fact {f['key']}: from after to")
            if prev_to is not None and h["from"] and h["from"] < prev_to:
                err(f"fact {f['key']}: history not in order")
            prev_to = h["to"]
        if f["history"][-1]["to"] is not None:
            err(f"fact {f['key']}: last value is not current")
    for i, nt in enumerate(gold["notes"]):
        for sid in nt["sessions"]:
            if sid not in main_ids:
                err(f"notes[{i}]: unknown session {sid}")
    for i, nm in enumerate(gold["not_memories"]):
        for sid in nm["sessions"]:
            if sid not in main_ids:
                err(f"not_memories[{i}]: unknown session {sid}")
    # every message addressed to the assistant by someone else must be listed in not_memories
    addressed = re.compile(r"\b(assistente|assistant|@bot|@assistente)\b", re.I)
    nm_sessions = {sid for nm in gold["not_memories"] for sid in nm["sessions"]}
    for s in main_sessions:
        for m in s["messages"]:
            if m["role"] == "other" and addressed.search(m["content"]) and s["id"] not in nm_sessions:
                err(f"{s['id']}: message to the assistant by {m['author']} not in not_memories")

    groups = sum(1 for s in SESSIONS if "group" in s)
    en = sum(1 for s in conv["sessions"] if sum(len(m["content"]) for m in s["messages"] if re.search(r"\b(the|and|you|I'm)\b", m["content"]))
             > 0.5 * sum(len(m["content"]) for m in s["messages"]))
    print(f"sessions={len(sessions)} (group chats {groups}, mostly-English {en}) noise={len(noise)} "
          f"questions={len(questions)} weekday-mentions-checked={n_wd}")
    print("categories:", dict(sorted(cats.items())))
    print("noise users:", dict(Counter(s["user"] for s in noise)))
    if ERRORS:
        print(f"\n{len(ERRORS)} ERROR(S):")
        for e in ERRORS:
            print(" -", e)
        sys.exit(1)
    print("OK")


if __name__ == "__main__":
    main()
