#!/bin/sh
# Confirmation on blind dataset 5 (base): service H11 ×3, D ×3, full context ×1. Priority order, resumable.
set -u
cd "$(dirname "$0")"
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 EVAL_DATASET=dataset_blind5
U="uv run --directory $PWD python"
SERVICE_MODEL=deepseek-flash RUN_TAG=h11a $U run_eval.py --system service --runs 3 --resume > b5_service_base.log 2>&1
ENGINE_MODEL=deepseek-flash $U run_eval.py --system d --runs 3 --resume > b5_d_base.log 2>&1
$U run_eval.py --system fullcontext > b5_full_base.log 2>&1
echo DONE
