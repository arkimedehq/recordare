#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
# Confirmation on blind dataset 4, ordered by priority (balance-aware): service v4 (balanced) and Mem0, base + noise,
# then D and the full-context ceiling. 3 runs each; --resume continues a stopped chain.
set -u
cd "$(dirname "$0")"
until grep -q DONE m4b_profiles.out 2>/dev/null; do sleep 60; done
export RECORDARE_ADMIN_KEY=$(grep '^ADMIN_API_KEY=' ../../service/.env | cut -d= -f2) EMBED_MODEL=st:BAAI/bge-m3 EVAL_DATASET=dataset_blind4
U="uv run --directory $PWD python"
SERVICE_MODEL=deepseek-flash RUN_TAG=xv4 $U run_eval.py --system service --runs 3 --resume > b4_service_base.log 2>&1
ENGINE_MODEL=deepseek-flash $U run_eval.py --system mem0 --runs 3 --resume > b4_mem0_base.log 2>&1
SERVICE_MODEL=deepseek-flash RUN_TAG=xv4 $U run_eval.py --system service --noise --runs 3 --resume > b4_service_noise.log 2>&1
ENGINE_MODEL=deepseek-flash $U run_eval.py --system mem0 --noise --runs 3 --resume > b4_mem0_noise.log 2>&1
ENGINE_MODEL=deepseek-flash $U run_eval.py --system d --runs 3 --resume > b4_d_base.log 2>&1
$U run_eval.py --system fullcontext --runs 3 --resume > b4_full_base.log 2>&1
for f in results/service-*dataset_blind4-*-xv4-r[123].json; do [ -f "${f%.json}-extraction.json" ] && continue; $U extraction_eval.py "$f" dataset_blind4/gold.json >> b4_extraction.log 2>&1; done
echo DONE
