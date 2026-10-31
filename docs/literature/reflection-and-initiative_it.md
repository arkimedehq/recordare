# Riflessione, modello di sé, procedure e iniziativa — che cosa ha Recordare, che cosa fanno gli altri, come lo fa la mente umana

Ricerca per WORK_PLAN 8.12 / D53 (2026-11-01), tre rassegne: il repository, i sistemi e i prodotti di agenti, le scienze
cognitive. Inglese: [reflection-and-initiative.md](reflection-and-initiative.md). Le fonti segnate *(non verificato)* sono
state viste solo come abstract o tramite una fonte secondaria; i benchmark del 2026 sono tutti in questo stato. Tutto è parafrasato.

## 1. Che cosa ha già Recordare

- **Schemi ricorrenti** (`service/src/engine/patterns.service.ts`, `patterns.v2`, D26): il passaggio notturno scrive le abitudini
  viste in ≥ 3 episodi su 3 giorni come note `inferred` della memoria stessa, mai in sospeso; decide il codice (supporto, nessuna
  riformulazione, nessuna riesumazione di una nota ritirata senza nuovi episodi); solo episodi pubblici e vissuti in prima persona.
  Salvate con `origin = holder_lived` — sbagliato per qualcosa di dedotto (D53 lo porta a `reflected`).
- **Diari** con la voce dell'agente (`digest.day.v2` / `digest.month.v2`): una cronaca che non aggiunge nulla, non una riflessione.
- **Schede di sé e dei contatti** (`recall/cards.ts`, senza LLM): l'unico modello di sé oggi.
- **Chiarimenti** ("quale Marco?", `engine/clarifications.ts`): l'unica iniziativa, passiva — si chiede quando un turno
  tocca l'argomento.
- **Piani** con esito (`plan_status`; piani aperti nel passato `unresolved`): i cicli aperti che nessuno solleva spontaneamente.
- **Ganci senza comportamento**: sorgente di conversazione `perception`, metodi di attribuzione `face` / `voiceprint`.
- **Progettato, non costruito**: il pensiero a riposo H12 (`RESEARCH_NOTES.md`), le lacune di
  [human-memory-and-agent-architectures_it.md](human-memory-and-agent-architectures_it.md) §3.3 (note di procedura, riflessione
  vincolata alle prove, modello di sé, la memoria prospettica propria dell'agente, uno strato percettivo, periodi di vita),
  intenti permanenti ([agent-platform-memory_it.md](agent-platform-memory_it.md) idea 8), archivi di intenzioni tipizzati
  ([pis-typed-intention-stores_it.md](pis-typed-intention-stores_it.md)), livelli di iniziativa L1 / L2 e modalità di ricerca
  (`DIGITAL_TWIN_VISION.md`).

## 2. Che cosa fanno gli altri

**Riflessione**
- Generative Agents (Park et al., 2023, arXiv:2304.03442): quando l'importanza dei ricordi recenti supera una soglia,
  l'agente si pone alcune domande, recupera le prove e scrive intuizioni che le citano; le intuizioni sono ricordi,
  quindi cresce un albero. Difetto noto: l'abbellimento.
- Reflexion (Shinn et al., 2023, arXiv:2303.11366): una breve lezione verbale dopo un fallimento, conservata per il tentativo
  successivo; richiede un segnale di successo affidabile.
- Think-in-Memory (Liu et al., 2023, arXiv:2311.08719): conservare le conclusioni raggiunte, non i turni.
- Reflective Memory Management (Tan et al., ACL 2025, arXiv:2503.08026): riassunti a più granularità più un recupero tarato su ciò che il
  modello ha effettivamente citato; > 10 % su LongMemEval.
- A-MEM (Xu et al., 2025, arXiv:2502.12110): una nota nuova riscrive il contesto di quelle vecchie collegate — rischio di deriva.
- Letta sleep-time agents (Lin et al., 2025, arXiv:2504.13171): un agente in background riscrive i blocchi di memoria condivisi ogni
  pochi passi, anticipando le domande.
- Inner Thoughts (Liu et al., CHI 2025, arXiv:2501.00383): un flusso parallelo di pensieri, ciascuno valutato per capire se
  vale la pena dirlo ora — dove la riflessione diventa iniziativa.

**Modello di sé**
- L'autovalutazione degli LLM è tarata male: i modelli approvano i propri errori (MetaLoop, MIRROR, 2026 *(non verificato)*);
  l'introspezione è limitata (Anthropic, 2025). I prodotti tengono il sé come testo modificabile (blocco persona di Letta, `MEMORY.md`
  di Hermes). Lezione: costruirlo dagli esiti osservati.

**Procedure**
- Voyager (Wang et al., 2023, arXiv:2305.16291): abilità in codice conservate solo dopo che un critico ne conferma il successo.
- ExpeL (Zhao et al., AAAI 2024, arXiv:2308.10144): intuizioni da successi contro fallimenti, mantenute con ADD / EDIT / UPVOTE /
  DOWNVOTE, rimosse a zero — un modello per qualsiasi elenco che l'agente scrive su di sé.
- CLIN (Majumder et al., 2023, arXiv:2310.10134): astrazioni causali con confidenza attenuata.
- Agent Workflow Memory (Wang et al., 2024, arXiv:2409.07429), ReasoningBank (Google, ICLR 2026, arXiv:2509.25140):
  flussi di lavoro e lezioni riusabili da successi e fallimenti, giudicati da un LLM.
- LangMem: la memoria procedurale come riscrittura del prompt di sistema a partire da conversazioni con punteggio.

**Intenti e iniziativa**
- Proactive Agent / ProactiveBench (Lu et al., 2024, arXiv:2410.12361): prevedere se e che cosa proporre da un flusso di eventi;
  il miglior modello addestrato ≈ 66 % F1 — anche i modelli addestrati sbagliano spesso. I benchmark del 2026 (ProAgentBench,
  PARE-Bench, ChronosBench, ProEvent *(non verificato)*) valutano il momento separatamente dal contenuto.
- BDI con LLM (ChatBDI, AAMAS 2025; arXiv:2512.09458): le intenzioni persistono finché un indizio non fa scattare la riconsiderazione.
- Prodotti: ChatGPT Pulse (2025: ricerca notturna, schede del mattino che scadono, feedback) è stato assorbito nelle Scheduled Tasks
  configurate dall'utente nel 2026 *(data e motivi non verificati)*; il contesto personale di Gemini è stato giudicato invadente; heartbeat
  di OpenClaw: un turno periodico a partire da una lista di controllo — lista vuota, nessuna chiamata al modello; il "niente" viene scartato; ore attive.
  App di compagnia: i messaggi proattivi sono sembrati intrusivi (ComPeer, arXiv:2407.18064) e gli addii hanno ricevuto risposte
  manipolatorie (HBS working paper, 2025) — iniziativa per il coinvolgimento, non per la persona.

**Rischi osservati**: intuizioni confabulate; la memoria che aumenta la piaggeria (Jain et al., arXiv:2509.12517: i profili utente hanno aumentato
di più la piaggeria di assenso, fino a +45 %; PersistBench, arXiv:2602.01146 *(abstract)*); auto-narrazioni che si accumulano;
iniziativa intrusiva; tratti dedotti più sensibili dei fatti dichiarati; cicli in background che costano quando nulla è cambiato.

## 3. Come lo fa la mente umana

- **Metacognizione** (Nelson & Narens 1990; Koriat 1993; Fleming 2024, doi:10.1146/annurev-psych-022423-032425): un
  metalivello monitora (sensazione di sapere, confidenza) e controlla (cercare ancora, fermarsi, chiedere); la confidenza è una stima
  distinta dalla prestazione e va tarata; la sensazione di sapere dipende dagli indizi e può essere ingannata dalla familiarità.
- **Riflessione contro ruminazione** (Trapnell & Campbell 1999; Watkins 2008, doi:10.1037/0033-2909.134.2.163): il pensiero ripetitivo
  aiuta quando è concreto e centrato sul processo ("com'è successo, e adesso"), nuoce quando è astratto e valutativo
  su materiale irrisolto.
- **Consolidamento offline** (Diekelmann & Born 2010, doi:10.1038/nrn2762; Stickgold & Walker 2013, doi:10.1038/nn.3303):
  la riproduzione porta il nucleo essenziale nella conoscenza a lungo termine e lo integra con gli schemi; ricordi affini riprodotti insieme producono
  una struttura condivisa — e falsi ricordi (Lewis & Durrant 2011). Il consolidamento selettivo di ciò che conterà è più debole
  di quanto si sostenga; è l'etichettatura da svegli a decidere che cosa elabora il sonno.
- **Pensiero spontaneo** (Christoff et al. 2016, doi:10.1038/nrn.2016.113; Andrews-Hanna et al. 2014): il pensiero a riposo riguarda
  per lo più il futuro, il sé e gli altri; l'incubazione aiuta un poco, di più sui problemi aperti (Sio & Ormerod 2009).
- **Il sé** (Conway & Pleydell-Pearce 2000, doi:10.1037/0033-295X.107.2.261; Conway 2005): i ricordi sono costruiti da periodi
  di vita, eventi generali e conoscenza specifica dell'evento; un sé operativo (gli obiettivi correnti) guida il richiamo; la coerenza
  spinge verso la confabulazione, la corrispondenza va imposta. La conoscenza di sé come tratti è conservata sotto forma di riassunti separati dagli
  episodi (Klein *(dettagli non verificati)*); il sé come modello predittivo rivisto dagli errori (Seth 2013).
- **Procedure** (Fitts & Posner 1967; Anderson 1982; Soar chunking 1986): i passi dichiarativi usati ripetutamente si compilano in
  regole condizione → azione; le abitudini sono contesto → risposta, insensibili al valore dell'esito (Dickinson 1985; Daw et al.
  2005); gli errori commessi con sicurezza e poi corretti sono quelli appresi meglio (Metcalfe 2017).
- **Intenzioni** (McDaniel & Einstein 2000; Gollwitzer 1999, Gollwitzer & Sheeran 2006): i piani "se X, allora Y" cedono il
  controllo a un indizio; gli indizi di evento battono quelli temporali. L'effetto Zeigarnik non vale in generale, l'effetto Ovsiankina
  (riprendere i compiti interrotti) sì (Ghibellini & Meier 2025, doi:10.1057/s41599-025-05000-w); fare un piano placa
  un obiettivo incompiuto (Masicampo & Baumeister 2011). Gli obiettivi come cicli di retroazione: un obiettivo fermo è il segnale (Carver &
  Scheier 1982). Le intenzioni sono impegni riconsiderati solo davanti a un indizio (Bratman 1987).
- **Curiosità e motivazione** (Loewenstein 1994; Gottlieb & Oudeyer 2018, doi:10.1038/s41583-018-0078-0; Ryan & Deci
  2000): la curiosità nasce da un piccolo divario informativo, colmabile; le sollecitazioni imperative minano la motivazione.
- **Prendere la parola** (Horvitz 1999; Iqbal & Bailey 2007; Brown & Levinson 1987): interrompere solo quando il valore atteso supera il
  costo, in un punto di pausa; dare il motivo e un modo semplice per rifiutare; nel dubbio, rimandare.
- **Dimenticare come funzione** (Anderson & Schooler 1991; Richards & Frankland 2017; Anderson & Hulbert 2021): la disponibilità
  segue la probabilità di bisogno; in un agente, dimenticare significa priorità più bassa, la cancellazione resta un atto distinto.

## 4. Dal meccanismo a Recordare

| Meccanismo umano | Meccanismo di Recordare | Innesco | Risultato |
|---|---|---|---|
| Riflessione concreta, non ruminazione | Passaggio di pensiero con filtro di novità | Nuovi episodi pubblici di importanza sufficiente | Pensieri (intuizione / domanda / opinione) che citano gli episodi, oppure niente |
| Riproduzione sovrapposta → schemi | Schemi da gruppi di episodi (costruito) | Di notte, ≥ 3 episodi su 3 giorni | Abitudini come note `reflected` |
| Rivalutazione | Sostituzione con provenienza | Un episodio che contraddice | Una nuova versione; la vecchia nella cronologia |
| Intuizione / incubazione | Passaggio libero che collega problemi aperti e materiale nuovo (profilo full) | Inattività, problemi aperti, nuovo input | Pensieri provvisori, mai fatti |
| Sé operativo | Obiettivi e ruoli correnti che pesano sul richiamo | Un obiettivo formato o chiuso | Rilevanza |
| Conoscenza di sé semantica | Modello di sé dagli esiti | Correzioni, errori fatti notare | Note su di sé attenuate, con prove |
| Ipercorrezione | Dare peso alle correzioni di errori sicuri | Una correzione | Una regola forte, taratura |
| Compilazione della conoscenza | Procedure "quando X, lo faccio così" | Successo ripetuto, uno stallo risolto | Richiamate per situazione |
| Intenzioni di implementazione | Intenti come righe indizio → azione, confrontate all'ingest | Una persona / argomento / evento / momento corrispondente | Un candidato di iniziativa |
| Ovsiankina, sollievo da piano | Ciclo aperto proposto una volta, silenziato se pianificato | Un piano fermo, una scadenza passata | Una sola offerta di ripresa, poi ritirata |
| Divario informativo | Rilevatore di lacune (piano senza esito, fatti in conflitto) | Di notte | Una domanda in un punto di pausa |
| Iniziativa mista, cortesia | Filtro: valore × confidenza − costo di interruzione | Un candidato e un punto di pausa | Un messaggio inviato con il suo motivo, oppure rinvio |
| Dimenticanza razionale | Classifica per recenza × uso; le sostituite perdono priorità | Tempo, nessun uso | Ordine di richiamo |

## 5. Dove l'analogia inganna

Cicli di ruminazione (rieseguire la riflessione sullo stesso materiale trova sempre più significato); confabulazione guidata dalla coerenza
(ogni elemento dedotto richiede le sue prove e una probabilità a priori più bassa di ciò che è stato detto); falsi ricordi da schema (supporto
minimo, controesempi); l'identità narrativa è della persona, non spetta all'agente imporla; un passaggio offline non "sa" che cosa
conta — etichettare all'ingest; niente insistenza (Zeigarnik non vale); un'abitudine non è una preferenza; dimenticare è priorità, non
cancellazione; la familiarità non è conoscenza (tarare); all'agente manca l'intuito sociale su quando parlare — un'interruzione sbagliata
costa più di una mancata.

## 6. Che cosa prende Recordare (D53)

Pensieri con prove, confidenza, un contatore di supporto e un filtro di novità, profondi al massimo un livello, origine `reflected`;
un modello di sé dagli esiti; intenti come righe indizio → azione con riconsiderazione BDI; iniziativa valutata e **spinta** verso
il client, con feedback, ritiro, limiti di frequenza e ore di silenzio; procedure solo con un segnale di esito; passaggi costosi
dietro i profili di qualità; valutazione per supporto delle prove, precisione dell'iniziativa e falsi allarmi, e un controllo della piaggeria.
Evitati: riscrivere sul posto le note vecchie, alberi di riflessione illimitati, tratti di personalità conservati come fatti, opinioni che
rispecchiano la persona, spinte al coinvolgimento, affermazioni su di sé senza esiti, procedure senza un segnale di successo, cicli
a intervallo fisso che chiamano un modello quando nulla è cambiato.
