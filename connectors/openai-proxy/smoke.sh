#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
#
# End-to-end smoke test of the memory proxy with AnythingLLM against a local Recordare (dev machine, Docker):
#   1. creates a test client (platform) + key and a person, bound to AnythingLLM's user 2;
#   2. runs the proxy (node, this folder) and AnythingLLM in Docker with the Generic OpenAI provider → the proxy,
#      multi-user mode, a workspace whose system prompt carries the marker;
#   3. turn 1 tells a personal fact → messages in Recordare; the proxy ends the conversation after END_IDLE_SECONDS →
#      waits for the extracted episode;
#   4. turn 2 (a new thread, streamed) asks about it → the memory block in what the upstream received, no marker;
#   5. removes the container and the image (always), and the proxy.
# Secrets are read from files and never printed. Costs 2 LLM turns + Recordare's extraction. Needs ~5 GB of Docker disk.
#
# Usage: SMOKE_DIR=/some/empty/scratch/dir connectors/openai-proxy/smoke.sh
# Env: RECORDARE_URL (default http://localhost:8080), SERVICE_ENV (default service/.env: ADMIN_API_KEY, LLM_API_KEY),
#      LLM_BASE_URL (default https://api.deepseek.com/v1), LLM_MODEL (default deepseek-flash),
#      ANYTHINGLLM_IMAGE (default mintplexlabs/anythingllm:1.17.0), PROXY_PORT (default 8788), DB_CONTAINER.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
: "${SMOKE_DIR:?set SMOKE_DIR to an empty scratch directory (never your home)}"
case "$(cd "$SMOKE_DIR" 2>/dev/null && pwd || echo "$SMOKE_DIR")" in "$HOME"|"$HOME/."*) echo "refusing SMOKE_DIR=$SMOKE_DIR" >&2; exit 1;; esac
URL="${RECORDARE_URL:-http://localhost:8080}"
SERVICE_ENV="${SERVICE_ENV:-$ROOT/service/.env}"
IMAGE="${ANYTHINGLLM_IMAGE:-mintplexlabs/anythingllm:1.17.0}"
PORT="${PROXY_PORT:-8788}"
MODEL="${LLM_MODEL:-deepseek-flash}"
DB="${DB_CONTAINER:-recordare-db-1}"
ALLM=allm-recordare-smoke
mkdir -p "$SMOKE_DIR/storage" "$SMOKE_DIR/secrets"; chmod 700 "$SMOKE_DIR/secrets"; touch "$SMOKE_DIR/storage/.env"
S="$SMOKE_DIR/secrets"

envval() { grep -E "^$1=" "$SERVICE_ENV" | cut -d= -f2- | tr -d "\"'"; }
ADMIN="$(envval ADMIN_API_KEY)"
json() { python3 -c "import json,sys; print(json.load(sys.stdin)$1)"; }
admin() { curl -sf -X POST "$URL/api/v1/admin/$1" -H "authorization: Bearer $ADMIN" -H 'content-type: application/json' -d "$2"; }
sql() { docker exec "$DB" psql -U recordare -d recordare -At -c "$1"; }

PROXY_PID=
cleanup() {
  [ -n "$PROXY_PID" ] && kill "$PROXY_PID" 2>/dev/null || true
  docker rm -f -v "$ALLM" >/dev/null 2>&1 || true
  docker rmi "$IMAGE" >/dev/null 2>&1 || true
  rm -rf "$S"
}
trap cleanup EXIT

echo "== build"
(cd "$HERE" && npm ci --no-audit --no-fund >/dev/null && npm run build >/dev/null)

echo "== Recordare: client key + person bound to anythingllm:2"
CLIENT="$(admin clients '{"name":"openai-proxy-smoke","kind":"platform","autoProvision":true}' | json "['id']")"
admin "clients/$CLIENT/keys" '{"scopes":["ingest","mcp","read"]}' | json "['key']" > "$S/rk"
PERSON="$(admin owners '{"displayName":"Proxy Smoke"}' | json "['personId']")"
admin identities "{\"kind\":\"account\",\"personId\":\"$PERSON\",\"clientId\":\"$CLIENT\",\"externalId\":\"anythingllm:2\"}" >/dev/null
{ echo "UPSTREAM_BASE_URL=${LLM_BASE_URL:-https://api.deepseek.com/v1}"; echo "UPSTREAM_API_KEY=$(envval LLM_API_KEY)"
  echo "PROXY_API_KEY=$(openssl rand -hex 16)"; echo "RECORDARE_URL=$URL"; echo "RECORDARE_API_KEY=$(cat "$S/rk")"; } > "$S/proxy.env"
echo "GENERIC_OPEN_AI_API_KEY=$(grep PROXY_API_KEY "$S/proxy.env" | cut -d= -f2)" > "$S/allm.env"
chmod 600 "$S"/*
echo "person $PERSON"

echo "== proxy on :$PORT"
(set -a; . "$S/proxy.env"; set +a; PORT=$PORT END_IDLE_SECONDS=20 LOG_UPSTREAM=1 exec node "$HERE/dist/main.js") > "$SMOKE_DIR/proxy.log" 2>&1 &
PROXY_PID=$!
until curl -sf "localhost:$PORT/health" >/dev/null; do sleep 1; done

echo "== AnythingLLM"
docker run -d --name "$ALLM" -p 3001:3001 --cap-add SYS_ADMIN \
  -v "$SMOKE_DIR/storage:/app/server/storage" -v "$SMOKE_DIR/storage/.env:/app/server/.env" -e STORAGE_DIR=/app/server/storage \
  --env-file "$S/allm.env" -e LLM_PROVIDER=generic-openai -e "GENERIC_OPEN_AI_BASE_PATH=http://host.docker.internal:$PORT/v1" \
  -e "GENERIC_OPEN_AI_MODEL_PREF=$MODEL" -e GENERIC_OPEN_AI_MODEL_TOKEN_LIMIT=32000 -e GENERIC_OPEN_AI_MAX_TOKENS=1024 "$IMAGE" >/dev/null
until curl -sf localhost:3001/api/ping >/dev/null; do sleep 3; done
curl -sf -X POST localhost:3001/api/system/generate-api-key | json "['apiKey']['secret']" > "$S/allm-key"
AK="$(cat "$S/allm-key")"
H=(-H "Authorization: Bearer $AK" -H 'content-type: application/json')
curl -sf -X POST localhost:3001/api/system/enable-multi-user -H 'content-type: application/json' \
  -d "{\"username\":\"admin\",\"password\":\"$(openssl rand -hex 12)\"}" >/dev/null
curl -sf -X POST "${H[@]}" localhost:3001/api/v1/admin/users/new -d "{\"username\":\"giulia\",\"password\":\"$(openssl rand -hex 12)\",\"role\":\"default\"}" | json "['user']['id']"
curl -sf -X POST "${H[@]}" localhost:3001/api/v1/workspace/new -d '{"name":"Memoria"}' >/dev/null
curl -sf -X POST "${H[@]}" localhost:3001/api/v1/workspace/memoria/update \
  -d '{"openAiPrompt":"Sei un assistente personale cordiale. Rispondi in italiano, in breve.\n[[recordare user={user.id} ws={workspace.id}]]"}' >/dev/null
thread() { curl -sf -X POST "${H[@]}" localhost:3001/api/v1/workspace/memoria/thread/new -d "{\"userId\":2,\"name\":\"$1\"}" | json "['thread']['slug']"; }

echo "== turn 1 (capture)"
T1="$(thread t1)"
curl -sf -m 120 -X POST "${H[@]}" "localhost:3001/api/v1/workspace/memoria/thread/$T1/chat" \
  -d '{"message":"Sabato scorso ho adottato un gatto rosso che si chiama Biscotto.","userId":2}' | json "['textResponse']"
sql "select m.role, left(m.content, 60) from conversations c join messages m on m.conversation_id = c.id where c.owner_id = '$PERSON' order by m.sent_at"

echo "== waiting for the episode (the proxy ends the conversation after 20 s)"
for _ in $(seq 1 60); do [ "$(sql "select count(*) from episodes where owner_id = '$PERSON'")" -gt 0 ] && break; sleep 5; done
sql "select content from episodes where owner_id = '$PERSON'"

echo "== turn 2 (recall, streamed, new thread)"
T2="$(thread t2)"
curl -sfN -m 120 -X POST "${H[@]}" "localhost:3001/api/v1/workspace/memoria/thread/$T2/stream-chat" \
  -d '{"message":"Come si chiama il mio gatto?","userId":2}' | grep -c '^data:' | sed 's/^/SSE events: /'
sleep 1
echo "upstream received the memory block: $(grep -c 'upstream request (stream: true.*memory-context' "$SMOKE_DIR/proxy.log" || true)"
echo "marker sent upstream (must be 0): $(grep 'upstream request' "$SMOKE_DIR/proxy.log" | grep -c '\[\[recordare' || true)"
sql "select m.role, left(m.content, 80) from conversations c join messages m on m.conversation_id = c.id where c.owner_id = '$PERSON' order by m.sent_at"
echo "== done (test person $PERSON and client $CLIENT stay in Recordare)"
