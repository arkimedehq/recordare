# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Consistency checks for the blind recurring-patterns set: file shape, ids, offsets (DST per memory time zone),
the 90-day window, weekday/date mentions in tool outputs, and the gold: every expected pattern has >= 3 supporting
sessions of its memory on different days, on its weekday and part of day, by the identified person in an entity
memory; checkpoint_expected patterns have >= 3 before that checkpoint; traps match their kind (near-threshold = 2
days, cluster = within 7 days, stopped = a stop session after the last occurrence, ...).
Run: python3 check.py (exit code 1 on failure)."""
import json
import re
import sys
from collections import Counter
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
ZONES = {"giulia": "Europe/Rome", "marco": "Europe/Rome", "chiara": "Europe/Rome", "luca": "Europe/Rome",
         "emma": "Europe/London", "lucia": "Europe/Madrid", "jonas": "Europe/Berlin", "kenji": "Asia/Tokyo",
         "biblioteca_villa_rosa": "Europe/Rome"}
PARTS = {"morning": (7, 14), "afternoon": (13, 19), "evening": (19, 24)}
IT_ABBR = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"]
TOOL_DATE = re.compile(rf"\b({'|'.join(IT_ABBR)}) (\d{{2}})/(\d{{2}})\b")
ERRORS: list[str] = []


def err(msg: str) -> None:
    ERRORS.append(msg)


def main() -> None:
    conv = json.loads((HERE / "conversations.json").read_text())
    gold = json.loads((HERE / "patterns_gold.json").read_text())
    ev = json.loads((HERE / "evidence.json").read_text())

    # ── conversations ──
    if set(conv) != {"_note", "users", "genders", "entities", "sessions"}:
        err(f"conversations keys {sorted(conv)}")
    users, entities = conv["users"], set(conv["entities"])
    if set(conv["genders"]) != set(users) or not set(conv["genders"].values()) <= {"masculine", "feminine", "neutral"}:
        err("genders do not cover users or have bad values")
    if not entities <= set(users):
        err("entities not in users")
    for u in users:
        rx = r"[a-z]+(_[a-z]+)+" if u in entities else r"[a-z]+"
        if not re.fullmatch(rx, u):
            err(f"bad memory id {u}")
    checkpoints = [datetime.fromisoformat(c) for c in gold["checkpoints"]]
    if checkpoints != sorted(checkpoints) or len(checkpoints) != 2:
        err("checkpoints not two ascending timestamps")
    final = checkpoints[-1]
    sess, prev = {}, None
    for s in conv["sessions"]:
        if set(s) != {"id", "user", "ts", "messages"}:
            err(f"{s.get('id')}: keys {sorted(s)}")
        if s["id"] in sess:
            err(f"duplicate id {s['id']}")
        if s["user"] not in users:
            err(f"{s['id']}: unknown user")
        dt = datetime.fromisoformat(s["ts"])
        if dt.utcoffset() is None:
            err(f"{s['id']}: ts without offset")
        local = dt.replace(tzinfo=None).replace(tzinfo=ZoneInfo(ZONES[s["user"]]))
        if local.utcoffset() != dt.utcoffset():
            err(f"{s['id']}: offset {dt.utcoffset()} != {ZONES[s['user']]} {local.utcoffset()}")
        if not (final - timedelta(days=90) < dt < final):
            err(f"{s['id']}: outside the 90 days before the final checkpoint")
        if prev and dt < prev:
            err(f"{s['id']}: sessions not in time order")
        prev = dt
        if not s["messages"] or s["messages"][0]["role"] != "user":
            err(f"{s['id']}: must start with a user message")
        for m in s["messages"]:
            if m["role"] not in {"user", "assistant", "tool"} or not m["content"].strip():
                err(f"{s['id']}: bad message {m}")
            if (m["role"] == "tool") != ("tool" in m):
                err(f"{s['id']}: tool name missing/extra")
            if m["role"] == "tool":
                for mt in TOOL_DATE.finditer(m["content"]):
                    d = date(dt.year, int(mt.group(3)), int(mt.group(2)))
                    if IT_ABBR[d.weekday()] != mt.group(1) or not 0 <= (d - dt.date()).days <= 7:
                        err(f"{s['id']}: tool date '{mt.group(0)}' wrong weekday or not in the coming week")
        if s["user"] in entities and any(m["role"] == "assistant" and re.search(r"\bsono [A-Z]", m["content"])
                                         for m in s["messages"]):
            err(f"{s['id']}: assistant names a speaker")
        sess[s["id"]] = (s, dt)

    def ldate(sid):
        return sess[sid][1].date()

    # ── gold ──
    if set(gold["memories"]) != set(users):
        err("gold memories != users")
    ids = Counter()
    for u, m in gold["memories"].items():
        for e in m["expected"]:
            ids[e["id"]] += 1
            if set(e) != {"id", "desc"} or not e["desc"].strip():
                err(f"{u}: bad expected {e}")
        for t in m["traps"]:
            ids[t["id"]] += 1
            if set(t) != {"id", "desc", "why"} or not t["desc"].strip() or not t["why"].strip():
                err(f"{u}: bad trap {t}")
        known = {x["id"] for x in m["expected"] + m["traps"]}
        for cp, lst in m.get("checkpoint_expected", {}).items():
            cdt = datetime.fromisoformat(cp)
            if cdt not in checkpoints[:-1]:
                err(f"{u}: checkpoint_expected key {cp} is not an intermediate checkpoint")
            for pid in lst:
                if pid not in known:
                    err(f"{u}: checkpoint_expected id {pid} unknown")
                    continue
                sids = (ev["expected"].get(pid) or ev["traps"].get(pid))["sessions"]
                days = {ldate(x) for x in sids if sess[x][1] < cdt}
                if len(days) < 3:
                    err(f"{pid}: only {len(days)} days before {cp}")
    for i, n in ids.items():
        if n > 1:
            err(f"duplicate gold id {i}")

    for pid, e in ev["expected"].items():
        sids = e["sessions"]
        if any(sess[x][0]["user"] != e["user"] for x in sids):
            err(f"{pid}: evidence from another memory")
        days = {ldate(x) for x in sids}
        if len(days) < 3:
            err(f"{pid}: only {len(days)} distinct days")
        lo, hi = PARTS[e["part"]]
        for x in sids:
            dt = sess[x][1]
            if dt.weekday() != e["weekday"]:
                err(f"{pid}: {x} on weekday {dt.weekday()} not {e['weekday']}")
            if not lo <= dt.hour < hi:
                err(f"{pid}: {x} at {dt:%H:%M} not {e['part']}")
            if e["person"]:
                said = " ".join(m["content"] for m in sess[x][0]["messages"] if m["role"] == "user")
                if not re.search(rf"\b[Ss]ono (di nuovo )?{e['person']}\b", said):
                    err(f"{pid}: {x} without '{e['person']}' identifying")
        if days and (final.date() - max(days)).days > 35:
            err(f"{pid}: last occurrence too old to be current")

    kinds = Counter()
    for tid, t in ev["traps"].items():
        kinds[t["kind"]] += 1
        sids, k = t["sessions"], t["kind"]
        if not sids or any(sess[x][0]["user"] != t["user"] for x in sids):
            err(f"{tid}: no evidence or from another memory")
            continue
        days = sorted({ldate(x) for x in sids})
        if k in ("one-off", "other-person-habit") and len(days) != 1:
            err(f"{tid}: {k} with {len(days)} days")
        if k == "near-threshold" and len(days) != 2:
            err(f"{tid}: near-threshold with {len(days)} days")
        if k in ("trip-cluster", "one-week-cluster"):
            core = [d for d in days if (d - days[0]).days <= 6]
            if len(core) < 3:
                err(f"{tid}: cluster with {len(core)} days within a week")
        if k in ("plan-never-done", "assistant-claim", "tool-only", "retold-single-event") and len(days) < 3:
            err(f"{tid}: {k} needs >= 3 sessions to tempt, has {len(days)}")
        if k == "assistant-claim":
            for x in sids:
                if not any(m["role"] == "assistant" for m in sess[x][0]["messages"]):
                    err(f"{tid}: {x} has no assistant turn")
        if k == "tool-only":
            for x in sids:
                if not any(m["role"] == "tool" for m in sess[x][0]["messages"]):
                    err(f"{tid}: {x} has no tool output")
        if k == "different-people-once":
            names = [re.search(r"\b[Ss]ono ([A-Z]\w+)", " ".join(m["content"] for m in sess[x][0]["messages"]
                                                               if m["role"] == "user")) for x in sids]
            if any(n is None for n in names) or len({n.group(1) for n in names}) != len(sids):
                err(f"{tid}: not one distinct identified person per session")
        if k == "unidentified-repeated":
            for x in sids:
                said = " ".join(m["content"] for m in sess[x][0]["messages"] if m["role"] == "user")
                if re.search(r"\b([Ss]ono|[Mm]i chiamo) [A-Z]", said):
                    err(f"{tid}: {x} identifies someone")
        if k == "stopped":
            stops = ev["stop_sessions"].get(tid, [])
            if not stops or min(ldate(x) for x in stops) <= days[-1]:
                err(f"{tid}: no stop session after the last occurrence")
            if len(days) < 3 or any(sess[x][1] > checkpoints[0] for x in sids):
                err(f"{tid}: stopped pattern must have >= 3 occurrences, all before the mid checkpoint")
            if not any(sess[x][1] > checkpoints[0] for x in stops):
                err(f"{tid}: stop must come after the mid checkpoint")

    n_sess = Counter(s["user"] for s in conv["sessions"])
    print(f"sessions={len(conv['sessions'])} per memory={dict(n_sess)}")
    print(f"expected={len(ev['expected'])} traps={len(ev['traps'])} by kind={dict(sorted(kinds.items()))}")
    if ERRORS:
        print("\n".join(f"ERROR: {e}" for e in ERRORS))
        sys.exit(1)
    print("OK")


if __name__ == "__main__":
    main()
