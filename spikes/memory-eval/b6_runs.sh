#!/bin/sh
set -u
cd "$(dirname "$0")"
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 EVAL_DATASET=dataset_blind6
U="uv run --directory $PWD python"
SERVICE_MODEL=deepseek-flash RUN_TAG=pois3 $U run_eval.py --system service > b6_service.log 2>&1
ENGINE_MODEL=deepseek-flash $U run_eval.py --system d > b6_d.log 2>&1
echo DONE
