# Recordare for Claude Code

A Claude Code plugin that gives Claude a long-term episodic memory kept by your own
[Recordare](../../README.md) service — the **full** client level:

- **Capture**: every prompt and every answer go to Recordare (`UserPromptSubmit` and `Stop` hooks); at the end of the
  session Recordare extracts what happened, plans, facts and notes (`SessionEnd`).
- **Recall before each prompt**: the memories relevant to what you just wrote are added to the turn as a fenced
  `<memory-context>` block (`POST api/v1/context`, no LLM call, nothing added when nothing is relevant).
- **Memory tools** (MCP): `search_episodes`, `search_memory`, `resolve_period`, `log_episode`, `remember`,
  `correct_episode`, `forget_episode`. What the agent writes counts as yours only when your own recent words say it
  (otherwise it waits for your confirmation in the diary).

Recordare stores every turn the hooks send (it has no consent flag, D50): to stop, disable the plugin. The hooks never
block Claude Code: if Recordare is down, the turn goes on without memory.

**Whose memory** (D50): the personal token opens one memory — your agent's, where you are "I" (a `personal` memory:
you are both its user and its agent). The same memory can serve your other agents (another
token or client). Its mode and the gender of its first person are set by the admin
(`PATCH api/v1/admin/memories/{id}` `{mode, gender}`; `gender` `masculine` by default, `feminine`, `neutral`); the plugin
has no setting for them.

## Install

1. Ask the Recordare admin for a **personal token** with the scopes `mcp`, `ingest` and `read` (admin console →
   your memory → tokens, client of kind `mcp_client`; or `POST api/v1/admin/memories/{id}/tokens`).
2. In Claude Code:
   ```
   /plugin marketplace add arkimedehq/recordare
   /plugin install recordare@recordare
   ```
   Claude Code asks for the plugin options: **url** (e.g. `http://localhost:8090`) and **token** (stored in the
   system keychain).
3. Requires Node.js ≥ 18 on the PATH (the hooks are a small dependency-free script).

Alternative to the options (e.g. for `claude -p` or CI): `RECORDARE_URL` and `RECORDARE_TOKEN` in the environment, or
the file `~/.config/recordare/claude-code.json` (`{"url", "token"}`, mode 600), are used by the hooks; the MCP tools
need the plugin options.

## How it maps

| Claude Code | Recordare |
|---|---|
| session | conversation `claude-code:<session id>` (channel `claude-code`, title = project folder) |
| your prompt / Claude's answer | messages `user` / `assistant` (tool calls and sub-agents are not sent) |
| end of session | `POST …/conversations/{id}/end` → extraction now instead of after the idle delay |

The hook script (`scripts/recordare-hook.mjs`) is shared with the [Codex connector](../codex/README.md); the two copies
must stay byte-identical (`connectors/check-shared.sh`, run in CI): edit one, copy it to the other.

Test without installing: `RECORDARE_URL=… RECORDARE_TOKEN=rp_… claude -p --plugin-dir connectors/claude-code "…"`.

Licence: AGPL-3.0-or-later, like Recordare.
