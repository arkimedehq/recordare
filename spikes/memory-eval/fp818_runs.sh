#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
# H13 arm C, predict then extract the gap (EXTRACTION_PREDICT=true, predict.v1), exploratory: dev gaps × 1, blind9 × 1,
# blind10 × 1, DeepSeek direct, one service instance on :8094 (queue diag94). Baseline: arm R (fp817).
set -u
cd "$(dirname "$0")"
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 SERVICE_MODEL=deepseek-flash RECORDARE_URL=http://localhost:8094
U="uv run --directory $PWD python"
RUN_TAG=fp818_dev_gaps EVAL_DATASET=dataset_dev_gaps $U run_eval.py --system service > fp818_dev_gaps.log 2>&1
RUN_TAG=fp818_blind9_r1 EVAL_DATASET=dataset_blind9 $U run_eval.py --system service > fp818_blind9_r1.log 2>&1
RUN_TAG=fp818_blind10_r1 EVAL_DATASET=dataset_blind10 $U run_eval.py --system service > fp818_blind10_r1.log 2>&1
echo DONE
