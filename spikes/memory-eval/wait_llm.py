# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Block until the LLM endpoint answers a tiny completion again (polls every 2 minutes, max ~2 h)."""
import time

from evalkit.common import llm_client, llm_model

client = llm_client()
for attempt in range(60):
    t0 = time.time()
    try:
        resp = client.chat.completions.create(
            model=llm_model(), max_tokens=5, temperature=0,
            messages=[{"role": "user", "content": "Rispondi solo: ok"}])
        print(f"LLM back after {attempt} retries ({round(time.time() - t0, 1)}s): {resp.choices[0].message.content!r}", flush=True)
        break
    except Exception as err:  # noqa: BLE001
        print(f"[{time.strftime('%H:%M:%S')}] still down: {type(err).__name__}", flush=True)
        time.sleep(120)
else:
    raise SystemExit("LLM still unavailable after ~2h")
