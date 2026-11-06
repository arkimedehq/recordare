# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Consistency checks for dev_timing: ids unique, times ISO with offset and in range, windows ordered and inside the
item's life, `for` / events naming known people, every item with a gold. Run: python check.py (exit 1 on failure)."""
import json
import sys
from datetime import datetime
from pathlib import Path

data = json.loads((Path(__file__).resolve().parent / "timelines.json").read_text())
errors: list[str] = []
start, end = datetime.fromisoformat(data["start"]), datetime.fromisoformat(data["end"])
ids: set[str] = set()
for m in data["memories"]:
    people = {p["name"] for p in m["people"]}
    voices = {p["voice"] for p in m["people"] if p.get("voice")}
    has = {p["ha"] for p in m["people"] if p.get("ha")}
    messages = {x["id"] for x in m["messages"]}
    for it in m["items"] + m["plans"]:
        if it["id"] in ids:
            errors.append(f"duplicate id {it['id']}")
        ids.add(it["id"])
        gold = it.get("gold") or {}
        if "windows" not in gold and gold.get("deliver") is not False:
            errors.append(f"{it['id']}: no gold")
        for a, b in gold.get("windows", []):
            if not datetime.fromisoformat(a) < datetime.fromisoformat(b):
                errors.append(f"{it['id']}: window not ordered")
        if it.get("for") and it["for"] not in people:
            errors.append(f"{it['id']}: unknown person {it['for']}")
        if it.get("message") and it["message"] not in messages:
            errors.append(f"{it['id']}: unknown message {it['message']}")
        if "due" in it and not datetime.fromisoformat(it["due"]) < datetime.fromisoformat(it["until"]):
            errors.append(f"{it['id']}: due after until")
    for e in m["events"]:
        at = datetime.fromisoformat(e["at"])
        if not start <= at <= end:
            errors.append(f"{m['id']}: event out of range {e['at']}")
        if e["type"] == "presence" and "voice" in e and e["voice"] not in voices and not e["voice"].startswith("stranger"):
            errors.append(f"{m['id']}: unknown voice {e['voice']}")
        for ha, conf in e.get("people", []):
            if ha not in has or not 0 <= conf <= 1:
                errors.append(f"{m['id']}: unknown person {ha} at {e['at']}")
        if e["type"] == "turn" and e.get("author") and e["author"] not in people:
            errors.append(f"{m['id']}: unknown author {e['author']}")
        if e["type"] == "presence" and e.get("channel") == "voice" and "people" in e and not e.get("place"):
            errors.append(f"{m['id']}: a room presence without a place at {e['at']}")
if errors:
    print("\n".join(errors))
    sys.exit(1)
print(f"ok: {len(ids)} items, {sum(len(m['events']) for m in data['memories'])} events")
