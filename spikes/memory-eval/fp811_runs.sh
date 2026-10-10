#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
# WORK_PLAN 8.11: fresh blind sets for the agent memory — blind9 (personal) and blind10 (entity), 3 runs each, no noise,
# released engine 0.2.0, DeepSeek direct, one service instance on :8091 (queue fp811).
set -u
cd "$(dirname "$0")"
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 SERVICE_MODEL=deepseek-flash RECORDARE_URL=http://localhost:8091
U="uv run --directory $PWD python"
for set in blind9 blind10; do
  for r in 1 2 3; do
    RUN_TAG=fp811_${set}_r$r EVAL_DATASET=dataset_$set $U run_eval.py --system service > fp811_${set}_r$r.log 2>&1
  done
done
echo DONE
