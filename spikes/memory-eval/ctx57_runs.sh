#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
# WORK_PLAN 5.7: memory-context floors, A (current 0.50 / 0.55 / 0.45) on :8082 vs B (0.45 / 0.48 / 0.42) on :8083, both with
# sentence matching and named periods. Agent mode (agent_eval.py), DeepSeek direct; blind7 (+ tools-only baseline on A)
# and the dev context set (no-harm questions).
set -u
cd "$(dirname "$0")"
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3
U="uv run --directory $PWD python"
(RECORDARE_URL=http://localhost:8082 EVAL_DATASET=dataset_blind7 $U agent_eval.py --variants tools,tools+context > ctx57_A_b7.log 2>&1
 RECORDARE_URL=http://localhost:8082 EVAL_DATASET=dataset_dev_context $U agent_eval.py --variants tools+context > ctx57_A_dev.log 2>&1) &
(RECORDARE_URL=http://localhost:8083 EVAL_DATASET=dataset_blind7 $U agent_eval.py --variants tools+context > ctx57_B_b7.log 2>&1
 RECORDARE_URL=http://localhost:8083 EVAL_DATASET=dataset_dev_context $U agent_eval.py --variants tools+context > ctx57_B_dev.log 2>&1) &
wait
echo DONE
