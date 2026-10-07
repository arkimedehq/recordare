# Making Prospective Memory SLM-Shaped: Typed Intention Stores for Small-Model Agents (Zhao & Wu, Peking University; NeurIPS 2026 submission, non-archival work in progress, arXiv:2609.01272)

*Traduzione italiana di [pis-typed-intention-stores.md](pis-typed-intention-stores.md) — la versione inglese è quella di riferimento.*

Letto: testo completo del PDF (8 pagine con i riferimenti; non esiste appendice); Codice: non rilasciato ("will release upon acceptance")

## Problema
Memoria prospettica (PM) = portare a termine un'intenzione differita al giusto segnale futuro (tempo, evento, o un "canale" nascosto come un portale o una casella di posta) mentre il lavoro prosegue. Gli store retrospettivi (Mem0, A-Mem, Letta, ...) ottimizzano la similarità `sim(e,q)`, non "quali azioni sono dovute adesso". Su PM-Bench (Liu & Gabriel, arXiv:2607.12385) il miglior scaffold pubblicato raggiunge il 65,1% di Set-F1. Gli autori sostengono che la PM sia tracciamento di stato vincolato da schema, quindi i small language model (SLM) possono farla se lo spazio delle azioni è tipizzato. Nota importante sull'ambito: le intenzioni sono i to-do propri dell'AGENTE ("ricordami quando il portale si apre"), non piani di un utente il cui esito è ignoto.

## Meccanismo (come funziona)
Un passo del ciclo dell'agente (Algorithm 1): `Form -> Revise -> Filter -> (channel Observation) -> Decide`.
1. **Form**: `Disassemble(V_t)` estrae gli span di impegno dal testo di evidenza; `Structure(s)` riempie gli slot trigger, action, status=pending. È l'unica fase in cui il testo libero entra nello store. Entrambe possono condividere una sola chiamata LLM.
2. **Revise**: aggiornamento di credenza sullo store esistente, non retrieval. Il codice preseleziona le intenzioni candidate `C_t`; poi UNA chiamata LLM "indexed judge" emette un insieme sparso di patch tipizzate applicate dal codice ("no update span implies an empty patch"). Tipi di patch: `reschedule` (riscrive il trigger), `override` (sostituisce l'azione), `cancel` (stato a canceled). "Cue appearance alone is not cancellation."
3. **Filter**: regole puramente strutturali (giorno/orizzonte, corrispondenza esatta dell'orario, etichette discrete di evento/canale) riducono le righe pending a una eligibility board `B_t`. Le intenzioni condizionate da un canale il cui canale non è ancora stato interrogato restano sulla board come "check targets".
4. **Observation**: un giudice di canale guarda `B_t` e può richiedere interrogazioni di canale; le risposte vengono fuse nell'evidenza finché non ne vengono richieste altre.
5. **Decide**: l'LLM mappa (board, evidenza, menu delle azioni) in un insieme di azioni dovute; le righe adempiute sono marcate `done` nel codice (`kappa`), "guards allow".
I predicati di orario sono verificati da regole; i predicati di evento/canale usano un giudice linguistico.

## Modello dati
Intenzione `I = (phi, alpha, sigma)`: `phi` trigger (condizione di scadenza/attivazione), `alpha` azione, `sigma in {pending, done, canceled}`. Store `P_t`; eligibility board `B_t`; canali `C_t` referenziati dalle intenzioni pending. Non sono descritti campi per provenienza, evidenza, timestamp dei cambi di stato o confidenza. Insieme dovuto ideale: `D*_t = {alpha | I in P_t, sigma = pending, V_t |= phi}`.

## Prompt / uso degli LLM
Per passo: Form (1 chiamata, eventualmente Disassemble+Structure unificati), Revise (1 chiamata del giudice sulla shortlist), giudice di canale (0..n chiamate), Decide (1 chiamata). Codice deterministico: ciclo di vita, transizioni di stato, Filter, regole di orario, applicazione delle patch, marcatura done. Nell'articolo non è dato alcun testo di prompt (non indicato). Senza addestramento: backbone congelati, niente LoRA/distillazione.

## Valutazione
PM-Bench "synthetic week" (7 giorni simulati, menu prospettici, azioni esca, canali nascosti). Metrica: Set-F1 micro degli insiemi dovuti predetti contro quelli gold; inoltre update miss (fetta reschedule/cancel/override), cross-day miss, falsi allarmi per passo (FA/step). Baseline: "single" senza store, Naive RAG, Mem0, A-Mem, Letta, stile LightMem, stile MemoryOS (gli ultimi due sono "pattern adapters", non server upstream).
- DeepSeek-Chat: PIS 82,9 Set-F1 (update miss 22,2, cross-day miss 0,0, FA 8,8) contro single 67,7, miglior retrospettivo 58,3. Tutte le memorie retrospettive hanno ottenuto punteggi SOTTO la baseline senza store.
- Gemma-E2B: single 4,2, retrospettivi 0,0-6,6, PIS 66,2 (update miss ancora 77,8).
- Qwen3.5-4B: PIS 70,1 contro il miglior 54,4; Qwen3-8B: PIS 57,2.
- Costo: PIS 16,4 min / 2,08M token su DeepSeek, più di una baseline silenziosa ma molto meno di A-Mem / Letta (22-24 min, ~8M token).

## Limiti
Autori: valutato solo su PM-Bench (l'unica suite PM aperta); nessun fine-tuning esplorato; le ablazioni per operatore sono lavoro futuro. Nostre osservazioni: un solo benchmark sintetico, una sola esecuzione, nessuna varianza; le baseline sono adapter; la gestione degli aggiornamenti sui modelli piccoli resta scarsa (77,8% di miss); le intenzioni sono lato agente, quindi manca la semantica di "la data è passata e non abbiamo mai saputo l'esito" (lo scaduto resta semplicemente pending); nessun codice, nessun prompt; Qwen3-8B < Qwen3.5-4B mostra un'alta sensibilità a modello/formato.

## Implicazioni per Recordare
- **ADOTTARE (importante), piani D10/D28**: tenere le transizioni del ciclo di vita nel codice e lasciare che l'LLM emetta solo patch tipizzate sparse. I nostri stati dei piani (`open | confirmed | cancelled | rescheduled | unresolved`) corrispondono a `reschedule` / `cancel` di PIS; aggiungere allo schema dell'estrattore una patch esplicita di tipo `override` (contenuto del piano cambiato, stesso slot), e trattare "nessuna patch" come output predefinito.
- **ADOTTARE, estrattore D23**: il Revise di PIS preseleziona i candidati prima del giudice. Il nostro estrattore "vede i piani aperti e i fatti correnti"; su larga scala quella lista va preselezionata (finestra di date + embedding + stesse persone/luogo) e referenziata per indice, altrimenti i modelli piccoli peggiorano (il loro 77,8% di update miss).
- **ADOTTARE, D10**: "cue appearance is not cancellation" - una menzione successiva dell'argomento di un piano non deve chiuderlo automaticamente; la conferma richiede evidenza dell'accadimento, la cancellazione richiede evidenza della cancellazione. Codificarlo nel prompt e nei casi di valutazione.
- **ADOTTARE, eval (H1/H5)**: riportare metriche in stile update-miss e falsi-allarmi-per-passo separatamente dall'accuratezza; PIS mostra che le note obsolete gonfiano i falsi allarmi (Naive RAG FA 57,5), a supporto di un richiamo filtrato per stato (mai presentare righe cancellate/sostituite come correnti).
- **CAMBIARE, D28**: PIS ha solo `pending/done/canceled`; il nostro `unresolved` (scaduto, esito ignoto) va davvero oltre — conferma la novità di H1, nessun cambiamento necessario, ma scriverlo esplicitamente in RESEARCH_NOTES.
- **EVITARE**: non copiare la channel Observation (polling lato agente) - fuori ambito per un servizio di memoria; non trattare i numeri di PIS come evidenza per la memoria di piani dell'utente.
