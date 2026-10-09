# Modello dati v1

*Traduzione italiana di [DATA_MODEL.md](DATA_MODEL.md) — la versione inglese è quella di riferimento.*

Stato: **contratti M1, revisione 3** (2026-10-03): applicate le revisioni di coerenza e di sicurezza; le tabelle
del profilo di deployment **public** (`API.md` §0, D33) sono contrassegnate e non costruite nella v1.
Costruito (2026-10-09): le migrazioni in `service/src/db/migrations` (dallo schema iniziale a `MemoryIdentity`) corrispondono a questo documento; le tabelle del profilo public
non sono create, le tabelle contrassegnate **created, unused yet** esistono senza codice che le usi.
Postgres 16 + pgvector ≥ 0.8. Implementa D6–D32 (`EPISODIC_MEMORY_TODO.md`), il modello di identità di
`API.md` e le regole di provenienza / disclosure della visione.

Regola su cosa esiste nella v1 (D28 raffinata): le **colonne sulle righe di memoria** di cui hanno bisogno le fasi successive
(`audience`, `disclosure`, `confidence_of`, `origin`, `stance`, …) sono create e popolate ora,
perché aggiungerle dopo significa un backfill. Le **tabelle intere e i valori di enum** usati solo dalle fasi successive
sono rinviati — aggiungerli dopo è puramente additivo (vedi l'ultima sezione).

Convenzioni: chiavi primarie `uuid` (v7 pianificato; come costruito `gen_random_uuid()`, v4); `timestamptz` ovunque; enum Postgres; le righe di memoria sono
append + link, mai riscritte (D29); `owner_id` su ogni riga di memoria e ogni query filtrata
per esso; comportamento `ON DELETE` delle FK indicato per tabella.

## Panoramica

```
Identity      persons ─ person_aliases       clients ─ api_keys ─ access_tokens ─ oauth_clients
              external_identities ─ link_codes   owners ─ owner_sessions   idempotency_keys   clarifications
Layer 0       conversations ─ conversation_participants ─ messages ─ message_revisions
Layer 1       episodes ─ episode_evidence ─ episode_people ─ plan_events ─ episode_promotions
Layer 2       digests ─ digest_sources
Layer 3       fact_slots ─ facts ─ fact_evidence     notes ─ note_evidence ─ note_changes
Engine        extraction_runs ─ run_outputs   llm_calls   recall_log   forget_tombstones   read_audit
```

## Colonne condivise

**Provenienza** (episodi, fatti, digest):

| Colonna | Tipo | Note |
|---|---|---|
| `origin` | enum `owner_lived \| owner_told \| assistant_stated` | Chi l'ha vissuto / detto (D28, D30, H3). `owner_told` = ciò che l'owner riferisce sugli altri, e i messaggi scritti da altri all'interno degli import dell'owner. `twin_experienced` viene aggiunto con le fasi del twin |
| `stance` | enum `stated \| inferred` | Gli elementi inferiti restano a bassa confidenza / pending (D29) |
| `author_role` | enum `owner \| assistant \| other \| tool` | Chi ha scritto l'evidenza. Gli elementi la cui unica evidenza proviene da messaggi `other` / `tool` (membri di un gruppo, output di strumenti, corpi di mail importate) sono contesto di estrazione, mai `stance: stated`: al massimo `inferred` (fatti: `pending`) — protezione contro l'avvelenamento; il recall li etichetta |
| `confidence` | real 0–1 | |
| `extraction_run_id` | uuid null → extraction_runs (`SET NULL`) | null per gli inserimenti manuali |

**Disclosure** (episodi, fatti, digest):

| Colonna | Tipo | Note |
|---|---|---|
| `disclosure` | enum `owner \| inner \| friends \| acquaintances \| public`, default `owner` | Tetto del livello (livelli della visione) |
| `audience` | uuid[] (id di persone), indice GIN | Persone presenti quando è stato registrato — immutabile (D29); contiene sempre l'owner. **Solo le identità verificate per questo owner** vi entrano; gli assistenti non sono persone |
| `audience_unverified` | text[] | Nomi visualizzati dei partecipanti presenti senza identità verificata (mai usati per divulgare) |
| `confidence_of` | uuid null (id di persona) | La confidenza di una terza parte ("Marco mi ha detto…"): al massimo owner + quella persona, salvo concessione (fase 3) |

**Regola di lettura: per ora nessuna (D50, WORK_PLAN 8.2, 2026-10-09).** Ogni risposta usa tutta la memoria, in ogni
conversazione; `disclosure`, `audience` e `audience_unverified` **continuano a essere scritte** (dati registrati per il
futuro lavoro su privacy e riservatezza, WORK_PLAN 8.12) ma **nessun percorso di lettura filtra su di esse**.
L'isolamento tra memorie resta (ogni lettura è limitata a un solo `owner_id`). *Superata (regola della fase 1)*: le
righe erano restituite solo se l'insieme di chi legge `V` ⊆ `audience` e il livello di ognuno ≥ `disclosure` — senza
livelli, solo quando chi leggeva era esattamente l'owner (le conversazioni condivise non vedevano il diario); le righe
derivate prendevano `audience = ∩ sources`, `disclosure = la fonte più restrittiva` (è ancora così che vengono scritte).

**Tempo.** Le date con precisione grossolana sono memorizzate come **inizio del periodo nel fuso orario dell'owner**
più `date_precision` (day → mezzanotte locale, month → primo giorno, year → 1 gennaio);
le query per intervallo corrispondono per **sovrapposizione** di `[occurred_at, occurred_until o fine del periodo]` con
l'intervallo richiesto.

| Colonna | Tipo | Note |
|---|---|---|
| `occurred_at` / `valid_from` | timestamptz null | Tempo del mondo |
| `occurred_until` / `valid_to` | timestamptz null | Eventi di più giorni / fine di validità |
| `date_precision` | enum `minute \| day \| month \| year \| approximate \| unknown` | Mai fingere precisione |
| `time_expression` | text null | Formulazione originale ("sabato scorso") |
| `recorded_at` | timestamptz | Quando Recordare l'ha appreso |

**Embedding**: `embedding vector(N)`, `embedding_model text`, `embedding_text text`. N è fisso per
installazione (D27). HNSW (`vector_cosine_ops`) interrogato con filtro `owner_id` e scansione
iterativa di pgvector (`hnsw.iterative_scan = relaxed_order`) così che il recall per owner regga nelle
installazioni multi-owner; partizionare per owner se un'installazione diventa grande. <!-- verify: hnsw.iterative_scan
non è impostato da nessuna parte in service/src (main) — non ancora costruito? -->

## Identità

### persons
| Colonna | Tipo | Note |
|---|---|---|
| `id` | uuid | |
| `owner_scope` | uuid null → owners | **null per la riga propria di una memoria; obbligatorio per ogni altra persona (un contatto)** — un contatto appartiene a una sola memoria, mai condiviso tra memorie (constraint trigger differito `persons_scope_required`, controllato al commit) |
| `display_name` | text | Una memoria auto-provisionata da un client prende all'inizio il nome dell'id utente del client; poi il client lo tiene allineato (`PATCH api/v1/me`). Un contatto: il nome con cui è stato visto o nominato la prima volta |
| `full_name` | text null | Contatti: il nome completo quando noto (8.3: solo la colonna, ancora nulla la riempie) |
| `relation` | text null | Contatti: la relazione con il sé della memoria — sorella, collega, capo… (8.3: solo la colonna) |
| `created_at` | timestamptz | |

Il tipo della memoria è passato a `owners.mode` (migrazione `MemoryIdentity`, D50); `persons.kind` non esiste più.

L'unione di persone **non è supportata nella v1** (un tentativo di collegare un'identità già legata a un altro
owner viene rifiutato); una futura unione dovrà rimappare gli array `audience` e le FK in un'unica transazione.

### person_aliases
`id, owner_id, person_id, alias text, alias_norm text (pg_trgm GIN), source enum
(extracted|manual|client), created_at`, unique `(person_id, alias_norm)` — i nomi di un contatto (nome, soprannomi,
"mia sorella"…). `alias_norm` = `lower(unaccent(btrim(alias)))`. Come costruito (8.3) ogni contatto ha il suo nome
visualizzato come alias (`client` quando creato da un partecipante identificato dal client, `extracted` quando lo
scrittore lo ha creato per nome); la regola del soggetto degli episodi li legge. Gli episodi tengono ancora le persone
come stringhe "Nome (relazione)" (`episode_people.alias`), che il recall consapevole delle persone legge (D39).

### owners
| Colonna | Tipo | Note |
|---|---|---|
| `person_id` | uuid PK → persons | |
| `email` | text unique null | Login dell'owner (magic link, `API.md` §1) — usato solo dal profilo public |
| `locale`, `timezone` | text | Default `it`, `Europe/Rome`; l'API admin accetta `it` / `en`. La lingua formatta solo le date e gli avvisi del recall: gli aiuti linguistici deterministici (periodi, mesi, parentele, nome dell'owner — `service/src/lang`, le 25 lingue più usate) applicano tutte le lingue insieme |
| `consolidated_at` | timestamptz null | Ultimo consolidamento notturno (M5) |
| `facts_reviewed_upto` | timestamptz null | Watermark della revisione notturna dei fatti (WORK_PLAN 5.6, sull'orologio di registrazione) |
| `quality_profile` | text null (`economy` / `balanced` / `full`) | D35; null = default dell'installazione (`QUALITY_PROFILE`) |
| `mode` | enum `personal \| entity`, default `personal` | D50: `personal` — ciò che arriva senza identità dichiarata è del sé della memoria (il titolare dell'account è l'"io"); `entity` (D48) — un dispositivo condiviso, un robot o un luogo: ciò che arriva non dichiarato è di "qualcuno". Il client lo cambia solo finché la memoria è vuota (`PATCH api/v1/me`), l'admin in qualsiasi momento |
| `gender` | enum `masculine \| feminine \| neutral`, default `masculine` | La prima persona nelle lingue con genere (D50; usato dall'8.4 del WORK_PLAN) |
| `created_at` | timestamptz | |

Il ritardo idle è un'impostazione globale (D5), non per owner. Nessuna colonna di consenso (D50): la migrazione
`NoConsent` ha eliminato `episodic_enabled`, `episodic_enabled_at`, `episodic_enabled_by` e `ingest_refused_at` — ogni
memoria conserva ciò che il suo client invia; l'interruttore acceso / spento appartiene alla piattaforma client.

### owner_sessions (public profile)
`id, owner_id, created_at, expires_at, revoked_at, user_agent` — la sessione di login propria dell'owner sulle
pagine di Recordare (link code, autorizzazione OAuth, diario self-service).

### clients
`id, name, kind enum (platform|mcp_client|import), auto_provision bool, raw_log_scope enum
(own|all, default own), created_at, disabled_at` — `raw_log_scope = own`: il fallback sul log grezzo di
questo client cerca solo nelle conversazioni che questo client ha ingerito (episodi / fatti sono condivisi tra i client
dell'owner; le chat grezze no, a meno che l'owner non lo amplii).

### api_keys
`id, client_id, prefix, hash (argon2id), scopes text[], created_at, last_used_at, revoked_at`
(tabella degli scope: `API.md` §1).

### access_tokens e oauth_clients (parti oauth: public profile)
`access_tokens(id, owner_id, client_id, kind enum (personal|oauth_access|oauth_refresh), prefix,
hash, scopes text[], created_at, expires_at, last_used_at, revoked_at)` — come costruito l'enum `kind` contiene solo
`personal` (i valori OAuth arrivano con il profilo public);
`oauth_clients(id, client_id, redirect_uris text[], registered_at)` (registrazione dinamica MCP).

### external_identities
`id, owner_scope null, person_id, kind enum (account|participant), client_id null, channel text
null, external_id, verified_at null, created_at` (migrazione `MemoryIdentity`, D50):
- **`account`** — l'id utente di un client apre una memoria: `client_id` impostato, `channel` e `owner_scope` null, la
  persona è la riga propria di una memoria; unique `(client_id, external_id)`. L'unico tipo che `OwnerResolver` legge
  (`X-Recordare-User`).
- **`participant`** — dentro la memoria `owner_scope` (obbligatoria), l'id di un partecipante del client (`client_id`)
  o un id di canale (`channel`, esattamente uno dei due) nomina il sé della memoria o uno dei suoi contatti; unique
  `(owner_scope, client_id, external_id)` e `(owner_scope, channel, external_id)`. Non apre mai una memoria: lo stesso
  id utente del client può essere l'account di una memoria e un partecipante (un contatto) in un'altra. L'ingest ne
  crea uno (verificato) quando vede per la prima volta l'identità di un partecipante; un collegamento non verificato
  (admin, `verified: false`) non identifica nessuno.
Solo i collegamenti verificati identificano gli interlocutori ed entrano in `audience`.

### link_codes (public profile)
`id, owner_id, client_id (l'unico client autorizzato a riscattarlo), code_hash, expires_at, used_at,
created_at`.

### idempotency_keys (public profile; la v1 tiene le chiavi di replay in Redis per 24 h)
`credential_id, owner_id, method_path, key, response_hash, response_body, created_at` — unique sulle
prime quattro; conservazione di 24 h.

### Memoria dell'agente (D50, WORK_PLAN 8.3) — progetto approvato 2026-10-09, costruito 2026-10-09 (migrazione `MemoryIdentity1791070000000`)
Una memoria appartiene a un agente: un account del client = una memoria (oggi la riga `owners`; rinominata `memories`
nell'8.10).
- **`owners.mode`** `personal | entity` (da `persons.kind`: human → personal, entity → entity; modificabile solo
  finché la memoria è vuota); **`owners.gender`** `masculine | feminine | neutral`, default **maschile**, per la prima
  persona nelle lingue con il genere (impostato dal client con `PATCH /me`). La riga persona della memoria stessa
  (`persons`, `owner_scope` nullo) porta il nome: in una memoria personale è il nome di "io" — il titolare
  dell'account, che è insieme l'utente e l'agente.
- **Contatti** = le persone che una memoria conosce: righe di `persons` con `owner_scope` = quella memoria
  (obbligatorio per ogni umano che non sia la memoria stessa). Lo stesso umano in due memorie è due contatti non
  collegati (le memorie sono isolate). Un contatto nasce quando un client identifica un partecipante, quando qualcuno
  si presenta o viene riconosciuto (voce, volto), e anche quando una persona è solo **nominata** con un nome ("mia
  sorella Giulia"). Campi del contatto: nomi (`person_aliases`: nome, soprannomi, "mia sorella"…), `full_name` quando
  noto, `relation` rispetto all'io della memoria (sorella, collega, capo…), e i suoi identificativi (identità di
  partecipante, sotto).
- **Stesso nome, due persone** ("Marco"): si decide in quest'ordine — identificativi certi (id del client, impronta
  vocale, volto) → nome e cognome → contesto (relazione, luogo, persone presenti). Le fusioni avvengono solo quando sono
  chiare (stesso nome e stessa relazione); altrimenti due contatti, unibili a mano nel Diario — una fusione sbagliata è
  peggio di un doppione.
- **`external_identities`** ha due tipi: **account** (l'utente di un client apre una memoria — gli attuali
  `client_user`) e **partecipante** (l'id di un partecipante del client, un'impronta vocale, un volto, un canale → un
  contatto di una memoria).
- **I messaggi** registrano chi li ha detti, come conoscenza: `author_kind` `self | contact | someone | agent | own |
  tool`, `author_person_id` (il contatto), `attribution_method` `account | declared | self_introduction |
  addressed_by_name | voiceprint | face | client_assertion | none`, `attribution_confidence` 0–1. Nella modalità
  personale la distinzione persona / assistente è solo conoscenza: nessuna logica la usa (D50).
- **Ingest**: un messaggio può avere `own: true` (dell'agente: conoscenza che gli viene data, sue percezioni, un
  documento) → `author_kind = own`; le fonti di conversazione aggiungono `document`, `perception`, `ambient`.
- **Soggetto di ogni ricordo** (episodi, fatti, note): `subject_kind` `self | contact | someone | undecided` +
  `subject_person_id`; `undecided` conserva i **contatti candidati** — un'attribuzione ambigua non viene mai indovinata.
- **`clarifications`** (la prima iniziativa di Recordare, livello L1 della visione): `id, memoria, domanda, candidati
  (contatti), episodio / fatto / nota interessato, stato open | resolved | expired, created_at, resolved_at`. Il
  contesto di memoria offre all'agente al massimo una domanda aperta pertinente ("se è naturale, chiedi: quale Marco —
  il collega o il cugino?"); la risposta la chiude alla prossima estrazione aggiungendo l'attribuzione (il ricordo non
  viene riscritto); le domande senza risposta scadono; il Diario può risolverle a mano. Il comportamento è nell'8.4 /
  8.5 (cambio di prompt, misurato).
- Migrazione dei dati esistenti (prima un backup): personale — i messaggi della persona `self`, quelli dell'assistente
  `agent`, episodi / note / fatti `self`; entità — i messaggi `someone` salvo un autore già noto, gli episodi il contatto
  quando nominano una sola persona nota, altrimenti `someone`, i fatti mantengono il loro soggetto; i contatti mancanti
  vengono creati (per esempio Andrea dentro la memoria Arkim3de). Prompt e valori di `origin` non cambiano nell'8.3 (la
  prima persona arriva nell'8.4).

**Come costruito (8.3).** Tabelle e colonne: `owners.mode` / `gender`; `persons.full_name` / `relation` e il trigger
sull'ambito; `person_aliases.source` + `client`; `external_identities.kind` `account | participant`;
`messages.author_kind` / `attribution_method` / `attribution_confidence`; sorgenti `document`, `perception`, `ambient`;
`subject_kind`, `subject_person_id`, `subject_candidates` su episodi, fatti, note; `clarifications`. Regole:
- *Attribuzione all'ingest* — `own: true` (solo su messaggi `user` / `other`) → `own`; `tool` → `tool`; `assistant` →
  `agent` (metodo `client_assertion`, confidenza 1); un messaggio il cui `authorRef` nomina un partecipante prende
  l'attribuzione del partecipante; altrimenti un messaggio `user` è `self` in una memoria personale (metodo `account`) e
  `someone` in una memoria di entità (metodo `none`), ogni altro `someone`. Partecipanti: `assistant` → agent; `owner` →
  `self` in una memoria personale (implicito quando manca; una memoria di entità non ne implica nessuno); con
  un'identità → risolto in questa memoria (l'id utente dell'account stesso → `self`; un'identità di partecipante → la sua
  persona; vista per la prima volta → un nuovo contatto + alias + identità di partecipante verificata; metodo
  `client_assertion` per un id utente del client, `declared` per un id di canale; un collegamento non verificato →
  `someone`).
- *Soggetti* — personale: ogni episodio, fatto, nota è `self`. Entità: un fatto con un soggetto → quel `contact`
  (trovato per nome visualizzato o creato, come prima), senza → `self` (dell'entità stessa); un episodio → il `contact`
  quando le sue persone nominano esattamente un contatto noto (nome visualizzato o alias, tolta la "(relazione)";
  `episode_people.person_id` impostato per un nome non ambiguo), altrimenti `someone`; una nota → `someone`. Mai
  `undecided` per ora. Le scritture esplicite (`log_episode`, `remember`) seguono le stesse regole; correzioni e copie di
  piani mantengono il soggetto della riga da cui derivano.
- *Prompt invariati* — gli input di estrazione / fatti / revisione etichettano ancora chi parla dall'account `owner`
  (personale) / `person` (entità): un messaggio è di chi parla dall'account quando il suo ruolo è `user`, il suo tipo di
  autore è `self` o `own`, o il suo `authorRef` è il partecipante `owner` della conversazione (SQL `accountSpeaker`); il
  gate, `author_role` e l'`authorRole` del log grezzo usano lo stesso test.
- *Backfill* — come il progetto sopra; in più: le persone di nessuna memoria (owner_scope null, non una memoria)
  referenziate in una memoria diventano contatti lì, poi vengono eliminate con le loro identità (anche quelle mai
  referenziate); un id di account legato a un contatto diventa un id di partecipante della sua memoria; un id di canale
  senza ambito prende la memoria della sua persona; i messaggi `user` personali senza autore prendono il sé; il
  partecipante `owner` delle conversazioni di entità perde l'entità come persona. `down` ripristina la forma precedente
  (gli id di partecipante di un client vengono eliminati; i contatti restano).

**Come costruito (8.4, prima persona personale — `extract.v12`, `facts.v2`; migrazione `ContactClarification1791080000000`).** Solo memorie
personali; le memorie di entità mantengono le regole della 8.3 e input dei prompt identici byte per byte fino alla 8.5.
- *Voce* — ogni episodio, nota e piano di una memoria personale è scritto in **prima persona**, nella lingua della
  conversazione, con `owners.gender` per l'accordo; i turni non dichiarati del titolare dell'account e quelli
  dell'assistente sono entrambi "io", senza distinzione nel testo (chi l'ha detto resta in `messages.author_kind` /
  `author_role` / `origin`, come dato). Il contenuto esterno (web, strumenti, file) è qualcosa che "io" ho imparato (la
  regola delle notizie di extract.v11 e l'esclusione di ciò che altri affermano sul sé restano). Il prompt riceve i nomi
  del sé (`ME`: nome visualizzato + alias, con il genere), `MEMORY LANGUAGE`, i contatti che riguardano la finestra
  (`PEOPLE I KNOW`, numerati C1…: nominati nella finestra, i suoi partecipanti, i soggetti dei fatti elencati, i
  candidati delle domande aperte; al massimo 30) e le domande aperte (`OPEN QUESTIONS`, Q1…, al massimo 5). Interlocutori:
  `me`, `me (assistant)`, `me (own)`, `Nome [C3]` (un contatto identificato), `other:Nome` (solo un nome visualizzato),
  `someone`, `tool:x`. I fatti attuali sono elencati per tutti i soggetti (`[me]` / `[Nome]`).
- *Soggetti* — il modello indica il soggetto di ogni episodio, fatto e nota: `me`, un numero C, `Nome (relazione)` o
  `someone`, oppure `undecided` con i numeri C candidati e una domanda. Lo scrittore collega i nomi ai contatti
  (`ContactBook`): i nomi del sé → sé; una sola corrispondenza → quel contatto, salvo che la relazione o il nome completo
  dicano altro (allora un nuovo contatto — nessuna fusione sbagliata); più corrispondenze → ristrette per relazione, poi
  per nome completo, altrimenti `undecided` con tutte; nessuna corrispondenza → un nuovo contatto (`relation`,
  `full_name` per due o più parole con la maiuscola, il nome di battesimo come alias). Le persone degli episodi sono
  collegate allo stesso modo (solo i nomi creano contatti: "amiche del nuoto" no). I fatti di `someone` o di una persona
  indecisa vengono scartati; anche le note di `someone`.
- *Partecipanti identificati* (decisione del titolare 2026-10-09: un nome di battesimo da solo non dice che un
  partecipante è un contatto noto solo per nome — "mia sorella Giulia" e una Giulia che scrive in un gruppo possono essere
  due persone) — un'identità di partecipante vista per la prima volta si **lega** a un contatto esistente solo con una
  prova forte: il suo nome visualizzato è un nome completo (due o più parole) uguale (senza distinzione di maiuscole e
  accenti) al nome visualizzato, al nome completo o a un alias di esattamente un contatto che non ha ancora un'identità.
  Altrimenti un **nuovo contatto**; quando esattamente un contatto senza identità condivide il nome (il nome di battesimo
  del partecipante è uno dei suoi nomi, oppure — per un partecipante con un solo nome — la prima parola di uno di essi;
  mai un contatto il cui nome completo noto differisce da quello del partecipante), una memoria personale apre una
  **chiarificazione "stessa persona?"** (`clarifications.contact_id` = il nuovo contatto, `candidates` = quello noto,
  nessun elemento; la domanda in italiano quando la lingua della memoria è l'italiano, altrimenti in inglese: "Giulia, che
  ha scritto il 22 settembre, è la stessa persona di Giulia (sorella)?", `created_at` = l'ora del primo messaggio del
  lotto). Più contatti di questo tipo: un nuovo contatto e nessuna domanda (niente spam; il Diario può fonderli a mano).
  Le memorie di entità non chiedono mai (fino alla 8.5). Le auto-presentazioni con relazione ("sono Giulia, la sorella di
  Andrea") e gli identificatori riconosciuti sono altre strade (non all'ingest).
- *Provenienza* — ciò che altri dicono del sé resta un'affermazione (`stance = inferred`, fatti in sospeso); ciò che una
  persona dice di sé è `stated` per quel soggetto (la notizia di Giulia, i fatti di Giulia); gli elementi solo da
  strumenti restano `inferred`. La guardia del nome nella finestra si applica ai soggetti (un contatto deve essere
  nominato nella finestra o parlarvi); la guardia anti-eco e le regole sulle evidenze non cambiano.
- *Chiarificazioni* — un episodio o una nota `undecided` riceve una riga `clarifications` (la domanda del modello, oppure
  "Marco? Marco (cugino) / Marco Bellini (collega)" quando non ne ha data una; `created_at` = l'ora dell'ultimo messaggio
  della finestra). Le finestre successive la vedono in OPEN QUESTIONS; una risposta (`answers: [{question, contact,
  evidence}]`) sostenuta dal messaggio di una persona (mai una risposta dell'assistente o uno strumento) e che indica uno
  dei candidati la risolve — insieme a ogni domanda aperta con lo stesso testo e gli stessi candidati: il soggetto
  dell'elemento diventa quel contatto, le persone dell'episodio non collegate con quel nome vengono collegate,
  `resolved_person_id` / `resolution` (il nome del contatto) / `resolved_at` vengono impostati; il testo della memoria
  non viene mai riscritto. Le domande aperte scadono dopo 14 giorni (`CLARIFICATION_TTL_DAYS`, una costante): verificato
  all'estrazione (alla data della finestra), in lettura (alla data della richiesta) e dalla consolidazione notturna. Una
  domanda "stessa persona?" è elencata come `Q1: <domanda> (about: C2 — the same person as C1?; answer C1 if yes, C2 if
  not)` (entrambi i contatti sono in PEOPLE I KNOW) e ha risposta allo stesso modo: il contatto noto → i due vengono
  **fusi** (`resolution` `same person`); il nuovo contatto stesso → restano separati (`different person`). Il Diario /
  l'admin la risolveranno con la stessa funzione (`resolveClarification`).
- *Fusione* (`service/src/engine/contacts.ts` → `mergeContacts`, un solo punto) — il nuovo contatto viene fuso in quello
  noto: ogni riferimento si sposta (identità di partecipante, alias — i duplicati eliminati —,
  `conversation_participants`, `messages.author_person_id`, `episode_people`, `subject_person_id` / `confidence_of` /
  `subject_candidates` / `audience` su episodi, fatti, note (e `audience` sui digest), candidati / `resolved_person_id` /
  `contact_id` delle chiarificazioni), `full_name` e `relation` restano quelli del contatto noto o vengono presi da quello
  fuso; un fatto a valore singolo attuale per entrambi tiene il più recente (il più vecchio diventa `superseded`); un
  elemento indeciso tra i due diventa del contatto fuso e una domanda aperta rimasta con un solo candidato viene risolta;
  poi la riga fusa viene eliminata. Il testo della memoria non viene mai riscritto.
- *Gate* — una finestra personale costa una chiamata quando parla chiunque tranne l'assistente o uno strumento (il sé,
  un contatto, qualcuno, contenuto proprio); un contatto identificato inviato come `user` con il suo `authorRef` è quel
  contatto, non il sé (SQL `memorySpeaker`, usato anche dalla ricerca nel log grezzo e dalle scritture MCP).
- *Rilevatore di fughe* (sostituisce `nameOwner` della 4.11, rimosso) — `extraction_runs.summary.leaks` conta gli episodi
  e le note scritti che parlano ancora del sé in terza persona (uno dei suoi nomi, o un sostituto come "the user",
  "l'utente", "the owner", "the assistant", nelle lingue più usate: `service/src/lang/self.ts`); solo conteggi, con
  `summary.clarifications` (`asked`, `resolved`) e `returned.answers`.

**Come costruito (8.5, agente entità — `extract.v13+entity.v4`, `facts.v2+entity.v4`; nessuna migrazione).** Le memorie di
entità seguono ora lo stesso modello di quelle personali; i prompt personali restano identici byte per byte (`extract.v13`,
`facts.v2`, fissati da un test).
- *Voce* — "io" è l'agente condiviso (un dispositivo, un luogo, un robot, un servizio): le sue risposte e azioni
  (`me (assistant)`), il contenuto che gli è stato dato da tenere (`me (own)`), il suo luogo e ciò che gli appartiene, in
  prima persona con `owners.gender`. Le persone che gli parlano non sono mai "io": chi parla dall'account è `someone`
  finché la conversazione non lo identifica (una presentazione o essere chiamato per nome, per i suoi messaggi successivi,
  mai riportato da un'altra conversazione, mai indovinato); un partecipante con un'identità è `Nome [C3]`. L'"io" di una
  persona si scrive con il suo nome ("Nunzia ha comprato…"), quello di chi non è identificato come "qualcuno…".
- *Prompt* — costruito con le sezioni del prompt personale valide per entrambi (schema di uscita, date, piani, note,
  correzioni) più le proprie sezioni di introduzione, voce, identificazione, episodi, fatti e sicurezza; il messaggio utente
  è quello personale (`ME`, `PEOPLE I KNOW`, `OPEN QUESTIONS`; fatti elencati `[me]` / `[Nome]`).
- *Soggetti* — il `ContactBook` dell'8.4 in entrambe le modalità (la ricerca per nome solo-entità non c'è più); in una
  memoria di entità un episodio o una nota senza soggetto è di `someone`, un fatto senza soggetto è dell'agente (il suo
  luogo: dove sono le chiavi, l'operatore internet). Resta il controllo che ogni persona nominata da un episodio compaia
  nella finestra. Un fatto o una nota di `someone` non viene salvato.
- *Stance e claims* — i turni di chi parla dall'account restano scritti da `owner` (stated); i `claims` nel richiamo sono
  le affermazioni inferred degli altri partecipanti alla conversazione (la regola personale); la notizia di uno strumento è
  un apprendimento dell'agente.
- *Richiamo* — `speaker` in ogni risultato: un contatto identificato, altrimenti `self` (personale) o `someone` (entità,
  con una nota che "io" nella domanda è chi parla, non l'agente); le domande di chiarimento ("quale Marco?", "stessa
  persona?") nascono anche nelle memorie di entità — all'ingest e all'estrazione — ma sono offerte solo a chi si è
  identificato.
- *Gate* — una regola per entrambe le modalità: una chiamata quando parla chiunque non sia l'assistente o uno strumento.

## Layer 0 — log grezzo

### conversations
| Colonna | Tipo | Note |
|---|---|---|
| `id`, `owner_id`, `client_id` | uuid | Unique `(client_id, owner_id, external_id)` |
| `external_id` | text | |
| `source` | enum `chat \| voice \| mcp_tool \| import_chat \| import_social \| import_email \| import_notes \| interview \| document \| perception \| ambient` | `mcp_tool` = conversazione sintetica che contiene le chiamate di strumento del livello basic; `document` / `perception` / `ambient` (D50): un documento dato all'agente, ciò che un dispositivo percepisce, l'ascolto continuo |
| `channel`, `title` | text null | |
| `started_at`, `last_message_at` | timestamptz | |
| `idle_job_at` | timestamptz null | Quando è dovuta l'estrazione idle |
| `deleted_at` | timestamptz null | |

### conversation_participants
`conversation_id, person_id null, role enum (owner|assistant|other), display_name, ref text,
joined_at` — fonte dell'`audience` di ogni riga (registrata; dal D50 nessuna lettura filtra su di essa).

### messages
| Colonna | Tipo | Note |
|---|---|---|
| `id`, `conversation_id`, `owner_id` | uuid | Unique `(conversation_id, external_id)`; indice `(owner_id, sent_at)` |
| `external_id` | text | |
| `role` | enum `user \| assistant \| tool \| other` | I messaggi `system` **non sono ingeriti** (possono contenere segreti); `tool` = chiamate / risultati di strumenti dei client agentici (D30) |
| `tool_name` | text null | Per `role = tool` |
| `author_person_id` | uuid null | Il sé della memoria (`self`) o il contatto (`contact`); per `own` il partecipante che l'ha fornito, se c'è |
| `author_ref` | text null | Il ref del partecipante del client; nomina i membri di gruppo non verificati per l'estrazione |
| `author_kind` | enum `self \| contact \| someone \| agent \| own \| tool` | Chi l'ha detto, come conoscenza (D50): il sé della memoria, un contatto identificato, un qualcuno non identificato, l'assistente, il contenuto proprio dell'agente (`own: true`), uno strumento |
| `attribution_method` | enum `account \| declared \| self_introduction \| addressed_by_name \| voiceprint \| face \| client_assertion \| none` | Come è stata stabilita; come costruito si scrivono solo `account`, `declared`, `client_assertion`, `none` |
| `attribution_confidence` | real 0–1 null | null quando nulla è stato stabilito (`none`) |
| `content` | text | Verbatim |
| `content_hash` | bytea | Rileva i re-invii con contenuto modificato (`API.md` §2) |
| `sent_at` | timestamptz | Tempo di riferimento per la risoluzione delle date |
| `received_at` | timestamptz | |
| `extracted_run_id` | uuid null → extraction_runs | **null = estrazione in attesa**; i job idle / notturni prendono i messaggi in attesa per `sent_at`, così i messaggi in arrivo in ritardo (import, batch fuori ordine) non vengono mai saltati |
| `edited_at` | timestamptz null | Testo precedente in `message_revisions(message_id, content, replaced_at)` |
| `tsv` | tsvector | Generato `to_tsvector('simple', content)`, GIN (l'estensione `unaccent` è creata ma non ancora usata) |
| `embedding` | vector(N) null | Solo fallback sul log grezzo (D13); calcolato in modo asincrono dopo l'ingest, per i messaggi non dell'assistente |

## Layer 1 — episodi

### episodes
| Colonna | Tipo | Note |
|---|---|---|
| `id`, `owner_id` | uuid | |
| `kind` | enum `event \| plan \| state_change` | `thought` / `goal` aggiunti con il track R |
| `content` | text | Autosufficiente, date assolute |
| *time* | | `occurred_at`, `occurred_until`, `date_precision`, `time_expression`, `recorded_at` |
| `place` | text null | |
| `importance` | smallint 1–10 | |
| `valence` | smallint −2…2 null | D21 |
| `feelings`, `opinion` | text[], text null | D21 |
| `keywords`, `context`, `tags` | text[], text, text[] | Chiavi di recupero, stessa chiamata di estrazione (D29) |
| `plan_status` | enum `open \| confirmed \| cancelled \| rescheduled \| unresolved` null | Solo piani. L'annullamento vive **solo** qui (un piano annullato era un piano reale) |
| `plan_status_at` | timestamptz null | |
| `rescheduled_to` | uuid null → episodes (`SET NULL`) | |
| `confirmed_by` | uuid null → episodes (`SET NULL`) | |
| `corrects` | uuid null → episodes (`SET NULL`) | Questa riga corregge una precedente |
| `invalidated_at` | timestamptz null | **Solo per le correzioni**: impostato sulla riga che era sbagliata |
| `duplicate_of` | uuid null → episodes (`SET NULL`) | Collegamento di dedup del consolidamento (stesso evento in più chat); i duplicati sono nascosti dal recall |
| `linked_notes` | text[] | Riferimenti esterni a note semantiche (id A-MEM finché vive nel client — D19, D31) |
| *soggetto* | | `subject_kind` enum `self \| contact \| someone \| undecided` (default `self`), `subject_person_id` uuid null → persons (`SET NULL`), `subject_candidates` uuid[] (i contatti candidati di una riga `undecided`) — di chi è il ricordo (D50, regole in "Memoria dell'agente"); le stesse tre colonne su fatti e note |
| `access_count`, `last_accessed_at` | int, timestamptz | Solo ranking |
| *provenance*, *disclosure*, *embedding* | | |
| `deleted_at` | timestamptz null | Oblio in corso (eliminato da un job). Come costruito l'oblio cancella subito le righe e la colonna non viene mai impostata (le letture la filtrano comunque) |

Indici: `(owner_id, occurred_at) WHERE deleted_at IS NULL AND invalidated_at IS NULL AND
duplicate_of IS NULL`, `(owner_id, kind, plan_status)`, HNSW `embedding`, GIN `tags`, `keywords`,
FTS su `content`.

### episode_evidence
`episode_id (CASCADE), message_id (CASCADE), evidence_kind enum (message|agent_paraphrase),
quote text null, created_at` — ogni episodio ha ≥ 1 riga; la citazione è validata nel codice rispetto
al messaggio prima dell'inserimento (D29). `agent_paraphrase` = `log_episode` di livello basic senza un
messaggio dell'utente da citare (la formulazione dell'agente, mantenuta distinguibile). Late binding: un
`log_episode` di livello full il cui messaggio di conversazione non è ancora arrivato ottiene la sua riga di evidenza quando arriva (non ancora costruito).

### episode_people
`episode_id (CASCADE), alias text, person_id null, role text null`

### plan_events
`id, plan_id → episodes (CASCADE), patch enum (open|confirm|cancel|reschedule|amend|expire),
evidence_message_id null (SET NULL), new_plan_id null, note, created_at, extraction_run_id` —
patch tipizzate; transizioni nel codice (D29). Come costruito, `unresolved` è calcolato al momento della lettura (un piano passato mai
confermato è mostrato come unresolved); nessun job lo scrive e la patch `expire` non è usata. Le patch richiedono evidenza su
quel piano (D37).

### episode_promotions (D20) — created, unused yet (WORK_PLAN 5.4)
`id, owner_id, pattern text, episode_ids uuid[], proposed_note_ref text null, status enum
(proposed|confirmed|rejected), created_at, updated_at` — pattern ricorrenti proposti come
note semantiche; esposti ai client come proposte in sospeso (D26).

## Layer 2 — digest

### digests
`id, owner_id, level enum (day|month), period_start date, period_end date, content, version int,
superseded_at null, embedding…, disclosure, audience, extraction_run_id, source_hash, created_at`; `source_hash` =
impronta della versione del prompt e degli elementi da cui il digest è stato scritto (un giorno viene riscritto solo
quando cambiano gli elementi o il prompt — M5, 8.6). Contenuto: il diario dell'agente in prima persona (8.6,
`digest.day.v2` / `digest.month.v2`, `+entity` per le memorie di entità): gli elementi propri della memoria, la notizia che
una persona dà di sé, ciò che uno strumento ha insegnato — mai le affermazioni di altre persone (autore other, inferred);
ogni elemento arriva al prompt con il suo soggetto. Unique
parziale `(owner_id, level, period_start) WHERE superseded_at IS NULL`. La fase 3 richiederà
digest per audience (la regola dell'intersezione rende i giorni a audience mista riservati all'owner).

### digest_sources
`digest_id (CASCADE), episode_id (CASCADE) | source_digest_id (CASCADE)` — obbligatorio.

## Layer 3 — fatti (D31: slot di stato con catena di valori)

I fatti di Recordare sono **slot di stato** con la loro cronologia ("la mia auto", "dove vivo", "datore di lavoro",
"figli"). Le preferenze durevoli e le note semantiche libere restano nella memoria semantica propria del client (A-MEM in Arkimede)
fino alla fase di migrazione di A-MEM.

### fact_slots
Schema degli slot per installazione (idea di Memobase), esteso dall'estrazione con nuove chiavi (snake_case,
riutilizzate tramite l'elenco di chiavi fornito all'estrattore).

`key text PK, description text, cardinality enum (single|multi), update_policy text
(istruzione di merge per l'estrattore), default_disclosure enum, created_at` — la supersessione
si applica solo agli slot `single`; gli slot `multi` accumulano (figli, hobby), e gli elementi escono solo per
dichiarazione esplicita.

### facts
| Colonna | Tipo | Note |
|---|---|---|
| `id`, `owner_id` | uuid | |
| `subject_person_id` | uuid null | null = il sé della memoria. **Memorie di entità (D48)**: la persona a cui il fatto si riferisce (un contatto di quella memoria, trovato per nome o creato dallo scrittore); null = l'entità stessa. Mai impostato in una memoria personale |
| `subject_kind`, `subject_candidates` | | Come sugli episodi (D50): `contact` con un soggetto, altrimenti `self` |
| `key` | text → fact_slots | |
| `value` | text **null** | null solo per `unknown_current` |
| `status` | enum `current \| superseded \| corrected \| unknown_current` | `unknown_current` è una **nuova riga** (value null) che supera quella obsoleta: "il valore attuale non è noto" (D29, STALE) |
| *time* | | `valid_from`, `valid_to`, `date_precision`, `time_expression`, `recorded_at` |
| `expired_at` | timestamptz null | Quando Recordare ha smesso di crederlo |
| `supersedes`, `corrects` | uuid null → facts (`SET NULL`) | |
| `verdict` | enum `new \| keep \| stale \| replace \| corrects \| unknown` | Verdetto al momento della scrittura (D29) |
| `support_count` | int | Riaffermazioni contate (Graphiti) |
| `pending` | bool | Inferito / promosso, in attesa di conferma dell'owner; escluso dal recall salvo richiesta |
| *provenance*, *disclosure*, *embedding* | | |
| `deleted_at` | timestamptz null | |

Unique parziale `(owner_id, subject_person_id, key) WHERE status = 'current' AND key is single`
(applicato tramite trigger su `fact_slots.cardinality`). Supersessione solo in avanti per tempo del mondo / del messaggio.
`derivedFrom` / `needsRecheck` (D29) sono rinviati finché qualcosa non produce fatti derivati.

`fact_evidence(fact_id CASCADE, message_id null CASCADE, episode_id null CASCADE, quote)`.

### notes (D34)
Note semantiche: chi è l'owner, oltre gli slot di stato.

| Colonna | Tipo | Note |
|---|---|---|
| `id`, `owner_id` | uuid | |
| `category` | enum `preference \| habit \| value \| relationship \| knowledge \| profile \| constraint` | |
| `content` | text | Frase breve e autosufficiente |
| `keywords`, `context`, `tags` | text[], text, text[] | Chiavi di recupero (stessa chiamata di estrazione) |
| `pinned` | bool | Sempre parte del blocco di contesto stabile (scelta dell'owner) |
| *soggetto* | | `subject_kind`, `subject_person_id`, `subject_candidates` come sugli episodi (D50): `self` in una memoria personale, `someone` in una memoria di entità |
| `status` | enum `current \| superseded \| corrected` | Cronologia conservata, mai riscritta |
| `supersedes`, `corrects` | uuid null → notes (`SET NULL`) | |
| `support_count` | int | Riaffermazioni contate |
| `pending` | bool | Le note inferite attendono conferma; escluse dal recall salvo richiesta |
| *time* | | `valid_from`, `recorded_at` |
| *provenance*, *disclosure*, *embedding* | | |
| `deleted_at` | timestamptz null | |

`note_evidence(note_id CASCADE, message_id null CASCADE, episode_id null CASCADE, quote)`;
`note_changes(seq bigserial, owner_id, note_id uuid, change enum (created|updated|corrected|
confirmed|forgotten), at)` — il change feed che i client usano per tenere allineate le copie (le note dimenticate sono
eliminate, il feed conserva solo il loro id). Come costruito l'estrazione scrive `created` / `updated` / `corrected` e
`remember` scrive `created`; cancellare, confermare o rifiutare una nota dall'API di lettura (`API.md` §4) non scrive
alcuna voce, e la rotta del feed (`GET api/v1/notes/changes`) non è ancora costruita.

## Contabilità del motore

### extraction_runs
`id, owner_id, conversation_id null, kind enum (extraction|digest|consolidation), window_from
timestamptz, window_to timestamptz, model, provider, prompt_version, status enum
(running|done|failed), error text null (nessun contenuto dell'utente), started_at, finished_at` — una
run `extraction` per finestra produce episodi, patch di piano e candidati di fatto (D32). `summary jsonb null`
(WORK_PLAN 4.12, migrazione `RunSummary`): `{returned: {episodes, plan_patches, facts, notes}, written: {tabella: n},
dropped: {tipo: {motivo: n}}}` — cosa ha restituito il modello, cosa è stato scritto, cosa le regole lato codice hanno
scartato e perché (`no_evidence`, `forgotten`, `recall_echo`, `person_not_named`, `not_about_plan`, `confirm_before_date`,
`no_change`, `not_reasserted_after_recall`, …); solo conteggi, mai testo, così l'oblio resta completo.
`run_outputs(run_id CASCADE, table_name, row_id)` — changelog; righe rimosse dal job di purge.

### llm_calls
`id, owner_id null, client_id null, run_id null, prompt_id, provider, model, input_tokens,
cached_input_tokens, output_tokens, latency_ms, status, created_at` — nessun testo di prompt o di completamento
memorizzato. Aggregato per owner / client / giorno per i budget e il cost gate della CI.

### recall_log
`id bigserial, owner_id → persons (CASCADE), tool, mode null, items, conversation_id null → conversations (SET NULL),
served_at` — una riga per recall servito (`search_episodes`, `search_memory`, un blocco di contesto di memoria prima del
turno: `memory_context`), solo metadati: mai la query, mai i ricordi;
`conversation_id` dice all'estrazione quali conversazioni hanno avuto un recall servito (protezione contro l'eco del recall, D38). Totali lungo tutta la vita per la dashboard degli operatori;
`read_audit` del profilo public (sotto) lo estende con client, visualizzatori e id delle righe restituite.

### forget_tombstones (D16)
`id, owner_id, scope enum (episode|period|conversation|message), episode_fingerprint bytea null,
message_ids uuid[] (i messaggi di evidenza dimenticati, nascosti dalla ricerca nelle chat), period_from, period_to,
conversation_id null, created_at` — controllato **prima di inserire qualsiasi
episodio o fatto** (sweep notturno, ri-estrazione, dedup), così il contenuto dimenticato non ritorna mai.

### clarifications (D50, visione L1; comportamento WORK_PLAN 8.4)
`id, owner_id → owners (CASCADE), question text, candidates uuid[] (contatti), episode_id / fact_id / note_id null
(CASCADE; al più uno), contact_id null → persons (CASCADE; migrazione `ContactClarification1791080000000`: il nuovo
contatto di una domanda "stessa persona?" — allora nessun elemento), status enum (open|resolved|expired) default open,
resolution text null (la risposta così come data: il nome del contatto scelto, oppure `same person` / `different
person`), resolved_person_id null → persons (SET NULL), created_at, resolved_at null (impostato esattamente quando non è
open)`; indice parziale `(owner_id, created_at) WHERE status = 'open'`. Una domanda a cui Recordare vuole una risposta
("quale Marco — il collega o il cugino?", "questa Giulia è mia sorella?"); il contesto di memoria offre al più una
domanda aperta pertinente, la risposta aggiunge l'attribuzione (o fonde due contatti) alla successiva estrazione, quelle
senza risposta scadono, il Diario le risolve a mano.

### read_audit (public profile)
`id, owner_id, client_id, actor enum (client|owner|admin), viewer_ids uuid[], viewer_source enum
(conversation|owner_direct|added_viewers), endpoint, row_ids uuid[], created_at` — quali ricordi
sono stati restituiti a chi e come è stato determinato l'insieme dei visualizzatori (principio 5 della visione, M7). Conservazione
configurabile.

## Oblio e cancellazione (D16)

Costruito (2026-10-08): dimenticare un episodio (MCP `forget_episode`, `DELETE api/v1/episodes/{id}`), la purge
sincrona di messaggio / conversazione, e cancellare un fatto o una nota dal diario (`DELETE api/v1/facts/{id}` /
`notes/{id}`, anche uno in sospeso rifiutato: la riga e le sue evidenze sono cancellate, nessun tombstone — <!-- verify:
un fatto / una nota cancellati possono essere estratti di nuovo dagli stessi messaggi; voluto? -->). Non ancora
costruito (WORK_PLAN 5.5): dimenticare un periodo, ri-verdetto dei fatti sull'evidenza dimenticata, cancellazione degli episodi rimasti
senza evidenza.

- **Dimenticare un episodio**: tombstone + cancellazione dell'episodio, delle sue righe di evidenza, persone, eventi di piano,
  promozioni che lo referenziano; la catena di correzioni (`corrects` in entrambe le direzioni) viene dimenticata
  con esso (come costruito: anche duplicati, l'evento di conferma e le ripianificazioni); i **digest giornalieri e mensili che lo hanno
  usato sono superati** e riscritti dal consolidamento successivo;
  **i fatti la cui evidenza interseca i suoi messaggi vengono ri-verdettati o cancellati** (non ancora costruito); i suoi messaggi
  di evidenza sono **esclusi dal fallback sul log grezzo per id del messaggio** (non per impronta fuzzy) e
  eliminati se l'owner sceglie "dimentica anche la conversazione".
- **Dimenticare un periodo** `[from, to]`: tombstone; abbina gli episodi per `occurred_at` **e** i messaggi
  grezzi per `sent_at`; i messaggi grezzi nel periodo sono **eliminati per default** (`keepRaw: true`
  per conservarli); i digest del periodo sono ricalcolati o rimossi.
- **Cancellare un messaggio / conversazione** (richiesta del client): purge delle righe grezze e delle revisioni; per ogni
  episodio / fatto che lo cita, **si elimina la riga di evidenza**; una riga rimasta senza evidenza viene cancellata (non ancora costruito);
  nessuna ri-estrazione (potrebbe riscrivere i ricordi).
- Il job di purge rimuove anche: `messages.embedding`, `message_revisions` (anche nel forget-period),
  `embedding_text`, citazioni, righe `run_outputs`. I job in coda portano **solo id, mai contenuto**;
  `extraction_runs.error` e `llm_calls` non contengono mai contenuto dell'utente.
- (Public profile) **Backup**: le righe dimenticate scompaiono dai backup entro una finestra configurata (default 30 giorni,
  mostrata all'owner). I **log dei provider LLM** sono fuori dal controllo di Recordare: la pagina dell'owner indica
  quale provider elabora i suoi dati e la sua policy di conservazione (profilo provider D27).
- Correzioni e supersessioni conservano la cronologia; l'oblio è fisico.

## Rinviato (additivo in seguito, nessuna migrazione dei ricordi)

Tabelle: `relationships` e `grants` (fase 3), `autonomy_settings` e `snapshots` (track R),
`fact_derivations` + `needs_recheck` (quando esistono fatti derivati). Valori di enum: `origin =
twin_experienced`, `kind = thought | goal`, `owners.mode = synthetic`, `conversations.source =
simulation`, ruolo di partecipante `twin`. Il loro design è registrato in `DIGITAL_TWIN_VISION.md`
(research mode, money knob) e `literature/README.md`.
