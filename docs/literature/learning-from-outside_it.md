# Imparare da ciò che si sente dire, si vede e si legge — come l'informazione esterna entra nella memoria: esseri umani, bambini, agenti, robot

Riferimento inglese: [learning-from-outside.md](learning-from-outside.md). Ricerca per l'auto-apprendimento della memoria di entità (la memoria propria di un agente o di un robot, D53 / D55 / D56; RESEARCH_NOTES H3),
2026-11-11. Estende `human-memory-and-agent-architectures_it.md` §1.6–1.10 (source monitoring, consolidamento, schemi,
oblio) e `disclosure_it.md`. Circa 40 ricerche; ogni id arXiv citato è stato aperto su arxiv.org e il suo titolo
controllato. Segni di lettura: [S] testo completo, [A+] abstract e parte del testo, [A] solo abstract o pagina del
prodotto / della documentazione, [sec] un classico controllato tramite la scheda dell'abstract e fonti secondarie, non
riletto. Nessuna fonte qui è stata letta per intero: trattare tutti i numeri come degli autori e ricontrollarli prima di
citarli fuori. Tutto parafrasato.

La domanda (maintainer): come entrano nella memoria le notizie, le cose lette, ciò che ci dicono gli altri e i risultati
del web — prima nelle persone, poi nelle memorie degli agenti — così che una memoria di entità (di una casa o di un
robot) possa imparare da sola da ciò che sente dire, vede e legge, "come un bambino", e prendere iniziativa da lì,
mentre oggi Recordare tiene l'output degli strumenti e le pagine solo nel registro grezzo, a meno che non riguardino la
vita di qualcuno.

## 1. Cosa ha già Recordare

- **Regola NEWS LEARNED** (`service/src/engine/extraction.prompt.ts`, varianti personale ed entità). Una notizia da un
  risultato di strumento, una pagina, un documento, una risposta o da qualcun altro diventa un episodio `event` di bassa
  importanza ("ho saputo che …") **solo quando riguarda** un piano aperto, una persona nota alla memoria, qualcosa di
  posseduto / che appartiene al luogo, o quando qualcuno reagisce. Si conservano entrambe le date (quando è stata
  appresa, quando accade la notizia). Le notizie non correlate, le curiosità e le risposte a domande generali restano
  nel registro grezzo. Ciò che gli altri dicono del titolare non è mai "notizia appresa" (valgono le regole sulle
  affermazioni altrui).
- **Fonti apprese (D49, API "Learned sources")**: un manuale, una pagina, una nota, un libro o un testo dell'agente
  stesso, inviato dal client come testo, tenuto separato da episodi / fatti / note, diviso in passaggi senza LLM,
  cercato con `search_knowledge`; versionato da `externalId`; `providedBy` (io / qualcuno / un contatto); l'apprendimento
  è esso stesso un episodio ("ho imparato «Manuale della caldaia», da Paolo"); una fonte dimenticata lascia un segno
  sugli episodi che la citavano. È un archivio con provenienza — l'idea di archivio di MemGPT / Letta, già annotata
  come arte nota.
- **Provenienza come dato**: `author_role` (`holder | assistant | other | tool`) e `origin` (`holder_lived`,
  `holder_told`, `assistant_stated`, `reflected`, `perceived`). Gli elementi la cui sola evidenza sono messaggi `other` /
  `tool` non sono mai `stance: stated` — al massimo `inferred`, i fatti `pending` (guardia contro l'avvelenamento).
  **Turn taint** (WORK_PLAN 5.7): una risposta dell'assistente dopo l'output di uno strumento non Recordare conta come
  lo strumento.
- **Percezioni (D56)**: viste, non raccontate (reality monitoring), scritte senza il modello, che sfumano dopo
  `keepDays`; non sono una fonte di iniziative.
- **Imparare chiedendo (D55)**: una domanda tenuta ha un risponditore — `lookup` tramite gli strumenti dell'agente o
  `ask` a una persona che potrebbe sapere; le risposte diventano memorie con la loro fonte e ritirano la domanda; una
  domanda alla volta, meno man mano che sa di più; conferme F2b di una nota sentita una volta o indovinata, una domanda
  di apprendimento al giorno.
- **Sostituzione** solo in avanti per tempo dell'evento; fatti `current | superseded | corrected | unknown_current`;
  solo in aggiunta, mai riscritti dall'LLM.
- **Lacuna**: la conoscenza generale che l'agente incontra (un fatto letto in una pagina, la risposta di una ricerca,
  "la farmacia ora chiude alle 7" detto da un vicino) non è tenuta come conoscenza a meno che non riguardi una vita
  nota, e nulla registra *quanto fidarsene* oltre al ruolo dell'autore, né *fino a quando* vale.

## 2. Come le persone assimilano l'informazione esterna

### 2.1 Source monitoring, amnesia della fonte, sleeper effect
- **Source monitoring** (Johnson, Hashtroudi & Lindsay 1993) [sec, già nella scheda sulla memoria umana]: la fonte non è
  conservata come etichetta ma giudicata al momento del ricordo dalle caratteristiche della traccia; tra gli errori,
  scambiare ciò che si è letto o sentito per ciò che si è visto, e "l'incorporazione della finzione nel fatto".
- **Sleeper effect** (Kumkale & Albarracín 2004, Psychological Bulletin, meta-analisi) [sec]: un messaggio dapprima
  scontato per via di una fonte scadente guadagna forza persuasiva col tempo, perché l'indizio che lo faceva scontare si
  dimentica più in fretta del messaggio, o smette di essere collegato ad esso (il risultato di Pratkanis et al. 1988,
  confermato dalla meta-analisi). Più probabile quando il messaggio era forte e l'indizio è venuto dopo.
- Per noi: le persone perdono "chi me l'ha detto" più in fretta di "cosa"; una macchina può tenere la fonte per sempre, e
  deve tenerla accanto all'elemento anziché in un record separato che si può perdere (un passaggio senza la sua fonte è
  uno sleeper effect).

### 2.2 Disinformazione e influenza persistente delle ritrattazioni
- **Effetto della disinformazione** (Loftus & Palmer 1974; rassegna di Loftus 2005) [sec]: l'informazione incontrata dopo
  un evento cambia ciò che se ne riferisce poi.
- **Falsi ricordi per le fake news** (Murphy, Loftus, Hofstein Grady, Levine & Greene 2019, Psychological Science)
  [A+]: 3.140 elettori hanno visto sei storie, due inventate; quasi la metà ha riferito un ricordo di almeno un evento
  inventato, oltre un terzo un ricordo specifico; di più quando la storia era in linea con la loro parte; un avviso che
  alcune storie potevano essere false è servito a poco.
- **Effetto di influenza persistente** (Lewandowsky et al. 2012; Ecker, Lewandowsky et al. 2022, Nature Reviews
  Psychology) [A]: la disinformazione corretta continua a plasmare il ragionamento dopo una ritrattazione credibile; i
  fattori sono cognitivi, sociali e affettivi, non la mancanza di accesso a buona informazione. La familiarità è uno dei
  fattori: ripetere il mito dentro la correzione può alimentarlo (Swire, Ecker & Lewandowsky, secondo la copertura della
  rassegna) [sec]. Le ritrattazioni funzionano meglio quando offrono una spiegazione alternativa (la linea della
  rassegna sul debunking) [sec].

### 2.3 Ripetizione: l'illusory truth effect
- Hasher, Goldstein & Toppino 1977 ("Frequency and the conference of referential validity") [sec]: le affermazioni
  ripetute sono giudicate più vere. Fazio, Brashier, Payne & Marsh 2015 [A]: sapere meglio non protegge — la fluidità
  vince sulla conoscenza conservata ("knowledge neglect"). Il maggiore incremento viene dalla seconda esposizione (Hassan
  & Barber 2021) [sec]; una meta-analisi (Dechêne et al. 2010) riporta un effetto medio [sec].
- LLM: uno studio del 2026 (Bouleimen, Pagan & Hannák, Zurigo; visto solo su un elenco-specchio, **nessun id arXiv
  trovato — non verificato**) riporta effetti di ripetizione misti tra i modelli in un feed di notizie simulato. Non
  correlato ma pertinente: modelli influenzati dagli errori presenti nel proprio contesto (§3.5).
- Per noi: la ripetizione da una sola origine (lo stesso articolo riscaricato, una voce ripetuta dallo stesso gruppo, il
  riassunto che ne fa l'agente stesso) non deve contare come conferma.

### 2.4 Come si ricordano le notizie: i flashbulb memories
- Brown & Kulik 1977 [sec]: ricordi vividi e sicuri delle circostanze in cui si è appresa una notizia sconvolgente.
- **Talarico & Rubin 2003** ("Confidence, not consistency", Psychological Science) [A]: i ricordi dell'11 settembre
  hanno perso coerenza allo stesso ritmo dei ricordi quotidiani; solo vividezza e sicurezza sono rimaste alte.
- **Hirst et al. 2015** (J. Exp. Psychol. General, follow-up a dieci anni) [A]: oblio rapido nel primo anno poi un
  plateau; la sicurezza è rimasta alta; l'attenzione dei media e le conversazioni successive predicevano l'accuratezza
  del ricordo dell'*evento*, e i ricordi imprecisi dell'evento venivano corretti più spesso, mentre i ricordi sbagliati
  delle *proprie circostanze* venivano ripetuti anziché corretti.
- Per noi: la sicurezza non è prova di accuratezza; ciò che il mondo pubblico continua a raccontare (l'evento) si
  autocorregge, ciò che solo la memoria possiede (chi ce l'ha detto, dove eravamo) no — esattamente ciò che una
  macchina dovrebbe conservare alla lettera.

### 2.5 Cosa viene codificato
- **Livelli di elaborazione** (Craik & Lockhart 1972) [sec]: l'elaborazione basata sul significato lascia tracce più
  forti di quella superficiale. **Effetto di autoriferimento** (Rogers, Kuiper & Kirker 1977; meta-analisi di Symons &
  Johnson 1997) [sec]: il materiale legato a sé si ricorda meglio. L'**attivazione emotiva** rafforza il consolidamento
  (McGaugh 2004) [sec]. Gli **schemi** accelerano l'integrazione di elementi coerenti e possono distorcere (Tse et al.
  2007; Gilboa & Marlatte 2017 — nella scheda sulla memoria umana).
- **Ricordo delle notizie** [sec]: *Poor Reception* di Gunter (1987) e la letteratura sulle notizie trasmesse rilevano
  che molto di ciò che si guarda è frainteso o dimenticato presto; leggere si ricorda meglio che guardare in alcuni
  confronti. In questo giro non è stata trovata una percentuale affidabile.
- Per noi: la regola NEWS LEARNED ("solo quando riguarda la mia vita") è l'effetto di autoriferimento scritto come
  politica di scrittura. È ben fondata per la memoria personale; per una memoria di entità, il "sé" è la casa / il luogo
  / i compiti propri dell'agente, che è ciò che la variante entità già dice.

### 2.6 Da episodio a conoscenza: la semantizzazione
- **Sistemi di apprendimento complementari** (McClelland, McNaughton & O'Reilly 1995; Kumaran, Hassabis & McClelland
  2016) [sec, nella scheda sulla memoria umana]: apprendimento episodico rapido, apprendimento semantico lento e
  intercalato; l'integrazione rapida è sicura per elementi coerenti con lo schema.
- **Ipotesi della trasformazione** (Winocur & Moscovitch 2011, JINS) [A]: col tempo una memoria episodica dettagliata
  dà origine a una memoria schematica / semantica meno dettagliata, recuperabile senza l'episodio; l'episodio può
  restare.
- Per noi: "il 3 nov ho letto sul sito X che la farmacia chiude alle 7" (episodio con fonte) → "la farmacia chiude alle
  7" (conoscenza). Le persone perdono l'episodio e tengono il succo, poi non sanno dire perché ci credono. La versione
  per la macchina: derivare la conoscenza, tenere il collegamento ai suoi episodi e alle sue fonti (D29 lo fa già per le
  note).

### 2.7 Sapere dove guardare: memoria transattiva e delega
- **Memoria transattiva** (Wegner 1987; Wegner, Erber & Raymond 1991, JPSP) [A]: le coppie strette si dividono il
  lavoro di memoria secondo la competenza nota e ricordano di più insieme; imporre un'altra divisione lo disturba.
- **Google effect** (Sparrow, Liu & Wegner 2011, Science) [sec]: chi si aspetta di avere accesso in futuro ricorda
  *dove* anziché *cosa*. Il suo esperimento di Stroop **non si è replicato** in Camerer et al. 2018 e di nuovo
  (Hesselmann 2020, PeerJ) [A]; trattare l'affermazione "memorizziamo meno quando possiamo cercare" come contestata.
- **Delega cognitiva** (Risko & Gilbert 2016, TiCS) [A]: le persone delegano quando credono sia più efficiente, credenze
  non sempre giuste. **Saving-enhanced memory** (Storm & Stone 2015) [sec]: salvare un elenco libera memoria per il
  successivo — solo quando salvare è ritenuto affidabile.
- Per noi: per i fatti pubblici volatili (un orario, un prezzo, una previsione) la memoria giusta è spesso un
  *puntatore* — "gli orari dei bus sono sul sito dell'operatore; Paolo sa della caldaia" — non il valore.

### 2.8 Fiducia nella testimonianza: vigilanza epistemica e credibilità
- **Vigilanza epistemica** (Sperber, Clément, Heintz, Mascaro, Mercier, Origgi & Wilson 2010, Mind & Language) [A]: le
  persone dipendono dalla comunicazione e hanno quindi meccanismi che controllano sia la *fonte* (competenza,
  benevolenza) sia il *contenuto* (coerenza con ciò che credono); la fiducia è calibrata, non di default.
- **Credibilità della fonte** (Hovland & Weiss 1951) [sec]: le fonti credibili persuadono di più subito; il divario si
  riduce col tempo (lo sleeper effect, §2.1).
- Per noi: due controlli distinti — chi l'ha detto (e attraverso quale canale) e se si accorda con ciò che la memoria
  sa — ed entrambi registrati, non solo applicati.

## 3. Come i bambini imparano da ciò che si dice loro, si mostra e si legge

### 3.1 Fiducia selettiva negli informatori
- **Koenig & Harris 2005** (Child Development) [A]: i bambini di 4 anni (non quelli di 3) preferiscono un informatore
  che è stato accurato in precedenza, ne prevedono l'accuratezza futura e accettano le sue nuove informazioni; a 3 e 4
  anni preferiscono chi sa a chi ignora. **Corriveau & Harris 2009** (Developmental Science, "Choosing your informant")
  [A]: i bambini preferiscono gli informatori familiari ma si adeguano all'accuratezza recente; un insegnante familiare
  ma inaccurato perde fiducia, soprattutto a 5 anni. L'informazione sull'accuratezza mantiene il suo effetto una
  settimana dopo (Corriveau & Harris 2009b) [sec].
- **Mascaro & Sperber 2009** (Cognition) [A]: tre componenti si sviluppano separatamente — preferenza per gli
  informatori benevoli (3 anni), comprensione che una bugia è falsa (circa 4), riconoscimento dell'intento di ingannare
  (4 anni e oltre).
- Per noi: la fiducia per informatore si impara dal **curriculum** (accuratezza), parte dalla **familiarità** (i membri
  della casa prima degli estranei) e si rivede quando il familiare sbaglia. Corrisponde ai contatti di una memoria di
  entità.

### 3.2 Pedagogia naturale e sovra-imitazione
- **Pedagogia naturale** (Csibra & Gergely 2009, TiCS) [A]: quando ci si rivolge a loro in modo ostensivo ("guarda",
  contatto visivo, un nome), i bambini prendono ciò che viene mostrato come conoscenza generica, rilevante per la
  categoria ("si aprono così"), non come un caso isolato.
- **Sovra-imitazione** (Lyons, Young & Keil 2007, PNAS) [sec]: i bambini copiano passaggi causalmente irrilevanti
  mostrati da un adulto, letti come parte del "modo giusto".
- Per noi: essere *istruiti* ("ricorda: il bidone verde si porta fuori il martedì") è un atto diverso dall'origliare;
  un'istruzione deliberata all'agente può essere tenuta subito come procedura / regola, con il suo insegnante, mentre
  una frase origliata no. La sovra-imitazione è la cautela: una procedura insegnata si tiene intera anche dove un
  passaggio è inutile — l'agente deve tenerla come insegnata e attribuirla, non "ottimizzarla" di nascosto.

### 3.3 Fast mapping, slow mapping
- Carey & Bartlett 1978 [sec]: un'esposizione dà una mappatura parziale. **Horst & Samuelson 2008** [sec]: a 24 mesi i
  bambini scelgono subito l'oggetto nuovo giusto ma cinque minuti dopo ricordano il nome a caso; il fast mapping ha
  bisogno dello slow mapping (ripetizione in contesti diversi) per diventare conoscenza.
- Per noi: una sola menzione dovrebbe creare un elemento provvisorio (pending), confermato da incontri successivi
  indipendenti — "una nota sentita una volta si conferma" di F2b è la stessa idea.

### 3.4 Rivedere le credenze su evidenza e correzione
- **Bonawitz, van Schijndel, Friel & Schulz 2012** (Cognitive Psychology) [A]: i bambini integrano credenze pregresse
  ed evidenza; l'evidenza che viola le credenze spinge a esplorare di più; l'apprendimento è "conservativo e
  flessibile".
- Il source monitoring dei bambini si sviluppa tra i 3 e gli 8 anni (Poole & Lindsay 2002, nella scheda sulla memoria
  umana): i bambini piccoli confondono ciò che è stato detto loro con ciò che hanno visto.
- Per noi: una correzione dovrebbe avviare una verifica (chiedere / controllare), non solo sovrascrivere; una
  contraddizione è un segnale di apprendimento.

### 3.5 Domande, curiosità, gioco
- **Chouinard 2007** (Monographs SRCD, con Harris & Maratsos) [A]: le domande dei bambini sono un meccanismo di richiesta
  di informazioni che guida lo sviluppo cognitivo: chiedono spesso, ottengono risposte utili e richiedono di nuovo
  quando la risposta manca.
- **Gopnik 2020** (Phil. Trans. B, "Childhood as a solution to explore–exploit tensions") [A]: un periodo protetto di
  ampia esplorazione precede lo sfruttamento; la neofilia e il gioco ne fanno parte.
- Per noi: una memoria di entità nuova in una casa dovrebbe chiedere di più e agire meno; man mano che sa di più, la
  curva si inverte ("meno domande man mano che sa di più" di D55). Il punto di Gopnik aggiunge che *la protezione*
  conta: l'esplorazione è sicura perché un adulto di riferimento porta le conseguenze — per un robot, le iniziative
  restano a bassa posta mentre impara.

## 4. Sviluppo e apprendimento dei robot

- **Robotica dello sviluppo** (rassegna di Asada et al. 2009; Cangelosi & Schlesinger 2015, *Developmental Robotics*,
  MIT Press) [sec]: robot che sviluppano abilità e conoscenza attraverso un apprendimento a stadi, incarnato e sociale,
  modellato sui neonati.
- **Motivazione intrinseca da progresso nell'apprendimento** (Oudeyer, Kaplan & Hafner 2007, IEEE TEC) [A]: il robot
  cerca le situazioni in cui il suo errore di previsione *cala più in fretta* — né banali né senza speranza; nell'esperimento
  Playground passa da solo da attività facili ad attività più difficili.
- **Apprendimento continuo per i robot** (Lesort et al., arXiv:1907.00182) [A]: imparare da una sequenza mutevole di
  esperienze senza dimenticanza catastrofica; la maggior parte dei metodi è provata in simulazione. Un servizio di
  memoria evita l'oblio dei pesi (nulla viene addestrato), ma incontra il suo analogo: le voci vecchie che soffocano le
  nuove (§6.3).
- **Memoria incarnata con LLM**: ReMEmbR (Anwar et al., arXiv:2409.13682) [A] — didascalie del video del robot in un
  archivio vettoriale interrogato da un agente LLM su testo, spazio e tempo; gli autori notano voci ripetitive che
  diluiscono l'archivio. Embodied-RAG (Xie et al., arXiv:2409.18313) [A] — una foresta semantica di descrizioni a più
  livelli di dettaglio. KARMA (Wang et al., arXiv:2409.14908) [A] — grafo di scena a lungo termine più una memoria a
  breve termine dei cambiamenti degli oggetti. HARMONI (Malécot et al., arXiv:2601.19839) [A] — robot sociale
  multi-utente con identificazione del parlante e profili per utente aggiornati in conversazione, provato in una casa
  di riposo.
- **Robot che chiedono** (KnowNo, Ren et al., arXiv:2307.01928, CoRL 2023) [A]: un pianificatore LLM misura la propria
  incertezza (conformal prediction) e chiede a una persona solo quando è incerto, con un limite statistico sul
  successo. **Disambiguazione attiva dei compiti** (Kobalczyk et al., arXiv:2502.04485) [A]: la domanda da fare è
  quella che ci si aspetta riduca di più l'incertezza. InteractComp (arXiv:2510.24668, visto nella ricerca, non aperto
  — non citare ancora) riporta che fare domande indiscriminatamente non aiuta.
- **Agenti proattivi** (Lu et al., arXiv:2410.12361, ProactiveBench) [A]: agenti che deducono compiti dall'attività e
  offrono aiuto, addestrati su etichette di accettazione / rifiuto umane — lo stesso segnale di esito di D55 F4.
- Per noi: nessuna di queste memorie di robot separa *detto* da *letto* da *visto* con fiducia per fonte; ReMEmbR /
  Embodied-RAG / KARMA sono memorie di percezione (ciò che D56 di Recordare copre a parole), HARMONI sono profili per
  utente. La parte da bambino — imparare *dalla testimonianza* con fiducia calibrata — manca nei lavori sui robot
  trovati.

## 5. Cosa fanno i sistemi di memoria per agenti con output di strumenti, pagine e documenti

### 5.1 Prodotti e framework
- **MemGPT / Letta** (Packer et al., arXiv:2310.08560; documentazione Letta) [A]: la memoria d'archivio è un archivio
  separato che l'agente scrive deliberatamente (`archival_memory_insert`, con tag) e cerca; i blocchi di memoria core
  tengono uno stato piccolo e che cambia spesso. Nessun campo di fiducia o scadenza documentato.
- **Graphiti / Zep** (documentazione) [A]: episodi di tipo `message | text | json` con una `source_description` a testo
  libero ("articolo di giornale"); i documenti sono divisi in episodi `text` e passano per la stessa estrazione di
  entità / fatti della conversazione, con archi bi-temporali. La fonte è un'etichetta, non un livello di fiducia.
- **Mem0** (documentazione) [A]: memorie con ambito utente / agente / esecuzione; `infer=False` memorizza il testo alla
  lettera, i metadati come filtri; nulla di specifico per l'output degli strumenti.
- **Supermemory** (documentazione) [A]: tutto ciò che si ingerisce è un "documento" (file, URL, testo) diviso
  automaticamente in "memorie"; un percorso più economico salta l'estrazione di memorie per il semplice recupero.
- **LangMem** [A, pagine secondarie]: memoria semantica / episodica / procedurale; scrive nel percorso caldo (strumenti
  dell'agente) o in background dopo una conversazione.
- **Memoria di ChatGPT** (pagine di aiuto OpenAI) [A]: memorie salvate (esplicite) più una sintesi automatica della
  cronologia delle chat; i criteri di ciò che viene salvato non sono pubblici.
- **Generative Agents** (Park et al., arXiv:2304.03442) [A, scheda nella rassegna sulla memoria umana]: ogni
  osservazione entra nel flusso con un punteggio di importanza dato da un LLM; le riflessioni citano le evidenze.
  **Reflexion** (Shinn et al., arXiv:2303.11366) [A]: lezioni verbali dal feedback tenute per le prove successive.
  **Voyager** (Wang et al., arXiv:2305.16291) [A]: una libreria di abilità di programmi eseguibili, memorizzati e
  recuperati interi, raffinati dagli errori di esecuzione e dall'autoverifica; un'abilità entra nella libreria solo
  dopo essere stata verificata.
- Riepilogo: i prodotti o memorizzano tutto ciò che dice un documento (Graphiti, Supermemory) o lasciano scegliere al
  modello (Letta, ChatGPT); **nessuno documenta un livello di fiducia per fonte, una scadenza per i fatti deperibili o
  una regola contro il contare la ripetizione come conferma.** D49 di Recordare (fonti a parte, con provenienza) più la
  regola del taint è già più prudente dei prodotti documentati.

### 5.2 Filtro di scrittura
- **SAGE** (Wang, Brahma & Henao, arXiv:2605.30711) [A]: la decisione di scrittura come rilevamento di novità sugli
  embedding della memoria; ADD / NOOP chiari decisi senza l'LLM, solo i casi incerti vanno ad esso; il 16–18 % delle
  chiamate LLM di scrittura saltate su A-Mem.
- **ConsistencyGate** (Zhang & Li, arXiv:2607.22962) [A]: un fatto allucinato scritto una volta diventa una premessa
  falsa ("contaminazione della memoria"); ammettere solo i fatti che il modello sostiene in K campioni; il costo ricade
  sui fatti impliciti.
- **MemoryBank** (Zhong et al., arXiv:2305.10250) [A]: sfumare in stile Ebbinghaus per tempo e rilevanza, rinforzato al
  richiamo.
- Per noi: Recordare filtra già per importanza ed evidenza; il nuovo filtro necessario è per **fonte e tipo**, non per
  novità.

### 5.3 Conoscenza sensibile al tempo
- **RealTime QA** (Kasai et al., arXiv:2207.13332) [A]: con documenti freschi i modelli aggiornano le risposte; senza,
  danno risposte vecchie anziché astenersi. **FreshQA** (Vu et al., arXiv:2310.03214) [A]: le domande a rapido
  cambiamento e a premessa falsa sono difficili per ogni dimensione di modello; i risultati di ricerca nel prompt
  aiutano.
- **ScrubJay-MEM** (Bhandari et al., arXiv:2608.04746) [A]: a ogni memoria si assegna una *deperibilità* stimata e un
  orizzonte di utilità; decadimento per tipo di contenuto; i guadagni calano con modelli più forti e si invertono sul
  consolidamento dei fatti.
- **MemStrata** (Yadav, arXiv:2606.26511) [A]: una regola deterministica di sostituzione soggetto–relazione–oggetto su
  un registro bi-temporale elimina gli errori da fatti vecchi (15–40 % → ~0 %); la similarità tra embedding non
  distingue una contraddizione da un duplicato (AUROC 0,59). La sostituzione dei fatti di Recordare è questo disegno.
- **STALE** (arXiv:2605.06527, scheda `stale-implicit-conflict_it.md`), **MemoryAgentBench** (Hu, Wang & McAuley,
  arXiv:2507.05257) [A] — tra le competenze l'apprendimento al momento del test e l'oblio selettivo; l'aggiornamento
  della conoscenza di LongMemEval (scheda).
- **Conflitti di conoscenza** (rassegna di Xu et al., arXiv:2403.08319) [A]: conflitti contesto–memoria, tra contesti e
  intra-memoria. **Adaptive Chameleon or Stubborn Sloth** (Xie et al., arXiv:2305.13300, ICLR 2024) [A]: i modelli
  accettano evidenza esterna coerente e persuasiva anche contro ciò che sanno, e favoriscono l'evidenza che concorda in
  parte con loro (bias di conferma). **Generazione consapevole della credibilità** (Pan et al., arXiv:2404.06809, EMNLP
  2024) [A]: dare a ogni passaggio un livello di credibilità e addestrare il modello a usarlo migliora la robustezza ai
  documenti rumorosi. **Addestramento consapevole della fonte** (Khalifa et al., arXiv:2404.01019, COLM 2024) [A]:
  l'attribuzione va incorporata; i modelli non conservano le fonti da soli.

## 6. Rischi

### 6.1 Avvelenamento attraverso ciò che l'agente legge
- **AgentPoison** (Chen et al., arXiv:2407.12784) [A]: una backdoor ottimizzata sul trigger nella memoria / base di
  conoscenza di un agente: >80 % di successo dell'attacco, <1 % di perdita benigna, tasso di veleno <0,1 %.
- **PoisonedRAG** (Zou et al., arXiv:2402.07867, USENIX Security 2025) [A]: cinque testi costruiti per ogni domanda
  bersaglio in un corpus di milioni danno circa il 90 % di successo.
- **MINJA** (Dong et al., arXiv:2503.03704) [A]: un utente ordinario pianta record con le sole interrogazioni; Sunil et
  al. (arXiv:2601.05504) [A] trovano che le memorie legittime esistenti ne riducono l'effetto e che le soglie di fiducia
  sono difficili da calibrare (troppo strette bloccano tutto, troppo larghe mancano l'attacco).
- **Incidenti reali** [A, stampa di sicurezza]: SpAIware (Rehberger 2024) — una pagina web o un documento che l'utente
  aveva chiesto a ChatGPT di leggere ha scritto memorie persistenti; ZombieAgent (Radware, divulgato a gennaio 2026) —
  un file / un'email condivisa ha impostato regole di memoria che giravano a ogni messaggio successivo.
- **Dall'input non fidato alla memoria fidata** (Dash et al., arXiv:2606.04329) [A]: quattro canali di scrittura,
  nove debolezze strutturali, sei classi di attacco (MPBench); gli agenti che scrivono memoria più avidamente sono più
  sfruttabili; le difese contro il prompt injection non la coprono. **MemEvoBench** (Xie et al., arXiv:2604.15774) [A]:
  memoria mista benigna / fuorviante, inclusi flussi contaminati dagli strumenti, degrada la sicurezza nei round; le
  difese a prompt sono insufficienti. Rassegna con una visione del ciclo di vita e "governance verificabile della
  memoria" (provenienza, versionamento, politica di conservazione) — Lin et al., arXiv:2604.16548 [A].

### 6.2 Riciclaggio: ripetizione, riassunti propri, echi
- **Autorità legata all'origine** (Louck, arXiv:2606.24322) [A]: le difese che giudicano una memoria dal contenuto o
  dalla storia di derivazione possono essere battute dal *riciclaggio* — il riassunto che l'agente stesso fa di un testo
  avvelenato, echi attraverso uno strumento fidato, corroborazione fabbricata (fino al 68 % di successo dell'attacco
  sulle difese esistenti); servono l'origine legata al momento della scrittura e una corroborazione resistente agli
  attacchi Sybil; la loro costruzione riporta 0 %.
- **Aggiornamento limitato dalla provenienza** (Singh, arXiv:2606.22030) [A]: una fiducia ricavata da *quanto sicuro
  suona il testo* è manipolabile; limitare la fiducia con la provenienza — min(provenienza, contenuto) — resiste
  all'avvelenamento di volume a un certo costo di utilità.
- **A-MemGuard** (Wei et al., arXiv:2510.02373, ICML 2026) [A]: gli audit per singola voce mancano il veleno attivato dal
  contesto; il consenso tra memorie correlate più una memoria separata di "lezioni" hanno ridotto il successo
  dell'attacco di >95 %.
- È l'illusory truth effect (§2.3) come attacco: la stessa affermazione che rientra da più porte sembra corroborata.

### 6.3 Disinformazione, notizie vecchie, errori appiccicosi
- L'informazione ritrattata continua a influenzare (§2.2); nei modelli, il **contextual drag** (Cheng, Zhu, Zhao &
  Arora, arXiv:2602.04288) [A]: gli errori presenti nel contesto tirano il ragionamento successivo verso errori simili
  (cali del 10–20 %), non eliminati dal feedback; l'**interferenza proattiva** (Chattaraj & Raj, arXiv:2603.00270) [A]:
  in 39 modelli i valori precedenti disturbano il richiamo di quelli più recenti molto più del contrario. Quindi un
  elemento sostituito o ritrattato che raggiunge ancora il contesto fa danno anche se etichettato.
- Notizie vecchie: i modelli rispondono da documenti vecchi anziché astenersi (RealTime QA); una previsione o un avviso
  di sciopero tenuto oltre la sua data è conoscenza sbagliata.

## 7. Implicazioni di progetto per Recordare (ciascuna da misurare; nessuna presentata come nuova)

1. **Tre classi di scrittura per l'informazione esterna, decise dal codice dalla provenienza del turno, il modello che
   si limita a proporre.** (a) *Riguarda una vita nota* → episodio (come la regola NEWS LEARNED di oggi; effetto di
   autoriferimento §2.5). (b) *Conoscenza duratura sul luogo / il mondo in cui l'agente lavora* (orari della farmacia
   che la casa usa, come si riavvia la caldaia, il nome di un vicino) → un **elemento appreso**: una nota di un nuovo
   tipo (o un passaggio in D49) di origine `learned` (vedi 3), pending, con la sua fonte. (c) *Tutto il resto* (titoli,
   curiosità, risposte a domande generali, pagine di risultati di ricerca) → solo registro grezzo, più al massimo un
   puntatore (implicazione 8). Fondamento: livelli di elaborazione e autoriferimento (§2.5), la regola NEWS LEARNED,
   SAGE / ConsistencyGate (§5.2) per il filtro; Dash et al.: gli scrittori avidi sono più sfruttabili (§6.1). Mai
   "memorizzare tutto ciò che dice un documento" (Graphiti / Supermemory) per una memoria di entità.
2. **La fonte viaggia con ogni elemento appreso e non si perde mai nella derivazione.** Memorizzare: canale (nome dello
   strumento / URL / id del documento / persona / percezione), chi l'ha portato (`providedBy`), quando è stato appreso,
   quando il contenuto vale (entrambe le date, già nella regola) e gli id dei messaggi del registro grezzo. Le note o i
   digest tratti da elementi appresi ereditano la fonte più debole (come D29 fa per il pubblico). Fondamento: sleeper
   effect e amnesia della fonte (§2.1), ipotesi della trasformazione — tenere l'episodio sotto il succo (§2.6),
   addestramento consapevole della fonte (§5.3), autorità legata all'origine (§6.2).
3. **Un'origine distinta per appreso-dall'esterno, a parte da raccontato e percepito.** Reality monitoring per
   l'agente: `perceived` (visto), `holder_told` / `told` (l'ha detto una persona), **`learned` / `read`** (l'ha detto uno
   strumento, una pagina o un documento), `reflected` (concluso). Il richiamo li etichetta ("ho letto il …", "me l'ha
   detto Paolo", "ho visto"). Fondamento: source monitoring (§2.1), le confusioni di fonte dei bambini (§3.4), il
   risultato sul reality monitoring degli LLM nella scheda sulla memoria umana.
4. **Livelli di fiducia per fonte, limitati dalla provenienza, mai dalle parole.** Livelli iniziali come configurazione
   (dati, in ogni lingua): un membro verificato della casa > un contatto noto > gli strumenti propri dell'agente su
   servizi di prima parte (calendario, un dispositivo) > una fonte pubblica con nome > una pagina anonima / un mittente
   sconosciuto. Il livello limita ciò che un elemento può diventare: sotto una soglia resta pending e si dice con la sua
   fonte; non diventa mai `stated`. Un testo che "suona sicuro" non guadagna nulla. Fondamento: vigilanza epistemica
   (§2.8), aggiornamento limitato dalla provenienza e autorità legata all'origine (§6.2), generazione consapevole della
   credibilità (§5.3), la guardia esistente sull'avvelenamento con `author_role`.
5. **Fiducia imparata dagli esiti, per informatore, come un bambino.** Ogni contatto / fonte tiene un curriculum:
   elementi poi confermati contro corretti / ritrattati. La familiarità fissa la partenza (la casa prima degli
   estranei); l'accuratezza recente la sposta, e anche un informatore familiare ma sbagliato perde fiducia. Contatori
   deterministici, senza LLM; usati solo per ordinare e per limitare (implicazione 4), mai per portare uno strumento o
   una pagina sopra la sua classe. Fondamento: Koenig & Harris 2005, Corriveau & Harris 2009, Mascaro & Sperber 2009
   (§3.1); D55 F4 impara già i tempi dagli esiti — stesso schema.
6. **La ripetizione non è conferma.** La corroborazione conta solo le *origini indipendenti*: due persone che non erano
   nella stessa conversazione, una persona più uno strumento di prima parte; lo stesso URL riscaricato, la stessa chat
   di gruppo che ripete, un racconto di ciò che l'agente stesso ha detto, o il riassunto dell'agente contano una
   volta. Regola di codice sugli id delle fonti. Fondamento: illusory truth (§2.3), riciclaggio e corroborazione Sybil
   (§6.2), fast contro slow mapping — la conferma richiede incontri separati (§3.3).
7. **Deperibile contro duraturo, con una scadenza fissata alla scrittura.** L'estrazione (o una tabella di tipi)
   etichetta un elemento appreso *deperibile* (previsione, sciopero, ritardo, un prezzo, notizie "di oggi"; scade alla
   data della notizia stessa o a un valore predefinito per tipo), *a lenta variazione* (orari di apertura, un numero di
   telefono: ricontrollare dopo N mesi, il flag `needsRecheck`) o *duraturo* (come funziona un dispositivo). Gli
   elementi scaduti sfumano come le percezioni (D56) — l'episodio "ho saputo che …" resta se riguardava una vita.
   Fondamento: RealTime QA / FreshQA (§5.3), deperibilità di ScrubJay-MEM, sfumare di MemoryBank, precedente D56.
8. **Sapere dove guardare anziché memorizzare (memoria transattiva).** Per i fatti pubblici volatili tenere un
   *puntatore*: "orari dei bus: il sito dell'operatore, tramite lo strumento web"; "la caldaia: il manuale (fonte X) o
   Paolo". I risponditori `lookup` / `ask` di D55 diventano memoria: chi o cosa ha risposto a quale tipo di domanda, e
   quanto bene (implicazione 5). Fondamento: Wegner 1987 / 1991, delega cognitiva (§2.7) — con la cautela che il Google
   effect è contestato; e D49 tiene già intere le fonti ricercabili, quindi memorizzare un valore letto da esse è
   spesso ridondante.
9. **Correzioni e ritrattazioni sostituiscono, e il vecchio valore esce dal contesto.** Una ritrattazione dalla stessa
   fonte o da una più fidata segna l'elemento `corrected` / `retracted` con il motivo; il richiamo non serve il vecchio
   valore, nemmeno etichettato, a meno che non si chieda la storia — e quando deve, dà la correzione con una
   spiegazione, non prima il mito. Una fonte ritrattata si propaga: i suoi elementi derivati ricevono `needsRecheck`.
   Fondamento: influenza persistente e backfire della familiarità (§2.2), contextual drag e interferenza proattiva
   (§6.3), MemStrata (§5.3).
10. **Un ciclo di apprendimento per la memoria di entità: notare → chiedere / cercare → tenere con la fonte → usare →
    essere corretta.** *Notare*: una lacuna (un nome sconosciuto, una domanda a cui l'agente non ha saputo rispondere,
    una contraddizione — Bonawitz: le contraddizioni guidano l'esplorazione). *Chiedere / cercare*: `ask` / `lookup` di
    D55, scegliendo la domanda che riduce di più l'incertezza (Kobalczyk et al.) e chiedendo quando è incerta (KnowNo),
    l'informatore più affidabile per primo (implicazione 5). *Tenere*: come elemento appreso pending con la fonte
    (2–4). *Usare*: nel richiamo, etichettato per origine. *Essere corretta*: l'esito aggiorna l'elemento e il
    curriculum dell'informatore (5, 9). Ritmo del progresso nell'apprendimento (Oudeyer): preferire le domande nelle
    aree dove le risposte hanno di recente cambiato la memoria; smettere di chiedere dove non arriva nulla di nuovo. Le
    domande dei bambini come meccanismo (Chouinard).
11. **Insegnato non è origliato (pedagogia naturale).** Un'istruzione esplicita all'agente da un membro della casa
    ("ricorda che …", "da noi si fa così …") è tenuta subito come regola / procedura dichiarata con il suo insegnante;
    una frase origliata o una pagina è pending finché non è confermata. Tenere le procedure insegnate come insegnate (la
    sovra-imitazione è il precedente umano; l'agente non deve scartare passaggi di nascosto). Fondamento: Csibra &
    Gergely, Lyons et al. (§3.2).
12. **Cosa una memoria da bambino tiene e cosa dimentica.** Tiene: chi ha detto cosa (alla lettera), le regole
    insegnate, i curricula degli informatori, ciò che ha riguardato la casa, la conoscenza duratura di come funzionano le
    cose, le correzioni. Dimentica (sfuma): le notizie deperibili oltre la loro data, le menzioni singole non
    confermate dopo una finestra, il testo grezzo delle pagine non citato da nulla (resta in D49 solo se inviato come
    fonte), le voci ripetute (la diluizione di ReMEmbR). Fondamento: Richards & Frankland — l'oblio serve le decisioni
    (scheda sulla memoria umana), fast / slow mapping (§3.3), D56.
13. **La conoscenza appresa alimenta le iniziative solo attraverso la decisione della memoria stessa, mai dal testo
    esterno.** (a) Un'iniziativa può essere *attivata* da un elemento appreso solo quando riguarda una vita nota
    (classe a) e la sua fonte è almeno a una soglia di fiducia — oppure l'iniziativa è una *domanda* ("ho letto che
    domani il bus della linea 3 è in sciopero — lo prendi?"), che è sempre sicura. (b) Le istruzioni dentro il
    contenuto esterno (una pagina che dice "ricorda a tutti di …", un'email che imposta una regola) non vengono mai
    memorizzate come regole, intenti o iniziative: il contenuto da `tool` / `other` può essere solo informazione, mai
    un'istruzione alla memoria (SpAIware, ZombieAgent, MINJA). (c) Un elemento appreso si dice con la sua fonte e la sua
    data quando è usato in un'iniziativa. (d) Gli elementi appresi restano a parte dalle conclusioni dell'agente
    (`reflected`): un pensiero può citarli, ma la riflessione su elementi appresi pending dà un pensiero pending, e un
    pensiero non promuove mai le sue fonti (riciclaggio, §6.2). Fondamento: §6.1–6.2, carta di D53 / D55, gli esiti
    di accettazione / rifiuto di ProactiveBench come segnale di apprendimento.
14. **Stadi da bambino.** Finché la memoria è giovane (pochi elementi confermati, pochi curricula), più domande e meno
    iniziative dalla conoscenza appresa; le soglie si allentano man mano che i curricula crescono. Misurato come la
    curva di D55. Fondamento: l'infanzia esplora–sfrutta di Gopnik (§3.5), i progressi a stadi di Oudeyer (§4).
15. **Valutazione prima del rilascio**: un dev set per lingua con: notizie non correlate (non devono essere tenute),
    notizie che riguardano un piano (tenute, scadono), un fatto letto una volta contro confermato da una persona
    indipendente, la stessa affermazione ripetuta da una sola fonte (non deve essere confermata), una ritrattazione (il
    vecchio valore deve uscire dal contesto), un'istruzione iniettata in una pagina e in un'email (non deve diventare
    una regola o un'iniziativa), un informatore familiare che si rivela sbagliato (la fiducia cala), un valore volatile
    (puntatore tenuto, valore no), riciclaggio tramite il riassunto dell'agente stesso. Contare: elementi tenuti che non
    dovevano esserlo, valori vecchi serviti, valori ritrattati serviti, regole iniettate memorizzate, iniziative da
    fonti non fidate e eccesso di cautela (conoscenza utile persa). Riusare idee da MPBench, MemEvoBench, STALE,
    MemoryAgentBench; controllare le licenze prima di usare qualsiasi dato.

16. **Procedure: come si fa un compito, tenute intere.** (Aggiunta dal maintainer, 2026-11-11: un robot che impara a
    rifare il letto da una fonte deve ricevere le istruzioni giuste.) Recordare ha già procedure di un tipo (8.12d, D53,
    `thoughts.v7`): "quando <situazione>, <come lo faccio>", un pensiero di una riga di origine `reflected`, imparato dal
    passaggio notturno dei pensieri da un esito sulle risposte dell'agente (insegnato, corretto, approvato), richiamato
    per situazione come "come lo faccio (appreso)". Coprono un modo di fare, non un compito a più passaggi letto in una
    fonte. Oggi un compito simile letto in una fonte è diviso in passaggi di ≈ 1 000 caratteri, `search_knowledge`
    restituisce i più vicini (i passaggi possono mancare o essere fuori ordine), il contesto di memoria aggiunge al più
    un passaggio tagliato a 300 caratteri, e un come-fare insegnato a parole non è estratto affatto (i come-fare non
    sono episodi). Una **procedura** è un'unità: un titolo, passaggi ordinati, la sua fonte, chi l'ha insegnata e quando
    — restituita intera, mai a frammenti. **Il modo proprio della casa prevale su quello generico** ("qui il cuscino va
    sopra il copriletto", insegnato da un familiare, è una variante mostrata come tale sopra il passaggio del manuale).
    **Insegnato si tiene subito, letto è pending** (implicazione 11) finché qualcuno non lo conferma o ha successo.
    **Ogni esecuzione torna indietro**: il client riferisce fatto, fallito al passaggio N, o corretto da una persona; la
    procedura è rivista e il curriculum dell'insegnante si sposta (implicazione 5) — l'esecuzione del robot è un esito
    come la reazione a una risposta in 8.12d, e una procedura di una riga di 8.12d sul compito resta la variante della
    casa. Il contesto di memoria porta l'intera procedura quando la richiesta la riguarda. Recordare dà *cosa fare, in
    quale ordine, con le preferenze della casa e da chi è stato appreso*; trasformare i passaggi in movimento è
    lavoro del client (il controllore del robot), senza dipendenza tra i due. Fondamento: la libreria di abilità di
    Voyager — memorizzate intere, raffinate dal feedback di esecuzione, ammesse dopo la verifica (§5.1); le lezioni dal
    feedback di Reflexion (§5.1); pedagogia naturale e sovra-imitazione — procedure insegnate tenute come insegnate,
    passaggi non scartati di nascosto (§3.2).

## 8. Questioni aperte

- Dove vive la conoscenza appresa duratura — note con origine `learned`, fatti su luoghi / cose, o passaggi in D49 con
  una breve nota di "succo"? Una sola casa è più semplice; l'ipotesi della trasformazione propende per succo + fonte.
- Chi fissa i livelli iniziali di fiducia — chi distribuisce (configurazione), la casa (console) o entrambi? Come
  tenerli indipendenti da lingua e provider (D27)?
- Come distingue l'estrazione deperibile da duraturo in tutte le lingue senza elenchi di parole (la regola di tutte le
  lingue)? Una tabella di tipi in `service/src/lang` più l'etichetta del modello?
- Lo strumento web dell'agente (l'agente ha scelto di cercare) dovrebbe valere più di una pagina incollata da un
  utente? Lo strumento non è l'autore; la pagina sì. Probabilmente la fiducia dell'URL, non quella dello strumento.
- I curricula richiedono esiti risolti; la maggior parte degli elementi appresi non è mai confermata né smentita. Con
  quanta lentezza dovrebbe muoversi la fiducia di un informatore con dati scarsi (un prior per classe)?
- Il "progresso nell'apprendimento" è misurabile su una memoria (quanto spesso le risposte in un argomento hanno
  cambiato di recente la memoria), a basso costo?
- Robot: ReMEmbR / KARMA tengono memorie di percezione dense; Recordare tiene percezioni descritte che sfumano. Basta
  per la conoscenza spaziale di un robot, o la memoria spaziale è compito del client (probabile: del client)?

## 9. Dove le analogie ingannano

- I bambini sono protetti da adulti di riferimento che portano il costo dei loro errori; un agente che agisce in una
  casa non ha un tale cuscinetto, a meno che le iniziative dalla conoscenza appresa non siano tenute a bassa posta per
  regola.
- Le persone perdono le fonti e tengono il succo; una macchina può tenere entrambi. Copiare l'oblio umano delle fonti
  importerebbe lo sleeper effect; copiare l'oblio umano dei dettagli deperibili è utile.
- La vigilanza umana controlla un parlante che si ha davanti; un agente legge testo senza volto — l'origine va
  stabilita dal canale (legame verificato, identità dello strumento), mai da ciò che il testo dice di sé.
- Il modello dell'attaccante non ha un analogo umano su larga scala: i testi di veleno ottimizzati (AgentPoison,
  PoisonedRAG) non sono pettegolezzo.

## 10. Arte nota e novità

Non nuovo: archivi separati con etichette di provenienza (Letta, `source_description` di Graphiti, D49),
filtro di scrittura (SAGE, ConsistencyGate), decadimento consapevole della deperibilità (ScrubJay-MEM), sostituzione
deterministica (MemStrata), fiducia limitata dalla provenienza (Singh), autorità legata all'origine (Louck), livelli di
credibilità sui passaggi (CAG), robot che chiedono quando sono incerti (KnowNo), agenti proattivi dall'attività
(ProactiveBench). Non trovato in questo giro (ricontrollare prima di qualsiasi affermazione): un servizio di memoria
che combini fiducia per informatore *imparata dagli esiti* alla maniera della fiducia selettiva dei bambini,
corroborazione basata sull'indipendenza (la ripetizione non conta), classi di scrittura per riguarda-una-vita /
duraturo / deperibile, e una regola per cui il contenuto esterno appreso può attivare solo domande o iniziative
etichettate con la fonte — misurati insieme su un solo dev set.

## 11. Fonti (segni di lettura)

Esseri umani
- Johnson, Hashtroudi & Lindsay 1993, Source monitoring, Psychological Bulletin [sec; scheda sulla memoria umana]
- Kumkale & Albarracín 2004, The sleeper effect in persuasion: a meta-analytic review, Psychological Bulletin 130(1) [sec]
- Loftus & Palmer 1974; Loftus 2005, Planting misinformation in the human mind, Learning & Memory [sec]
- Murphy, Loftus, Hofstein Grady, Levine & Greene 2019, False memories for fake news during Ireland's abortion
  referendum, Psychological Science 30(10) [A+]
- Lewandowsky, Ecker, Seifert, Schwarz & Cook 2012, Misinformation and its correction, PSPI [sec]
- Ecker, Lewandowsky et al. 2022, The psychological drivers of misinformation belief and its resistance to correction,
  Nature Reviews Psychology 1 [A]
- Hasher, Goldstein & Toppino 1977, Frequency and the conference of referential validity, JVLVB [sec]
- Fazio, Brashier, Payne & Marsh 2015, Knowledge does not protect against illusory truth, JEP: General [A]
- Dechêne et al. 2010 (meta-analisi); Hassan & Barber 2021, Cognitive Research [sec]
- Brown & Kulik 1977, Flashbulb memories, Cognition [sec]
- Talarico & Rubin 2003, Confidence, not consistency, Psychological Science [A]
- Hirst et al. 2015, A ten-year follow-up of a study of memory for the attack of September 11, 2001, JEP: General 144(3) [A]
- Craik & Lockhart 1972; Rogers, Kuiper & Kirker 1977; Symons & Johnson 1997; McGaugh 2004 [sec]
- Gunter 1987, Poor Reception: Misunderstanding and Forgetting Broadcast News [sec]
- McClelland, McNaughton & O'Reilly 1995; Kumaran, Hassabis & McClelland 2016 [sec; scheda sulla memoria umana]
- Winocur & Moscovitch 2011, Memory transformation and systems consolidation, JINS 17 [A]
- Wegner 1987; Wegner, Erber & Raymond 1991, Transactive memory in close relationships, JPSP 61(6) [A]
- Sparrow, Liu & Wegner 2011, Google effects on memory, Science [sec]; Camerer et al. 2018, Nature Human Behaviour
  [sec]; Hesselmann 2020, PeerJ 10325 [A]
- Risko & Gilbert 2016, Cognitive offloading, TiCS 20(9) [A]; Storm & Stone 2015, Saving-enhanced memory, Psych. Science [sec]
- Sperber, Clément, Heintz, Mascaro, Mercier, Origgi & Wilson 2010, Epistemic vigilance, Mind & Language 25(4) [A]
- Hovland & Weiss 1951 [sec]
- Bouleimen, Pagan & Hannák 2026, illusory truth in LLM agents (solo elenco-specchio, nessun id arXiv trovato) [non verificato]

Bambini
- Koenig & Harris 2005, Preschoolers mistrust ignorant and inaccurate speakers, Child Development 76(6) [A]
- Corriveau & Harris 2009, Choosing your informant: weighing familiarity and recent accuracy, Dev. Science 12 [A]
- Mascaro & Sperber 2009, The moral, epistemic, and mindreading components of children's vigilance towards deception,
  Cognition 112(3) [A]
- Csibra & Gergely 2009, Natural pedagogy, TiCS 13(4) [A]
- Lyons, Young & Keil 2007, The hidden structure of overimitation, PNAS 104(50) [sec]
- Carey & Bartlett 1978 [sec]; Horst & Samuelson 2008, Fast mapping but poor retention by 24-month-old infants, Infancy [sec]
- Bonawitz, van Schijndel, Friel & Schulz 2012, Children balance theories and evidence…, Cognitive Psychology 64 [A]
- Poole & Lindsay 2002 [sec; scheda sulla memoria umana]
- Chouinard 2007, Children's questions: a mechanism for cognitive development, Monographs SRCD 72(1) [A]
- Gopnik 2020, Childhood as a solution to explore–exploit tensions, Phil. Trans. R. Soc. B 375 [A]

Sviluppo e apprendimento dei robot
- Asada et al. 2009, Cognitive developmental robotics: a survey, IEEE TAMD [sec]; Cangelosi & Schlesinger 2015,
  Developmental Robotics, MIT Press [sec]
- Oudeyer, Kaplan & Hafner 2007, Intrinsic motivation systems for autonomous mental development, IEEE TEC 11(2) [A]
- Lesort et al., Continual learning for robotics, arXiv:1907.00182 [A]
- Anwar et al., ReMEmbR, arXiv:2409.13682 [A]
- Xie et al., Embodied-RAG, arXiv:2409.18313 [A]
- Wang et al., KARMA, arXiv:2409.14908 [A]
- Malécot et al., HARMONI, arXiv:2601.19839 [A]
- Ren et al., Robots That Ask For Help (KnowNo), arXiv:2307.01928 [A]
- Kobalczyk et al., Active Task Disambiguation with LLMs, arXiv:2502.04485 [A]
- Lu et al., Proactive Agent / ProactiveBench, arXiv:2410.12361 [A]

Sistemi di memoria per agenti e conoscenza
- Packer et al., MemGPT, arXiv:2310.08560 [scheda sulla memoria umana]; documentazione Letta, memoria d'archivio [A]
- Documentazione Graphiti / Zep, aggiunta di episodi [A]; documentazione Mem0, aggiunta di memorie [A]; documentazione
  Supermemory [A]; LangMem (pagine secondarie) [A]; FAQ sulla memoria di OpenAI [A]
- Park et al., Generative Agents, arXiv:2304.03442 [titolo controllato; scheda nella rassegna sulla memoria umana]
- Shinn et al., Reflexion, arXiv:2303.11366 [A]
- Wang et al., Voyager: an open-ended embodied agent with large language models, arXiv:2305.16291 [A]
- Zhong et al., MemoryBank, arXiv:2305.10250 [A]
- Wang, Brahma & Henao, SAGE, arXiv:2605.30711 [A]
- Zhang & Li, ConsistencyGate, arXiv:2607.22962 [A]
- Kasai et al., RealTime QA, arXiv:2207.13332 [A]
- Vu et al., FreshLLMs / FreshQA, arXiv:2310.03214 [A]
- Bhandari et al., ScrubJay-MEM, arXiv:2608.04746 [A]
- Yadav, MemStrata (Temporal validity in retrieval memory), arXiv:2606.26511 [A]
- Hu, Wang & McAuley, MemoryAgentBench, arXiv:2507.05257 [A]
- Xu et al., Knowledge conflicts for LLMs: a survey, arXiv:2403.08319 [A]
- Xie et al., Adaptive Chameleon or Stubborn Sloth, arXiv:2305.13300 [A]
- Pan et al., Credibility-aware generation, arXiv:2404.06809 [A]
- Khalifa et al., Source-aware training, arXiv:2404.01019 [A]
- STALE arXiv:2605.06527; LongMemEval arXiv:2410.10813 [schede esistenti]

Rischi
- Chen et al., AgentPoison, arXiv:2407.12784 [A]
- Zou et al., PoisonedRAG, arXiv:2402.07867 [A]
- Dong et al., MINJA, arXiv:2503.03704 [A]
- Devarangadi Sunil et al., Memory poisoning attack and defense on memory based LLM-agents, arXiv:2601.05504 [A]
- Dash et al., From untrusted input to trusted memory, arXiv:2606.04329 [A]
- Xie et al., MemEvoBench, arXiv:2604.15774 [A]
- Lin et al., Survey on long-term memory security in LLM agents, arXiv:2604.16548 [A]
- Louck, Non-malleable, origin-bound authority, arXiv:2606.24322 [A]
- Singh, Reliability-conditional updating and provenance-capped poisoning defense, arXiv:2606.22030 [A]
- Wei et al., A-MemGuard, arXiv:2510.02373 [A]
- Cheng, Zhu, Zhao & Arora, Contextual Drag, arXiv:2602.04288 [A]
- Chattaraj & Raj, LLMs remember first, forget last, arXiv:2603.00270 [A]
- SpAIware (Rehberger 2024; The Hacker News), ZombieAgent (Radware; SecurityWeek, gen. 2026) [A, stampa]
