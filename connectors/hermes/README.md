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
  the memory and the conversation — neither the model nor the user can point them elsewhere). `log_episode` is left
  out: the conversation is already captured.
- **One memory for the agent** (D50): the Hermes agent has one memory; the gateway users who talk to it (Telegram,
  Discord, … — `user_id`, `user_name`, platform, and each turn's author in shared sessions) are **participants**
  recognised inside it: each `<platform>:<user id>` becomes a contact of the memory, named after them. You, the account
  holder, are the memory's "I". One memory per gateway user stays available (`RECORDARE_MEMORY_PER=user`).

It is Hermes' one external memory provider (`memory.provider: recordare`); the built-in `MEMORY.md` / `USER.md` store
keeps working beside it. Recordare stores every turn the provider sends (it has no consent flag, D50). The provider
never breaks a turn: every call is time-boxed, failures are logged without content, and captured messages wait in a
small SQLite outbox (`$HERMES_HOME/recordare_outbox.db`) that retries with back-off, honours `Retry-After` and survives
restarts (messages keep their ids, so a re-send is stored once).

Tested with Hermes Agent v0.21.6. Pure Python, only `requests` (a Hermes dependency).

## Install

1. Ask the Recordare admin for a credential for the agent's memory:
   - a **personal token** with the scopes `mcp`, `ingest`, `read` (`POST api/v1/admin/owners/{id}/tokens`, client of
     kind `mcp_client`) — the token's memory is the agent's;
   - or a **client key** with the same scopes and a fixed `RECORDARE_USER` (the agent's account: a client user, bound by
     the admin with `POST api/v1/admin/identities` or auto-provisioned if the client allows it); a client key is also
     what one memory per gateway user needs.

   The memory's **mode** and **gender** are set by the admin (`PATCH api/v1/admin/owners/{id}` `{mode, gender}`), or
   with a client key by `PATCH api/v1/me`: `personal` (your own assistant: you are "I", what arrives undeclared is
   yours) or `entity` (an agent shared by a family, a team, a place: what arrives undeclared is "someone"'s); `gender`
   `masculine` (default) | `feminine` | `neutral` for the first person in gendered languages. The provider has no
   setting for them.
2. Install the provider from the public repository with
   `hermes plugins install arkimedehq/recordare/connectors/hermes/recordare` (not tested yet), or copy it into the
   profile's plugins:
   ```
   cp -r connectors/hermes/recordare "$HERMES_HOME/plugins/recordare"     # default HERMES_HOME: ~/.hermes
   ```
3. Configure it in `$HERMES_HOME/.env`:
   ```
   RECORDARE_URL=http://localhost:8080
   RECORDARE_API_KEY=rp_…            # or rk_… (client key) with RECORDARE_USER=<the agent's account>
   RECORDARE_SELF_IDS=telegram:123456789   # your own gateway ids: you are the memory's "I"
   ```
   and activate it: `hermes config set memory.provider recordare` (or `hermes memory setup`). Check with
   `hermes memory status`.

### Options

Environment (`$HERMES_HOME/.env`) first, then `memory.recordare.<key>` in `config.yaml` for the non-secret ones.

| Env | `memory.recordare.` | Default | Meaning |
|---|---|---|---|
| `RECORDARE_URL` | `url` | — | Recordare's address |
| `RECORDARE_API_KEY` | — | — | Personal token (`rp_…`) or client key (`rk_…`); env only |
| `RECORDARE_MEMORY_PER` | `memory_per` | `agent` | `agent`: one memory for the agent, gateway users are participants of it. `user`: one memory per gateway user |
| `RECORDARE_USER` | `user` | — | Client key. `agent`: the agent's Recordare account (required: without it the provider stays off). `user`: the Recordare user of turns without a gateway user (CLI, desktop, ACP) |
| `RECORDARE_SELF_IDS` | `self_ids` | — | `agent`: your own `<platform>:<user id>` ids (comma-separated or a JSON list) — the memory's "I". Turns without a gateway user (CLI) are always yours |
| `RECORDARE_USER_ALIASES` | `user_aliases` | `{}` | JSON `{"<platform>:<user id>": "<id>"}`. `agent`: one id for a person across platforms (their participant identity becomes the client user id `<id>`: one contact; the account's own id is you). `user`: their Recordare user |
| `RECORDARE_RECALL` | `recall` | `true` | Return the memory context before each turn |
| `RECORDARE_TOOLS` | `tools` | `true` | Offer the `recordare_*` tools |
| `RECORDARE_CAPTURE` | `capture` | `true` | Send the conversations |
| `RECORDARE_TIMEOUT` | `timeout` | `3` | Seconds for the context request (Hermes stops waiting at 8) |

**Who is who — memory per agent (default).** Every turn goes to the agent's memory (the token's, or `RECORDARE_USER`).
The person speaking is the turn's author (`author_id` / `author_name`, shared sessions) or the session's gateway user:
`<platform>:<user_id_alt or user_id>` (e.g. `telegram:123456789`). Listed in `RECORDARE_SELF_IDS`, or without a gateway
user (CLI): the account holder — message `user`. Anyone else: a participant with the channel identity
`{channel: <platform>, externalId: <user id>}` (or `{externalUserId: <alias>}`) and their name, message `other` with
that author — Recordare links it to a contact of the memory, created on first sight, so what they say about themselves
never becomes a fact about you. Recordare answers with the whole memory in every conversation (D50): what one person
told the agent can come up with another; whoever runs the agent tells the people who talk to it.

**Memory per user (`RECORDARE_MEMORY_PER=user`, the behaviour before D50).** With a client key the person is
`<platform>:<user_id_alt or user_id>`, through `RECORDARE_USER_ALIASES` when mapped; turns without a gateway user use
`RECORDARE_USER`, and without one the provider stays off. With a personal token every turn belongs to the token's
person — unless an alias map is set: then only the mapped gateway users are remembered and everyone else writing to the
same bot is left out. Upgrading with an alias map: add `RECORDARE_MEMORY_PER=user` to keep this.

## How it maps

| Hermes | Recordare |
|---|---|
| session lineage (`gateway_session_key` or platform + first session id) | conversation `hermes:<gateway_session_key or platform>/<session id>` (channel `hermes:<platform>`, title = session title or chat name); kept across context compression and `--resume`, new on `/new` / `/reset` |
| the agent (`RECORDARE_USER` or the token) — memory per user: `user_id_alt` / `user_id` (+ aliases), or `RECORDARE_USER` | the memory (`X-Recordare-User` with a client key; the token's memory otherwise) |
| the turn's author / the session's gateway user (memory per agent) | the account holder (`RECORDARE_SELF_IDS`, CLI): participant `owner` (with `user_name`); anyone else: participant `<platform>:<user id>` with its identity and name |
| the person's message (`on_turn_start`, then `prefetch`) | message `user` (account holder) or `other` with its author, id `<session id>:<turn id>:u`, queued at turn start and stored **before** the agent runs (so what the agent stores with `recordare_remember` binds to the person's own words): by `prefetch` in the same call as the memory context; right away when recall is off; before any memory tool call when `prefetch` could not store it |
| the agent's answer (`sync_turn`, background) | message `assistant`, id `<session id>:<turn id>:a` (tool calls and results are not sent) |
| session end (`on_session_end`, `on_session_switch(reset)`) | `POST api/v1/ingest/conversations/{id}/end`, queued after every pending message of the conversation → extraction now |
| `prefetch` | `POST api/v1/context {query, ingest?}` (`ingest` = the turn's queued message) → the block **without** Recordare's fence (Hermes adds its own) |
| `recordare_*` tools | Recordare's MCP endpoint (`/mcp`, Streamable HTTP) with the user and conversation headers; one MCP session per memory |
| cron and sub-agent runs (`agent_context` ≠ `primary`) | not captured (recall and tools still work) |
| shared rooms (`group_sessions_per_user: false`) | memory per agent: each turn attributed to its author (a participant); memory per user: turns written by someone other than the session's person are neither captured nor answered from memory |

Every read carries `X-Recordare-Conversation`; with a personal token a conversation Recordare has not stored yet counts
as the person's own.

## Tests

- Unit tests (fake Recordare, stdlib only; need Hermes importable):
  `<hermes venv>/bin/python -m unittest discover -s connectors/hermes/tests`.
- End to end against a local Recordare: `SMOKE_DIR=<scratch dir> connectors/hermes/smoke.sh` installs Hermes from source
  into a venv under `SMOKE_DIR` (or uses `HERMES_BIN`), with a throwaway `HERMES_HOME` and `HOME` there; three LLM turns
  through `hermes -z` (capture, session end and extraction, recall in a new session, a memory tool), then the gateway
  path with a client key (memory per agent, a second Telegram user stored as a participant) driven by Hermes' own
  `MemoryManager` without an LLM (`SKIP_LLM=1` runs only this part). See
  the header of [smoke.sh](smoke.sh).

Licence: AGPL-3.0-or-later, like Recordare.
