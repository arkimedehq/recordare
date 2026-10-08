#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
#
# End-to-end smoke test of the OpenClaw plugin against a local Recordare (dev machine, Docker):
#   1. creates a test client, person (consent on) and personal token through Recordare's admin API;
#   2. runs an OpenClaw Gateway in Docker with a throwaway state dir and the plugin linked from this folder;
#   3. turn 1 tells a personal fact → checks the messages in Recordare's database; /new ends the session →
#      waits for the extracted episode;
#   4. turn 2 in a new session asks about it (answer from the injected <memory-context> block); turn 3 calls
#      recordare_search_episodes;
#   5. removes the container (and the image with CLEAN_IMAGE=1).
# Secrets are read from files and never printed. Costs 3 LLM turns + Recordare's extraction.
#
# Usage: SMOKE_DIR=/some/scratch/dir connectors/openclaw/smoke.sh
# Env: RECORDARE_URL (host side, default http://localhost:8080), RECORDARE_DOCKER_URL (from the container, default
#      http://host.docker.internal:8080), SERVICE_ENV (default service/.env: ADMIN_API_KEY, LLM_API_KEY),
#      LLM_BASE_URL (default https://api.deepseek.com/v1), LLM_MODEL (default deepseek-flash),
#      OPENCLAW_IMAGE (default ghcr.io/openclaw/openclaw:2026.9.9), DB_CONTAINER (default recordare-db-1).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
: "${SMOKE_DIR:?set SMOKE_DIR to an empty scratch directory (never your home)}"
case "$(cd "$SMOKE_DIR" 2>/dev/null && pwd || echo "$SMOKE_DIR")" in "$HOME"|"$HOME/.openclaw"*) echo "refusing SMOKE_DIR=$SMOKE_DIR" >&2; exit 1;; esac
URL="${RECORDARE_URL:-http://localhost:8080}"
DURL="${RECORDARE_DOCKER_URL:-http://host.docker.internal:8080}"
SERVICE_ENV="${SERVICE_ENV:-$ROOT/service/.env}"
IMAGE="${OPENCLAW_IMAGE:-ghcr.io/openclaw/openclaw:2026.9.9}"
DB="${DB_CONTAINER:-recordare-db-1}"
GW=oc-recordare-smoke
mkdir -p "$SMOKE_DIR/state" "$SMOKE_DIR/secrets"; chmod 700 "$SMOKE_DIR/secrets"

envval() { grep -E "^$1=" "$SERVICE_ENV" | cut -d= -f2- | tr -d "\"'"; }
ADMIN="$(envval ADMIN_API_KEY)"
json() { python3 -c "import json,sys; print(json.load(sys.stdin)$1)"; }
admin() { curl -sf -X POST "$URL/api/v1/admin/$1" -H "authorization: Bearer $ADMIN" -H 'content-type: application/json' -d "$2"; }
sql() { docker exec "$DB" psql -U recordare -d recordare -At -c "$1"; }

echo "== build"
(cd "$HERE" && npm ci --no-audit --no-fund >/dev/null && npm run build >/dev/null)

echo "== Recordare: test person + personal token"
CLIENT="$(admin clients '{"name":"openclaw-smoke","kind":"mcp_client"}' | json "['id']")"
PERSON="$(admin owners '{"displayName":"OpenClaw Smoke","episodicEnabled":true}' | json "['personId']")"
admin "owners/$PERSON/tokens" "{\"clientId\":\"$CLIENT\",\"scopes\":[\"mcp\",\"ingest\",\"read\"]}" | json "['token']" > "$SMOKE_DIR/secrets/token"
{ printf 'LLM_KEY=%s\n' "$(envval LLM_API_KEY)"; printf 'RECORDARE_API_KEY=%s\n' "$(cat "$SMOKE_DIR/secrets/token")"; } > "$SMOKE_DIR/secrets/env"
chmod 600 "$SMOKE_DIR/secrets/"*
echo "person $PERSON"

cat > "$SMOKE_DIR/state/openclaw.json" <<EOF
{
  gateway: { mode: "local" },
  session: { dmScope: "per-channel-peer" },
  models: { providers: { llm: {
    baseUrl: "${LLM_BASE_URL:-https://api.deepseek.com/v1}", apiKey: "\${LLM_KEY}", api: "openai-completions",
    models: [{ id: "${LLM_MODEL:-deepseek-flash}", name: "test model", reasoning: false, input: ["text"],
               cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 128000, maxTokens: 4096 }] } } },
  agents: { defaults: { model: { primary: "llm/${LLM_MODEL:-deepseek-flash}" } } },
  plugins: { entries: { recordare: {
    enabled: true,
    hooks: { allowConversationAccess: true },
    config: { url: "$DURL", apiKey: "\${RECORDARE_API_KEY}" } } } }
}
EOF

run() { docker run --rm --env-file "$SMOKE_DIR/secrets/env" -v "$SMOKE_DIR/state:/home/node/.openclaw" -v "$HERE:/plugins/recordare:ro" --entrypoint node "$IMAGE" /app/openclaw.mjs "$@"; }
agent() { docker exec "$GW" node openclaw.mjs agent --session-key "$1" --message "$2" --json 2>&1 | python3 -c 'import sys,re; m=re.search(r"\"finalAssistantVisibleText\": *\"([^\"]*)\"", sys.stdin.read()); print(m.group(1) if m else "(no answer)")'; }
cleanup() { docker rm -f "$GW" >/dev/null 2>&1 || true; [ "${CLEAN_IMAGE:-0}" = 1 ] && docker rmi "$IMAGE" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "== OpenClaw: link the plugin, start the Gateway"
run plugins install --link /plugins/recordare --force --accept-capabilities >/dev/null
docker run -d --name "$GW" --env-file "$SMOKE_DIR/secrets/env" -v "$SMOKE_DIR/state:/home/node/.openclaw" -v "$HERE:/plugins/recordare:ro" \
  "$IMAGE" node openclaw.mjs gateway --allow-unconfigured --bind loopback >/dev/null
until docker logs "$GW" 2>&1 | grep -q '\[gateway\] ready'; do sleep 2; done

echo "== turn 1 (capture)"
agent agent:main:smoke-a "Sabato scorso ho adottato un gatto rosso che si chiama Biscotto. Rispondi in una frase."
sql "select m.role, left(m.content, 60) from conversations c join messages m on m.conversation_id = c.id where c.owner_id = '$PERSON' order by m.sent_at"
agent agent:main:smoke-a "/new" >/dev/null
echo "== waiting for the extraction (conversation ended)"
until [ "$(sql "select count(*) from episodes where owner_id = '$PERSON'")" -gt 0 ]; do sleep 3; done
sql "select kind, left(content, 90) from episodes where owner_id = '$PERSON'"

echo "== turn 2 (recall before the turn)"
agent agent:main:smoke-b "Come si chiama il mio gatto e di che colore è? Rispondi in una frase, senza usare strumenti."
sql "select count(*) || ' memory-context block(s) served' from recall_log where owner_id = '$PERSON'"
echo "== turn 3 (memory tool)"
agent agent:main:smoke-b "Usa lo strumento recordare_search_episodes (query: gatto) e dimmi in una frase che data risulta per l'adozione."
echo "== done (test person $PERSON left in Recordare)"
