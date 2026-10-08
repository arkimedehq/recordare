#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
# WORK_PLAN 5.7 decision: old memory context (main, :8082) vs new (sentences + named periods, :8083), default floors,
# blind7, agent mode with tools + context, 3 runs each, DeepSeek direct.
set -u
cd "$(dirname "$0")"
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 EVAL_DATASET=dataset_blind7
U="uv run --directory $PWD python"
(for r in 1 2 3; do RECORDARE_URL=http://localhost:8082 $U agent_eval.py --variants tools+context > ctx57_old_r$r.log 2>&1; done) &
(for r in 1 2 3; do RECORDARE_URL=http://localhost:8083 $U agent_eval.py --variants tools+context > ctx57_new_r$r.log 2>&1; done) &
wait
echo DONE
