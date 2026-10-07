# We audited LoCoMo: 6.4% of the answer key is wrong and the judge accepts up to 63% of intentionally wrong answers (Penfield Labs, Apr 2026, github.com/dial481/locomo-audit)

*Traduzione italiana di [penfield-locomo-audit.md](penfield-locomo-audit.md) — la versione inglese è quella di riferimento.*

Letto: il post su dev.to (tramite uno strumento di fetch che restituisce passaggi estratti, non il testo completo grezzo), il README del repository dell'audit (struttura e riepilogo dei risultati) e snippet dei risultati di ricerca; non ho eseguito gli script né letto i singoli pacchetti di errori o i prompt del giudice. Codice/Dati: https://github.com/dial481/locomo-audit (CC BY-NC 4.0, include LoCoMo10 con SHA256, pacchetti di audit, stress test del giudice, esecuzioni baseline a contesto completo); post https://dev.to/penfieldlabs/we-audited-locomo-64-of-the-answer-key-is-wrong-and-the-judge-accepts-up-to-63-of-intentionally-33lg

## Problema
LoCoMo (arXiv:2402.17753) è il benchmark di memoria a lungo termine più citato; i fornitori pubblicano punteggi su di esso (EverMemOS, Mem0, Zep, ...) e ne nascono dispute. L'audit chiede se la chiave delle risposte è corretta e se il giudice LLM sa distinguere il giusto dallo sbagliato.

## Metodo (come funziona l'analisi)
- Audit manuale e tramite script di tutte le 1.540 domande valutate (le 446 domande avversariali di categoria 5 non sono valutate nel setup EverMemOS a causa di un formato a scelta multipla rotto) rispetto alle conversazioni di origine.
- Analisi dell'impatto degli errori su cinque sistemi pubblicati con intervalli di confidenza di Wilson.
- Test avversariale del giudice: per ognuna delle 1.540 domande è stata generata una risposta volutamente errata ma tematicamente adiacente e valutata con il setup del giudice pubblicato (gpt-4o-mini, prompt pubblicati; circa 1.485 chiamate al giudice).
- Baseline indipendenti a contesto completo (4 esecuzioni) e una revisione metodologica di prompt, costi in token e riproducibilità.

## Risultati principali (con i numeri)
- 99 domande su 1.540 (6,4%) hanno risposte gold errate che corrompono il punteggio, quindi il tetto per un sistema perfetto è circa 93,6% (93,57%). Categorie: fatti allucinati nella chiave (es. "Ferrari 488 GTB" dove la conversazione dice solo "this beauty" e una didascalia "red sports car"), ragionamento temporale errato (24+ errori di aritmetica delle date, es. "last Saturday" risolto sul giorno sbagliato), errori di attribuzione del parlante (24 domande).
- Il giudice ha accettato il 62,81% delle risposte volutamente errate. I fatti errati specifici (nome o data sbagliati) sono stati individuati circa l'89% delle volte, ma le risposte vaghe che nominano l'argomento giusto senza dettagli sono passate circa nel 67%. Questo premia un retrieval debole che trova la conversazione giusta ma non estrae nulla.
- Le dimensioni delle categorie differiscono di 8,8x (96-841 domande); il 56% dei confronti tra sistemi adiacenti è statisticamente indistinguibile al 95%; open-domain richiede un divario di 15+ punti per separare due sistemi.
- Le dichiarazioni sul costo in token non corrispondono alla tabella dell'articolo stesso (2.298 dichiarati contro 6.669 di media, quindi la riduzione rispetto al contesto completo è 67%, non 89%); terze parti riportano 38,38% contro un 92,32% dichiarato.
- LongMemEval-S (~115K token) sta nelle finestre di contesto moderne: baseline a contesto completo 60,2% contro 84,2% per un sistema di memoria osservazionale, quindi misura l'efficienza del contesto più che il retrieval.
- Citazione: "When a judge accepts 63% of intentionally wrong answers, score differences below that threshold are not interpretable."

## Pratiche di valutazione da copiare
Sei requisiti elencati dagli autori: (1) corpus più grande della finestra di contesto; (2) un giudice più forte di gpt-4o-mini; (3) validazione avversariale del giudice (dargli risposte sbagliate); (4) ingestione realistica, basata su conversazioni; (5) divulgazione della pipeline pubblicata: metodo di ingestione, modello di embedding, prompt di generazione, modello e prompt del giudice, numero di esecuzioni, deviazione standard; (6) verifica della ground truth (confronto con il ~3,3% di errore nelle etichette dei principali benchmark ML, Northcutt et al. 2021). Inoltre: intervalli di Wilson per categoria; verificare l'hash del dataset; usare la stessa pipeline di risposta per tutti i sistemi.

## Limiti
- Il testo dell'audit è di un laboratorio vicino a un fornitore; le risposte avversariali sono di un solo stile di generazione (pertinenti ma sbagliate), il tasso di accettazione dipende da quello stile e dal giudice gpt-4o-mini.
- Le domande avversariali di categoria 5 non sono sottoposte ad audit, e l'audit non propone un benchmark corretto.
- La mia lettura si basa su riassunti; le prove per ogni errore sono nel repository.

## Implicazioni per Recordare
- ADOTTARE (importante): la validazione avversariale del giudice come test permanente (4.6 / 3.4). Per ogni domanda generare (a) risposte pertinenti ma vaghe, (b) specifiche ma sbagliate (data errata, vecchio valore di un fatto aggiornato, fatto di un'altra persona), (c) risposte corrette con un'affermazione extra, e richiedere che il giudice rifiuti (a) e (b) e accetti le parafrasi corrette. Riportare i tassi di falsa accettazione e falso rifiuto del giudice. Il nostro giudice è lo stesso deepseek-flash di chi risponde ed è stato verificato solo ad hoc (artefatti "wrong" di flash); sappiamo che esistono falsi rifiuti (eccessiva rigidità di must_not, in RESEARCH_NOTES H6) ma non abbiamo mai misurato le false accettazioni, che invaliderebbero i punteggi "partial" e "correct".
- ADOTTARE (importante): verificare il nostro gold. Un secondo lettore (non l'autore) controlla ogni `expected` rispetto alle sessioni, specialmente l'aritmetica delle date ("last Saturday", risoluzione del giorno della settimana, cambio d'anno nell'holdout) e l'attribuzione di parlante/persona (omonimie luca vs elena/davide). Un tasso di errore del 6,4% sul gold gonfia i divari apparenti; i nostri dataset sono abbastanza piccoli da essere verificati per intero.
- ADOTTARE: fissare l'intera pipeline di risposta tra i sistemi (già fatto: risposta + giudice identici in common.py) e pubblicare percorso di ingestione, modello di embedding, prompt, modello del giudice e numero di esecuzioni in ogni voce di RESULTS, con IC; segnalare le differenze sotto la soglia di rumore (le nostre +-4 punti misurate).
- ADOTTARE: richiedere dettagli specifici in `expected` (nomi, date, conteggi), perché le risposte vaghe ma pertinenti passano giudici indulgenti; il prompt del giudice deve esigere il fatto specifico, con "partial" solo per fatti parziali espliciti.
- CAMBIARE: il modello giudice dovrebbe essere diverso da (e almeno altrettanto forte di) quello che risponde/dell'engine dove il budget lo consente; eseguire il giudice con più campioni o un modello più forte sui disaccordi.
- EVITARE: usare i numeri di punta di LoCoMo o LongMemEval-S per confrontarci con i fornitori; usarli solo come esecuzioni di sanità. Mantenere la nostra disciplina blind held-out (verifica held-out di RESULTS) come garanzia più forte contro l'overfitting, e riscrivere un nuovo set blind quando i prompt cambiano sostanzialmente (4.4b).
