# Collaborative Memory: Multi-User Memory Sharing in LLM Agents with Dynamic Access Control (Rezazadeh, Li, Lou, Zhao, Wei, Bao, arXiv preprint cs.MA, May 2025, arXiv:2505.18279)
*Traduzione italiana di [collaborative-memory.md](collaborative-memory.md) — la versione inglese è quella di riferimento.*

Letto: l'intero HTML di arXiv (https://arxiv.org/html/2505.18279), recuperato tramite un estrattore da pagina a markdown con un prompt di estrazione dettagliato (non una lettura manuale dell'HTML grezzo; simboli e numeri sono quelli estratti); Codice: non rilasciato (nessun link a repository nella pagina arXiv)

## Problema
I sistemi LLM multi-utente e multi-agente traggono beneficio da una memoria condivisa persistente, ma i lavori esistenti sulla memoria assumono un singolo utente. Due sfide: asimmetria informativa (gli utenti raggiungono agenti e risorse diversi) e accesso dinamico (i permessi cambiano nel tempo). Domanda posta: come massimizzare l'utilità della memoria collettiva mentre la condivisione rispetta i permessi.

## Meccanismo (come funziona)
1. Utenti, agenti e risorse (strumenti, API, database) sono collegati da due grafi bipartiti di permessi variabili nel tempo.
2. Un LLM coordinatore riceve la query dell'utente, le stringhe di specializzazione degli agenti e la cronologia della conversazione, ed emette JSON {"agent": ID, "subquery": ...} oppure {"stop": true}.
3. Per ogni agente scelto, il recupero prende i top-k_user frammenti dal livello privato dell'utente più i top-k_cross dal livello condiviso tra utenti, per similarità coseno, limitati ai frammenti la cui provenienza soddisfa i permessi correnti.
4. La policy di lettura filtra i frammenti candidati (la versione semplice restituisce i frammenti ammissibili alla lettera); l'agente risponde dalla vista filtrata.
5. Dopo la risposta, vengono eseguite le policy di scrittura: una trasformazione basata su LLM scrive una versione per la memoria privata e una per la memoria condivisa nei rispettivi livelli.
6. Un aggregatore di risposte sintetizza le coppie (subquery, response) nella risposta finale.
7. Quando gli archi del grafo cambiano, i frammenti già memorizzati vengono ricontrollati rispetto al nuovo grafo in lettura usando la loro provenienza memorizzata (controllo retrospettivo dei permessi).

## Modello dati
- Insiemi: 𝒰 utenti, 𝒜 agenti, ℛ risorse.
- Grafi (Eq. 1): G𝒰𝒜(t) ⊆ 𝒰 × 𝒜 e G𝒜ℛ(t) ⊆ 𝒜 × ℛ.
- Accessibilità (Eq. 2-3): 𝒜(u,t) := {a | (u,a) ∈ G𝒰𝒜(t)}; ℛ(a,t) := {r | (a,r) ∈ G𝒜ℛ(t)}.
- Accesso ai frammenti: ℳ(u,a,t) := {m ∈ ℳ | 𝒜(m) ⊆ 𝒜(u,t) ∧ ℛ(m) ⊆ ℛ(a,t)}.
- Provenienza immutabile per frammento m: 𝒯(m) timestamp di creazione, 𝒰(m) utente di origine, 𝒜(m) agenti contributori, ℛ(m) risorse consultate durante la creazione.
- Livelli: ℳ = ℳ^private ∪ ℳ^shared; ℳ^private(u,t) è isolato a un solo utente; ℳ^shared(a,t) è limitato all'agente e accessibile tra utenti secondo i permessi.
- Policy: π^read_{u,a,t}; π^{write/private}_{u,a,t} e π^{write/shared}_{u,a,t} (Eq. 4-5). Istanziazioni: semplice (memorizza alla lettera) o trasformazione (redazione LLM, anonimizzazione, parafrasi). Livelli di granularità: π^global, π^u, π^a, π^t (sistema, per utente, per agente, temporale).
- I frammenti sono coppie chiave-valore generate dall'LLM annotate con la provenienza. Nota che il test di accesso riguarda gli agenti e le risorse contributori del frammento, non il contenuto del frammento né un pubblico per frammento; l'utente di origine 𝒰(m) è registrato ma la formula citata per ℳ(u,a,t) non lo usa direttamente (lo copre il livello privato).

## Uso dell'LLM
LLM: instradamento del coordinatore, codifica della memoria in frammenti chiave-valore, trasformazione della policy di scrittura (prompt privato e condiviso; il prompt condiviso dice di estrarre conoscenza generalmente applicabile e rimuovere i dettagli specifici dell'utente), gli agenti di dominio, l'aggregazione delle risposte (tutti GPT-4o; embedding text-embedding-3-large). Deterministici: i grafi dei permessi, le funzioni di accessibilità, il test di sottoinsieme sulla provenienza, il recupero top-k. L'applicazione della policy sul contenuto del livello condiviso si affida al fatto che l'LLM rediga correttamente.

## Valutazione
Metriche: accuratezza, utilizzo degli agenti (agenti distinti per query), utilizzo delle risorse (chiamate a KB/API per query). Nessuna metrica di perdita.
- Scenario 1, pienamente collaborativo: MultiHop-RAG (609 articoli, 2.556 query, 6 agenti di dominio, 5 utenti, sovrapposizione 0/25/50/75%, k=10/10). Accuratezza sopra 0,90 ovunque; chiamate alle risorse ridotte del 61% con sovrapposizione al 50% e del 59% al 75% rispetto alla memoria isolata.
- Scenario 2, asimmetrico: 200 query di business sintetiche (100 facili, 100 difficili), 4 ruoli, 4 agenti, 4 risorse simulate, k=20/20; meno chiamate alle risorse rispetto all'isolato, nessuna ground truth quantitativa.
- Scenario 3, dinamico: SciQAG, 5 agenti, 5 utenti, 100 query, concessioni di archi Bernoulli poi revoche su 8 blocchi temporali. L'accuratezza sale con le concessioni e scende con la revoca; gli utenti raggiungono solo agenti e risorse concessi; l'uso delle risorse scende nel tempo grazie al riuso.
Baseline: solo memoria isolata (scenario 1).

## Limiti
Autori: benchmark e query sintetiche possono non riflettere l'uso reale; numeri moderati di utenti e agenti; gli LLM possono causare occasionali allucinazioni o violazioni di policy nonostante l'applicazione; l'utilizzo delle risorse è misurato solo come conteggio di chiamate. Non indicati: prove formali di sicurezza, limiti di scalabilità, costo della trasformazione LLM, confronto con altri sistemi di memoria.
Osservazioni nostre: l'obiettivo è l'efficienza e l'accuratezza sui compiti tra utenti cooperanti, non la protezione da un interlocutore avversario; nessun test di perdita, nonostante l'inquadramento come controllo degli accessi. L'unità di permesso è la capacità di agente/risorsa, che non corrisponde a "chi era nella conversazione". La sicurezza del livello condiviso dipende dalla redazione LLM. La revoca funziona solo perché i frammenti vengono ricontrollati in lettura; i frammenti condivisi derivati (redatti) che hanno già assorbito contenuto privato non vengono ritirati. Gli autori del paper 2608.17148 lo contrappongono come redazione + utilità del compito contro la loro esclusione.

## Implicazioni per Recordare
- (importante) Memorizzare provenienza immutabile su ogni unità di memoria (timestamp, persona/conversazione di origine, strumento/agente contributore, risorse toccate) e valutare i permessi in lettura rispetto alla policy corrente, non congelati in scrittura. È ciò che fa sì che concessioni e revoche (un amico declassato, la concessione di una persona rimossa) abbiano effetto senza riscrivere i dati; complementa l'insieme del pubblico in scrittura di 2608.17148 e si adatta a D28 (`origin`, id di origine, righe bi-temporali).
- (importante) Non usare la trasformazione LLM come controllo di sicurezza. Il loro livello condiviso si affida a un LLM per eliminare i dettagli specifici dell'utente; per noi la redazione può migliorare l'utilità, ma la divulgazione deve essere decisa da etichette deterministiche (D28 `disclosure`) prima del prompt. Se generiamo una "versione condivisibile" di un episodio, tenerla come elemento derivato separato con id di origine e una propria etichetta, mai come sostituzione.
- Privato/condiviso corrisponde alla nostra divisione solo-proprietario contro divulgabile, ma i nostri livelli sono graduati (proprietario/inner/amici/conoscenti/pubblico) e per persona, quindi una colonna booleana a due livelli non basta; mantenere l'etichetta graduata più la provenienza.
- Permessi variabili nel tempo: modellare le concessioni come dati con intervalli di validità (valid-from / valid-to), coerentemente con il nostro approccio bi-temporale, così che le domande di audit ("cosa poteva vedere questa persona alla data X") abbiano risposta.
- Mantenere le policy di scrittura configurabili a più granularità (globale, per persona, per canale, per tempo) come in π^global/π^u/π^a/π^t, ma solo come configurazione, non come percorsi di codice (profili in stile D27).
- Log di audit: registrare quali frammenti sono stati ammessi in quale prompt (id conversazione, spettatore, versione della policy). Utile per la valutazione H2 e per la revisione retroattiva.
- Evitare: test dei permessi solo sulla provenienza agente/risorsa (manca la dimensione "chi era presente": abbinarlo all'insieme del pubblico); assenza di metriche di perdita; trattare i guadagni di efficienza dal riuso tra utenti come un obiettivo, dato che un twin dovrebbe condividere meno per default.
