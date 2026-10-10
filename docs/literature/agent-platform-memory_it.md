# Memoria delle piattaforme di agenti — come la gestiscono e che cosa Recordare dovrebbe prendere in prestito (rassegna, 2026-10-07)

*Traduzione italiana di [agent-platform-memory.md](agent-platform-memory.md) — la versione inglese è quella di riferimento.*

Letto: codice sorgente da shallow clone fatti il 2026-10-07: Hermes Agent `a50406d9`, OpenClaw `8f436000`, Honcho
`ae4a157`, letta-code `4b028fa`, Mem0 `0516f19`, LangMem `48e3c11`. I file letti sono nominati in ogni sezione. Documentazione
ufficiale: Hermes (pagine memory e memory-providers), OpenClaw (`docs/concepts/memory*.md`, `dreaming.md`, nel repo),
Claude Code (`code.claude.com/docs/en/memory`). Sono stati letti tramite uno strumento di fetch che restituisce passaggi
estratti: la documentazione di Zep, Supermemory e Cognee. Il centro assistenza di ChatGPT ha restituito 403, quindi la sua sezione si basa su fonti
secondarie (copertura stampa dell'aggiornamento di ottobre 2025) e va ricontrollata prima che qualcuno la citi. Si appoggia a
`../ENGINE_IDEAS_it.md` (Memobase, Graphiti, OpenHuman, Open Dots) e alle schede `mem0-production-memory_it.md` e
`zep-temporal-kg_it.md`. Lo spike di Recordare ha già misurato Mem0, Cognee, Graphiti e Memobase (`RESULTS.md`), quindi
questa rassegna riguarda **idee di progetto**, non nuovi punteggi.

Le licenze decidono che cosa possiamo copiare (`../LICENSING_it.md`). MIT: Hermes, OpenClaw, LangMem. Apache-2.0: Letta, Mem0, Graphiti,
Cognee. **AGPL-3.0: Honcho**, che è la stessa famiglia della nostra, quindi il testo dei suoi prompt può essere riusato con le note di attribuzione.
Proprietari: Claude Code, ChatGPT, Zep Cloud, il servizio di Supermemory. Da questi prendiamo solo le idee.

## 1. I sistemi

**Hermes Agent (Nous Research, MIT)** —
[memory](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory),
[providers](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory-providers),
[repo](https://github.com/NousResearch/hermes-agent). La memoria integrata è fatta di due piccoli file che l'agente scrive da sé:
`MEMORY.md` (gli appunti dell'agente sul proprio ambiente, 2.200 caratteri) e `USER.md` (chi è l'utente, 1.375 caratteri). Vengono
iniettati nel prompt di sistema come **snapshot congelato** all'inizio della sessione ("never changes mid-session", così
la prefix cache sopravvive). Le scritture diventano visibili solo nella sessione successiva. L'agente ha un unico strumento `memory`
(`tools/memory_tool.py`) con add / replace / remove, applicati come batch atomico verificato rispetto al limite di
caratteri. Un archivio pieno restituisce un errore che fa consolidare l'agente nella stessa chiamata. La descrizione dello strumento dice
di salvare solo "facts that apply to EVERY session regardless of task" e di SALTARE "task progress, completed-work logs,
temporary TODO state". Le procedure vanno nelle **skill**, non nella memoria. Ogni 10 turni (`nudge_interval`) un **fork di
revisione in background** (`agent/background_review.py`) rilegge la conversazione su un modello ausiliario più economico che riusa la
stessa prefix cache, e chiede "should any skill/memory be saved". Il suo prompt instrada ogni fatto verso un solo archivio
("One fact goes to ONE store, never both"). Le scritture vengono scansionate alla ricerca di pattern di iniezione ed esfiltrazione. L'opzione
`write_approval` le mette in staging per la revisione umana. `session_search` offre ricerca full-text sulle sessioni passate.
I provider esterni implementano `MemoryProvider` (`agent/memory_provider.py`) con questi hook:
- `system_prompt_block` (statico);
- `prefetch` / `queue_prefetch`: il recall per il turno successivo viene calcolato in background dopo quello corrente;
- `sync_turn`: dopo ogni turno, con `turn_author`;
- `on_session_end`, `on_pre_compress` (salvare i fatti prima della compattazione), `on_memory_write` (rispecchiare le scritture integrate),
  `on_delegation`.
Il recall viene saltato per i prompt banali (`is_trivial_prompt`: saluti, comandi slash). Il testo recuperato è avvolto in una
recinzione `<memory-context>` con una nota "NOT new user input", e `sanitize_context` toglie recinzioni e note così il testo
recuperato non rientra come nuovo input. Tutto ciò che viene passato a un provider attraversa prima uno scrub dei segreti
(`_redact_for_provider`). I provider ricevono `agent_context` (`primary | cron | subagent`) e dovrebbero "skip automatic
writes for the non-primary values". Il provider incluso `holographic` tiene un archivio di fatti SQLite con un **punteggio di fiducia (trust score)**
che l'agente addestra tramite uno strumento `fact_feedback` (helpful / unhelpful).

**OpenClaw (MIT)** — [repo](https://github.com/openclaw/openclaw), `docs/concepts/memory-architecture.md`,
`dreaming.md`, `extensions/memory-core/`. È il progetto più elaborato tra quelli esaminati e il più vicino al nostro nello spirito
("Writing is the hard part", "Deterministic gates, model judgment inside them", "The write path is the security
boundary"). La memoria è organizzata in livelli:
- **instructions**: `AGENTS.md`, scritto solo da umani;
- **curated core**: `MEMORY.md` + `USER.md`, con budget e iniettati all'inizio della sessione;
- **episodic**: note giornaliere datate `memory/YYYY-MM-DD.md` + trascrizioni di sessione, raggiunte solo tramite ricerca;
- **prospective**: intenti permanenti + cron;
- **review**: `DREAMS.md`, che gli umani leggono e che non viene mai iniettato.

La **provenienza** è mantenuta in colonne SQLite che la prosa non può falsificare. La classe di origine è `owner | agent | untrusted | system`,
e "it is never defaulted to `owner`". Ogni voce registra anche il tipo di sessione, un timestamp di osservazione e una
chiave di sostituzione. Regole di igiene costruite su questa base:
- le sessioni cron, heartbeat e sub-agent non producono mai candidati durevoli;
- **prevenzione dei loop di recall**: la memoria iniettata è "structurally marked and never re-extracted";
- **turn taint**: quando uno strumento restituisce contenuto proveniente dalla rete, il resto dell'output dell'assistente in quel turno è
  `untrusted` (la contaminazione si azzera al messaggio successivo dell'utente).

**Dreaming** è l'unico scrittore del curated core. Gira come cron notturno in tre fasi: light (stage),
REM (temi) e deep (promozione). Deep ordina i candidati per rilevanza 0,30, frequenza di recall 0,24, diversità delle query 0,15,
recenza 0,15, ricorrenza su più giorni 0,10 e ricchezza concettuale 0,06. I candidati untrusted e system vengono rimossi
prima che venga costruito qualsiasi prompt. Una chiamata senza strumenti restituisce poi **operazioni, non prosa** (`added | merged | superseded`
con le esatte voci precedenti, `dreaming-consolidation.ts`). Il codice le valida: fonti preservate, budget rispettato,
perdita limitata di voci precedenti, concorrenza ottimistica su un hash del contenuto. La versione precedente del file (pre-immagine) viene
salvata e un output non valido ripiega su append-only. Il recall gira su due corsie:
- La corsia 1 richiede zero chiamate LLM. Inietta i file curati e ordina la ricerca ibrida con un'emivita di recenza di 30 giorni ×
  importanza assegnata in scrittura. Gli scrittori allegano **frasi trigger** alle voci curate; il messaggio in arrivo viene confrontato con
  esse (punteggio ≥ 0,65, al massimo 3 per turno).
- La corsia 2 è un sub-agente di recall bloccante ("active memory"). Gira solo quando il messaggio mostra intento di recall *e*
  la corsia 1 non ha trovato nulla di forte.

`USER.md` contiene **direttive** imperative ("Always / Never / Prefer") con una data di osservazione e uno stato (attiva o
sostituita), aggiornate sul posto. La ragione addotta è PrefEval: i modelli smettono di applicare una preferenza che sta semplicemente nel
contesto. Gli **intenti permanenti** vengono compilati fuori dal modello: "remind me Friday" diventa un job cron. Gli intenti
condizionati a eventi sono righe SQLite con parole chiave, embedding, ambito, scadenza, un budget di attivazioni (3) e un periodo di raffreddamento (24 h), confrontati da un
prefiltro deterministico. Un turno di **memory flush** pre-compattazione salva il contesto non ancora scritto nella nota giornaliera.
`memory forget` rimuove le voci derivate da sessioni scelte e tiene quelle sessioni fuori dalle future ingestioni.
Plugin: `memory-lancedb` (auto-recall / auto-capture su LanceDB), `memory-wiki` (affermazioni con evidenze,
report di contraddizione e freschezza) e un plugin Honcho.

**Claude Code (Anthropic, proprietario)** — [docs](https://code.claude.com/docs/en/memory). Ha due livelli.
`CLAUDE.md` contiene istruzioni scritte da umani (ambito utente / progetto / organizzazione), consegnate come messaggio utente dopo il
prompt di sistema. La **auto memory** è scritta dal modello in `~/.claude/projects/<repo>/memory/`. Quella cartella contiene un
indice `MEMORY.md` (una riga per ricordo; le prime 200 righe o 25 KB vengono caricate a ogni sessione) più un file di topic per
ricordo con un `type` tra `user | feedback | project | reference`. I file di topic vengono letti su richiesta. L'harness applica un
timestamp `modified` a ogni scrittura e avvisa quando l'indice si avvicina al limite. Claude "skips anything it can derive from
the codebase" e qualsiasi cosa `CLAUDE.md` dica già. Non c'è consolidamento in background; l'utente modifica tramite
`/memory`.

**ChatGPT (OpenAI, proprietario)** — la [Memory FAQ](https://help.openai.com/en/articles/8590148-memory-faq) non era
leggibile (403); questa sezione usa fonti secondarie come
[TechRadar](https://www.techradar.com/ai-platforms-assistants/chatgpt/chatgpt-is-smarter-now-that-its-learned-to-forget-a-huge-memory-upgrade-is-coming)
e va ricontrollata. ChatGPT ha le **saved memories** (fatti discreti, espliciti o su iniziativa del modello, elencati e
cancellabili) e il **chat-history reference** (temi dalle chat passate, non elencati voce per voce). Dall'aggiornamento di ottobre 2025,
la **automatic memory management** tiene i ricordi "top of mind" in base a recenza e frequenza di menzione e sposta il resto
"to the background" invece di cancellarlo. Gli utenti possono vedere e sovrascrivere le priorità. Le chat temporanee non leggono né
scrivono memoria.

**Letta / MemGPT (Apache-2.0)** — [letta-code](https://github.com/letta-ai/letta-code) (il vecchio repo del server è
archiviato), MemGPT ([arXiv:2310.08560](https://arxiv.org/abs/2310.08560)), sleep-time compute
([arXiv:2504.13171](https://arxiv.org/abs/2504.13171)). Il progetto classico ha tre parti: blocchi di **core memory**
(persona / human, con limite di caratteri, sempre nel contesto, modificati dall'agente con strumenti), **archival memory** (un archivio
vettoriale raggiunto tramite strumenti) e **recall memory** (ricerca nelle conversazioni). Gli agenti sleep-time modificano in modo asincrono i blocchi
condivisi. letta-code ora tiene la memoria come **filesystem Markdown basato su git**: i file in radice sono core (sempre nel
contesto), le directory figlie sono differite (lette su richiesta in base alla descrizione) e `ARCHIVE.md` contiene il contesto ritirato. Un
**subagente di riflessione** (`src/agent/subagents/builtin/reflection-v2.md`) viene attivato da `step-count` o da un
`compaction-event`. Legge una o più trascrizioni e ordina gli apprendimenti candidati mettendo prima "mistakes and corrections",
poi preferenze, nuovi fatti, contraddizioni e procedure riutilizzabili. Applica filtri (duraturo o effimero,
già catturato, generalizzabile, "convert any relative dates") e fa il **commit** della modifica su git con gli id dell'agente figlio e
dell'agente padre. "If new information contradicts existing memory, fix the stale entry at the source."

**Mem0 (Apache-2.0)** — [repo](https://github.com/mem0ai/mem0), `mem0/configs/prompts.py`,
`docs/migration/platform-v2-to-v3.mdx`. L'algoritmo v3 ha **abbandonato ADD / UPDATE / DELETE / NOOP**. L'estrazione è ora un'unica
passata **solo ADD** (`ADDITIVE_EXTRACTION_PROMPT`): "nothing is overwritten or deleted". Ogni nuovo ricordo si collega a quelli
esistenti correlati tramite `linked_memory_ids` (stessa entità, preferenza aggiornata, continuazione, contraddizione). L'attualità è
gestita al retrieval con un ranking multi-segnale (semantico + BM25 + un boost per entità da un grafo di entità integrato; nessun archivio a
grafo esterno). Idee di prompt degne di nota:
- estrarre i **fatti incidentali dentro le richieste** ("Do NOT let the request overshadow the facts");
- catturare le **transizioni** (il nuovo stato *e* ciò che sostituisce; segnalare prove o cambiamenti temporanei);
- la data di osservazione è l'unico ancoraggio temporale;
- dai turni dell'assistente estrarre solo ciò che è nuovo (raccomandazioni, piani, accordi), mai gli echi;
- "When in doubt, extract".
È la stessa direzione presa in D28 / D29 (append-only + catene di valori), raggiunta in modo indipendente.

**Zep / Graphiti (Graphiti Apache-2.0; Zep Cloud proprietario)** — [concepts](https://help.getzep.com/concepts); vedi
`zep-temporal-kg_it.md`. È un knowledge graph bi-temporale: gli episodi forniscono la provenienza, i fatti sono archi con
`valid_at / invalid_at` e i tipi personalizzati di entità e archi fungono da ontologia. Il prodotto cloud aggiunge per ogni thread un
**context block** e un **user summary** guidato da fino a cinque istruzioni scritte dallo sviluppatore. Nulla di nuovo oltre alla scheda
e a `ENGINE_IDEAS_it.md`.

**Honcho (Plastic Labs, AGPL-3.0)** — [repo](https://github.com/plastic-labs/honcho). Modella i peer: ogni
*observer* ha la propria rappresentazione di ciascun peer *osservato*, che è letteralmente una teoria della mente ("Alice's view of
Bob"). I componenti:
- **Deriver** (`src/deriver/prompts.py`): estrae fatti espliciti atomici per ogni batch di messaggi. I messaggi sono taggati
  `peer=…, target=true|false`. I fatti sul target vengono solo dai messaggi del target ("never derive a fact about
  the target peer from what another peer said"). Una regola: "When the target peer answers a question or accepts a
  proposal … the details … count as stated by the target peer. A bare acknowledgement ('ok', 'thanks') does not."
- **Peer card**: un archivio compatto di identità di al massimo 40 voci con i prefissi `IDENTITY / ATTRIBUTE / RELATIONSHIP /
  INSTRUCTION`. Regola di stabilità: "If the value plausibly changes within six months … it does not belong on the card".
  Le voci INSTRUCTION sono scritte "only when explicit; never inferred". Le affermazioni di altri sul target contano solo
  "with the target observee's assent".
- **Dreamer** (`src/dreamer/`): gira per coppia di peer quando è dovuto. Un prefiltro opzionale di **surprisal** sceglie le osservazioni
  insolite. Uno specialista di *deduzione* gestisce aggiornamenti di conoscenza, implicazioni e contraddizioni; uno specialista di
  *induzione* trova pattern da almeno 2 fonti, con confidenza determinata dal numero di evidenze (2 = bassa, 3–4 = media,
  5+ = alta). Ogni conclusione deve citare `source_ids` e gli id inventati vengono scartati. Lo specialista di deduzione
  cancella anche le osservazioni obsolete.
- **Dialectic** (`src/dialectic/`): un endpoint di Q&A agentico sulla memoria, con strumenti come `search_memory`,
  `get_reasoning_chain`, `search_messages_temporal` e `get_messages_by_date_range`.

**Supermemory (hosted, proprietario)** —
[graph memory](https://supermemory.ai/docs/concepts/graph-memory). Separa i documenti (fonti di verità) dai
ricordi (fatti estratti). Le relazioni sono **updates** (`isLatest` si inverte, la storia resta per l'audit), **extends** (aggiunge
dettaglio, entrambi restano validi) e **derives** (inferito da pattern). L'oblio ha tre forme: temporale (i fatti
temporanei scadono), per contraddizione e filtraggio del rumore. I profili sono divisi in parti statiche e dinamiche.

**Cognee (Apache-2.0)** — [memify](https://docs.cognee.ai/core-concepts/main-operations/memify). `cognify`
(classifica → spezza in chunk → estrae → riassume → memorizza) costruisce un grafo. `memify` arricchisce un grafo esistente senza
rileggere le fonti (consolidamento delle entità, connessioni trasversali, embedding di triple). L'abbiamo già misurato: è il più vicino
al semplice RAG (`RESULTS.md` 4b.5).

**LangMem (LangChain, MIT)** — [repo](https://github.com/langchain-ai/langmem). La memoria è tipizzata come semantica (fatti,
profilo), episodica ("successful interactions as learning examples") e procedurale (ottimizzazione del prompt di sistema dal
feedback: `create_prompt_optimizer`). Il prompt del memory manager (`knowledge/extraction.py`) chiede la confidenza
("p(x)") e di conservare l'informazione "surprising (pattern deviation) and persistent (frequently reinforced)".
`ReflectionExecutor(after_seconds=…)` fa il **debounce** dell'estrazione in background: un nuovo messaggio ripianifica l'esecuzione, che è
il nostro trigger idle (D1).

## 2. Confronto con Recordare

| | Recordare (ora) | Hermes | OpenClaw | Claude Code | ChatGPT | Letta | Mem0 v3 | Honcho |
|---|---|---|---|---|---|---|---|---|
| **Tipi di memoria** | Log grezzo, episodi (evento / piano / cambio di stato), piani con ciclo di vita, fatti di stato (catena di valori), note, digest giornalieri / mensili | 2 piccoli file curati; skill; ricerca nelle sessioni | Curated core, modello utente a direttive, note giornaliere, trascrizioni, intenti permanenti, claim wiki | File di istruzioni + note di topic tipizzate | Fatti salvati, riferimento alla cronologia delle chat, profilo | Blocchi core, archival, recall; skill | Stringhe di fatti piatte + grafo di entità | Osservazioni esplicite / deduttive / induttive, peer card, per coppia observer–observed |
| **Trigger di scrittura** | Finestra idle + notturno (digest, revisione dei fatti) | Strumento dell'agente in qualsiasi momento + fork di revisione ogni 10 turni + sync del provider a ogni turno | Note dell'agente, flush pre-compattazione, fine sessione; il dreaming notturno promuove | Il modello durante la sessione | Il modello durante la chat; gestione in background | Strumenti dell'agente; riflessione su step count / compattazione | Per ogni chiamata `add` | Per batch di messaggi; dream quando dovuto |
| **Chi decide la scrittura** | Estrattore in background (1 chiamata), il codice applica i verdetti; strumenti dell'agente per le scritture esplicite | Agente + fork in background (LLM) | Agente per l'episodico; **gate nel codice + operazioni LLM** per il core | Il modello | Il modello | Agente / subagente di riflessione | LLM (solo add) | LLM del Deriver; agenti dream |
| **Modello del tempo** | Tempo dell'evento + precisione + espressione originale; tempo di registrazione; fatti bi-temporali; query as-of | Solo tempo della sessione | Timestamp di osservazione + chiave di sostituzione; file giornalieri datati | Timestamp `modified` | Recenza della menzione | Cronologia dei commit | Data di osservazione nel testo; `created_at` | Tempo del messaggio; deduzioni di "knowledge updates" |
| **Provenienza** | Id dei messaggi di evidenza validati nel codice; origine `holder_lived / holder_told / assistant_stated`; ruolo dell'autore; claim tenuti separati; audience set (D29) | Archivio di destinazione; ambito del profilo | **Colonna della classe di origine (owner / agent / untrusted / system), tipo di sessione, turn taint** | Nessuna | Nessuna visibile | Autore git per ogni riflessione | Metadati di attore / ruolo | Flag di peer e target; `source_ids` sulle deduzioni |
| **Correzioni** | `corrects` vs `supersedes`, mai riscrivere; le patch dei piani richiedono evidenza; guardia contro gli echi del recall | Sostituzione per sottostringa (distruttiva) | Sostituzione per lignaggio; pre-immagine conservata; fallback append | Modifica del file | Il modello aggiorna / l'utente cancella | Modifica alla fonte + cronologia git | Solo ADD; il ranking preferisce il nuovo | La deduzione cancella l'obsoleto |
| **Recall / iniezione** | Strumenti MCP (modalità `search_episodes`, `search_facts` as-of, `search_memory`); gambe claim / estratti di chat / persone; nessun LLM in lettura | Snapshot congelato + prefetch del provider a ogni turno (in background) | Corsia 1 zero-LLM (curato + trigger + ricerca ordinata); corsia 2 sub-agente di escalation | Indice sempre + file su richiesta | Profilo sempre attivo + riferimento alla cronologia | Core sempre; strumenti per il resto | API di ricerca; l'host inietta | Q&A dialectic (LLM), peer card, contesto |
| **Consolidamento** | Digest notturni (con fingerprint), revisione notturna dei fatti (1 chiamata / memoria con novità) | Fork di revisione; il tetto di dimensione forza i merge | Dreaming light / REM / deep con gate deterministici | Nessuno | Gestione delle priorità | Subagente di riflessione | Nessuno (in fase di retrieval) | Dream di deduzione + induzione |
| **Privacy** | Regole di consenso, livelli di disclosure, audience set, forget con tombstone, ambito del log grezzo per client | Scansione delle iniezioni, scrub dei segreti, opzione di approvazione | Quarantena dei taint, politica di ammissione, forget per sessione, redazione prima dell'ingestione | File locali | Chat temporanea, cancellazione | Locale / cloud | API di cancellazione, scadenza | Ambito per coppia |

Nel complesso, nessuna piattaforma ha tempo dell'evento, ciclo di vita dei piani o provenienza titolare-vs-altri al nostro livello. OpenClaw è
l'unica con provenienza strutturale, e le sue regole (mai default a `owner`, mettere in quarantena l'untrusted, tenere fuori i loop di
recall) corrispondono a quanto hanno trovato empiricamente i nostri lavori su poisoning ed echi. Le piattaforme investono dove noi non l'abbiamo ancora fatto:
**iniezione** (prefetch, budget, trigger, prefix caching) e **curatela guidata dall'uso** (frequenza di recall,
feedback, priorità).

## 3. Idee da adottare (in ordine di priorità)

### 1. Recall recintato e marcato strutturalmente nel contratto dei connettori (prevenzione dei loop di recall per costruzione)
- **Che cosa**: tutto ciò che Recordare inietta in un prompt dell'host (blocco di prefetch, risultati degli strumenti) porta un marcatore
  leggibile dalla macchina, e l'ingestione rimuove o marca quegli intervalli prima dell'estrazione. Il tipo di sessione (`primary | cron | subagent | heartbeat`)
  viaggia con ogni turno e le sessioni non interattive non producono mai ricordi del titolare.
- **Da**: Hermes `build_memory_context_block` / `sanitize_context` e `agent_context`
  (`agent/memory_manager.py`, `agent/memory_provider.py`); OpenClaw "recall-loop prevention" e "session-kind
  gating" (`memory-architecture.md`).
- **Perché per noi**: la guardia contro gli echi del recall (`RESULTS.md`, "Recall echoes") funziona quando un *tool* di Recordare è nel turno. I
  connettori 6.6 inietteranno per lo più la memoria *prima* del turno (prefetch), dove il segnale dell'eco è più debole: la risposta
  ripete il testo iniettato e nessuna chiamata di strumento lo mostra. Anche un subagente di Claude Code o un'esecuzione cron di Hermes alimenterebbe
  contenuto "l'assistente ha detto" sul titolare.
- **Dove si inserisce**: contratto di ingestione (`API.md` §2: `injected_spans` opzionale o una convenzione di recinzione, `session_kind`); la guardia
  contro gli echi tratta un intervallo recintato esattamente come un recall servito; l'estrazione ignora i turni il cui `session_kind` non è
  interattivo (oppure li tiene come `assistant_stated` senza fatti).
- **Costo**: 0 chiamate LLM.
- **Misura**: il dev set degli echi rieseguito con una variante a iniezione da prefetch (gli stessi 9 casi, recall servito
  tramite iniezione invece che tramite strumento); l'obiettivo è lo stesso 100 %. Più una run di regressione su blind5 (nessun cambiamento atteso per
  costruzione).

### 2. Recall a due corsie per i connettori: un brief di prefetch zero-LLM, con escalation verso gli strumenti
- **Che cosa**: un endpoint `prefetch(query, conversation)` che restituisce un blocco compatto e con budget. Contiene (a) un
  **brief** stabile (scheda del titolare + fatti correnti + piani aperti dei prossimi giorni), iniettato una volta per sessione nella parte di sistema
  così il prefix caching lo mantiene, e (b) al massimo 3 elementi per turno il cui campo `context` memorizzato corrisponde al messaggio
  in modo forte. Viene saltato per i prompt banali. Il recall profondo resta negli strumenti MCP e il brief dice all'agente quando
  chiamarli (domande sul passato, su periodi e "quando ho…").
- **Da**: corsia 1 / corsia 2 di OpenClaw e iniezione per trigger (punteggio ≥ 0,65, ≤ 3 per turno); snapshot congelato di Hermes,
  `queue_prefetch` (recall per il turno n+1 calcolato dopo il turno n) e `is_trivial_prompt`; indice-più-su-richiesta di Claude Code.
- **Perché per noi**: il lavoro su H11 ha mostrato che le risposte dipendono da ciò che il recall consegna (blind4: recall dell'estrazione 0,96–0,99,
  risposte 80,8 %). I client Hermes e OpenClaw per lo più *non* chiameranno gli strumenti spontaneamente, quindi è il percorso di prefetch a decidere la
  qualità. Il nostro estrattore scrive già una frase `context` ("quando questo ricordo è utile da richiamare") per ogni episodio e
  nota. Oggi viene solo embeddata con il contenuto, mentre OpenClaw usa la stessa idea come trigger di iniezione.
  `ENGINE_IDEAS_it.md` elenca già "un brief di contesto pronto da iniettare" (OpenHuman); questo gli dà una forma concreta.
- **Dove si inserisce**: API di lettura + connettori (6.6); ranking deterministico, viewer context applicato per primo (D29), i claim mai nel
  brief.
- **Costo**: 0 chiamate LLM in lettura (regola D12 mantenuta); il brief è costruito da dati già esistenti.
- **Misura**: una variante di planner dell'harness "solo prefetch, nessuna chiamata di strumenti" contro l'attuale planner a strumenti su blind5,
  3 run, più token iniettati per domanda. Un set cieco in cui l'agente *non* deve aver bisogno della memoria (turni banali)
  verifica che l'iniezione non distragga.

### 3. Prompt di estrazione: fatti incidentali dentro le richieste, e transizioni
- **Che cosa**: due regole. (a) Una richiesta di aiuto non è un episodio, ma lo sono i fatti personali che porta come contesto ("mi
  fa di nuovo male il ginocchio, quali esercizi…", "da quando convivo con Luca…"): registrarli come fatti o note con evidenza.
  (b) Quando il titolare cambia, smette o sostituisce qualcosa, il verdetto del fatto è `replace` con il vecchio valore come target,
  e una prova o un cambiamento temporaneo viene detto come tale.
- **Da**: Mem0 `ADDITIVE_EXTRACTION_PROMPT` ("Extract Incidental Facts, Not Just Requests", paragrafo sulle transizioni),
  Apache-2.0, quindi la formulazione è riusabile con attribuzione. La regola di Honcho per cui rispondere a una proposta o accettarla conta come
  affermarne i dettagli (AGPL-3.0, riusabile con nota) completa (a) per le proposte dell'assistente.
- **Perché per noi**: i fatti sono lo stadio più debole (attuale 0,62–0,77, storia 0,38–0,54 su blind5). Gli errori indicati in
  `RESULTS.md` sono esattamente questi: stipendio, ginocchio, "vive con", la città di un parente. I cambiamenti impliciti stanno a 0,67 per ogni
  sistema. Il nostro prompt dice "Help requests … are NOT episodes", e il modello può leggerlo come "ignora il messaggio".
- **Dove si inserisce**: `extraction.prompt.ts` (candidato extract.v7), nessun cambio di schema.
- **Costo**: 0 chiamate extra, qualche centinaio di token di prompt (in cache).
- **Misura**: punteggi di fatti e note di `extraction_eval.py` + blind5 3 run (appaiate). Tenere solo se i fatti migliorano senza
  regressione nelle risposte. extract.v5 mostra che "più memorizzato" può nuocere, quindi controllare anche il tasso di non supportati.

### 4. Turn taint dagli strumenti di rete
- **Che cosa**: quando un turno contiene un risultato di strumento dalla rete (ricerca web, fetch, browser), il testo dell'assistente
  successivo in quel turno viene marcato come derivato da strumento. Gli elementi estratti da esso possono essere episodi `assistant_stated` ("l'assistente
  ha trovato gli orari dell'autobus") ma mai fatti o note del titolare, e non sono "l'ha detto il titolare".
- **Da**: OpenClaw "Content origin also propagates within a turn" (`memory-architecture.md`).
- **Perché per noi**: la guardia v2 conta già l'output di strumenti non-memoria come fonte per il caso dell'eco. Il poisoning è la categoria
  in cui ogni sistema fallisce (blind5 0,17–0,33 prima della separazione dei claim), e i client agentici (Hermes, Claude Code) fanno largo uso di
  strumenti, quindi una pagina web che dice "l'utente è allergico a…" è un canale realistico.
- **Dove si inserisce**: ingestione (i messaggi di strumento hanno già `authorRole tool`); una regola nello scrittore: un elemento la cui unica evidenza
  è testo dell'assistente dopo un risultato di strumento riceve origine `assistant_stated` e nessun verdetto su fatti o note.
- **Costo**: 0 chiamate LLM.
- **Misura**: un piccolo dev set di poisoning-via-strumento (non cieco) più un nuovo set cieco di poisoning già pianificato in
  `RESULTS.md`; regressione su blind5.

### 5. Una passata notturna sui "pattern" per le note: induzione con conteggi di evidenza
- **Che cosa**: una volta per memoria per notte con nuovi episodi (lo stesso gate della revisione dei fatti), proporre **note inferite**
  (abitudini, persone ricorrenti, attività sospese, preferenze mostrate dal comportamento) solo quando supportate da ≥ 2 episodi.
  Ogni nota porta gli id degli episodi, `stance: inferred` e una confidenza ricavata dal conteggio delle evidenze (2 = bassa, 3–4 = media,
  5+ = alta). Le nuove note inferite restano `pending` finché il titolare non le conferma, come già richiede il rifiuto 6 di `ENGINE_IDEAS`.
- **Da**: Honcho `InductionSpecialist` (`src/dreamer/specialists.py`, AGPL-3.0); Graphiti "never manufacture pattern
  language from a single occurrence" (già adottato per i digest); LangMem "persistent (frequently reinforced)".
- **Perché per noi**: le note ottengono 0,64–0,79 e gli errori indicati sono per natura trasversali alle sessioni ("colleghi di lavoro, un'abitudine
  in pausa"): una singola finestra non li vede, ma una vista notturna di 30 giorni sì. La revisione dei fatti è lo stesso pattern
  per i fatti (una chiamata per memoria per notte, verdetti applicati dal codice). Alimenta anche H9 (compagno: "tre mesi fa
  dicesti…") e H12 (pensiero a riposo).
- **Dove si inserisce**: consolidamento M5, accanto a `facts-review.service.ts`; output = verdetti sulle note con evidenza di episodi
  validata nel codice (id inventati scartati, come fa Honcho).
- **Costo**: ≤ 1 chiamata per memoria-notte con novità; dietro un parametro del profilo di qualità (D35), spento finché non misurato.
- **Misura**: punteggio delle note (`extraction_eval.py`) e quota di note inferite giudicate non supportate; risposte blind5
  su domande di preferenze / abitudini.

### 6. Scheda del titolare con regola di stabilità e istruzioni esplicite
- **Che cosa**: una **scheda del titolare** derivata e limitata (≤ 40 righe) costruita dai fatti correnti e dalle note dichiarate. Usa prefissi
  tipizzati (identità, attributo, relazione, istruzione per l'assistente), prende solo valori stabili per circa sei
  mesi e scrive le istruzioni solo quando il titolare le ha dette esplicitamente. Le preferenze sono scritte come direttive
  ("Prefers…", "Never…") con la loro data di osservazione. La scheda è il nucleo del brief di prefetch (idea 2).
- **Da**: Honcho `PEER_CARD_SYSTEM_SECTION` (AGPL-3.0); contratto delle direttive di `USER.md` di OpenClaw (che cita PrefEval);
  profilo statico e dinamico di Supermemory.
- **Perché per noi**: oggi un client ottiene il titolare solo interrogando; non esiste un compatto "chi è questa persona". La forma
  a direttiva affronta l'aderenza alle preferenze, che la nostra valutazione non misura ancora. La regola dei sei mesi tiene gli stati
  volatili (umore, viaggio in corso) fuori dalla parte sempre attiva.
- **Dove si inserisce**: artefatto derivato (D29: id delle fonti, pubblico = intersezione), ricostruito di notte solo quando i suoi input
  sono cambiati (fingerprint, come fanno i digest), quindi nessuna chiamata LLM se nulla è cambiato. Prima rendering deterministico; una
  riscrittura LLM solo se misurata migliore.
- **Costo**: 0 chiamate (deterministico) oppure ≤ 1 per memoria-notte con cambiamenti.
- **Misura**: un piccolo set di sonde di aderenza alle preferenze (l'agente deve applicare una preferenza dichiarata senza che gli venga chiesto)
  e la dimensione in token del brief.

### 7. Segnali d'uso per il ranking e per il brief, mai per la verità
- **Che cosa**: usare `recall_log` (già nel modello dati) come segnale: gli elementi serviti spesso e per query varie salgono
  nel brief e nei pareggi di `latest` / `search`. Gli elementi non toccati per mesi restano memorizzati ma escono dal brief
  ("background", come fa ChatGPT). Opzionalmente, esporre il feedback dell'host ("questo ricordo era sbagliato / utile") tramite uno strumento.
- **Da**: ranking deep di OpenClaw (frequenza 0,24, diversità delle query 0,15); automatic memory management di ChatGPT
  (recenza + frequenza, override dell'utente); trust score `fact_feedback` di Hermes holographic.
- **Perché per noi**: il brief ha bisogno di una regola di selezione diversa da "il più importante", e i digest hanno mostrato che più contesto non
  è meglio (diario nel recall: −1,9 pt, entro il rumore).
- **Dove si inserisce**: solo ranking; non cambia mai stato, sostituzione o confidenza (un fatto sbagliato richiamato spesso non deve
  diventare più vero).
- **Costo**: 0 chiamate LLM.
- **Misura**: richiede traffico longitudinale. Simularlo con il flusso di domande della valutazione, oppure rimandare finché non esiste l'uso di Arkimede
  (domanda aperta).

### 8. Richieste all'assistente come intenti permanenti (memoria prospettica)
- **Che cosa**: alcuni messaggi sono istruzioni per dopo, non ricordi: "la prossima volta che parliamo della casa ricordami
  il notaio", "quando scrive Marco, digli…", "ricordati di chiedermi dell'esame". Memorizzarli come **intenti** con
  parole chiave trigger, un embedding opzionale, ambito (persona, conversazione), scadenza, un budget di attivazioni e un periodo di raffreddamento. Vengono
  confrontati in modo deterministico al prefetch e scattano come nota nascosta per l'agente. Quelli basati sul tempo vanno allo
  scheduler dell'host.
- **Da**: intenti permanenti di OpenClaw (`docs/concepts/standing-intents.md`; TriggerBench arXiv:2606.23459 come citato
  lì).
- **Perché per noi**: la categoria dei "messaggi rivolti all'assistente" (0,25 → 0,62) e l'iniziativa L1 della visione richiedono entrambe
  un elenco esplicito delle richieste fatte all'assistente. `RESULTS.md` indica già "an explicit list of requests
  made to the assistant" come lavoro di progetto necessario. I piani riguardano ciò che il titolare vive; gli intenti ciò che
  l'assistente deve fare, il che mantiene pulito il ciclo di vita dei piani.
- **Dove si inserisce**: un nuovo tipo di output di estrazione (o uno strumento `remember` / `intent`), una tabella con ciclo di vita nel codice
  (pending → armed → fired → done / cancelled / expired), prefetch (idea 2).
- **Costo**: 0 chiamate extra (stessa chiamata di estrazione); confronto senza LLM.
- **Misura**: fetta blind6 dei messaggi rivolti all'assistente (non più cieca; usarne una nuova) e un dev set di attivazione degli intenti.

### 9. Superficie di revisione per il titolare di ciò che la notte ha cambiato
- **Che cosa**: un breve digest "che cosa ho imparato / cambiato" per notte (fatti sostituiti, note inferite, piani chiusi),
  con conferma o rifiuto con un tocco. I rifiuti diventano correzioni.
- **Da**: `DREAMS.md` e Dreams UI di OpenClaw; `write_approval` e `/journey` di Hermes; interfaccia di gestione della memoria di ChatGPT.
- **Perché per noi**: le note inferite (idea 5) e i cambiamenti della revisione dei fatti sono esattamente gli elementi che le regole di consenso vogliono che un titolare
  veda. L'API del diario (D18) e l'atlas (5b) esistono già come superfici.
- **Dove si inserisce**: API di lettura + scheda diario di Arkimede; dati da `extraction_runs` / `run_outputs` (già il changelog).
- **Costo**: 0 chiamate LLM.
- **Misura**: metrica di prodotto (tassi di conferma / rifiuto), non la valutazione.

### 10. Hook di pre-compattazione e di cambio sessione nei connettori
- **Che cosa**: il connettore Hermes implementa `on_pre_compress` e `on_session_switch` così i turni vengono ingeriti grezzi
  *prima* che l'host li comprima o li tronchi. Può anche restituire l'elenco di episodi di Recordare per quell'intervallo, per
  migliorare il riassunto dell'host.
- **Da**: `on_pre_compress` di Hermes; memory flush di OpenClaw; trigger `compaction-event` di Letta.
- **Perché per noi**: la compattazione è il punto in cui le trascrizioni dell'host perdono dettaglio. Se il connettore sincronizza dopo la compattazione, il nostro log grezzo
  (Livello 0, l'àncora di provenienza) riceve un riassunto invece dei messaggi.
- **Dove si inserisce**: solo codice del connettore (6.6); l'ingestione è idempotente per id di messaggio.
- **Costo**: 0.
- **Misura**: test di integrazione del connettore (una sessione lunga compattata deve comunque produrre i suoi episodi).

## 4. Idee che non dovremmo adottare

- **File di memoria limitati scritti dall'agente come archivio** (`MEMORY.md` / `USER.md` di Hermes, auto memory di Claude Code, blocchi core
  di Letta). Gli errori di capacità forzano riscritture con perdita, la sostituzione per sottostringa distrugge la storia e non c'è tempo dell'evento
  né evidenza. Vanno bene come blocco appunti *del client*; Recordare vi si rispecchia (Hermes `on_memory_write`) solo
  come input `assistant_stated`, mai come fatti del titolare.
- **Cancellare le osservazioni obsolete** (deduzione di Honcho "DELETE the outdated observation immediately"; Letta "fix the
  stale entry at the source"). Entra in conflitto con append-only + `corrects` / `supersedes` (D28, D29) e con
  "perché il twin crede X".
- **"When in doubt, extract"** (Mem0). Abbiamo misurato che più claim memorizzati nuocciono (extract.v5 scartato due volte:
  72,7 % vs 81,8 % sulle fette). Il nostro tasso di non supportati (4–13 %) è la metrica che conta.
- **Implicazioni logiche come ricordi memorizzati** (Honcho: "works at Google" → "employed in tech"). È rumore per il
  recall e inventa fatti che il titolare non ha mai dichiarato. L'inferenza resta al momento della risposta.
- **LLM in lettura sul percorso di default** (dialectic di Honcho, sub-agente di corsia 2 di OpenClaw, generazione di query di LangMem).
  Rompe D12 / "nessun LLM al recall" e aggiunge latenza. Una *risposta sintetizzata* resta un extra opzionale per i client
  semplici (`ENGINE_IDEAS` voce 3 di OpenHuman). Una corsia di escalation sta nell'agente host (chiama i nostri strumenti), non in
  Recordare.
- **Decadimento esponenziale della recenza come ranking di default** (emivita di 30 giorni di OpenClaw). È sbagliato per una memoria di vita ("quando
  ho… la prima volta", modalità legacy); abbiamo modalità esplicite `latest` / periodo. Accettabile solo dentro la selezione del brief
  (idea 7).
- **La frequenza di recall come promozione a verità** (gate deep di OpenClaw). L'uso misura l'utilità, non la correttezza; per un
  twin un fatto sbagliato richiamato spesso deve restare sbagliato. Usarla solo per il ranking (idea 7).
- **Skill / memoria procedurale e ottimizzazione dei prompt** (skill di Hermes, skill di Letta, optimizer di LangMem). È
  compito dell'agente host, non della memoria della persona. Il pilastro "Mind" del twin (pattern decisionali) verrà dopo e da dati
  del titolare, non dalle traiettorie dell'agente.
- **L'"attualità solo al retrieval" di Mem0 v3**. Le nostre catene di valori con stato esplicito sono misurate meglio per
  "stato attuale" e correzioni (categorie blind4 / 5); il solo ranking lasciava visibili i vecchi valori (correzioni di rumore blind3
  prima di extract.v4).
- **Rappresentazioni separate per observer ovunque** (Honcho). Il modello è giusto per la disclosure del twin (H2:
  "che cosa Marco sa del titolare") ma prematuro ora; i nostri audience set (D29) registrano già chi era presente.
  Da riprendere nella fase 3.
- **La scansione dei contenuti come difesa principale dal poisoning** (scansione delle iniezioni di Hermes). Aiuta come filtro economico, ma il
  ragionamento stesso di OpenClaw (e il nostro: a risolvere il poisoning è stata la separazione dei claim, non il rilevamento) favorisce la provenienza. Possibile come ulteriore
  gate economico su `remember` / `log_episode`.

## 5. Domande aperte

1. **Prefetch vs strumenti**: con i connettori che iniettano un brief, i modelli che rispondono chiamano ancora `search_episodes` quando
   ne hanno bisogno? OpenClaw fa escalation nell'host; il nostro harness lascia sempre che il planner chiami gli strumenti. Serve una variante di planner
   che imiti un host pigro (idea 2).
2. **Budget e variazione del brief**: quanti token può occupare il brief prima di distrarre (diario nel recall: nessun guadagno)?
   E quanto spesso può cambiare senza rompere le prefix cache degli host (Hermes lo congela per sessione)?
3. **Convenzione di recinzione**: recinzione in stile XML (Hermes), intervalli di metadati nel payload di ingestione, o entrambi? Lo decidono gli host che persistono
   il prompt di sistema iniettato nella propria trascrizione (OpenClaw no, Hermes lo toglie).
4. **Intenti vs piani**: una tabella con un `kind`, o un archivio separato? Il codice del ciclo di vita differisce (budget di attivazioni,
   raffreddamento) ma le regole di evidenza e di patch sono le stesse.
5. **Scheda del titolare vs note**: la scheda è una vista su fatti e note (deterministica) o un artefatto curato a sé con
   una passata LLM notturna? Misurare prima la vista deterministica.
6. **Segnali d'uso senza traffico**: l'idea 7 richiede veri log di recall. Il periodo di dogfooding con Arkimede basta, oppure
   simuliamo il traffico di recall nella valutazione?
7. **Ricontrollare le fonti secondarie** prima di citare all'esterno: ChatGPT (403 sul centro assistenza), Supermemory e Zep
   (solo riassunti da fetch).
