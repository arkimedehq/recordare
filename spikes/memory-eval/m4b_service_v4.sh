#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
# Service-only measurements of an engine version (noise and base, 3 runs each, + extraction scoring).
set -u
cd "$(dirname "$0")"
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 EVAL_DATASET=dataset_blind3 SERVICE_MODEL=deepseek-flash RUN_TAG=${RUN_TAG:-xv4}
U="uv run --directory $PWD python"
for mode in noise base; do
  N=""; [ $mode = noise ] && N="--noise"
  $U run_eval.py --system service $N --runs 3 --resume > m4b_service_${RUN_TAG}_$mode.log 2>&1
  for f in results/service$( [ -n "$N" ] && echo -noise)-dataset_blind3-*-$RUN_TAG-r[123].json; do [ -f "${f%.json}-extraction.json" ] && continue; $U extraction_eval.py "$f" dataset_blind3/gold.json >> m4b_extraction_${RUN_TAG}_$mode.log 2>&1; done
done
echo DONE
