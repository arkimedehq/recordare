# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Answer outcomes of stored runs (WORK_PLAN 4.5c, RESEARCH_NOTES H1, HaluMem's three-way outcome): each answer is
`supported` (asserts only what the reference supports, maybe incompletely), `unjustified` (asserts as true a claim
the reference contradicts, a MUST_NOT claim, or an outcome / value the reference says is unknown) or `abstained`
(says it does not know the asked information); the reference is `known` or `unknown`. From them:
- unjustified-assertion rate = unjustified / all questions;
- over-abstention rate = abstained on a known reference / questions with a known reference;
- invented on unknown = unjustified on an unknown reference / questions with an unknown reference (an outcome made up
  where the memory cannot know it; "I don't know, but …" is right there).
The validated judge (correct / partial / wrong) is untouched: this is a second, independent grading of the same
answers, so old runs of every system get the rates without new ingestion.

Usage: uv run --directory <this dir> python outcome_eval.py <run label> [<run label> …]
       uv run --directory <this dir> python outcome_eval.py --table <run label> …   (means per system, per category)
The dataset of each run is read from its summary (`system`: service-<dataset>-emb_…, d-<dataset>-…).
Writes results/<label>-outcomes.json and prints the rates per run and per category.
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor

from evalkit.common import RESULTS, ROOT, chat

OUTCOME_SYSTEM = (
    "You classify the answer of a personal memory assistant against a reference answer. Output JSON "
    '{"reference": "known"|"unknown", "outcome": "supported"|"unjustified"|"abstained", "reason": "<short>"}.\n'
    "- reference: \"unknown\" when the reference says the asked information is not known, not recorded, never "
    "mentioned, or that the outcome of a plan is not known; otherwise \"known\".\n"
    "- outcome \"abstained\": the answer says it does not know, does not have, or cannot tell the asked information "
    "(the key part of it) and asserts no specific value for it, NOR gives the key facts the reference gives. Extra "
    "context around the abstention is fine. An answer that rejects a false premise (\"I have no record that Greta did "
    "it\") and gives what the reference gives (who did it instead, that it did not happen, the real date) is "
    "\"supported\", not \"abstained\".\n"
    "- outcome \"unjustified\": the answer ASSERTS as true at least one specific claim that the reference contradicts "
    "(a wrong date, name, count, place, plan status, or who did it), or a MUST_NOT claim, or an outcome / value the "
    "reference says is unknown (e.g. that a plan took place when its outcome is unknown). Using the same words as "
    "history, inside a correction, as someone else's experience, as a hypothesis clearly marked uncertain, or in a "
    "negation is not asserting them.\n"
    "- outcome \"supported\": otherwise — what the answer asserts is consistent with the reference, even when it is "
    "incomplete, vague, or adds true context.\n"
    "When the answer both abstains on one part and asserts a contradicted claim on another, it is \"unjustified\".\n"
    "Compare with the reference only: do not check calendar facts yourself (which weekday a date falls on, which year "
    "it is) — a year, time or detail the reference does not mention is not a contradiction."
)


def classify(question: dict, must_not: list[str], asker: str | None) -> dict:
    # Who asks, as the judge is told (blind9: the answer may name the asker in the third person — the same person).
    user = (f"QUESTION: {question['q']}\n"
            + (f"ASKED BY: {asker} (the answer may address {asker} as 'you' or name {asker} in the third person: "
               f"the same person)\n" if asker else "")
            + f"REFERENCE: {question['expected']}\n"
            f"MUST_NOT: {json.dumps(must_not, ensure_ascii=False)}\nANSWER: {question['answer']}")
    raw = ""
    for _ in range(3):
        try:
            raw = chat([{"role": "system", "content": OUTCOME_SYSTEM}, {"role": "user", "content": user}],
                       phase="judge", json_mode=True, max_tokens=3000)
            out = json.loads(raw)
            if out.get("outcome") in ("supported", "unjustified", "abstained") and out.get("reference") in ("known", "unknown"):
                return out
        except Exception:  # noqa: BLE001 - retried; a lasting failure is reported, not a wrong answer
            pass
    return {"outcome": "error", "reference": "error", "reason": f"unparseable: {raw[:120]}"}


def rates(rows: list[dict]) -> dict:
    ok = [r for r in rows if r["outcome"] != "error"]
    known = [r for r in ok if r["reference"] == "known"]
    unknown = [r for r in ok if r["reference"] == "unknown"]
    pct = lambda n, d: round(n / d, 3) if d else None  # noqa: E731
    return {
        "questions": len(ok), "known": len(known), "unknown": len(unknown),
        "unjustified_assertion_rate": pct(sum(r["outcome"] == "unjustified" for r in ok), len(ok)),
        "over_abstention_rate": pct(sum(r["outcome"] == "abstained" for r in known), len(known)),
        # On an unknown reference the error is inventing an outcome; "I don't know, but …" is right.
        "invented_on_unknown_rate": pct(sum(r["outcome"] == "unjustified" for r in unknown), len(unknown)),
        "errors": len(rows) - len(ok),
    }


def dataset_of(run: dict) -> str:
    m = re.search(r"(dataset[a-z0-9_]*?)-(?:emb|noise|base|$)", run["summary"].get("system", ""))
    if not m:
        raise SystemExit(f"no dataset in summary.system: {run['summary'].get('system')}")
    return m.group(1)


def table(labels: list[str]) -> None:
    """Mean of the rates over the runs of each system (labels ending in -r<N> / _r<N> grouped), overall and per category."""
    files = {label: json.loads((RESULTS / f"{label}-outcomes.json").read_text()) for label in labels}
    # Whether a reference is known is a property of the question: one label per question, the majority over every run
    # of its dataset given here (the grader decides it per answer and may waver on a borderline reference).
    votes: dict[tuple[str, str], Counter] = defaultdict(Counter)
    for f in files.values():
        for r in f["rows"]:
            if r["reference"] != "error":
                votes[(f["summary"]["dataset"], r["id"])][r["reference"]] += 1
    groups: dict[str, list[dict]] = defaultdict(list)
    for label, f in files.items():
        rows = [{**r, "reference": votes[(f["summary"]["dataset"], r["id"])].most_common(1)[0][0]} if r["reference"] != "error" else r
                for r in f["rows"]]
        by_cat: dict[str, list[dict]] = defaultdict(list)
        for r in rows:
            by_cat[r["category"] or "?"].append(r)
        groups[re.sub(r"[-_]r\d+$", "", label)].append(
            {"accuracy": f["summary"]["accuracy"], **rates(rows), "by_category": {c: rates(v) for c, v in by_cat.items()}})
    mean = lambda xs: round(sum(xs) / len(xs), 3) if xs else None  # noqa: E731
    keys = ("unjustified_assertion_rate", "over_abstention_rate", "invented_on_unknown_rate")
    print("| system | runs | accuracy | unjustified | over-abstention | invented on unknown |\n|---|---|---|---|---|---|")
    for g, runs in groups.items():
        vals = [mean([r[k] for r in runs if r[k] is not None]) for k in ("accuracy", *keys)]
        print(f"| {g} | {len(runs)} | " + " | ".join("—" if v is None else str(v) for v in vals) + " |")
    cats = sorted({c for runs in groups.values() for r in runs for c in r["by_category"]})
    for k in keys[:2]:
        print(f"\n{k} by category\n| system | " + " | ".join(cats) + " |\n|---|" + "---|" * len(cats))
        for g, runs in groups.items():
            cells = [mean([r["by_category"][c][k] for r in runs if c in r["by_category"] and r["by_category"][c][k] is not None]) for c in cats]
            print(f"| {g} | " + " | ".join("—" if v is None else str(v) for v in cells) + " |")


def main() -> None:
    if sys.argv[1:2] == ["--table"]:
        table(sys.argv[2:])
        return
    for label in sys.argv[1:]:
        run = json.loads((RESULTS / f"{label}.json").read_text())
        dataset = dataset_of(run)
        qs = json.loads((ROOT / dataset / "questions.json").read_text())
        must_not = {q["id"]: q.get("must_not", []) for q in qs["questions"]}
        asker = {q["id"]: (q.get("asker") or {}).get("name") or qs.get("holder") for q in qs["questions"]}
        rows = [r for r in run["rows"] if r.get("answer")]
        with ThreadPoolExecutor(max_workers=8) as pool:
            outs = list(pool.map(lambda r: classify(r, must_not.get(r["id"], []), asker.get(r["id"])), rows))
        graded = [{"id": r["id"], "category": r.get("category"), "verdict": r.get("verdict"), **o} for r, o in zip(rows, outs)]
        by_cat: dict[str, list[dict]] = defaultdict(list)
        for g in graded:
            by_cat[g["category"] or "?"].append(g)
        summary = {"run": label, "dataset": dataset, "accuracy": run["summary"].get("accuracy"), **rates(graded),
                   "by_category": {c: rates(v) for c, v in sorted(by_cat.items())},
                   # Consistency with the validated judge: an unjustified answer should be graded wrong (or partial).
                   "outcome_vs_verdict": {f"{o}/{v}": n for (o, v), n in sorted(Counter((g["outcome"], g["verdict"]) for g in graded).items())}}
        (RESULTS / f"{label}-outcomes.json").write_text(json.dumps({"summary": summary, "rows": graded}, ensure_ascii=False, indent=2))
        print(f"{label} [{dataset}] acc {summary['accuracy']}: unjustified {summary['unjustified_assertion_rate']}, "
              f"over-abstention {summary['over_abstention_rate']} ({summary['known']} known), "
              f"invented on unknown {summary['invented_on_unknown_rate']} ({summary['unknown']} unknown), errors {summary['errors']}")
        print(f"  outcome/verdict: {summary['outcome_vs_verdict']}")


if __name__ == "__main__":
    main()
