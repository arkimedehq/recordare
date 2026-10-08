#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
set -u
cd "$(dirname "$0")"
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 EVAL_DATASET=dataset_blind3 SERVICE_MODEL=deepseek-flash RUN_TAG=xv3
U="uv run --directory $PWD python"
$U run_eval.py --system service --runs 3 > m4b_service_v3_base.log 2>&1
for f in results/service-dataset_blind3-*-xv3-r[123].json; do $U extraction_eval.py "$f" dataset_blind3/gold.json >> m4b_extraction_v3_base.log 2>&1; done
echo DONE
