# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Consistency checks for blind set #11 (entity memory, Ciclofficina Raggio): file shape, evalkit loaders, ids,
Europe/Rome offsets (DST), weekday/date mentions (Italian, English, German), messages one second apart and entries in
time order, own-content flags, learned / forgotten sources, speaker self-identification, questions asked after all
their evidence, gold references. Run: python3 check.py (exit code 1 on failure)."""
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
YEAR = 2032
ENTITY = "ciclofficina_raggio"
# who may speak, and how each one identifies in the text ("Marco" = a Marco without surname)
ID_RE = {
    "Ettore": re.compile(r"\bsono Ettore\b", re.I),
    "Giada": re.compile(r"\bsono Giada\b", re.I),
    "Marco Tomasi": re.compile(r"\bsono Marco Tomasi\b", re.I),
    "Marco Dallapiccola": re.compile(r"\bsono Marco Dallapiccola\b", re.I),
    "Marco": re.compile(r"\bsono Marco\b(?!\s+(Tomasi|Dallapiccola))", re.I),
    "Rhys": re.compile(r"\b(I'm|it's) Rhys\b"),
    "Katharina": re.compile(r"\b(ich bin|ich bin's,) Katharina\b", re.I),
    "Bruna": re.compile(r"\bsono Bruna\b", re.I),
}
CATEGORIES = {"own-content", "own-action", "attribution", "unidentified", "carry-over", "hand-over", "same-name",
              "source", "plan", "correction", "state-as-of", "premise-trap", "negative"}
LANGS = {"it", "en", "de"}
SOURCE_KEYS = {"type", "id", "user", "ts", "title", "text", "kind", "author", "provided_by", "conversation"}
ERRORS: list[str] = []


def err(msg: str) -> None:
    ERRORS.append(msg)


IT_DAYS = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"]
EN_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
DE_DAYS = ["montag", "dienstag", "mittwoch", "donnerstag", "freitag", "samstag", "sonntag"]
IT_MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre",
             "ottobre", "novembre", "dicembre"]
EN_MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october",
             "november", "december"]
DE_MONTHS = ["januar", "februar", "märz", "april", "mai", "juni", "juli", "august", "september", "oktober",
             "november", "dezember"]
IT_RE = re.compile(rf"\b({'|'.join(IT_DAYS)})\s+(\d{{1,2}})°?\s+({'|'.join(IT_MONTHS)})", re.I)
EN_RE = re.compile(rf"\b({'|'.join(EN_DAYS)})\s+(?:the\s+)?(\d{{1,2}})(?:st|nd|rd|th)?\s+(?:of\s+)?({'|'.join(EN_MONTHS)})", re.I)
DE_RE = re.compile(rf"\b({'|'.join(DE_DAYS)}),?\s+(?:den\s+)?(\d{{1,2}})\.\s+({'|'.join(DE_MONTHS)})", re.I)
# abbreviated English weekdays in the gold ("Thu 14 Oct")
EN_ABBR_RE = re.compile(r"\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2})\s+(Oct|Nov)\b")
# a bare "giovedì 14" without month: checked against the closest such day to the session
IT_BARE = re.compile(rf"\b({'|'.join(IT_DAYS)})\s+(\d{{1,2}})\b(?!:\d)(?!°?\s+({'|'.join(IT_MONTHS)}))", re.I)


def check_weekdays(text: str, where: str, ref: date | None = None) -> int:
    n = 0
    for rx, days, months in ((IT_RE, IT_DAYS, IT_MONTHS), (EN_RE, EN_DAYS, EN_MONTHS), (DE_RE, DE_DAYS, DE_MONTHS)):
        for m in rx.finditer(text):
            wd, d, mo = days.index(m.group(1).lower()), int(m.group(2)), months.index(m.group(3).lower()) + 1
            n += 1
            if date(YEAR, mo, d).weekday() != wd:
                err(f"{where}: '{m.group(0)}' is a {days[date(YEAR, mo, d).weekday()]} in {YEAR}")
    for m in EN_ABBR_RE.finditer(text):
        wd = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].index(m.group(1))
        d, mo = int(m.group(2)), {"Oct": 10, "Nov": 11}[m.group(3)]
        n += 1
        if date(YEAR, mo, d).weekday() != wd:
            err(f"{where}: '{m.group(0)}' is wrong in {YEAR}")
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
    try:  # the loaders need neither package: stub them when the spike's venv is not active (plain python3)
        import dotenv  # noqa: F401
        import openai  # noqa: F401
    except ImportError:
        import types
        sys.modules.setdefault("dotenv", types.SimpleNamespace(load_dotenv=lambda *a, **k: None))
        sys.modules.setdefault("openai", types.SimpleNamespace(OpenAI=object))
    from evalkit.common import eval_user, load_questions, load_sessions  # noqa: E402
    from _questions import QUESTIONS  # noqa: E402
    from _sessions import SESSIONS, SOURCES  # noqa: E402

    entries, questions, user = load_sessions(), load_questions(), eval_user()
    gold = json.loads((HERE / "gold.json").read_text())
    conv = json.loads((HERE / "conversations.json").read_text())

    # file shape + entity consistency
    if set(conv) != {"_note", "users", "genders", "entities", "sessions"}:
        err(f"conversations.json keys {sorted(conv)}")
    if conv["entities"] != [ENTITY] or ENTITY not in conv["users"]:
        err("entity id must be in both 'users' and 'entities'")
    if user != ENTITY or gold.get("user") != ENTITY:
        err(f"questions/gold user = {user}/{gold.get('user')}, expected {ENTITY}")
    if [e["ts"] for e in conv["sessions"]] != sorted(e["ts"] for e in conv["sessions"]):
        err("conversations.json entries are not in ts order")

    convs = [e for e in conv["sessions"] if "type" not in e]
    srcs = [e for e in conv["sessions"] if e.get("type") == "source"]
    forgets = [e for e in conv["sessions"] if e.get("type") == "forget_source"]
    if len(convs) + len(srcs) + len(forgets) != len(conv["sessions"]) or len(entries) != len(conv["sessions"]):
        err("unknown entry types")
    n_own = 0
    for s in convs:
        if set(s) != {"id", "user", "ts", "messages"}:
            err(f"{s['id']}: session keys {sorted(s)}")
        if s["user"] != ENTITY:
            err(f"{s['id']}: user {s['user']} is not the entity")
        for i, m in enumerate(s["messages"]):
            if m["role"] not in ("user", "assistant") or not set(m) <= {"role", "content", "own"}:
                err(f"{s['id']}#{i}: message {sorted(m)} role {m.get('role')}")
            if "own" in m:
                n_own += 1
                if m["own"] is not True or m["role"] != "user":
                    err(f"{s['id']}#{i}: own must be true on a user message")
        if s["messages"][0]["role"] != "user":
            err(f"{s['id']}: first message must be from a person")

    # ids
    ids = [s["id"] for s in convs]
    if ids != [f"s{i:02d}" for i in range(1, len(ids) + 1)]:
        err("session ids are not s01..sNN in chronological order")
    all_ids = [e["id"] for e in conv["sessions"]]
    if len(set(all_ids)) != len(all_ids):
        err("duplicate entry ids")
    qids = [q["id"] for q in questions]
    if qids != [f"q{i:02d}" for i in range(1, len(qids) + 1)]:
        err("question ids are not q01..qNN in order")
    for k, c in Counter(e["id"] for e in gold["episodes"]).items():
        if c > 1:
            err(f"duplicate episode id {k}")

    # timestamps, chronology (sessions end before the next entry starts), weekday mentions, self-identification
    start, end, n_wd = {}, {}, 0
    src_by_id = {s["id"]: s for s in SESSIONS}
    for s in convs:
        dt = check_ts(s["ts"], s["id"])
        start[s["id"]], end[s["id"]] = dt, dt + timedelta(seconds=len(s["messages"]) - 1)
        for i, m in enumerate(s["messages"]):
            n_wd += check_weekdays(m["content"], f"{s['id']}#{i}", dt.date())
        src = src_by_id[s["id"]]
        if src["lang"] not in LANGS:
            err(f"{s['id']}: lang {src['lang']}")
        text = " ".join(m["content"] for m in s["messages"] if m["role"] == "user")
        named = [n for n in src["speakers"] if n]
        for n in named:
            if n not in ID_RE or not ID_RE[n].search(text):
                err(f"{s['id']}: speaker {n} never identifies in the text")
        for n in set(ID_RE) - set(named):
            if ID_RE[n].search(text):
                err(f"{s['id']}: {n} identifies but is not listed in speakers")
        if src["speakers"][0] is None and named:
            err(f"{s['id']}: an unidentified opening speaker followed by a named one (keep unidentified sessions pure)")
        if src["speakers"][0] is None and any(m["role"] == "user" and m.get("own") for m in s["messages"]):
            err(f"{s['id']}: own content from an unidentified speaker")
    for e in srcs + forgets:
        dt = check_ts(e["ts"], e["id"])
        start[e["id"]] = end[e["id"]] = dt
        if e["user"] != ENTITY:
            err(f"{e['id']}: user {e['user']}")
    ordered = sorted(start, key=lambda k: start[k])
    for a, b in zip(ordered, ordered[1:]):
        if end[a] >= start[b]:
            err(f"{a} ends {end[a]} at/after {b} starts {start[b]}")

    # sources and forgets
    src_ids = {e["id"] for e in srcs}
    for e in srcs:
        if not set(e) <= SOURCE_KEYS or not {"type", "id", "user", "ts", "title", "text"} <= set(e):
            err(f"{e['id']}: source keys {sorted(e)}")
        if e.get("kind") not in (None, "document", "page", "note", "book", "own_text"):
            err(f"{e['id']}: kind {e.get('kind')}")
        conv_id = e.get("conversation")
        if conv_id:
            if conv_id not in end or end[conv_id] >= start[e["id"]]:
                err(f"{e['id']}: conversation {conv_id} missing or not over before the source's ts")
            elif e.get("provided_by") and e["provided_by"] not in src_by_id[conv_id]["speakers"]:
                err(f"{e['id']}: provided_by {e['provided_by']} does not speak in {conv_id}")
        n_wd += check_weekdays(e["text"], e["id"])
    for e in forgets:
        if set(e) != {"type", "id", "user", "ts", "source"}:
            err(f"{e['id']}: forget keys {sorted(e)}")
        if e["source"] not in src_ids or start[e["source"]] >= start[e["id"]]:
            err(f"{e['id']}: forgets unknown or later source {e['source']}")

    # questions
    meta = {q["id"]: q for q in QUESTIONS}
    cats = Counter(q["category"] for q in questions)
    if set(cats) != CATEGORIES:
        err(f"categories {sorted(cats)} != {sorted(CATEGORIES)}")
    for c, k in cats.items():
        if k < 2:
            err(f"category {c} has only {k} questions")
    for q in questions:
        if set(q) != {"id", "category", "asked_at", "q", "expected", "must_not"}:
            err(f"{q['id']}: keys {sorted(q)}")
        if meta[q["id"]]["lang"] not in LANGS:
            err(f"{q['id']}: lang")
        at = check_ts(q["asked_at"], q["id"])
        if at <= min(start.values()):
            err(f"{q['id']}: asked before the first entry")
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
        n_wd += check_weekdays(q["expected"] + " " + q["q"], q["id"])

    # gold references
    speakers_of = {s["id"]: set(s["speakers"]) for s in SESSIONS}
    for e in gold["episodes"]:
        if set(e) != {"id", "sessions", "speaker", "kind", "date", "date_precision", "people", "plan_outcome", "content"}:
            err(f"{e['id']}: keys {sorted(e)}")
        for sid in e["sessions"]:
            if sid not in speakers_of:
                err(f"{e['id']}: unknown session {sid}")
        first = speakers_of.get(e["sessions"][0], set())
        if e["speaker"] not in first:
            err(f"{e['id']}: speaker {e['speaker']} does not speak in {e['sessions'][0]}")
        date.fromisoformat(e["date"])
        if e["kind"] not in ("event", "plan", "state_change"):
            err(f"{e['id']}: kind {e['kind']!r}")
        if e["kind"] != "plan" and e["plan_outcome"] is not None:
            err(f"{e['id']}: plan_outcome on a non-plan")
        n_wd += check_weekdays(e["content"], e["id"])
    unid_eps = {e["sessions"][0] for e in gold["episodes"] if e["speaker"] is None}
    for s in SESSIONS:
        if None in s["speakers"] and s["id"] not in unid_eps:
            err(f"{s['id']}: unidentified session without an unidentified gold episode")
    covered = {sid for e in gold["episodes"] for sid in e["sessions"]}
    for s in SESSIONS:
        if s["id"] not in covered:
            err(f"{s['id']}: no gold episode covers it")
    for f in gold["facts"]:
        for h in f["history"]:
            for k in ("from", "to"):
                if h[k] is not None:
                    date.fromisoformat(h[k])
    for i, nm in enumerate(gold["not_memories"]):
        for sid in nm["sessions"]:
            if sid not in speakers_of:
                err(f"not_memories[{i}]: unknown session {sid}")

    handovers = sum(1 for s in SESSIONS if len(s["speakers"]) > 1)
    unid = sum(1 for s in SESSIONS if None in s["speakers"])
    print(f"sessions={len(convs)} (hand-overs {handovers}, with an unidentified speaker {unid}, own messages {n_own}) "
          f"sources={len(srcs)} forgets={len(forgets)} questions={len(questions)} weekday-mentions-checked={n_wd}")
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
