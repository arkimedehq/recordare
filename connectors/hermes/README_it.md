# Recordare per Hermes Agent

Un memory provider per [Hermes Agent](https://github.com/NousResearch/hermes-agent) che dà all'agente una memoria
episodica a lungo termine custodita dal tuo servizio [Recordare](../../README_it.md) — il livello client **completo**:

- **Cattura**: ogni messaggio che una persona invia e ogni risposta dell'agente vanno a Recordare; quando la sessione di
  Hermes finisce (`/new`, `/reset`, uscita) Recordare estrae subito ciò che è successo, i piani, i fatti e le note invece
  di attendere il suo ritardo di inattività.
- **Richiamo prima di ogni turno**: i ricordi pertinenti al messaggio arrivano da `POST api/v1/context` (nessuna
  chiamata LLM, niente quando non c'è nulla di pertinente); Hermes li aggiunge al turno dentro il proprio blocco
  `<memory-context>`.
- **Strumenti di memoria**: `recordare_search_episodes`, `recordare_search_memory`, `recordare_resolve_period`,
  `recordare_remember`, `recordare_correct_episode`, `recordare_forget_episode` (gli strumenti MCP di Recordare, legati
  nel codice alla persona e alla conversazione — né il modello né l'utente possono puntarli altrove). `log_episode` è
  escluso: la conversazione è già catturata.

È l'unico memory provider esterno di Hermes (`memory.provider: recordare`); la memoria integrata `MEMORY.md` /
`USER.md` continua a funzionare accanto. Nulla viene conservato finché l'admin di Recordare non ha attivato il consenso
della persona. Il provider non rompe mai un turno: ogni chiamata ha un tempo massimo, gli errori sono registrati senza
contenuto, e i messaggi catturati attendono in una piccola outbox SQLite (`$HERMES_HOME/recordare_outbox.db`) che
riprova con back-off, rispetta `Retry-After` e sopravvive ai riavvii (i messaggi mantengono i loro id, quindi un nuovo
invio viene conservato una volta sola).

Provato con Hermes Agent v0.21.6. Python puro, solo `requests` (una dipendenza di Hermes).

## Installazione

1. Chiedi all'admin di Recordare una credenziale:
   - **una persona** (il tuo assistente): un **token personale** con gli scope `mcp`, `ingest`, `read`
     (`POST api/v1/admin/owners/{id}/tokens`, client di tipo `mcp_client`);
   - **più persone** (un gateway: Telegram, Discord, …): una **chiave client** con gli stessi scope; ogni persona è un
     utente del client (`X-Recordare-User`), collegato dall'admin (`POST api/v1/admin/identities`) o creato
     automaticamente se il client lo consente.
2. Copia il provider nei plugin del profilo (oppure, quando il repository sarà pubblico,
   `hermes plugins install arkimedehq/recordare/connectors/hermes/recordare`):
   ```
   cp -r connectors/hermes/recordare "$HERMES_HOME/plugins/recordare"     # HERMES_HOME predefinita: ~/.hermes
   ```
3. Configuralo in `$HERMES_HOME/.env`:
   ```
   RECORDARE_URL=http://localhost:8080
   RECORDARE_API_KEY=rp_…            # oppure rk_… (chiave client)
   ```
   e attivalo: `hermes config set memory.provider recordare` (oppure `hermes memory setup`). Verifica con
   `hermes memory status`.

### Opzioni

Prima l'ambiente (`$HERMES_HOME/.env`), poi `memory.recordare.<chiave>` in `config.yaml` per quelle non segrete.

| Env | `memory.recordare.` | Predefinito | Significato |
|---|---|---|---|
| `RECORDARE_URL` | `url` | — | Indirizzo di Recordare |
| `RECORDARE_API_KEY` | — | — | Token personale (`rp_…`) o chiave client (`rk_…`); solo env |
| `RECORDARE_USER` | `user` | — | Chiave client: l'utente Recordare dei turni senza utente del gateway (CLI, desktop, ACP) |
| `RECORDARE_USER_ALIASES` | `user_aliases` | `{}` | JSON `{"<piattaforma>:<id utente>": "<utente Recordare>"}` |
| `RECORDARE_RECALL` | `recall` | `true` | Restituire il contesto di memoria prima di ogni turno |
| `RECORDARE_TOOLS` | `tools` | `true` | Offrire gli strumenti `recordare_*` |
| `RECORDARE_CAPTURE` | `capture` | `true` | Inviare le conversazioni |
| `RECORDARE_TIMEOUT` | `timeout` | `3` | Secondi per la richiesta di contesto (Hermes smette di attendere a 8) |

**Chi è chi.** Con una **chiave client** la persona è `<piattaforma>:<user_id_alt o user_id>` (es.
`telegram:123456789`), tramite `RECORDARE_USER_ALIASES` se mappata; i turni senza utente del gateway usano
`RECORDARE_USER`, e senza di esso il provider resta spento. Con un **token personale** ogni turno appartiene alla
persona del token — a meno che sia impostata una mappa di alias: allora solo gli utenti del gateway mappati vengono
ricordati e chiunque altro scriva allo stesso bot resta fuori.

## Corrispondenze

| Hermes | Recordare |
|---|---|
| linea della sessione (`gateway_session_key` o piattaforma + primo id di sessione) | conversazione `hermes:<gateway_session_key o piattaforma>/<id sessione>` (canale `hermes:<piattaforma>`, titolo = titolo della sessione o nome della chat); mantenuta attraverso la compressione del contesto e `--resume`, nuova con `/new` / `/reset` |
| `user_id_alt` / `user_id` (+ alias), oppure `RECORDARE_USER` | l'utente (`X-Recordare-User` con una chiave client; altrimenti la persona del token) |
| il messaggio della persona (`on_turn_start`) | messaggio `user`, id `<id sessione>:<id turno>:u`, conservato **prima** della richiesta di contesto e prima che l'agente parta (così ciò che l'agente salva con `recordare_remember` si lega alle parole della persona) |
| la risposta dell'agente (`sync_turn`, in background) | messaggio `assistant`, id `<id sessione>:<id turno>:a` (chiamate e risultati degli strumenti non vengono inviati) |
| fine sessione (`on_session_end`, `on_session_switch(reset)`) | `conversationEnded` (l'ultimo messaggio reinviato con l'indicazione, dopo ogni messaggio in attesa della conversazione) → estrazione subito |
| `prefetch` | `POST api/v1/context {query}` → il blocco **senza** la recinzione di Recordare (Hermes aggiunge la sua) |
| strumenti `recordare_*` | l'endpoint MCP di Recordare (`/mcp`, Streamable HTTP) con le intestazioni di utente e conversazione; una sessione MCP per persona |
| esecuzioni cron e sub-agent (`agent_context` ≠ `primary`) | non catturate (richiamo e strumenti funzionano comunque) |
| stanze condivise (`group_sessions_per_user: false`) | i turni scritti da qualcuno diverso dalla persona della sessione non vengono né catturati né serviti dalla memoria |

Ogni richiesta porta `X-Recordare-Conversation` una volta che Recordare ha conservato la conversazione; con un token
personale la primissima lettura di una nuova conversazione è diretta del proprietario (senza intestazione).

## Test

- Test unitari (Recordare finto, solo libreria standard; serve Hermes importabile):
  `<venv di hermes>/bin/python -m unittest discover -s connectors/hermes/tests`.
- End to end contro un Recordare locale: `SMOKE_DIR=<cartella temporanea> connectors/hermes/smoke.sh` installa Hermes
  dai sorgenti in un venv sotto `SMOKE_DIR` (oppure usa `HERMES_BIN`), con `HERMES_HOME` e `HOME` usa e getta lì; tre
  turni LLM con `hermes -z` (cattura, fine sessione ed estrazione, richiamo in una nuova sessione, uno strumento di
  memoria), poi il percorso gateway con una chiave client guidato dal `MemoryManager` stesso di Hermes senza LLM
  (`SKIP_LLM=1` esegue solo questa parte). Vedi l'intestazione di [smoke.sh](smoke.sh).

Licenza: AGPL-3.0-or-later, come Recordare.
