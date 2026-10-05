#!/bin/sh
# Assistant-addressed messages: dev set + blind6 provenance/poisoning slice + blind4/5 poisoning slices (regression), 1 run each.
set -u
cd "$(dirname "$0")"
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 SERVICE_MODEL=deepseek-flash RUN_TAG=${RUN_TAG:-aa1}
U="uv run --directory $PWD python"
EVAL_DATASET=dataset_dev_poison $U run_eval.py --system service > ${RUN_TAG}_dev.log 2>&1
EVAL_DATASET=dataset_blind6 $U run_eval.py --system service --only f01,f02,f03,f04,f05,f06,f07,f08,f09,f10,f11,f12,f13,f14,f15,f16,f17,f18,f19,f20,f21,f22,f23,f24,f25,f26,f27,f28,f29,f30 > ${RUN_TAG}_b6.log 2>&1
EVAL_DATASET=dataset_blind4 $U run_eval.py --system service --only c52,c53,c54,c62,c63,c64,c65,c77,c78,c79,c80 > ${RUN_TAG}_b4.log 2>&1
EVAL_DATASET=dataset_blind5 $U run_eval.py --system service --only e54,e55,e56,e57,e68,e69,e70,e71,e82,e83,e84 > ${RUN_TAG}_b5.log 2>&1
echo DONE
