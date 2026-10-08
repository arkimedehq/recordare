# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Check whether the provider lets us disable reasoning ("thinking") per request."""
import time

from evalkit.common import llm_client

client = llm_client()
variants = {
    "default": {},
    "thinking disabled": {"extra_body": {"thinking": {"type": "disabled"}}},
}
for model in ("deepseek-flash", "deepseek-v4-pro"):
    for label, extra in variants.items():
        t0 = time.time()
        try:
            r = client.chat.completions.create(model=model, max_tokens=60, temperature=0,
                                               messages=[{"role": "user", "content": "Rispondi solo: ok"}], **extra)
            msg = r.choices[0].message
            reasoning = getattr(msg, "reasoning_content", None)
            details = getattr(r.usage, "completion_tokens_details", None)
            rt = getattr(details, "reasoning_tokens", None) if details else None
            print(f"{model:16} {label:18} content={msg.content!r:12} reasoning_chars={len(reasoning or '')} "
                  f"reasoning_tokens={rt} completion={r.usage.completion_tokens} {round(time.time()-t0,1)}s")
        except Exception as err:  # noqa: BLE001
            print(f"{model:16} {label:18} ERROR {type(err).__name__}: {str(err)[:150]}")
