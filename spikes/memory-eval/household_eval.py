# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""The growing household (D55 F2b, INITIATIVES_DELIVERY §6): an entity memory meets a family over two weeks and should
come to know it — asking each question of someone who could know, never nagging, and fewer questions as it knows more.

`dataset_dev_household`: the days' talk goes in through REST ingest (its members recognised by their voice, a platform
identity); each evening, twice (19:00 and 20:30, beyond the voice pace), the initiative sweep runs and every member comes
home alone (a presence impulse): what the memory gives them is played — an ask is answered by a model playing the
member, only from the facts they know (`world.json`), "non lo so" otherwise, and let go past their patience (questions a
day); the answer goes back into the memory as their turn and the outcome is reported (asked / ignored). At night the
passes that write the questions run (patterns, thoughts). At the end of each day a judge reads what the memory knows
(facts, notes, contacts) against the household's 30 facts.

Scored: the curve (questions a day against facts known), questions per fact learned, and the errors that must stay zero —
a question to someone who could not know, one asked again of the same person after an answer (nagging).

Env as run_eval.py's service system (RECORDARE_URL, RECORDARE_ADMIN_KEY, RECORDARE_DB_URL; the service with
ALLOW_CLOCK_OVERRIDE=true and CONSOLIDATION_SCHEDULE=false). EVAL_DATASET=dataset_dev_household, HOUSEHOLD_DAYS=<n> runs
the first n days (a pilot), RUN_TAG names the result file.
Run: EVAL_DATASET=dataset_dev_household uv run --directory <spike> python household_eval.py
"""
from __future__ import annotations

import json
import os
import time
from datetime import datetime, timedelta

import openai
import psycopg

from evalkit.common import DATASET, RESULTS, USAGE
from evalkit.common import chat as _chat
from systems.service_sys import DB_URL, ServiceSystem

WORLD = json.loads((DATASET / "world.json").read_text())
CONV = json.loads((DATASET / "conversations.json").read_text())
DAYS = int(os.getenv("HOUSEHOLD_DAYS", WORLD["days"]))
EVENING = ["19:00", "20:30"]
START = datetime.fromisoformat(WORLD["start"])

MEMBER_SYSTEM = """You play a member of an Italian family talking to the family's home assistant, which has just asked
you something. You know ONLY the facts listed under WHAT YOU KNOW (and your own profile). Answer in Italian, briefly and
naturally, in your own voice (a 9-year-old girl chats, a 16-year-old boy answers in a few words). If the question is about
something you do not know from your list, say you do not know (and, if natural, who might). Never invent facts.
Output JSON only: {"answer": "<what you say>"}"""

QUESTION_SYSTEM = """A home assistant asked a family member a question. Which fact of the household's list is it trying to
find out? Answer with the fact's id, or "none" when it asks about none of them (small talk, a reminder, something
outside the list). Output JSON only: {"fact": "<id>" | "none"}"""

KNOW_SYSTEM = """You check what a home assistant's memory knows about a family. MEMORY lists what it holds (facts, notes,
episodes — what happened or was said —, people with their relation). FACTS lists some of the household's truths. For each
fact, say whether the memory states it — the same thing, in any words, and correctly; it may be spread over several lines
(a fact counts when its whole content can be read from the memory). "known": the whole fact; "partial": its core is
there but a part is missing (one of two days, a detail such as a place or a colour); "no": absent, wrong or only a vague
hint. Quote the line (or lines) that state it.
Output JSON only: {"verdicts": [{"id": "<fact id>", "known": "known" | "partial" | "no", "where": "<the memory line(s), or empty>"}]}"""


def chat(*args, **kwargs) -> str:
    """The eval's own calls survive a network blip (run 1 stopped on day 10 on a DNS failure) or a provider's bad
    minutes (confirm3: HTTP 500 and empty responses with no body)."""
    for attempt in range(6):
        try:
            return _chat(*args, **kwargs)
        except (openai.APIConnectionError, openai.APITimeoutError, openai.InternalServerError, AttributeError):
            if attempt == 5:
                raise
            time.sleep(30 * (attempt + 1))
    raise AssertionError


def at(day: int, hhmm: str) -> datetime:
    h, m = (int(x) for x in hhmm.split(":"))
    return (START + timedelta(days=day - 1)).replace(hour=h, minute=m)


def judge(system: str, user: str) -> dict:
    for max_tokens in (4000, 12000):
        try:
            return json.loads(chat([{"role": "system", "content": system}, {"role": "user", "content": user}], "judge", json_mode=True, max_tokens=max_tokens))
        except (json.JSONDecodeError, ValueError) as e:
            print(f"  ! judge answer unusable ({e.__class__.__name__})", flush=True)
    return {}


def member_says(name: str, question: str) -> str:
    member = WORLD["members"][name]
    known = [f["fact"] for f in WORLD["facts"] if name in f["knowers"]]
    msg = f"YOU: {member['about']}\nWHAT YOU KNOW:\n" + "\n".join(f"- {k}" for k in known) + f"\n\nTHE ASSISTANT ASKS: {question}"
    out = json.loads(chat([{"role": "system", "content": MEMBER_SYSTEM}, {"role": "user", "content": msg}], "member", json_mode=True, max_tokens=2000))
    return str(out.get("answer", "")).strip() or "Non lo so."


def known_facts(mid: str) -> tuple[list[str], list[str]]:
    with psycopg.connect(DB_URL) as conn:
        facts = conn.execute("SELECT p.display_name, f.key, f.value FROM facts f LEFT JOIN persons p ON p.id = f.subject_person_id "
                             "WHERE f.memory_id = %s AND f.status = 'current' AND f.deleted_at IS NULL", (mid,)).fetchall()
        notes = conn.execute("SELECT p.display_name, n.content FROM notes n LEFT JOIN persons p ON p.id = n.subject_person_id "
                             "WHERE n.memory_id = %s AND n.status = 'current' AND n.deleted_at IS NULL AND n.category <> 'question'", (mid,)).fetchall()
        episodes = conn.execute("SELECT content FROM episodes WHERE memory_id = %s AND deleted_at IS NULL AND invalidated_at IS NULL "
                                "AND duplicate_of IS NULL ORDER BY occurred_at NULLS LAST", (mid,)).fetchall()
        people = conn.execute("SELECT display_name, full_name, relation FROM persons WHERE memory_id = %s", (mid,)).fetchall()
    memory = ["FACTS:"] + [f"- [{s or 'me'}] {k}: {v}" for s, k, v in facts] + ["NOTES:"] + [f"- [{s or '-'}] {c}" for s, c in notes] \
        + ["EPISODES:"] + [f"- {c}" for (c,) in episodes] + ["PEOPLE:"] + [f"- {n}{f' ({fn})' if fn else ''}{f': {r}' if r else ''}" for n, fn, r in people]
    known: list[str] = []
    partial: list[str] = []
    truth = WORLD["facts"]
    for i in range(0, len(truth), 6):
        chunk = truth[i:i + 6]
        out = judge(KNOW_SYSTEM, "MEMORY:\n" + "\n".join(memory) + "\n\nFACTS:\n" + "\n".join(f"{f['id']}: {f['fact']}" for f in chunk))
        ids = {f["id"] for f in chunk}
        for v in out.get("verdicts", []):
            if isinstance(v, dict) and v.get("id") in ids:
                (known if v.get("known") == "known" else partial if v.get("known") == "partial" else []).append(v["id"])
    return sorted(set(known)), sorted(set(partial) - set(known))


def main() -> None:
    system = ServiceSystem()
    account = system._account("casa_neri")
    mid = account["id"]
    # The platform's own key for presence and outcomes (the service system's key ingests and reads only).
    key = system._post(f"/api/v1/admin/clients/{system.client_id}/keys", {"scopes": ["ingest", "read", "write"]})["key"]
    as_user = {"authorization": f"Bearer {key}", "x-recordare-user": account["ext"]}
    sessions = sorted(CONV["sessions"], key=lambda s: s["ts"])
    world = "\n".join(f"{f['id']}: {f['fact']}" for f in WORLD["facts"])
    asked: list[dict] = []
    days: list[dict] = []
    t0 = time.time()
    for day in range(1, DAYS + 1):
        print(f"day {day}", flush=True)
        system.ingest([s for s in sessions if s["day"] == day])
        patience = {n: m["patience"] for n, m in WORLD["members"].items()}
        given = {"ask": 0, "say": 0, "lookup": 0}
        for hhmm in EVENING:
            now = at(day, hhmm)
            system.http.post(f"/api/v1/admin/memories/{mid}/initiatives", headers={"x-recordare-now": now.isoformat()}, timeout=600).raise_for_status()
            for k, (name, member) in enumerate(WORLD["members"].items()):
                moment = now + timedelta(minutes=2 * k)
                body = {"channel": "voice", "place": "Soggiorno", "ttlSeconds": 600,
                        "people": [{"identity": {"externalUserId": member["voice"]}, "confidence": 0.95}]}
                r = system.http.post("/api/v1/presence", json=body, headers={**as_user, "x-recordare-now": moment.isoformat()})
                r.raise_for_status()
                i = (r.json() or {}).get("initiative")
                if not i or i.get("status") != "offered":
                    continue
                given[i["kind"]] = given.get(i["kind"], 0) + 1
                if i["kind"] != "ask":
                    system.http.post(f"/api/v1/initiatives/{i['id']}/outcome", json={"status": "said", "at": moment.isoformat(), "channel": "voice"},
                                     headers=as_user).raise_for_status()
                    continue
                entry = {"day": day, "at": moment.isoformat(), "to": name, "question": i["text"], "id": i["id"]}
                if patience[name] <= 0:
                    entry["outcome"] = "ignored"
                    system.http.post(f"/api/v1/initiatives/{i['id']}/outcome", json={"status": "ignored", "at": (moment + timedelta(minutes=10)).isoformat(),
                                                                                       "channel": "voice"}, headers=as_user).raise_for_status()
                else:
                    patience[name] -= 1
                    answer = member_says(name, i["text"])
                    entry.update(outcome="asked", answer=answer)
                    # The exchange goes back into the memory: the question as the agent said it, the answer as the member's turn.
                    system.ingest([{"id": f"ev{day:02d}{hhmm.replace(':', '')}{name}", "user": "casa_neri", "ts": (moment + timedelta(minutes=1)).isoformat(),
                                    "participants": [{"name": name, "identity": member["voice"]}],
                                    "messages": [{"role": "assistant", "content": i["text"]}, {"role": "other", "author": name, "content": answer}]}])
                    system.http.post(f"/api/v1/initiatives/{i['id']}/outcome", json={"status": "asked", "at": (moment + timedelta(minutes=1)).isoformat(),
                                                                                       "channel": "voice"}, headers=as_user).raise_for_status()
                entry["fact"] = judge(QUESTION_SYSTEM, f"FACTS:\n{world}\n\nQUESTION: {i['text']}").get("fact", "none")
                asked.append(entry)
                print(f"  {moment:%H:%M} → {name}: {i['text'][:90]} [{entry['outcome']}, {entry['fact']}]", flush=True)
        night = at(day, "23:30").isoformat()
        for step in ("patterns", "thoughts"):
            system.http.post(f"/api/v1/admin/memories/{mid}/{step}", headers={"x-recordare-now": night}, timeout=900).raise_for_status()
        known, partial = known_facts(mid)
        with psycopg.connect(DB_URL) as conn:
            held = dict(conn.execute("SELECT kind::text || ':' || status::text, count(*) FROM intents WHERE memory_id = %s GROUP BY 1", (mid,)).fetchall())
            held["question_notes"] = conn.execute("SELECT count(*) FROM notes WHERE memory_id = %s AND category = 'question' AND status = 'current' "
                                                  "AND deleted_at IS NULL", (mid,)).fetchone()[0]
        days.append({"day": day, "given": given, "asks": sum(1 for a in asked if a["day"] == day), "known": known, "partial": partial, "held": held})
        print(f"  known {len(known)}/{len(WORLD['facts'])} (+{len(partial)} partial), asks {days[-1]['asks']}, given {given}, held {held}", flush=True)

    # The errors that must stay zero: a question to someone who could not know; the same fact asked again of the same
    # person after they answered (nagging).
    knowers = {f["id"]: f["knowers"] for f in WORLD["facts"]}
    answered: set[tuple[str, str]] = set()
    for a in asked:
        a["wrong_person"] = a["fact"] in knowers and a["to"] not in knowers[a["fact"]]
        a["nagging"] = (a["fact"], a["to"]) in answered and a["fact"] != "none"
        if a["outcome"] == "asked":
            answered.add((a["fact"], a["to"]))
    final = set(days[-1]["known"]) if days else set()
    final_partial = set(days[-1]["partial"]) if days else set()
    summary = {"asks": len(asked), "answered": sum(1 for a in asked if a["outcome"] == "asked"),
               "ignored": sum(1 for a in asked if a["outcome"] == "ignored"), "known_end": len(final), "partial_end": len(final_partial),
               "asks_per_fact": round(len(asked) / max(1, len(final)), 2),
               "wrong_person": sum(1 for a in asked if a["wrong_person"]), "nagging": sum(1 for a in asked if a["nagging"]),
               "off_list": sum(1 for a in asked if a["fact"] == "none"),
               "learnt_by_asking": sorted({a["fact"] for a in asked if a["outcome"] == "asked" and a["fact"] in final | final_partial})}
    print("\nday | asks | given (ask/say/lookup) | known | partial")
    for d in days:
        print(f"{d['day']:3} | {d['asks']:4} | {d['given'].get('ask', 0)}/{d['given'].get('say', 0)}/{d['given'].get('lookup', 0)} | {len(d['known'])} | {len(d['partial'])}")
    print(json.dumps(summary, ensure_ascii=False))
    out = RESULTS / f"household_{os.getenv('RUN_TAG', system.run)}.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps({"dataset": DATASET.name, "run": system.run, "days": days, "asked": asked, "summary": summary,
                               "engine_cost": system.cost(), "eval_usage": USAGE.as_dict(),
                               "seconds": round(time.time() - t0)}, ensure_ascii=False, indent=1, default=str))
    print(f"→ {out}")


if __name__ == "__main__":
    main()
