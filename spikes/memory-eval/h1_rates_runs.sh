#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
# WORK_PLAN 4.5c: unjustified-assertion and over-abstention rates of stored runs (outcome_eval.py; judge calls only,
# no ingestion). blind3: the service and the baselines, 3 runs each; the current engine on blind7 / 9 / 10 / 11.
set -u
cd "$(dirname "$0")"
U="uv run --directory $PWD python"
E=emb_bge-m3-deepseek-flash-nothink
B3=""
for s in service-dataset_blind3-$E-xv4 mem0-dataset_blind3-$E cognee-dataset_blind3-$E d-dataset_blind3-$E fullcontext-dataset_blind3-emb_bge-m3; do
  for r in 1 2 3; do B3="$B3 $s-r$r"; done
done
CUR="service-dataset_blind7-$E-b7-r1 service-dataset_blind7-$E-b7-r2 service-dataset_blind7-$E-b7-r3"
for r in 1 2 3; do
  CUR="$CUR service-dataset_blind9-$E-fp820_blind9_r$r service-dataset_blind10-$E-fp820_blind10_r$r service-dataset_blind11-$E-b11_r$r"
done
for l in $B3 nomemory-dataset_blind3-emb_bge-m3 $CUR; do
  [ -s "results/$l-outcomes.json" ] || $U outcome_eval.py "$l" 2>&1 | grep -v "judge call failed"
done
echo DONE
