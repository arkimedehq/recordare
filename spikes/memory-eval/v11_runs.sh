#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
# WORK_PLAN 4.10: extract.v11 (received news, minus others' claims about the holder, both dates kept) on :8083 —
# the news dev set (1 run) and blind7 (3 runs), DeepSeek direct; compare with v8 (b7) and v10 (b7v10).
set -u
cd "$(dirname "$0")"
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 SERVICE_MODEL=deepseek-flash RECORDARE_URL=http://localhost:8083
U="uv run --directory $PWD python"
EVAL_DATASET=dataset_dev_news RUN_TAG=news11 $U run_eval.py --system service > news_v11.log 2>&1
EVAL_DATASET=dataset_blind7 RUN_TAG=b7v11 $U run_eval.py --system service --runs 3 --resume > b7_v11.log 2>&1
echo DONE
