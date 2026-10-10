# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Consistency checks for blind set #10 (entity memory, own content, learned sources): file shape, evalkit loaders,
ids, Europe/Rome offsets (DST), weekday/date mentions (IT/EN/DE), entity consistency, speaker self-identification,
sources after their hand-over conversation, questions asked after their evidence, category minimums, gold references.
Run: python check.py (exit code 1 on failure)."""
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
ENTITY = "camping_il_ginepro"
# people who speak (and must identify in the text); the two Martas are distinct contacts
PEOPLE = {"Ottavio", "Benedetta", "Chiara", "Nico", "Marta Venturi", "Marta Olivetti", "Katrin", "Jonas", "Fiona",
          "Rob", "Priya", "Wouter"}
MENTIONED_ONLY = {"Samira", "Till", "Pip", "Birillo"}  # must never self-identify
FIRST_NAMES = {n.split()[0] for n in PEOPLE} | MENTIONED_ONLY
MIN_PER_CATEGORY = {"own-content": 3, "agent-action": 3, "attribution": 3, "unidentified": 4, "same-name": 2,
                    "knowledge": 4, "knowledge-provenance": 2, "plan": 3, "correction": 3, "state-now": 3,
                    "premise-trap": 2, "negative": 2}
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
DE_RE = re.compile(rf"\b({'|'.join(DE_DAYS)}),?\s+(?:den\s+)?(\d{{1,2}})\.\s*({'|'.join(DE_MONTHS)})", re.I)
# a bare "giovedì 13" / "Monday 17" without month: checked against the closest such day to the entry's date
IT_BARE = re.compile(rf"\b({'|'.join(IT_DAYS)})\s+(\d{{1,2}})°?\b(?!\s+({'|'.join(IT_MONTHS)}))", re.I)
EN_BARE = re.compile(rf"\b({'|'.join(EN_DAYS)})\s+(\d{{1,2}})\b(?!(?:st|nd|rd|th)?\s+({'|'.join(EN_MONTHS)}))", re.I)
# self-identification in IT / EN / DE ("sono Nico", "I'm Fiona Hadley", "hier ist Katrin Brandt", "Jonas Brandt hier")
ID_RE = {n: re.compile(rf"(\b(sono|sono io,|i'm|i am|it's|this is|hier ist|ich bin)\s+(di nuovo\s+|again,?\s+|wieder\s+)?{n}\b"
                       rf"|\b{n}(\s+\w+)?\s+hier\b)", re.I) for n in PEOPLE | MENTIONED_ONLY}


def check_weekdays(text: str, where: str, ref: date | None = None) -> int:
    n = 0
    for rx, days, months in ((IT_RE, IT_DAYS, IT_MONTHS), (EN_RE, EN_DAYS, EN_MONTHS), (DE_RE, DE_DAYS, DE_MONTHS)):
        for m in rx.finditer(text):
            wd, d, mo = days.index(m.group(1).lower()), int(m.group(2)), months.index(m.group(3).lower()) + 1
            n += 1
            if date(YEAR, mo, d).weekday() != wd:
                err(f"{where}: '{m.group(0)}' is a {days[date(YEAR, mo, d).weekday()]} in {YEAR}")
    if ref:
        for rx, days, months in ((IT_BARE, IT_DAYS, IT_MONTHS), (EN_BARE, EN_DAYS, EN_MONTHS)):
            for m in rx.finditer(text):
                wd, d = days.index(m.group(1).lower()), int(m.group(2))
                # a range "da venerdì 7 a mercoledì 12 aprile": the month that follows applies to both days
                tail = re.match(rf"\s+(?:a|al|to|-|–)\s+\w+\s+\d{{1,2}}°?\s+({'|'.join(months)})\b", text[m.end():], re.I)
                if tail:
                    n += 1
                    mo = months.index(tail.group(1).lower()) + 1
                    if date(YEAR, mo, d).weekday() != wd:
                        err(f"{where}: '{m.group(0)} … {tail.group(1)}' is a {days[date(YEAR, mo, d).weekday()]} in {YEAR}")
                    continue
                cands = []
                for mo in (ref.month - 1, ref.month, ref.month + 1):
                    try:
                        cands.append(date(YEAR, mo, d))
                    except ValueError:
                        pass
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
    from _sessions import SESSIONS, SOURCES  # noqa: E402

    entries, questions, user = load_sessions(), load_questions(), eval_user()
    gold = json.loads((HERE / "gold.json").read_text())
    conv = json.loads((HERE / "conversations.json").read_text())
    convs = [e for e in conv["sessions"] if e.get("type") != "source"]
    sources = [e for e in conv["sessions"] if e.get("type") == "source"]

    # file shape + entity consistency
    if set(conv) != {"_note", "users", "genders", "entities", "sessions"}:
        err(f"conversations.json keys {sorted(conv)}")
    if not isinstance(conv["_note"], str):
        err("_note is not a string")
    if conv["entities"] != [ENTITY] or ENTITY not in conv["users"] or conv["genders"].get(ENTITY) != "masculine":
        err("entity id must be in 'users', 'entities' and 'genders'")
    if user != ENTITY or gold.get("user") != ENTITY:
        err(f"questions/gold user = {user}/{gold.get('user')}, expected {ENTITY}")
    if [e["ts"] for e in conv["sessions"]] != sorted(e["ts"] for e in conv["sessions"]):
        err("entries (conversations + sources) are not written in ts order")
    n_own = 0
    for s in convs:
        if set(s) != {"id", "user", "ts", "messages"}:
            err(f"{s['id']}: session keys {sorted(s)}")
        if s["user"] != ENTITY:
            err(f"{s['id']}: user {s['user']} is not the entity")
        for i, m in enumerate(s["messages"]):
            keys = set(m)
            if keys == {"role", "content", "own"}:
                n_own += 1
                if m["role"] != "user" or m["own"] is not True:
                    err(f"{s['id']}#{i}: own content must be role user with own: true")
            elif keys != {"role", "content"} or m["role"] not in ("user", "assistant"):
                err(f"{s['id']}#{i}: message {sorted(m)} role {m.get('role')}")
        if s["messages"][0]["role"] != "user":
            err(f"{s['id']}: first message must be from a person")
    if n_own < 3:
        err(f"only {n_own} own-content messages")
    for k in sources:
        allowed = {"type", "id", "user", "ts", "title", "text", "kind", "author", "provided_by", "conversation"}
        if not {"type", "id", "user", "ts", "title", "text"} <= set(k) or not set(k) <= allowed:
            err(f"{k['id']}: source keys {sorted(k)}")
        if k["user"] != ENTITY or not k["id"].startswith("k-"):
            err(f"{k['id']}: source user/id")
        if k.get("kind") not in (None, "document", "page", "note", "book", "own_text"):
            err(f"{k['id']}: kind {k.get('kind')!r}")
        if k.get("provided_by") is not None and k["provided_by"] not in PEOPLE:
            err(f"{k['id']}: provided_by {k['provided_by']} is not a known person")
    if len(sources) < 3:
        err(f"only {len(sources)} learned sources")
    if not any(k.get("provided_by") for k in sources) or not any(k.get("conversation") for k in sources):
        err("need at least one source with provided_by and one with conversation")

    # ids
    ids = [s["id"] for s in convs]
    if ids != [f"s{i:02d}" for i in range(1, len(ids) + 1)]:
        err("conversation ids are not s01..sNN in chronological order")
    qids = [q["id"] for q in questions]
    if qids != [f"q{i:02d}" for i in range(1, len(qids) + 1)]:
        err("question ids are not q01..qNN in order")
    for k, c in Counter(e["id"] for e in conv["sessions"]).items():
        if c > 1:
            err(f"duplicate entry id {k}")
    for k, c in Counter(e["id"] for e in gold["episodes"]).items():
        if c > 1:
            err(f"duplicate episode id {k}")

    # timestamps, chronology, weekday mentions, speaker self-identification
    by_id, end_of, n_wd, prev = {}, {}, 0, None
    src_by_id = {s["id"]: s for s in SESSIONS}
    for s in convs:
        src = src_by_id[s["id"]]
        dt = check_ts(s["ts"], s["id"])
        if prev and dt <= prev:
            err(f"{s['id']}: not chronological")
        prev = by_id[s["id"]] = dt
        end_of[s["id"]] = dt + timedelta(seconds=len(s["messages"]))
        for i, m in enumerate(s["messages"]):
            n_wd += check_weekdays(m["content"], f"{s['id']}#{i}", dt.date())
        text = " ".join(m["content"] for m in s["messages"] if m["role"] == "user")
        a_text = " ".join(m["content"] for m in s["messages"] if m["role"] == "assistant")
        named = [n for n in src["speakers"] if n]
        for n in named:
            if n not in PEOPLE or not ID_RE[n].search(text):
                err(f"{s['id']}: speaker {n} never identifies in the text")
        for n in (PEOPLE | MENTIONED_ONLY) - set(named):
            if ID_RE[n].search(text):
                err(f"{s['id']}: {n} identifies but is not listed in speakers")
        if src["speakers"][0] is None:
            if named:
                err(f"{s['id']}: mixed unidentified + named speakers (keep unidentified sessions pure)")
            # the assistant must not put a name on an unidentified speaker
            for n in FIRST_NAMES:
                if re.search(rf"\b{n}\b", a_text):
                    err(f"{s['id']}: assistant names {n} in an unidentified session")
        if len(named) > 1 and len(set(named)) < 2:
            err(f"{s['id']}: hand-over needs two different people")
    for k in sources:
        dt = check_ts(k["ts"], k["id"])
        by_id[k["id"]] = dt
        if k.get("conversation"):
            if k["conversation"] not in end_of:
                err(f"{k['id']}: unknown conversation {k['conversation']}")
            elif dt <= end_of[k["conversation"]]:
                err(f"{k['id']}: ts {k['ts']} is not after the last message of {k['conversation']}")
        n_wd += check_weekdays(k["text"], k["id"])
    first_main = min(by_id.values())

    # questions
    ev = {q["id"]: q["ev"] for q in QUESTIONS}
    cats = Counter(q["category"] for q in questions)
    if set(cats) != set(MIN_PER_CATEGORY):
        err(f"categories {sorted(cats)} != {sorted(MIN_PER_CATEGORY)}")
    for c, k in MIN_PER_CATEGORY.items():
        if cats.get(c, 0) < k:
            err(f"category {c} has {cats.get(c, 0)} questions, minimum {k}")
    for q in questions:
        if set(q) != {"id", "category", "asked_at", "q", "expected", "must_not"}:
            err(f"{q['id']}: keys {sorted(q)}")
        if not q["must_not"]:
            err(f"{q['id']}: empty must_not")
        at = check_ts(q["asked_at"], q["id"])
        if at <= first_main:
            err(f"{q['id']}: asked before the first entry")
        if not ev[q["id"]]:
            err(f"{q['id']}: no evidence entries")
        for sid in ev[q["id"]]:
            if sid not in by_id:
                err(f"{q['id']}: unknown evidence entry {sid}")
            elif by_id[sid] >= at:
                err(f"{q['id']}: evidence {sid} ({by_id[sid]}) is not before asked_at {at}")
        n_wd += check_weekdays(q["expected"] + " " + q["q"], q["id"])

    # gold references
    speakers_of = {s["id"]: set(s["speakers"]) for s in SESSIONS}
    for e in gold["episodes"]:
        if set(e) != {"id", "sessions", "speaker", "kind", "date", "date_precision", "people", "plan_outcome", "content"}:
            err(f"{e['id']}: keys {sorted(e)}")
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
        for p in e["people"]:
            if p != "self" and p not in PEOPLE | MENTIONED_ONLY:
                err(f"{e['id']}: unknown person {p}")
        n_wd += check_weekdays(e["content"], e["id"])
    unid_eps = {sid for e in gold["episodes"] if e["speaker"] is None for sid in e["sessions"][:1]}
    for s in SESSIONS:
        if None in s["speakers"] and s["id"] not in unid_eps:
            err(f"{s['id']}: unidentified session without an unidentified gold episode")
    for f in gold["facts"]:
        if set(f) != {"key", "history"} or not f["history"]:
            err(f"fact {f.get('key')}: shape")
        for h in f["history"]:
            if set(h) != {"value", "from", "to"}:
                err(f"fact {f['key']}: history keys {sorted(h)}")
            for d in (h["from"], h["to"]):
                if d is not None:
                    date.fromisoformat(d)
    for n in gold["notes"]:
        if set(n) != {"category", "content"}:
            err(f"note keys {sorted(n)}")
    for i, nm in enumerate(gold["not_memories"]):
        for sid in nm["sessions"]:
            if sid not in by_id:
                err(f"not_memories[{i}]: unknown session {sid}")
    gold_src = {g["id"]: g for g in gold["sources"]}
    if set(gold_src) != {k["id"] for k in sources}:
        err(f"gold sources {sorted(gold_src)} != dataset sources {sorted(k['id'] for k in sources)}")
    for k in sources:
        g = gold_src.get(k["id"])
        if g and (g["provided_by"] != k.get("provided_by") or g["conversation"] != k.get("conversation")
                  or g["learned"] != k["ts"][:10]):
            err(f"{k['id']}: gold provenance differs from the dataset entry")

    handovers = sum(1 for s in SESSIONS if len(s["speakers"]) > 1)
    unid = sum(1 for s in SESSIONS if None in s["speakers"])
    en = sum(1 for s in convs if re.search(r"\b(the|and|you|I'm|it's|we've)\b", s["messages"][0]["content"]))
    de = sum(1 for s in convs if re.search(r"\b(ich|wir|hier ist|Guten Tag|Hallo)\b", s["messages"][0]["content"]))
    print(f"conversations={len(convs)} (hand-overs {handovers}, unidentified {unid}, English {en}, German {de}) "
          f"sources={len(sources)} own-messages={n_own} questions={len(questions)} weekday-mentions-checked={n_wd}")
    print("categories:", dict(sorted(cats.items())))
    if ERRORS:
        print(f"\n{len(ERRORS)} ERROR(S):")
        for e in ERRORS:
            print(" -", e)
        sys.exit(1)
    print("OK")


if __name__ == "__main__":
    main()
