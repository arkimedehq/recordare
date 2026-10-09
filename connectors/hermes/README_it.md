# Recordare per Hermes Agent

Un memory provider per [Hermes Agent](https://github.com/NousResearch/hermes-agent) che dà all'agente una memoria
episodica a lungo termine custodita dal tuo servizio [Recordare](../../README_it.md) — il livello client **completo**:

- **Cattura**: ogni messaggio che una persona invia e ogni risposta dell'agente vanno a Recordare; quando la sessione di
  Hermes finisce (`/new`, `/reset`, uscita) Recordare estrae subito ciò che è successo, i piani, i fatti e le note invece
  di attendere il suo ritardo di inattività.
- **Richiamo prima di ogni turno**: una sola chiamata conserva il messaggio e restituisce i ricordi pertinenti
  (`POST api/v1/context` con `ingest`, nessuna chiamata LLM, niente quando non c'è nulla di pertinente); Hermes li
  aggiunge al turno dentro il proprio blocco `<memory-context>`.
- **Strumenti di memoria**: `recordare_search_episodes`, `recordare_search_memory`, `recordare_resolve_period`,
  `recordare_remember`, `recordare_correct_episode`, `recordare_forget_episode` (gli strumenti MCP di Recordare, legati
  nel codice alla memoria e alla conversazione — né il modello né l'utente possono puntarli altrove). `log_episode` è
  escluso: la conversazione è già catturata.
- **Una memoria per l'agente** (D50): l'agente Hermes ha una sola memoria; gli utenti del gateway che gli parlano
  (Telegram, Discord, … — `user_id`, `user_name`, piattaforma, e l'autore di ogni turno nelle sessioni condivise) sono
  **partecipanti** riconosciuti al suo interno: ogni `<piattaforma>:<id utente>` diventa un contatto della memoria, con
  il suo nome. Tu, il titolare dell'account, sei l'"io" della memoria. Una memoria per utente del gateway resta
  disponibile (`RECORDARE_MEMORY_PER=user`).

È l'unico memory provider esterno di Hermes (`memory.provider: recordare`); la memoria integrata `MEMORY.md` / `USER.md`
continua a funzionare accanto. Recordare conserva ogni turno che il provider invia (non ha un flag di consenso, D50). Il
provider non rompe mai un turno: ogni chiamata ha un tempo massimo, gli errori sono registrati senza contenuto, e i
messaggi catturati attendono in una piccola outbox SQLite (`$HERMES_HOME/recordare_outbox.db`) che riprova con back-off,
rispetta `Retry-After` e sopravvive ai riavvii (i messaggi mantengono i loro id, quindi un nuovo invio viene conservato
una volta sola).

Provato con Hermes Agent v0.21.6. Python puro, solo `requests` (una dipendenza di Hermes).

## Installazione

1. Chiedi all'admin di Recordare una credenziale per la memoria dell'agente:
   - un **token personale** con gli scope `mcp`, `ingest`, `read` (`POST api/v1/admin/owners/{id}/tokens`, client di
     tipo `mcp_client`) — la memoria del token è quella dell'agente;
   - oppure una **chiave client** con gli stessi scope e un `RECORDARE_USER` fisso (l'account dell'agente: un utente del
     client, collegato dall'admin con `POST api/v1/admin/identities` o creato automaticamente se il client lo
     consente); la chiave client serve anche per una memoria per utente del gateway.

   **Modalità** e **genere** della memoria li imposta l'admin (`PATCH api/v1/admin/owners/{id}` `{mode, gender}`),
   oppure, con una chiave client, `PATCH api/v1/me`: `personal` (il tuo assistente: tu sei l'"io", ciò che arriva senza
   identità dichiarata è tuo) o `entity` (un agente condiviso da una famiglia, un team, un luogo: ciò che arriva senza
   identità è di "qualcuno"); `gender` `masculine` (predefinito) | `feminine` | `neutral` per la prima persona nelle
   lingue con il genere. Il provider non ha impostazioni per questi valori.
2. Installa il provider dal repository pubblico con
   `hermes plugins install arkimedehq/recordare/connectors/hermes/recordare` (non ancora provato), oppure copialo nei
   plugin del profilo:
   ```
   cp -r connectors/hermes/recordare "$HERMES_HOME/plugins/recordare"     # HERMES_HOME predefinita: ~/.hermes
   ```
3. Configuralo in `$HERMES_HOME/.env`:
   ```
   RECORDARE_URL=http://localhost:8080
   RECORDARE_API_KEY=rp_…            # oppure rk_… (chiave client) con RECORDARE_USER=<l'account dell'agente>
   RECORDARE_SELF_IDS=telegram:123456789   # i tuoi id del gateway: sei l'"io" della memoria
   ```
   e attivalo: `hermes config set memory.provider recordare` (oppure `hermes memory setup`). Verifica con
   `hermes memory status`.

### Opzioni

Prima l'ambiente (`$HERMES_HOME/.env`), poi `memory.recordare.<chiave>` in `config.yaml` per quelle non segrete.

| Env | `memory.recordare.` | Predefinito | Significato |
|---|---|---|---|
| `RECORDARE_URL` | `url` | — | Indirizzo di Recordare |
| `RECORDARE_API_KEY` | — | — | Token personale (`rp_…`) o chiave client (`rk_…`); solo env |
| `RECORDARE_MEMORY_PER` | `memory_per` | `agent` | `agent`: una memoria per l'agente, gli utenti del gateway sono suoi partecipanti. `user`: una memoria per utente del gateway |
| `RECORDARE_USER` | `user` | — | Chiave client. `agent`: l'account Recordare dell'agente (obbligatorio: senza, il provider resta spento). `user`: l'utente Recordare dei turni senza utente del gateway (CLI, desktop, ACP) |
| `RECORDARE_SELF_IDS` | `self_ids` | — | `agent`: i tuoi id `<piattaforma>:<id utente>` (separati da virgola o lista JSON) — l'"io" della memoria. I turni senza utente del gateway (CLI) sono sempre tuoi |
| `RECORDARE_USER_ALIASES` | `user_aliases` | `{}` | JSON `{"<piattaforma>:<id utente>": "<id>"}`. `agent`: un solo id per una persona su più piattaforme (la sua identità di partecipante diventa l'id utente del client `<id>`: un solo contatto; l'id dell'account stesso sei tu). `user`: il suo utente Recordare |
| `RECORDARE_RECALL` | `recall` | `true` | Restituire il contesto di memoria prima di ogni turno |
| `RECORDARE_TOOLS` | `tools` | `true` | Offrire gli strumenti `recordare_*` |
| `RECORDARE_CAPTURE` | `capture` | `true` | Inviare le conversazioni |
| `RECORDARE_TIMEOUT` | `timeout` | `3` | Secondi per la richiesta di contesto (Hermes smette di attendere a 8) |

**Chi è chi — memoria per agente (predefinito).** Ogni turno va nella memoria dell'agente (quella del token, o
`RECORDARE_USER`). Chi parla è l'autore del turno (`author_id` / `author_name`, sessioni condivise) o l'utente del gateway
della sessione: `<piattaforma>:<user_id_alt o user_id>` (es. `telegram:123456789`). Se è in `RECORDARE_SELF_IDS`, o senza
utente del gateway (CLI): il titolare dell'account — messaggio `user`. Chiunque altro: un partecipante con l'identità di
canale `{channel: <piattaforma>, externalId: <id utente>}` (o `{externalUserId: <alias>}`) e il suo nome, messaggio
`other` con quell'autore — Recordare lo lega a un contatto della memoria, creato alla prima occasione, così ciò che dice
di sé non diventa mai un fatto su di te. Recordare risponde con tutta la memoria in ogni conversazione (D50): ciò che una
persona ha detto all'agente può emergere con un'altra; chi gestisce l'agente lo dice alle persone che gli parlano.

**Memoria per utente (`RECORDARE_MEMORY_PER=user`, il comportamento prima di D50).** Con una chiave client la persona è
`<piattaforma>:<user_id_alt o user_id>`, tramite `RECORDARE_USER_ALIASES` se mappata; i turni senza utente del gateway
usano `RECORDARE_USER`, e senza di esso il provider resta spento. Con un token personale ogni turno appartiene alla
persona del token — a meno che sia impostata una mappa di alias: allora solo gli utenti del gateway mappati vengono
ricordati e chiunque altro scriva allo stesso bot resta fuori. Aggiornando con una mappa di alias: aggiungi
`RECORDARE_MEMORY_PER=user` per mantenere questo comportamento.

## Corrispondenze

| Hermes | Recordare |
|---|---|
| linea della sessione (`gateway_session_key` o piattaforma + primo id di sessione) | conversazione `hermes:<gateway_session_key o piattaforma>/<id sessione>` (canale `hermes:<piattaforma>`, titolo = titolo della sessione o nome della chat); mantenuta attraverso la compressione del contesto e `--resume`, nuova con `/new` / `/reset` |
| l'agente (`RECORDARE_USER` o il token) — memoria per utente: `user_id_alt` / `user_id` (+ alias), oppure `RECORDARE_USER` | la memoria (`X-Recordare-User` con una chiave client; altrimenti la memoria del token) |
| l'autore del turno / l'utente del gateway della sessione (memoria per agente) | il titolare dell'account (`RECORDARE_SELF_IDS`, CLI): partecipante `owner` (con `user_name`); chiunque altro: partecipante `<piattaforma>:<id utente>` con la sua identità e il suo nome |
| il messaggio della persona (`on_turn_start`, poi `prefetch`) | messaggio `user` (titolare dell'account) o `other` con il suo autore, id `<id sessione>:<id turno>:u`, messo in coda all'inizio del turno e conservato **prima** che l'agente parta (così ciò che l'agente salva con `recordare_remember` si lega alle parole della persona): da `prefetch` nella stessa chiamata del contesto di memoria; subito se il richiamo è spento; prima di ogni chiamata a uno strumento di memoria se `prefetch` non ha potuto conservarlo |
| la risposta dell'agente (`sync_turn`, in background) | messaggio `assistant`, id `<id sessione>:<id turno>:a` (chiamate e risultati degli strumenti non vengono inviati) |
| fine sessione (`on_session_end`, `on_session_switch(reset)`) | `POST api/v1/ingest/conversations/{id}/end`, in coda dopo ogni messaggio in attesa della conversazione → estrazione subito |
| `prefetch` | `POST api/v1/context {query, ingest?}` (`ingest` = il messaggio del turno in coda) → il blocco **senza** la recinzione di Recordare (Hermes aggiunge la sua) |
| strumenti `recordare_*` | l'endpoint MCP di Recordare (`/mcp`, Streamable HTTP) con le intestazioni di utente e conversazione; una sessione MCP per memoria |
| esecuzioni cron e sub-agent (`agent_context` ≠ `primary`) | non catturate (richiamo e strumenti funzionano comunque) |
| stanze condivise (`group_sessions_per_user: false`) | memoria per agente: ogni turno attribuito al suo autore (un partecipante); memoria per utente: i turni scritti da qualcuno diverso dalla persona della sessione non vengono né catturati né serviti dalla memoria |

Ogni lettura porta `X-Recordare-Conversation`; con un token personale una conversazione che Recordare non ha ancora
conservato conta come della persona stessa.

## Test

- Test unitari (Recordare finto, solo libreria standard; serve Hermes importabile):
  `<venv di hermes>/bin/python -m unittest discover -s connectors/hermes/tests`.
- End to end contro un Recordare locale: `SMOKE_DIR=<cartella temporanea> connectors/hermes/smoke.sh` installa Hermes
  dai sorgenti in un venv sotto `SMOKE_DIR` (oppure usa `HERMES_BIN`), con `HERMES_HOME` e `HOME` usa e getta lì; tre
  turni LLM con `hermes -z` (cattura, fine sessione ed estrazione, richiamo in una nuova sessione, uno strumento di
  memoria), poi il percorso gateway con una chiave client (memoria per
  agente, un secondo utente Telegram conservato come partecipante) guidato dal `MemoryManager` stesso di Hermes senza LLM
  (`SKIP_LLM=1` esegue solo questa parte). Vedi l'intestazione di [smoke.sh](smoke.sh).

Licenza: AGPL-3.0-or-later, come Recordare.
