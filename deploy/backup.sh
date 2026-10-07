#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese

# backup.sh — dump of Recordare's database into deploy/backups/ (both profiles; co-hosted: only Recordare's database,
# never Arkimede's). Keeps the last ${KEEP:-14} dumps. Usage: deploy/backup.sh
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p backups && chmod 700 backups
ts=$(date +%Y%m%d-%H%M%S); out="backups/recordare-$ts.sql.gz"
if docker inspect recordare-postgres-1 >/dev/null 2>&1; then
  docker exec recordare-postgres-1 pg_dump -U recordare -d recordare | gzip > "$out"          # standalone
else
  PG=$(docker ps --format '{{.Names}}' | grep -E -- '-postgres-1$' | grep -i arkimede | head -1)   # co-hosted
  [[ -n "$PG" ]] || { echo "no Postgres container found" >&2; exit 1; }
  docker exec "$PG" sh -c 'pg_dump -U "$POSTGRES_USER" -d recordare' | gzip > "$out"
fi
chmod 600 "$out"
[[ $(gzip -dc "$out" | head -c 1000 | grep -c 'PostgreSQL database dump') -ge 1 ]] || { echo "dump looks empty: $out" >&2; exit 1; }
ls -1t backups/recordare-*.sql.gz | tail -n +$(( ${KEEP:-14} + 1 )) | xargs -r rm -f
echo "backup: $out ($(du -h "$out" | cut -f1))"
