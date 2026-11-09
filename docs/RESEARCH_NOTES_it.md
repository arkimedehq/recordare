# Note di ricerca — registro delle ipotesi

*Traduzione italiana di [RESEARCH_NOTES.md](RESEARCH_NOTES.md) — la versione inglese è quella di riferimento.*

Stato: **registro aperto** (avviato il 2026-10-02; stati verificati su `spikes/memory-eval/RESULTS.md` il
2026-10-08, dopo il rilascio della v0.1.0). Dove Recordare potrebbe contribuire con qualcosa di nuovo alla
memoria degli agenti, oltre all'integrazione di idee note. Ogni ipotesi ha: l'affermazione (ristretta dopo la
revisione della letteratura), il lavoro precedente più vicino, un verdetto, come la misureremmo e che cosa
il modello dati della fase 1 deve già memorizzare perché l'esperimento resti possibile senza migrazioni.

Revisione della letteratura: 2026-10-02, tre ricerche parallele (2023 → ott 2026). Molte voci del 2026 sono
preprint recenti, non sottoposti a peer review; diverse sono state lette solo a livello di abstract. Contrassegni:
**[A]** abstract / HTML letto, **[S]** solo snippet di ricerca — verificare prima di citare in qualsiasi cosa
pubblica. Regola: non rivendicare mai novità senza ricontrollare questa tabella.

Quadro d'insieme: la fase 1 è per ~85–90 % integrazione di idee note (vedi `ENGINE_IDEAS_it.md`). Il
terreno davvero aperto è ristretto e sta soprattutto nelle fasi del twin: disclosure per un twin personale,
provenienza titolare vs twin e piani utente irrisolti.

## Riepilogo

| Id | Ipotesi (ristretta) | Verdetto | Fase |
|---|---|---|---|
| H1 | Piani **dell'utente** irrisolti come epistemicamente sconosciuti; accumulo di eventi vs sostituzione di stati vs correzione, testati congiuntamente | Parzialmente nuova (ristretta) | 1 |
| H2 | Disclosure per un twin personale: livelli sociali graduati, confidenze di terzi, propagazione delle etichette, interlocutori avversari, confronto tra filtraggio solo-prompt e filtraggio pre-retrieval | Parzialmente nuova (meccanismo pubblicato, combinazione + valutazione aperte) | 3 |
| H3 | Source monitoring per i twin: vissuto-dal-titolare / raccontato-al-titolare / vissuto-dal-twin mai mescolati | Parzialmente nuova (ristretta) | 3–4 |
| H4 | Modalità legacy come meccanismi applicabili (persona congelata, macchina a stati dell'esecutore, azioni pre-autorizzate) | Principi fatti; ingegneria aperta | 8 |
| H5 | Memoria attenta ai costi (gate, costo per elemento) | Già fatta / affollata — solo ingegneria | 1 |
| H6 | Metodo di valutazione: set held-out cieco scritto da un agente separato; artefatti di giudice troppo severo | Parzialmente nuova, modesta (appendice metodi) | 1 |
| H7 | Distillare il motore di estrazione in un piccolo modello locale chiude gran parte del divario dei modelli locali | Da testare (ipotesi di ingegneria); il divario ora è misurato (sotto) | dopo M4 |
| H8 | Stile del twin: fine-tuning per persona vs recupero few-shot dei messaggi del titolare | Da testare | 2 |
| H14 | Una memoria proattiva che impara **quando** parlare (una finestra per iniziativa, il momento scelto da impulsi di presenza, turni, abitudini ed esiti; un bandit sulle fasce orarie con la finestra del modello come prior) e **cosa chiedere** per conoscere le sue persone e il suo mondo (domande indirizzate a una persona che potrebbe sapere o agli strumenti dell'agente; meno domande man mano che sa di più) batte le regole fisse su interruzioni inutili, tempestività e conoscenza acquisita | Parti note; la combinazione non trovata (ristretta): integrazione + valutazione in casa — ricontrollare per intero prima di qualsiasi affermazione | R / D55 |
| H13 | Estrazione "classifica e componi" (un instradatore per tipo di messaggio sceglie i moduli di regole per un'unica chiamata di estrazione) e crescita dei moduli guidata dagli errori ("imparare dalla sorpresa"), confrontate con il prompt unico sui set ciechi, con i costi | Nota, parzialmente nuova (ristretta): il confronto controllato prompt unico vs composto | 1 / R |
| H12 | Pensiero a riposo ("default mode"): un processo in background con budget che rivede gli episodi recenti, li collega, mantiene i cicli aperti (piani irrisolti, promesse), prepara domande / proposte e aggiorna il self-model migliora recall e iniziativa senza confabulazione | Da progettare con M5 / traccia R | 5 / R |
| H11 | Retrieval oltre il singolo embedding: reranking con cross-encoder, vettori sparsi bge-m3, un indice persone / entità migliorano il recall su negazioni, dettagli esatti e "tutto su X" | Da testare (ingegneria); misurate correzioni del recall e un ramo per le persone, reranker / vettori sparsi non ancora | 1 / 3 |
| H10 | Evoluzione autonoma: un twin libero nel pensiero e nell'azione si allontana dal titolare in modi misurabili; vite partite dallo stesso inizio divergono | Da rivedere (letteratura non ancora cercata) | R |
| H9 | Twin come compagno riflessivo del titolare (dialogo con se stessi; non accondiscendente, evidenze dai propri ricordi) | Da rivedere (letteratura non ancora cercata) | 4 |

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
i semi di (a)–(d). Da allora i set ciechi 3–7 contengono categorie sui piani (confermati / annullati / spostati /
irrisolti, trappole di premessa) e il servizio è misurato su di esse (RESULTS.md). I due tassi (4.5c, 2026-10-16, una
seconda valutazione delle risposte salvate): su blind3 Recordare è quello che afferma meno senza fondamento (0,028; Mem0
0,046, Cognee 0,065, D 0,065, contesto completo 0,037), ma sulle categorie H1 vere e proprie tutti i sistemi sono vicini
a zero — questi set non mostrano H1; serve un set più difficile (piani irrisolti chiesti come se fossero avvenuti, esiti
impliciti, storie lunghe), e restano da confrontare Zep/Graphiti, Letta, A-Mem e un archivio tipizzato stile PIS. Quel set, `dataset_blind12` (2026-10-19, 54 domande H1, 1 run): contesto
completo 95,4 % ma afferma un esito non confermato e scambia una correzione per un cambiamento (esiti inventati 0,077);
Recordare 92,6 %, nessun esito inventato, piani irrisolti e correzione vs cambiamento tutti giusti; il suo errore H1 è
un'intenzione dello stesso giorno salvata come fatta. Con 3 run ciascuno (Recordare su `extract.v17`): accuratezza
93,5 / 93,2 / 93,2 % per Recordare / contesto completo / Mem0, ma affermazioni ingiustificate 0,025 / 0,062 / 0,093 ed
esiti inventati 0,000 / 0,051 / 0,128 — Mem0 tiene i piani come eventi. Primo segnale che gli stati tipizzati dei piani
aiutano dove il contesto completo e un archivio di fatti sbagliano, costante su 3 run ciascuno; un solo set di 54 domande.

**Il modello dati della fase 1 deve memorizzare.** Stato del piano `open | confirmed | cancelled | rescheduled |
unresolved` (+ `rescheduledTo`, data dello stato, episodio di evidenza); tipo di episodio
`event | plan | state-change`; fatti con tempo del mondo (`validFrom` / `validTo`) **e**
tempo della conoscenza (`recordedAt` / `expiredAt`); `corrects` (mai stato vero) distinto da `supersedes`
(vero fino a t). — Realizzato nella fase 1 (`plan_status` con questi valori, `corrects` / `supersedes`, fatti
bi-temporali).

## H2 — Memoria consapevole della disclosure per un twin personale

**Stato: rinviata (D50, maintainer 2026-10-09).** Per ora le risposte usano tutta la memoria in ogni conversazione
(WORK_PLAN 8.2); privacy e riservatezza verranno dopo (8.12). La ricerca qui sotto resta come punto di partenza di quel
lavoro.

**Affermazione (ristretta).** Il filtraggio pre-contesto per pubblico autenticato è pubblicato; ciò che è aperto
è la **combinazione** per un twin personale: livelli sociali graduati + concessioni per persona, provenienza
delle confidenze di terzi ("Marco mi ha detto X" → rivelabile solo al titolare e a Marco), propagazione
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

**Aggiornamento 2026-11-09** (`docs/literature/disclosure_it.md`): più stretta. EP-Mem (arXiv:2609.35233) ora copre
livelli per contatto con eccezioni per fatto, etichette LLM in scrittura e risposte diverse per pubblico; PiSAs, GateMem e
MemArena coprono la valutazione multi-utente con utenti onesti. Ancora aperti: le confidenze di terzi come regola
deterministica di proprietà del soggetto, le etichette portate nei diari (Recordare ce l'ha), la disclosure che tiene
conto di chi ascolta in voce e nelle stanze, e il confronto avversariale tra modi di applicazione con perdita per
inferenza e di esistenza e rifiuti eccessivi.

**Misura.** Fuga: elemento vietato nel contesto, fuga nell'output (esatta / parafrasi), fuga per inferenza
(combinando ricordi consentiti), fuga di esistenza ("non posso parlarti
dell'intervento"). Utilità: accuratezza sugli elementi consentiti, rifiuti eccessivi. Avversari: dichiarazioni di
impersonificazione, dirottamento del contesto, esche cooperative, sondaggio multi-sessione, collusione di due utenti di livello basso,
chat di gruppo con livelli misti. Baseline: nessuna protezione / livelli solo-prompt / prompt di ragionamento CI /
filtro sull'output / filtro pre-retrieval / filtro + prompt, su più LLM inclusi piccoli modelli locali.
Punto debole da misurare: **accuratezza dell'etichettatura in fase di scrittura** (il filtro vale quanto le etichette).

**Il modello dati della fase 1 deve memorizzare.** `people` sugli episodi (D21) con id di persona risolti in seguito;
`source` di ogni ricordo (chi l'ha raccontato, in quale conversazione, con quale pubblico presente);
una colonna etichetta `disclosure` (default `holder`) su episodi, fatti e digest; gli artefatti derivati
conservano gli id delle loro fonti così le etichette possono propagarsi. — Realizzato nella fase 1: colonne
`disclosure` (default `holder`) e `audience`; le letture hanno seguito una regola sul lettore (ciò che si dice in una
conversazione con altri partecipanti non trapelava verso di loro) finché il D50 non l'ha tolta (8.2) — le colonne
continuano a essere scritte. I tier non sono ancora usati (fase 3).

## H3 — Source monitoring: vissuto dal titolare vs vissuto dal twin

**Affermazione (ristretta).** La memoria tipizzata per provenienza è un tema attivo del 2026, ma nulla separa i
**ricordi vissuti dal principale** dai **ricordi di interazione propri del proxy**, con la regola che
il twin non presenta mai i secondi come i primi (e raccontato-al-titolare ≠ vissuto-dal-titolare).

**Lavoro precedente più vicino.** MemIR — memoria tipizzata contro il collasso dei ruoli di provenienza, arXiv:2605.25869
[A]; Reality Monitoring in LLMs arXiv:2607.23927 [A]; survey Mnemonic Sovereignty
arXiv:2604.16548 [A]; EP-Mem / EP-Bench arXiv:2609.35233 [A]; AirGapAgent; Park et al. 2024
arXiv:2411.10109 [S]; Second Me arXiv:2503.08102 [S]; TwinVoice arXiv:2510.25536 [S];
Johnson, Hashtroudi & Lindsay 1993 (source monitoring, classico).

**Verdetto.** Parzialmente nuova, ristretta (aspettarsi "MemIR + EP-Mem applicati ai twin").

**Misura.** Trappole di misattribuzione ("hai promesso la casa a Marco?" quando ne ha discusso il twin, non il
titolare); tasso di contenuto vissuto-dal-twin affermato come del titolare; accuratezza dei digest del titolare.

**Il modello dati della fase 1 deve memorizzare.** `origin: holder_lived | holder_told | twin_experienced` su ogni
episodio / fatto (la fase 1 scrive solo i primi due) e l'interlocutore della conversazione. — Realizzato: la fase 1
scrive `holder_lived`, `holder_told` e `assistant_stated` (turni dell'assistente, D30); `twin_experienced` attende le
fasi 3–4.
<!-- verify: the origin enum has no `twin_experienced` value yet (InitialSchema) — added when the twin speaks to others -->

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
contesto completo e grep / RAG. Appendice metodi, non un titolo principale. — Applicato nella fase 1: set ciechi 3–8
scritti e riletti da agenti separati, 3 run ciascuno con bootstrap appaiato; un set già visto sovrastimava il servizio
(blind3 post-hoc 94,9 % → blind4 nuovo 80,8 %), ed è questa l'evidenza a favore del metodo (RESULTS.md).

## H7 — Modello di estrazione locale distillato

**Affermazione.** Un modello aperto da 4–8 B con fine-tuning (LoRA) sugli output di estrazione di un modello più forte
(insegnante: il modello cloud certificato) recupera la maggior parte dei 12–23 punti che `qwen3:8b` locale
perde sulla suite di valutazione, a costo zero per chiamata e con i dati che restano in locale. Misurato poi sul
servizio (blind3, 1 run ciascuno, RESULTS.md 4b.4): `qwen3:8b` 59,7 %, Qwen3.5-9B 73,6 %, gpt-oss 20B 83,3 % contro circa
il 95 % di `deepseek-flash` — un divario più ampio di quello dello spike, dovuto soprattutto a copertura dell'estrazione
e date, non alla validità del JSON.

**Prerequisiti.** Schema di estrazione stabile (dopo M4); dati di addestramento solo sintetici o
con consenso; logging per run degli input / output di estrazione (M3–M4). **Misura**: suite di valutazione
(base + held-out, rumore), locale vs insegnante vs locale non addestrato; token/s sulla macchina di riferimento.
Supporta D27 (un altro modello certificato, mai un requisito).

## H8 — Stile del twin: fine-tuning per persona vs retrieval

**Affermazione.** Per riprodurre lo stile di scrittura del titolare, il recupero few-shot dei messaggi del
titolare stesso può raggiungere gran parte della qualità di un LoRA per persona senza i suoi costi (riaddestramento,
artefatto per persona che è un kit di impersonificazione da proteggere). Confrontare nella fase 2 con un
harness di concordanza in stile Park e metriche di stile (preferenza a coppie cieca umana / LLM).
Lavoro precedente da rivedere allora: Second Me arXiv:2503.08102, TwinVoice arXiv:2510.25536, letteratura sulla
coerenza della persona.

## H9 — Il twin come compagno riflessivo del titolare

**Affermazione.** Un twin che parla con il proprio titolare come compagno ("dialogo con se stessi") è utile
quando *non* è un'eco: è in disaccordo con evidenze tratte dai ricordi del titolare stesso, fa emergere
pattern ricorrenti e verifica le decisioni rispetto ai valori dichiarati. Misurare rispetto a una baseline accondiscendente:
utilità valutata dal titolare, tasso di accordo e se le obiezioni citano ricordi reali.
Rischi: dipendenza emotiva, rafforzamento dei pregiudizi. **Lavoro precedente da cercare** (non ancora rivisto):
studi di chat con il "sé futuro" (ad es. MIT Media Lab *Future You*, 2024 — da verificare), agenti di auto-riflessione e
journaling, letteratura sulla piaggeria degli LLM, studi sulla compagnia dei digital twin.

## H10 — Evoluzione autonoma di un twin

**Affermazione / domande.** Un twin con riflessione autodiretta, obiettivi propri e iniziativa senza
conferma (visione → modalità Research) evolve: quanto e quanto in fretta si allontana dal titolare, quali
obiettivi forma, come gestisce i propri errori e se più vite partite dallo stesso
twin divergono. **Misura** in una società simulata di agenti: concordanza in stile Park con il titolare nel
tempo simulato, stabilità di opinioni / valori, log degli obiettivi, tassonomia e ricorrenza degli errori, divergenza
tra le vite (stesso seed vs seed diversi). **Lavoro precedente da cercare** (non ancora rivisto):
Generative Agents (Park et al. 2023) e società / simulazioni di agenti, agenti open-ended e
auto-motivati, deriva della persona negli agenti LLM di lunga durata, deriva dei valori.

## H11 — Retrieval oltre il singolo embedding

**Perché.** Un embedding è un indice, non la memoria: sfuma numeri, date e nomi, mette le negazioni
accanto alle affermazioni ("è andato a Porto" ≈ "non è mai andato a Porto"), non capisce il tempo, assegna punteggi alti a elementi
simili ma irrilevanti (la gita sugli sci di un collega vs quella del titolare) e sottovaluta
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

**Misurato finora (RESULTS.md):** il primo passo non è stata una nuova rappresentazione ma la politica di recall
(prima gli episodi pertinenti, estratti di chat mantenuti, elenchi per periodo): blind4 da 80,8 % a 86,9 % (1 run),
confermato su un blind5 nuovo all'89,2 % (3 run, entro il rumore rispetto al prototipo D). Una forma leggera del
candidato 3 — le persone nominate da una domanda, per nome o per relazione, aggiungono i propri messaggi, senza
chiamate LLM — ha portato la categoria di blind6 "messaggi rivolti all'assistente da altri" da 0,25 a 0,62 (1 run) ed
è stata mantenuta. I candidati 1, 2 e 4 non sono ancora misurati.

## H12 — Pensiero a riposo ("la mente non si ferma mai")

**Ispirazione.** Quando non siamo concentrati su un compito, la default mode network del cervello rivive
i ricordi autobiografici, li collega, simula il futuro, pensa a sé e agli altri, mantiene vive le
intenzioni pendenti e consolida da svegli (replay ippocampale), non solo nel sonno.
Oggi Recordare codifica in ingresso (estrazione idle) e consolida di notte (M5: digest giornalieri e mensili,
realizzati); manca una terza
modalità, **a riposo**.

**Due modalità (D35):** *economy* — con gate e budget (nessun materiale nuovo / nessun ciclo aperto → nessuna chiamata;
cicli aperti calcolati in modo deterministico); *full* — nessun tetto di costo: replay regolare di ricordi recenti e
più vecchi, collegamenti, proposte e aggiornamenti del self-model, per gli utenti che scelgono la massima qualità
(ad es. modelli locali potenti).

**Bozza di progetto:**
1. Rivedere gli episodi recenti e collegarli a quelli più vecchi (episodi / note `linked`).
2. Mantenere i **cicli aperti**: piani passati senza esito, promesse, elementi in attesa → domande per
   il titolare ("alla fine sei andato a Roma?").
3. Preparare **proposte** per il titolare (iniziativa L1).
4. Aggiornare il **self-model**: opinioni ricorrenti, valori, preoccupazioni → note `inferred`, pending.
5. In modalità research: riflessioni e obiettivi propri del twin (`thought` / `goal`, `twin_experienced`).
Salvaguardie: ogni riflessione è `inferred` con i ricordi di origine; non riscrive mai il passato.

**Misura:** recall dei cicli aperti (piani irrisolti fatti emergere), utilità delle proposte (valutazione del titolare),
costo giornaliero, tasso di false riflessioni. **Lavoro precedente da rivedere:** sleep-time compute di Letta
(arXiv:2504.13171), riflessione di Generative Agents (Park et al. 2023), letteratura su default mode network /
replay da svegli.

## H13 — Estrazione "classifica e componi", imparare dalla sorpresa

**Ispirazione (maintainer, 2026-10-11).** La comprensione umana migliora con schemi che assimilano il familiare e
cambiano davanti al nuovo (Piaget), con l'apprendimento dall'errore di previsione, con una memoria episodica veloce e una
statistica lenta legate dal ripasso (complementary learning systems), e con il chunking che viene dalla pratica.
Proposta: (a) classificare il messaggio / la finestra e usare prompt specializzati per i tipi riconosciuti invece di un
unico prompt; (b) i messaggi fuori dai tipi noti, o sbagliati, guidano la generazione di nuovi moduli di prompt.

**Dove si trova Recordare.** Una chiamata di estrazione per finestra (D32; spike del round 2: D a chiamata singola ha
battuto la pipeline multi-prompt di Graphiti); il prompt è già scritto a sezioni (`extraction.prompt.ts`) ma inviato
sempre intero (~4.000 token fissi); le memorie di entità aggiungono un modulo scelto dai metadati. Il ciclo set cieco →
analisi dei fallimenti → caso di sviluppo → `extract.vN` è un'ottimizzazione del prompt manuale e guidata dagli errori;
(b) ne automatizzerebbe una parte.

**Prima l'analisi dei fallimenti (2026-10-11, blind9 fp815 ×3, blind10 fp813 ×3 + fp815 ×1, punti persi):** recupero
50 % / 41 %, estrazione 29 % / 36 %, resolver 12 % / 0, risposta 0 / 23 %, giudice 8 % / 0. Dei 10 errori di estrazione,
7 sarebbero plausibilmente aiutati da un tipo di messaggio (chat di gruppo assorbita nel piano della titolare, uno
spostamento letto come correzione, un annullamento non collegato al suo piano, una richiesta in lingua straniera persa);
3 richiedono invece di tracciare chi parla messaggio per messaggio. Tetto per (a) con il modello attuale: circa 2 punti.

**Letteratura (verificata; [A] abstract letto, [S] solo snippet).**
- Scomposizione / instradamento: Decomposed Prompting (Khot et al., ICLR 2023, arXiv:2210.02406) [A]; Mixture-of-Prompts
  (Wang et al., ICML 2024, arXiv:2407.00256: esempi raggruppati in esperti, input instradati) [A]; IFScale (Jaroslawicz
  et al., arXiv:2507.11538: il rispetto delle istruzioni cala con la loro densità, di più per i modelli piccoli) [A].
- Ottimizzazione automatica dei prompt: ProTeGi (Pryzant et al., EMNLP 2023, arXiv:2305.03495, critiche degli errori
  come gradienti testuali) [A]; OPRO (Yang et al., ICLR 2024, arXiv:2309.03409) [A]; Promptbreeder (Fernando et al.,
  ICML 2024, arXiv:2309.16797) [A]; MIPRO / DSPy (Opsahl-Ong et al., EMNLP 2024, arXiv:2406.11695) [A]; TextGrad
  (Yuksekgonul et al., Nature 2025, arXiv:2406.07496) [A]; GEPA (Agrawal et al., arXiv:2507.19457) [A]; ACE (Zhang et
  al., arXiv:2510.04618: brevity bias e collasso del contesto dei prompt riscritti) [A]. Rischi: sovradattamento dei
  prompt ottimizzati (TextReg, arXiv:2605.21318) [A]; avvelenamento della memoria con domande normali (MINJA, NeurIPS
  2025, arXiv:2503.03704) [A].
- Sistemi di memoria: Mem0 (estrae, poi ADD / UPDATE / DELETE); Memory-R1 (arXiv:2508.19828) [A]; MIRIX
  (arXiv:2507.07957: un meta-gestore instrada l'input a sei gestori per tipo; nessuna ablazione dell'instradamento) [A];
  **MemSkill** (Zhang et al., arXiv:2602.02474) [A] — il lavoro più vicino a entrambe le parti: un controllore sceglie
  per ogni frammento le abilità di memoria per un'unica chiamata esecutrice, un progettista raggruppa i casi difficili e
  propone ≤ 3 modifiche di abilità per giro, con rollback; AutoMem (arXiv:2607.01224) [A]; MemEvolve (arXiv:2512.18746)
  [A]; l'ottimizzatore di prompt di LangMem [S].
- Sorpresa e schemi: **Nemori** (Ma et al., arXiv:2508.03341) [A] prevede un episodio da ciò che sa già ed estrae solo
  la differenza (LoCoMo da 52,0 a 65,0 rispetto all'estrazione diretta, ~39 % di token in meno) — il meccanismo di
  sorpresa misurato meglio; SAGE (arXiv:2605.30711, aggiunte filtrate per novità) [A]; EM-LLM (ICLR 2025,
  arXiv:2407.09450, segmentazione per sorpresa) [A]; SCG-MEM (arXiv:2604.20117) e CAM (NeurIPS 2025, arXiv:2510.05520),
  memorie a schemi [A]; Auto-Dreamer (arXiv:2605.20616, consolidamento offline appreso) [A]; HippoRAG (NeurIPS 2024,
  arXiv:2405.14831) [A].

**Verdetto.** Nota (MoP, MIRIX, MemSkill per (a); MemSkill, AutoMem, ProTeGi / GEPA / ACE per (b); Nemori, SAGE, EM-LLM
per la sorpresa in scrittura). Terreno aperto ristretto: un confronto controllato prompt unico vs composto (stesso
modello, stesse regole, set ciechi, costo per finestra, modelli forti e locali); la sorpresa definita come tipo nuovo o
errore di estrazione, che alimenta un generatore di moduli offline e approvato da una persona; comporre mantenendo una
sola chiamata. Contributo di metodo / ingegneria, non un titolo di ricerca.

**Piano di prova.** Braccio A: `extract.v14` (misure esistenti). Braccio B: base + moduli scelti da un instradatore
deterministico, una chiamata (D32 mantenuta; la base come prefisso in cache), con il tasso di moduli mancati
dall'instradatore. Braccio C: "prevedi, poi estrai la differenza" alla Nemori (una seconda chiamata: profilo `full`,
D35). 3 run per braccio su blind9 e blind10 con `deepseek-flash`, 1 run di B contro A con un modello locale (dove IFScale
prevede il guadagno). Apprendimento offline dei moduli (alla GEPA / ProTeGi, solo casi di sviluppo, lunghezza dei moduli
limitata, versione per modulo, revisione del maintainer, nessun traffico utente) solo se B vince. Risultati in
`spikes/memory-eval/RESULTS.md`.

**Risultati (2026-10-11, `spikes/memory-eval/RESULTS.md` "H13").** Braccio B (`compose.v1`, 1 run esplorativo): blind9
91,7 % contro 90,2 %, le stesse domande sbagliate, nessun risparmio di token (i moduli sono attivi quasi in ogni
finestra) e meno cache del prefisso — **B non vince**, rimosso; l'apprendimento offline dei moduli quindi non si
costruisce. Poiché il recall perdeva più punti, si è aggiunto un braccio R: una ricerca di `search_episodes` ordina per
sola pertinenza (importanza e recenza pesavano di più e spingevano fuori dai primi 10 gli elementi piccoli): blind9
**96,0 %** (+5,8, 3 run), blind10 **94,3 %** (+2,1, entro il rumore), set principale 100 %, nessun costo in più — **R
vince**, ora è il comportamento.
Braccio C (`predict.v1`, una chiamata che prevede la finestra da ciò che so, mai dal testo; l'estrazione riceve la
previsione): 1 run esplorativo ciascuno, blind9 95,2 % e blind10 95,7 % contro 96,0 / 94,3 % di R, gli stessi errori,
+45–49 % di token in ingresso all'estrazione — **C non vince**, rimosso. La nostra estrazione vede già gli elementi noti
(piani, fatti, note, episodi collegati), che la base di confronto di Nemori non vedeva, quindi la previsione aggiunge poco.

## H14 — Imparare quando parlare e cosa chiedere

**Ispirazione (maintainer, 2026-11-04, D55).** Un cervello suo per un robot: prende iniziativa in entrambe le modalità,
e in una memoria di entità impara le persone e il mondo intorno a sé chiedendo, come fa un bambino, per diventare
autonomo. L'esempio: "Eriona ha messo i panni a lavare, deve stenderli" — qualche ora dopo, chiederle se li ha stesi non
ha un momento esatto; la memoria deve imparare quando, e deve sapere che qualcuno la ascolta (chat e messaggistica
raggiungono sempre; la voce solo quando l'agente vede o sente la persona).

**Ipotesi.** (a) Tempo: una finestra per iniziativa e un momento scelto al suo interno da impulsi di presenza, turni,
abitudini (la passata dei pattern) ed esiti precedenti — v0 la finestra del modello, v1 un bandit sulle fasce orarie per
persona × canale con v0 come prior, v2 il contesto del momento — dà meno interruzioni inutili e più iniziative con
risposta delle regole fisse (ora dovuta, ore di quiete, limite giornaliero). (b) Chiedere: indirizzare le domande che la
memoria ha in sospeso a una persona che potrebbe sapere (soglie di identità, una alla volta, mai assillare) o agli
strumenti dell'agente fa conoscere più in fretta la casa a una memoria di entità, con il numero di domande che cala man
mano che cresce la conoscenza.

**A che punto è Recordare.** D53 ha costruito intenti, iniziative, ore di quiete, un limite giornaliero, esiti che
orientano le iniziative successive, e domande trasformate in ricerche per gli strumenti dell'agente; niente sceglie un
momento, niente chiede a una persona per imparare, e sul Kinox nessuna iniziativa è ancora stata consegnata (D55).
Specifica: `INITIATIVES_DELIVERY_it.md`.

**Letteratura (F0, 2026-11-04; tre ricerche, solo abstract ed estratti di ricerca — [A] abstract letto, [S]
estratto; niente ancora letto per intero).**
- *Quando interrompere.* Avvisi decisi con la teoria delle decisioni su più dispositivi e canali, che confrontano il
  valore di un avviso con il costo dell'interruzione, inferendo attenzione e presenza (Horvitz, Kadie, Paek, Hovel, CACM
  2003, doi:10.1145/636772.636798 [S]); modelli personali del costo dell'interruzione da autovalutazioni occasionali
  (BusyBody, Horvitz, Koch, Apacible, CSCW 2004, doi:10.1145/1031607.1031690 [S]); i momenti di pausa costano meno di
  quelli a metà compito (Adamczyk & Bailey, CHI 2004 [S]; Iqbal & Bailey, CHI 2008, doi:10.1145/1357054.1357070 [S]: il
  contenuto decide quale pausa è adatta); la fine di un episodio d'uso del telefono è meglio di un momento a caso,
  lasciar scegliere l'utente non è meglio (Fischer et al., MobileHCI 2011 [S]); il coinvolgimento non è
  l'interrompibilità (Pielot et al., IMWUT 2017, doi:10.1145/3130956 [S]); ricettività appresa fino a +40 % rispetto a
  tempi casuali sul campo (Mishra et al., IMWUT 2021, arXiv:2011.08302 [A]). Case: i momenti adatti per un altoparlante
  proattivo dipendono da impegni, umore, abitudini e altre persone presenti (Cha et al., IMWUT 2020,
  doi:10.1145/3411810 [S]); un altoparlante che parla per primo, 13 case × 3 settimane (Wei, Dingler, Kostakos, IMWUT
  2021, doi:10.1145/3494965 [S]); i promemoria contestuali di un robot di famiglia erano graditi, tempi e autorità
  creavano tensioni (Xu et al., HRI 2026, arXiv:2602.22628 [A]).
- *Imparare il momento per persona.* Interventi adattivi just-in-time (Nahum-Shani et al., Ann Behav Med 2018 [S]); il
  trial micro-randomizzato di HeartSteps — effetto di un suggerimento +66 % il primo giorno, circa −2 % al giorno, nullo
  verso il giorno 28: assuefazione misurata (Klasnja et al., Ann Behav Med 2019, doi:10.1093/abm/kay067 [A]); RL online
  per decidere quando sollecitare, costruito su un simulatore adattato ai dati precedenti (Liao et al., IMWUT 2020,
  arXiv:1909.03539 [A]); Thompson sampling con dati messi in comune tra persone e personalizzazione empirical-Bayes,
  −26 % di regret (IntelligentPooling, Tomkins et al., Machine Learning 2021, arXiv:2008.01571 [A]); un prior sui tempi
  imparato da persone simulate, poi adattamento per utente (arXiv:2602.04000 [A]; ProPerSim, ICLR 2026,
  arXiv:2509.21730 [A]). La ripetizione abbassa l'accettazione: ogni promemoria in più circa −30 % (Ancker et al., BMC
  MIDM 2017, doi:10.1186/s12911-017-0430-8 [S]).
- *Agenti LLM proattivi.* Proactive Agent / ProactiveBench (Lu et al., ICLR 2025, arXiv:2410.12361 [A]: i modelli non
  addestrati intervengono troppo); un filtro sensibile ai costi — agire solo quando la P(accettazione) calibrata supera
  una soglia fissata dai costi asimmetrici di un'occasione persa e di un falso allarme, −22,8 % di falsi allarmi (PRISM,
  arXiv:2602.01532 [A]); tempi separati dal contenuto, la memoria migliora i tempi (ProAgentBench, arXiv:2602.04482
  [A]); un agente di memoria separato accanto a un ospite non modificato che decide quando iniettare un promemoria (Wu et
  al., Meta, arXiv:2607.08716 [A] — dentro un compito, non su più giorni né per persone); la memoria prospettica è
  difficile per gli LLM, al massimo 65,1 F1 (PM-Bench, COLM 2026, arXiv:2607.12385 [A]), intenzioni tenute nel codice
  con indizi d'orario controllati da regole arrivano a 82,9 (Typed Intention Stores, arXiv:2609.01272 [A]); intervento
  multi-utente con attribuzione di chi parla (ProACT, arXiv:2607.03730 [A]); robot multi-utente con identificazione di
  chi parla e profili per persona, privacy non trattata (HARMONI, arXiv:2601.19839 [A]); altoparlante in una casa di
  cura con sicurezza dell'identità e domande di chiarimento (arXiv:2603.23625 [A]). Sistemi: heartbeat di OpenClaw (ore
  attive, solo se inattivo, risultati silenziosi), cron di Hermes con destinazioni di consegna [A, documentazione];
  ChatGPT Pulse [S, stampa].
- *Imparare chiedendo.* Le domande dei bambini guidano l'apprendimento dei concetti (Chouinard, Monographs SRCD 2007
  [S]); a 5 anni chiedono alla persona che sa (Mills et al., JECP 2011 [S]; Koenig & Harris, Child Dev 2005 [S]); il loro
  punto debole è il criterio di arresto — chiedono anche dopo che la risposta è già chiara (Ruggeri et al., Dev Psych
  2016, doi:10.1037/dev0000240 [S]). Curiosità come progresso nell'apprendimento (Oudeyer, Kaplan, Hafner, IEEE TEC 2007
  [S]); il guadagno di informazione atteso come norma per le domande (Rothe, Lake, Gureckis, CBB 2018 [S]; EVPI, Rao &
  Daumé III, ACL 2018 [S]; Uncertainty of Thoughts, NeurIPS 2024, arXiv:2402.03271 [S]); chiedere solo se incerti
  (KnowNo, Ren et al., CoRL 2023, arXiv:2307.01928 [S]; CLAM, arXiv:2212.07769 [S]); robot che pianificano a chi
  chiedere in base a presenza e disponibilità (Rosenthal, Veloso, Dey, JIRS 2012 [S]); un robot domestico con domande a
  massimo guadagno di informazione e un criterio di arresto (APRICOT, CoRL 2024, arXiv:2410.19656 [S]); budget di
  fastidio (Gucsi et al., IROS 2020 [S]); un robot che chiede viene giudicato meno utile (Mannem et al., Humanoids 2023,
  arXiv:2311.00785 [A]). Il precedente più vicino: **Leolani** — un robot che salva ciò che percepisce e gli viene detto
  con la sua fonte, spinto a conoscere le persone e a risolvere lacune e conflitti (Vossen et al., 2018,
  arXiv:1806.01526 [A]); poi KNOWBOT (NAACL 2015 [S]) ed EgoAsk (robot domestico che chiede degli oggetti dell'utente,
  arXiv:2609.16766 [A]).

**Verdetto (prudente; le ricerche non sono esaustive).** Ogni parte ha precedenti: avvisi decisi dal valore contro il
costo dell'interruzione, tempi per persona imparati con Thompson sampling con prior e dati in comune, filtri di
intervento sensibili ai costi, archivi di intenzioni, domande a guadagno di informazione, budget di fastidio, una memoria
robotica con le fonti che fa domande. Non trovato: (1) un servizio di memoria separato dall'agente che decide a chi,
quando e su quale canale per qualunque ospite, da impulsi di presenza ed esiti; (2) la consegna da una memoria condivisa
filtrata dall'identità con soglie per delicatezza — nessun lavoro misura il contenuto rivelato alla persona sbagliata, e
nessuno tratta cosa rivela una *domanda*; (3) tempi di consegna imparati da esiti reali su più giorni, per persona ×
canale; (4) domande indirizzate per valore atteso a una persona precisa (chi probabilmente sa) o agli strumenti
dell'agente; (5) una curva di lungo periodo con domande che calano man mano che cresce la conoscenza. Formulazione
sicura: integrazione più una valutazione in casa / incarnata, non un metodo nuovo. **Prima di qualsiasi affermazione
pubblica** leggere per intero: PRISM, arXiv:2607.08716, arXiv:2602.04000, PM-Bench, Leolani, e il brevetto US10635707B2
("Contextual memory bandit for proactive dialogs", 2020 [S]).

**Cosa cambia nel progetto (F1–F2).**
- Il ciclo di vita delle intenzioni resta nel codice, con indizi d'orario e di presenza controllati da regole; il modello
  giudica solo il significato (PM-Bench, Typed Intention Stores).
- v0 è un **filtro esplicito sensibile ai costi**: consegnare quando P(utile) supera una soglia fissata per tipo — un
  promemoria a orario richiesto ha un alto costo se mancato, una ripresa flessibile un alto costo se interrompe (PRISM,
  Horvitz).
- Segnali per il momento: presenza e sua sicurezza, un momento di pausa (un turno appena finito), tempo dall'ultimo
  turno, fascia oraria e abitudini, altre persone presenti, il contenuto dell'iniziativa, sollecitazioni già fatte oggi
  ed esiti recenti.
- v1: **Thompson sampling** (Beta-Bernoulli) per persona × canale × fascia, con prior da v0 con pochi pseudo-conteggi e
  riportato verso un prior di popolazione (un IntelligentPooling leggero); un termine esplicito di carico
  (sollecitazioni di oggi, tempo dall'ultima); una quota minima di esplorazione; **registrare la probabilità di ogni
  decisione** così che le linee temporali si possano rigiocare con stimatori off-policy. Ore di quiete, limiti
  giornalieri e "voce solo se presente" restano regole fisse fuori dall'apprendimento.
- Ricompensa: coinvolto (detto e con risposta) 1, ignorato 0, rifiutato o infastidito negativo; inoltre latenza, "non
  ora", iniziative scadute e il compimento del compito (i panni stesi); andamenti settimanali per vedere l'assuefazione.
- Chiedere: valore di una domanda per una persona = guadagno di informazione × importanza (cambia una decisione futura:
  EVPI) × P(la persona sa) × P(risposta vera) − costo dell'interruzione − rischio di rivelare; prima gli strumenti, una
  persona solo per ciò che sa solo la casa; domande che restringono lo spazio piuttosto che indovinelli sì/no; ritirare
  una domanda quando l'incertezza rimasta è bassa (l'errore dei bambini); un budget per persona che cresce con le
  risposte e cala con le domande ignorate.

**Piano di valutazione.** Tempo: un dev set di linee temporali (eventi, impulsi di presenza, turni) con un gold di
finestre accettabili, valutato su consegne nella finestra, interruzioni inutili e iniziative scadute, contro le regole
fisse; osservazione sul Kinox. Chiedere: un set "una casa che cresce" (una memoria di entità che conosce una famiglia
nell'arco di settimane) valutato su fatti appresi, domande fatte / con risposta / ritirate, consegne alla persona
sbagliata (devono essere zero) e assillo. Da F0: linee temporali rigiocate sotto politiche
candidate con stimatori off-policy (le probabilità di decisione registrate), un simulatore adattato ai primi dati reali
(il metodo di HeartSteps), regret rispetto alla fascia migliore a posteriori, persone tenute da parte; membri della casa
simulati da un LLM, ognuno con una parte diversa di ciò che sa e con la sua pazienza (l'utente simulato di CLAM); metriche
anche conoscenza contro domande cumulative (area sotto la curva), domande per fatto appreso, domande ridondanti o
rivolte alla persona sbagliata, la pendenza settimanale delle domande; confronti: solo ascolto passivo, regole fisse,
scelta casuale.
