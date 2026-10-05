"""Shared plumbing for the market-baseline adapters (Mem0, Cognee): engine endpoint, local
embeddings through the gateway, group-chat rendering, fresh per-run storage, token accounting."""
from __future__ import annotations

import json
import os
import shutil
import urllib.request
from pathlib import Path

from evalkit.common import ROOT, USAGE, engine_model, fmt_when
from evalkit.embed import MODEL as EMBED_MODEL

STORE = ROOT / ".engine_data"  # gitignored; wiped at the start of every run
GATEWAY = f"http://localhost:{os.getenv('EMBED_PORT', '8790')}/v1"

GROUP_NOTE = ("Chat di gruppo: i messaggi che iniziano con un nome (es. 'Giorgio: …') sono scritti da quel "
              "partecipante, non dall'utente.")


def engine_llm() -> dict:
    """OpenAI-compatible endpoint + model for the engine's internal LLM calls. With
    ENGINE_NO_THINKING the local gateway forwards to the provider with reasoning disabled
    (the libraries cannot send provider-specific body fields themselves)."""
    base = GATEWAY if os.getenv("ENGINE_NO_THINKING") else (os.getenv("ENGINE_BASE_URL") or os.environ["LLM_BASE_URL"])
    return {"base_url": base, "model": engine_model(),
            "api_key": os.getenv("ENGINE_API_KEY") or os.environ["LLM_API_KEY"]}


def check_gateway_embeddings() -> None:
    """The engines embed through the gateway's /v1/embeddings: it must serve the run's EMBED_MODEL."""
    with urllib.request.urlopen(f"{GATEWAY}/models", timeout=10) as r:
        served = json.loads(r.read())["data"][0]["id"]
    assert served == EMBED_MODEL, f"gateway serves {served}, run expects EMBED_MODEL={EMBED_MODEL}"


def fresh_dir(name: str) -> Path:
    path = STORE / name
    shutil.rmtree(path, ignore_errors=True)
    path.mkdir(parents=True)
    return path


def is_group(session: dict) -> bool:
    return any(m["role"] == "other" for m in session["messages"])


def other_text(m: dict) -> str:
    """Other participants' messages carry their author in the content (attribution is possible)."""
    return f"{m.get('author') or 'Altro partecipante'}: {m['content']}"


def session_header(session: dict) -> str:
    return f"Conversazione del {fmt_when(session['ts'])} (sessione {session['id']})." + (
        f" {GROUP_NOTE}" if is_group(session) else "")


def record_usage(usage) -> None:
    """Engine LLM tokens go under phase 'ingest' (as for the other engines)."""
    USAGE.add("ingest", usage)
