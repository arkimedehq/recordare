# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Consistency checks for blind set #9: file shape (DATASET_FORMAT.md), evalkit loaders, ids in order, Europe/Rome
offsets (DST change on 29 Oct 2034), weekday/date mentions (IT / EN / ES), participants and askers, sources after their
conversation and the forget entry after its source, source-only facts absent from chats, questions asked after their
evidence, category minimums, gold references. Run: python check.py (exit code 1 on failure)."""
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
YEAR = 2034
USER = "beatrice"
MIN_PER_CATEGORY = {"agent-action": 3, "declared-group": 3, "claim": 3, "asker-self": 4, "asker-other": 2, "plan": 3,
                    "correction": 3, "state-now": 3, "knowledge": 5, "knowledge-provenance": 3, "temporal": 3,
                    "premise-trap": 2, "negative": 2}
ERRORS: list[str] = []


def err(msg: str) -> None:
    ERRORS.append(msg)


IT_DAYS = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"]
EN_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
ES_DAYS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
IT_MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre",
             "ottobre", "novembre", "dicembre"]
EN_MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october",
             "november", "december"]
ES_MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre",
             "noviembre", "diciembre"]
IT_RE = re.compile(rf"\b({'|'.join(IT_DAYS)})\s+(\d{{1,2}})°?\s+({'|'.join(IT_MONTHS)})", re.I)
EN_RE = re.compile(rf"\b({'|'.join(EN_DAYS)})\s+(?:the\s+)?(\d{{1,2}})(?:st|nd|rd|th)?\s+(?:of\s+)?({'|'.join(EN_MONTHS)})", re.I)
ES_RE = re.compile(rf"\b({'|'.join(ES_DAYS)})\s+(\d{{1,2}})\s+de\s+({'|'.join(ES_MONTHS)})", re.I)
# "giovedì 12" without a month: must be the right weekday for that day number in the session's month or the next
IT_BARE = re.compile(rf"\b({'|'.join(IT_DAYS)})\s+(\d{{1,2}})\b(?!°?\s+({'|'.join(IT_MONTHS)}))(?!:)", re.I)
# an "N ottobre" / "N October" without weekday still has to be a real date
RULES = ((IT_RE, IT_DAYS, IT_MONTHS), (EN_RE, EN_DAYS, EN_MONTHS), (ES_RE, ES_DAYS, ES_MONTHS))


def check_weekdays(text: str, where: str, ref: date | None = None) -> int:
    n = 0
    for rx, days, months in RULES:
        for m in rx.finditer(text):
            wd, d, mo = days.index(m.group(1).lower()), int(m.group(2)), months.index(m.group(3).lower()) + 1
            n += 1
            try:
                actual = date(YEAR, mo, d).weekday()
            except ValueError:
                err(f"{where}: '{m.group(0)}' is not a date")
                continue
            if actual != wd:
                err(f"{where}: '{m.group(0)}' is a {days[actual]} in {YEAR}")
    if ref is not None:
        for m in IT_BARE.finditer(text):
            wd, d = IT_DAYS.index(m.group(1).lower()), int(m.group(2))
            cands = []
            for mo in ((ref.month - 2) % 12 + 1, ref.month, ref.month % 12 + 1):
                try:
                    cands.append(date(YEAR, mo, d))
                except ValueError:
                    pass
            n += 1
            if not any(c.weekday() == wd and -10 <= (c - ref).days <= 45 for c in cands):
                err(f"{where}: bare '{m.group(0)}' matches no {m.group(1)} between 10 days before and 45 after {ref}")
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
    from _sessions import SESSIONS, SOURCES, SOURCE_ONLY  # noqa: E402

    entries, questions, user = load_sessions(), load_questions(), eval_user()
    gold = json.loads((HERE / "gold.json").read_text())
    conv = json.loads((HERE / "conversations.json").read_text())
    if user != USER:
        err(f"eval_user = {user}")
    for key in ("_note", "users", "genders", "entities", "sessions"):
        if key not in conv:
            err(f"conversations.json lacks {key}")
    if conv["genders"].get(USER) not in ("masculine", "feminine", "neutral"):
        err("genders[beatrice] missing or invalid")
    if conv["entities"]:
        err("a personal memory must not be listed in entities")

    sessions = [e for e in entries if e.get("type") is None]
    sources = [e for e in entries if e.get("type") == "source"]
    forgets = [e for e in entries if e.get("type") == "forget_source"]
    if len(sessions) + len(sources) + len(forgets) != len(entries):
        err("unknown entry types")

    # ids
    ids = [s["id"] for s in sessions]
    if ids != [f"s{i:02d}" for i in range(1, len(ids) + 1)]:
        err("session ids are not s01..sNN in chronological order")
    qids = [q["id"] for q in questions]
    if qids != [f"q{i:02d}" for i in range(1, len(qids) + 1)]:
        err("question ids are not q01..qNN in order")
    for k in sources:
        if not k["id"].startswith("k-"):
            err(f"source id {k['id']} must start with k-")
    for f in forgets:
        if f["id"] != f"forget-{f['source']}":
            err(f"forget id {f['id']} should be forget-{f['source']}")
    for k, c in Counter(e["id"] for e in entries).items():
        if c > 1:
            err(f"duplicate entry id {k}")
    for k, c in Counter(e["id"] for e in gold["episodes"]).items():
        if c > 1:
            err(f"duplicate episode id {k}")

    # sessions: shape, timestamps, roles, participants, weekday mentions, source-only facts
    by_id: dict[str, datetime] = {}
    declared: dict[str, set[str]] = {}  # identity -> names used
    n_wd, prev, all_chat = 0, None, []
    for s in sessions:
        dt = check_ts(s["ts"], s["id"])
        if prev and dt <= prev:
            err(f"{s['id']}: not chronological")
        prev = by_id[s["id"]] = dt
        if s["user"] != USER:
            err(f"{s['id']}: user {s['user']}")
        authors = set()
        for i, m in enumerate(s["messages"]):
            if m["role"] not in ("user", "assistant", "other"):
                err(f"{s['id']}#{i}: role {m['role']}")
            if (m["role"] == "other") != ("author" in m):
                err(f"{s['id']}#{i}: author iff role other")
            if m["role"] == "other":
                authors.add(m["author"])
            n_wd += check_weekdays(m["content"], f"{s['id']}#{i}", dt.date())
            all_chat.append(m["content"])
        for p in s.get("participants", []):
            if set(p) != {"name", "identity"}:
                err(f"{s['id']}: participant keys {sorted(p)}")
            if p["name"] not in authors:
                err(f"{s['id']}: declared participant {p['name']} never writes in the session")
            declared.setdefault(p["identity"], set()).add(p["name"])
        if s["messages"][0]["role"] == "assistant":
            err(f"{s['id']}: first message must not be the agent's")
    for ident, names in declared.items():
        if len(names) > 1:
            err(f"identity {ident} used with several names {sorted(names)}")
    chat_text = "\n".join(all_chat)
    for token in SOURCE_ONLY:
        if token in chat_text:
            err(f"source-only token {token!r} appears in a chat message")

    # sources: fields, order after their conversation, forget after its source
    for k in sources:
        kt = check_ts(k["ts"], k["id"])
        by_id[k["id"]] = kt
        for key in ("title", "text", "user"):
            if not k.get(key):
                err(f"{k['id']}: missing {key}")
        if k.get("kind") not in (None, "document", "page", "note", "book", "own_text"):
            err(f"{k['id']}: kind {k.get('kind')!r}")
        conv_id = k.get("conversation")
        if conv_id:
            if conv_id not in by_id:
                err(f"{k['id']}: unknown conversation {conv_id}")
            else:
                last_msg = by_id[conv_id].timestamp() + len(next(s for s in sessions if s["id"] == conv_id)["messages"])
                if kt.timestamp() <= last_msg:
                    err(f"{k['id']}: ts must be after the last message of {conv_id}")
        n_wd += check_weekdays(k["text"], k["id"])
    for f in forgets:
        ft = check_ts(f["ts"], f["id"])
        by_id[f["id"]] = ft
        if f["source"] not in by_id or by_id[f["source"]] >= ft:
            err(f"{f['id']}: must come after its source {f['source']}")
    if not (4 <= len(sources) <= 7):
        err(f"{len(sources)} sources (expected 4-7)")
    if len(forgets) != 1:
        err(f"{len(forgets)} forget entries (expected 1)")
    if not any(k.get("conversation") and not k.get("provided_by") for k in sources):
        err("no source handed over by the holder in a session (conversation without provided_by)")
    if not any(k.get("provided_by") for k in sources):
        err("no source given by a contact (provided_by)")
    first_main = min(by_id[s["id"]] for s in sessions)

    # questions
    ev = {q["id"]: q["ev"] for q in QUESTIONS}
    cats = Counter(q["category"] for q in questions)
    if set(cats) != set(MIN_PER_CATEGORY):
        err(f"categories {sorted(cats)} != {sorted(MIN_PER_CATEGORY)}")
    for c, k in MIN_PER_CATEGORY.items():
        if cats.get(c, 0) < k:
            err(f"category {c} has {cats.get(c, 0)} questions, minimum {k}")
    for q in questions:
        keys = set(q)
        if keys - {"asker"} != {"id", "category", "asked_at", "q", "expected", "must_not"}:
            err(f"{q['id']}: keys {sorted(q)}")
        if q["category"].startswith("asker-") != ("asker" in q):
            err(f"{q['id']}: asker iff category asker-*")
        if "asker" in q:
            a = q["asker"]
            if set(a) != {"name", "identity"}:
                err(f"{q['id']}: asker keys {sorted(a)}")
            elif a["identity"] not in declared or a["name"] not in declared[a["identity"]]:
                err(f"{q['id']}: asker {a} not declared in any session's participants")
        at = check_ts(q["asked_at"], q["id"])
        if at <= first_main:
            err(f"{q['id']}: asked before the first session")
        if not ev[q["id"]]:
            err(f"{q['id']}: no evidence")
        for sid in ev[q["id"]]:
            if sid not in by_id:
                err(f"{q['id']}: unknown evidence {sid}")
            elif by_id[sid] >= at:
                err(f"{q['id']}: evidence {sid} ({by_id[sid]}) is not before asked_at {at}")
        if not q["must_not"]:
            err(f"{q['id']}: empty must_not")
        n_wd += check_weekdays(q["expected"] + " " + q["q"], q["id"])
    # the forgotten source's content must be in a knowledge question's must_not
    forgotten_q = [q for q in questions if q["category"] == "knowledge" and "forget-" in " ".join(ev[q["id"]])]
    if not forgotten_q:
        err("no knowledge question on the forgotten source")

    # gold references
    for e in gold["episodes"]:
        for key in ("id", "sessions", "speaker", "kind", "date", "date_precision", "people", "plan_outcome", "content"):
            if key not in e:
                err(f"{e['id']}: missing {key}")
        for sid in e["sessions"]:
            if sid not in by_id:
                err(f"{e['id']}: unknown session {sid}")
        date.fromisoformat(e["date"])
        if e["kind"] not in ("event", "plan", "state_change"):
            err(f"{e['id']}: kind {e['kind']!r}")
        if (e["kind"] == "plan") != (e["plan_outcome"] is not None):
            err(f"{e['id']}: plan_outcome iff kind plan")
        n_wd += check_weekdays(e["content"], e["id"])
    for f in gold["facts"]:
        for h in f["history"]:
            for b in ("from", "to"):
                if h[b]:
                    date.fromisoformat(h[b])
    for n in gold["notes"]:
        if set(n) != {"category", "content"}:
            err(f"note keys {sorted(n)}")
    for i, nm in enumerate(gold["not_memories"]):
        for sid in nm["sessions"]:
            if sid not in by_id:
                err(f"not_memories[{i}]: unknown session {sid}")
    if not any("forget-" in " ".join(nm["sessions"]) for nm in gold["not_memories"]):
        err("not_memories lacks the forgotten source")

    langs = Counter(s["lang"] for s in SESSIONS)
    groups = sum(1 for s in SESSIONS if "group" in s)
    askers = Counter(q["asker"]["identity"] for q in questions if "asker" in q)
    print(f"sessions={len(sessions)} (group chats {groups}, languages {dict(langs)}) sources={len(sources)} "
          f"forget={len(forgets)} questions={len(questions)} weekday-mentions-checked={n_wd}")
    print("categories:", dict(sorted(cats.items())))
    print("askers:", dict(askers), "declared identities:", sorted(declared))
    if ERRORS:
        print(f"\n{len(ERRORS)} ERROR(S):")
        for e in ERRORS:
            print(" -", e)
        sys.exit(1)
    print("OK")


if __name__ == "__main__":
    main()
