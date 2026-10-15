#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
# WORK_PLAN 6.5 (3): dev_ambient, 1 run per arm — ambient (extract.v16 note + pending facts / notes) vs the same
# transcripts sent as voice. DeepSeek direct, one service instance on :8095 (queue amb95).
set -u
cd "$(dirname "$0")"
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 SERVICE_MODEL=deepseek-flash RECORDARE_URL=http://localhost:8095
U="uv run --directory $PWD python"
[ -s amb65_ambient.log ] || RUN_TAG=amb65-ambient EVAL_DATASET=dataset_dev_ambient $U run_eval.py --system service > amb65_ambient.log 2>&1
[ -s amb65_voice.log ] || RUN_TAG=amb65-voice EVAL_SOURCE_AMBIENT_AS=voice EVAL_DATASET=dataset_dev_ambient $U run_eval.py --system service > amb65_voice.log 2>&1
# After the pending-proposals fix (ca751d2) and with `heard` in recall: the same ambient arm again.
[ -s amb65_ambient_r2.log ] || RUN_TAG=amb65-ambient-r2 EVAL_DATASET=dataset_dev_ambient $U run_eval.py --system service > amb65_ambient_r2.log 2>&1
[ -s amb65_ambient_r3.log ] || RUN_TAG=amb65-ambient-r3 EVAL_DATASET=dataset_dev_ambient $U run_eval.py --system service > amb65_ambient_r3.log 2>&1
echo DONE
