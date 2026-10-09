#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
# WORK_PLAN 8.4b: extract.v13 (claims about me dated and attributed) on dev sets, 1 run each, DeepSeek direct, :8086.
set -u
cd "$(dirname "$0")"
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 SERVICE_MODEL=deepseek-flash RECORDARE_URL=http://localhost:8086
U="uv run --directory $PWD python"
for d in dev_poison dev_agent_personal; do
  RUN_TAG=fp84b_$d EVAL_DATASET=dataset_$d $U run_eval.py --system service > fp84b_${d}.log 2>&1
done
RUN_TAG=fp84b_dataset EVAL_DATASET=dataset $U run_eval.py --system service > fp84b_dataset.log 2>&1
echo DONE
