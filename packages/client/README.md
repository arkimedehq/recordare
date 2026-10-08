# @arkimedehq/recordare-client

*Italian version: [README_it.md](README_it.md).*

The one client library every Recordare client uses (WORK_PLAN 6.7): identity and consent, the person's settings,
ingest, edits and deletions, recall over MCP, and the delivery policy for a host's outbox. Built on standards, so a
host adapts to them: MCP through the official SDK (streamable HTTP), errors as RFC 9457 problem details,
`Retry-After` (RFC 9110) honoured, W3C trace context forwarded, native `fetch` (a host may pass its own, e.g. one
enforcing an outbound-host policy). No host-specific code.

On npm since Recordare v0.1.0: `npm install @arkimedehq/recordare-client` (Node ≥ 20, ES module).

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

## Before each turn, and at the end
`contextWithTurn(user, turn)` stores the turn and returns its memory context in one round trip (`{block, items}`, the
block to append to the system prompt; `context(user, conversation, query)` when the turn is already stored); `endConversation(user, conversation)` tells Recordare a conversation ended
(session closed, /new) so extraction runs now. `TOOLS` holds the MCP tool schemas the service serves (name, title,
description, JSON Schema), for hosts that must declare tools before connecting; the conformance suite keeps it in
sync with the service.

## The diary
`episodes`, `episode`, `digests`, `facts`, `notes`, `plans` read what Recordare remembers for the person's own view in
the platform's UI; `correctEpisode`, `forgetEpisode`, `pinNote`, `delete`, `decide` are the person's edits (API.md §4).

## What stays with the host
How it stores its outbox (its own database, its own transaction) and how it maps its chats to the ingest contract.
Everything else is here, the same for every client.

## Conformance
`service/test/conformance` runs this library against the real service in Recordare's CI: a turn ingested once,
nothing stored before consent, deletions propagate, the name and kind follow the platform, recall over MCP carries the
user and the conversation. Type checks there fail the build when this contract drifts from the service's schemas.

## Synced copy (Arkimede)
Arkimede still uses a copy of the sources instead of the npm package: `scripts/sync-to.sh <dir>` copies them into a
host repository with a header naming the source commit (Arkimede: `backend/src/recordare/client/`). The host never
edits them; change the library here and sync again. Switching to the npm package only changes the imports.

## Development
`npm ci`, `npm run typecheck`, `npm test`, `npm run build` (Node ≥ 20).
