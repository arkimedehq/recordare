#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
# H11 recall check: 1 run blind3 base (non-regression, seen set) + 1 run blind4 base (category-level target).
set -u
cd "$(dirname "$0")"
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 SERVICE_MODEL=deepseek-flash RUN_TAG=${RUN_TAG:-h11a}
U="uv run --directory $PWD python"
EVAL_DATASET=dataset_blind3 $U run_eval.py --system service > h11_${RUN_TAG}_b3.log 2>&1
EVAL_DATASET=dataset_blind4 $U run_eval.py --system service > h11_${RUN_TAG}_b4.log 2>&1
echo DONE
