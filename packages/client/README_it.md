# @arkimedehq/recordare-client

*Versione inglese (di riferimento): [README.md](README.md).*

> Da D50 (2026-10-09) Recordare non ha un flag di consenso: ogni memoria conserva ciò che il suo client invia;
> l'interruttore acceso / spento appartiene alla piattaforma client (WORK_PLAN 8.1).

L'unica libreria client che ogni client di Recordare usa (WORK_PLAN 6.7): identità, l'interruttore acceso / spento della piattaforma, impostazioni della
persona, ingest, modifiche e cancellazioni, richiamo via MCP e la politica di consegna per l'outbox dell'host. È
costruita sugli standard, così è l'host ad adattarsi: MCP con l'SDK ufficiale (streamable HTTP), errori come problem
details RFC 9457, `Retry-After` (RFC 9110) rispettato, contesto di traccia W3C inoltrato, `fetch` nativo (l'host può
passarne una sua, ad esempio con una politica sugli host in uscita). Nessun codice specifico di un host.

Su npm da Recordare v0.1.0: `npm install @arkimedehq/recordare-client` (Node ≥ 20, modulo ES).

```ts
import { PersonDirectory, RecordareClient, afterFailure } from '@arkimedehq/recordare-client';

const rc = new RecordareClient({ baseUrl: 'http://recordare:8080', apiKey: process.env.RECORDARE_API_KEY!,
  headers: () => traceHeaders() });                       // es. propagation.inject di OpenTelemetry

// Chi è l'utente, il tipo di memoria e l'indirizzo di Atlas; il nome segue il profilo sulla piattaforma. `enabled` è
// l'interruttore della memoria della piattaforma: finché è false Recordare non viene contattato (niente consenso, D50).
const people = new PersonDirectory(rc, { user: async (id) => ({ enabled: true, name: 'Andrea' }) });
const person = await people.refresh('user-42');           // { ownerId, kind, atlasUrl }; peek() legge la cache

// Ingest (diviso in richieste da 500, idempotente su ogni externalId): → { conversationId, accepted, duplicates, conflicts }.
await rc.ingest('user-42', { conversation: { externalId: 'chat-1' }, messages: [
  { externalId: 'm1', role: 'user', content: 'Domani vado a Bologna', sentAt: new Date().toISOString() },
] });

// Richiamo: una sessione MCP per utente E conversazione (il contesto di chi vede), entrambi fissati nel codice.
const tools = await rc.mcp.listTools('user-42', 'chat-1'); // gli strumenti dell'agente nascono da questi schemi
const res = await rc.mcp.callTool('user-42', 'chat-1', 'search_episodes', { query: 'Bologna' });

// Outbox: prima salva nella tua transazione, invia in background, dopo un errore chiedi alla politica.
const next = afterFailure(err, attempts);                 // { action: 'retry', delayMs } | { action: 'park', reason }
```

## Prima di ogni turno, e alla fine
`contextWithTurn(user, turn)` salva il turno e restituisce il suo contesto di memoria in una sola andata e ritorno
(`{block, items}`, il blocco da aggiungere in coda al prompt di sistema; `context(user, conversation, query)` quando il
turno è già salvato); `endConversation(user, conversation)` dice a
Recordare che una conversazione è finita (sessione chiusa, /new), così l'estrazione parte subito. `TOOLS` contiene gli
schemi degli strumenti MCP che il servizio offre (nome, titolo, descrizione, JSON Schema), per gli host che devono
dichiarare gli strumenti prima di collegarsi; la suite di conformità li tiene allineati al servizio.

## Il diario
`episodes`, `episode`, `digests`, `facts`, `notes`, `plans` leggono ciò che Recordare ricorda, per la vista della persona
nell'interfaccia della piattaforma; `correctEpisode`, `forgetEpisode`, `pinNote`, `delete`, `decide` sono le modifiche
della persona (API.md §4).

## Cosa resta all'host
Come conserva la sua outbox (il suo database, la sua transazione) e come trasforma le sue chat nel contratto di
ingest. Tutto il resto è qui, uguale per ogni client.

## Conformità
`service/test/conformance` esegue questa libreria contro il servizio vero nella CI di Recordare: un turno salvato una
volta sola, le cancellazioni si propagano, nome e tipo seguono la piattaforma, il
richiamo via MCP porta l'utente e la conversazione. I controlli di tipo lì fanno fallire la build se questo contratto si
allontana dagli schemi del servizio.

## Copia sincronizzata (Arkimede)
Arkimede usa ancora una copia dei sorgenti invece del pacchetto npm: `scripts/sync-to.sh <dir>` copia i sorgenti nel
repository dell'host con un'intestazione che indica il commit di origine (Arkimede: `backend/src/recordare/client/`).
L'host non li modifica mai; si cambia la libreria qui e si sincronizza di nuovo. Passare al pacchetto npm cambia solo
gli import.

## Sviluppo
`npm ci`, `npm run typecheck`, `npm test`, `npm run build` (Node ≥ 20).
