# Piano di lavoro

*Traduzione italiana di [WORK_PLAN.md](WORK_PLAN.md) — la versione inglese è quella di riferimento.*

Stato: **2026-10-08** — fase 1 implementata fino a M5 (alcune righe parziali), M4b completata tranne la
matrice dei provider, M5b quasi completa, M6 quasi completa (Arkimede integrato con il Diario, connettori 6.6 fatti), M7:
**i criteri della v0.1.0 sono soddisfatti e la v0.1.0 è pubblica** (2026-10-08; il profilo pubblico resta rinviato, D33).
Ogni milestone qui sotto ha una riga di stato; le righe indicano **done / partial / TODO**.
Copre la fase 1 della roadmap (memoria episodica, `EPISODIC_MEMORY_TODO.md`) dalla decisione sul motore a una prima integrazione con Arkimede.
Le fasi successive della roadmap (`DIGITAL_TWIN_VISION.md` → Roadmap) sono elencate in fondo e avranno
un proprio piano quando la fase 1 sarà conclusa.

## Vincoli guida

- **Neutrale rispetto al client**: Recordare serve qualsiasi piattaforma agentica. Arkimede è il primo client,
  non un caso speciale — nessun campo, endpoint o assunzione specifici di Arkimede nei
  contratti. Ogni funzionalità deve funzionare attraverso i contratti pubblici (ingest REST, MCP, SDK).
- **Due livelli di integrazione** (vision → Architecture): *basic* = solo strumenti MCP (Claude
  Desktop / Code, Cursor, …); *full* = MCP + ingest REST + SDK. Entrambi sono testati.
- **Qualsiasi provider LLM / di embedding** (D27): DeepSeek e Ollama locale sono solo i nostri ambienti di test;
  le differenze tra provider stanno nei profili di configurazione, prompt e schemi sono indipendenti dal provider.
- **Motore dietro una porta**: il motore di memoria (build D / Memobase / ibrido) sta dietro un'interfaccia
  interna, così i contratti e lo scheletro del servizio non dipendono da D23.
- **Valutare, non presumere**: il dataset dello spike diventa un harness di regressione che gira
  contro il servizio attraverso la sua API pubblica.
- **Lezioni dallo spike**: ogni chiamata LLM disattiva il ragionamento o dimensiona `max_tokens` di
  conseguenza; l'output strutturato è validato e ritentato; i prompt esistono in IT e EN.
- Stack: TypeScript / NestJS, Postgres, BullMQ + Redis (stessa famiglia di Arkimede: NestJS 10,
  TypeORM, BullMQ, zod).

## Milestone

M0 e M1 possono procedere in parallelo: i contratti non dipendono dalla scelta del motore.

### M0 — Chiudere la decisione sul motore (spike) → D23

**Completata il 2026-10-02** (`spikes/memory-eval/RESULTS.md`, round 2): D 96% sotto rumore contro Memobase
88%, Graphiti 81%, baseline 67%; `qwen3:8b` locale: D 73% contro Memobase 65%. D23 approvata: costruire
D (`EPISODIC_MEMORY_TODO.md`); `deepseek-flash` = stessa qualità di `v4-pro` → nostro default di test (qualsiasi provider, D27). Dataset held-out (cieco ai prompt di D): D 86% contro Memobase 61%
sotto rumore. Idee da prendere in prestito / scartare e principi di costo: `ENGINE_IDEAS.md`. Resta aperta: la
rassegna dei modelli locali.

| # | Compito | Output |
|---|---|---|
| 0.1 | Rieseguire Memobase con embedding `bge-m3` (via `embed_server.py`), base + rumore. Graphiti una sola volta, solo per completezza: il suo modello di sostituzione dei fatti fallisce strutturalmente su "quante volte" / "l'ultima volta", gli embedding non lo risolveranno — la vera sfida è Memobase contro D | `RESULTS.md` aggiornato |
| 0.2 | Prototipare D nello spike: prompt di estrazione degli episodi (bi-temporale, piani, emozioni), digest giornalieri, filtro per intervallo di date (espansione della query consapevole del tempo), vettoriale `bge-m3` + BM25 con fusione ottimizzata | `systems/d_sys.py`, punteggi base + rumore |
| 0.3 | Esecuzione con modello locale (Ollama, es. qwen3, thinking disattivato) per C e D | Scenario sovrano/locale verificato o escluso |
| 0.4 | Estendere il dataset con domande per cui D è progettato e che gli altri sbagliano: "questa settimana", "quante volte", piani annullati | Valutazione più discriminante |
| 0.5 | Registrare **D23** in `EPISODIC_MEMORY_TODO.md` | Decisione |

Regola di decisione (proposta): se D è entro ~5 punti da Memobase sotto rumore, costruire D (stack
nativo, filtro per date, digest, piani, provenienza, disclosure in seguito); altrimenti adottare Memobase
dietro la porta del motore (ibrido) e riesaminare dopo M4.

### M0.5 — Igiene della valutazione prima di costruire (2026-10-02)

**Completata**: audit del gold applicato, giudice validato e riscritto (falsi accetti 0 %, falsi rifiuti
≤ 3 %), ingestione as-of nel runner; D 100 % / baseline 66–83 % sui set base
(`spikes/memory-eval/RESULTS.md` → Harness v1.1).

| # | Compito |
|---|---|
| 0.5.1 | Audit del gold di `dataset/` e `dataset_holdout/` da parte di un secondo lettore (date, giorni della settimana, cambio d'anno, chi è chi) — correzioni registrate in `spikes/memory-eval/GOLD_AUDIT.md` |
| 0.5.2 | Validazione del giudice: per ogni domanda, risposte vaghe / specifiche ma sbagliate / corrette con extra / parafrasi corrette; misurare i tassi di falso accetto e falso rifiuto del giudice; correggere il prompt del giudice (regole per tipo) finché entrambi sono bassi |

Il resto dell'upgrade della valutazione (N ≥ 3 esecuzioni + test appaiati, controlli e baseline, esiti corretto /
allucinato / omesso, valutazione dell'estrazione per stadio, nuovi tipi di probe, colonne di costo)
confluisce in M3/M4 come suite di regressione del servizio (`literature/README.md` → Evaluation).

### M1 — Contratti (indipendenti dal motore)

**Bozza completata il 2026-10-03, revisione 2 dopo una revisione di coerenza** (branch `m1-contracts`): `docs/API.md` (identità, auth, ingest, strumenti MCP,
API di lettura, SDK) e `docs/DATA_MODEL.md` (modello dati v1 con D28–D30). OpenAPI è generato dagli
schemi zod in M2 invece di essere scritto a mano.
Stato (2026-10-07): 1.1–1.5 completate come documenti e realizzate in M2–M4 (parti del profilo pubblico rinviate, D33); l'API di lettura
di 1.4 **non è realizzata** (vedi 4.7); 1.6 scheletro SDK e OpenAPI generato **non realizzati** (→ 6.7).
Stato (2026-10-08): 1.4 **partial** — la parte dell'API di lettura che serve al diario è realizzata (4.7), dimenticare un
periodo e il resto della §4 sono TODO; 1.6 **done** come libreria client (`packages/client`, 6.7; pubblicata su npm come
`@arkimedehq/recordare-client` 0.1.0); l'OpenAPI generato **non è ancora realizzato**.

| # | Compito | Output |
|---|---|---|
| 1.1 | **Modello di identità**: `client` (piattaforma, chiave API) → `external identity` (client + id utente esterno) → `person` (una memoria per persona). Flusso di collegamento per la stessa persona tra client diversi | `docs/API.md` § Identity |
| 1.2 | **Ingest REST**: `POST api/v1/ingest/messages` (batch). Per messaggio: id di conversazione esterno, id di messaggio esterno, ruolo, autore, contenuto, `sentAt`, canale, identità opzionale dell'interlocutore. Idempotente su (client, conversazione, messaggio); endpoint di modifica e cancellazione | `docs/API.md` § Ingest + OpenAPI |
| 1.3 | **Strumenti MCP**: `log_episode`, `search_episodes` (D11/D12) — schemi JSON validi con tutti i provider LLM (nessuna parola chiave non supportata, parametri piatti) | `docs/API.md` § MCP |
| 1.3b | **Modello dati v1** con i campi di D28 + D29 + D30 (stati dei piani incl. `unresolved` e patch tipizzate, tipi, fatti bi-temporali con `unknown_current`, `corrects` / `supersedes`, `derivedFrom` / `needsRecheck`, `origin` incl. `assistant_stated`, `disclosure` + insieme di destinatari, id delle sorgenti, id dei messaggi di evidenza) | `docs/DATA_MODEL.md` |
| 1.4 | **API di lettura** per le UI host (timeline / diario, modifica, cancellazione, "dimentica periodo" — D16/D18) | `docs/API.md` § Timeline |
| 1.5 | Trasporto MCP + auth: HTTP streamable, chiave bearer legata a una persona (il livello basic non ha ingest, quindi la chiave è l'identità) | Decisione D24 |
| 1.6 | Forma dell'SDK: client TS sottile `@arkimedehq/recordare-client` (ingest, timeline, errori tipizzati) | Scheletro del pacchetto |

### M2 — Scheletro del servizio

**Completata il 2026-10-03** (branch `m2-scaffold`): NestJS 12 + TypeScript 6 strict (build con tsc, SWC per sviluppo e
test — la CLI di Nest 12 non gira su Node 20), validazione dell'env, health, migrazione iniziale del modello
dati v1 (profilo privato / di ricerca), `LlmPort` indipendente dal provider con adattatori compatibili OpenAI e Anthropic
nativo e profili (verificati dal vivo su DeepSeek e Ollama con `npm run smoke:llm`),
porte per embedding e clock, auth v1 (chiavi API dei client, token personali, API admin, risoluzione del proprietario),
docker-compose, CI, Dockerfile. Spostati dove vengono usati per la prima volta: `QueuePort` (job idle BullMQ) →
M3, `VectorStorePort` e file di prompt IT/EN → M4.
Stato (2026-10-07): completata tranne 2.3 `VectorStorePort` (**TODO** — l'SQL pgvector è inline nei servizi) e 2.6 i18n
(**partial** — i prompt sono in inglese con una riga sulla lingua del proprietario; il risolutore di periodi e le parole di relazione sono IT/EN).
Stato (2026-10-08): 2.6 ancora **partial**, con il modulo delle lingue (regola del proprietario: tutte le lingue, almeno
le più usate): `service/src/lang` contiene periodi e nomi dei mesi da Intl per 25 lingue, parole di relazione e nome del
proprietario per molte lingue (le scritture senza spazi si confrontano come sottostringhe), usati dal risolutore di
periodi, dal riconoscimento delle persone e dal nome del proprietario; i prompt restano in inglese con una riga sulla
lingua del proprietario; la console admin è IT/EN.

| # | Compito |
|---|---|
| 2.1 | Progetto NestJS, TS strict, lint, `tsc --noEmit`, test runner; CI a ogni push |
| 2.2 | Postgres + migrazioni (TypeORM); pgvector con indice HNSW (**D25**) |
| 2.3 | Porte e adattatori: `LlmPort` (adattatori compatibili OpenAI + Anthropic nativo, profili provider dalla configurazione — ragionamento disattivato, modalità di output strutturato, parametro dei token, caching, usage — validazione + retry; D27), `EmbeddingPort` (compatibile OpenAI, default `bge-m3`), `VectorStorePort` (adattatore pgvector; Qdrant sarebbe solo un altro adattatore), `ClockPort`, `QueuePort` (BullMQ) |
| 2.4 | Auth (profilo v1 privato / di ricerca, D33): chiavi API dei client con hash, token personali, bootstrap dell'admin, tabelle person / identity |
| 2.5 | `docker-compose.yml` (servizio, Postgres, Redis), endpoint health, configurazione via env |
| 2.6 | Impalcatura i18n per prompt e messaggi (IT/EN) |

### M3 — Livello 0: log grezzo

**Completata il 2026-10-03** (branch `m3-raw-log`): ingest REST (idempotente, vincolato al consenso, conflitti / modifiche
upsert, partecipanti solo verificati), modifiche e purghe, BullMQ (job di estrazione idle con debounce —
il runner è un segnaposto fino a M4 — e embedding dei messaggi in background), ricerca nel log grezzo (full-text +
vettoriale), endpoint MCP con contesto del visualizzatore risolto lato server e `search_episodes` (solo grezzo), sistema
di valutazione S via REST + MCP: **90 % / 71 %** sui set base (baseline dello spike 83 % / 66 %).

| # | Compito |
|---|---|
| 3.1 | Endpoint di ingest → log grezzo dei messaggi (testuale, provenienza, idempotenza, modifica/cancellazione) |
| 3.2 | Ricerca nel log grezzo (FTS + vettoriale, fusione ottimizzata) — è anche il fallback D13 |
| 3.3 | Server MCP con `search_episodes` che restituisce solo risultati del log grezzo (primo incremento utilizzabile) |
| 3.4 | **Eval harness v1**: dataset dello spike ingerito tramite l'API REST, domande poste tramite MCP, valutate dallo stesso giudice — numero di baseline per il servizio |

### M4 — Livello 1: episodi (codifica + richiamo)

**Nucleo completato il 2026-10-03** (branch `m4-engine`): motore (una chiamata di estrazione per finestra, regole
di ciclo di vita lato codice, risolutore di quasi-duplicati / correzioni), note (D34), strumenti di richiamo (`search_episodes`
con `latest`, `search_memory` con as-of, `resolve_period`, scritture esplicite e dimenticanza).
Servizio v1: 100 % / 89–96 % sui set base, **96,4 % sul set held-out con rumore**
(`spikes/memory-eval/RESULTS.md`). Ancora aperte: 4.4b (nuovo set cieco — quello held-out non è più
cieco per il prompt del motore), 4.5b (matrice dei provider), 4.5c (categorie H1), 4.6 (N ≥ 3 esecuzioni,
controlli, valutazione dell'estrazione per stadio) — passano in M4b insieme all'upgrade della valutazione M3/M4.
Stato (2026-10-07): completata tranne 4.1 (sweep notturno dei messaggi in attesa TODO), 4.4c (TODO) e 4.5b (partial); 4.7–4.8 TODO.
Stato (2026-10-08): completata tranne 4.1 (partial: sweep notturno dei messaggi in attesa TODO), 4.3 (partial: il feed dei
cambiamenti delle note è registrato in `note_changes` ma non ha ancora un endpoint), 4.4c (TODO), 4.5b (partial), 4.5c
(partial) e 4.7 (partial: la parte per il diario è realizzata); 4.4b e 4.6 completate in M4b; 4.8, 4.9, 4.11 done; 4.10
e 4.12 TODO.

| # | Compito |
|---|---|
| 4.1 | Debounce idle per conversazione (D1/D5) + cursore lato servizio (D22) + sweep notturno — **partial**: lo sweep notturno dei messaggi in attesa (non estratti) è TODO (lo sweep orario si limita a consolidare) |
| 4.2 | Estrazione degli episodi (D2, D9, D10, D21): bi-temporale, `datePrecision`, piani con `validUntil` / `invalidatedAt`, valenza / sentimenti / opinione, `people`, provenienza fino al messaggio grezzo |
| 4.3 | `log_episode` (cattura esplicita, importanza massima); note semantiche (D34): estrazione nella stessa chiamata, tabelle `notes`, `remember` / `search_memory`, feed dei cambiamenti delle note — **partial**: tutto realizzato tranne l'endpoint del feed (`GET api/v1/notes/changes`, con la 4.7; i cambiamenti sono già registrati in `note_changes`) |
| 4.4 | `search_episodes` completo: filtro per intervallo di date, `mode: search \| list`, ranking rilevanza + recenza + importanza + boost di accesso (D14), fallback automatico al log grezzo (D13); risolutore deterministico per le espressioni di periodo comuni (questa / scorsa settimana, nomi dei mesi) |
| 4.4b | Suite di valutazione = `dataset/` + `dataset_holdout/` (+ un nuovo set cieco quando i prompt cambiano molto); lacune di `ENGINE_IDEAS.md` coperte (piani riprogrammati, correzioni, modalità `latest`, fatti as-of) — **done** in M4b: set ciechi 3–8 (4b.1, 4.8) |
| 4.4c | Budget di costo per finestra idle e per persona/mese, misurato dalla contabilità per chiamata; la CI fallisce se una modifica porta i token per messaggio oltre il budget — **TODO** (la contabilità esiste, nessun budget / gate in CI) |
| 4.5 | Interruttore per persona `episodicMemoryEnabled` (D4), default off |
| 4.5b | **Matrice dei provider**: suite di valutazione eseguita su DeepSeek, Ollama e almeno uno tra OpenAI / Anthropic / Gemini; CLI `eval --config <profile>`; tabella dei modelli supportati (D27) — **partial**: misurati (DeepSeek, modelli locali Ollama, modelli OpenRouter, claude-cli); nessuna CLI `eval --config`, nessuna tabella formale dei modelli supportati con le licenze dei pesi |
| 4.5c | Categorie di valutazione per H1 (risoluzione dei piani incl. unresolved, trappole di premessa, accumulare vs sostituire, correzione vs cambiamento) con tassi di asserzioni ingiustificate e di astensione eccessiva (`RESEARCH_NOTES.md`) — **partial**: le categorie H1 sono nei set ciechi (4b.1) e hanno un punteggio per categoria; i due tassi non sono riportati <!-- verify: nessun tasso di asserzioni ingiustificate / astensione eccessiva in RESULTS.md --> |
| 4.6 | Eval harness v2: confronto con i punteggi di M0; non deve regredire sotto il prototipo D23 — **done** in M4b (4b.2) |
| 4.7 | API di lettura / timeline (`API.md` §4: episodi, digest, fatti, note, piani, dimenticare un periodo, impostazioni, uso, esportazione); prerequisito della scheda Diario di Arkimede (6.3) — **partial**: **fatto (2026-10-08)** per il diario: episodi (linea del tempo, dettaglio, correzione, oblio), digest, fatti, note (fissa, cancella, conferma / rifiuta), piani; in `packages/client` e nella suite di conformità. Il resto della §4 (inserimento manuale, oblio di un periodo, impostazioni, uso, export, feed delle modifiche) TODO. |
| 4.8 | **Fatto 2026-10-08** — nuovi set ciechi scritti da agenti separati e riletti da un secondo agente: `dataset_blind7` (memoria di persona) **91,3 %** e `dataset_blind8` (memoria di entità) **82,1 %**, 3 run ciascuno su DeepSeek diretto (RESULTS.md). La memoria di entità resta sperimentale: chi parla senza presentarsi e l'attribuzione sono i punti deboli |
| 4.9 | **Done** — postura di `log_episode`: `stated` solo con le parole del proprietario a supporto, `inferred` per una scrittura fatta solo dall'agente (`API.md` §3) |
| 4.10 | **TODO** — **La notizia ricevuta come ricordo** (richiesta del proprietario 2026-10-07): oggi le richieste di aiuto e le informazioni generali non sono episodi (restano nel registro grezzo, che il recall consulta). Registrare "X ha saputo che …" come episodio di bassa importanza solo quando la notizia si collega alla vita della persona — un piano aperto, un luogo o una persona che conosce — oppure quando la persona reagisce ("allora porto l'ombrello"); le curiosità isolate restano nel registro grezzo. Modifica al prompt di estrazione: un piccolo dev set (notizie collegate e non collegate, risposte dell'assistente e output degli strumenti), 1 run prima di decidere (regole di valutazione) |
| 4.11 | **Done** — trovati tramite il Diario (2026-10-08): (1) un piano **confermato prima della sua data** ("il viaggio è per tutta la famiglia" letto come conferma del viaggio del 12 ottobre) — guardia nel codice: una patch `confirm` su un piano la cui data è successiva al messaggio di evidenza non è un esito (va trattata come `amend`); (2) gli episodi dicono "l'owner" invece del nome della persona — l'estrattore deve nominare la persona (o scrivere in terza persona senza la parola "owner"). Misurare entrambi sui dev set **Fatto (2026-10-08)**: guardia sui piani nel writer; "l'owner" sostituito con il nome della persona nel codice al momento di salvare (nominare la persona nel prompt, extract.v9, costava circa 2 punti su blind5 ed è stato scartato) — RESULTS.md. |
| 4.12 | **Fatto 2026-10-08** (riassunto, solo conteggi — conservare il testo è stato scartato: l'oblio deve restare completo; una risposta vuota del modello appare come `returned` tutto a zero) — **Conservare l'output delle estrazioni vuote** (emerso l'8/10/2026 registrando l'animazione del README): un'estrazione dal vivo ha fatto la sua chiamata LLM e non ha scritto nulla in 2 prove su 3 in inglese e 1 su 2 in italiano (chat demo brevi e generiche — forse è giusto, forse no); la risposta del modello non viene conservata quando non produce ricordi, quindi non si può verificare. Salvare l'output grezzo (o un riassunto: conteggi, elementi scartati e perché — protezioni, schema) in `extraction_runs` per le esecuzioni che non scrivono nulla, visibile all'amministratore; poi guardare qualche caso reale prima di decidere se c'è un problema |
| 4.13 | **TODO** — **Cancellare un fatto o una nota non lascia tombstone** (emerso l'8/10/2026 aggiornando DATA_MODEL): `DELETE api/v1/facts|notes/{id}` e il rifiuto di uno in sospeso tolgono la riga e le sue evidenze, quindi una nuova estrazione degli stessi messaggi (una modifica, una riesecuzione) potrebbe riscriverlo; gli episodi hanno già i tombstone dell'oblio (D16). Aggiungere lo stesso per fatti e note, con un test |
| 4.14 | **TODO** — **`hnsw.iterative_scan` mai impostato** (emerso l'8/10/2026): DATA_MODEL conta sulle scansioni iterative dell'indice di pgvector per le ricerche vettoriali filtrate (per owner), ma il servizio non le imposta, quindi una ricerca HNSW filtrata può restituire meno righe di quelle chieste su installazioni grandi. Impostarlo per sessione (o per query) e misurare su una memoria grande |

### M4b — Valutazione rigorosa e profili di qualità

| # | Compito |
|---|---|
| 4b.1 | Terzo dataset cieco (agente separato, senza accesso a prompt / risultati): un'altra persona e altri domini, IT + EN, probe H1 (risoluzione dei piani incl. unresolved, trappole di premessa, accumulare vs sostituire, correzione vs cambiamento, anti-trappole, cambiamenti impliciti), generatore di rumore, **annotazioni gold di episodi / piani / fatti / note** per la valutazione per stadio |
| 4b.2 | Harness: N ≥ 3 esecuzioni per configurazione, media ± intervallo di confidenza, confronti appaiati; controlli (nessuna memoria, contesto completo, solo log grezzo); report per categoria; valutazione dell'estrazione per stadio rispetto al gold; colonne di costo (chiamate, token, quota in cache, latenza) |
| 4b.3 | Profili di qualità (D35) come configurazione: economy / balanced / full, misurati sulla suite |
| 4b.4 | Matrice dei provider (D27): DeepSeek, Ollama locale, almeno un altro provider hosted; tabella dei modelli supportati — **partial** (come 4.5b) |
| 4b.5 | Baseline di mercato su `dataset_blind3` (base + rumore, 3 esecuzioni, stesso harness, giudice ed embedding): **Mem0** OSS (la memoria per agenti più usata; ADD/UPDATE/DELETE su stringhe di fatti) e **Cognee** OSS (grafo di conoscenza + vettori). Adattatori sottili in `systems/`, motori sullo stesso LLM (`deepseek-flash`, thinking disattivato); licenze verificate prima dell'uso (eseguiti come dipendenze, nessun codice copiato); riportare accuratezza, costo di estrazione e token iniettati per query accanto al servizio v4, a D e ai controlli (H6) |

Stato (2026-10-03): 4b.1 completata (`dataset_blind3`, sottoposto ad audit); 4b.2 completata (multi-esecuzione + CI, bootstrap appaiato,
controlli, scorer per stadio — validati e corretti). **Base, cieco: servizio 86,0 % (motore Claude 87,5 %), D 92,1 %,
contesto completo 97,2 %, nessuna memoria 8,3 %.** Correzioni dai fallimenti ciechi (affermazioni di terzi attribuite al loro
autore, estratti di chat sempre accanto agli episodi) → servizio 96,2 % a posteriori; un quarto set cieco deve confermarlo.
Rumore: v3 88,0 % (D 94,0 %, contesto completo 95,3 %) — correzioni perse perché la lista di episodi conteneva solo
elementi recenti; **extract.v4** (episodi recenti + correlati) → **rumore 95,4 %, base 94,9 %**, alla pari con D e con
il contesto completo. I fatti sono lo stadio di estrazione più debole (→ M5). Prossimo: modelli locali nella matrice (Qwen3-8B,
MiniCPM4.1-8B; MiniCPM5-2B come modello leggero), profili.
**Set cieco 4 (84 d, nessuno ci ha ottimizzato): servizio v4 80,8 % base / 79,8 % rumore, Mem0 78,0 / 79,3 %, D 88,3 %,
contesto completo 89,9 %** — l'estrazione va bene (recall 0,96–0,99, date ~1,0); il divario è nel richiamo (provenienza, panoramiche
di periodo, correzioni, terzi). Profili: economy 93,5 %, balanced 94,9 %, full 92,1 % su blind3 (entro il rumore;
full costa 3,5× di output). Prossimo: lavoro sul richiamo (H11) a livello di categoria, confermato su un quinto set cieco.
**H11 richiamo, passo 1 (branch `h11-recall`):** blind4 86,9 % (1 esecuzione, guida a livello di categoria), **blind5 89,2 % contro D 91,7 %
e contesto completo 91,4 % — entro il rumore** (3 esecuzioni, set cieco nuovo). Punti deboli aperti per tutti i sistemi: probe di
avvelenamento (incl. un messaggio di gruppo indirizzato all'assistente), cambiamenti impliciti; per il servizio anche piani riprogrammati
e domande cross-lingua.
Motori locali misurati: Qwen3-8B 59,7 %, Qwen3-14B 66,7 %, Qwen3.5-9B 73,6 %, Gemma 4 12B 73,6 %, gpt-oss 20B 83,3 %, Gemma 4 26B non ci sta, MiniCPM escluso dopo i probe. **Regola del proprietario: un modello motore
è supportato solo se ≥ 95 % sulla suite**; i modelli più deboli vengono rimossi, i risultati conservati (RESULTS.md). Dettagli in
`spikes/memory-eval/RESULTS.md` § M4b.
Stato (2026-10-08): 4b.1, 4b.2, 4b.3 (profili in `service/src/engine/quality-profile.ts`, misurati su blind3) e 4b.5
(Mem0 e Cognee su blind3, Mem0 su blind4) completate; 4b.4 partial (come 4.5b). Set ciechi successivi: blind5, blind6 e i
nuovi blind7 / blind8 della 4.8 (91,3 % memoria di persona, 82,1 % memoria di entità).

### M5 — Livello 2: consolidamento

Stato (2026-10-07): 5.1, 5.2 done; 5.3, 5.5 partial; 5.4 TODO; 5.6 realizzata e disattivata; 5.7 un'idea realizzata (extract.v8).
Stato (2026-10-08): 5.1, 5.2 done; 5.3, 5.5 partial; 5.4 TODO; 5.6 realizzata e disattivata; 5.7 partial (lavoro sul contesto di memoria fatto il 2026-10-08)
(extract.v8 e il contesto di memoria prima del turno realizzati; ora i suoi mancati bersagli della 6.6b (8)); 5.8 TODO (idea).

| # | Compito |
|---|---|
| 5.1 | Job notturno per persona con nuovi episodi (zero chiamate LLM se non c'è nulla di nuovo) — **done** |
| 5.2 | Digest giornalieri + roll-up mensile (D8); le domande sui periodi leggono prima i digest — **done**; digest nel richiamo dietro la manopola `recallDigests`, disattivata (misurato −1,9 pt) |
| 5.3 | Deduplicazione dello stesso evento tra conversazioni (collegare, mai riscrivere) — **partial**: risolutore di quasi-duplicati all'estrazione; nessun passaggio di deduplicazione nel consolidamento |
| 5.4 | Promozioni di pattern con `episode_promotions` (D20) — la destinazione dipende da **D26** — **TODO** (tabella creata, inutilizzata) |
| 5.5 | Cancellazione guidata dall'utente: episodio, periodo; digest ricalcolati; vettori rimossi (D16) — **partial**: dimenticare un episodio fatto; TODO: dimenticare un periodo, riesaminare i fatti la cui evidenza è stata dimenticata, eliminare gli episodi rimasti senza evidenza quando si cancella un messaggio |
| 5.6 | **Revisione notturna dei fatti** (2026-10-07) — **realizzata, off**: realizzata (`facts_review.v1`, task `facts`, admin `POST owners/:id/review-facts`), misurata su blind5 — nessun guadagno sui fatti correnti (0,769 ×3), storico +1 fatto in 1/3, ribollire di riformulazioni → manopola `factsReview` off. Il lavoro sui fatti passa al prompt di estrazione |
| 5.7 | **Idee dalla memoria di altre piattaforme** (`docs/literature/agent-platform-memory.md`, 2026-10-07) — **partial**: l'idea del prompt di estrazione è realizzata come extract.v8 (D40), le altre TODO; ciascuna da misurare: memoria iniettata racchiusa tra delimitatori (`<memory-context>`) perché la guardia anti-eco continui a funzionare con i connettori; un blocco di richiamo pre-turno senza LLM per i connettori (scheda del proprietario, fatti correnti, piani imminenti + ≤ 3 corrispondenze); prompt di estrazione per fatti personali detti di passaggio e per le transizioni ("sono passato a / ho smesso" → sostituire; accettare una proposta la afferma, un semplice "ok" no); taint degli strumenti web (il testo dell'assistente dopo un risultato web non diventa mai un fatto del proprietario); un passaggio notturno di pattern che propone note inferite in attesa supportate da ≥ 2 episodi Contesto di memoria prima del turno **costruito** (`POST api/v1/context`, sempre disponibile; decide il client per agente — Arkimede: opzione dell'agente, spenta di default): dev set in modalità agente, 1 run ciascuno — prompt neutro 93,3 → 100 %, prompt dell'agente vocale 90 → 93,3 % con chiamate ai tool da 9 a 5 su 15, nessun danno sulle domande estranee (RESULTS.md); prossimo: un set cieco. **Fatto (2026-10-08)**: i mancati bersagli del contesto di memoria trovati con i connettori (6.6b (8)) — ogni frase del messaggio confrontata anche da sola, così un'istruzione in coda non diluisce la domanda, e un periodo nominato nel messaggio ("sabato scorso") porta gli episodi di quel periodo (tutte le lingue); misurato su blind7, 3 run: 92,4 % contro 92,0 % (parità), corregge i mancati bersagli visti nelle sonde e nei connettori — tenuto, soglie invariate e ora configurabili (RESULTS 5.7). Le altre idee (taint degli strumenti web, passaggio notturno dei pattern) TODO. |
| 5.8 | **TODO — idea da valutare quando sarà accessibile** (richiesta del proprietario 2026-10-08): un **modello di decisioni** (es. Jev di TypeSafe AI, settembre 2026: decisioni tipate con probabilità in 70–500 ms, niente testo; oppure, aperto e locale, un piccolo LLM costretto a una risposta JSON chiusa con decodifica vincolata — es. Spark-X2.5-4B di iFLYTEK, settembre 2026, 4 miliardi di parametri, Ollama / llama.cpp / vLLM; licenza da verificare — misurato per singola decisione, non rispetto alla soglia del 95 % dell'estrazione, che i modelli piccoli hanno mancato con il 60–83 %) Opzioni aperte, locali, compatibili con AGPL (2026-10): **SemIf** (MIT; legge la probabilità di ogni risposta ammessa da un modello aperto da 4 B in un solo passaggio, decisioni definite a ogni richiesta — nessun addestramento; circa 5× più veloce che generare JSON, accuratezza bilanciata dichiarata 0,81), **Kev** (Apache-2.0; adattatori LoRA su Qwen3.5 0,8 / 4 / 9 B che espongono la stessa API di Jev — un solo contratto per Jev in cloud e Kev in locale, scelto dalla configurazione del provider), **jevlike** (MIT; un classificatore addestrato sulle nostre etichette sopra un encoder congelato — adatto al filtro delle finestre, i nostri set di valutazione forniscono le etichette). come giudice veloce ed economico per le decisioni interne del motore — mai per scrivere episodi, note o digest. Candidati: saltare le finestre senza nulla da ricordare (meno chiamate di estrazione), risoluzione dei quasi-duplicati (`resolve`), patch dei piani (avvenuto / annullato / solo dettagli, accanto alle guardie D37 e 4.11), pertinenza del contesto di memoria al posto di una soglia fissa di somiglianza, chi sta parlando in una memoria di entità. Condizioni: un task opzionale del provider (D27: Recordare funziona senza), disponibilità / prezzo / uso locale verificati, misurato sui dev set e sui set ciechi (per primo: il filtro delle finestre, costo e accuratezza rispetto all'LLM) |
| 5.9 | **TODO** — **Memoria semantica: fonti imparate** (D49, richiesta del proprietario 2026-10-08): fonti salvate con i loro passaggi ed embedding, origine e fornitore; l'apprendimento come episodio collegato nei due sensi alla sua fonte; strumento di richiamo per i passaggi (+ passaggio opzionale nel contesto); l'output della ricerca documentale di un client non inviato come chat (al suo posto un riferimento "fonte consultata"). Prima il progetto (modello dati, API, strumento MCP, limiti per profilo, oblio), poi un set di sviluppo con domande a cui si risponde solo dalle fonti, misurato |

**Da tenere d'occhio** (punti deboli visti nei set ciechi, non ancora affrontati): notizie di terzi nelle chat di gruppo (extract.v8),
intenti permanenti per le richieste all'assistente, esito dei piani 0,77 (esecuzione pulita), cambiamenti impliciti 0,67,
domande cross-lingua.
Visti nei nuovi set ciechi della 4.8 (2026-10-08): provenienza 0,4 / 0,8 / 0,7 su blind7; nella memoria di entità, chi parla
senza mai presentarsi (0,0 / 0,33 / 0,0) e l'attribuzione tra persone (blind8).

### M5b — Neural Atlas: dashboard live (dopo M5)

Un "cervello virtuale" 3D che mostra Recordare al lavoro, dal vivo: le regioni sono i componenti (talamo = ingest, ippocampo =
episodi, LLM = chiamate di estrazione, amigdala = importanza / sentimenti, cingolato anteriore = conflitti: duplicati,
correzioni, affermazioni di terzi, neocorteccia = fatti e note, prefrontale = richiamo via MCP), i neuroni sono gli episodi,
le sinapsi i loro collegamenti, e i segnali viaggiano tra le regioni come flussi di dati. La modalità "Sonno" riproduce il consolidamento
M5 (ippocampo → neocorteccia), lo stesso meccanismo che l'architettura prende in prestito dalla memoria umana. Prototipo con dati
simulati: `docs/prototypes/neural-atlas.html` (Three.js + bloom; pubblicato anche come artifact privato).

Stato (2026-10-07): 5b.1, 5b.2, 5b.6, 5b.7, 5b.8 done; 5b.3 partial (niente click-to-read, filtri, replay di un giorno); 5b.4
partial (solo chiave admin); 5b.5 partial (nessun fallback senza WebGL, nessun controllo degli fps); 5b.9 TODO (idea).
Stato (2026-10-08): righe invariate; Recordare Atlas è pubblico insieme a Recordare (v0.1.0), con interfaccia in inglese
(predefinito) e italiano, e ha una modalità di rendering leggera per GPU poco potenti, che non disegna nulla quando la scena
è ferma (5b.5 resta partial: nessun fallback senza WebGL).

| # | Compito |
|---|---|
| 5b.1 | Servizio: flusso di eventi live per gli operatori (`GET api/v1/admin/telemetry/stream`, Server-Sent Events): messaggio ingerito, inizio / fine dell'esecuzione di estrazione, chiamata LLM (task, modello, token, costo), episodio / fatto / nota scritti, quasi-duplicato o correzione, affermazione isolata, richiamo servito, passi di consolidamento. Solo metadati di default — nessun contenuto a meno che il visualizzatore sia il proprietario (D33 / regole di disclosure) |
| 5b.2 | Servizio: snapshot per la mappa iniziale: episodi (tipo, importanza, date, collegamenti: corrects / duplicate_of / piano → evento / persone condivise), fatti e note, per proprietario; layout 2-D / 3-D dagli embedding (es. UMAP / PCA calcolati lato server e messi in cache) |
| 5b.3 | App dashboard — ora il repo `recordare-atlas` (5b.7) (TypeScript, Vite; Three.js o React Three Fiber): il prototipo su dati reali — neuroni posizionati per significato, clic su un neurone per leggere l'episodio con le sue fonti, filtri per periodo / tipo / persona, replay di un giorno a velocità regolabile, contatori di costo da `llm_calls` |
| 5b.4 | Accesso: solo chiave admin o token personale del proprietario; nessuna modalità pubblica; funziona senza contenuto (vista dei soli metadati) per gli schermi condivisi |
| 5b.5 | Prestazioni: migliaia di neuroni a 60 fps (punti istanziati, particelle GPU), fallback elegante senza WebGL |
| 5b.6 | **Rete neurale visibile, solo eventi reali** (richiesta del proprietario 2026-10-07): il cervello mostra una rete vera — neuroni collegati da percorsi visibili di assoni / dendriti dentro e tra le regioni (fasci di fibre) — invece di "meteore" che volano libere. Gli impulsi corrono lungo quei percorsi da una regione all'altra. **Nessuna animazione finta:** ogni impulso è un vero evento di Recordare dal flusso di telemetria (5b.1) che segue il percorso reale di quel dato (messaggio → ingest → estrazione LLM → episodio scritto → collegamenti / risolutore → richiamo …); senza eventi il cervello è quieto. Un "replay" di eventi registrati è ammesso solo se etichettato come tale. **La regola vale per ogni vista** — l'attuale vista del cervello (regioni, neuroni, segnali) così come la vista della rete: nessun movimento decorativo o simulato nel prodotto; il prototipo simulato esiste solo finché non esiste il flusso di telemetria |
| 5b.7 | **`recordare-atlas`: la dashboard come repo a sé** (decisione del proprietario 2026-10-08): parte del progetto Recordare, pubblicata insieme (stessa licenza, AGPL), ma opzionale — Recordare funziona senza (nessun ascoltatore, nessun costo). Il repo contiene l'app del cervello più un piccolo server (custodisce la chiave admin, serve l'app, inoltra le sorgenti); installabile da solo (immagine Docker). Recordare mantiene solo le sue sorgenti: flusso di telemetria, snapshot dell'atlas, totali. Un **contratto di eventi versionato** (`atlas-events v1`) documentato in Recordare permette ai due repo di evolversi separatamente |
| 5b.8 | **Agenti del client sul cervello** (richiesta del proprietario 2026-10-08): mostrare ciò che fa la piattaforma client — agenti invocati, le sue chiamate LLM, strumenti eseguiti — accanto al lavoro di Recordare, per Arkimede e per qualsiasi altro client. Via preferita: il server dell'atlas riceve **tracce OpenTelemetry (OTLP)** con le convenzioni semantiche GenAI (`gen_ai.*`: `invoke_agent`, `chat`, `execute_tool`; modello, token, durate — verificare prima la versione corrente), così qualsiasi piattaforma strumentata si collega senza codice dedicato; un piccolo helper per i client senza OpenTelemetry. Mappatura: pianificazione dell'agente → corteccia prefrontale, l'LLM del client che genera → area di Broca (la comprensione dell'LLM di Recordare = area di Wernicke), strumenti → corteccia motoria, richiamo → il percorso prefrontale → ippocampo esistente. Eventi legati al proprietario tramite le identità di Recordare. **Solo metadati** su questo canale (prompt, risposte, output degli strumenti non viaggiano mai come telemetria: il visualizzatore potrebbe non essere il proprietario, il contenuto sfuggirebbe a dimenticanza e disclosure, e le tracce degli agenti contengono prompt di sistema e dati degli strumenti che non sono memorie); il contenuto delle conversazioni raggiunge Recordare solo tramite ingest, sotto le regole della memoria. Arkimede: strumentare `backend/src/common/llm-usage.util.ts` e i servizi di agent / multi-agent (lavoro nel repo di Arkimede, con l'OK del proprietario) |
| 5b.9 | **Idea — anche Recordare parla OpenTelemetry**: emettere le proprie operazioni come span di memoria GenAI (`search_memory`, `create_memory`, `update_memory`, `delete_memory`; solo metadati) in modo che gli strumenti di osservabilità standard (Grafana / Jaeger / Langfuse) vedano Recordare senza integrazione dedicata, e l'atlas possa leggerli come per qualsiasi client. Solo osservazione: il contenuto della memoria continua a viaggiare sull'ingest (REST / MCP) — la telemetria campiona, raggruppa e scarta, non porta autore né partecipanti, e sfugge alla dimenticanza, quindi non è mai un canale di memoria |

### M6 — Integrazioni (prova della neutralità rispetto al client)

Stato (2026-10-07): 6.1 TODO; **6.2 done** in Arkimede (outbox, identità + naming, strumenti MCP come `recordare_*` senza
`log_episode`, stato del consenso, turni di errore esclusi); 6.3 partial (interruttore nelle Impostazioni fatto; scheda Diario TODO — richiede 4.7);
6.4 partial (test unitari; nessuna esecuzione di regressione registrata); 6.5, 6.6 TODO; 6.7 (libreria client + conformità, Arkimede la usa), 6.8 (memoria di entità, D48) e 6.9 (console admin) done; la divisione dell'interruttore A-MEM di D34 e la copia delle note
Recordare → A-MEM TODO. Prossimi in ordine (decisione del proprietario 2026-10-07: i connettori per ultimi): le idee
della 5.7, la 4.7 API di lettura (poi la scheda Diario, 6.3), la 4.8 nuovo dataset cieco (e un set cieco per la memoria
di entità), la 4.10, poi i connettori 6.6.
Stato (2026-10-08): 6.1, 6.2, 6.3, 6.6, 6.7, 6.8, 6.9 done; 6.6b quasi completa ((5), (6), (10) TODO, (8) fatto con la 5.7); 6.4 partial (test unitari; nessuna esecuzione di regressione registrata); 6.5 TODO; la divisione dell'interruttore A-MEM di D34 e la copia delle note Recordare → A-MEM TODO; Arkimede usa ancora la
copia sincronizzata della libreria client, non il pacchetto npm.
Dell'ordine qui sopra sono fatte la 4.7 (parte del diario), la 6.3, la 4.8 e la 6.6; prossimi: 4.12, 4.10, 4.13, 4.14,
il resto della 6.6b.

| # | Compito | Dove |
|---|---|---|
| 6.1 | **Livello basic**: configurare Claude Code / Claude Desktop come client MCP, eseguire una sessione scriptata, verificare che gli strumenti funzionino | Questo repo (docs + smoke test) — **fatto 2026-10-08** (Claude Code; INTEGRATION §4b, `npm run smoke:mcp`; le scritture dell'agente attendono la conferma della persona; Claude Desktop richiede OAuth o un ponte, non provato) |
| 6.2 | **Livello full di Arkimede**: registrare Recordare nel suo client MCP; ingest non bloccante dei messaggi persistiti (outbox + retry, non fa mai fallire la chat); mappatura delle identità utente Arkimede → persona | `personalAgent`, branch proprio |
| 6.3 | Impostazioni di Arkimede: interruttore `episodicMemoryEnabled` + scheda Diario (D18) tramite l'API timeline di Recordare | `personalAgent` Scheda Diario **fatta (2026-10-08)**: Impostazioni → Diario (linea del tempo con dettaglio, correggi, dimentica; diario; chi sei; piani; da confermare) tramite un proxy nel backend; la chiave di Arkimede richiede lo scope `write`. |
| 6.4 | Checklist di regressione di Arkimede (`EPISODIC_MEMORY_TODO.md` → Regression checklist): A-MEM, `search_conversations`, `search_memory` invariati | `personalAgent` |
| 6.5 | **Ascolto continuo da un dispositivo vocale domestico** (decisione del proprietario 2026-10-07; D45): (1) una sorgente di conversazione `ambient` e una nota di estrazione per essa (parlato trascritto, possibili errori di riconoscimento, non rivolto all'assistente) — una modifica di prompt, misurata; (2) cautela sull'attribuzione: da `ambient`, episodi come al solito ma fatti e note sul proprietario restano **pending** finché il proprietario non li conferma in una chat o a voce all'assistente (un parlante riconosciuto male non deve trasformare la frase di una sorella in un fatto del proprietario); (3) un dev set `ambient` (conversazioni domestiche con più parlanti, errori di riconoscimento, un parlante attribuito male) misurato prima di abilitare la modalità; (4) in seguito, opzionale: un ingest "stanza" che distribuisce una trascrizione alle memorie delle persone presenti (v1: una chiamata di ingest per persona, con gli altri come partecipanti collegati tramite identità). Già disponibili: memoria per persona, partecipanti collegati alle persone tramite le identità dei client, consenso per persona, dimenticanza per periodo | `recordare` |
| 6.6 | **Connettori: Recordare in qualsiasi piattaforma di agenti con una sola installazione** (richiesta del proprietario 2026-10-07). Il solo MCP dà richiamo e scritture esplicite ma nessuna cattura automatica della conversazione; ogni connettore fa entrambe le cose — invia i turni all'ingest dopo ogni risposta e dà all'agente la memoria (strumenti MCP e/o contesto iniettato prima del turno). In ordine: (1) **plugin Claude Code** — server MCP incluso + hook `Stop` / `SessionEnd` che leggono `transcript_path` e ingeriscono i nuovi turni; (2) **memory provider di Hermes Agent** (la sua interfaccia ufficiale dei provider: sincronizzazione per turno, prefetch pre-turno); (3) **plugin memory-slot di OpenClaw**; (4) **proxy di memoria compatibile OpenAI** per i client senza plugin (inoltra al vero provider, ingerisce i turni, opzionalmente aggiunge memoria). Più un comando di onboarding `recordare connect` (crea la persona, un token personale, configura il connettore scelto). Ogni connettore in un proprio piccolo repo o pacchetto, telemetria solo di metadati, regole di consenso invariate | connettori — **fatto 2026-10-08 (livello completo, ognuno provato dal vero)**: plugin Claude Code, Codex (installer di hook + MCP), plugin OpenClaw, memory provider di Hermes Agent, proxy di memoria compatibile OpenAI (provato con AnythingLLM; Open WebUI / LibreChat con lo stesso meccanismo, test unitari) — `connectors/`; Claude Desktop / claude.ai solo basic. Pubblicati con la v0.1.0: plugin Claude Code tramite il marketplace del repository, `@arkimedehq/openclaw-recordare` su npm, immagine `ghcr.io/arkimedehq/recordare-openai-proxy`. Il comando di onboarding `recordare connect` non è realizzato (TODO) |
| 6.6b | **Emerso costruendo i connettori (2026-10-08)** — **fatto 2026-10-08: (1) `POST ingest/conversations/{id}/end`, (2) `TOOLS` in `packages/client` tenuto allineato dalla suite di conformità, (3) `POST api/v1/context {ingest}`, (4) il client viene costruito prima della pubblicazione, (9) i token personali leggono prima che la conversazione sia salvata, (11) chip in console "chiede il consenso"**; ancora TODO: (5) (la coda di ritentativi di OpenClaw è ancora in memoria), (6), (8) → 5.7 (in corso), (10); i connettori hanno tolto i loro aggiramenti (una chiamata prima di un turno, `/end` alla fine, gli strumenti di OpenClaw da `TOOLS`; Hermes, in Python, copia ancora i suoi schemi) — fatto 2026-10-08: (1) una chiamata "conversazione finita" senza messaggi (oggi il segnale deve viaggiare con un messaggio, quindi ogni connettore conserva l'ultimo per reinviarlo e lo perde a un riavvio); (2) pubblicare gli schemi degli strumenti MCP (un file JSON in `packages/client` o `GET api/v1/mcp/tools`) così i connettori che dichiarano gli strumenti in modo statico (OpenClaw) smettono di copiarli a mano; (3) una sola chiamata per "salva questo messaggio e dammi il contesto di memoria" (oggi un connettore deve prima fare l'ingest, poi chiedere il contesto: due andate e ritorno prima di ogni turno); (4) `packages/client/dist` non allineato con `src` — costruirlo in CI / prima della pubblicazione; (5) coda di ritentativi persistente nel plugin OpenClaw (oggi in memoria); (6) prove su canali reali per OpenClaw (più persone, gruppi) e l'approvazione interattiva degli hook di Codex; (7) Claude Desktop / claude.ai restano al livello basic (nessun hook per catturare la conversazione); (8) **il contesto di memoria manca facilmente il bersaglio** (prova di Hermes): "Come si chiama il mio gatto? Rispondi in una frase." → 0 elementi, senza il suffisso → 1, la domanda in inglese → 0, domande su un periodo ("cosa ho fatto sabato scorso?") → 0 — la soglia di similarità sul messaggio grezzo; da misurare con la 5.7 (togliere le istruzioni, interlingua, risolvere i periodi); (9) una lettura che nomina una conversazione non ancora salvata non restituisce nulla, anche con un token personale; (10) `/mcp` risponde solo come flusso di eventi (minore); (11) una persona creata automaticamente da un client parte senza consenso, quindi i primi utenti di una piattaforma non vengono ricordati, in silenzio, finché l'amministratore non lo attiva — avvisare l'amministratore (notifica in console) |
| 6.7 | **Un client, un contratto, una suite di conformità** (decisione del proprietario 2026-10-07): uniformità a livello di contratto, non di meccanismo — Arkimede resta il client nativo lato server (outbox, id stabili, partecipanti, cancellazioni, stato del consenso: meglio degli hook sulla trascrizione, che restano l'opzione migliore solo per le piattaforme che non controlliamo). (1) La libreria client `@arkimedehq/recordare-client` (API.md §5) vive **in questo repo** come pacchetto workspace (`packages/client/`), riusando gli schemi zod del servizio — contratto e client cambiano in un solo commit, una CI, una versione; include ingest a lotti con retry, identità / naming / stato del consenso, la sessione MCP con header utente + conversazione e il formato del contesto iniettato racchiuso tra delimitatori; Arkimede passa a usarla. (2) Le stesse funzionalità per ogni client, Arkimede incluso (es. il richiamo pre-turno con `<memory-context>`, 5.7). (3) Una **suite di conformità** che ogni client supera contro il servizio reale (un turno ingerito una sola volta, le cancellazioni si propagano, nulla viene inviato prima del consenso, il richiamo porta utente + conversazione); Arkimede la supera per primo. I connettori TypeScript vivono in `connectors/` sopra il client; altri linguaggi (Hermes, Python) come pacchetti propri **Fatto (2026-10-07)**: `packages/client` (standard: SDK MCP ufficiale, RFC 9457, Retry-After, contesto di traccia W3C) + suite di conformità nella CI del servizio; Arkimede è passato alla libreria (copia sincronizzata in `backend/src/recordare/client/`, strumenti costruiti da `tools/list` MCP). I wrapper della API di lettura arrivano con la 4.7. | `recordare` + `personalAgent` |
| 6.8 | **Memoria di entità** (D48, decisione del proprietario 2026-10-07): proprietario `kind = entity` per account e dispositivi condivisi (prima l'utente vocale di Arkimede); fatti con la persona a cui si riferiscono; l'identificazione dice solo di chi; guardia named-in-window. **Done sul branch `entity-memory`** (migrazione, admin `kind` / `displayName`, `GET /me` `kind`, `search_memory` `about`, dev set 95,5 % su 1 esecuzione). Lato client (2026-10-07): `PATCH /me {kind}` finché la memoria è vuota, il nome segue l'utente del client (sincronizzazione al rinominare), `GET /me` `atlasUrl` (`ATLAS_URL`); Arkimede: tipo di memoria scelto nelle impostazioni della memoria, avviso di memoria condivisa, sincronizzazione del nome, link all'Atlas per gli admin. TODO: elementi intimi leggibili solo dalla loro persona (identificazione più forte) | `recordare` + `personalAgent` |
| 6.9 | **Console admin** (decisione del proprietario 2026-10-07, dopo il lavoro su Arkimede): una piccola pagina protetta servita da Recordare stesso (`/admin`, chiave admin o password) — persone e client, consenso on / off, kind, nome, profilo di qualità, chiavi e token, avviare un consolidamento. Non in Recordare Atlas: l'atlas resta una vista in sola lettura senza login **Fatto** (2026-10-07): `service/console/` servita su `/admin`, più le letture admin `GET persons` / `GET clients`, `PATCH clients/:id`, `DELETE identities/:id`; ricerca per nome; IT/EN. | `recordare` |

**Altre piattaforme di agenti — possibili client** (riesaminate il 2026-10-04; nessuna ha una memoria temporale / consapevole
della provenienza, il che conferma la scommessa sul servizio standalone). Non è lavoro impegnato: candidati dopo Arkimede, in questo ordine.

| Piattaforma | Cos'è | Memoria oggi | Percorso di integrazione | Priorità |
|---|---|---|---|---|
| OpenHuman (`tinyhumansai/openhuman`, GPL-3.0, ~40k stelle, beta iniziale) | Harness di agenti in Rust (desktop / web / terminale / libreria), 26 provider + locale | Motore intercambiabile dietro TinyMemory (`Recall / Fetch / Store`): CortexDB hosted, Mem0, Supermemory, Cognee… — documenti + RAG, nessun tempo dell'evento, piani o provenienza | Un **adattatore di motore Recordare per TinyMemory** (il loro pannello di selezione del motore) — un solo adattatore raggiunge tutti i loro utenti | Media (dopo M6.2) |
| Open Dots (`Anil-matcha/open-dots`, MIT, prototipo) | Workspace self-hosted per agenti personali (Next.js + FastAPI), personas, azioni soggette ad approvazione | Solo cronologia chat in SQLite; "nessun servizio di memoria durevole" secondo il suo stesso README | Nessun client MCP visto: un piccolo adattatore dal loro lato (ingest REST + richiamo) | Bassa (maturità) |


### M7 — Hardening e rilascio

Stato (2026-10-07): non iniziata (D33). Esiste un Dockerfile; nulla pubblicato.
Stato (2026-10-08): **v0.1.0 rilasciata** — tutti i criteri della v0.1 qui sotto sono soddisfatti; tag `v0.1.0` con le
release su GitHub, `arkimedehq/recordare` e `arkimedehq/recordare-atlas` pubblici, `@arkimedehq/recordare-client` e
`@arkimedehq/openclaw-recordare` su npm, immagine `ghcr.io/arkimedehq/recordare-openai-proxy` su GHCR. Della lista di
hardening: test di isolamento per persona, backup (`deploy/backup.sh`) / aggiornamento, README, API, guida al deployment,
intestazioni AGPL (SPDX), immagini Docker e pubblicazione sono fatti; la rotazione delle chiavi è manuale (nuova chiave,
poi si cancella la vecchia); rate limit, audit delle letture, esportazione dei dati di una persona e cancellazione completa
sono TODO, con il profilo pubblico (D33).

Solo se Recordare si apre a persone che l'operatore non conosce: abilitare il **profilo pubblico**
(`API.md` §0, D33) — login e pagine del proprietario, OAuth 2.1 per i connettori MCP, collegamento e
revoca guidati dal proprietario, audit delle letture, idempotenza persistente, politica di backup / retention del provider — più protezione
di rete davanti (firewall / WAF / rate limit).

- Sicurezza: test di isolamento dei dati per persona, rotazione delle chiavi, rate limit, audit log delle letture
  (il gemello è un segreto di alto valore — principio 5 della vision).
- Backup / ripristino, esportazione dei dati di una persona, cancellazione completa.
- README, `docs/API.md`, guida al deployment, intestazioni AGPL, immagine Docker.
- Pubblicare su `arkimedehq/recordare` — **solo dopo l'OK del proprietario**.


**Prima versione pubblica — v0.1, profilo privato / di ricerca** (richiesta del proprietario 2026-10-08: pubblicare quando una
versione funzionante gira su alcuni client; l'OK finale è del proprietario). Criteri, tutti richiesti:
1. **Client**: Arkimede al livello completo (ingest, richiamo MCP, Diario) — fatto; almeno un client MCP standard al
   livello base (Claude Code o Claude Desktop con un token personale: richiamo, `remember`, `log_episode`) — 6.1, una
   configurazione documentata più uno smoke test scriptato — **fatto 2026-10-08** (Claude Code, `npm run smoke:mcp`).
2. **Installazione**: entrambi i profili provati da capo a fondo su una macchina pulita — co-ospitato (Kinox) fatto,
   standalone (con text-embeddings-inference) **fatto 2026-10-08** su un clone pulito (macOS arm64): installazione,
   ingest → estrazione → richiamo, smoke test MCP, backup e aggiornamento; corretti strada facendo il nome del progetto
   Compose (`RECORDARE_PROJECT`) e la memoria dell'embedder (batch 2048 token).
3. **Qualità**: un nuovo set cieco (4.8) misurato con il motore rilasciato (3 run, numeri in RESULTS.md); CI verde —
   **fatto 2026-10-08** (blind7 91,3 %, blind8 82,1 %).
4. **Igiene**: nessun segreto nella storia dei repository; intestazioni AGPL; `THIRD_PARTY_NOTICES.md` e licenze delle
   dipendenze verificate; test di isolamento per persona; i limiti del profilo privato dichiarati chiaramente (operatore
   fidato, non per sconosciuti — D33) — **fatto 2026-10-08**.
5. **Documentazione**: README e ogni documento del progetto in inglese e italiano (fatto), INTEGRATION, DEPLOYMENT, KNOBS,
   un CHANGELOG; tag di versione `v0.1.0` — **fatto 2026-10-08**.
5b. **Rilasciata 2026-10-08**: tag `v0.1.0`, entrambi i repository pubblici; il pacchetto npm segue (decisione del proprietario) —
   pubblicato lo stesso giorno (`@arkimedehq/recordare-client`, `@arkimedehq/openclaw-recordare`; immagine del proxy su GHCR).
6. **Cosa diventa pubblico insieme**: `arkimedehq/recordare` e `arkimedehq/recordare-atlas`; `@arkimedehq/recordare-client`
   su npm (Arkimede lo installa al posto della copia sincronizzata); l'integrazione di Arkimede tramite il suo mirror
   pubblico — entrambi i repository e il pacchetto npm sono pubblici; il passaggio di Arkimede al pacchetto npm è TODO.
Non richiesti per la v0.1: il profilo pubblico (login del proprietario, OAuth), i connettori (6.6), le fasi 2+ della vision
(i connettori sono comunque usciti con la v0.1).

## Decisioni aperte da prendere lungo il percorso

| Id | Domanda | Proposta | Quando |
|---|---|---|---|
| D23 | Motore: costruire D / adottare Memobase / ibrido | **Costruire D — approvato il 2026-10-02** | Fatto |
| D35 | Costo | Un'opzione: profili di qualità economy / balanced / full, per installazione + override del proprietario | Fatto (2026-10-03) |
| D34 | Note: Recordare completo, A-MEM invariato | Recordare ha note semantiche; copie unidirezionali verso A-MEM a scelta dell'utente; interruttore di Arkimede diviso in M6 | Fatto (2026-10-03) |
| D33 | Profili di deployment | v1 privato / di ricerca; hardening del profilo pubblico rinviato a M7 | Fatto (2026-10-03) |
| D31 | Fatti in Recordare | Slot di stato con catena di valori; le note restano in A-MEM fino alla migrazione | Fatto (2026-10-03) |
| D32 | Chiamate di estrazione per finestra | Una chiamata (modifica D2) | Fatto (2026-10-03) |
| D29 | Aggiunte al modello dati / al richiamo dalla letteratura | Approvato (`EPISODIC_MEMORY_TODO.md`) | Fatto (2026-10-02) |
| D30 | Turni dell'assistente | Estratti con `origin: assistant_stated` | Fatto (2026-10-02) |
| D28 | Campi del modello dati per le ipotesi di ricerca | Riservati dalla v1 (`EPISODIC_MEMORY_TODO.md`) | Fatto (2026-10-02) |
| D27 | Provider LLM / di embedding | **Qualsiasi provider** tramite profili di configurazione; DeepSeek + Ollama solo come ambienti di test | Fatto (2026-10-02) |
| D24 | Trasporto MCP e auth per persona per i client di livello basic | **Deciso (M1)**: HTTP streamable su `/mcp`; token di accesso personali per i client che supportano header; OAuth 2.1 secondo la specifica di autorizzazione MCP per i client che lo richiedono (Claude Desktop / claude.ai); livello full = chiave API del client + `X-Recordare-User` (`API.md` §1) | Fatto (2026-10-03) |
| D25 | Vector store | **pgvector** — deciso, in uso (HNSW, vedi sotto) | Fatto (2026-10-03) |
| D26 | Dove vanno le promozioni di pattern finché A-MEM vive in Arkimede | Esposte da Recordare come proposte `pending` via API; decide il client (Arkimede le importa in A-MEM) | Aperta — con 5.4 |
| — | Single-tenant (un'installazione per famiglia) vs multi-tenant | Modellare `person` + `client` in modo che funzionino entrambi; partire single-tenant | M1 |

### Motivazione di D25 — pgvector (2026-10-02)
- Recordare ha comunque un proprio DB (non può condividere il Qdrant di Arkimede), quindi la scelta è
  solo Postgres contro Postgres + Qdrant.
- Un container in meno nei deployment domestici (Postgres e Redis servono comunque).
- Il filtro per intervallo di date è centrale: vettoriale + FTS + `occurredAt BETWEEN` in un'unica query SQL,
  nessuna duplicazione di payload, nessuna fusione tra store diversi.
- La cancellazione è transazionale: "dimentica marzo" (D16) rimuove episodi, digest e vettori in
  un'unica transazione — nessun vettore orfano in un diario personale. Un solo `pg_dump` per backup/esportazione.
- I volumi sono piccoli (migliaia di episodi per persona): HNSW è più che sufficiente.
  Anche Memobase usa Postgres + pgvector.
- Non scelti: **Qdrant** (familiare da Arkimede, ibrido sparse+dense integrato, scala
  di più) — resta raggiungibile tramite `VectorStorePort`. **TimescaleDB** (hypertable per serie temporali:
  nessun beneficio al nostro volume, vincoli di partizionamento, Timescale License non OSI accanto ad AGPL, immagine pesante,
  raramente disponibile su Postgres gestiti).
- Via di fuga: **pgvectorscale** (licenza PostgreSQL) aggiunge un indice StreamingDiskANN sullo
  stesso tipo `vector` — solo un cambio di indice, nessuna migrazione di schema, se i volumi dovessero crescere.

## Dopo la fase 1

Le fasi 2–8 della roadmap (automodello, contatti e disclosure, interfaccia del gemello, iniziativa L1,
voce, iniziativa L2, modalità legacy) e la migrazione di A-MEM seguono l'ordine in
`DIGITAL_TWIN_VISION.md`. La fase 1 deve già mantenere `people` sugli episodi e la
provenienza vissuto-dal-proprietario vs vissuto-dal-gemello nel modello dati, così la fase 3 potrà aggiungere la disclosure
senza migrare gli episodi.

## Convenzioni di lavoro

- Un branch per milestone (`m0-engine-decision`, `m1-contracts`, …), unito con `--no-ff`
  dopo l'OK del proprietario; branch eliminato dopo il merge.
- Ogni milestone termina con: test verdi, `tsc --noEmit` pulito, eval harness eseguito (da M3),
  documentazione aggiornata (decisioni registrate come numeri D).

## Budget di valutazione (regola del proprietario, 2026-10-05)

Misurato: dal rifornimento del 2026-10-04, 41 esecuzioni / 2.178 domande giudicate hanno usato 27,8 M di token in input + 4,1 M in output
(≈ 6,4 USD su DeepSeek); Mem0 da solo ne è stato il 56 %. Il costo è la misurazione, non Recordare (una persona, cinque
mesi, 232 sessioni ≈ 1 M di token in input, due terzi in cache). Regole:

1. **Controlli esplorativi: 1 esecuzione.** 3 esecuzioni solo per risultati che alimentano una decisione o un numero riportato.
2. **Prima la base, il rumore solo se la base è promettente** (e solo per i sistemi ancora in discussione).
3. **Le baseline di mercato già misurate non vengono rieseguite** (Mem0, Cognee, Graphiti, Memobase) a meno che una domanda specifica
   lo richieda — i loro numeri restano in `RESULTS.md`.
4. **Controlli una volta per dataset** (nessuna memoria, contesto completo): non cambiano tra le versioni del motore.
5. **Piccole porzioni durante l'iterazione** (`--only` sulle domande che falliscono), il set completo solo per confermare.
6. **Giudice senza ragionamento** una volta rivalidato rispetto al giudice corrente (`judge_eval.py`): ~4× meno token di output.
7. Ogni catena è riprendibile con `--resume` e ordinata per priorità, così una catena interrotta (saldo, interruzione del servizio) conserva ciò che ha già pagato.
8. Prima di una catena grande, dichiarare il budget di token previsto e controllare il saldo del provider.
9. **Un'istanza del servizio per coda** (2026-10-07): prima di un'esecuzione, verificare che solo il servizio previsto consumi la
   coda (un'istanza fermata a metà continuava a estrarre con codice vecchio); confrontare le versioni affiancate con porte separate
   e `QUEUE_PREFIX` diversi. Dopo un'esecuzione, verificare che le sue estrazioni portino un'unica versione di prompt
   (`extraction_runs.prompt_version`) — un'esecuzione mista viene scartata.
