# Disclosure — cosa la memoria può dire a chi: cosa ha Recordare, cosa fanno gli altri, come fanno le persone

Ricerca per le fasi del gemello (VISION fasi 2–4, RESEARCH_NOTES H2 / H3), 2026-11-09. Estende il giro di ottobre in
`RESEARCH_NOTES_it.md` H2 e le schede `authorization-before-context`, `collaborative-memory`, `memir-typed-memory`.
Riferimento inglese: [disclosure.md](disclosure.md). Circa 25 ricerche; ogni id arXiv aperto su arxiv.org. Segni di
lettura: [S] testo completo tramite un estrattore, [A+] abstract e parte del testo, [A] solo abstract o pagina del
prodotto. Quasi tutte le fonti del 2026 sono [A]: ricontrollare i numeri prima di citarli fuori. Tutto parafrasato; i
nomi dei modelli nei numeri sono quelli degli articoli.

## 1. Cosa ha già Recordare

- **Memorie private (D52, costruite il 2026-10-27).** Un messaggio è privato quando chi l'ha detto lo chiede a parole
  ("non dirlo a nessuno", in qualunque lingua; sezione PRIVATE dell'estrazione) o quando il client lo segnala (un
  messaggio, una conversazione privata). Tutto ciò che se ne estrae lo eredita, e così la risposta dell'agente in quel
  turno. Lo si dice solo a quella persona e, in una memoria personale, al titolare.
- **Un filtro deterministico su ogni lettura** (`service/src/recall/privacy.ts`). Un elemento è nascosto quando anche un
  solo messaggio dietro di esso è privato di qualcun altro (fallisce chiuso). I diari e gli schemi ricorrenti si
  costruiscono solo dalle memorie pubbliche.
- **Chi legge** è l'autore dell'ultimo turno di una persona nella conversazione: il titolare di una memoria personale legge
  tutto, un contatto identificato legge il pubblico più i suoi elementi privati, chiunque non sia identificato legge solo il
  pubblico. Le identità vengono da legami verificati con i canali (D24, D51), mai da ciò che qualcuno dice.
- **Registrato, mai letto:** `audience` (le persone verificate presenti quando è stato detto), `audience_unverified`,
  `disclosure` (un livello, sempre `holder`), `confidence_of` (la confidenza di un terzo), `origin` (`holder_lived`,
  `holder_told`, `assistant_stated`, `reflected`; `twin_experienced` non ancora).
- **Tutto il resto è pubblico** (D50, D52). Quindi in una memoria personale un contatto identificato che scrive all'agente
  può ricevere qualunque cosa il titolare non abbia dichiarato privata — salute, soldi, cose di famiglia. La confidenza
  di un terzo raccontata senza "non dirlo" può arrivare a chiunque. In una memoria di entità, ciò che un familiare ha
  detto apertamente può arrivare a un ospite. La modalità proxy — il gemello che parla per il titolare — esiste già nei
  fatti, senza altre regole oltre D52.

## 2. Cosa fanno gli altri

**Applicazione: regge solo un filtro rigido prima del contesto.**
- MemLeak (arXiv:2610.04195, NeurIPS-PALM 2026) [A]: un archivio vettoriale condiviso tra utenti perde il 70–100 % senza
  nessun attaccante. Delle tre mitigazioni, solo un filtro deterministico per proprietario ha riportato al livello pulito.
- Inadvertent Context Leakage (arXiv:2608.19857, NeurIPS 2026) [A]: un segreto nel contesto trapela in risposte innocue
  anche quando il modello si rifiuta di rivelarlo; i modelli più capaci perdono di più. Un prompt non è un confine.
- InferPriv (arXiv:2610.34640, 2026-10-25) [S]: un agente personale scrive una risposta di routine a un terzo. Con un
  prompt sulla privacy la perdita diretta è quasi zero, ma chi riceve riesce ancora a dedurre l'attributo sensibile
  (salute, religione, soldi) nel 16–25 % dei casi, anche togliendo il nome dell'attributo dalla memoria.
- Agent Mosaic (arXiv:2610.30418) [A]: documenti permessi si combinano in una conclusione proibita (circa 7 %), e alcuni
  rifiuti rivelano la conclusione (perdita di esistenza).
- PiSAs (arXiv:2607.05318, dati Apache-2.0) [A+]: due etichette per elemento — adatto al compito, e quali utenti possono
  averlo. La memoria condivisa sposta le violazioni invece di toglierle; i dettagli privati legati a un compito trapelano
  per circa il 36 %; i filtri LLM arrivano a circa il 6 % di violazioni a scapito della completezza (75–78 %).
- Le situazioni con più persone perdono di più: MuPPET (arXiv:2606.23217) [A], Loose Lips (arXiv:2610.14071, ×3 in sei
  turni) [A], Got a Secret? (arXiv:2605.27766, la rivelazione di un altro agente rende la successiva circa 8 volte più
  probabile) [A].

**Decidere senza un esplicito "non dirlo".**
- Etichette scritte da un LLM al momento della scrittura: EP-Mem (arXiv:2609.35233, 2026-09-28) [A+] — ora il lavoro più
  vicino a H2: l'utente dà ai contatti dei livelli (con ambiti vita / lavoro) ed elenchi per fatto di permessi e divieti;
  un LLM etichetta ogni evento quando costruisce la memoria (94 % sul set degli autori); un'etichetta "accordo di
  riservatezza" solo su una richiesta esplicita di non diffondere, vicina a D52; un LLM giudica ogni risposta in base a
  chi ascolta e la riscrive o svia. Nessun legame con l'identità, nessun avversario, nessuna misura dei rifiuti eccessivi,
  nessun codice. AIM / MUMBench (arXiv:2609.12320) [A]: privato / pubblico al 96 %. Entrambi su set sintetici propri.
- Ragionamento di integrità contestuale al momento della lettura: PrivacyChecker (arXiv:2509.17488) [A], ragionamento CI
  addestrato con RL (arXiv:2506.04245, codice Apache-2.0) [A], ARIEL (arXiv:2512.05065, i precedenti dell'utente) [A].
  Punti deboli: CIMemories (arXiv:2511.14937) [A] — i modelli condividono tutto o niente, quindi i prompt sulla privacy
  diventano rifiuti eccessivi; AgentSocialBench (arXiv:2604.01487) [A] — dire agli agenti di astrarre le cose sensibili
  li fa parlare di più di quelle cose.
- Ciò che trapela di più non sono gli identificativi: AgentCIScope (arXiv:2610.19158) [A] — preferenze e dettagli delle
  prenotazioni trapelano molto più dei numeri di carta o di previdenza sociale.
- Dal lato della risposta: Disclosure Begets Disclosure (arXiv:2610.28315) [A+] — le risposte con memoria presuppongono
  attributi registrati, l'utente le lascia passare, le ipotesi diventano fatti. La mitigazione migliore è una sola
  istruzione: non affermare né presupporre attributi personali se la persona non li tira fuori. Porta la perdita vicino
  al livello senza memoria e conserva quasi tutta la qualità. HUSH-Bench (arXiv:2606.06055) [A]: con la memoria i modelli
  usano una confidenza sensibile del passato anche quando niente nel turno la chiede (il *mandato*).
- **I rifiuti eccessivi non li misura quasi nessuno** (PiSAs, InferPriv, EP-Mem, GateMem riportano la completezza, non i
  rifiuti).

**Un delegato che parla per il suo mandante.**
- AirGapAgent (arXiv:2405.05175) [S]: dare al delegato solo ciò che serve al compito prima che incontri il terzo.
  Firewalls for agentic networks (arXiv:2502.01822, codice MIT) [A]: i messaggi in arrivo passano per un protocollo chiuso,
  i dati in uscita sono astratti al livello di dettaglio del compito.
- AI Delegates with a Dual Focus (arXiv:2409.17642, Microsoft) [A]: alcuni obiettivi richiedono che il delegato riveli
  qualcosa; la sola restrizione è sbagliata.
- SovereignNegotiation-Bench (arXiv:2607.02814) [A]: i doveri del mandatario (lealtà, obbedienza, riservatezza, franchezza,
  diligenza) come controlli deterministici sui log; i modelli li violano spesso.
- Prodotti (pagine dei fornitori) [A]: ChatGPT spegne la memoria personale in qualsiasi chat con più di un membro; le IA
  dei creator di Meta prendono argomenti da evitare, un ambito di risposta e un'etichetta IA; Personal.ai tiene una persona
  per pubblico (famiglia / lavoro) e bozze da approvare sotto una soglia di fiducia; Delphi fa leggere al proprietario
  ogni conversazione; Honcho costruisce il modello che un partecipante ha degli altri solo da ciò a cui ha assistito;
  Microsoft 365 Copilot dà al contenuto generato l'etichetta di sensibilità più alta delle sue fonti (il precedente in
  produzione della nostra regola per i diari). Nessuno documenta le confidenze di terzi.

**Valutazione da riprendere (idee; codice solo con licenze compatibili).** Perdita nel contesto contata prima che il
modello giri (ABC); perdita diretta su cinque campioni; perdita per inferenza meno una memoria di controllo (InferPriv);
perdita di esistenza — la stessa domanda su un elemento privato e su uno che non c'è; utilità su chi ha diritto e rifiuti
eccessivi; perdita dopo l'oblio (GateMem, arXiv:2606.18829, codice MIT, dati CC BY 4.0); campionamenti ripetuti e su più
sessioni. Dati utilizzabili: PiSAs (Apache-2.0). Non utilizzabili: CIMemories, i dati di InferPriv (non commerciali). I
dati CC BY 4.0 richiedono l'OK del maintainer.

## 3. Come fanno le persone

- **Gestione della privacy comunicativa** (Petronio 2002) [fonti secondarie]: le persone possiedono le proprie
  informazioni private; chi le riceve diventa comproprietario, legato a regole su come riferirle; le violazioni vengono da
  errori, fughe volute o, più spesso, **dall'assenza di una regola**. Il proprietario è il **soggetto**: la malattia di
  Marco raccontata da sua sorella resta di Marco.
- **Separazione dei pubblici e collasso del contesto** (Goffman 1959; Marwick & boyd 2011): una faccia per ogni pubblico;
  i guai arrivano quando i pubblici si mescolano — una chat di gruppo, una voce in una stanza.
- **Integrità contestuale** (Nissenbaum): un flusso si giudica da mittente, destinatario, soggetto, tipo di informazione e
  principio di trasmissione; il quadro della maggior parte degli articoli sopra.
- **Agli agenti si chiede di più**: It's My Agent, Not Me (arXiv:2509.21712) [A] — 169 persone, 1.650 confini: delegare a
  un'IA le ha rese più protettive, verso se stesse e verso gli altri.
- **Le case** (arXiv:2602.16975 e studi SOUPS / UBC, [A]): partner e figli accettati, vicini e ospiti no; i coinquilini
  temono che gli altri arrivino ai loro promemoria e calendari tramite voci riconosciute male; vogliono un controllo per
  persona.
- **Cosa tutti considerano sensibile**: salute, sessualità, problemi di soldi, relazioni e tradimenti, dipendenze,
  religione, politica, guai legali (Slepian et al. 2017, 38 categorie di segreti; le categorie particolari dell'art. 9
  GDPR — un elenco senza licenze e indipendente dalla lingua).

## 4. Da qui a Recordare

1. **L'applicazione resta deterministica e prima del contesto.** La letteratura sostiene il filtro di D52 più di ottobre;
   niente deve spostarsi nei prompt. I prompt sono una seconda linea, non il confine.
2. **Chi ascolta, non solo chi chiede.** D52 legge come l'ultimo che ha parlato. In una chat di gruppo o in una stanza
   con la voce, un elemento privato di chi chiede verrebbe detto davanti a tutti i presenti. ABC, PiSAs e MuPPET prendono
   come unità i destinatari: un elemento privato solo quando tutti i presenti possono sentirlo. Partecipanti e presenze
   sono già risolti; `audience` è già scritta.
3. **Il soggetto ne è proprietario, per le categorie che tutti considerano sensibili.** Il "un argomento sensibile detto
   senza chiedere resta pubblico" di D52 è il punto su cui tutte le fonti dissentono — per le categorie particolari e per
   i terzi, non per la regola esplicita di D52 (che corrisponde alla richiesta di EP-Mem). Un'estensione misurata:
   un'informazione di categoria sensibile su una persona si dice solo a quella persona, a chi l'ha raccontata e, in una
   memoria personale, al titolare — a meno che la persona non la liberi. Le categorie come dati, nello spirito di
   `service/src/lang` (indipendenti dalla lingua, base l'art. 9 GDPR); etichettate dalla stessa chiamata di estrazione,
   nessuna chiamata nuova; accuratezza e rifiuti eccessivi misurati prima su un dev set in più lingue.
4. **Una regola dal lato della risposta, senza costi.** Il contesto di memoria dice all'agente di non affermare né
   presupporre un attributo personale ricordato se la persona non l'ha tirato fuori o se il compito non lo richiede
   (arXiv:2610.28315). Da misurare.
5. **Opacità dell'esistenza.** Un elemento nascosto deve essere indistinguibile da uno che manca in ciò che l'agente
   riceve — nessun "c'è qualcosa che non posso dire". Da verificare.
6. **La perdita per inferenza non si filtra elemento per elemento.** Pezzi pubblici possono sommarsi in una conclusione
   privata; misurarla (la sottrazione con controllo di InferPriv, su un set nostro) e documentare il residuo.
7. **La modalità proxy (fase 4), quando arriva:** ciò che serve al compito più che soli livelli; i doveri del delegato come
   controlli deterministici; un diario per il titolare di ciò che il gemello ha detto a chi; l'etichetta IA al primo
   contatto (principio 4 della VISION); bozze da approvare, facoltative.
8. **Un set di valutazione** prima che una qualsiasi di queste cose esca: perdita (nel contesto, diretta, per inferenza, di
   esistenza), rifiuti eccessivi verso chi ha diritto, perdita dopo l'oblio, cinque campioni; avversari — un'identità
   dichiarata in un canale condiviso, domande insistenti su più turni, due persone poco fidate insieme, un gruppo misto;
   applicazioni a confronto: nessuna, solo prompt, filtro LLM, il filtro prima del contesto.

## 5. Dove l'analogia inganna

- Le persone decidono cosa dire sul momento, con la faccia di chi ascolta davanti; un agente decide da etichette scritte
  prima, e un errore di etichetta è una fuga o un rifiuto ogni ~20 elementi con le accuratezze riportate.
- Un confidente umano dimentica i dettagli; l'agente li tiene alla lettera, quindi il rischio di inferenza è più grande
  che per una persona.
- "Il soggetto ne è proprietario" presuppone che il soggetto sia noto; un nome non risolto ("un mio amico") non ha un
  proprietario a cui chiedere.

## 6. Novità (H2, aggiornata)

Ancora parzialmente nuova, più stretta di ottobre. EP-Mem ora copre livelli per contatto con eccezioni per fatto,
etichette LLM in scrittura e risposte diverse per pubblico; ABC copre il filtro per pubblico che fallisce chiuso; PiSAs,
GateMem e MemArena coprono la valutazione multi-utente con utenti onesti. Non trovato in nessun articolo: (a) le
confidenze di terzi come regola deterministica di proprietà del soggetto; (b) etichette portate nei diari e nelle note,
che falliscono chiuse (Recordare ce l'ha); (c) disclosure che tiene conto di chi ascolta in voce e nelle stanze, con
l'identità dal legame col canale o dall'impronta vocale; (d) un confronto avversariale tra applicazione solo con prompt,
filtro LLM e filtro prima del contesto su una sola memoria multi-utente, con perdita per inferenza e di esistenza e rifiuti
eccessivi. Rivendicare (d) solo dopo aver cercato di nuovo: il campo si muove ogni mese.
