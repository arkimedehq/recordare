# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Timing evaluation (D55 F2b, RESEARCH_NOTES H14): replays `dataset_dev_timing` against a running service with a moving
clock — no LLM call. Each item is written as the extraction would (an intent) or as a plan the sweep asks about; the
clock steps every `tick_minutes`, presences and turns happen at their times, the initiative sweep runs as of each tick
(`POST api/v1/admin/memories/{id}/initiatives` with `X-Recordare-Now`). Scored per item against its gold: delivered in
an acceptable window (and through the right trigger), delivered outside (a needless interruption), not delivered when
it should have been (lapsed), or rightly not delivered.

The service must run with ALLOW_CLOCK_OVERRIDE=true, CONSOLIDATION_SCHEDULE=false, INITIATIVE_WORDING=false and a long
IDLE_DELAY_SECONDS (no extraction); INITIATIVE_TIMING=v0, v1, v2 or due selects the policy compared. Env: RECORDARE_URL,
RECORDARE_ADMIN_KEY, RECORDARE_DB_URL, TIMING_LABEL (names the result file).
Run: uv run --directory <spike> python timing_eval.py
"""
from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from pathlib import Path

import httpx
import psycopg

HERE = Path(__file__).resolve().parent
ROME = ZoneInfo("Europe/Rome")
URL = os.getenv("RECORDARE_URL", "http://localhost:8095")
ADMIN = os.environ.get("RECORDARE_ADMIN_KEY", "")
DB_URL = os.getenv("RECORDARE_DB_URL", "postgres://recordare:recordare@localhost:5433/recordare_eval_timing")
LABEL = os.getenv("TIMING_LABEL", "v0")
RUN = f"t{int(time.time())}"

http = httpx.Client(base_url=URL, timeout=60)


def api(method: str, path: str, token: str = ADMIN, headers: dict | None = None, body: object | None = None) -> dict | list | None:
    r = http.request(method, path, headers={"authorization": f"Bearer {token}", **(headers or {})}, json=body)
    if r.status_code >= 300:
        raise RuntimeError(f"{method} {path}: {r.status_code} {r.text[:300]}")
    return r.json() if r.content else None


def setup(m: dict, db: psycopg.Connection) -> dict:
    client = api("POST", "/api/v1/admin/clients", body={"name": f"{RUN}-{m['id']}", "kind": "platform", "channels": m["channels"]})
    key = api("POST", f"/api/v1/admin/clients/{client['id']}/keys", body={"scopes": ["ingest", "read", "write"]})["key"]
    memory = api("POST", "/api/v1/admin/memories", body={"displayName": m["name"], "mode": m["mode"]})["personId"]
    user = f"{RUN}-{m['id']}"
    api("POST", "/api/v1/admin/identities", body={"kind": "account", "personId": memory, "clientId": client["id"], "externalId": user})
    as_user = {"x-recordare-user": user}
    # A person is known by their voiceprint, or (D55 §5c) by their Home Assistant person.
    ident = lambda p: {"channel": "voice", "externalId": p["voice"]} if p.get("voice") else {"channel": "homeassistant", "externalId": p["ha"]}
    participants = [{"ref": p["name"].lower(), "role": "other", "displayName": p["name"], "identity": ident(p)} for p in m["people"]]
    # Everyone the memory knows says hello once (a contact with a verified identity), then the messages items come from.
    hello = [{"externalId": f"{RUN}-hi-{p['ref']}", "role": "other", "authorRef": p["ref"], "content": "Ciao!", "sentAt": "2026-10-18T10:00:00+02:00"}
             for p in participants]
    if hello:
        api("POST", "/api/v1/ingest/messages", key, as_user, {"conversation": {"externalId": f"{RUN}-hello", "participants": participants}, "messages": hello})
    for x in m["messages"]:
        msg = {"externalId": f"{RUN}-{x['id']}", "role": "other" if x.get("author") else "user", "content": x["text"], "sentAt": "2026-10-18T12:00:00+02:00",
               **({"authorRef": x["author"].lower()} if x.get("author") else {}), **({"private": True} if x.get("private") else {})}
        api("POST", "/api/v1/ingest/messages", key, as_user, {"conversation": {"externalId": f"{RUN}-{x['conversation']}", "participants": participants}, "messages": [msg]})
    person = lambda name: db.execute("SELECT id FROM persons WHERE memory_id = %s AND display_name = %s", (memory, name)).fetchone()[0]
    # Their other addresses (a Telegram chat): what messaging reaches them on (D55 §5c.1).
    for p in m["people"]:
        if p.get("telegram"):
            api("POST", "/api/v1/admin/identities", body={"kind": "participant", "memoryId": memory, "personId": str(person(p["name"])),
                                                          "channel": "telegram", "externalId": p["telegram"], "verified": True})
    message = lambda mid: db.execute("SELECT id FROM messages WHERE external_id = %s", (f"{RUN}-{mid}",)).fetchone()[0]
    for it in m["items"]:
        db.execute("INSERT INTO intents (memory_id, kind, content, for_person_id, message_id, due_at, expires_at, timed) VALUES (%s, 'request', %s, %s, %s, %s, %s, %s)",
                   (memory, it["content"], person(it["for"]) if it.get("for") else None, message(it["message"]) if it.get("message") else None,
                    it["due"], it["until"], bool(it.get("timed"))))
    for p in m["plans"]:
        db.execute("""INSERT INTO episodes (memory_id, kind, content, origin, author_role, stance, audience, occurred_at, date_precision, plan_status)
                      VALUES (%s, 'plan', %s, 'holder_lived', 'holder', 'stated', ARRAY[%s::uuid], %s, 'day', 'open')""", (memory, p["content"], memory, p["at"]))
    return {"memory": memory, "key": key, "user": user, "participants": participants, "db": db}


def run_event(e: dict, ctx: dict) -> dict:
    headers = {"x-recordare-user": ctx["user"], "x-recordare-now": e["at"]}
    if e["type"] == "presence" and "voice" in e:
        body = {"channel": e["channel"], "confidence": e["confidence"], "person": {"identity": {"channel": "voice", "externalId": e["voice"]}}}
        return api("POST", "/api/v1/presence", ctx["key"], headers, body)
    if e["type"] == "presence":
        # A place as a host describes it (D55 §5c): who is recognised there, how sure, and anyone it cannot name.
        body = {"channel": e["channel"], "ttlSeconds": e.get("ttl", 900),
                **({"place": e["place"]} if e.get("place") else {}),
                **({"people": [{"identity": {"channel": "homeassistant", "externalId": ha}, "confidence": c} for ha, c in e["people"]]} if e.get("people") else {}),
                **({"someone": e["someone"]} if e.get("someone") else {}), **({"left": True} if e.get("left") else {}),
                # Timing v2 (D55 F6): what the host knows of the moment — busy (a call, do-not-disturb), people talking.
                **({"busy": e["busy"]} if "busy" in e else {}), **({"talking": True} if e.get("talking") else {})}
        return api("POST", "/api/v1/presence", ctx["key"], headers, body)
    if e["type"] == "outcome":
        # The host reports how an initiative was taken (D55 F6: a refusal the moment's context remembers).
        row = ctx["db"].execute("SELECT id FROM initiatives WHERE memory_id = %s AND lower(text) LIKE %s ORDER BY created_at DESC LIMIT 1",
                                (ctx["memory"], f"%{e['content'].lower()}%")).fetchone()
        if not row:
            return {"outcome": "no initiative"}
        api("POST", f"/api/v1/initiatives/{row[0]}/outcome", ctx["key"], {"x-recordare-user": ctx["user"]}, {"status": e["status"], "at": e["at"]})
        return {"outcome": e["status"]}
    author = next((p for p in ctx["participants"] if e.get("author") and p["displayName"] == e["author"]), None)
    msg = {"externalId": f"{RUN}-turn-{e['at']}", "role": "other" if author else "user", "content": e["text"], "sentAt": e["at"],
           **({"authorRef": author["ref"]} if author else {})}
    turn = {"conversation": {"externalId": f"{RUN}-{e['conversation']}", **({"participants": ctx["participants"]} if author else {})},
            "messages": [msg]}
    return api("POST", "/api/v1/context", ctx["key"], headers, {"ingest": turn, "query": e["text"], "card": False})


def part_of_day(at: datetime) -> str:
    h = at.astimezone(ROME).hour
    return "morning" if 8 <= h < 12 else "afternoon" if 12 <= h < 18 else "evening" if 18 <= h < 22 else "night"


def report_outcomes(m: dict, ctx: dict, db: psycopg.Connection, reported: dict) -> None:
    """D55 F4: the host reports what became of each initiative given, as the memory's `behavior` says the person acts
    (by part of the day) — the outcomes timing v1 learns from."""
    rows = db.execute("""SELECT id, offered_at, channel FROM initiatives WHERE memory_id = %s AND status = 'offered' AND offered_at IS NOT NULL""",
                      (ctx["memory"],)).fetchall()
    for iid, offered_at, channel in rows:
        status = m["behavior"].get(part_of_day(offered_at), "said")
        api("POST", f"/api/v1/initiatives/{iid}/outcome", ctx["key"], {"x-recordare-user": ctx["user"]},
            {"status": status, "at": (offered_at + timedelta(minutes=5)).isoformat(), **({"channel": channel} if channel else {})})
        reported[status] = reported.get(status, 0) + 1


def score(item: dict, got: dict | None) -> str:
    gold = item["gold"]
    if gold.get("deliver") is False:
        return "rightly_silent" if not got or not got["offered_at"] else "wrong_delivery"
    if not got or not got["offered_at"]:
        return "lapsed"
    at = got["offered_at"]
    inside = any(datetime.fromisoformat(a) <= at <= datetime.fromisoformat(b) for a, b in gold["windows"])
    if not inside:
        return "outside"
    if gold.get("via") and got["via"] not in gold["via"]:
        return "wrong_trigger"
    if gold.get("channel") and got["channel"] != gold["channel"]:
        return "wrong_channel"
    if gold.get("opened") and not (got.get("opened_at") and
                                   datetime.fromisoformat(gold["opened"][0]) <= got["opened_at"] <= datetime.fromisoformat(gold["opened"][1])):
        return "no_opening"
    return "in_window"


def main() -> None:
    if not ADMIN:
        sys.exit("RECORDARE_ADMIN_KEY not set")
    data = json.loads((HERE / "dataset_dev_timing" / "timelines.json").read_text())
    with psycopg.connect(DB_URL, autocommit=True) as db:
        ctxs = {m["id"]: setup(m, db) for m in data["memories"]}
        events = sorted(((datetime.fromisoformat(e["at"]), m["id"], e) for m in data["memories"] for e in m["events"]), key=lambda x: x[0])
        log: list[dict] = []
        outcomes: dict[str, dict[str, int]] = {}
        tick = datetime.fromisoformat(data["start"])
        end = datetime.fromisoformat(data["end"])
        while tick <= end:
            while events and events[0][0] <= tick:
                at, mid, e = events.pop(0)
                res = run_event(e, ctxs[mid])
                kept = {k: (v.get("text") if isinstance(v, dict) and "text" in v else v)
                        for k, v in (res or {}).items() if k in ("initiative", "askWho", "block", "opening", "outcome")}
                entry = {"at": e["at"], "memory": mid, "type": e["type"], "result": kept}
                if e.get("expect"):
                    # An event's own gold (D55 §5c): what this presence must and must not bring.
                    want = e["expect"]
                    # Given = an initiative offered now; an opening returns it still pending (said only after a "yes").
                    seen = {"initiative": bool((res or {}).get("initiative")) and (res or {}).get("initiative", {}).get("status") == "offered",
                            "askWho": bool((res or {}).get("askWho")), "opening": bool((res or {}).get("opening"))}
                    ok = all(seen[k] == v for k, v in want.items())
                    entry["check"] = "ok" if ok else f"expected {want}, got {{{', '.join(f'{k}: {seen[k]}' for k in want)}}}"
                log.append(entry)
            for c in ctxs.values():
                api("POST", f"/api/v1/admin/memories/{c['memory']}/initiatives", headers={"x-recordare-now": tick.isoformat()})
            for m in data["memories"]:
                if m.get("behavior"):
                    report_outcomes(m, ctxs[m["id"]], db, outcomes.setdefault(m["id"], {}))
            tick += timedelta(minutes=data["tick_minutes"])
        results = []
        for m in data["memories"]:
            rows = db.execute("""SELECT i.text, i.status::text, i.offered_at, i.channel, i.opened_at,
                                   (SELECT d.trigger FROM initiative_decisions d WHERE d.initiative_id = i.id AND d.delivered ORDER BY d.at LIMIT 1) AS via
                                 FROM initiatives i WHERE i.memory_id = %s""", (ctxs[m["id"]]["memory"],)).fetchall()
            for it in m["items"] + m["plans"]:
                hit = next(({"text": r[0], "status": r[1], "offered_at": r[2], "channel": r[3], "opened_at": r[4], "via": r[5]}
                            for r in rows if it["content"].lower() in r[0].lower()), None)
                results.append({"id": it["id"], "outcome": score(it, hit), "offered_at": hit["offered_at"].isoformat() if hit and hit["offered_at"] else None,
                                "channel": hit["channel"] if hit else None, "via": hit["via"] if hit else None, "why": it["why"]})
    counts: dict[str, int] = {}
    for r in results:
        counts[r["outcome"]] = counts.get(r["outcome"], 0) + 1
    good = counts.get("in_window", 0) + counts.get("rightly_silent", 0)
    print(f"policy {LABEL}: {good}/{len(results)} right — {counts}")
    for r in results:
        print(f"  {r['id']:4} {r['outcome']:15} {r['offered_at'] or '-':26} {r['channel'] or '-':10} {r['via'] or '-'}")
    for mid, counts_by in outcomes.items():
        print(f"outcomes reported in {mid}: {counts_by}")
    checks = [x for x in log if "check" in x]
    if checks:
        print(f"event checks: {sum(1 for x in checks if x['check'] == 'ok')}/{len(checks)}")
        for x in checks:
            print(f"  {x['at']} {x['memory']}: {x['check']}")
    out = HERE / "results" / f"timing_{LABEL}_{RUN}.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps({"label": LABEL, "counts": counts, "results": results, "outcomes": outcomes, "events": log}, ensure_ascii=False, indent=1, default=str))
    print(f"→ {out}")


if __name__ == "__main__":
    main()
