# Iniziative su ogni client: a chi, quando, dove (D53, D55, WORK_PLAN 8.12c)

Stato: **specifica, decisa** (D55, maintainer 2026-11-04); costruita per fasi (§9). Riferimento inglese:
[INITIATIVES_DELIVERY.md](INITIATIVES_DELIVERY.md). Contratto attuale: `API.md` §4b; guida per le piattaforme:
`INTEGRATION.md` §4d; ricerca: `RESEARCH_NOTES.md` H14.

Un'iniziativa è qualcosa che l'agente ha deciso di dire, chiedere, cercare o fare di sua iniziativa, per una persona.
Recordare le crea; solo il corpo dell'agente (il client) può parlare. Lo scopo resta quello di D50: **dare a una
macchina — a un robot — un cervello suo**. Un cervello non aspetta di essere interpellato: ricorda, riprende le cose
lasciate a metà e, soprattutto in una memoria di entità, **chiede per imparare** — come un bambino impara le persone e
il mondo intorno a sé, per diventare autonomo.

## 1. Perché cambia la divisione di D53

D53 lasciava il *quando* all'ospite ("consegnala quando la persona è presente"). Osservato sul Kinox (2026-11-02 → 04):
due iniziative create, nessuna consegnata (nessun webhook, nessun lettore del feed, nessun connettore che consegna),
entrambe scadute; nella stessa conversazione l'ospite aveva programmato un suo promemoria con i suoi strumenti, quindi
un'iniziativa consegnata avrebbe ricordato due volte. E la parte difficile — scegliere il momento — non può essere
dell'ospite: ogni ospite la risolverebbe in modo diverso, o per niente. **D55**: Recordare decide **a chi, quando e su
quale canale**; l'agente gli dà i **sensi** (chi c'è adesso, con che sicurezza), i **canali** (cosa può raggiungere), la
**consegna** e l'**esito**.

## 2. Ruoli

| Recordare (la mente) | L'agente (il corpo) |
|---|---|
| crea le iniziative e i loro tempi (classe, finestra) | dichiara i suoi canali e come ognuno raggiunge una persona |
| decide chi può riceverne una (identità, sicurezza, delicatezza) | manda **impulsi di presenza**: chi vede o sente adesso, con che sicurezza (impronta vocale, volto, account), per quanto |
| decide quando e dove (un momento, un canale), impara dagli esiti | consegna nel suo canale, con la sua voce |
| chiede per imparare (memoria di entità), ritira le domande a cui ha avuto risposta | esegue le ricerche con i suoi strumenti (web, camera, microfono: D53) |
| non legge mai un sensore, non fa mai biometria | fa la biometria dalla sua parte; manda solo "è Eriona, 0,9" |

## 3. A chi — conoscere la persona

- **Memoria personale**: un'iniziativa è per il titolare (o per un contatto con cui il titolare ha a che fare tramite
  l'agente); l'account dice chi sta parlando. Nessun problema di identificazione.
- **Memoria di entità**: l'agente parla con molte persone; un'iniziativa per Eriona deve arrivare a Eriona. Ogni identità
  arriva con la sua **fonte e il suo grado di sicurezza** (D50: dichiarata, impronta vocale, volto, dedotta):

| Fonte | Chi la produce | Sicurezza |
|---|---|---|
| account della piattaforma / mittente del canale (chat, messaggistica) | la piattaforma | alta |
| codice di collegamento confermato dal titolare (D51) | Recordare + la persona | alta |
| "sono Eriona" in chat o a voce | la persona | media (chiunque può dirlo) |
| impronta vocale | l'agente (per esempio Wyoming / Home Assistant) | quella dell'agente, mandata come numero |
| volto | l'agente (camera) | quella dell'agente, mandata come numero |

- **Soglie per delicatezza**: un'iniziativa innocua ("hai steso i panni?") basta con sicurezza media; una che nasce da un
  ricordo privato (D52) o che tocca le cose personali di qualcuno richiede sicurezza alta; una persona non identificata
  non viene mai a sapere il contenuto.
- **Chi parla è sconosciuto** mentre un'iniziativa aspetta qualcuno: l'agente può chiedere "sei Eriona?" (senza rivelare
  nulla) — lo stesso meccanismo delle chiarificazioni (visione L1). La risposta è un'identità di sicurezza media, e un
  ricordo.
- I modelli biometrici restano all'agente (visione: impronte vocali sul dispositivo); Recordare salva chi è stato
  riconosciuto, con cosa, con che sicurezza — mai una voce o un volto.

## 4. Quando — due classi di tempo

- **A orario**: una richiesta o una promessa con un'ora ("ricordami alle 9"), il promemoria richiesto di un appuntamento.
  Dovuta in quel momento, su un canale che raggiunge la persona **adesso**; se nessuno la raggiunge, alla sua prima
  presenza o al suo primo turno prima di `expiresAt`.
- **Flessibile**: la ripresa di qualcosa lasciato a metà ("Eriona ha messo i panni a lavare, deve stenderli" → qualche
  ora dopo, "hai steso i panni?"), com'è andata una visita, una domanda che l'agente ha in sospeso. Una **finestra**
  (`notBefore`, `notAfter`), e dentro la finestra **Recordare sceglie il momento** in base a:
  - segnali: la persona è presente (un impulso), sta parlando (un turno), è appena rientrata;
  - le sue abitudini (la passata dei pattern, 5.4: "Eriona è a casa dopo le 18");
  - gli esiti delle iniziative precedenti (detta, ignorata, rifiutata, una risposta infastidita).

Scegliere il momento è il cuore del lavoro, imparato per gradi (H14):
- **v0** — alla creazione il modello propone la finestra e un momento adatto ("qualche ora dopo, quando è a casa"), nella
  stessa chiamata che oggi formula l'iniziativa (task `initiative`); in economy, finestre per tipo da regole.
- **v1** — apprendimento dagli esiti per persona × canale × fascia oraria × tempo trascorso dall'evento: un bandit
  semplice sulle fasce orarie, inizializzato da v0.
- **v2** — il contesto del momento (occupato, sta parlando con altri, ha appena rifiutato qualcosa).
- Misurato su un dev set di **linee temporali** (eventi, presenze, turni) con un gold di finestre accettabili e una
  penalità per le interruzioni inutili; osservato sul Kinox.

## 5. Dove — canali, dichiarati dal client

| Canale | Raggiunge la persona | Regole |
|---|---|---|
| **nel turno** (il contesto di memoria) | mentre sta parlando | il migliore per le flessibili; non interrompe nessuno; le ore di quiete non si applicano |
| **chat** | sempre (il messaggio aspetta) | la vede quando la apre |
| **messaggistica** (Telegram, WhatsApp…) | sempre, e interrompe | ore di quiete, limite giornaliero per persona |
| **voce / stanza** | **solo dopo un impulso di presenza** | identità sopra la soglia; la breve validità dell'impulso |

Un client dichiara i suoi canali una volta (admin, per client: `channels: [{kind: chat | messaging | voice, reach:
always | presence}]`). Il canale nel turno non va dichiarato: ogni client di livello completo chiama già `POST
api/v1/context` prima di ogni turno (D54).

### 5b. Il canale si sceglie alla consegna (maintainer, 2026-11-05)

Scegliere il canale quando l'iniziativa nasce (`pickChannel`: a orario → messaggistica poi chat, flessibile → chat poi
messaggistica; la voce mai) è sbagliato due volte: ciò che un client raggiunge cambia da persona a persona (Andrea ha
Telegram, Chloé no) e da momento a momento (la voce raggiunge qualcuno solo mentre è lì). Deciso:

- **Canali accettabili, in ordine, sull'iniziativa; il canale si sceglie alla consegna.** Recordare dice quali canali
  vanno bene e in che ordine; il client consegna sul primo che raggiunge **quella persona adesso** e riporta, con
  l'esito, il canale usato. Consegnata su un canale l'iniziativa è presa (esclusiva, come `offered` oggi): mai due
  volte. Recordare non ha bisogno di sapere cos'è Telegram: lo stesso contratto vale per ogni piattaforma.
- **Messaggistica solo per ciò che è stato chiesto o promesso a un'ora**: un promemoria a orario, una richiesta della
  persona, una mia promessa. Domande, cose lasciate a metà, questioni e ricerche non interrompono mai con un messaggio:
  aspettano un turno, una presenza o la chat. Ore di quiete e limite giornaliero valgono sempre; in una conversazione di
  gruppo niente di privato e niente che richieda `identity: high` — solo una conversazione diretta con la persona a cui
  è destinata.
  - Ordine per un promemoria a orario, una richiesta, una promessa: voce (se presente) → messaggistica → chat.
  - Ordine per tutto il resto: voce (se presente) o il turno → chat.
- **Un promemoria a orario non si perde**: se al suo momento nessun canale raggiunge la persona adesso, lo prende il
  successivo nell'ordine (messaggistica, poi la chat, che raggiunge sempre). Una flessibile aspetta il suo momento; a
  fine finestra, `ignored`.
- **La risposta torna come turno.** La persona risponde dove il messaggio l'ha raggiunta; il client acquisisce la
  risposta nella conversazione che contiene il messaggio consegnato (`source` punta all'iniziativa), e l'estrazione la
  chiude (fatta, risposta, imparata) senza chiamate LLM in più, come nel turno (§7).
- **Voce: annuncio spontaneo a ogni presenza**, con un'apertura che non rivela niente quando ci sono altri: §5c.

Cambi al contratto (additivi, costruiti il 2026-11-05, `API_it.md` §4b): `channels: [kind…]` in ordine sull'iniziativa
(feed, webhook, presenza, contesto) accanto a `channel` (dove è stata offerta o spinta); l'esito porta `channel`; la dichiarazione per client resta
ciò su cui l'orologio può spingere (`channels` elenca ciò che l'iniziativa accetta; il client usa quelli che ha).

### 5c. Presenza e voce (maintainer, 2026-11-05)

Ragionata sulla casa del maintainer (Home Assistant con persone, telecamere, un satellite vocale in cucina; presto la
papera di quacksat, un satellite vocale mobile) ma scritta come **standard**: non sappiamo cosa avranno gli utenti, così
l'agente integra quanti più dispositivi può attraverso un solo hub e la guida dice cosa si può usare (§5c.8).

**1. Chi è l'agente, chi sono le persone.** La configurazione più usata è una **memoria di entità**: un nuovo essere
digitale con un cervello suo (Arkim3de sul Kinox), il cui corpo è un account sulla piattaforma (l'utente Wyoming di
Arkimede). Le persone di casa sono **contatti di quella memoria**, non utenti della piattaforma: a Chloé non serve un
account Arkimede. Ogni indirizzo di una persona è un'identità sulla **sua scheda in Recordare** — un'identità di
partecipante verificata: `homeassistant` / `person.chloe`, `telegram` / il suo chat id, più avanti un'impronta vocale o
l'etichetta di un volto — collegata una volta dalla console (`POST api/v1/admin/identities` dell'admin) o con un codice di
collegamento (D51). Un solo elenco, usato nei due sensi: un impulso di presenza che nomina `person.chloe` porta a Chloé
(come oggi), e un'iniziativa per Chloé porta **i suoi indirizzi per canale**, così il corpo sa dove trovarla. Gli
indirizzi sono dell'agente (D50: la memoria appartiene all'agente), restituiti al corpo che li ha registrati. Le memorie
personali (quella di un utente) tengono chat e messaggistica; la voce di casa per loro si può aggiungere dopo senza
cambiare questo.

**2. Tre livelli di presenza.**

| Livello | Fonte di esempio | Basta per parlare? |
|---|---|---|
| **in casa** | `person.*` di Home Assistant è `home` (app companion, router, GPS) | no: tiene pronto ciò che è dovuto |
| **in una stanza** | Bluetooth per stanza (Bermuda, ESPresense), un volto riconosciuto da Frigate, la papera che vede qualcuno | sì, se la stanza ha un punto voce e l'identità è abbastanza sicura |
| **sta parlando** | un turno vocale su un satellite | è già il canale nel turno |

Un sensore di occupazione senza identità (mmWave, movimento, la "persona" di Frigate senza volto) è **qualcuno** nella
stanza: può portare a "sei Chloé?" (§3), mai al contenuto.

**3. Tutto da Home Assistant.** La piattaforma legge la presenza da Home Assistant e parla attraverso di esso. MCP non
basta: i suoi strumenti li chiama il modello, su richiesta — la presenza deve arrivare da sola, senza modello, e un
annuncio deve andare a un satellite scelto, certo e senza costo (l'intento di broadcast di Home Assistant parla su tutti
i satelliti). **Lo stesso URL e lo stesso token** già configurati per l'MCP server di Home Assistant aprono le sue **API
WebSocket**: la piattaforma si iscrive agli eventi (persone, sensori delle aree, il posto della papera) e chiama
direttamente le azioni dei satelliti. Nessuna impostazione nuova. Senza Home Assistant una piattaforma ha chat,
messaggistica e voce nel turno.

**4. Fonti di presenza e punti voce** — due anagrafiche che la piattaforma ricava da Home Assistant, niente da tenere a
mano:
- **fonti di presenza**: chi è in quale area e quanto è sicuro, da qualunque entità abbia Home Assistant (sopra);
- **punti voce**: ogni entità `assist_satellite` con la sua area presa da Home Assistant; uno **mobile** prende l'area da
  un sensore (la papera: `sensor.quacksat_where` / il `place` MQTT; quacksat chiede già di dare ai posti della papera i
  nomi delle aree di Home Assistant, così le due cose coincidono).

Per raggiungere una persona a voce la piattaforma usa **il punto voce nell'area dove si trova la persona** — un satellite
fisso prima della papera; nessuno lì → il canale successivo nell'ordine (§5b). Più avanti la papera potrà andare dalla
persona per un promemoria a orario (`go_to`).

**5. Impulsi e momento.**
- L'impulso descrive **un luogo**, non una persona: `{place, people: [{identity, confidence, by}], someone: n,
  ttlSeconds}`. Recordare vede se ci sono altri e decide da sé l'apertura (6).
- **Cambiamenti, non stati**: un impulso per qualcuno senza presenza valida in quel luogo è un **arrivo** (una pausa
  naturale: può far partire un'iniziativa flessibile); un rinnovo tiene solo viva la presenza.
- **L'orologio legge le presenze valide** (oggi la tabella `presences` è scritta e mai letta): al minuto di un promemoria
  a orario, una presenza valida in una stanza mette la voce come primo canale.
- **Ritmo**: al massimo un annuncio spontaneo per persona ogni **30 minuti** (in prova, da correggere con gli esiti);
  nessuno mentre la piattaforma dice che la persona parla con qualcuno; le ore di quiete valgono anche per la voce,
  tranne un promemoria a orario (chiesto per quel momento).

**6. Dirlo e sentire la risposta.**
- **Sola nella stanza**: il punto voce dice l'iniziativa **e poi ascolta**, senza parola di attivazione — su un satellite
  di Home Assistant `assist_satellite.start_conversation` (da verificare sulla versione installata; `announce` senza
  ascolto come ripiego: la persona risponde con la parola di attivazione); sulla papera il bridge parla e apre il
  microfono (7).
- **La risposta arriva nella stessa conversazione**: quando parla, la piattaforma scrive il messaggio nella chat della
  persona e **lega quel satellite a quella chat per qualche minuto** (Arkimede: `ConversationFocusService`, già usato per
  i satelliti); il turno di risposta va lì, con chi parla noto (la piattaforma si è appena rivolta a Chloé: sicurezza
  media), arriva a Recordare come turno, e l'estrazione chiude l'iniziativa — risposta, fatta, imparata — senza chiamate
  in più.
- **Altri nella stanza**: solo l'apertura, che non rivela niente — "Chloé, ho una cosa per te: vuoi sentirla?" (la
  lingua della memoria, da `service/src/lang`, ogni lingua) — poi ascolto. Un "sì, dimmi" è un turno normale di Chloé:
  il contesto di memoria porta già l'iniziativa per chi parla ed è identificato (canale nel turno), così l'agente la dice
  e ascolta di nuovo. "Dopo" o silenzio: **resta in attesa** (non `ignored`) e torna a una presenza successiva, nel
  ritmo.
- **Cosa conta come detta**: annuncio riprodotto → detta (`said` / `asked`, canale `voice`); una risposta → chiusa
  dall'estrazione, come in chat; riprodotta senza risposta → una domanda resta aperta fino alla fine della sua finestra,
  come in chat; un'apertura senza sì → non detta, ancora in attesa.

**7. La papera (quacksat) con Arkimede come bridge.** La papera usa il backend `agent` di quacksat e Arkimede diventa il
suo bridge (protocollo agent v1 di quacksat: audio ed eventi su WebSocket, la piattaforma fa STT → LLM → TTS, più papere
su un bridge per nome). Da fare lato quacksat: un annuncio voluto dal server (protocollo v1.2: `announce` dal server, poi
`listen.start` per sentire la risposta — oggi `say` va solo dalla papera al server) e il posto come evento (è già un
sensore di Home Assistant). Più avanti la telecamera della papera con il riconoscimento dei volti è una fonte di presenza
mobile.

**8. Cosa possono installare gli utenti** (la guida, dal minimo al completo):
1. l'app companion di Home Assistant e un satellite vocale (Voice PE o simili): presenza in casa, voce nel turno;
2. un satellite in ogni stanza dove si vive;
3. Bluetooth per stanza (Bermuda con proxy ESPHome, o ESPresense) con telefono o orologio: chi è in quale stanza, senza
   telecamere, poco costoso;
4. Frigate con riconoscimento dei volti dove ci sono telecamere;
5. occupazione mmWave, per sapere che c'è qualcuno anche senza telefono;
6. un satellite mobile (la papera di quacksat).

**Cambi al contratto** (additivi, costruiti il 2026-11-05, `API_it.md` §4b): l'iniziativa porta `for.addresses: [{channel, id}]` (le identità della
persona); l'impulso di presenza per luogo (`people[]`, `someone`); la frase di apertura con l'iniziativa quando ci sono
altri (`opening`); il `channel` dell'esito; un'iniziativa che resta in attesa dopo un'apertura senza risposta.

## 6. Imparare chiedendo (memoria di entità)

Una memoria di entità parte vuota e deve arrivare a **conoscere** le persone e il mondo intorno a sé, poi agire da sé.
Oltre a ricordare e riprendere le cose, **chiede**:
- **chi** — "come ti chiamo?", "sei Eriona?" (identità, §3);
- **sulle persone** — relazioni, ruoli, preferenze, abitudini che non conosce ancora ("chi è Marta per te?", "Leo ha
  scuola il sabato?");
- **sul mondo** — ciò che ha visto o sentito e non sa collocare ("cos'era quel rumore stanotte?"), cosa vuol dire una
  parola in questa casa.

Una domanda che l'agente ha in sospeso (pensieri D53 di tipo `question`) riceve un **destinatario**: il mondo, tramite
gli strumenti dell'agente (un `lookup`, come oggi), oppure **una persona che potrebbe sapere** (un `ask`, consegnato
secondo §3–§5 a qualcuno presente). Una risposta diventa un ricordo con la sua fonte; la passata dei pensieri ritira la
domanda. Regole: una domanda alla volta per persona, mai a una persona non identificata quando rivela qualcosa, mai
assillare (una domanda ignorata aspetta nuove prove, come in D53), e **meno domande man mano che sa di più** — misurato
come una curva nel tempo (domande fatte, con risposta, ritirate; cosa sa la memoria che prima non sapeva). In una
memoria personale lo stesso meccanismo chiede al titolare, con parsimonia.

## 7. Il contratto (cambi, tutti additivi)

- **Impulso di presenza** `POST api/v1/presence {user?, person: {ref | personId}, channel: voice | camera | chat | panel,
  confidence: 0–1, ttlSeconds, place?}` (scope `ingest`): Recordare lo registra (una presenza di breve durata, un
  avvistamento nella memoria quando serve) e **risponde subito** con l'iniziativa da consegnare adesso, se è il momento —
  così l'agente parla senza aspettare un webhook; altrimenti `{initiative: null}`. Un impulso "uscito" la chiude.
- **Canali** dichiarati per client (§5), API admin e console.
- **L'iniziativa** riceve `timing: timed | flexible`, `window: {notBefore, notAfter}`, `channel` (scelto),
  `identity: {required: medium | high}`, `source: {conversation, messageIds}` (gli id del client dei messaggi da cui è
  nata — un ospite riconosce il suo promemoria programmato), e lo stato **`offered`** (consegnata in un turno, in attesa
  di ciò che succede dopo).
- **Nel turno**: `POST api/v1/context` aggiunge al massimo un'iniziativa dovuta adesso per chi parla, identificato, come
  riga del blocco (`- something I meant to tell you (my own initiative; say it if natural, once): …`; `ask`, e `lookup`
  solo quando l'agente dell'ospite ha strumenti: `initiatives: {lookups: true}` nel corpo); la forma della risposta non
  cambia.
- **Chiudere un'iniziativa offerta** senza chiamate LLM in più: l'estrazione della conversazione la vede fatta (INTENTS
  `done`), con risposta (l'esito di un piano, la risposta a una domanda) o appresa (`learn_source`); un client può
  riportare l'esito; niente entro la fine della finestra → `ignored` (`expired` per un `say` a orario).
- **Webhook**: `events` per endpoint (un endpoint che consegna direttamente in una chat si iscrive solo a
  `initiative.created`).
- **Esiti** con il loro contesto (canale, ritardo rispetto a `dueAt`, come ha reagito la persona): i dati da cui il tempo
  impara.
- **La carta della memoria** (`charter.v2`): una riga del blocco marcata come mia iniziativa è qualcosa che volevo dire o
  chiedere — tirarla fuori con naturalezza, una volta; mai come elenco, mai due volte.

## 8. Client

Fatti verificati il 2026-11-04 (codice dei connettori, OpenClaw 2026.10.10, hermes-agent main 2026-11-03, Arkimede
`master`).

- **Ogni client di livello completo** (Claude Code, Codex, il proxy compatibile con OpenAI dietro AnythingLLM / Open
  WebUI / LibreChat, OpenClaw, Hermes, Arkimede): il canale nel turno funziona senza codice nel client appena Recordare lo
  ha. Claude Code e Codex possono mandare `initiatives: {lookups: true}` (una riga nell'hook condiviso). Le CLI e il proxy
  non hanno altri canali.
- **Arkimede** (progetto indipendente; solo il client npm e questi documenti). Il suo unico canale che raggiunge un
  utente senza che scriva è lo schema delle automazioni programmate (un messaggio dell'assistente in una chat → una riga
  di notifica → push Socket.IO, `SchedulingService.deliverToChat`, `NotificationsGateway`); Telegram è uno skill
  installato dall'utente ed eseguito dentro un run dell'agente; Wyoming è solo un server (nessun annuncio); nessun body
  grezzo conservato per verificare le firme. Da costruire: un ricevitore webhook pubblico verificato con `verifyWebhook`
  (body grezzo per quella rotta; `WEBHOOK_ALLOW_PRIVATE` su un Recordare co-hosted) e il feed come riserva; canali
  dichiarati `chat: always`, `messaging: always` (Telegram, su scelta), poi `voice: presence`; **impulsi di presenza** da
  Voce (l'utente Wyoming, `ConversationFocusService`), poi impronta vocale / volto tramite Home Assistant o una camera;
  consegna in chat + notifica; deduplica di un `say` rispetto agli `scheduled_tasks` dell'utente (`source`, ±2 h, parole
  in comune); esiti riportati.
  - **Messaggistica, in modo universale (deciso il 2026-11-05, strada B)**: uno skill si dichiara canale nel suo
    `SKILL.md` — p. es. `user-channel: {kind: messaging, script: scripts/send_message.js}` — e Arkimede chiama
    direttamente quello script con **il testo e un indirizzo**, senza modello in mezzo (esito certo, nessun costo).
    L'indirizzo arriva con l'iniziativa (§5c.1: le identità della persona sulla sua scheda in Recordare — il chat id
    Telegram di Chloé), così a un contatto della memoria di entità non serve un account Arkimede; per la memoria
    personale di un utente l'indirizzo è l'utente collegato allo skill. Ogni skill di messaggistica (Telegram, WhatsApp,
    Signal, e-mail) aderisce con due righe; per primo `telegram-bot` (il suo `send_message` oggi raggiunge un utente
    collegato: riceve l'indirizzo). Con più canali per una persona, il primo in un ordine di preferenza
    (un'impostazione), altrimenti il primo su cui la persona ha un indirizzo. Il messaggio consegnato è scritto anche
    nella chat di Arkimede che il bot usa per quella persona, così la risposta arriva con il suo contesto e raggiunge
    Recordare come turno. Scartata: la consegna tramite una run dell'agente (strada A: una chiamata LLM per messaggio,
    strumento ed esito non certi).
  - **Presenza e voce**: da Home Assistant con le sue API WebSocket e le credenziali dell'MCP server, le due anagrafiche
    (fonti di presenza, punti voce), la risposta legata alla chat, la papera con Arkimede come bridge: §5c.
- **OpenClaw**: nel turno già oggi (`before_prompt_build`). Push con una rotta webhook (`registerHttpRoute`, `auth:
  "plugin"`) o con il feed dal servizio del plugin (`registerService`); consegna come evento di sistema sulla sessione
  della persona più un risveglio heartbeat (`enqueueSystemEvent`, `requestHeartbeat` con `target: "last"`), confermata
  da `message_sent`; canali `messaging: always`; presenza da `message_received` e dal `lastInteractionAt` delle
  sessioni. Un invio diretto sul canale da un plugin che non è un canale non è verificato.
- **Hermes Agent**: nel turno già oggi (`prefetch`). Push senza codice tramite la piattaforma webhook del gateway
  (accetta Standard Webhooks, `deliver_only`, una chat per rotta, `mirror_to_session`; serve `events`; la sintassi dei
  campi del template è da verificare su un gateway in funzione), oppure con un piccolo plugin distribuito accanto al
  provider (`inject_message` sulla sessione del gateway della persona, il feed letto da un thread); presenza da
  `on_turn_start` e dagli hook del gateway.
- **Ogni altra piattaforma**: `INTEGRATION.md` §4d, aggiornata con canali, impulsi di presenza ed esiti con contesto.

## 9. Fasi

| Fase | Cosa | Dove |
|---|---|---|
| **F0** | letteratura (H14: interrompibilità, tempismo delle notifiche, agenti LLM proattivi, curiosità / apprendimento attivo); D55; questa specifica — **fatta il 2026-11-04** (fonti, verdetto e conseguenze per il progetto in H14) | docs |
| **F1** | contratto: canali, impulso di presenza, timing / finestra / canale / identità / `source`, `offered`, `events`; il canale nel turno con le soglie di identità; "sei …?" per chi parla ed è sconosciuto — **costruita il 2026-11-04** (la finestra è `dueAt` / `expiresAt` fino a F2; la riga `lookups` dell'hook condiviso di Claude Code / Codex arriva con F3) | Recordare |
| **F2** | tempo v0 (classi, finestre da regole e dal modello, una decisione su tre eventi: l'orologio, un impulso, un turno); la fonte nuova "qualcosa lasciato a metà"; domande alle persone (§6); dev set con linee temporali (tempo) e una casa che cresce (imparare chiedendo) — **F2a costruita il 2026-11-04**: il filtro sensibile ai costi dell'orologio con finestre da regole, promemoria a orario al loro minuto, `initiative.deliver`, ogni decisione registrata; F2b **costruita il 2026-11-04**: `dataset_dev_timing` + quattro regole di tempo, le ore del modello (`initiative.v3`), le cose lasciate a metà (`extract.v23`), domande indirizzate a chi potrebbe sapere (deterministico; la curva della casa che cresce con risposte simulate è ancora da fare) | Recordare + valutazione |
| **F3** | client: prima Arkimede (ricevitore, chat + notifica, Telegram su scelta, impulsi da Voce), poi OpenClaw e Hermes — **in corso**: `InitiativeInbox` nella libreria client (0.8.0: webhook, presenza, feed, ognuno una volta, esiti riportati); l'hook di Claude Code / Codex chiede le ricerche (0.8.0); Arkimede (2026-11-05, Arkimede 0.6.0): ricevitore webhook + feed tramite `InitiativeInbox`, consegna in una chat dedicata con notifica, un impulso di presenza quando l'utente apre l'app, un promemoria già programmato riportato `done`, connessione e segreto del webhook dalle sue impostazioni. F3a costruita il 2026-11-05 (Recordare: `channels` in ordine, `for.addresses`, presenza per luogo, l'orologio che legge le presenze valide, ritmo della voce, l'apertura, indirizzi in console). Restano: la libreria client (F3b, 0.9.0), gli skill `user-channel` di Arkimede (§8: per primo Telegram), il push per OpenClaw e Hermes | client |
| **F4** | tempo v1: apprendimento dagli esiti; misurato sul dev set e sul Kinox | Recordare |
| **F5** | impronta vocale e volto in Arkimede (Home Assistant, camera), presenza da Home Assistant (tre livelli), punti voce, annuncio e ascolto a ogni presenza, l'apertura quando ci sono altri, la papera con Arkimede come bridge (§5c); tempo v2 | Arkimede, Recordare |

Costo (D35): economy — regole per finestre e canali, nessuna chiamata LLM; balanced — la finestra del modello nella
chiamata `initiative` che esiste già; full — lo stesso con il ragionamento. Imparare dagli esiti non costa chiamate LLM.
