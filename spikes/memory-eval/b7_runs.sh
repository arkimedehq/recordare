#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
# WORK_PLAN 4.8: fresh blind set (blind7), released engine, DeepSeek direct, 3 runs, base (no noise).
set -u
cd "$(dirname "$0")"
while pgrep -f "b8_runs.sh" >/dev/null; do sleep 30; done
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 EVAL_DATASET=dataset_blind7 SERVICE_MODEL=deepseek-flash
U="uv run --directory $PWD python"
RUN_TAG=b7 $U run_eval.py --system service --runs 3 --resume > b7_service.log 2>&1
echo DONE
