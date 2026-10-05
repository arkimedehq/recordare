#!/bin/sh
# 4b.3: measure the economy and full quality profiles (balanced = service v4), 3 base runs each + extraction scoring.
set -u
cd "$(dirname "$0")"
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 EVAL_DATASET=dataset_blind3 SERVICE_MODEL=deepseek-flash
U="uv run --directory $PWD python"
run() { # tag port
  RUN_TAG=$1 RECORDARE_URL=http://localhost:$2 $U run_eval.py --system service --runs 3 --resume > m4b_profile_$1.log 2>&1
  for f in results/service-dataset_blind3-*-$1-r[123].json; do [ -f "${f%.json}-extraction.json" ] && continue; $U extraction_eval.py "$f" dataset_blind3/gold.json >> m4b_profile_$1.log 2>&1; done
}
run peco 8083 &
run pfull 8084 &
wait
echo DONE
