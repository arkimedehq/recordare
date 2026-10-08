#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
# extract.v8 decision: blind5 base ×3 (QA), paired with the ppl runs (same code except the prompt).
set -u
cd "$(dirname "$0")"
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 SERVICE_MODEL=deepseek-flash CONSOLIDATE=0
EVAL_DATASET=dataset_blind5 RUN_TAG=xv8 uv run --directory $PWD python run_eval.py --system service --runs 3 --resume > facts_b5_v8.log 2>&1
echo DONE
