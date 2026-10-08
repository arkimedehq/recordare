#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
# extract.v8 (facts): blind6 KB baseline on the existing ppl owner, then blind4 ×1 and blind6 ×1 with v8 (QA + extraction).
set -u
cd "$(dirname "$0")"
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 SERVICE_MODEL=deepseek-flash CONSOLIDATE=0
U="uv run --directory $PWD python"
B6=$(ls results/service-dataset_blind6-*-ppl.json | grep -v -e kb -e extraction | head -1)
KB_ONLY=1 $U extraction_eval.py "$B6" dataset_blind6/gold.json > facts_b6_base.log 2>&1
for ds in blind4 blind6; do
  EVAL_DATASET=dataset_$ds RUN_TAG=xv8 $U run_eval.py --system service > facts_${ds}_v8.log 2>&1
  R=$(ls -t results/service-dataset_$ds-*-xv8.json | grep -v -e kb -e extraction -e agg | head -1)
  $U extraction_eval.py "$R" dataset_$ds/gold.json > facts_${ds}_v8_extr.log 2>&1
done
echo DONE
