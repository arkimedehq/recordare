# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Control systems (MemDelta): what a memory system must beat.

- NoMemory: empty context — measures what the answering model guesses (and judge leniency).
- FullContext: every session of the user up to the question time, verbatim, most recent first,
  capped — the upper bound of "just give the model everything" on small datasets.
"""
from __future__ import annotations

from datetime import datetime

from evalkit.common import fmt_when

FULL_CONTEXT_CHARS = 120_000


class NoMemory:
    name = "nomemory"

    def ingest(self, sessions: list[dict]) -> None:
        pass

    def context(self, user: str, question: dict) -> str:
        return ""


class FullContext:
    name = "fullcontext"

    def __init__(self) -> None:
        self.sessions: list[dict] = []

    def ingest(self, sessions: list[dict]) -> None:
        self.sessions += sessions

    def context(self, user: str, question: dict) -> str:
        asked = datetime.fromisoformat(question["asked_at"])
        mine = [s for s in self.sessions if s["user"] == user and datetime.fromisoformat(s["ts"]) <= asked]
        blocks, size = [], 0
        for s in sorted(mine, key=lambda s: s["ts"], reverse=True):
            text = f"[{fmt_when(s['ts'])} · sessione {s['id']}]\n" + "\n".join(
                f"{m.get('author') or m['role']}: {m['content']}" for m in s["messages"])
            if size + len(text) > FULL_CONTEXT_CHARS:
                break
            blocks.append(text)
            size += len(text)
        return "\n\n".join(reversed(blocks))
