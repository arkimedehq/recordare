#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
# WORK_PLAN 8.11 gaps, step 6: a vague span ("in queste settimane") is not a period (the planner and the
# search_episodes description), and chat excerpts carry their group chat's name. blind9 × 3, blind10 × 3, main set control × 1
# (dev gaps run first, by hand; runs whose log exists are skipped), DeepSeek direct, one service instance on :8095 (queue diag95).
set -u
cd "$(dirname "$0")"
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 SERVICE_MODEL=deepseek-flash RECORDARE_URL=http://localhost:8095
U="uv run --directory $PWD python"
run() { [ -s "$1.log" ] || RUN_TAG=$1 EVAL_DATASET=$2 $U run_eval.py --system service > "$1.log" 2>&1; }
for r in 1 2 3; do
  run fp820_blind9_r$r dataset_blind9
  run fp820_blind10_r$r dataset_blind10
done
run fp820_dataset dataset
echo DONE
