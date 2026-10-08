# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Consistency checks for dataset_blind5: ids, ordering, DST offsets, weekday+date mentions, and that every
question is asked after the sessions supporting its expected answer. Run after build.py and gen_noise.py."""
import json
import re
from collections import Counter
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
TZ = ZoneInfo("Europe/Rome")
YEAR = 2029

conv = json.loads((HERE / "conversations.json").read_text())
qs = json.loads((HERE / "questions.json").read_text())
gold = json.loads((HERE / "gold.json").read_text())
noise = json.loads((HERE / "noise.json").read_text())
errors = []

# Sessions supporting each question (max ts must be <= asked_at).
DEPS = {
    "e01": ["s25", "s26"], "e02": ["s32"], "e03": ["s20", "s23", "s27"], "e04": ["s07", "s08"],
    "e05": ["s49", "s51"], "e06": ["s37", "s47"], "e07": ["s28", "s30"], "e08": ["s38"],
    "e09": ["s15"], "e10": ["s37", "s38", "s39"], "e11": ["s51", "s52"], "e12": ["s17", "s18", "s19"],
    "e13": ["s24", "s25", "s26"], "e14": ["s56", "s57", "s58", "s59"], "e15": ["s34"], "e16": ["s45"],
    "e17": ["s09"], "e18": ["s57"], "e19": ["s35"], "e20": ["s31"], "e21": ["s39"], "e22": ["s53"],
    "e23": ["s31"], "e24": ["s34"], "e25": ["s39"], "e26": ["s53"], "e27": ["s35"], "e28": ["s53"],
    "e29": ["s22"], "e30": ["s31"], "e31": ["s16"], "e32": ["s19"], "e33": ["s39"], "e34": ["s57"],
    "e35": ["s26"], "e36": ["s21"], "e37": ["s51"], "e38": ["s22"], "e39": ["s40"], "e40": ["s22"],
    "e41": ["s37", "s44"], "e42": ["s49", "s51"], "e43": ["s47", "s53"], "e44": ["s31"], "e45": ["s37"],
    "e46": ["s16"], "e47": ["s28", "s52"], "e48": ["s60"], "e49": ["s57"], "e50": ["s59"], "e51": ["s47"],
    "e52": ["s38"], "e53": ["s48"], "e54": ["s14"], "e55": ["s30"], "e56": ["s15"], "e57": ["s55"],
    "e58": ["s22"], "e59": ["s56"], "e60": ["s25"], "e61": ["s48"], "e62": ["s12"], "e63": ["s32"],
    "e64": ["s52"], "e65": ["s34"], "e66": ["s07"], "e67": ["s46"], "e68": ["s03"], "e69": ["s09"],
    "e70": ["s20"], "e71": ["s43"], "e72": ["s26"], "e73": ["s31"], "e74": ["s47"], "e75": ["s22"],
    "e76": ["s44", "s48"], "e77": ["s36", "s39"], "e78": ["s38"], "e79": ["s22"], "e80": ["s40"],
    "e81": ["s50"], "e82": ["s15", "s30"], "e83": ["s30"], "e84": ["s30"], "e85": ["s60"], "e86": ["s60"],
    "e87": ["s60"],
}

# ── ids, ordering, offsets ──────────────────────────────────────────────────────
sessions = conv["sessions"]
ids = [s["id"] for s in sessions] + [s["id"] for s in noise["sessions"]]
for k, n in Counter(ids).items():
    if n > 1:
        errors.append(f"duplicate session id {k}")
for k, n in Counter(q["id"] for q in qs["questions"]).items():
    if n > 1:
        errors.append(f"duplicate question id {k}")
for k, n in Counter(e["id"] for e in gold["episodes"]).items():
    if n > 1:
        errors.append(f"duplicate episode id {k}")
ts_list = [s["ts"] for s in sessions]
if ts_list != sorted(ts_list, key=lambda t: datetime.fromisoformat(t)):
    errors.append("conversation sessions are not in chronological order")


def check_offset(label: str, iso: str) -> None:
    dt = datetime.fromisoformat(iso)
    local = dt.replace(tzinfo=None).replace(tzinfo=TZ)
    if local.utcoffset() != dt.utcoffset():
        errors.append(f"{label}: wrong offset in {iso}")


for s in sessions + noise["sessions"]:
    check_offset(s["id"], s["ts"])
for q in qs["questions"]:
    check_offset(q["id"], q["asked_at"])

# ── group chats, roles ──────────────────────────────────────────────────────────
for s in sessions:
    for m in s["messages"]:
        if m["role"] not in ("user", "assistant", "other"):
            errors.append(f"{s['id']}: bad role {m['role']}")
        if m["role"] == "other" and not m.get("author"):
            errors.append(f"{s['id']}: 'other' message without author")

# ── weekday + date mentions ─────────────────────────────────────────────────────
WD_IT = {"lunedì": 0, "martedì": 1, "mercoledì": 2, "giovedì": 3, "venerdì": 4, "sabato": 5, "domenica": 6}
WD_EN = {"monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3, "friday": 4, "saturday": 5, "sunday": 6}
MONTHS = {"gennaio": 1, "febbraio": 2, "marzo": 3, "aprile": 4, "maggio": 5, "giugno": 6, "luglio": 7,
          "agosto": 8, "settembre": 9, "ottobre": 10, "novembre": 11, "dicembre": 12,
          "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6, "july": 7,
          "august": 8, "september": 9, "october": 10, "november": 11, "december": 12}
WD = {**WD_IT, **WD_EN}
PAT = re.compile(r"\b(" + "|".join(WD) + r")\s+(\d{1,2})(?:°)?(?:\s+(" + "|".join(MONTHS) + r"))?(?:\s+(\d{4}))?",
                 re.IGNORECASE)
checked = 0


def check_text(label: str, text: str, ref: datetime) -> None:
    global checked
    for m in PAT.finditer(text):
        wd, day = WD[m.group(1).lower()], int(m.group(2))
        year = int(m.group(4)) if m.group(4) else YEAR
        if m.group(3):
            ok = date(year, MONTHS[m.group(3).lower()], day).weekday() == wd
        else:  # month omitted: the matching day closest to the reference date (±40 days)
            near = sorted((abs(off), (ref + timedelta(days=off)).date()) for off in range(-40, 41)
                          if (ref + timedelta(days=off)).day == day)
            ok = bool(near) and near[0][1].weekday() == wd
        checked += 1
        if not ok:
            errors.append(f"{label}: weekday mismatch in «{m.group(0)}»")


for s in sessions:
    ref = datetime.fromisoformat(s["ts"])
    for i, m in enumerate(s["messages"]):
        check_text(f"{s['id']}#{i}", m["content"], ref)
for q in qs["questions"]:
    ref = datetime.fromisoformat(q["asked_at"])
    for field in ("q", "expected"):
        check_text(f"{q['id']}.{field}", q[field], ref)
    for mn in q["must_not"]:
        check_text(f"{q['id']}.must_not", mn, ref)

# ── questions asked after their supporting sessions ─────────────────────────────
by_id = {s["id"]: s for s in sessions}
for q in qs["questions"]:
    deps = DEPS.get(q["id"])
    if deps is None:
        errors.append(f"{q['id']}: no DEPS entry")
        continue
    asked = datetime.fromisoformat(q["asked_at"])
    for sid in deps:
        if datetime.fromisoformat(by_id[sid]["ts"]) > asked:
            errors.append(f"{q['id']}: asked before supporting session {sid}")
for e in gold["episodes"]:
    for sid in e["sessions"]:
        if sid not in by_id:
            errors.append(f"{e['id']}: unknown session {sid}")

# ── noise: quiet windows hold only neutral filler ───────────────────────────────
import importlib.util  # noqa: E402

spec = importlib.util.spec_from_file_location("gen_noise_mod", HERE / "gen_noise.py")
# (gen_noise rewrites noise.json deterministically on import; content is identical)
gn = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gn)
tech_q = {q for q, _ in gn.TECH}
for s in noise["sessions"]:
    ts = datetime.fromisoformat(s["ts"])
    if gn.quiet(ts):
        for m in s["messages"]:
            if m["role"] == "user" and m["content"] not in tech_q:
                errors.append(f"noise {s['id']}: non-filler content in a quiet window")

# ── summary ─────────────────────────────────────────────────────────────────────
cats = Counter(q["category"] for q in qs["questions"])
langs = Counter("en" if re.search(r"\b(the|what|when|did|how|my|is|you)\b", q["q"], re.I) else "it" for q in qs["questions"])
print(f"sessions {len(sessions)} (+{len(noise['sessions'])} noise), questions {len(qs['questions'])}, "
      f"weekday mentions checked {checked}")
print("question languages:", dict(langs))
for c, n in sorted(cats.items()):
    print(f"  {c:20s} {n}")
low = [c for c, n in cats.items() if n < 3]
if low:
    errors.append(f"categories with < 3 questions: {low}")
print("ERRORS:" if errors else "OK", *errors, sep="\n  ")
