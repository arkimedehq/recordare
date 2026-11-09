# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Consistency checks for holdout_timing: ids unique, times ISO with the CEST offset, inside the set's range and inside
the runner's constraints (after its fixed message date, before daylight saving ends), windows ordered and inside the
item's life (a plan's two days after it), gold fields known, `for` / messages / events naming known people and items,
`expect` keys known, outcome events naming an item, every item and every check with a `why`.
Run: python check.py (exit 1 on failure)."""
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

data = json.loads((Path(__file__).resolve().parent / "timelines.json").read_text())
errors: list[str] = []
start, end = datetime.fromisoformat(data["start"]), datetime.fromisoformat(data["end"])
# timing_eval.py ingests every message at 2026-10-18 12:00 +02:00; the set's times are fixed +02:00 (CEST ends 25 Oct).
if start <= datetime.fromisoformat("2026-10-18T12:00:00+02:00"):
    errors.append("start must be after the runner's message date (2026-10-18 12:00)")
if end >= datetime.fromisoformat("2026-10-25T03:00:00+02:00"):
    errors.append("end must be before daylight saving ends (2026-10-25)")
GOLD_KEYS = {"windows", "deliver", "via", "channel", "opened"}
VIA = {"presence", "turn", "clock"}
CHANNELS = {"turn", "chat", "messaging", "voice", "panel"}
EXPECT = {"initiative", "askWho", "opening"}
ids: set[str] = set()


def when(s: str) -> datetime:
    d = datetime.fromisoformat(s)
    if d.utcoffset() != timedelta(hours=2):
        errors.append(f"{s}: not +02:00")
    return d


for m in data["memories"]:
    people = {p["name"] for p in m["people"]}
    has = {p["ha"] for p in m["people"] if p.get("ha")}
    voices = {p["voice"] for p in m["people"] if p.get("voice")}
    messages = {x["id"]: x for x in m["messages"]}
    contents = {it["content"].lower() for it in m["items"] + m["plans"]}
    for x in m["messages"]:
        if x.get("author") and x["author"] not in people:
            errors.append(f"{x['id']}: unknown author {x['author']}")
    for it in m["items"] + m["plans"]:
        iid = it["id"]
        if iid in ids:
            errors.append(f"duplicate id {iid}")
        ids.add(iid)
        if not it.get("why"):
            errors.append(f"{iid}: no why")
        gold = it.get("gold") or {}
        if set(gold) - GOLD_KEYS:
            errors.append(f"{iid}: unknown gold keys {set(gold) - GOLD_KEYS}")
        if gold.get("deliver") is False:
            if set(gold) != {"deliver"}:
                errors.append(f"{iid}: deliver false with other gold fields")
        elif not gold.get("windows"):
            errors.append(f"{iid}: no gold")
        if not set(gold.get("via", [])) <= VIA:
            errors.append(f"{iid}: unknown via {gold['via']}")
        if gold.get("channel") and gold["channel"] not in CHANNELS:
            errors.append(f"{iid}: unknown channel {gold['channel']}")
        if gold.get("channel") == "turn" and gold.get("via") != ["turn"]:
            errors.append(f"{iid}: channel turn needs via [turn]")
        if "due" in it:
            life = (when(it["due"]), when(it["until"]))
            if not life[0] < life[1]:
                errors.append(f"{iid}: due after until")
        else:
            # A plan is asked about two days after it at the earliest, for a week.
            at = when(it["at"])
            life = (at + timedelta(days=2) - timedelta(hours=at.hour, minutes=at.minute), at + timedelta(days=9))
        for a, b in gold.get("windows", []):
            a, b = when(a), when(b)
            if not a < b:
                errors.append(f"{iid}: window not ordered")
            if a < life[0] or b > life[1] or not start <= a <= end:
                errors.append(f"{iid}: window outside the item's life or the set")
        if gold.get("opened"):
            oa, ob = (when(x) for x in gold["opened"])
            if not oa < ob or not any(when(a) <= oa <= when(b) for a, b in gold["windows"]):
                errors.append(f"{iid}: opened not inside a window")
        if it.get("for") and it["for"] not in people:
            errors.append(f"{iid}: unknown person {it['for']}")
        if it.get("message") and it["message"] not in messages:
            errors.append(f"{iid}: unknown message {it['message']}")
    if m["mode"] == "personal" and any(it.get("for") for it in m["items"]):
        errors.append(f"{m['id']}: a personal memory's items are for the holder")
    for e in m["events"]:
        at = when(e["at"])
        if not start <= at <= end:
            errors.append(f"{m['id']}: event out of range {e['at']}")
        if e["type"] not in ("presence", "turn", "outcome"):
            errors.append(f"{m['id']}: unknown event type {e['type']}")
        if e["type"] == "presence" and "voice" in e and e["voice"] not in voices and not e["voice"].startswith("stranger"):
            errors.append(f"{m['id']}: unknown voice {e['voice']}")
        for ha, conf in e.get("people", []):
            if ha not in has or not 0 <= conf <= 1:
                errors.append(f"{m['id']}: unknown person {ha} at {e['at']}")
        if e["type"] == "presence" and e.get("channel") in ("voice", "camera") and ("people" in e or "someone" in e) and not e.get("place"):
            errors.append(f"{m['id']}: a room presence without a place at {e['at']}")
        if e["type"] == "turn" and (not e.get("conversation") or (e.get("author") and e["author"] not in people)):
            errors.append(f"{m['id']}: turn without a conversation or with an unknown author at {e['at']}")
        if e["type"] == "outcome" and (e["content"].lower() not in contents or e["status"] not in ("said", "asked", "ignored", "declined", "done", "failed")):
            errors.append(f"{m['id']}: outcome naming no item or with an unknown status at {e['at']}")
        if e.get("expect"):
            if set(e["expect"]) - EXPECT:
                errors.append(f"{m['id']}: unknown expect keys at {e['at']}")
            if e["type"] != "presence" or not e.get("why"):
                errors.append(f"{m['id']}: an expect only on a presence, with a why, at {e['at']}")
if errors:
    print("\n".join(errors))
    sys.exit(1)
checks = sum(1 for m in data["memories"] for e in m["events"] if e.get("expect"))
print(f"ok: {len(ids)} items, {sum(len(m['events']) for m in data['memories'])} events, {checks} event checks")
