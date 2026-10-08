# Connettore Hermes Agent — ricerca (2026-10-08)

Fonti verificate il 2026-10-08: [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) su `main`
commit `25a71a7` (= `v0.21.6-130`; ultima release **v0.21.6**, 2026-10-08; precedente v0.21.5 / tag `v2026.9.24`).
`pyproject.toml` indica `version = "0.0.0"` (le versioni vengono dai tag); `requires-python = ">=3.11,<3.15"` (l'immagine
Docker usa Python 3.14). I percorsi dei file qui sotto sono relativi a quel repo.

## 1. Interfaccia del memory provider

**ABC**: `agent.memory_provider.MemoryProvider` ([agent/memory_provider.py](https://github.com/NousResearch/hermes-agent/blob/main/agent/memory_provider.py));
guida: [developer-guide/memory-provider-plugin.md](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/memory-provider-plugin.md).
Pilotato da `agent.memory_manager.MemoryManager`: lo store integrato (MEMORY.md / USER.md) è sempre attivo, più **al massimo
un** provider esterno, selezionato per nome in `config.yaml` → `memory.provider`.

| Metodo | Obbligatorio | Quando / contratto |
|---|---|---|
| `name` (property) | sì | id del provider (= valore di `memory.provider`) |
| `is_available()` | sì | solo configurazione / dipendenze, **nessuna rete** |
| `initialize(session_id, **kwargs)` | sì | una volta all'avvio dell'agente; kwargs più sotto (§3) |
| `get_tool_schemas()` | sì | schemi di funzione OpenAI `{name, description, parameters}`; `[]` se nessuno |
| `handle_tool_call(tool_name, args, **kwargs)` | se ci sono tool | deve restituire una stringa JSON |
| `system_prompt_block()` | no | solo testo statico |
| `prefetch(query, *, session_id)` | no | chiamato **in modo sincrono prima del ciclo dei tool** di ogni turno (saltato per i prompt banali: `is_trivial_prompt`, ad es. "ok", "/cmd"); limitato da `_EXTERNAL_PREFETCH_TIMEOUT_S = 8.0` s, dopo un timeout il provider viene saltato finché la chiamata bloccata non ritorna |
| `queue_prefetch(query, *, session_id)` | no | dopo ogni turno — pre-riscalda una cache che `prefetch()` consuma al turno successivo |
| `sync_turn(user, assistant, *, session_id, messages=None, turn_author=None)` | no | dopo ogni turno **completato** (i turni interrotti vengono saltati), su un executor in background a singolo worker; deve essere non bloccante. `messages` = lista in stile OpenAI incl. chiamate / risultati dei tool; `turn_author` = `{id, name, is_bot}` (passato solo se la firma lo accetta) |
| `on_turn_start(turn_number, message, **kw)` | no | kw: `remaining_tokens, model, platform, tool_count, author_id, author_name, author_is_bot` |
| `on_session_end(messages)` | no | solo veri confini di sessione (/new, rotazione per compressione, uscita) |
| `on_session_switch(new_session_id, *, parent_session_id, reset, rewound)` | no | /resume, /branch, /reset, /new, compressione; `reset=True` solo per una conversazione davvero nuova |
| `on_pre_compress(messages)` | no | prima della compressione con perdita (API di checkpoint v2 opt-in fail-closed) |
| `on_memory_write(action, target, content, metadata)` | no | specchio delle scritture del tool di memoria integrato (add / replace / remove) |
| `on_delegation(task, result, …)` | no | vista lato genitore dell'esecuzione di un subagent |
| `get_config_schema()` / `save_config(values, hermes_home)` | sì* | campi per `hermes memory setup`; `secret`+`env_var` vanno in `$HERMES_HOME/.env`; *i provider solo-env possono mantenere il `save_config` no-op |
| `identity_signature()` | no | valori che devono invalidare un agente gateway in cache quando cambiano |
| `shutdown()`, `backup_paths()`, `recall_status()`, `unavailable_reason()` | no | flush / backup / indicatore di recall / suggerimento di setup |

Come viene iniettato il recall ([agent/turn_context.py](https://github.com/NousResearch/hermes-agent/blob/main/agent/turn_context.py),
`build_memory_context_block` in `agent/memory_manager.py`): la stringa di prefetch viene avvolta da **Hermes** in
`<memory-context>…</memory-context>` con una nota di sistema e **aggiunta al messaggio utente corrente** (sidecar `api_content`,
riprodotto byte per byte nei turni successivi per la cache del prompt) — non al system prompt. Se il provider restituisce un
blocco già racchiuso tra tag, Hermes rimuove i tag e registra `memory provider returned pre-wrapped context; stripped`. I risultati
oltre `hooks.output_spill` (10 000 caratteri per impostazione predefinita) vengono riversati in un file con un'anteprima.

Threading: il lavoro in background deve usare `agent.memory_provider.spawn_context_thread` (il `HERMES_HOME` del profilo e lo
scope dei segreti vivono in contextvars); i segreti tramite `agent.secret_scope.get_secret(name)`, mai `os.environ` diretto (profili
multiplexati).

**Scoperta / installazione** ([plugins/memory/\_\_init\_\_.py](https://github.com/NousResearch/hermes-agent/blob/main/plugins/memory/__init__.py)),
vince la prima fonte in caso di conflitto di nomi:
1. `plugins/memory/<name>/` incluso — **chiuso a nuovi provider** (CONTRIBUTING);
2. utente `$HERMES_HOME/plugins/<name>/` (per profilo) — ciò che produce `hermes plugins install owner/repo[/subdir] [--ref <sha>]
   [--enable]` (le installazioni da sottodirectory scaricano solo quella cartella);
3. progetto `./.hermes/plugins/<name>/` (solo con `HERMES_ENABLE_PROJECT_PLUGINS=1`);
4. gruppo di entry point pip `hermes_agent.memory_providers` (`my-provider = "my_provider:register"`) — la documentazione sconsiglia
   di iniettare con pip in un'installazione gestita dal package manager; pensato per build gestite dal proprietario (Nix).

L'`__init__.py` della directory deve definire `register(ctx)` che chiama `ctx.register_memory_provider(Provider())` (oppure una
sottoclasse `MemoryProvider` di primo livello). Attivazione: `hermes config set memory.provider <name>` oppure `hermes memory setup`.
Dipendenze Python: `pyproject.toml [project] dependencies` oppure `pip_dependencies` in `plugin.yaml`. Con
`plugins.isolation: host` i plugin utente girano in un processo plugin-host separato (nessuna modifica necessaria per un provider
solo HTTP). I plugin di terze parti curati sono elencati in [`plugin-catalog/`](https://github.com/NousResearch/hermes-agent/tree/main/plugin-catalog)
(rivisti tramite PR, pin esatti dello SHA, capability dichiarate, scansione di sicurezza).

Stato dei provider citati nel compito: **Honcho, Mem0, Supermemory, Hindsight, OpenViking sono usciti dal core** verso il
catalogo (`plugin-catalog/{honcho,mem0,supermemory,hindsight,openviking}.yaml`); ancora inclusi: `byterover`,
`holographic`, `retaindb`.

Struttura di un provider esistente — RetainDB incluso ([plugins/memory/retaindb](https://github.com/NousResearch/hermes-agent/tree/main/plugins/memory/retaindb)),
un'API cloud HTTP con una coda di scrittura SQLite durevole (la più vicina a ciò che ci serve):
```
plugins/memory/retaindb/
├── __init__.py   # RetainDBMemoryProvider(MemoryProvider) + _Client (requests) + _WriteQueue (SQLite outbox
│                 #   at $HERMES_HOME/retaindb_queue.db, replayed on start) + register(ctx)
├── plugin.yaml   # name, version, description, requires_env: [RETAINDB_API_KEY]
└── README.md
```
Esempio di catalogo con struttura più ricca: [supermemoryai/hermes-supermemory](https://github.com/supermemoryai/hermes-supermemory)
(`__init__.py`, `plugin.yaml` con `pip_dependencies`, `pyproject.toml`); Honcho
([plastic-labs/honcho/hermes-plugin-honcho](https://github.com/plastic-labs/honcho/tree/main/hermes-plugin-honcho))
aggiunge `cli.py` (`register_cli` → `hermes honcho …`), `config_schema.py` (pannello della dashboard), `tool_schemas.py`.

## 2. MCP nativo

Documentazione: [user-guide/features/mcp.md](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/mcp.md).
Integrato (nessuna installazione aggiuntiva). `$HERMES_HOME/config.yaml`:
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
Altre chiavi: `identity_header {name, value_from: static|profile, value}`, `client_cert`/`client_key` (mTLS), OAuth
(`hermes mcp login <server>`), `lazy`. **Limite**: gli header sono fissi per voce di server (statici o il nome del profilo) —
non esiste un header per utente del gateway né per conversazione, quindi l'MCP da solo non può inviare `X-Recordare-User` /
`X-Recordare-Conversation` per un gateway multiutente. Per un'installazione per una sola persona funziona un token personale (letture
dirette del proprietario, INTEGRATION §4b).

## 3. Identità (utente / sessione / piattaforma)

I kwargs di `initialize()` costruiti da `_memory_provider_init_kwargs` ([agent/agent_init.py](https://github.com/NousResearch/hermes-agent/blob/main/agent/agent_init.py)):
`session_id`, `platform` (`cli`, `gui`, `acp`, `telegram`, `discord`, …, `cron`, `subagent`), `hermes_home`,
`agent_context` (`primary` | `cron` | `subagent` — **saltare le scritture se non è primary**), `agent_identity` (nome del profilo),
`agent_workspace`, `session_title`, `cwd`, e sui gateway `user_id`, `user_id_alt` (id alternativo stabile sulla piattaforma, ad es. UUID di
Signal), `user_name`, `chat_id`, `chat_name`, `chat_type` (`dm` | gruppo/canale | thread), `thread_id`,
**`gateway_session_key`** (stabile per chat, ad es. `agent:main:telegram:dm:123`; costruito da `build_session_key` in
[gateway/session.py](https://github.com/NousResearch/hermes-agent/blob/main/gateway/session.py)). CLI: nessun `user_id`.

Chat di gruppo ([user-guide/sessions.md](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/sessions.md)):
`group_sessions_per_user: true` predefinito → una sessione per (stanza, mittente), la chiave riceve l'id del partecipante; i thread sono
condivisi a meno di `thread_sessions_per_user`. Con `group_sessions_per_user: false` una stanza condivide una sola sessione e
il vero autore di ogni turno arriva a ogni turno (trio di autore in `on_turn_start`, `sync_turn(turn_author=…)`).
`session_id` ruota con /new **e con la compressione**; `gateway_session_key` no.

Mappatura per Recordare:
- `X-Recordare-User` = `user_id_alt or user_id` sui gateway, mappato tramite una tabella di alias opzionale (schema `userPeerAliases` /
  `pinUserPeer` di Honcho); su CLI / gui / acp un `RECORDARE_USER` configurato. Con prefisso della piattaforma
  (`telegram:123`) salvo alias, così due piattaforme restano distinte finché l'admin non collega le identità.
- `externalId` della conversazione = `gateway_session_key` se presente, altrimenti il primo `session_id` della linea (mantenerlo
  attraverso i cambi per compressione, `on_session_switch(reset=False)`; iniziarne uno nuovo con `reset=True`).
- partecipanti: owner (l'utente), assistant (`agent_identity`), e nelle stanze condivise ogni `turn_author` come `other`.

## 4. Licenze

| Codice | Licenza | Riutilizzabile in Recordare AGPL-3.0 |
|---|---|---|
| hermes-agent (incl. `retaindb`, `holographic`, `byterover` inclusi) | MIT ([LICENSE](https://github.com/NousResearch/hermes-agent/blob/main/LICENSE)) | sì, con avviso in `THIRD_PARTY_NOTICES.md` |
| `hermes-plugin-honcho` (sottodirectory di un repo AGPL-3.0) | il `LICENSE` della sottodirectory è MIT, "Copyright (c) 2025 Nous Research" | sì (MIT) — il repo stesso è AGPL-3.0, comunque compatibile |
| `hermes-plugin-mem0` (monorepo mem0) | Apache-2.0 | sì |
| `supermemoryai/hermes-supermemory` | MIT | sì |

Nota: il plugin stesso gira dentro Hermes (MIT) come opera separata che parla HTTP con Recordare; possiamo rilasciarlo con AGPL-3.0
(o in modo più permissivo, decisione del proprietario — non presa qui).

## 5. Progetto minimo — memory provider `recordare`

Provider di tipo directory (installabile con `hermes plugins install <repo>/connectors/hermes/recordare` una volta pubblico, oppure copiando
in `$HERMES_HOME/plugins/recordare/`). Solo stdlib + `requests` (dipendenza del core di Hermes) — nessuna dipendenza in `pyproject`.
```
recordare/
├── __init__.py   # RecordareProvider + register(ctx)
├── client.py     # HTTP: ingest, context, me, tool calls (REST or MCP-over-HTTP)
├── outbox.py     # SQLite outbox at $HERMES_HOME/recordare_outbox.db, retry with back-off, replay on start
├── plugin.yaml   # name: recordare, version, description, requires_env: [RECORDARE_API_KEY, RECORDARE_URL]
└── README.md
```
Configurazione (env in `$HERMES_HOME/.env`, letta tramite `get_secret`; quelle non segrete possono stare anche in `config.yaml` →
`memory.recordare.*`):
`RECORDARE_URL`, `RECORDARE_API_KEY` (chiave client, scope ingest + read [+ write]), `RECORDARE_USER` (CLI / persona
predefinita), `RECORDARE_USER_ALIASES` (JSON `{runtime_id: recordare_user}`), `RECORDARE_RECALL` (`context` | `tools` |
`both`, predefinito `both`), `RECORDARE_INGEST_TOOLS` (invia i messaggi dei tool, predefinito off).

Metodi:
- `is_available()`: URL e chiave impostati.
- `initialize()`: risolvere utente + id della conversazione (§3); saltare le scritture se `agent_context != primary`; aprire l'outbox; avviare il
  worker dell'outbox con `spawn_context_thread`; (in background) `GET api/v1/me` per mettere in cache `episodicEnabled` — se false, il recall
  funziona ancora ma `sync_turn` scarta (nessun buffer prima del consenso, INTEGRATION §2).
- `sync_turn()`: mettere in coda un batch `POST api/v1/ingest/messages` (`conversation {externalId, channel: platform,
  participants}`, messaggi utente + assistant con `externalId` stabili generati al momento dell'accodamento — ad es.
  `<session_id>:<turn>:u|a` — e `sentAt`); ritorna subito. Righe opzionali `role: "tool"` da `messages`.
- `prefetch(query)`: `POST api/v1/context {query}` con `X-Recordare-User` + `X-Recordare-Conversation`, timeout ≈ 3 s
  (< gli 8 s di Hermes); restituire il blocco **senza** il suo recinto `<memory-context>` (Hermes aggiunge il proprio) oppure unire gli `items`;
  `""` su `block: null` / errore. `queue_prefetch` può essere un no-op (l'endpoint non fa chiamate LLM).
- `get_tool_schemas()` / `handle_tool_call()`: `recordare_search_episodes`, `recordare_search_memory`,
  `recordare_resolve_period`, `recordare_remember`, `recordare_correct_episode`, `recordare_forget_episode` (nessun
  `log_episode`, come in Arkimede), inoltrati all'endpoint MCP di Recordare (o REST) **con gli header
  per utente / per conversazione** — per questo i tool passano dal provider e non da `mcp_servers` (§2).
- `on_session_switch(reset=True)` / `on_session_end()`: inviare `hints.conversationEnded: true` e cambiare l'id della conversazione.
- `on_memory_write()` (opzionale): rispecchiare le aggiunte alla memoria "user" integrata come `remember`.
- `shutdown()`: svuotare l'outbox con una breve scadenza.

Smoke test headless (qualsiasi LLM compatibile OpenAI), senza installazione di sistema — l'immagine ufficiale con un
`HERMES_HOME` usa e getta:
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
In locale senza Docker: installazione con `uv tool run`/venv di `hermes-agent` poi `HERMES_HOME=/tmp/hh hermes -z "<prompt>"`
(`-z`: solo la risposta finale su stdout, exit code 0 / 2) oppure `hermes chat --oneshot -q … --format stream-json`
(chiamate ai tool visibili). A livello unitario: `MemoryManager().add_provider(p); mgr.initialize_all(session_id="t1",
platform="cli"); mgr.sync_all("u", "a"); mgr.prefetch_all("q")` (schema dalla guida; test in
`tests/agent/test_memory_provider*.py`). Percorso multiutente: l'API server compatibile OpenAI del gateway
(`gateway run`, porta 8642, [features/api-server.md](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/api-server.md))
oppure un bot di test Telegram.

## Non verificato
- Nulla è stato installato o eseguito: i comandi dello smoke test sono assemblati dalla documentazione, non eseguiti. In particolare
  se l'entrypoint dell'immagine accetti direttamente `chat --oneshot -q` / `-z` (la documentazione mostra solo `setup` e `gateway run`),
  e le chiavi esatte di `model:` per un endpoint custom sulla v0.21.6 (`docker.md` mostra `provider: custom, model, base_url,
  api_key`).
- Come l'API server mappi un chiamante su `user_id` (non letto in dettaglio); se `turn_author` sia popolato su ogni
  piattaforma nelle stanze condivise.
- Se la sostituzione `${VAR}` funzioni dentro `model.api_key` in `config.yaml` (documentata per `mcp_servers` e per gli alias
  dei modelli).
- Comportamento dell'isolamento plugin-host (`plugins.isolation: host`) con i thread in background in un provider.
