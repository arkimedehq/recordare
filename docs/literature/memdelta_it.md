# MemDelta: Controlled Baselines and Hidden Confounds in Agent Memory Evaluation (Kuan Wang, 2026, arXiv:2606.29914)

*Traduzione italiana di [memdelta.md](memdelta.md) — la versione inglese è quella di riferimento.*

Letto: pagina dell'abstract su arXiv e arXiv HTML (tramite uno strumento di fetch che restituisce passaggi estratti, non il testo completo grezzo; le tabelle qui sotto provengono da quegli estratti). Codice/Dati: nessun repository collegato; usa il LongMemEval-S pubblico.

## Problema
I miglioramenti riportati dai sistemi di memoria confondono più variabili: la qualità del retrieval, il modello di embedding, l'LLM lettore e il costo del percorso di scrittura. Gli articoli confrontano un sistema sofisticato con una baseline debole o non specificata, quindi "l'architettura di memoria aiuta" non è dimostrato.

## Metodo (come funziona l'analisi)
Protocollo di isolamento di una singola variabile su LongMemEval-S (500 domande; 39-66 sessioni, ~115k token ciascuna). Strategie:
- S0 solo la domanda (limite inferiore); S_rand chunk casuali da ~5K token (separa "rilevante" da "qualsiasi contesto");
- S2 scratchpad di auto-memoria dell'agente (budget di 4.096 token, ~250 chiamate LLM per scriverlo);
- S4 RAG verbatim con all-MiniLM-L6-v2 (384d); S4b RAG verbatim con OpenAI text-embedding-3-small (1536d);
- S1 conversazione completa nel contesto; S3 pipeline di estrazione Mem0 v2.0 (embedding: ada-002).
Modelli lettori: GPT-4o-mini (n=500), Claude Sonnet (n=300-500), Gemini 2.5 Flash (n=100). Giudice: GPT-4o-mini binario che vede solo la ground truth e la risposta (non la memoria/il contesto). Statistica: test appaiato di McNemar, IC bootstrap al 95% (2.000 ricampionamenti), alpha 0,05.

## Risultati principali (con i numeri)
- Il solo cambio di embedding (S4 -> S4b): 47,2% -> 53,4% (+6,2pp, p=0,004). Per tipo: temporal +10,5, multi-session +11,3, SS-user +11,4, knowledge-update 0,0, SS-assistant -5,4, SS-preference -10,0. Quindi l'effetto dipende dal tipo e può essere negativo.
- RAG contro contesto completo dipende dal modello: GPT-4o-mini S1 49,8% contro S4 47,2% (n.s.); Claude Sonnet RAG 44,7% contro completo 14,0% (Sonnet ha rifiutato il 63% delle query a contesto completo; a 47K token il rifiuto scende al 41% e l'accuratezza sale al 38%); Gemini 2.5 Flash completo 70% contro RAG 56%. Le classifiche si ribaltano tra famiglie di modelli.
- Lo scratchpad di auto-memoria è peggiore del semplice retrieval: 42,0% (n=100), -5,2pp rispetto a S4; multi-session 3,3%; costo di scrittura ~90 min, ~250 chiamate, $0,34.
- Mem0 v2.0 su un sottoinsieme appaiato di n=88 (68 SS-user, 20 multi-session): 72,7% contro RAG cloud 73,9% (McNemar p=1,0) a un costo del percorso di scrittura ~50x (~120 min, 1.000+ chiamate, $0,50+ per istanza). Multi-session: Mem0 20% contro RAG 25%. Parità solo su 2 tipi su 6, e temporal/KU sono stati esclusi per costo.
- Per tipo, GPT-4o-mini: knowledge-update favorisce il contesto completo (71,8% contro 62,8% RAG), perché "il più recente" richiede di vedere tutto; SS-preference 40% (S4), 30% (S4b), 13% completo.

## Pratiche di valutazione da copiare
- Includere sempre una baseline RAG verbatim con nome e riportarne il modello di embedding; testare la sensibilità a una sua sostituzione.
- Includere un controllo con chunk casuali (S_rand) e uno senza contesto (S0) per rilevare perdite di informazione / rispondibilità dai prior.
- Almeno due famiglie di modelli lettori; riportare se le classifiche persistono.
- Riportare il costo del percorso di scrittura (chiamate LLM, tempo, dollari) accanto all'accuratezza; confronti su istanze appaiate per i sistemi costosi.
- Test di significatività appaiati e IC; il giudice vede solo gold e risposta.
- Controllo di troncamento/lunghezza per separare "non sa svolgere il compito" da "rifiuta a contesto lungo".

## Limiti
- Mem0 solo su 88 istanze e 2 tipi su 6; esecuzioni di Sonnet parziali.
- Un solo dataset sintetico; la generalizzazione al mondo reale non è testata.
- S4b e S3 usano embedding OpenAI diversi, quindi il controllo sull'embedding è approssimato.
- Un solo giudice (GPT-4o-mini) per tutti i modelli; verifiche manuali a campione raccomandate ma non eseguite.

## Implicazioni per Recordare
- CAMBIARE (importante): i nostri punteggi con rumore sono singole esecuzioni su 24-28 domande; RESULTS.md stesso stima la varianza a +-4 punti (una domanda = 3,6-4,2 punti). Aggiungere il confronto appaiato (McNemar o bootstrap sulle domande) e N>=3 seed prima di qualsiasi affermazione "D batte X"; segnalare automaticamente nell'harness le differenze sotto la soglia di rumore (3.4, 4.6). È la principale indicazione: le nostre decisioni attuali (D23, divari di +8..+25 punti) sono valide per grandi divari ma non per la messa a punto fine dei prompt.
- ADOTTARE (importante): mantenere costante il modello di embedding tra i sistemi e riportarlo. RESULTS.md round 1 usava MiniLM e round 2 bge-m3 (baseline 56 -> 67%), un confondente che l'articolo quantifica in 6,2pp; mai confrontare righe di round diversi.
- ADOTTARE: aggiungere alla suite i controlli S0 (nessuna memoria) e contesto casuale; le nostre domande sono in italiano con vite sintetiche, quindi un'esecuzione senza memoria dovrebbe ottenere ~0% sui dettagli specifici e rivela anche l'indulgenza del giudice.
- ADOTTARE: colonne di costo del percorso di scrittura (chiamate, token in/out per messaggio, tempo, dollari) per ogni esecuzione; abbiamo già la contabilità `USAGE` per chiamata; renderla un risultato di prima classe e il gate di budget CI di 4.4c. Confrontare il costo di D con una baseline RAG semplice, non solo la qualità (Mem0 ~50x per la parità).
- ADOTTARE: una baseline a contesto completo per i dataset piccoli (il nostro set base di 17 sessioni sta nel contesto); dice quando la memoria non è necessaria. Usare almeno due famiglie di modelli lettori nella matrice dei provider (4.5b); la classifica può ribaltarsi.
- ADOTTARE: reportistica su sottoinsiemi appaiati quando i sistemi costosi non possono eseguire tutto.
- Da tenere d'occhio: le domande knowledge-update e "latest" favoriscono il vedere tutto; mantenere una modalità `latest` e una categoria KU in 4.4b.
- EVITARE: memoria scratchpad/riassunto scritta dall'agente come design alternativo (-5pp rispetto al RAG, crolla su multi-session); supporta il fallback sul log grezzo di D13.
