#!/bin/sh
# Recall echo: dev set (NOT blind), 1 run of the code under test. RUN_TAG names the variant.
set -u
cd "$(dirname "$0")"
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 EVAL_DATASET=dataset_dev_echo SERVICE_MODEL=deepseek-flash
CONSOLIDATE=0 uv run --directory $PWD python run_eval.py --system service > echo_$RUN_TAG.log 2>&1
echo DONE
