#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
# Remainder of m4b_runs.sh (D and controls) after the service runs. Usage: sh m4b_rest.sh base|noise
set -u
cd "$(dirname "$0")"
export EMBED_MODEL=st:BAAI/bge-m3 EVAL_DATASET=dataset_blind3
NOISE=""; [ "$1" = noise ] && NOISE="--noise"
U="uv run --directory $PWD python"
ENGINE_MODEL=deepseek-flash $U run_eval.py --system d $NOISE --runs 3 > m4b_d_$1.log 2>&1
$U run_eval.py --system fullcontext $NOISE --runs 3 > m4b_full_$1.log 2>&1
$U run_eval.py --system nomemory $NOISE --runs 1 > m4b_nomem_$1.log 2>&1
echo DONE
