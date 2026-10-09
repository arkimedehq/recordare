#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
# WORK_PLAN 8.6: diary v2 in recall (RECALL_DIGESTS) + facts review v2 (FACTS_REVIEW) on dev sets, 1 run each, DeepSeek
# direct, :8088 (instance started with both knobs on); compare with the knobs-off runs of 8.4b.
set -u
cd "$(dirname "$0")"
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 SERVICE_MODEL=deepseek-flash RECORDARE_URL=http://localhost:8088
U="uv run --directory $PWD python"
RUN_TAG=fp86_dataset EVAL_DATASET=dataset $U run_eval.py --system service > fp86_dataset.log 2>&1
RUN_TAG=fp86_dev_agent_personal EVAL_DATASET=dataset_dev_agent_personal $U run_eval.py --system service > fp86_dev_agent_personal.log 2>&1
echo DONE
