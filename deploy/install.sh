#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese

# install.sh — guided installer of Recordare in containers (docs/DEPLOYMENT.md).
#
# Two profiles:
#   standalone  Recordare with its own Postgres (pgvector), Redis and embedding server (bge-m3).
#   cohosted    next to Arkimede on a small server: an own database + user in Arkimede's Postgres (pgvector image),
#               an own Redis logical database, Arkimede's bge-m3 embedder — Recordare's code stays independent.
# Then, optionally, it links Arkimede: a client for it in Recordare, RECORDARE_URL / RECORDARE_API_KEY in its .env.
#
# Idempotent: re-running keeps the secrets already in deploy/.env (backed up before any change). Never asks for sudo.
#
# Usage:
#   deploy/install.sh                 interactive
#   deploy/install.sh --profile cohosted --yes     answers from the environment / defaults:
#     LLM_BASE_URL, LLM_MODEL, LLM_API_KEY (or LLM_API_KEY_FILE), ARKIMEDE_DIR, RECORDARE_PORT, RECORDARE_BIND, LINK_ARKIMEDE=yes|no,
#     RECORDARE_PROJECT (Compose project name, default recordare: another one for a second installation on the host)
set -euo pipefail

PROFILE=""; YES=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile) PROFILE="$2"; shift 2 ;;
    --yes|-y) YES=1; shift ;;
    -h|--help) sed -n '5,20p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1 (use --help)"; exit 1 ;;
  esac
done

if [[ -t 1 ]]; then B=$'\e[1m'; G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; C=$'\e[36m'; N=$'\e[0m'; else B=; G=; Y=; R=; C=; N=; fi
step() { echo; echo "${B}${C}▸ $*${N}"; }
ok()   { echo "  ${G}✓${N} $*"; }
warn() { echo "  ${Y}⚠${N} $*"; }
die()  { echo "  ${R}✗${N} $*" >&2; exit 1; }
ask()  { local q="$1" def="${2:-}" ans; if [[ $YES == 1 ]]; then echo "$def"; return; fi
         read -rp "  ${B}$q${N}${def:+ [$def]}: " ans; echo "${ans:-$def}"; }
askpw() { local q="$1" ans; read -rsp "  ${B}$q${N}: " ans; echo >&2; echo "$ans"; }
yesno() { local def="${2:-Y}" ans; if [[ $YES == 1 ]]; then [[ $def == Y ]]; return; fi
          read -rp "  ${B}$1${N} [$([[ $def == Y ]] && echo Y/n || echo y/N)]: " ans; [[ "${ans:-$def}" =~ ^[YySs] ]]; }

cd "$(dirname "$0")"
DEPLOY="$(pwd)"; ENV_FILE="$DEPLOY/.env"
get() { grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- || true; }

echo "${B}Recordare · installer${N}"

step "1 · Preflight"
command -v docker >/dev/null || die "docker not installed"
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is required"
docker info >/dev/null 2>&1 || die "the Docker daemon is not responding"
command -v openssl >/dev/null || die "openssl is required (secrets)"
ok "docker $(docker version --format '{{.Server.Version}}') · compose v2"

step "2 · Profile"
ARK_PG=$(docker ps --format '{{.Names}}' | grep -E -- '-postgres-1$' | grep -i arkimede | head -1 || true)
if [[ -z "$PROFILE" ]]; then
  [[ -n "$ARK_PG" ]] && echo "  Arkimede found ($ARK_PG): co-hosting saves memory on small servers."
  PROFILE=$(ask "Profile: standalone | cohosted" "$([[ -n $ARK_PG ]] && echo cohosted || echo standalone)")
fi
[[ "$PROFILE" == standalone || "$PROFILE" == cohosted ]] || die "profile must be standalone or cohosted"
PROJECT_NAME=${RECORDARE_PROJECT:-$(get RECORDARE_PROJECT)}; PROJECT_NAME=${PROJECT_NAME:-recordare}
COMPOSE_FILE="$DEPLOY/docker-compose.yml"; [[ $PROFILE == cohosted ]] && COMPOSE_FILE="$DEPLOY/docker-compose.cohosted.yml"
COMPOSE=(docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE")
# A Compose project of the same name started from other files (e.g. the repository's development compose) would have
# its containers replaced: stop here and ask for another name.
other=$(docker compose ls -a --format json 2>/dev/null | PN="$PROJECT_NAME" CF="$COMPOSE_FILE" python3 -c '
import json, os, sys
for p in json.load(sys.stdin) or []:
    if p["Name"] == os.environ["PN"] and os.environ["CF"] not in p.get("ConfigFiles", ""): print(p.get("ConfigFiles", ""))' 2>/dev/null || true)
[[ -z "$other" ]] || die "a Compose project '$PROJECT_NAME' already runs from $other — set RECORDARE_PROJECT=<another name>"
RC="$PROJECT_NAME-recordare-1"
ok "profile: $PROFILE · project $PROJECT_NAME"

[[ -f "$ENV_FILE" ]] && cp -p "$ENV_FILE" "$ENV_FILE.bak-$(date +%Y%m%d-%H%M%S)" && ok "existing .env backed up"
ADMIN_API_KEY=$(get ADMIN_API_KEY); [[ -n "$ADMIN_API_KEY" ]] || ADMIN_API_KEY=$(openssl rand -hex 32)
DB_PASSWORD=$(get RECORDARE_DB_PASSWORD); [[ -n "$DB_PASSWORD" ]] || DB_PASSWORD=$(openssl rand -hex 24)

step "3 · Language model (any OpenAI-compatible provider)"
LLM_BASE_URL=${LLM_BASE_URL:-$(get LLM_BASE_URL)}; LLM_MODEL=${LLM_MODEL:-$(get LLM_MODEL)}
LLM_BASE_URL=$(ask "LLM base URL" "${LLM_BASE_URL:-https://api.deepseek.com/v1}")
LLM_MODEL=$(ask "Model (measured best: deepseek-flash)" "${LLM_MODEL:-deepseek-flash}")
LLM_PROFILE=$(get LLM_PROFILE); [[ -n "$LLM_PROFILE" ]] || { [[ "$LLM_BASE_URL" == *deepseek* ]] && LLM_PROFILE=deepseek || LLM_PROFILE=generic; }
if [[ -n "${LLM_API_KEY_FILE:-}" ]]; then LLM_API_KEY=$(cat "$LLM_API_KEY_FILE")
elif [[ -z "${LLM_API_KEY:-}" ]]; then LLM_API_KEY=$(get LLM_API_KEY); fi
if [[ -z "$LLM_API_KEY" && $YES == 0 ]]; then LLM_API_KEY=$(askpw "API key (not shown; empty for a local server)"); fi
ok "LLM: $LLM_MODEL at $LLM_BASE_URL (profile $LLM_PROFILE)"

step "4 · Storage and embeddings"
if [[ $PROFILE == cohosted ]]; then
  [[ -n "$ARK_PG" ]] || die "co-hosted needs Arkimede's Postgres running (container *arkimede*-postgres-1)"
  PROJECT=${ARK_PG%-postgres-1}
  img=$(docker inspect "$ARK_PG" --format '{{.Config.Image}}')
  [[ "$img" == pgvector/* ]] || die "Arkimede's Postgres runs $img: switch it to pgvector/pgvector first (Arkimede: scripts/postgres-to-pgvector.sh)"
  # The network Postgres, Redis and the embedder share: Recordare joins it and reaches them by name.
  NET=$(docker inspect "$ARK_PG" --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' | awk '{print $1}')
  for s in redis embedding; do docker inspect "$PROJECT-$s-1" >/dev/null 2>&1 || die "$PROJECT-$s-1 not found"; done
  ARK_EMB=$(docker inspect "$PROJECT-embedding-1" --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^EMBEDDING_MODEL=//p; s/^MODEL_NAME=//p' | head -1)
  [[ "$ARK_EMB" == "BAAI/bge-m3" ]] || die "Arkimede's embedder serves '${ARK_EMB:-unknown}', not BAAI/bge-m3 (Recordare needs bge-m3): migrate Arkimede first or use the standalone profile"
  PGU=$(docker exec "$ARK_PG" printenv POSTGRES_USER)
  psql_ark() { docker exec -i "$ARK_PG" psql -v ON_ERROR_STOP=1 -X -q -At -U "$PGU" "$@"; }
  if [[ -z "$(psql_ark -d postgres -c "SELECT 1 FROM pg_roles WHERE rolname = 'recordare'")" ]]; then
    psql_ark -d postgres -c "CREATE ROLE recordare LOGIN PASSWORD '$DB_PASSWORD';"
  else psql_ark -d postgres -c "ALTER ROLE recordare PASSWORD '$DB_PASSWORD';"; fi
  [[ -n "$(psql_ark -d postgres -c "SELECT 1 FROM pg_database WHERE datname = 'recordare'")" ]] || psql_ark -d postgres -c "CREATE DATABASE recordare OWNER recordare;"
  psql_ark -d recordare -c "CREATE EXTENSION IF NOT EXISTS vector;"   # not a trusted extension: created by the superuser
  ok "database 'recordare' and its user in $ARK_PG (Arkimede's data untouched)"
  REDIS_DB=1
  n=$(docker exec "$PROJECT-redis-1" redis-cli -n $REDIS_DB DBSIZE 2>/dev/null || echo 0)
  [[ "$n" == 0 || -n "$(get REDIS_URL)" ]] || warn "Redis db $REDIS_DB already holds $n keys (shared with another app?)"
  DATABASE_URL="postgres://recordare:$DB_PASSWORD@postgres:5432/recordare"
  REDIS_URL="redis://redis:6379/$REDIS_DB"
  EMBEDDING_BASE_URL="http://embedding:8000/v1"; EMBEDDING_MODEL="BAAI/bge-m3"
  ok "network $NET · Redis db $REDIS_DB · embedder $EMBEDDING_MODEL (Arkimede's)"
else
  DATABASE_URL="postgres://recordare:$DB_PASSWORD@postgres:5432/recordare"
  REDIS_URL="redis://redis:6379/0"
  EMBEDDING_BASE_URL="http://embedder:80/v1"; EMBEDDING_MODEL="BAAI/bge-m3"
  [[ "$(uname -m)" =~ ^(arm64|aarch64)$ ]] && EMBEDDER_IMAGE="ghcr.io/huggingface/text-embeddings-inference:cpu-arm64-1.9" \
    || EMBEDDER_IMAGE="ghcr.io/huggingface/text-embeddings-inference:cpu-1.9"
  ok "own Postgres (pgvector), Redis and embedder ($EMBEDDER_IMAGE, bge-m3)"
fi
step "5 · Network"
RECORDARE_PORT=${RECORDARE_PORT:-$(get RECORDARE_PORT)}; RECORDARE_PORT=$(ask "Host port" "${RECORDARE_PORT:-8090}")
RECORDARE_BIND=${RECORDARE_BIND:-$(get RECORDARE_BIND)}
if [[ -z "$RECORDARE_BIND" ]]; then
  # Other devices on the LAN (a client platform on another machine, the admin console from a laptop) need 0.0.0.0;
  # every route still needs a key, but traffic is plain HTTP: a trusted network only (README → Limits).
  if yesno "Reachable from other devices on the local network (plain HTTP, trusted network only)?" N; then RECORDARE_BIND=0.0.0.0
  else RECORDARE_BIND=127.0.0.1; fi
fi
ok "listening on $RECORDARE_BIND:$RECORDARE_PORT"

step "6 · Configuration (deploy/.env, mode 600)"
umask 077
cat > "$ENV_FILE" <<ENV
# Written by deploy/install.sh ($PROFILE) on $(date -u +%Y-%m-%dT%H:%MZ). Secrets: keep this file private.
NODE_ENV=production
DATABASE_URL=$DATABASE_URL
RECORDARE_DB_PASSWORD=$DB_PASSWORD
POSTGRES_PASSWORD=$DB_PASSWORD
REDIS_URL=$REDIS_URL
QUEUE_PREFIX=recordare
ADMIN_API_KEY=$ADMIN_API_KEY
QUALITY_PROFILE=balanced
CONSOLIDATION_SCHEDULE=true
CONSOLIDATION_HOUR=3
IDLE_DELAY_SECONDS=900
LLM_PROVIDER=openai-compatible
LLM_PROFILE=$LLM_PROFILE
LLM_BASE_URL=$LLM_BASE_URL
LLM_API_KEY=$LLM_API_KEY
LLM_MODEL=$LLM_MODEL
EMBEDDING_BASE_URL=$EMBEDDING_BASE_URL
EMBEDDING_MODEL=$EMBEDDING_MODEL
EMBEDDING_DIM=1024
RECORDARE_PORT=$RECORDARE_PORT
RECORDARE_BIND=$RECORDARE_BIND
RECORDARE_PROJECT=$PROJECT_NAME
${NET:+ARKIMEDE_NETWORK=$NET}
${EMBEDDER_IMAGE:+EMBEDDER_IMAGE=$EMBEDDER_IMAGE}
ENV
chmod 600 "$ENV_FILE"; ok "$ENV_FILE"

step "7 · Build and start"
"${COMPOSE[@]}" --env-file "$ENV_FILE" up -d --build 2>&1 | grep -E 'Built|Started|Running|Healthy|Error' || true
for i in $(seq 1 60); do
  [[ "$(docker inspect $RC --format '{{.State.Health.Status}}' 2>/dev/null)" == healthy ]] && break; sleep 5
done
[[ "$(docker inspect $RC --format '{{.State.Health.Status}}' 2>/dev/null)" == healthy ]] \
  || die "Recordare did not become healthy — see: docker logs $RC"
ok "Recordare is up (migrations applied) on $RECORDARE_BIND:$RECORDARE_PORT"

admin() { docker exec -i $RC node -e "
  const [m, p, b] = process.argv.slice(1);
  fetch('http://localhost:8080' + p, { method: m, headers: { authorization: 'Bearer ' + process.env.ADMIN_API_KEY, 'content-type': 'application/json' },
    body: b || undefined }).then(async (r) => { process.stdout.write(await r.text()); process.exit(r.ok ? 0 : 1); });" "$@"; }

if [[ $PROFILE == cohosted ]]; then
  step "8 · Link Arkimede"
  ARKIMEDE_DIR=${ARKIMEDE_DIR:-$(docker inspect "$PROJECT-backend-1" --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' 2>/dev/null || true)}
  if [[ "${LINK_ARKIMEDE:-yes}" != no ]] && [[ -f "$ARKIMEDE_DIR/.env" ]] && yesno "Create Arkimede's client and set RECORDARE_URL / RECORDARE_API_KEY in $ARKIMEDE_DIR/.env?" Y; then
    if grep -q '^RECORDARE_API_KEY=.' "$ARKIMEDE_DIR/.env"; then
      ok "Arkimede already has a Recordare key — left as it is"
    else
      client=$(admin POST /api/v1/admin/clients '{"name":"arkimede","kind":"platform","autoProvision":true}')
      cid=$(echo "$client" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
      key=$(admin POST "/api/v1/admin/clients/$cid/keys" '{"scopes":["ingest","mcp","read","write"]}' | sed -n 's/.*"key":"\([^"]*\)".*/\1/p')
      [[ -n "$key" ]] || die "could not create Arkimede's client key"
      cp -p "$ARKIMEDE_DIR/.env" "$ARKIMEDE_DIR/.env.bak-$(date +%Y%m%d-%H%M%S)"
      sed -i.tmp '/^RECORDARE_URL=/d; /^RECORDARE_API_KEY=/d' "$ARKIMEDE_DIR/.env" && rm -f "$ARKIMEDE_DIR/.env.tmp"
      printf '\n# Recordare (episodic memory) — written by recordare/deploy/install.sh\nRECORDARE_URL=http://recordare:8080\nRECORDARE_API_KEY=%s\n' "$key" >> "$ARKIMEDE_DIR/.env"
      ok "client 'arkimede' created; Arkimede's .env updated (backup kept)"
      warn "restart Arkimede's backend to load it (from $ARKIMEDE_DIR: docker compose … up -d backend)"
    fi
  fi
fi

echo
HOSTNAME_SHOWN=$([[ $RECORDARE_BIND == 0.0.0.0 ]] && (hostname -I 2>/dev/null | awk '{print $1}' || true) || true)
URL="http://${HOSTNAME_SHOWN:-127.0.0.1}:$RECORDARE_PORT"
echo "${B}Done.${N} Recordare ($PROFILE) on $URL"
echo "  Admin console: $URL/admin — sign in with ADMIN_API_KEY from $ENV_FILE (read it there; it is not printed)."
echo "  Next: in the console create a person, switch their consent on, and give each client platform a key"
echo "  (docs/INTEGRATION.md); backups: deploy/backup.sh (cron), upgrades: deploy/update.sh."
