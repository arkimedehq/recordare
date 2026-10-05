#!/bin/sh
# M4b measurements on the blind dataset 3 (DeepSeek flash everywhere). Usage: sh m4b_runs.sh base|noise
set -u
cd "$(dirname "$0")"
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 EVAL_DATASET=dataset_blind3
NOISE=""; [ "$1" = noise ] && NOISE="--noise"
U="uv run --directory $PWD python"
RUN_TAG=xv3 SERVICE_MODEL=$(grep '^LLM_MODEL=' ../../service/.env | cut -d= -f2) $U run_eval.py --system service $NOISE --runs 3 > m4b_service_$1.log 2>&1
for f in results/service$( [ -n "$NOISE" ] && echo -noise)-dataset_blind3-*-r[123].json; do $U extraction_eval.py "$f" dataset_blind3/gold.json >> m4b_extraction_$1.log 2>&1; done
ENGINE_MODEL=deepseek-flash $U run_eval.py --system d $NOISE --runs 3 > m4b_d_$1.log 2>&1
$U run_eval.py --system fullcontext $NOISE --runs 3 > m4b_full_$1.log 2>&1
$U run_eval.py --system nomemory $NOISE --runs 1 > m4b_nomem_$1.log 2>&1
echo DONE
