# HaluMem: Evaluating Hallucinations in Memory Systems of Agents (Chen, Niu, Li, Liu, Zheng, Tang, Li, Xiong, Li; arXiv:2511.03506, v3)
*Traduzione italiana di [halumem.md](halumem.md) — la versione inglese è quella di riferimento.*

Letto: HTML arXiv v3 (tramite uno strumento di fetch che restituisce passaggi estratti, non il testo integrale grezzo; formule delle metriche e tabelle provengono da quegli estratti; prompt del giudice non visti). Codice/Dati: https://github.com/MemTensor/HaluMem ; https://huggingface.co/datasets/IAAR-Shanghai/HaluMem

## Problema
L'accuratezza QA end-to-end nasconde dove un sistema di memoria fallisce. Una risposta sbagliata può venire dall'estrazione (omissione o invenzione), dall'aggiornamento (modifiche obsolete o allucinate) o dal recupero/risposta. HaluMem misura l'allucinazione per ogni operazione di memoria.

## Metodo (come funziona il benchmark)
- Due dataset: HaluMem-Medium (20 utenti, 30.073 turni, ~160k token/utente, 69 sessioni/utente) e HaluMem-Long (~1M token/utente, 121 sessioni, riempito con ELI5 irrilevanti e dialoghi generati). Entrambi: 14.948 memory point, 3.467 coppie QA.
- Pipeline sintetica a sei stadi: persona (Persona Hub) -> scheletro di vita -> flusso di eventi -> riassunti di sessione con memory point annotati (contenuto, tipo, importanza) -> generazione di sessioni multi-turno con contenuto avversario e verifica -> domande. Controllo manuale di 700 sessioni: 95,7% corrette, rilevanza 9,58/10, coerenza 9,45/10.
- Tipi di memory point: persona 9.116; event 4.550; relationship 1.282; update 3.122; distractor 2.648 (false memorie che il sistema non dovrebbe memorizzare).
- Tipi di domanda (3.467): richiamo di fatti di base 746, multi-hop 198, aggiornamento dinamico 180, confine della memoria 828 (informazione ignota), conflitto di memoria 769, generalizzazione e applicazione 746.
- Tre compiti con gold a ogni passo (le memorie memorizzate dal sistema vengono ispezionate dopo ogni sessione):
  1. Estrazione: Memory Recall (1/0,5/0 per punto), Weighted Recall (per importanza), Memory Accuracy (punteggio su tutte le memorie estratte), Target Memory Precision, False Memory Resistance (distrattori non memorizzati), F1 di recall e target precision.
  2. Aggiornamento: accuratezza, tasso di allucinazione, tasso di omissione (sugli aggiornamenti target; top-10 memorie recuperate).
  3. QA: accuratezza, tasso di allucinazione, tasso di omissione (top-20 memorie).
- Punteggio da parte di GPT-4o con template di prompt.

## Risultati chiave (con numeri)
- Medium: recall sotto il 60% per la maggior parte dei sistemi: Mem0 42,9%, Mem0-Graph 43,3%, Memobase 14,6%, Supermemory 41,5%, MemOS 74,1% (Zep non espone ispezione della memoria, quindi solo QA). Target precision alta (86-92%) ma memory accuracy solo 32-62%, cioè molte memorie estratte sono sbagliate o non mirate. FMR 45-81%.
- Accuratezza QA Medium: Mem0 53,0, Mem0-Graph 54,7, Memobase 35,3, MemOS 67,2, Supermemory 54,1, Zep 55,5. Long: Mem0 28,1, Mem0-Graph 32,4, Memobase 33,6, MemOS 64,4, Supermemory 53,8, Zep 50,2. Il recall crolla su Long per Mem0/Memobase (3-6%).
- Aggiornamento: l'accuratezza cala bruscamente; i tassi di omissione superano il 50% per diversi sistemi.
- Gli errori si propagano: l'accuratezza QA segue la qualità dell'estrazione a monte. I sistemi vanno meglio sulle domande di confine e conflitto, peggio su multi-hop, aggiornamento dinamico, generalizzazione.
- Le memorie di evento sono il tipo più debole per la maggior parte dei sistemi (accuratezza eventi di Mem0 29,7% contro persona 33,7%; MemOS 63,4 / 59,8).
- Costo: tempo di elaborazione dei dialoghi Medium: Mem0 ~2.810 min, Memobase 433, Supermemory 369, MemOS 1.049; i sistemi più veloci estraggono meno.

## Pratiche di valutazione da copiare
- Valutare ogni stadio della pipeline rispetto ai memory point gold, con credito parziale 1 / 0,5 / 0 e pesi di importanza.
- Esito a tre vie per le risposte: corretta / allucinata / omessa (non solo giusta o sbagliata).
- Memory point distrattori come classe negativa esplicita (false memory resistance).
- Domande di confine della memoria (informazione ignota) e di conflitto (l'utente afferma qualcosa di incompatibile con la memoria) come categorie separate.
- Incrociare il recall dell'estrazione con la precisione, dato che un sistema può sembrare preciso estraendo poco.

## Limiti
- Interamente sintetico, utenti generati da LLM con traiettorie di vita a template; il gold dei memory point è fissato a una sola granularità, quindi i sistemi con schemi diversi (episodi contro fatti atomici) vengono abbinati tramite un giudice LLM.
- Richiede accesso alle memorie memorizzate dal sistema (Zep non valutabile sull'estrazione).
- GPT-4o come unico valutatore; nessun audit umano riportato sugli errori del valutatore né test avversari del giudice.
- Le cifre estratte qui provengono da un fetch riassuntivo; i prompt esatti del giudice e i dettagli di aggregazione dei punteggi vanno verificati nel repo prima del riuso.

## Implicazioni per Recordare
- ADOTTARE (importante): valutazione per stadio, non solo QA end-to-end. Oggi l'harness valuta solo le risposte finali, quindi una regressione nell'estrazione degli episodi è indistinguibile da una regressione di recall o di risposta. Aggiungere un controllo dell'estrazione rispetto alle annotazioni gold di episodi/piani per ogni sessione del dataset (task 4.4b, 4.6): recall degli episodi, target precision, false-memory resistance sui distrattori, accuratezza/omissione/allucinazione dell'aggiornamento dei piani.
- ADOTTARE (importante): esito della risposta a tre vie corretta / allucinata (afferma un fatto non supportato o contraddetto) / omessa ("Non mi risulta" quando la memoria lo aveva). Sono esattamente i tassi di asserzione ingiustificata e di over-abstention di H1 (4.5c); il nostro giudice corretta/parziale/sbagliata li confonde e `must_not` mescola allucinazione e menzione benigna.
- ADOTTARE: elementi distrattori nel dataset (contenuto simile di un'altra persona, già presente per `davide`/`elena`; aggiungere affermazioni false, ipotesi, cose che l'utente nega e fatti di terzi) per misurare la false-memory resistance; verificare l'isolamento per persona come test.
- ADOTTARE: test separati sulle operazioni di aggiornamento (riprogrammare, annullare, correggere) con conteggi di omissione contro allucinazione, in linea con gli stati dei piani D28 e `corrects` / `supersedes`.
- ADOTTARE: riportare tempo di ingestione e token per messaggio come nella loro tabella di efficienza; notare che i sistemi più rapidi estraggono meno, quindi costo e recall vanno mostrati insieme.
- Cautela: HaluMem mostra che il basso recall di estrazione è il fallimento dominante; il nostro estrattore di episodi D è giudicato solo tramite QA, quindi il recall dell'estrazione è attualmente non misurato. Il riempimento a contesto lungo (il loro set Long) supporta il nostro approccio del noise-set.
- EVITARE: assumere un'unica granularità di memoria per il gold; annotare il gold come fatti in testo libero con date e abbinarli tramite giudice, così che le varianti di motore (stile Memobase, D) restino confrontabili.
