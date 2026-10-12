#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
# WORK_PLAN 5.7 turn taint: an assistant reply after a non-Recordare tool's output in its turn counts as the tool
# (facts / notes pending, episodes assistant_stated). Only the dev sets with such tools are touched: dev_agent_personal
# (web_search, weather) and dev_echo (web_search, bus) — 1 run each, DeepSeek direct, one service instance on :8095.
set -u
cd "$(dirname "$0")"
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 SERVICE_MODEL=deepseek-flash RECORDARE_URL=http://localhost:8095
U="uv run --directory $PWD python"
run() { [ -s "$1.log" ] || RUN_TAG=$1 EVAL_DATASET=$2 $U run_eval.py --system service > "$1.log" 2>&1; }
run taint_dev_agent_personal dataset_dev_agent_personal
run taint_dev_echo dataset_dev_echo
echo DONE
