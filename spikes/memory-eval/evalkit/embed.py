"""Embeddings for the spike, switchable via EMBED_MODEL.

- fastembed (ONNX, in-process): any model from TextEmbedding.list_supported_models().
- `ollama:<name>`: local Ollama server (/api/embed), e.g. `ollama:bge-m3`.
E5 models get "query: " / "passage: " prefixes; mxbai gets its declared query prompt.
"""
from __future__ import annotations

import json
import os
import urllib.request
from functools import lru_cache

import numpy as np

DEFAULT_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
MODEL = os.getenv("EMBED_MODEL") or DEFAULT_MODEL
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")


@lru_cache(maxsize=1)
def _st():
    """sentence-transformers, exactly as Arkimede's embedding-service loads it."""
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer(MODEL.removeprefix("st:"), device="cpu")


@lru_cache(maxsize=1)
def _fastembed():
    from fastembed import TextEmbedding
    return TextEmbedding(MODEL)


def _ollama(texts: list[str]) -> list[list[float]]:
    req = urllib.request.Request(
        f"{OLLAMA_URL}/api/embed",
        data=json.dumps({"model": MODEL.removeprefix("ollama:"), "input": texts}).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=300) as r:
        return json.loads(r.read())["embeddings"]


def embed(texts: list[str], kind: str = "passage") -> np.ndarray:
    """L2-normalized embeddings, shape (n, dim). `kind` is 'query' or 'passage' (used by E5)."""
    if MODEL.startswith("st:"):
        # Mirror embedding-service/main.py: input_type 'query' | 'document', prompt applied only
        # if the model declares one under that exact name.
        side = "query" if kind == "query" else "document"
        model = _st()
        prompt_name = side if side in (model.prompts or {}) and model.prompts.get(side) else None
        vecs = model.encode(texts, batch_size=16, normalize_embeddings=True, convert_to_numpy=True,
                            **({"prompt_name": prompt_name} if prompt_name else {}))
        return vecs.astype(np.float32)
    if "e5" in MODEL.lower():
        texts = [f"{kind}: {t}" for t in texts]
    elif "mxbai" in MODEL.lower() and kind == "query":
        # prompt declared by the model (config_sentence_transformers.json), as Arkimede applies it
        texts = [f"Represent this sentence for searching relevant passages: {t}" for t in texts]
    if MODEL.startswith("ollama:"):
        raw = []
        for i in range(0, len(texts), 64):
            raw += _ollama(texts[i:i + 64])
        vecs = np.array(raw, dtype=np.float32)
    else:
        vecs = np.array(list(_fastembed().embed(texts)), dtype=np.float32)
    norms = np.linalg.norm(vecs, axis=1, keepdims=True)
    return vecs / np.clip(norms, 1e-9, None)
