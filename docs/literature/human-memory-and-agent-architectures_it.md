# Memoria umana e architetture cognitive per agenti — riportate su "un cervello per qualsiasi macchina" (rassegna, 2026-10-09)

*Traduzione italiana di [human-memory-and-agent-architectures.md](human-memory-and-agent-architectures.md) — la versione inglese è quella di riferimento.*

Letto (2026-10-09): **abstract** di tutte le fonti sulla memoria umana, tramite PubMed (efetch per DOI) o la scheda
dell'editore; metadati di ogni DOI verificati su Crossref e di ogni id arXiv su arxiv.org. **Testo completo** (HTML
ar5iv) di Generative Agents, CoALA, MemGPT e Voyager; PDF completo di Laird 2022 (Soar); la sezione "memory subjects"
di Huang et al. 2026; la sezione 7 di Turing 1950 tramite la pagina dell'editore. Queste affermazioni poggiano su
**fonti secondarie** (pagine enciclopediche o di rassegna trovate con la ricerca web) perché il testo primario non era
raggiungibile: Tulving 1972 (definizioni, intervallo di pagine), Tulving 1985 (la triade anoetica / noetica /
autonoetica), i riquadri dettagliati della tassonomia di Squire, i tre livelli della base di conoscenza
autobiografica di Conway, McDaniel & Einstein 2000, Conway 2005, Johnson & Raye 1981, l'equazione base-level di
ACT-R, Nuxoll & Laird 2012. Bartlett 1932 è citato come origine classica di "schema" e non è stato riletto. Si
appoggia alla tabella "Cognitive model" di `../EPISODIC_MEMORY_TODO_it.md`, a `agent-platform-memory_it.md` (Letta,
Honcho, OpenClaw) e a H3 / H12 in `../RESEARCH_NOTES_it.md`.

## 0. La visione su cui è riportata questa scheda (maintainer, 2026-10-09)

Una memoria appartiene **all'agente stesso**: "Caino" (un account di una piattaforma cliente) ha una memoria, "Abele"
(un altro account) un'altra, isolata. Tutto ciò che entra la arricchisce: conversazioni, voce, documenti, foto, audio,
video, più avanti le telecamere e i sensori di un robot. L'agente distingue i tipi di memoria (episodi, fatti,
conoscenze, note…) e sa sempre **chi ha detto cosa e di chi è** (identità dichiarata, impronta vocale, altri metodi).
Due modalità per memoria:
- **personale**: ciò che arriva senza un'identità dichiarata è dell'agente, in prima persona, così l'agente diventa un
  gemello digitale indiretto della persona che gli parla;
- **entità**: ciò che arriva senza un'identità dichiarata appartiene a "qualcuno", a meno che sia marcato come proprio
  dell'agente (conoscenze che gli vengono date, o ciò che un robot percepisce lavorando da solo).

L'agente si sviluppa come un bambino: acquisisce dati, riconosce persone e cose, consolida di notte e più avanti ha
pensieri propri. Obiettivo: chiunque può dare un cervello a una macchina.

Nulla di questo è nuovo come aspirazione. Turing (1950, §7) proponeva già: "Instead of trying to produce a programme to
simulate the adult mind, why not rather try to produce one which simulates the child's?", e la robotica dello sviluppo
è un campo di ricerca da oltre vent'anni (Lungarella et al. 2003). Quel che segue chiede quali parti della memoria
umana e delle architetture di agenti esistenti servono alla visione, e che cosa Recordare ha già.

## 1. Memoria umana — che cosa dice la letteratura

### 1.1 Episodica vs semantica, e il "sé" nella memoria episodica
- **Tulving (1972)** ha diviso la memoria dichiarativa a lungo termine in memoria *episodica* (eventi personali e le
  loro relazioni temporali e spaziali) e memoria *semantica* (conoscenza organizzata di parole, concetti, regole), come
  due sistemi "paralleli e parzialmente sovrapposti" (fonti secondarie).
- **Tulving (1985)** ha associato tre sistemi di memoria a tre tipi di consapevolezza: procedurale con *anoetica* (non
  conoscente), semantica con *noetica* (conoscente), episodica con **autonoetica** (conoscenza di sé: rivivere "qui e
  ora qualcosa che è accaduto prima"). **Tulving (2002)**, abstract dell'Annual Review: il concetto fu definito prima in
  termini di materiali e compiti e "poi raffinato ed elaborato in termini di idee come sé, tempo soggettivo e coscienza
  autonoetica".
- Per noi: un episodio non è solo "cosa / quando / dove" ma **di chi era l'esperienza**. La modalità in prima persona
  della visione è esattamente un'affermazione sull'autonoesi: l'agente ricorda un evento *come proprio*.

### 1.2 Dichiarativa vs non dichiarativa (Squire)
- **Squire (2004)**: dal 1980 circa le evidenze convergono su una distinzione fra memoria "accessibile al ricordo
  consapevole" e memoria che non lo è, e poi su "più sistemi separati" (ippocampo e strutture collegate, amigdala,
  neostriato, cervelletto). La tassonomia usuale (fonti secondarie): *dichiarativa* = fatti (semantica) + eventi
  (episodica); *non dichiarativa* = abilità e abitudini procedurali, priming e apprendimento percettivo,
  condizionamento classico semplice, apprendimento non associativo. **Squire & Zola (1996)** elencano compiti di
  apprendimento non dichiarativo: apprendimento di classificazione, abilità percettivo-motorie, grammatiche
  artificiali, astrazione di prototipi.
- Per noi: tutto ciò che Recordare memorizza oggi è dichiarativo. La memoria non dichiarativa di un agente LLM vive nei
  pesi del modello e nel codice dell'host (CoALA, §2.1), che un servizio di memoria non possiede.

### 1.3 Memoria di lavoro
- **Baddeley & Hitch (1974)** hanno proposto una memoria di lavoro a più componenti; **Baddeley (2000)** ha aggiunto
  l'**episodic buffer**: un deposito temporaneo a capacità limitata "in un codice multimodale" che lega le informazioni
  dei sottosistemi *e della memoria a lungo termine* in "una rappresentazione episodica unitaria". **Cowan (2001)**: il
  limite centrale di capacità è in media "circa quattro chunk".
- Per noi: la memoria di lavoro dell'agente è la finestra di contesto del client. Ciò che Recordare inietta prima di un
  turno (il memory context) svolge il ruolo dell'episodic buffer: contenuto a lungo termine legato alla scena
  corrente. I limiti di capacità suggeriscono un'iniezione piccola e selezionata, in linea con le nostre misure (diari
  nel recall −1,9 pt, `agent-platform-memory_it.md`).

### 1.4 Memoria prospettica
- **Einstein & McDaniel (1990)** hanno costruito il paradigma di laboratorio (compiere un'azione quando si presenta un
  evento bersaglio) e non hanno trovato relazione affidabile fra prestazioni di memoria prospettica e retrospettiva:
  "alcune differenze di fondo" fra le due. **McDaniel & Einstein (2000)**, il *multiprocess framework* (abstract da
  fonti secondarie): le intenzioni si recuperano o con un **monitoraggio** strategico dell'ambiente o con un recupero
  **spontaneo, guidato da indizi**; quale prevalga dipende da compito, indizio e persona.
- **Schacter, Addis & Buckner (2007)**: immaginare il futuro usa gran parte dello stesso apparato neurale del ricordare
  il passato ("il cervello prospettico").
- Per noi: la memoria prospettica è un sistema a sé, non una variante degli episodi. I piani di Recordare con ciclo di
  vita sono memoria prospettica *del titolare*. Le due vie di recupero corrispondono a due meccanismi già
  discussi: intenzioni a tempo → uno scheduler ("monitoraggio"), intenzioni legate a un evento → un confronto con gli
  indizi al recall pre-turno ("recupero spontaneo"; standing intents di OpenClaw, `agent-platform-memory_it.md` idea 8).

### 1.5 Memoria autobiografica e il sé (Conway)
- **Conway & Pleydell-Pearce (2000)**: i ricordi autobiografici sono "costruzioni mentali transitorie" dentro un
  **self-memory system** composto da una base di conoscenza autobiografica e dagli **obiettivi correnti del working
  self**; processi di controllo modellano gli indizi di recupero; la base di conoscenza "radica" gli obiettivi e gli
  obiettivi modulano l'accesso. La base di conoscenza è organizzata su tre livelli (fonti secondarie): **periodi di
  vita**, **eventi generali**, **conoscenza specifica dell'evento**.
- **Conway (2005)** (fonti secondarie): la costruzione del ricordo bilancia la **coerenza** con il sé e la
  **corrispondenza** con ciò che è stato davvero vissuto.
- Per noi: due lezioni. (a) Una gerarchia sopra i singoli episodi (periodo → evento generale → episodio) è il modo in
  cui le persone si orientano in una vita; i nostri digest (giorno, mese) ne sono un'approssimazione cronologica, non
  periodi di vita ("quando vivevo a Milano", "la ristrutturazione della casa"). (b) Negli umani la memoria è sbilanciata
  verso la coerenza con il sé; il disegno di Recordare, append-only e legato alle evidenze, privilegia di proposito la
  corrispondenza. Un modello di sé che orienta il recall non deve riscrivere ciò che è stato vissuto.

### 1.6 Source monitoring e reality monitoring
- **Johnson & Raye (1981)**, *reality monitoring*: come le persone distinguono i ricordi di esperienze di origine
  esterna (percepite) da quelli generati internamente (immaginati, pensati) (fonti secondarie).
- **Johnson, Hashtroudi & Lindsay (1993)**, abstract PubMed: il source monitoring è un **giudizio formulato al momento
  del ricordo**, "basato sulle qualità dell'esperienza risultanti da combinazioni di processi percettivi e
  riflessivi", con "attribuzioni di diversa deliberatezza"; i giudizi "valutano l'informazione secondo criteri
  flessibili e sono soggetti a errori e disturbi". Fenomeni trattati: familiarità attribuita male, **criptomnesia**
  (prendere un'idea altrui per propria), "incorporazione della finzione nei fatti", e disturbi da confabulazione,
  amnesia e invecchiamento.
- Sviluppo: **Poole & Lindsay (2002)**, un addestramento al source monitoring ha ridotto le false segnalazioni, da parte
  di bambini di 7–8 anni, di eventi solo sentiti raccontare, ma non ha aiutato i più piccoli: una "transizione fra i 3 e
  gli 8 anni nell'uso strategico delle informazioni di source monitoring".
- LLM: **Ranjan, Sokratous & Odegaard (2026)** verificano il reality monitoring in sei LLM: l'attribuzione di contenuti
  autoprodotti vs dell'utente dipende da come è strutturata la memoria conversazionale; con un ritardo episodico il
  vantaggio si inverte, e in alcuni modelli i giudizi interno ed esterno si scambiano. La loro frase d'apertura è il
  nostro problema D38 detto in generale: "A conversational AI that cannot tell its own output from what a user said will
  treat its own mistakes as user-provided facts."
- Per noi: è il sistema umano più importante per la visione ("sa sempre chi ha detto cosa"). Gli umani **non
  memorizzano un'etichetta della fonte**: la ricostruiscono dalle caratteristiche della traccia, e sbagliano, tanto
  più da piccoli. Una macchina può fare meglio memorizzando la fonte come dato al momento della scrittura, con **come**
  è stata stabilita e quanto è sicura. H3 nomina già questo campo (e cita Johnson et al. 1993).

### 1.7 Consolidamento di sistema, sonno e replay
- **McClelland, McNaughton & O'Reilly (1995)**, *complementary learning systems* (CLS): l'ippocampo impara nuovi
  elementi rapidamente; la neocorteccia impara lentamente, e solo un apprendimento graduale e **intercalato** le
  permette di scoprire la struttura fra le esperienze senza disturbare ciò che sa; il ripristino dei ricordi
  ippocampali intercala gli elementi nuovi con quelli vecchi. **Kumaran, Hassabis & McClelland (2016)** aggiornano CLS:
  il replay permette "una ponderazione delle statistiche dell'esperienza dipendente dagli obiettivi"; l'apprendimento
  neocorticale "può essere rapido per informazioni coerenti con una struttura nota"; rilevanza esplicita per gli agenti
  artificiali. **McClelland (2013)** mostra con simulazioni che le informazioni coerenti con uno schema si imparano in
  fretta senza interferenza, mentre l'apprendimento rapido di informazioni incoerenti causa interferenza catastrofica.
- Replay e sonno: **Wilson & McNaughton (1994)**: le place cell ippocampali che si attivavano insieme durante il
  comportamento si riattivano insieme nel successivo sonno a onde lente. **Diekelmann & Born (2010)**: il sonno a onde
  lente sostiene il consolidamento di sistema (riattivazione e ridistribuzione dei ricordi dipendenti dall'ippocampo
  verso la neocorteccia); il sonno REM il consolidamento sinaptico.
- Non risolto: **Nadel & Moscovitch (1997)** (multiple trace theory) sostengono che il complesso ippocampale resta
  coinvolto nei ricordi episodici autobiografici "finché esistono", contro il modello standard in cui i ricordi
  consolidati diventano indipendenti dall'ippocampo.
- Per noi: "estrarre all'inattività, consolidare di notte" in Recordare è un disegno di forma CLS (già citato in
  `../EPISODIC_MEMORY_TODO_it.md` tramite HEMA / Active Dreaming). Una differenza conta: la nostra estrazione scrive
  fatti e note **direttamente** (in fretta) invece che per intercalazione lenta. CLS dice che è sicuro per elementi
  coerenti con lo schema (un nuovo valore di uno slot esistente) e rischioso per quelli incoerenti, ed è proprio ciò che
  già proteggono i nostri verdetti di sostituzione e gli elementi inferiti `pending`. La multiple trace theory sostiene
  il mantenere l'episodio (e il raw log) come ancora permanente degli elementi semantici, come facciamo.

### 1.8 Riconsolidamento
- **Nader, Schafe & LeDoux (2000)**: i ricordi di paura consolidati, quando riattivati, "tornano in uno stato labile"
  che richiede nuova sintesi proteica per essere di nuovo memorizzati. **Loftus & Palmer (1974)** (classico, titolo
  verificato, non riletto): la formulazione di una domanda dopo l'evento cambia ciò che i testimoni riferiscono poi.
- Per noi: Recordare di proposito **non** copia questo meccanismo (`../EPISODIC_MEMORY_TODO_it.md`, tabella del modello
  cognitivo). Gli aggiornamenti si accodano (`corrects`, `supersedes`); il recall non riscrive mai. La letteratura
  sostiene questa scelta per una memoria che deve anche fare da prova.

### 1.9 Schemi
- **Bartlett (1932)** ha introdotto gli schemi nella ricerca sulla memoria (classico, non riletto). **Tse et al.
  (2007)**: con uno schema associativo preesistente, nuove associazioni apprese in **una sola prova** sono state
  assimilate e sono diventate "rapidamente indipendenti dall'ippocampo". **Gilboa & Marlatte (2017)**: gli schemi
  "migliorano o distorcono" la memoria fin dalla codifica e accelerano l'integrazione neocorticale.
- Per noi: lo schema dei fact slot (chiavi con cardinalità e politica di fusione, idea di Memobase) e le categorie delle
  note sono schemi in questo senso: un elemento che si adatta a uno slot noto viene integrato subito. Il "o distorcono"
  di Gilboa & Marlatte è l'avvertimento: uno schema può piegare un elemento per farlo combaciare (es. trasformare un
  evento isolato in un'"abitudine").

### 1.10 Oblio
- **Anderson & Schooler (1991)** (fonti secondarie): la probabilità che un ricordo serva segue la recenza e la
  frequenza dell'uso passato nell'ambiente; l'attivazione base-level di ACT-R `B_i = ln(Σ t_j^−d)` (d di solito 0,5) lo
  codifica. **Anderson, Bjork & Bjork (1994)**: recuperare alcuni elementi fa dimenticare quelli collegati non
  recuperati (retrieval-induced forgetting). **Wixted (2004)**: l'oblio quotidiano è soprattutto interferenza
  dell'attività mentale successiva su ricordi non ancora consolidati. **Richards & Frankland (2017)**: la transitorietà
  è utile: riduce il peso delle informazioni superate e impedisce l'overfitting su eventi specifici; "lo scopo della
  memoria è ottimizzare le decisioni".
- Per noi: negli umani l'oblio serve **le decisioni**, non i limiti di spazio. Recordare tiene tutto e dimentica solo
  nel ranking (recenza, accessi) e per scelta del titolare; così ottiene il beneficio per le decisioni senza perdere
  la registrazione, purché i valori superati siano etichettati (catene di valori, stato). Il retrieval-induced
  forgetting ha un analogo macchina da tenere d'occhio: gli elementi richiamati spesso spingono in basso quelli simili
  (segnali d'uso solo per il ranking, mai per la verità, `agent-platform-memory_it.md` idea 7).

### 1.11 Sviluppo: amnesia infantile, riconoscere le persone, il sé
- **Amnesia infantile.** **Howe & Courage (1993)**: le teorie precedenti "vacillano"; la fine dell'amnesia infantile è
  legata alla comparsa di un **senso cognitivo del sé** che permette di personalizzare i ricordi degli eventi. **Nelson
  & Fivush (2004)**: la memoria autobiografica emerge gradualmente negli anni prescolari da memoria di base, linguaggio
  e narrazione, conversazioni degli adulti sui ricordi, comprensione del tempo e comprensione di sé e degli altri.
  **Josselyn & Frankland (2012)**: la mostrano anche gli animali, quindi non è solo un fenomeno umano legato al
  linguaggio; propongono come causa l'alta neurogenesi ippocampale. **Bauer (2015)**: un resoconto a processi
  complementari: sviluppo precoce e graduale della capacità di formare e recuperare ricordi personali **più** un oblio
  accelerato nell'infanzia.
- **Volti e voci.** **DeCasper & Fifer (1980)**: i neonati si impegnano (con schemi di suzione) per sentire la voce
  della madre piuttosto che quella di un'altra donna. **Johnson, Dziurawiec, Ellis & Morton (1991)**: nella prima ora di
  vita i neonati seguono più a lungo stimoli simili a volti che stimoli rimescolati; la preferenza cala nel secondo
  mese. **Pascalis, de Haan & Nelson (2002)**: a 6 mesi si distinguono singoli volti umani *e* di scimmia, a 9 mesi e
  da adulti solo quelli umani: **restringimento percettivo** con l'esperienza.
- **Il sé.** **Rochat (2003)**: cinque livelli di consapevolezza di sé si sviluppano dalla nascita ai 4–5 anni circa.
- Per noi: (a) una memoria di tipo personale ha bisogno di un **sé** e di un **cast di persone** prima che gli episodi
  diventino una storia personale organizzata; (b) il riconoscimento parte da pochi forti presupposti ed è affinato
  dall'esposizione alle persone familiari; (c) i bambini sono deboli nel source monitoring fino ai 7–8 anni circa
  (1.6). Un agente "bambino" dovrebbe quindi essere prudente nell'attribuzione all'inizio e, a differenza di un bambino,
  può **rileggere la sua prima vita** quando conosce le sue persone, perché il raw log è conservato.

## 2. Architetture cognitive per agenti

### 2.1 CoALA (Sumers, Yao, Narasimhan & Griffiths, 2023; TMLR)
- Un agente linguistico ha una **memoria di lavoro** ("una struttura dati che persiste fra le chiamate all'LLM": input
  percettivi, conoscenza attiva, obiettivi) e tre memorie a lungo termine: **episodica** ("esperienza di cicli
  decisionali precedenti"), **semantica** ("conoscenza del mondo e di sé"), **procedurale** (due forme: implicita nei
  pesi dell'LLM, esplicita nel codice dell'agente). Azioni interne: **recupero** (lungo termine → memoria di lavoro),
  **ragionamento** (lavoro → lavoro), **apprendimento** (scrittura nella memoria a lungo termine: esperienza episodica,
  conoscenza semantica, parametri dell'LLM, codice dell'agente).
- Note dal testo: la memoria procedurale "deve essere inizializzata dal progettista"; aggiornare il proprio codice è
  "rischioso sia per la funzionalità sia per l'allineamento dell'agente"; "modificare e cancellare (un caso di
  'unlearning') sono poco studiati". Negli ambienti fisici la percezione è trasformata in testo "tramite modelli di
  captioning pre-addestrati".
- Per noi: CoALA è la mappa più vicina alla visione ("l'agente distingue i tipi di memoria"). Recordare copre come
  servizio la memoria a lungo termine episodica e semantica; memoria di lavoro e memoria procedurale appartengono
  all'agente host.

### 2.2 Generative Agents (Park et al., UIST 2023)
- **Memory stream**: "un elenco completo delle esperienze dell'agente" in linguaggio naturale. Punteggio di
  **recupero** = α·recenza + α·importanza + α·rilevanza, ciascuna normalizzata min-max, tutte le α = 1
  nell'implementazione; la recenza è un decadimento esponenziale (fattore 0,995 per ora di gioco) dall'**ultimo
  recupero** del ricordo; l'importanza è un voto dell'LLM da 1 a 10 ("banale" → "toccante") dato alla creazione; la
  rilevanza è il coseno fra embedding.
- **Riflessione**: scatta quando la somma delle importanze degli eventi recenti supera 150 (circa due o tre volte per
  giornata di gioco); l'LLM legge i 100 record più recenti, si chiede le "3 domande di alto livello più salienti",
  recupera per ciascuna e scrive "5 intuizioni di alto livello" **citando i record usati come evidenza**; le
  riflessioni sono salvate nello stream con i puntatori e possono poggiare su altre riflessioni (un albero di
  riflessioni). Anche i piani rientrano nello stream.
- Difetto notato dagli autori: gli agenti "abbellivano" le conoscenze (aggiungendo dettagli plausibili, o conoscenza
  del mondo presa dal modello), pur senza dichiarare esperienze non vissute.
- Per noi: Recordare segue già questo stato dell'arte: importanza 1–10 alla codifica, ranking recenza + importanza +
  rilevanza (D14), elementi derivati con gli id delle fonti (D29). Manca la riflessione (H12), e l'abbellimento
  osservato è il motivo per cui le riflessioni devono restare `inferred`, legate alle evidenze e in attesa di conferma.

### 2.3 MemGPT / Letta (Packer et al., 2023)
- Analogia con il sistema operativo: **main context** (istruzioni di sistema, working context, coda FIFO dei messaggi)
  vs **contesto esterno**: **recall storage** (il database dei messaggi) e **archival storage** (testo arbitrario). Un
  queue manager invia un avviso di "memory pressure" prima dell'espulsione così che l'LLM possa salvare ciò che conta;
  i messaggi espulsi confluiscono in un riassunto ricorsivo. Un lavoro successivo (sleep-time compute, Lin et al. 2025)
  permette ai modelli di "pensare" offline su un contesto prima che arrivino le domande.
- Per noi: recall storage ≈ il nostro raw log (Layer 0); archival storage ≈ le fonti apprese di D49; l'avviso prima
  dell'espulsione ≈ l'hook pre-compattazione (`agent-platform-memory_it.md` idea 10). Già stato dell'arte per D49.

### 2.4 Voyager (Wang et al., 2023): memoria procedurale come libreria di abilità
- Una "libreria di abilità in continua crescita, fatta di codice eseguibile": un programma viene aggiunto solo dopo che
  un passo di **auto-verifica** conferma la riuscita del compito, indicizzato con l'embedding della sua descrizione,
  recuperato con l'embedding del piano e del feedback dell'ambiente (accuratezza di recupero top-5 96,5 %). Gli autori
  dicono che le abilità composizionali attenuano l'oblio catastrofico.
- Per noi: la memoria procedurale più chiara dell'era LLM. È dell'agente, non della persona; in una memoria
  "dell'agente stesso" diventa pertinente (§3, lacuna 1).

### 2.5 Architetture classiche: ACT-R e Soar
- **ACT-R** (Anderson et al., 2004): moduli (percettivo-motori, obiettivo, memoria dichiarativa) mettono chunk in
  buffer letti da un sistema di produzioni; grandezze subsimboliche guidano il recupero. Il recupero dichiarativo usa
  l'attivazione base-level (recenza e frequenza, §1.10).
- **Soar** (Laird 2022, letto per intero): memoria di lavoro; memoria **procedurale** di regole, appresa con il
  **chunking** (compilare in una regola il ragionamento deliberato fatto in un sottostato) e con l'apprendimento per
  rinforzo; memoria **semantica** recuperata con un indizio parziale tramite attivazione base-level più attivazione per
  diffusione e, alla versione 9.6, "nessun meccanismo di apprendimento automatico per la memoria semantica, ma un agente
  può memorizzare deliberatamente informazioni"; memoria **episodica** = **istantanee automatiche della memoria di
  lavoro**, recuperate con un indizio parziale, che restituiscono **l'episodio corrispondente più recente**, con
  navigazione successivo / precedente; la memoria episodica è usata anche "per conservare obiettivi per situazioni
  future nei compiti prospettici". **Nuxoll & Laird (2012)** sostengono che una memoria episodica indipendente dal
  compito supporta capacità di percezione, ragionamento e apprendimento.
- **Laird, Lebiere & Rosenbloom (2017)** propongono un "modello standard della mente" condiviso dalla comunità e
  costruito a partire dalle architetture cognitive.
- Per noi: la nostra modalità `latest` è il "corrispondente più recente" di Soar; la navigazione successivo /
  precedente è un'aggiunta economica (la read API del diario ordina già per tempo). La divisione di Soar
  (apprendimento procedurale automatico, scrittura semantica deliberata) ricorda che l'apprendimento semantico
  automatico, che Recordare fa a ogni finestra, è la parte più rischiosa.

### 2.6 Rassegne recenti (2024–2026)
- **Zhang et al. (2024)**, la prima rassegna ampia sulla memoria degli agenti LLM.
- **Wu et al. (2025)** collegano le categorie della memoria umana alla memoria dell'IA lungo tre dimensioni (oggetto,
  forma, tempo).
- **Du et al. (2025)** definiscono sei operazioni: consolidamento, aggiornamento, indicizzazione, oblio, recupero,
  condensazione.
- **Hu et al. (2025)** separano le forme (a livello di token, parametrica, latente) dalle funzioni (fattuale,
  esperienziale, di lavoro).
- **Liang et al. (2025)** fanno una rassegna dalle neuroscienze cognitive agli agenti, sicurezza della memoria inclusa.
- **Huang et al. (2026, TMLR)** aggiungono la dimensione del **soggetto della memoria**: memoria *centrata sull'utente*
  (fatti e preferenze dell'utente) vs memoria *centrata sull'agente* (traiettorie, esiti, abilità dell'agente stesso).
  Notano che "un singolo sistema può mantenere" entrambe e che "i benchmark attuali raramente richiedono entrambe
  contemporaneamente".
- **Ding et al. (2026)** trattano gli agenti sempre attivi come sistemi a stato persistente (ricordi ma anche impegni,
  provenienza, permessi) e trovano che la letteratura studia più l'accumulo e il recupero dello stato che il suo
  governo o il suo rilascio.
- **Pink et al. (2025)** (position paper): la memoria episodica è "il pezzo mancante", con cinque proprietà (già la
  nostra checklist).
- Robot e percezione: **Ego4D** (Grauman et al., 2022) definisce domande di memoria episodica su video in prima
  persona; **ReMEmbR** (Anwar et al., 2024) costruisce una memoria spazio-temporale a lungo orizzonte del video di un
  robot per domande "dove / quando / quanto tempo fa".
- Per noi: la visione è, nei termini di Huang et al., una **memoria centrata sull'agente che contiene la memoria
  centrata sull'utente con attribuzione**. Quella rassegna indica la combinazione come poco studiata; non è dimostrato
  che sia nuova (i peer osservatore / osservato di Honcho e Collaborative Memory sono vicini, `agent-platform-memory_it.md`,
  `collaborative-memory_it.md`).

## 3. Riportare tutto su Recordare

### 3.1 Sistema per sistema

| Sistema di memoria | Umani / stato dell'arte | Recordare oggi | Manca |
|---|---|---|---|
| Sensoriale / percettiva | Buffer sensoriali brevi; apprendimento percettivo (Squire); volti / voci dalla nascita (§1.11) | Raw log di **testo** (Layer 0), alla lettera, per sempre; impronte vocali solo sul dispositivo client (D45), nessun audio conservato | Input non testuali (foto, audio, video, flussi di sensori) come elementi Layer 0 con descrizione; memoria di riconoscimento di persone e cose (voci / volti registrati, luoghi, oggetti) |
| Memoria di lavoro | Episodic buffer di Baddeley; ~4 chunk (Cowan); memoria di lavoro di CoALA | Contesto dell'host; il memory context pre-turno di Recordare = l'ingresso a lungo termine del buffer | Nulla da possedere: resta nell'host (iniezione a budget) |
| Episodica | Tulving; stream di Generative Agents; istantanee di Soar | Episodi: bi-temporali, persone, luogo, importanza, valenza / sentimenti / opinione, evidenze, fallback sul raw log, recall `latest` / `list` / per periodo | Episodi vissuti dall'agente (`twin_experienced` riservato, non scritto); navigazione successivo / precedente |
| Semantica — sulle persone | Tulving; base di conoscenza di Conway | Fatti come state slot con catene di valori (D31), note per categoria (D34), `subject_person_id` nella memoria di entità (D48) | Fatti su terzi nella memoria di una persona (per scelta, oggi) |
| Semantica — conoscenza del mondo | Memoria semantica di CoALA; archival di MemGPT | Fonti apprese D49: proposta, non costruita (WORK_PLAN 5.9) | Tutto |
| Autobiografica / sé | Self-memory system di Conway; periodi di vita | Digest giornalieri e mensili (cronologici) | Periodi di vita / eventi generali; un **modello di sé** (chi è l'agente, il suo rapporto con ciascuna persona); l'idea della holder card |
| Prospettica | Einstein & McDaniel; multiprocess framework; obiettivi nella memoria episodica di Soar | Piani con ciclo di vita nel codice (`open … unresolved`, D10, D37): le intenzioni **del titolare** | Le intenzioni **dell'agente**: promesse, richieste rivolte a lui, standing intents (idea 8) |
| Procedurale | Squire; CoALA (pesi + codice); libreria di abilità di Voyager; chunking di Soar | Nessuna; respinta in precedenza come "compito dell'agente host" (`agent-platform-memory_it.md` §4) | Da decidere con la nuova visione (lacuna 1) |
| Priming / condizionamento | Non dichiarativa di Squire | Conteggi di accesso solo nel ranking | Non proposto |
| Source / reality monitoring | Johnson & Raye; Johnson et al. 1993; reality monitoring negli LLM (2026) | `origin` (`holder_lived / holder_told / assistant_stated`), `author_role`, `stance`, `confidence`, `audience`, `confidence_of`; guardia anti-eco D38 nel codice; "qualcuno" e guardia nome-nella-finestra di D48 | **Come** è stata stabilita la fonte (legame dichiarato, presentazione, impronta vocale, volto, inferenza) e **con quale sicurezza**, come dato; un "parlante sconosciuto" riattribuibile in seguito |
| Consolidamento / replay | CLS; Wilson & McNaughton; Diekelmann & Born | Job notturno (zero chiamate se non c'è nulla di nuovo), digest; risolutore di quasi-duplicati all'estrazione | Promozioni di pattern (D20, TODO), passata di dedup in consolidamento (5.3 parziale); revisione dei fatti costruita ma spenta (D41, nessun guadagno) |
| Riflessione / pensieri propri | Riflessione di Generative Agents; Reflexion; sleep-time di Letta | Solo il disegno H12; `kind = thought / goal` riservati alla traccia R | Tutto |
| Riconsolidamento | Nader et al.; Loftus & Palmer | Di proposito non copiato: `corrects` / `supersedes` append-only | Nulla (mantenere) |
| Schemi | Bartlett; Tse et al.; Gilboa & Marlatte | Schema dei fact slot con cardinalità e politica di fusione; categorie delle note | Un controllo che gli schemi non trasformino eventi isolati in abitudini (sonda di valutazione) |
| Oblio | Anderson & Schooler; Richards & Frankland; ACT-R | Retrocessione nel ranking; oblio di un episodio per scelta del titolare (periodo TODO, D16) | Nulla di nuovo; oblio di un periodo |
| Sviluppo | Turing; robotica dello sviluppo; amnesia infantile | Nessuno | Fasi e rielaborazione della prima vita (§3.3) |

### 3.2 Che cosa cambia con la nuova visione

1. **La memoria è l'account dell'agente.** Oggi una memoria è una persona (`kind = human`) o un'entità
   (`kind = entity`, D48). Nella visione entrambi sono "la memoria dell'agente" con una modalità. Sul piano dei dati è
   vicino a ciò che esiste: modalità personale ≈ la memoria di persona di oggi (l'utente dell'account è il
   titolare; le sue parole sono `holder_lived`), modalità entità ≈ D48. Il cambiamento sta soprattutto in **come
   parla la memoria** (prima persona) e in due nuovi valori di provenienza (sotto).
2. **Modalità personale, prima persona: mantenere il reality monitoring.** Se tutto ciò che non è dichiarato è
   dell'agente, le parole dell'utente e le risposte dell'agente sono entrambe "mie". La distinzione di Johnson & Raye
   (percepito vs autogenerato) e il risultato del 2026 sugli LLM dicono che è proprio qui che i sistemi sbagliano: i
   prodotti dell'agente tornano come fatti. Quindi la prima persona dovrebbe essere una **scelta di resa al momento
   della lettura**, mentre i dati tengono separati `origin` / `author_role` (ciò che ha detto la persona vs ciò che ha
   generato l'agente, D30) e la guardia anti-eco D38 resta nel codice. Così anche il "gemello indiretto" resta onesto:
   il gemello della persona è costruito da ciò che la persona ha detto, non da ciò che l'agente ha risposto.
3. **Modalità entità, "qualcuno": memorizzare la fonte sconosciuta, riattribuire dopo.** Oggi D48 registra episodi che
   non nominano nessuno e scarta i fatti personali di parlanti non identificati. Il source monitoring umano e lo
   sviluppo infantile suggeriscono una terza via: tenere gli elementi come **"qualcuno (non identificato)"** con bassa
   sicurezza di attribuzione e, quando l'identità diventa nota (una presentazione successiva, un'impronta vocale
   registrata dopo), **aggiungere** un legame di attribuzione, senza mai riscrivere l'elemento. Il raw log lo rende
   possibile; la guardia di D48 (il nome deve comparire nella finestra) resta per l'attribuzione *automatica*.
4. **Marcare la memoria propria richiede due nuovi valori di provenienza.** "Conoscenze che gli vengono date" = fonti
   apprese (D49), con chi le fornisce come fonte. "Ciò che un robot percepisce lavorando da solo" = percezione di prima
   mano dell'agente, che nessuno fra `holder_lived / holder_told / assistant_stated` descrive: qualcosa come
   `agent_perceived` (percepito di prima mano) accanto a `agent_generated` (le sue parole e i suoi pensieri). Il reality
   monitoring è esattamente percepito vs generato, quindi i due non dovrebbero condividere un valore.
5. **I metodi di identificazione come evidenza di attribuzione, non come autorità.** Identità dichiarata (legame
   sicuro), presentazione, impronta vocale, volto, inferenza dal contesto: ognuno dà un'attribuzione con un metodo e una
   sicurezza. La regola di D48 resta: solo un legame sicuro instrada contenuti nella memoria **propria** di una persona
   o allarga la divulgazione; un'identità biometrica o inferita dice solo di chi è probabilmente un elemento dentro la
   memoria dell'agente.
6. **"Si sviluppa come un bambino" = capacità a fasi, misurate.** La letteratura indica un ordine: percezione e
   riconoscimento delle persone familiari per primi (§1.11), un sé e un cast di persone prima di una storia personale
   organizzata (Howe & Courage; Nelson & Fivush), source monitoring affidabile tardi (Poole & Lindsay), riflessione e
   obiettivi propri per ultimi. Per Recordare: (a) acquisizione = raw log + episodi (costruito); (b) riconoscimento =
   un registro delle persone con alias (tabella `person_aliases` creata, non usata) e voci / volti registrati sul client;
   (c) consolidamento = notturno (costruito, promozioni TODO); (d) pensieri propri = H12 / traccia R. Un vantaggio sul
   bambino: con il raw log conservato, i primi periodi possono essere **ri-estratti** quando l'agente conosce le sue
   persone (un job a pagamento, opzionale, per profilo di qualità, D35), invece di subire l'amnesia infantile.

### 3.3 Lacune da progettare (ognuna da misurare; nessuna dichiarata nuova)

1. **Memoria procedurale.** Prima abbiamo tenuto fuori le abilità ("compito dell'agente host"). Se la memoria è
   dell'agente, una piccola **nota di procedura** legata alle evidenze (categoria `procedure`: "per resettare la
   caldaia, …", imparata da una persona o da un'esecuzione riuscita) è una conservazione in stile semantico di
   conoscenza procedurale e sta nel modello dati. Le abilità eseguibili (Voyager) restano nell'host. Stato dell'arte:
   Voyager, abilità di Letta e Hermes, CoALA.
2. **Riflessione con evidenze.** H12 come progettato, con la meccanica di Generative Agents (domande → recupero →
   intuizioni che citano gli id delle evidenze), `stance = inferred`, in attesa, mai iniettata come fatto. L'innesco per
   importanza accumulata (la loro soglia 150) costa meno di un calendario fisso e rispetta "zero chiamate quando non c'è
   nulla da fare".
3. **Sicurezza dell'attribuzione come campo di prima classe.** Separata dalla `confidence` del contenuto:
   `attributed_to`, `attribution_method`, `attribution_confidence`, legami di riattribuzione. La misura di H3 (trappole
   di attribuzione errata) diventa il test.
4. **Modello di sé.** Il working self di Conway: obiettivi e identità dell'agente orientano il recall. Partire dalla
   holder card derivata (idea 6) per la modalità personale, e da un "chi sono / il mio rapporto con ciascuna persona"
   inferito per la modalità entità (direzione G della visione), sempre `inferred`, tracciabile, senza mai riscrivere gli
   episodi.
5. **Memoria prospettica propria dell'agente.** Promesse e richieste rivolte all'agente come intenzioni con ciclo di vita
   (idea 8), confrontate con gli indizi al recall pre-turno e, se a tempo, tramite lo scheduler dell'host (multiprocess
   framework).
6. **Layer 0 percettivo.** Elementi non testuali (foto, clip audio, segmento video, evento di un sensore) conservati come
   riferimenti con una descrizione prodotta dal client o da un modello configurato (la via del captioning di CoALA),
   tempo e luogo, poi estratti come i messaggi. Ego4D e ReMEmbR danno la forma della valutazione per "dove / quando ho
   visto X".
7. **Periodi di vita.** Uno strato opzionale tematico o per periodo sopra i digest (i riassunti mensili di topic /
   persona di TSM hanno aiutato le domande sulle preferenze, `tsm-temporal-semantic-memory_it.md`).

## 4. Che cosa la letteratura conferma in Recordare (nessun cambiamento)

- Memoria append-only con correzioni invece del riconsolidamento (Nader et al.; Loftus & Palmer come rischio).
- Codifica all'inattività + consolidamento notturno come disegno di forma CLS; gli episodi come ancora permanente degli
  elementi semantici (multiple trace theory).
- Importanza alla codifica e ranking recenza + importanza + rilevanza: segue Generative Agents e ACT-R / Anderson &
  Schooler.
- Oblio solo nel ranking e per scelta del titolare (Richards & Frankland: l'oblio serve alle decisioni).
- Provenienza memorizzata alla scrittura invece che ricostruita al recall (errori di source monitoring nelle persone e
  negli LLM).

## 5. Domande aperte

1. Un unico tipo di memoria ("agente") con una modalità (personale / entità) è più pulito di `human` / `entity`, o
   è solo un cambio di nome? (Fase di sviluppo: codice pulito prima della compatibilità.)
2. In modalità personale, la persona deve mai essere *distinta* dall'agente (le percezioni dell'agente dalla
   fotocamera di un telefono, le sue opinioni)? Se sì, anche la modalità personale ha bisogno di `agent_perceived` /
   `agent_generated`.
3. Chi conferma la riattribuzione di un elemento "qualcuno": la persona, l'amministratore o una soglia di sicurezza?
4. Note di procedura: appartengono alle note (categoria) o alle fonti di D49 (gli scritti della persona)?
5. Ri-estrarre la prima vita: quando, a che costo, e come evitare duplicati con quanto già estratto?
6. Valutazione: quali set ciechi misurano source monitoring (trappole di attribuzione errata, riattribuzione del
   parlante sconosciuto), riflessione (tasso di false riflessioni) e percezione ("dove ho lasciato X") prima di costruire
   qualcosa di tutto questo?

## Riferimenti

Tutti i DOI sono stati verificati su Crossref e tutti gli id arXiv su arxiv.org il 2026-10-09. "abstract" = abstract
letto (PubMed o arXiv); "completo" = testo completo letto; "secondario" = contenuto preso da pagine secondarie, metadati
verificati; "classico" = non riletto.

Memoria umana
- Anderson, J. R., & Schooler, L. J. (1991). Reflections of the environment in memory. *Psychological Science*, 2(6),
  396–408. doi:10.1111/j.1467-9280.1991.tb00174.x — secondario.
- Anderson, M. C., Bjork, R. A., & Bjork, E. L. (1994). Remembering can cause forgetting. *JEP: LMC*, 20(5),
  1063–1087. doi:10.1037/0278-7393.20.5.1063 — abstract.
- Baddeley, A. D., & Hitch, G. (1974). Working memory. *Psychology of Learning and Motivation*, 8, 47–89.
  doi:10.1016/S0079-7421(08)60452-1 — solo metadati.
- Baddeley, A. (2000). The episodic buffer: a new component of working memory? *Trends Cogn. Sci.*, 4(11), 417–423.
  doi:10.1016/S1364-6613(00)01538-2 — abstract.
- Bartlett, F. C. (1932). *Remembering*. Cambridge University Press — classico.
- Bauer, P. J. (2015). A complementary processes account of the development of childhood amnesia and a personal past.
  *Psychological Review*, 122(2), 204–231. doi:10.1037/a0038939 — abstract.
- Conway, M. A., & Pleydell-Pearce, C. W. (2000). The construction of autobiographical memories in the self-memory
  system. *Psychological Review*, 107(2), 261–288. doi:10.1037/0033-295X.107.2.261 — abstract; tre livelli da fonti secondarie.
- Conway, M. A. (2005). Memory and the self. *Journal of Memory and Language*, 53(4), 594–628.
  doi:10.1016/j.jml.2005.08.005 — secondario.
- Cowan, N. (2001). The magical number 4 in short-term memory. *Behavioral and Brain Sciences*, 24(1), 87–114.
  doi:10.1017/S0140525X01003922 — abstract.
- DeCasper, A. J., & Fifer, W. P. (1980). Of human bonding: newborns prefer their mothers' voices. *Science*, 208,
  1174–1176. doi:10.1126/science.7375928 — abstract.
- Diekelmann, S., & Born, J. (2010). The memory function of sleep. *Nat. Rev. Neurosci.*, 11, 114–126.
  doi:10.1038/nrn2762 — abstract.
- Einstein, G. O., & McDaniel, M. A. (1990). Normal aging and prospective memory. *JEP: LMC*, 16(4), 717–726.
  doi:10.1037/0278-7393.16.4.717 — abstract.
- Gilboa, A., & Marlatte, H. (2017). Neurobiology of schemas and schema-mediated memory. *Trends Cogn. Sci.*, 21(8),
  618–631. doi:10.1016/j.tics.2017.04.013 — abstract.
- Howe, M. L., & Courage, M. L. (1993). On resolving the enigma of infantile amnesia. *Psychological Bulletin*,
  113(2), 305–326. doi:10.1037/0033-2909.113.2.305 — abstract.
- Johnson, M. H., Dziurawiec, S., Ellis, H., & Morton, J. (1991). Newborns' preferential tracking of face-like stimuli
  and its subsequent decline. *Cognition*, 40(1–2), 1–19. doi:10.1016/0010-0277(91)90045-6 — abstract.
- Johnson, M. K., & Raye, C. L. (1981). Reality monitoring. *Psychological Review*, 88(1), 67–85.
  doi:10.1037/0033-295X.88.1.67 — secondario.
- Johnson, M. K., Hashtroudi, S., & Lindsay, D. S. (1993). Source monitoring. *Psychological Bulletin*, 114(1), 3–28.
  doi:10.1037/0033-2909.114.1.3 — abstract.
- Josselyn, S. A., & Frankland, P. W. (2012). Infantile amnesia: a neurogenic hypothesis. *Learning & Memory*, 19(9),
  423–433. doi:10.1101/lm.021311.110 — abstract.
- Kumaran, D., Hassabis, D., & McClelland, J. L. (2016). What learning systems do intelligent agents need?
  Complementary learning systems theory updated. *Trends Cogn. Sci.*, 20(7), 512–534. doi:10.1016/j.tics.2016.05.004
  — abstract.
- Loftus, E. F., & Palmer, J. C. (1974). Reconstruction of automobile destruction. *J. Verbal Learning and Verbal
  Behavior*, 13(5), 585–589. doi:10.1016/S0022-5371(74)80011-3 — classico.
- McClelland, J. L., McNaughton, B. L., & O'Reilly, R. C. (1995). Why there are complementary learning systems in the
  hippocampus and neocortex. *Psychological Review*, 102(3), 419–457. doi:10.1037/0033-295X.102.3.419 — abstract.
- McClelland, J. L. (2013). Incorporating rapid neocortical learning of new schema-consistent information into
  complementary learning systems theory. *JEP: General*, 142(4), 1190–1210. doi:10.1037/a0033812 — abstract.
- McDaniel, M. A., & Einstein, G. O. (2000). Strategic and automatic processes in prospective memory retrieval: a
  multiprocess framework. *Applied Cognitive Psychology*, 14(7), S127–S144. doi:10.1002/acp.775 — secondario (intervallo di
  pagine non restituito da Crossref).
- Nadel, L., & Moscovitch, M. (1997). Memory consolidation, retrograde amnesia and the hippocampal complex. *Curr.
  Opin. Neurobiol.*, 7(2), 217–227. doi:10.1016/S0959-4388(97)80010-4 — abstract.
- Nader, K., Schafe, G. E., & LeDoux, J. E. (2000). Fear memories require protein synthesis in the amygdala for
  reconsolidation after retrieval. *Nature*, 406, 722–726. doi:10.1038/35021052 — abstract.
- Nelson, K., & Fivush, R. (2004). The emergence of autobiographical memory. *Psychological Review*, 111(2), 486–511.
  doi:10.1037/0033-295X.111.2.486 — abstract.
- Pascalis, O., de Haan, M., & Nelson, C. A. (2002). Is face processing species-specific during the first year of
  life? *Science*, 296, 1321–1323. doi:10.1126/science.1070223 — abstract.
- Poole, D. A., & Lindsay, D. S. (2002). Reducing child witnesses' false reports of misinformation from parents.
  *J. Exp. Child Psychol.*, 81(2), 117–140. doi:10.1006/jecp.2001.2648 — abstract (PubMed).
- Richards, B. A., & Frankland, P. W. (2017). The persistence and transience of memory. *Neuron*, 94(6), 1071–1084.
  doi:10.1016/j.neuron.2017.04.037 — abstract.
- Rochat, P. (2003). Five levels of self-awareness as they unfold early in life. *Consciousness and Cognition*, 12(4),
  717–731. doi:10.1016/S1053-8100(03)00081-3 — abstract.
- Schacter, D. L., Addis, D. R., & Buckner, R. L. (2007). Remembering the past to imagine the future: the prospective
  brain. *Nat. Rev. Neurosci.*, 8, 657–661. doi:10.1038/nrn2213 — abstract.
- Squire, L. R., & Zola, S. M. (1996). Structure and function of declarative and nondeclarative memory systems.
  *PNAS*, 93(24), 13515–13522. doi:10.1073/pnas.93.24.13515 — abstract.
- Squire, L. R. (2004). Memory systems of the brain: a brief history and current perspective. *Neurobiol. Learn.
  Mem.*, 82(3), 171–177. doi:10.1016/j.nlm.2004.06.005 — abstract; riquadri della tassonomia da fonti secondarie.
- Tse, D., Langston, R. F., Kakeyama, M., et al. (2007). Schemas and memory consolidation. *Science*, 316, 76–82.
  doi:10.1126/science.1135935 — abstract.
- Tulving, E. (1972). Episodic and semantic memory. In E. Tulving & W. Donaldson (Eds.), *Organization of Memory*
  (pp. 381–403). Academic Press — secondario (senza DOI; intervallo di pagine da schede secondarie).
- Tulving, E. (1985). Memory and consciousness. *Canadian Psychology*, 26(1), 1–12. doi:10.1037/h0080017 — secondario.
- Tulving, E. (2002). Episodic memory: from mind to brain. *Annu. Rev. Psychol.*, 53, 1–25.
  doi:10.1146/annurev.psych.53.100901.135114 — abstract.
- Wilson, M. A., & McNaughton, B. L. (1994). Reactivation of hippocampal ensemble memories during sleep. *Science*,
  265, 676–679. doi:10.1126/science.8036517 — abstract.
- Wixted, J. T. (2004). The psychology and neuroscience of forgetting. *Annu. Rev. Psychol.*, 55, 235–269.
  doi:10.1146/annurev.psych.55.090902.141555 — abstract.

Sviluppo e macchine
- Turing, A. M. (1950). Computing machinery and intelligence. *Mind*, 59(236), 433–460. doi:10.1093/mind/LIX.236.433 —
  citazione del §7 verificata sulla pagina dell'editore.
- Lungarella, M., Metta, G., Pfeifer, R., & Sandini, G. (2003). Developmental robotics: a survey. *Connection
  Science*, 15(4), 151–190. doi:10.1080/09540090310001655110 — solo metadati.

Architetture di agenti e rassegne
- Anderson, J. R., Bothell, D., Byrne, M. D., Douglass, S., Lebiere, C., & Qin, Y. (2004). An integrated theory of the
  mind. *Psychological Review*, 111(4), 1036–1060. doi:10.1037/0033-295X.111.4.1036 — abstract; equazione base-level
  da fonti secondarie.
- Anwar, A., Welsh, J., Biswas, J., Pouya, S., et al. (2024). ReMEmbR. arXiv:2409.13682 — abstract.
- Ding, T., et al. (2026). Always-On Agents: a survey of persistent memory, state, and governance in LLM agents.
  arXiv:2606.30306 — abstract.
- Du, Y., et al. (2025). Rethinking memory in LLM based agents. arXiv:2505.00675 — abstract.
- Grauman, K., et al. (2022). Ego4D. CVPR 2022; arXiv:2110.07058 — abstract.
- Hu, Y., et al. (2025). Memory in the age of AI agents. arXiv:2512.13564 — abstract.
- Huang, W.-C., et al. (2026). A survey of agent memory in the second half. *TMLR* (07/2026); arXiv:2602.06052 —
  abstract e §3.3.
- Laird, J. E., Lebiere, C., & Rosenbloom, P. S. (2017). A standard model of the mind. *AI Magazine*, 38(4), 13–26.
  doi:10.1609/aimag.v38i4.2744 — abstract.
- Laird, J. E. (2022). Introduction to Soar. arXiv:2205.03854 — completo.
- Liang, J., et al. (2025). AI meets brain: memory systems from cognitive neuroscience to autonomous agents.
  arXiv:2512.23343 — abstract.
- Lin, K., Snell, C., et al. (2025). Sleep-time compute. arXiv:2504.13171 — abstract.
- Nuxoll, A. M., & Laird, J. E. (2012). Enhancing intelligent agents with episodic memory. *Cognitive Systems
  Research*, 17–18, 34–48. doi:10.1016/j.cogsys.2011.10.002 — secondario.
- Packer, C., et al. (2023). MemGPT: towards LLMs as operating systems. arXiv:2310.08560 — completo.
- Park, J. S., O'Brien, J. C., Cai, C. J., Morris, M. R., Liang, P., & Bernstein, M. S. (2023). Generative agents:
  interactive simulacra of human behavior. UIST 2023. doi:10.1145/3586183.3606763; arXiv:2304.03442 — completo.
- Pink, M., et al. (2025). Position: episodic memory is the missing piece for long-term LLM agents. arXiv:2502.06975 —
  abstract.
- Ranjan, S., Sokratous, K., & Odegaard, B. (2026). Reality monitoring in large language models. arXiv:2607.23927 —
  abstract.
- Shinn, N., et al. (2023). Reflexion: language agents with verbal reinforcement learning. arXiv:2303.11366 —
  abstract.
- Sumers, T. R., Yao, S., Narasimhan, K., & Griffiths, T. L. (2023). Cognitive architectures for language agents.
  TMLR; arXiv:2309.02427 — completo.
- Wang, G., et al. (2023). Voyager: an open-ended embodied agent with large language models. arXiv:2305.16291 — completo.
- Wu, Y., et al. (2025). From human memory to AI memory. arXiv:2504.15965 — abstract.
- Zhang, Z., et al. (2024). A survey on the memory mechanism of large language model based agents. arXiv:2404.13501 —
  abstract.

Non verificati: nessuno dei riferimenti sopra ha fallito la verifica. Le sedi di pubblicazione vengono dalle schede
arXiv (CoALA "TMLR camera ready", Ego4D "CVPR 2022", Huang et al. "TMLR 07/2026"); l'anno di CoALA in TMLR non è stato
verificato.
