# Registro delle modifiche

Le modifiche rilevanti di Recordare. Formato: [Keep a Changelog](https://keepachangelog.com/it-IT/1.1.0/); le versioni
seguono il [Semantic Versioning](https://semver.org/lang/it/) (0.x: l'API può ancora cambiare tra versioni minori).
Riferimento inglese: [CHANGELOG.md](CHANGELOG.md).

## [Non rilasciato]

## [0.10.0] — 2026-11-06

**La memoria impara quando ogni persona accoglie ciò che dice.** Il tempo v1 (`INITIATIVE_TIMING=v1`) legge gli esiti che
un host riporta — detta, chiesta, fatta, oppure ignorata, rifiutata — per persona, parte del giorno e canale, e fa
aspettare un'iniziativa flessibile dove di solito viene lasciata cadere; `INITIATIVE_TIMING_SHADOW` registra prima cosa
deciderebbe accanto a v0. Corretti due difetti trovati dai nuovi casi di presenza per luogo: un promemoria chiesto per un
orario viene detto a quell'orario per quanto piena sia la giornata, e i messaggi vanno solo a un indirizzo vero. Solo il
servizio: la libreria client e i connettori restano alla 0.9.0.

### Aggiunto
- **Tempo v1: la memoria impara quando ogni persona accoglie ciò che dice** (D55 F4, `INITIATIVE_TIMING=v1`). Ogni esito
  riportato da un host (detta, chiesta, fatta — oppure ignorata, rifiutata) viene contato per persona, parte del giorno e
  canale; dove qualcuno ha lasciato cadere spesso (la voce della cucina la mattina), un'iniziativa flessibile aspetta un
  momento in cui la accoglie, e un canale chiaramente migliore per lei viene preferito. Con pochi esiti non cambia
  niente (la stima di v0 è il prior); un orario scelto dalla persona, le ore di quiete, l'identità e le regole delle
  stanze non vengono mai toccati. Misurato sulla serie di test sui tempi (una persona che ignora la voce del mattino:
  ignorate 6 → 3, gli altri casi invariati). `INITIATIVE_TIMING_SHADOW` registra cosa deciderebbe v1 accanto a v0, per
  confrontare prima di passare.

### Corretto
- **Un promemoria chiesto per un orario viene detto a quell'orario, per quanto piena sia la giornata.** Il limite
  giornaliero delle iniziative tratteneva una richiesta con orario: chiesta per le 18:00 dopo altre tre cose dette quel
  giorno, aspettava il giorno dopo. Un orario scelto dalla persona ora supera il limite, come già superava le ore di
  quiete.
- **Messaggi solo a un indirizzo vero.** Una persona riconosciuta dalla sua persona di Home Assistant, dall'impronta
  vocale o dal volto risultava raggiungibile per messaggio; queste identità ora servono solo a riconoscere qualcuno, e
  un'iniziativa va per messaggio solo a un indirizzo su un altro canale (una chat Telegram). Entrambi trovati dai nuovi
  casi di presenza per luogo della serie di test sui tempi (D55 §5c: 17 / 17 dopo le correzioni).

## [0.9.1] — 2026-11-06

### Cambiato
- **Chiedere chi è non fa nomi.** Con nessuno identificato e qualcosa in attesa per qualcuno, il contesto di memoria
  chiede all'agente di scoprire con chi sta parlando — non più "sei Chloé?", che diceva a chi era lì che c'era qualcosa
  per Chloé. Carta `charter.v3`. Un nome detto da chi parla ("sono Eriona") resta quello che è: non un'identità, perché
  chiunque può dirlo.

## [0.9.0] — 2026-11-06

**Iniziative dove si trova la persona: per messaggio, a voce, nella stanza.** Un'iniziativa porta ora i canali su cui
può andare, in ordine, e gli indirizzi della persona (la sua chat Telegram, la sua persona di Home Assistant),
collegati una volta dalla console; gli impulsi di presenza descrivono un luogo — chi è nella stanza, o solo qualcuno —
così un promemoria con orario può essere detto dal satellite della stanza in cui si trova la persona, con solo
un'apertura quando ci sono altri. La libreria client dà all'host il canale da usare e l'indirizzo della persona. Due
schede della stessa persona si uniscono dalla console. Host: un promemoria programmato dai tuoi strumenti copre
un'iniziativa solo per la stessa persona; uno fallito non copre niente.

### Aggiunto
- **Iniziative: il canale scelto alla consegna, la presenza per luogo, la voce** (D55 §5b–§5c). Un'iniziativa porta
  `channels` — quelli accettabili in ordine; la messaggistica solo per una richiesta o una promessa (interrompe) — e
  `for.addresses`, le identità verificate della persona (una persona di Home Assistant, una chat Telegram), collegate
  dalla console (la scheda di una memoria: collega un indirizzo a una delle sue persone) o dall'API admin. Gli impulsi
  di presenza descrivono un luogo (`people`, `someone`, il canale `home`); in una stanza un arrivo può dare qualunque
  cosa dovuta, un rinnovo solo una richiesta o promessa a orario; un annuncio spontaneo per persona ogni
  `INITIATIVE_VOICE_PACE_MINUTES` (30, in prova); le ore di quiete valgono anche per la voce; con altri nella stanza si
  dice solo un'apertura ("Chloé, ho una cosa per te: vuoi sentirla?", in ogni lingua) e l'iniziativa aspetta il suo
  "sì". L'orologio legge le presenze valide: una richiesta a orario la cui persona è in una stanza va a voce; in una
  memoria di entità, ciò che è per una persona va solo così o per messaggio a un suo indirizzo.
- **Libreria client: canali, indirizzi e apertura in `InitiativeInbox`.** I tipi portano `channels`, `for.addresses`,
  la presenza per luogo (`people`, `someone`, `home`) e `opening`. `deliver(user, initiative, {via})` può restituire
  `{outcome, channel}` — viene riportato il canale su cui ha raggiunto la persona; `addressesOn(initiative, 'telegram')`
  trova la persona lì. Con altri nella stanza l'apertura va al nuovo `open(user, initiative, opening)` e mai a
  `deliver`: l'iniziativa non viene presa e torna a una presenza successiva (un ospite senza `open` non dice nulla). Una
  presenza da una telecamera è riportata come voce. Gli ospiti esistenti funzionano senza modifiche.

- **Unire due schede della stessa persona** (console admin, la scheda di una memoria → Persone): "Eriona" ed "Eriona
  Rossi" diventano una — nomi, indirizzi, ciò che la memoria sa di lei e ciò che intende dirle passano alla scheda
  tenuta (`POST api/v1/admin/memories/:id/persons/:person/merge`). Ogni contatto mostra in quanti episodi è nominato, per
  scegliere. L'unione non perde più ciò che era stato dimenticato del contatto unito, né le sue fonti, promozioni,
  intenti, iniziative e presenze; una persona che ha una memoria non viene mai unita.

### Corretto
- **Un'iniziativa detta giorni dopo non dice più "ieri".** Una domanda su un piano viene formulata due giorni dopo e
  può essere detta per una settimana: "Ieri avevi la verifica di geometria" era falsa fin dall'inizio (visto su una
  memoria reale). La formulazione (`initiative.v4`) riceve ora i giorni in cui ogni iniziativa può essere detta e nomina
  un giorno relativo a oggi solo quando è detta soltanto oggi (un promemoria nel suo giorno dice ancora "oggi");
  altrimenti il giorno della settimana o la data. Il servizio lo controlla anche, in ogni lingua (Intl): un testo che
  può essere detto in un giorno successivo e ne nomina uno lascia il posto alla frase del servizio, che nomina il giorno.

## [0.8.0] — 2026-11-05

**Consegnare le iniziative in un pezzo solo, ogni impostazione dalla console.** La libreria client ottiene
`InitiativeInbox`: webhook, impulsi di presenza e feed insieme, ogni iniziativa passata all'ospite una volta e il suo
esito riportato — un ospite scrive solo come ne pronuncia una. La console di amministrazione imposta tutto ciò che hanno
una memoria e un client (lingua, fuso orario, ore di quiete, passate su richiesta, permessi dei token, cancellazione,
ambito del registro grezzo, canali, webhook), spiega ogni campo e passa allo stile di Atlas. Gli hook di Claude Code e
Codex chiedono le ricerche. Nessuna modifica incompatibile, nessuna migrazione: aggiornare il servizio, poi la libreria
client (`InitiativeInbox`) e i connettori.

### Aggiunto
- **Gli hook di Claude Code / Codex chiedono le ricerche** (`initiatives: {lookups: true}` nel contesto di memoria,
  D55): questi agenti hanno degli strumenti, quindi una ricerca che la memoria vuole fare può essere loro affidata nel
  turno.
- **La console di amministrazione spiega ogni campo** (italiano e inglese): cosa fa e quando cambiarlo, sotto ogni
  impostazione; una legenda dei permessi di chiavi e token e degli eventi dei webhook; una breve introduzione a persone e
  client.
- **La console di amministrazione nello stile di Atlas**: pannelli scuri con angoli, titoli in maiuscoletto, dati in
  monospazio; ogni scheda si chiude sul nome, le etichette e i contatori ("Apri tutte" / "Chiudi tutte"; una scheda
  sola si apre da sé); ogni spiegazione si nasconde dietro un piccolo "?", tutte mostrate o nascoste insieme
  dall'intestazione (ricordato nel browser). Nessun font esterno (la CSP della pagina resta sulla stessa origine).
- **`InitiativeInbox`** nella libreria client: ciò che ogni ospite fa per consegnare le iniziative, una volta sola —
  webhook verificati (un `webhook-id` ripetuto ignorato), impulsi di presenza, il feed recuperato da un cursore, ogni
  iniziativa passata una volta al `deliver` dell'ospite, l'esito che restituisce riportato; archivi durevoli `seen` /
  `cursors` facoltativi.
- **Ogni impostazione dalla console di amministrazione** (`/admin`): per memoria anche lingua, fuso orario e ore di
  quiete, le passate notturne su richiesta (revisione dei fatti, abitudini, pensieri, iniziative), i permessi di un token
  personale e la cancellazione dell'intera memoria (scrivendone il nome); per client l'ambito del registro grezzo, i canali
  (D55: chat / messaggistica / voce, sempre o con presenza), i webhook (registrazione con i loro eventi — il segreto
  `whsec_` mostrato una volta —, elenco, rimozione) e il permesso `erase` per le chiavi. `PATCH
  api/v1/admin/clients/{id}` accetta `rawLogScope`; `GET api/v1/admin/clients` elenca i webhook di ogni client (mai il
  loro segreto).

### Corretto
- **Build dell'immagine del proxy**: il bundle viene costruito una volta sulla piattaforma del runner e copiato nelle
  immagini amd64 e arm64 (la build arm64 sotto QEMU andava in crash in `npm ci` e ha bloccato il job della v0.7.0 fino al
  limite di 6 ore; l'immagine 0.7.0 è stata pubblicata a mano il 2026-11-05); il job si ferma dopo 30 minuti.

## [0.7.0] — 2026-11-04

**Iniziative decise dalla memoria** (D55): Recordare decide chi riceve un'iniziativa, quando e su quale canale; l'agente
le dà i sensi — impulsi di presenza (chi vede o sente, con che sicurezza) — e dichiara i suoi canali. Ogni client di
livello completo consegna le iniziative nel turno senza codice (il contesto di memoria porta quella dovuta per chi sta
parlando); a un impulso di presenza risponde con ciò che va detto adesso; l'orologio spinge i promemoria a orario al loro
minuto e quelli flessibili a un'ora adatta (`initiative.deliver`), ogni decisione registrata; una memoria di entità dà
l'iniziativa di una persona solo a quella persona, riconosciuta con sufficiente sicurezza. Fonti nuove: le cose lasciate
a metà ("hai steso i panni?") e le domande indirizzate a chi potrebbe sapere. E gli embedding interattivi non aspettano mai
quelli in background (il contesto di memoria entro un budget). Nessuna modifica incompatibile nell'API (campi additivi,
un nuovo stato `offered`, un nuovo evento `initiative.deliver`); cambi di comportamento: le iniziative arrivano all'agente
nel turno, le richieste a orario valgono anche nelle ore di quiete. Aggiornare prima il servizio (le migrazioni
`InitiativeDelivery`, `InitiativeTiming`, `IntentFollowup` girano all'avvio), poi la libreria client (`presence()`, i
nuovi tipi) e i connettori. Qualità (DeepSeek `deepseek-flash`, `spikes/memory-eval/RESULTS.md`): blind12 95,7 % di media
con `extract.v23`; dev set — cose lasciate a metà 7–8 / 8, iniziative 11 / 14 con `initiative.v3`, tempo 9 / 9 (messo a
punto su di esso), domande indirizzate senza nessuna falsa.

### Aggiunto
- **Iniziative decise da Recordare: a chi, quando, dove** (D55, `docs/INITIATIVES_DELIVERY_it.md` F1). A un impulso di
  presenza (`POST api/v1/presence`, libreria `presence()`) — l'agente dice chi vede o sente, con cosa, con che sicurezza —
  Recordare risponde subito con l'unica iniziativa da consegnare adesso, oppure, in una memoria di entità senza nessuno
  identificato, a chi chiedere "sei tu?" (senza rivelare nulla). Il contesto di memoria porta l'iniziativa dovuta per chi
  sta parlando (il canale nel turno: ogni client di livello completo consegna le iniziative senza codice; le ricerche solo
  con `initiatives: {lookups: true}`). Un'iniziativa per una persona raggiunge solo quella persona, riconosciuta con
  sicurezza ≥ 0,6, o ≥ 0,85 quando nasce da un messaggio privato; in una memoria di entità una per nessuno in particolare
  raggiunge chiunque sia identificato, o chi parla nella conversazione da cui è nata. Nuovo stato `offered`, chiuso da ciò
  che vede l'estrazione della conversazione (said, asked, done, declined) o che decade come expired / ignored. Le
  iniziative ricevono `timing` (timed / flexible), `window`, `channel`, `identity`, `source` (gli id del client dei
  messaggi da cui sono nate), `offeredAt`; gli esiti accettano `channel` e `reaction` e conservano il ritardo; i client
  dichiarano i loro `channels`; i webhook accettano `events`. Carta della memoria `charter.v2` (come usare una riga di
  iniziativa). Migrazione `InitiativeDelivery`. Additivo, nessuna modifica incompatibile; serve una release della libreria
  client per `presence()` e i nuovi tipi.
- **Tempo v0: l'orologio sceglie il momento** (D55 F2a). Le iniziative in attesa con un canale che raggiunge sempre la
  persona vengono spinte quando è il momento: una a orario al suo minuto (la memoria viene passata a quel minuto), una
  flessibile quando un filtro sensibile ai costi lo permette (il worth × l'adattamento dell'ora ÷ ciò che la persona ha
  già ricevuto oggi, contro la soglia del tipo), una dovuta alla sua ultima occasione; mai nelle ore di quiete. Quelle
  spinte escono come nuovo evento webhook `initiative.deliver` (`pushedAt`); ogni decisione — orologio, presenza, turno —
  è registrata con la sua probabilità (`initiative_decisions`, migrazione `InitiativeTiming`).
- **Regole di tempo da `dataset_dev_timing`** (D55 F2b, un set deterministico di linee temporali, `timing_eval.py`):
  un'ora scelta dalla persona vale anche nelle ore di quiete; l'ultima occasione viene prima di esse; le iniziative dovute
  vengono prima in un turno o in una presenza; una memoria di entità non spinge mai l'iniziativa di una persona su un
  canale condiviso; il contesto di memoria mantiene la scheda di sé e un'iniziativa quando il server di embedding è giù.
  `INITIATIVE_TIMING=due` è il confronto di base delle valutazioni. v0 9 / 9, due 8 / 9 sul set su cui è stato messo a
  punto (RESULTS.md).
- **Le ore del modello** (`initiative.v3`, balanced e full): ogni iniziativa formulata porta le ore locali in cui dirla
  sarebbe naturale (l'ordine della farina prima che il mulino chiuda a mezzogiorno, i bidoni la sera); l'orologio le usa al
  posto delle ore predefinite del tipo. `dataset_dev_initiatives`: 11 / 14 come v2 sulla stessa estrazione (RESULTS.md).
- **Cose lasciate a metà** (`extract.v23` / `entity.v11`, migrazione `IntentFollowup`): qualcosa che una persona ha
  iniziato e deve finire più tardi (i panni da stendere, un arrosto in forno, un modulo prima della scadenza) diventa,
  quando ha senso, la domanda dell'agente per quella persona — chiusa quando dice che è fatto; non ciò che finisce da sé,
  che è finito nella conversazione, banale, un'abitudine o compito d'altri. `dataset_dev_followups` 7–8 / 8; blind12
  95,4 / 94,4 / 97,2 % (la v23 più breve sopra la media 94,1 % della v22, h11 di nuovo giusta; RESULTS.md). La passata delle iniziative ora visita anche le
  memorie che hanno solo iniziative in attesa, così si chiudono.
- **Domande a chi potrebbe sapere** (D55 F2b passo 4, `docs/INITIATIVES_DELIVERY_it.md` §6): una domanda che la memoria
  tiene su una persona viene fatta a quella persona quando parla con l'agente, altrimenti a chi gliene ha parlato di più
  (il titolare, o un contatto identificato in una memoria di entità; nessuno identificato: non si chiede), una alla volta
  per persona, con un riconoscimento sicuro quando riguarda qualcun altro; le domande sul mondo restano ricerche per gli
  strumenti dell'agente. Una domanda su un piano è lasciata alla domanda del giorno dopo solo finché il piano è aperto.
  `dataset_dev_asking`: 0 false, 0 trappole in quattro corse (RESULTS.md).

### Corretto
- **Il contesto di memoria non aspetta più gli embedding in background.** Su un ospite che condivide un server di
  embedding su CPU (una richiesta alla volta, come quello di Arkimede), il turno appena salvato — output di strumenti di
  4–8 000 caratteri — veniva embeddato in un unico lotto proprio quando arrivava la domanda successiva, e la query del
  contesto aspettava dietro: misurato sul Kinox (i3-1215U, bge-m3 su CPU), 4 970 ms invece di 110–150 ms, oltre il
  timeout di 2,5 s dell'ospite. Gli embedding ora hanno una priorità: quelli interattivi (contesto di memoria, strumenti
  di richiamo, `remember`) partono subito; quelli in background vanno una richiesta alla volta, in richieste di al
  massimo `EMBEDDING_BACKGROUND_BATCH_CHARS` caratteri (default 2000), e partono dopo una pausa della conversazione
  (`EMBEDDING_QUIET_MS`, default 10 s; al massimo 60 s di attesa). Stesso caso dopo: 137 ms. Le query ripetute vengono da
  una piccola cache, e gli strumenti di richiamo di un turno condividono una sola richiesta per la stessa query. Il
  contesto di memoria aspetta i suoi vettori al massimo `CONTEXT_EMBEDDING_BUDGET_MS` (default 1,5 s), poi serve la sola
  scheda di sé invece di far aspettare l'ospite. `recall.served` (Atlas) riporta `embedMs`, e `late` quando il budget è
  stato mancato. Nessun cambio all'API. Cambia un comportamento: durante una conversazione un messaggio nuovo diventa
  cercabile per vettore fino a un minuto dopo (il full-text lo trova nel frattempo); con una GPU o un provider di
  embedding ospitato, alzare `EMBEDDING_BACKGROUND_BATCH_CHARS` e impostare `EMBEDDING_QUIET_MS=0` (`docs/KNOBS.md`).

## [0.6.0] — 2026-11-03

**La mente dell'agente** (D53, D54): la memoria ora pensa da sé — intuizioni, domande e opinioni tratte da ciò che
l'agente ha vissuto, ciò che ha imparato di sé dalle sue risposte, e come svolge i compiti ricorrenti — e **spinge**:
iniziative (una richiesta o una promessa con una data, il "com'è andata?" dopo un appuntamento, una ricerca per gli
strumenti propri dell'ospite) consegnate con Standard Webhooks o lette come feed; un promemoria solo se chiesto. E la
memoria è la mente dell'agente, non uno strumento tra tanti: una carta della memoria per il prompt di sistema (completa,
o per il solo contesto per gli ospiti senza strumenti di memoria), il contesto di memoria formulato come ciò che è venuto
in mente e aperto di default dalla scheda di sé, ogni connettore che segue il contratto memory-first (`INTEGRATION.md`
§4). Nessuna modifica incompatibile nell'API; cambia un comportamento: la scheda di sé è accesa di default (`card: false`
la spegne). Aggiornare prima il servizio (le migrazioni `Thoughts`, `SelfNotes`, `Initiatives`, `IntentMessages`,
`InitiativeWorth`, `Procedures` girano all'avvio), poi la libreria client (`charter()`, `initiatives()`,
`reportInitiative()`, `verifyWebhook()`) e i connettori. Qualità (DeepSeek `deepseek-flash`,
`spikes/memory-eval/RESULTS.md`): blind12 97,2 % con `extract.v21`; dev set — pensieri 11,8 / 14, modello di sé 13 / 15,
procedure 10–11 / 14, iniziative 11 / 14 senza iniziative false.

### Aggiunto
- **I pensieri dell'agente** (D53, WORK_PLAN 8.12a — il primo passo della mente dell'agente): una passata notturna di
  pensiero trae intuizioni, domande e opinioni da ciò che l'agente ha vissuto (solo episodi pubblici), ognuna poggiata
  sugli episodi che cita; parte solo quando gli episodi nuovi hanno raccolto abbastanza importanza, non pensa mai senza
  prove nuove (una domanda su qualcosa che si attende fa eccezione), sostiene, indebolisce, rivede e ritira i suoi
  pensieri man mano che arrivano nuovi episodi. Sono note con `thought: true` (categorie `insight` / `question` /
  `opinion`), raccontate come pensieri propri dell'agente negli strumenti di recall, nel contesto di memoria e nel
  Diario (`GET api/v1/notes`), mai come qualcosa che è stato detto; un'opinione può differire da ciò che dice il
  titolare. Nulla da confermare (D26): un client può dimenticarne uno (`DELETE api/v1/notes/{id}`). Ciò che la memoria
  conclude da sola ha ora una propria origine, `reflected` — i pattern ricorrenti passano a questa (erano salvati come
  vissuti dal titolare). Opzione del profilo di qualità `thoughts` (attiva in balanced e full), override `THOUGHTS`,
  task LLM `thoughts`; l'admin `POST api/v1/admin/memories/{id}/thoughts` esegue la sola passata. Migrazione `Thoughts`.
- **Il modello di sé dell'agente** (D53, WORK_PLAN 8.12b): la passata dei pensieri impara anche sull'agente stesso dalle
  sue risposte e da come la persona ha reagito — un errore da evitare ("sbaglio sempre i suoi turni: prima controllare il
  piano turni"), ciò che funziona con una persona (risposte brevi, elenchi, nessun consiglio non richiesto), una promessa
  e che fine ha fatto, la fiducia dimostrata — mai dall'introspezione: note di categoria `self` (`thought: true`),
  sostenute da quei messaggi, lo stesso esito in due giorni; raccontate nel recall e nel contesto di memoria come ciò che
  ha imparato di sé, e nella scheda di sé come "su di me come agente" (`GET api/v1/cards`). Migrazione `SelfNotes`.
- **Iniziative — la memoria spinge** (D53, WORK_PLAN 8.12c, prima versione): ciò che l'agente decide di dire, chiedere o
  cercare da sé, da ciò che tiene — un piano aperto oltre la sua data (un `ask` due giorni dopo), una promessa o una
  richiesta con una data (un `say` quel giorno), una domanda che tiene (un `lookup` per gli strumenti propri dell'agente ospite) — scattano
  quando sono dovute, dopo le ore di quiete della memoria (`quietFrom` / `quietTo`) ed entro un limite giornaliero per
  persona (`INITIATIVE_DAILY_LIMIT`), proposte una volta e al massimo un'altra una settimana dopo, decadendo in silenzio
  quando nessuno c'è in tempo. Consegnate con **Standard Webhooks** (admin `POST api/v1/admin/clients/{id}/webhooks`, un
  segreto `whsec_` mostrato una sola volta, intestazioni firmate, nuovi tentativi, `410` disabilita, https pubblico a
  meno di `WEBHOOK_ALLOW_PRIVATE`) e leggibili come feed (`GET api/v1/initiatives`); il client riporta che fine ha fatto
  ciascuna (`POST api/v1/initiatives/{id}/outcome`) e l'intento dell'agente ne segue l'esito. Libreria `initiatives`,
  `reportInitiative`, `verifyWebhook`. L'ospite consegna quando la persona è presente e svolge le ricerche. Migrazioni
  `Initiatives`, `IntentMessages`, `InitiativeWorth`. L'estrazione (`extract.v21` / `entity.v9`, INTENTS) trasforma una
  promessa dell'agente o una richiesta fattagli con una data in un intento (ritirata o fatta in conversazione, si chiude);
  in balanced e full il modello formula ogni iniziativa e le dà un `worth` (`initiative.v2`, knob `initiativeWording`).
  Una domanda attende due giorni dopo il piano e non si fa se hanno raccontato com'è andata, né per un piano che nessuno
  ha detto prima del suo giorno (una decisione non è un appuntamento — la prima iniziativa dal vivo); una richiesta con
  un orario lo conserva. Recordare fa il suo lavoro qualunque cosa abbiano fatto gli strumenti dell'ospite: un promemoria
  che anche l'ospite ha programmato tocca all'ospite deduplicarlo. **Un promemoria solo se chiesto**: un piano o un
  evento solo raccontato viene ricordato, non promemorato (nessun promemoria il giorno prima); un evento detto prima del
  suo giorno è un appuntamento, chiesto dopo se non se ne è raccontato l'esito. Misurato: dev_initiatives 11/14 in 3 run, 0 false, nessun promemoria non richiesto.
- **Le procedure dell'agente** (D53, WORK_PLAN 8.12d): come svolge un compito ricorrente per una persona o un luogo,
  imparato da un esito sulle sue stesse risposte — insegnato, corretto, approvato esplicitamente — come "quando
  <situazione>, <come lo faccio>" (note di categoria `procedure`, `thoughts.v7`); una correzione chiara basta; riviste
  quando il modo cambia; riferite nel contesto di memoria come "come lo faccio (imparato)". Migrazione `Procedures`.
- L'admin legge gli elementi di una memoria (D52): `GET api/v1/admin/memories/{id}/episodes` (`source=own|claims`),
  `…/facts`, `…/notes` — le liste del diario lette come l'intera memoria, gli elementi privati segnati con di chi sono — e
  ne dimentica uno (`DELETE …/episodes|facts|notes/{id}`). Solo chiave admin; Recordare Atlas li elenca e li dimentica con
  queste rotte.

### Modificato
- **La memoria è la mente dell'agente — un contratto memory-first per ogni client** (D54, WORK_PLAN 8.14): la carta
  della memoria, come un agente usa la sua memoria (la sua mente, da cui ragiona prima di rispondere, in cui cerca prima
  degli altri strumenti e prima di "non lo so"; "ricordi / ricordare" vogliono dire questa memoria, non file o foto),
  servita da `GET api/v1/charter` (`{charter, version}`, per il prompt di sistema dell'agente), come `instructions` del
  server MCP, e citata dal blocco `<memory-context>`; `?tools=false` dà la forma per un ospite con il solo contesto, senza strumenti
  di memoria (mai "cerca", piuttosto "non me lo ricordo"; il default del proxy, `MEMORY_TOOLS=true` per quella completa).
  Il blocco è ora formulato come ciò che è venuto in mente all'agente dalla sua
  memoria (non più "usalo solo se aiuta"). La scheda di sé apre il blocco **di default** (`card: false` la spegne; circa
  130–150 token). Un seguito breve ("e lui?", ogni lingua, `CONTEXT_SHORT_QUERY_WORDS`) viene confrontato anche con il
  turno precedente della persona. Il contratto, richiesto a ogni client (`INTEGRATION.md` §4): la carta nel prompt di
  sistema, il contesto prima di ogni turno di ogni agente, gli strumenti di memoria disponibili, un ripiego, spenta solo
  esplicitamente. Libreria `charter()`; ogni connettore lo segue.

### Corretto
- La passata notturna dei pattern cancellava i pensieri dell'agente scritti la notte prima come "pattern deboli" (meno
  di tre episodi): la sua sincronizzazione ora guarda solo i pattern.
- In una memoria entity, chi parlava attraverso un account condiviso dell'agente (la piattaforma manda il nome
  dell'account come quello del partecipante titolare) veniva preso per l'agente, che poi citava sé stesso; ora chi parla
  così è qualcuno.
- Un esito raccontato dopo l'ora del giro non nasconde più una domanda (rieseguire una valutazione su una memoria che
  contiene già messaggi successivi la nascondeva).

## [0.5.0] — 2026-10-27

**Memorie private**: una persona può tenere ciò che ha detto tra sé e l'agente — con un flag del client (un messaggio
o un'intera chat) o con parole sue ("resti tra noi") — e ogni lettura lo rispetta: una memoria privata è detta solo a
chi appartiene e, in una memoria personale, al titolare; l'admin legge tutto (D52). Nessuna modifica incompatibile:
l'API cresce soltanto; aggiornare prima il servizio (la migrazione `PrivateMessages` gira all'avvio), poi la libreria
client e i connettori. Qualità (DeepSeek `deepseek-flash`, `spikes/memory-eval/RESULTS.md`): i set ciechi entro il
rumore di una run (blind12 95,4 %, blind5 90,7 %, entity blind11 95,0 %), nessun messaggio reso privato per errore.

### Aggiunto
- Messaggi privati (D52, primo passo): `private` su un messaggio o su un'intera richiesta (`conversation.private`); la
  risposta dell'agente e i turni degli strumenti che seguono lo diventano, per la stessa persona; `PATCH …/messages/{id}
  {private}` (libreria `setMessagePrivate`) lo rende privato o di nuovo pubblico. Ogni lettura lo rispetta (`API.md`
  §1): raccontato solo a chi appartiene — chi parla nell'ultimo turno della conversazione — e al titolare di una memoria
  personale; in una memoria entity l'account legge solo il pubblico. Episodi, fatti e note seguono i loro messaggi
  (nascosti quando anche un solo messaggio dietro di loro è privato di qualcun altro); una correzione mantiene la privacy di
  ciò che corregge. L'API di lettura segna gli elementi privati (`private: {by}`) e `GET api/v1/private` (libreria
  `privateItems`) li elenca senza contenuto per il Diario di una memoria entity; il diario e gli schemi ricorrenti si
  scrivono solo dai ricordi pubblici. Una persona che chiede a parole che ciò che ha detto resti tra noi rende privati i
  suoi messaggi, e liberandolo li rende di nuovo pubblici (`extract.v20`, `entity.v8`: sezione PRIVATE).

### Corretto
- Modificare, cancellare o chiudere una conversazione per un utente senza memoria non ne crea più una vuota
  (`autoProvision`): risponde 404 come per una conversazione sconosciuta, così una cancellazione tardiva non riporta in
  vita una memoria cancellata.
- `search_episodes` in modalità `list` senza `query` non restituiva alcun episodio: ora elenca gli episodi del periodo
  (o tutti), prima i più importanti.

## [0.4.0] — 2026-10-26

**I piani separati dai fatti, le mie risposte, le schede e la cancellazione**: un piano o un desiderio non diventa più un
fatto o un evento compiuto, il richiamo ritrova ciò che l'agente stesso ha risposto prima, le frasi del servizio seguono
la lingua della memoria, il contratto REST è pubblicato come OpenAPI, e due nuovi controlli — una scheda di chi sono e
di ogni contatto, e la cancellazione di un'intera memoria (nuovo scope `erase`). Nessuna modifica incompatibile: l'API
cresce soltanto; aggiorna prima il servizio (le migrazioni partono all'avvio), poi la libreria client e i connettori.
Qualità (DeepSeek `deepseek-flash`, `spikes/memory-eval/RESULTS.md`): LongMemEval-S, un campione di 100 domande,
83,5 % (76,0 % prima di D30 e di `extract.v19`; tutta la cronologia nel prompt 84,5 %), ciò che ha detto l'assistente
0,82 (0,14); i set ciechi entro il rumore di una run.

### Aggiunto
- **Schede** (WORK_PLAN 8.13): `GET api/v1/cards` — chi sono e una scheda per ogni contatto, dai fatti e dalle note
  attuali (con i loro id, gli alias, l'ultima menzione), senza LLM; libreria `cards(user)`. Il contesto di memoria può
  aprirsi con la scheda di sé (`POST api/v1/context {card: true}`, libreria `context(…, { card: true })`), spento di
  default.
- **Cancellare un'intera memoria** (WORK_PLAN 8.13): `DELETE api/v1/admin/memories/:id` e `DELETE api/v1/me` (nuovo
  scope `erase`, per una chiave client o un token personale, dato solo se richiesto), entrambe con `?confirm=` l'id della
  memoria; libreria `eraseMemory(user, memoryId)`. Tutto ciò che la memoria contiene se ne va in una sola transazione,
  senza tombstone; il registro delle chiamate LLM tiene le sue righe senza la memoria. I ricordi di qualcun altro si
  dimenticano uno alla volta, mai in blocco.
- **OpenAPI** (API.md): `GET api/v1/openapi.json`, senza autenticazione — il contratto REST come OpenAPI 3.1, generato
  dalle rotte: percorsi, scope (`x-recordare-scopes`), parametri di percorso e di query e corpi delle richieste dagli
  schemi zod che li validano, le risposte JSON dagli schemi di risposta delle rotte (`@Returns`; quelle dell'admin e di
  Atlas sono oggetti liberi, non un contratto stabile), codici di stato ed errori RFC 9457. I test controllano ogni
  risposta che vedono contro il suo schema, e il compilatore vi controlla i gestori delle rotte e i tipi della libreria
  client.

### Modificato
- **Tutte le lingue nelle frasi del servizio** (WORK_PLAN 2.6): le note degli strumenti di richiamo per l'agente, le date
  ignote e approssimate, i nomi dei giorni e la domanda "stessa persona?" seguono la lingua della memoria nelle 25 lingue
  più usate (erano in italiano o in inglese); il `locale` di una memoria è qualsiasi tag BCP 47 anche nell'API admin
  (prima `it` / `en`).
- **Una cosa raccontata come fatta oggi che poi non è avvenuta** (H1, `extract.v17`, memorie personali): "oggi
  pomeriggio vernicio la ringhiera" viene salvato come fatto quel giorno, come prima; quando un messaggio successivo
  mostra che non è avvenuto ("sabato vernicio finalmente la ringhiera, il barattolo è ancora lì"), ora l'episodio viene
  corretto invece di restare vero. Le memorie entity mantengono il loro prompt.
- **Ciò che ho detto prima si ritrova** (D30): il richiamo cerca anche le mie risposte precedenti (`fromChats` con
  `authorRole: "assistant"`), così "che birra mi avevi consigliato per quella ricetta?" trova la risposta, che non sta in
  nessun episodio; una risposta della conversazione servita, o una breve (chiacchiere, una conferma), non viene restituita. Un messaggio lungo mostra il passaggio
  più vicino alla domanda invece dei primi 400 caratteri. Ogni messaggio ora ha un embedding, e lo sweep orario mette in
  coda quelli mancanti (le risposte salvate prima; migrazione `UnembeddedMessages`).
- **Un piano non è come stanno le cose** (`extract.v19`, `entity.v7`): "il mese prossimo mi trasferisco a Bologna"
  salvava il nuovo indirizzo come quello attuale (con il piano dentro il valore), e "da aprile mi iscrivo al corso di
  ceramica" diventava una nota "frequento il corso di ceramica"; ora un piano, un'intenzione o un desiderio non cambia
  nessun fatto e non crea note finché un messaggio successivo non dice che è avvenuto, e il valore di un fatto è solo lo
  stato. Il passaggio separato dei fatti (`factsPass: separate`) aveva già questa regola.
- **Cose tenute e modificate nel tempo, e richieste che dicono un fatto** (`extract.v18`, `entity.v6`): "aggiungi il
  latte alla lista", "sposta la riunione a venerdì", "segna che ho pagato l'affitto" erano prese per richieste di aiuto e
  spesso non ricordate; ora si ricorda ciò che dicono. Una lista della spesa, gli invitati di una festa, le cose da
  portare in viaggio sono una nota con tutto il contenuto attuale, sostituita a ogni modifica (il contenuto precedente
  resta nella sua storia), più un piccolo evento per ogni modifica con data e motivo; prima venivano salvate come piani.
  Gestire la lista resta compito dell'agente: Recordare la ricorda soltanto.
- **Un elenco senza periodo** (`search_episodes` in modalità `list`, senza `from` / `to`) sceglie per argomento, come una
  ricerca, e riempie i posti liberi per somiglianza; prima teneva gli elementi più importanti fra quelli pertinenti e non
  aggiungeva altro, così "quante corse ti ho raccontato?" non riceveva nessuna corsa. Gli elenchi con periodo non
  cambiano.

### Corretto
- Un messaggio lungo (un diario di viaggio di 21 k caratteri incollato in chat) faceva fallire la sua estrazione: gli
  episodi non stavano nell'output fisso di 6000 token e venivano tagliati. Il budget di output ora cresce con il testo
  della finestra, fino a 32000.
- Una memoria con lingua regionale (`it-IT`, come accetta `PATCH settings`) riceveva quelle frasi e i nomi dei giorni in
  inglese.
- Un fatto non più noto faceva fallire l'intera finestra di estrazione quando veniva ridetto non noto, riceveva un nuovo
  valore o veniva corretto (il database non ammetteva valori vuoti nella storia di un fatto); un "non noto" ripetuto ora
  non cambia nulla, e gli altri due casi scrivono la storia come devono (migrazione `UnknownFactHistory`).
- `provider_eval.py` (valutazione): run con tag diversi sullo stesso set non si sovrascrivono più il riepilogo.

### Rimosso
- **`packages/client/scripts/sync-to.sh`**: Arkimede installa `@arkimedehq/recordare-client` da npm invece di una
  copia sincronizzata dei sorgenti.

## [0.3.0] — 2026-10-17

**Qualità e controllo** della memoria: il richiamo ordina per pertinenza, abitudini ricorrenti, ascolto continuo nella
stanza, dimenticare un periodo, il resto dell'API di lettura (inserimenti manuali, correzioni, il feed delle modifiche
alle note, impostazioni, consumi, esportazioni), le identità di canale del titolare con un codice monouso. Nessuna
modifica incompatibile: l'API cresce soltanto; aggiornare prima il servizio (le migrazioni girano all'avvio), poi la
libreria client e i connettori. Qualità (DeepSeek `deepseek-flash`, `spikes/memory-eval/RESULTS.md`, 3 run ciascuno):
insieme cieco personale 97,2 % (90,9 % nella 0.2.0), insiemi ciechi di entità 96,7 % e 98,8 % (91,4 % nella 0.2.0); il
tasso più basso di affermazioni non giustificate tra i sistemi confrontati su blind3 (WORK_PLAN 4.5c).

### Aggiunto
- **Ascolto continuo** (WORK_PLAN 6.5, D45): sorgente di conversazione `ambient` per il parlato che un dispositivo di
  casa sente nella stanza. All'estrazione viene detto che legge parlato sentito per caso (`extract.v16`, solo in quelle
  finestre); gli episodi si scrivono come sempre, ogni fatto e nota sentiti lì restano in attesa finché la loro persona
  non li ridice in una chat o a voce all'assistente (o li conferma nel diario); il richiamo segna episodi ed estratti di
  chat sentiti lì (`heard: true`; "heard in the room" nel contesto di memoria) e la descrizione di `search_episodes` dice
  all'agente che cosa significa; un codice di collegamento sentito lì non è mai una richiesta. Dev set
  `dataset_dev_ambient`: 86,7 %, nessuna frase attribuita male salvata come fatto dichiarato. **Trascrizioni di stanza**:
  `POST api/v1/ingest/room` (client `ingestRoom`) invia una trascrizione alle memorie delle persone presenti — ognuna
  riceve le proprie parole come turni `user` e gli altri parlanti come contatti.
- **Budget di costo in CI** (WORK_PLAN 4.4c): `service/test/cost/` misura, per profilo di qualità, le chiamate LLM e i
  token di input di una giornata di riferimento di una persona (per finestra idle, per notte, per mese) e fallisce oltre
  `budget.json`; un aumento voluto si registra nello stesso commit (`COST_BUDGET_UPDATE=1 npx vitest run test/cost`).
- **Il resto dell'API di lettura** (WORK_PLAN 4.7, API.md §4): inserimento manuale (`POST api/v1/episodes`,
  `POST api/v1/notes` — scritti dalla persona, dichiarati), correzioni di fatti e note (`POST …/{id}/corrections`,
  cronologia conservata), un fatto o una nota con le sue prove (`GET api/v1/facts/{id}`, `GET api/v1/notes/{id}`), il
  feed delle modifiche delle note (`GET api/v1/notes/changes?since`, per le piattaforme che ne tengono una copia;
  `replaces` indica la nota di cui una nota aggiornata o corretta ha preso il posto),
  impostazioni (`GET` / `PATCH api/v1/settings`: lingua, fuso orario, profilo di qualità; cambiarle richiede il token
  personale della memoria), uso (`GET api/v1/usage`: chiamate LLM e token per prompt e per giorno) ed export completi
  (`POST api/v1/exports` → `GET …/{id}` → `GET …/{id}/archive`: un archivio JSON, costruito in background, conservato 7
  giorni; token personale). Metodi del client per tutti; migrazione `Exports1791140000000`.
- **Dimenticare un periodo**: `POST api/v1/forget {from, to, keepRaw?}` (client `forgetPeriod`) dimentica gli episodi
  avvenuti nel periodo e i messaggi grezzi inviati in esso (`keepRaw`: conservati ma nascosti e mai più estratti), con
  ciò che solo loro sostenevano; restituisce quanto è stato dimenticato (WORK_PLAN 5.5). Dimenticare un episodio ora
  porta via anche i fatti e le note sostenuti solo dai suoi messaggi (non quelli sostenuti anche da un altro messaggio).
- **Pattern ricorrenti** (WORK_PLAN 5.4, D26): il consolidamento notturno deduce le abitudini che emergono dagli episodi
  degli ultimi mesi ("corro al parco il sabato mattina") e le tiene come note della memoria stessa — inferite, mai in
  attesa, nessuno le conferma — sostenute da almeno tre episodi in giorni diversi; le rafforza, aggiorna e ritira da
  sola, e una dimenticata non ritorna dagli stessi episodi. Le note riportano `pattern` (`GET api/v1/notes`,
  `search_memory`; client `Note.pattern`); il contesto di memoria le etichetta. Opzione `patterns` del profilo di
  qualità (accesa in balanced / full; `PATTERNS` la sovrascrive), task LLM `patterns` (`LLM_PATTERNS_*`), admin
  `POST api/v1/admin/memories/:id/patterns`; migrazione `Patterns1791130000000` (`episode_promotions` ricostruita,
  `memories.patterns_upto`, modifica di nota `retired`). Set di sviluppo: 20 abitudini su 21, nessun pattern falso (3 run).
- **Le identità di canale del titolare con un codice monouso** (D51, WORK_PLAN 8.7): in una memoria personale il titolare
  crea un codice (`POST api/v1/me/link-codes` → `RCD-XXXX-XXXX`, dieci minuti, un solo uso; admin
  `POST api/v1/admin/memories/:id/link-codes`; "Link code" nella console), lo invia all'agente da un canale in una chat
  diretta — il messaggio non viene mai salvato, diventa una richiesta di collegamento — e la conferma entro sette giorni
  (`GET api/v1/me/identities`, `POST …/pending/{id}/confirm`, `DELETE …/pending/{id}`; admin `…/link-claims/:claim`,
  `linkClaims` in `GET admin/persons`; "To confirm" nella console): da allora quel mittente è l'"io" della memoria (i
  messaggi precedenti mantengono la loro attribuzione); `DELETE api/v1/me/identities/{id}` lo scollega. Campo d'ingest
  `conversation.direct` (un gruppo non chiede mai nulla). Libreria client: `linkCode`, `holderIdentities`,
  `confirmHolderClaim`, `rejectHolderClaim`, `unlinkHolderIdentity`, `isLinkCode`, `LINK_CODE_INSTRUCTION`. OpenClaw,
  Hermes e il proxy inviano subito un codice e dicono al modello che cos'è (OpenClaw e Hermes segnano le chat dirette).
  Migrazione `HolderLinks1791150000000`.

### Modificato
- Un partecipante noto che compare con un nome nuovo sul canale (un soprannome diventato nome completo) resta lo stesso
  contatto, e il nome nuovo si aggiunge ai suoi alias, così una ricerca per quel nome lo trova (WORK_PLAN 8.7).
- `PATCH api/v1/me` accetta anche il token personale della memoria (scope `ingest`): un host senza account utente
  (Claude Code, Codex, un connettore con token personale) imposta il genere, e la modalità finché la memoria è vuota,
  senza l'amministratore (WORK_PLAN 8.7).
- Libreria client: `PersonDirectory` tiene il genere allineato al profilo sulla piattaforma come il nome
  (`PlatformUser.gender`; un solo `PATCH api/v1/me` porta entrambi quando cambiano entrambi) (WORK_PLAN 8.7).
- Plugin OpenClaw: i messaggi catturati non inviati aspettano in una coda su disco (`<cartella di stato di OpenClaw>/recordare/outbox`,
  solo per il proprietario, solo i batch non inviati) e vengono ritentati per qualche ora, anche dopo un riavvio del
  Gateway — prima una coda in memoria rinunciava dopo una decina di minuti e perdeva tutto al riavvio (WORK_PLAN 6.6b (5)).
- `/mcp` risponde in JSON semplice (`application/json`) invece che come flusso di eventi: un host o uno script legge la
  risposta senza un parser SSE; i client inviano comunque `Accept: application/json, text/event-stream` (WORK_PLAN 6.6b (10)).
- Prompt di estrazione `extract.v14` (entrambe le modalità, WORK_PLAN 8.11): gli errori dell'agente stesso sono salvati in
  prima persona ("ho sbagliato le date: avevo detto X, è Y"), le alternative confrontate restano accanto alla scelta, e un
  passo di un piano aperto fatto prima della sua data (una prenotazione, dei biglietti) aggiorna il piano. Set ciechi:
  personale 81,6 % → 90,1 %, entità 89,8 % → 93,3 % (`spikes/memory-eval/RESULTS.md`).
- `search_episodes`: una `search` con un periodo restituisce anche fino a 3 episodi pertinenti di fuori in `outsidePeriod`
  (prima: solo quando il periodo non aveva risultati), ordinati solo per pertinenza; gli estratti di chat dietro un episodio corretto portano `correctedBy`.
- Prompt entità `entity.v5` (WORK_PLAN 8.11): ciò che l'agente condiviso ha fatto con quanto qualcuno gli ha passato o
  chiesto (una prenotazione presa, un pagamento registrato) è una sua azione, in prima persona, con chi l'ha chiesta —
  non più "Benedetta ha registrato la prenotazione"; un numero C solo per la persona di cui parla l'elemento. Il writer
  dell'estrazione assegna un episodio il cui soggetto è un contatto elencato mai nominato nella conversazione all'unica
  persona che l'episodio nomina (prima: l'episodio veniva scartato). Set cieco entità: 91,9 % (3 run; la domanda sulla
  prenotazione da 0/3 a 2/3 + 1 parziale).
- Risolutore dei quasi-duplicati `resolve.v2`: di due racconti dello stesso evento nasconde quello che l'altro contiene
  per intero, come indica il modello (prima: sempre il più corto, così un messaggio successivo breve con l'esito —
  "inviato alle 16:10, numero di conferma …" — veniva nascosto); quando ognuno ha qualcosa di suo, restano visibili
  entrambi.
- `search_episodes`: una ricerca (`search`) ordina per sola pertinenza; importanza e recenza decidono solo i pari
  merito (prima pesavano più della pertinenza, così i grandi eventi di una persona spingevano fuori dai risultati il
  piccolo elemento che la domanda nomina). Gli elenchi e `latest` tengono l'ordine di prima. Set ciechi: personale
  90,2 % → 96,0 %, entità 92,2 % → 94,3 % (3 run ciascuno).
- Prompt di estrazione `extract.v15`: l'input dell'estrazione di una chat di gruppo porta il nome del gruppo (il `title`
  della conversazione), così un episodio raccontato lì dice che era in quel gruppo. Il prompt di sistema non cambia.
- `search_episodes`: anche un `list` con una query restituisce fino a 3 episodi pertinenti di fuori periodo in
  `outsidePeriod` (prima: solo `search`): ciò che è stato detto nel periodo è datato da ciò che racconta (un trasloco il
  mese dopo).
- `search_episodes`: gli estratti di chat (`fromChats`) portano `group`, il nome della chat di gruppo, così ciò che
  qualcuno ha scritto e che nessun episodio racconta dice comunque in quale gruppo; la descrizione dello strumento dice
  agli agenti che un intervallo vago ("ultimamente", "in queste settimane") non è un periodo. Set cieco personale
  96,0 % → 97,2 % (3 run; la domanda sui messaggi di un fratello in due gruppi corretta 3 su 3).

### Corretto
- Un fatto o una nota in attesa che sostituirebbe o correggerebbe uno dichiarato (l'affermazione di un altro, l'output di
  uno strumento, parlato sentito nella stanza) lo propone soltanto: quello dichiarato resta corrente finché quello in
  attesa non è confermato, che allora lo ritira (migrazione `PendingProposals1791160000000`; prima, l'età di una sorella
  sentita come quella del titolare ritirava quella del titolare).
- Cancellare un fatto o una nota (`DELETE api/v1/facts|notes/{id}`, o rifiutarne uno in sospeso) lascia un tombstone
  (solo id: chiave dello slot o categoria della nota, soggetto, messaggi di evidenza), così una ri-estrazione degli
  stessi messaggi non lo riscrive più; raccontato di nuovo in un messaggio nuovo, viene imparato (WORK_PLAN 4.13;
  migrazione `FactNoteTombstones1791110000000`).
- Le ricerche vettoriali filtrate per memoria scandiscono gli indici HNSW in modo iterativo (`hnsw.iterative_scan =
  strict_order`, pgvector ≥ 0.8): su un'installazione grande una ricerca poteva restituire meno righe di quelle chieste
  quando altre memorie riempivano l'indice (WORK_PLAN 4.14).
- L'oblio porta con sé ciò che solo esso sosteneva (WORK_PLAN 5.5): cancellare un messaggio o una conversazione, o
  dimenticare un episodio, cancella gli episodi, i fatti e le note rimasti senza evidenza (prima restavano, senza più
  nulla dietro); un piano confermato, annullato o ripianificato da un messaggio cancellato riprende lo stato precedente;
  un fatto o una nota che ne sostituiva uno più vecchio lo fa tornare attuale; i digest costruiti su ciò che sparisce
  vengono riscritti.
- I messaggi rimasti senza estrazione (una chiamata di estrazione fallita, un job di inattività perso) non aspettano più
  il messaggio successivo nella loro conversazione: lo sweep notturno li estrae prima di consolidare (WORK_PLAN 4.1).
- Ciò che l'assistente riporta da uno strumento (una ricerca web, una pagina, un calendario) in quel turno non diventa
  più un fatto o una nota dichiarati della persona: resta in sospeso finché non viene confermato, e un episodio che ne
  deriva è il resoconto dell'assistente (taint del turno, WORK_PLAN 5.7). Prima, una pagina web che diceva "X è
  allergico alle noci", ripetuta dall'assistente, poteva essere salvata come della persona.
- Lo stesso evento raccontato in due conversazioni estratte nello stesso momento, o registrato con `log_episode`, non
  resta più doppio: il consolidamento notturno controlla le coppie che nessun controllo dei quasi-duplicati poteva
  vedere, prima di scrivere il diario (WORK_PLAN 5.3; migrazione `EpisodeResolvedAt1791120000000`; il riepilogo del
  consolidamento conta `duplicates`). Quando nessuno dei due racconti era mai stato controllato, quello che può essere
  nascosto è il registrato dopo (prima dipendeva dall'ordine degli id).

## [0.2.0] — 2026-10-10

La **memoria dell'agente** (D50): ogni memoria appartiene a un agente ed è scritta in prima persona — l'assistente di
una persona (personale) o un agente che usano in tanti (entità, "qualcuno" finché non dice chi è); le persone sono i
suoi contatti; l'agente impara fonti (D49). **Incompatibile**: nessuno stato di consenso in Recordare (l'unico
interruttore è quello del client), "owner" rinominato (memoria / titolare, sotto) — aggiornare la libreria client e i
connettori insieme al servizio. Qualità (DeepSeek `deepseek-flash`, `spikes/memory-eval/RESULTS.md`): insieme cieco di
entità 91,4 % (82,1 % nella 0.1.0), insieme cieco personale 90,9 %, fonti apprese (insieme di sviluppo) 96,7 %.

### Aggiunto
- **Notizie ricevute come ricordo** (`extract.v11`): una notizia che tocca la vita della persona (un piano aperto, una
  persona che conosce, una cosa che possiede, o una sua reazione) diventa un episodio a bassa importanza con entrambe le
  date; le curiosità restano nel log delle chat.
- **Contesto di memoria**: ogni frase del messaggio viene confrontata anche da sola, e un periodo nominato nel messaggio
  (in qualsiasi lingua supportata, giorni della settimana compresi) aggiunge gli episodi di quel periodo; soglie
  configurabili (`CONTEXT_MIN_*_SIMILARITY`).
- **Lingue**: `service/src/lang` — espressioni di periodo e nomi di mesi / giorni da Intl per 25 delle lingue più usate;
  tabelle di parentele e dei sostituti in terza persona del sé (rilevatore di fughe, 8.4) per molte lingue.
- **Chiamate per i connettori**: `POST api/v1/ingest/conversations/{id}/end`; `POST api/v1/context {ingest}` (salva il
  turno e restituisce il contesto in una chiamata); i token personali leggono prima che la conversazione sia salvata;
  `TOOLS` (schemi degli strumenti MCP) nella libreria client; i connettori li usano.
- **Diagnostica**: ogni estrazione conserva un riassunto (restituito, scritto, scartato e perché — solo conteggi);
  `GET api/v1/admin/memories/{id}/runs`.

### Modificato
- **Niente più flag di consenso** (D50, WORK_PLAN 8.1) — **incompatibile**. Recordare conserva, estrae e consolida
  sempre ciò che un client invia (sempre zero chiamate LLM quando non c'è nulla da fare); l'interruttore acceso / spento
  appartiene alla piattaforma client, e informare le persone attorno all'agente è compito di chi lo installa. La
  migrazione `NoConsent1791060000000` elimina `owners.episodic_enabled`, `episodic_enabled_at`, `episodic_enabled_by` e
  `ingest_refused_at`; `stored` esce dal risultato dell'ingest; `episodicEnabled` esce da `GET api/v1/me` e dall'API
  admin (con `episodicEnabledAt` e `waitingForConsentSince`); spariscono l'interruttore del consenso e l'etichetta "in
  attesa del consenso" della console; le scritture MCP non rispondono più "memoria spenta". Libreria client: rimossi
  `ConsentState`, `PersonDirectory.knownOff()` e `status()`, `MeResponse.episodicEnabled` e `IngestResult.stored`.
- **Niente più filtro su chi legge** (D50, WORK_PLAN 8.2). Il richiamo MCP (`search_episodes`, `search_memory`) e il
  contesto di memoria (`POST api/v1/context`) rispondono con tutta la memoria in ogni conversazione — conversazioni
  condivise e di gruppo, conversazioni non ancora salvate, nessuna conversazione, lettori aggiunti — invece di niente;
  privacy e riservatezza verranno dopo. `X-Recordare-Viewers` / `_meta.recordare.viewers` sono ignorati e l'avviso
  `"nothing to show here"` non c'è più. `audience` / `disclosure` continuano a essere registrati; una memoria non vede
  comunque mai i dati di un'altra. L'header della conversazione è ancora risolto: le scritture MCP vi legano le loro prove.
- **Identità della memoria** (D50, WORK_PLAN 8.3) — **incompatibile**. Una memoria appartiene a un account di un client;
  le persone che conosce sono contatti di quella sola memoria. Migrazione `MemoryIdentity1791070000000`: `persons.kind`
  diventa `memories.mode` (`personal | entity`) con `memories.gender` (`masculine | feminine | neutral`, default maschile);
  ogni persona che non è una memoria è un contatto di esattamente una memoria (`full_name`, `relation`, nomi in
  `person_aliases`), e i contatti che mancavano a una memoria vengono creati (per esempio una persona con una propria
  memoria che parla anche a un dispositivo condiviso); `external_identities.kind` diventa `account` (era `client_user`:
  apre una memoria) o `participant` (era `channel`, ora anche l'id di partecipante di un client: nomina un contatto
  dentro una sola memoria, creato dall'ingest al primo incontro); ogni messaggio registra chi l'ha detto (`author_kind`
  `self | contact | someone | agent | own | tool`, `attribution_method`, `attribution_confidence`); episodi, fatti e
  note registrano di chi sono (`subject_kind`, `subject_person_id`, `subject_candidates`); viene creata una tabella
  `clarifications` per dopo. API: `GET / PATCH api/v1/me` e le rotte admin delle memorie accettano `mode` e `gender` al
  posto di `kind`; `POST api/v1/admin/identities` accetta `kind: account | participant`; l'ingest accetta `own: true`
  su un messaggio (contenuto proprio dell'agente) e le sorgenti `document`, `perception`, `ambient`. La console mostra
  modo, genere, contatti e tipi di identità. Libreria client: `MemoryKind` → `MemoryMode` + `MemoryGender`, `Me.kind` →
  `mode` / `gender`, `MeSettings.kind` → `mode` / `gender`, `Person.kind` → `mode`, `IngestMessage.own`, le nuove
  sorgenti. I prompt di estrazione e i loro input non cambiano.
- **Prima persona nella memoria personale** (D50, WORK_PLAN 8.4) — **incompatibile per i risultati MCP**. Una memoria
  personale è scritta in prima persona (`extract.v12`, `facts.v2`), nella lingua della conversazione e con il genere
  della memoria: il titolare dell'account e l'assistente sono un solo "io". Ogni episodio, fatto e nota riceve un
  soggetto collegato ai contatti della memoria (creati quando una persona è solo nominata, fusi solo quando è chiaro);
  una persona ambigua ("quale Marco?") è salvata come indecisa con una chiarificazione a cui risponde una conversazione
  successiva o che scade dopo 14 giorni; un'identità di partecipante vista per la prima volta si lega a un contatto noto
  solo quando il suo nome completo corrisponde a esattamente un contatto senza identità — con il solo nome di battesimo
  diventa un nuovo contatto con una chiarificazione "stessa persona?", il cui "sì" fonde i due contatti (migrazione
  `ContactClarification1791080000000`: `clarifications.contact_id`). `search_episodes` / `search_memory` restituiscono `memory {name, mode}` (era `owner {name}`),
  il `subject` di ogni elemento (fatti: `subject` sostituisce `about`), `speaker` (chi sta chiedendo; chi è identificato
  riceve per primi i propri elementi) e `clarifications`; in una memoria personale i `claims` sono affermazioni di altri
  su qualcun altro (la notizia che una persona dà di sé è sua, l'output di uno strumento è un apprendimento dell'agente).
  Il contesto di memoria parla all'agente come al sé della memoria, nomina gli elementi delle altre persone e può offrire
  una domanda ("if natural, ask: …"). Le descrizioni degli strumenti parlano della "tua memoria". `nameOwner` è
  sostituito da un rilevatore di fughe (conteggi nel riepilogo dell'esecuzione). Una finestra personale in cui parlano
  solo altre persone ora costa una chiamata di estrazione. Le memorie di entità non cambiano fino alla 8.5. Libreria
  client: `TOOLS` rigenerato.
- **Affermazioni altrui sul sé, datate** (WORK_PLAN 8.4b, `extract.v13`): in una memoria personale ciò che qualcun altro
  dice del sé è un episodio in prima persona con la data in cui è stato detto, chi l'ha detto e dove; il richiamo non
  descrive più i claims come affermazioni solo su altri.
- **Agente entità** (D50, WORK_PLAN 8.5) — **incompatibile per i risultati MCP delle memorie di entità**. Una memoria di
  entità (un dispositivo, un luogo, un robot o un servizio condiviso) è la memoria dell'agente in prima persona
  (`extract.v13+entity.v4`, `facts.v2+entity.v4`): le sue risposte e azioni e il contenuto che gli viene dato (`own`) sono
  "io"; le persone che gli parlano sono contatti per nome, `someone` finché la conversazione non le identifica. Soggetti,
  contatti e domande di chiarimento funzionano come nelle memorie personali (una domanda "quale Marco?" è offerta solo a chi
  si è identificato); `speaker` è in ogni risultato (`someone` per chi non è identificato in una memoria di entità); i
  `claims` seguono la regola personale. Blind8: 82,1 % → 91,4 % (3 run).
- **Il diario dell'agente** (WORK_PLAN 8.6, `digest.day.v2` / `digest.month.v2`, `facts_review.v2`): i riassunti notturni del
  giorno e del mese sono scritti in prima persona dal sé della memoria (personale: la mia giornata, con le notizie delle
  persone che conosco; entità: la giornata dell'agente condiviso), mai dalle affermazioni altrui; una nuova versione del
  prompt riscrive ogni giorno una volta. La revisione notturna dei fatti copre ogni soggetto (i fatti del sé e dei
  contatti). Entrambi restano spenti nel richiamo / per default (nessun guadagno misurato).
- **Fonti apprese** (D49, WORK_PLAN 8.9): la memoria semantica dell'agente — testi che impara (manuali, documenti, pagine,
  appunti; solo testo, il client converte i file) tenuti separati da ciò che ha vissuto, senza limiti di dimensione
  (inviati a parti), brani con embedding in background, chi li ha dati e quando, e l'apprendimento come episodio collegato
  nei due sensi (scritto dall'estrazione della sua conversazione, o dal codice nella lingua della memoria). Nuove route
  REST (`api/v1/ingest/sources`, `api/v1/sources`), strumenti MCP `search_knowledge` e `learn_source`, `sources` sugli
  episodi, un brano nel contesto di memoria; dimenticare una fonte lascia un segno sui suoi episodi. Libreria client:
  `learnSource` (parti automatiche), `forgetSource`, `sources`; `TOOLS` rigenerato. Le richieste più grandi di
  `MAX_REQUEST_BYTES` (16 MB) ricevono 413, il JSON malformato 400 (prima 500).
- **Connettori: una memoria per agente, le persone come partecipanti** (D50) — **incompatibile per le installazioni con
  più persone**. OpenClaw: l'agente del Gateway ha una sola memoria (un token personale, o una chiave client con
  `defaultUser`); ogni mittente è un partecipante con l'identità di canale `<canale>:<senderId>` e il nome che ha sul
  canale, il titolare dell'account sta in `selfSenders` (i turni da CLI e Control UI sono suoi); la mappa `users` è ora
  `memoryPer: "user"`. Hermes Agent: una memoria per l'agente (un token personale, o una chiave client con un
  `RECORDARE_USER` fisso); gli utenti del gateway e l'autore di ogni turno nelle sessioni condivise sono partecipanti
  (`<piattaforma>:<id utente>`, il loro nome), il titolare dell'account in `RECORDARE_SELF_IDS`; memorie per utente con
  `RECORDARE_MEMORY_PER=user`, la mappa di alias dà a una persona un solo id su più piattaforme. Proxy compatibile
  OpenAI: una memoria per proxy (`RECORDARE_USER` o il token personale), gli utenti della piattaforma come partecipanti
  con il loro nome (nome utente di Open WebUI, `X-Recordare-User-Name` di LibreChat, `name=` nel marcatore di
  AnythingLLM), il titolare dell'account in `SELF_USERS`; `MEMORY_PER=workspace` (una memoria per workspace di
  AnythingLLM) o `user` (il comportamento precedente). I turni delle altre persone sono inviati con ruolo `other` e il
  loro autore, così non vengono mai letti come parole del titolare dell'account. Claude Code / Codex: invariati (la
  memoria del token personale), solo testi. Chi aggiorna con una mappatura per persona: imposti `memoryPer: "user"` /
  `RECORDARE_MEMORY_PER=user` / `MEMORY_PER=user`.
- **Niente più "owner"** (D50, WORK_PLAN 8.10) — **incompatibile**: una memoria è una memoria, e la persona a cui
  appartiene una memoria personale è il suo titolare (`holder`). La migrazione `Memories1791100000000` rinomina sul posto
  (nessuna modifica ai dati oltre ai valori rinominati): tabella `owners` → `memories`; ogni colonna `owner_id` e
  `persons.owner_scope` / `external_identities.owner_scope` → `memory_id`, con indici e vincoli rinominati allo stesso
  modo (per esempio `facts_owner_key_idx` → `facts_memory_key_idx`); il valore enum `owner` → `holder` per il ruolo del
  partecipante, il ruolo dell'autore e il livello di disclosure, le origini `owner_lived` / `owner_told` →
  `holder_lived` / `holder_told`, il ref del partecipante implicito `owner` → `holder`; scope dei token `owner_settings`
  → `memory_settings`; marcatore del gate delle esecuzioni di estrazione `gate:no-owner-message` →
  `gate:no-holder-message`. API: `ownerId` → `memoryId` ovunque (REST, `GET api/v1/me`, MCP, telemetria); nell'ingest
  `participants[].role` e `authorRole` accettano `holder`; rotte admin `api/v1/admin/owners…` → `api/v1/admin/memories…`
  (compresa `GET api/v1/admin/memories/:id/atlas`); flusso di telemetria `?owner=<id>` → `?memory=<id>`; `GET
  api/v1/me` `via` `owner_token` → `memory_token`; risoluzione della conversazione `owner_direct` → `memory_direct`.
  Contratto di Atlas **v2** (`docs/ATLAS_EVENTS_it.md`): gli eventi portano `memoryId`, lo snapshot `memory {id, name}`,
  le rotte admin qui sopra. Libreria client: `memoryId` (per esempio `people.refresh()` → `{ memoryId, mode, atlasUrl
  }`), ruolo `holder`; i connettori inviano il titolare dell'account come partecipante `holder`. Client e connettori 0.1.0
  non funzionano con questa versione: vanno aggiornati insieme al servizio. L'header `X-Recordare-User` e i prompt non
  cambiano.

### Corretto
- Un fatto breve dentro un messaggio lungo della persona conta come sue parole; "il proprietario" viene sostituito dal
  nome.

## [0.1.0] — 2026-10-08

Prima versione pubblica: il **profilo privato** (un'installazione gestita da qualcuno di cui gli utenti si fidano —
README → Limiti).

### Motore di memoria
- **Log grezzo**: ingest REST delle chat (idempotente, modifiche e cancellazioni, chat di gruppo con partecipanti e
  autori), avvio per inattività della conversazione e consolidamento notturno; nulla viene elaborato senza il consenso
  della persona.
- **Episodi**: una chiamata LLM di estrazione per finestra di conversazione (`extract.v8`) — eventi, piani con il loro
  esito (fatto, annullato, spostato, aperto, irrisolto), cambiamenti di stato, persone, luoghi, sentimenti; bi-temporali
  (quando è successo, quando si è saputo) con la precisione della data; la provenienza (`author_role`, `stance`) tiene
  separato ciò che la persona ha vissuto da ciò che altri affermano; le correzioni rimandano alla versione che
  sostituiscono; l'oblio è definitivo.
- **Fatti** con storia e validità (domande "alla data"), **note** (preferenze, abitudini, conoscenze), **riassunti
  giornalieri e mensili**.
- Protezioni misurate su set ciechi: le affermazioni di altri non diventano fatti della persona; un messaggio di gruppo
  rivolto all'assistente da qualcun altro non è una richiesta della persona; un piano non si conferma prima della sua
  data; un ricordo ripetuto dall'assistente non è una nuova prova; il nome della persona al posto di "l'owner".
- **Memoria di entità** (sperimentale): una memoria per un dispositivo o account condiviso (l'assistente di cucina di
  una famiglia); i fatti portano la persona a cui si riferiscono; chi parla è solo chi si presenta nella conversazione.
- **Profili di qualità** `economy | balanced | full` (costo contro qualità), per installazione con modifica per persona.
- Qualsiasi provider LLM (compatibile OpenAI, Anthropic, Claude CLI; profili per le particolarità dei provider) e
  qualsiasi endpoint di embedding compatibile OpenAI (misurato con BAAI/bge-m3).

### Interfacce
- **MCP** (Streamable HTTP): `search_episodes`, `search_memory`, `resolve_period`, `log_episode`, `remember`,
  `correct_episode`, `forget_episode`; chiavi client che agiscono per i loro utenti, o token personali (Claude Code —
  INTEGRATION §4b, `npm run smoke:mcp`).
- **Contesto di chi legge** in ogni lettura: ciò che si dice in una conversazione con altri partecipanti non arriva mai a
  loro.
- **Contesto di memoria** `POST api/v1/context`: i ricordi rilevanti per la prossima risposta in un unico blocco
  delimitato, senza chiamate LLM.
- **API di lettura** (il diario della persona): linea del tempo, dettaglio dell'episodio con le prove, riassunti, fatti
  a una data, note, piani, e le modifiche della persona (correggere, dimenticare, fissare, confermare, rifiutare).
- **API admin** e **console admin** (`/admin`): persone, consenso, tipo di memoria, client, chiavi, token.
- **Libreria client** `@arkimedehq/recordare-client` (`packages/client`): consegna con ritentativi, rubrica delle
  persone, sessioni MCP, errori RFC 9457; suite di conformità contro il servizio. Pubblicata su npm
  (`@arkimedehq/recordare-client`), insieme al plugin OpenClaw (`@arkimedehq/openclaw-recordare`); il proxy compatibile
  OpenAI come immagine (`ghcr.io/arkimedehq/recordare-openai-proxy`).
- Contratto di telemetria per la vista dal vivo opzionale **Recordare Atlas** (`arkimedehq/recordare-atlas`, solo
  metadati).

### Installazione
- `deploy/install.sh` (guidato, o `--yes` non interattivo), `deploy/update.sh`, `deploy/backup.sh`.
- Profili: **standalone** (Postgres + pgvector, Redis e text-embeddings-inference con bge-m3 propri; ≈ 6 GB di RAM) e
  **co-ospitato** con Arkimede (database e db Redis propri sui servizi di Arkimede). Entrambi provati da capo a fondo.

### Qualità (DeepSeek `deepseek-flash`, 3 run ciascuno, `spikes/memory-eval/RESULTS.md`)
- Nuovo set cieco scritto da un agente separato: **91,3 %** (memoria di persona, 46 domande); memoria di entità 82,1 %.
- Set ciechi precedenti: 90,7 % (blind5); alla pari con un riferimento a contesto completo e davanti a Mem0 su blind4.

### Client
- **Arkimede**: ingest, strumenti di richiamo, contesto di memoria per agente, il Diario, tipo di memoria e consenso
  nelle sue impostazioni.
- **Connettori al livello completo** (cattura + contesto di memoria prima di ogni turno + strumenti di memoria), in
  `connectors/`, ognuno provato dal vero: plugin per **Claude Code** (`/plugin marketplace add arkimedehq/recordare`),
  **Codex** (installer di hook + MCP), plugin per **OpenClaw**, memory provider per **Hermes Agent**, e un **proxy di
  memoria compatibile OpenAI** per le piattaforme senza hook (provato con AnythingLLM; Open WebUI e LibreChat con lo
  stesso meccanismo).
- **Qualsiasi client MCP** al livello basic con un token personale (per esempio Claude Desktop tramite un ponte locale,
  non provato); le scritture di un agente valgono come della persona solo se lo dicono le sue parole recenti.

### Limiti noti
- Ancora nessun login del titolare, OAuth o registro delle letture (profilo pubblico rimandato, D33); HTTP semplice solo
  su una rete fidata.
- Memoria di entità: chi non si presenta può ancora essere attribuito a una persona con nome.
- Claude Desktop / claude.ai: solo livello basic (nessun hook per catturare la conversazione); Desktop richiede OAuth o
  un ponte locale (non provato). Il contesto di memoria manca domande con istruzioni in coda, in altre lingue o su un
  periodo (WORK_PLAN 6.6b) — gli strumenti di memoria no.
