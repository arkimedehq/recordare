# Registro delle modifiche

Le modifiche rilevanti di Recordare. Formato: [Keep a Changelog](https://keepachangelog.com/it-IT/1.1.0/); le versioni
seguono il [Semantic Versioning](https://semver.org/lang/it/) (0.x: l'API può ancora cambiare tra versioni minori).
Riferimento inglese: [CHANGELOG.md](CHANGELOG.md).

## [Non rilasciato]

### Aggiunto
- **Budget di costo in CI** (WORK_PLAN 4.4c): `service/test/cost/` misura, per profilo di qualità, le chiamate LLM e i
  token di input di una giornata di riferimento di una persona (per finestra idle, per notte, per mese) e fallisce oltre
  `budget.json`; un aumento voluto si registra nello stesso commit (`COST_BUDGET_UPDATE=1 npx vitest run test/cost`).
- **Il resto dell'API di lettura** (WORK_PLAN 4.7, API.md §4): inserimento manuale (`POST api/v1/episodes`,
  `POST api/v1/notes` — scritti dalla persona, dichiarati), correzioni di fatti e note (`POST …/{id}/corrections`,
  cronologia conservata), un fatto o una nota con le sue prove (`GET api/v1/facts/{id}`, `GET api/v1/notes/{id}`), il
  feed delle modifiche delle note (`GET api/v1/notes/changes?since`, per le piattaforme che ne tengono una copia;
  `replaces` indica la nota di cui una nota aggiornata o corretta ha preso il posto),
  impostazioni (`GET` / `PATCH api/v1/settings`: lingua, fuso orario, profilo di qualità; cambiarle richiede il token
  personale della memoria), uso (`GET api/v1/usage`: chiamate LLM e token per prompt e per giorno) ed export completi
  (`POST api/v1/exports` → `GET …/{id}` → `GET …/{id}/archive`: un archivio JSON, costruito in background, conservato 7
  giorni; token personale). Metodi del client per tutti; migrazione `Exports1791140000000`.
- **Dimenticare un periodo**: `POST api/v1/forget {from, to, keepRaw?}` (client `forgetPeriod`) dimentica gli episodi
  avvenuti nel periodo e i messaggi grezzi inviati in esso (`keepRaw`: conservati ma nascosti e mai più estratti), con
  ciò che solo loro sostenevano; restituisce quanto è stato dimenticato (WORK_PLAN 5.5). Dimenticare un episodio ora
  porta via anche i fatti e le note sostenuti solo dai suoi messaggi (non quelli sostenuti anche da un altro messaggio).
- **Pattern ricorrenti** (WORK_PLAN 5.4, D26): il consolidamento notturno deduce le abitudini che emergono dagli episodi
  degli ultimi mesi ("corro al parco il sabato mattina") e le tiene come note della memoria stessa — inferite, mai in
  attesa, nessuno le conferma — sostenute da almeno tre episodi in giorni diversi; le rafforza, aggiorna e ritira da
  sola, e una dimenticata non ritorna dagli stessi episodi. Le note riportano `pattern` (`GET api/v1/notes`,
  `search_memory`; client `Note.pattern`); il contesto di memoria le etichetta. Opzione `patterns` del profilo di
  qualità (accesa in balanced / full; `PATTERNS` la sovrascrive), task LLM `patterns` (`LLM_PATTERNS_*`), admin
  `POST api/v1/admin/memories/:id/patterns`; migrazione `Patterns1791130000000` (`episode_promotions` ricostruita,
  `memories.patterns_upto`, modifica di nota `retired`). Set di sviluppo: 20 abitudini su 21, nessun pattern falso (3 run).
- **Le identità di canale del titolare con un codice monouso** (D51, WORK_PLAN 8.7): in una memoria personale il titolare
  crea un codice (`POST api/v1/me/link-codes` → `RCD-XXXX-XXXX`, dieci minuti, un solo uso; admin
  `POST api/v1/admin/memories/:id/link-codes`; "Link code" nella console), lo invia all'agente da un canale in una chat
  diretta — il messaggio non viene mai salvato, diventa una richiesta di collegamento — e la conferma entro sette giorni
  (`GET api/v1/me/identities`, `POST …/pending/{id}/confirm`, `DELETE …/pending/{id}`; admin `…/link-claims/:claim`,
  `linkClaims` in `GET admin/persons`; "To confirm" nella console): da allora quel mittente è l'"io" della memoria (i
  messaggi precedenti mantengono la loro attribuzione); `DELETE api/v1/me/identities/{id}` lo scollega. Campo d'ingest
  `conversation.direct` (un gruppo non chiede mai nulla). Libreria client: `linkCode`, `holderIdentities`,
  `confirmHolderClaim`, `rejectHolderClaim`, `unlinkHolderIdentity`, `isLinkCode`, `LINK_CODE_INSTRUCTION`. OpenClaw,
  Hermes e il proxy inviano subito un codice e dicono al modello che cos'è (OpenClaw e Hermes segnano le chat dirette).
  Migrazione `HolderLinks1791150000000`.

### Modificato
- Un partecipante noto che compare con un nome nuovo sul canale (un soprannome diventato nome completo) resta lo stesso
  contatto, e il nome nuovo si aggiunge ai suoi alias, così una ricerca per quel nome lo trova (WORK_PLAN 8.7).
- `PATCH api/v1/me` accetta anche il token personale della memoria (scope `ingest`): un host senza account utente
  (Claude Code, Codex, un connettore con token personale) imposta il genere, e la modalità finché la memoria è vuota,
  senza l'amministratore (WORK_PLAN 8.7).
- Libreria client: `PersonDirectory` tiene il genere allineato al profilo sulla piattaforma come il nome
  (`PlatformUser.gender`; un solo `PATCH api/v1/me` porta entrambi quando cambiano entrambi) (WORK_PLAN 8.7).
- Plugin OpenClaw: i messaggi catturati non inviati aspettano in una coda su disco (`<cartella di stato di OpenClaw>/recordare/outbox`,
  solo per il proprietario, solo i batch non inviati) e vengono ritentati per qualche ora, anche dopo un riavvio del
  Gateway — prima una coda in memoria rinunciava dopo una decina di minuti e perdeva tutto al riavvio (WORK_PLAN 6.6b (5)).
- `/mcp` risponde in JSON semplice (`application/json`) invece che come flusso di eventi: un host o uno script legge la
  risposta senza un parser SSE; i client inviano comunque `Accept: application/json, text/event-stream` (WORK_PLAN 6.6b (10)).
- Prompt di estrazione `extract.v14` (entrambe le modalità, WORK_PLAN 8.11): gli errori dell'agente stesso sono salvati in
  prima persona ("ho sbagliato le date: avevo detto X, è Y"), le alternative confrontate restano accanto alla scelta, e un
  passo di un piano aperto fatto prima della sua data (una prenotazione, dei biglietti) aggiorna il piano. Set ciechi:
  personale 81,6 % → 90,1 %, entità 89,8 % → 93,3 % (`spikes/memory-eval/RESULTS.md`).
- `search_episodes`: una `search` con un periodo restituisce anche fino a 3 episodi pertinenti di fuori in `outsidePeriod`
  (prima: solo quando il periodo non aveva risultati), ordinati solo per pertinenza; gli estratti di chat dietro un episodio corretto portano `correctedBy`.
- Prompt entità `entity.v5` (WORK_PLAN 8.11): ciò che l'agente condiviso ha fatto con quanto qualcuno gli ha passato o
  chiesto (una prenotazione presa, un pagamento registrato) è una sua azione, in prima persona, con chi l'ha chiesta —
  non più "Benedetta ha registrato la prenotazione"; un numero C solo per la persona di cui parla l'elemento. Il writer
  dell'estrazione assegna un episodio il cui soggetto è un contatto elencato mai nominato nella conversazione all'unica
  persona che l'episodio nomina (prima: l'episodio veniva scartato). Set cieco entità: 91,9 % (3 run; la domanda sulla
  prenotazione da 0/3 a 2/3 + 1 parziale).
- Risolutore dei quasi-duplicati `resolve.v2`: di due racconti dello stesso evento nasconde quello che l'altro contiene
  per intero, come indica il modello (prima: sempre il più corto, così un messaggio successivo breve con l'esito —
  "inviato alle 16:10, numero di conferma …" — veniva nascosto); quando ognuno ha qualcosa di suo, restano visibili
  entrambi.
- `search_episodes`: una ricerca (`search`) ordina per sola pertinenza; importanza e recenza decidono solo i pari
  merito (prima pesavano più della pertinenza, così i grandi eventi di una persona spingevano fuori dai risultati il
  piccolo elemento che la domanda nomina). Gli elenchi e `latest` tengono l'ordine di prima. Set ciechi: personale
  90,2 % → 96,0 %, entità 92,2 % → 94,3 % (3 run ciascuno).
- Prompt di estrazione `extract.v15`: l'input dell'estrazione di una chat di gruppo porta il nome del gruppo (il `title`
  della conversazione), così un episodio raccontato lì dice che era in quel gruppo. Il prompt di sistema non cambia.
- `search_episodes`: anche un `list` con una query restituisce fino a 3 episodi pertinenti di fuori periodo in
  `outsidePeriod` (prima: solo `search`): ciò che è stato detto nel periodo è datato da ciò che racconta (un trasloco il
  mese dopo).
- `search_episodes`: gli estratti di chat (`fromChats`) portano `group`, il nome della chat di gruppo, così ciò che
  qualcuno ha scritto e che nessun episodio racconta dice comunque in quale gruppo; la descrizione dello strumento dice
  agli agenti che un intervallo vago ("ultimamente", "in queste settimane") non è un periodo. Set cieco personale
  96,0 % → 97,2 % (3 run; la domanda sui messaggi di un fratello in due gruppi corretta 3 su 3).

### Corretto
- Cancellare un fatto o una nota (`DELETE api/v1/facts|notes/{id}`, o rifiutarne uno in sospeso) lascia un tombstone
  (solo id: chiave dello slot o categoria della nota, soggetto, messaggi di evidenza), così una ri-estrazione degli
  stessi messaggi non lo riscrive più; raccontato di nuovo in un messaggio nuovo, viene imparato (WORK_PLAN 4.13;
  migrazione `FactNoteTombstones1791110000000`).
- Le ricerche vettoriali filtrate per memoria scandiscono gli indici HNSW in modo iterativo (`hnsw.iterative_scan =
  strict_order`, pgvector ≥ 0.8): su un'installazione grande una ricerca poteva restituire meno righe di quelle chieste
  quando altre memorie riempivano l'indice (WORK_PLAN 4.14).
- L'oblio porta con sé ciò che solo esso sosteneva (WORK_PLAN 5.5): cancellare un messaggio o una conversazione, o
  dimenticare un episodio, cancella gli episodi, i fatti e le note rimasti senza evidenza (prima restavano, senza più
  nulla dietro); un piano confermato, annullato o ripianificato da un messaggio cancellato riprende lo stato precedente;
  un fatto o una nota che ne sostituiva uno più vecchio lo fa tornare attuale; i digest costruiti su ciò che sparisce
  vengono riscritti.
- I messaggi rimasti senza estrazione (una chiamata di estrazione fallita, un job di inattività perso) non aspettano più
  il messaggio successivo nella loro conversazione: lo sweep notturno li estrae prima di consolidare (WORK_PLAN 4.1).
- Ciò che l'assistente riporta da uno strumento (una ricerca web, una pagina, un calendario) in quel turno non diventa
  più un fatto o una nota dichiarati della persona: resta in sospeso finché non viene confermato, e un episodio che ne
  deriva è il resoconto dell'assistente (taint del turno, WORK_PLAN 5.7). Prima, una pagina web che diceva "X è
  allergico alle noci", ripetuta dall'assistente, poteva essere salvata come della persona.
- Lo stesso evento raccontato in due conversazioni estratte nello stesso momento, o registrato con `log_episode`, non
  resta più doppio: il consolidamento notturno controlla le coppie che nessun controllo dei quasi-duplicati poteva
  vedere, prima di scrivere il diario (WORK_PLAN 5.3; migrazione `EpisodeResolvedAt1791120000000`; il riepilogo del
  consolidamento conta `duplicates`). Quando nessuno dei due racconti era mai stato controllato, quello che può essere
  nascosto è il registrato dopo (prima dipendeva dall'ordine degli id).

## [0.2.0] — 2026-10-10

La **memoria dell'agente** (D50): ogni memoria appartiene a un agente ed è scritta in prima persona — l'assistente di
una persona (personale) o un agente che usano in tanti (entità, "qualcuno" finché non dice chi è); le persone sono i
suoi contatti; l'agente impara fonti (D49). **Incompatibile**: nessuno stato di consenso in Recordare (l'unico
interruttore è quello del client), "owner" rinominato (memoria / titolare, sotto) — aggiornare la libreria client e i
connettori insieme al servizio. Qualità (DeepSeek `deepseek-flash`, `spikes/memory-eval/RESULTS.md`): insieme cieco di
entità 91,4 % (82,1 % nella 0.1.0), insieme cieco personale 90,9 %, fonti apprese (insieme di sviluppo) 96,7 %.

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
  `GET api/v1/admin/memories/{id}/runs`.

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
  diventa `memories.mode` (`personal | entity`) con `memories.gender` (`masculine | feminine | neutral`, default maschile);
  ogni persona che non è una memoria è un contatto di esattamente una memoria (`full_name`, `relation`, nomi in
  `person_aliases`), e i contatti che mancavano a una memoria vengono creati (per esempio una persona con una propria
  memoria che parla anche a un dispositivo condiviso); `external_identities.kind` diventa `account` (era `client_user`:
  apre una memoria) o `participant` (era `channel`, ora anche l'id di partecipante di un client: nomina un contatto
  dentro una sola memoria, creato dall'ingest al primo incontro); ogni messaggio registra chi l'ha detto (`author_kind`
  `self | contact | someone | agent | own | tool`, `attribution_method`, `attribution_confidence`); episodi, fatti e
  note registrano di chi sono (`subject_kind`, `subject_person_id`, `subject_candidates`); viene creata una tabella
  `clarifications` per dopo. API: `GET / PATCH api/v1/me` e le rotte admin delle memorie accettano `mode` e `gender` al
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
- **Niente più "owner"** (D50, WORK_PLAN 8.10) — **incompatibile**: una memoria è una memoria, e la persona a cui
  appartiene una memoria personale è il suo titolare (`holder`). La migrazione `Memories1791100000000` rinomina sul posto
  (nessuna modifica ai dati oltre ai valori rinominati): tabella `owners` → `memories`; ogni colonna `owner_id` e
  `persons.owner_scope` / `external_identities.owner_scope` → `memory_id`, con indici e vincoli rinominati allo stesso
  modo (per esempio `facts_owner_key_idx` → `facts_memory_key_idx`); il valore enum `owner` → `holder` per il ruolo del
  partecipante, il ruolo dell'autore e il livello di disclosure, le origini `owner_lived` / `owner_told` →
  `holder_lived` / `holder_told`, il ref del partecipante implicito `owner` → `holder`; scope dei token `owner_settings`
  → `memory_settings`; marcatore del gate delle esecuzioni di estrazione `gate:no-owner-message` →
  `gate:no-holder-message`. API: `ownerId` → `memoryId` ovunque (REST, `GET api/v1/me`, MCP, telemetria); nell'ingest
  `participants[].role` e `authorRole` accettano `holder`; rotte admin `api/v1/admin/owners…` → `api/v1/admin/memories…`
  (compresa `GET api/v1/admin/memories/:id/atlas`); flusso di telemetria `?owner=<id>` → `?memory=<id>`; `GET
  api/v1/me` `via` `owner_token` → `memory_token`; risoluzione della conversazione `owner_direct` → `memory_direct`.
  Contratto di Atlas **v2** (`docs/ATLAS_EVENTS_it.md`): gli eventi portano `memoryId`, lo snapshot `memory {id, name}`,
  le rotte admin qui sopra. Libreria client: `memoryId` (per esempio `people.refresh()` → `{ memoryId, mode, atlasUrl
  }`), ruolo `holder`; i connettori inviano il titolare dell'account come partecipante `holder`. Client e connettori 0.1.0
  non funzionano con questa versione: vanno aggiornati insieme al servizio. L'header `X-Recordare-User` e i prompt non
  cambiano.

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
