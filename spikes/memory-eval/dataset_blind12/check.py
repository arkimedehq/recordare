# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Consistency checks for blind set #12 (personal memory, H1): file shape, evalkit loaders, ids, Europe/Rome offsets
(DST), weekday/date mentions (Italian, English), messages one second apart and sessions in time order, group-chat
authors declared, questions asked after all their evidence, category minimums, gold references.
Run: python3 check.py (exit code 1 on failure)."""
import json
import os
import re
import sys
from collections import Counter
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
ROME = ZoneInfo("Europe/Rome")
YEAR = 2034
HOLDER = "tommaso"
# category -> minimum number of questions (the eight H1 categories); optional ones are capped together
MIN = {"plan-unresolved": 7, "plan-implicit": 6, "plan-moved": 6, "premise-trap": 6, "accumulate": 5, "supersede": 5,
       "correction-vs-change": 6, "negative": 3}
OPTIONAL = {"state-at-date", "count", "cross-language"}
LANGS = {"it", "en"}
OUTCOMES = {"confirmed", "cancelled", "missed", "unresolved", "open"}
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
EN_RE = re.compile(rf"\b({'|'.join(EN_DAYS)}),?\s+(?:the\s+)?(\d{{1,2}})(?:st|nd|rd|th)?\s+(?:of\s+)?"
                   rf"({'|'.join(EN_MONTHS)})", re.I)
EN_ABBR = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
EN_ABBR_RE = re.compile(r"\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2})\s+(Feb|Mar|Apr|May|Jun)\b")
ABBR_MONTH = {"Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6}
# a bare "giovedì 14" / "Thursday 14" without month: checked against the closest such day to the reference date
IT_BARE = re.compile(rf"\b({'|'.join(IT_DAYS)})\s+(\d{{1,2}})\b(?!:\d)(?!°?\s+({'|'.join(IT_MONTHS)}))", re.I)
EN_BARE = re.compile(rf"\b({'|'.join(EN_DAYS)}),?\s+(\d{{1,2}})\b(?!:\d)(?!\s+({'|'.join(EN_MONTHS)}))", re.I)


# a range "sabato 22 a martedì 25 aprile" / "Monday 15 to Wednesday 17 May": the first day takes the second's month
RANGE_RE = re.compile(rf"\b({'|'.join(IT_DAYS + EN_DAYS)})\s+(\d{{1,2}})\s+(?:a|al|to|–|-)\s+"
                      rf"({'|'.join(IT_DAYS + EN_DAYS)})\s+(\d{{1,2}})°?\s+({'|'.join(IT_MONTHS + EN_MONTHS)})", re.I)


def day_index(name: str) -> int:
    name = name.lower()
    return IT_DAYS.index(name) if name in IT_DAYS else EN_DAYS.index(name)


def month_index(name: str) -> int:
    name = name.lower()
    return (IT_MONTHS.index(name) if name in IT_MONTHS else EN_MONTHS.index(name)) + 1


def check_weekdays(text: str, where: str, ref: date | None = None) -> int:
    n = 0
    for m in RANGE_RE.finditer(text):
        d = date(YEAR, month_index(m.group(5)), int(m.group(2)))
        n += 1
        if d.weekday() != day_index(m.group(1)):
            err(f"{where}: range start '{m.group(0)}' is wrong in {YEAR}")
    text = RANGE_RE.sub(lambda m: m.group(0)[m.start(3) - m.start(0):], text)  # the end is checked below
    for rx, days, months in ((IT_RE, IT_DAYS, IT_MONTHS), (EN_RE, EN_DAYS, EN_MONTHS)):
        for m in rx.finditer(text):
            wd, d, mo = days.index(m.group(1).lower()), int(m.group(2)), months.index(m.group(3).lower()) + 1
            n += 1
            if date(YEAR, mo, d).weekday() != wd:
                err(f"{where}: '{m.group(0)}' is a {days[date(YEAR, mo, d).weekday()]} in {YEAR}")
    for m in EN_ABBR_RE.finditer(text):
        d = date(YEAR, ABBR_MONTH[m.group(3)], int(m.group(2)))
        n += 1
        if d.weekday() != EN_ABBR.index(m.group(1)):
            err(f"{where}: '{m.group(0)}' is wrong in {YEAR}")
    if ref:
        for rx, days in ((IT_BARE, IT_DAYS), (EN_BARE, EN_DAYS)):
            for m in rx.finditer(text):
                wd, d = days.index(m.group(1).lower()), int(m.group(2))
                cands = []
                for mo in (ref.month - 1, ref.month, ref.month + 1):
                    try:
                        cands.append(date(YEAR, mo, d))
                    except ValueError:
                        pass
                near = min(cands, key=lambda c: abs((c - ref).days))
                n += 1
                if near.weekday() != wd:
                    err(f"{where}: bare '{m.group(0)}' does not match {near}")
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
    try:  # the loaders need neither package: stub them when the spike's venv is not active (plain python3)
        import dotenv  # noqa: F401
        import openai  # noqa: F401
    except ImportError:
        import types
        sys.modules.setdefault("dotenv", types.SimpleNamespace(load_dotenv=lambda *a, **k: None))
        sys.modules.setdefault("openai", types.SimpleNamespace(OpenAI=object))
    from evalkit.common import eval_user, load_questions, load_sessions  # noqa: E402
    from _questions import QUESTIONS  # noqa: E402
    from _sessions import SESSIONS  # noqa: E402

    sessions, questions, user = load_sessions(), load_questions(), eval_user()
    gold = json.loads((HERE / "gold.json").read_text())
    conv = json.loads((HERE / "conversations.json").read_text())
    qfile = json.loads((HERE / "questions.json").read_text())

    # file shape
    if set(conv) != {"_note", "users", "genders", "entities", "sessions"}:
        err(f"conversations.json keys {sorted(conv)}")
    if conv["entities"] != [] or HOLDER not in conv["users"] or conv["genders"].get(HOLDER) != "masculine":
        err("holder must be a personal memory in 'users' with a gender, and 'entities' empty")
    if user != HOLDER or gold.get("user") != HOLDER or qfile.get("holder") != "Tommaso":
        err(f"questions/gold user = {user}/{gold.get('user')}, holder {qfile.get('holder')}")
    if len(sessions) != len(conv["sessions"]):
        err("loader and file disagree")

    # sessions
    ids = [s["id"] for s in conv["sessions"]]
    if ids != [f"s{i:02d}" for i in range(1, len(ids) + 1)]:
        err("session ids are not s01..sNN in chronological order")
    if len(set(ids)) != len(ids):
        err("duplicate session ids")
    src = {s["id"]: s for s in SESSIONS}
    start, end, n_wd, n_msg = {}, {}, 0, 0
    for s in conv["sessions"]:
        if not {"id", "user", "ts", "messages"} <= set(s) or not set(s) <= {"id", "user", "ts", "messages", "group",
                                                                            "participants"}:
            err(f"{s['id']}: session keys {sorted(s)}")
        if s["user"] != HOLDER:
            err(f"{s['id']}: user {s['user']}")
        if not 4 <= len(s["messages"]) <= 14:
            err(f"{s['id']}: {len(s['messages'])} messages (4–14 expected)")
        if src[s["id"]]["lang"] not in LANGS:
            err(f"{s['id']}: lang")
        dt = check_ts(s["ts"], s["id"])
        start[s["id"]], end[s["id"]] = dt, dt + timedelta(seconds=len(s["messages"]) - 1)
        declared = {p["name"] for p in s.get("participants", [])}
        if ("group" in s) != ("participants" in s):
            err(f"{s['id']}: group and participants go together")
        for i, m in enumerate(s["messages"]):
            n_msg += 1
            if m["role"] == "other":
                if set(m) != {"role", "author", "content"} or m["author"] not in declared:
                    err(f"{s['id']}#{i}: other message without a declared author")
            elif m["role"] in ("user", "assistant"):
                if set(m) != {"role", "content"}:
                    err(f"{s['id']}#{i}: keys {sorted(m)}")
                if m["role"] == "assistant" and "group" in s:
                    err(f"{s['id']}#{i}: the agent does not speak in group chats")
            else:
                err(f"{s['id']}#{i}: role {m['role']}")
            if not m["content"].strip():
                err(f"{s['id']}#{i}: empty")
            n_wd += check_weekdays(m["content"], f"{s['id']}#{i}", dt.date())
    for a, b in zip(ids, ids[1:]):
        if end[a] >= start[b]:
            err(f"{a} ends {end[a]} at/after {b} starts {start[b]}")

    # questions
    meta = {q["id"]: q for q in QUESTIONS}
    qids = [q["id"] for q in questions]
    if qids != [f"h{i:02d}" for i in range(1, len(qids) + 1)]:
        err("question ids are not h01..hNN in order")
    cats = Counter(q["category"] for q in questions)
    for c, k in MIN.items():
        if cats[c] < k:
            err(f"category {c}: {cats[c]} < {k}")
    unknown = set(cats) - set(MIN) - OPTIONAL
    if unknown:
        err(f"unknown categories {unknown}")
    if sum(cats[c] for c in OPTIONAL) > 8:
        err("more than 8 optional-category questions")
    if sum(cats[c] for c in MIN) < 42:
        err("fewer than 42 questions in the eight H1 categories")
    first = min(start.values())
    for q in questions:
        if set(q) != {"id", "category", "asked_at", "q", "expected", "must_not"}:
            err(f"{q['id']}: keys {sorted(q)}")
        if meta[q["id"]]["lang"] not in LANGS:
            err(f"{q['id']}: lang")
        at = check_ts(q["asked_at"], q["id"])
        if at <= first:
            err(f"{q['id']}: asked before the first session")
        ev = meta[q["id"]]["ev"]
        if not ev:
            err(f"{q['id']}: no evidence")
        for sid in ev:
            if sid not in end:
                err(f"{q['id']}: unknown evidence {sid}")
            elif end[sid] >= at:
                err(f"{q['id']}: evidence {sid} (ends {end[sid]}) is not before asked_at {at}")
        if not isinstance(q["must_not"], list):
            err(f"{q['id']}: must_not is not a list")
        n_wd += check_weekdays(q["expected"] + " " + q["q"], q["id"], at.date())

    # gold references
    speakers = {s["id"]: {"Tommaso"} | {m["author"] for m in s["messages"] if m["role"] == "other"}
                for s in conv["sessions"]}
    for k, c in Counter(e["id"] for e in gold["episodes"]).items():
        if c > 1:
            err(f"duplicate episode id {k}")
    for e in gold["episodes"]:
        if set(e) != {"id", "sessions", "speaker", "kind", "date", "date_precision", "people", "plan_outcome", "content"}:
            err(f"{e['id']}: keys {sorted(e)}")
        for sid in e["sessions"]:
            if sid not in speakers:
                err(f"{e['id']}: unknown session {sid}")
        if e["speaker"] not in speakers.get(e["sessions"][0], set()):
            err(f"{e['id']}: speaker {e['speaker']} does not speak in {e['sessions'][0]}")
        date.fromisoformat(e["date"])
        if e["kind"] not in ("event", "plan", "state_change"):
            err(f"{e['id']}: kind {e['kind']!r}")
        if e["kind"] == "plan" and e["plan_outcome"] not in OUTCOMES:
            err(f"{e['id']}: plan_outcome {e['plan_outcome']!r}")
        if e["kind"] != "plan" and e["plan_outcome"] is not None:
            err(f"{e['id']}: plan_outcome on a non-plan")
        n_wd += check_weekdays(e["content"], e["id"])
    covered = {sid for e in gold["episodes"] for sid in e["sessions"]}
    for sid in ids:
        if sid not in covered:
            err(f"{sid}: no gold episode covers it")
    for f in gold["facts"]:
        for h in f["history"]:
            for k in ("from", "to"):
                if h[k] is not None:
                    date.fromisoformat(h[k])
    for i, nm in enumerate(gold["not_memories"]):
        for sid in nm["sessions"]:
            if sid not in speakers:
                err(f"not_memories[{i}]: unknown session {sid}")

    groups = sum(1 for s in conv["sessions"] if "group" in s)
    print(f"sessions={len(ids)} (group chats {groups}) messages={n_msg} questions={len(questions)} "
          f"weekday-mentions-checked={n_wd}")
    print(f"period: {conv['sessions'][0]['ts']} .. {conv['sessions'][-1]['ts']}")
    print("session languages:", dict(Counter(s["lang"] for s in SESSIONS)))
    print("question languages:", dict(Counter(q["lang"] for q in QUESTIONS)))
    print("categories:", dict(sorted(cats.items())))
    if ERRORS:
        print(f"\n{len(ERRORS)} ERROR(S):")
        for e in ERRORS:
            print(" -", e)
        sys.exit(1)
    print("OK")


if __name__ == "__main__":
    main()
