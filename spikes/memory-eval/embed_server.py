"""Tiny OpenAI-compatible /v1/embeddings server over the local fastembed model (for Memobase)."""
import os

import uvicorn
from fastapi import FastAPI
from pydantic import BaseModel

from evalkit.embed import MODEL, embed

app = FastAPI()


class EmbeddingRequest(BaseModel):
    input: str | list[str]
    model: str | None = None


@app.post("/v1/embeddings")
def embeddings(req: EmbeddingRequest) -> dict:
    texts = [req.input] if isinstance(req.input, str) else req.input
    vecs = embed(texts)
    return {
        "object": "list",
        "model": MODEL,
        "data": [{"object": "embedding", "index": i, "embedding": v.tolist()} for i, v in enumerate(vecs)],
        "usage": {"prompt_tokens": 0, "total_tokens": 0},
    }


@app.get("/v1/models")
def models() -> dict:
    return {"object": "list", "data": [{"id": MODEL, "object": "model"}]}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("EMBED_PORT", "8790")), log_level="warning")
