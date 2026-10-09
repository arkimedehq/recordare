#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
# WORK_PLAN 4.10: extract.v10 (received news) on blind7, 3 runs, DeepSeek direct — no regression against extract.v8 (4.8: 91.3 %).
set -u
cd "$(dirname "$0")"
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 EVAL_DATASET=dataset_blind7 SERVICE_MODEL=deepseek-flash
U="uv run --directory $PWD python"
RECORDARE_URL=http://localhost:8083 RUN_TAG=b7v10 $U run_eval.py --system service --runs 3 --resume > b7_v10.log 2>&1
echo DONE
