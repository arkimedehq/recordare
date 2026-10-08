# Contratti API v1

*Traduzione italiana di [API.md](API.md) — la versione inglese è quella di riferimento.*

Stato: **contratti M1, revisione 3** (2026-10-03): applicate le revisioni di coerenza e di sicurezza, poi suddiviso
in profili di deployment (§0) così che la v1 resti focalizzata sul twin.
**Costruito (2026-10-07)**: §2 ingest, §3 strumenti MCP (come indicato per ciascuno), `GET / PATCH api/v1/me`, l'API
admin, la telemetria live e lo snapshot dell'atlas. Le sezioni o righe contrassegnate **not built yet (v1 plan)** sono il
contratto ancora da costruire (§4 API di lettura, §5 SDK, OpenAPI, `Idempotency-Key`).
Neutrale rispetto al client: nulla qui è specifico di Arkimede. Modello dati: `DATA_MODEL.md`. Due livelli di
integrazione (visione → Architecture): **basic** = solo strumenti MCP; **full** = ingest REST + MCP + API di lettura
+ SDK.

Convenzioni: JSON su HTTPS; i controller hard-codano `api/v1/…` (nessun prefisso globale); ISO 8601 con
offset; uuid; errori come problem details RFC 9457 (`{type, title, status, detail, code}`); gli schemi zod
sono l'unica fonte di verità e generano `GET /api/v1/openapi.json` (**not built yet**); paginazione
`?cursor&limit` → `{items, nextCursor}`; ogni POST non idempotente accetta un header `Idempotency-Key`
(finestra di replay di 24 h, viene restituita la stessa risposta — **not built yet**; l'ingest è idempotente sugli id dei messaggi).

## 0. Profili di deployment (D33)

| Profilo | Per chi | Contenuto |
|---|---|---|
| **v1 — privato / di ricerca** (`home`) (costruito ora) | Un'installazione gestita dai suoi proprietari e dai loro client (Arkimede, Claude Code, il simulatore di ricerca) | Proprietari e identità creati dall'**API admin**; chiavi API dei client; **personal access token** per i client solo MCP (creati via API admin); credenziali con hash e scope semplici; isolamento per proprietario; **contesto del visualizzatore risolto da Recordare** (la disclosure fa parte del twin, non è un'aggiunta di sicurezza); provenienza `author_role`; flag di consenso; oblio che resta |
| **Public** (rinviato — M7 / rilascio pubblico) | Recordare come servizio per persone che l'operatore non conosce | Login del proprietario (magic link via email, email verificata, pagine del proprietario), OAuth 2.1 per i connettori MCP, link code guidati dal proprietario + UI di revoca, `read_audit`, tabella di idempotenza persistente, policy di conservazione dei backup e avviso sulla conservazione presso il provider, export limitato alle sessioni del proprietario; protezione a livello di rete (firewall / WAF / rate limit) davanti |

Gli elementi contrassegnati **(public profile)** qui sotto sono specificati perché il design resti coerente, ma non sono
costruiti nella v1. Nulla nel profilo public modifica le righe di memoria, quindi abilitarlo in seguito non richiede alcuna migrazione
dei dati.

## 1. Identità, autenticazione, contesto del visualizzatore (task 1.1, 1.5 → D24)

### Modello
- **Person**: un essere umano noto all'installazione. **Owner**: una persona con una memoria (una per
  persona, qualunque sia la piattaforma). I contatti sono persone con ambito limitato alla memoria di un solo owner.
- **Client**: un'integrazione di piattaforma (installazione di Arkimede, configurazione di Claude Desktop, strumento di import).
- **External identity**: `client_user` (`clientId + externalUserId`) oppure `channel`
  (`telegram:…`, `phone:+39…`, `email:…`); solo i collegamenti verificati identificano gli interlocutori.

### Autenticazione dell'owner (public profile)
**v1**: gli owner sono creati dall'admin (`POST api/v1/admin/owners`); il consenso (`episodicEnabled`),
i token personali e i collegamenti di identità sono gestiti tramite l'API admin o un personal token dell'owner;
non esistono pagine dell'owner. Il consolidamento notturno si avvia da solo (`CONSOLIDATION_HOUR`, fuso orario dell'owner); `POST api/v1/admin/owners/:id/consolidate` lo esegue subito (rispetta `X-Recordare-Now` dove consentito); `POST api/v1/admin/owners/:id/review-facts` esegue subito la sola revisione dei fatti (WORK_PLAN 5.6, stesso lock del consolidamento). Profilo di qualità (D35): `qualityProfile` `economy | balanced | full` alla creazione dell'owner /
`PATCH api/v1/admin/owners/:id` (`null` = il default dell'installazione `QUALITY_PROFILE`, `balanced` se non impostato). Le stesse
route accettano `kind` `human | entity` (D48: una **memoria di entità**, condivisa da tutti coloro che usano l'account — un dispositivo domestico,
un robot, un luogo) e `PATCH` accetta `displayName` (una successiva sincronizzazione del nome del suo utente da parte di un client lo sovrascrive: il nome segue la piattaforma).

**Public profile**: gli owner accedono alle pagine di Recordare con un **magic link via email** (niente password; passkey e
OIDC in seguito). La sessione dell'owner serve per: dare il consenso (`episodicEnabled`), creare link
code, revocare client, autorizzare client MCP OAuth, creare token personali, export, il
diario self-service.
- L'email dell'owner viene impostata **solo** tramite una mail di verifica che l'owner apre (claim flow); non
  viene mai presa dai payload del client o dell'ingest, e modificarla richiede la sessione corrente dell'owner
  più la verifica del nuovo indirizzo.
- Magic link: monouso, ≤ 15 min, con rate limit per indirizzo e IP, legati al browser che
  li ha richiesti; notifiche di nuovo accesso via email.
- Un owner auto-provisionato (creato da un client) non ha email finché non viene rivendicato: fino ad allora la sua
  memoria è protetta esattamente quanto la chiave di quel client, e non ha pagine dell'owner. I toggle dell'host
  (ad es. "abilita diario" di Arkimede) **aprono la pagina dell'owner di Recordare**; non modificano mai il consenso
  con la chiave del client.

### Credenziali (D24)
| Livello | Credenziale | Agisce come |
|---|---|---|
| Full | **Client API key** `Authorization: Bearer rk_…` | Gli owner associati a quel client, selezionati per richiesta con `X-Recordare-User: <externalUserId>` |
| Basic | **Personal access token** `rp_…`, legato a un owner + un client, creato dall'owner (sessione dell'owner) — per i client MCP in grado di inviare header (Claude Code, Cursor, SDK) | Quell'owner |
| Basic (OAuth) — public profile | **OAuth 2.1** secondo la specifica di autorizzazione MCP (code + PKCE, registrazione dinamica del client, metadati della risorsa protetta); l'owner accede (magic link) e acconsente — per i client che lo richiedono (connettori Claude Desktop / claude.ai). Pianificato per M6; i token personali coprono M3–M5 | Quell'owner |
| Admin | Chiave API con scope `admin` | Gestione dell'installazione |

### Scope
| Scope | Consente |
|---|---|
| `ingest` | §2 ingest, modifiche, cancellazioni delle conversazioni del client stesso |
| `mcp` | §3 strumenti (lettura + `log_episode`, `correct_episode`, `forget_episode`) |
| `read` | §4 endpoint GET |
| `write` | §4 inserimenti manuali, correzioni, oblio, modifiche dei fatti |
| `owner_settings` | `PATCH settings` incluso `episodicEnabled` — mai le chiavi API dei client (consenso, D4). v1: chiave admin o token personale dell'owner; public profile: sessioni dell'owner / token creati dall'owner |
| `export` | §4 job di export — v1: chiave admin o token personale dell'owner; public profile: solo sessioni dell'owner, download con scadenza |
| `admin` | `api/v1/admin/…` |

Chiavi e token: hash argon2id, mostrati una sola volta, prefisso visibile, rotazione tramite crea + revoca. Un
client non può mai emettere token per un altro client. I replay di `Idempotency-Key` hanno ambito
`(credential, owner, method + path)`; la v1 li tiene in Redis per 24 h (tabella persistente nel
public profile).

### Contesto del visualizzatore (chi vedrà il risultato) — ogni lettura
L'insieme dei visualizzatori è **risolto da Recordare, mai dichiarato dal client o dall'LLM**:
- **Chiavi API dei client e sessioni MCP aperte con esse**: l'unica fonte accettata è
  `X-Recordare-Conversation: <externalConversationId>`, risolto rispetto ai partecipanti che Recordare
  ha ingerito per quella conversazione. `X-Recordare-Viewers` e `_meta.recordare.viewers` possono solo
  **aggiungere** visualizzatori (restringendo ciò che viene restituito), mai sostituire l'insieme risolto. Una lettura **senza
  una conversazione risolvibile non restituisce nulla**.
- **Token personali e sessioni dell'owner** (uso diretto dell'owner, ad es. Claude Code): nessun header → visualizzatori =
  l'owner; un header di conversazione, se inviato, si applica come sopra.
- (Public profile) l'insieme dei visualizzatori risolto e la sua fonte sono scritti in `read_audit`.

Regola (`DATA_MODEL.md` → regola di lettura): nella fase 1 i ricordi — e i dati grezzi derivati dalle chat
(citazioni, estratti `fromChats`, id dei messaggi) — sono restituiti solo quando i visualizzatori sono esattamente
l'owner; altrimenti la risposta è vuota con una nota neutra (`"nothing to show here"`) che non
rivela se esistano ricordi. Elementi mancanti e vietati appaiono uguali.

### Collegare la stessa persona tra client
**v1**: l'admin collega le identità (`POST api/v1/admin/identities {personId, kind, clientId |
channel, externalId}`); collegare un id già legato a un altro owner fallisce con un generico
`400 cannot_link`.

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

Admin (`api/v1/admin/…`), costruito: `POST clients`, `POST clients/:id/keys`, `DELETE keys/:id`, `POST owners`,
`PATCH owners/:id`, `POST identities`, `POST owners/:id/tokens`, `DELETE tokens/:id`, `POST owners/:id/consolidate`,
`POST owners/:id/review-facts`, `GET owners` (owner con dimensione della memoria, per l'atlas), `GET owners/:id/atlas`,
`GET telemetry/stream` (§6). Non ancora costruiti: job di export dell'owner / cancellazione totale.

## 2. Ingest REST (task 1.2) — integrazione full

### `POST api/v1/ingest/messages` (scope `ingest`)
```ts
{
  conversation: {
    externalId: string;
    source?: "chat" | "voice" | "import_chat" | "import_social" | "import_email"
           | "import_notes" | "interview";                // default "chat"
    channel?: string; title?: string;
    participants?: Array<{
      ref: string; role: "owner" | "assistant" | "other"; displayName?: string;
      identity?: { channel: string; externalId: string } | { externalUserId: string };
      // resolved to a person only if the identity is verified for this owner;
      // otherwise stored by display name (never enters `audience`)
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
  }>;
  hints?: { conversationEnded?: boolean };
}
```
Risposta **`200`** dopo che le righe grezze sono state scritte in modo sincrono (l'estrazione è sempre asincrona):
`{conversationId, accepted, duplicates, conflicts: [externalId…], stored: boolean}`.
- Stesso `externalId` e stesso contenuto → duplicato (ignorato). Stesso `externalId`, contenuto diverso →
  elencato in `conflicts` (stile `409` per elemento) a meno che `upsert: true`, che registra una modifica.
- **Owner senza `episodicEnabled`** → non viene memorizzato nulla, `stored: false` (nessun log grezzo senza
  consenso). Disabilitarlo in seguito interrompe ingest ed estrazione; i ricordi esistenti restano finché l'owner
  non li cancella ("disabilita e cancella" è offerto nella pagina dell'owner).
- Ogni batch accettato (ri)pianifica il job idle della conversazione (D1, D5, ritardo globale); i messaggi
  sono estratti quando in attesa, per `sentAt`, così i messaggi in ritardo o fuori ordine non vengono mai saltati.

### Modifiche e cancellazioni
- `PATCH api/v1/ingest/conversations/{externalId}/messages/{messageExternalId}` `{content}`.
- `DELETE …/messages/{messageExternalId}`, `DELETE api/v1/ingest/conversations/{externalId}` →
  purge (`DATA_MODEL.md` → Forgetting and deletion). Come costruito: la purge viene eseguita in modo sincrono e restituisce `202` senza
  corpo (piano: `202` + id del job).

### Import
`source: import_*` con `sentAt` storico, in batch; estratti dal percorso notturno con segmentazione per
argomento (D29); supersessione solo in avanti per `sentAt`.

## 3. Strumenti MCP (task 1.3) — entrambi i livelli

Trasporto: **MCP streamable HTTP** su `/mcp`. **Una sessione MCP per owner**: l'owner è fissato
a `initialize` (owner del token, oppure `X-Recordare-User` per le chiavi client); ogni richiesta riconvalida
`X-Recordare-User` rispetto all'owner della sessione — una discrepanza restituisce 403 e termina la sessione
(gli host che riutilizzano una sessione per più utenti non possono incrociare le memorie). Il contesto del visualizzatore segue il §1
(header di conversazione; `_meta` può solo aggiungere visualizzatori). Gli schemi degli strumenti usano il sottoinsieme neutrale rispetto al provider
(D27). Gli strumenti sono sempre elencati (nessun indizio sull'esistenza di un diario); con `episodicEnabled` disattivato, le letture
non restituiscono nulla e le scritture sono rifiutate con un errore neutro.

### `log_episode` (D11)
| Param | Tipo | Note |
|---|---|---|
| `content` | string, obbligatorio | |
| `kind` | `"event" \| "plan"` | default `event` |
| `occurred_at`, `occurred_until` | string | data / datetime ISO risolta dall'agente |
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
  riga invalidata.
- `forget_episode {id}` → oblio come in `DATA_MODEL.md` (tombstone, nessun ritorno).

### `search_episodes` (D12, D13, D29)
| Param | Tipo | Note |
|---|---|---|
| `query` | string | Facoltativo per panoramiche pure di un periodo |
| `from`, `to` | string | Date ISO, estremi inclusi, abbinate per sovrapposizione (`resolve_period` aiuta) |
| `mode` | `"search" \| "list" \| "latest"` | `search` per rilevanza; `list` cronologico nell'intervallo; `latest` prima le corrispondenze più recenti |
| `include_plans` | boolean | default true |
| `limit` | integer | default: search 10, list 30, latest 5 |

Restituisce:
```ts
{
  period?: { from: string; to: string };
  digests: Array<{ day: string; text: string }>;     // list mode without query
  episodes: Episode[];                                // in period / matching
  outsidePeriod: Episode[];                           // same shape; filled only when the period has no match (max 5)
  fromChats: Array<{ conversationId: string; messageId: string; at: string; excerpt: string }>;
  notes: string[];                                    // e.g. unresolved plans, shared-conversation notice
}
type Episode = {
  id: string; kind: "event" | "plan" | "state_change"; content: string;
  when: string;                                       // human-readable, with precision
  planStatus?: "open" | "confirmed" | "cancelled" | "rescheduled" | "unresolved";
  rescheduledTo?: string; origin: "owner_lived" | "owner_told" | "assistant_stated";
  authorRole: "owner" | "assistant" | "other" | "tool";   // who wrote the evidence
  people: string[]; feelings: string[]; opinion?: string;
  source: { conversationId: string; messageIds: string[]; at: string };
};
```
Ogni elemento riporta `authorRole` (`owner | assistant | other | tool`) così che gli host possano racchiudere i contenuti
non dell'owner come dati, non come istruzioni; tali elementi riportano anche `claimedBy` (i nomi di chi ha scritto l'evidenza), ogni
risultato nomina il proprio `owner` (gli elementi parlano dell'owner in terza persona: è l'utente a chiedere), gli estratti di chat riportano
il proprio `author` quando non è l'owner; quando tali elementi vengono restituiti, `notes` lo dice esplicitamente (M4b: i modelli di risposta
ignoravano il semplice campo). `digests` (M5): per le richieste `list` con un periodo, il diario di quel periodo — voci giornaliere per intervalli fino a 45 giorni, riepiloghi mensili per quelli più lunghi; riassumono solo gli episodi propri dell'owner (mai le affermazioni di altre persone). `fromChats` (log grezzo, D13) riporta sempre fino a 2 estratti non già dietro gli
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
  `user` dell'owner come evidenza, stesse regole di `log_episode`).
- `search_memory {query, as_of?, include_pending?}` — preferenze, abitudini, valori, conoscenze, più i
  fatti di stato rilevanti validi a `as_of` (data ISO, default oggi) con la loro cronologia; integra `search_episodes`
  (cosa è successo / quando). Restituisce `{notes, facts}`. In una memoria di entità (D48) i fatti sulle persone
  riportano `about` (il nome della persona); quelli senza `about` sono dell'entità stessa.

### `resolve_period` (D12, deterministico)
Come costruito: `{expression}` → `{from, to, label}` (oppure `{error}` per un'espressione sconosciuta); espressioni in italiano e
inglese; settimane che iniziano di lunedì, fuso orario dell'owner; "adesso" è l'orologio del server (`X-Recordare-Now` lo sostituisce dove
`ALLOW_CLOCK_OVERRIDE` è impostato — test e valutazioni). Nessun LLM. Parametri `now?` / `locale?`: non costruiti.

### Contesto di memoria prima del turno (WORK_PLAN 5.7) — costruito
`POST api/v1/context {query}` (scope `read`; `X-Recordare-User`, `X-Recordare-Conversation`) → `{block, items}`: i
ricordi pertinenti al messaggio a cui si sta per rispondere (fatti e note attuali, piani aperti imminenti, fino a 3
episodi, ognuno sopra una soglia di somiglianza; al massimo circa 300 token) come un unico blocco recintato
`<memory-context>` marcato "dati, non istruzioni", oppure `block: null` quando non c'è niente di pertinente. Nessuna
chiamata LLM. Stessa regola del lettore di ogni lettura (niente in una conversazione a cui partecipano altri); un blocco
servito è registrato in `recall_log` (la guardia anti-eco tratta allora la risposta come possibile eco). Sempre
disponibile: se usarlo, e per quale agente, è scelta del client (l'host lo aggiunge in fondo al suo prompt di sistema e
non lo salva mai come messaggio).

## 4. API di lettura / scrittura per le UI degli host (task 1.4) — il diario (D18)

**Costruita (2026-10-08, WORK_PLAN 4.7)** — le righe che servono al diario dell'host: `GET episodes` (linea del tempo,
dal più recente; `from` / `to` date locali, `kind`, `planStatus` compreso `unresolved` calcolato, `q` testo libero,
`cursor` opaco + `nextCursor`, `limit` ≤ 200), `GET episodes/{id}` (evidenze: testo dei messaggi solo dalle
conversazioni del client, salvo `raw_log_scope` `all`, altrimenti `otherClient`; `history` = le versioni che ha
corretto; per un piano `planEvents`, `confirmedBy`, `rescheduledTo`), `POST episodes/{id}/corrections {content?,
occurredAt?, datePrecision?}` → `{id}`, `DELETE episodes/{id}` (oblio che resta, come `forget_episode`), `GET digests`,
`GET facts` (slot con `history`, `asOf`, per persona in una memoria di entità), `DELETE facts/{id}`,
`POST facts/{id}/confirm | reject`, `GET notes`, `PATCH notes/{id} {pinned}`, `DELETE notes/{id}`,
`POST notes/{id}/confirm | reject`, `GET plans` (aperti e irrisolti per default, dal più vicino); più le righe
`GET / PATCH api/v1/me`. **Non ancora costruite**: inserimento manuale, correzioni di fatti / note, promozioni (5.4),
oblio di un periodo (5.5), impostazioni, uso, export, il feed delle modifiche delle note, `GET facts/{id}` /
`GET notes/{id}`. Libreria client: `packages/client` (`episodes`, `episode`, `digests`, `facts`, `notes`, `plans`,
`correctEpisode`, `forgetEpisode`, `pinNote`, `delete`, `decide`).

Con ambito limitato all'owner, e chi legge è l'owner stesso nell'interfaccia dell'host (owner-direct): una chiave
client indica la persona con `X-Recordare-User` (scope `read` per leggere, `write` per modificare), un token personale è
la persona; nessuna intestazione di conversazione, nessuna risoluzione del lettore (la regola del lettore vale per le
risposte dentro le conversazioni). In una memoria di entità chiunque usi l'account la vede tutta (D48).

| Metodo + percorso | Scope | Scopo |
|---|---|---|
| `GET api/v1/episodes?from&to&kind&planStatus&q&cursor&limit` | read | Timeline |
| `GET api/v1/episodes/{id}` | read | Dettaglio: evidenza (citazioni filtrate da `raw_log_scope` e dalla regola del visualizzatore), cronologia delle correzioni, piano / evento collegato |
| `POST api/v1/episodes` | write | Inserimento manuale |
| `POST api/v1/episodes/{id}/corrections` | write | Correzione (nuova riga, `corrects`) |
| `DELETE api/v1/episodes/{id}` | write | Dimenticare un episodio |
| `POST api/v1/forget {from, to, keepRaw?}` | write | Dimenticare un periodo (job asincrono) |
| `GET api/v1/digests?level&from&to` | read | Voci del diario |
| `GET api/v1/facts?key&asOf&status&includePending` / `GET …/{id}` | read | Fatti con cronologia |
| `POST api/v1/facts/{id}/corrections`, `DELETE api/v1/facts/{id}` | write | Correggere o dimenticare un fatto |
| `POST api/v1/facts/{id}/confirm` / `…/reject` | write | Fatti in sospeso (D20) |
| `GET api/v1/promotions?status` + `POST …/{id}/confirm\|reject` | read / write | Proposte di pattern (D20, D26) |
| `GET api/v1/plans?status` | read | Piani aperti / irrisolti |
| `GET api/v1/notes?category&pinned&includePending` / `GET …/{id}` | read | Note semantiche (D34) |
| `POST api/v1/notes`, `POST …/{id}/corrections`, `POST …/{id}/confirm\|reject`, `PATCH …/{id} {pinned}`, `DELETE …/{id}` | write | Gestire le note |
| `GET api/v1/notes/changes?since=<seq>` | read | Change feed per i client che tengono copie (Arkimede → A-MEM, D34) |
| `GET api/v1/settings`, `PATCH api/v1/settings` | read / owner_settings | `episodicEnabled`, locale, timezone |
| `GET api/v1/usage?from&to` | read | Chiamate LLM e token per questo owner |
| `POST api/v1/exports` → `GET api/v1/exports/{id}` | export | Export completo asincrono (archivio JSON) |
| `GET api/v1/me` | read | Per chi agisce la richiesta: `{ownerId, displayName, kind, episodicEnabled, atlasUrl?, via, scopes}` (`atlasUrl`: `ATLAS_URL`, quando l'atlas è installato) (`kind` `entity` = una memoria condivisa: il client lo comunica ai suoi utenti) (`episodicEnabled` = il consenso dell'owner: finché non è dato, l'ingest non memorizza nulla) (con una chiave client: la persona dietro `X-Recordare-User`, auto-provisionata se il client lo consente) |
| `PATCH api/v1/me {displayName?, kind?}` | ingest (chiave client) | Le impostazioni della persona provenienti dalla sua piattaforma: il nome segue l'utente del client (sincronizzazione a ogni rinomina); `kind` `human \| entity` (D48) solo finché la memoria non ha episodi, fatti o note → altrimenti 409 `memory_not_empty` (l'admin può comunque cambiarlo). Il consenso non si imposta mai qui |
| `GET api/v1/me/identities`, `DELETE api/v1/me/identities/{id}` | sessione dell'owner (public profile) | Client / identità connessi, revoca |

## 5. Libreria client (task 1.6, WORK_PLAN 6.7) — costruita (2026-10-07)

`@arkimedehq/recordare-client` in `packages/client/` (vedi il suo README): `RecordareClient` (`me`, `updateMe`, `ingest`
diviso in richieste da 500, `editMessage`, `deleteMessage` / `deleteConversation` con 404 = fatto, `mcp.listTools` /
`mcp.callTool` con l'SDK MCP ufficiale e una sessione per utente + conversazione), `PersonDirectory` (persona in cache,
consenso, tipo e indirizzo di Atlas; l'opt-in della piattaforma; sincronizzazione del nome), `afterFailure` (politica di
consegna dell'outbox: back-off con jitter, `Retry-After`, parcheggio su 400 / 413 / 422), errori tipizzati (RFC 9457).
All'host restano solo la memorizzazione dell'outbox e la trasformazione delle sue chat. Una suite di conformità la
esegue contro il servizio nella CI (`service/test/conformance`). Non ancora costruiti: i wrapper della API di lettura
(§4: episodi, fatti, digest) — arrivano con la §4.

## 6. Versionamento e compatibilità
- Modifiche incompatibili solo sotto `api/v2/…`; modifiche additive all'interno della v1; nomi degli strumenti MCP stabili, nuovi
  parametri facoltativi.
- I contract test (M3) eseguono gli stessi scenari attraverso REST + MCP, a entrambi i livelli, inclusa la
  regola del contesto del visualizzatore (le conversazioni condivise non ottengono nulla).

### Console admin (WORK_PLAN 6.9)
`GET /admin` serve una pagina statica (pubblica: non contiene dati) sopra la API admin; l'operatore digita la chiave
admin, che resta solo in quella scheda del browser (CSP restrittiva, `no-store`). Rotte usate oltre a quelle sopra, tutte
solo admin e solo metadati: `GET api/v1/admin/persons` (owner con impostazioni, conteggi di messaggi / episodi / fatti /
note, estrazione in attesa, identità collegate, token personali attivi per prefisso), `GET api/v1/admin/clients` (client
con chiavi attive per prefisso), `PATCH api/v1/admin/clients/:id {autoProvision?, disabled?}` (disabled = tutte le chiavi
e i token del client smettono subito di funzionare), `DELETE api/v1/admin/identities/:id` (scollega l'utente di un client
da una persona; i ricordi restano).

### Telemetria live (M5b, solo admin)
`GET api/v1/admin/telemetry/stream[?owner=<personId>]` — Server-Sent Events, uno per ogni passo reale all'interno del servizio:
`message.ingested`, `extraction.started` / `extraction.finished`, `work.started` / `work.finished` (op: `embed.messages`, `context`, `embed.memories`, `recall`, `consolidation`; id, durata — lavoro senza chiamata LLM), `llm.started` (id del prompt, task — la chiamata è partita) e `llm.call` (id del prompt, modello, token, latenza, stato),
`memory.written` (episodi / fatti / note con tipo e ruolo dell'autore), `episode.linked` (duplicate / corrects),
`recall.served` (strumento, modalità, id di episodi e claim restituiti, conteggi), `digest.written`, `consolidation.finished`,
`episode.forgotten`. Solo metadati — id, tipi, conteggi, token — mai il contenuto di messaggi o ricordi. Nulla è
sintetizzato: la dashboard (WORK_PLAN 5b.6) si muove solo quando questi eventi arrivano. Contratto versionato: `ATLAS_EVENTS.md`.

Recall log: ogni `search_episodes` / `search_memory` servito scrive una riga `recall_log` (strumento, modalità, numero di elementi,
conversazione; mai la query né i ricordi) — la fonte dei totali dell'atlas e della protezione contro l'eco del recall (D38).

`GET api/v1/admin/owners/:id/atlas` — la mappa iniziale della dashboard di un owner: gli episodi come neuroni (tipo, ruolo
dell'autore, importanza, giorno, stato del piano, stato nascosto, posizione per significato = prime tre componenti principali degli
embedding), archi reali (vicini più prossimi per significato, correzioni, duplicati, piano → esito, ripianificazioni, persone
condivise), fatti / note / digest come corteccia, e i `totals` dell'owner lungo tutta la vita (chiamate LLM, token di input / output,
recall — da `llm_calls` e `recall_log`). Solo metadati.
