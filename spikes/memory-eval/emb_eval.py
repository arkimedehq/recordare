"""Retrieval-only comparison of embedding models (no LLM): recall@K of gold sessions.

For each question, a hit = at least one message of a gold session among the top-K retrieved
messages. Reports vector-only and hybrid (BM25 + vector, RRF) on base and base+noise,
plus embedding throughput. Usage: EMBED_MODEL=<model> python emb_eval.py
"""
import json
import os
import time

import psutil

import numpy as np
from rank_bm25 import BM25Okapi

from evalkit.common import DATASET, load_questions, load_sessions, tokenize
from evalkit.embed import MODEL, embed

GOLD = {
    "q01": ["s11"], "q02": ["s02", "s06", "s11"], "q03": ["s02", "s11"], "q04": ["s06", "s07", "s08"],
    "q05": ["s04", "s05"], "q06": ["s12", "s13"], "q07": ["s10"], "q08": ["s01"], "q09": ["s06"],
    "q10": ["s02"], "q11": ["s08"], "q12": ["s06"], "q13": ["s14"], "q14": ["s14", "s05"],
    "q15": ["s15"], "q16": ["s03"], "q17": ["s08"], "q18": ["s07"],
}
K = 8
RRF_K = 60


def evaluate(sessions):
    docs = [(s["id"], m["content"]) for s in sessions if s["user"] == "luca" for m in s["messages"]]
    t0 = time.time()
    vecs = embed([d[1] for d in docs], kind="passage")
    rate = len(docs) / (time.time() - t0)
    bm25 = BM25Okapi([tokenize(d[1]) for d in docs])
    out = {"vector": [], "hybrid": []}
    for q in load_questions():
        sem = vecs @ embed([q["q"]], kind="query")[0]
        lex = bm25.get_scores(tokenize(q["q"]))
        fused = np.zeros(len(docs))
        for scores in (lex, sem):
            for rank, idx in enumerate(np.argsort(-scores)):
                fused[idx] += 1.0 / (RRF_K + rank + 1)
        for mode, scores in (("vector", sem), ("hybrid", fused)):
            found = {docs[i][0] for i in np.argsort(-scores)[:K]}
            gold = GOLD[q["id"]]
            out[mode].append(sum(g in found for g in gold) / len(gold))
    return {m: round(float(np.mean(v)), 3) for m, v in out.items()}, rate, len(docs)


base = load_sessions()
noise = json.loads((DATASET / "noise.json").read_text())["sessions"]
res_base, _, n1 = evaluate(base)
res_noise, rate, n2 = evaluate(base + noise)
rss_gb = round(psutil.Process(os.getpid()).memory_info().rss / 1e9, 2)
print(json.dumps({"model": MODEL, "process_rss_gb": rss_gb, f"recall@{K}_base({n1} msgs)": res_base,
                  f"recall@{K}_noise({n2} msgs)": res_noise, "embeds_per_sec": round(rate, 1)}))
