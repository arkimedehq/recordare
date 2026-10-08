# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Shared pieces of the memory-engine spike: config, LLM client, dataset, answer and judge."""
from __future__ import annotations

import json
import os
import re
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

ROOT = Path(__file__).resolve().parent.parent
DATASET = ROOT / os.getenv("EVAL_DATASET", "dataset")  # e.g. EVAL_DATASET=dataset_holdout
RESULTS = ROOT / "results"

load_dotenv(ROOT / ".env")

WEEKDAYS_IT = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"]


def llm_client() -> OpenAI:
    return OpenAI(base_url=os.environ["LLM_BASE_URL"], api_key=os.environ["LLM_API_KEY"], timeout=60, max_retries=0)


def llm_model() -> str:
    return os.environ["LLM_MODEL"]


def engine_model() -> str:
    """Model used by memory engines for their internal extraction (answer/judge stay on llm_model)."""
    return os.getenv("ENGINE_MODEL") or llm_model()


@dataclass
class Usage:
    """Token accounting per phase (ingest / answer / judge)."""
    calls: dict[str, int] = field(default_factory=dict)
    prompt: dict[str, int] = field(default_factory=dict)
    completion: dict[str, int] = field(default_factory=dict)

    def add(self, phase: str, usage) -> None:
        self.calls[phase] = self.calls.get(phase, 0) + 1
        if usage is not None:
            self.prompt[phase] = self.prompt.get(phase, 0) + (usage.prompt_tokens or 0)
            self.completion[phase] = self.completion.get(phase, 0) + (usage.completion_tokens or 0)

    def as_dict(self) -> dict:
        return {"calls": self.calls, "prompt_tokens": self.prompt, "completion_tokens": self.completion}


USAGE = Usage()


ATTEMPTS = 6


def chat(messages: list[dict], phase: str, json_mode: bool = False, max_tokens: int = 800) -> str:
    """Single chat completion with retry; records token usage under `phase`."""
    kwargs = {"model": llm_model(), "messages": messages, "max_tokens": max_tokens, "temperature": 0}
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    # Backoff covers short network outages (a DNS blip of ~1 min aborted a whole M4b chain).
    for attempt in range(ATTEMPTS):
        try:
            resp = llm_client().chat.completions.create(**kwargs)
            USAGE.add(phase, resp.usage)
            content = resp.choices[0].message.content or ""
            if not content.strip():  # reasoning models can exhaust max_tokens before answering
                raise ValueError("empty completion")
            return content
        except Exception as err:  # noqa: BLE001 - transient provider errors
            print(f"  ! {phase} call failed (attempt {attempt + 1}): {type(err).__name__}: {str(err)[:160]}", flush=True)
            if attempt == ATTEMPTS - 1:
                raise
            time.sleep(min(5 * 2 ** attempt, 60))
    return ""


# How to switch reasoning off differs per provider; the engine logic must not care. Override with
# REASONING_OFF_BODY='{"...": ...}' for providers not listed here.
REASONING_OFF = {
    "api.deepseek.com": {"thinking": {"type": "disabled"}},
    ":11434": {"reasoning_effort": "none"},  # Ollama OpenAI-compatible API
}


def reasoning_off_body(base_url: str) -> dict:
    if os.getenv("REASONING_OFF_BODY"):
        return json.loads(os.environ["REASONING_OFF_BODY"])
    return next((body for key, body in REASONING_OFF.items() if key in base_url), {})


def engine_chat_json(messages: list[dict], phase: str, max_tokens: int = 4000) -> dict:
    """JSON-mode completion for an engine's internal work (system D): ENGINE_* endpoint/model,
    reasoning disabled when ENGINE_NO_THINKING is set; invalid JSON is retried."""
    base_url = os.getenv("ENGINE_BASE_URL") or os.environ["LLM_BASE_URL"]
    client = OpenAI(base_url=base_url,
                    api_key=os.getenv("ENGINE_API_KEY") or os.environ["LLM_API_KEY"], timeout=180, max_retries=0)
    kwargs = {"model": engine_model(), "messages": messages, "max_tokens": max_tokens, "temperature": 0,
              "response_format": {"type": "json_object"}}
    if os.getenv("ENGINE_NO_THINKING"):
        kwargs["extra_body"] = reasoning_off_body(base_url)
    for attempt in range(ATTEMPTS):
        try:
            resp = client.chat.completions.create(**kwargs)
            USAGE.add(phase, resp.usage)
            return json.loads(resp.choices[0].message.content or "")
        except Exception as err:  # noqa: BLE001 - transient provider errors, invalid JSON
            print(f"  ! {phase} call failed (attempt {attempt + 1}): {type(err).__name__}: {str(err)[:160]}", flush=True)
            if attempt == ATTEMPTS - 1:
                raise
            time.sleep(min(5 * 2 ** attempt, 60))
    return {}


# ── Dataset ─────────────────────────────────────────────────────────────────────

def load_sessions() -> list[dict]:
    data = json.loads((DATASET / "conversations.json").read_text())
    return sorted(data["sessions"], key=lambda s: s["ts"])


def load_questions() -> list[dict]:
    return json.loads((DATASET / "questions.json").read_text())["questions"]


def eval_user() -> str:
    """The user the questions are asked as (questions.json `user`, default 'luca')."""
    return json.loads((DATASET / "questions.json").read_text()).get("user", "luca")


def fmt_when(iso: str) -> str:
    """'2026-01-18T19:30:00+01:00' -> 'domenica 2026-01-18 19:30'."""
    dt = datetime.fromisoformat(iso)
    return f"{WEEKDAYS_IT[dt.weekday()]} {dt:%Y-%m-%d %H:%M}"


def tokenize(text: str) -> list[str]:
    return [w for w in re.split(r"[^\w]+", text.lower()) if len(w) > 2]


# ── Answer + judge (identical for every system) ─────────────────────────────────

ANSWER_SYSTEM = (
    "Sei l'assistente personale dell'utente. Rispondi in italiano, in modo breve e preciso, "
    "usando SOLO le informazioni nel CONTESTO DI MEMORIA. Se il contesto non contiene la "
    "risposta, dillo chiaramente (es. 'Non mi risulta'). Non inventare date o fatti."
)


def answer(question: dict, context: str) -> str:
    user = (
        f"Oggi è {fmt_when(question['asked_at'])}.\n\n"
        f"CONTESTO DI MEMORIA:\n{context or '(vuoto)'}\n\n"
        f"DOMANDA: {question['q']}"
    )
    return chat([{"role": "system", "content": ANSWER_SYSTEM}, {"role": "user", "content": user}],
                phase="answer", max_tokens=3000).strip()


JUDGE_SYSTEM = (
    "You grade the answer of a personal memory assistant against a reference answer. Output JSON "
    '{"verdict": "correct"|"partial"|"wrong", "reason": "<short>"}.\n'
    "- correct: states the key facts of the reference (names, dates, counts, places, status of plans); "
    "dates may be phrased differently, and a date without the year is fine when the year is unambiguous; "
    "details the question did not ask for are not key facts. Extra TRUE context is fine: a past value mentioned as history, the "
    "original date of a rescheduled event, a correction ('not Monday but Tuesday'), a similar event of "
    "another person clearly attributed to them.\n"
    "- partial: at least one KEY specific fact of the reference (a date, name, count, place or status) is "
    "stated correctly, another key fact is missing, and nothing asserted contradicts the reference.\n"
    "- wrong: no key specific fact is stated (a vague or generic answer on the right topic is wrong, not "
    "partial), or a claim contradicts the reference, or the answer asserts a MUST_NOT claim.\n"
    "MUST_NOT lists claims that must not be ASSERTED as true. Using the same words in another role "
    "(as history, inside a correction, as someone else's experience, or in a negation) is not a violation.\n"
    "When the reference says the information is unknown or not recorded, an answer saying it does not know "
    "is correct (with or without the extra context of the reference); inventing an outcome is wrong."
)


def judge(question: dict, given: str) -> dict:
    user = (
        f"QUESTION: {question['q']}\n"
        f"REFERENCE: {question['expected']}\n"
        f"MUST_NOT: {json.dumps(question.get('must_not', []), ensure_ascii=False)}\n"
        f"ANSWER: {given}"
    )
    raw = ""
    for _ in range(3):  # a truncated / invalid verdict is a judge failure, not a wrong answer
        try:
            raw = chat([{"role": "system", "content": JUDGE_SYSTEM}, {"role": "user", "content": user}],
                       phase="judge", json_mode=True, max_tokens=3000)
        except Exception as err:  # noqa: BLE001 - provider kept failing: do not abort the whole run
            return {"verdict": "error", "reason": f"judge unavailable: {type(err).__name__}"}
        try:
            out = json.loads(raw)
            if out.get("verdict") in ("correct", "partial", "wrong"):
                return out
        except ValueError:
            pass
    return {"verdict": "error", "reason": f"unparseable judge output: {raw[:120]}"}


SCORE = {"correct": 1.0, "partial": 0.5, "wrong": 0.0}
# "error" = judge failure: excluded from accuracy, reported separately.
