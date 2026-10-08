#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
set -u
cd "$(dirname "$0")"
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 EVAL_DATASET=dataset_blind4
U="uv run --directory $PWD python"
SERVICE_MODEL=deepseek-flash RUN_TAG=xv4 $U run_eval.py --system service --runs 3 --resume > b4_service_base.log 2>&1
for f in results/service-*dataset_blind4-*-xv4-r[123].json; do [ -f "${f%.json}-extraction.json" ] && continue; $U extraction_eval.py "$f" dataset_blind4/gold.json >> b4_extraction.log 2>&1; done
echo DONE
