#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese

# update.sh — backup, then rebuild and restart Recordare on the current code (migrations run at start).
# Get the new code first (git pull, or a copy of the repository); deploy/.env is kept. Usage: deploy/update.sh
set -euo pipefail
cd "$(dirname "$0")"
[[ -f .env ]] || { echo "deploy/.env missing: run deploy/install.sh first" >&2; exit 1; }
./backup.sh
if grep -q '^ARKIMEDE_NETWORK=' .env; then F=docker-compose.cohosted.yml; else F=docker-compose.yml; fi
[[ -d ../.git ]] && git -C .. pull --ff-only || true
docker compose -p recordare -f "$F" --env-file .env up -d --build
for i in $(seq 1 60); do
  [[ "$(docker inspect recordare-recordare-1 --format '{{.State.Health.Status}}' 2>/dev/null)" == healthy ]] && { echo "Recordare updated and healthy"; exit 0; }
  sleep 5
done
echo "Recordare did not become healthy — see: docker logs recordare-recordare-1" >&2; exit 1
