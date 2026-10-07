# StateMemBench: Can Agent Memory Systems Track Evolving State? (Fan, Liu, Yang, Ouyang, Han; UIUC, 2026, arXiv:2608.19652)

*Traduzione italiana di [statemembench-state-tracking.md](statemembench-state-tracking.md) — la versione inglese è quella di riferimento.*

Letto: testo completo del PDF (articolo principale più appendici inclusi i prompt E.1-E.3, wrapper F, limiti H); Codice: nessun URL di repository trovato nell'articolo (benchmark e kit di annotazione sono dichiarati "released with the benchmark", nessun link letto)

## Problema
I benchmark di richiamo (LoCoMo, LongMemEval) non verificano se la memoria rifletta lo stato CORRENTE dopo che fatti, regole e decisioni sono stati rivisti nel corso delle sessioni. "State drift": il fatto rilevante è nel contesto ma l'agente agisce su una versione obsoleta o incompleta. Si dimostra che il drift persiste con retrieval perfetto: su LongMemEval oracle (recall = 1,0), il 44,4% (16/36) dei fallimenti di DeepSeek-V4-Flash è drift; le domande multi-session vanno in drift ~3x più spesso di quelle knowledge-update (71,4% contro 25,0%). Abilitare il reasoning non ha aiutato (84,0% a 76,0%, n=50).

## Meccanismo (StateMem, tre fasi)
1. **Ingestione**: un `TurnEncoder` fa UNA chiamata LLM per turno di conversazione, data la resa compatta di tutte le unità attive; emette operazioni `add` e `supersede` ("Look ACTIVELY for supersession patterns: actually, instead, no longer, switched to...").
2. **Aggiornamento**: lo store applica le supersessioni segnalate (vecchia unità con stato `superseded`, sostituta aggiunta come attiva). Un `Rechecker` deterministico percorre il grafo delle dipendenze `G=(U,E)`: ogni unità con un arco verso un'unità il cui stato è appena cambiato riceve `needs_recheck` (O(|E|), zero chiamate LLM).
3. **Al momento del test**: un renderer deterministico raggruppa le unità attive (incluse quelle `needs_recheck`, mostrate con il trigger che le ha segnalate) in blocchi "BINDING", "PREFERENCES (yield if necessary)", "NEEDS RECHECK", aggiunge le date come marcatori di recenza e un'ancora "today"; UNA chiamata di risposta con un prompt di guida al ricalcolo ("A unit flagged NEEDS RECHECK is STALE ... RECOMPUTE it").

## Modello dati
Unità di stato `u = (id, content, priority, source, deps)`: `priority in {hard, soft}`; `source` = turno di origine e parlante; collegamenti tipizzati `derived_from` (valore calcolato da un'altra unità) e `coupled_with` (la validità dipende dallo stato di un'altra unità); `triggers` opzionali con tipi `date_passed | entity_closed | supersession_announced | cascade`; `type`, `scope`, `source_type in {user, action, tool_result}` liberi. Stato: active / `superseded` (conservata per audit, trattenuta dalle risposte) / `needs_recheck` (attiva ma segnalata). Le unità sono marcate con la data del turno quando disponibile.

## Prompt / uso degli LLM
Ingestione 1 chiamata/turno; aggiornamento 0 chiamate; risposta 1 chiamata. `PolicyEncoder` opzionale una volta per scenario. Variante wrapper: 0 chiamate extra, sostituisce la chiamata di risposta del backend con una chiamata fusa "Trace then Resolve" (traccia limitata a 250 parole: valore iniziale, ogni revisione, valore corrente per slot, con numeri di turno; quattro regole di precedenza: il successivo sostituisce il precedente, le regole permanenti prevalgono sulle istanze, le quantità derivate vanno ricalcolate non citate, un fatto è ritirato solo da supersessione esplicita o scadenza). Tutto a temperatura 0, reasoning disattivato.

## Valutazione
Benchmark: 234 scenari multi-session (Set A 190 brevi, ~165 turni; Set B 44 lunghi fusi, ~600 turni, 3 sonde), 322 sonde a pool chiuso; domini ricerca, shopping, finanza personale. Gli scenari sono programmi di eventi simbolici riprodotti da un valutatore deterministico, resi da un LLM. Modalità di fallimento per costruzione: status, salience, sequence, compound, più anti-trap (il valore ancorato resta corretto; verifica la sovra-invalidazione). La valutazione a pool chiuso separa la "drift answer" da "other".
- DeepSeek-V4-Flash gold rate: StateMem 0,363 contro Dense 0,205, A-Mem 0,199, Mem0 0,177, long-context 0,149, LightMem 0,012, MemoryOS 0,025. Qwen-3.5-9B: StateMem 0,233 contro GraphRAG 0,224 (non significativo), Mem0 0,149.
- Ablazione (DeepSeek): solo estrazione 0,174; + supersessione 0,298 (il passo più grande); senza propagazione delle dipendenze 0,373 (la propagazione scatta troppo sugli anti-trap, -12,5pp); senza guida al ricalcolo 0,301.
- Benchmark di richiamo: LongMemEval 0,656 (miglior sistema di memoria), temporal-reasoning 0,624 contro long-context 0,391.
- Wrapper su sei backend: da +32 a +67 punti; gli attributi di controllo appaiati da +15 a +32 alla struttura. Un riassunto cieco alla domanda è peggio di nessuno.

## Limiti
Autori: dati sintetici; le trappole provengono dalla stessa famiglia di policy "lazy reader" che StateMem contrasta, quindi i margini sono un limite superiore; scenari brevi (3k-15k token); le dipendenze sono dichiarate esplicitamente, non inferite. Nostri: l'accuratezza assoluta resta bassa (0,36); una sola esecuzione per cella; l'intero stato attivo viene reso, quindi non scala senza sezionamento; la chiamata LLM per turno è costosa; l'accordo del giudice tra famiglie di modelli è solo kappa 0,37.

## Implicazioni per Recordare
- **ADOTTARE (importante), fatti D28**: la marcatura della supersessione è il singolo guadagno più grande; mantenere `supersedes` e far vedere all'estrattore i fatti correnti (già in D23) con frasi-indizio esplicite ("actually", "no longer", "switched to") nel prompt.
- **ADOTTARE (importante), D28**: aggiungere `derivedFrom` (id dei fatti) più un flag deterministico `needsRecheck` sui fatti, propagato dal codice quando un fatto sorgente è sostituito/corretto; ricalcolare al momento della risposta tramite resa con flag. Oggi assente da D28 (i valori derivati come "risparmio mensile", "giorni di ferie rimasti" diventano obsoleti).
- **ADOTTARE, D12 / richiamo**: restituire la catena dei valori per slot (iniziale, ogni revisione, corrente, date) invece del solo valore corrente; la traccia del wrapper ha battuto il contesto semplice. `search_episodes` per gli slot dei fatti dovrebbe rendere in modo compatto la storia sostituita con le date.
- **ADOTTARE, eval (H1/H6)**: aggiungere al nostro set held-out casi anti-trap (fatto invariato ribadito, eccezione circoscritta che NON deve invalidare) e l'etichettatura del drift a pool chiuso; tracciare la sovra-invalidazione, non solo l'accuratezza. Il nostro D23 "i fatti invariati ribaditi vengono scartati" richiede un test simile.
- **ADOTTARE**: la tassonomia dei fallimenti status / salience / sequence / compound come tag di valutazione.
- **CAMBIARE**: la propagazione dovrebbe essere conservativa (ha danneggiato gli anti-trap): marcare `needs_recheck`, mai riscrivere automaticamente.
- **EVITARE**: ingestione LLM per turno (in conflitto con il batching idle+nightly di D1); rendere tutte le unità in ogni prompt.
