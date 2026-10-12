#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
# WORK_PLAN 5.4 recurring patterns: dev_patterns, the pattern pass run alone at each checkpoint (patterns.v1), DeepSeek
# direct, one service instance on :8095. Usage: [DS=dataset_…] patterns_runs.sh <tag> [runs]
set -u
cd "$(dirname "$0")"
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) RECORDARE_URL=http://localhost:8095
U="uv run --directory $PWD python"
for i in $(seq 1 "${2:-1}"); do
  [ -s "$1_r$i.log" ] || RUN_TAG=$1_r$i EVAL_DATASET=${DS:-dataset_dev_patterns} $U pattern_eval.py > "$1_r$i.log" 2>&1
done
echo DONE
