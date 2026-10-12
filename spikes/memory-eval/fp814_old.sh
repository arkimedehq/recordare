#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
# Near-duplicate resolver, before the fix (resolve.v1): dev case d08 × 2, DeepSeek direct, service on :8092 (queue fp814).
set -u
cd "$(dirname "$0")"
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 SERVICE_MODEL=deepseek-flash RECORDARE_URL=http://localhost:8092
U="uv run --directory $PWD python"
for r in 1 2; do
  RUN_TAG=fp814_old_r$r EVAL_DATASET=dataset_dev_gaps $U run_eval.py --system service --only d08 > fp814_old_r$r.log 2>&1
done
echo DONE
