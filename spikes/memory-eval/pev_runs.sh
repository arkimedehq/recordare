#!/bin/sh
# Plan-evidence guard + extract.v6: blind5 base, 3 runs, no consolidation — paired with m5off (same setup, previous code).
set -u
cd "$(dirname "$0")"
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 EVAL_DATASET=dataset_blind5 SERVICE_MODEL=deepseek-flash
U="uv run --directory $PWD python"
CONSOLIDATE=0 RUN_TAG=pev $U run_eval.py --system service --runs 3 --resume > pev_b5.log 2>&1
echo DONE
