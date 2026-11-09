# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
"""Writes timelines.json from _timelines.py. Run: python build.py"""
import json
from pathlib import Path

from _timelines import END, MEMORIES, START, TICK_MINUTES

HERE = Path(__file__).resolve().parent
(HERE / "timelines.json").write_text(json.dumps({
    "_note": "holdout_timing (D55 F2b/F4/F6, H14): held-out timelines written blind, replayed with a moving clock, no LLM. "
             "Do not tune on it. See README.md.",
    "start": START, "end": END, "tick_minutes": TICK_MINUTES, "memories": MEMORIES,
}, ensure_ascii=False, indent=1) + "\n")
print("timelines.json written")
