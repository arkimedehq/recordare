#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
#
# End-to-end smoke test of the Hermes Agent provider against a local Recordare (dev machine, no Docker for Hermes):
#   1. installs Hermes Agent from source into a venv under SMOKE_DIR (unless HERMES_BIN is given) and a throwaway
#      HERMES_HOME with this provider copied into its plugins/;
#   2. creates a test client, person and personal token through Recordare's admin API;
#   3. turn 1 (one-shot session) tells a personal fact → checks the messages in Recordare's database; the session end
#      at exit ends the conversation (`…/end`) → waits for the extracted episode;
#   4. turn 2 (new session) asks about it → the answer comes from the pre-turn memory context (recall_log
#      `memory_context`); turn 3 asks for recordare_search_episodes (recall_log `search_episodes`);
#   5. gateway path without an LLM: a client key (rk_…) and the agent's memory, the client user `alice` (memory per
#      agent, D50); Hermes' own MemoryManager drives the provider as a Telegram gateway would (user `4242` = the account
#      holder, RECORDARE_SELF_IDS): turn start, pre-turn context, recordare_remember, sync, session end; then a new
#      session recalls the note; another Telegram user (`999`) is stored in the same memory as a participant (contact);
#   6. deletes the secrets it wrote (the test persons stay, with their memories, for inspection).
# Secrets are read from files and never printed. Costs 3 short LLM turns + Recordare's extraction.
# SKIP_LLM=1 runs only step 5.
#
# Usage: SMOKE_DIR=/some/scratch/dir connectors/hermes/smoke.sh
# Env: RECORDARE_URL (default http://localhost:8080), SERVICE_ENV (default service/.env: ADMIN_API_KEY, LLM_API_KEY),
#      LLM_BASE_URL (default https://api.deepseek.com/v1), LLM_MODEL (default deepseek-flash),
#      HERMES_BIN (an existing `hermes`; default: built in SMOKE_DIR), HERMES_REF (default v0.21.6),
#      DB_CONTAINER (default recordare-db-1).
set -euo pipefail
umask 077   # the .env files written below hold secrets

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
: "${SMOKE_DIR:?set SMOKE_DIR to an empty scratch directory (never your home)}"
mkdir -p "$SMOKE_DIR"
SMOKE_DIR="$(cd "$SMOKE_DIR" && pwd)"
case "$SMOKE_DIR" in "$HOME"|"$HOME/.hermes"*) echo "refusing SMOKE_DIR=$SMOKE_DIR" >&2; exit 1;; esac
URL="${RECORDARE_URL:-http://localhost:8080}"
SERVICE_ENV="${SERVICE_ENV:-$ROOT/service/.env}"
DB="${DB_CONTAINER:-recordare-db-1}"
HH="$SMOKE_DIR/home"                 # HERMES_HOME
FAKE_HOME="$SMOKE_DIR/user-home"     # HOME for Hermes: never touch the real ~/.hermes
mkdir -p "$HH/plugins" "$FAKE_HOME"

envval() { grep -E "^$1=" "$SERVICE_ENV" | cut -d= -f2- | tr -d "\"'"; }
ADMIN="$(envval ADMIN_API_KEY)"
json() { python3 -c "import json,sys; print(json.load(sys.stdin)$1)"; }
admin() { curl -sf -X POST "$URL/api/v1/admin/$1" -H "authorization: Bearer $ADMIN" -H 'content-type: application/json' -d "$2"; }
sql() { docker exec "$DB" psql -U recordare -d recordare -At -c "$1"; }
cleanup() { rm -f "$HH/.env"; }
trap cleanup EXIT

if [ -z "${HERMES_BIN:-}" ]; then
  echo "== Hermes Agent ${HERMES_REF:-v0.21.6} into $SMOKE_DIR/venv"
  [ -d "$SMOKE_DIR/hermes-src" ] || git clone -q --depth 1 --branch "${HERMES_REF:-v0.21.6}" \
    https://github.com/NousResearch/hermes-agent.git "$SMOKE_DIR/hermes-src"
  (cd "$SMOKE_DIR/hermes-src" && UV_PROJECT_ENVIRONMENT="$SMOKE_DIR/venv" uv sync -q --frozen --python 3.14)
  HERMES_BIN="$SMOKE_DIR/venv/bin/hermes"
fi
hermes() { env HOME="$FAKE_HOME" HERMES_HOME="$HH" "$HERMES_BIN" "$@"; }

echo "== provider → $HH/plugins/recordare"
rm -rf "$HH/plugins/recordare" && mkdir -p "$HH/plugins/recordare"
cp "$HERE"/recordare/*.py "$HERE"/recordare/plugin.yaml "$HH/plugins/recordare/"

if [ "${SKIP_LLM:-0}" != 1 ]; then
echo "== Recordare: test person + personal token"
CLIENT="$(admin clients '{"name":"hermes-smoke","kind":"mcp_client"}' | json "['id']")"
PERSON="$(admin owners '{"displayName":"Hermes Smoke"}' | json "['personId']")"
TOKEN="$(admin "owners/$PERSON/tokens" "{\"clientId\":\"$CLIENT\",\"scopes\":[\"mcp\",\"ingest\",\"read\"]}" | json "['token']")"
printf 'RECORDARE_URL=%s\nRECORDARE_API_KEY=%s\nLLM_API_KEY=%s\n' "$URL" "$TOKEN" "$(envval LLM_API_KEY)" > "$HH/.env"
unset TOKEN
echo "person $PERSON"

cat > "$HH/config.yaml" <<EOF
model:
  provider: custom
  model: ${LLM_MODEL:-deepseek-flash}
  base_url: ${LLM_BASE_URL:-https://api.deepseek.com/v1}
  api_key: "\${LLM_API_KEY}"
memory:
  provider: recordare
EOF

msgs() { sql "select m.role || ': ' || left(replace(m.content, E'\n', ' '), 90) from conversations c join messages m on m.conversation_id = c.id where c.owner_id = '$PERSON' order by m.sent_at, m.role desc"; }

echo "== turn 1 (capture; the one-shot exit ends the session)"
hermes -z "Sabato scorso ho adottato un gatto rosso che si chiama Biscotto. Rispondi in una frase."
msgs
sql "select external_id from conversations where owner_id = '$PERSON'"

echo "== waiting for the extraction"
for _ in $(seq 1 60); do
  n="$(sql "select count(*) from episodes where owner_id = '$PERSON'")"
  [ "$n" -gt 0 ] && break; sleep 5
done
sql "select kind || ': ' || content from episodes where owner_id = '$PERSON'"

echo "== turn 2 (new session: recall from the pre-turn memory context)"
hermes -z "Come si chiama il mio gatto?"
sql "select tool, items from recall_log where owner_id = '$PERSON' order by served_at"

echo "== turn 3 (memory tool)"
hermes -z "Usa lo strumento recordare_search_episodes per dirmi cosa ho fatto sabato scorso. Rispondi in una frase."
sql "select tool, coalesce(mode, '-'), items from recall_log where owner_id = '$PERSON' order by served_at"
echo "== conversations"
sql "select external_id, (select count(*) from messages m where m.conversation_id = c.id) from conversations c where owner_id = '$PERSON' order by started_at"
fi

echo "== gateway path (client key, X-Recordare-User; no LLM)"
GCLIENT="$(admin clients '{"name":"hermes-gateway-smoke","kind":"platform"}' | json "['id']")"
GPERSON="$(admin owners '{"displayName":"Hermes Gateway Smoke"}' | json "['personId']")"
admin identities "{\"personId\":\"$GPERSON\",\"kind\":\"account\",\"clientId\":\"$GCLIENT\",\"externalId\":\"alice\"}" >/dev/null
KEY="$(admin "clients/$GCLIENT/keys" '{"scopes":["mcp","ingest","read"]}' | json "['key']")"
printf 'RECORDARE_URL=%s\nRECORDARE_API_KEY=%s\nRECORDARE_USER=alice\nRECORDARE_SELF_IDS=telegram:4242\n' "$URL" "$KEY" > "$HH/.env"
unset KEY
echo "person $GPERSON"
PY="$(dirname "$HERMES_BIN")/python"
env HOME="$FAKE_HOME" HERMES_HOME="$HH" "$PY" - <<'PYEOF'
import os
from pathlib import Path
from dotenv import dotenv_values
os.environ.update({k: v for k, v in dotenv_values(Path(os.environ["HERMES_HOME"]) / ".env").items() if v})
from agent.memory_manager import MemoryManager
from plugins.memory import load_memory_provider

def session(sid, user_id, name="Alice"):
    mm = MemoryManager()
    mm.add_provider(load_memory_provider("recordare"))
    mm.initialize_all(session_id=sid, platform="telegram", hermes_home=os.environ["HERMES_HOME"], agent_context="primary",
                      user_id=user_id, user_name=name, chat_type="dm", gateway_session_key=f"agent:main:telegram:dm:{user_id}")
    return mm

mm = session("gw-1", "4242")
msg = "Ricordati che sono allergica alle arachidi."
mm.on_turn_start(1, msg, author_id="4242")
print("context before:", repr(mm.prefetch_all(msg)[:80]))
print("remember:", mm.handle_tool_call("recordare_remember", {"content": "Sono allergica alle arachidi", "category": "constraint"}))
mm.sync_all(msg, "Ok, me lo ricordo: allergia alle arachidi.")
mm.on_session_end([])
mm.shutdown_all()

mm = session("gw-2", "4242")
q = "Posso mangiare il burro di arachidi?"
mm.on_turn_start(1, q, author_id="4242")
print("context after:", mm.prefetch_all(q))
print("search_memory:", mm.handle_tool_call("recordare_search_memory", {"query": "allergie"})[:300])
mm.shutdown_all()

other = session("gw-3", "999", "Bruno")  # someone else: a participant of the same memory (a contact)
other.on_turn_start(1, "Ciao, sono Bruno, un amico di Alice.", author_id="999", author_name="Bruno")
other.prefetch_all("Ciao, sono Bruno, un amico di Alice.")
other.shutdown_all()
PYEOF
sql "select c.external_id || ' | ' || m.role || ': ' || left(m.content, 60) from conversations c join messages m on m.conversation_id = c.id where c.owner_id = '$GPERSON' order by m.sent_at"
sql "select 'note: ' || content from notes where owner_id = '$GPERSON'"
sql "select m.author_kind || ' ' || coalesce(p.display_name, '-') || ': ' || left(m.content, 50) from messages m left join persons p on p.id = m.author_person_id where m.owner_id = '$GPERSON' and m.role <> 'assistant' order by m.sent_at"
