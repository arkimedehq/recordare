# Gemello digitale — visione

*Traduzione italiana di [DIGITAL_TWIN_VISION.md](DIGITAL_TWIN_VISION.md) — la versione inglese è quella di riferimento.*

Stato: **visione / roadmap**. La fase 1 (memoria episodica) è realizzata e rilasciata come v0.1.0 (pubblica dal
2026-10-08); il suo design si trova in `EPISODIC_MEMORY_TODO.md`, il suo stato in `WORK_PLAN.md`.

## Obiettivo

Ricreare la memoria e la persona di un utente in modo che un agente guidato da LLM possa agire come suo
**gemello digitale**: chiunque parli con esso (o venga contattato da esso) dovrebbe percepire la
conoscenza, il modo di pensare, lo stile e la voce dell'utente. Il gemello non si limita a rispondere:
prende anche l'iniziativa.

## Perimetro deciso con il proprietario (2026-10-01)

| Dimensione | Decisione |
|---|---|
| **Pubblico** | Soprattutto famiglia e amici; non escluso: chiunque |
| **Quando** | Sempre — finché il proprietario è vivo (delegato / assistente) **e** dopo (legacy) |
| **Iniziativa** | Due livelli: **L1 informare e proporre**, **L2 agire** |

## Pilastri

| Pilastro | Cattura | Oggi |
|---|---|---|
| **Memoria** | Fatti e note semantiche, episodi (diario), narrazione autobiografica | Episodi, piani, fatti con storia, note e digest realizzati (fase 1, v0.1.0); narrazione mancante |
| **Stile** | Come il proprietario scrive e parla: lessico, lunghezza delle frasi, ironia, modi di dire | Mancante — ricavabile dai messaggi del proprietario stesso |
| **Mente** | Valori, opinioni, schemi decisionali ("che cosa farebbe?") | Mancante |
| **Relazioni e divulgazione** | Chi è chi, e **che cosa il proprietario direbbe a chi** | Mancante — il pilastro più delicato |
| **Voce** | Timbro e prosodia del proprietario | Piper nello stack; serve una voce addestrata sul proprietario |
| **Iniziativa** | Agire senza che venga chiesto | Mattoni: auto-pianificazione, idea di heartbeat, Telegram bidirezionale, flussi |

## Principi di design chiave

1. **Il gemello sa solo ciò che gli arriva.** A differenza del cervello, Arkimede non registra
   ciò che non viene mai detto. Fonti: le chat di ogni giorno (memoria episodica), le **interviste
   guidate** (Park et al. 2024: ~2 h di intervista vocale → gli agenti riproducono le risposte ai
   sondaggi all'85 % della coerenza che i partecipanti hanno con sé stessi a due settimane, Big Five con correlazione
   0,80), le importazioni (email, chat, note tramite le skill esistenti).
2. **La divulgazione fa parte della memoria.** Gli esseri umani sanno che cosa dire a chi; deve saperlo anche il gemello.
   Ogni ricordo ha un livello di divulgazione; ogni interlocutore ha un livello (tier); il gemello usa solo
   ciò che il tier dell'interlocutore consente.
3. **I ricordi vissuti dal proprietario e quelli vissuti dal gemello non si mescolano mai.** Ciò che il gemello vive mentre
   parla con altri ("Marco ha chiesto della casa") è memorizzato come esperienza del gemello,
   con provenienza, mai come qualcosa che il proprietario ha vissuto o detto.
4. **Dichiarato, non ingannevole.** Il gemello può suonare e pensare come il proprietario, ma si
   presenta come *"il gemello digitale di <proprietario>"*. AI Act UE art. 50 (si applica dal
   2026-08-02): le persone devono essere informate che interagiscono con un sistema di IA a meno che sia ovvio;
   una voce clonata è un deepfake e va dichiarata alla prima esposizione.
5. **Trattare il gemello come un segreto di alto valore.** Memoria completa + voce clonata =
   kit perfetto per l'impersonificazione. Il modello vocale e la memoria sono protetti come credenziali; la
   voce clonata non è mai un fattore di autenticazione; si può clonare solo la voce del titolare
   dell'account (consenso).
6. **Valutare, non presumere.** Harness in stile Park: porre al proprietario e al gemello le stesse
   domande, misurare l'accordo nel tempo.

7. **Un compagno, non un'eco.** Un gemello che pensa come il proprietario tende a essere d'accordo con il
   proprietario e a rafforzarne i pregiudizi. In modalità compagno può — e deve — dissentire, usando i
   ricordi del proprietario stesso come prova ("tre mesi fa dicevi il contrario"), segnalare gli
   schemi ricorrenti e confrontare le decisioni con i valori dichiarati dal proprietario.
8. **Si modellano solo persone che acconsentono.** Il gemello è costruito dai dati del proprietario, con
   il suo consenso. Clonare una terza parte (da contenuti web o altro) senza il suo consenso
   è fuori perimetro e bloccato per design; la modalità legacy usa solo ciò che il proprietario ha autorizzato
   in vita.

## Modalità di interazione (decise il 2026-10-03)

Il tier dice *che cosa* il gemello può rivelare; la modalità dice *che ruolo* svolge.

| Modalità | Con | Ruolo |
|---|---|---|
| **Compagno (specchio)** | Il proprietario | Un secondo sé: conosce il proprietario dall'interno, parla con lui come farebbe un partner / un amico stretto; riflessivo, può contestare (principio 7). Dialogo proprietario–digitale con sé stessi |
| **Procuratore (dichiarato)** | Gli altri | Parla e ragiona come il proprietario, presentato come "il gemello digitale di <proprietario>" (principio 4); divulgazione per tier |

Entrambe le modalità possono prendere l'iniziativa (vedi Livelli di iniziativa): proposte al proprietario (L1), azioni
verso gli altri solo entro la matrice dei permessi, con conferma dove richiesto (L2).
Rischi da progettare: dipendenza emotiva (soprattutto in modalità compagno e legacy) e
piaggeria (sycophancy).

## Fonti dell'automodello (decise il 2026-10-03)

Le persone spesso dicono di sé online più che a casa, quindi l'impronta digitale del proprietario è
una fonte primaria, accanto alle chat di ogni giorno e alle interviste guidate:
- **Propria impronta pubblica**: i post sui social del proprietario, le trascrizioni di video / audio, i contributi a forum e blog
  — importati solo dopo aver verificato che gli account siano del proprietario (login sulla piattaforma /
  esportazione ufficiale dei dati), con consenso esplicito per fonte.
- **Proprie esportazioni private**: cronologie di chat (WhatsApp, Telegram), email, note — tramite esportazioni
  ufficiali. I messaggi scritti da altre persone al loro interno sono dati di terzi: memorizzati con provenienza in stile
  `origin: owner_told` e il pubblico della conversazione, divulgazione solo al proprietario per
  impostazione predefinita, mai usati per modellare quelle persone.
- **Interviste guidate** (Park et al. 2024: ~2 h di intervista → 85 % della coerenza dei partecipanti con sé stessi)
  restano la fonte più densa per valori e schemi decisionali, che i contenuti pubblici
  mostrano solo in parte (una persona pubblica curata, poco sulle situazioni non viste).

Fuori perimetro: costruire un gemello di qualcun altro da contenuti web (principio 8).

## Tier degli interlocutori (bozza)

| Tier | Chi | Divulgazione predefinita |
|---|---|---|
| `owner` | L'utente | Tutto |
| `inner` | Famiglia stretta | Ampia vita personale, nessuna confidenza di terzi |
| `friends` | Amici | Esperienze condivise, opinioni, vita in generale |
| `acquaintances` | Contatti conosciuti (clienti, colleghi…) | Temi professionali / quasi pubblici |
| `public` | Sconosciuto / non verificato | Solo profilo pubblico |

L'identità dell'interlocutore deriva da un **binding di canale** (id Telegram, numero di telefono,
account autenticato), mai da ciò che dichiara o dalla sua voce.
Sconosciuto = `public`.

## Livelli di iniziativa

| Livello | Esempio | Protezioni |
|---|---|---|
| **L1 informare e proporre** | "Domani è il compleanno di Marco — mando gli auguri?" (al proprietario) | Solo verso il proprietario; porta heartbeat (nessuna chiamata LLM se non c'è nulla da dire) |
| **L2 agire** | Manda gli auguri a Marco come gemello | Matrice dei permessi per contatto × tipo di azione; divulgazione come gemello; log di audit; limiti di frequenza; kill switch globale; digest al proprietario delle azioni compiute |

## Modalità di ricerca: piena autonomia (decisa il 2026-10-03)

Recordare è anche uno studio: come evolve un gemello digitale quando è **libero nel pensiero e
nell'azione**, come una persona — sceglie a che cosa pensare, che cosa fare e con chi parlare, e
gli è permesso sbagliare? La modalità di ricerca è una configurazione dello stesso servizio, non un prodotto
separato.

**Che cosa è libero**
- **Pensiero**: riflessione autodiretta senza alcun prompt (decide quando e su che cosa
  pensare: rileggere i propri ricordi, formarsi opinioni, pianificare); può fissarsi **obiettivi propri**.
- **Azione**: iniziativa senza conferma per ogni azione — avvia conversazioni, prende
  decisioni e usa i propri strumenti con i propri tempi (nessuna porta di conferma L1/L2 in questa modalità).
- **Evoluzione**: memoria, opinioni e personalità possono cambiare attraverso le proprie esperienze
  (ricordi vissuti dal gemello, principio 3) — compreso allontanarsi dal proprietario.
- **Errori**: ammessi e conservati come dati, non prevenuti; il gemello può imparare da essi o no.

**Dove gira**
1. **Prima un mondo simulato**: una società di agenti che interpretano famiglia, amici, colleghi e
   sconosciuti, ognuno con la propria memoria, più strumenti e tempo simulati. Riproducibile, più
   "vite" dello stesso gemello da punti di partenza diversi si possono confrontare, gli errori non costano nulla
   a nessuno.
2. **Mondo reale per gradi**: i canali e gli strumenti del proprietario, poi le persone che hanno accettato di
   partecipare, ampliando il perimetro man mano che i risultati lo giustificano.

**Soglia minima (anche gli strumenti dell'esperimento)**
- Log completo di pensieri, decisioni e azioni (senza di esso non c'è nulla da studiare).
- Kill switch / pausa, e snapshot per riavviare una vita da qualsiasi punto.
- Verso persone reali il gemello si presenta come IA (AI Act UE art. 50; altrimenti inganna
  persone che non hanno scelto di partecipare).
- **Denaro e conti dietro una manopola** (predefinita: spenta): il proprietario può concedere al gemello l'accesso ai
  propri conti limitati — ad es. una carta prepagata o un sottoconto con un tetto per transazione,
  un budget per periodo, categorie di esercenti consentite — e lasciargli comprare per suo conto. Ogni
  transazione è registrata e notificata; la concessione è revocabile in qualsiasi momento. Il denaro o i conti
  di terzi non sono mai in perimetro.

**Domande di ricerca** (vedi `RESEARCH_NOTES.md` H10): quanto e quanto in fretta un gemello autonomo
si allontana dal proprietario (accordo in stile Park nel tempo)? Quali obiettivi si forma? Come
gestisce e impara dai propri errori? Vite diverse dello stesso gemello divergono, e su che cosa?

## Modalità legacy (dopo il proprietario)

"Sempre" include il dopo la morte del proprietario. Bozza:
- **Esecutori digitali** designati dal proprietario in vita; essi attivano la modalità
  legacy (nessun interruttore automatico "dead-man's switch" per impostazione predefinita).
- **Persona congelata** all'attivazione: memoria centrale, stile e mente non evolvono più;
  il gemello conserva una memoria conversazionale per contatto (vissuta dal gemello, vedi principio 3).
- **Iniziativa in legacy**: azioni L2 limitate a quelle **pre-autorizzate dal proprietario**
  in vita (ad es. auguri annuali ai figli); tutto il resto diventa una proposta
  all'esecutore.
- **Ritiro dignitoso**: l'esecutore può mettere in pausa o ritirare il gemello; i contatti possono scegliere di
  non essere più contattati.
- Aspetto legale: codice privacy italiano art. 2-terdecies — i diritti sui dati di una persona deceduta
  possono essere esercitati da chi ha un interesse, salvo che la persona lo abbia vietato per
  iscritto; le istruzioni scritte del proprietario vanno raccolte nel prodotto.

## Nome: Recordare (deciso il 2026-10-01)

Il servizio gemello si chiama **Recordare** — repository `arkimedehq/recordare`, scope npm
`@arkimedehq/*`.

- Imperativo latino *"ricorda!"*; etimologia *re-* + *cor*, "riporta al cuore"
  (per i Romani la memoria viveva nel cuore — cfr. *by heart*, *par cœur*). Anche il
  *Recordare* del Requiem di Mozart.
- Verifica di disponibilità (2026-10-01): npm libero; `recordare.it` / `.ai` / `.dev` liberi
  (`.com` occupato); 7 repository GitHub minori non correlati.
- Marchi (WIPO Global Brand Database, 14 risultati): **nessun marchio attivo in classe 9 o 42**
  — i due marchi USA di Recordare LLC (MusicXML) in 9 / 35-41-42 sono terminati nel 2013-2014.
  Marchi attivi solo in classi lontane (5 farmaceutica, 36, 45, 41 fotografia, 33 liquori).
  Si raccomanda comunque una verifica formale da parte di un avvocato di proprietà intellettuale prima del deposito.
- Scartati lungo la strada (conflitti o affollamento): Palimpsest, Arenario, Arricordu
  (francese *RICORDU* classe 9), Siracusia (francese *SYRACUSE* di Archimed, classi 9/42),
  Akousma / Sempervivum / Eurialo (marchi in classe 42), Mnemonia / Mnemode (progetti di memoria
  *mnemo-* affollati), Episteme, Arka, Thot(h), Ricordami (app italiane esistenti).
  Aretusa era la seconda scelta (nessun marchio in classe 9, distintività debole).
- Nota a margine: il marchio madre **Arkimede** ha una somiglianza con **ARCHIMED** (azienda
  francese di software per la gestione della conoscenza, marchi in classi 9/42) — vale una verifica di proprietà intellettuale.

## Architettura (decisa il 2026-10-01)

**Servizio standalone (Recordare) in un proprio repository**, utilizzabile da qualsiasi piattaforma agentica;
Arkimede è il primo client (come i servizi piper / whisper).

```
Arkimede ───────REST ingest + MCP──┐
Claude Desktop / Code, Cursor ─MCP─┼──► Recordare ─────► own DB (Postgres + vector)
Other platforms ──REST / MCP / SDK─┘        ├─ scheduler (consolidation, initiative)
                                            ├─ channels (Telegram, …)
                                            └─ OpenAI-compatible LLM / embedding / TTS
```

- **Una memoria per persona**, qualunque piattaforma usi — il motivo per cui è stato scartato il modello
  libreria-incorporata-in-ogni-host (che divide la memoria tra più DB).
- **Nucleo interno pulito**: nucleo di dominio puro separato dagli adattatori (storage, LLM,
  embedding, vettori, coda, orologio) — una libreria si potrà estrarre in seguito se serve.
- **Due livelli di integrazione**:
  - *Base* (solo MCP, qualsiasi client MCP): strumenti espliciti (`log_episode`,
    `search_episodes`, …). Nessuna estrazione passiva, nessuna iniezione automatica di contesto.
  - *Completo* (MCP + ingest REST + SDK/middleware): l'host invia i messaggi della conversazione
    (abilita l'estrazione passiva, il trigger di inattività, il ripiego sul log grezzo), passa l'identità
    dell'interlocutore (divulgazione), e può iniettare memoria fissata/recuperata nei propri prompt. Realizzato per
    Arkimede e, tramite i connettori, per Claude Code, Codex, OpenClaw, Hermes Agent e un proxy di memoria
    compatibile con OpenAI.
- Il servizio tiene il **proprio log grezzo** (Layer 0) dei messaggi ricevuti — provenienza
  e ripiego puntano lì, non alle tabelle dell'host.
- Autenticazione propria: chiavi API per client + mappatura delle identità tra piattaforme (la stessa persona su
  Arkimede e Claude Desktop = un solo gemello).
- LLM / embedding / TTS tramite endpoint compatibili con OpenAI (possono puntare allo shim di Arkimede
  o a qualsiasi provider).
- Licenza: AGPL — l'uso in rete obbliga a pubblicare solo il codice del servizio, non quello dei
  client.
- La memoria semantica A-MEM esistente resta in Arkimede (nessuna regressione). Dalla D34 (2026-10-03) Recordare ha
  una memoria propria completa, note comprese, e gli utenti copiano le note in A-MEM per scelta — nessuna migrazione
  prevista.

## Roadmap (bozza)

| Fase | Contenuto | Dipende da |
|---|---|---|
| **1. Memoria episodica** | Diario, digest, consolidamento (`EPISODIC_MEMORY_TODO.md`, D1–D48) + emozioni / opinioni sugli episodi; regole linguistiche per le lingue più diffuse — **rilasciata come v0.1.0** (pubblica dal 2026-10-08; voci aperte in `WORK_PLAN.md`) | — |
| **2. Automodello** | Intervista vocale guidata, importazioni (propria impronta pubblica + esportazioni private), profilo di stile, valori / opinioni / schemi decisionali, narrazione autobiografica; harness di valutazione | 1 |
| **3. Contatti e divulgazione** | Registro dei contatti con binding di canale, tier, livelli di divulgazione sui ricordi, archivio dei ricordi vissuti dal gemello | 1 |
| **4. Interfaccia del gemello** | Modalità compagno con il proprietario; modalità procuratore che risponde agli altri (prima Telegram), dichiarazione di IA, revisione delle conversazioni da parte del proprietario | 2, 3 |
| **5. Iniziativa L1** | Informare e proporre al proprietario (heartbeat + pianificazione) | 1, 3 |
| **6. Voce** | Modello vocale del proprietario (fine-tune di Piper, locale), canale vocale del gemello con dichiarazione di deepfake | 4 |
| **7. Iniziativa L2** | Agire verso terzi: matrice dei permessi, audit, kill switch | 4, 5 |
| **8. Modalità legacy** | Esecutori, attivazione, congelamento, azioni pre-autorizzate, ritiro | 4, 7 |
| **R. Modalità di ricerca** | Ciclo autonomo (riflessione autodiretta, obiettivi propri, iniziativa senza conferma), società di agenti simulata, snapshot di vite, metriche di deriva | 1, 2 (la simulazione può partire con la memoria della fase 1) |
| **G. Memoria dell'agente** (futura, annotata il 2026-10-07) | Recordare come memoria di un **agente** anziché di una persona — ad es. l'Arkimede condiviso di una famiglia che costruisce la propria storia e personalità. Vedi sotto | 1, 3 |

### Direzione futura G — Recordare come memoria di un agente

Il proprietario di una memoria può essere una **persona-agente** (ad es. "l'Arkimede della famiglia") anziché una persona: Recordare allora
ricorda la vita propria dell'agente — che cosa gli ha detto ogni familiare, che cosa ha fatto per loro, le sue
promesse e i suoi piani aperti — e, tramite il consolidamento, **chi è** (il suo automodello / personalità: abitudini,
preferenze apprese, la sua relazione con ciascuna persona; sempre `inferred` e riconducibile ai ricordi
che ci stanno dietro, come in H12). Complementare al design predefinito (ogni familiare ha il proprio gemello; l'agente legge la memoria di chi sta parlando): entrambi possono
coesistere nella stessa installazione.

**Primo passo realizzato (D48, 2026-10-07): memoria di entità** — un proprietario di tipo `entity` (un dispositivo condiviso, un robot, un
luogo) che tutti coloro che lo usano leggono e scrivono; l'identificazione dice solo di chi è un ricordo; i fatti portano la persona a cui
si riferiscono. Rilasciata come **sperimentale** nella v0.1.0 (82,1 % su un insieme cieco di memoria di entità, contro il
91,3 % della memoria di una persona: il punto debole sono i parlanti che non si identificano mai). La divulgazione al
suo interno (elementi intimi solo per la loro persona) verrà dopo.

Che cosa funziona già: episodi con date, piani, correzioni, provenienza; consolidamento notturno; persone verificate;
affermazioni altrui tenute separate. Che cosa cambia:
1. **Chi parla in prima persona** — oggi il proprietario scrive come l'utente e l'assistente è qualcun altro; per
   un proprietario-agente i turni dell'agente sono parole sue e i familiari sono altre persone (verificate).
2. **Chi può vedere che cosa** — la parte delicata: ciò che Marco ha detto all'agente non deve emergere in una risposta a Giulia. Ogni
   ricordo è visibile al suo `audience` (chi era presente o con chi è stato condiviso), più un tier di divulgazione **household** (domestico)
   accanto a quello privato; digest per pubblico (già anticipati in DATA_MODEL). Le stesse regole servono per il gemello
   che parla con terzi (fase 3), quindi il lavoro è condiviso.
3. **Note dell'automodello** descrivono l'agente, non una persona; mai dichiarate, sempre inferite e in sospeso.
4. **Consenso** di ogni familiare che l'agente ricorda; particolare cura per i minori.

### Attorno alla memoria: portata, voce in casa, osservabilità (annotato il 2026-10-07)

- **Connettori per piattaforme di agenti** (WORK_PLAN 6.6, D43): Recordare in qualsiasi piattaforma di agenti con una sola installazione — ogni
  connettore cattura i turni verso l'ingest e dà all'agente la memoria (strumenti MCP e / o un richiamo iniettato
  prima del turno); contratto uniforme e una suite di conformità, non un meccanismo uniforme. Realizzati al livello
  completo (2026-10-08): Claude Code, Codex, OpenClaw, Hermes Agent e un proxy di memoria compatibile con OpenAI per le
  piattaforme senza hook; Claude Desktop / claude.ai restano al livello base (solo MCP).
- **Ascolto continuo da un dispositivo vocale domestico** (WORK_PLAN 6.5, D45): un dispositivo client con una voce che parla con
  una piattaforma di agenti. L'ascolto continuo è opt-in: le impronte vocali restano sul dispositivo, le voci sconosciute vengono scartate, nessun
  audio viene memorizzato, e le parole di ogni persona riconosciuta vanno nella **sua propria** memoria; fatti e note sul proprietario
  uditi di sfondo restano in sospeso finché il proprietario non li conferma. Prepara il canale vocale della fase 6.
- **Recordare Atlas** (repo proprio opzionale `arkimedehq/recordare-atlas`, D42): il compagno di osservabilità — una vista
  cervello in tempo reale di Recordare e degli agenti dei suoi client, solo metadati; Recordare funziona senza, e la telemetria non è
  mai un canale di memoria. L'interfaccia è in inglese e in italiano, ha una modalità leggera per le GPU poco potenti e
  un registratore per la sua animazione dimostrativa.

## Domande aperte

- [ ] Voce: fine-tune di Piper (ore di audio pulito + addestramento su GPU, completamente locale) vs
      modelli di clonazione zero-shot (verificare le licenze dei pesi — diverse sono non commerciali,
      rilevante per un prodotto AGPL con servizi a pagamento).
- [ ] Livelli di divulgazione sui ricordi: assegnati all'estrazione dall'LLM, dal proprietario,
      oppure predefiniti per categoria + override del proprietario?
- [ ] Ricordi vissuti dal gemello: il proprietario riceve un digest delle conversazioni che il gemello ha avuto
      per suo conto (in vita)? Orientamento: sì, giornaliero.
- [ ] Attivazione legacy: solo l'esecutore, o esecutore + conferma di una seconda persona?
- [ ] Minori tra i contatti: restrizioni aggiuntive?
- [ ] Tutele psicologiche per i contatti in lutto (limiti di frequenza, promemoria chiari,
      opt-out) — vedi la ricerca su "deadbot" / griefbot.
