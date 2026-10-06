#!/bin/sh
# M5 decision: blind5 base, 3 runs with nightly consolidation (digests for period overviews) vs 3 without, same code.
set -u
cd "$(dirname "$0")"
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 EVAL_DATASET=dataset_blind5 SERVICE_MODEL=deepseek-flash
U="uv run --directory $PWD python"
CONSOLIDATE=1 RUN_TAG=m5on $U run_eval.py --system service --runs 3 --resume > m5on_b5.log 2>&1
CONSOLIDATE=0 RUN_TAG=m5off $U run_eval.py --system service --runs 3 --resume > m5off_b5.log 2>&1
echo DONE
