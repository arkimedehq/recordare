# Integrare una piattaforma client (M6)

*Traduzione italiana di [INTEGRATION.md](INTEGRATION.md) — la versione inglese è quella di riferimento.*

Come una piattaforma di agenti (prima Arkimede, poi qualsiasi altra) usa Recordare come memoria dei suoi utenti, al
**livello completo** (chiave API del client, ingest REST + MCP). Contratti: `API.md`; eventi per la vista in tempo
reale opzionale: `ATLAS_EVENTS.md`.

Infrastruttura (standalone, o co-ospitato con Arkimede su un piccolo server): `DEPLOYMENT.md`.

**Usa la libreria client** (`packages/client`, WORK_PLAN 6.7): fa le sezioni 2–4 qui sotto allo stesso modo per ogni
piattaforma — persona, consenso e sincronizzazione del nome, ingest, cancellazioni, richiamo MCP con le intestazioni
giuste, la politica di consegna dell'outbox — e passa la suite di conformità. Alla piattaforma restano solo la
memorizzazione dell'outbox e la trasformazione delle sue chat.

## 1. Configurazione (amministratore, una volta)
1. Creare il client: `POST api/v1/admin/clients {name, kind: "platform", autoProvision: true}`.
2. Creare la sua chiave: `POST api/v1/admin/clients/{id}/keys {scopes: ["ingest", "mcp", "read", "write"]}` (`write` per le modifiche della persona in un diario) — mostrata una sola
   volta; conservarla come segreto della piattaforma.
3. **Il consenso resta all'amministratore / al proprietario** (D4): la chiave di un client non può mai attivare la
   memoria episodica di una persona. Profilo privato: l'amministratore la attiva per persona
   (`PATCH api/v1/admin/owners/{ownerId} {episodicEnabled: true}`). Profilo public: l'interruttore dell'host apre la
   pagina del proprietario di Recordare.

## 2. Persone
- Ogni richiesta nomina l'utente della piattaforma: `X-Recordare-User: <the platform's own user id>`. Con
  `autoProvision` la persona viene creata al primo contatto; `GET api/v1/me` restituisce `ownerId` — conservarlo
  accanto al proprio utente (lega la propria telemetria alla persona: attributo OpenTelemetry `recordare.owner_id`).
- Dare alla persona il nome del proprio utente e tenerlo sincronizzato: `PATCH api/v1/me {displayName}` ogni volta che
  l'utente rinomina il proprio profilo (il nome segue la piattaforma). La scelta dell'utente sul tipo di memoria segue
  la stessa via: `PATCH api/v1/me {kind: human | entity}` (D48 — `entity` per un account condiviso che usano tutti),
  accettato solo finché la memoria è vuota (409 `memory_not_empty`). `GET api/v1/me` restituisce `kind` (mostrare una
  memoria condivisa come tale) e `atlasUrl` quando Recordare Atlas è installato (collegarlo solo per i propri
  amministratori: mostra l'attività di ogni persona).
- `GET api/v1/me` indica anche `episodicEnabled`: finché il consenso non è dato, l'ingest non memorizza nulla —
  mostrare all'utente "in attesa di attivazione" invece di accumulare i suoi messaggi (trattenerli aggirerebbe il
  consenso).
- La stessa persona su due piattaforme: l'amministratore collega le identità (`POST api/v1/admin/identities`).

## 3. Ingest — non bloccare mai la chat
- Inviare ogni messaggio persistito (utente, assistente, altri partecipanti, output degli strumenti) con
  `POST api/v1/ingest/messages`, con `externalId` stabili (idempotente: un nuovo tentativo non duplica mai) e i
  partecipanti della conversazione.
- Usare un **outbox**: scrivere prima il messaggio nella propria tabella, inviare in modo asincrono, ritentare con
  back-off; un'interruzione di Recordare non deve mai far fallire o rallentare la chat. Modifiche ed eliminazioni
  seguono (`API.md` §2).

## 4. Richiamo — MCP
- Registrare l'endpoint MCP di Recordare (`/mcp`) nel proprio client MCP con la chiave e `X-Recordare-User`.
- **Inviare sempre `X-Recordare-Conversation: <externalConversationId>`**: Recordare stabilisce chi vedrà la risposta
  dai partecipanti che ha ricevuto in ingest; senza una conversazione risolvibile una lettura con una chiave client non restituisce nulla (un token personale legge
  come la persona anche prima che la sua conversazione sia salvata)
  (regola dello spettatore, `API.md` §1).
- Facoltativo, per agente: `POST api/v1/context {query}` prima di una risposta restituisce i ricordi pertinenti come
  blocco recintato da mettere in fondo al prompt di sistema (`API_it.md`, WORK_PLAN 5.7) — l'agente può rispondere senza
  chiamare uno strumento.
- Strumenti: `search_episodes`, `search_memory` (fatti e note), `resolve_period`, `log_episode`, `correct_episode`,
  `forget_episode`, `remember`.

## 4b. Client MCP standard — Claude Code (livello basic, WORK_PLAN 6.1)
Un client che parla solo MCP (senza ingest) usa un **token personale** legato a una persona e a un client:
```bash
# amministratore, una volta: un client e il token della persona (scope mcp)
curl -H "authorization: Bearer $ADMIN_API_KEY" -H 'content-type: application/json' \
  -d '{"name":"Claude Code","kind":"mcp_client"}' $RECORDARE_URL/api/v1/admin/clients
curl -H "authorization: Bearer $ADMIN_API_KEY" -H 'content-type: application/json' \
  -d '{"clientId":"<id client>","scopes":["mcp"]}' $RECORDARE_URL/api/v1/admin/owners/<id persona>/tokens
# la persona, in Claude Code (scope local = solo questo progetto; user = tutti i progetti)
claude mcp add --transport http --scope user recordare $RECORDARE_URL/mcp --header "Authorization: Bearer rp_…"
```
- Con un token personale le letture sono dirette del titolare (non serve l'intestazione della conversazione).
- **Le scritture attendono la persona**: un client così non invia conversazioni, quindi Recordare non ha le parole
  della persona dietro ciò che l'agente scrive. `log_episode` viene salvato come affermato dall'assistente (dedotto),
  `remember` come nota in attesa che il richiamo mostra solo con `include_pending`; la persona la conferma nel suo
  diario (API di lettura §4, per esempio il Diario di Arkimede). È la protezione contro l'avvelenamento (API.md §3),
  voluta; un client che invia anche la conversazione (Arkimede) ottiene ricordi confermati.
- Smoke test del livello basic (usare una persona di prova: scrive un episodio, poi lo dimentica, e una nota in
  attesa): `RECORDARE_URL=… RECORDARE_TOKEN=rp_… npm run smoke:mcp` in `service/`. Provato con Claude Code l'8/10/2026.
- Claude Desktop: i suoi connettori remoti richiedono OAuth, che la v1 non offre (D33); un ponte locale che aggiunge
  l'intestazione (per esempio `mcp-remote` con `--header`) dovrebbe funzionare ma non è provato.

## 5. Osservabilità (opzionale)
Recordare Atlas mostra il lavoro di Recordare stesso dal suo flusso di telemetria; i propri agenti (chiamate LLM,
strumenti) compaiono quando si esportano le tracce OpenTelemetry GenAI verso l'atlas (README di `recordare-atlas`) —
solo metadati, con `recordare.owner_id` sugli span.
