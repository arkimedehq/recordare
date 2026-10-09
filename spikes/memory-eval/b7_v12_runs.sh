#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
# WORK_PLAN 8.4: extract.v12 (personal first person) on blind7, 3 runs, DeepSeek direct, :8085 — bar 91.7 % (v11).
set -u
cd "$(dirname "$0")"
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 SERVICE_MODEL=deepseek-flash RECORDARE_URL=http://localhost:8085 EVAL_DATASET=dataset_blind7
U="uv run --directory $PWD python"
RUN_TAG=b7v12 $U run_eval.py --system service --runs 3 --resume > b7_v12.log 2>&1
echo DONE
