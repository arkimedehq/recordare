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
| **F3** | client: prima Arkimede (ricevitore, chat + notifica, Telegram su scelta, impulsi da Voce), poi OpenClaw e Hermes — **in corso**: `InitiativeInbox` nella libreria client (0.8.0: webhook, presenza, feed, ognuno una volta, esiti riportati); l'hook di Claude Code / Codex chiede le ricerche (0.8.0); Arkimede (2026-11-05, Arkimede 0.6.0): ricevitore webhook + feed tramite `InitiativeInbox`, consegna in una chat dedicata con notifica, un impulso di presenza quando l'utente apre l'app, un promemoria già programmato riportato `done`, connessione e segreto del webhook dalle sue impostazioni. Restano: gli impulsi da Voce e Telegram (su scelta) in Arkimede, il push per OpenClaw e Hermes | client |
| **F4** | tempo v1: apprendimento dagli esiti; misurato sul dev set e sul Kinox | Recordare |
| **F5** | impronta vocale e volto in Arkimede (Home Assistant, camera), annuncio a voce; tempo v2 | Arkimede, Recordare |

Costo (D35): economy — regole per finestre e canali, nessuna chiamata LLM; balanced — la finestra del modello nella
chiamata `initiative` che esiste già; full — lo stesso con il ragionamento. Imparare dagli esiti non costa chiamate LLM.
