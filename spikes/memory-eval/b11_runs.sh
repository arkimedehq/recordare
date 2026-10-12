#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
# A fresh blind entity-memory set (dataset_blind11, written blind and gold-audited by separate agents): the current engine
# (extract.v15+entity.v5, patterns.v2 on in balanced) × 3, DeepSeek direct, one service instance on :8095 (queue diag95).
set -u
cd "$(dirname "$0")"
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 SERVICE_MODEL=deepseek-flash RECORDARE_URL=http://localhost:8095
U="uv run --directory $PWD python"
run() { [ -s "$1.log" ] || RUN_TAG=$1 EVAL_DATASET=$2 $U run_eval.py --system service > "$1.log" 2>&1; }
for r in 1 2 3; do run b11_r$r dataset_blind11; done
echo DONE
