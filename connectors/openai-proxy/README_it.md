# Proxy di memoria Recordare (compatibile OpenAI)

Porta il **livello client completo** — ogni turno catturato, i ricordi pertinenti aggiunti prima di ogni risposta —
alle piattaforme di chat senza hook per plugin: **AnythingLLM**, **Open WebUI** e **LibreChat**, o qualunque
piattaforma il cui provider LLM possa essere un URL compatibile OpenAI. La piattaforma parla col proxy come se fosse il
suo provider; il proxy parla col provider vero e con Recordare.

```
piattaforma ──► proxy ──► provider upstream (qualunque API compatibile OpenAI)
                  │
                  └──► Recordare: POST api/v1/context (salva il messaggio della persona) → (risposta) → ingest della risposta
```

**Una memoria per proxy** (D50, predefinito `MEMORY_PER=instance`): l'agente dietro il proxy ha una sola memoria; gli
utenti della piattaforma che chattano con lui sono **partecipanti** riconosciuti al suo interno (ognuno diventa un
contatto della memoria, con il suo nome), e il titolare dell'account (`SELF_USERS`) è il suo "io". Una memoria per
workspace di AnythingLLM (`MEMORY_PER=workspace`) o per utente della piattaforma (`MEMORY_PER=user`, il comportamento
prima di D50) si ottengono con un'impostazione.

Per ogni `POST /v1/chat/completions` (in streaming o no):
1. **Chi**: un resolver d'identità trova la persona e la conversazione (sotto), poi la memoria. Nessuna ⇒ puro
   pass-through.
2. **Prima della risposta**: una sola chiamata (`POST api/v1/context` con `ingest`) salva l'ultimo messaggio della
   persona e restituisce i ricordi pertinenti come blocco recintato `<memory-context>`, aggiunto in fondo al primo
   messaggio di sistema (se manca, se ne aggiunge uno). Con `RECALL=false` il messaggio è salvato con un semplice
   `POST api/v1/ingest/messages`. La chiamata ha un tempo massimo (`RECALL_TIMEOUT_MS`, 1,5 s); a qualunque errore la
   richiesta prosegue senza blocco e il messaggio attende nella coda di ritentativi.
3. **La risposta** è inoltrata invariata — uno stream resta uno stream (i byte SSE passano appena arrivano mentre il
   testo viene accumulato) — e, se completa e finale, inviata a Recordare in background.

Le altre chiamate `/v1/*` (`/v1/models`, embedding, …) passano invariate. `GET /health` risponde in locale.

Il richiamo con **strumenti MCP** non fa parte del proxy: le piattaforme che supportano header MCP per utente
(LibreChat, Open WebUI) possono registrare direttamente `/mcp` di Recordare (`docs/INTEGRATION_it.md`).

## Avvio

Node ≥ 20 (locale) o Docker. Build da questa cartella: `npm ci && npm run build && node dist/main.js` (il bundle include
`packages/client`, compilato dai sorgenti). Docker, dalla radice del repository:
L'immagine pubblicata è `ghcr.io/arkimedehq/recordare-openai-proxy` (amd64 + arm64, tag `latest` e la versione); oppure,
dalla radice del repository:
```sh
docker build -f connectors/openai-proxy/Dockerfile -t recordare-openai-proxy .
```
`compose.example.yml` è un servizio da copiare accanto alla piattaforma. Tieni il proxy sulla rete privata della
piattaforma (nessuna porta pubblicata), oppure imposta `PROXY_API_KEY` (vedi Sicurezza).

### Configurazione di Recordare (admin, una volta)
```sh
# un client per la piattaforma e la sua chiave; la memoria del proxy (RECORDARE_USER) è creata al primo uso (autoProvision)
curl -H "authorization: Bearer $ADMIN_API_KEY" -H 'content-type: application/json' \
  -d '{"name":"AnythingLLM","kind":"platform","autoProvision":true}' $RECORDARE_URL/api/v1/admin/clients
curl -H "authorization: Bearer $ADMIN_API_KEY" -H 'content-type: application/json' \
  -d '{"scopes":["ingest","read"]}' $RECORDARE_URL/api/v1/admin/clients/<id client>/keys
```
Recordare non ha un flag di consenso (D50): i turni sono salvati dalla prima richiesta; per smettere, spegnere
`CAPTURE` / `RECALL` o togliere il proxy. Per usare una memoria esistente come quella del proxy, collega il suo account:
`POST api/v1/admin/identities {kind: "account", personId, clientId, externalId: "<RECORDARE_USER>"}`, oppure usa un
**token personale** (`rp_…`) al posto della chiave client: ogni richiesta risolta va allora nella memoria del token.

**Modalità** e **genere** della memoria li imposta l'admin (`PATCH api/v1/admin/owners/{id}` `{mode, gender}`) oppure,
con la chiave client, `PATCH api/v1/me` (`X-Recordare-User: <RECORDARE_USER>`): `personal` (l'assistente di una
persona: è lei l'"io", ciò che arriva senza identità dichiarata è suo) o `entity` (un assistente di famiglia, di team o
di ufficio: ciò che arriva senza identità è di "qualcuno"); `gender` `masculine` (predefinito) | `feminine` | `neutral`
per la prima persona nelle lingue con il genere. Il proxy non ha impostazioni per questi valori.

### Configurazione (ambiente)

| Variabile | Default | Significato |
|---|---|---|
| `UPSTREAM_BASE_URL` | — (obbligatoria) | Il provider vero, es. `https://api.deepseek.com/v1`; `/v1/x` → `<base>/x` |
| `UPSTREAM_API_KEY` | — | Inviata upstream come `Authorization: Bearer …`. Non impostata: passa l'`Authorization` del chiamante (la piattaforma tiene la chiave del provider) |
| `PROXY_API_KEY` | — | I chiamanti devono presentarla come chiave bearer; richiede `UPSTREAM_API_KEY` |
| `RECORDARE_URL`, `RECORDARE_API_KEY` | — | Recordare e una chiave client (`rk_…`, scope `ingest` + `read`) o un token personale (`rp_…`). Non impostate: proxy semplice |
| `MEMORY_PER` | `instance` | `instance`: una memoria per il proxy, gli utenti della piattaforma sono suoi partecipanti. `workspace`: una memoria per workspace di AnythingLLM (`anythingllm:ws:<id>`, o mappata con `USER_MAP`; altre piattaforme: quella dell'istanza). `user`: una memoria per utente della piattaforma |
| `RECORDARE_USER` | — | Chiave client, `instance` / `workspace`: l'account Recordare del proxy (la sua memoria). Senza, nulla viene ricordato (un avviso all'avvio) |
| `SELF_USERS` | — | `instance` / `workspace`: utenti della piattaforma, separati da virgola, che sono il titolare dell'account — l'"io" della memoria (`openwebui:<uuid>`, `anythingllm:2`, l'id generico nudo, o il loro id di `USER_MAP`). Tutti gli altri sono partecipanti |
| `RESOLVERS` | `generic,openwebui,anythingllm` | Resolver d'identità, in ordine (vince il primo che trova un utente) |
| `USER_MAP` | `{}` | Mappa alias JSON: `{"anythingllm:2":"andrea","openwebui:<uuid>":"andrea"}` (header generici: l'id nudo) — `user`: il suo utente Recordare; altrimenti il suo id di partecipante, un solo contatto su più piattaforme |
| `USER_MAP_ONLY` | `false` | Solo gli utenti mappati sono ricordati; gli altri passano e basta |
| `DEFAULT_USER` | — | AnythingLLM: l'utente quando quello del marcatore non è espanso (modalità utente singolo: `[User ID]`) |
| `OPENWEBUI_JWT_SECRET` | — | Modalità JWT di Open WebUI (verifica `X-OpenWebUI-User-Jwt`, HS256); gli header utente semplici sono allora ignorati |
| `RECALL_TIMEOUT_MS` | `1500` | Per la chiamata a Recordare prima della risposta (l'ingest del messaggio con il suo contesto) |
| `END_IDLE_SECONDS` | `0` | Secondi di silenzio dopo cui il proxy dice a Recordare che la conversazione è finita; `0` = il ritardo di inattività di Recordare (`IDLE_DELAY_SECONDS`, 900 s) |
| `TZ` | di sistema | Fuso orario del giorno usato negli id di conversazione sintetizzati |
| `SKIP_PATTERNS` | — | Regex aggiuntive (array JSON o separate da `\|\|`) sull'ultimo messaggio utente che marcano le chiamate di background |
| `RECALL`, `CAPTURE` | `true` | Spegne l'iniezione / la cattura |
| `LOG_UPSTREAM` | `false` | Debug: registra i messaggi inviati upstream (dati personali — mai in produzione) |
| `PORT` | `8788` | Porta d'ascolto |
| `MAX_BODY_BYTES` | 25 MB | Richiesta di chat più grande accettata |

## Identità

Una richiesta è ricordata solo se un resolver trova una persona; altrimenti è inoltrata intatta. Header e marcatori
vengono dalla **configurazione admin della piattaforma**; il testo scritto dall'utente non è mai letto per l'identità
(un marcatore in un messaggio utente è ignorato).

| Resolver | Legge | Id della persona | Nome | Conversazione |
|---|---|---|---|---|
| `generic` | `X-Recordare-User`, `X-Recordare-Conversation`, `X-Recordare-Message` (id del messaggio della persona, facoltativo), `X-Recordare-User-Name` (facoltativo) | il valore dell'header | `X-Recordare-User-Name` | il valore dell'header |
| `openwebui` | `X-OpenWebUI-User-Id`, `X-OpenWebUI-User-Name`, `X-OpenWebUI-Chat-Id` (o il firmato `X-OpenWebUI-User-Jwt`, claim `sub`, `name`) | `openwebui:<id>` | il suo nome | `openwebui:<id chat>` |
| `anythingllm` | il marcatore `[[recordare user=… name="…" ws=…]]` nel **primo messaggio di sistema** | `anythingllm:<utente>` | `name` | `anythingllm:<ws>:<utente>:<giorno>` |

L'id della persona passa per `USER_MAP`. Poi la memoria (`MEMORY_PER`):
- **`instance`** (predefinito): la memoria è `RECORDARE_USER` (o quella del token personale). Una persona in
  `SELF_USERS` è il titolare dell'account: messaggio `user`, partecipante `owner`. Chiunque altro è un partecipante con
  l'identità `{externalUserId: <id della persona>}` e il suo nome, messaggio `other` con quell'autore: Recordare lo
  lega a un contatto della memoria (creato alla prima occasione), così ciò che dice di sé resta suo. Recordare risponde
  con tutta la memoria in ogni conversazione (D50): ciò che una persona ha detto all'assistente può emergere con
  un'altra; chi gestisce la piattaforma lo dice ai suoi utenti.
- **`workspace`**: come `instance`, ma ogni workspace di AnythingLLM è una memoria a sé (`anythingllm:ws:<id ws>`, o il
  valore di `USER_MAP` per quella chiave) — per esempio un workspace di famiglia e uno di lavoro; le richieste di Open
  WebUI / LibreChat usano `RECORDARE_USER`.
- **`user`**: l'id della persona è l'utente Recordare — una memoria per utente della piattaforma, ognuno il suo "io"
  (il comportamento prima di D50; impostalo aggiornando per tenere le memorie divise per persona).

Segnaposto non espansi (`{{…}}`, `[User ID]`, `{user.name}`) e valori come `null` / `new` contano come mancanti. Senza id di conversazione, la conversazione è **una per utente (e workspace) e giorno**; gli header
d'identità (`X-Recordare-*`, `X-OpenWebUI-*`) non vanno mai upstream, e i marcatori sono tolti da ogni messaggio di
sistema.

### AnythingLLM (v1.17)
1. Provider LLM **Generic OpenAI**: base URL `http://recordare-proxy:8788/v1`, API key = `PROXY_API_KEY` (o la chiave
   del provider se il proxy la lascia passare), il nome del modello upstream, la sua finestra di contesto.
2. Nel **prompt di sistema** di ogni workspace aggiungi (dove vuoi, viene tolto prima che il provider lo veda):
   `[[recordare user={user.id} name="{user.name}" ws={workspace.id}]]`. AnythingLLM espande le variabili nelle chat
   normali e agent.
   La modalità multi-utente dà a ogni persona il suo id (`anythingllm:<id>`); in modalità utente singolo `{user.id}`
   resta `[User ID]` — imposta `DEFAULT_USER`, o scrivi un utente letterale nel marcatore (e metti
   `anythingllm:<quell'utente>` in `SELF_USERS` se è il titolare dell'account).
3. Spegni le memorie proprie di AnythingLLM (due memorie che alimentano lo stesso prompt). Le sue chiamate LLM di
   background (estrazione memorie, nomi dei thread, …) non hanno marcatore e passano e basta.

AnythingLLM **non invia l'id del thread**, quindi la conversazione è sintetizzata per workspace, utente e giorno: due
thread dello stesso giorno sono una conversazione Recordare. È l'id più stabile disponibile — un hash del primo
messaggio cambierebbe man mano che AnythingLLM tronca la cronologia. Un attributo esplicito `conv=` lo sostituisce
(utile con workspace a scopo fisso). AnythingLLM non invia nemmeno id dei messaggi: cancellazioni e modifiche in
AnythingLLM non arrivano a Recordare.

### Open WebUI
Imposta `ENABLE_FORWARD_USER_INFO_HEADERS=true` su Open WebUI e aggiungi il proxy come connessione OpenAI
(`http://recordare-proxy:8788/v1`). Preferisci la modalità JWT: lo stesso segreto in
`FORWARD_USER_INFO_HEADER_JWT_SECRET` di Open WebUI e in `OPENWEBUI_JWT_SECRET` del proxy, così un header utente
contraffatto non è creduto. Le sue chiamate di servizio (titoli, tag, domande di seguito, query di ricerca,
autocompletamento: prompt che iniziano con `### Task:`) sono saltate; il suo template RAG (anch'esso `### Task:`, col
testo della persona in `<user_query>`) è un turno vero, e si salva solo il testo di `<user_query>`.

### LibreChat
Un endpoint custom in `librechat.yaml` con gli header generici:
```yaml
endpoints:
  custom:
    - name: "Recordare"
      apiKey: "${RECORDARE_PROXY_KEY}"            # il PROXY_API_KEY del proxy (o la chiave del provider in pass-through)
      baseURL: "http://recordare-proxy:8788/v1"
      models: { default: ["deepseek-flash"], fetch: true }
      titleConvo: true
      headers:
        X-Recordare-User: "{{LIBRECHAT_USER_ID}}"
        X-Recordare-Conversation: "librechat:{{LIBRECHAT_BODY_CONVERSATIONID}}"
        X-Recordare-Message: "{{LIBRECHAT_BODY_MESSAGEID}}"
        X-Recordare-User-Name: "{{LIBRECHAT_USER_NAME}}"
```
Le richieste di titolo (`… title for the conversation …`) sono saltate da un pattern incorporato; aggiungine altri con
`SKIP_PATTERNS`.

## Turni, ripetizioni e chiamate di background
- **Id dei messaggi**: il messaggio della persona è `m:<id messaggio della piattaforma>` se la piattaforma lo invia,
  altrimenti `u:<hash(conversazione, posizione tra i messaggi utente, testo)>`; la risposta è `<quell'id>:a`.
  Recordare deduplica su questi id, quindi un nuovo tentativo non duplica mai.
- **Chiamate ripetute dello stesso turno** — loop agent (più chiamate LLM con risultati di strumenti dopo lo stesso
  messaggio utente) e rigenerazioni — hanno lo stesso id: il messaggio è inviato e il contesto chiesto **una volta**
  (in cache 15 min, il blocco è reiniettato a ogni chiamata). Si cattura solo una risposta completa **senza chiamate a
  strumenti**; una risposta rigenerata sostituisce quella salvata (`upsert`), quindi vince l'ultima. Chiamate e
  risultati degli strumenti non sono catturati (v0.1).
- **Chiamate di background** — i lavori LLM delle piattaforme stesse — non sono né catturate né arricchite di ricordi:
  nessuna identità (i lavori di AnythingLLM non hanno marcatore), i pattern incorporati (`### Task:` senza
  `<user_query>`; "generate … title … conversation/chat/thread"), `SKIP_PATTERNS`, o un header `X-Recordare-Skip`.
- **Fine di una conversazione**: Recordare estrae una conversazione dopo il suo ritardo di inattività. Con
  `END_IDLE_SECONDS` il proxy la chiude prima (`POST api/v1/ingest/conversations/{id}/end`, quando i suoi messaggi
  hanno lasciato la coda di ritentativi).

## Mai d'intralcio
- Recordare irraggiungibile o lento: la richiesta è inoltrata senza blocco dopo al massimo `RECALL_TIMEOUT_MS` per
  chiamata; dopo un errore di connessione il proxy smette per 30 s di chiamare Recordare prima delle risposte (puro
  pass-through) e mette in coda ciò che cattura.
- **Coda di ritentativi in memoria** (v0.1): fino a 1000 lotti, ~8 tentativi con back-off in ≈ 10 minuti
  (`Retry-After` rispettato), errori permanenti (400 / 413 / 422) scartati e registrati; un ultimo tentativo al
  SIGTERM; **persa al riavvio**.
- I log non contengono testo dei messaggi (salvo con `LOG_UPSTREAM`).

## Sicurezza
Il proxy si fida dell'identità dichiarata dal chiamante: chi può raggiungerlo può dichiararsi qualunque utente. Tienilo
sulla rete privata della piattaforma, oppure imposta `PROXY_API_KEY` così che solo la piattaforma possa chiamarlo; con
Open WebUI usa la modalità JWT. La chiave Recordare è una chiave client: non cambia mai le impostazioni di una persona
(`owner_settings` non è uno scope dei client).

## Limiti (v0.1)
- Nessuna iniezione di strumenti MCP (il modello riceve i ricordi nel prompt, non gli strumenti `recordare_*`); usa il
  supporto MCP della piattaforma.
- AnythingLLM: conversazioni per giorno, niente modifiche / cancellazioni; il prompt che il proxy vede è quello già
  troncato da AnythingLLM (il contesto RAG sta nel messaggio di sistema, che non è mai inviato a Recordare).
- Il contesto di memoria manca facilmente con messaggi che contengono istruzioni ("… rispondi in una frase"), domande
  in un'altra lingua o su periodi — un limite di Recordare (WORK_PLAN 6.6b punto 8), non del proxy.
- Coda di ritentativi e cache dei turni in memoria (perse al riavvio).

## Test
`npm test` (vitest: resolver, rimozione del marcatore, chiamate di background, iniezione, accumulo dello stream, turni
ripetuti, Recordare giù, pass-through), `npm run typecheck`. `smoke.sh` esegue il test end-to-end con AnythingLLM
contro un Recordare locale (`SMOKE_DIR=/una/cartella/temporanea connectors/openai-proxy/smoke.sh`; ~5 GB di disco
Docker, 2 turni LLM; rimuove poi l'immagine di AnythingLLM).

Smoke test del 2026-10-08 con AnythingLLM 1.17.0 (modalità multi-utente, modalità chat predefinita `automatic` —
percorso agent con strumenti nativi — in streaming e no) e DeepSeek come upstream. Open WebUI e LibreChat: solo test
unitari, dai loro sorgenti e documenti (nomi degli header, prompt di servizio, segnaposto) — non ancora eseguiti.
