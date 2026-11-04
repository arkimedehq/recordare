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
(`PATCH api/v1/admin/memories/{id}` `{mode, gender}`; `gender` `masculine` by default, `feminine`, `neutral`) or with the
personal token itself, if it has the `ingest` scope (`PATCH api/v1/me {mode?, gender?}`; the mode only while the memory
is empty); the plugin has no setting for them.

## Memory-first contract (D54)

- **The charter at session start**: a `SessionStart` hook reads the memory charter (`GET api/v1/charter`: how the agent
  uses its memory — its own mind, searched before other tools and before saying it does not know) and adds it as context
  for the whole session, the closest the hooks get to the system prompt; it runs again after `/clear` and a compaction.
  The MCP server sends the same charter as its `instructions`, which Claude Code also puts in the system prompt: the
  hook keeps it there when the MCP server is not connected.
- **The memory context before every prompt**, opened by the self card (who I am; on by default in Recordare). A short
  follow-up ("and him?") is matched with the previous turn by Recordare itself.
- **Initiatives in the turn** (Recordare 0.7.0, D55): the memory context also carries what the agent meant to tell or
  ask whoever is talking — a reminder they asked for, "how did it go?", "did you hang the laundry?" — offered once,
  with no setup; the memory charter (`charter.v2`) says how to use it.
- **Fallback**: if Recordare does not answer, no charter and no block — the session and the turn go on without memory.

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
| start of session (also after `/clear`, a compaction) | `GET api/v1/charter` → the memory charter as session context (D54) |
| end of session | `POST …/conversations/{id}/end` → extraction now instead of after the idle delay |

The hook script (`scripts/recordare-hook.mjs`) is shared with the [Codex connector](../codex/README.md); the two copies
must stay byte-identical (`connectors/check-shared.sh`, run in CI): edit one, copy it to the other.

Unit tests of the hook script: `node --test connectors/codex/test/hook.test.mjs` (the Codex copy is the same file).
Test without installing: `RECORDARE_URL=… RECORDARE_TOKEN=rp_… claude -p --plugin-dir connectors/claude-code "…"`.

Licence: AGPL-3.0-or-later, like Recordare.
