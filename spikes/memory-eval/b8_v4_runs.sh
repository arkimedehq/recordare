#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
# WORK_PLAN 8.5: entity agent (extract.v13+entity.v4) on blind8, 3 runs, DeepSeek direct, :8087 — bar 82.1 % (b8).
set -u
cd "$(dirname "$0")"
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 EVAL_DATASET=dataset_blind8 SERVICE_MODEL=deepseek-flash RECORDARE_URL=http://localhost:8087
U="uv run --directory $PWD python"
RUN_TAG=b8e4 $U run_eval.py --system service --runs 3 --resume > b8_e4.log 2>&1
echo DONE
