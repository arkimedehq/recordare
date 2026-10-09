#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
# WORK_PLAN 8.3 no-change check: memory identity (prompts unchanged) — 1 run blind7, 1 run dev_entity on :8083.
set -u
cd "$(dirname "$0")"
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 SERVICE_MODEL=deepseek-flash RECORDARE_URL=http://localhost:8083
U="uv run --directory $PWD python"
EVAL_DATASET=dataset_dev_entity RUN_TAG=ident1 $U run_eval.py --system service > ident_dev_entity.log 2>&1
EVAL_DATASET=dataset_blind7 RUN_TAG=b7ident $U run_eval.py --system service > ident_b7.log 2>&1
echo DONE
