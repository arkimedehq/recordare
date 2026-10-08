# Ricerca: un connettore Recordare per OpenAI Codex

Stato: nota di ricerca, 2026-10-08. Fonti: l'albero dei sorgenti di Codex su
[`openai/codex@9b73858`](https://github.com/openai/codex/tree/9b738582b13c2cdbeff54af0afd04c50c3e7ba09) (main del
2026-10-08), la documentazione ufficiale (`developers.openai.com/codex/*` ora reindirizza a `learn.chatgpt.com/docs/*`) e
il nostro connettore Claude Code esistente (`connectors/claude-code/`). Qui sotto, `SRC/` significa
`https://github.com/openai/codex/blob/9b738582b13c2cdbeff54af0afd04c50c3e7ba09/`.

**Versione.** Ultima release **0.161.0** (`rust-v0.161.0`, pubblicata il 2026-10-07; npm `@openai/codex` 0.161.0). La CLI,
l'estensione per IDE e l'app desktop eseguono tutte lo stesso core in Rust (l'app/IDE tramite `codex app-server`), quindi
`~/.codex/config.toml` e `~/.codex/hooks.json` valgono per tutti e tre. Questo è stato letto nel sorgente, non provato
nell'estensione per IDE né nell'app.

**In breve.** Codex ora ha **hook del ciclo di vita in stile Claude Code**: sono stabili e attivi per impostazione predefinita. Usano gli
stessi nomi di evento e payload JSON quasi identici. `UserPromptSubmit` può restituire `additionalContext`, che Codex
inietta come **messaggio con ruolo developer** per quel turno. Il nostro script di hook per Claude Code funziona quindi con Codex dopo
piccole modifiche. L'unico nuovo ostacolo è la **fiducia negli hook** (hook trust): un hook a livello utente non viene eseguito finché l'utente non
lo approva in `/hooks`, oppure finché il suo hash non è registrato in `config.toml`.

---

## 1. MCP (streamable HTTP)

Integrato, senza flag sperimentali. Il vecchio flag `experimental_use_rmcp_client` non serve più: rmcp è il client.
Per il tipo di trasporto vedere `SRC/codex-rs/config/src/mcp_types.rs` (`McpServerTransportConfig::StreamableHttp`), e la
pagina di documentazione [MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).

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
`codex mcp add recordare --url http://localhost:8090/mcp --bearer-token-env-var RECORDARE_TOKEN`, più
`codex mcp list|get|remove`. Esistono anche flag OAuth (`--oauth-client-id`, …); non ci servono.

Note:
- Gli `http_headers` sono statici, quindi Codex non può inviare un header `X-Recordare-Conversation` per sessione. Va bene:
  il commit `9a3f280` collega le scritture con token personale alle parole recenti della persona dallo stesso client quando non viene indicata
  alcuna conversazione.
- I tool MCP nella TUI possono chiedere approvazione a seconda di `default_tools_approval_mode` e della policy della sandbox. Per
  `codex exec`, impostare `default_tools_approval_mode = "approve"` oppure `"auto"`.

## 2. Hook sui turni

### 2a. `notify` legacy (ancora supportato, segnato per la rimozione)
`notify = ["node", "/abs/path/recordare-codex.mjs"]` al livello superiore di `config.toml`. Dopo ogni turno Codex avvia
il programma e aggiunge **un argomento JSON** ad argv. stdin, stdout e stderr sono null, e nessuno attende il
processo. Sorgente: [`SRC/codex-rs/hooks/src/legacy_notify.rs`](https://github.com/openai/codex/blob/9b738582b13c2cdbeff54af0afd04c50c3e7ba09/codex-rs/hooks/src/legacy_notify.rs)
(contiene un `TODO: Remove this hook … when legacy notify support is removed`).

```json
{ "type": "agent-turn-complete", "thread-id": "b5f6c1c2-…", "turn-id": "12345", "cwd": "/Users/x/project",
  "client": "codex-tui", "input-messages": ["Rename `foo` to `bar` …"], "last-assistant-message": "Rename complete …" }
```

Fornisce un turno completo (input dell'utente e risposta) in una sola chiamata e non richiede il passaggio di fiducia. Non può iniettare contesto, ed è
deprecato, quindi va usato solo come ripiego.

### 2b. Hook del ciclo di vita (attuali, stabili, attivi per impostazione predefinita)
La feature `hooks` è `Stage::Stable, default_enabled: true`
([`SRC/codex-rs/features/src/lib.rs`](https://github.com/openai/codex/blob/9b738582b13c2cdbeff54af0afd04c50c3e7ba09/codex-rs/features/src/lib.rs)).
`[features] hooks = false` disattiva gli hook (`codex_hooks` è l'alias deprecato). Documentazione:
[Hooks](https://learn.chatgpt.com/docs/hooks).

**Dove si configurano gli hook.** Ogni livello di configurazione può contenere hook: `~/.codex/hooks.json`, tabelle `[hooks]` inline in
`~/.codex/config.toml`, `<repo>/.codex/hooks.json` e `<repo>/.codex/config.toml`. I plugin possono anche includere hook in
`hooks/hooks.json`. Lo schema è quello di Claude Code
([`SRC/codex-rs/config/src/hook_config.rs`](https://github.com/openai/codex/blob/9b738582b13c2cdbeff54af0afd04c50c3e7ba09/codex-rs/config/src/hook_config.rs)):

```json
{ "hooks": {
  "UserPromptSubmit": [ { "hooks": [ { "type": "command", "command": "node ~/.codex/recordare/recordare-hook.mjs", "timeout": 10 } ] } ],
  "Stop":             [ { "hooks": [ { "type": "command", "command": "node ~/.codex/recordare/recordare-hook.mjs", "timeout": 15 } ] } ],
  "SessionEnd":       [ { "hooks": [ { "type": "command", "command": "node ~/.codex/recordare/recordare-hook.mjs", "timeout": 3 } ] } ]
} }
```

**Eventi:** `PreToolUse`, `PermissionRequest`, `PostToolUse`, `PreCompact`, `PostCompact`, `SessionStart`, `SessionEnd`,
`UserPromptSubmit`, `SubagentStart`, `SubagentStop`, `Stop`, `Interrupt`.

**Campi dell'handler.** `type` è `command` oppure `mcp_tool` (`prompt` e `agent` vengono analizzati ma non sono supportati). Gli altri
campi sono `command`, `commandWindows`, `timeout` (predefinito 600 s; `SessionEnd`/`Interrupt` hanno come predefinito 1 s con un limite di
3 s), `async` (un hook in background: fino a 8 per sessione, mai su `SessionEnd`, senza effetti di controllo), `statusMessage` e
`additionalContextLimit` (≈ 2.500 token per impostazione predefinita; quando il testo è più lungo, Codex lo riversa in
`<tmp>/hook_outputs/<session>/<uuid>.txt` e mostra al modello un'anteprima di testa e coda). I comandi girano tramite
`$SHELL -lc`, con lo snapshot dell'ambiente della sessione e il payload su **stdin**.

**Payload** (schemi JSON generati in
[`SRC/codex-rs/hooks/schema/generated/`](https://github.com/openai/codex/tree/9b738582b13c2cdbeff54af0afd04c50c3e7ba09/codex-rs/hooks/schema/generated)):

| Evento | Campi di input (stdin) |
|---|---|
| `UserPromptSubmit` | `session_id`, `turn_id`, `transcript_path` (nullable), `cwd`, `hook_event_name`, `model`, `permission_mode`, **`prompt`**, opzionali `agent_id`, `agent_type` (impostati per i subagent) |
| `Stop` | `session_id`, `turn_id`, `transcript_path`, `cwd`, `hook_event_name`, `model`, `permission_mode`, `stop_hook_active`, **`last_assistant_message`** (nullable) |
| `SessionStart` | `session_id`, `transcript_path`, `cwd`, `hook_event_name`, `model`, `permission_mode`, `source` (`startup`, `resume`, `clear`, `compact`, `fork`) |
| `SessionEnd` | `session_id`, `transcript_path`, `cwd`, `hook_event_name`, `reason` (sempre `"other"`) |

`session_id` è l'id del thread, quindi è stabile per la conversazione e sopravvive a `codex resume`.

**L'iniezione di contesto funziona.** Un hook `UserPromptSubmit` può stampare
`{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"…"}}` oppure stampare **testo semplice**: anche
qualsiasi stdout non JSON con exit 0 diventa contesto. `SessionStart` può restituire `additionalContext` allo stesso modo. Codex
lo registra come messaggio con **ruolo developer** per il turno
([`SRC/codex-rs/core/src/context/hook_additional_context.rs`](https://github.com/openai/codex/blob/9b738582b13c2cdbeff54af0afd04c50c3e7ba09/codex-rs/core/src/context/hook_additional_context.rs)).
Exit code 2 con un motivo su stderr, oppure `decision: "block"`, blocca il prompt. Non lo vogliamo mai.

**Fiducia (la differenza importante rispetto a Claude Code).** Gli hook utente e di progetto, compresi quelli dei plugin, partono come
`Untrusted` e **vengono saltati** finché non sono approvati
([`SRC/codex-rs/hooks/src/engine/discovery.rs`](https://github.com/openai/codex/blob/9b738582b13c2cdbeff54af0afd04c50c3e7ba09/codex-rs/hooks/src/engine/discovery.rs)).
Ci sono tre modi per approvarli:
1. In modo interattivo: eseguire `/hooks` nella TUI per rivederli e approvarli. La documentazione lo raccomanda.
2. Tramite configurazione: `[hooks.state."<key>"] trusted_hash = "sha256:…"` in `~/.codex/config.toml`. Funzionano anche i flag di sessione
   `-c`. La chiave è `<absolute source path>:<event_snake>:<group_index>:<handler_index>`, ad esempio
   `/Users/x/.codex/hooks.json:user_prompt_submit:0:0`. L'hash è
   `"sha256:" + hex(sha256(compact JSON with sorted keys of {"event_name": "<event_snake>", "matcher"?: …, "hooks": [normalized handler]}))`.
   L'handler normalizzato è `{"type":"command","command":<raw command>,"timeout":<effective timeout>,"async":<bool>}`
   più `statusMessage` e un `additionalContextLimit` non predefinito quando sono impostati
   ([`SRC/codex-rs/config/src/fingerprint.rs`](https://github.com/openai/codex/blob/9b738582b13c2cdbeff54af0afd04c50c3e7ba09/codex-rs/config/src/fingerprint.rs)).
   Ho riprodotto l'algoritmo di fingerprint rispetto al vettore di test di Codex stesso. **Non** ho verificato l'intera identità
   con un Codex in esecuzione. Un installer potrebbe pre-approvare i propri hook in questo modo, ma la formula è interna e può
   cambiare, quindi `/hooks` resta il percorso documentato.
3. Per esecuzione: `--dangerously-bypass-hook-trust` (`codex` e `codex exec`). Solo per lo smoke test.

Gli admin possono impostare `allow_managed_hooks_only = true` in `requirements.toml`, che disabilita del tutto gli hook utente.

## 3. Trascrizioni di sessione (cattura di ripiego)

Percorso: `$CODEX_HOME/sessions/YYYY/MM/DD/rollout-YYYY-MM-DDThh-mm-ss-<thread-uuid>.jsonl`. `CODEX_HOME` ha come predefinito
`~/.codex`. Un thread ripristinato a uno stato precedente aggiunge `_<rollout-uuid>`. I file più vecchi possono essere compressi in **`.jsonl.zst`**, e quelli
archiviati vengono spostati in `archived_sessions/`
([`SRC/codex-rs/rollout/src/`](https://github.com/openai/codex/tree/9b738582b13c2cdbeff54af0afd04c50c3e7ba09/codex-rs/rollout/src)).
Ogni riga è `{"timestamp": "...", "ordinal"?: n, "type": <item>, "payload": {...}}` con questi tipi di item:
`session_meta` (`id`, `session_id`, cwd, …), `response_item`, `turn_context`, `compacted`, `event_msg`, e altri.
Per la cattura, gli item utili sono `event_msg` con `payload.type = "user_message"` (`message`), `"agent_message"`
(`message`, `phase`) e `"task_complete"` (`turn_id`, `last_agent_message`). Gli hook ricevono questo file come
`transcript_path`. Il formato è interno e cambia spesso, quindi usarlo solo quando `last_assistant_message` è null.
Nota: il `~/.codex` di questa macchina **non ha la directory `sessions/`**. Le build più recenti potrebbero tenere lo stato in SQLite
(`state_5.sqlite`, `logs_2.sqlite`) in alcune modalità. Non ho approfondito.

## 4. Opzioni per istruzioni e contesto

- `AGENTS.md` (globale `~/.codex/AGENTS.md`, file per repo, `AGENTS.override.md`), `developer_instructions` (un
  messaggio developer), `instructions`, `model_instructions_file` (in precedenza `experimental_instructions_file`; sostituisce
  il prompt integrato, cosa sconsigliata) e i profili. Tutti questi sono **statici**, letti all'avvio della sessione.
  Nessuno può portare un blocco di memoria per turno.
- La memoria per turno è possibile solo tramite l'**hook `UserPromptSubmit`** (§2b). Per un riepilogo a livello di sessione su "con chi stai
  parlando", un hook `SessionStart` può restituire `additionalContext`. Una nota di una riga in `developer_instructions`
  o `AGENTS.md` può dire al modello che i tool di Recordare esistono. È opzionale, perché le descrizioni dei tool MCP
  lo coprono già.
- Codex ha una **propria funzione di memoria** (`[features] memories`, stabile, disattivata per impostazione predefinita, salvata in
  `~/.codex/memories_1.sqlite`). È indipendente da Recordare. Il README dovrebbe dire che le due possono convivere
  affiancate e che la nostra è quella cross-platform.

## 5. Licenza

**Apache-2.0** (`LICENSE`; `NOTICE`: "OpenAI Codex, Copyright 2025 OpenAI", più Ratatui con licenza MIT). Il codice Apache-2.0 può
essere incorporato in un'opera AGPL-3.0 (è compatibile con GPLv3 e quindi con AGPLv3), quindi è consentito da
`docs/LICENSING.md`. Se copiamo qualcosa, mantenere l'avviso Apache e registrarlo in `THIRD_PARTY_NOTICES.md`. In pratica
**non ci serve codice di Codex**: il connettore usa solo i suoi contratti di configurazione e di hook.

## 6. Progetto proposto

### File (`connectors/codex/`)
- `recordare-hook.mjs`: il nostro script per Claude Code, generalizzato. I payload coincidono, quindi lo script può essere **condiviso** con
  un parametro client (`node recordare-hook.mjs codex`). Le modifiche specifiche per Codex sono:
  - il canale e l'id di conversazione `codex:<session_id>`, con il titolo da `basename(cwd)`;
  - **saltare gli eventi dei subagent** (`agent_id` presente) per non inquinare la memoria della persona;
  - per `Stop`, usare `last_assistant_message`; se è null, prendere l'ultimo `agent_message` dal rollout in
    `transcript_path` (gestendo `.zst`, oppure saltandolo);
  - `SessionEnd` ha un limite di 3 s, quindi serve una sola richiesta breve con timeout di 2,5 s;
  - la configurazione viene da `RECORDARE_URL` / `RECORDARE_TOKEN`, con ripiego su un file
    `~/.config/recordare/codex.json` (modo 0600). Il file evita di dipendere dall'ambiente della login shell.
  - Resta best effort: uscire sempre con 0, non stampare mai nulla tranne il blocco di contesto.
- `hooks.json`: i tre eventi sopra, con `UserPromptSubmit` (sincrono, 10 s), `Stop` (valutare `"async": true` in modo che
  l'upload della risposta non ritardi mai il prompt successivo) e `SessionEnd` (3 s).
- `install.sh`: una riga di comando, ad es.
  `curl -fsSL https://…/connectors/codex/install.sh | sh -s -- --url http://host:8090 --token rp_…`. Esso:
  1. copia lo script in `~/.codex/recordare/` e scrive `~/.config/recordare/codex.json` (0600);
  2. unisce `hooks.json` in `~/.codex/hooks.json` (riconoscendo il nostro comando, senza sovrascrivere gli hook dell'utente);
  3. esegue `codex mcp add recordare --url <url>/mcp --bearer-token-env-var RECORDARE_TOKEN` e dice all'utente di
     esportare `RECORDARE_TOKEN`. L'alternativa è scrivere `http_headers = { Authorization = "Bearer …" }`, che mette
     il token in `config.toml`; offrirla come opzione;
  4. dice all'utente di aprire `codex` ed eseguire **`/hooks` → trust** per i tre hook di Recordare. La pre-approvazione con la formula
     dell'hash del §2b potrebbe diventare un flag opt-in una volta testata.
- Passo opzionale successivo: un **plugin Codex**. Codex legge `.codex-plugin/plugin.json`, e anche `.claude-plugin/plugin.json`
  e `.claude-plugin/marketplace.json`, quindi il nostro marketplace esistente potrebbe già essere individuabile con
  `codex plugin marketplace add arkimedehq/recordare` + `codex plugin add recordare@recordare`. Gli hook dei plugin ricevono
  `PLUGIN_ROOT` / `CLAUDE_PLUGIN_ROOT`. Tuttavia, Codex **non ha `userConfig`**, quindi `${user_config.*}` nel nostro manifest
  Claude non verrebbe espanso. Servirebbe un `.codex-plugin/plugin.json` dedicato con un `.mcp.json` che usi
  `bearer_token_env_var`, e gli hook dei plugin richiedono comunque la fiducia. Non è verificato, quindi lo salterei
  per la v0.1.

### Smoke test (non interattivo, isolato)
Codex ora parla **solo l'API Responses**: `wire_api = "chat"` viene rifiutato (`SRC/codex-rs/model-provider-info/src/lib.rs`,
[discussion #7782](https://github.com/openai/codex/discussions/7782)). Ciò significa che **DeepSeek (solo Chat Completions, per quanto ne so)
e il nostro gateway dello spike non possono essere usati direttamente**. Ci sono tre opzioni:
1. Ollama locale, provider integrato `ollama` (Responses):
   `codex exec --oss --local-provider ollama -m qwen3:8b …`. Richiede una versione di Ollama con `/v1/responses`. Non
   ho verificato quale versione di Ollama sia installata qui.
2. Un proxy Responses-verso-Chat (ad es. LiteLLM) davanti a DeepSeek, dichiarato come
   `[model_providers.x] base_url = "http://localhost:4000/v1", env_key = "…", wire_api = "responses"`.
3. La più economica e deterministica, adatta alla CI: un **server SSE Responses finto** di ~50 righe in Node che risponde sempre con
   un messaggio fisso. I test di Codex stesso fanno lo stesso. Non ha costi LLM e verifica comunque entrambi gli hook end to end.

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
`codex exec --json` stampa eventi JSONL, quindi il test può leggere l'id del thread. Senza il flag di bypass, gli hook vengono
saltati in silenzio: è un buon test negativo del comportamento di fiducia.

## Cosa non ho potuto verificare
- Non ho eseguito nessun binario di Codex (qui non ne è installato nessuno). Tutto proviene dal sorgente a `9b73858`, che è main e
  leggermente più avanti del tag 0.161.0, e dalla documentazione.
- Che l'estensione per IDE e l'app desktop eseguano gli hook allo stesso modo della CLI, e come mostrino la richiesta di fiducia
  (il sorgente suggerisce che condividano il core e `hooks/list`).
- L'esatta identità dell'hash di fiducia per i nostri handler (è stato verificato solo l'algoritmo di fingerprint).
- Se l'Ollama di questa macchina serve `/v1/responses`, e se DeepSeek offre un endpoint Responses.
- Se il marketplace `.claude-plugin` esistente si installa correttamente tramite `codex plugin`.
- Perché il `~/.codex` di questa macchina non ha la directory `sessions/` (forse l'app con stato SQLite).
