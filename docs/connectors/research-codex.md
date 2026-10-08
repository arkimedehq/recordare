# Research: a Recordare connector for OpenAI Codex

Status: research note, 2026-10-08. Sources: the Codex source tree at
[`openai/codex@9b73858`](https://github.com/openai/codex/tree/9b738582b13c2cdbeff54af0afd04c50c3e7ba09) (main of
2026-10-08), the official docs (`developers.openai.com/codex/*` now redirects to `learn.chatgpt.com/docs/*`) and
our existing Claude Code connector (`connectors/claude-code/`). Below, `SRC/` means
`https://github.com/openai/codex/blob/9b738582b13c2cdbeff54af0afd04c50c3e7ba09/`.

**Version.** Latest release **0.161.0** (`rust-v0.161.0`, published 2026-10-07; npm `@openai/codex` 0.161.0). The CLI,
the IDE extension and the desktop app all run the same Rust core (the app/IDE through `codex app-server`), so
`~/.codex/config.toml` and `~/.codex/hooks.json` apply to all three. This was read in the source, not tested in the IDE
extension or the app.

**Short version.** Codex now has **Claude-Code-style lifecycle hooks**: they are stable and on by default. They use the
same event names and almost the same JSON payloads. `UserPromptSubmit` can return `additionalContext`, which Codex
injects as a **developer-role message** for that turn. Our Claude Code hook script therefore works with Codex after
small changes. The one new obstacle is **hook trust**: a user-level hook does not run until the user trusts it in
`/hooks`, or until its hash is recorded in `config.toml`.

---

## 1. MCP (streamable HTTP)

Built-in, with no experimental flag. The old `experimental_use_rmcp_client` flag is no longer needed: rmcp is the client.
For the transport type see `SRC/codex-rs/config/src/mcp_types.rs` (`McpServerTransportConfig::StreamableHttp`), and the
docs page [MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).

```toml
[mcp_servers.recordare]
url = "http://localhost:8090/mcp"
bearer_token_env_var = "RECORDARE_TOKEN"   # sends Authorization: Bearer $RECORDARE_TOKEN; the env var must be set for codex
# alternatives:
# http_headers = { Authorization = "Bearer rp_…" }          # static, the secret then sits in config.toml
# env_http_headers = { "X-Something" = "ENV_VAR_NAME" }     # header value read from an env var
# http_headers_helper = "cmd that prints a JSON object of headers"  # local helper, dynamic headers
startup_timeout_sec = 10
tool_timeout_sec = 30
required = false                       # true = codex refuses to start if the server is down
default_tools_approval_mode = "auto"   # auto | prompt | writes | approve
# enabled_tools = ["search_memory", "search_episodes", "remember"]   # allow-list; disabled_tools also exists
```

CLI ([`SRC/codex-rs/cli/src/mcp_cmd.rs`](https://github.com/openai/codex/blob/9b738582b13c2cdbeff54af0afd04c50c3e7ba09/codex-rs/cli/src/mcp_cmd.rs)):
`codex mcp add recordare --url http://localhost:8090/mcp --bearer-token-env-var RECORDARE_TOKEN`, plus
`codex mcp list|get|remove`. OAuth flags (`--oauth-client-id`, …) also exist; we do not need them.

Notes:
- `http_headers` are static, so Codex cannot send a per-session `X-Recordare-Conversation` header. That is fine:
  commit `9a3f280` binds personal-token writes to the person's recent words from the same client when no
  conversation is named.
- MCP tools in the TUI may ask for approval depending on `default_tools_approval_mode` and the sandbox policy. For
  `codex exec`, set `default_tools_approval_mode = "approve"` or `"auto"`.

## 2. Turn hooks

### 2a. Legacy `notify` (still supported, marked for removal)
`notify = ["node", "/abs/path/recordare-codex.mjs"]` at the top level of `config.toml`. After each turn Codex spawns
the program and appends **one JSON argument** to argv. stdin, stdout and stderr are null, and nobody waits for the
process. Source: [`SRC/codex-rs/hooks/src/legacy_notify.rs`](https://github.com/openai/codex/blob/9b738582b13c2cdbeff54af0afd04c50c3e7ba09/codex-rs/hooks/src/legacy_notify.rs)
(it carries a `TODO: Remove this hook … when legacy notify support is removed`).

```json
{ "type": "agent-turn-complete", "thread-id": "b5f6c1c2-…", "turn-id": "12345", "cwd": "/Users/x/project",
  "client": "codex-tui", "input-messages": ["Rename `foo` to `bar` …"], "last-assistant-message": "Rename complete …" }
```

It gives a full turn (user input and answer) in one call and needs no trust step. It cannot inject context, and it is
deprecated, so use it only as a fallback.

### 2b. Lifecycle hooks (current, stable, default on)
Feature `hooks` is `Stage::Stable, default_enabled: true`
([`SRC/codex-rs/features/src/lib.rs`](https://github.com/openai/codex/blob/9b738582b13c2cdbeff54af0afd04c50c3e7ba09/codex-rs/features/src/lib.rs)).
`[features] hooks = false` turns hooks off (`codex_hooks` is the deprecated alias). Docs:
[Hooks](https://learn.chatgpt.com/docs/hooks).

**Where hooks are configured.** Each config layer can hold hooks: `~/.codex/hooks.json`, inline `[hooks]` tables in
`~/.codex/config.toml`, `<repo>/.codex/hooks.json` and `<repo>/.codex/config.toml`. Plugins can also bundle hooks in
`hooks/hooks.json`. The schema is the Claude Code one
([`SRC/codex-rs/config/src/hook_config.rs`](https://github.com/openai/codex/blob/9b738582b13c2cdbeff54af0afd04c50c3e7ba09/codex-rs/config/src/hook_config.rs)):

```json
{ "hooks": {
  "UserPromptSubmit": [ { "hooks": [ { "type": "command", "command": "node ~/.codex/recordare/recordare-hook.mjs", "timeout": 10 } ] } ],
  "Stop":             [ { "hooks": [ { "type": "command", "command": "node ~/.codex/recordare/recordare-hook.mjs", "timeout": 15 } ] } ],
  "SessionEnd":       [ { "hooks": [ { "type": "command", "command": "node ~/.codex/recordare/recordare-hook.mjs", "timeout": 3 } ] } ]
} }
```

**Events:** `PreToolUse`, `PermissionRequest`, `PostToolUse`, `PreCompact`, `PostCompact`, `SessionStart`, `SessionEnd`,
`UserPromptSubmit`, `SubagentStart`, `SubagentStop`, `Stop`, `Interrupt`.

**Handler fields.** `type` is `command` or `mcp_tool` (`prompt` and `agent` are parsed but unsupported). The other
fields are `command`, `commandWindows`, `timeout` (default 600 s; `SessionEnd`/`Interrupt` default to 1 s with a 3 s
cap), `async` (a background hook: up to 8 per session, never on `SessionEnd`, no control effects), `statusMessage` and
`additionalContextLimit` (≈ 2,500 tokens by default; when the text is longer, Codex spills it to
`<tmp>/hook_outputs/<session>/<uuid>.txt` and shows the model a head and tail preview). Commands run through
`$SHELL -lc`, with the session's environment snapshot and the payload on **stdin**.

**Payloads** (generated JSON schemas in
[`SRC/codex-rs/hooks/schema/generated/`](https://github.com/openai/codex/tree/9b738582b13c2cdbeff54af0afd04c50c3e7ba09/codex-rs/hooks/schema/generated)):

| Event | Input fields (stdin) |
|---|---|
| `UserPromptSubmit` | `session_id`, `turn_id`, `transcript_path` (nullable), `cwd`, `hook_event_name`, `model`, `permission_mode`, **`prompt`**, optional `agent_id`, `agent_type` (set for subagents) |
| `Stop` | `session_id`, `turn_id`, `transcript_path`, `cwd`, `hook_event_name`, `model`, `permission_mode`, `stop_hook_active`, **`last_assistant_message`** (nullable) |
| `SessionStart` | `session_id`, `transcript_path`, `cwd`, `hook_event_name`, `model`, `permission_mode`, `source` (`startup`, `resume`, `clear`, `compact`, `fork`) |
| `SessionEnd` | `session_id`, `transcript_path`, `cwd`, `hook_event_name`, `reason` (always `"other"`) |

`session_id` is the thread id, so it is stable for the conversation and survives `codex resume`.

**Context injection works.** A `UserPromptSubmit` hook can either print
`{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"…"}}` or print **plain text**: any
non-JSON stdout on exit 0 also becomes context. `SessionStart` can return `additionalContext` in the same way. Codex
records it as a **developer-role** message for the turn
([`SRC/codex-rs/core/src/context/hook_additional_context.rs`](https://github.com/openai/codex/blob/9b738582b13c2cdbeff54af0afd04c50c3e7ba09/codex-rs/core/src/context/hook_additional_context.rs)).
Exit code 2 with a reason on stderr, or `decision: "block"`, blocks the prompt. We never want that.

**Trust (the important difference from Claude Code).** User and project hooks, plugin hooks included, start as
`Untrusted` and **are skipped** until trusted
([`SRC/codex-rs/hooks/src/engine/discovery.rs`](https://github.com/openai/codex/blob/9b738582b13c2cdbeff54af0afd04c50c3e7ba09/codex-rs/hooks/src/engine/discovery.rs)).
There are three ways to trust them:
1. Interactively: run `/hooks` in the TUI to review and trust them. The docs recommend this.
2. Through config: `[hooks.state."<key>"] trusted_hash = "sha256:…"` in `~/.codex/config.toml`. `-c` session flags
   also work. The key is `<absolute source path>:<event_snake>:<group_index>:<handler_index>`, for example
   `/Users/x/.codex/hooks.json:user_prompt_submit:0:0`. The hash is
   `"sha256:" + hex(sha256(compact JSON with sorted keys of {"event_name": "<event_snake>", "matcher"?: …, "hooks": [normalized handler]}))`.
   The normalized handler is `{"type":"command","command":<raw command>,"timeout":<effective timeout>,"async":<bool>}`
   plus `statusMessage` and a non-default `additionalContextLimit` when they are set
   ([`SRC/codex-rs/config/src/fingerprint.rs`](https://github.com/openai/codex/blob/9b738582b13c2cdbeff54af0afd04c50c3e7ba09/codex-rs/config/src/fingerprint.rs)).
   I reproduced the fingerprint algorithm against Codex's own test vector. I have **not** checked the full identity
   against a running Codex. An installer could pre-trust its hooks this way, but the formula is internal and may
   change, so `/hooks` stays the documented path.
3. Per run: `--dangerously-bypass-hook-trust` (`codex` and `codex exec`). This is for the smoke test only.

Admins can set `allow_managed_hooks_only = true` in `requirements.toml`, which disables user hooks entirely.

## 3. Session transcripts (fallback capture)

Path: `$CODEX_HOME/sessions/YYYY/MM/DD/rollout-YYYY-MM-DDThh-mm-ss-<thread-uuid>.jsonl`. `CODEX_HOME` defaults to
`~/.codex`. A reverted thread appends `_<rollout-uuid>`. Older files may be compressed to **`.jsonl.zst`**, and archived
ones move to `archived_sessions/`
([`SRC/codex-rs/rollout/src/`](https://github.com/openai/codex/tree/9b738582b13c2cdbeff54af0afd04c50c3e7ba09/codex-rs/rollout/src)).
Each line is `{"timestamp": "...", "ordinal"?: n, "type": <item>, "payload": {...}}` with these item types:
`session_meta` (`id`, `session_id`, cwd, …), `response_item`, `turn_context`, `compacted`, `event_msg`, and others.
For capture, the useful items are `event_msg` with `payload.type = "user_message"` (`message`), `"agent_message"`
(`message`, `phase`) and `"task_complete"` (`turn_id`, `last_agent_message`). Hooks receive this file as
`transcript_path`. The format is internal and changes often, so use it only when `last_assistant_message` is null.
Note: this machine's `~/.codex` has **no `sessions/` directory**. Newer builds may keep state in SQLite
(`state_5.sqlite`, `logs_2.sqlite`) in some modes. I did not check this further.

## 4. Instructions and context options

- `AGENTS.md` (global `~/.codex/AGENTS.md`, per-repo files, `AGENTS.override.md`), `developer_instructions` (a
  developer message), `instructions`, `model_instructions_file` (formerly `experimental_instructions_file`; it
  replaces the built-in prompt, which is discouraged) and profiles. All of these are **static**, read at session start.
  None of them can carry a per-turn memory block.
- Per-turn memory is possible only through the **`UserPromptSubmit` hook** (§2b). For a session-level "who you are
  talking to" summary, a `SessionStart` hook can return `additionalContext`. A one-line note in `developer_instructions`
  or `AGENTS.md` can tell the model that the Recordare tools exist. That is optional, because MCP tool descriptions
  already cover it.
- Codex has its **own memory feature** (`[features] memories`, stable, off by default, stored in
  `~/.codex/memories_1.sqlite`). It is independent of Recordare. The README should say that the two can run side by
  side and that ours is the cross-platform one.

## 5. Licence

**Apache-2.0** (`LICENSE`; `NOTICE`: "OpenAI Codex, Copyright 2025 OpenAI", plus Ratatui under MIT). Apache-2.0 code may
be incorporated into an AGPL-3.0 work (it is compatible with GPLv3 and therefore with AGPLv3), so it is allowed by
`docs/LICENSING.md`. If we copy anything, keep the Apache notice and record it in `THIRD_PARTY_NOTICES.md`. In practice
we **need no Codex code**: the connector only uses its configuration and hook contracts.

## 6. Proposed design

### Files (`connectors/codex/`)
- `recordare-hook.mjs`: our Claude Code script, generalised. The payloads match, so the script can **be shared** with
  a client parameter (`node recordare-hook.mjs codex`). The Codex-specific changes are:
  - the channel and the conversation id `codex:<session_id>`, with the title from `basename(cwd)`;
  - **skip subagent events** (`agent_id` present) so that the person's memory is not polluted;
  - for `Stop`, use `last_assistant_message`; if it is null, take the last `agent_message` from the rollout at
    `transcript_path` (handling `.zst`, or skipping it);
  - `SessionEnd` has a 3 s cap, so it needs one short request with a 2.5 s timeout;
  - configuration comes from `RECORDARE_URL` / `RECORDARE_TOKEN`, falling back to a file
    `~/.config/recordare/codex.json` (mode 0600). The file avoids relying on the login shell's environment.
  - It stays best effort: always exit 0, never print anything except the context block.
- `hooks.json`: the three events above, with `UserPromptSubmit` (sync, 10 s), `Stop` (consider `"async": true` so the
  answer upload never delays the next prompt) and `SessionEnd` (3 s).
- `install.sh`: a one-liner, e.g.
  `curl -fsSL https://…/connectors/codex/install.sh | sh -s -- --url http://host:8090 --token rp_…`. It:
  1. copies the script to `~/.codex/recordare/` and writes `~/.config/recordare/codex.json` (0600);
  2. merges `hooks.json` into `~/.codex/hooks.json` (by matching our command, without overwriting the user's hooks);
  3. runs `codex mcp add recordare --url <url>/mcp --bearer-token-env-var RECORDARE_TOKEN` and tells the user to
     export `RECORDARE_TOKEN`. The alternative is to write `http_headers = { Authorization = "Bearer …" }`, which puts
     the token in `config.toml`; offer it as an option;
  4. tells the user to open `codex` and run **`/hooks` → trust** the three Recordare hooks. Pre-trusting with the hash
     formula from §2b could become an opt-in flag once it has been tested.
- Optional later step: a **Codex plugin**. Codex reads `.codex-plugin/plugin.json`, and also `.claude-plugin/plugin.json`
  and `.claude-plugin/marketplace.json`, so our existing marketplace may already be discoverable with
  `codex plugin marketplace add arkimedehq/recordare` + `codex plugin add recordare@recordare`. Plugin hooks get
  `PLUGIN_ROOT` / `CLAUDE_PLUGIN_ROOT`. However, Codex has **no `userConfig`**, so `${user_config.*}` in our Claude
  manifest would not expand. A dedicated `.codex-plugin/plugin.json` with an `.mcp.json` that uses
  `bearer_token_env_var` would be needed, and plugin hooks still need trust. This is unverified, so I would skip it
  for v0.1.

### Smoke test (non-interactive, isolated)
Codex now speaks **only the Responses API**: `wire_api = "chat"` is rejected (`SRC/codex-rs/model-provider-info/src/lib.rs`,
[discussion #7782](https://github.com/openai/codex/discussions/7782)). That means **DeepSeek (Chat Completions only, as
far as I know) and our spike gateway cannot be used directly**. There are three options:
1. Local Ollama, built-in provider `ollama` (Responses):
   `codex exec --oss --local-provider ollama -m qwen3:8b …`. This needs an Ollama version with `/v1/responses`. I did
   not verify which Ollama version is installed here.
2. A Responses-to-Chat proxy (e.g. LiteLLM) in front of DeepSeek, declared as
   `[model_providers.x] base_url = "http://localhost:4000/v1", env_key = "…", wire_api = "responses"`.
3. Cheapest and deterministic, good for CI: a ~50-line **mock Responses SSE server** in Node that always answers with
   one fixed message. Codex's own tests do the same. This needs no LLM cost and still tests both hooks end to end.

```sh
export CODEX_HOME=$(mktemp -d)            # never touch the user's ~/.codex
cp connectors/codex/hooks.json "$CODEX_HOME/hooks.json"
export RECORDARE_URL=http://localhost:8090 RECORDARE_TOKEN=rp_test…
codex exec --skip-git-repo-check --dangerously-bypass-hook-trust \
  -c 'model_provider="mock"' -c 'model_providers.mock.base_url="http://127.0.0.1:8799/v1"' \
  -c 'model_providers.mock.wire_api="responses"' -c 'model="mock"' \
  -c 'mcp_servers.recordare.url="http://localhost:8090/mcp"' \
  -c 'mcp_servers.recordare.bearer_token_env_var="RECORDARE_TOKEN"' \
  "My sister's name is Giulia."
# then assert in Recordare that conversation codex:<session> has the user and the assistant message
# (codex exec --json prints thread.started with the thread id), and run a second exec to check that the
# mock received the fenced memory block in a developer message.
```
`codex exec --json` prints JSONL events, so the test can read the thread id. Without the bypass flag, the hooks are
silently skipped: that is a good negative test of the trust behaviour.

## What I could not verify
- I did not run any Codex binary (none is installed here). Everything comes from source at `9b73858`, which is main and
  slightly ahead of the 0.161.0 tag, and from the docs.
- That the IDE extension and the desktop app run hooks the same way as the CLI, and how they show the trust prompt
  (the source suggests they share the core and `hooks/list`).
- The exact trust-hash identity for our handlers (only the fingerprint algorithm was checked).
- Whether this machine's Ollama serves `/v1/responses`, and whether DeepSeek offers a Responses endpoint.
- Whether the existing `.claude-plugin` marketplace installs cleanly through `codex plugin`.
- Why this machine's `~/.codex` has no `sessions/` directory (possibly the app with SQLite state).
