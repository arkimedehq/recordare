# Recordare per OpenClaw

Un plugin di [OpenClaw](https://github.com/openclaw/openclaw) che dà al tuo agente una memoria episodica a lungo termine
tenuta dal tuo servizio [Recordare](../../README_it.md) — il livello client **completo**:

- **Cattura**: ogni messaggio di una persona e ogni risposta dell'agente vanno a Recordare; quando la sessione di
  OpenClaw finisce (`/new`, `/reset`, il reset giornaliero o per inattività) Recordare estrae ciò che è successo, piani,
  fatti e note.
- **Richiamo prima di ogni turno**: una sola chiamata salva il messaggio e restituisce i ricordi rilevanti, aggiunti prima
  di esso in un blocco delimitato `<memory-context>` (`POST api/v1/context` con `ingest`, nessuna chiamata LLM, nulla se
  nulla è rilevante).
- **Strumenti di memoria**: `recordare_search_episodes`, `recordare_search_memory`, `recordare_resolve_period`,
  `recordare_remember`, `recordare_correct_episode`, `recordare_forget_episode`, `recordare_search_knowledge`,
  `recordare_learn_source` (gli strumenti MCP di Recordare, legati
  nel codice alla memoria e alla conversazione — né il modello né l'utente possono puntarli altrove), con gli schemi
  pubblicati dal servizio (`TOOLS` della libreria client). `log_episode` è escluso: la conversazione è già catturata.
- **Una memoria per l'agente** (D50): l'agente del Gateway ha una sola memoria; le persone che gli parlano — su qualsiasi
  canale, in chat dirette e gruppi — sono **partecipanti** riconosciuti al suo interno (ogni `<canale>:<senderId>`
  diventa un contatto della memoria, con il nome che ha sul canale). Tu, il titolare dell'account, sei l'"io" della
  memoria. Una memoria per persona resta disponibile (`memoryPer: "user"`).
- **Chat di gruppo**: si catturano i messaggi di tutti i membri insieme al turno che segue (gli altri membri con ruolo
  `other`). Il richiamo funziona anche nei gruppi: Recordare risponde con tutta la memoria in ogni conversazione (D50:
  per ora nessun filtro su chi legge — privacy e riservatezza verranno dopo), quindi ciò che l'agente ricorda può
  emergere davanti al gruppo.

Non occupa lo slot memoria di OpenClaw: `memory-core` (`MEMORY.md`, `memory_search`) continua a funzionare accanto.
Recordare conserva ogni turno che il plugin invia (non ha un flag di consenso, D50). Il plugin non blocca né rompe mai
un turno: ogni chiamata ha un limite di tempo (3 s prima del turno), gli errori finiscono nel log senza contenuti, i
messaggi catturati non inviati vengono ritentati in background per una decina di minuti (in memoria: un riavvio del
Gateway li perde).

Richiede OpenClaw ≥ 2026.9.9 (Node ≥ 24, come OpenClaw stesso).

## Installazione

1. Installalo in OpenClaw (sulla macchina del Gateway) da npm:
   ```
   openclaw plugins install npm:@arkimedehq/openclaw-recordare --accept-capabilities
   ```
2. Oppure da un checkout (sviluppo): `cd connectors/openclaw && npm ci && npm run build`, poi
   `openclaw plugins install --link /percorso/di/recordare/connectors/openclaw --accept-capabilities` (`--link` lo
   lascia puntato alla cartella; senza, OpenClaw lo copia). Riavvia il Gateway, poi controlla
   `openclaw plugins inspect recordare --runtime --json` (stato `loaded`, 4 hook, 8 strumenti).
3. Chiedi all'amministratore di Recordare una credenziale per la memoria dell'agente:
   - un **token personale** con gli scope `mcp`, `ingest`, `read` (`POST api/v1/admin/memories/{id}/tokens`, client di
     tipo `mcp_client`) — la memoria del token è quella dell'agente;
   - oppure una **chiave client** con gli stessi scope e l'account dell'agente in `defaultUser` (un utente del client,
     noto a Recordare o creato automaticamente se il client lo consente); la chiave client serve anche per una memoria
     per persona.

   **Modalità** e **genere** della memoria li imposta l'amministratore (`PATCH api/v1/admin/memories/{id}`
   `{mode, gender}`), oppure, con una chiave client, `PATCH api/v1/me`: `personal` (il tuo assistente: tu sei l'"io",
   ciò che arriva senza identità dichiarata è tuo) o `entity` (un agente condiviso da una famiglia, un team, un luogo:
   ciò che arriva senza identità è di "qualcuno"); `gender` `masculine` (default) | `feminine` | `neutral` per la prima
   persona nelle lingue con il genere. Il plugin non ha impostazioni per questi valori.
4. Configuralo in `~/.openclaw/openclaw.json`:
   ```json5
   {
     plugins: {
       entries: {
         recordare: {
           enabled: true,
           // Obbligatorio: gli hook di cattura e richiamo leggono la conversazione.
           hooks: { allowConversationAccess: true },
           config: {
             url: "http://localhost:8080",
             apiKey: "${RECORDARE_API_KEY}",   // rp_… o rk_…; ${VAR} viene letta dall'ambiente
             selfSenders: ["telegram:123456789"], // i tuoi sender id: sei l'"io" della memoria
             // defaultUser: "il-mio-agente",    // con una chiave client: l'account Recordare dell'agente
           },
         },
       },
     },
   }
   ```
   `allowPromptInjection: false` sulla voce bloccherebbe il blocco di richiamo (la cattura continua).

### Opzioni

| Opzione | Default | Significato |
|---|---|---|
| `url` | `RECORDARE_URL` | Indirizzo di Recordare |
| `apiKey` | `RECORDARE_API_KEY` | Chiave client (`rk_…`) o token personale (`rp_…`) |
| `memoryPer` | `agent` | `agent`: una memoria per l'agente, ogni mittente è un suo partecipante. `user`: una memoria per persona (`users`) |
| `defaultUser` | — (`me` con un token personale) | `agent`: l'account Recordare dell'agente (chiave client; senza, la memoria è spenta). `user`: l'utente dei turni senza mittente di canale |
| `selfSenders` | `[]` | `agent`: gli id `"<canale>:<senderId>"` del titolare dell'account — l'"io" della memoria. I turni senza mittente di canale (CLI, Control UI) sono sempre suoi |
| `users` | `{}` | `user`: `"<canale>:<senderId>"` → utente Recordare. I mittenti non mappati non vengono ricordati |
| `autoRecall` | `true` | Aggiunge il blocco di memoria prima di ogni turno |
| `capture` | `true` | Invia le conversazioni |
| `tools` | `true` | Offre gli strumenti `recordare_*` |
| `groups` | `true` | Cattura anche le chat di gruppo |
| `timeoutMs` | `3000` | Per la chiamata prima del turno (l'invio del messaggio con il suo contesto) |

**I tuoi sender id.** Con `memoryPer: "agent"` un mittente che non è in `selfSenders` è qualcuno che l'agente conosce,
non tu: elenca lì i tuoi id (oppure chiedi all'amministratore di legarli al sé della memoria,
`POST api/v1/admin/identities` `{kind: "participant", memoryId, personId: <la memoria>, channel, externalId}`, prima
di scrivere la prima volta). Le parole degli altri restano loro (ruolo `other`, attribuite al loro contatto), così ciò
che dicono di sé non diventa mai un fatto su di te.

**Aggiornare da una mappa `users`.** Il comportamento precedente (ogni mittente mappato un utente Recordare separato, i
non mappati non ricordati) è `memoryPer: "user"`: aggiungilo per tenere le memorie divise per persona.

### Più persone sullo stesso Gateway
Il default di OpenClaw `session.dmScope: "main"` mette **tutti i messaggi diretti di tutte le persone in un'unica
sessione**. Ogni messaggio resta attribuito al suo mittente, ma l'agente vede i turni di una persona nel contesto di
un'altra. Imposta
```json5
{ session: { dmScope: "per-channel-peer" } }
```
(oppure `per-peer` con `session.identityLinks` per chi scrive da più canali). Verifica con `openclaw security audit`.
Recordare risponde con tutta la memoria in ogni conversazione (D50): ciò che una persona ha detto all'agente può
emergere con un'altra; chi gestisce il Gateway lo dice alle persone che gli parlano.

## Corrispondenze

| OpenClaw | Recordare |
|---|---|
| sessione (chiave + session id) | conversazione `openclaw:<sessionKey>/<sessionId>` (canale `openclaw:<canale>`, titolo = chiave di sessione) |
| l'agente (`memoryPer: agent`) — oppure `<canale>:<senderId>` (`users`) / `defaultUser` (`memoryPer: user`) | la memoria (`X-Recordare-User` con una chiave client; altrimenti la memoria del token) |
| un mittente (`memoryPer: agent`) | il titolare dell'account (`selfSenders`, CLI, Control UI): partecipante `holder`, messaggio `user`; chiunque altro: partecipante `<canale>:<senderId>` con l'identità di canale `{channel, externalId: senderId}` e il nome che ha sul canale (da `message_received`), messaggio `other` — Recordare lo lega a un contatto della memoria, creato alla prima occasione |
| il messaggio della persona (`before_prompt_build`) | messaggio (come sopra), id `<currentUserMessageId o runId>:u`, salvato **prima** che l'agente parta, nella stessa chiamata che restituisce il blocco di memoria (così ciò che l'agente salva con `recordare_remember` si lega alle parole della persona); un semplice ingest se `autoRecall` è spento |
| il testo dell'agente che segue (`agent_end`) | messaggio `assistant`, id `<runId>:a` (chiamate e risultati degli strumenti non vengono inviati) |
| messaggi degli altri membri di un gruppo (`message_received`) | messaggi `other`, autore `<canale>:<senderId>` (partecipante con identità di canale); quelli del titolare dell'account come `user` (`memoryPer: agent`) |
| fine sessione (`session_end`: new, reset, idle, daily, deleted) | `POST api/v1/ingest/conversations/{id}/end` → estrazione subito invece che dopo il ritardo di inattività (non su compaction, shutdown o restart) |
| blocco di memoria | `prependContext` di `before_prompt_build` (solo per il modello in OpenClaw; mai rimandato a Recordare — il plugin lo rimuove) |
| esecuzioni cron, heartbeat, sub-agente, tra agenti e incognito | non ricordate |

## Smoke test

`SMOKE_DIR=<cartella temporanea> connectors/openclaw/smoke.sh` esegue l'intero ciclo contro un Recordare locale con
OpenClaw in Docker (cartella di stato usa e getta, tre turni LLM): vedi l'intestazione di [smoke.sh](smoke.sh). Test
unitari: `npm test`.

Licenza: AGPL-3.0-or-later, come Recordare.
