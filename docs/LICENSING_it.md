# Politica di licenza per idee, codice, prompt e dati riutilizzati

*Traduzione italiana di [LICENSING.md](LICENSING.md) — la versione inglese è quella di riferimento.*

Recordare è sotto licenza **AGPL-3.0** (`LICENSE`). Tutto ciò che prendiamo da altre fonti deve essere
compatibile con essa e con un possibile servizio commerciale sopra. Non è consulenza legale: prima di un rilascio
pubblico o commerciale, far rivedere a un avvocato questo file e `THIRD_PARTY_NOTICES.md`.

## Regole

1. **Idee, algoritmi, concetti di modello dei dati** (ad es. fatti bi-temporali, stati dei piani, controllo del
   pubblico `V ⊆ Aud`) non sono protetti dal diritto d'autore: possiamo implementarli nel nostro codice, e
   citiamo la fonte nei documenti (`docs/literature/`, `ENGINE_IDEAS.md`). I brevetti sono una questione a parte —
   vedi la regola 6.
2. Il **codice** può essere copiato o adattato solo da fonti la cui licenza lo consente ed è compatibile
   con AGPL-3.0:
   - **MIT, BSD, Apache-2.0**: consentito. Conservare l'avviso di copyright originale e il testo della licenza,
     aggiungere una voce a `THIRD_PARTY_NOTICES.md`, marcare i file modificati ("Adapted from <project>,
     <licence>; modified"). Apache-2.0 richiede anche di portare con sé il file `NOTICE` originale, se esiste
     (Graphiti e Memobase non ne hanno al 2026-10-02).
   - **GPL-3.0 / AGPL-3.0**: consentito (stessa famiglia), con gli avvisi.
   - **Nessuna licenza, "all rights reserved", non commerciale (CC BY-NC), solo ricerca o poco chiara**:
     **non copiare**. Reimplementare a partire dall'idea con parole nostre, senza guardare il codice
     mentre lo si scrive.
3. Il **testo dei prompt** conta come testo / codice:
   - da progetti Apache-2.0 / MIT (Graphiti, Memobase, Mem0, A-MEM…): riuso consentito con
     attribuzione in `THIRD_PARTY_NOTICES.md` e un commento al prompt;
   - da **paper**: il copyright dipende dalla licenza del paper (la licenza predefinita di arXiv non concede
     diritti di riuso; CC BY consente il riuso con attribuzione). Predefinito: **riscrivere con parole
     nostre**; citazioni brevi solo nei documenti, con citazione della fonte.
4. **Dataset e benchmark** usati nella nostra suite di valutazione:
   - consentiti per la valutazione interna se la licenza permette quell'uso;
   - **non ridistribuirli** né distribuirli a meno che la licenza lo consenta;
   - i dati **non commerciali** (ad es. **LoCoMo, CC BY-NC 4.0**) possono essere usati solo per confronti di
     ricerca, mai come parte del prodotto o di un servizio a pagamento, e non vanno committati in questo repo.
   - I nostri dataset (`spikes/memory-eval/dataset*/`) sono originali e nostri.
5. **Pesi dei modelli** (LLM locali, embedding, voci TTS, fine-tune): controllare la licenza dei pesi
   prima di supportarli o distribuirli — diversi sono non commerciali o hanno restrizioni d'uso.
   Registrare i modelli supportati e le loro licenze nella tabella dei modelli supportati (D27).
6. **Brevetti**: Apache-2.0 include una concessione di brevetto da parte dei contributori; MIT / BSD non dicono nulla;
   i paper possono descrivere metodi brevettati. Prima di un rilascio commerciale, eseguire una verifica di
   freedom-to-operate sui meccanismi centrali (fatti temporali, ciclo di vita dei piani, filtraggio della divulgazione).
7. **Ogni riuso viene registrato nel momento in cui avviene** — niente "aggiungeremo l'attribuzione dopo".

## Licenze delle fonti note (verificate il 2026-10-02)

| Fonte | Licenza | Uso |
|---|---|---|
| Graphiti (`getzep/graphiti`) | Apache-2.0 | idee; formulazione dei prompt riutilizzabile con attribuzione |
| Memobase (`memodb-io/memobase`) | Apache-2.0 | idee; formulazione dei prompt riutilizzabile con attribuzione |
| Mem0 (`mem0ai/mem0`) | Apache-2.0 | idee; baseline dello spike (`mem0ai` 2.2.1, solo dipendenza) |
| Cognee (`topoteretes/cognee`) | Apache-2.0 (ha un `NOTICE.md`, verificato il 2026-10-04) | baseline dello spike (`cognee` 1.6.0, solo dipendenza) |
| A-MEM (`agiresearch/A-mem`, `WujiangXu/A-mem-sys`) | MIT | idee |
| STALE (`icedreamc/STALE`) | MIT | idee, design della valutazione |
| LongMemEval (`xiaowu0162/LongMemEval`) | MIT | design della valutazione; dati utilizzabili secondo la sua licenza |
| LoCoMo (`snap-research/locomo`) | **CC BY-NC 4.0** | solo confronto di ricerca, non nel prodotto / repo |
| Penfield LoCoMo audit (`dial481/locomo-audit`) | file di licenza presente, non verificato | solo metodologia |
| PIS, StateMemBench, Authorization Before Context, Collaborative Memory, TSM, MemIR, LightMem, MemDelta, HaluMem | paper (codice non rilasciato o non verificato) | solo idee — reimplementare, non copiare il testo |
