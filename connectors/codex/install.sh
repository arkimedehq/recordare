#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
#
# Recordare connector for OpenAI Codex: installs (or removes) the capture + recall hooks and the MCP server.
#
#   install.sh [--url http://host:8090] [--trust]      install or update (idempotent)
#   install.sh uninstall                                remove everything this script added
#
# The personal token is read from RECORDARE_TOKEN or asked for (never passed as an argument, so it stays out of the
# shell history). Other environment: RECORDARE_URL, RECORDARE_TRUST_HOOKS=1 (= --trust), CODEX_HOME (default
# ~/.codex), XDG_CONFIG_HOME (default ~/.config), RECORDARE_RAW_BASE (where to download the hook script from when
# this file is not run from a checkout).
#
# What it touches (each edited file is backed up as <file>.bak-<timestamp> first; never uses sudo):
#   ~/.config/recordare/codex.json   url + token, mode 600 (read by the hooks and by the MCP headers helper)
#   $CODEX_HOME/recordare/           the hook script
#   $CODEX_HOME/hooks.json           UserPromptSubmit, Stop and SessionEnd handlers (other hooks are kept)
#   $CODEX_HOME/config.toml          a marked [mcp_servers.recordare] block (+ hook trust entries with --trust)
set -euo pipefail

CODEX_DIR="${CODEX_HOME:-$HOME/.codex}"
CONF_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/recordare"
CONF="$CONF_DIR/codex.json"
SCRIPT_DIR="$CODEX_DIR/recordare"
SCRIPT="$SCRIPT_DIR/recordare-hook.mjs"
HOOKS="$CODEX_DIR/hooks.json"
TOML="$CODEX_DIR/config.toml"
RAW_BASE="${RECORDARE_RAW_BASE:-https://raw.githubusercontent.com/arkimedehq/recordare/main}"
BEGIN='# >>> recordare (managed by the Recordare Codex connector, install.sh)'
END='# <<< recordare'
STAMP="$(date +%Y%m%d%H%M%S)"

say() { printf '%s\n' "$*" >&2; }
die() { say "error: $*"; exit 1; }
backup() { if [ -f "$1" ]; then cp -p "$1" "$1.bak-$STAMP"; say "  backup: $1.bak-$STAMP"; fi; }
ask() { # ask <prompt> [silent]: reads from the terminal even when this script comes from a pipe
  local v=''
  [ -r /dev/tty ] || die "no terminal to ask '$1': set it in the environment"
  if [ "${2:-}" = silent ]; then
    printf '%s' "$1" >/dev/tty; stty -echo </dev/tty; IFS= read -r v </dev/tty || true; stty echo </dev/tty; printf '\n' >/dev/tty
  else
    printf '%s' "$1" >/dev/tty; IFS= read -r v </dev/tty || true
  fi
  printf '%s' "$v"
}

command -v node >/dev/null 2>&1 || die "Node.js >= 18 is required on the PATH (the hooks are a small Node script)"
node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 18 ? 0 : 1)' || die "Node.js >= 18 is required"

# Removes our handlers (any command running recordare-hook.mjs) from hooks.json; with "add", appends ours and prints
# the trust key + hash of each (the key needs the final group index, so this runs after the merge).
merge_hooks() { # merge_hooks add|remove
  node - "$HOOKS" "$1" "$SCRIPT" <<'NODE'
const fs = require('fs'), { createHash } = require('crypto');
const [file, mode, script] = process.argv.slice(2);
let doc = {};
try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
doc.hooks ??= {};
const ours = (h) => typeof h?.command === 'string' && h.command.includes('recordare-hook.mjs');
for (const ev of Object.keys(doc.hooks)) {
  doc.hooks[ev] = doc.hooks[ev].map((g) => ({ ...g, hooks: (g.hooks ?? []).filter((h) => !ours(h)) })).filter((g) => g.hooks.length);
  if (!doc.hooks[ev].length) delete doc.hooks[ev];
}
const trust = [];
if (mode === 'add') {
  const command = `node ${JSON.stringify(script)} codex`;
  // SessionEnd: Codex caps it at 3 s; the script keeps its request under 2.5 s there.
  for (const [ev, timeout] of [['UserPromptSubmit', 10], ['Stop', 15], ['SessionEnd', 3]]) {
    const handler = { type: 'command', command, timeout };
    (doc.hooks[ev] ??= []).push({ hooks: [handler] });
    // Codex's hook trust: key <hooks.json path>:<event_snake>:<group>:<handler>, hash = sha256 of the canonical
    // (sorted-key, compact) JSON of the normalised handler group. Checked against Codex 0.161.0.
    const snake = ev.replace(/[A-Z]/g, (c, i) => (i ? '_' : '') + c.toLowerCase());
    const canon = JSON.stringify({ event_name: snake, hooks: [{ async: false, command, timeout, type: 'command' }] });
    trust.push(`${file}:${snake}:${doc.hooks[ev].length - 1}:0 sha256:${createHash('sha256').update(canon).digest('hex')}`);
  }
}
if (Object.keys(doc.hooks).length || Object.keys(doc).length > 1) fs.writeFileSync(file, JSON.stringify(doc, null, 2) + '\n');
else fs.rmSync(file, { force: true });
process.stdout.write(trust.join('\n'));
NODE
}

# Prints config.toml without our marked block.
toml_without_block() {
  [ -f "$TOML" ] || return 0
  awk -v b="$BEGIN" -v e="$END" '$0==b{skip=1;next} skip&&$0==e{skip=0;next} !skip' "$TOML"
}

uninstall() {
  say "Removing the Recordare connector from $CODEX_DIR"
  if [ -f "$HOOKS" ] && grep -q 'recordare-hook.mjs' "$HOOKS"; then backup "$HOOKS"; merge_hooks remove >/dev/null; fi
  if [ -f "$TOML" ] && grep -qxF "$BEGIN" "$TOML"; then
    backup "$TOML"; toml_without_block >"$TOML.tmp-$STAMP"; mv "$TOML.tmp-$STAMP" "$TOML"
  fi
  if [ -f "$TOML" ] && grep -q '^\[mcp_servers\.recordare\]' "$TOML"; then
    say "  note: config.toml still has an [mcp_servers.recordare] table not written by this script: 'codex mcp remove recordare'"
  fi
  rm -rf "$SCRIPT_DIR"
  rm -f "$CONF"
  rmdir "$CONF_DIR" 2>/dev/null || true
  say "Done. Trust entries Codex wrote for the removed hooks ([hooks.state.\"…hooks.json:…\"]) are harmless; /hooks lists what is left."
}

install() {
  local url="${RECORDARE_URL:-}" token="${RECORDARE_TOKEN:-}" trust="${RECORDARE_TRUST_HOOKS:-0}"
  while [ $# -gt 0 ]; do
    case "$1" in
      --url) url="${2:-}"; shift 2 ;;
      --url=*) url="${1#--url=}"; shift ;;
      --trust) trust=1; shift ;;
      --token|--token=*) die "pass the token in RECORDARE_TOKEN or at the prompt, not as an argument (shell history)" ;;
      *) die "unknown argument: $1" ;;
    esac
  done
  [ -n "$url" ] || url="$(ask 'Recordare URL (e.g. http://localhost:8090): ')"
  [ -n "$token" ] || token="$(ask 'Personal token (rp_…, scopes mcp + ingest + read): ' silent)"
  url="${url%/}"
  [ -n "$url" ] && [ -n "$token" ] || die "the URL and the token are both required"

  # Connectivity check (warning only: the service may be down right now).
  if command -v curl >/dev/null 2>&1; then
    local code
    code="$(curl -s -o /dev/null -w '%{http_code}' -m 5 -K - "$url/api/v1/me" <<<"header = \"Authorization: Bearer $token\"" || true)"
    case "$code" in
      200) say "Recordare reachable, token accepted." ;;
      401|403) die "Recordare rejected the token (HTTP $code)" ;;
      *) say "warning: could not check the token at $url (HTTP ${code:-none}); installing anyway" ;;
    esac
  fi

  say "Installing the Recordare connector into $CODEX_DIR"
  mkdir -p "$CONF_DIR" "$SCRIPT_DIR"
  (umask 077; RECORDARE_URL="$url" RECORDARE_TOKEN="$token" node -e '
    require("fs").writeFileSync(process.argv[1], JSON.stringify({ url: process.env.RECORDARE_URL, token: process.env.RECORDARE_TOKEN }, null, 2) + "\n", { mode: 0o600 })' "$CONF")
  chmod 600 "$CONF"
  say "  config: $CONF (mode 600)"

  local here=''
  [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ] && here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  if [ -n "$here" ] && [ -f "$here/scripts/recordare-hook.mjs" ]; then
    cp "$here/scripts/recordare-hook.mjs" "$SCRIPT"
  else
    command -v curl >/dev/null 2>&1 || die "curl is needed to download the hook script"
    curl -fsSL "$RAW_BASE/connectors/codex/scripts/recordare-hook.mjs" -o "$SCRIPT.tmp" && mv "$SCRIPT.tmp" "$SCRIPT"
  fi
  say "  hook script: $SCRIPT"

  backup "$HOOKS"
  local trusts
  trusts="$(merge_hooks add)"
  say "  hooks: $HOOKS (UserPromptSubmit, Stop, SessionEnd)"

  # config.toml: our block replaces the previous one; a foreign [mcp_servers.recordare] table goes through Codex.
  backup "$TOML"
  local rest
  rest="$(toml_without_block)"
  if printf '%s\n' "$rest" | grep -q '^\[mcp_servers\.recordare\]'; then
    command -v codex >/dev/null 2>&1 || die "$TOML already has an [mcp_servers.recordare] table: remove it first"
    codex mcp remove recordare >/dev/null
    rest="$(toml_without_block)"
  fi
  local q_script helper block
  q_script="$(node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$SCRIPT")"
  # The helper runs through a shell and prints {"Authorization": "Bearer …"} from codex.json: no token in config.toml.
  helper="$(node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "node $q_script codex --mcp-headers")"
  block="$BEGIN
[mcp_servers.recordare]
url = $(node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$url/mcp")
http_headers_helper = $helper
startup_timeout_sec = 10
tool_timeout_sec = 30"
  if [ "$trust" = 1 ]; then
    local key hash
    while read -r key hash; do
      [ -n "$key" ] || continue
      if printf '%s\n' "$rest" | grep -qF "[hooks.state.\"$key\"]"; then
        say "  trust: $key already has an entry (review it in /hooks)"; continue
      fi
      block="$block
[hooks.state.$(node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$key")]
trusted_hash = \"$hash\""
    done <<<"$trusts"
  fi
  block="$block
$END"
  mkdir -p "$CODEX_DIR"
  { [ -n "$rest" ] && printf '%s\n\n' "$rest"; printf '%s\n' "$block"; } >"$TOML.tmp-$STAMP"
  mv "$TOML.tmp-$STAMP" "$TOML"
  say "  MCP server: [mcp_servers.recordare] in $TOML"

  say ""
  if [ "$trust" = 1 ]; then
    say "Done. The three hooks are pre-trusted; check them any time with /hooks in codex."
  else
    say "Done. One step left: Codex runs new hooks only once you trust them."
    say "Open codex, type /hooks and trust the three Recordare hooks (UserPromptSubmit, Stop, SessionEnd)."
  fi
  say "Then 'codex mcp list' shows the recordare server. Remove everything with: install.sh uninstall"
}

case "${1:-}" in
  uninstall) uninstall ;;
  *) install "$@" ;;
esac
