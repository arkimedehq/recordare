# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Consistency checks for blind set #8 (entity memory): file shape, evalkit loaders, ids, Europe/Rome offsets
(DST), weekday/date mentions, entity consistency, speaker self-identification, questions asked after their
evidence, gold references. Run: python check.py (exit code 1 on failure)."""
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
ENTITY = "casa_bellandi"
HOUSEHOLD = {"Paolo", "Silvia", "Tommaso", "Irene", "Franca", "Aoife"}
CATEGORIES = {"attribution", "unidentified", "carry-over", "hand-over", "place", "plan", "correction",
              "state-now", "premise-trap", "negative"}
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
# a bare "giovedì 13" without month: checked against the closest such day to the session
IT_BARE = re.compile(rf"\b({'|'.join(IT_DAYS)})\s+(\d{{1,2}})\b(?!°?\s+({'|'.join(IT_MONTHS)}))", re.I)
ID_RE = {n: re.compile(rf"\b(sono|it's|i'm|sono io, la|sono la)\s+(di nuovo\s+)?{n}\b", re.I) for n in HOUSEHOLD}


def check_weekdays(text: str, where: str, ref: date | None = None) -> int:
    n = 0
    for rx, days, months in ((IT_RE, IT_DAYS, IT_MONTHS), (EN_RE, EN_DAYS, EN_MONTHS)):
        for m in rx.finditer(text):
            wd, d, mo = days.index(m.group(1).lower()), int(m.group(2)), months.index(m.group(3).lower()) + 1
            n += 1
            if date(YEAR, mo, d).weekday() != wd:
                err(f"{where}: '{m.group(0)}' is a {days[date(YEAR, mo, d).weekday()]} in {YEAR}")
    if ref:
        for m in IT_BARE.finditer(text):
            wd, d = IT_DAYS.index(m.group(1).lower()), int(m.group(2))
            cands = [date(YEAR, mo, d) for mo in (ref.month - 1, ref.month, ref.month + 1) if 1 <= mo <= 12]
            near = min(cands, key=lambda c: abs((c - ref).days))  # the closest such day, past or future
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
    from evalkit.common import eval_user, load_questions, load_sessions  # noqa: E402
    from _questions import QUESTIONS  # noqa: E402
    from _sessions import SESSIONS  # noqa: E402

    sessions, questions, user = load_sessions(), load_questions(), eval_user()
    gold = json.loads((HERE / "gold.json").read_text())
    conv = json.loads((HERE / "conversations.json").read_text())

    # file shape + entity consistency
    if set(conv) != {"_note", "users", "entities", "sessions"}:
        err(f"conversations.json keys {sorted(conv)}")
    if not isinstance(conv["_note"], str):
        err("_note is not a string")
    if conv["entities"] != [ENTITY] or ENTITY not in conv["users"]:
        err("entity id must be in both 'users' and 'entities'")
    if user != ENTITY or gold.get("user") != ENTITY:
        err(f"questions/gold user = {user}/{gold.get('user')}, expected {ENTITY}")
    for s in conv["sessions"]:
        if set(s) != {"id", "user", "ts", "messages"}:
            err(f"{s['id']}: session keys {sorted(s)}")
        if s["user"] != ENTITY:
            err(f"{s['id']}: user {s['user']} is not the entity")
        for i, m in enumerate(s["messages"]):
            if set(m) != {"role", "content"} or m["role"] not in ("user", "assistant"):
                err(f"{s['id']}#{i}: message {sorted(m)} role {m.get('role')}")
        if s["messages"][0]["role"] != "user":
            err(f"{s['id']}: first message must be from a person")

    # ids
    ids = [s["id"] for s in sessions]
    if ids != [f"s{i:02d}" for i in range(1, len(ids) + 1)]:
        err("session ids are not s01..sNN in chronological order")
    qids = [q["id"] for q in questions]
    if qids != [f"e{i:02d}" for i in range(1, len(qids) + 1)]:
        err("question ids are not e01..eNN in order")
    for k, c in Counter(e["id"] for e in gold["episodes"]).items():
        if c > 1:
            err(f"duplicate episode id {k}")

    # timestamps, chronology, weekday mentions, speaker self-identification
    by_id, n_wd, prev = {}, 0, None
    for s, src in zip(conv["sessions"], SESSIONS):
        dt = check_ts(s["ts"], s["id"])
        if prev and dt <= prev:
            err(f"{s['id']}: not chronological")
        prev = by_id[s["id"]] = dt
        for i, m in enumerate(s["messages"]):
            n_wd += check_weekdays(m["content"], f"{s['id']}#{i}", dt.date())
        text = " ".join(m["content"] for m in s["messages"] if m["role"] == "user")
        named = [n for n in src["speakers"] if n]
        for n in named:
            if n not in HOUSEHOLD or not ID_RE[n].search(text):
                err(f"{s['id']}: speaker {n} never identifies in the text")
        for n in HOUSEHOLD - set(named):
            if ID_RE[n].search(text):
                err(f"{s['id']}: {n} identifies but is not listed in speakers")
        # the opening message must not already name the speaker in an assistant turn before they identify
        first = s["messages"][0]["content"]
        if not named and any(ID_RE[n].search(first) for n in HOUSEHOLD):
            err(f"{s['id']}: unidentified session contains a self-identification")
        if src["speakers"][0] is None and named:
            err(f"{s['id']}: mixed unidentified + named speakers (keep unidentified sessions pure)")
    first_main = min(by_id.values())

    # questions
    ev = {q["id"]: q["ev"] for q in QUESTIONS}
    cats = Counter(q["category"] for q in questions)
    if set(cats) != CATEGORIES:
        err(f"categories {sorted(cats)} != {sorted(CATEGORIES)}")
    for c, k in cats.items():
        if k < 2:
            err(f"category {c} has only {k} questions")
    for q in questions:
        if set(q) != {"id", "category", "asked_at", "q", "expected", "must_not"}:
            err(f"{q['id']}: keys {sorted(q)}")
        at = check_ts(q["asked_at"], q["id"])
        if at <= first_main:
            err(f"{q['id']}: asked before the first session")
        if not ev[q["id"]]:
            err(f"{q['id']}: no evidence sessions")
        for sid in ev[q["id"]]:
            if sid not in by_id:
                err(f"{q['id']}: unknown evidence session {sid}")
            elif by_id[sid] >= at:
                err(f"{q['id']}: evidence {sid} ({by_id[sid]}) is not before asked_at {at}")
        n_wd += check_weekdays(q["expected"] + " " + q["q"], q["id"])

    # gold references
    speakers_of = {s["id"]: set(s["speakers"]) for s in SESSIONS}
    for e in gold["episodes"]:
        for sid in e["sessions"]:
            if sid not in by_id:
                err(f"{e['id']}: unknown session {sid}")
        if e["speaker"] is not None and e["speaker"] not in speakers_of.get(e["sessions"][0], set()):
            err(f"{e['id']}: speaker {e['speaker']} does not speak in {e['sessions'][0]}")
        if e["speaker"] is None and None not in speakers_of.get(e["sessions"][0], set()):
            err(f"{e['id']}: unidentified episode but {e['sessions'][0]} has no unidentified speaker")
        date.fromisoformat(e["date"])
        if e["kind"] not in ("event", "plan", "state_change"):
            err(f"{e['id']}: kind {e['kind']!r}")
        n_wd += check_weekdays(e["content"], e["id"])
    # every unidentified session is covered by an unidentified gold episode
    unid_eps = {sid for e in gold["episodes"] if e["speaker"] is None for sid in e["sessions"][:1]}
    for s in SESSIONS:
        if None in s["speakers"] and s["id"] not in unid_eps:
            err(f"{s['id']}: unidentified session without an unidentified gold episode")
    for i, nm in enumerate(gold["not_memories"]):
        for sid in nm["sessions"]:
            if sid not in by_id:
                err(f"not_memories[{i}]: unknown session {sid}")

    handovers = sum(1 for s in SESSIONS if len(s["speakers"]) > 1)
    unid = sum(1 for s in SESSIONS if None in s["speakers"])
    en = sum(1 for s in conv["sessions"] for m in s["messages"] if re.search(r"\b(the|and|you|I'm)\b", m["content"]))
    print(f"sessions={len(sessions)} (hand-overs {handovers}, unidentified {unid}, English messages {en}) "
          f"questions={len(questions)} weekday-mentions-checked={n_wd}")
    print("categories:", dict(sorted(cats.items())))
    if ERRORS:
        print(f"\n{len(ERRORS)} ERROR(S):")
        for e in ERRORS:
            print(" -", e)
        sys.exit(1)
    print("OK")


if __name__ == "__main__":
    main()
