#!/bin/sh
# 4b.5 market baselines: Mem0 and Cognee, 3 runs base + noise, one engine at a time (shared gateway / store dirs).
set -u
cd "$(dirname "$0")"
export EVAL_DATASET=dataset_blind3 EMBED_MODEL=st:BAAI/bge-m3 ENGINE_MODEL=deepseek-flash
U="uv run --directory $PWD python"
for sys in mem0 cognee; do
  $U run_eval.py --system $sys --runs 3 --resume > m4b_${sys}_base.log 2>&1
  $U run_eval.py --system $sys --runs 3 --noise --resume > m4b_${sys}_noise.log 2>&1
done
echo DONE
