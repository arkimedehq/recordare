# Ricerca: un connettore Recordare completo per AnythingLLM

Stato: nota di ricerca, 2026-10-08. Non è un contratto; ancora nessun codice.
Fonti: sorgente di AnythingLLM su `master` commit `3c7e73b` (2026-10-06), ultima release
[v1.17.0](https://github.com/Mintplex-Labs/anything-llm/releases/tag/v1.17.0) (pubblicata il 2026-10-01), letto in
locale (clone shallow, nulla è stato installato o eseguito), più la documentazione ufficiale. I percorsi dei file qui sotto sono relativi alla
[radice del repo](https://github.com/Mintplex-Labs/anything-llm). **Nulla di quanto segue è stato eseguito su un'istanza reale**: il
comportamento è letto dal codice e va confermato con lo smoke test del §5.

## 1. Punti di estensione (v1.17.0)

| Punto | Cosa ci offre | Limiti |
|---|---|---|
| **MCP** (`storage/plugins/anythingllm_mcp_servers.json`, [docs](https://docs.anythingllm.com/mcp-compatibility/overview)) | I tool di Recordare al modello. Trasporti: stdio, `sse`, `streamable` / `http` (`server/utils/MCP/hypervisor/index.js` → `createHttpTransport`, `StreamableHTTPClientTransport` dell'SDK MCP ufficiale). Oggetto `headers` opzionale; `anythingllm.autoStart` e `suppressedTools` specifici di AnythingLLM. | Solo agent ("MCP tools for use with AI Agents"). **Gli header sono statici** per server: un solo `X-Recordare-User` (o un solo token personale) per l'intera istanza, quindi l'identità per utente è impossibile via MCP. Nemmeno `X-Recordare-Conversation`. |
| **Portata della modalità agent** | Dalla modalità di chat `automatic` (ora predefinita per i nuovi workspace, `models/workspace.js`), ogni chat dell'interfaccia passa dal percorso agent *se il provider supporta il tool calling nativo* (`server/utils/chats/agents.js` → `Workspace.supportsNativeToolCalling`); per la maggior parte dei provider è attivo per impostazione predefinita, con opt-out tramite `PROVIDER_DISABLE_NATIVE_TOOL_CALLING`. Altrimenti l'utente deve digitare `@agent`. | I workspace impostati su `chat` / `query`, il widget embed (`automatic` → `chat`, `utils/chats/embed.js`) e l'endpoint compatibile OpenAI non usano mai i tool. |
| **Custom agent skill** (`storage/plugins/agent-skills/<hubId>/plugin.json` + `handler.js`, [docs](https://docs.anythingllm.com/agent/custom/introduction)) | Tool JS in-process; `this.super` è l'istanza aibitat, il cui `handlerProps.invocation` porta `user_id`, `workspace_id`, `thread_id` (`server/utils/agents/imported.js`, `aibitat/plugins/chat-history.js`). Quindi una skill *può* chiamare Recordare con l'utente reale. | Gira solo quando il modello decide di chiamarla (un tool, non un hook); stessa portata solo-agent dell'MCP. `invocation` è interno, non è un'API documentata (potrebbe cambiare). |
| **Agent Flows** (`server/utils/agentFlows/`) | Catene di tool no-code: blocchi `apiCall`, `llmInstruction`, `webScraping`. | Sono anch'essi tool invocati dall'agent; nessun trigger sugli eventi di chat. |
| **Developer API** (`/api/v1/*`, chiave API, Swagger su `/api/docs`) | `GET /v1/workspace/{slug}/chats` (solo thread predefinito, filtra `thread_id: null`; restituisce `{role, content, sentAt}` senza id e senza utente), `GET /v1/workspace/{slug}/thread/{threadSlug}/chats`, **`POST /v1/admin/workspace-chats`** `{offset}` → righe grezze (`id`, `workspaceId`, `prompt`, `response` JSON, `user_id`, `thread_id`, `api_session_id`, `createdAt`, più `workspace.slug`, `user.username`), 20 per pagina, dalla più recente; documentato come "disabled until multi user mode is enabled". Endpoint di chat: `/v1/workspace/{slug}/chat`, `/stream-chat`, thread `new` / `chat` con `userId`. Endpoint admin degli utenti (`/v1/admin/users`). | Nessun webhook, nessuno stream di eventi, nessun cursore "since" (paginare per offset e fermarsi all'ultimo `id` visto). La chiave API vale per l'intera istanza (poteri da admin). |
| **Widget embed** (`/v1/embed`, tabella `embed_chats`) | Bolla di chat pubblica per workspace; chat leggibili tramite `GET /v1/embed/{embedUuid}/chats` (limitato alla sessione). | Visitatori anonimi (solo id di sessione): non sono una persona che Recordare debba ricordare (D33 ci tiene lontani dai profili pubblici). |
| **Variabili del system prompt** (`server/models/systemPromptVariables.js`) | `{user.id}`, `{user.name}`, `{user.bio}`, `{workspace.id}`, `{workspace.name}`, data/ora, più variabili statiche definite dall'admin; espanse nel system prompt del workspace per la chat normale (`utils/chats/index.js` → `chatPrompt`) e per la chat agent (`aibitat/providers/ai-provider.js` → `systemPrompt`). | Nessuna variabile per l'id del thread. Un utente sconosciuto (modalità single-user, embed, API senza `userId`) viene espanso nel segnaposto letterale `[User ID]`. |
| **Memoria integrata** (nuova: `server/utils/memories/`, `jobs/extract-memories.js`, tabella `memories`) | AnythingLLM ha ora memorie proprie, globali e per workspace, per utente, estratte da un job observer-reflector in idle/background e aggiunte al system prompt. | Si sovrappone a Recordare: si consiglia di disattivarla nella configurazione del connettore per evitare due memorie che alimentano lo stesso prompt (e le chiamate dell'estrattore di AnythingLLM che passano dal nostro proxy, vedi §2). |

Altro: esistono un bot Telegram (`utils/telegramBot`) e job pianificati; nessuno dei due è un hook sui messaggi di chat. **Non ho trovato alcun
webhook / sottoscrizione a eventi** nel codice (cercati `webhook`, `EventEmitter`, hooks).

## 2. Un hook su ogni messaggio nella chat normale?

Non ce n'è. Opzioni percorribili:

### (i) Proxy compatibile OpenAI come provider "Generic OpenAI" — consigliato per cattura + iniezione
`GenericOpenAiLLM` di AnythingLLM (`server/utils/AiProviders/genericOpenAi/index.js`) e il provider degli agent
(`utils/agents/aibitat/providers/genericOpenAi.js`) chiamano `GENERIC_OPEN_AI_BASE_PATH` con `GENERIC_OPEN_AI_API_KEY`,
lo `User-Agent` di AnythingLLM e `GENERIC_OPEN_AI_CUSTOM_HEADERS` **statici** (`"Name:value,Name2:value2"`).

Identità: **non ne viene inoltrata nessuna.** `streamGetChatCompletion(messages, {user})` riceve l'utente ma Generic OpenAI
lo ignora (solo OpenRouter imposta il campo `user` di OpenAI, come `user_${id}`). Nessun header di workspace / thread nemmeno.
Un espediente che funziona dal codice: inserire un marcatore nel system prompt del workspace usando le variabili del prompt, ad es.
`[[recordare user={user.id} ws={workspace.id}]]`. Viene espanso lato server sia nei percorsi di chat sia in quelli agent, quindi il proxy
lo legge **solo dal primo messaggio `system`** (mai dal testo dell'utente, che l'utente controlla), lo rimuove, e mappa
l'id utente AnythingLLM → `X-Recordare-User` (tramite una tabella di mappatura, oppure `{user.name}` se i nomi utente sono gli id esterni).
Spoofing: solo admin / manager possono modificare i prompt dei workspace; una richiesta senza un marcatore valido (widget embed, `[User ID]` in
single-user, estrazione di memoria, titolo e classificatore del router propri di AnythingLLM) passa senza modifiche — oppure, in
modalità single-user, viene mappata su un'unica memoria configurata.

Per ogni richiesta il proxy: (1) `POST /api/v1/context {query: last user message}` → aggiunge il blocco `<memory-context>` al
messaggio di sistema; (2) inoltra (in stream o no) al provider reale, duplicando lo stream SSE; (3) a completamento,
acquisisce l'ultimo messaggio utente + il testo finale dell'assistant. I cicli agent fanno più chiamate per turno: acquisire solo la
chiamata finale (nessun `tool_calls` nella risposta), opzionalmente le chiamate ai tool come `role: "tool"` (D30); deduplicare con
`externalId = hash(user, ws, user-message text, timestamp bucket)`.

Lacune: nessun id del thread → l'externalId della conversazione va sintetizzato (ad es. `anythingllm:{ws}:{user}:{day}` o un hash del
primo messaggio utente in `messages`); nessun id dei messaggi, quindi modifiche / rigenerazioni / cancellazioni con `/reset` sono invisibili
(una rigenerazione appare come una seconda risposta dell'assistant allo stesso testo utente → usare `upsert`). Il prompt che il proxy vede è
già compresso / troncato da AnythingLLM e porta il contesto RAG nel messaggio di sistema, che non deve essere acquisito.
Affidabilità: alta per la cattura (il proxy è nel percorso della richiesta; se Recordare è giù deve comunque inoltrare e accodare
l'ingest), ma cambia la scelta del provider LLM — il provider reale passa nella configurazione del proxy, e le funzioni native dei provider di AnythingLLM
(ad es. gli elenchi di modelli per provider, il model router) si perdono o vanno inoltrate tramite proxy.

### (ii) Polling della developer API — consigliato per la cattura quando il provider deve restare nativo
`POST /v1/admin/workspace-chats` fornisce ogni chat (normale, agent, thread, sessioni API) con `id`, `user_id`,
`thread_id`, `workspaceId`, `createdAt` — esattamente ciò che serve all'ingest: conversazione
`externalId = anythingllm:{workspaceId}:{thread_id ?? "default"}:{user_id}`, `externalId` del messaggio = `chat:{id}:user|assistant`,
`X-Recordare-User` da `user_id` (o `user.username`). Cursore = `id` più alto visto. I turni agent vengono prima salvati con
`include: false` e risposta vuota, poi aggiornati con upsert (`chat-history.js`): leggere solo le righe con `include: true` e un
`response.text` non vuoto, e trattare le modifiche successive con `upsert`. Svantaggi: latenza = intervallo di polling; cancellazioni/reset
non vengono segnalati (le righe con `include: false` dopo un reset si potrebbero confrontare, ma non a basso costo); richiede la modalità multi-user
(secondo la documentazione dell'endpoint; in modalità single-user usare gli endpoint per workspace/per thread, non serve l'id utente); chiave API admin
a livello di istanza custodita dal connettore. Nessuna iniezione: il recall deve venire da MCP o dal proxy.

### (iii) MCP solo in modalità agent
Fornisce tool di recall (e `remember` ecc.) senza alcuna modifica ad AnythingLLM, ma header statici ⇒ una sola memoria Recordare per
istanza di AnythingLLM; nessuna cattura automatica (il modello dovrebbe chiamare un tool). Va bene per un'installazione desktop
single-user, non per il multi-user.

| | Cattura | Iniezione | Identità per utente | Id thread | Provider invariato |
|---|---|---|---|---|---|
| (i) proxy | ogni turno incl. agent | sì, a ogni turno | tramite marcatore nel system prompt | no (sintetizzato) | no |
| (ii) polling | ogni turno salvato | no | sì (`user_id`) | sì | sì |
| (iii) MCP | no | solo tool, modalità agent | no (statica) | no | sì |
| custom skill | no | solo tool, modalità agent | sì (`invocation.user_id`) | sì | sì |

## 3. Licenza
AnythingLLM è **MIT** ([LICENSE](https://github.com/Mintplex-Labs/anything-llm/blob/master/LICENSE), "Copyright (c)
Mintplex Labs Inc."), compatibile con AGPL-3.0: il codice può essere riutilizzato con l'avviso in `THIRD_PARTY_NOTICES.md`. Non
dovremmo averne bisogno: il connettore parla solo con la sua API HTTP / i suoi file di configurazione.

## 4. Progetto consigliato
Un piccolo servizio connettore nel repo di Recordare (TypeScript, costruito su `packages/client`), con due modalità a scelta dell'admin:

1. **Cattura = polling (ii) per impostazione predefinita**: id affidabili, utente e thread reali, nessuna modifica al percorso LLM. Idempotente tramite
   gli externalId dei messaggi; il consenso per memoria è applicato da Recordare (`stored: false`).
2. **Recall**: (a) **modalità proxy** (i) per l'iniezione a ogni turno — il proxy fa allora anche la cattura inline, e il polling
   viene spento (il proxy non può derivare gli id del polling, quindi eseguirli entrambi duplicherebbe l'ingest: una sola fonte di cattura
   per istanza); oppure (b) **modalità MCP** (iii) per le installazioni single-user.
   Una custom skill che legge `invocation.user_id` è un possibile percorso dei tool multi-user ma si appoggia su elementi interni: da parcheggiare.
3. Documento di setup: disattivare le memorie integrate di AnythingLLM; mappare gli utenti AnythingLLM → externalUserIds di Recordare; aggiungere il marcatore
   al prompt di ogni workspace (modalità proxy); tenere fuori le chat del widget embed (nessuna persona).

## 5. Smoke test locale (non serve un account)
```sh
export STORAGE_LOCATION=$PWD/.anythingllm && mkdir -p $STORAGE_LOCATION && touch $STORAGE_LOCATION/.env
docker run -d --name allm -p 3001:3001 --cap-add SYS_ADMIN \
  -v $STORAGE_LOCATION:/app/server/storage -v $STORAGE_LOCATION/.env:/app/server/.env \
  -e STORAGE_DIR=/app/server/storage \
  -e LLM_PROVIDER=generic-openai -e GENERIC_OPEN_AI_BASE_PATH=http://host.docker.internal:<proxy>/v1 \
  -e GENERIC_OPEN_AI_MODEL_PREF=<model> -e GENERIC_OPEN_AI_MODEL_TOKEN_LIMIT=32000 \
  mintplexlabs/anythingllm:1.17.0   # verify the tag exists on Docker Hub; `latest` otherwise
```
([guida Docker](https://github.com/Mintplex-Labs/anything-llm/blob/master/docker/HOW_TO_USE_DOCKER.md)). Poi, da script:
- Chiave API: in modalità single-user senza `AUTH_TOKEN`, `POST /api/system/generate-api-key` non richiede autenticazione
  (`server/endpoints/system.js`); altrimenti crearla nell'interfaccia (Settings → Developer API).
- Multi-user: `POST /api/system/enable-multi-user` (endpoint interno, sessione UI) oppure l'interfaccia; utenti tramite
  `POST /api/v1/admin/users/new`.
- `POST /api/v1/workspace/new {name}`; impostare il prompt con il marcatore tramite `POST /api/v1/workspace/{slug}/update
  {openAiPrompt}`; `POST /api/v1/workspace/{slug}/thread/new {userId}`;
  `POST /api/v1/workspace/{slug}/thread/{thread}/chat {message, mode:"chat"|"automatic", userId}`.
- Verificare: il log grezzo di Recordare contiene entrambi i turni sotto la memoria e la conversazione giuste; una seconda chat che richiede il primo
  fatto lo ottiene dal blocco iniettato (proxy) o da `search_memory` (MCP, `mode:"automatic"`).
- MCP: scrivere `storage/plugins/anythingllm_mcp_servers.json`
  `{"mcpServers":{"recordare":{"type":"streamable","url":"http://host.docker.internal:<port>/mcp","headers":{"Authorization":"Bearer rk_…","X-Recordare-User":"<id>"}}}}`.

## 6. Lo stesso proxy per Open WebUI e LibreChat?
- **Open WebUI** ([v0.11.4](https://github.com/open-webui/open-webui/releases/tag/v0.11.4), 2026-09-21): con
  `ENABLE_FORWARD_USER_INFO_HEADERS=true` inoltra `X-OpenWebUI-User-Id/-Name/-Email/-Role`, più
  `X-OpenWebUI-Chat-Id` e `X-OpenWebUI-Message-Id` (`backend/open_webui/env.py`, `utils/headers.py`); con
  `FORWARD_USER_INFO_HEADER_JWT_SECRET` impostato invia invece un unico **JWT HS256 firmato** (`X-OpenWebUI-User-Jwt`, 300 s)
  — il proxy può verificare l'identità. Quindi il proxy ha copertura completa (id di utente + chat + messaggio). Si noti
  [CVE-2026-59224](https://osv.dev/vulnerability/CVE-2026-59224) (id utente inoltrato non firmato nel proxy del terminale,
  corretto nella 0.10.0): preferire la modalità JWT. Licenza: la "Open WebUI License" (BSD-3 più una clausola di branding) — non riutilizzare
  il suo codice senza verificare la compatibilità; noi consumiamo solo header.
- **LibreChat** (ultimi tag v0.8.8-rc*, MIT): gli `headers` degli endpoint custom supportano `{{LIBRECHAT_USER_ID}}`,
  `{{LIBRECHAT_USER_EMAIL}}`, `{{LIBRECHAT_BODY_CONVERSATIONID}}`, `{{LIBRECHAT_BODY_MESSAGEID}}`,
  `{{LIBRECHAT_BODY_PARENTMESSAGEID}}` ([custom endpoint](https://www.librechat.ai/en/docs/configuration/librechat_yaml/object_structure/custom_endpoint));
  gli stessi segnaposto funzionano negli header di `mcpServers`
  ([MCP servers](https://www.librechat.ai/docs/configuration/librechat_yaml/object_structure/mcp_servers)), quindi lì anche
  l'MCP può essere per utente. Copertura completa tramite il proxy; gli header sono impostati dalla configurazione dell'admin, non dagli utenti.
- AnythingLLM è l'anello debole: nessun inoltro dell'identità, da cui il marcatore nel system prompt o il polling.

## Non verificato
- Nessuna istanza di AnythingLLM è stata eseguita: la portata della modalità agent automatica, l'espansione del marcatore nelle chiamate agent, l'endpoint admin delle chat
  in modalità single-user, l'esatto tag Docker `1.17.0` e quante chiamate LLM faccia un turno agent richiedono tutti lo smoke test.
- L'accesso della custom skill a `this.super.handlerProps.invocation` è letto dal codice, non dalla documentazione pubblica.
- Le affermazioni su Open WebUI / LibreChat provengono dal sorgente `main` e dalle pagine di documentazione, non da esecuzioni.
