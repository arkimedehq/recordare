# Recordare per OpenClaw

Un plugin di [OpenClaw](https://github.com/openclaw/openclaw) che dà al tuo agente una memoria episodica a lungo termine
tenuta dal tuo servizio [Recordare](../../README_it.md) — il livello client **completo**:

- **Cattura**: ogni messaggio di una persona e ogni risposta dell'agente vanno a Recordare; quando la sessione di
  OpenClaw finisce (`/new`, `/reset`, il reset giornaliero o per inattività) Recordare estrae ciò che è successo, piani,
  fatti e note.
- **Richiamo prima di ogni turno**: i ricordi rilevanti per il messaggio vengono aggiunti prima di esso in un blocco
  delimitato `<memory-context>` (`POST api/v1/context`, nessuna chiamata LLM, nulla se nulla è rilevante).
- **Strumenti di memoria**: `recordare_search_episodes`, `recordare_search_memory`, `recordare_resolve_period`,
  `recordare_remember`, `recordare_correct_episode`, `recordare_forget_episode` (gli strumenti MCP di Recordare, legati
  nel codice alla persona e alla conversazione — né il modello né l'utente possono puntarli altrove). `log_episode` è
  escluso: la conversazione è già catturata.
- **Chat di gruppo**: si catturano i turni delle persone note, con i messaggi degli altri membri come contesto (ruolo
  `other`). Recordare mostra i ricordi solo quando chi li vede è esattamente il proprietario, quindi nei gruppi il
  richiamo resta vuoto.

Non occupa lo slot memoria di OpenClaw: `memory-core` (`MEMORY.md`, `memory_search`) continua a funzionare accanto. Nulla
viene salvato finché l'amministratore di Recordare non ha attivato il consenso della persona. Il plugin non blocca né
rompe mai un turno: ogni chiamata ha un limite di tempo (3 s prima del turno), gli errori finiscono nel log senza
contenuti, i messaggi catturati non inviati vengono ritentati in background per una decina di minuti (in memoria: un
riavvio del Gateway li perde).

Richiede OpenClaw ≥ 2026.9.9 (Node ≥ 24, come OpenClaw stesso).

## Installazione

1. Installalo in OpenClaw (sulla macchina del Gateway) da npm:
   ```
   openclaw plugins install npm:@arkimedehq/openclaw-recordare --accept-capabilities
   ```
2. Oppure da un checkout (sviluppo): `cd connectors/openclaw && npm ci && npm run build`, poi
   `openclaw plugins install --link /percorso/di/recordare/connectors/openclaw --accept-capabilities` (`--link` lo
   lascia puntato alla cartella; senza, OpenClaw lo copia). Riavvia il Gateway, poi controlla
   `openclaw plugins inspect recordare --runtime --json` (stato `loaded`, 4 hook, 6 strumenti).
3. Chiedi all'amministratore di Recordare una credenziale:
   - **una persona** (il tuo assistente): un **token personale** con gli scope `mcp`, `ingest`, `read`
     (`POST api/v1/admin/owners/{id}/tokens`, client di tipo `mcp_client`);
   - **più persone**: una **chiave client** con gli stessi scope; ogni persona è un utente del client
     (`X-Recordare-User`), noto a Recordare o creato automaticamente se il client lo consente.
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
             apiKey: "${RECORDARE_API_KEY}",          // rp_… o rk_…; ${VAR} viene letta dall'ambiente
             users: { "telegram:123456789": "alice" }, // "<canale>:<senderId>" → utente Recordare
             defaultUser: "alice",                     // turni senza mittente di canale (CLI, Control UI)
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
| `users` | `{}` | `"<canale>:<senderId>"` → utente Recordare. I mittenti non mappati non vengono ricordati |
| `defaultUser` | — (`me` con un token personale) | Utente dei turni senza mittente di canale |
| `autoRecall` | `true` | Aggiunge il blocco di memoria prima di ogni turno |
| `capture` | `true` | Invia le conversazioni |
| `tools` | `true` | Offre gli strumenti `recordare_*` |
| `groups` | `true` | Cattura anche le chat di gruppo |
| `timeoutMs` | `3000` | Per chiamata prima del turno (l'invio del messaggio, poi il contesto) |

Con un token personale e la mappa `users` vuota ogni turno appartiene alla persona del token (installazione per una
persona). Se altre persone possono parlare con l'agente, mappa i tuoi sender id in `users`: tutti gli altri restano
fuori.

### Più persone sullo stesso Gateway
Il default di OpenClaw `session.dmScope: "main"` mette **tutti i messaggi diretti di tutte le persone in un'unica
sessione**, quindi i turni di una persona finirebbero nel contesto di conversazione di un'altra. Imposta
```json5
{ session: { dmScope: "per-channel-peer" } }
```
(oppure `per-peer` con `session.identityLinks` per chi scrive da più canali) e mappa ogni persona in `users`. Verifica
con `openclaw security audit`.

## Corrispondenze

| OpenClaw | Recordare |
|---|---|
| sessione (chiave + session id) | conversazione `openclaw:<sessionKey>/<sessionId>` (canale `openclaw:<canale>`, titolo = chiave di sessione) |
| `<canale>:<senderId>` (`users`), oppure `defaultUser` | l'utente (`X-Recordare-User` con una chiave client; altrimenti la persona del token) |
| il messaggio della persona (`before_prompt_build`) | messaggio `user`, id `<currentUserMessageId o runId>:u`, inviato **prima** che l'agente parta (così ciò che l'agente salva con `recordare_remember` si lega alle parole della persona) |
| il testo dell'agente che segue (`agent_end`) | messaggio `assistant`, id `<runId>:a` (chiamate e risultati degli strumenti non vengono inviati) |
| messaggi degli altri membri di un gruppo (`message_received`) | messaggi `other`, autore `<canale>:<senderId>` (partecipante con identità di canale) |
| fine sessione (`session_end`: new, reset, idle, daily, deleted) | `conversationEnded` → estrazione subito invece che dopo il ritardo di inattività (non su compaction, shutdown o restart) |
| blocco di memoria | `prependContext` di `before_prompt_build` (solo per il modello in OpenClaw; mai rimandato a Recordare — il plugin lo rimuove) |
| esecuzioni cron, heartbeat, sub-agente, tra agenti e incognito | non ricordate |

## Smoke test

`SMOKE_DIR=<cartella temporanea> connectors/openclaw/smoke.sh` esegue l'intero ciclo contro un Recordare locale con
OpenClaw in Docker (cartella di stato usa e getta, tre turni LLM): vedi l'intestazione di [smoke.sh](smoke.sh). Test
unitari: `npm test`.

Licenza: AGPL-3.0-or-later, come Recordare.
