# LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive Memory (Wu, Wang, Yu, Zhang, Chang, Yu; ICLR 2025; arXiv:2410.10813)
*Traduzione italiana di [longmemeval.md](longmemeval.md) — la versione inglese è quella di riferimento.*

Letto: HTML arXiv (tramite uno strumento di fetch che restituisce passaggi estratti, non il testo integrale grezzo; i numeri di figure/tabelle qui sotto provengono da quegli estratti) più lo script del giudice `src/evaluation/evaluate_qa.py` dal repo. Il wording esatto del prompt del giudice era visibile solo in parte (solo frammenti citati). Codice/Dati: https://github.com/xiaowu0162/LongMemEval

## Problema
I benchmark precedenti sulla memoria a lungo termine (LoCoMo ecc.) usano chiacchiere umano-umano, cronologie brevi, e testano soprattutto il semplice richiamo. LongMemEval punta a un contesto utente-assistente con cronologie lunghe e orientate ai compiti e cinque abilità: estrazione di informazioni, ragionamento multi-sessione, ragionamento temporale, aggiornamenti di conoscenza, astensione.

## Metodo (come funziona il benchmark)
- 500 domande curate a mano, costruite da un'ontologia umana di 164 attributi utente in cinque categorie (demografia, stile di vita, contesto situazionale, eventi di vita, beni). Gli LLM scrivono sfondi centrati sull'attributo; gli umani filtrano e riscrivono le domande seme.
- Sette tipi: single-session-user, single-session-assistant, single-session-preference, multi-session (MR), knowledge-update (KU), temporal-reasoning (TR), più abstention (ABS, 30 domande create modificando altri tipi in domande su informazioni mai menzionate).
- Le dichiarazioni di evidenza sono incorporate indirettamente in dialoghi orientati ai compiti (simulazione self-chat), poi gli umani le vagliano. La maggior parte delle domande richiede evidenza da più sessioni (fino a sei).
- Cronologia = sessioni di evidenza mescolate con riempitivo (25% ShareGPT, 25% UltraChat, 50% sessioni simulate). Timestamp: i timestamp di evidenza predefiniti fanno da ancore, gli altri sono assegnati attorno a essi (altrimenti casuali a maggio 2023).
- Due scale: LongMemEval_S (~115k token, ~50 sessioni) e LongMemEval_M (500 sessioni, ~1,5M token).
- Framework unificato: indicizzazione (cronologia -> elementi chiave/valore), recupero (denso, Stella V5 1.5B), lettura (LLM). Quattro punti di controllo: granularità del valore, espansione della chiave, query (consapevole del tempo), strategia di lettura. Metriche: Recall@k / NDCG@k per il recupero, accuratezza QA end-to-end.
- Giudice: GPT-4o (gpt-4o-2024-08-06), temperatura 0, max_tokens 10, risposta interpretata tramite "yes" nell'output; **prompt separato per tipo di domanda**; accordo riportato >97% con esperti umani (30 domande per tipo campionate).

## Risultati chiave (con numeri)
- Gli LLM a contesto lungo su _S perdono accuratezza rispetto all'evidenza oracolo: GPT-4o 0,606 (-30,3%), Llama 3.1 70B 0,334, Llama 3.1 8B 0,454, varianti Phi-3 0,34-0,38.
- Assistenti commerciali in un pilota online sessione per sessione (97 domande, cronologie di 3-6 sessioni): ChatGPT 0,577 contro 0,918 offline (-37%), Coze 0,330 (-64%). ChatGPT ha sovrascritto informazioni cruciali; Coze non ha registrato fatti dichiarati indirettamente.
- Granularità del valore: a livello di round (coppie di turni) batte il livello di sessione per GPT-4o; i valori di soli fatti danneggiano nel complesso per perdita di informazione, ma aiutano il ragionamento multi-sessione.
- Espansione della chiave (Recall@5, sessioni / round): K=V 0,706 / 0,582; K=V+fact 0,732 / 0,644; K=V+summary 0,689; K=V+keyphrase 0,710; chiavi dei soli fatti 0,642 / 0,530; solo keyphrase 0,482 / 0,282. Espansione del documento con fatti utente estratti: +9,4% di recall medio, +5,4% di accuratezza finale tra i modelli.
- Espansione della query consapevole del tempo (l'LLM estrae un intervallo di tempo, indice filtrato per timestamp): sottoinsieme temporale Recall@5 0,421 -> 0,451 (round, K=V), fino a +11,3% con K=V+fact; Llama 8B come estrattore di tempo allucina o perde gli indizi.
- Lettura: Chain-of-Note + lettura strutturata in JSON previene fino a un calo di 10 punti per GPT-4o; non universalmente utile (Llama 70B cala con CoN).
- Il budget di token conta: Llama 8B degrada oltre ~3k token recuperati, GPT-4o continua a migliorare oltre 20k.

## Pratiche di valutazione da copiare
- Prompt del giudice per tipo con regole di bordo esplicite: TR "do not penalize off-by-one errors in number of days/weeks/months"; KU "correct if the response contains previous information along with the updated answer, as long as the updated answer is the required one"; preference "does not need to reflect all rubric points, only use the user's personal info correctly"; ABS "yes if the model identifies the question as unanswerable".
- Riportare l'accuratezza per tipo di domanda, non solo complessiva; riportare il recall del recupero separatamente dall'accuratezza QA, così che i difetti di recupero e di lettura siano separabili.
- Esecuzione con evidenza oracolo (il lettore riceve solo le sessioni gold) come limite superiore che isola il lettore.
- Testare sia la lettura offline sia la vera memoria online (l'assistente ingerisce turno per turno).
- Meta-valutare il giudice rispetto agli umani per tipo.

## Limiti
- Dialoghi sintetici, in inglese, orientati ai compiti; il riempitivo è chat generica, quindi i distrattori non sono trappole lessicali per un utente specifico.
- _S (115k token) ora entra nelle moderne finestre di contesto (vedi MemDelta, Penfield), quindi non impone il recupero.
- Il giudice è binario e interpretato su "yes" con max_tokens 10 (nessuna motivazione); nessuna validazione avversaria del giudice, solo l'accordo con gli umani su output reali campionati.
- Il paper non elenca esplicitamente i limiti; lo studio commerciale è piccolo (97 domande, cronologie brevi).

## Implicazioni per Recordare
- ADOTTARE (importante): reportistica per categoria nella nostra suite. Oggi RESULTS.md riporta una singola percentuale su 24-28 domande; aggiungere tag di categoria (lookup, aggregazione multi-sessione, temporale, aggiornamento/correzione, astensione, stato del piano) a questions.json e riportare per categoria (task 3.4, 4.4b, 4.5c).
- ADOTTARE (importante): una categoria esplicita di astensione / non rispondibile. Il nostro giudice ha `must_not`, ma non c'è un set di domande "mai menzionato" con una regola dedicata; i tassi di asserzione ingiustificata e over-abstention di H1 (4.5c) dovrebbero usare l'inquadramento ABS di LongMemEval, separati dall'"esito ignoto di un piano".
- ADOTTARE: metrica di recupero separata (Recall@k di episodi/messaggi gold) accanto all'accuratezza QA, così che una regressione possa essere localizzata tra codifica, recall e lettura (4.6). Abbiamo già `emb_eval.py` solo per gli embedding.
- ADOTTARE: regole del giudice per tipo. Il nostro unico JUDGE_SYSTEM applica `must_not` a qualsiasi menzione, il che RESULTS.md mostra già sottovaluta le risposte corrette (artefatti "wrong" di flash). Adottare la regola KU (il vecchio valore menzionato accanto a quello corrente corretto va bene) e una regola off-by-one per le durate; mantenere `must_not` rigoroso solo dove il vecchio valore è affermato come corrente.
- ADOTTARE: esecuzione con contesto oracolo (episodi gold dati a chi risponde) come limite superiore per 4.6.
- Convalida il design D12/D13: filtro per intervallo consapevole del tempo (+6,8..11,3% di recall sul temporale), chiavi aumentate con fatti (testo dell'episodio più fatti estratti come documento calcolato in embedding), fallback al log grezzo a livello di round/turno; evitare l'archiviazione di soli fatti (perdita di informazione) - supporta il mantenimento del log grezzo (D13).
- CAMBIARE: il nostro giudice usa `max_tokens=3000` con una motivazione; va bene, ma aggiungere un set di calibrazione etichettato da umani (vedi penfield-locomo-audit.md).
- EVITARE: usare LongMemEval_S come nostro riferimento principale; usarlo solo come esecuzione esterna di sanità (entra nel contesto).
