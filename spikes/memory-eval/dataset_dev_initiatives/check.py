# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Consistency checks for dev_initiatives: file shape, ids, dates in order and in range, weekday mentions, session
users known, gold ids unique, kinds / checkpoints / due days / `for` valid, every trap kind present, at least two
expected of each kind. Run: python check.py (exit code 1 on failure)."""
import json
import re
import sys
from collections import Counter
from datetime import date, datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
ERRORS: list[str] = []
START, END = date(2026, 9, 1), date(2026, 9, 30)
CHECKPOINTS = ["2026-09-10T22:00:00+02:00", "2026-09-20T22:00:00+02:00", "2026-09-30T22:00:00+02:00"]
KINDS = {"say", "ask", "lookup"}
TRAP_KINDS = set(range(1, 9))
OFFSETS = {"oliver": "+01:00"}

DAYS = {"it": ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"],
        "en": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]}
MONTHS = {"it": ["agosto", "settembre", "ottobre"], "en": ["august", "september", "october"]}
DAY_TO_WD = {d: i for days in DAYS.values() for i, d in enumerate(days)}
MONTH_TO_N = {m: 8 + i for months in MONTHS.values() for i, m in enumerate(months)}
# "martedì 8", "giovedì 1 ottobre", "Monday the 7th", "Thursday 1 October"
DATED = re.compile(rf"\b({'|'.join(DAY_TO_WD)})\s+(?:the\s+)?(\d{{1,2}})(?:st|nd|rd|th)?(?:\s+(?:of\s+)?({'|'.join(MONTH_TO_N)}))?", re.I)


def err(msg: str) -> None:
    ERRORS.append(msg)


def main() -> None:
    conv = json.loads((HERE / "conversations.json").read_text())
    gold = json.loads((HERE / "initiatives_gold.json").read_text())

    if set(conv) != {"_note", "users", "genders", "entities", "sessions"}:
        err(f"conversations.json keys {sorted(conv)}")
    users, entities = conv["users"], conv["entities"]
    for e in entities:
        if e not in users:
            err(f"entity {e} not in users")
    for p in users:
        if p not in entities and p not in conv["genders"]:
            err(f"personal memory {p} has no gender")

    # sessions: shape, ids, users, dates in range and in order, weekday mentions
    ids = Counter(s["id"] for s in conv["sessions"])
    for k, c in ids.items():
        if c > 1:
            err(f"duplicate session id {k}")
    prev: datetime | None = None
    per_user: Counter = Counter()
    texts: dict[str, str] = {p: "" for p in users}
    n_wd = 0
    for s in conv["sessions"]:
        where = s["id"]
        if set(s) != {"id", "user", "ts", "messages"}:
            err(f"{where}: keys {sorted(s)}")
        if s["user"] not in users:
            err(f"{where}: unknown user {s['user']}")
            continue
        per_user[s["user"]] += 1
        if not s["id"].startswith(f"{s['user']}-{s['ts'][:10]}-"):
            err(f"{where}: id does not match user and date")
        dt = datetime.fromisoformat(s["ts"])
        if not s["ts"].endswith(OFFSETS.get(s["user"], "+02:00")):
            err(f"{where}: offset {s['ts'][-6:]}")
        if not START <= dt.date() <= END:
            err(f"{where}: date out of range")
        if prev and dt < prev:
            err(f"{where}: not in time order")
        prev = dt
        msgs = s["messages"]
        if not 2 <= len(msgs) <= 8:
            err(f"{where}: {len(msgs)} messages")
        if msgs[0]["role"] != "user":
            err(f"{where}: first message is not the user's")
        for i, m in enumerate(msgs):
            if set(m) != {"role", "content"} or m["role"] not in ("user", "assistant") or not m["content"].strip():
                err(f"{where}#{i}: bad message {m}")
                continue
            texts[s["user"]] += " " + m["content"]
            for mt in DATED.finditer(m["content"]):
                wd, d = DAY_TO_WD[mt.group(1).lower()], int(mt.group(2))
                mon = MONTH_TO_N.get((mt.group(3) or "").lower())
                if mon is None:  # a bare "lunedì 21": the closest such day to the session
                    cands = [date(2026, mo, d) for mo in (dt.month, dt.month + 1) if d <= 30]
                    target = min(cands, key=lambda c: abs((c - dt.date()).days))
                else:
                    target = date(2026, mon, d)
                n_wd += 1
                if target.weekday() != wd:
                    err(f"{where}#{i}: '{mt.group(0)}' but {target} is weekday {target.weekday()}")
    for p in users:
        if not 10 <= per_user[p] <= 16:
            err(f"{p}: {per_user[p]} sessions (want 10–16)")

    # gold
    if set(gold) != {"_note", "checkpoints", "memories"}:
        err(f"gold keys {sorted(gold)}")
    if gold["checkpoints"] != CHECKPOINTS:
        err(f"checkpoints {gold['checkpoints']}")
    cps = [datetime.fromisoformat(c).date() for c in gold["checkpoints"]]
    if set(gold["memories"]) != set(users):
        err(f"gold memories {sorted(gold['memories'])} != users {sorted(users)}")
    gids: Counter = Counter()
    kinds: Counter = Counter()
    by_cp: Counter = Counter()
    trap_kinds: Counter = Counter()
    n_exp = n_trap = 0
    for mem, g in gold["memories"].items():
        if set(g) != {"expected", "traps"}:
            err(f"{mem}: keys {sorted(g)}")
        per_cp: Counter = Counter()
        for e in g["expected"]:
            n_exp += 1
            gids[e["id"]] += 1
            if not {"id", "kind", "by", "for", "desc"} <= set(e) or not set(e) <= {"id", "kind", "by", "due_day", "for", "desc"}:
                err(f"{e['id']}: keys {sorted(e)}")
                continue
            if e["kind"] not in KINDS:
                err(f"{e['id']}: kind {e['kind']}")
            kinds[e["kind"]] += 1
            if e["by"] not in (1, 2, 3):
                err(f"{e['id']}: by {e['by']}")
                continue
            by_cp[e["by"]] += 1
            per_cp[e["by"]] += 1
            if "due_day" in e:
                d = date.fromisoformat(e["due_day"])
                lo = cps[e["by"] - 2] if e["by"] > 1 else START
                if not lo <= d <= cps[e["by"] - 1]:  # due inside the window that ends at its checkpoint
                    err(f"{e['id']}: due_day {e['due_day']} outside the window of checkpoint {e['by']}")
            elif e["kind"] != "lookup":
                err(f"{e['id']}: due_day is required for a {e['kind']}")
            if e["for"] != "holder":
                if mem not in entities:
                    err(f"{e['id']}: a personal memory's initiative is for the holder")
                elif f"Sono {e['for']}" not in texts[mem]:
                    err(f"{e['id']}: nobody says 'Sono {e['for']}' in {mem}")
            if not e["desc"].strip():
                err(f"{e['id']}: empty desc")
        for cp, n in per_cp.items():
            if not 1 <= n <= 4:
                err(f"{mem}: {n} expected by checkpoint {cp} (want 1–4)")
        for tr in g["traps"]:
            n_trap += 1
            gids[tr["id"]] += 1
            if set(tr) != {"id", "desc", "why"}:
                err(f"{tr['id']}: keys {sorted(tr)}")
                continue
            m = re.search(r"\[(\d)\]$", tr["why"])
            if not m or int(m.group(1)) not in TRAP_KINDS:
                err(f"{tr['id']}: why must end with its trap kind [1-8]")
            else:
                trap_kinds[int(m.group(1))] += 1
        if not 3 <= len(g["expected"]) <= 9 or not 2 <= len(g["traps"]) <= 4:
            err(f"{mem}: {len(g['expected'])} expected, {len(g['traps'])} traps")
    for k, c in gids.items():
        if c > 1:
            err(f"duplicate gold id {k}")
    missing = TRAP_KINDS - set(trap_kinds)
    if missing:
        err(f"trap kinds not covered: {sorted(missing)}")
    for k in KINDS:
        if kinds[k] < 2:
            err(f"only {kinds[k]} expected of kind {k} (want at least 2)")
    if not 18 <= n_exp <= 26:
        err(f"{n_exp} expected in all (want 18–26)")
    if n_trap < 10:
        err(f"{n_trap} traps in all (want at least 10)")

    print(f"sessions={sum(per_user.values())} {dict(per_user)} expected={n_exp} {dict(kinds)} by-checkpoint={dict(sorted(by_cp.items()))} "
          f"traps={n_trap} trap-kinds={dict(sorted(trap_kinds.items()))} weekday-mentions-checked={n_wd}")
    if ERRORS:
        print(f"\n{len(ERRORS)} ERROR(S):")
        for e in ERRORS:
            print(" -", e)
        sys.exit(1)
    print("OK")


if __name__ == "__main__":
    main()
