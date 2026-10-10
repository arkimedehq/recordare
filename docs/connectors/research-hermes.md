# Hermes Agent connector — research (2026-10-08)

Sources checked on 2026-10-08: [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) at `main`
commit `25a71a7` (= `v0.21.6-130`; latest release **v0.21.6**, 2026-10-08; previous v0.21.5 / tag `v2026.9.24`).
`pyproject.toml` says `version = "0.0.0"` (versions come from tags); `requires-python = ">=3.11,<3.15"` (the Docker
image runs Python 3.14). File paths below are relative to that repo.

## 1. Memory provider interface

**ABC**: `agent.memory_provider.MemoryProvider` ([agent/memory_provider.py](https://github.com/NousResearch/hermes-agent/blob/main/agent/memory_provider.py));
guide: [developer-guide/memory-provider-plugin.md](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/memory-provider-plugin.md).
Driven by `agent.memory_manager.MemoryManager`: the built-in store (MEMORY.md / USER.md) is always on, plus **at most
one** external provider, selected by name in `config.yaml` → `memory.provider`.

| Method | Required | When / contract |
|---|---|---|
| `name` (property) | yes | provider id (= `memory.provider` value) |
| `is_available()` | yes | config / deps only, **no network** |
| `initialize(session_id, **kwargs)` | yes | once at agent start; kwargs below (§3) |
| `get_tool_schemas()` | yes | OpenAI function schemas `{name, description, parameters}`; `[]` if none |
| `handle_tool_call(tool_name, args, **kwargs)` | if tools | must return a JSON string |
| `system_prompt_block()` | no | static text only |
| `prefetch(query, *, session_id)` | no | called **synchronously before the tool loop** of each turn (skipped for trivial prompts: `is_trivial_prompt`, e.g. "ok", "/cmd"); bounded by `_EXTERNAL_PREFETCH_TIMEOUT_S = 8.0` s, after a timeout the provider is skipped until the stuck call returns |
| `queue_prefetch(query, *, session_id)` | no | after each turn — pre-warm a cache that `prefetch()` consumes next turn |
| `sync_turn(user, assistant, *, session_id, messages=None, turn_author=None)` | no | after each **completed** turn (interrupted turns are skipped), on a single-worker background executor; must be non-blocking. `messages` = OpenAI-style list incl. tool calls / results; `turn_author` = `{id, name, is_bot}` (only passed if the signature accepts it) |
| `on_turn_start(turn_number, message, **kw)` | no | kw: `remaining_tokens, model, platform, tool_count, author_id, author_name, author_is_bot` |
| `on_session_end(messages)` | no | real session boundaries only (/new, compression rotation, exit) |
| `on_session_switch(new_session_id, *, parent_session_id, reset, rewound)` | no | /resume, /branch, /reset, /new, compression; `reset=True` only for a genuinely new conversation |
| `on_pre_compress(messages)` | no | before lossy compression (opt-in fail-closed v2 checkpoint API) |
| `on_memory_write(action, target, content, metadata)` | no | mirror of built-in memory tool writes (add / replace / remove) |
| `on_delegation(task, result, …)` | no | parent-side view of a subagent run |
| `get_config_schema()` / `save_config(values, hermes_home)` | yes* | fields for `hermes memory setup`; `secret`+`env_var` go to `$HERMES_HOME/.env`; *env-only providers may keep the no-op `save_config` |
| `identity_signature()` | no | values that must bust a cached gateway agent when they change |
| `shutdown()`, `backup_paths()`, `recall_status()`, `unavailable_reason()` | no | flush / backup / recall indicator / setup hint |

How recall is injected ([agent/turn_context.py](https://github.com/NousResearch/hermes-agent/blob/main/agent/turn_context.py),
`build_memory_context_block` in `agent/memory_manager.py`): the prefetch string is wrapped by **Hermes** in
`<memory-context>…</memory-context>` with a system note and **appended to the current user message** (`api_content`
sidecar, replayed byte-stable on later turns for prompt caching) — not to the system prompt. If the provider returns an
already-fenced block Hermes strips the tags and logs `memory provider returned pre-wrapped context; stripped`. Results
above `hooks.output_spill` (10 000 chars default) are spilled to a file with a preview.

Threading: background work must use `agent.memory_provider.spawn_context_thread` (profile `HERMES_HOME` and the
secret scope live in contextvars); secrets via `agent.secret_scope.get_secret(name)`, never raw `os.environ` (multiplexed
profiles).

**Discovery / install** ([plugins/memory/\_\_init\_\_.py](https://github.com/NousResearch/hermes-agent/blob/main/plugins/memory/__init__.py)),
first source wins on a name clash:
1. bundled `plugins/memory/<name>/` — **closed to new providers** (CONTRIBUTING);
2. user `$HERMES_HOME/plugins/<name>/` (per profile) — what `hermes plugins install owner/repo[/subdir] [--ref <sha>]
   [--enable]` produces (subdirectory installs download only that folder);
3. project `./.hermes/plugins/<name>/` (only with `HERMES_ENABLE_PROJECT_PLUGINS=1`);
4. pip entry point group `hermes_agent.memory_providers` (`my-provider = "my_provider:register"`) — the docs discourage
   pip-injecting into a PM-managed install; meant for self-managed builds (Nix).

The directory's `__init__.py` must define `register(ctx)` calling `ctx.register_memory_provider(Provider())` (or a
top-level `MemoryProvider` subclass). Activation: `hermes config set memory.provider <name>` or `hermes memory setup`.
Python deps: `pyproject.toml [project] dependencies` or `pip_dependencies` in `plugin.yaml`. With
`plugins.isolation: host` user plugins run in a separate plugin-host process (no change needed for an HTTP-only
provider). Curated third-party plugins are listed in [`plugin-catalog/`](https://github.com/NousResearch/hermes-agent/tree/main/plugin-catalog)
(PR-reviewed, exact SHA pins, declared capabilities, security scan).

Status of the providers named in the task: **Honcho, Mem0, Supermemory, Hindsight, OpenViking moved out of core** to the
catalog (`plugin-catalog/{honcho,mem0,supermemory,hindsight,openviking}.yaml`); still bundled: `byterover`,
`holographic`, `retaindb`.

Layout of an existing provider — bundled RetainDB ([plugins/memory/retaindb](https://github.com/NousResearch/hermes-agent/tree/main/plugins/memory/retaindb)),
an HTTP cloud API with a durable SQLite write queue (closest to what we need):
```
plugins/memory/retaindb/
├── __init__.py   # RetainDBMemoryProvider(MemoryProvider) + _Client (requests) + _WriteQueue (SQLite outbox
│                 #   at $HERMES_HOME/retaindb_queue.db, replayed on start) + register(ctx)
├── plugin.yaml   # name, version, description, requires_env: [RETAINDB_API_KEY]
└── README.md
```
Catalog example with the richer layout: [supermemoryai/hermes-supermemory](https://github.com/supermemoryai/hermes-supermemory)
(`__init__.py`, `plugin.yaml` with `pip_dependencies`, `pyproject.toml`); Honcho
([plastic-labs/honcho/hermes-plugin-honcho](https://github.com/plastic-labs/honcho/tree/main/hermes-plugin-honcho))
adds `cli.py` (`register_cli` → `hermes honcho …`), `config_schema.py` (dashboard panel), `tool_schemas.py`.

## 2. Native MCP

Docs: [user-guide/features/mcp.md](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/mcp.md).
Built in (no extra install). `$HERMES_HOME/config.yaml`:
```yaml
mcp_servers:
  recordare:
    url: "http://recordare.lan:3000/mcp"          # Streamable HTTP (SSE also supported)
    headers:
      Authorization: "Bearer ${RECORDARE_TOKEN}"  # ${VAR} resolved at connect time, incl. $HERMES_HOME/.env
      X-Recordare-User: "andrea"
    timeout: 30
    connect_timeout: 10
    tools: { include: [search_episodes, search_memory, resolve_period] }   # optional filter
```
Other keys: `identity_header {name, value_from: static|profile, value}`, `client_cert`/`client_key` (mTLS), OAuth
(`hermes mcp login <server>`), `lazy`. **Limit**: headers are fixed per server entry (static or the profile name) —
there is no per-gateway-user or per-conversation header, so MCP alone cannot send `X-Recordare-User` /
`X-Recordare-Conversation` for a multi-user gateway. For a single-person install a personal token (memory-direct reads,
INTEGRATION §4b) works.

## 3. Identity (user / session / platform)

`initialize()` kwargs built by `_memory_provider_init_kwargs` ([agent/agent_init.py](https://github.com/NousResearch/hermes-agent/blob/main/agent/agent_init.py)):
`session_id`, `platform` (`cli`, `gui`, `acp`, `telegram`, `discord`, …, `cron`, `subagent`), `hermes_home`,
`agent_context` (`primary` | `cron` | `subagent` — **skip writes when not primary**), `agent_identity` (profile name),
`agent_workspace`, `session_title`, `cwd`, and on gateways `user_id`, `user_id_alt` (platform-stable alt id, e.g. Signal
UUID), `user_name`, `chat_id`, `chat_name`, `chat_type` (`dm` | group/channel | thread), `thread_id`,
**`gateway_session_key`** (stable per chat, e.g. `agent:main:telegram:dm:123`; built by `build_session_key` in
[gateway/session.py](https://github.com/NousResearch/hermes-agent/blob/main/gateway/session.py)). CLI: no `user_id`.

Group chats ([user-guide/sessions.md](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/sessions.md)):
default `group_sessions_per_user: true` → one session per (room, sender), the key gets the participant id; threads are
shared unless `thread_sessions_per_user`. With `group_sessions_per_user: false` a room shares one session and the
real author of each turn arrives per turn (`on_turn_start` author trio, `sync_turn(turn_author=…)`).
`session_id` rotates on /new **and on compression**; `gateway_session_key` does not.

Mapping for Recordare:
- `X-Recordare-User` = `user_id_alt or user_id` on gateways, mapped through an optional alias table (Honcho's
  `userPeerAliases` / `pinUserPeer` pattern); on CLI / gui / acp a configured `RECORDARE_USER`. Platform-prefixed
  (`telegram:123`) unless aliased, so two platforms stay distinct until the admin links identities.
- conversation `externalId` = `gateway_session_key` if present, else the first `session_id` of the lineage (keep it
  across compression switches, `on_session_switch(reset=False)`; start a new one on `reset=True`).
- participants: `holder` (the user), assistant (`agent_identity`), and in shared rooms each `turn_author` as `other`.

## 4. Licences

| Code | Licence | Reusable in AGPL-3.0 Recordare |
|---|---|---|
| hermes-agent (incl. bundled `retaindb`, `holographic`, `byterover`) | MIT ([LICENSE](https://github.com/NousResearch/hermes-agent/blob/main/LICENSE)) | yes, with notice in `THIRD_PARTY_NOTICES.md` |
| `hermes-plugin-honcho` (subdir of an AGPL-3.0 repo) | subdir `LICENSE` is MIT, "Copyright (c) 2025 Nous Research" | yes (MIT) — repo itself AGPL-3.0, also compatible |
| `hermes-plugin-mem0` (mem0 monorepo) | Apache-2.0 | yes |
| `supermemoryai/hermes-supermemory` | MIT | yes |

Note: the plugin itself runs inside Hermes (MIT) as a separate work talking HTTP to Recordare; we can licence it AGPL-3.0
(or more permissively, maintainer's choice — not decided here).

## 5. Minimal design — `recordare` memory provider

Directory provider (installable by `hermes plugins install <repo>/connectors/hermes/recordare` once public, or by copying
into `$HERMES_HOME/plugins/recordare/`). Pure stdlib + `requests` (a Hermes core dependency) — no `pyproject` deps.
```
recordare/
├── __init__.py   # RecordareProvider + register(ctx)
├── client.py     # HTTP: ingest, context, me, tool calls (REST or MCP-over-HTTP)
├── outbox.py     # SQLite outbox at $HERMES_HOME/recordare_outbox.db, retry with back-off, replay on start
├── plugin.yaml   # name: recordare, version, description, requires_env: [RECORDARE_API_KEY, RECORDARE_URL]
└── README.md
```
Config (env in `$HERMES_HOME/.env`, read via `get_secret`; non-secret ones may also live in `config.yaml` →
`memory.recordare.*`):
`RECORDARE_URL`, `RECORDARE_API_KEY` (client key, scopes ingest + read [+ write]), `RECORDARE_USER` (CLI / default
person), `RECORDARE_USER_ALIASES` (JSON `{runtime_id: recordare_user}`), `RECORDARE_RECALL` (`context` | `tools` |
`both`, default `both`), `RECORDARE_INGEST_TOOLS` (send tool messages, default off).

Methods:
- `is_available()`: URL and key set.
- `initialize()`: resolve user + conversation id (§3); skip writes if `agent_context != primary`; open outbox; start the
  outbox worker with `spawn_context_thread`; (background) `GET api/v1/me` to cache `episodicEnabled` — if false, recall
  still works but `sync_turn` drops (no buffering before consent, INTEGRATION §2).
- `sync_turn()`: enqueue one `POST api/v1/ingest/messages` batch (`conversation {externalId, channel: platform,
  participants}`, messages user + assistant with stable `externalId`s generated at enqueue time — e.g.
  `<session_id>:<turn>:u|a` — and `sentAt`); returns immediately. Optional `role: "tool"` rows from `messages`.
- `prefetch(query)`: `POST api/v1/context {query}` with `X-Recordare-User` + `X-Recordare-Conversation`, timeout ≈ 3 s
  (< Hermes' 8 s); return the block **without** its `<memory-context>` fence (Hermes adds its own) or join `items`;
  `""` on `block: null` / error. `queue_prefetch` can be a no-op (the endpoint makes no LLM call).
- `get_tool_schemas()` / `handle_tool_call()`: `recordare_search_episodes`, `recordare_search_memory`,
  `recordare_resolve_period`, `recordare_remember`, `recordare_correct_episode`, `recordare_forget_episode` (no
  `log_episode`, as in Arkimede), proxied to Recordare's MCP endpoint (or REST) **with the per-user / per-conversation
  headers** — this is why tools go through the provider rather than `mcp_servers` (§2).
- `on_session_switch(reset=True)` / `on_session_end()`: send `hints.conversationEnded: true` and switch conversation id.
- `on_memory_write()` (optional): mirror built-in "user" memory adds as `remember`.
- `shutdown()`: flush the outbox with a short deadline.

Smoke test headless (any OpenAI-compatible LLM), no system-wide install — the official image with a throwaway
`HERMES_HOME`:
```bash
mkdir -p /tmp/hh/plugins && cp -r connectors/hermes/recordare /tmp/hh/plugins/
cat > /tmp/hh/config.yaml <<'EOF'
model: { provider: custom, model: deepseek-chat, base_url: https://api.deepseek.com/v1, api_key: "${LLM_API_KEY}" }
memory: { provider: recordare }
EOF
printf 'RECORDARE_URL=http://host.docker.internal:3000\nRECORDARE_API_KEY=…\nRECORDARE_USER=smoke-user\nLLM_API_KEY=…\n' > /tmp/hh/.env
docker run --rm -v /tmp/hh:/opt/data nousresearch/hermes-agent chat --oneshot -q "My sister Giulia moves to Turin in May."
docker run --rm -v /tmp/hh:/opt/data nousresearch/hermes-agent chat --oneshot -q "Where is Giulia moving?"
```
Locally without Docker: `uv tool run`/venv install of `hermes-agent` then `HERMES_HOME=/tmp/hh hermes -z "<prompt>"`
(`-z`: only the final answer on stdout, exit code 0 / 2) or `hermes chat --oneshot -q … --format stream-json`
(tool calls visible). Unit-level: `MemoryManager().add_provider(p); mgr.initialize_all(session_id="t1",
platform="cli"); mgr.sync_all("u", "a"); mgr.prefetch_all("q")` (pattern from the guide; tests in
`tests/agent/test_memory_provider*.py`). Multi-user path: the gateway's OpenAI-compatible API server
(`gateway run`, port 8642, [features/api-server.md](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/api-server.md))
or a Telegram test bot.

## Not verified
- Nothing was installed or run: the smoke-test commands are assembled from the docs, not executed. In particular
  whether the image's entrypoint accepts `chat --oneshot -q` / `-z` directly (docs only show `setup` and `gateway run`),
  and the exact `model:` keys for a custom endpoint on v0.21.6 (`docker.md` shows `provider: custom, model, base_url,
  api_key`).
- How the API server maps a caller to `user_id` (not read in detail); whether `turn_author` is populated on every
  platform in shared rooms.
- Whether `${VAR}` substitution works inside `model.api_key` in `config.yaml` (documented for `mcp_servers` and model
  aliases).
- Plugin-host isolation (`plugins.isolation: host`) behaviour with background threads in a provider.
