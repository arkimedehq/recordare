#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
# WORK_PLAN 8.11 gaps, step 5: extract.v15 (a group chat's name, the conversation title, in the extraction input), a
# list with a query brings relevant out-of-period items too, and the judge told who asks (questions.json `holder`).
# blind9 × 3, blind10 × 3, main set control × 1 (dev gaps run first, by hand), DeepSeek direct, one service instance on
# :8095 (queue diag95).
set -u
cd "$(dirname "$0")"
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 SERVICE_MODEL=deepseek-flash RECORDARE_URL=http://localhost:8095
U="uv run --directory $PWD python"
for r in 1 2 3; do
  RUN_TAG=fp819_blind9_r$r EVAL_DATASET=dataset_blind9 $U run_eval.py --system service > fp819_blind9_r$r.log 2>&1
  RUN_TAG=fp819_blind10_r$r EVAL_DATASET=dataset_blind10 $U run_eval.py --system service > fp819_blind10_r$r.log 2>&1
done
RUN_TAG=fp819_dataset EVAL_DATASET=dataset $U run_eval.py --system service > fp819_dataset.log 2>&1
echo DONE
