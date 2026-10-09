# Recordare for OpenAI Codex

Gives Codex (CLI; the IDE extension and the desktop app share its core and configuration) a long-term episodic memory
kept by your own [Recordare](../../README.md) service — the **full** client level:

- **Capture**: every prompt and every answer go to Recordare (`UserPromptSubmit` and `Stop` hooks); when the session
  ends Recordare extracts what happened, plans, facts and notes (`SessionEnd`).
- **Recall before each prompt**: the memories relevant to what you just wrote are added to the turn as a fenced
  `<memory-context>` block, which Codex gives the model as a developer message (`POST api/v1/context`, no LLM call,
  nothing added when nothing is relevant).
- **Memory tools** (MCP): `search_episodes`, `search_memory`, `resolve_period`, `log_episode`, `remember`,
  `correct_episode`, `forget_episode`. What the agent writes counts as yours only when your own recent words say it
  (otherwise it waits for your confirmation in the diary).

Recordare stores every turn the hooks send (it has no consent flag, D50): to stop, disable the plugin. The hooks never
block Codex: if Recordare is down, the turn goes on without memory.

## Install

1. Ask the Recordare admin for a **personal token** with the scopes `mcp`, `ingest` and `read` (admin console → your
   person → tokens, client of kind `mcp_client`; or `POST api/v1/admin/owners/{id}/tokens`).
2. Run the installer (Node.js ≥ 18 on the PATH; no sudo). From a checkout:
   ```sh
   connectors/codex/install.sh --url http://localhost:8090
   ```
   or without one:
   ```sh
   curl -fsSL https://raw.githubusercontent.com/arkimedehq/recordare/main/connectors/codex/install.sh | bash -s -- --url http://localhost:8090
   ```
   It asks for the token (hidden input; or set `RECORDARE_TOKEN` in the environment — the token is never accepted as
   an argument, so it stays out of the shell history), checks it against `GET api/v1/me`, and is safe to run again.
3. **Trust the hooks.** Codex runs a new user hook only after you trust it: open `codex`, type **`/hooks`** and trust
   the three Recordare hooks. Until then nothing is captured or recalled (the MCP tools work regardless).
   `install.sh --trust` (or `RECORDARE_TRUST_HOOKS=1`) records the trust in `config.toml` instead; it uses Codex's
   internal hook-hash format (verified with Codex 0.161.0), so if a later Codex version shows them as untrusted again,
   trust them in `/hooks`.
4. Check: `codex mcp list` shows `recordare`; after a short session the conversation appears in the Recordare console.

Remove everything: `connectors/codex/install.sh uninstall`.

## What the installer writes

Each file it edits is first backed up as `<file>.bak-<timestamp>`.

| File | Content |
|---|---|
| `~/.config/recordare/codex.json` (mode 600) | `{"url", "token"}` — read by the hooks and by the MCP headers helper (`XDG_CONFIG_HOME` respected) |
| `$CODEX_HOME/recordare/recordare-hook.mjs` | the hook script (`CODEX_HOME` defaults to `~/.codex`) |
| `$CODEX_HOME/hooks.json` | three handlers `node "…/recordare-hook.mjs" codex`: `UserPromptSubmit` (10 s), `Stop` (15 s), `SessionEnd` (3 s, Codex's cap); your other hooks are kept |
| `$CODEX_HOME/config.toml` | a marked block (`# >>> recordare` … `# <<< recordare`) with `[mcp_servers.recordare]`: `url = "<url>/mcp"` and `http_headers_helper`, which prints the `Authorization` header from `codex.json` — the token is not stored in `config.toml`; with `--trust`, the `[hooks.state."…"]` entries too |

The installer writes the MCP block itself because `codex mcp add` cannot set a headers helper. An existing
`[mcp_servers.recordare]` table it did not write is removed first with `codex mcp remove recordare`.

**Configuration.** The hook script reads `RECORDARE_URL` / `RECORDARE_TOKEN` from the environment first, then
`~/.config/recordare/codex.json`. Alternative for the MCP server if you prefer an environment variable to the helper:
`bearer_token_env_var = "RECORDARE_TOKEN"` in the table (then `RECORDARE_TOKEN` must be set wherever Codex starts,
including the IDE and the app).

## How it maps

| Codex | Recordare |
|---|---|
| session (thread; survives `codex resume`) | conversation `codex:<session id>` (channel `codex`, title = project folder) |
| your prompt / Codex's answer | messages `user` / `assistant` (`last_assistant_message`; when empty, the last agent message of the rollout file). Tool calls are not sent |
| sub-agent turns (payload with `agent_id`) | not sent |
| end of session (`SessionEnd`) | `POST …/conversations/{id}/end` → extraction now instead of after the idle delay |

The hook script is the same file as the Claude Code connector's (`node recordare-hook.mjs codex`); the two copies are
kept byte-identical by `connectors/check-shared.sh`, run in CI.

## Limits

- Hooks run only once trusted (step 3); admins can disable user hooks entirely (`allow_managed_hooks_only` in
  `requirements.toml`).
- `SessionEnd` has a 3 s cap in Codex: if Recordare does not answer within 2.5 s the end hint is lost and extraction
  happens after the idle delay instead. A session that never ends cleanly behaves the same way.
- Compressed rollouts (`.jsonl.zst`) are not read; they only matter when Codex sends an empty `last_assistant_message`.
- Codex has its own memory feature (`[features] memories`); it is independent of Recordare and both can run side by
  side. Recordare is the one shared across your platforms.
- Verified with the Codex CLI 0.161.0; the IDE extension and the desktop app were not tested.

## Smoke test without a paid model

`test/mock-responses.mjs` is a tiny mock of the OpenAI Responses API (Codex speaks only that API) that always gives
the same answer and logs every request, so you can check that the `<memory-context>` block reached the model:

```sh
node connectors/codex/test/mock-responses.mjs 8799 /tmp/mock-requests.jsonl &
T=$(mktemp -d); export HOME=$T CODEX_HOME=$T/.codex     # never your real ~/.codex
RECORDARE_URL=http://localhost:8090 RECORDARE_TOKEN=rp_… connectors/codex/install.sh --trust
codex exec --json --skip-git-repo-check \
  -c 'model_provider="mock"' -c 'model_providers.mock.name="mock"' \
  -c 'model_providers.mock.base_url="http://127.0.0.1:8799/v1"' -c 'model_providers.mock.wire_api="responses"' \
  -c 'model="mock-model"' "My sister's name is Giulia." </dev/null
```

`--dangerously-bypass-hook-trust` runs untrusted hooks for one invocation.

Licence: AGPL-3.0-or-later, like Recordare.
