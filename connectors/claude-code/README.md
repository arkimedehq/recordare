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

Nothing is processed until the Recordare admin switched your consent on. The hooks never block Claude Code: if
Recordare is down, the turn goes on without memory.

## Install

1. Ask the Recordare admin for a **personal token** with the scopes `mcp`, `ingest` and `read` (admin console →
   your person → tokens, client of kind `mcp_client`; or `POST api/v1/admin/owners/{id}/tokens`).
2. In Claude Code:
   ```
   /plugin marketplace add arkimedehq/recordare
   /plugin install recordare@recordare
   ```
   Claude Code asks for the plugin options: **url** (e.g. `http://localhost:8090`) and **token** (stored in the
   system keychain).
3. Requires Node.js ≥ 18 on the PATH (the hooks are a small dependency-free script).

Alternative to the options (e.g. for `claude -p` or CI): `RECORDARE_URL` and `RECORDARE_TOKEN` in the environment are
used by the hooks; the MCP tools need the plugin options.

## How it maps

| Claude Code | Recordare |
|---|---|
| session | conversation `claude-code:<session id>` (channel `claude-code`, title = project folder) |
| your prompt / Claude's answer | messages `user` / `assistant` (tool calls and sub-agents are not sent) |
| end of session | `conversationEnded` → extraction now instead of after the idle delay |

Test without installing: `RECORDARE_URL=… RECORDARE_TOKEN=rp_… claude -p --plugin-dir connectors/claude-code "…"`.

Licence: AGPL-3.0-or-later, like Recordare.
