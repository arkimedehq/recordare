# Manopole — ogni impostazione in un posto solo

*Traduzione italiana di [KNOBS.md](KNOBS.md) — la versione inglese è quella di riferimento.*

Tutte le impostazioni di Recordare, dei suoi componenti opzionali e del lato client: dove si impostano, il valore
predefinito e — per le manopole del motore — se e come sono state misurate. Il costo è un'opzione del proprietario, mai
un limite silenzioso (D35); una manopola che non ha mostrato un guadagno resta spenta finché una misura non dice il
contrario (regole di valutazione, `WORK_PLAN.md`).

## 1. Profili di qualità (per installazione, per persona)

`QUALITY_PROFILE` fissa il predefinito dell'installazione (`balanced`); ogni persona può averne uno suo
(`qualityProfile`, API admin o console). Un profilo raggruppa solo manopole; i modelli restano configurazione del
provider (§3).

| Manopola | economy | balanced | full | Cosa fa · misurato |
|---|---|---|---|---|
| `windowChars` | 16 000 | 12 000 | 8 000 | Caratteri di messaggi per chiamata di estrazione (meno = più chiamate, estrazione più fine) · blind3: profili nel rumore |
| `extractionTask` | `extract_economy` | `extract` | `extract` | Quale modello di task esegue l'estrazione (§3) |
| `reasoning` | off | off | on | Fa ragionare il modello di estrazione (più lento, più output) |
| `factsPass` | inline | inline | inline | Fatti e note nella chiamata degli episodi, o in una chiamata separata sul modello `facts` · blind5 con V4 Pro: nessun guadagno, +65 chiamate |
| `recentEpisodes` / `relatedEpisodes` | 6 / 6 | 8 / 10 | 12 / 20 | Episodi mostrati all'estrattore (recenti + collegati alla finestra) |
| `resolverWindowDays` / `resolverSimilarity` | 3 / 0.7 | 3 / 0.7 | 7 / 0.6 | Candidati quasi-duplicati (± giorni, somiglianza minima) |
| `rawHitsAlongside` | 1 | 3 | 5 | Estratti di chat restituiti accanto agli episodi trovati |
| `recallDigests` | off | off | off | Il diario notturno dato ai riepiloghi di periodo · blind5 3+3 run: −1,9 pt, nel rumore |
| `factsReview` | off | off | off | Revisione notturna dei fatti sui nuovi episodi · nessun guadagno misurato |

Override dell'installazione di singole manopole (vincono su ogni profilo): `EXTRACTION_WINDOW_CHARS`, `FACTS_PASS`,
`RECALL_DIGESTS`, `FACTS_REVIEW`.

## 2. Servizio (`service/.env`, oppure `deploy/.env` per il servizio installato)

| Variabile | Predefinito | Cosa fa |
|---|---|---|
| `DATABASE_URL`, `REDIS_URL` | — | Postgres (pgvector) e Redis |
| `QUEUE_PREFIX` | `recordare` | Separa installazioni o istanze di valutazione sullo stesso Redis (regola 9: un'istanza per coda) |
| `PORT` | 8080 | Porta HTTP dentro il container |
| `ADMIN_API_KEY` | — | Credenziale admin (≥ 32 caratteri): API admin e console |
| `ATLAS_URL` | — | Dove si apre Recordare Atlas; comunicato ai client in `GET /me` (in Arkimede lo vedono solo gli admin) |
| `IDLE_DELAY_SECONDS` | 900 | Silenzio prima che una conversazione venga estratta (un nuovo messaggio fa ripartire l'attesa) |
| `CONTEXT_MIN_FACT_SIMILARITY`, `…_EPISODE_…`, `…_PLAN_…`, `…_PERIOD_…` | 0.50, 0.55, 0.45, 0.35 | Contesto di memoria (`POST api/v1/context`): similarità minima per fatti e note, episodi, piani imminenti, episodi di un periodo nominato. Soglie più basse (0.45 / 0.48 / 0.42) misurate: nessun guadagno (RESULTS 5.7) |
| `CONSOLIDATION_SCHEDULE` | on | Consolidamento notturno automatico; off = solo su richiesta (valutazioni) |
| `CONSOLIDATION_HOUR` | 3 | Ora locale (fuso della persona) dopo la quale gira la notte |
| `QUALITY_PROFILE` | `balanced` | Profilo predefinito dell'installazione (§1) |
| `LOG_LLM_CALLS` | on | Una riga `llm_calls` per chiamata (token, latenza; mai il contenuto) |
| `ALLOW_CLOCK_OVERRIDE` | off | Solo valutazioni / test: rispetta `X-Recordare-Now` |
| `NODE_ENV` | development | — |

## 3. Modelli e provider (qualunque provider, D27)

| Variabile | Cosa fa |
|---|---|
| `LLM_PROVIDER` | `openai-compatible` (predefinito), `anthropic`, `claude-cli` (solo valutazioni locali) |
| `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` | Endpoint e modello predefiniti di ogni task |
| `LLM_PROFILE` / `LLM_PROFILE_JSON` | Profilo del provider — come spegnere il ragionamento, output strutturato: `generic`, `deepseek`, `openrouter`, `ollama`, `vllm`, `anthropic`, `openai`, o una definizione JSON |
| `LLM_<TASK>_MODEL` / `_PROVIDER` / `_PROFILE` / `_PROFILE_JSON` / `_BASE_URL` / `_API_KEY` | Override per task; task: `EXTRACT`, `EXTRACT_ECONOMY`, `RESOLVE`, `FACTS`, `DIGEST` |
| `EMBEDDING_BASE_URL`, `EMBEDDING_API_KEY`, `EMBEDDING_MODEL` | Endpoint di embedding (misurato con `BAAI/bge-m3`) |
| `EMBEDDING_DIM` | Fisso per installazione (1024 per bge-m3); cambiare modello richiede un re-embed |

Modelli supportati: solo quelli che raggiungono il 95 % nella valutazione (`RESULTS.md`).

## 4. Per persona (API admin, console, o la piattaforma della persona)

Nessuna impostazione di consenso (D50): ogni memoria conserva ciò che il suo client invia; l'interruttore acceso / spento è del client (§8).

| Impostazione | Chi la imposta | Predefinito | Cosa fa |
|---|---|---|---|
| `kind` | la persona sulla sua piattaforma (solo a memoria vuota), o l'admin | `human` | `entity` = memoria di entità, condivisa da chi usa l'account (D48) |
| `displayName` | segue il profilo sulla piattaforma (sincronizzato) | l'id utente del client | Il nome della persona |
| `qualityProfile` | admin | predefinito dell'installazione | §1 |
| `locale`, `timezone` | admin | `it`, `Europe/Rome` | Lingua dei ricordi, date locali e la notte |

## 5. Per client (API admin o console)

| Impostazione | Predefinito | Cosa fa |
|---|---|---|
| `kind` | — | `platform`, `mcp_client`, `import` |
| `autoProvision` | off | Crea una persona al primo contatto di un nuovo utente |
| `rawLogScope` | `own` | Estratti del registro grezzo solo dalle conversazioni di questo client, o da tutte |
| `disabled` | off | Tutte le chiavi e i token del client smettono subito di funzionare |
| Permessi delle chiavi | — | `ingest`, `mcp`, `read`, `write` (mai admin, impostazioni dell'owner o export) |

## 6. Script di installazione (`deploy/`)

| Variabile | Predefinito | Cosa fa |
|---|---|---|
| `RECORDARE_PORT` | 8090 | Porta del servizio sull'host |
| `RECORDARE_PROJECT` | `recordare` | Nome del progetto Compose (container `<nome>-recordare-1`, …); un altro nome per una seconda installazione sullo stesso host — l'installer si ferma se il nome è già usato da altri file |
| `EMBEDDER_MAX_BATCH_TOKENS` (standalone) | 2048 | Batch dell'embedder bge-m3; ≈ 4,5 GB di RAM a 2048 (il predefinito di text-embeddings-inference, 16384, esaurisce la memoria su un host da 8 GB); i testi più lunghi vengono troncati |
| `RECORDARE_BIND` | `127.0.0.1` | `0.0.0.0` apre API e console admin sulla LAN (ogni rotta richiede comunque una chiave) |
| `ARKIMEDE_NETWORK` | — | Impostata dall'installazione co-ospitata: la rete Docker condivisa con Arkimede |
| `LINK_ARKIMEDE` | yes | L'installer crea il client di Arkimede e scrive il suo `.env` |
| `ARKIMEDE_DIR` (co-ospitato) | ricavata dal backend di Arkimede in esecuzione | La cartella di Arkimede, di cui l'installer aggiorna il `.env` |
| `LLM_API_KEY_FILE` (install.sh) | — | Installazione non interattiva: legge la chiave dell'LLM da questo file (mai sulla riga di comando) |
| `EMBEDDER_IMAGE` (standalone) | immagine CPU 1.9 di text-embeddings-inference per l'architettura dell'host | Impostata dall'installer (`cpu-arm64-1.9` su arm64) |
| `RECORDARE_MEM_LIMIT` (co-ospitato) | `768m` | Limite di memoria del container del servizio accanto ad Arkimede |
| `RECORDARE_DB_PASSWORD`, `POSTGRES_PASSWORD` | generata | Password del database scritta dall'installer (mantenuta quando lo si rilancia) |
| `KEEP` (backup.sh) | 14 | Dump del database conservati |

## 7. Recordare Atlas (`recordare-atlas`, opzionale)

| Variabile | Predefinito | Cosa fa |
|---|---|---|
| `RECORDARE_URL`, `RECORDARE_ADMIN_KEY` | — | Il servizio che legge (la chiave admin resta sul server dell'atlas) |
| `ATLAS_INGEST_TOKEN` | — | Token Bearer che chi invia OTLP deve presentare su `/v1/traces` |
| `ATLAS_HOST`, `ATLAS_PORT` | `127.0.0.1`, 5175 | Indirizzo di ascolto (nel container: `0.0.0.0`) |
| `ATLAS_BIND`, `ATLAS_PUBLIC_PORT`, `ATLAS_NETWORK` | `127.0.0.1`, 5175, — | Compose: binding sull'host (LAN solo su una rete fidata), porta sull'host, rete Docker di Recordare |
| `ATLAS_ALLOWED_HOSTS` | — | Solo server di sviluppo: nomi Host aggiuntivi (es. `host.docker.internal`) |

## 8. Lato client — Arkimede (qualunque client tramite `packages/client`)

| Impostazione | Dove | Predefinito | Cosa fa |
|---|---|---|---|
| `RECORDARE_URL`, `RECORDARE_API_KEY` | `.env` di Arkimede | — | Spento finché non sono impostati entrambi |
| `RECORDARE_OUTBOX_POLL_MS` | `.env` di Arkimede | 3000 | Ogni quanto il worker dell'outbox invia |
| `episodicMemoryEnabled` | Impostazioni → Memoria, per utente | off | L'opt-in della piattaforma, l'unico interruttore acceso / spento (D50): finché è spento non si invia nulla e non viene creata nessuna persona |
| Tipo di memoria | Impostazioni → Memoria, per utente | personale | Personale / condivisa (`PATCH /me {kind}`, solo a memoria vuota) |
| Contesto di memoria | Agenti → agente, per agente | off | Prima di ogni risposta, i ricordi pertinenti di Recordare (`POST api/v1/context`) in fondo al prompt (WORK_PLAN 5.7) · dev set: nessun danno, +3–7 pt; con il prompt dell'agente vocale chiamate ai tool da 9 a 5 su 15. Scelta del client: Recordare serve il blocco quando glielo si chiede (vale la regola del lettore) |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`, `_HEADERS`, `_PROTOCOL`, `OTEL_SERVICE_NAME` | `.env` di Arkimede | off | Tracce OpenTelemetry GenAI verso l'atlas (solo metadati) |
| Politica di consegna della libreria | `packages/client` (`DEFAULT_DELIVERY`) | 12 tentativi, 5 s → 1 h | Tentativi dell'outbox (jitter, `Retry-After`), poi parcheggio |

## 8b. Connettori (`connectors/`, l'elenco completo è nel README di ciascuno)

| Connettore | Dove | Impostazioni principali |
|---|---|---|
| Claude Code | opzioni del plugin (`url`, `token` nel portachiavi); oppure `RECORDARE_URL` / `RECORDARE_TOKEN`, o `~/.config/recordare/claude-code.json` (solo gli hook) | Un token personale con i permessi `mcp`, `ingest`, `read` |
| Codex | `install.sh --url … [--trust]` → `~/.config/recordare/codex.json`, `$CODEX_HOME/hooks.json` e `config.toml` | `RECORDARE_URL`, `RECORDARE_TOKEN`, `RECORDARE_TRUST_HOOKS=1` (= `--trust`), `CODEX_HOME` (predefinito `~/.codex`) |
| OpenClaw | opzioni del plugin | `url`, `apiKey` (predefiniti `RECORDARE_URL` / `RECORDARE_API_KEY`), `users`, `defaultUser`, `autoRecall` (on), `capture` (on), `tools` (on), `groups` (on), `timeoutMs` (3000) |
| Hermes Agent | env o `memory.recordare.*` | `RECORDARE_URL`, `RECORDARE_API_KEY`, `RECORDARE_USER`, `RECORDARE_USER_ALIASES`, `RECORDARE_RECALL` / `_TOOLS` / `_CAPTURE` (on), `RECORDARE_TIMEOUT` (3 s) |
| Proxy di memoria compatibile OpenAI | env | `UPSTREAM_BASE_URL`, `UPSTREAM_API_KEY`, `PROXY_API_KEY`, `RECORDARE_URL`, `RECORDARE_API_KEY`, `RESOLVERS`, `USER_MAP`, `USER_MAP_ONLY`, `DEFAULT_USER`, `OPENWEBUI_JWT_SECRET`, `RECALL_TIMEOUT_MS` (1500), `END_IDLE_SECONDS` (0 = il ritardo di inattività di Recordare), `SKIP_PATTERNS`, `RECALL` / `CAPTURE` (on), `LOG_UPSTREAM` (off), `PORT` (8788), `MAX_BODY_BYTES` (25 MB), `TZ` |

## 9. Spike di valutazione (`spikes/memory-eval/.env`)

`LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` (risposta e giudice), `ENGINE_MODEL`, `ENGINE_NO_THINKING`, `EMBED_MODEL`,
`EVAL_DATASET`, `RECORDARE_URL` / `RECORDARE_ADMIN_KEY` / `RECORDARE_DB_URL` (sistema service), `CONSOLIDATE`,
`AGENT_SYSTEM_FILE` (modalità agente: il prompt di un agente reale), `REASONING_OFF_BODY`, `OPEN_ROUTER_API_KEY`. Le run
dello spike costano denaro: valgono le regole del budget di valutazione in `WORK_PLAN.md`.
