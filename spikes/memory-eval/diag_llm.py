"""Minimal LLM connectivity check: streams a tiny completion per model and reports timings."""
import sys
import time

from evalkit.common import llm_client

models = sys.argv[1:] or ["deepseek-flash"]
client = llm_client()
for model in models:
    t0 = time.time()
    first = None
    text = ""
    try:
        stream = client.chat.completions.create(
            model=model, max_tokens=10, temperature=0, stream=True,
            messages=[{"role": "user", "content": "Rispondi solo: ok"}])
        for chunk in stream:
            delta = chunk.choices[0].delta if chunk.choices else None
            piece = (getattr(delta, "content", None) or getattr(delta, "reasoning_content", None) or "") if delta else ""
            if piece and first is None:
                first = time.time() - t0
            text += piece
        print(f"{model}: first token {first and round(first, 1)}s, total {round(time.time() - t0, 1)}s, text={text!r}")
    except Exception as err:  # noqa: BLE001
        print(f"{model}: ERROR after {round(time.time() - t0, 1)}s: {type(err).__name__}: {str(err)[:200]}")
