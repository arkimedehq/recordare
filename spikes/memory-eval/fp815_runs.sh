#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
# Near-duplicate resolver resolve.v2 (a later, shorter telling that adds the outcome is not hidden; the model says which
# telling to keep): dev gaps × 1, blind9 (personal) × 3, blind10 (entity, control) × 1, DeepSeek direct, one service
# instance on :8092 (queue fp815).
set -u
cd "$(dirname "$0")"
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 SERVICE_MODEL=deepseek-flash RECORDARE_URL=http://localhost:8092
U="uv run --directory $PWD python"
RUN_TAG=fp815_dev_gaps EVAL_DATASET=dataset_dev_gaps $U run_eval.py --system service > fp815_dev_gaps.log 2>&1
for r in 1 2 3; do
  RUN_TAG=fp815_blind9_r$r EVAL_DATASET=dataset_blind9 $U run_eval.py --system service > fp815_blind9_r$r.log 2>&1
done
RUN_TAG=fp815_blind10_r1 EVAL_DATASET=dataset_blind10 $U run_eval.py --system service > fp815_blind10_r1.log 2>&1
echo DONE
