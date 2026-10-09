# Contratti API v1

*Traduzione italiana di [API.md](API.md) — la versione inglese è quella di riferimento.*

> Da D50 (2026-10-09) Recordare non ha un flag di consenso: ogni memoria conserva ciò che il suo client invia;
> l'interruttore acceso / spento appartiene alla piattaforma client (WORK_PLAN 8.1).

Stato: **contratti M1, revisione 3** (2026-10-03): applicate le revisioni di coerenza e di sicurezza, poi suddiviso
in profili di deployment (§0) così che la v1 resti focalizzata sul twin.
**Costruito (2026-10-08)**: §2 ingest (con `…/end`), §3 strumenti MCP (come indicato per ciascuno) e il contesto di
memoria prima del turno (`POST api/v1/context`, con `ingest`), le righe della §4 che servono al diario dell'host
(WORK_PLAN 4.7), `GET / PATCH api/v1/me`, la §5 libreria client, l'API admin e la console, la telemetria live e lo
snapshot dell'atlas; `GET api/v1/health` (senza autenticazione: il servizio è vivo e raggiunge il database). Le sezioni o
righe contrassegnate **not built yet (v1 plan)** sono il contratto ancora da costruire (le altre righe della §4, OpenAPI,
`Idempotency-Key`).
Neutrale rispetto al client: nulla qui è specifico di Arkimede. Modello dati: `DATA_MODEL.md`. Due livelli di
integrazione (visione → Architecture): **basic** = solo strumenti MCP; **full** = ingest REST + MCP + API di lettura
+ SDK.

Convenzioni: JSON su HTTPS; i controller hard-codano `api/v1/…` (nessun prefisso globale); ISO 8601 con
offset; uuid; errori come problem details RFC 9457 (`{type, title, status, detail, code}`); gli schemi zod
sono l'unica fonte di verità e generano `GET /api/v1/openapi.json` (**not built yet**); paginazione
`?cursor&limit` → `{items, nextCursor}` (come costruito pagina solo `GET api/v1/episodes`; le altre liste della §4
restituiscono semplici array); ogni POST non idempotente accetta un header `Idempotency-Key`
(finestra di replay di 24 h, viene restituita la stessa risposta — **not built yet**; l'ingest è idempotente sugli id dei messaggi).

## 0. Profili di deployment (D33)

| Profilo | Per chi | Contenuto |
|---|---|---|
| **v1 — privato / di ricerca** (`home`) (costruito ora) | Un'installazione gestita dai suoi proprietari e dai loro client (Arkimede, Claude Code, il simulatore di ricerca) | Proprietari e identità creati dall'**API admin**; chiavi API dei client; **personal access token** per i client solo MCP (creati via API admin); credenziali con hash e scope semplici; isolamento per proprietario; conversazione risolta da Recordare (il filtro su chi legge le risposte è caduto con D50: privacy e riservatezza verranno dopo); provenienza `author_role`; oblio che resta |
| **Public** (rinviato — M7 / rilascio pubblico) | Recordare come servizio per persone che l'operatore non conosce | Login del proprietario (magic link via email, email verificata, pagine del proprietario), OAuth 2.1 per i connettori MCP, link code guidati dal proprietario + UI di revoca, `read_audit`, tabella di idempotenza persistente, policy di conservazione dei backup e avviso sulla conservazione presso il provider, export limitato alle sessioni del proprietario; protezione a livello di rete (firewall / WAF / rate limit) davanti |

Gli elementi contrassegnati **(public profile)** qui sotto sono specificati perché il design resti coerente, ma non sono
costruiti nella v1. Nulla nel profilo public modifica le righe di memoria, quindi abilitarlo in seguito non richiede alcuna migrazione
dei dati.

## 1. Identità, autenticazione, contesto di conversazione (task 1.1, 1.5 → D24)

### Modello
- **Memoria** (oggi la riga `owners`, D50): la memoria di un account di un client — quella di un agente. La sua riga
  persona porta il nome dell'account (in una memoria personale, il nome dell'"io"). **Contatti**: le persone che una
  memoria conosce, persone con ambito limitato a quella sola memoria (lo stesso essere umano in due memorie è due
  contatti senza legame).
- **Client**: un'integrazione di piattaforma (installazione di Arkimede, configurazione di Claude Desktop, strumento di import).
- **External identity** (WORK_PLAN 8.3): `account` (`clientId + externalUserId` → la memoria che apre quell'account del
  client) oppure `participant` (l'id di un partecipante del client `clientId + externalId`, o un id di canale
  `telegram:…`, `phone:+39…`, `email:…` → il sé o un contatto **di una sola memoria**); solo i collegamenti di
  partecipante verificati identificano gli interlocutori, e un'identità di partecipante non apre mai una memoria.

### Autenticazione dell'owner (public profile)
**v1**: gli owner sono creati dall'admin (`POST api/v1/admin/owners`), oppure auto-provisionati alla prima richiesta
di un client che lo consente (`autoProvision`, con il nome dell'id utente del client finché il client non li rinomina);
i token personali e i collegamenti di identità sono gestiti tramite l'API admin (e la
sua console, §6) — come costruito nessuna rotta permette a un personal token dell'owner di cambiarli; non esistono pagine
dell'owner. Il consolidamento notturno si avvia da solo (`CONSOLIDATION_HOUR`, fuso orario dell'owner); `POST api/v1/admin/owners/:id/consolidate` lo esegue subito (rispetta `X-Recordare-Now` dove consentito); `POST api/v1/admin/owners/:id/review-facts` esegue subito la sola revisione dei fatti (WORK_PLAN 5.6, stesso lock del consolidamento). Profilo di qualità (D35): `qualityProfile` `economy | balanced | full` alla creazione dell'owner /
`PATCH api/v1/admin/owners/:id` (`null` = il default dell'installazione `QUALITY_PROFILE`, `balanced` se non impostato). Le stesse
route accettano `mode` `personal | entity` (D50: `personal` — il titolare dell'account è l'"io", ciò che arriva senza
identità dichiarata è della memoria stessa; `entity` — una memoria condivisa da tutti coloro che usano l'account, un
dispositivo domestico, un robot, un luogo: ciò che arriva non dichiarato è di "qualcuno") e `gender` `masculine |
feminine | neutral` (la prima persona nelle lingue con genere, default `masculine`), e `PATCH` accetta `displayName` (una successiva sincronizzazione del nome del suo utente da parte di un client lo sovrascrive: il nome segue la piattaforma).

**Public profile**: gli owner accedono alle pagine di Recordare con un **magic link via email** (niente password; passkey e
OIDC in seguito). La sessione dell'owner serve per: creare link
code, revocare client, autorizzare client MCP OAuth, creare token personali, export, il
diario self-service.
- L'email dell'owner viene impostata **solo** tramite una mail di verifica che l'owner apre (claim flow); non
  viene mai presa dai payload del client o dell'ingest, e modificarla richiede la sessione corrente dell'owner
  più la verifica del nuovo indirizzo.
- Magic link: monouso, ≤ 15 min, con rate limit per indirizzo e IP, legati al browser che
  li ha richiesti; notifiche di nuovo accesso via email.
- Un owner auto-provisionato (creato da un client) non ha email finché non viene rivendicato: fino ad allora la sua
  memoria è protetta esattamente quanto la chiave di quel client, e non ha pagine dell'owner. I toggle dell'host
  (ad es. "abilita diario" di Arkimede) **aprono la pagina dell'owner di Recordare**; non modificano mai le impostazioni
  dell'owner con la chiave del client.

### Credenziali (D24)
| Livello | Credenziale | Agisce come |
|---|---|---|
| Full | **Client API key** `Authorization: Bearer rk_…` | Gli owner associati a quel client, selezionati per richiesta con `X-Recordare-User: <externalUserId>` |
| Basic | **Personal access token** `rp_…`, legato a un owner + un client, creato dall'owner (sessione dell'owner; v1: dall'admin, `POST api/v1/admin/owners/:id/tokens {clientId, scopes, expiresAt?}`) — per i client MCP in grado di inviare header (Claude Code, Cursor, SDK); con anche `ingest` e `read` serve pure i connettori di livello full per una sola persona (`connectors/`). Disabilitare il suo client lo ferma | Quell'owner |
| Basic (OAuth) — public profile | **OAuth 2.1** secondo la specifica di autorizzazione MCP (code + PKCE, registrazione dinamica del client, metadati della risorsa protetta); l'owner accede (magic link) e acconsente — per i client che lo richiedono (connettori Claude Desktop / claude.ai). Pianificato per M6; i token personali coprono M3–M5 | Quell'owner |
| Admin | Chiave API con scope `admin` (v1: l'unica `ADMIN_API_KEY` dell'installazione, impostata nel suo ambiente) | Gestione dell'installazione |

### Scope
| Scope | Consente |
|---|---|
| `ingest` | §2 ingest, modifiche, cancellazioni, `…/end` delle conversazioni del client stesso; `ingest` dentro `POST api/v1/context`; `PATCH api/v1/me` (chiavi client) |
| `mcp` | §3 strumenti (letture + `log_episode`, `remember`, `correct_episode`, `forget_episode`) |
| `read` | §4 endpoint GET, `GET api/v1/me`, `POST api/v1/context` |
| `write` | §4 inserimenti manuali, correzioni, oblio, modifiche di fatti / note |
| `owner_settings` | `PATCH settings` (lingua, fuso orario, profilo di qualità) — mai le chiavi API dei client. v1: chiave admin o token personale dell'owner; public profile: sessioni dell'owner / token creati dall'owner. Come costruito nessuna rotta lo usa ancora: queste impostazioni le imposta l'admin (`PATCH api/v1/admin/owners/:id`) |
| `export` | §4 job di export — v1: chiave admin o token personale dell'owner; public profile: solo sessioni dell'owner, download con scadenza. Non ancora costruito |
| `admin` | `api/v1/admin/…` (come costruito: solo la credenziale `ADMIN_API_KEY`; una chiave o un token che elenca `admin` non ottiene alcuna rotta admin) |

Le chiavi client si creano solo con `ingest`, `mcp`, `read`, `write` (`POST api/v1/admin/clients/:id/keys {scopes}`);
`admin`, `owner_settings` ed `export` non vengono mai dati a una chiave client.

Chiavi e token: hash argon2id, mostrati una sola volta, prefisso visibile, rotazione tramite crea + revoca. Un
client non può mai emettere token per un altro client. I replay di `Idempotency-Key` hanno ambito
`(credential, owner, method + path)`; la v1 li tiene in Redis per 24 h (tabella persistente nel
public profile).

### Contesto di conversazione — nessun filtro su chi legge (D50, WORK_PLAN 8.2)
**Comportamento attuale (2026-10-09)**: ogni risposta — richiamo via MCP, contesto di memoria — usa **tutta la
memoria**, in ogni conversazione: quella in cui c'è solo l'owner, una conversazione condivisa o di gruppo, una che
Recordare non ha ancora salvato, o nessuna conversazione. Chi può sapere cosa (privacy, riservatezza) verrà dopo
(WORK_PLAN 8.12); le colonne `audience` / `disclosure` continuano a essere scritte, così quel lavoro partirà da dati
registrati. **L'isolamento tra memorie resta**: una richiesta apre solo la memoria indicata dalla sua credenziale e da
`X-Recordare-User`.

La conversazione è ancora **risolta da Recordare, mai dichiarata dal client o dall'LLM**, da
`X-Recordare-Conversation: <externalConversationId>` (le chiamate MCP possono portarla invece come
`_meta.recordare.conversation`), rispetto alle conversazioni che questo client ha inviato per l'owner. Serve per:
- **le scritture MCP** (`log_episode`, `remember`, `correct_episode`, `forget_episode`): richiedono un contesto
  risolvibile — una conversazione inviata (i suoi messaggi recenti sono la prova della scrittura), oppure un token
  personale (uso diretto dell'owner; senza una conversazione salvata contano i messaggi recenti dell'owner da questo
  client). Una chiave client senza conversazione riceve `"cannot write here"`;
- escludere il turno corrente dagli estratti di chat (`fromChats`), e la riga di `recall_log`.

`X-Recordare-Viewers` e `_meta.recordare.viewers` **non esistono più** (potevano solo restringere ciò che il filtro su
chi legge restituiva): Recordare li ignora. Sparisce anche l'avviso `"nothing to show here"`.

*Superata (regola della fase 1, D24 / D33 → D50)*: i ricordi — e i dati grezzi derivati dalle chat — venivano
restituiti solo quando chi leggeva era esattamente l'owner (le chiavi client dovevano indicare una conversazione
risolvibile con il solo owner tra i partecipanti; altri lettori dichiarati potevano solo restringere); altrimenti una
risposta vuota con `"nothing to show here"`. Resta qui come punto di partenza del lavoro sulla privacy
(`RESEARCH_NOTES_it.md` H2).

### Collegare la stessa persona tra client
**v1**: l'admin collega le identità (`POST api/v1/admin/identities`, rotte admin del §1): un `account` a una memoria, un
`participant` al sé o a un contatto di una memoria; collegare un id già legato, un account a una persona che non è una
memoria, o un partecipante a una persona fuori da quella memoria fallisce con un generico `400 cannot_link`. Anche
l'ingest crea identità di partecipante (§2).

**Public profile**:
1. In una **sessione dell'owner**, l'owner sceglie il client di destinazione e crea un link code
   (`POST api/v1/me/link-codes {clientId}` → `{code, expiresAt}`, monouso, 10 min), vedendo ciò che
   quel client otterrà: episodi e fatti di tutti i client; chat grezze solo delle proprie conversazioni
   (`clients.raw_log_scope = own`, ampliabile dall'owner).
2. Quel client lo invia: `POST api/v1/identities/link {code, externalUserId}`; il riscatto da parte di qualsiasi
   altro client è rifiutato. L'owner riceve una notifica.
3. Se l'`externalUserId` è già legato a un altro owner, il collegamento fallisce con un generico
   `400 cannot_link` (nessun indizio che l'id esista) — l'unione di persone non è supportata nella v1.
4. L'owner può elencare e revocare in qualsiasi momento i client e le identità connessi:
   `GET api/v1/me/identities`, `DELETE api/v1/me/identities/{id}` (sessione dell'owner).

Admin (`api/v1/admin/…`), costruito: `POST clients {name, kind: platform | mcp_client | import, autoProvision?,
rawLogScope?}`, `GET clients`, `PATCH clients/:id`, `POST clients/:id/keys {scopes}` (→ `{id, key, prefix}`, la chiave
mostrata una sola volta), `DELETE keys/:id`, `POST owners {displayName, mode? (personal | entity), gender? (masculine |
feminine | neutral), locale? (it | en), timezone?, qualityProfile?}`, `PATCH owners/:id` (stessi campi; l'admin può
cambiare il modo di una memoria non vuota), `GET persons`, `POST identities {kind: account, personId (una memoria),
clientId, externalId} | {kind: participant, ownerScope (la memoria), personId (il suo sé o uno dei suoi contatti), clientId |
channel (esattamente uno), externalId, verified?}`, `DELETE identities/:id`,
`POST owners/:id/tokens` (→ `{id, token, prefix}`), `DELETE tokens/:id`, `POST owners/:id/consolidate`,
`POST owners/:id/review-facts`, `GET owners` (owner con dimensione della memoria, per l'atlas), `GET owners/:id/atlas`,
`GET telemetry/stream` (§6; le rotte della console sono descritte lì). Le revoche hanno effetto subito (la cache delle
credenziali viene svuotata). Non ancora costruiti: job di export dell'owner / cancellazione totale.

## 2. Ingest REST (task 1.2) — integrazione full

### `POST api/v1/ingest/messages` (scope `ingest`)
Una chiave client indica la persona con `X-Recordare-User`; un token personale con `ingest` invia per il suo owner (i
connettori per una sola persona). La credenziale admin non può fare ingest (403).
```ts
{
  conversation: {
    externalId: string;
    source?: "chat" | "voice" | "import_chat" | "import_social" | "import_email"
           | "import_notes" | "interview"
           | "document" | "perception" | "ambient";       // default "chat"
    channel?: string; title?: string;
    participants?: Array<{
      ref: string; role: "owner" | "assistant" | "other"; displayName?: string;
      identity?: { channel: string; externalId: string } | { externalUserId: string };
      // resolved inside this memory only: its participant identity, or the account's own
      // user id (the self); seen for the first time → a new contact of this memory
      // (named after displayName); an unverified binding identifies nobody
    }>;
  };
  messages: Array<{                       // max 500, any order
    externalId: string;
    role: "user" | "assistant" | "tool" | "other";        // "system" is rejected (may carry secrets)
    toolName?: string;                    // role "tool": agent tool calls / results (D30)
    authorRef?: string;
    content: string;                      // verbatim, ≤ 64 KB
    sentAt: string;                       // reference time for date resolution
    upsert?: boolean;                     // true: same externalId with new content = edit
    own?: boolean;                        // the agent's own content (knowledge given to it, its
                                          // perceptions, a document); role user | other only
  }>;
  hints?: { conversationEnded?: boolean };
}
```
Risposta **`200`** dopo che le righe grezze sono state scritte in modo sincrono (l'estrazione è sempre asincrona):
`{conversationId, accepted, duplicates, conflicts: [externalId…]}`.
- Stesso `externalId` e stesso contenuto → duplicato (ignorato). Stesso `externalId`, contenuto diverso →
  elencato in `conflicts` (stile `409` per elemento) a meno che `upsert: true`, che registra una modifica.
- **Nessun flag di consenso** (D50): ogni messaggio accettato viene memorizzato, estratto e consolidato. Se una memoria
  è attiva lo decide l'interruttore della piattaforma client: quando è spento, il client non invia. I ricordi esistenti
  restano finché non vengono cancellati.
- Ogni batch accettato (ri)pianifica il job idle della conversazione (D1, D5, ritardo globale); i messaggi
  sono estratti quando in attesa, per `sentAt`, così i messaggi in ritardo o fuori ordine non vengono mai saltati.
- **Attribuzione** (D50, WORK_PLAN 8.3): ogni messaggio registra chi l'ha detto, come conoscenza — `author_kind` `self`
  (memoria personale: un turno `user` senza un altro autore, il partecipante `owner`, l'id utente dell'account stesso;
  metodo `account`), `contact` (un partecipante con un'identità; metodo `client_assertion` per un id utente del client,
  `declared` per un id di canale), `someone` (chiunque non identificato, e in una memoria di entità chi parla
  dall'account; metodo `none`), `agent` (`assistant`), `tool`, `own` (`own: true`) — con una confidenza (1, o nessuna
  quando nulla è stato stabilito). Solo registrata: non ancora esposta dall'API di lettura, e i prompt di estrazione non
  cambiano (la prima persona arriva con WORK_PLAN 8.4). Fino ad allora il contenuto `own` è letto come i turni di chi
  parla dall'account.

### Modifiche e cancellazioni
- `PATCH api/v1/ingest/conversations/{externalId}/messages/{messageExternalId}` `{content}` → `204` (`404` se
  sconosciuto); il testo precedente va in `message_revisions` e il messaggio viene estratto di nuovo.
- `DELETE …/messages/{messageExternalId}`, `DELETE api/v1/ingest/conversations/{externalId}` →
  purge (`DATA_MODEL.md` → Forgetting and deletion). Come costruito: la purge viene eseguita in modo sincrono e restituisce `202` senza
  corpo (piano: `202` + id del job); `404` se sconosciuto (la libreria client lo tratta come fatto).
- `POST api/v1/ingest/conversations/{externalId}/end` → `202`: la conversazione è finita sul client (sessione chiusa,
  /new) — l'estrazione parte subito invece che dopo il ritardo di inattività; `404` per una conversazione mai ricevuta. Stesso effetto di `hints.conversationEnded`
  (rispettato anche in un batch i cui messaggi sono tutti duplicati), senza reinviare un messaggio.

### Import
`source: import_*` con `sentAt` storico, in batch; estratti dal percorso notturno con segmentazione per
argomento (D29); supersessione solo in avanti per `sentAt`.

## 3. Strumenti MCP (task 1.3) — entrambi i livelli

Trasporto: **MCP streamable HTTP** su `/mcp`. **Una sessione MCP per owner**: l'owner è fissato
a `initialize` (owner del token, oppure `X-Recordare-User` per le chiavi client); ogni richiesta riconvalida
`X-Recordare-User` rispetto all'owner della sessione — una discrepanza restituisce 403 e termina la sessione
(gli host che riutilizzano una sessione per più utenti non possono incrociare le memorie). La conversazione segue il §1
(header di conversazione o `_meta.recordare.conversation`; le risposte usano tutta la memoria, D50). Gli schemi degli strumenti usano il sottoinsieme neutrale rispetto al provider
(D27). Gli strumenti sono sempre elencati (nessun indizio sull'esistenza di un diario). Come costruito: una
sessione si apre solo con una richiesta `initialize` (`404` per un id di sessione sconosciuto); la credenziale admin
riceve `403`; una richiesta da una credenziale diversa da quella che ha aperto la sessione è rifiutata come una
discrepanza di owner. Le scritture richiedono un contesto risolvibile — un token personale, o una conversazione che
Recordare ha ricevuto — altrimenti restituiscono `{error: "cannot write here"}`. Gli schemi pubblicati degli strumenti
sono in `packages/client` (`TOOLS`, tenuti allineati dalla suite di conformità) per i connettori che dichiarano gli
strumenti in anticipo.

### `log_episode` (D11)
| Param | Tipo | Note |
|---|---|---|
| `content` | string, obbligatorio | |
| `kind` | `"event" \| "plan"` | default `event` |
| `occurred_at`, `occurred_until` | string | data ISO risolta dall'agente (come costruito `YYYY-MM-DD` o `YYYY-MM`; un datetime è rifiutato) |
| `date_precision` | `"day" \| "month" \| "year" \| "approximate"` | |
| `people` | string[] | Nomi come menzionati |
| `place` | string | |

Restituisce `{id, stored}`. Evidenza (come costruito): il messaggio dell'owner nella conversazione della chiamata ricevuto negli ultimi
30 minuti il cui testo si sovrappone al contenuto (similarità trigramma ≥ 0,2, oppure il contenuto trovato dentro il messaggio:
word similarity ≥ 0,6) — con un token personale e nessuna conversazione
indicata, i messaggi dell'owner dallo stesso client (un connettore che invia i turni); pianificato, non ancora costruito: deduplica di 10 minuti dei
retry dell'agente e late binding quando l'ingest non è ancora arrivato. **Importanza 10 e `stance: stated` solo quando
l'evidenza si lega a un messaggio `user` dell'owner**; altrimenti (`stance: inferred`, confidenza 0.6) (livello basic, o nessun messaggio dell'owner)
la chiamata è memorizzata in una conversazione giornaliera per client (`source: mcp_tool`, `evidence_kind:
agent_paraphrase`) con `origin: assistant_stated`, importanza di default e l'etichetta "noted by the
assistant" — così l'output iniettato di uno strumento non può creare un ricordo "l'utente ha detto" ad alta importanza.

### `correct_episode` / `forget_episode` (D16, D18 — anche per gli owner solo MCP)
- `correct_episode {id, content?, occurred_at?, date_precision?}` → nuova riga con `corrects`, vecchia
  riga invalidata; restituisce `{id, stored}` (l'id della nuova riga).
- `forget_episode {id}` → oblio come in `DATA_MODEL.md` (tombstone, nessun ritorno); restituisce `{forgotten: true}`.
- Le descrizioni degli strumenti (8.4) parlano della **tua memoria** — quella dell'agente: ciò che hai vissuto, fatto,
  pianificato o imparato, e ciò che sai delle persone attorno a te, ogni elemento con il suo soggetto.

### `search_episodes` (D12, D13, D29)
| Param | Tipo | Note |
|---|---|---|
| `query` | string | Facoltativo per panoramiche pure di un periodo |
| `from`, `to` | string | Date ISO (`YYYY-MM-DD`, oppure `YYYY-MM` = il mese intero), estremi inclusi, abbinate per sovrapposizione (`resolve_period` aiuta) |
| `mode` | `"search" \| "list" \| "latest"` | `search` per rilevanza; `list` cronologico nell'intervallo; `latest` prima le corrispondenze più recenti |
| `include_plans` | boolean | default true |
| `limit` | integer, 1–50 | default: search 10, list 30, latest 5 |

Restituisce (come costruito):
```ts
{
  memory: { name: string; mode: "personal" | "entity" };   // whose memory: personal — "I" is `name` (first person)
  speaker?: { kind: "self" } | { kind: "contact"; name: string };  // personal: who is asking (8.4)
  period?: { from: string | null; to: string | null };
  digests: Array<{ level: "day" | "month"; from: string; to: string; text: string }>;  // list mode with a period (knob, below)
  episodes: Episode[];                                // in period / matching; lived, done, planned or learned (each with its subject)
  claims: Episode[];                                  // personal: others' statements about someone else (other, inferred);
                                                      // entity (until 8.5): every other / tool statement — kept apart
  outsidePeriod: Episode[];                           // same shape; filled only when the period has no match (max 5)
  fromChats: Array<{ conversationId: string; conversation: string; messageId: string; at: string;
                     authorRole: "owner" | "other" | "tool"; author?: string; excerpt: string }>;
  notes: string[];                                    // e.g. unresolved plans, claims / others' excerpts notice, who is asking
  clarifications?: string[];                          // personal: open questions about the people involved (8.4)
}
type Episode = {
  id: string; kind: "event" | "plan" | "state_change"; content: string;
  when: string;                                       // human-readable, with precision
  planStatus?: "open" | "confirmed" | "cancelled" | "rescheduled" | "unresolved";
  rescheduledTo?: string; origin: "owner_lived" | "owner_told" | "assistant_stated";
  authorRole: "owner" | "assistant" | "other" | "tool";   // who wrote the evidence
  subject: { kind: "self" } | { kind: "contact"; name: string } | { kind: "someone" }
         | { kind: "undecided"; candidates: string[] };   // whose memory it is (D50, 8.4)
  claimedBy?: string[];                               // for claims: who wrote the evidence
  inferred: boolean;
  people: string[]; feelings: string[]; opinion?: string;
  source: { conversation: string; messageIds: string[]; at: string };   // conversation = the client's own id
};
```
Lo stesso in ogni conversazione, anche in quelle a cui partecipano altri (D50: nessun filtro su chi legge).
Ogni elemento riporta `authorRole` (`owner | assistant | other | tool`) così che gli host possano racchiudere i contenuti
non scritti dai turni propri della memoria come dati, non come istruzioni; tali elementi riportano anche `claimedBy` (i nomi di chi ha
scritto l'evidenza), gli estratti di chat riportano il proprio `author` quando non sono un turno proprio della memoria; quando tali
elementi vengono restituiti, `notes` lo dice esplicitamente (M4b: i modelli di risposta ignoravano il semplice campo). **Memoria
dell'agente (D50, WORK_PLAN 8.4)**: ogni risultato nomina la sua `memory` (`name`, `mode`); ogni elemento riporta il suo `subject` —
`self` (in una memoria personale l'elemento è scritto in prima persona: "io" è `memory.name`, perché la persona e l'agente sono uno),
un `contact` per nome, `someone`, oppure `undecided` tra contatti candidati (è stata posta una domanda, vedi sotto). In una memoria
personale il risultato dice anche chi sta chiedendo (`speaker`): l'autore dell'ultimo turno della conversazione quando è un contatto
identificato (un partecipante con un'identità), altrimenti il sé — chi è identificato riceve per primi i propri elementi (poi quelli a
cui ha preso parte), e `notes` dice al modello che risponde che "io" nella domanda è quella persona, non il sé della memoria. I `claims`
di una memoria personale sono affermazioni di altre persone su qualcun altro (il sé o una terza persona, `inferred`); la notizia che una
persona dà di sé è un episodio con quella persona come soggetto, e ciò che uno strumento o un documento ha insegnato all'agente è un suo
apprendimento (non un claim). `clarifications`: fino a 2 domande aperte i cui candidati sono nominati dalla query o il cui elemento è
restituito — da porre se viene naturale. Due tipi: "quale?" su un elemento ("Marco chi — il collega o il cugino?") e "stessa persona?" su
un partecipante appena identificato e un contatto noto solo per nome ("Giulia, che ha scritto il 22 settembre, è la stessa persona di
Giulia (sorella)?" — la risposta fonde i due o li tiene separati; DATA_MODEL "Memoria dell'agente"). Le memorie di entità mantengono la regola precedente
sui claims fino alla 8.5. `digests` (M5): per le richieste `list` con un periodo, il diario di quel periodo — voci giornaliere per intervalli fino a 45 giorni, riepiloghi mensili per quelli più lunghi; riassumono solo gli episodi propri dell'owner (mai le affermazioni di altre persone). Come costruito sono restituiti solo quando `RECALL_DIGESTS` è attivo (spento per default in ogni profilo di qualità — `KNOBS.md`); altrimenti `digests` è vuoto. `fromChats` (log grezzo, D13) riporta sempre fino a 2 estratti non già dietro gli
episodi restituiti — il log risponde a ciò che gli episodi non contengono mai, ad es. le richieste di aiuto ("quando ti ho chiesto…") — e fino a 3 quando meno di
3 episodi corrispondono o la migliore corrispondenza è sotto la soglia di rilevanza; limitato alle
conversazioni del client stesso (`raw_log_scope`). Gli stati sono sempre espliciti; gli elementi annullati, irrisolti e superati
non sono mai presentati come attuali (premise check, D29).

### `search_facts` (D31, catena di valori, as-of) — not built yet (v1 plan)
Oggi `search_memory` (sotto) restituisce anche i fatti, a una certa data (`as_of`), ciascuno con la sua catena di valori; è pianificato uno
strumento `search_facts` separato.

| Param | Tipo | Note |
|---|---|---|
| `query` | string | Argomento |
| `as_of` | string | Data ISO; default adesso |
| `include_pending` | boolean | default false |

Restituisce `{facts: [{key, value | null, status, validFrom, validTo, history: [...], source}]}`;
`unknown_current` → "il valore attuale non è noto".

### `remember` e `search_memory` (D34 — note semantiche)
- `remember {content, category?}` — esplicito "ricorda che…": memorizzato come nota dichiarata (messaggio
  `user` dell'owner come evidenza, stesse regole di `log_episode`); senza tale evidenza è memorizzato come nota
  dedotta **in sospeso** (`origin: assistant_stated`) che l'owner conferma nel diario (§4). `category` per default è
  `knowledge`. Restituisce `{id, stored}`.
- `search_memory {query, as_of?, include_pending?}` — preferenze, abitudini, valori, conoscenze, più i
  fatti di stato rilevanti validi a `as_of` (data ISO, default oggi) con la loro cronologia; integra `search_episodes`
  (cosa è successo / quando). Restituisce `{memory, speaker?, notes, facts, notes_info, clarifications?}` (`notes_info`:
  avvisi sul risultato; `speaker` e `clarifications` come in `search_episodes`, memorie personali). Fatti e note del sé e
  delle persone che la memoria conosce, in entrambe le modalità; ognuno riporta il suo `subject` (`self` — in una memoria
  di entità l'entità stessa — oppure `{kind: "contact", name}`; le note possono essere anche `undecided`).

### `resolve_period` (D12, deterministico)
Come costruito: `{expression}` → `{from, to, label}` (oppure `{error}` per un'espressione sconosciuta); espressioni nelle
lingue più usate (`service/src/lang`: periodi relativi e nomi dei mesi da Intl per 25 locale, più stagioni e sinonimi); settimane che iniziano di lunedì, fuso orario dell'owner; "adesso" è l'orologio del server (`X-Recordare-Now` lo sostituisce dove
`ALLOW_CLOCK_OVERRIDE` è impostato — test e valutazioni). Nessun LLM. Parametri `now?` / `locale?`: non costruiti.

### Contesto di memoria prima del turno (WORK_PLAN 5.7) — costruito
`POST api/v1/context {query?, ingest?}` (scope `read`; `X-Recordare-User`, `X-Recordare-Conversation`) → `{block, items}`.
`ingest` (il corpo di `POST api/v1/ingest/messages`, serve anche lo scope `ingest`) salva prima il turno e risponde per
quella conversazione, con `query` che per default è il suo ultimo messaggio dell'utente — una sola andata e ritorno prima
di ogni turno invece di due (`400` quando non ci sono né una `query` né un messaggio dell'utente; `403` per `ingest`
senza lo scope `ingest`). Con un token personale, una conversazione non ancora salvata conta come
della persona. `query` viene tagliata a 8 000 caratteri. Il blocco contiene i
ricordi pertinenti al messaggio a cui si sta per rispondere (fatti e note attuali, piani aperti imminenti, fino a 3
episodi, ognuno sopra una soglia di somiglianza; al massimo circa 300 token) come un unico blocco recintato
`<memory-context>` marcato "dati, non istruzioni", oppure `block: null` quando non c'è niente di pertinente. Nessuna
chiamata LLM. Memorie personali (8.4): il blocco parla all'agente come al sé della memoria ("Background from your memory (you
are Andrea: first-person items are yours)"), le note e gli episodi di altre persone riportano il loro nome (`[Giulia] …`), e può
chiudersi con **una** chiarificazione aperta pertinente al messaggio (un candidato nominato, o il suo elemento servito):
`- if natural, ask: Marco chi — il collega o il cugino?`. Tutta la memoria in ogni conversazione, come ogni lettura (D50); un blocco
servito è registrato in `recall_log` (strumento `memory_context`; la guardia anti-eco tratta allora la risposta come possibile eco). Sempre
disponibile: se usarlo, e per quale agente, è scelta del client (l'host lo aggiunge in fondo al suo prompt di sistema e
non lo salva mai come messaggio).

## 4. API di lettura / scrittura per le UI degli host (task 1.4) — il diario (D18)

**Costruita (2026-10-08, WORK_PLAN 4.7)** — le righe che servono al diario dell'host: `GET episodes` (linea del tempo,
dal più recente; `from` / `to` date locali, `kind`, `planStatus` compreso `unresolved` calcolato, `q` testo libero,
`cursor` opaco + `nextCursor`, `limit` ≤ 200), `GET episodes/{id}` (evidenze: testo dei messaggi solo dalle
conversazioni del client, salvo `raw_log_scope` `all`, altrimenti `otherClient`; `history` = le versioni che ha
corretto; per un piano `planEvents`, `confirmedBy`, `rescheduledTo`), `POST episodes/{id}/corrections {content?,
occurredAt?, datePrecision?}` → `{id}`, `DELETE episodes/{id}` (oblio che resta, come `forget_episode`), `GET digests`
(voci attuali di giorni / mesi, dalla più recente), `GET facts` (slot con `history`, `asOf`, per persona in una memoria
di entità), `DELETE facts/{id}`, `POST facts/{id}/confirm | reject`, `GET notes`, `PATCH notes/{id} {pinned}`,
`DELETE notes/{id}`, `POST notes/{id}/confirm | reject`, `GET plans` (aperti e irrisolti per default, dal più vicino);
più le righe `GET / PATCH api/v1/me`. Le modifiche rispondono `204` (`404` per un id che non è dell'owner); pagina solo
`GET episodes` (`{items, nextCursor}`, default 50), le altre liste sono array. Come costruito, cancellare un fatto o una
nota (e rifiutarne uno in sospeso) rimuove la riga con le sue evidenze — nessun tombstone, nessuna voce in
`note_changes`; confermare la rende dichiarata (`pending` false). **Non ancora costruite**: inserimento manuale, correzioni di fatti / note, promozioni (5.4),
oblio di un periodo (5.5), impostazioni, uso, export, il feed delle modifiche delle note, `GET facts/{id}` /
`GET notes/{id}`. Libreria client: `packages/client` (`episodes`, `episode`, `digests`, `facts`, `notes`, `plans`,
`correctEpisode`, `forgetEpisode`, `pinNote`, `delete`, `decide`).

Con ambito limitato all'owner, e chi legge è l'owner stesso nell'interfaccia dell'host (owner-direct): una chiave
client indica la persona con `X-Recordare-User` (scope `read` per leggere, `write` per modificare), un token personale è
la persona; nessuna intestazione di conversazione, nessuna risoluzione della conversazione. In una memoria di entità chiunque usi l'account la vede tutta (D48).

| Metodo + percorso | Scope | Scopo |
|---|---|---|
| `GET api/v1/episodes?from&to&kind&planStatus&q&cursor&limit` | read | Timeline |
| `GET api/v1/episodes/{id}` | read | Dettaglio: evidenza (citazioni filtrate da `raw_log_scope`), cronologia delle correzioni, piano / evento collegato |
| `POST api/v1/episodes` | write | Inserimento manuale |
| `POST api/v1/episodes/{id}/corrections` | write | Correzione (nuova riga, `corrects`) |
| `DELETE api/v1/episodes/{id}` | write | Dimenticare un episodio |
| `POST api/v1/forget {from, to, keepRaw?}` | write | Dimenticare un periodo (job asincrono) |
| `GET api/v1/digests?level&from&to` | read | Voci del diario (`level` `day \| month`) |
| `GET api/v1/facts?key&asOf&status&includePending` / `GET …/{id}` | read | Fatti con cronologia (come costruito: `key`, `asOf`, `includePending`; nessun filtro `status`) |
| `POST api/v1/facts/{id}/corrections`, `DELETE api/v1/facts/{id}` | write | Correggere o dimenticare un fatto |
| `POST api/v1/facts/{id}/confirm` / `…/reject` | write | Fatti in sospeso (D20) |
| `GET api/v1/promotions?status` + `POST …/{id}/confirm\|reject` | read / write | Proposte di pattern (D20, D26) |
| `GET api/v1/plans?status` | read | Piani aperti / irrisolti |
| `GET api/v1/notes?category&pinned&includePending` / `GET …/{id}` | read | Note semantiche (D34) |
| `POST api/v1/notes`, `POST …/{id}/corrections`, `POST …/{id}/confirm\|reject`, `PATCH …/{id} {pinned}`, `DELETE …/{id}` | write | Gestire le note |
| `GET api/v1/notes/changes?since=<seq>` | read | Change feed per i client che tengono copie (Arkimede → A-MEM, D34) |
| `GET api/v1/settings`, `PATCH api/v1/settings` | read / owner_settings | lingua, fuso orario, profilo di qualità |
| `GET api/v1/usage?from&to` | read | Chiamate LLM e token per questo owner |
| `POST api/v1/exports` → `GET api/v1/exports/{id}` | export | Export completo asincrono (archivio JSON) |
| `GET api/v1/me` | read | Per chi agisce la richiesta: `{ownerId, displayName, mode, gender, atlasUrl?, via, scopes}` (`atlasUrl`: `ATLAS_URL`, quando l'atlas è installato) (`mode` `entity` = una memoria condivisa: il client lo comunica ai suoi utenti) (con una chiave client: la memoria dell'account dietro `X-Recordare-User`, auto-provisionata se il client lo consente; `via` `client \| owner_token`) |
| `PATCH api/v1/me {displayName?, mode?, gender?}` | ingest (chiave client; un token personale riceve 403) | Le impostazioni della memoria provenienti dalla piattaforma: il nome segue l'utente del client (sincronizzazione a ogni rinomina); `mode` `personal \| entity` (D50) solo finché la memoria non ha episodi, fatti o note → altrimenti 409 `memory_not_empty` (l'admin può comunque cambiarlo); `gender` `masculine \| feminine \| neutral` (la prima persona, dal profilo dell'account) in qualsiasi momento |
| `GET api/v1/me/identities`, `DELETE api/v1/me/identities/{id}` | sessione dell'owner (public profile) | Client / identità connessi, revoca |

## 5. Libreria client (task 1.6, WORK_PLAN 6.7) — costruita (2026-10-07)

`@arkimedehq/recordare-client` in `packages/client/` (vedi il suo README): `RecordareClient` (`me`, `updateMe`, `ingest`
diviso in richieste da 500, `context` / `contextWithTurn` (§3 contesto di memoria prima del turno, con `ingest`),
`endConversation`, `editMessage`, `deleteMessage` / `deleteConversation` con 404 = fatto, i wrapper della §4 `episodes`,
`episode`, `correctEpisode`, `forgetEpisode`, `digests`, `facts`, `notes`, `plans`, `pinNote`, `delete`, `decide`,
`mcp.listTools` / `mcp.callTool` con l'SDK MCP ufficiale e una sessione per utente + conversazione), `TOOLS` (gli schemi
pubblicati degli strumenti MCP), `PersonDirectory` (memoria in cache, modo e indirizzo di Atlas; l'opt-in della
piattaforma; sincronizzazione del nome), `afterFailure` (politica di consegna dell'outbox: back-off con jitter,
`Retry-After`, parcheggio su 400 / 413 / 422), errori tipizzati (RFC 9457). All'host restano solo la memorizzazione
dell'outbox e la trasformazione delle sue chat. Una suite di conformità la esegue contro il servizio nella CI
(`service/test/conformance`). Costruiti su di essa: il connettore OpenClaw e il proxy di memoria compatibile OpenAI
(`connectors/`); lo script degli hook di Claude Code / Codex (senza dipendenze) e il connettore Hermes (Python) chiamano
direttamente le stesse rotte.

## 6. Versionamento e compatibilità
- Modifiche incompatibili solo sotto `api/v2/…`; modifiche additive all'interno della v1; nomi degli strumenti MCP stabili, nuovi
  parametri facoltativi.
- I contract test (M3) eseguono gli stessi scenari attraverso REST + MCP, a entrambi i livelli, inclusa la
  memoria intera nelle conversazioni condivise (D50; fino all'8.2 non ottenevano nulla).

### Console admin (WORK_PLAN 6.9)
`GET /admin` serve una pagina statica (pubblica: non contiene dati) sopra la API admin; l'operatore digita la chiave
admin, che resta solo in quella scheda del browser (CSP restrittiva, `no-store`). Rotte usate oltre a quelle sopra, tutte
solo admin e solo metadati: `GET api/v1/admin/owners/{id}/runs?conversation=&limit=` (le esecuzioni di estrazione recenti di una persona con il
loro riassunto — restituito, scritto, scartato e perché, solo conteggi; WORK_PLAN 4.12), `GET api/v1/admin/persons` (memorie con impostazioni — modo, genere, lingua, profilo —, conteggi di messaggi / episodi /
fatti / note / contatti, estrazione in attesa, ultimo messaggio, identità — gli account che aprono la memoria e gli id di
partecipante del suo sé e dei suoi contatti —, token personali attivi per prefisso), `GET api/v1/admin/clients` (client
con chiavi attive per prefisso), `PATCH api/v1/admin/clients/:id {autoProvision?, disabled?}` (disabled = tutte le chiavi
e i token del client smettono subito di funzionare), `DELETE api/v1/admin/identities/:id` (scollega l'utente di un client
da una persona; i ricordi restano). Per il resto la console usa le altre rotte admin della §1 (modo e
genere della memoria, profilo di qualità, nome, identità, token personali, chiavi dei client, consolidamento); è in italiano e in
inglese.

### Telemetria live (M5b, solo admin)
`GET api/v1/admin/telemetry/stream[?owner=<personId>]` — Server-Sent Events, uno per ogni passo reale all'interno del servizio:
`message.ingested`, `extraction.started` / `extraction.finished`, `work.started` / `work.finished` (op: `embed.messages`, `context`, `embed.memories`, `recall`, `consolidation`; id, durata — lavoro senza chiamata LLM), `llm.started` (id del prompt, task — la chiamata è partita) e `llm.call` (id del prompt, modello, token, latenza, stato),
`memory.written` (episodi / fatti / note con tipo e ruolo dell'autore), `episode.linked` (duplicate / corrects),
`recall.served` (strumento, modalità, id di episodi e claim restituiti, conteggi), `digest.written`, `consolidation.finished`,
`episode.forgotten`. Solo metadati — id, tipi, conteggi, token — mai il contenuto di messaggi o ricordi. Nulla è
sintetizzato: la dashboard (WORK_PLAN 5b.6) si muove solo quando questi eventi arrivano. Contratto versionato: `ATLAS_EVENTS.md`.

Recall log: ogni `search_episodes` / `search_memory` servito, e ogni blocco di contesto di memoria servito (strumento
`memory_context`), scrive una riga `recall_log` (strumento, modalità, numero di elementi,
conversazione; mai la query né i ricordi) — la fonte dei totali dell'atlas e della protezione contro l'eco del recall (D38).

`GET api/v1/admin/owners/:id/atlas` — la mappa iniziale della dashboard di un owner: gli episodi come neuroni (tipo, ruolo
dell'autore, importanza, giorno, stato del piano, stato nascosto, posizione per significato = prime tre componenti principali degli
embedding), archi reali (vicini più prossimi per significato, correzioni, duplicati, piano → esito, ripianificazioni, persone
condivise), fatti / note / digest come corteccia, e i `totals` dell'owner lungo tutta la vita (chiamate LLM, token di input / output,
recall — da `llm_calls` e `recall_log`). Solo metadati.
