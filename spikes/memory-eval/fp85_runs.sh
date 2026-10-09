#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
# WORK_PLAN 8.5: entity agent (extract.v13+entity.v4) on dev sets, 1 run each, DeepSeek direct, :8087; poison = personal control.
set -u
cd "$(dirname "$0")"
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 SERVICE_MODEL=deepseek-flash RECORDARE_URL=http://localhost:8087
U="uv run --directory $PWD python"
for d in dev_entity_own dev_entity dev_poison; do
  RUN_TAG=fp85_$d EVAL_DATASET=dataset_$d $U run_eval.py --system service > fp85_${d}.log 2>&1
done
echo DONE
