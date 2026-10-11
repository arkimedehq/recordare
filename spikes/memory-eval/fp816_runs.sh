#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
# H13 arm B, classify-and-compose (EXTRACTION_COMPOSE=true, extract.v14+compose.v1): blind9 × 1, exploratory, DeepSeek
# direct, one service instance on :8092 (queue fp816). Arm A: fp815_blind9_r1–r3.
set -u
cd "$(dirname "$0")"
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 SERVICE_MODEL=deepseek-flash RECORDARE_URL=http://localhost:8092
RUN_TAG=fp816_blind9_r1 EVAL_DATASET=dataset_blind9 uv run --directory "$PWD" python run_eval.py --system service > fp816_blind9_r1.log 2>&1
echo DONE
