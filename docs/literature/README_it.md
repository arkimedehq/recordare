# Letteratura — schede di lettura e sintesi

*Traduzione italiana di [README.md](README.md) — la versione inglese è quella di riferimento.*

Letture approfondite (articolo completo, appendici, codice dove rilasciato) fatte il 2026-10-02 per verificare il nostro progetto
prima di M1. Una scheda per fonte, struttura fissa (problema, meccanismo, modello dati, uso degli LLM,
valutazione, limiti, implicazioni per Recordare). Diverse schede sono state lette tramite uno strumento di fetch
che restituisce passaggi estratti — la riga `Read:` di ciascuna scheda lo indica; ricontrollare i numeri prima di
citarli all'esterno. Licenze del codice riutilizzabile: `../LICENSING_it.md`.

## Indice

| Scheda | Fonte | Tema |
|---|---|---|
| [pis-typed-intention-stores](pis-typed-intention-stores_it.md) | Zhao & Wu, arXiv:2609.01272 | Ciclo di vita di piani / intenzioni nel codice |
| [statemembench-state-tracking](statemembench-state-tracking_it.md) | Fan et al., arXiv:2608.19652 | Stato in evoluzione, anti-trappole, fatti derivati |
| [stale-implicit-conflict](stale-implicit-conflict_it.md) | Chao et al., arXiv:2605.06527 | Invalidazione implicita, resistenza alle premesse |
| [zep-temporal-kg](zep-temporal-kg_it.md) | Rasmussen et al., arXiv:2501.13956 | Fatti bi-temporali |
| [mem0-production-memory](mem0-production-memory_it.md) | Chhikara et al., arXiv:2504.19413 | Pipeline ADD/UPDATE/DELETE, numeri di costo |
| [amem-zettelkasten](amem-zettelkasten_it.md) | Xu et al., arXiv:2502.12110 | Note, collegamenti, evoluzione (A-MEM di Arkimede) |
| [tsm-temporal-semantic-memory](tsm-temporal-semantic-memory_it.md) | Su et al., arXiv:2601.07468 | Tempo dell'evento vs tempo del dialogo |
| [memir-typed-memory](memir-typed-memory_it.md) | Jin et al., arXiv:2605.25869 | Memoria tipizzata legata alle evidenze |
| [lightmem-efficient-memory](lightmem-efficient-memory_it.md) | Fang et al., arXiv:2510.18866 | Batching, segmentazione per topic, costo |
| [authorization-before-context](authorization-before-context_it.md) | Liu, arXiv:2608.17148 | Verifica del pubblico prima del prompt |
| [collaborative-memory](collaborative-memory_it.md) | Rezazadeh et al., arXiv:2505.18279 | Permessi multi-utente, provenienza |
| [longmemeval](longmemeval_it.md) | Wu et al., arXiv:2410.10813 | Benchmark, ablazioni, giudice |
| [memdelta](memdelta_it.md) | Wang, arXiv:2606.29914 | Confondenti, controlli, costo del percorso di scrittura |
| [halumem](halumem_it.md) | Chen et al., arXiv:2511.03506 | Valutazione delle allucinazioni per operazione |
| [penfield-locomo-audit](penfield-locomo-audit_it.md) | Penfield Labs, 2026 | Risposte gold sbagliate, giudici indulgenti |
| [human-memory-and-agent-architectures](human-memory-and-agent-architectures_it.md) | Rassegna: Tulving, Squire, Conway, Johnson et al. 1993, CLS; CoALA, Generative Agents, MemGPT, Voyager, Soar / ACT-R (2026-10-09) | Sistemi della memoria umana e architetture di agenti riportati sulla memoria propria dell'agente |

## Sintesi — che cosa cambia nel nostro progetto

### Confermato (da mantenere)
- Tempo dell'evento vs tempo di ingestione + filtro per intervallo di date (LongMemEval, TSM, Zep); `datePrecision`
  evita la falsa precisione di Zep ("2020" → 1 gen).
- Append-only con `supersedes` / `corrects`; non lasciare mai che l'LLM cancelli o riscriva (Mem0, A-MEM,
  caso Tokyo/Kyoto di LightMem, punteggio di contraddizione del 32 % di MemIR).
- Log grezzo + fallback etichettato (LongMemEval: l'archiviazione dei soli fatti perde informazione; MemDelta:
  memoria scratchpad < RAG; Zep perde il contenuto lato assistente).
- Il batching per finestra idle è dove stanno i risparmi di costo (LightMem); nessun database a grafo (Mem0g, Zep).
- `unresolved` per i piani dell'utente va oltre il lavoro più vicino (PIS ha pending / done / canceled).

### Aggiunte al modello dati (D29, approvate il 2026-10-02 — estende D28)
1. **Insieme del pubblico (audience set)** su ogni episodio, fatto, digest e voce di profilo: id delle persone risolti
   presenti quando è stato registrato (immutabile), accanto al livello `disclosure`; permessi valutati in
   lettura rispetto alla politica corrente; concessioni (grant) come dati con intervalli di validità; le ricerche restituiscono
   lo stesso "non trovato" per elementi mancanti e vietati. *(Liu; Collaborative Memory)*
2. **Gli artefatti derivati portano gli id delle fonti**; pubblico derivato = intersezione dei pubblici delle fonti; un
   artefatto senza id di fonte fallisce in modo chiuso (fail closed). *(Liu)*
3. **Fatti**: stato `current | superseded | corrected | unknown_current` (vecchio valore non sicuro, nuovo
   sconosciuto); verdetto in fase di scrittura per ogni fatto toccato `keep | stale | replace | corrects | unknown`
   su un insieme di candidati preselezionato; `derivedFrom` + propagazione deterministica di `needsRecheck`
   (solo segnalazione, mai riscrittura automatica); sostituzione solo in avanti per tempo dell'evento / del messaggio, così
   le importazioni non possono sovrascrivere fatti più recenti; `stated | inferred` + confidenza. *(STALE,
   StateMemBench, LightMem)*
4. **Piani**: l'LLM emette patch tipizzate sparse (`confirm | cancel | reschedule | amend`), transizioni di ciclo di vita
   nel codice; "una menzione successiva non è una cancellazione"; i piani aperti vengono preselezionati (finestra di
   date + embedding + persone) e referenziati per indice. *(PIS)*
5. **Estrazione legata alle evidenze**: ogni episodio / fatto / patch di piano cita id di messaggio, validati nel
   codice rispetto al Livello 0 (altrimenti rifiutati); l'espressione temporale originale è memorizzata accanto alla
   data risolta. *(MemIR, Zep)*
6. **Chiavi di retrieval** (parole chiave, contesto di una riga, tag) prodotte nella stessa chiamata di estrazione
   ed embeddate con il contenuto; nessuna chiamata extra per elemento. *(A-MEM, chiavi fact-augmented di LongMemEval)*

### Motore e recall
- `search_episodes` modalità **`latest`**; con un intervallo di date, ordinare **prima quelli nell'intervallo**
  (prior temporale rigido) *(TSM)*; per gli slot dei fatti restituire la **catena dei valori** (iniziale → revisioni → corrente, con
  date) *(StateMemBench)*; stato sempre mostrato (cancellato / irrisolto / sostituito mai
  presentato come corrente) e **verifica della premessa** per gli stati presupposti *(STALE, PIS)*.
- Le code lunghe (sweep notturno, importazioni, legacy) vengono **segmentate per topic** (similarità di embedding tra turni adiacenti)
  prima dell'estrazione, mai troncate *(LightMem)*; tetto di affermazioni per finestra *(MemIR)*;
  contesto di estrazione = riassunto progressivo + ultimi messaggi *(Mem0)*.
- Parsing deterministico dei periodi con un corpus di test IT/EN *(TSM)*.
- Da evitare: compressione dei token (LLMLingua) nella v1, clustering GMM / grafi per turno (TSM), selezione
  LLM in lettura (MemIR), disclosure o redazione decise dall'LLM (Collaborative Memory), riscrittura
  dei vicini (A-MEM), ricostruzioni periodiche dell'indice.

### Valutazione (diventa la suite di regressione)
- **Statistica**: N ≥ 3 run, test appaiati (bootstrap / McNemar), segnalazione automatica del noise floor;
  modello di embedding costante e dichiarato. I nostri divari di D23 (+8…+25) restano; le affermazioni a grana fine
  (ad es. flash = v4-pro) sono "entro il rumore", non "dimostrate uguali". *(MemDelta)*
- **Controlli e baseline**: nessuna memoria, contesto casuale, contesto completo, RAG semplice, contesto
  oracolo (limite superiore), Mem0 OSS accanto a Memobase. *(MemDelta, Mem0, Zep, LongMemEval)*
- **Esiti**: corretto / allucinato / omesso invece di corretto / parziale / sbagliato, per
  categoria (incl. astensione, stato dei piani, aggiornamento della conoscenza); recall del retrieval riportato
  separatamente; **valutazione dell'estrazione per stadio** rispetto a episodi / aggiornamenti di piano gold con
  distrattori. *(HaluMem, LongMemEval)*
- **Giudice**: validazione avversaria (tassi di falsa accettazione e falso rifiuto su risposte vaghe, sbagliate e
  corrette-più-extra), regole per tipo (il vecchio valore citato accanto a quello corrente va
  bene), modello giudice diverso dal modello che risponde, set di calibrazione etichettato da umani.
  *(audit Penfield, LongMemEval)*
- **Audit del gold** da parte di un secondo lettore (date, giorni della settimana, cambio d'anno, chi è chi). *(Penfield)*
- **Nuovi tipi di sonda**: anti-trappole (fatti invariati che non devono essere invalidati), cambiamenti
  impliciti senza indizi di negazione, triplette di resistenza alle premesse. *(StateMemBench, STALE)*
- **Colonne di costo** per run: chiamate e token per messaggio, token iniettati per query, latenza p50 / p95.
  *(Mem0, MemDelta, LightMem)*

### Turni dell'assistente (D30, approvata il 2026-10-02: opzione b)
- **Turni dell'assistente**: le memorie derivate perdono ciò che ha detto l'assistente (regressione di Zep su
  single-session-assistant). Per i client agentici conta (le azioni dell'agente,
  le raccomandazioni che l'utente ha accettato). Opzioni: (a) i turni dell'assistente solo come contesto, (b) estrarre anche
  gli elementi affermati dall'assistente con una propria origine (`assistant_stated`), mai mescolati con i ricordi
  vissuti dal proprietario. Scelta: (b), coerente con la provenienza H3.
