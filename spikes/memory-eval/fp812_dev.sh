#!/bin/sh
# WORK_PLAN 8.11 gaps: dev sets on the fix instance (:8092, queue fp812), 1 run each.
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 SERVICE_MODEL=deepseek-flash RECORDARE_URL=http://localhost:8092
U="uv run --directory $PWD python"
for set in dev_gaps dev_gaps_entity; do
  RUN_TAG=fp812_$set EVAL_DATASET=dataset_$set $U run_eval.py --system service > fp812_$set.log 2>&1
done
echo DONE
