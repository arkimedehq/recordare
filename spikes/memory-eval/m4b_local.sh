#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
# One base run of the service engine on a local model (Ollama) + extraction scoring. Answer and judge
# stay on the spike's LLM (DeepSeek flash) so scores compare with the hosted runs.
# Usage: RECORDARE_URL=http://localhost:8082 SERVICE_MODEL=<label> sh m4b_local.sh
set -u
cd "$(dirname "$0")"
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 EVAL_DATASET=dataset_blind3 RUN_TAG=xv4
U="uv run --directory $PWD python"
$U run_eval.py --system service > m4b_local_$SERVICE_MODEL.log 2>&1
f=$(ls -t results/service-dataset_blind3-*-$SERVICE_MODEL-*xv4.json | head -1)
$U extraction_eval.py "$f" dataset_blind3/gold.json >> m4b_local_$SERVICE_MODEL.log 2>&1
echo DONE
