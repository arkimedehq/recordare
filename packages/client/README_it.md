# @arkimedehq/recordare-client

*Versione inglese (di riferimento): [README.md](README.md).*

L'unica libreria client che ogni client di Recordare usa (WORK_PLAN 6.7): identità e consenso, impostazioni della
persona, ingest, modifiche e cancellazioni, richiamo via MCP e la politica di consegna per l'outbox dell'host. È
costruita sugli standard, così è l'host ad adattarsi: MCP con l'SDK ufficiale (streamable HTTP), errori come problem
details RFC 9457, `Retry-After` (RFC 9110) rispettato, contesto di traccia W3C inoltrato, `fetch` nativo (l'host può
passarne una sua, ad esempio con una politica sugli host in uscita). Nessun codice specifico di un host.

```ts
import { PersonDirectory, RecordareClient, afterFailure } from '@arkimedehq/recordare-client';

const rc = new RecordareClient({ baseUrl: 'http://recordare:8080', apiKey: process.env.RECORDARE_API_KEY!,
  headers: () => traceHeaders() });                       // es. propagation.inject di OpenTelemetry

// Chi è l'utente, il suo consenso, il tipo di memoria e l'indirizzo di Atlas; il nome segue il profilo sulla piattaforma.
const people = new PersonDirectory(rc, { user: async (id) => ({ enabled: true, name: 'Andrea' }) });
await people.status('user-42');                           // 'active' | 'waiting_activation' | 'unknown'

// Ingest (diviso in richieste da 500, idempotente su ogni externalId). Prima del consenso non si conserva nulla.
await rc.ingest('user-42', { conversation: { externalId: 'chat-1' }, messages: [
  { externalId: 'm1', role: 'user', content: 'Domani vado a Bologna', sentAt: new Date().toISOString() },
] });

// Richiamo: una sessione MCP per utente E conversazione (il contesto di chi vede), entrambi fissati nel codice.
const tools = await rc.mcp.listTools('user-42', 'chat-1'); // gli strumenti dell'agente nascono da questi schemi
const res = await rc.mcp.callTool('user-42', 'chat-1', 'search_episodes', { query: 'Bologna' });

// Outbox: prima salva nella tua transazione, invia in background, dopo un errore chiedi alla politica.
const next = afterFailure(err, attempts);                 // { action: 'retry', delayMs } | { action: 'park', reason }
```

## Cosa resta all'host
Come conserva la sua outbox (il suo database, la sua transazione) e come trasforma le sue chat nel contratto di
ingest. Tutto il resto è qui, uguale per ogni client.

## Conformità
`service/test/conformance` esegue questa libreria contro il servizio vero nella CI di Recordare: un turno salvato una
volta sola, nulla conservato prima del consenso, le cancellazioni si propagano, nome e tipo seguono la piattaforma, il
richiamo via MCP porta l'utente e la conversazione. I controlli di tipo lì fanno fallire la build se questo contratto si
allontana dagli schemi del servizio.

## Host che non possono ancora installare il pacchetto
Recordare non è pubblicato: `scripts/sync-to.sh <dir>` copia i sorgenti nel repository dell'host con un'intestazione che
indica il commit di origine (Arkimede: `backend/src/recordare/client/`). L'host non li modifica mai; si cambia la
libreria qui e si sincronizza di nuovo. Quando Recordare sarà pubblicato l'host passerà al pacchetto npm cambiando solo
gli import.

## Sviluppo
`npm ci`, `npm run typecheck`, `npm test`, `npm run build` (Node ≥ 20).
