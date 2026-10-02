"""System A — raw baseline: hybrid BM25 + vector over raw messages, fused with RRF.

Approximates Arkimede's `search_conversations` plus a vector leg. No LLM at ingest.
"""
from __future__ import annotations

import numpy as np
from rank_bm25 import BM25Okapi

from evalkit.common import fmt_when, tokenize
from evalkit.embed import embed

TOP_K = 8
RRF_K = 60


class Baseline:
    name = "baseline"

    def __init__(self) -> None:
        self.docs: dict[str, list[dict]] = {}  # user -> messages

    def ingest(self, sessions: list[dict]) -> None:
        for s in sessions:
            for m in s["messages"]:
                self.docs.setdefault(s["user"], []).append({
                    "text": f"[{fmt_when(s['ts'])} · sessione {s['id']} · {m['role']}] {m['content']}",
                    "content": m["content"],
                })
        self._index = {}
        for user, docs in self.docs.items():
            bm25 = BM25Okapi([tokenize(d["content"]) for d in docs])
            vecs = embed([d["content"] for d in docs], kind="passage")
            self._index[user] = (bm25, vecs)

    def context(self, user: str, question: dict) -> str:
        docs = self.docs.get(user, [])
        if not docs:
            return ""
        bm25, vecs = self._index[user]
        lex = bm25.get_scores(tokenize(question["q"]))
        sem = vecs @ embed([question["q"]], kind="query")[0]
        fused = np.zeros(len(docs))
        for scores in (lex, sem):
            for rank, idx in enumerate(np.argsort(-scores)):
                fused[idx] += 1.0 / (RRF_K + rank + 1)
        top = sorted(np.argsort(-fused)[:TOP_K])  # chronological order for readability
        return "\n".join(docs[i]["text"] for i in top)
