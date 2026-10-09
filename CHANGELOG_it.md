# Registro delle modifiche

Le modifiche rilevanti di Recordare. Formato: [Keep a Changelog](https://keepachangelog.com/it-IT/1.1.0/); le versioni
seguono il [Semantic Versioning](https://semver.org/lang/it/) (0.x: l'API può ancora cambiare tra versioni minori).
Riferimento inglese: [CHANGELOG.md](CHANGELOG.md).

## [Non rilasciato]

### Aggiunto
- **Notizie ricevute come ricordo** (`extract.v11`): una notizia che tocca la vita della persona (un piano aperto, una
  persona che conosce, una cosa che possiede, o una sua reazione) diventa un episodio a bassa importanza con entrambe le
  date; le curiosità restano nel log delle chat.
- **Contesto di memoria**: ogni frase del messaggio viene confrontata anche da sola, e un periodo nominato nel messaggio
  (in qualsiasi lingua supportata, giorni della settimana compresi) aggiunge gli episodi di quel periodo; soglie
  configurabili (`CONTEXT_MIN_*_SIMILARITY`).
- **Lingue**: `service/src/lang` — espressioni di periodo e nomi di mesi / giorni da Intl per 25 delle lingue più usate;
  tabelle di parentele e del nome della persona per molte lingue.
- **Chiamate per i connettori**: `POST api/v1/ingest/conversations/{id}/end`; `POST api/v1/context {ingest}` (salva il
  turno e restituisce il contesto in una chiamata); i token personali leggono prima che la conversazione sia salvata;
  `TOOLS` (schemi degli strumenti MCP) nella libreria client; i connettori li usano.
- **Diagnostica**: ogni estrazione conserva un riassunto (restituito, scritto, scartato e perché — solo conteggi);
  `GET api/v1/admin/owners/{id}/runs`. La console mostra chi attende il consenso.

### Corretto
- Le scritture MCP (`log_episode`, `remember`, `correct_episode`) rispettano il consenso.
- Un fatto breve dentro un messaggio lungo della persona conta come sue parole; "il proprietario" viene sostituito dal
  nome.

## [0.1.0] — 2026-10-08

Prima versione pubblica: il **profilo privato** (un'installazione gestita da qualcuno di cui gli utenti si fidano —
README → Limiti).

### Motore di memoria
- **Log grezzo**: ingest REST delle chat (idempotente, modifiche e cancellazioni, chat di gruppo con partecipanti e
  autori), avvio per inattività della conversazione e consolidamento notturno; nulla viene elaborato senza il consenso
  della persona.
- **Episodi**: una chiamata LLM di estrazione per finestra di conversazione (`extract.v8`) — eventi, piani con il loro
  esito (fatto, annullato, spostato, aperto, irrisolto), cambiamenti di stato, persone, luoghi, sentimenti; bi-temporali
  (quando è successo, quando si è saputo) con la precisione della data; la provenienza (`author_role`, `stance`) tiene
  separato ciò che la persona ha vissuto da ciò che altri affermano; le correzioni rimandano alla versione che
  sostituiscono; l'oblio è definitivo.
- **Fatti** con storia e validità (domande "alla data"), **note** (preferenze, abitudini, conoscenze), **riassunti
  giornalieri e mensili**.
- Protezioni misurate su set ciechi: le affermazioni di altri non diventano fatti della persona; un messaggio di gruppo
  rivolto all'assistente da qualcun altro non è una richiesta della persona; un piano non si conferma prima della sua
  data; un ricordo ripetuto dall'assistente non è una nuova prova; il nome della persona al posto di "l'owner".
- **Memoria di entità** (sperimentale): una memoria per un dispositivo o account condiviso (l'assistente di cucina di
  una famiglia); i fatti portano la persona a cui si riferiscono; chi parla è solo chi si presenta nella conversazione.
- **Profili di qualità** `economy | balanced | full` (costo contro qualità), per installazione con modifica per persona.
- Qualsiasi provider LLM (compatibile OpenAI, Anthropic, Claude CLI; profili per le particolarità dei provider) e
  qualsiasi endpoint di embedding compatibile OpenAI (misurato con BAAI/bge-m3).

### Interfacce
- **MCP** (Streamable HTTP): `search_episodes`, `search_memory`, `resolve_period`, `log_episode`, `remember`,
  `correct_episode`, `forget_episode`; chiavi client che agiscono per i loro utenti, o token personali (Claude Code —
  INTEGRATION §4b, `npm run smoke:mcp`).
- **Contesto di chi legge** in ogni lettura: ciò che si dice in una conversazione con altri partecipanti non arriva mai a
  loro.
- **Contesto di memoria** `POST api/v1/context`: i ricordi rilevanti per la prossima risposta in un unico blocco
  delimitato, senza chiamate LLM.
- **API di lettura** (il diario della persona): linea del tempo, dettaglio dell'episodio con le prove, riassunti, fatti
  a una data, note, piani, e le modifiche della persona (correggere, dimenticare, fissare, confermare, rifiutare).
- **API admin** e **console admin** (`/admin`): persone, consenso, tipo di memoria, client, chiavi, token.
- **Libreria client** `@arkimedehq/recordare-client` (`packages/client`): consegna con ritentativi, rubrica delle
  persone, sessioni MCP, errori RFC 9457; suite di conformità contro il servizio. Pubblicata su npm
  (`@arkimedehq/recordare-client`), insieme al plugin OpenClaw (`@arkimedehq/openclaw-recordare`); il proxy compatibile
  OpenAI come immagine (`ghcr.io/arkimedehq/recordare-openai-proxy`).
- Contratto di telemetria per la vista dal vivo opzionale **Recordare Atlas** (`arkimedehq/recordare-atlas`, solo
  metadati).

### Installazione
- `deploy/install.sh` (guidato, o `--yes` non interattivo), `deploy/update.sh`, `deploy/backup.sh`.
- Profili: **standalone** (Postgres + pgvector, Redis e text-embeddings-inference con bge-m3 propri; ≈ 6 GB di RAM) e
  **co-ospitato** con Arkimede (database e db Redis propri sui servizi di Arkimede). Entrambi provati da capo a fondo.

### Qualità (DeepSeek `deepseek-flash`, 3 run ciascuno, `spikes/memory-eval/RESULTS.md`)
- Nuovo set cieco scritto da un agente separato: **91,3 %** (memoria di persona, 46 domande); memoria di entità 82,1 %.
- Set ciechi precedenti: 90,7 % (blind5); alla pari con un riferimento a contesto completo e davanti a Mem0 su blind4.

### Client
- **Arkimede**: ingest, strumenti di richiamo, contesto di memoria per agente, il Diario, tipo di memoria e consenso
  nelle sue impostazioni.
- **Connettori al livello completo** (cattura + contesto di memoria prima di ogni turno + strumenti di memoria), in
  `connectors/`, ognuno provato dal vero: plugin per **Claude Code** (`/plugin marketplace add arkimedehq/recordare`),
  **Codex** (installer di hook + MCP), plugin per **OpenClaw**, memory provider per **Hermes Agent**, e un **proxy di
  memoria compatibile OpenAI** per le piattaforme senza hook (provato con AnythingLLM; Open WebUI e LibreChat con lo
  stesso meccanismo).
- **Qualsiasi client MCP** al livello basic con un token personale (per esempio Claude Desktop tramite un ponte locale,
  non provato); le scritture di un agente valgono come della persona solo se lo dicono le sue parole recenti.

### Limiti noti
- Ancora nessun login del titolare, OAuth o registro delle letture (profilo pubblico rimandato, D33); HTTP semplice solo
  su una rete fidata.
- Memoria di entità: chi non si presenta può ancora essere attribuito a una persona con nome.
- Claude Desktop / claude.ai: solo livello basic (nessun hook per catturare la conversazione); Desktop richiede OAuth o
  un ponte locale (non provato). Il contesto di memoria manca domande con istruzioni in coda, in altre lingue o su un
  periodo (WORK_PLAN 6.6b) — gli strumenti di memoria no.
