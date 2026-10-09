# Recordare e gli altri sistemi di memoria per agenti AI — confronto (2026-10-09)

*Versione inglese: [COMPETITORS.md](COMPETITORS.md). Il documento inglese è quello di riferimento.*

Questo documento confronta Recordare con i principali sistemi di memoria per agenti AI al 9 ottobre 2026, dopo il cambio
di direzione di Recordare con **D50** (`EPISODIC_MEMORY_TODO.md`): ogni memoria appartiene a un agente / account. In
modalità **personale** la memoria parla in prima persona, così l'agente diventa un gemello digitale indiretto della
persona che gli parla. In modalità **entità** chi parla senza dichiararsi è "qualcuno", a meno che l'input sia marcato
come dell'agente stesso. Non c'è flag di consenso e, per ora, nessun filtro sugli spettatori.

Si basa su due rassegne precedenti, `literature/agent-platform-memory.md` (codice sorgente letto il 2026-10-07) e
`literature/human-memory-and-agent-architectures.md` (2026-10-09), e su `ENGINE_IDEAS.md`. I punteggi di Recordare e
dei sistemi di mercato che abbiamo eseguito noi vengono da `spikes/memory-eval/RESULTS.md` e sono riportati con date e
avvertenze. Per questo documento non è stata eseguita alcuna nuova valutazione.

## 0. Metodo e limiti

- **Verificato sul web il 2026-10-09**, per lo più con uno strumento di fetch che restituisce brani estratti e non le
  pagine grezze. Pagine primarie lette: i README GitHub di Mem0, Graphiti, Honcho, Supermemory, MemOS e Hindsight; il
  changelog della piattaforma Mem0; la pagina dei concetti di Zep; il post "our next phase" di Letta; l'annuncio di
  Cognee 1.0; la pagina dei provider di memoria di Hermes; la pagina sulla memoria di Claude Code; la pagina sulla
  memoria di Claude Managed Agents; il report LongMemEval di Supermemory; il repo di LongMemEval. Tutto il resto viene
  dalla stampa o da altre fonti secondarie, ed è indicato dove conta.
- **Non è stato possibile verificare**:
  - il post "Dreaming" di OpenAI e la Memory FAQ di ChatGPT. L'help centre aveva risposto 403 nella rassegna
    precedente; questa volta è stata letta solo la stampa;
  - i numeri di benchmark di Honcho. Il README rimanda a una pagina di valutazioni, ma nessun numero è stato letto da
    una fonte primaria;
  - se il binario locale di Supermemory contenga tutto il motore come open source. Il repo è risultato MIT, ma il
    README non dice cosa contenga il binario;
  - le licenze di MemoryOS e del dataset BEAM;
  - le funzioni di Memory Bank di Google di luglio 2026. È stato letto un solo articolo secondario;
  - i numeri di versione attuali della maggior parte dei progetti. Le pagine README spesso non li mostrano.
- **I numeri di benchmark dei fornitori sono dichiarazioni.** Usano modelli di risposta, giudici, budget di recupero e
  perfino metriche diversi: Supermemory riporta il recall del recupero, quasi tutti gli altri l'accuratezza delle
  risposte. Sono elencati nel §4 per dare un'idea del panorama, mai per classificare i sistemi rispetto a Recordare.

## 1. I sistemi, a ottobre 2026

**Mem0** (Apache-2.0; libreria OSS, server self-hosted, piattaforma hosted) —
[repo](https://github.com/mem0ai/mem0), [changelog](https://docs.mem0.ai/changelog/platform.md),
[ricerca](https://mem0.ai/research-5).
- **Aprile 2026**: un nuovo algoritmo. L'estrazione è un solo passaggio ADD-only, quindi nulla viene sovrascritto o
  cancellato. Il collegamento delle entità è integrato, senza un archivio a grafo esterno. Il recupero fonde segnali
  semantici, BM25 e di entità.
- **Maggio 2026** (piattaforma): "Temporal Reasoning" ordina le domande temporali ("la settimana scorsa", "prossimi",
  "alla data …") e accetta un `reference_date`. "Memory Decay" aggiunge al momento della ricerca una preferenza per il
  recente che "non esclude mai un candidato".
- **Ambiti**: `user_id`, `agent_id` e `run_id`, più metadati di attore / ruolo sui messaggi.
- **Punteggi dichiarati**: LoCoMo 91,6–92,5, LongMemEval 93,4–94,4, BEAM 1M 64,1, BEAM 10M 48,6. Il README e la pagina
  di migrazione danno numeri leggermente diversi.

**Zep / Graphiti** (Graphiti Apache-2.0; Zep Cloud proprietario) — [Graphiti](https://github.com/getzep/graphiti),
[concetti di Zep](https://help.getzep.com/concepts),
[strategia OSS](https://blog.getzep.com/announcing-a-new-direction-for-zeps-open-source-strategy/).
- **Graphiti**: un "context graph" temporale. I fatti hanno finestre di validità, i fatti vecchi vengono invalidati e
  non cancellati, gli episodi danno la provenienza, le ontologie sono personalizzabili (Pydantic) e il recupero è
  ibrido. Gira su Neo4j, FalkorDB o Neptune, e offre un server MCP e un'API REST.
- **Zep Community Edition** non è più mantenuta.
- **Zep Cloud**: un grafo per utente, grafi autonomi per il contesto condiviso, un context block per thread e un
  riassunto dell'utente guidato da al massimo cinque istruzioni.
- **Punteggi**: il paper di Zep riportava il 71,2 % su LongMemEval con gpt-4o. I concorrenti citano quel numero.

**Letta (ex MemGPT)** (Apache-2.0) — [our next phase](https://www.letta.com/blog/our-next-phase),
[Letta Code](https://www.letta.com/blog/letta-code).
- **16 marzo 2026**: Letta si concentra su **Letta Code**, un harness indipendente dal modello. La memoria diventa un
  filesystem Markdown su git ("MemFS" / context repositories) e la riflessione nel tempo di inattività passa al client.
- **Ritirati entro metà aprile**: gli strumenti di memoria lato server, i template, i sistemi di identità e l'MCP lato
  server.
- **Da allora**: l'app Letta Code è uscita il 6 aprile 2026. Un SDK TypeScript per agenti è stato annunciato ad agosto
  2026 (fonte secondaria).
- **Modello di memoria**: è **dell'agente**. Un agente persiste, impara e mantiene la propria identità anche se cambia
  il modello.

**Supermemory** (repo risultato MIT; API hosted e un unico binario locale) —
[repo](https://github.com/supermemoryai/supermemory),
[report LongMemEval](https://supermemory.ai/research/longmembench).
- **Modello**: i documenti (fonti di verità) sono separati dalle memorie (fatti estratti). Le relazioni sono
  `updates`, `extends` e `derives`. L'oblio automatico copre i fatti scaduti, contraddetti e rumorosi. I profili sono
  divisi in parte statica e parte dinamica.
- **Input**: file di molti tipi (PDF, immagini, video, codice) e connettori (Drive, Gmail, Notion, OneDrive, GitHub).
- **Interfacce**: un server MCP.
- **Punteggi**: su LongMemEval-S un **Recall@20** del 97 % (95 % a Recall@15 nel README), contro il 71,2 % di Zep e il
  60,2 % del contesto completo. Sono cifre di recall del recupero accostate all'accuratezza delle risposte degli altri
  sistemi: metriche diverse.

**Honcho (Plastic Labs)** (AGPL-3.0, self-hostable; server 3.3.0) — [repo](https://github.com/plastic-labs/honcho).
- **Peer**: ogni partecipante, umano o AI, è un **peer**. L'osservazione è configurabile, il che dà rappresentazioni
  osservatore → osservato (teoria della mente).
- **Isolamento**: i **workspace** sono il confine multi-tenant. Gli **scope**, nuovi, sono gruppi di sessioni con un
  nome che limitano ciò che chat, rappresentazione e ricerca possono vedere.
- **Lavoro in background**: un **deriver** estrae i fatti e costruisce riassunti, peer card e sogni. Un endpoint di
  domande e risposte **dialettico** ha quattro livelli di sforzo.
- **Punteggi**: dichiara una "frontiera di Pareto" su LongMemEval, LoCoMo e BEAM (numeri non verificati). Il blog di
  Hindsight riporta Honcho al **40,6 % su BEAM 10M**.
- **Integrazioni**: Hermes, OpenClaw, Claude Code e qualunque client MCP.

**Memobase** (Apache-2.0) — [repo](https://github.com/memodb-io/memobase). Un profilo utente fatto di slot, più una
linea temporale di eventi con due date, buffer per utente e un server MCP. Una fonte secondaria colloca l'ultimo push
all'11 gennaio 2026. L'abbiamo misurato a ottobre 2026.

**Cognee** (Apache-2.0) — [annuncio 1.0](https://www.cognee.ai/cognee-1-0-announcement).
- **1.0** (26 giugno 2026): un'API di memoria `remember / recall / forget / improve`, un'opzione con un solo Postgres,
  un nucleo in Rust per l'edge, MCP e il formato di esportazione COGX.
- **v1.4.0** (luglio 2026) è seguita, secondo una fonte secondaria.
- **Punteggio**: BEAM-100k 79 % contro una base del 73,4 % (dichiarato). È centrato sui grafi e, nella nostra misura,
  vicino a un RAG.

**LangMem (LangChain)** (MIT) — [repo](https://github.com/langchain-ai/langmem). Memoria semantica, episodica e
procedurale (ottimizzazione del prompt), con estrazione in background con debounce. Una fonte secondaria indica come
ultima release PyPI la 0.0.30 (ottobre 2025) e un repo ancora attivo a giugno 2026. È pre-1.0.

**MemOS (MemTensor)** (Apache-2.0) — [repo](https://github.com/MemTensor/MemOS).
- **Release**: 2.0 "Stardust" il 5 gennaio 2026; v2.0.22 il 3 luglio 2026.
- **Funzioni**: memorie come grafo ispezionabile, input multimodale (testo, immagini, tracce di strumenti, persona),
  isolamento "multi-cube" con condivisione controllata e feedback in linguaggio naturale.
- **Plugin**: ufficiali per OpenClaw (marzo 2026) e Hermes (aprile 2026). Il `memos-local-plugin 2.0` (maggio 2026)
  aggiunge tracce, policy, modelli del mondo e skill.
- **Punteggi**: LoCoMo 88,83, LongMemEval 89,20 (dichiarati).

**MemoryOS (BAI-LAB)** (licenza non verificata) — [repo](https://github.com/BAI-LAB/MemoryOS). Il sistema di ricerca
del paper orale a EMNLP 2025: livelli a breve, medio e lungo termine, catena di dialogo FIFO e pagine segmentate. Ha un
server MCP. Il suo risultato su LoCoMo è riportato rispetto alle baseline (+49 % F1 su GPT-4o-mini).

**Hindsight (Vectorize)** (MIT) — [repo](https://github.com/vectorize-io/hindsight),
[post BEAM](https://hindsight.vectorize.io/blog/2026/04/02/beam-sota). Aggiunto perché nel 2026 è diventato un
provider comune (Hermes lo include).
- **Tipi di memoria**: fatti del mondo, esperienze, osservazioni (credenze consolidate) e modelli mentali.
- **Operazioni**: retain, recall (semantico, per parole chiave, a grafo e temporale in parallelo) e reflect.
- **Punteggio**: **BEAM 10M 64,1 %** (dichiarato, 2 aprile 2026).

**Memoria di ChatGPT (OpenAI)** (proprietaria) — fonti secondarie
([PCWorld](https://www.pcworld.com/article/3158111/chatgpt-new-dreaming-feature-makes-it-way-better-at-remembering-you.html),
[iClarified](https://www.iclarified.com/96981/chatgpt-can-now-reference-all-your-past-chats)).
- **Prima**: memorie salvate più il riferimento a tutta la cronologia delle chat.
- **4–5 giugno 2026, "Dreaming" (V3)**: un processo in background legge le chat passate e mantiene uno **stato di
  memoria sintetizzato** che viene iniettato all'inizio di ogni chat. Gli utenti possono leggere e modificare un
  riassunto della memoria, e Plus / Pro hanno il doppio della capacità.
- **Controlli**: si può tornare alle memorie salvate, disattivare la memoria o usare le chat temporanee.
- **Punteggio**: OpenAI dichiarerebbe un recall dei fatti dell'82,8 %, contro il 41,5 % del 2024 (valutazione
  interna, secondo la stampa).

**Memoria di Claude (Anthropic)** (proprietaria) — tre prodotti.
- **App Claude**: memoria delle chat passate; aperta agli utenti gratuiti dal 2 marzo 2026, con un prompt per
  importare le memorie di altri assistenti e una vista "cosa Claude ha imparato su di te"
  ([9to5Mac](https://9to5mac.com/2026/03/02/free-claude-users-can-now-use-memory-and-import-context-from-rivals/)).
- **Claude Code** ([documentazione](https://code.claude.com/docs/en/memory)): `CLAUDE.md` contiene le istruzioni
  umane (ambito organizzazione, progetto e utente). L'**auto memory** è scritta dal modello: un indice `MEMORY.md` (le
  prime 200 righe / 25 KB vengono caricate a ogni sessione) più file per argomento di tipo
  `user | feedback | project | reference`. È locale alla macchina e per repository, e i subagenti possono averne una
  propria.
- **Memory store di Claude Managed Agents** ([documentazione](https://platform.claude.com/docs/en/managed-agents/memory);
  beta pubblica da aprile 2026):
  - gli store sono raccolte di documenti di testo con ambito di workspace, montate come cartelle nella sandbox
    dell'agente, con accesso `read_only` o `read_write`;
  - ogni modifica è una versione immutabile **attribuita alla sessione**, conservata 30 giorni, e le versioni si
    possono oscurare;
  - le sessioni di "dreaming" consolidano uno store in uno store **nuovo**;
  - la documentazione avverte che una prompt injection può scrivere in uno store in lettura-scrittura.

**Google Gemini** (proprietario) — fonti:
[Android Authority](https://www.androidauthority.com/google-gemini-personal-intelligence-rollout-3632287),
[9to5Google](https://9to5google.com/2026/02/26/gemini-past-chats-free/),
[blog Google](https://blog.google/intl/en-mena/product-updates/explore-get-answers/ai-memories-chat-history-to-gemini/).
- **"Personal context"**: memoria delle chat passate, attiva per default e disattivabile.
- **"Personal Intelligence"** (14 gennaio 2026, AI Pro / Ultra negli USA): ragiona su Gmail, Foto e YouTube. Spenta
  per default, e ogni app va autorizzata a parte.
- **Da marzo 2026**: chat temporanee e importazione della memoria.
- **Per gli sviluppatori**: la piattaforma per agenti di Google ha aggiunto alla sua Memory Bank, a luglio 2026,
  un'API `IngestEvents`, i **Memory Profiles** e controlli sulle revisioni (TTL, etichette). È una sola fonte
  secondaria ([agentmarketcap](https://agentmarketcap.ai/blog/2026/07/28/gemini-agent-memory-managed-infrastructure));
  non verificato.

**OpenClaw** (MIT) — documentazione del repo (rassegna del 2026-10-07),
[release 2026.4.12](https://newreleases.io/project/npm/openclaw/release/2026.4.12),
[memory-core](https://docs.openclaw.ai/es/plugins/reference/memory-core.md).
- **Memoria a livelli**: `AGENTS.md`, `MEMORY.md` / `USER.md` curati, note giornaliere datate, intenti permanenti e
  `DREAMS.md`.
- **Provenienza**: strutturale, con una classe di origine `owner | agent | untrusted | system` che "non è mai owner per
  default", più la contaminazione del turno dopo gli strumenti di rete.
- **Dreaming**: fasi light, REM e deep (2026.4.5). Il codice convalida le operazioni dell'LLM.
- **Active Memory** (2026.4.12): un sotto-agente di richiamo opzionale che gira prima della risposta.
- **Plugin**: memory-lancedb, memory-wiki, Honcho, MemOS, ReMe e il connettore di Recordare.

**Hermes Agent (Nous Research)** (MIT) —
[provider](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory-providers).
- **Memoria integrata**: `MEMORY.md` + `USER.md`, congelati per sessione, con un fork di revisione in background.
- **Provider esterni**: ne sono elencati nove (Honcho, OpenViking, Mem0, Hindsight, Holographic, RetainDB, ByteRover,
  Supermemory, Memori). Ne è attivo uno alla volta, sempre accanto alla memoria integrata, e tutto ciò che viene
  passato a un provider viene prima ripulito dai segreti.
- Il connettore di Recordare è un provider di questo tipo.

**Riferimento di ricerca** — **Collaborative Memory** (Rezazadeh et al., arXiv:2505.18279;
`literature/collaborative-memory.md`): memoria multi-utente e multi-agente.
- **Modello**: un livello privato per utente e uno condiviso.
- **Provenienza**: immutabile su ogni frammento (tempo, utente di origine, agenti che vi hanno contribuito, risorse).
- **Permessi**: variabili nel tempo, verificati al momento della lettura.
- Nessun codice rilasciato.

## 2. Tabella di confronto

Abbreviazioni: Ep = episodica, Fatti-s = fatti con storia, Pref = preferenze / note, Proc = procedurale,
Prosp = prospettica (piani / intenti con ciclo di vita), Doc = documenti / conoscenza. "Recordare (D50)" è lo stato
pianificato di WORK_PLAN M8 (passi 8.3–8.12), non ancora costruito oltre 8.1–8.2.

### 2a. Cosa si memorizza, su chi, e quanto ci si fida

| Sistema | Di chi è la memoria | Identità di chi parla / monitoraggio della fonte | Tipi | Modello del tempo | Provenienza / difese dall'avvelenamento | Consolidamento |
|---|---|---|---|---|---|---|
| **Recordare (oggi)** | Una memoria per persona; memoria di entità per i dispositivi condivisi (D48, sperimentale) | `author_role`, origine `owner_lived / owner_told / assistant_stated`, affermazioni altrui tenute separate, guardia "nome nella finestra" per chi parla in un'entità | Ep (evento / piano / cambio di stato), Fatti-s (catene di valori), Pref (note), Prosp (piani della persona con ciclo di vita); log grezzo per sempre; niente Proc, niente Doc (proposta D49) | Bitemporale; tempo dell'evento + **precisione** + espressione originale; fatti **alla data**; `corrects` vs `supersedes` | Id delle prove convalidati nel codice; l'LLM non cancella mai; guardia contro l'eco del richiamo; le modifiche ai piani richiedono prove; tombstone | Finestra di inattività + diari notturni di giorno / mese (con impronta, zero chiamate se non c'è niente di nuovo) |
| **Recordare (D50)** | **Dell'agente**: una per account del client, modalità personale o entità | Pianificato: soggetto su ogni elemento, **metodo + confidenza** dell'attribuzione, marcatore `own`, "qualcuno" + riattribuzione | + fonti D49 (Doc), poi riflessione, note Proc, intenti propri dell'agente, percezione | Invariato | Invariato + monitoraggio della realtà mantenuto nei dati mentre il testo è in prima persona | + diari con la voce dell'agente |
| Mem0 | Centrata sull'utente con ambiti `user_id` / `agent_id` / `run_id` | Metadati di attore / ruolo; nessun ruolo per i terzi (il nostro adattatore ha dovuto anteporre i nomi) | Fatti come stringhe piatte + collegamenti fra entità; Pref | Data di osservazione nel testo; piattaforma: ordinamento temporale + `reference_date` (maggio 2026) | Solo ADD (nulla cancellato); attualità solo al recupero | Nessuno (ordinamento al recupero, preferenza per il recente) |
| Zep / Graphiti | Grafo per utente + grafi condivisi | Entità risolte; episodi come provenienza; nessun modello di fiducia per chi parla | Fatti come archi del grafo, entità, episodi, riassunti | Archi **bitemporali** (`valid_at / invalid_at` + tempo di registrazione) | Invalidazione, non cancellazione; l'LLM decide le contraddizioni (ogni fatto trattato come stato) | Incrementale; comunità / riassunti |
| Letta | **Centrata sull'agente** (blocchi / MemFS dell'agente) | Autore git per ogni riflessione; niente per chi parla | Blocchi core, archivio, richiamo; skill (Proc) | Storia dei commit | Storia git; modifica alla fonte | Subagente di riflessione / tempo di inattività su numero di passi o compattazione |
| Supermemory | Ambito utente / container | Non documentato | Memorie + **documenti** (multimodali), profilo statico / dinamico | `isLatest` sugli aggiornamenti; scadenza nel tempo | Storia conservata per audit; gestione delle contraddizioni | Oblio automatico; relazioni derivate |
| Honcho | **Centrata sui peer**: ogni partecipante (umano o AI) è un peer; osservatore → osservato | Fatti su un peer solo dai suoi messaggi; le proposte accettate contano; peer card | Osservazioni esplicite / deduttive / induttive, peer card, riassunti | Tempo del messaggio; le deduzioni gestiscono gli aggiornamenti | `source_ids` obbligatori sulle deduzioni; id inventati scartati; cancella le osservazioni superate | Dreaming (deduzione + induzione) per coppia di peer |
| Memobase | Profilo utente | Niente oltre all'utente | Slot del profilo + linea temporale degli eventi | Tempo della menzione vs tempo dell'evento (come testo) | Sovrascrive all'aggiornamento | Svuotamento del buffer; fusione del profilo |
| Cognee | Dataset / grafi di conoscenza | Nessuna | Grafo centrato sui documenti, `improve` | Ricerca temporale come pipeline separata | — | `memify` / `improve` |
| LangMem | Namespace (utente o agente) | Nessuna | Semantica, episodica, **Proc** (ottimizzatore di prompt) | `created_at` | — | Riflessione in background con debounce |
| MemOS | MemCube per utente / agente, condivisione multi-cube | Non documentato | Testo, multimodale, tracce di strumenti, skill, persona | Non documentato | Feedback / correzione in linguaggio naturale | Scheduler; evoluzione delle skill (plugin locale) |
| Hindsight | Banchi di memoria (dettagli non verificati) | Non documentato | Fatti del mondo, esperienze, osservazioni, modelli mentali | Strategia di recupero temporale | Non documentato | Reflect |
| ChatGPT | Account dell'utente | Nessuna (un solo utente) | Memorie salvate + stato sintetizzato dalle chat | Recenza della menzione | L'utente legge / modifica il riassunto | **Dreaming V3** (sintesi in background) |
| Claude (app / Code / Managed Agents) | Account; per repository (Code); per store scelto dallo sviluppatore (Managed Agents) | Code: nessuna; Managed Agents: versioni attribuite alla sessione | Code: istruzioni + note tipizzate; Managed Agents: file liberi | Timbro `modified`; versioni (30 giorni) | Managed Agents: mount `read_only`, versioni immutabili, oscuramento | Code: nessuno; Managed Agents: "dreaming" in un nuovo store |
| Gemini | Account dell'utente | Nessuna | Profilo dalle chat passate, preferenze, dati delle app collegate | Non documentato | Autorizzazione per app sui dati collegati | Riassunto periodico del profilo |
| OpenClaw | Workspace dell'agente (`USER.md` sull'utente) | **Classe di origine `owner / agent / untrusted / system`**, tipo di sessione, **contaminazione del turno** | Nucleo curato, direttive, note giornaliere, **intenti permanenti** (Prosp), affermazioni wiki | Timestamp osservato + chiave di sostituzione | Mai owner per default; il non fidato è tolto prima del dreaming; prevenzione dei cicli di richiamo | Dreaming notturno con operazioni convalidate dal codice |
| Hermes | Profilo dell'agente (`MEMORY.md` agente, `USER.md` utente) | `turn_author`, `agent_context` (primary / cron / subagent) verso i provider | Due file piccoli + skill (Proc) + ricerca nelle sessioni | Tempo della sessione | Scansione per injection / esfiltrazione, pulizia dei segreti, approvazione facoltativa delle scritture | Fork di revisione ogni 10 turni |

### 2b. Come si raggiunge, si isola, si esegue e si misura

| Sistema | Interfacce di richiamo | Multi-agente / multi-tenant | Sensori / multimodale | Lingue | Privacy / consenso | Self-hosting / licenza | Modello di costo | Valutazioni pubblicate |
|---|---|---|---|---|---|---|---|---|
| **Recordare** | Strumenti MCP (7), ingest REST, contesto di memoria prima del turno (zero LLM), API di lettura (Diario), libreria client TS; connettori per Claude Code, Codex, OpenClaw, Hermes, proxy compatibile OpenAI | Un'installazione, memorie isolate (testato); solo profilo privato: admin fidato, niente OAuth | Solo testo; voce tramite la trascrizione del client | Memorie nella lingua configurata; risolutore di periodi per 25 lingue; misurato soprattutto in italiano con sessioni in inglese | **Nessun flag di consenso da D50**; chi installa informa le persone (GDPR); oblio con tombstone; per ora nessun filtro sugli spettatori | **AGPL-3.0**, solo self-hosted (Docker; ≈ 6 GB di RAM standalone) | Una chiamata di estrazione per finestra di inattività, zero se inattivo, cache dei prefissi (67–71 % in cache); profili di qualità economy / balanced / full | Solo set ciechi propri (31–87 domande ciascuno), 3 esecuzioni, intervalli appaiati, controlli; **niente LoCoMo / LongMemEval / BEAM** |
| Mem0 | SDK, REST, MCP (OpenMemory), iniezione a cura dell'host | `user_id` / `agent_id` / `run_id`; progetti sulla piattaforma | Immagini sulla piattaforma (non controllato in questo giro) | Nella nostra esecuzione: memorie salvate in inglese | API di cancellazione, scadenza | Apache-2.0 OSS + hosted | Una chiamata LLM per `add`; piattaforma a consumo | LoCoMo, LongMemEval, BEAM (dichiarati) |
| Zep / Graphiti | SDK, REST, MCP (Graphiti), context block | Utenti, grafi autonomi | Dati aziendali / JSON | Fatti in lingue miste nella nostra esecuzione | Controlli del cloud | Graphiti Apache-2.0; Zep Cloud proprietario | 8–12 chiamate per sessione nella nostra traccia del 2026-10-02 (Graphiti) | LongMemEval 71,2 % (paper, gpt-4o) |
| Letta | Strumenti dell'agente, file; app / SDK Letta Code | Agenti, subagenti | — | Dipende dal modello | Locale / cloud | Apache-2.0 | Guidato dall'agente | Non controllato |
| Supermemory | API, MCP, connettori, endpoint del profilo | Container | **File: PDF, immagini, video, codice** | Non documentato | Non controllato | Repo MIT; hosted + binario locale | Prezzi hosted (non controllati) | LongMemEval-S Recall@20 97 % (dichiarato, metrica di recupero) |
| Honcho | SDK, REST, MCP, chat dialettica, peer card, contesto | **Workspace (multi-tenant), peer, scope** | — | Dipende dal modello | Scope come confini di visibilità | **AGPL-3.0**, self-host + cloud | Deriver + dreamer + LLM in lettura (dialettica) | Dichiarazioni su LongMemEval / LoCoMo / BEAM; BEAM 10M 40,6 % (riportato da Hindsight) |
| Memobase | SDK, REST, MCP, impacchettatore del contesto | Utenti | — | Prompt en / zh | — | Apache-2.0 | Lotti bufferizzati | LoCoMo (dichiarato, vecchio) |
| Cognee | SDK, MCP, recall | Dataset | Molti formati di file | Non documentato | Operazione forget | Apache-2.0 + cloud | Costruzione del grafo a ogni ingest | BEAM-100k 79 % (dichiarato) |
| LangMem | SDK Python sullo store di LangGraph | Namespace | — | Dipende dal modello | — | MIT | Chiamate in background | Non controllato |
| MemOS | API, plugin cloud / locali | Multi-cube | Testo, immagini, tracce di strumenti | Comunità zh / en | — | Apache-2.0 + cloud | Il fornitore dichiara risparmi di token | LoCoMo 88,83, LongMemEval 89,20 (dichiarati) |
| Hindsight | API, oltre 60 integrazioni, provider Hermes | Banchi | Non controllato | Non controllato | — | MIT + cloud | Non controllato | BEAM 10M 64,1 % (dichiarato) |
| ChatGPT | Iniezione sempre attiva | Per account; progetti | Chat (immagini nelle chat) | Molte | Disattivazione, chat temporanea, riassunto modificabile | Proprietario | Nell'abbonamento | Recall interno 82,8 % (stampa) |
| Claude | Code: file caricati all'avvio; Managed Agents: file montati | Managed Agents: fino a 8 store per sessione | — | Molte | Code: file locali; Managed Agents: oscuramento, sola lettura | Proprietario | Nell'abbonamento / API | Nessuna trovata |
| Gemini | Personal context sempre attivo; app collegate | Per account | Foto / Gmail / YouTube con Personal Intelligence | Molte | App collegate spente per default; chat temporanee | Proprietario | Nell'abbonamento | Nessuna trovata |
| OpenClaw | Iniezione di livello 1 (zero LLM), sotto-agente Active Memory di livello 2, plugin | Per agente | — | Dipende dal modello | Oblio per sessione, oscuramento, quarantena del contaminato | MIT | Dreaming notturno | Non trovate |
| Hermes | Istantanea congelata + prefetch del provider | Per profilo; un provider alla volta | — | Dipende dal modello | Pulizia dei segreti, approvazione delle scritture | MIT | Fork di revisione su un modello economico | Non trovate |

## 3. Dimensione per dimensione

**Di chi è la memoria.** Il mercato si divide in tre.
- **Centrata sull'utente**: Mem0, Zep, Memobase, Supermemory, ChatGPT, Claude e Gemini. La memoria parla *di* un
  utente, indicizzata da un id utente.
- **Centrata sull'agente**: Letta, Hermes e OpenClaw. La memoria è il taccuino dell'agente, e l'utente è un argomento
  al suo interno (`USER.md`, un blocco "human").
- **Centrata sui peer**: Honcho. Ogni partecipante, umano o AI, è un peer, e la memoria è la visione che un peer ha di
  un altro.

Recordare prima di D50 era centrato sull'utente, con una provenienza insolitamente forte. D50 lo sposta nel gruppo
centrato sull'agente, con dentro una memoria centrata sull'utente, nei termini di Huang et al.
(`human-memory-and-agent-architectures.md` §2.6). La modalità personale aggiunge una variante che non abbiamo visto
negli altri prodotti esaminati: l'"io" dell'agente **è** il titolare dell'account, quindi la memoria dell'agente si
legge come il diario del titolare. Non abbiamo trovato nessun prodotto che scriva la memoria nella prima persona
dell'utente. È un'osservazione sui prodotti, non una rivendicazione di novità: gli agenti di Letta e lo stato
sintetizzato di ChatGPT sono vicini nello spirito, e nessuno l'ha ancora verificata sulla letteratura.

**Identità e monitoraggio della fonte.**
- **Honcho**: "non derivare mai un fatto sul peer osservato da ciò che ha detto un altro peer".
- **OpenClaw**: una classe di origine più la contaminazione del turno.
- **Recordare prima di D50**: `origin` / `author_role`, affermazioni altrui separate, la guardia "nome nella
  finestra".

Sono gli unici tre sistemi trovati che trattano **chi l'ha detto** come campo di prima classe. Mem0 ha metadati
sull'attore ma nessun ruolo per i terzi (nel nostro adattatore le chat di gruppo sono state appiattite in messaggi
dell'utente con il nome davanti). Gli assistenti consumer modellano un solo utente. Le aggiunte pianificate da D50
sono il **metodo e la confidenza** dell'attribuzione (dichiarata, impronta vocale, volto, dedotta), un "parlante
sconosciuto" da riattribuire più avanti e un marcatore `own` per le percezioni e la conoscenza dell'agente. Vanno oltre
ciò che i prodotti esaminati documentano, ma il paper Collaborative Memory conserva già una provenienza immutabile per
frammento (utente e agente di origine) e verifica i permessi al momento della lettura.

**Tipi di memoria.**
- **Recordare copre bene**: episodi con tempo dell'evento, fatti con catene di valori, note e i piani della persona con
  un ciclo di vita.
- **A Recordare mancano**:
  - la memoria procedurale (Letta, Hermes, LangMem e MemOS hanno skill o ottimizzazione dei prompt);
  - i documenti / la conoscenza: Supermemory, Cognee e MemOS acquisiscono file; D49 è solo una proposta;
  - gli intenti propri dell'agente (gli intenti permanenti di OpenClaw);
  - la riflessione (l'induzione di Honcho, i "modelli mentali" di Hindsight, il tempo di inattività di Letta).
- **Ciclo di vita dei piani**: non ne abbiamo trovato nessuno con uno stato "esito sconosciuto" per i piani passati
  dell'utente (H1, "parzialmente nuovo, ristretto").

**Tempo.** Due famiglie hanno fatti davvero bitemporali: Graphiti / Zep e Recordare. Da maggio 2026 la piattaforma
Mem0 ordina le domande temporali con una data di riferimento, ma è un ordinamento al recupero, non una validità
memorizzata. Recordare è l'unico tra quelli esaminati che memorizza la **precisione della data** e l'espressione
temporale originale sugli episodi, e risponde "alla data" a partire dalla validità memorizzata.

**Provenienza e avvelenamento.** I sistemi che reggono si affidano alla struttura, non al rilevamento:
- la classe di origine di OpenClaw;
- i `source_ids` di Honcho;
- i mount in sola lettura e le versioni di Managed Agents;
- le prove convalidate dal codice e la separazione delle affermazioni di Recordare.

Nelle nostre misure sia Mem0 sia Cognee hanno attribuito alla persona l'affermazione di un membro del gruppo (blind3
b34, 0/3). La documentazione di Anthropic dice il rischio chiaramente: un'injection in uno store in
lettura-scrittura viene poi letta dalle sessioni successive "come memoria fidata".

**Consolidamento.** Il "dreaming" è ormai diffuso: ChatGPT (giugno 2026), Claude Managed Agents, OpenClaw e Honcho
lo hanno tutti.
- **Che riscrive**: lo stato di memoria sintetizzato di ChatGPT.
- **Non distruttivo**: Managed Agents sogna in un nuovo store; OpenClaw conserva la versione precedente e convalida le
  operazioni nel codice.
- **Quello di Recordare**: diari cronologici che fanno zero chiamate LLM se non c'è niente di nuovo. Il loro valore
  misurato sulle risposte finora è nullo (diari nel richiamo −1,9 punti, entro il rumore).

**Interfacce di richiamo.** Ogni sistema serio offre ormai MCP, e quasi tutti un'iniezione prima del turno (il context
block di Zep, ChatGPT, il prefetch di Hermes, il livello 1 di OpenClaw, il contesto di memoria di Recordare). Un LLM al
momento della lettura è comune: la dialettica di Honcho, Active Memory di OpenClaw, il reflect di Hindsight. Recordare
lo tiene fuori di proposito (D12). L'ingest REST di Recordare con cinque connettori è ampio. La sua libreria client è
solo TypeScript, e il connettore Hermes è in Python.

**Multi-tenant e multi-agente.**
- **Honcho**: workspace, peer e scope.
- **Mem0**: ambiti utente / agente / esecuzione.
- **MemOS**: condivisione multi-cube.
- **Managed Agents**: più store per sessione.
- **Recordare**: memorie isolate in un'unica installazione, ma solo il profilo privato (admin fidato, niente OAuth,
  nessun audit delle letture). D50 semplifica l'isolamento (un account = una memoria) e toglie il legame "una
  persona = una memoria" fra piattaforme.

**Sensori e input multimodale.** Supermemory, MemOS, Cognee e Gemini (tramite le app collegate) accettano input non
testuale. Recordare è solo testo. Il "robot con telecamere" di D50 non esiste ancora: lo strato percettivo è nel passo
12 di M8 ("più avanti").

**Lingue.** Recordare è l'unico sistema qui i cui set di valutazione sono per lo più in italiano con sessioni in
inglese mescolate. Nella nostra esecuzione Mem0 ha salvato conversazioni italiane come memorie in inglese, e i prompt
di Memobase sono solo en / zh. Gli altri sistemi non documentano il comportamento con le lingue.

**Privacy e consenso.**
- **Assistenti consumer**: controlli per l'utente (disattivazione, chat temporanee, riassunti modificabili).
- **Infrastruttura**: API di cancellazione, oscuramento (Managed Agents), scope (Honcho).
- **Recordare dopo D50**: nessun flag di consenso e nessun filtro sugli spettatori. La responsabilità è di chi
  installa, e `audience` / `disclosure` restano registrati per dopo. In pratica oggi protegge **meno** degli scope di
  Honcho nei contesti con più persone, ed è vicino al "decide lo sviluppatore" dei prodotti infrastrutturali.

**Self-hosting e licenza.** Sono interamente self-hostable con licenza aperta: Mem0, Graphiti, Letta, Honcho,
Memobase, Cognee, LangMem, MemOS, Hindsight, OpenClaw, Hermes e Recordare. Il repo di Supermemory risulta MIT, ma il
contenuto del suo binario non è verificato. Honcho e Recordare sono entrambi **AGPL-3.0**, gli unici copyleft, il che
significa anche che possiamo riusare il testo dei prompt di Honcho con le note di licenza (`LICENSING.md`).

**Costo.**
- **Il design di Recordare** è frugale: una chiamata per finestra di inattività, zero chiamate se inattivo e nessun LLM
  in lettura. L'ingest misurato per una persona su cinque mesi (232 sessioni) è stato di circa 1 M di token in input,
  due terzi in cache (WORK_PLAN, budget di valutazione).
- **Mem0 nelle nostre esecuzioni**: 1,77 M di token in input al motore per un'esecuzione con rumore su blind3, contro
  731 k di Recordare v4 (`RESULTS.md` 4b.5).
- **Honcho**: spende al momento della lettura (dialettica).
- **Graphiti**: ha richiesto 8–12 chiamate per sessione nella nostra esecuzione del 2026-10-02.

## 4. Valutazioni

### 4.1 Cosa abbiamo misurato noi (`spikes/memory-eval/RESULTS.md`)

Impostazione comune: risposta e giudice `deepseek-flash` (lo stesso modello, un punto debole noto), embedding
`bge-m3`, motori su DeepSeek con il ragionamento spento. Set di 24–87 domande, quindi gli scarti sotto i 5 punti circa
sono rumore.

| Data | Set | Risultato | Avvertenze |
|---|---|---|---|
| 2026-10-02 | Round 2, 24 domande, rumore (187 sessioni) | Prototipo D 96 %, Memobase 0.0.42 88 %, Graphiti 0.30 81 %, baseline sul log grezzo 67 % | D ha avuto tre iterazioni del prompt dopo aver visto i risultati base; Graphiti e Memobase così come distribuiti; 1 esecuzione |
| 2026-10-02 | Held-out (scritto alla cieca rispetto a D), rumore | D 86 %, Memobase 61 %, baseline 50 % | Graphiti non rieseguito; 1 esecuzione |
| 2026-10-03/05 | `dataset_blind3`, 36 domande, 3 esecuzioni | Base / rumore: Mem0 2.2.1 87,5 / 88,4 %; Cognee 1.6.0 85,7 / 83,8 %; servizio v2 (cieco) 86,0 % base; servizio v4 94,9 / 95,4 % (**a posteriori**, set già letto); contesto completo 97,2 %; senza memoria 8,3 % | v4 − Mem0 entro il rumore; v4 − Cognee +11,6 punti con rumore (significativo). Mem0 ha usato la sua pipeline v3 ADD-only **senza** il potenziamento delle entità di spaCy, con la data della sessione passata come data di osservazione, e ha salvato le memorie in inglese |
| 2026-10-05 | `dataset_blind4`, 84 domande, 3 esecuzioni | Base / rumore: servizio v4 80,8 / 79,8 %; Mem0 78,0 / 79,3 %; D 88,3 %; contesto completo 89,9 % | v4 vs Mem0 entro il rumore; la correzione onesta del 95 % di blind3 |
| 2026-10-05→08 | `dataset_blind5`, 87 domande | Servizio 89,2 % (poi 90,7 %), D 91,7 %, contesto completo 91,4 % | Nessuna baseline di mercato eseguita |
| 2026-10-08 | `dataset_blind7` (46 domande) / `dataset_blind8` (entità, 31 domande), 3 esecuzioni | Servizio rilasciato 91,3 % / **82,1 %** | Nessuna baseline di mercato; memoria di entità sperimentale |

Conclusioni che si possono davvero trarre:
1. Sui set dove sono stati eseguiti entrambi, il servizio di Recordare era **al livello di Mem0** (entro il rumore).
   Era davanti a Cognee con rumore, e davanti a Memobase e Graphiti nei round precedenti, più piccoli.
2. Mem0 e Cognee hanno fallito ogni volta le stesse prove strutturali: le domande su un periodo e l'affermazione di un
   terzo sulla persona.
3. **Nessun sistema di mercato è stato eseguito sui set che contano per D50**: l'attribuzione fra più parlanti
   (blind6, blind8) e i prossimi set sugli agenti. Il Mem0 che abbiamo misurato è la libreria OSS. L'ordinamento
   temporale della piattaforma di maggio 2026 non è stato provato.

### 4.2 Dichiarazioni sui benchmark pubblici (numeri dei fornitori; non confrontabili fra loro né con il §4.1)

| Sistema | LoCoMo | LongMemEval | BEAM |
|---|---|---|---|
| Mem0 (algoritmo di aprile 2026) | 91,6–92,5 | 93,4–94,4 | 1M 64,1, 10M 48,6 |
| MemOS | 88,83 | 89,20 | — |
| Supermemory | dichiarato | Recall@20 97 % (recupero, non risposte) | — |
| Zep | — | 71,2 % (gpt-4o, paper) | — |
| Hindsight | — | SOTA dichiarato (gennaio 2026) | 10M 64,1 % |
| Honcho | dichiarato | dichiarato | 10M 40,6 % (riportato da Hindsight) |
| Cognee | — | — | 100k 79 % |

Avvertenze sui benchmark stessi:
- **LoCoMo**: il 6,4 % delle risposte di riferimento è sbagliato, e il suo giudice pubblicato ha accettato il 63 % di
  risposte volutamente sbagliate (`literature/penfield-locomo-audit.md`). La licenza è CC BY-NC.
- **LongMemEval-S**: circa 115 k token stanno nelle finestre di contesto attuali, quindi misura l'efficienza del
  contesto più del recupero. Una versione ripulita è uscita a settembre 2025 e LongMemEval-V2 ("contesto agentico") a
  maggio 2026. Licenza MIT.
- **BEAM**: costruito per 1M–10M token, dove riempire il contesto non basta più. Licenza non verificata.
- **Nessuno di questi misura le domande poste da D50**: chi ha detto cosa fra più parlanti, le memorie proprie
  dell'agente rispetto a quelle altrui, la resa in prima persona.

## 5. Dove Recordare è diverso — oggi e dopo D50

### Punti di forza, onestamente
- **Semantica del tempo e dei piani.** Tempo dell'evento con precisione, fatti alla data, `corrects` vs `supersedes`,
  e piani il cui esito resta sconosciuto. Solo Graphiti / Zep è paragonabile sui fatti bitemporali, e nessuno dei
  sistemi esaminati ha il ciclo di vita dei piani.
- **Provenienza imposta dal codice.** Gli id delle prove sono verificati sul log grezzo, l'LLM non cancella mai, le
  affermazioni altrui restano separate, e c'è la guardia contro l'eco del richiamo (dal 79 % al 100 % sul suo set di
  sviluppo). OpenClaw e Honcho condividono questa filosofia; gli altri per lo più no.
- **Disciplina di misura.** Set ciechi scritti da agenti separati, tre esecuzioni, intervalli appaiati, controlli
  senza memoria e a contesto completo, e baseline di mercato nello stesso harness. I fornitori pubblicano numeri
  singoli su benchmark pubblici.
- **Economico per costruzione**, senza LLM in lettura, e con **qualunque provider**.
- **Aperto e self-hosted (AGPL)**, con connettori per OpenClaw, Hermes, Claude Code e Codex e un proxy compatibile
  OpenAI.

### Debolezze e lacune
- **Nessun numero su benchmark pubblici.** Recordare non si può affatto mettere accanto a Mem0, MemOS, Hindsight o
  Zep, e i suoi set sono piccoli (31–87 domande).
- **La memoria di entità / con più parlanti è il punto debole**: 82,1 % su blind8, dove chi non si identifica viene
  attribuito a persone con un nome. D50 rende centrale proprio questa modalità.
- **Tipi di memoria mancanti**: niente documenti (D49 non costruito), niente memoria procedurale, niente riflessione,
  niente intenti dell'agente, niente input multimodale. Supermemory, MemOS e Cognee acquisiscono file; Letta e Hermes
  conservano skill.
- **Non è pronto per servire estranei**: profilo privato, admin fidato, niente OAuth. Honcho ha workspace e scope;
  Mem0, Zep e Supermemory hanno piattaforme hosted multi-tenant.
- **Nessuno strato di privacy dopo D50.** Senza consenso e senza filtro sugli spettatori, un familiare che chiede
  all'agente ottiene risposte da tutto. Gli scope di Honcho e gli store in sola lettura di Managed Agents danno agli
  sviluppatori dei confini che oggi Recordare non offre.
- **I modelli locali non sono supportati con qualità sufficiente**: 60–83 %, sotto la soglia del 95 %. Diversi
  concorrenti pubblicizzano modalità locali, ma la loro qualità con modelli locali non l'abbiamo misurata.
- **Un solo manutentore e un solo client reale.** Gli altri hanno comunità e integrazioni su larga scala.

### Cosa fanno meglio gli altri (da cui imparare)
- **Iniezione e cura in base all'uso**: i due livelli e i trigger di OpenClaw, il prefetch di Hermes, la gestione per
  recenza / frequenza di ChatGPT, il decadimento di Mem0 come preferenza nell'ordinamento che non esclude mai nulla.
- **Profili che gli utenti possono leggere e correggere**: il riassunto modificabile di ChatGPT, il profilo statico /
  dinamico di Supermemory, le peer card di Honcho, i Memory Profiles di Google.
- **Audit delle versioni e oscuramento**: Managed Agents (versioni immutabili attribuite alla sessione, oscuramento),
  i controlli sulle revisioni di Google.
- **Confini di visibilità come dati**: gli scope di Honcho, i grafi di permessi di Collaborative Memory verificati in
  lettura.
- **Documenti accanto alle memorie**: Supermemory e Cognee.

### I più vicini alla visione D50, e in cosa D50 si distingue

| Sistema | Cosa è vicino | In cosa D50 si distingue |
|---|---|---|
| **Honcho** | Ogni partecipante è un peer; fatti su un peer solo da quel peer; l'agente stesso può essere un peer che osserva gli altri | Honcho conserva rappresentazioni **per coppia** (la visione che A ha di B) e risponde con un LLM in lettura. D50 tiene **una** memoria per agente con un soggetto su ogni elemento, la scrive in prima persona (modalità personale), non usa LLM in lettura, conserva una storia append-only (la deduzione di Honcho cancella le osservazioni superate) e ha un modello esplicito del tempo dell'evento |
| **Letta / Letta Code** | La memoria appartiene a un agente persistente che mantiene la sua identità fra modelli diversi; riflessione nel tempo di inattività | La memoria di Letta sono file che l'agente modifica da sé (riscritture con perdita, niente tempo dell'evento, niente attribuzione per parlante); D50 mantiene l'estrazione fatta dal servizio, con prove e attribuzione |
| **Collaborative Memory** (paper) | Provenienza immutabile per frammento (utente di origine, agente che ha contribuito), più utenti degli stessi agenti, permessi verificati in lettura | È un design di ricerca con livello privato e condiviso e oscuramento fatto dall'LLM; D50 ha un livello solo e **ancora nessuna verifica dei permessi** (nessun filtro sugli spettatori). La verifica in lettura di Collaborative Memory è la forma naturale del futuro passo di privacy di D50 |
| **OpenClaw** | Memoria dell'agente con classi di origine e contaminazione del turno | OpenClaw non attribuisce mai per default il contenuto al proprietario; la modalità personale di D50 **sì**, attribuisce al sé il contenuto non dichiarato, e per questo serve una contaminazione alla OpenClaw che tenga fuori dall'"io" il testo di strumenti e web |
| **Claude Managed Agents** | Store posseduti dal deployment, collegati per sessione, versioni attribuite alla sessione | File liberi scritti dall'agente; l'attribuzione è a una sessione, non a chi parla; nessuna semantica di tempo o di piani |
| **Mem0 (`agent_id`, metadati sull'attore)** | Ambito agente accanto all'ambito utente | Ambiti, non attribuzione dentro una stessa memoria; nessun ruolo per i terzi |

Stato della letteratura: `human-memory-and-agent-architectures.md` §2.6 dice che una *memoria centrata sull'agente che
contiene una memoria centrata sull'utente con attribuzione* è indicata come poco studiata (Huang et al., 2026), e che
non è dimostrata nuova. Honcho e Collaborative Memory sono vicini. La resa in prima persona da "gemello indiretto" e il
metodo / la confidenza dell'attribuzione come dati non sono stati verificati sulla letteratura. **Qui non si rivendica
alcuna novità.**

## 6. Raccomandazioni per M8

1. **Fare dell'attribuzione un dato, prendendo le regole di Honcho (AGPL, riusabili con nota) e la provenienza di
   Collaborative Memory (idea, citata).** Aggiungere `attributed_to`, `attribution_method`,
   `attribution_confidence` e collegamenti di riattribuzione su ogni elemento (audit Q2–Q6, lacuna 3 della scheda di
   letteratura). Tenere la regola del deriver di Honcho: nessun fatto su una persona dalle parole di un altro, a meno
   che quella persona non acconsenta. Conservare in modo immutabile chi parla all'origine e l'agente che ha
   contribuito, così che un futuro passo di privacy possa verificare in lettura senza migrazioni.
2. **Trattare la prima persona come resa, mai come provenienza.** Tenere separati nei dati `origin` / `author_role`
   (percepito vs generato, la distinzione del monitoraggio della realtà), come argomenta la scheda di letteratura.
   Evitare lo stile dei file di memoria (Letta, Claude Code, `MEMORY.md` di Hermes), dove un agente scrive "io" senza
   fonte, ed evitare uno stato sintetizzato alla ChatGPT che sostituisce gli elementi.
3. **Prendere da OpenClaw la contaminazione del turno prima che la modalità personale attribuisca al sé il testo non
   dichiarato** (MIT, idea e formulazione con nota). Nella modalità personale di D50 il default è "mio". Il testo che
   arriva da risultati di web, strumenti o file non deve quindi mai diventare memoria in prima persona, a meno che sia
   marcato `own` (fonti D49). L'avvertenza di Anthropic sull'injection negli store in lettura-scrittura descrive lo
   stesso rischio. Misurarlo con un piccolo set di sviluppo di injection tramite strumenti, poi con le categorie
   cieche di avvelenamento.
4. **Aggiungere l'oscuramento / la cancellazione per contatto, ora che il consenso non c'è più.** Managed Agents può
   oscurare le versioni; la Memory Bank di Google ha TTL sulle revisioni (non verificato). A Recordare serve
   "dimentica tutto su Marta" (gli episodi che la nominano, i suoi fatti, le sue righe nel log grezzo) come operazione
   append-only con tombstone. Senza consenso è lo strumento principale di chi installa per le richieste di
   cancellazione del GDPR. Costa zero chiamate LLM, quindi può essere rilasciato senza valutazione (solo test).
5. **Progettare il futuro passo di privacy sugli scope, non sui prompt.** Gli scope di Honcho (gruppi di sessioni che
   limitano il richiamo) e la verifica in lettura di Collaborative Memory sulla provenienza memorizzata si adattano
   entrambi a dati che Recordare registra già (`audience`, `disclosure`). Annotare la decisione nella lista "più
   avanti" di D50, così che lo schema di M8 (8.3, 8.10) non chiuda la porta.
6. **Una scheda del sé e schede dei contatti come viste derivate e deterministiche** (idea 6 della rassegna sulle
   piattaforme; peer card di Honcho, riassunto modificabile di ChatGPT, profilo statico / dinamico di Supermemory,
   Memory Profiles di Google). Nei termini di D50: "chi sono io" per il sé e una scheda per ogni contatto, costruite dai
   fatti attuali e dalle note dichiarate con gli id delle fonti, leggibili e correggibili nel Diario. Zero chiamate
   LLM se costruite in modo deterministico. Misurarle con il set di sviluppo del contesto di memoria.
7. **Fonti D49: prendere come modello la separazione fra documenti e memorie di Supermemory e le sue relazioni
   `updates / extends / derives`** (idea, citata). Non adottare la costruzione del grafo all'ingest alla Cognee (l'abbiamo
   misurata come la più vicina a un RAG, ed è costosa per documento).
8. **Da evitare**: un LLM in lettura sul percorso di default (la dialettica di Honcho, Active Memory di OpenClaw); la
   cancellazione degli elementi superati (la deduzione di Honcho, il "correggi alla fonte" di Letta); il decadimento
   per recenza o la frequenza di richiamo come verità (solo per l'ordinamento, come mostrano il decadimento di Mem0 e
   il filtro deep di OpenClaw); "nel dubbio, estrai" (Mem0; il nostro extract.v5 ha perso punti due volte).
9. **Rieseguire un solo confronto misurato, con un budget dichiarato: Mem0 OSS sui nuovi set per gli agenti (8.11),
   solo base, 3 esecuzioni.** Mem0 è il sistema con cui il nostro servizio ha pareggiato, e i suoi ambiti `agent_id` /
   attore sono la risposta di default del mercato alla "memoria dell'agente". La regola 3 delle valutazioni ammette la
   riesecuzione perché la domanda è nuova: l'attribuzione fra più parlanti non è mai stata misurata per Mem0. Il costo
   è alto: Mem0 ha preso il 56 % della spesa del giro 2026-10-04→05, e 1,77 M di token in input per esecuzione con
   rumore su blind3. Solo base, niente rumore, e dichiarare il budget e controllare il saldo prima di partire (regola
   8). Aggiungere **Honcho come una sola esecuzione esplorativa** (1 esecuzione, il set di entità) solo se il
   risultato di Mem0 lascia aperta la domanda sull'attribuzione: è il design più vicino, è AGPL e si può
   self-hostare.
10. **Ottenere un dato su un benchmark pubblico, a basso costo, solo per confrontabilità:** LongMemEval-S *ripulito*
    (MIT), un sottoinsieme stratificato di circa 100 domande, modalità personale, 1 esecuzione, nessuna messa a punto su
    di esso. Ogni domanda ha la sua storia di circa 115 k token, quindi 100 domande significano circa 11–12 M di token
    in input all'estrazione. È circa dieci volte un'esecuzione su un set cieco, quindi il budget va dichiarato e
    approvato prima. Non usare LoCoMo (CC BY-NC, il 6,4 % delle risposte di riferimento sbagliato, un giudice
    indulgente). Riportare il numero con l'avvertenza che LongMemEval misura la memoria di un solo utente, non
    l'attribuzione di D50.

## Fonti

Documenti del repository: `EPISODIC_MEMORY_TODO.md` (D48–D50), `AGENT_MEMORY_AUDIT.md`, `WORK_PLAN.md` (M8, budget
di valutazione), `ENGINE_IDEAS.md`, `literature/agent-platform-memory.md`,
`literature/human-memory-and-agent-architectures.md`, `literature/collaborative-memory.md`,
`literature/penfield-locomo-audit.md`, `literature/longmemeval.md`, `spikes/memory-eval/RESULTS.md`,
`spikes/memory-eval/systems/mem0_sys.py`.

Web (letto il 2026-10-09):
- Mem0: [repo](https://github.com/mem0ai/mem0), [changelog della piattaforma](https://docs.mem0.ai/changelog/platform.md), [ricerca](https://mem0.ai/research-5)
- Zep / Graphiti: [repo di Graphiti](https://github.com/getzep/graphiti), [concetti di Zep](https://help.getzep.com/concepts), [direzione OSS](https://blog.getzep.com/announcing-a-new-direction-for-zeps-open-source-strategy/)
- Letta: [our next phase](https://www.letta.com/blog/our-next-phase), [Letta Code](https://www.letta.com/blog/letta-code), [app Letta Code](https://www.letta.com/blog/introducing-the-letta-code-app/)
- Supermemory: [repo](https://github.com/supermemoryai/supermemory), [report LongMemEval](https://supermemory.ai/research/longmembench)
- Honcho: [repo](https://github.com/plastic-labs/honcho)
- Memobase: [repo](https://github.com/memodb-io/memobase), [stato da fonte secondaria](https://gittrend.io/repo/memodb-io/memobase)
- Cognee: [annuncio 1.0](https://www.cognee.ai/cognee-1-0-announcement)
- LangMem: [repo](https://github.com/langchain-ai/langmem), [stato da fonte secondaria](https://rywalker.com/research/langmem)
- MemOS: [repo](https://github.com/MemTensor/MemOS); MemoryOS: [repo](https://github.com/BAI-LAB/MemoryOS)
- Hindsight: [repo](https://github.com/vectorize-io/hindsight), [post BEAM](https://hindsight.vectorize.io/blog/2026/04/02/beam-sota)
- ChatGPT: [PCWorld su Dreaming](https://www.pcworld.com/article/3158111/chatgpt-new-dreaming-feature-makes-it-way-better-at-remembering-you.html), [iClarified](https://www.iclarified.com/96981/chatgpt-can-now-reference-all-your-past-chats)
- Claude: [memoria di Claude Code](https://code.claude.com/docs/en/memory), [memoria di Managed Agents](https://platform.claude.com/docs/en/managed-agents/memory), [9to5Mac su memoria gratuita e importazione](https://9to5mac.com/2026/03/02/free-claude-users-can-now-use-memory-and-import-context-from-rivals/)
- Gemini: [Android Authority su Personal Intelligence](https://www.androidauthority.com/google-gemini-personal-intelligence-rollout-3632287), [9to5Google sulle chat passate](https://9to5google.com/2026/02/26/gemini-past-chats-free/), [blog Google sull'importazione](https://blog.google/intl/en-mena/product-updates/explore-get-answers/ai-memories-chat-history-to-gemini/), [agentmarketcap su Memory Bank](https://agentmarketcap.ai/blog/2026/07/28/gemini-agent-memory-managed-infrastructure)
- OpenClaw: [release 2026.4.12](https://newreleases.io/project/npm/openclaw/release/2026.4.12), [memory-core](https://docs.openclaw.ai/es/plugins/reference/memory-core.md)
- Hermes: [provider di memoria](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory-providers)
- Benchmark: [repo di LongMemEval](https://github.com/xiaowu0162/LongMemEval); audit di LoCoMo come in `literature/penfield-locomo-audit.md`
