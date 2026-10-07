# Mem0: Building Production-Ready AI Agents with Scalable Long-Term Memory (Chhikara, Khant, Aryan, Singh, Yadav — Mem0, arXiv preprint Apr 2025, arXiv:2504.19413)
*Traduzione italiana di [mem0-production-memory.md](mem0-production-memory.md) — la versione inglese è quella di riferimento.*

Letto: testo completo del PDF arXiv (testo principale, appendici A-C) più il post di replica di Zep (riassunto via fetch). Il repo open-source https://github.com/mem0ai/mem0 NON è stato ispezionato; Codice: il paper indica "https://mem0.ai/research"; nel paper non sono pubblicati codice specifico né prompt di estrazione/aggiornamento.

## Problema
Le finestre di contesto fisse fanno dimenticare gli agenti tra una sessione e l'altra; anche le finestre lunghe non bastano perché le cronologie le superano e l'attenzione degrada sul contesto distante e irrilevante. Obiettivo: estrarre, consolidare e recuperare fatti salienti a basso costo, con bassa latenza e basso costo in token.

## Meccanismo (come funziona)
**Mem0 (due fasi, incrementale):**
1. L'estrazione scatta a ogni nuova coppia di messaggi (m_t-1, m_t), di solito utente più assistente.
2. Prompt P = (riassunto della conversazione S, ultimi m=10 messaggi, la nuova coppia). S viene aggiornato in modo asincrono, fuori dal percorso critico.
3. Una funzione LLM phi(P) restituisce i fatti candidati Omega = {w1..wn}.
4. Aggiornamento: per ogni candidato, recupera per embedding le top s=10 memorie simili; l'LLM, tramite function calling ("tool call"), sceglie una di quattro operazioni: **ADD** (non esiste un equivalente), **UPDATE** (arricchisce una memoria esistente), **DELETE** (contraddetta), **NOOP**.
5. L'Algoritmo 1 (appendice) le esegue. UPDATE sostituisce la vecchia memoria solo se il nuovo fatto ha più contenuto informativo; DELETE rimuove fisicamente la memoria contraddetta.

**Mem0g (variante a grafo):** (1) un estrattore di entità LLM assegna tipi (Person, Location, Event...); (2) un generatore di relazioni LLM emette triplette (sorgente, relazione, destinazione), ad es. `lives_in`, `prefers`, `happened_on`; (3) le entità sono calcolate in embedding e confrontate con i nodi esistenti sopra una soglia t, poi create o riusate; (4) un passo di rilevamento dei conflitti più un "update resolver" LLM marca le relazioni obsolete come **non valide invece di cancellarle**, per consentire il ragionamento temporale. Recupero: centrato sulle entità (trova le entità della query, espandi gli archi in entrata e in uscita in un sottografo) più semantico sulle triplette (embedding della query, confronto con le codifiche testuali di tutte le triplette sopra una soglia).

## Modello dati (campi, stati, tabelle/archivi)
Scarso nel paper. Mem0: stringhe di memoria in linguaggio naturale con id univoco, embedding in un database vettoriale; l'Algoritmo registra `(id, f, "ADD"|"UPDATE")` — cioè un'etichetta di operazione, nessun intervallo di validità. Mem0g: grafo orientato etichettato G = (V, E, L); nodo = tipo di entità, embedding e_v, timestamp di creazione t_v; arco = tripletta con etichetta; flag di invalidità sugli archi obsoleti (nome del campo non indicato). Archivio: Neo4j per il grafo. Database vettoriale non nominato. Non è descritto alcun campo di tempo dell'evento; il risultato temporale si basa sui timestamp dentro il testo della memoria e sul prompt di risposta ("convert relative time references ... based on the memory timestamp", "if contradictory, prioritize the most recent memory").

## Prompt / uso dell'LLM
Tutto gpt-4o-mini, temperatura 0. Per coppia di messaggi: 1 chiamata di estrazione, poi 1 chiamata di aggiornamento per fatto candidato (ciascuna con le top-10 memorie simili), più rigenerazione periodica del riassunto. Mem0g aggiunge chiamate di estrazione di entità, generazione di relazioni e risoluzione dei conflitti. Codice deterministico: recupero, esecuzione delle operazioni. I prompt di estrazione e aggiornamento NON sono nel paper; ci sono solo il giudice, il prompt di risposta e il prompt della baseline ChatGPT-memory. Il prompt del giudice dice al modello di "be generous with your grading - as long as it touches on the same topic as the gold answer, it should be counted as CORRECT" (anche per le date: stessa data o periodo). Il numero di chiamate per messaggio non è indicato (nostra stima: 1 + numero di candidati).

## Valutazione
- Dataset: LoCoMo, 10 conversazioni (~26k token, ~200 domande ciascuna); la **categoria adversarial è stata esclusa** (nessuna risposta gold); categorie single-hop, multi-hop, temporal, open-domain. Metriche F1, BLEU-1, LLM-as-judge J (10 esecuzioni, media +/- sd; il modello giudice non è nominato).
- J per categoria (Mem0 / Mem0g): single-hop 67,13 / 65,71; multi-hop 51,15 / 47,19; open-domain 72,93 / 75,71; temporal 55,51 / 58,13. Zep riportato: 61,70 / 41,35 / 76,60 / 49,31. Riesecuzione A-Mem 39,79 / 18,85 / 54,05 / 49,91.
- J complessivo: Mem0 66,88, Mem0g 68,44, Zep 65,99, LangMem 58,10, memoria OpenAI 52,90, A-Mem 48,38, miglior RAG ~61 (chunk 256, k=2), **full-context 72,90**.
- Costo: token di memoria per query Mem0 1.764, Mem0g 3.616, Zep 3.911, full-context 26.031. Ricerca p50/p95: Mem0 0,148/0,200 s, Mem0g 0,476/0,657 s, Zep 0,513/0,778 s. Totale p95: Mem0 1,44 s contro full-context 17,1 s ("91% lower"). Memoria archiviata per conversazione: Mem0 ~7k token, Mem0g ~14k, Zep >600k.
- **Disputa:** Zep dice che il suo sistema è stato eseguito male (ruolo utente per entrambi gli interlocutori, timestamp aggiunti al testo, ricerca sequenziale) e riporta 75,14% J, sopra il 68,44% di Mem0g. La nostra lettura: il paper dice anche che Mem0 perde contro il full-context di 6 punti, ed entrambi i fornitori scelgono impostazioni favorevoli; si applica la nostra nota in CLAUDE.md ("~94% auto-riportato contro ~49% indipendente"). Nessuna ablation isola l'effetto di ADD/UPDATE/DELETE.

## Limiti
Autori: il grafo aggiunge latenza; i grafi non hanno aiutato multi-hop né single-hop; lavoro futuro su memoria gerarchica e consolidamento più ricco. Nostri: i fatti sono stringhe atemporali (nessun tempo dell'evento, nessuna precisione); DELETE distrugge la storia (contraddice l'affermazione del paper stesso di "temporal consistency"); UPDATE riscrive in loco; il riassunto S è un secondo livello con perdita; domande adversarial / non rispondibili rimosse, quindi il comportamento con premesse false non è testato; giudice generoso; LoCoMo entra in una finestra di contesto; una sola esecuzione di ingestione per sistema; il passo di aggiornamento costa O(candidati) chiamate LLM.

## Implicazioni per Recordare
- **Importante, EVITARE:** il modello ADD/UPDATE/DELETE/NOOP applicato a tutto. DELETE e UPDATE in loco sono ciò che D28/D10 vietano; il nostro è append + supersede/correct. Prendere solo l'idea utile: una singola piccola decisione (add / same / supersedes / corrects / noop) per candidato, vincolata da gate deterministici (ENGINE_IDEAS "one resolve call").
- ADOTTARE come baseline nella suite di valutazione (H6): eseguire Mem0 (OSS) accanto a Memobase/Graphiti sui nostri due dataset, con il giudice generoso in stile LoCoMo sostituito dal nostro giudice rigoroso; includere sempre le baseline **full-context e RAG semplice** — il paper mostra che il full-context vince ancora sulla qualità, quindi la nostra affermazione deve essere corretta per il costo.
- ADOTTARE: riportare l'accuratezza insieme ai token iniettati per query, alla latenza di ricerca p50/p95 e ai token archiviati per conversazione (contabilità per chiamata, M2). Questi tre numeri hanno costruito il caso di Mem0; usarli.
- ADOTTARE (D1/D2): contesto di estrazione = un riassunto di conversazione scorrevole più gli ultimi ~10 messaggi. Passiamo già la coda; considerare il riassunto asincrono per risolvere pronomi e date nelle brevi finestre idle.
- NON cambiare nulla in D8: le memorie dense in linguaggio naturale senza grafo hanno battuto o pareggiato la variante a grafo su single- e multi-hop; supporta "nessun database a grafo" (rifiuto 2 di D23).
- Nota per D13: il guadagno di Mem0g sulle domande temporali (+2,6 J) veniva da relazioni con timestamp, cioè il tempo dell'evento conta; il nostro `occurredAt` più il filtro per data è la forma più forte della stessa idea.
- Evitare di copiare la forma del suo prompt di risposta ("answer < 5-6 words"), gonfia i punteggi del benchmark e non riflette l'uso da agente.
