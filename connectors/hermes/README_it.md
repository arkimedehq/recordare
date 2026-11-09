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

## Contratto memory-first (D54)

- **La carta nel prompt di sistema**: `system_prompt_block` restituisce la carta della memoria (`GET api/v1/charter`:
  come l'agente usa la sua memoria — la sua mente, da consultare prima degli altri strumenti e prima di dire che non
  sa), seguita da una riga che nomina gli strumenti `recordare_*`, finché il richiamo o gli strumenti sono attivi. Viene
  letta una volta e tenuta in cache per versione per tutto il processo (ricontrollata ogni ora).
- **Il contesto di memoria prima di ogni turno** (`prefetch`), aperto dalla scheda di sé (chi sono; attiva per default
  in Recordare). Una breve domanda di seguito ("e lui?") viene collegata al turno precedente da Recordare stesso
  (Hermes salta `prefetch` solo per i messaggi banali come "ok").
- **Le iniziative nel turno** (Recordare 0.7.0, D55): il contesto di memoria porta anche ciò che l'agente voleva dire
  o chiedere a chi sta parlando — un promemoria richiesto, "com'è andata?", "hai steso i panni?" — offerto una volta,
  senza configurazione; la carta della memoria (`charter.v3`) dice come usarlo.
- **Ripiego**: se Recordare non risponde, niente carta (solo la riga degli strumenti; un tentativo ogni 30 s) e niente
  blocco — il turno prosegue senza memoria.

## Installazione

1. Chiedi all'admin di Recordare una credenziale per la memoria dell'agente:
   - un **token personale** con gli scope `mcp`, `ingest`, `read` (`POST api/v1/admin/memories/{id}/tokens`, client di
     tipo `mcp_client`) — la memoria del token è quella dell'agente;
   - oppure una **chiave client** con gli stessi scope e un `RECORDARE_USER` fisso (l'account dell'agente: un utente del
     client, collegato dall'admin con `POST api/v1/admin/identities` o creato automaticamente se il client lo
     consente); la chiave client serve anche per una memoria per utente del gateway.

   **Modalità** e **genere** della memoria li imposta l'admin (`PATCH api/v1/admin/memories/{id}` `{mode, gender}`),
   oppure, con una chiave client o il token personale, `PATCH api/v1/me`: `personal` (il tuo assistente: tu sei l'"io", ciò che arriva senza
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

**Oppure collega il tuo id del gateway con un codice** (D51, memorie personali), al posto di `RECORDARE_SELF_IDS`. Crea
un codice monouso — "Codice di collegamento" sulla memoria nella console di amministrazione, oppure `POST api/v1/me/link-codes` con il
token personale della memoria (`→ {"code": "RCD-…", "expiresAt": …}`, dieci minuti) — e invialo da solo all'agente in
una **chat diretta** (DM) dal tuo account sulla piattaforma. Il provider lo invia subito a Recordare (non viene mai
salvato come messaggio) e, al posto del contesto di memoria, dice al modello solo di rispondere che il codice è arrivato;
poi conferma la richiesta nella console ("Da confermare" → "È il titolare") oppure con `GET api/v1/me/identities` e
`POST api/v1/me/identities/pending/{id}/confirm`, entro sette giorni. Da allora quell'id sei tu; i messaggi precedenti
mantengono la loro attribuzione. Il provider riconosce la chat dal `chat_type` del gateway (`dm` diretta, qualsiasi altro
valore un gruppo, dove un codice non chiede nulla).

**Memoria per utente (`RECORDARE_MEMORY_PER=user`, il comportamento prima di D50).** Con una chiave client la persona è
`<piattaforma>:<user_id_alt o user_id>`, tramite `RECORDARE_USER_ALIASES` se mappata; i turni senza utente del gateway
usano `RECORDARE_USER`, e senza di esso il provider resta spento. Con un token personale ogni turno appartiene alla
persona del token — a meno che sia impostata una mappa di alias: allora solo gli utenti del gateway mappati vengono
ricordati e chiunque altro scriva allo stesso bot resta fuori. Aggiornando con una mappa di alias: aggiungi
`RECORDARE_MEMORY_PER=user` per mantenere questo comportamento.

## Iniziative inviate (D55 F3, senza codice)

In ogni turno il contesto di memoria porta già ciò che l'agente voleva dire o chiedere a chi sta parlando. Per
raggiungere chi **non** sta parlando con l'agente — un promemoria chiesto, al suo minuto — si usa la **piattaforma
webhook** del gateway di Hermes in consegna diretta: Recordare invia l'iniziativa, Hermes ne manda il testo così com'è
alla chat, **senza il modello**. Il provider non c'entra.

1. **Recordare**: dichiara il canale `messaging` del client con portata `always` (console → il client → Canali, oppure
   `PATCH api/v1/admin/clients/{id}` `{channels: [{kind: "messaging", reach: "always"}]}`), poi registra un webhook per
   ciascuna rotta qui sotto, con il solo evento `initiative.deliver`:
   `POST api/v1/admin/clients/{id}/webhooks {url: "https://<gateway>/webhooks/recordare-contacts", events: ["initiative.deliver"]}`.
   La risposta mostra il segreto `whsec_…` dell'endpoint **una volta**: è il `secret` della rotta. (Recordare invia solo
   a `https` su un indirizzo pubblico, a meno che chi lo installa imposti `WEBHOOK_ALLOW_PRIVATE` per un gateway sulla
   stessa rete.)
2. **Hermes** (`~/.hermes/config.yaml`, piattaforma webhook attiva — `WEBHOOK_ENABLED=true`):

```yaml
platforms:
  webhook:
    enabled: true
    extra:
      routes:
        # Qualcuno che l'agente conosce, sulla sua chat Telegram.
        recordare-contacts:
          secret: "whsec_…"                    # il segreto dell'endpoint di Recordare
          events: ["initiative.deliver"]
          filters:
            - field: "data.channel"
              equals: "messaging"
            - field: "data.for.addressOn.telegram"
              exists: true                     # senza indirizzo Telegram: non questa rotta
          deliver: "telegram"
          deliver_only: true                   # il testo così com'è, nessun turno dell'agente
          prompt: "{data.text}"
          deliver_extra:
            chat_id: "{data.for.addressOn.telegram}"
          mirror_to_session: true              # la sua risposta arriva con il contesto
        # Il titolare della memoria (`for` è null), sul canale principale della piattaforma.
        recordare-holder:
          secret: "whsec_…"                    # il segreto del secondo endpoint
          events: ["initiative.deliver"]
          filters:
            - field: "data.channel"
              equals: "messaging"
            - field: "data.for"
              equals: null
          deliver: "telegram"
          deliver_only: true
          prompt: "{data.text}"
          mirror_to_session: true
```

   Oppure lo stesso con `hermes webhook subscribe recordare-holder --events initiative.deliver --deliver telegram
   --deliver-only --prompt "{data.text}" --mirror-to-session --secret "whsec_…"` (i filtri si impostano nella
   configurazione). Un'altra piattaforma funziona allo stesso modo (`deliver: discord`, `{data.for.addressOn.discord}`…).

Come si incastra:
- Hermes verifica la firma **Standard Webhooks** di Recordare (`webhook-id`, `webhook-timestamp`, `webhook-signature`,
  il segreto `whsec_` decodificato) e scarta un `webhook-id` ripetuto; legge l'evento dal `type` della busta.
- L'indirizzo di un contatto è l'identità che questo provider dichiara per lui (`telegram` / il suo user id — in una
  chat privata, il chat id), legata e verificata nella memoria. I template di Hermes leggono oggetti, non liste, quindi
  Recordare dà `for.addressOn` — il primo indirizzo su ogni canale — accanto a `for.addresses`. Un contatto noto solo
  tramite `user_aliases` (un id tra piattaforme) non ha un indirizzo di canale e non si raggiunge così.
- **Nessun esito riportato**: una consegna diretta non dice a Recordare che è stata detta, quindi l'iniziativa resta
  offerta, poi scade, e il tempo non ne impara nulla. Il contesto di memoria non la offre di nuovo in un turno.
- Non usato: un plugin che chiama `inject_message` — fa girare un turno dell'agente per ogni iniziativa (il modello, e
  nessuna certezza che il testo venga detto così com'è).

## Corrispondenze

| Hermes | Recordare |
|---|---|
| linea della sessione (`gateway_session_key` o piattaforma + primo id di sessione) | conversazione `hermes:<gateway_session_key o piattaforma>/<id sessione>` (canale `hermes:<piattaforma>`, titolo = titolo della sessione o nome della chat); mantenuta attraverso la compressione del contesto e `--resume`, nuova con `/new` / `/reset` |
| l'agente (`RECORDARE_USER` o il token) — memoria per utente: `user_id_alt` / `user_id` (+ alias), oppure `RECORDARE_USER` | la memoria (`X-Recordare-User` con una chiave client; altrimenti la memoria del token) |
| l'autore del turno / l'utente del gateway della sessione (memoria per agente) | il titolare dell'account (`RECORDARE_SELF_IDS`, CLI): partecipante `holder` (con `user_name`); chiunque altro: partecipante `<piattaforma>:<id utente>` con la sua identità e il suo nome |
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

- Test unitari (Recordare finto, solo libreria standard; serve Hermes importabile — oppure stub di
  `agent.memory_provider` e `agent.secret_scope` nel `PYTHONPATH`):
  `<venv di hermes>/bin/python -m unittest discover -s connectors/hermes/tests`.
- End to end contro un Recordare locale: `SMOKE_DIR=<cartella temporanea> connectors/hermes/smoke.sh` installa Hermes
  dai sorgenti in un venv sotto `SMOKE_DIR` (oppure usa `HERMES_BIN`), con `HERMES_HOME` e `HOME` usa e getta lì; tre
  turni LLM con `hermes -z` (cattura, fine sessione ed estrazione, richiamo in una nuova sessione, uno strumento di
  memoria), poi il percorso gateway con una chiave client (memoria per
  agente, un secondo utente Telegram conservato come partecipante) guidato dal `MemoryManager` stesso di Hermes senza LLM
  (`SKIP_LLM=1` esegue solo questa parte). Vedi l'intestazione di [smoke.sh](smoke.sh).

Licenza: AGPL-3.0-or-later, come Recordare.
