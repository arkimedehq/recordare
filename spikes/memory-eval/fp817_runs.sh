#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
# H13 arm R, the question's type picks the ranking (RECALL_SEARCH_RANKING=relevance: a "search" ranks by relevance alone,
# the blend of importance and recency only breaking ties): blind9 × 3, blind10 × 3, main set control × 1, DeepSeek direct, one service
# instance on :8093 (queue diag93). Arm A: fp815 (blind9 × 3, blind10 × 1) and fp813 (blind10 × 3).
set -u
cd "$(dirname "$0")"
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 SERVICE_MODEL=deepseek-flash RECORDARE_URL=http://localhost:8093
U="uv run --directory $PWD python"
for r in 1 2 3; do
  RUN_TAG=fp817_blind9_r$r EVAL_DATASET=dataset_blind9 $U run_eval.py --system service > fp817_blind9_r$r.log 2>&1
  RUN_TAG=fp817_blind10_r$r EVAL_DATASET=dataset_blind10 $U run_eval.py --system service > fp817_blind10_r$r.log 2>&1
done
RUN_TAG=fp817_dataset EVAL_DATASET=dataset $U run_eval.py --system service > fp817_dataset.log 2>&1
echo DONE
