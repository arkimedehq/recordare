#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
# WORK_PLAN 4.8: fresh blind entity-memory set (blind8), released engine, DeepSeek direct, 3 runs.
set -u
cd "$(dirname "$0")"
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 EVAL_DATASET=dataset_blind8 SERVICE_MODEL=deepseek-flash
U="uv run --directory $PWD python"
RUN_TAG=b8 $U run_eval.py --system service --runs 3 --resume > b8_service.log 2>&1
echo DONE
