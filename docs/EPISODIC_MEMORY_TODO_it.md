# Memoria episodica — TODO di progettazione

*Traduzione italiana di [EPISODIC_MEMORY_TODO.md](EPISODIC_MEMORY_TODO.md) — la versione inglese è quella di riferimento.*

Stato: **implementata** (2026-10-07) in `service/` — log grezzo, episodi, piani, fatti, note, digest, strumenti di richiamo,
scritture esplicite e dimenticanza di un singolo episodio; i punti aperti per milestone sono in `WORK_PLAN.md` (M5 parziale, M6 in
corso). Aggiornamento (2026-10-08): **rilasciata come v0.1.0** (pubblica, profilo privato — D33), con l'API di lettura per
il diario, il contesto di memoria prima del turno, la libreria client e i connettori; aperti: passaggio notturno dei
messaggi in attesa (D1), dimenticare un periodo (D16), promozioni dei pattern (D20 / D26), l'endpoint del feed delle
modifiche delle note (D34) — WORK_PLAN M4–M7. Valutazione dei motori (`spikes/memory-eval/RESULTS.md`, round 2 + held-out): un prototipo di questo design (D)
ha battuto Memobase, Graphiti e la baseline grezza; D23 (approvata) lo costruisce. Decisioni prese durante la realizzazione: D36–D48.

Questa è la **fase 1** della visione del digital twin (`DIGITAL_TWIN_VISION.md`): la memoria
episodica è la fondazione su cui si costruiscono la memoria del twin, il suo automodello e la sua iniziativa.

## Problema

L'attuale memoria di Arkimede (A-MEM, vedi `docs/MEMORY.md` di Arkimede) è **semantica**: fatti durevoli sull'
utente (preferenze, profilo, vincoli, conoscenze), recuperati top-K e iniettati nel
prompt. L'estrazione scarta deliberatamente gli eventi isolati.

Vogliamo una memoria **episodica**: "cosa è successo e quando", ad es. *"oggi sono andato a sciare
in montagna"*. Un simile ricordo è irrilevante per quasi ogni turno, ma deve poter essere
richiamato su richiesta, magari una sola volta, mesi dopo:

- "quando è stata l'ultima volta che sono andato a sciare?"
- "cosa ho fatto la settimana scorsa?"
- "quante volte sono andato in montagna quest'inverno?"

Regola guida: **memorizzare tutto, non iniettare nulla automaticamente, recuperare su richiesta.**

## Modello cognitivo (riferimento)

Il design segue il funzionamento della memoria umana: il cervello è sempre in ascolto ma
**non** memorizza tutto — è una cascata di filtri.

| Memoria umana | Ruolo | Controparte in Arkimede |
|---|---|---|
| Memoria sensoriale (~250 ms visiva, ~3 s uditiva) | Buffer grezzo, quasi tutto va perso | **Log grezzo dei messaggi** — qui battiamo il cervello: tutto è conservato alla lettera, per sempre |
| Attenzione / memoria di lavoro (~4 elementi) | Filtro: solo ciò a cui si presta attenzione viene codificato | Finestra di contesto della chat |
| Codifica ippocampale | Associazione rapida e fragile di *cosa / dove / quando / chi* | **Estrazione degli episodi** (a chat inattiva) |
| Marcatura da parte dell'amigdala, novità, rilevanza per sé | Decide cosa viene consolidato con più forza | **Punteggio di importanza** assegnato alla codifica |
| Consolidamento nel sonno (replay → neocorteccia) | Estrae il senso generale, collega alla conoscenza esistente, gli episodi diventano conoscenza semantica ("semanticizzazione") | **Job di consolidamento notturno**: digest giornalieri, collegamenti, promozione dei pattern ricorrenti a note semantiche |
| Il recupero rafforza il ricordo (effetto di spaziatura) | I ricordi richiamati durano di più | `accessCount` / `lastAccessedAt` aumentano il punteggio nel ranking |
| Oblio (prima il dettaglio, poi l'evento; il senso generale sopravvive) | Attivo e utile: evita di annegare nei dettagli, consente la generalizzazione | **Nessuna cancellazione**: i periodi più vecchi sono serviti dai digest, il dettaglio è retrocesso nel ranking; il log grezzo resta come verità di riferimento |
| Riconsolidamento (i ricordi vengono riscritti al richiamo → falsi ricordi) | Difetto umano | **Deliberatamente NON copiato**: nessuna riscrittura, ogni episodio conserva la provenienza (coerente con l'evoluzione conservativa di A-MEM) |

## Stato dell'arte

Il design a strati è in linea con lo stato dell'arte; nulla di quanto segue cambia la
direzione, ma diversi elementi portano raffinamenti concreti (vedi sottosezione successiva).

| Lavoro | Cosa fa | Rilevanza per noi |
|---|---|---|
| **Zep / Graphiti** (open source, [arXiv 2501.13956](https://arxiv.org/abs/2501.13956)) | Ogni input entra come **episodio** senza perdite; entità/relazioni estratte in un grafo di conoscenza temporale. Modello **bi-temporale** (tempo dell'evento vs tempo di acquisizione); i fatti hanno `valid_from` / `valid_to` / `invalid_at` — i fatti superati vengono invalidati, non cancellati. | Sistema più vicino. Lo strato di episodi grezzi = il nostro Strato 0. Bi-temporalità + validità adottate. DB a grafo (Neo4j/FalkorDB) + servizio Python non adottati. |
| **MemoryBank** (AAAI 2024, [arXiv 2305.10250](https://arxiv.org/abs/2305.10250)) | Gerarchia: **riassunti giornalieri degli eventi** → riassunti globali → profilo di personalità dell'utente. **Curva dell'oblio di Ebbinghaus**: la forza decade col tempo, si rinforza al recupero, si elimina sotto una soglia. | Convalida i digest (Strato 2) e il boost di accesso. Usiamo la forza solo per il ranking, mai per l'eliminazione. |
| **Letta (ex MemGPT) — sleep-time compute** ([blog](https://www.letta.com/blog/sleep-time-compute/)) | Un secondo agente "dormiente" lavora nei tempi morti: rilegge le conversazioni, riorganizza la memoria; dichiara fino a 5× meno calcolo al momento del test. | Convalida il consolidamento notturno / a riposo. |
| **Active Dreaming Memory**, **HEMA** ([arXiv 2504.16754](https://arxiv.org/abs/2504.16754)) | Teoria dei Complementary Learning Systems: store ippocampale veloce + store neocorticale lento; il "sonno" offline consolida le tracce episodiche in regole semantiche, deduplica le tracce ridondanti. | Convalida la promozione episodio → semantica e la deduplica nel consolidamento. |
| **Pink et al., "Episodic Memory is the Missing Piece for Long-Term LLM Agents"** (2025, [arXiv 2502.06975](https://arxiv.org/abs/2502.06975)) | Cinque proprietà della memoria episodica: archiviazione a lungo termine, ragionamento esplicito, apprendimento one-shot, specifica dell'istanza, contestualizzata. | Checklist per il modello dati degli episodi — i nostri campi le coprono tutte e cinque. |
| **LongMemEval** (ICLR 2025, [arXiv 2410.10813](https://arxiv.org/abs/2410.10813)) | Benchmark + ablazioni sulle pipeline di memoria. **Espansione della query consapevole del tempo** (indicizzare per data dell'evento, l'LLM estrae l'intervallo temporale dalla domanda) → **+11,4% di recall** sulle domande temporali. La granularità migliore per il valore = **singolo scambio**, non sessione. **Chiavi aumentate con fatti**: cercare su brevi fatti estratti che puntano al testo grezzo. | Indicazione empirica più forte: filtro per data, granularità per evento, episodio-come-chiave con provenienza verso lo scambio grezzo. |
| **Generative Agents** (Park et al., Stanford 2023) | Flusso di memoria ordinato per **recenza + importanza + rilevanza**; la **riflessione** periodica sintetizza intuizioni di livello superiore. | Formula di ranking + riflessione = consolidamento. |
| **ES-Mem** ([arXiv 2601.07582](https://arxiv.org/abs/2601.07582)) | Segmentazione in eventi di dialoghi lunghi in unità di evento coerenti. | Possibile approccio per dividere una chat in episodi. |
| **Omi** (open source), **Limitless** (prodotti) | Cattura sempre attiva da dispositivo indossabile → trascrizioni, "ricordi", riassunti giornalieri. | Versione consumer di "sempre in ascolto"; il codice di Omi merita un'occhiata per la UX di cattura/riassunto. |
| **Mem0** | Livello di memoria basato sull'estrazione di fatti. | Si sovrappone ad A-MEM esistente; non adottato. |

Avvertenza sui benchmark (LoCoMo, LongMemEval, BEAM): ogni fornitore pubblica numeri
in cui vince (ad es. Mem0 dichiara ~94% contro ~49% nelle prove indipendenti). Usarli
come direzione, non come verità; valutare sulle nostre conversazioni.

### Raffinamenti adottati dallo stato dell'arte
1. **Episodi bi-temporali** (Zep): `occurredAt` (tempo dell'evento) distinto da `createdAt`
   (tempo di acquisizione); `validUntil` / `invalidatedAt` per i piani che vengono superati o
   annullati ("la prossima settimana vado a Roma" → poi annullato).
2. **Filtro per intervallo temporale al momento della query** (LongMemEval): l'agente compila `from` / `to`
   nella chiamata allo strumento, risolvendo le espressioni relative tramite `get_current_datetime`.
3. **Granularità per evento / per scambio** (LongMemEval), non per chat; episodio = chiave
   breve, `messageId` = puntatore allo scambio grezzo.
4. **Forza in stile Ebbinghaus solo per il ranking** (MemoryBank): decade col tempo,
   si rinforza al richiamo; non cancella mai.

### Costruire o riusare
Costruire sullo stack esistente (Postgres FTS, vector store, RRF, BullMQ, summarizer):
mancano solo tabelle e job. Graphiti/Zep aggiungerebbe un DB a grafo + un servizio Python
(pesante, anche sulle piccole installazioni domestiche); Mem0 si sovrappone ad A-MEM. Prendere le idee, non
le dipendenze.

## Cosa esiste oggi (in Arkimede)

- `search_conversations` di Arkimede (`backend/src/user-memory/user-memory.service.ts` → `searchConversations`): FTS su
  `messages.tsv` (config 'simple', tokenizzazione OR), limitata alle chat accessibili, restituisce
  snippet `ts_headline`. Trova già il messaggio grezzo, con dei limiti:
  - solo lessicale — "neve" non corrisponde a "sciare";
  - nessun filtro temporale — "cosa ho fatto a febbraio?" non ha risposta;
  - snippet di chat grezza, rumorosi, non un evento pulito;
  - il ricordo muore con la chat (cancellare una chat cancella la memoria);
  - le chat vocali (shim compatibile OpenAI, origine `voice`) sono stateless → mai memorizzate.
- L'estrazione automatica (`memoryExtractionPrompt`, modello summarizer, basata su soglia)
  legge già ogni nuovo turno → un aggancio naturale per estrarre eventi a costo
  aggiuntivo quasi zero.

## Direzione proposta: memoria a strati

```
Layer 0  raw log        messages (all, verbatim)              ← exists
Layer 1  episodes       one row per event, importance, date   ← encoding
Layer 2  digests        day → (week) → month summaries        ← consolidation
Layer 3  semantic notes durable facts (A-MEM user_memory)     ← exists; fed by promotion
```

### 1. Codifica (ippocampo)
- Trigger: a **chat inattiva** (non solo la soglia di N messaggi — una chat breve con un
  solo "oggi sono andato a sciare" non deve andare persa), più la cattura esplicita.
- Il summarizer estrae gli episodi **in modo ampio** (eventi in prima persona, eventi di
  persone vicine all'utente, piani) — il punteggio di importanza decide il peso, non un'
  esclusione a priori.
- Ogni episodio: `content`, `occurredAt` + `datePrecision` (giorno / mese / approssimata),
  `who` / `where` (opzionali), `importance` (1–10), `kind` (event / plan),
  provenienza `chatId` / `messageId`.
- Le date relative ("oggi", "domenica scorsa") sono risolte rispetto al **timestamp del messaggio**,
  non al momento dell'estrazione.
- Euristiche di importanza: carica emotiva, novità rispetto alla routine, rilevanza per sé;
  un esplicito "ricorda che…" → importanza massima.
- Chiamata LLM e cursore separati dall'estrazione dei fatti (vedi D2).

### 2. Consolidamento (sonno)
- Job BullMQ notturno per ogni utente con nuovi episodi (zero chiamate LLM se non c'è nulla di nuovo).
- Rielabora gli episodi del giorno e:
  - scrive un **digest giornaliero** (Strato 2); i digest settimanali/mensili si aggregano dai giornalieri;
  - collega gli episodi a note semantiche correlate / episodi precedenti;
  - rileva **pattern ricorrenti** ("ha sciato 4 weekend quest'inverno") e li propone
    come note semantiche — sempre `pending`, mai auto-confermate (regola A-MEM esistente);
  - deduplica lo stesso evento citato in più chat (collegamento, non riscrittura).
- Al massimo un passaggio, nessuna cascata (stesso vincolo dell'evoluzione di A-MEM).

### 3. Recupero (richiamo)
- Episodi e digest **non vengono mai iniettati automaticamente**: `retrieve()` e il prefisso fissato
  restano intatti. Nessuna crescita del prompt, nessuna invalidazione della cache.
- Ranking = **rilevanza** (FTS + vettoriale ibrido, RRF esistente) **+ recenza + importanza**
  (+ boost di accesso sull'episodio stesso; il boost delle note semantiche collegate è v2, D19).
- Instradamento della query in base alla forma della domanda:
  - ricerca puntuale ("quando sono andato a sciare?") → episodi;
  - panoramica di un periodo ("cosa ho fatto a ottobre?") → digest, poi episodi su richiesta;
  - aggregato ("quante volte…") → modalità elenco per intervallo di date con un tetto;
  - nulla trovato → ripiego su `search_conversations` (log grezzo).
- Ogni richiamo aggiorna `accessCount` / `lastAccessedAt`.

### 4. Oblio
- Nulla viene cancellato automaticamente. L'invecchiamento = dettaglio retrocesso nel ranking,
  periodi più vecchi serviti principalmente dai digest; log grezzo ed episodi restano raggiungibili.
- Solo cancellazione su iniziativa dell'utente (singolo episodio, "dimentica questo periodo").

## Decisioni

### D1 — Trigger di estrazione: debounce a riposo + passaggio notturno (2026-10-01)
- Contesto: oggi l'estrazione gira solo a fine turno nel flusso della chat
  (`backend/src/messages/messages.controller.ts` di Arkimede → `maybeExtractOnTurn`) quando si sono accumulati ≥ `autoMemoryThreshold`
  (default 6, utente + assistente) nuovi messaggi da
  `chat.memoryUpToMessageId`. La coda di una chat sotto soglia non viene **mai** analizzata —
  una lacuna che già oggi riguarda i fatti.
- **Debounce a riposo**: a ogni messaggio persistito, (ri)pianificare un job BullMQ ritardato per chat
  (jobId = chatId, sostituito a ogni nuovo messaggio), ritardo configurabile (~15 min).
  Allo scatto: estrarre la coda non elaborata a prescindere dalla soglia.
- **Passaggio notturno**: prima del consolidamento, elaborare ogni coda di chat rimasta non elaborata
  (job persi, riavvii). Rete di sicurezza, non il percorso primario.
- Come realizzato (2026-10-08): il debounce a riposo gira per conversazione nel servizio (D5, D22); il passaggio notturno
  delle code non elaborate **non è realizzato** (WORK_PLAN 4.1) — il passaggio orario si limita a consolidare.

### D2 — Fatti ed episodi: due chiamate LLM separate (2026-10-01)
- Il prompt e il flusso esistenti di estrazione dei fatti restano **intatti** (rischio zero di
  regressione sulla qualità dei fatti); gli episodi hanno un prompt proprio.
- Cursore separato: nuovo `chats.episodesUpToMessageId` (il cursore dei fatti
  `memoryUpToMessageId` resta invariato).
- Costo accettato: una chiamata aggiuntiva al summarizer per ogni finestra di estrazione.

### D3 — Il percorso a riposo/notturno estrae i fatti anche dalle code (2026-10-01)
- Chiude la lacuna esistente: le code di fatti sotto soglia vengono analizzate a riposo / di notte
  (condizionato da `autoMemoryEnabled`, come oggi). Modifica additiva: al massimo più
  proposte `pending`, comunque confermate dall'utente. Il percorso a soglia di fine turno resta invariato.

### D4 — Interruttore per utente separato `episodicMemoryEnabled`, default off (2026-10-01)
- Un diario è più sensibile dei fatti durevoli → opt-in esplicito, indipendente da
  `autoMemoryEnabled`.
- **Superata da D50 (2026-10-09)**: Recordare non ha più un flag di consenso (WORK_PLAN 8.1); l'interruttore acceso /
  spento appartiene alla piattaforma client.

### D5 — Ritardo a riposo: impostazione globale, default 15 min (2026-10-01)
- Come realizzato: env `IDLE_DELAY_SECONDS` (default 900), nessuna sovrascrittura per utente.
- Passaggio sugli episodi saltato (zero chiamate LLM) quando la coda non contiene alcun messaggio dell'utente.

### D6 — Tabelle dedicate `user_episodes` + `user_digests` (2026-10-01)
- `user_memory` resta intatta: nessuna query esistente (retrieve, pinned, evolution, prune,
  graph, list) richiede un filtro di esclusione. Modello dati proprio (datato, bi-temporale,
  importanza, senza scope/evoluzione). Riuso degli helper RRF + embedding.

### D7 — Una sola collezione vettoriale `user_episodes` (2026-10-01)
- Episodi e digest insieme, payload `{userId, level: 'episode'|'digest', ...}`;
  filtro per `level` quando serve.

### D8 — Livelli di digest: giorno + mese (2026-10-01)
- "La settimana scorsa" si risponde da 7 digest giornalieri; i digest mensili si aggregano dai giornalieri.

### D9 — Gli episodi estratti sono auto-confermati (2026-10-01)
- Memorizzati subito, visibili / modificabili / cancellabili nella timeline. Mai
  auto-iniettati, quindi un episodio sbagliato emerge solo se richiesto esplicitamente.
- Le promozioni di pattern ricorrenti a note semantiche restano `pending` (regola A-MEM).

### D10 — Un piano passato resta un piano finché non è confermato (2026-10-01)
- `kind='plan'` + `validUntil`. Quando la data passa, il consolidamento **non**
  lo trasforma in un evento; solo una menzione successiva che lo conferma ("Roma è stata splendida")
  crea l'evento (collegato al piano). Una menzione contraddittoria imposta
  `invalidatedAt`. Il richiamo mostra i piani passati non confermati come tali — nessuna invenzione.

### D11 — Cattura esplicita tramite lo strumento dedicato `log_episode` (2026-10-01)
- ad es. "annota che oggi ho fatto il tagliando all'auto". Parametri: `content`, opzionali
  `occurredAt` / `datePrecision`, `kind` (event|plan).
- Caricato solo quando `episodicMemoryEnabled` (classe B, come `save_memory`) → costo zero
  di prompt per gli utenti senza diario. Cattura esplicita → importanza massima.
- Come realizzato (D22): uno strumento MCP di Recordare, non uno strumento di Arkimede; importanza 10 / `stated` solo con le
  parole del proprietario a monte (`API.md` §3). Arkimede espone gli strumenti di Recordare come `recordare_*` ma non `log_episode`.

### D12 — Strumento dedicato `search_episodes` (2026-10-01)
- Simmetrico a `log_episode`, stesso gate `episodicMemoryEnabled`; `search_memory`
  resta intatto. Parametri: `query`, opzionali `from` / `to`, `mode: 'search' | 'list'`
  (list = cronologico per intervallo di date, con tetto, per "cosa ho fatto a ottobre?" /
  "quante volte…"). Le domande su un periodo leggono prima i digest, poi gli episodi su richiesta.
- Come realizzato (D22): uno strumento MCP di Recordare con `mode: search | list | latest`; `search_memory` è quello proprio di Recordare
  (note + fatti a una data), non quello di Arkimede. I digest nel richiamo sono dietro il parametro `recallDigests` (off: misurato −1,9 pt,
  WORK_PLAN 5.2).

### D13 — Ripiego automatico sul log grezzo (2026-10-01)
- Quando episodi/digest non restituiscono nulla di rilevante, `search_episodes` interroga il
  log grezzo dei messaggi (`searchConversations`) e restituisce quei risultati marcati come
  "from chats". L'agente non deve concatenare un secondo strumento.

### D14 — I pesi di ranking sono costanti nel codice (2026-10-01)
- recenza / importanza / rilevanza (+ boost di accesso) con valori fissi e testati;
  resi configurabili solo se emerge un'esigenza reale.

### D15 — Gli episodi sono solo personali (2026-10-01)
- Nessuno scope team/org; il diario non viene mai condiviso; il consolidamento non attraversa mai gli utenti.

### D16 — Conservati per sempre, solo cancellazione su iniziativa dell'utente (2026-10-01)
- Nessun TTL. L'utente cancella singoli episodi o un periodo ("dimentica marzo"); i digest
  interessati vengono ricalcolati (o cancellati) di conseguenza; le voci vettoriali rimosse.
- Come realizzato (2026-10-08): dimenticare un episodio (MCP `forget_episode`, API di lettura `DELETE episodes/{id}`; i digest
  costruiti su di esso vengono sostituiti); dimenticare un periodo è TODO (WORK_PLAN 5.5).

### D17 — Voce rinviata alla persistenza delle chat vocali (2026-10-01)
- Fuori dalla v1. Arriva con la voce di backlog "persistenza opzionale delle chat vocali", così la
  voce segue esattamente lo stesso percorso (messaggi persistiti → riposo → estrazione,
  provenienza, ripiego sul log grezzo). Nessun secondo percorso di cattura.

### D18 — Timeline del diario come scheda in Impostazioni → Memoria (2026-10-01)
- Accanto a Elenco / Grafo: vista "Diario", digest del giorno in alto e episodi sotto,
  navigazione per mese, filtri, modifica (contenuto / data / importanza), cancellazione,
  "dimentica questo periodo".
- Come realizzato: resta il piano per Arkimede (WORK_PLAN 6.3), alimentato dall'API di lettura / timeline di Recordare (`API.md` §4, non
  ancora realizzata); nel frattempo gli strumenti MCP di Recordare `correct_episode` / `forget_episode` coprono modifica e cancellazione.
- Aggiornamento (2026-10-08): la parte dell'API di lettura che serve al diario è realizzata (WORK_PLAN 4.7) e Arkimede ha la
  sua scheda Diario (Impostazioni → Diario: linea del tempo con dettaglio, correggi, dimentica; diario; fatti e note; piani;
  da confermare — WORK_PLAN 6.3); "dimentica questo periodo" è ancora TODO (WORK_PLAN 5.5).

### D19 — Boost di richiamo delle note semantiche collegate: rinviato alla v2 (2026-10-01)
- Cos'è: quando `search_episodes` restituisce un episodio collegato (dal consolidamento) a
  note semantiche, quelle note ricevono un boost di richiamo e si posizionano leggermente più in alto nel futuro
  recupero automatico (riattivazione associativa).
- Perché rinviato: oggi il ranking di `retrieve()` è **senza stato** (FTS + vettoriale → RRF →
  soglia `MIN_VECTOR_SCORE` → `RETRIEVE_TOP_K`). Il boost richiede nuovo stato su
  `user_memory` (`recallCount` / `lastRecalledAt` o una tabella laterale) **e** cambia
  quali note vengono iniettate in ogni chat — il cuore di una memoria funzionante e verificata e2e,
  da una porta di servizio, con effetti difficili da testare. In conflitto con D6.
- Direzione v2: progettare il rinforzo del richiamo come funzionalità della memoria semantica stessa
  (boost sui risultati di `search_memory` / recupero automatico), poi lasciare che gli episodi la alimentino.
- La v1 prepara i dati: i collegamenti episodio → nota sono memorizzati **lato episodio**
  (`user_episodes.linkedNoteIds`); `user_memory` non viene modificata.

### D20 — Nessuna riproposta dei pattern rifiutati: `episode_promotions` (2026-10-01)
- Problema: se l'utente rifiuta la promozione di un pattern ("Scia regolarmente d'inverno"), il
  consolidamento notturno successivo vede gli stessi episodi e lo ripropone — all'infinito.
- Tabella `episode_promotions(id, userId, pattern, proposedNoteId, episodeIds,
  status: proposed|confirmed|rejected, createdAt, updatedAt)`, lato episodio.
- Lo stato è dedotto, nessun hook in `user_memory`: al consolidamento successivo, se
  `proposedNoteId` non esiste più e non è mai stato confermato → `rejected`; se è
  `confirmed` → `confirmed`.
- Un pattern rifiutato non viene riproposto a meno che non sia supportato da nuove
  evidenze significative (nuovi episodi oltre agli `episodeIds` originali, soglia da definire
  in fase di implementazione).
- `user_memory` riceve solo l'inserimento della nota `pending`, tramite lo stesso percorso
  dell'estrazione automatica (etichetta di origine "from diary"). Nessuna UI dedicata alle promozioni nella v1.

### D21 — Gli episodi catturano emozioni e opinioni (2026-10-01)
- Guidato dall'obiettivo del digital twin: "giornata splendida", "il rifugio era deludente" fanno parte
  di chi è il proprietario, non sono rumore.
- Campi dell'episodio: `valence` (-2..+2), `feelings` (brevi tag liberi), `opinion`
  (presa di posizione opzionale in una riga espressa dal proprietario). La carica emotiva alimenta anche
  `importance` (marcatura dell'amigdala).
- Predisposizione per la fase 3 (disclosure): gli episodi che coinvolgono terze parti conservano
  `people` (nomi come citati) così che un livello di disclosure possa essere applicato in seguito.

### D22 — Realizzato come servizio autonomo in un repository proprio: Recordare (2026-10-01)
- Vedi `DIGITAL_TWIN_VISION.md` → Architettura. Arkimede è il primo client
  (ingest REST + MCP); altre piattaforme tramite MCP (base) o ingest + SDK (completo).
- Impatto sulle decisioni precedenti (sostanza invariata, cambia la collocazione):
  - D1/D2: il debounce a riposo e i cursori vivono nel servizio, sulle **conversazioni
    ingerite** (non sulle `chats` di Arkimede); `episodesUpToMessageId` diventa un
    cursore lato servizio. D3 (code di fatti) resta in Arkimede finché A-MEM vive lì.
  - D6/D7: tabelle e collezione vettoriale vivono nel DB proprio del servizio.
  - D11/D12: `log_episode` / `search_episodes` esposti come strumenti MCP; Arkimede li consuma
    tramite il suo client MCP esistente.
  - D13: il ripiego cerca nel **log grezzo proprio** del servizio dei messaggi ingeriti.
  - D4/D5: interruttore e ritardo a riposo diventano impostazioni del servizio (per utente / globali).
- A-MEM resta in Arkimede per ora; la migrazione è una fase successiva.

### D23 — Motore: costruire il nostro design (D) nel servizio (approvata 2026-10-02)
- Evidenza (`spikes/memory-eval/RESULTS.md`, round 2, bge-m3, 24 domande): con rumore
  D 96% vs Memobase 88%, Graphiti 81%, baseline grezza 67%; con un `qwen3:8b` locale D 73% vs
  Memobase 65%. Il divario deriva dal modello dati (date degli eventi + filtro per data, stato dei piani,
  emozioni, storia dei fatti), non dagli embedding.
- Verifica held-out (dataset separato scritto alla cieca rispetto ai prompt di D): D 91% / 86% (base / rumore)
  vs Memobase 75% / 61% — il divario si è ampliato; gli errori di D sono registrati come lacune di design in
  `ENGINE_IDEAS.md`.
- Idee prese in prestito (Memobase, Graphiti), idee scartate e principi di costo: `ENGINE_IDEAS.md`.
- Modello del motore nel nostro setup di test: `deepseek-flash`, reasoning off — stessa qualità di
  `deepseek-v4-pro` sul set held-out, molto più economico (qualsiasi provider ammesso, vedi D27). Regola: a parità di qualità vince l'opzione più economica; mai scambiare
  qualità per costo.
- Conseguenze: nessun sidecar Python / Memobase; motore in TypeScript dietro una porta interna;
  i prompt dello spike (`systems/d_sys.py`) sono il punto di partenza per i prompt del servizio.
- Aggiunte apprese dal prototipo:
  - calendario esplicito giorno della settimana → data nei prompt di estrazione e pianificazione (risoluzione delle date);
  - l'estrattore vede i piani aperti e i fatti correnti (conferma / annullamento dei piani,
    sostituzione dei fatti) — il meccanismo D10 funziona come progettato;
  - un cambiamento di stato vissuto ("ho venduto la Golf, ora ho una Tesla") è sia un episodio sia un fatto;
  - notizie riportate senza data → data del messaggio con precisione `approximate`;
  - i fatti riformulati invariati vengono scartati (il rumore ripete la stessa notizia);
  - `search_episodes` accetta `from` / `to` dall'agente, più un resolver deterministico per le
    espressioni di periodo comuni così che i modelli agente piccoli non calcolino calendari.

### D27 — Qualsiasi provider LLM / embedding; DeepSeek e Ollama sono solo i nostri setup di test (2026-10-02)
- Recordare deve funzionare con qualsiasi LLM: ospitato (OpenAI, Anthropic, Google, Mistral, DeepSeek,
  OpenRouter, Groq, …), self-hosted (vLLM, LM Studio, Ollama) o il gateway proprio della piattaforma ospite
  (ad es. lo shim compatibile OpenAI di Arkimede). Testiamo con DeepSeek (cloud) e Ollama (locale) per
  comodità; nulla nel motore deve dipenderne.
- Adattatori `LlmPort` scelti via configurazione: **compatibile OpenAI** (copre la maggior parte dei provider e
  dei server locali) e **Anthropic nativo**; Gemini nativo solo se il suo endpoint compatibile OpenAI
  si rivela insufficiente.
- **Profilo del provider = configurazione, non codice**: come disattivare il reasoning (DeepSeek
  `thinking`, OpenAI / Ollama `reasoning_effort`, Qwen `/no_think`, Anthropic off di default),
  supporto all'output strutturato (`json_schema` → `json_object` → solo prompt con parsing tollerante
  e un nuovo tentativo di riparazione), parametro del limite di token (`max_tokens` vs `max_completion_tokens`),
  supporto alla temperatura, prompt caching (prefisso automatico vs `cache_control` esplicito), campi di
  usage per la contabilità.
- **Prompt e schemi neutrali rispetto al provider**: un solo set di prompt per tutti i provider (IT/EN), nessun tag
  specifico del vendor; schemi JSON nel sottoinsieme comune (oggetti piatti, enum, niente `oneOf` / parole chiave di formato);
  output sempre validato nel codice.
- **Ruoli dei modelli configurati indipendentemente**: estrazione, compiti leggeri (digest, dedupe), embedding
  — ognuno può usare un provider diverso (ad es. embedding locali + estrazione ospitata).
- **Embedding**: qualsiasi `/v1/embeddings` compatibile OpenAI o server locale; modello e dimensione
  fissati per installazione e memorizzati con ogni vettore; cambiare modello = job di re-embed (come Arkimede).
- **Certificazione**: un provider / modello è "supportato" quando supera la suite di valutazione (base +
  held-out) entro un margine stabilito rispetto al riferimento e il suo output strutturato si valida; un comando CLI
  esegue la suite su una data configurazione; risultati conservati in una tabella dei modelli supportati.
  A parità di qualità vince il modello più economico.
- Come realizzato (2026-10-08): un solo set di prompt scritto in inglese, con una riga che indica la lingua del proprietario;
  i dati linguistici delle parti deterministiche (periodi, nomi dei mesi, parole di relazione, nome del proprietario) stanno
  in `service/src/lang` per le lingue più usate (regola del proprietario: tutte le lingue, mai solo IT / EN). CLI di
  certificazione e tabella dei modelli supportati non realizzate (WORK_PLAN 4.5b); regola del proprietario: un modello del
  motore è supportato solo se raggiunge il 95 % sulla suite.

### D28 — Il modello dati della fase 1 riserva i campi di cui le ipotesi di ricerca hanno bisogno (2026-10-02)
- Da `RESEARCH_NOTES.md` (H1–H3): aggiungerli dopo significherebbe migrare gli episodi, quindi
  esistono fin dalla v1 anche dove la fase 1 scrive solo valori predefiniti.
- Piani: stato `open | confirmed | cancelled | rescheduled | unresolved` (un piano passato mai
  confermato diventa `unresolved` → si risponde "non so se sia successo"), `rescheduledTo`,
  data dello stato ed episodio di evidenza (estende D10).
- Tipo di episodio `event | plan | state-change`; fatti bi-temporali su entrambi gli assi: tempo del mondo
  (`validFrom` / `validTo`) e tempo della conoscenza (`recordedAt` / `expiredAt`).
- `corrects` (il vecchio valore non è mai stato vero) distinto da `supersedes` (vero fino a t); entrambi conservano
  la vecchia riga (nessuna riscrittura).
- `origin: owner_lived | owner_told | twin_experienced` su episodi e fatti (la fase 1 scrive
  i primi due), più l'interlocutore e il pubblico della conversazione.
- Etichetta `disclosure` su episodi, fatti e digest (default `owner`); gli artefatti derivati conservano
  gli id delle loro fonti così che le etichette possano propagarsi (vince la più restrittiva).
- `stated | inferred` sui fatti; quelli inferiti restano pending (vedi `ENGINE_IDEAS.md`).

### D29 — Aggiunte al modello dati e al richiamo dalla revisione della letteratura (approvata 2026-10-02)
- Fonte: `literature/README.md` (sintesi di 15 fonti lette in profondità); estende D28.
- **Insieme del pubblico (audience)**: ogni episodio, fatto, digest e voce di profilo memorizza gli id delle persone risolte
  presenti al momento della registrazione (immutabile), accanto al livello `disclosure`; i permessi sono
  valutati al momento della lettura rispetto alla policy corrente; i grant sono dati con intervalli di validità;
  gli elementi mancanti e quelli vietati restituiscono lo stesso "non trovato".
- **Gli artefatti derivati portano gli id delle fonti**; audience derivata = intersezione di quelle delle fonti;
  un artefatto senza id di fonte fallisce in modo chiuso.
- **Fatti**: stato `current | superseded | corrected | unknown_current`; per ogni fatto toccato
  l'estrattore dà un verdetto `keep | stale | replace | corrects | unknown` su un insieme ristretto di
  candidati; `derivedFrom` + `needsRecheck` deterministico (solo segnalazione, mai riscrittura automatica);
  sostituzione solo in avanti per tempo dell'evento / del messaggio (le importazioni non sovrascrivono mai fatti più recenti);
  `stated | inferred` + confidenza.
- **Piani**: l'LLM emette patch tipizzate sparse `confirm | cancel | reschedule | amend`;
  le transizioni avvengono nel codice; una menzione successiva non è un annullamento; i piani aperti sono preselezionati
  (finestra di date + embedding + persone) e referenziati per indice.
- **Estrazione vincolata all'evidenza**: ogni episodio / fatto / patch di piano cita id di messaggi, validati
  nel codice rispetto allo Strato 0; l'espressione temporale originale è memorizzata accanto alla data risolta.
- **Chiavi di recupero** (parole chiave, contesto in una riga, tag) provengono dalla stessa chiamata di estrazione.
- **Richiamo**: `search_episodes` modalità `latest`; con un intervallo di date, prima quelli nell'intervallo; catena dei
  valori per slot di fatto; stati sempre mostrati; verifica della premessa per stati presupposti; code lunghe segmentate
  per argomento prima dell'estrazione, mai troncate; tetto di affermazioni per finestra.

### D30 — Anche i turni dell'assistente vengono estratti, con una propria origine (approvata 2026-10-02)
- Le memorie derivate che ignorano l'assistente perdono ciò che ha detto o fatto (la regressione di Zep
  sul single-session-assistant) — per i client agentici sono le azioni dell'agente e le
  raccomandazioni che l'utente ha accettato.
- I turni dell'assistente sono sempre contesto di estrazione, e gli elementi dichiarati dall'assistente sono estratti con
  `origin: assistant_stated` (estende `owner_lived | owner_told | twin_experienced` di D28),
  mai fusi con i ricordi vissuti dal proprietario; il richiamo li etichetta ("l'assistente ha suggerito / fatto").

### D31 — I fatti di Recordare sono slot di stato con una catena di valori (2026-10-03; la parte sulle note è superata da D34)
- Lo Strato 3 in Recordare = **slot di stato** ("auto", "indirizzo", "datore di lavoro", "figli") con la loro
  storia, cardinalità `single` (sostituisce) o `multi` (accumula), schema degli slot con politica di fusione
  e disclosure predefinita (`DATA_MODEL.md` → fact_slots).
- Le preferenze durevoli e le note semantiche a forma libera restano nella memoria semantica del client (A-MEM in
  Arkimede) fino alla migrazione di A-MEM — nessun secondo archivio di note concorrente. Gli episodi si collegano alle note tramite
  riferimento esterno (`linked_notes`, D19); le promozioni vanno al client come proposte (D20, D26).

### D32 — Una chiamata di estrazione per finestra (modifica D2) (2026-10-03)
- Una chiamata del motore per finestra a riposo estrae episodi, patch dei piani e candidati fatto (come faceva il prototipo
  D, a qualità da prototipo); una seconda chiamata solo quando i gate deterministici lasciano
  candidati fatto ambigui da risolvere (regola di costo di `ENGINE_IDEAS.md`). Le "due chiamate" di D2 furono scritte
  quando i fatti vivevano solo in A-MEM; l'estrazione propria di A-MEM in Arkimede resta intatta (la sua chiamata
  è di Arkimede, non di Recordare).

### D33 — Profili di deployment: v1 privato / di ricerca, hardening rinviato (2026-10-03)
- Terminologia: "profilo privato" (in inglese `home`) indica chi gestisce l'installazione; non ha nulla a che fare con la memoria condivisa di un dispositivo o di una casa, che è la **memoria di entità** (D48).
- Indicazione del proprietario: restare sul twin; quando serve più sicurezza, mettere firewall e
  hardening davanti. v1 = **profilo privato / di ricerca**: proprietari creati dall'admin, chiavi client, token
  personali, scope semplici, isolamento per proprietario.
- Mantenuti nella v1 perché fanno parte del twin, non sono aggiunte di sicurezza: contesto del visualizzatore risolto da
  Recordare (sapere cosa dire a chi — pilastro della disclosure), provenienza `author_role` (principio 3,
  qualità della memoria), flag di consenso (D4 — *superato da D50, 2026-10-09: niente flag di consenso*), oblio che resta (D16).
- Rinviati al **profilo pubblico** (M7 / rilascio pubblico): login e pagine del proprietario, OAuth per MCP,
  UI di collegamento e revoca guidata dal proprietario, audit di lettura, idempotenza persistente, politica di backup / retention
  del provider, protezione di rete. Specificati in `API.md` §0 così che abilitarli non richieda alcuna migrazione
  dei dati.
- Stato (2026-10-08): la v0.1.0 è stata rilasciata pubblicamente con questo profilo, con i suoi limiti dichiarati nel README
  (WORK_PLAN M7); il profilo pubblico resta rinviato.

### D34 — Recordare è completo; A-MEM resta in Arkimede; sceglie l'utente (2026-10-03)
- **Recordare possiede una memoria personale completa**: episodi, piani, digest, fatti di stato **e
  note semantiche** (preferenze, abitudini, valori, relazioni, conoscenze), estratti nella stessa
  singola chiamata (D32). Funziona pienamente con qualsiasi client, Arkimede o no. Sostituisce il "le note restano in
  A-MEM" di D31 (gli slot di stato di D31 restano).
- **A-MEM resta in Arkimede invariata nella sua logica** (serve anche gli scope team e org).
- **Le copie fluiscono in un solo senso, per scelta dell'utente**: Arkimede, quando Recordare è connesso, mostra le
  note di Recordare e lascia che l'utente copi una nota in A-MEM (personale o team) — per regola (ad es. una categoria) o
  manualmente nota per nota, mai con richieste indiscriminate. Una copia conserva un riferimento alla nota di Recordare;
  Recordare espone un feed delle modifiche (`GET api/v1/notes/changes?since=`) così che Arkimede aggiorni o
  rimuova le copie quando la nota cambia o viene dimenticata. Copiare in team / org allarga l'audience
  → sempre un'azione esplicita dell'utente, registrata.
- **Lato Arkimede (M6, repo proprio, additivo)**: oggi un interruttore per utente (`autoMemoryEnabled`)
  governa insieme estrazione, iniezione e strumenti. Viene suddiviso in scelte indipendenti per utente:
  memoria di note personali (estrazione + uso), note team / org (uso), Recordare (connesso o no).
  Gli utenti senza Recordare ottengono la stessa flessibilità. Se un utente abilita sia l'estrazione personale di A-MEM
  sia le note di Recordare, sono possibili duplicati: la UI avvisa, non vieta (scelta dell'utente).
- Stato (2026-10-08): le note di Recordare sono realizzate; i cambiamenti sono registrati (`note_changes`) ma l'endpoint del
  feed delle modifiche non è ancora realizzato (WORK_PLAN 4.3 / 4.7); il lato Arkimede (divisione dell'interruttore, copia
  delle note in A-MEM) è TODO.

### D35 — Il costo è un'opzione, non un limite: profili di qualità (2026-10-03)
- Indicazione del proprietario: i modelli diventano più economici e i modelli locali più forti; gli utenti scelgono la qualità
  che vogliono. Ogni meccanismo costoso sta dietro un **profilo di qualità**, scelto per installazione con una
  sovrascrittura per proprietario:
  - **economy** — i principi di costo odierni (`ENGINE_IDEAS.md`): una chiamata di estrazione per finestra,
    gate rigorosi, modello leggero dove possibile, nessun reranker, digest per giorno, pensiero a riposo
    (H12) limitato ai cicli aperti deterministici;
  - **balanced** (default) — comportamento attuale del servizio v1;
  - **full** — qualità prima di tutto: il modello più forte configurato ovunque, candidati quasi-duplicati più ampi,
    un passaggio di verifica sulle estrazioni, reranker (H11), digest giorno + mese,
    pensiero a riposo completo (H12: replay, collegamenti, proposte, automodello) con cadenza regolare.
- I profili sono configurazione, mai rami di codice sparsi nel motore; ogni profilo è
  misurato sulla suite di valutazione (qualità e costo per messaggio) così che il compromesso sia visibile.
- Implementato (M4b, 2026-10-04): `service/src/engine/quality-profile.ts` — un'unica tabella di parametri (dimensione della finestra,
  ruolo del modello di estrazione, reasoning, episodi recenti / correlati, finestra e soglia dei quasi-duplicati, estratti
  di chat); `QUALITY_PROFILE` predefinito dell'installazione + `owners.quality_profile`. `balanced` = service v4 misurato.
  Non ancora: passaggio di verifica, reranker, digest mensili, H12 (arrivano con M5 / H11 e si uniscono a `full`).
- Modello per compito (regola del proprietario, 2026-10-06): ogni compito LLM ha il proprio modello e provider configurabili
  (`LLM_<TASK>_*`, compiti `extract`, `extract_economy`, `resolve`, `digest`, `facts`); i default sono documentati come il miglior modello misurato.
  I profili scelgono il compito di estrazione (`economy` → `extract_economy`), mai un modello.
- Sostituisce la precedente regola "il più economico possibile" con: **mai scambiare la qualità
  in silenzio — il proprietario sceglie il profilo**.

### D36 — Consenso in due passi (2026-10-07)
- L'interruttore per utente di un client governa il lato del client; il consenso episodico vero e proprio è dato dall'admin di Recordare
  (profilo privato) o dal proprietario (profilo pubblico). `GET api/v1/me` restituisce `episodicEnabled`; i client non mettono in buffer
  i messaggi prima del consenso (mostrano "in attesa di attivazione").
- **Superata da D50 (2026-10-09)**: nessun passo di consenso in Recordare (WORK_PLAN 8.1). L'interruttore per utente del
  client è l'unico; `episodicEnabled` e lo stato "in attesa di attivazione" non esistono più.

### D37 — Le patch dei piani richiedono evidenza su quel piano (2026-10-06)
- Una patch si applica solo quando la sua evidenza parla di quel piano (nome / luogo / parola chiave in comune, o embedding ≥ 0.37);
  un nuovo rinvio ripetuto viene ignorato; un piano spostato porta la nuova data nel proprio testo. extract.v6. blind5 91,3 % vs 89,9 %
  (nel rumore), esito dei piani 0.92 → 1.00.

### D38 — L'eco del richiamo è fermata da una guardia nel codice, non da una regola di prompt (2026-10-07)
- Un'etichetta nel prompt ("rispondo dalla memoria") faceva fidare l'estrattore di un richiamo sbagliato (dev set 75 %), quindi resta extract.v6.
- Lo scrittore scarta gli elementi detti solo da una risposta dell'assistente che risponde dalla memoria (uno strumento di lettura di Recordare nel turno, o
  un richiamo servito in quella conversazione) e non dal proprietario, da un'altra persona o da uno strumento non di memoria; dopo un richiamo un
  fatto cambia solo con una frase asserente (non una domanda). Set di eco dev 79 % → 100 % (3 + 3 run).

### D39 — Richiamo consapevole delle persone (2026-10-07)
- Una domanda che nomina qualcuno (per nome, o tramite una relazione risolta dalle persone memorizzate "Nome (relazione)") ottiene anche
  i messaggi di chat di quella persona; nessuna chiamata LLM. blind6 rivolti all'assistente 0.25 → 0.62 (1 run), blind5 nel rumore.

### D40 — extract.v8: una nozione più ampia di fatti (2026-10-07)
- Mantenuto: blind5 +1,5 pt (nel rumore), fatti correnti 0.77 → 0.82, blind6 94,4 % vs 81,1 % (1 run). Tenere d'occhio
  le notizie su terzi nelle chat di gruppo.

### D41 — Revisione notturna dei fatti realizzata, tenuta spenta (2026-10-07)
- `facts_review.v1` (compito `facts`), admin `POST owners/:id/review-facts`; blind5: nessun guadagno sui fatti correnti
  (0.769 × 3) → parametro del profilo di qualità `factsReview` off. Il lavoro sui fatti passa al prompt di estrazione (D40).

### D42 — Recordare Atlas è un repo proprio opzionale (2026-10-06)
- `arkimedehq/recordare-atlas`, contratto di eventi versionato `docs/ATLAS_EVENTS.md`; Recordare funziona senza. Gli
  agenti client lo raggiungono come tracce OpenTelemetry GenAI, solo metadati. OpenTelemetry è un canale di osservazione, mai un
  canale di memoria: l'ingest resta l'unico ingresso della memoria.

### D43 — Client: contratto uniforme, non meccanismo uniforme (2026-10-07)
- Arkimede è il client nativo lato server; i connettori (hook + MCP + richiamo pre-turno) servono le piattaforme che non
  controlliamo; una libreria client dentro questo repo (`packages/client`) e una suite di conformità che ogni client supera
  (WORK_PLAN 6.6, 6.7).
- Stato (2026-10-08): realizzato — `packages/client` (su npm come `@arkimedehq/recordare-client`), la suite di conformità e
  i connettori di livello completo per Claude Code, Codex, OpenClaw, Hermes Agent e un proxy di memoria compatibile OpenAI
  (WORK_PLAN 6.6, 6.6b).

### D44 — Profili di infrastruttura: autonomo o co-ospitato (2026-10-07)
- Autonomo per default; co-ospitato con Arkimede su piccoli server (database + utente propri sul Postgres pgvector di Arkimede,
  db Redis + prefisso di coda propri, embedder bge-m3 di Arkimede) — `docs/DEPLOYMENT.md`. I default di Arkimede sono passati
  a `pgvector/pgvector:pg16` e BAAI/bge-m3 (e voce Piper `it_IT-serena-medium`).

### D45 — Ascolto continuo da un dispositivo vocale domestico (2026-10-07)
- Un dispositivo client che ascolta in modo continuo, opt-in: impronte vocali sul dispositivo, voci sconosciute scartate, nessun
  audio memorizzato, le parole di ciascuno nella propria memoria. WORK_PLAN 6.5.

### D46 — Regola di valutazione 9: un'istanza del servizio per coda (2026-10-07)
- Un run le cui estrazioni portano più di una versione di prompt viene scartato (un'istanza obsoleta ha contaminato dei run; corretto
  nello spegnimento del servizio). WORK_PLAN → Budget di valutazione.

### D47 — Gli span vocali agiscono per l'utente Wyoming (2026-10-07)
- Gli span del server vocale Wyoming di Arkimede sono attribuiti all'utente di conversazione Wyoming configurato.

### D48 — Memoria di entità: una memoria per persona, più memorie di entità (2026-10-07)
- Problema: una famiglia parla con un unico account condiviso (l'utente vocale di Arkimede sui satelliti); i suoi turni non possono andare nella
  memoria di nessuna persona, e una sola memoria "persona" mista trasformerebbe le parole di tutti in fatti sull'account.
- **La memoria di una persona è scritta solo tramite un'identità sicura**: l'utente del client (l'id proprietario di Arkimede o quello di un altro
  client), associato dall'admin. Una presentazione di sé o un'impronta vocale non instrada mai un turno nella memoria personale di qualcuno.
- **Memoria di entità**: un proprietario può essere un'entità (`persons.kind = entity`) — un dispositivo condiviso, un robot domestico, un luogo.
  Chiunque la usi la legge e la scrive per intero, e sa che è condivisa (`GET /me` restituisce `kind`). Possono esistere più entità
  (una per dispositivo condiviso o stanza).
- L'identificazione al suo interno ("sono Andrea", essere chiamati per nome; poi un'impronta vocale) dice solo **di chi** è un ricordo:
  gli episodi nominano la persona, i fatti portano `subject_person_id`, le note nominano la persona; un parlante non identificato è
  "qualcuno" e i suoi fatti personali non vengono registrati. Ogni conversazione inizia senza nessuno identificato.
- Guardia nel codice: un fatto su una persona, o un episodio che ne nomina una, è registrato solo se quel nome compare nella finestra
  (nessuna identità riportata da chat precedenti — misurato: senza questa il modello lo faceva).
- Prompt: `extract.v8` (ora `extract.v11`, WORK_PLAN 4.10) + `ENTITY_RULES` (`entity.v3`), aggiunto solo per i proprietari entità (memorie di persona invariate).
  Misurato su `dataset_dev_entity` (RESULTS.md).
- TODO (più avanti): identificazione più forte così che i ricordi più intimi in una memoria di entità siano leggibili solo dalla
  persona a cui appartengono — allora l'entità potrà essere un robot domestico a cui tutti si confidano (direzione G della visione). La
  rinomina di un utente da parte del client si propaga a Recordare (WORK_PLAN 6.8).
- Seguito del proprietario (2026-10-07): la **persona sceglie il tipo sulla sua piattaforma** (impostazioni di memoria di Arkimede →
  `PATCH /me {kind}`), solo finché la memoria è vuota; il **nome segue sempre il profilo della piattaforma** (una
  sincronizzazione del client sovrascrive una rinomina dell'admin); il consenso resta all'admin di Recordare (*superato da D50, 2026-10-09: niente consenso*).
- Stato (2026-10-08): su un nuovo set cieco per la memoria di entità (`dataset_blind8`, WORK_PLAN 4.8) 82,1 % su 3 run (dev
  set 95,5 %); la memoria di entità resta **sperimentale** — chi parla senza mai presentarsi e l'attribuzione tra persone
  sono i punti deboli.

### D49 — Memoria semantica: fonti imparate (proposta, 2026-10-08)
- Richiesta del proprietario: molti client non hanno un RAG proprio (un robot con il suo agente, un piccolo
  assistente), quindi Recordare dovrebbe essere una memoria **completa** — ciò che la persona ha vissuto **e ciò che ha
  imparato**. Recordare resta una memoria personale: i documenti non si mescolano con episodi, fatti o note.
- **Memoria semantica = fonti imparate.** Una fonte (un testo, un documento, una pagina, gli appunti di un libro, i
  testi scritti dalla persona) viene salvata in Recordare con i suoi passaggi (frammenti + embedding, nessun LLM
  necessario per salvarla), la sua origine (titolo, autore, provenienza: un file inviato dal client, un URL, un testo
  della persona), chi l'ha fornita e quando.
- **Memoria episodica = il riferimento.** Imparare è un evento: "Andrea ha studiato il manuale della caldaia l'8
  ottobre" — un episodio collegato alla fonte. Il collegamento va nei due sensi: dall'episodio alla fonte (cosa ho letto
  quel giorno?), dalla fonte ai suoi episodi (quando l'ho imparato, in quale conversazione, cosa ho deciso?).
- **Richiamo:** uno strumento (per esempio `search_knowledge`) restituisce passaggi con la loro fonte e gli episodi che
  la citano; il contesto di memoria può aggiungere un passaggio quando è chiaramente pertinente, entro il suo budget.
- **Cosa non è:** non è la base di conoscenza di un'organizzazione (i documenti di team / organizzazione restano nel RAG
  della piattaforma, per esempio Arkimede); non è l'output degli strumenti. I risultati della ricerca documentale di un
  client non vengono inviati come chat: al più un riferimento "ha consultato la fonte X", così il RAG della piattaforma
  e Recordare non si duplicano.
- Stesse regole del resto: consenso (*superato da D50: niente consenso*), la memoria della persona (o una memoria di entità, D48, per esempio quella del
  robot), divulgazione, l'oblio di una fonte rimuove i suoi passaggi (gli episodi tengono un segno "fonte dimenticata"),
  diagnostica solo a conteggi.
- Precedenti (non è nuovo): Supermemory separa i documenti (fonti di verità) dalle memorie estratte; Letta / MemGPT
  hanno una "archival memory" raggiungibile con strumenti (`docs/literature/agent-platform-memory_it.md`).
- Aperto: come arrivano le fonti (upload REST del testo estratto dal client; uno strumento MCP `learn_source`; formati
  oltre al testo); limiti di dimensione e costo per profilo di qualità (D35); i testi di terzi sono conservati solo per
  l'uso della persona (mai divulgati ad altri, limiti D33); se estrarre con un LLM i punti chiave con le parole della
  persona (un'opzione successiva). WORK_PLAN 5.9.

### D50 — Memoria dell'agente: ogni memoria appartiene all'agente (decisione del proprietario, 2026-10-09)
Sostituisce "una memoria per persona" (identità D24, la divisione persona / entità di D48 come due tipi di owner),
l'interruttore del consenso (D4), la regola dello spettatore come filtro sulle risposte (§1 di API.md), e fa del
gemello digitale (VISION) un caso emergente. Ricerca: `docs/literature/human-memory-and-agent-architectures_it.md`;
inventario e piano: `docs/AGENT_MEMORY_AUDIT.md`.
- **Una memoria appartiene a un agente**: un account del client ("Caino" — per esempio un account di Arkimede) = una
  memoria; un altro account ("Abele") = un'altra memoria, isolata come fosse un'altra installazione. Gli umani non
  sono più proprietari: sono **contatti che l'agente conosce**, dentro quella memoria. Obiettivo: chiunque possa dare un
  cervello a una macchina (domani un robot con telecamere, microfoni e altri sensori costruisce i propri ricordi).
- **Tutto ciò che arriva arricchisce la memoria dell'agente**: chat, voce, documenti, foto, audio, video, sensori; le
  fonti imparate di D49 ne fanno parte. L'agente distingue i tipi di memoria (episodica, semantica, prospettica…, vedi
  la scheda di letteratura) e **registra sempre chi ha detto cosa e di chi è** — la fonte al momento della scrittura,
  con il metodo (dichiarata, impronta vocale, volto, dedotta) e la certezza.
- **Due modalità per memoria:**
  - **personale** — ciò che arriva senza identità dichiarata è dell'agente, scritto in **prima persona**; il nome del
    titolare dell'account è il nome di "io" (ciò che lo riguarda è prima persona); anche le azioni dell'assistente sono
    in prima persona, senza distinzione (la memoria personale *è* il gemello digitale). Le altre persone identificate
    sono attribuite per nome.
  - **entità** — ciò che non è dichiarato è di **"qualcuno"** (terza persona); le persone identificate per nome; il
    contenuto marcato esplicitamente come **proprio** dell'agente (conoscenza che gli viene data, ciò che un robot
    percepisce o fa da solo) è dell'agente, in prima persona. L'ingest riceve un marcatore "proprio" (messaggio, testo,
    documento).
- **Richiamo**: chi si è identificato e chiede di sé ("cosa ho fatto ieri?") riceve i **suoi** ricordi; chi non si
  dichiara riceve quelli dell'agente. I risultati indicano il soggetto di ogni elemento.
- **Nessun consenso**: né di chi parla né dell'account; l'interruttore sta nel client, Recordare è sempre attivo. Chi
  installa l'agente è responsabile di informare le persone intorno (GDPR) — scritto nei documenti.
  Realizzato in WORK_PLAN 8.1 (2026-10-09): la migrazione `NoConsent1791060000000` elimina le colonne del consenso.
- **Nessun filtro su chi ascolta, per ora**: le risposte usano sempre tutta la memoria, in ogni conversazione; chi può
  sapere cosa (riservatezza, livelli di divulgazione) è una decisione successiva. `audience` / `disclosure` restano
  registrati per allora.
- **Resta**: il Diario (strumento di correzione per chi mantiene la memoria); la protezione contro l'eco del richiamo (D38),
  nelle parole del proprietario: quando l'agente risponde con un ricordo che ha già ("ieri dove sono stato?" → "al
  mare"), la risposta non rientra, giusta o sbagliata che sia; quando dice qualcosa di nuovo ("che tempo fa a Ispica?" →
  le previsioni), è una cosa che l'agente ha appreso e può diventare memoria, scelta per importanza come ogni altro input;
  storia solo in aggiunta, consolidamento a inattività e notturno, oblio per scelta.
- **Prima persona nelle lingue con il genere**: un'impostazione per memoria (maschile / femminile / neutro), con default
  dal profilo dell'account.
- **Più avanti, dalla letteratura**: riflessione (i pensieri propri dell'agente, sempre dedotti), un modello di sé,
  memoria procedurale, promesse e intenzioni dell'agente, un livello percettivo per foto / audio / video / sensori; le
  memorie "proprie" percepite e generate tenute distinte (reality monitoring).
- Piano: WORK_PLAN M8 (passi 0–11 dell'audit), ogni passo sui prompt misurato su set di sviluppo + 3 run ciechi; le
  memorie esistenti su Kinox migrate quando la voce è definitiva (prima un backup).

## Questioni aperte (da discutere)

Nessuna — risolte in D1–D48 (D24–D26: vedi `WORK_PLAN.md`; D26 ancora aperta, con WORK_PLAN 5.4). Il lavoro aperto è tracciato
in `WORK_PLAN.md`.

## Non-obiettivi (per ora)
- Fare l'embedding di ogni messaggio grezzo (costo, rumore, nessuna semantica del tempo dell'evento).
- Iniezione automatica di episodi in base alla data ("un anno fa oggi…").
- Riscrittura degli episodi al richiamo (nessun riconsolidamento).
- Esportazione del diario (JSON / Markdown) — più avanti.
- UI dedicata alle promozioni di pattern del consolidamento (pannello con gli episodi a supporto,
  "non riproporre"): nella v1 compaiono come normali note `pending` nell'elenco
  Memoria esistente con un'etichetta di origine; la riproposta è gestita da D20.
- Boost di richiamo delle note semantiche collegate (D19) — v2.

## Checklist di regressione (in fase di implementazione)
- Il recupero semantico esistente, il prefisso fissato, l'evoluzione, la potatura e il grafo devono essere
  inalterati — enumerare ogni query su `user_memory`.
- L'estrazione dei fatti esistente a soglia invariata nell'output quando gli episodi sono attivi.
- Il comportamento esistente di `search_conversations` / `search_memory` invariato per gli
  argomenti attuali (nuovi parametri additivi e opzionali).
- Cross-provider: schemi degli strumenti e modifiche ai prompt validi su tutti i provider LLM.
- Job di consolidamento: zero chiamate LLM quando non c'è nulla di nuovo.
