# @arkimedehq/recordare-client

*Italian version: [README_it.md](README_it.md).*

The one client library every Recordare client uses (WORK_PLAN 6.7): identity and consent, the person's settings,
ingest, edits and deletions, recall over MCP, and the delivery policy for a host's outbox. Built on standards, so a
host adapts to them: MCP through the official SDK (streamable HTTP), errors as RFC 9457 problem details,
`Retry-After` (RFC 9110) honoured, W3C trace context forwarded, native `fetch` (a host may pass its own, e.g. one
enforcing an outbound-host policy). No host-specific code.

```ts
import { PersonDirectory, RecordareClient, afterFailure } from '@arkimedehq/recordare-client';

const rc = new RecordareClient({ baseUrl: 'http://recordare:8080', apiKey: process.env.RECORDARE_API_KEY!,
  headers: () => traceHeaders() });                       // e.g. OpenTelemetry propagation.inject

// Who the user is, their consent, kind of memory and Atlas address; the name follows the platform's profile.
const people = new PersonDirectory(rc, { user: async (id) => ({ enabled: true, name: 'Andrea' }) });
await people.status('user-42');                           // 'active' | 'waiting_activation' | 'unknown'

// Ingest (split into requests of 500, idempotent on each externalId). Nothing is stored before consent.
await rc.ingest('user-42', { conversation: { externalId: 'chat-1' }, messages: [
  { externalId: 'm1', role: 'user', content: 'Domani vado a Bologna', sentAt: new Date().toISOString() },
] });

// Recall: one MCP session per user AND conversation (the viewer context), both bound in code.
const tools = await rc.mcp.listTools('user-42', 'chat-1'); // build the agent's tools from these schemas
const res = await rc.mcp.callTool('user-42', 'chat-1', 'search_episodes', { query: 'Bologna' });

// Outbox: store first in your own transaction, send in the background, ask the policy after a failure.
const next = afterFailure(err, attempts);                 // { action: 'retry', delayMs } | { action: 'park', reason }
```

## What stays with the host
How it stores its outbox (its own database, its own transaction) and how it maps its chats to the ingest contract.
Everything else is here, the same for every client.

## Conformance
`service/test/conformance` runs this library against the real service in Recordare's CI: a turn ingested once,
nothing stored before consent, deletions propagate, the name and kind follow the platform, recall over MCP carries the
user and the conversation. Type checks there fail the build when this contract drifts from the service's schemas.

## Hosts that cannot install the package yet
Recordare is not published: `scripts/sync-to.sh <dir>` copies the sources into a host repository with a header naming
the source commit (Arkimede: `backend/src/recordare/client/`). The host never edits them; change the library here and
sync again. When Recordare is published the host switches to the npm package by changing its imports.

## Development
`npm ci`, `npm run typecheck`, `npm test`, `npm run build` (Node ≥ 20).
