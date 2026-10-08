# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Local OpenAI-compatible gateway for the engines under test.

- /v1/embeddings: local fastembed model.
- /v1/chat/completions: proxy to the spike LLM (any OpenAI-compatible provider) that disables reasoning
  ("thinking") — engines like Memobase cap max_tokens at 1024 and a reasoning model spends it
  all on thinking, returning empty content. The API key stays in this process.
"""
import os

import httpx

import uvicorn
from fastapi import FastAPI, Request
from pydantic import BaseModel

from evalkit.common import ROOT, reasoning_off_body  # noqa: F401 - ROOT import loads .env
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


@app.post("/v1/chat/completions")
async def chat_completions(request: Request) -> dict:
    body = await request.json()
    body.update(reasoning_off_body(os.environ["LLM_BASE_URL"]))
    async with httpx.AsyncClient(timeout=180) as client:
        r = await client.post(f"{os.environ['LLM_BASE_URL'].rstrip('/')}/chat/completions", json=body,
                              headers={"Authorization": f"Bearer {os.environ['LLM_API_KEY']}"})
    return r.json()


@app.get("/v1/models")
def models() -> dict:
    return {"object": "list", "data": [{"id": MODEL, "object": "model"}]}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("EMBED_PORT", "8790")), log_level="warning")
