# Manopole — ogni impostazione in un posto solo

*Traduzione italiana di [KNOBS.md](KNOBS.md) — la versione inglese è quella di riferimento.*

Tutte le impostazioni di Recordare, dei suoi componenti opzionali e del lato client: dove si impostano, il valore
predefinito e — per le manopole del motore — se e come sono state misurate. Il costo è un'opzione dell'operatore, mai
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
| `recallDigests` | off | off | off | Il diario notturno dato ai riepiloghi di periodo · blind5 3+3 run: −1,9 pt, nel rumore; diario v2 (8.6, prima persona) set di sviluppo 1 run: nessun guadagno |
| `factsReview` | off | off | off | Revisione notturna dei fatti sui nuovi episodi · nessun guadagno misurato (5.6; v2 con soggetti, 8.6: nessun cambio proposto sui set di sviluppo) |
| `patterns` | off | on | on | Passaggio notturno dei pattern: i pattern ricorrenti (≥ 3 episodi in giorni diversi) diventano note inferite della memoria stessa, che li conferma / aggiorna / ritira · una chiamata per memoria per notte con episodi nuovi · dev_patterns, `patterns.v2`, 3 run: 20 / 21 abitudini, nessun pattern falso (5.4) |
| `initiativeWording` | off | on | on | Iniziative formulate e pesate dal modello (D53, 8.12c, `initiative.v3`, con le ore locali adatte a ciascuna): una chiamata quando ci sono intenti dovuti; sotto worth 0,3 la domanda di un piano viene scartata (mai una richiesta o una promessa); off: la frase del servizio · dev_initiatives 19–20 / 22, ≈ 95 % di precisione (RESULTS.md) |
| `thoughts` | off | on | on | Passata dei pensieri (D53, 8.12a–d): le intuizioni, domande e opinioni proprie dell'agente, le sue note di sé (8.12b) e le procedure (8.12d, come svolge un compito ricorrente, da un esito; dev_procedures, `thoughts.v7`, 3 run: 11 / 14, 10 / 14, 11 / 14, al massimo una falsa), ognuna poggiata sugli episodi che cita, sostenuta / indebolita / ritirata da quelli successivi · una chiamata per memoria quando gli episodi nuovi hanno raccolto un'importanza ≥ 20, nessuna altrimenti · dev_thoughts, `thoughts.v6`, 3 run: 14 / 14, 14 / 14, 13 / 14 pensieri attesi, nessun pensiero falso; il modello di sé (8.12b, tipo `self`, dalle risposte dell'agente e dalle reazioni a esse) dev_self 11–12 / 15 note di sé, nessuna falsa (RESULTS.md) |

Override dell'installazione di singole manopole (vincono su ogni profilo): `EXTRACTION_WINDOW_CHARS`, `FACTS_PASS`,
`RECALL_DIGESTS`, `FACTS_REVIEW`, `PATTERNS`, `THOUGHTS`, `INITIATIVE_WORDING`.

## 2. Servizio (`service/.env`, oppure `deploy/.env` per il servizio installato)

| Variabile | Predefinito | Cosa fa |
|---|---|---|
| `DATABASE_URL`, `REDIS_URL` | — | Postgres (pgvector) e Redis |
| `QUEUE_PREFIX` | `recordare` | Separa installazioni o istanze di valutazione sullo stesso Redis (regola 9: un'istanza per coda) |
| `PORT` | 8080 | Porta HTTP dentro il container |
| `ADMIN_API_KEY` | — | Credenziale admin (≥ 32 caratteri): API admin e console |
| `ATLAS_URL` | — | Dove si apre Recordare Atlas; comunicato ai client in `GET /me` (in Arkimede lo vedono solo gli admin) |
| `MAX_REQUEST_BYTES` | 16 MB (16 777 216) | Corpo JSON più grande accettato in una richiesta (≥ 100 000); oltre → `413` `payload_too_large`. Una fonte appresa più grande arriva a parti (`learnSource` invia parti da 4 MB, `SOURCE_PART_BYTES`); nessun limite per fonte né per memoria (WORK_PLAN 8.9) |
| `IDLE_DELAY_SECONDS` | 900 | Silenzio prima che una conversazione venga estratta (un nuovo messaggio fa ripartire l'attesa) |
| `CONTEXT_MIN_FACT_SIMILARITY`, `…_EPISODE_…`, `…_PLAN_…`, `…_PERIOD_…` | 0.50, 0.55, 0.45, 0.35 | Contesto di memoria (`POST api/v1/context`): similarità minima per fatti e note, episodi, piani imminenti, episodi di un periodo nominato. Soglie più basse (0.45 / 0.48 / 0.42) misurate: nessun guadagno (RESULTS 5.7) |
| `card` (corpo di `POST api/v1/context`) | true (D54) | La scheda di sé in cima al contesto di memoria (WORK_PLAN 8.13): un agente sa sempre chi è; `false` la spegne · misurata su dieci memorie di valutazione: 526 caratteri in media, 600 al massimo (circa 130–150 token) |
| `CONTEXT_MIN_PASSAGE_SIMILARITY` | 0.6 | Contesto di memoria: similarità minima per l'unico passaggio di una fonte appresa che può contenere (tagliato a 300 caratteri, `- learned (from «titolo»): …`; WORK_PLAN 8.9). Primo valore, da misurare |
| `CONTEXT_EMBEDDING_BUDGET_MS` | 1500 | Contesto di memoria: l'attesa massima per i suoi vettori di query; oltre, il blocco contiene solo la scheda di sé (`Nothing else came to mind`, un avviso nel log, `recall.served` con `late`), e i vettori arrivati in ritardo servono lo stesso messaggio la volta dopo (cache delle query). 0 = attesa senza limite (il comportamento precedente). Un provider di embedding ospitato con code lente può volerne di più · misurato sul Kinox (i3-1215U, bge-m3 su CPU): una query da sola 110–150 ms; con un testo lungo già sul server ≈ 1,6 s (a 1000: servito in ≈ 1 s con la scheda); durante i turni a voce, con la CPU condivisa con il riconoscimento vocale, 570–730 ms — 1500 tiene un margine sotto i 2,5 s dell'ospite |
| `CONTEXT_SHORT_QUERY_WORDS` | 4 | Contesto di memoria (D54): un messaggio di al massimo tante parole (segmentazione Intl, ogni lingua: "e lui?", "他呢？") viene confrontato anche insieme al turno precedente della persona nella stessa conversazione; 0 mai · test unitari e di integrazione, non misurato su un dev set |
| `CONSOLIDATION_SCHEDULE` | on | Consolidamento notturno automatico, preceduto dall'estrazione dei messaggi rimasti in attesa (4.1); off = solo su richiesta (valutazioni) |
| `CONSOLIDATION_HOUR` | 3 | Ora locale (fuso della persona) dopo la quale gira la notte |
| `INITIATIVE_DAILY_LIMIT` | 3 | Iniziative che una persona riceve al giorno al massimo (D53, 8.12c); le altre aspettano domani |
| `WEBHOOK_ALLOW_PRIVATE` | false | I webhook possono puntare a indirizzi privati e a http semplice (un client ospitato insieme a Recordare); spento: solo https pubblico |
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
| `LLM_<TASK>_MODEL` / `_PROVIDER` / `_PROFILE` / `_PROFILE_JSON` / `_BASE_URL` / `_API_KEY` | Override per task; task: `EXTRACT`, `EXTRACT_ECONOMY`, `RESOLVE`, `FACTS`, `DIGEST`, `PATTERNS`, `THOUGHTS`, `INITIATIVE` |
| `EMBEDDING_BASE_URL`, `EMBEDDING_API_KEY`, `EMBEDDING_MODEL` | Endpoint di embedding (misurato con `BAAI/bge-m3`) |
| `EMBEDDING_DIM` | Fisso per installazione (1024 per bge-m3); cambiare modello richiede un re-embed |
| `EMBEDDING_QUIET_MS` | Default 10000. Gli embedding interattivi (contesto di memoria, strumenti di richiamo, `remember`) partono subito; quelli in background (messaggi nuovi, ricordi estratti, passaggi, passate notturne) vanno una richiesta alla volta e partono solo dopo tanto tempo senza un embedding interattivo — una conversazione richiede entro pochi secondi, il lavoro in background aspetta la sua pausa — o dopo al massimo 60 s di attesa. 0 = appena nessuna richiesta interattiva è in corso. Durante una conversazione un messaggio diventa cercabile per vettore fino a un minuto dopo (il full-text lo trova nel frattempo). Le configurazioni di valutazione possono usare 0 (il consolidamento su richiesta non aspetta mai) · misurato sul Kinox: la query del contesto durante l'ingest di un turno 4 970 ms → 137 ms |
| `EMBEDDING_BACKGROUND_BATCH_CHARS` | Default 2000. Caratteri per richiesta in background (un testo più lungo va da solo, al massimo 64 testi): una richiesta già su un server seriale non si può interrompere, quindi questo limita l'attesa di una query; su CPU è anche più veloce (nessun padding dei testi corti alla lunghezza del più lungo: l'ingest di un turno 4,9 s → ≈ 2 s sul Kinox). Una GPU o un provider ospitato (paralleli, con limiti per richiesta) possono alzarlo (es. 50000) e impostare `EMBEDDING_QUIET_MS=0` |

Modelli supportati: solo quelli che raggiungono il 95 % nella valutazione — modelli misurati, punteggi e licenze dei pesi in `docs/MODELS_it.md`.

## 4. Per persona (API admin, console, o la piattaforma della persona)

Nessuna impostazione di consenso (D50): ogni memoria conserva ciò che il suo client invia; l'interruttore acceso / spento è del client (§8).

| Impostazione | Chi la imposta | Predefinito | Cosa fa |
|---|---|---|---|
| `mode` | la persona sulla sua piattaforma (solo a memoria vuota), o l'admin | `personal` | `entity` = memoria di entità, condivisa da chi usa l'account (D48, D50): ciò che arriva non dichiarato è di "qualcuno" |
| `gender` | la piattaforma (dal profilo dell'account) o l'admin, in qualsiasi momento | `masculine` | `feminine`, `neutral`: la prima persona nelle lingue con genere (D50; letto dall'8.4 del WORK_PLAN) |
| `displayName` | segue il profilo sulla piattaforma (sincronizzato) | l'id utente del client | Il nome della persona |
| `qualityProfile` | admin | predefinito dell'installazione | §1 |
| `locale`, `timezone` | admin | `it`, `Europe/Rome` | Lingua dei ricordi, date locali e la notte |
| `quietFrom`, `quietTo` | admin | 22, 8 | Le ore di quiete della memoria (locali): nessuna iniziativa scatta al loro interno (D53, 8.12c) |

## 5. Per client (API admin o console — ogni impostazione qui sotto, webhook e canali compresi)

| Impostazione | Predefinito | Cosa fa |
|---|---|---|
| `kind` | — | `platform`, `mcp_client`, `import` |
| `autoProvision` | off | Crea una persona al primo contatto di un nuovo utente |
| `rawLogScope` | `own` | Estratti del registro grezzo solo dalle conversazioni di questo client, o da tutte |
| `disabled` | off | Tutte le chiavi e i token del client smettono subito di funzionare |
| `channels` | `[]` | D55: i canali su cui il client raggiunge una persona, ognuno con il modo — `chat` / `messaging` `always`, `voice` su `presence`; il `channel` di una nuova iniziativa (dove l'orologio può spingerla) è il primo dei suoi `channels` accettabili dichiarato `always` (§5b: messaggistica solo per una richiesta o una promessa). `INITIATIVE_VOICE_PACE_MINUTES` (env del servizio, default 30, in prova, maintainer 2026-11-05; 0 = nessun ritmo): al massimo un annuncio spontaneo — un'iniziativa a voce o un'apertura — per persona ogni tanto (§5c). `INITIATIVE_TIMING` (env del servizio, default `v0`; `v1` corregge v0 con gli esiti di ogni persona — F4, `learning.ts`: accolte detta / chiesta / fatta contro ignorata / rifiutata, per parte del giorno e canale, una stima Beta il cui prior è l'adattamento di v0, forza del prior 2, almeno 3 esiti prima di trattenere sotto 0,35 o di cambiare canale con un margine di 0,2, ultimi 60 giorni; `due` spinge appena dovuta — il confronto di base delle valutazioni). `INITIATIVE_TIMING_SHADOW` (env del servizio, default false): con `v0`, registra accanto a ogni decisione cosa avrebbe deciso `v1` (`features.shadow`), senza cambiare niente. Le soglie di identità 0,6 (medium) / 0,85 (high) sono costanti (`IDENTITY_THRESHOLD`), non ancora misurate; così il tempo v0 (`TIMING`: soglie say 0,5 / ask 0,6, ore preferite say 9–21 / ask 10–20, adattamento fuori orario 0,3, prior di default 0,7, tolleranza a orario e ultima occasione 2 h) — una prima stima, registrata con ogni decisione perché F4 la sostituisca |
| Permessi delle chiavi | — | `ingest`, `mcp`, `read`, `write` (mai admin, impostazioni della memoria o export) |

Webhook (D53, 8.12c): `POST api/v1/admin/clients/{id}/webhooks {url, token?, authentication?, description?, events?}` registra dove un client riceve le iniziative dell'agente (Standard Webhooks, il segreto `whsec_` mostrato una sola volta); `GET …/webhooks`, `DELETE api/v1/admin/webhooks/{id}`. `API.md` §4b.

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
| Contesto di memoria | Agenti → agente, per agente | off | Prima di ogni risposta, i ricordi pertinenti di Recordare (`POST api/v1/context`) in fondo al prompt (WORK_PLAN 5.7) · dev set: nessun danno, +3–7 pt; con il prompt dell'agente vocale chiamate ai tool da 9 a 5 su 15. Scelta del client: Recordare serve il blocco quando glielo si chiede, da tutta la memoria in ogni conversazione (D50) |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`, `_HEADERS`, `_PROTOCOL`, `OTEL_SERVICE_NAME` | `.env` di Arkimede | off | Tracce OpenTelemetry GenAI verso l'atlas (solo metadati) |
| Politica di consegna della libreria | `packages/client` (`DEFAULT_DELIVERY`) | 12 tentativi, 5 s → 1 h | Tentativi dell'outbox (jitter, `Retry-After`), poi parcheggio |
| Dimensione delle parti di una fonte | `packages/client` (`SOURCE_PART_BYTES`, `partBytes` di `learnSource`) | 4 MB | Una fonte appresa più grande viene inviata a parti, tagliate ai confini dei paragrafi (da tenere sotto il `MAX_REQUEST_BYTES` del servizio) |

## 8b. Connettori (`connectors/`, l'elenco completo è nel README di ciascuno)

| Connettore | Dove | Impostazioni principali |
|---|---|---|
| Claude Code | opzioni del plugin (`url`, `token` nel portachiavi); oppure `RECORDARE_URL` / `RECORDARE_TOKEN`, o `~/.config/recordare/claude-code.json` (solo gli hook) | Un token personale con i permessi `mcp`, `ingest`, `read` |
| Codex | `install.sh --url … [--trust]` → `~/.config/recordare/codex.json`, `$CODEX_HOME/hooks.json` e `config.toml` | `RECORDARE_URL`, `RECORDARE_TOKEN`, `RECORDARE_TRUST_HOOKS=1` (= `--trust`), `CODEX_HOME` (predefinito `~/.codex`) |
| OpenClaw | opzioni del plugin | `url`, `apiKey` (predefiniti `RECORDARE_URL` / `RECORDARE_API_KEY`), `memoryPer` (`agent` (D50) \| `user`), `defaultUser` (l'account dell'agente con una chiave client), `selfSenders` (i mittenti del titolare dell'account), `users` (`memoryPer: user`), `autoRecall` (on), `capture` (on), `tools` (on), `groups` (on), `timeoutMs` (3000) |
| Hermes Agent | env o `memory.recordare.*` | `RECORDARE_URL`, `RECORDARE_API_KEY`, `RECORDARE_MEMORY_PER` (`agent` (D50) \| `user`), `RECORDARE_USER` (l'account dell'agente con una chiave client), `RECORDARE_SELF_IDS` (il titolare dell'account), `RECORDARE_USER_ALIASES`, `RECORDARE_RECALL` / `_TOOLS` / `_CAPTURE` (on), `RECORDARE_TIMEOUT` (3 s) |
| Proxy di memoria compatibile OpenAI | env | `UPSTREAM_BASE_URL`, `UPSTREAM_API_KEY`, `PROXY_API_KEY`, `RECORDARE_URL`, `RECORDARE_API_KEY`, `MEMORY_PER` (`instance` (D50) \| `workspace` \| `user`), `RECORDARE_USER` (l'account del proxy con una chiave client), `SELF_USERS` (il titolare dell'account), `RESOLVERS`, `USER_MAP`, `USER_MAP_ONLY`, `DEFAULT_USER`, `OPENWEBUI_JWT_SECRET`, `RECALL_TIMEOUT_MS` (1500), `END_IDLE_SECONDS` (0 = il ritardo di inattività di Recordare), `SKIP_PATTERNS`, `RECALL` / `CAPTURE` (on), `MEMORY_TOOLS` (spento: la carta della memoria per il solo contesto, D54), `LOG_UPSTREAM` (off), `PORT` (8788), `MAX_BODY_BYTES` (25 MB), `TZ` |

## 9. Spike di valutazione (`spikes/memory-eval/.env`)

`LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` (risposta e giudice), `ENGINE_MODEL`, `ENGINE_NO_THINKING`, `EMBED_MODEL`,
`EVAL_DATASET`, `RECORDARE_URL` / `RECORDARE_ADMIN_KEY` / `RECORDARE_DB_URL` (sistema service),
`EVAL_SOURCE_AMBIENT_AS` (sistema service: invia le sessioni `ambient` di un set con questa sorgente, es. `voice` — il
braccio di confronto di WORK_PLAN 6.5), `CONSOLIDATE`,
`AGENT_SYSTEM_FILE` (modalità agente: il prompt di un agente reale), `REASONING_OFF_BODY`, `OPEN_ROUTER_API_KEY`; la matrice dei provider (`provider_eval.py --config profiles/<modello>.json`) legge la chiave di ogni profilo dalla variabile che nomina (`OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `LLM_API_KEY`). Le run
dello spike costano denaro: valgono le regole del budget di valutazione in `WORK_PLAN.md`.
