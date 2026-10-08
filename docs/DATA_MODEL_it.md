# Modello dati v1

*Traduzione italiana di [DATA_MODEL.md](DATA_MODEL.md) — la versione inglese è quella di riferimento.*

Stato: **contratti M1, revisione 3** (2026-10-03): applicate le revisioni di coerenza e di sicurezza; le tabelle
del profilo di deployment **public** (`API.md` §0, D33) sono contrassegnate e non costruite nella v1.
Costruito (2026-10-08): le migrazioni in `service/src/db/migrations` (dallo schema iniziale a `ConsentWaiting`) corrispondono a questo documento; le tabelle del profilo public
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
              external_identities ─ link_codes   owners ─ owner_sessions   idempotency_keys
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

**Regola di lettura, applicata nel codice in ogni percorso di lettura dalla v1** (`API.md` §1 contesto del visualizzatore): le righe sono
restituite solo se l'insieme dei visualizzatori `V` ⊆ `audience` e il livello di ogni visualizzatore ≥ `disclosure`. Nella fase 1
non ci sono ancora livelli, quindi di fatto: **le righe sono restituite solo quando i visualizzatori sono esattamente
l'owner**; qualsiasi altro insieme di visualizzatori non ottiene nulla (le conversazioni condivise non vedono il diario). Le righe derivate prendono
`audience = ∩ sources`, `disclosure = la fonte più restrittiva`; una riga derivata senza fonti fallisce
in modo chiuso. Righe mancanti e vietate restituiscono lo stesso "not found". Le rotte del diario (`API.md` §4) sono
owner-direct: chi legge è l'owner nell'interfaccia dell'host, quindi restituiscono le righe dell'owner senza un insieme di
visualizzatori.

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
| `owner_scope` | uuid null → owners | **null per gli owner stessi; impostato per i contatti** — un contatto appartiene alla memoria di un solo owner, mai condiviso tra owner |
| `display_name` | text | Un owner auto-provisionato da un client prende all'inizio il nome dell'id utente del client; poi il client lo tiene allineato (`PATCH api/v1/me`) |
| `kind` | enum `human \| entity` | `entity` (D48): un owner che è un dispositivo condiviso, un robot o un luogo — una **memoria di entità** che tutti coloro che usano l'account leggono e scrivono. `synthetic` (simulatore di ricerca) aggiunto con il track R |
| `created_at` | timestamptz | |

L'unione di persone **non è supportata nella v1** (un tentativo di collegare un'identità già legata a un altro
owner viene rifiutato); una futura unione dovrà rimappare gli array `audience` e le FK in un'unica transazione.

### person_aliases — created, unused yet
`id, owner_id, person_id, alias text, alias_norm text (pg_trgm GIN), source enum
(extracted|manual), created_at` — risoluzione delle menzioni, LLM solo quando ambigua. Oggi le persone sono tenute come
stringhe "Nome (relazione)" sugli episodi (`episode_people.alias`), che il recall consapevole delle persone legge (D39).

### owners
| Colonna | Tipo | Note |
|---|---|---|
| `person_id` | uuid PK → persons | |
| `email` | text unique null | Login dell'owner (magic link, `API.md` §1) — usato solo dal profilo public |
| `locale`, `timezone` | text | Default `it`, `Europe/Rome`; l'API admin accetta `it` / `en`. La lingua formatta solo le date e gli avvisi del recall: gli aiuti linguistici deterministici (periodi, mesi, parentele, nome dell'owner — `service/src/lang`, le 25 lingue più usate) applicano tutte le lingue insieme |
| `episodic_enabled` | bool, default false | D4 — modificato solo dall'owner (sessione dell'owner o token con scope owner); v1 come costruito: dall'admin (`episodic_enabled_by = 'admin'`), mai da una chiave client |
| `episodic_enabled_at`, `episodic_enabled_by` | timestamptz, text | Registro del consenso (chi / quale UI del client) |
| `ingest_refused_at` | timestamptz null | Ultima volta in cui un client ha inviato messaggi con il consenso spento (nulla salvato); la console admin mostra "chiede il consenso" (`waitingForConsentSince`) finché il consenso resta spento (WORK_PLAN 6.6b) |
| `consolidated_at` | timestamptz null | Ultimo consolidamento notturno (M5) |
| `facts_reviewed_upto` | timestamptz null | Watermark della revisione notturna dei fatti (WORK_PLAN 5.6, sull'orologio di registrazione) |
| `quality_profile` | text null (`economy` / `balanced` / `full`) | D35; null = default dell'installazione (`QUALITY_PROFILE`) |
| `created_at` | timestamptz | |

Il ritardo idle è un'impostazione globale (D5), non per owner.

### owner_sessions (public profile)
`id, owner_id, created_at, expires_at, revoked_at, user_agent` — la sessione di login propria dell'owner sulle
pagine di Recordare (consenso, link code, autorizzazione OAuth, diario self-service).

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
`id, owner_scope null, person_id, kind enum (client_user|channel), client_id null, channel text
null, external_id, verified_at null, created_at`; unique `(kind, client_id, external_id)` e
`(owner_scope, kind, channel, external_id)` (come costruito: indici unique parziali `(client_id, external_id) WHERE kind =
'client_user'` e `(owner_scope, channel, external_id) WHERE kind = 'channel'`, con un `owner_scope` null contato come un
solo valore) — i collegamenti di canale dei contatti hanno ambito limitato alla memoria di un solo owner
(il client A non può associare l'id Telegram dell'owner B alle memorie di A). Solo i collegamenti verificati
identificano gli interlocutori ed entrano in `audience`.

### link_codes (public profile)
`id, owner_id, client_id (l'unico client autorizzato a riscattarlo), code_hash, expires_at, used_at,
created_at`.

### idempotency_keys (public profile; la v1 tiene le chiavi di replay in Redis per 24 h)
`credential_id, owner_id, method_path, key, response_hash, response_body, created_at` — unique sulle
prime quattro; conservazione di 24 h.

## Layer 0 — log grezzo

### conversations
| Colonna | Tipo | Note |
|---|---|---|
| `id`, `owner_id`, `client_id` | uuid | Unique `(client_id, owner_id, external_id)` |
| `external_id` | text | |
| `source` | enum `chat \| voice \| mcp_tool \| import_chat \| import_social \| import_email \| import_notes \| interview` | `mcp_tool` = conversazione sintetica che contiene le chiamate di strumento del livello basic |
| `channel`, `title` | text null | |
| `started_at`, `last_message_at` | timestamptz | |
| `idle_job_at` | timestamptz null | Quando è dovuta l'estrazione idle |
| `deleted_at` | timestamptz null | |

### conversation_participants
`conversation_id, person_id null, role enum (owner|assistant|other), display_name, ref text,
joined_at` — fonte dell'`audience` di ogni riga e dell'insieme dei visualizzatori per le letture in questa conversazione.

### messages
| Colonna | Tipo | Note |
|---|---|---|
| `id`, `conversation_id`, `owner_id` | uuid | Unique `(conversation_id, external_id)`; indice `(owner_id, sent_at)` |
| `external_id` | text | |
| `role` | enum `user \| assistant \| tool \| other` | I messaggi `system` **non sono ingeriti** (possono contenere segreti); `tool` = chiamate / risultati di strumenti dei client agentici (D30) |
| `tool_name` | text null | Per `role = tool` |
| `author_person_id` | uuid null | |
| `author_ref` | text null | Il ref del partecipante del client; nomina i membri di gruppo non verificati per l'estrazione |
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
impronta degli elementi da cui il digest è stato scritto (un giorno viene riscritto solo quando cambia — M5); unique
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
| `subject_person_id` | uuid null | null = l'owner. **Memorie di entità (D48)**: la persona a cui il fatto si riferisce (un contatto di quella memoria, trovato per nome o creato dallo scrittore); null = l'entità stessa. Mai impostato nella memoria di una persona |
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
twin_experienced`, `kind = thought | goal`, `persons.kind = synthetic`, `conversations.source =
simulation`, ruolo di partecipante `twin`. Il loro design è registrato in `DIGITAL_TWIN_VISION.md`
(research mode, money knob) e `literature/README.md`.
