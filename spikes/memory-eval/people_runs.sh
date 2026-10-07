#!/bin/sh
# People-aware recall: blind6 base ×1 (assistant-addressed category no longer blind), then blind5 base ×3 (regression).
set -u
cd "$(dirname "$0")"
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 SERVICE_MODEL=deepseek-flash CONSOLIDATE=0
U="uv run --directory $PWD python"
EVAL_DATASET=dataset_blind6 RUN_TAG=ppl $U run_eval.py --system service > ppl_b6.log 2>&1
EVAL_DATASET=dataset_blind5 RUN_TAG=ppl $U run_eval.py --system service --runs 3 --resume > ppl_b5.log 2>&1
echo DONE
