# Ricerca: un connettore OpenClaw per Recordare

Stato: nota di ricerca, 2026-10-08. Le fonti sono state lette dai pacchetti pubblicati, non solo dalle pagine web:
`openclaw@2026.9.9` (npm `latest`, release GitHub [v2026.9.9](https://github.com/openclaw/openclaw/releases/tag/v2026.9.9),
2026-10-08; `beta` = 2026.10.1-beta.2), `@openclaw/memory-lancedb@2026.9.9` e `@honcho-ai/openclaw-honcho@1.7.0`
(estratti con `npm pack`, nulla è stato installato). I percorsi della documentazione qui sotto fanno riferimento a
[docs.openclaw.ai](https://docs.openclaw.ai) (distribuiti anche nel pacchetto npm sotto `docs/`).

## 0. Cos'è OpenClaw oggi
- Repo ufficiale: [github.com/openclaw/openclaw](https://github.com/openclaw/openclaw), TypeScript, **MIT**
  ("Copyright (c) 2026 OpenClaw Foundation"). Documentazione: [docs.openclaw.ai](https://docs.openclaw.ai)
  (indice per gli LLM: [llms.txt](https://docs.openclaw.ai/llms.txt)). Le versioni seguono il calendario (`2026.9.9`).
- Nomi nel tempo: Warelay → CLAWDIS → Clawdbot (gen 2026) → Moltbot (27 gen 2026) → OpenClaw (30 gen 2026)
  ([Wikipedia](https://en.wikipedia.org/wiki/OpenClaw), [docs: lore](https://docs2.openclaw.ai/start/lore)).
- Architettura: un **Gateway** sempre attivo (Node ≥ 24.16 o ≥ 26.1, da `engines` in `package.json`) che gestisce
  sessioni e canali (Telegram, WhatsApp, Slack, Discord, iMessage, Control UI…), esegue l'agente
  (un runner incorporato, oppure harness Codex / Copilot / CLI) e carica i **plugin nativi in-process**.

## 1. Meccanismi di estensione

| Meccanismo | Cos'è | Uso per Recordare |
| --- | --- | --- |
| Plugin nativo (`openclaw.plugin.json` + entry TS/JS) | Modulo in-process; registra hook, tool, servizi, comandi CLI, resolver MCP ([building plugins](https://docs.openclaw.ai/plugins/building-plugins), [SDK overview](https://docs.openclaw.ai/plugins/sdk-overview)) | **Sì: il connettore** |
| Hook tipizzati del plugin `api.on(name, handler)` | ~40 hook del ciclo di vita ([hooks](https://docs.openclaw.ai/plugins/hooks), [hook reference](https://docs.openclaw.ai/plugins/hooks/reference)) | cattura + recall |
| Slot di memoria `plugins.slots.memory` | Un solo plugin con `kind: "memory"` lo possiede (predefinito: `memory-core` incluso, `MEMORY.md` Markdown + `memory_search`); rivendicarlo disabilita il plugin precedente | **No** (vedi §5) |
| Slot del context engine `plugins.slots.contextEngine` | Sostituisce l'assemblaggio della cronologia / la compattazione ([context engine](https://docs.openclaw.ai/concepts/context-engine)) | No |
| Skill (`SKILL.md`) | Istruzioni a livello di prompt, senza codice | Opzionale, in seguito |
| Hook interni (`HOOK.md`, `command:new`…) | Script dell'operatore sui comandi | No |
| Client MCP (`mcp.servers`) | Nativo, vedi §2 | Possibile, ma vedi §2 |

### Hook rilevanti qui (tipi da `dist/*.d.ts` di 2026.9.9)
Gli handler ricevono `(event, ctx)`; `ctx: PluginHookAgentContext` (§3).

- `before_prompt_build` — **recall**. Evento `{ prompt: string; currentUserMessage?: string; currentUserMessageId?: string; messages: unknown[] }`.
  Restituisce `{ prependContext?, appendContext?, prependSystemContext?, appendSystemContext?, systemPrompt?, toolsAllow? }`.
  Budget predefinito di 15 s. `currentUserMessage` è la richiesta corrente *prima* della proiezione di cronologia/envelope
  (stringa vuota = nessun testo, ad es. solo immagine); `currentUserMessageId` è stabile tra i tentativi ripetuti di una
  stessa richiesta ammessa. Registrando con `{ requiresToolAuthority: true }` viene eseguito dopo che la tool policy è
  definitiva e fornisce `ctx.toolAuthority.allows(tool)`
  ([prompt and session hooks](https://docs.openclaw.ai/plugins/hooks/prompt-and-session)).
- `agent_end` — **cattura**. Evento `{ runId?: string; messages: unknown[]; success: boolean; error?: string; durationMs?: number }`
  (l'intera trascrizione in memoria della sessione, non solo il turno). Sola osservazione, fire-and-forget sui
  percorsi dei canali, timeout predefinito di 30 s per handler. Le sessioni in incognito ricevono `messages` vuoto.
- `session_end` — evento `{ sessionId; sessionKey?; messageCount; reason?: "new"|"reset"|"idle"|"daily"|"compaction"|"deleted"|"shutdown"|"restart"|"unknown"; nextSessionId?; nextSessionKey? }`
  → mappare su `hints.conversationEnded`. Shutdown/restart condividono un budget totale di drain di 2 s.
- `message_received` — ogni messaggio in ingresso dal canale (`content`, `senderId`, `messageId`, `timestamp`, `threadId`,
  `sessionKey`, `runId`, media, metadata; ctx `{ channelId, accountId?, conversationId?, sessionKey?, runId? }`).
  Scatta anche per i messaggi di gruppo che non attivano l'agente (con menzione obbligatoria), quindi è l'hook
  per i messaggi degli altri partecipanti.
- `message_sent` — esito della consegna in uscita (`content`, `success`, `sessionKey`).
- Il più vecchio `before_agent_start` è "solo per compatibilità"; i nuovi plugin usano `before_model_resolve` + `before_prompt_build`.

**Controllo dei permessi**: i plugin non inclusi (non bundled) richiedono `plugins.entries.<id>.hooks.allowConversationAccess: true` per
`before_prompt_build`, `agent_end`, `llm_input/output`, `before_agent_run`…; gli hook del prompt sono bloccati anche da
`allowPromptInjection: false` ([hooks → permissions](https://docs.openclaw.ai/plugins/hooks#permissions-and-scope)).
Avvertenza sul runtime: `agent_turn_prepare` e le iniezioni in coda non sono collegati agli harness Codex/Copilot;
`before_prompt_build` è supportato dai runtime incorporato, CLI, Copilot e Codex.

### Pacchettizzazione, configurazione, installazione
- File: `package.json` con un blocco `openclaw`, `openclaw.plugin.json` (manifest, **obbligatorio**: `id`, `configSchema`
  come JSON Schema inline; i tool devono essere dichiarati staticamente in `contracts.tools`), modulo di entry che esporta
  `definePluginEntry({ id, name, description, kind?, configSchema?, register(api) })` da
  `openclaw/plugin-sdk/plugin-entry` ([manifest](https://docs.openclaw.ai/plugins/manifest),
  [entry points](https://docs.openclaw.ai/plugins/sdk-entrypoints)).
- `package.json` `openclaw`: `extensions: ["./index.ts"]` (sorgente, adatto ai caricamenti locali) oppure `runtimeExtensions:
  ["./dist/index.js"]` (build pubblicate), `compat.pluginApi: ">=2026.x"`, `install.minHostVersion`;
  `peerDependencies: { openclaw: ">=…" }`.
- La configurazione sta in `openclaw.json` (JSON5) sotto `plugins.entries.<id>.{enabled, config, hooks}`; il plugin legge
  `api.pluginConfig` dentro `register`. La modifica della configurazione si ricarica a caldo (riesegue `register`).
- Installazione: `openclaw plugins install <spec>` con `clawhub:<pkg>`, `npm:<pkg>` (o il semplice nome npm), `git:github.com/o/r@tag`,
  una directory/archivio locale, oppure `--link ./dir --force` per lo sviluppo; poi `openclaw plugins enable <id>`,
  `openclaw plugins inspect <id> --runtime --json`, `openclaw plugins reload <id>`
  ([CLI plugins](https://docs.openclaw.ai/cli/plugins), [manage plugins](https://docs.openclaw.ai/plugins/manage-plugins)).
  Distribuzione: npm e/o [ClawHub](https://docs.openclaw.ai/plugins/community).

### Esempio 1 — `@openclaw/memory-lancedb` (ufficiale, esterno, MIT, monorepo `extensions/memory-lancedb/`)
Struttura (pubblicata): `openclaw.plugin.json` (`id: memory-lancedb`, `kind: "memory"`, `contracts.tools:
[memory_forget, memory_recall, memory_store]`, `uiHints`, `activation.onCommands: ["ltm"]`), `package.json`
(`openclaw.extensions`, `runtimeExtensions`, `compat.pluginApi: ">=2026.9.9"`), `dist/index.js` (entry),
`auto-recall.js`, `config.js`, `embeddings.js`, `lancedb-store.js`, `memory-capture-sanitization.js`, `memory-cli.js`.
Entry (`index.ts`): `api.registerMemoryCapability?.(…)`, tre `api.registerTool((ctx) => ({ name, parameters, execute }))`,
`api.on("before_prompt_build", autoRecall, { requiresToolAuthority: true })` che restituisce `{ prependContext }`,
`api.on("agent_end", …)` (cattura i testi dell'utente, con chiave `ctx.agentId` + `ctx.sessionKey`, salta l'incognito),
`api.on("session_end", …)` (scarta i cursori per sessione), `api.registerService({ id, start, stop })`.
Documentazione: [memory-lancedb](https://docs.openclaw.ai/plugins/memory-lancedb). Nota: indicizza la memoria **per agente**, non per persona.

### Esempio 2 — `@honcho-ai/openclaw-honcho` 1.7.0 (il più vicino a noi: servizio di memoria esterno, MIT, [plastic-labs/openclaw-honcho](https://github.com/plastic-labs/openclaw-honcho))
Nessun `kind` (non occupa lo slot di memoria). `dist/hooks/capture.js`: su `agent_end`, prende l'ultimo messaggio `role: "user"`
e tutto ciò che lo segue, mittente = `ctx.senderId` (ripiega sull'analisi del blocco di metadati in ingresso sugli host < 2026.8),
salta le esecuzioni cron/heartbeat/`internal_system`, rimuove l'envelope in ingresso di OpenClaw (blocchi JSON "Conversation info (untrusted
metadata):", prefisso di timestamp `[Mon 2026-03-23 13:12]`) prima di salvare. `dist/hooks/context.js`: su
`before_prompt_build` recupera il modello utente per mittente e restituisce `appendSystemContext`. Mappa gli id dei mittenti sui peer
di Honcho in un file JSON locale (`~/.honcho/openclaw-peers.json`). Documentazione: [Honcho memory](https://docs.openclaw.ai/concepts/memory-honcho).

## 2. Supporto MCP
- **Client MCP nativo.** Configurazione sotto `mcp.servers.<name>`; trasporti `stdio`, `sse`, `streamable-http`; campi `url`,
  `transport`, **`headers`** (mappa chiave/valore statica), `connectionTimeoutMs`, `requestTimeoutMs`, `auth: "oauth"`,
  `toolFilter.include/exclude`, `sslVerify`, mTLS ([connect MCP servers](https://docs.openclaw.ai/tools/mcp),
  [transports](https://docs.openclaw.ai/cli/mcp/transports)). CLI: `openclaw mcp add recordare --url https://…/mcp
  --transport streamable-http`, `openclaw mcp doctor recordare --probe`. MCP HTTP remoto con header: **sì**.
  (I tool passano dalla normale tool policy; un plugin può anche fornire un server tramite `mcpServers` nel manifest.)
- **Header per richiedente**: `api.registerMcpServerConnectionResolver({ serverName, resolve(ctx) → { url, headers } | null })`,
  `ctx = { requesterSenderId: string; agentAccountId?; messageChannel? }`
  ([infrastructure → requester-scoped MCP](https://docs.openclaw.ai/plugins/sdk-overview/infrastructure)).
  Limiti che contano per Recordare: il resolver **non riceve sessione/conversazione**, quindi non può impostare
  `X-Recordare-Conversation`; le esecuzioni senza un mittente attendibile (cron, operatore della Control UI, CLI) non ottengono mai il server; il
  trasporto risolto viene messo in cache e riconvalidato al più ogni 5 min. → L'MCP statico/per richiedente da solo non può soddisfare
  la regola del viewer di Recordare (INTEGRATION.md §4). Usare invece i tool registrati dal plugin (§5). *(Dal D50 / WORK_PLAN
  8.2 la regola non c'è più: il richiamo funziona senza conversazione; le scritture MCP con una chiave client ne hanno
  ancora bisogno, quindi i tool del plugin restano la strada migliore.)*

## 3. Identità: persona, sessione, canale, gruppi
`PluginHookAgentContext` (hook dell'agente) contiene: `agentId`, `sessionKey`, `sessionId`, `runId`, `channel` /
`messageProvider` (ad es. `telegram`), `accountId`, `chatId` / `channelId` (destinazione della conversazione), **`senderId`**
(id del mittente nel canale, ad es. id utente Telegram; aggiunto circa nel 2026.8 secondo i commenti nel codice di Honcho), `channelContext.{sender,chat}.id`,
`trigger` (`user`, `cron`, `heartbeat`…), `inputProvenance.kind` (`external_user` | `inter_session` | `internal_system`).
I campi del mittente sono **assenti per le esecuzioni di sistema** (cron, heartbeat) e possono mancare anche altrove.
Le factory dei tool ricevono `OpenClawPluginToolContext`: `agentId`, `sessionKey`, `sessionId`, `messageChannel`,
`agentAccountId`, **`requesterSenderId`**, `senderIsOwner`, `deliveryContext`.

- Session key: forma canonica `agent:<agentId>:<provider>:…` (ad es. un gruppo/stanza o un peer in DM). **Il valore predefinito
  `session.dmScope: "main"` mette tutti i DM di tutte le persone in un'unica sessione** — un'installazione con più persone deve impostare
  `per-channel-peer` (o `per-peer`) ([session management](https://docs.openclaw.ai/concepts/session)).
  `session.identityLinks` mappa le identità di una persona tra i canali su un unico peer per l'instradamento; i **profili** del Gateway
  possono essere collegati ai mittenti dei canali da un admin (`users.linkChannelIdentity`, [user model](https://docs.openclaw.ai/concepts/user-model)),
  ma il contesto degli hook non espone alcun id di profilo (solo `requesterProfileId` in alcuni tipi interni) — non utilizzabile per ora.
- Gruppi: isolati per gruppo per impostazione predefinita (`session.groupScope: "per-group"`). Ogni turno ha un solo `senderId`; i payload
  di gruppo in ingresso contengono `ChatType=group`, `GroupSubject`, `GroupMembers` (se noto), `WasMentioned`
  ([groups](https://docs.openclaw.ai/channels/groups)) — sono campi dei template del prompt; **non verificato** se
  arrivino agli hook dei plugin. I messaggi degli altri membri sono osservabili tramite `message_received` (ciascuno con il proprio `senderId`).
- I turni da Control UI / CLI / HTTP compatibile OpenAI sono turni owner/operatore ([OpenAI HTTP API](https://docs.openclaw.ai/gateway/openai-http-api)
  "treats chat turns as owner-sender turns"); se `senderId` sia impostato in quei casi **non è verificato** → il plugin ha bisogno di una
  persona di ripiego configurata.

## 4. Licenze
- OpenClaw: **MIT** (repo e pacchetto npm; `THIRD_PARTY_NOTICES.md` incluso). `@openclaw/memory-lancedb`: stesso repo,
  MIT. `openclaw-honcho`: **MIT** (Plastic Labs). Tutte compatibili con AGPL-3.0: il codice può essere riutilizzato con l'avviso MIT
  registrato in `THIRD_PARTY_NOTICES.md` nel momento del riuso (ad es. gli helper di Honcho per la rimozione dell'envelope / i confini del turno).
- Il plugin importa `openclaw/plugin-sdk/*` (MIT) e il nostro `@arkimedehq/recordare-client` (AGPL-3.0-or-later). Un
  plugin AGPL caricato in un host MIT va bene dal punto di vista della licenza; se pubblicare il plugin con AGPL o con una licenza
  permissiva (adozione su ClawHub) è una decisione del maintainer — si noti che la libreria client è AGPL, quindi un plugin permissivo
  non potrebbe includerla.

## 5. Progetto minimo proposto: `@arkimedehq/openclaw-recordare` (id del plugin `recordare`)
Scelte: nessun `kind: "memory"` (lasciare in pace `memory-core` / `MEMORY.md`, come Honcho; nello spirito di D34); cattura tramite
`before_prompt_build` + `agent_end`; recall sia come blocco iniettato sia come tool; MCP di Recordare chiamato tramite
`packages/client` (`RecordareMcp`) con header per chiamata, non tramite `mcp.servers`.

```
packages/openclaw-recordare/
  package.json            # openclaw.extensions ["./src/index.ts"], runtimeExtensions ["./dist/index.js"],
                          # compat.pluginApi ">=2026.9.9", peerDependencies openclaw, dep @arkimedehq/recordare-client
  openclaw.plugin.json    # id "recordare", categories ["memory"], activation.onStartup true,
                          # contracts.tools [recordare_search_memory, recordare_search_episodes, recordare_resolve_period,
                          #   recordare_remember, recordare_correct_episode, recordare_forget_episode], configSchema, uiHints (apiKey sensitive)
  src/index.ts            # definePluginEntry: hooks + tools + service (outbox flush)
  src/identity.ts         # ctx → { user, conversationId, participants } ; skip rules
  src/transcript.ts       # text of AgentMessage content blocks; strip inbound envelope (ported from Honcho, MIT notice)
  src/outbox.ts           # small durable queue (JSONL/SQLite in api.resolvePath(stateDir)), retry with back-off
  test/                   # vitest with a fake api + fetch mock; conformance against a dev Recordare
```

Configurazione (`plugins.entries.recordare.config`):
`url` (obbligatorio), `apiKey` (chiave client, scope ingest+mcp+read; espansione `${ENV}`), `users` (mappa
`"<channel>:<senderId>"` → id utente Recordare; predefinito `"<channel>:<senderId>"` alla lettera, facendo affidamento su
`autoProvision` di Recordare), `defaultUser` (per i turni senza mittente: Control UI, CLI, il titolare), `capture` (bool, predefinito true),
`autoRecall` (`"off" | "context" `, predefinito `"context"`), `tools` (bool, predefinito true), `groups`
(`"off" | "mapped"`, predefinito `"mapped"`: acquisisce i turni di gruppo solo per i mittenti presenti in `users`), `captureSystemRuns` (predefinito false).
Necessario inoltre in `openclaw.json`: `plugins.entries.recordare.hooks.allowConversationAccess: true`; per più persone,
`session.dmScope: "per-channel-peer"`.

Hook e flusso:
1. `before_prompt_build` (fase ordinaria): risolvere `user` da `ctx.channel`/`ctx.senderId` (altrimenti `defaultUser`, altrimenti
   saltare); saltare l'incognito (`isIncognitoSessionKey` da `openclaw/plugin-sdk/routing`), cron/heartbeat/`internal_system`.
   Memorizzare `{ text: event.currentUserMessage, id: event.currentUserMessageId ?? runId, at: now, user }` per `ctx.runId`.
   Se `autoRecall`: `POST api/v1/context {query: currentUserMessage}` con `X-Recordare-User` e
   `X-Recordare-Conversation: <sessionKey>`, timeout ~3 s, restituire `{ prependContext: block }` (il testo dinamico va nel
   contesto lato utente; `appendSystemContext` romperebbe la cache del prompt a ogni turno — misurare prima di scegliere).
2. `agent_end` (se `success`): prendere il testo utente memorizzato (ripiego: l'ultimo messaggio `role:"user"`, envelope rimosso) e i
   blocchi di testo dell'ultimo `role:"assistant"`; mettere in coda `POST api/v1/ingest/messages` con
   `conversation: { externalId: sessionKey, channel: ctx.channel, participants: [holder ref → user, assistant ref → agentId] }`,
   `externalId` dei messaggi = `<currentUserMessageId|runId>:u` / `<runId>:a`, `sentAt` ISO. Outbox: non bloccare mai il turno.
   I risultati dei tool (ruolo `toolResult`) sono opzionali in seguito (D30: `role: "tool"`).
3. `message_received` (gruppi, `groups: "mapped"`): mettere in buffer i messaggi del gruppo non destinati all'agente con `role: "other"` e
   `authorRef = senderId` in modo che il prossimo ingest li includa; i partecipanti crescono man mano che compaiono i mittenti.
4. `session_end` (reason ≠ `compaction`): inviare `hints.conversationEnded: true` per quel `sessionKey`.
5. Tool: `api.registerTool((ctx) => …)` per ciascun tool `recordare_*` dichiarato; `execute` chiama l'MCP di Recordare tramite
   `RecordareMcp` con `X-Recordare-User` da `ctx.requesterSenderId`/`messageChannel` (o `defaultUser`) e
   `X-Recordare-Conversation: ctx.sessionKey`; restituire `null` dalla factory quando nessun utente viene risolto. Nessun `log_episode`
   (come in Arkimede). Schemi: copiare gli schemi di input MCP di Recordare in fase di build (il manifest deve elencare i nomi staticamente).
6. `api.registerService({ start, stop })`: avviare/fermare il flusher dell'outbox; `stop` svuota la coda entro un limite.

Consenso: `GET api/v1/me` → `episodicEnabled`; se false, non mettere in buffer (INTEGRATION.md §2), registrare un log una sola volta per utente.

### Test locale / smoke test
- Node: OpenClaw richiede **Node ≥ 24.16** (questo Mac ha v20.19) → usare Docker o un Node 24 locale al progetto.
- Docker: immagini ufficiali `ghcr.io/openclaw/openclaw:<version>` (mirror `openclaw/openclaw`; tag `2026.9.9`, `latest`,
  `slim`); `docker compose` del repo con i servizi `openclaw-gateway` + `openclaw-cli`
  ([Docker install](https://docs.openclaw.ai/install/docker)). Montare la directory del plugin ed eseguire
  `openclaw plugins install --link /plugins/recordare --force`.
- Turni headless: `openclaw agent exec "…" --json [--config <file>] [--state-dir <dir>]` esegue un turno incorporato senza
  Gateway (stato temporaneo, usa i plugin installati, exit 0/1/2), oppure `openclaw agent --local --agent main --message "…" --json`;
  `openclaw agent --session-key … --message …` tramite Gateway mantiene una sessione tra le chiamate
  ([agent CLI](https://docs.openclaw.ai/cli/agent)). LLM: DeepSeek tramite `@openclaw/deepseek-provider` + `DEEPSEEK_API_KEY`,
  oppure il provider Ollama incluso.
- Script: (1) avviare Recordare dev + una persona di test con `episodicEnabled`; (2) due turni `agent` nella stessa session key
  ("my sister is called Giulia", poi un riempitivo); (3) verificare le righe di `ingest` per la conversazione (`externalId` = session key);
  (4) dopo l'estrazione, una nuova sessione chiede "what is my sister called?" → verificare che il blocco di recall sia stato iniettato
  (`openclaw plugins inspect recordare --runtime --json`, log del gateway) e la risposta. L'identità per mittente non può essere
  provata dalla CLI (nessun `senderId`, usa `defaultUser`); serve un canale reale (un bot di test Telegram) oppure
  l'[endpoint HTTP compatibile OpenAI](https://docs.openclaw.ai/gateway/openai-http-api) — non verificato quale id mittente
  restituisca quest'ultimo.

## Non verificato
- Forma esatta degli elementi `messages` di `agent_end` (nel parser di Honcho abbiamo visto `role` + `content` stringa oppure `[{type:"text",text}]`;
  un campo `timestamp` per messaggio è probabile ma non confermato).
- Se `GroupMembers` / il tipo di chat arrivino ai contesti degli hook dei plugin; se `senderId` sia impostato per i turni da Control UI / API HTTP.
- Comportamento degli hook sull'harness app-server di Codex oltre quanto dichiarato nella documentazione (assumiamo il runner incorporato predefinito).
- `registerMcpServerConnectionResolver` e `before_prompt_build` sono stati letti solo in documentazione/tipi, non eseguiti.
- Nulla è stato eseguito: nessuna istanza di OpenClaw è stata avviata.
