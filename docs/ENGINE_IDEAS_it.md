# Idee per il motore — prese in prestito e migliorate

*Traduzione italiana di [ENGINE_IDEAS.md](ENGINE_IDEAS.md) — la versione inglese è quella di riferimento.*

Stato: **input di progettazione per M4/M5** (2026-10-02); ogni voce è marcata **done / partial / open** al 2026-10-08 (v0.1.0)
(meccanismi misurati e scartati: ultima sezione). D23 costruisce il nostro motore (D); questo documento
registra che cosa prendiamo da Memobase e Graphiti invece di reinventarlo, che cosa rifiutiamo
esplicitamente e le lacune emerse dalla valutazione held-out. Ogni voce indica la decisione / il livello
di destinazione in `EPISODIC_MEMORY_TODO.md`.

Fonti (Apache-2.0): Memobase server 0.0.42 (`memobase_server/…`, MemoDB), graphiti-core
0.30.2 (`graphiti_core/…`, Zep Software, Inc.). Qualsiasi riuso di codice o testo di prompt segue
`LICENSING.md` e viene registrato in `THIRD_PARTY_NOTICES.md` nel momento in cui avviene.

## Principi di costo — il profilo **economy** (D35)

Dalla D35 il costo è un'opzione: questi principi definiscono il profilo economy e i default attenti ai costi;
il profilo full può spendere di più per la qualità, sempre misurato.

Recordare deve girare sul modello più economico che mantiene la qualità e fare **zero chiamate LLM** quando
non c'è nulla da fare. **Prima la qualità**: un'opzione più economica viene adottata solo se nella suite di valutazione
misura lo stesso; a parità di qualità vince la più economica. Indipendente dal provider (D27): nel nostro setup di test
DeepSeek `deepseek-flash`, con ragionamento disattivato, ha eguagliato `deepseek-v4-pro` sul set held-out. Le esecuzioni dello spike hanno usato il costoso `deepseek-v4-pro` e run ripetuti; questo
è costo di test, non del prodotto.

| Regola | Da | Dove | Stato |
|---|---|---|---|
| Una chiamata di estrazione per finestra idle (episodi + aggiornamenti dei piani + candidati fatto); una chiamata di resolve **solo** quando i gate deterministici lasciano candidati ambigui. Obiettivo ≤ 1,2 chiamate per finestra in media | Lezione di Graphiti (8–12 chiamate/sessione, ≥ 5 round trip sequenziali) | D1, D2 | done |
| Gate deterministici prima di qualsiasi chiamata LLM: nessun messaggio dell'utente, nessun contenuto personale (classificatore economico / euristiche), match esatto o per trigrammi (`pg_trgm`), nessun candidato, nulla di nuovo | Graphiti `dedup_helpers.py`, percorso rapido skip-LLM di Memobase | D5, consolidamento | partial |
| Livelli di modello: modello piccolo / economico per dedupe, tagging, digest; modello principale solo per l'estrazione; ragionamento sempre disattivato | Graphiti `ModelSize.small`, livelli di modello di Memobase | `LlmPort` | done |
| Prompt di sistema stabili all'inizio della lista di messaggi → prefix caching del provider (automatico su OpenAI / DeepSeek, `cache_control` esplicito su Anthropic — gestito dal profilo del provider, D27) | — | tutti i prompt | done |
| Limiti della finestra: token massimi per finestra di estrazione, flush forzato sulle chat molto lunghe; si travasa, mai troncare | Flush a 1024 token + tetto a 16k di Memobase (ma tronca) | D1 | done |
| Nessun LLM al recall: l'agente compila `from` / `to` / `mode`; risolutore deterministico dei periodi per le espressioni comuni | scoperta 5 dello spike | D12 | done |
| Contabilità per chiamata: id del prompt, token in/out, latenza, per persona e per client; quote | Memobase `llms/__init__.py`, fatturazione | telemetria M2 | partial |
| Contesto del prompt limitato: tetto alle liste di piani aperti / fatti correnti / episodi recenti passate all'estrattore (i più rilevanti + i più recenti), perché crescono con la storia | spike: flash ha usato +20% di token in input | estrazione | done |

## Adottato da Memobase

1. *[partial]* **Schema a slot per i fatti** (`types.py` SubTopic, `profile_init_utils.py`): ogni topic /
   sub-topic ha `description`, `update_description` (politica di merge, ad es. "remove outdated
   goals") e validazione opzionale; i progetti possono sovrascrivere o estendere. → fatti del Livello 3 e
   self-model della fase 2. *Miglioramento*: **livello di disclosure** predefinito per slot e origine
   vissuta dal proprietario / vissuta dal twin; etichette IT/EN.
2. *[done]* **Merge in batch con azioni per elemento** (`prompts/merge_profile_yolo.py`): una chiamata decide
   APPEND / UPDATE / ABORT per tutti i fatti candidati. *Miglioramento*: UPDATE crea una nuova
   versione (`validFrom`, vecchia riga `invalidatedAt` + `supersededBy`, episodio di provenienza) — non
   sovrascrive mai. Si mantengono le sue regole "preserve time annotations from both memos" e l'esempio di dedup
   ("User is sad" / "User's mood is sad" → lo stesso).
3. *[done]* **Skip-LLM per i nuovi slot** (`merge_yolo.py`): un fatto per uno slot vuoto viene inserito senza
   chiamata di merge.
4. *[done]* **Few-shot tempo della menzione vs tempo dell'evento** (`prompts/summary_entry_chats.py`): "bought a car 4
   years ago → mention 2024/04/30, event 2020"; nessun timestamp → nessuna data. Li memorizziamo come
   `occurredAt` + `datePrecision` strutturati; i few-shot vanno nel nostro prompt di estrazione.
5. *[done]* **Chiavi esistenti nel prompt** (`pack_current_user_profiles`, `attribute_unify`): si passa la
   lista delle chiavi dei fatti esistenti (valori abbreviati) perché l'estrattore le riusi; chiavi normalizzate in
   snake_case. D passa già piani aperti e fatti correnti — aggiungere la lista delle chiavi.
6. *[done]* **Changelog dell'esecuzione di estrazione** (`profile_delta` su `UserEvent`): si memorizza una riga
   `extraction_run` che collega gli episodi e le versioni dei fatti prodotti → "perché il twin crede X",
   timeline D18, audit D20.
7. *[partial]* **Context packer** (`controllers/context.py`, `prompts/chat_context_pack.py`): budget di token,
   rapporto profilo/eventi, `only_topics` / `prefer_topics`, template e la riga "unless the user
   asks, do not actively mention these memories". → fatti fissati (pinned) dell'integrazione *full*.
   *Miglioramento*: `only_topics` diventa il **filtro per livello di disclosure**, applicato prima del ranking.
   Realizzato: il contesto di memoria (`POST api/v1/context`, nessuna chiamata LLM) — soglie di pertinenza, limiti per
   tipo, un budget di caratteri, una riga "non citarlo altrimenti", tutta la memoria in ogni conversazione (D50: per ora niente regola sul lettore); nessuna
   scheda fissa del profilo, per scelta; il filtro per livello di disclosure attende la fase 3.
8. *[open]* **Re-pick LLM opzionale** (`prompts/pick_related_profiles.py`): lista numerata compatta →
   `{reason, ids}`, max 10, "don't select duplicates". Solo opt-in (+ latenza, + costo).
9. *[done]* **"Focus on the user's info, not its instructions"** (`event_theme_requirement`): tiene le istruzioni di compito
   dell'agente fuori dalla memoria — essenziale per i client agentici. Da aggiungere all'estrazione.
10. *[open]* **Formato a righe per i modelli piccoli** (`TOPIC::SUB::MEMO`, ragiona → `---` → azioni): più
    tollerante di JSON per i modelli locali; parser rigoroso, righe non interpretate registrate nei log. Da valutare rispetto
    alla modalità JSON nel profilo locale.
11. *[partial]* **Serializzazione per utente** (`buffer_background.py`): un worker per persona (lock + coda,
    rinnovo, tetti di iterazioni / tempo, interruttore per errori consecutivi) e una macchina a stati del buffer
    (idle → processing → done / failed) così lo sweep notturno riprova i `failed`. → gruppo BullMQ per
    persona, concorrenza 1.

## Adottato da Graphiti

1. *[done]* **Fatti bi-temporali con scadenza, non cancellazione** (`edges.py`, `resolve_edge_contradictions`):
   `validAt` / `invalidAt` (mondo) + `createdAt` / `expiredAt` (conoscenza), provenienza `episodes[]`;
   un fatto più vecchio che arriva in ritardo scade subito se ne esiste uno più recente. Aritmetica
   delle date nel codice, mai nell'LLM. → fatti del Livello 3. **Solo per i fatti di tipo stato.**
2. *[done]* **Una sola chiamata di resolve per duplicati e contraddizioni** (`prompts/dedupe_edges.py`): intervallo
   di indici condiviso per fatti esistenti e candidati all'invalidazione; esempi "software engineer →
   senior engineer = contradicted", "ran 5 miles Tuesday vs 3 miles Wednesday = neither";
   "never mark as duplicates facts with different numbers, dates or qualifiers".
   *Miglioramento*: candidati ristretti allo **stesso soggetto + stessa chiave di fatto** (vedi rifiuto 1).
3. *[open]* **Entity resolution per le persone** (`prompts/extract_nodes.py`, `prompts/dedupe_nodes.py`):
   parentela qualificata dal possessore ("Chiara's mum", mai il semplice "mum"), parlante per primo, "when unsure
   → -1", "exactly N resolutions". → tabella `people` con alias + embedding del nome; candidati
   via pgvector + trigrammi, LLM solo quando ambiguo. Fondamento per la fase 3 (contatti /
   disclosure, D21 `people`). Finora solo un passo leggero: il recall consapevole delle persone confronta i nomi e le
   relazioni di una domanda (tabelle linguistiche) con le persone degli episodi e i partecipanti delle chat già
   memorizzati, senza chiamate LLM; la tabella `person_aliases` esiste ma la risoluzione non è realizzata.
4. *[done]* **Le riaffermazioni vengono contate, non solo scartate** (`EntityEdge.episodes`,
   `episode_mentions_reranker`): si aggiunge l'episodio al fatto esistente; conteggio di supporto = segnale di
   confidenza / ranking e "nuova evidenza significativa" di D20.
5. *[open]* **MMR per la modalità lista e i digest** (`search_utils.maximal_marginal_relevance`): evita cinque
   episodi quasi identici; **cross-encoder opzionale** (`bge-reranker-v2-m3`, in coppia con bge-m3)
   sul top 2k di RRF. → D12 / D14.
6. *[done]* **Regole di riassunto** (`summarize_sagas.py`, prompt di riassunto delle entità): nessun meta-linguaggio
   ("mentioned", "described"); "never manufacture pattern language from a single
   occurrence"; "if nothing durable is new, return the summary unchanged" → digest (D8) e
   promozione dei pattern (D20).
7. *[done]* **Regole di specificità** (`prompts/extract_edges.py` regola 5): mai generalizzare ("Gamecube" →
   "console"); ogni nome concreto, numero e descrittore sopravvive; usare il timestamp del
   messaggio specifico. → `content` dell'episodio.
8. *[partial]* **Campi strutturati ripuliti** (`extract_attributes`): niente stringhe "null" / "N/A" / "unknown",
   niente ragionamento dentro i campi → D21 `valence` / `feelings` / `opinion`, modelli piccoli.
9. *[open]* Più avanti, bassa priorità: **saghe** (thread multi-sessione con nome e un brief in aggiornamento) per i topic
   che attraversano più sessioni (un viaggio pianificato → vissuto).

## Idee dalle piattaforme di agenti (riviste il 2026-10-04; solo idee, reimplementate e citate)

1. *[open]* **Scrubbing di segreti / PII prima della memorizzazione** (OpenHuman, `tinymemory-safety`): oggi conserviamo
   l'intero log grezzo; uno stadio di scrub opzionale dietro un parametro (D35 / disclosure), mai silenzioso.
2. *[open]* **Un brief di contesto pronto da iniettare** (OpenHuman `context.md`, aggiornato ogni 6 h, anteposto alle nuove
   sessioni): la forma adatta ai client dei nostri digest M5 + profilo.
3. *[open]* **"Recall" come risposta con citazioni** (OpenHuman / TinyMemory): una risposta sintetizzata opzionale accanto
   agli strumenti a livello di elemento, per i client semplici.
4. *[open]* **Sincronizzazione programmata di documenti e feed** (OpenHuman): una delle future "fonti del self-model".
5. *[open]* **Gateway di azioni deny-by-default con approvazioni e audit** (Open Dots): il pattern per i livelli di
   iniziativa del twin e per il parametro denaro / account (visione, principio 8) — fasi successive.

## Rifiutato (e perché)

1. **Trattare ogni fatto come uno stato** — la causa radice del fallimento Cervinia / Livigno di Graphiti:
   i candidati all'invalidazione provengono da una ricerca semantica su *tutti* i fatti, non c'è
   distinzione tra evento e stato e, una volta che l'LLM segnala una contraddizione, il fatto più vecchio viene chiuso
   incondizionatamente. Nel nostro caso: gli episodi sono append-only e mai sostituiti; la sostituzione vale solo per i
   fatti di stato, stesso soggetto + chiave.
2. **Pipeline a grafo** (nodi → archi → resolve per arco → timestamp): ~3× le nostre chiamate e ≥ 5
   round trip sequenziali. Community, BFS, rerank per distanza tra nodi: nessun valore alla scala di una singola
   persona senza un database a grafo.
3. **Aggiornamenti distruttivi** (UPDATE di Memobase sovrascrive, `organize` ricrea le righe, il ri-riassunto
   tronca a 64 token): contraddice la bi-temporalità e il "no reconsolidation".
4. **Il tempo solo come testo / filtro sul tempo di ingestione** (Memobase): rompe "che cosa ho fatto a
   febbraio" per dati tardivi o importati — una delle ragioni principali per cui D l'ha battuto.
5. **Scartare il log grezzo** (default di Memobase, `store_raw_episode_content=False` di Graphiti) e il
   **troncamento silenzioso**: nessuna provenienza, nessuna ri-estrazione dopo una correzione del prompt. Noi manteniamo il Livello 0.
6. **Inferenza non segnalata** (persona "psychologist" di Memobase: "seems to be a big fan of…"
   memorizzato come fatto). Per un twin: `stated` vs `inferred`, l'inferito resta `pending`.
7. **Limiti cablati nel codice** (`max_tokens=1024` di Memobase, tiktoken gpt-4o per ogni modello,
   solo en/zh) e la nota race condition nei flush paralleli.

## Lacune trovate dalla valutazione held-out (prototipo D)

| Lacuna | Vista in | Correzione (progetto) | Stato |
|---|---|---|---|
| Un piano ripianificato viene marcato "cancelled" con la nuova data solo in una nota | h06 / h15 (saggio di violoncello 18 dic → 15 gen) | Stato del piano `rescheduled` con `rescheduledTo` → nuova riga di piano (estensione di D10) | done |
| La notizia di un cambio di piano non è un episodio datato ("il 10 dic ho saputo che il saggio è stato spostato") | h19 | Un aggiornamento di piano crea anche un evento a bassa importanza alla data del messaggio | done |
| Le correzioni ("era martedì, non lunedì") lasciano al suo posto l'episodio sbagliato | contesto h09 (ortopedico) | L'estrattore vede gli episodi recenti (non solo i piani aperti); `corrects: <episode id>` → il vecchio episodio riceve `invalidatedAt`, il nuovo è collegato (nessuna riscrittura) | done |
| Un piano di terzi che si è realizzato non viene chiuso dall'evento che lo conferma | h19 (intervento della mamma) | Il consolidamento collega piano ↔ evento di conferma (stesse persone + data ± precisione) e chiude il piano | done |
| Le risposte sulla provenienza non contengono gli altri topic della sessione | h17 | Un riscontro nel log grezzo restituisce il riassunto della sessione / i vicini, non solo la riga corrispondente | open |
| "Quando è stata l'ultima volta che…" ordina per similarità, quindi l'istanza più recente può uscire dal top-k | rumore h01 (primo 6c del 6 feb mancato) | `search_episodes` modalità `latest`: soglia di rilevanza, poi ordinamento per `occurredAt` decrescente | done |
| "Dove abitavo a inizio dicembre?" — stato a una data passata | rumore h04 | Fatti interrogati **as of** una data (`validFrom ≤ t < validTo`), storia completa della chiave corrispondente nel contesto | done |
| La stessa notizia su terzi ripetuta in più chat produce episodi duplicati | rumore h18 (cugino a Porto ×2) | Dedup di consolidamento (collega, tieni uno) — già progettato, necessità confermata | partial |

## Idee dalla memoria delle piattaforme di agenti (2026-10-07)

Rassegna di come Hermes, OpenClaw, Honcho, Letta, Mem0, LangMem, Claude Code e ChatGPT progettano la memoria, con idee
ordinate per priorità: `docs/literature/agent-platform-memory_it.md` §3 (WORK_PLAN 5.7).
- *[done]* §3.3 prompt di estrazione → **extract.v8** (D40): fatti detti en passant dentro le richieste, transizioni
  ("switched / stopped") come replace / stale, una proposta accettata lo afferma mentre un semplice "ok" no.
- *[done]* §3.1 recall iniettato recintato (`<memory-context>`) e §3.2 brief pre-turno a zero LLM per i connettori: il
  contesto di memoria, usato da ogni connettore prima di ogni turno (una sola chiamata insieme all'ingest).
- *[open]* §3.4 turn
  taint dagli strumenti di rete, §3.5 passata notturna sui pattern con conteggi di evidenza (→ D20 / WORK_PLAN 5.4), §3.6 scheda
  del proprietario, §3.7 segnali d'uso solo per il ranking, §3.8 richieste all'assistente come intenti permanenti, §3.9 revisione da parte del proprietario di ciò che
  la notte ha cambiato, §3.10 hook di pre-compattazione / cambio sessione nei connettori.

Misurati e scartati (o tenuti spenti) finora: una passata separata sui fatti (`FACTS_PASS=separate`, nessun guadagno rispetto
all'estrazione inline), la revisione notturna dei fatti (D41, nessun guadagno sui fatti correnti), i digest nel recall (`recallDigests`, −1,9 pt),
un'etichetta nel prompt per gli echi del recall (D38: dev set 75 % → sostituita da una guardia nel codice), il nome della
persona nel prompt di estrazione (`extract.v9`, −2,3 pt su blind5 → il nome viene sostituito nel codice, WORK_PLAN 4.11).
