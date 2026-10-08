# Recordare for Hermes Agent

A [Hermes Agent](https://github.com/NousResearch/hermes-agent) memory provider that gives the agent a long-term episodic
memory kept by your own [Recordare](../../README.md) service — the **full** client level:

- **Capture**: each message a person sends and each answer of the agent go to Recordare; when the Hermes session ends
  (`/new`, `/reset`, exit) Recordare extracts what happened, plans, facts and notes right away instead of after its idle
  delay.
- **Recall before each turn**: one call stores the message and returns the memories relevant to it
  (`POST api/v1/context` with `ingest`, no LLM call, nothing when nothing is relevant); Hermes adds them to the turn
  inside its own `<memory-context>` block.
- **Memory tools**: `recordare_search_episodes`, `recordare_search_memory`, `recordare_resolve_period`,
  `recordare_remember`, `recordare_correct_episode`, `recordare_forget_episode` (Recordare's MCP tools, bound in code to
  the person and the conversation — neither the model nor the user can point them elsewhere). `log_episode` is left out:
  the conversation is already captured.

It is Hermes' one external memory provider (`memory.provider: recordare`); the built-in `MEMORY.md` / `USER.md` store
keeps working beside it. Nothing is stored until the Recordare admin switched the person's consent on. The provider
never breaks a turn: every call is time-boxed, failures are logged without content, and captured messages wait in a
small SQLite outbox (`$HERMES_HOME/recordare_outbox.db`) that retries with back-off, honours `Retry-After` and survives
restarts (messages keep their ids, so a re-send is stored once).

Tested with Hermes Agent v0.21.6. Pure Python, only `requests` (a Hermes dependency).

## Install

1. Ask the Recordare admin for a credential:
   - **one person** (your own assistant): a **personal token** with the scopes `mcp`, `ingest`, `read`
     (`POST api/v1/admin/owners/{id}/tokens`, client of kind `mcp_client`);
   - **several people** (a gateway: Telegram, Discord, …): a **client key** with the same scopes; each person is a
     client user (`X-Recordare-User`), bound by the admin (`POST api/v1/admin/identities`) or auto-provisioned if the
     client allows it.
2. Install the provider from the public repository with
   `hermes plugins install arkimedehq/recordare/connectors/hermes/recordare` (not tested yet), or copy it into the
   profile's plugins:
   ```
   cp -r connectors/hermes/recordare "$HERMES_HOME/plugins/recordare"     # default HERMES_HOME: ~/.hermes
   ```
3. Configure it in `$HERMES_HOME/.env`:
   ```
   RECORDARE_URL=http://localhost:8080
   RECORDARE_API_KEY=rp_…            # or rk_… (client key)
   ```
   and activate it: `hermes config set memory.provider recordare` (or `hermes memory setup`). Check with
   `hermes memory status`.

### Options

Environment (`$HERMES_HOME/.env`) first, then `memory.recordare.<key>` in `config.yaml` for the non-secret ones.

| Env | `memory.recordare.` | Default | Meaning |
|---|---|---|---|
| `RECORDARE_URL` | `url` | — | Recordare's address |
| `RECORDARE_API_KEY` | — | — | Personal token (`rp_…`) or client key (`rk_…`); env only |
| `RECORDARE_USER` | `user` | — | Client key: the Recordare user of turns without a gateway user (CLI, desktop, ACP) |
| `RECORDARE_USER_ALIASES` | `user_aliases` | `{}` | JSON `{"<platform>:<user id>": "<Recordare user>"}` |
| `RECORDARE_RECALL` | `recall` | `true` | Return the memory context before each turn |
| `RECORDARE_TOOLS` | `tools` | `true` | Offer the `recordare_*` tools |
| `RECORDARE_CAPTURE` | `capture` | `true` | Send the conversations |
| `RECORDARE_TIMEOUT` | `timeout` | `3` | Seconds for the context request (Hermes stops waiting at 8) |

**Who is who.** With a **client key** the person is `<platform>:<user_id_alt or user_id>` (e.g. `telegram:123456789`),
through `RECORDARE_USER_ALIASES` when mapped; turns without a gateway user use `RECORDARE_USER`, and without one the
provider stays off. With a **personal token** every turn belongs to the token's person — unless an alias map is set:
then only the mapped gateway users are remembered and everyone else writing to the same bot is left out.

## How it maps

| Hermes | Recordare |
|---|---|
| session lineage (`gateway_session_key` or platform + first session id) | conversation `hermes:<gateway_session_key or platform>/<session id>` (channel `hermes:<platform>`, title = session title or chat name); kept across context compression and `--resume`, new on `/new` / `/reset` |
| `user_id_alt` / `user_id` (+ aliases), or `RECORDARE_USER` | the user (`X-Recordare-User` with a client key; the token's person otherwise) |
| the person's message (`on_turn_start`, then `prefetch`) | message `user`, id `<session id>:<turn id>:u`, queued at turn start and stored **before** the agent runs (so what the agent stores with `recordare_remember` binds to the person's own words): by `prefetch` in the same call as the memory context; right away when recall is off; before any memory tool call when `prefetch` could not store it |
| the agent's answer (`sync_turn`, background) | message `assistant`, id `<session id>:<turn id>:a` (tool calls and results are not sent) |
| session end (`on_session_end`, `on_session_switch(reset)`) | `POST api/v1/ingest/conversations/{id}/end`, queued after every pending message of the conversation → extraction now |
| `prefetch` | `POST api/v1/context {query, ingest?}` (`ingest` = the turn's queued message) → the block **without** Recordare's fence (Hermes adds its own) |
| `recordare_*` tools | Recordare's MCP endpoint (`/mcp`, Streamable HTTP) with the user and conversation headers; one MCP session per person |
| cron and sub-agent runs (`agent_context` ≠ `primary`) | not captured (recall and tools still work) |
| shared rooms (`group_sessions_per_user: false`) | turns written by someone other than the session's person are neither captured nor answered from memory |

Every read carries `X-Recordare-Conversation`; with a personal token a conversation Recordare has not stored yet counts
as the person's own.

## Tests

- Unit tests (fake Recordare, stdlib only; need Hermes importable):
  `<hermes venv>/bin/python -m unittest discover -s connectors/hermes/tests`.
- End to end against a local Recordare: `SMOKE_DIR=<scratch dir> connectors/hermes/smoke.sh` installs Hermes from source
  into a venv under `SMOKE_DIR` (or uses `HERMES_BIN`), with a throwaway `HERMES_HOME` and `HOME` there; three LLM turns
  through `hermes -z` (capture, session end and extraction, recall in a new session, a memory tool), then the gateway
  path with a client key driven by Hermes' own `MemoryManager` without an LLM (`SKIP_LLM=1` runs only this part). See
  the header of [smoke.sh](smoke.sh).

Licence: AGPL-3.0-or-later, like Recordare.
