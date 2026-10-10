#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
# Entity agent's own actions (entity.v5: what I did at someone's request is mine; a C-number only for the item's
# person) and the writer's fallback for a wrong C-number subject: dev sets, blind10 (entity) × 3, blind9 (personal,
# control) × 1, DeepSeek direct, one service instance on :8092 (queue fp813).
set -u
cd "$(dirname "$0")"
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 SERVICE_MODEL=deepseek-flash RECORDARE_URL=http://localhost:8092
U="uv run --directory $PWD python"
RUN_TAG=fp813_dev_gaps EVAL_DATASET=dataset_dev_gaps $U run_eval.py --system service > fp813_dev_gaps.log 2>&1
for r in 1 2 3; do
  RUN_TAG=fp813_blind10_r$r EVAL_DATASET=dataset_blind10 $U run_eval.py --system service > fp813_blind10_r$r.log 2>&1
done
RUN_TAG=fp813_blind9_r1 EVAL_DATASET=dataset_blind9 $U run_eval.py --system service > fp813_blind9_r1.log 2>&1
echo DONE
