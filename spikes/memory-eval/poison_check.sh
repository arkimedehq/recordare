#!/bin/sh
set -u
cd "$(dirname "$0")"
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 SERVICE_MODEL=deepseek-flash RUN_TAG=${RUN_TAG:-pois1}
EVAL_DATASET=dataset_dev_poison uv run --directory $PWD python run_eval.py --system service > ${RUN_TAG}_dev.log 2>&1
U="uv run --directory $PWD python"
EVAL_DATASET=dataset_blind4 $U run_eval.py --system service --only c52,c53,c54,c62,c63,c64,c65,c77,c78,c79,c80 > ${RUN_TAG}_b4.log 2>&1
EVAL_DATASET=dataset_blind5 $U run_eval.py --system service --only e54,e55,e56,e57,e68,e69,e70,e71,e82,e83,e84 > ${RUN_TAG}_b5.log 2>&1
echo DONE
