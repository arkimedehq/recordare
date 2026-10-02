"""Local multilingual embeddings (fastembed / ONNX) — no external embedding API needed."""
from __future__ import annotations

from functools import lru_cache

import numpy as np

MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"


@lru_cache(maxsize=1)
def _model():
    from fastembed import TextEmbedding
    return TextEmbedding(MODEL)


def embed(texts: list[str]) -> np.ndarray:
    """L2-normalized embeddings, shape (n, dim)."""
    vecs = np.array(list(_model().embed(texts)), dtype=np.float32)
    norms = np.linalg.norm(vecs, axis=1, keepdims=True)
    return vecs / np.clip(norms, 1e-9, None)
