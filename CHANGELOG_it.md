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
  tabelle di parentele e dei sostituti in terza persona del sé (rilevatore di fughe, 8.4) per molte lingue.
- **Chiamate per i connettori**: `POST api/v1/ingest/conversations/{id}/end`; `POST api/v1/context {ingest}` (salva il
  turno e restituisce il contesto in una chiamata); i token personali leggono prima che la conversazione sia salvata;
  `TOOLS` (schemi degli strumenti MCP) nella libreria client; i connettori li usano.
- **Diagnostica**: ogni estrazione conserva un riassunto (restituito, scritto, scartato e perché — solo conteggi);
  `GET api/v1/admin/owners/{id}/runs`.

### Modificato
- **Niente più flag di consenso** (D50, WORK_PLAN 8.1) — **incompatibile**. Recordare conserva, estrae e consolida
  sempre ciò che un client invia (sempre zero chiamate LLM quando non c'è nulla da fare); l'interruttore acceso / spento
  appartiene alla piattaforma client, e informare le persone attorno all'agente è compito di chi lo installa. La
  migrazione `NoConsent1791060000000` elimina `owners.episodic_enabled`, `episodic_enabled_at`, `episodic_enabled_by` e
  `ingest_refused_at`; `stored` esce dal risultato dell'ingest; `episodicEnabled` esce da `GET api/v1/me` e dall'API
  admin (con `episodicEnabledAt` e `waitingForConsentSince`); spariscono l'interruttore del consenso e l'etichetta "in
  attesa del consenso" della console; le scritture MCP non rispondono più "memoria spenta". Libreria client: rimossi
  `ConsentState`, `PersonDirectory.knownOff()` e `status()`, `MeResponse.episodicEnabled` e `IngestResult.stored`.
- **Niente più filtro su chi legge** (D50, WORK_PLAN 8.2). Il richiamo MCP (`search_episodes`, `search_memory`) e il
  contesto di memoria (`POST api/v1/context`) rispondono con tutta la memoria in ogni conversazione — conversazioni
  condivise e di gruppo, conversazioni non ancora salvate, nessuna conversazione, lettori aggiunti — invece di niente;
  privacy e riservatezza verranno dopo. `X-Recordare-Viewers` / `_meta.recordare.viewers` sono ignorati e l'avviso
  `"nothing to show here"` non c'è più. `audience` / `disclosure` continuano a essere registrati; una memoria non vede
  comunque mai i dati di un'altra. L'header della conversazione è ancora risolto: le scritture MCP vi legano le loro prove.
- **Identità della memoria** (D50, WORK_PLAN 8.3) — **incompatibile**. Una memoria appartiene a un account di un client;
  le persone che conosce sono contatti di quella sola memoria. Migrazione `MemoryIdentity1791070000000`: `persons.kind`
  diventa `owners.mode` (`personal | entity`) con `owners.gender` (`masculine | feminine | neutral`, default maschile);
  ogni persona che non è una memoria è un contatto di esattamente una memoria (`full_name`, `relation`, nomi in
  `person_aliases`), e i contatti che mancavano a una memoria vengono creati (per esempio una persona con una propria
  memoria che parla anche a un dispositivo condiviso); `external_identities.kind` diventa `account` (era `client_user`:
  apre una memoria) o `participant` (era `channel`, ora anche l'id di partecipante di un client: nomina un contatto
  dentro una sola memoria, creato dall'ingest al primo incontro); ogni messaggio registra chi l'ha detto (`author_kind`
  `self | contact | someone | agent | own | tool`, `attribution_method`, `attribution_confidence`); episodi, fatti e
  note registrano di chi sono (`subject_kind`, `subject_person_id`, `subject_candidates`); viene creata una tabella
  `clarifications` per dopo. API: `GET / PATCH api/v1/me` e le rotte admin degli owner accettano `mode` e `gender` al
  posto di `kind`; `POST api/v1/admin/identities` accetta `kind: account | participant`; l'ingest accetta `own: true`
  su un messaggio (contenuto proprio dell'agente) e le sorgenti `document`, `perception`, `ambient`. La console mostra
  modo, genere, contatti e tipi di identità. Libreria client: `MemoryKind` → `MemoryMode` + `MemoryGender`, `Me.kind` →
  `mode` / `gender`, `MeSettings.kind` → `mode` / `gender`, `Person.kind` → `mode`, `IngestMessage.own`, le nuove
  sorgenti. I prompt di estrazione e i loro input non cambiano.
- **Prima persona nella memoria personale** (D50, WORK_PLAN 8.4) — **incompatibile per i risultati MCP**. Una memoria
  personale è scritta in prima persona (`extract.v12`, `facts.v2`), nella lingua della conversazione e con il genere
  della memoria: il titolare dell'account e l'assistente sono un solo "io". Ogni episodio, fatto e nota riceve un
  soggetto collegato ai contatti della memoria (creati quando una persona è solo nominata, fusi solo quando è chiaro);
  una persona ambigua ("quale Marco?") è salvata come indecisa con una chiarificazione a cui risponde una conversazione
  successiva o che scade dopo 14 giorni; un'identità di partecipante vista per la prima volta si lega a un contatto noto
  solo quando il suo nome completo corrisponde a esattamente un contatto senza identità — con il solo nome di battesimo
  diventa un nuovo contatto con una chiarificazione "stessa persona?", il cui "sì" fonde i due contatti (migrazione
  `ContactClarification1791080000000`: `clarifications.contact_id`). `search_episodes` / `search_memory` restituiscono `memory {name, mode}` (era `owner {name}`),
  il `subject` di ogni elemento (fatti: `subject` sostituisce `about`), `speaker` (chi sta chiedendo; chi è identificato
  riceve per primi i propri elementi) e `clarifications`; in una memoria personale i `claims` sono affermazioni di altri
  su qualcun altro (la notizia che una persona dà di sé è sua, l'output di uno strumento è un apprendimento dell'agente).
  Il contesto di memoria parla all'agente come al sé della memoria, nomina gli elementi delle altre persone e può offrire
  una domanda ("if natural, ask: …"). Le descrizioni degli strumenti parlano della "tua memoria". `nameOwner` è
  sostituito da un rilevatore di fughe (conteggi nel riepilogo dell'esecuzione). Una finestra personale in cui parlano
  solo altre persone ora costa una chiamata di estrazione. Le memorie di entità non cambiano fino alla 8.5. Libreria
  client: `TOOLS` rigenerato.
- **Affermazioni altrui sul sé, datate** (WORK_PLAN 8.4b, `extract.v13`): in una memoria personale ciò che qualcun altro
  dice del sé è un episodio in prima persona con la data in cui è stato detto, chi l'ha detto e dove; il richiamo non
  descrive più i claims come affermazioni solo su altri.
- **Agente entità** (D50, WORK_PLAN 8.5) — **incompatibile per i risultati MCP delle memorie di entità**. Una memoria di
  entità (un dispositivo, un luogo, un robot o un servizio condiviso) è la memoria dell'agente in prima persona
  (`extract.v13+entity.v4`, `facts.v2+entity.v4`): le sue risposte e azioni e il contenuto che gli viene dato (`own`) sono
  "io"; le persone che gli parlano sono contatti per nome, `someone` finché la conversazione non le identifica. Soggetti,
  contatti e domande di chiarimento funzionano come nelle memorie personali (una domanda "quale Marco?" è offerta solo a chi
  si è identificato); `speaker` è in ogni risultato (`someone` per chi non è identificato in una memoria di entità); i
  `claims` seguono la regola personale. Blind8: 82,1 % → 91,4 % (3 run).
- **Il diario dell'agente** (WORK_PLAN 8.6, `digest.day.v2` / `digest.month.v2`, `facts_review.v2`): i riassunti notturni del
  giorno e del mese sono scritti in prima persona dal sé della memoria (personale: la mia giornata, con le notizie delle
  persone che conosco; entità: la giornata dell'agente condiviso), mai dalle affermazioni altrui; una nuova versione del
  prompt riscrive ogni giorno una volta. La revisione notturna dei fatti copre ogni soggetto (i fatti del sé e dei
  contatti). Entrambi restano spenti nel richiamo / per default (nessun guadagno misurato).
- **Fonti apprese** (D49, WORK_PLAN 8.9): la memoria semantica dell'agente — testi che impara (manuali, documenti, pagine,
  appunti; solo testo, il client converte i file) tenuti separati da ciò che ha vissuto, senza limiti di dimensione
  (inviati a parti), brani con embedding in background, chi li ha dati e quando, e l'apprendimento come episodio collegato
  nei due sensi (scritto dall'estrazione della sua conversazione, o dal codice nella lingua della memoria). Nuove route
  REST (`api/v1/ingest/sources`, `api/v1/sources`), strumenti MCP `search_knowledge` e `learn_source`, `sources` sugli
  episodi, un brano nel contesto di memoria; dimenticare una fonte lascia un segno sui suoi episodi. Libreria client:
  `learnSource` (parti automatiche), `forgetSource`, `sources`; `TOOLS` rigenerato. Le richieste più grandi di
  `MAX_REQUEST_BYTES` (16 MB) ricevono 413, il JSON malformato 400 (prima 500).
- **Connettori: una memoria per agente, le persone come partecipanti** (D50) — **incompatibile per le installazioni con
  più persone**. OpenClaw: l'agente del Gateway ha una sola memoria (un token personale, o una chiave client con
  `defaultUser`); ogni mittente è un partecipante con l'identità di canale `<canale>:<senderId>` e il nome che ha sul
  canale, il titolare dell'account sta in `selfSenders` (i turni da CLI e Control UI sono suoi); la mappa `users` è ora
  `memoryPer: "user"`. Hermes Agent: una memoria per l'agente (un token personale, o una chiave client con un
  `RECORDARE_USER` fisso); gli utenti del gateway e l'autore di ogni turno nelle sessioni condivise sono partecipanti
  (`<piattaforma>:<id utente>`, il loro nome), il titolare dell'account in `RECORDARE_SELF_IDS`; memorie per utente con
  `RECORDARE_MEMORY_PER=user`, la mappa di alias dà a una persona un solo id su più piattaforme. Proxy compatibile
  OpenAI: una memoria per proxy (`RECORDARE_USER` o il token personale), gli utenti della piattaforma come partecipanti
  con il loro nome (nome utente di Open WebUI, `X-Recordare-User-Name` di LibreChat, `name=` nel marcatore di
  AnythingLLM), il titolare dell'account in `SELF_USERS`; `MEMORY_PER=workspace` (una memoria per workspace di
  AnythingLLM) o `user` (il comportamento precedente). I turni delle altre persone sono inviati con ruolo `other` e il
  loro autore, così non vengono mai letti come parole del titolare dell'account. Claude Code / Codex: invariati (la
  memoria del token personale), solo testi. Chi aggiorna con una mappatura per persona: imposti `memoryPer: "user"` /
  `RECORDARE_MEMORY_PER=user` / `MEMORY_PER=user`.

### Corretto
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
