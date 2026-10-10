#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
# WORK_PLAN 8.9: learned sources — dev set dataset_dev_knowledge + dataset (control), 1 run each, DeepSeek direct, :8089.
set -u
cd "$(dirname "$0")"
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 SERVICE_MODEL=deepseek-flash RECORDARE_URL=http://localhost:8089
U="uv run --directory $PWD python"
RUN_TAG=fp89_knowledge EVAL_DATASET=dataset_dev_knowledge $U run_eval.py --system service > fp89_dev_knowledge.log 2>&1
RUN_TAG=fp89_dataset EVAL_DATASET=dataset $U run_eval.py --system service > fp89_dataset.log 2>&1
echo DONE
