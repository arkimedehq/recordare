# Note di ricerca — registro delle ipotesi

*Traduzione italiana di [RESEARCH_NOTES.md](RESEARCH_NOTES.md) — la versione inglese è quella di riferimento.*

Stato: **registro aperto** (avviato il 2026-10-02). Dove Recordare potrebbe contribuire con qualcosa di nuovo alla
memoria degli agenti, oltre all'integrazione di idee note. Ogni ipotesi ha: l'affermazione (ristretta dopo la
revisione della letteratura), il lavoro precedente più vicino, un verdetto, come la misureremmo e che cosa
il modello dati della fase 1 deve già memorizzare perché l'esperimento resti possibile senza migrazioni.

Revisione della letteratura: 2026-10-02, tre ricerche parallele (2023 → ott 2026). Molte voci del 2026 sono
preprint recenti, non sottoposti a peer review; diverse sono state lette solo a livello di abstract. Contrassegni:
**[A]** abstract / HTML letto, **[S]** solo snippet di ricerca — verificare prima di citare in qualsiasi cosa
pubblica. Regola: non rivendicare mai novità senza ricontrollare questa tabella.

Quadro d'insieme: la fase 1 è per ~85–90 % integrazione di idee note (vedi `ENGINE_IDEAS_it.md`). Il
terreno davvero aperto è ristretto e sta soprattutto nelle fasi del twin: disclosure per un twin personale,
provenienza proprietario vs twin e piani utente irrisolti.

## Riepilogo

| Id | Ipotesi (ristretta) | Verdetto | Fase |
|---|---|---|---|
| H1 | Piani **dell'utente** irrisolti come epistemicamente sconosciuti; accumulo di eventi vs sostituzione di stati vs correzione, testati congiuntamente | Parzialmente nuova (ristretta) | 1 |
| H2 | Disclosure per un twin personale: livelli sociali graduati, confidenze di terzi, propagazione delle etichette, interlocutori avversari, confronto tra filtraggio solo-prompt e filtraggio pre-retrieval | Parzialmente nuova (meccanismo pubblicato, combinazione + valutazione aperte) | 3 |
| H3 | Source monitoring per i twin: vissuto-dal-proprietario / raccontato-al-proprietario / vissuto-dal-twin mai mescolati | Parzialmente nuova (ristretta) | 3–4 |
| H4 | Modalità legacy come meccanismi applicabili (persona congelata, macchina a stati dell'esecutore, azioni pre-autorizzate) | Principi fatti; ingegneria aperta | 8 |
| H5 | Memoria attenta ai costi (gate, costo per elemento) | Già fatta / affollata — solo ingegneria | 1 |
| H6 | Metodo di valutazione: set held-out cieco scritto da un agente separato; artefatti di giudice troppo severo | Parzialmente nuova, modesta (appendice metodi) | 1 |
| H7 | Distillare il motore di estrazione in un piccolo modello locale chiude gran parte del divario dei modelli locali | Da testare (ipotesi di ingegneria) | dopo M4 |
| H8 | Stile del twin: fine-tuning per persona vs recupero few-shot dei messaggi del proprietario | Da testare | 2 |
| H12 | Pensiero a riposo ("default mode"): un processo in background con budget che rivede gli episodi recenti, li collega, mantiene i cicli aperti (piani irrisolti, promesse), prepara domande / proposte e aggiorna il self-model migliora recall e iniziativa senza confabulazione | Da progettare con M5 / traccia R | 5 / R |
| H11 | Retrieval oltre il singolo embedding: reranking con cross-encoder, vettori sparsi bge-m3, un indice persone / entità migliorano il recall su negazioni, dettagli esatti e "tutto su X" | Da testare (ingegneria) | 1 / 3 |
| H10 | Evoluzione autonoma: un twin libero nel pensiero e nell'azione si allontana dal proprietario in modi misurabili; vite partite dallo stesso inizio divergono | Da rivedere (letteratura non ancora cercata) | R |
| H9 | Twin come compagno riflessivo del proprietario (dialogo con se stessi; non accondiscendente, evidenze dai propri ricordi) | Da rivedere (letteratura non ancora cercata) | 4 |

## H1 — Piani, esiti sconosciuti, eventi vs stati, correzioni

**Affermazione (ristretta).** I sistemi di memoria per agenti e i benchmark esistenti trattano i piani o come to-do
propri dell'agente (trigger → fatto) o come fatti ordinari. Nessuno rappresenta **il piano di un utente la cui
data è passata senza conferma come "non si sa se sia avvenuto"** (a cui rispondere "non so se ci sei andato", non "ci sei andato" né "non
menzionato"), e nessuno testa **insieme accumulo di eventi, sostituzione di stati e correzione retroattiva**,
inclusa la correzione (il vecchio valore non è mai stato vero) vs cambiamento (era vero fino a t).

**Lavoro precedente più vicino.**
- PM-Bench, Liu & Gabriel, COLM 2026, arXiv:2607.12385 [A] — benchmark di memoria prospettica
  (Virtual Week), cancellazioni / ripianificazioni / override; compiti lato agente, nessun esito sconosciuto.
- PIS — Typed Intention Stores, Zhao & Wu, arXiv:2609.01272 [A, PDF] — intenzioni con stato
  pending / done / canceled, ciclo di vita nel codice; architettura più vicina; nessuno stato scaduto-sconosciuto.
- StateMemBench, Fan et al. (UIUC), arXiv:2608.19652 [A] — stato in evoluzione, sonde anti-trappola e di
  accumulo; nessuna tipizzazione esplicita evento/stato, nessun esito dei piani.
- STALE, arXiv:2605.06527 [A] — conflitti impliciti, resistenza alle premesse.
- LongMemEval arXiv:2410.10813, LoCoMo arXiv:2402.17753, BEAM arXiv:2510.27246, TReMu
  arXiv:2502.01630 — astensione = informazione mai menzionata (non piani irrisolti).
- TSM (Temporal Semantic Memory) arXiv:2601.07468 [A] — tempo dell'evento vs tempo del dialogo, stati durativi.
- Zep / Graphiti arXiv:2501.13956, Mem0 arXiv:2504.19413 — aggiornamenti bi-temporali / CRUD; ogni
  fatto è uno stato.
- Precedenti linguistici: TimeML (OCCURRENCE / STATE / I_STATE / I_ACTION); FactBank (Saurí &
  Pustejovsky) valore di fattualità CTu "certain but unknown output" [S].
- Scienze cognitive: output monitoring, Scullin, Bugg & McDaniel 2011 [S]; paradigma Virtual Week.

**Verdetto.** Parzialmente nuova, ristretta. Non rivendicare il "ciclo di vita dei piani" (PM-Bench, PIS esistono).

**Misura.** Categorie di benchmark (haystack multi-sessione, in stile LongMemEval per
confrontabilità): (a) risoluzione dei piani — confermato / cancellato / ripianificato / irrisolto, chiesto
dopo la data, comprese le conferme implicite; (b) trappole di premessa ("com'era Roma?" quando il viaggio è stato cancellato
o è irrisolto); (c) coppie di item accumulo vs sostituzione con controlli anti-trappola; (d) correzione
vs cambiamento, domande bi-temporali "come detto" vs "come vero". Metriche: valutazione a pool chiuso
(corretto / obsoleto-o-assunto / astenuto), **tasso di asserzioni ingiustificate**, **tasso di
astensione eccessiva**, Set-F1 per le liste, costo per utente. Baseline: contesto completo, RAG semplice, Mem0,
Zep/Graphiti, Memobase, Letta, A-Mem, un archivio tipizzato in stile PIS. I nostri due dataset contengono già
i semi di (a)–(d).

**Il modello dati della fase 1 deve memorizzare.** Stato del piano `open | confirmed | cancelled | rescheduled |
unresolved` (+ `rescheduledTo`, data dello stato, episodio di evidenza); tipo di episodio
`event | plan | state-change`; fatti con tempo del mondo (`validFrom` / `validTo`) **e**
tempo della conoscenza (`recordedAt` / `expiredAt`); `corrects` (mai stato vero) distinto da `supersedes`
(vero fino a t).

## H2 — Memoria consapevole della disclosure per un twin personale

**Affermazione (ristretta).** Il filtraggio pre-contesto per pubblico autenticato è pubblicato; ciò che è aperto
è la **combinazione** per un twin personale: livelli sociali graduati + concessioni per persona, provenienza
delle confidenze di terzi ("Marco mi ha detto X" → rivelabile solo al proprietario e a Marco), propagazione
delle etichette agli artefatti derivati (digest, note, profilo ereditano l'etichetta più restrittiva tra le
fonti), livello ricavato solo dal binding del canale (in caso di dubbio, pubblico), e una **valutazione** che
confronta le difese solo-prompt con il filtraggio pre-retrieval su fuga di informazioni e utilità con
interlocutori avversari.

**Lavoro precedente più vicino.**
- "Authorization Before Context", Sibo Liu, arXiv:2608.17148 [A, HTML] — **il più vicino**: tag di
  pubblico in fase di scrittura, insieme dei visualizzatori dai metadati del canale, fallback a pubblico; insiemi non livelli, nessuna
  gestione dei terzi, nessun avversario, nessun confronto solo-prompt, nessun codice.
- AirGapAgent, Bagdasarian et al. (Google), arXiv:2405.05175 [S] — restringere i dati prima che l'agente
  incontri il terzo (minimizzatore LLM, non etichette).
- Collaborative Memory arXiv:2505.18279 [A]; AIM / MUMBench arXiv:2609.12320 [A] — memoria
  multi-utente con ACL / privato-pubblico; aziendale o a due livelli.
- CIMemories (Meta, ICLR 2026) arXiv:2511.14937 [A]; MuPPET arXiv:2606.23217 [A] (fuga di memoria
  multi-parte 23–70 %, difese solo-prompt); ConFaIde arXiv:2310.17884 [A]; PrivacyLens
  arXiv:2409.00138 [S]; SOTOPIA-ToM arXiv:2605.02307 [A].
- Terzi: IDP-Bench arXiv:2606.09908 [A] (solo valutazione); etichette di pubblico: CIDER
  arXiv:2608.09164 [A].
- Avversari: ConVerse arXiv:2511.05359 [A]; FLOWSEAL arXiv:2609.14003 [A]; MAGPIE
  arXiv:2510.15186 [S].
- Controllo del flusso informativo: FIDES arXiv:2505.23643 [S], CaMeL arXiv:2503.18813 [S].
- Delegati sociali: "AI Delegates with a Dual Focus" (Microsoft) arXiv:2409.17642 [A].

**Verdetto.** Parzialmente nuova. Il solo meccanismo non è nuovo; lo sono la combinazione specifica per il twin e
la sua valutazione.

**Misura.** Fuga: elemento vietato nel contesto, fuga nell'output (esatta / parafrasi), fuga per inferenza
(combinando ricordi consentiti), fuga di esistenza ("non posso parlarti
dell'intervento"). Utilità: accuratezza sugli elementi consentiti, rifiuti eccessivi. Avversari: dichiarazioni di
impersonificazione, dirottamento del contesto, esche cooperative, sondaggio multi-sessione, collusione di due utenti di livello basso,
chat di gruppo con livelli misti. Baseline: nessuna protezione / livelli solo-prompt / prompt di ragionamento CI /
filtro sull'output / filtro pre-retrieval / filtro + prompt, su più LLM inclusi piccoli modelli locali.
Punto debole da misurare: **accuratezza dell'etichettatura in fase di scrittura** (il filtro vale quanto le etichette).

**Il modello dati della fase 1 deve memorizzare.** `people` sugli episodi (D21) con id di persona risolti in seguito;
`source` di ogni ricordo (chi l'ha raccontato, in quale conversazione, con quale pubblico presente);
una colonna etichetta `disclosure` (default `owner`) su episodi, fatti e digest; gli artefatti derivati
conservano gli id delle loro fonti così le etichette possono propagarsi.

## H3 — Source monitoring: vissuto dal proprietario vs vissuto dal twin

**Affermazione (ristretta).** La memoria tipizzata per provenienza è un tema attivo del 2026, ma nulla separa i
**ricordi vissuti dal principale** dai **ricordi di interazione propri del proxy**, con la regola che
il twin non presenta mai i secondi come i primi (e raccontato-al-proprietario ≠ vissuto-dal-proprietario).

**Lavoro precedente più vicino.** MemIR — memoria tipizzata contro il collasso dei ruoli di provenienza, arXiv:2605.25869
[A]; Reality Monitoring in LLMs arXiv:2607.23927 [A]; survey Mnemonic Sovereignty
arXiv:2604.16548 [A]; EP-Mem / EP-Bench arXiv:2609.35233 [A]; AirGapAgent; Park et al. 2024
arXiv:2411.10109 [S]; Second Me arXiv:2503.08102 [S]; TwinVoice arXiv:2510.25536 [S];
Johnson, Hashtroudi & Lindsay 1993 (source monitoring, classico).

**Verdetto.** Parzialmente nuova, ristretta (aspettarsi "MemIR + EP-Mem applicati ai twin").

**Misura.** Trappole di misattribuzione ("hai promesso la casa a Marco?" quando ne ha discusso il twin, non il
proprietario); tasso di contenuto vissuto-dal-twin affermato come del proprietario; accuratezza dei digest del proprietario.

**Il modello dati della fase 1 deve memorizzare.** `origin: owner_lived | owner_told | twin_experienced` su ogni
episodio / fatto (la fase 1 scrive solo i primi due) e l'interlocutore della conversazione.

## H4 — Modalità legacy

**Affermazione.** I principi sono pubblicati; i meccanismi applicabili no: persona congelata con un
log post-mortem separato, attivazione dell'esecutore come macchina a stati, liste di azioni pre-autorizzate,
salvaguardie per il lutto come politiche, il divieto scritto dell'art. 2-terdecies come campo.

**Lavoro precedente.** Hollanek & Nowaczyk-Basińska, Philosophy & Technology 2024,
doi:10.1007/s13347-024-00744-w [S, letto il comunicato stampa]; Morris & Brubaker, "Generative Ghosts",
CHI 2025, arXiv:2402.01662 [A]; Spitale & Germani arXiv:2511.20094 [A]; Manning et al.
arXiv:2605.21390 [A]; considerando 27 GDPR; codice privacy italiano art. 2-terdecies.

**Verdetto.** Principi fatti; solo contributo di ingegneria. Da riprendere nella fase 8.

## H5 — Memoria attenta ai costi

**Verdetto.** Già fatta / affollata: MemDelta arXiv:2606.29914 [A], MERIT arXiv:2609.05441 [A],
Zero-Mem arXiv:2607.29377 [A], LightMem arXiv:2510.18866 [S], Sleep-time compute
arXiv:2504.13171 [S], Mem0 arXiv:2504.19413 [A]. Riportiamo token / $ del percorso di scrittura e di lettura
per elemento memorizzato e per query come risultati di ingegneria, citando questi lavori. Nessuna rivendicazione di ricerca.

## H6 — Metodologia di valutazione

**Verdetto.** Critica generale già fatta (disputa Zep vs Mem0; audit di LoCoMo di Penfield Labs — 6,4 % di risposte
gold sbagliate, giudici indulgenti; Thakur et al. arXiv:2406.12624 [S]; MemDelta). Parzialmente nuova e
modesta: il **set held-out cieco scritto da un agente separato** che non ha mai visto i prompt, e
l'artefatto del **giudice troppo severo** (regole must-not che penalizzano risposte corrette), l'opposto della
consueta indulgenza. Misurare i falsi negativi del giudice rispetto a etichette umane; più seed; baseline a
contesto completo e grep / RAG. Appendice metodi, non un titolo principale.

## H7 — Modello di estrazione locale distillato

**Affermazione.** Un modello aperto da 4–8 B con fine-tuning (LoRA) sugli output di estrazione di un modello più forte
(insegnante: il modello cloud certificato) recupera la maggior parte dei 12–23 punti che `qwen3:8b` locale
perde sulla suite di valutazione, a costo zero per chiamata e con i dati che restano in locale.

**Prerequisiti.** Schema di estrazione stabile (dopo M4); dati di addestramento solo sintetici o
con consenso; logging per run degli input / output di estrazione (M3–M4). **Misura**: suite di valutazione
(base + held-out, rumore), locale vs insegnante vs locale non addestrato; token/s sulla macchina di riferimento.
Supporta D27 (un altro modello certificato, mai un requisito).

## H8 — Stile del twin: fine-tuning per persona vs retrieval

**Affermazione.** Per riprodurre lo stile di scrittura del proprietario, il recupero few-shot dei messaggi del
proprietario stesso può raggiungere gran parte della qualità di un LoRA per persona senza i suoi costi (riaddestramento,
artefatto per persona che è un kit di impersonificazione da proteggere). Confrontare nella fase 2 con un
harness di concordanza in stile Park e metriche di stile (preferenza a coppie cieca umana / LLM).
Lavoro precedente da rivedere allora: Second Me arXiv:2503.08102, TwinVoice arXiv:2510.25536, letteratura sulla
coerenza della persona.

## H9 — Il twin come compagno riflessivo del proprietario

**Affermazione.** Un twin che parla con il proprio proprietario come compagno ("dialogo con se stessi") è utile
quando *non* è un'eco: è in disaccordo con evidenze tratte dai ricordi del proprietario stesso, fa emergere
pattern ricorrenti e verifica le decisioni rispetto ai valori dichiarati. Misurare rispetto a una baseline accondiscendente:
utilità valutata dal proprietario, tasso di accordo e se le obiezioni citano ricordi reali.
Rischi: dipendenza emotiva, rafforzamento dei pregiudizi. **Lavoro precedente da cercare** (non ancora rivisto):
studi di chat con il "sé futuro" (ad es. MIT Media Lab *Future You*, 2024 — da verificare), agenti di auto-riflessione e
journaling, letteratura sulla piaggeria degli LLM, studi sulla compagnia dei digital twin.

## H10 — Evoluzione autonoma di un twin

**Affermazione / domande.** Un twin con riflessione autodiretta, obiettivi propri e iniziativa senza
conferma (visione → modalità Research) evolve: quanto e quanto in fretta si allontana dal proprietario, quali
obiettivi forma, come gestisce i propri errori e se più vite partite dallo stesso
twin divergono. **Misura** in una società simulata di agenti: concordanza in stile Park con il proprietario nel
tempo simulato, stabilità di opinioni / valori, log degli obiettivi, tassonomia e ricorrenza degli errori, divergenza
tra le vite (stesso seed vs seed diversi). **Lavoro precedente da cercare** (non ancora rivisto):
Generative Agents (Park et al. 2023) e società / simulazioni di agenti, agenti open-ended e
auto-motivati, deriva della persona negli agenti LLM di lunga durata, deriva dei valori.

## H11 — Retrieval oltre il singolo embedding

**Perché.** Un embedding è un indice, non la memoria: sfuma numeri, date e nomi, mette le negazioni
accanto alle affermazioni ("è andato a Porto" ≈ "non è mai andato a Porto"), non capisce il tempo, assegna punteggi alti a elementi
simili ma irrilevanti (la gita sugli sci di un collega vs quella del proprietario) e sottovaluta
lo stesso evento raccontato in breve vs in dettaglio (osservato: ~0,6 di similarità tra i due racconti della
visita dall'ortopedico). Recordare tiene già la memoria strutturata (date, stati, storia) e
fonde full-text + vettori; lo spike ha mostrato che la struttura conta più del modello di embedding.

**Candidati (ciascuno misurato sulla suite di valutazione, N ≥ 3 run, prima dell'adozione):**
1. **Reranking con cross-encoder** dei primi 20–30 candidati (ad es. `bge-reranker-v2-m3`, in coppia con
   bge-m3; locale, decine di ms) — legge insieme query e ricordo: negazioni, dettagli.
2. **Vettori sparsi (lessicali) bge-m3** accanto a quelli densi — precisione lessicale con pesi
   dei termini appresi, un solo modello.
3. **Indice persone / entità** (`people` della fase 3, alias) — "tutto su Marco" come ricerca
   esatta invece che come similarità.
4. Opzionale, più avanti: rappresentazioni multi-vettore (late interaction) per episodi lunghi.

**Misura:** recall@k degli episodi gold e accuratezza QA per categoria (negazione / dettaglio / persone),
latenza e costo; adottare solo con un guadagno significativo a latenza accettabile.

## H12 — Pensiero a riposo ("la mente non si ferma mai")

**Ispirazione.** Quando non siamo concentrati su un compito, la default mode network del cervello rivive
i ricordi autobiografici, li collega, simula il futuro, pensa a sé e agli altri, mantiene vive le
intenzioni pendenti e consolida da svegli (replay ippocampale), non solo nel sonno.
Oggi Recordare codifica in ingresso (estrazione idle) e consoliderà di notte (M5); manca una terza
modalità, **a riposo**.

**Due modalità (D35):** *economy* — con gate e budget (nessun materiale nuovo / nessun ciclo aperto → nessuna chiamata;
cicli aperti calcolati in modo deterministico); *full* — nessun tetto di costo: replay regolare di ricordi recenti e
più vecchi, collegamenti, proposte e aggiornamenti del self-model, per gli utenti che scelgono la massima qualità
(ad es. modelli locali potenti).

**Bozza di progetto:**
1. Rivedere gli episodi recenti e collegarli a quelli più vecchi (episodi / note `linked`).
2. Mantenere i **cicli aperti**: piani passati senza esito, promesse, elementi in attesa → domande per
   il proprietario ("alla fine sei andato a Roma?").
3. Preparare **proposte** per il proprietario (iniziativa L1).
4. Aggiornare il **self-model**: opinioni ricorrenti, valori, preoccupazioni → note `inferred`, pending.
5. In modalità research: riflessioni e obiettivi propri del twin (`thought` / `goal`, `twin_experienced`).
Salvaguardie: ogni riflessione è `inferred` con i ricordi di origine; non riscrive mai il passato.

**Misura:** recall dei cicli aperti (piani irrisolti fatti emergere), utilità delle proposte (valutazione del proprietario),
costo giornaliero, tasso di false riflessioni. **Lavoro precedente da rivedere:** sleep-time compute di Letta
(arXiv:2504.13171), riflessione di Generative Agents (Park et al. 2023), letteratura su default mode network /
replay da svegli.
