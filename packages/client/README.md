# @arkimedehq/recordare-client

*Italian version: [README_it.md](README_it.md).*

> Since D50 (2026-10-09) Recordare has no consent flag: every memory stores what its client sends; the on/off switch
> belongs to the client platform (WORK_PLAN 8.1).

The one client library every Recordare client uses (WORK_PLAN 6.7): identity, the platform's on/off switch, the person's settings,
ingest, edits and deletions, recall over MCP, and the delivery policy for a host's outbox. Built on standards, so a
host adapts to them: MCP through the official SDK (streamable HTTP), errors as RFC 9457 problem details,
`Retry-After` (RFC 9110) honoured, W3C trace context forwarded, native `fetch` (a host may pass its own, e.g. one
enforcing an outbound-host policy). No host-specific code.

On npm since Recordare v0.1.0: `npm install @arkimedehq/recordare-client` (Node ≥ 20, ES module).

```ts
import { PersonDirectory, RecordareClient, afterFailure } from '@arkimedehq/recordare-client';

const rc = new RecordareClient({ baseUrl: 'http://recordare:8080', apiKey: process.env.RECORDARE_API_KEY!,
  headers: () => traceHeaders() });                       // e.g. OpenTelemetry propagation.inject

// Which memory the user's account opens, its mode (personal | entity) and Atlas address; the name follows the platform's profile. `enabled` is the
// platform's own memory switch: while false, Recordare is not contacted (no consent flag in Recordare, D50).
const people = new PersonDirectory(rc, { user: async (id) => ({ enabled: true, name: 'Andrea' }) });
const person = await people.refresh('user-42');           // { memoryId, mode, atlasUrl }; peek() reads the cache

// Ingest (split into requests of 500, idempotent on each externalId): → { conversationId, accepted, duplicates, conflicts }.
await rc.ingest('user-42', { conversation: { externalId: 'chat-1' }, messages: [
  { externalId: 'm1', role: 'user', content: 'Domani vado a Bologna', sentAt: new Date().toISOString() },
] });
// The agent's own content (knowledge given to it, a perception, a document): `own: true` on a user / other message.
await rc.ingest('user-42', { conversation: { externalId: 'doc-1', source: 'document' }, messages: [
  { externalId: 'd1', role: 'user', own: true, content: 'La caldaia va revisionata ogni due anni.', sentAt: new Date().toISOString() },
] });
// Mode (only while the memory is empty, else MemoryNotEmptyError) and the first person's gender, from the profile.
await rc.updateMe('user-42', { gender: 'feminine' });

// Recall: one MCP session per user AND conversation (evidence of writes, the current turn), both bound in code.
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

## Learned sources
`learnSource(user, {externalId, title, text, kind?, author?, uri?, language?, learnedAt?, providedBy?, conversation?})`
makes the agent learn a text (D49, WORK_PLAN 8.9: a manual, a page, a note — **text only**, the host converts files).
Any size: a text bigger than `SOURCE_PART_BYTES` (4 MB, or the `partBytes` argument) is sent in parts cut at paragraph
boundaries (`POST api/v1/ingest/sources` + `…/parts`); → `{sourceId, status, parts, passages, duplicate}`. The same
`externalId` again replaces the source; `providedBy` is `'me'` (default), `'someone'` or `{name}`; `conversation:
{externalId}` links it to the conversation it was learned in (that extraction tells of the learning).
`forgetSource(user, externalId)` forgets it (one never sent counts as done); `sources(user)` lists what the agent
learned (`Source[]`). The agent searches it with the MCP tool `search_knowledge`. Send only what the agent should
learn, never a RAG's search results.

```ts
await rc.learnSource('user-42', { externalId: 'boiler-manual', title: 'Manuale della caldaia', text: manualText,
  kind: 'document', providedBy: { name: 'Paolo' }, conversation: { externalId: 'chat-1' } });
```

## The diary
`episodes`, `episode`, `digests`, `facts`, `notes`, `plans` read what Recordare remembers for the person's own view in
the platform's UI; `correctEpisode`, `forgetEpisode`, `pinNote`, `delete`, `decide` are the person's edits (API.md §4).

## What stays with the host
How it stores its outbox (its own database, its own transaction) and how it maps its chats to the ingest contract.
Everything else is here, the same for every client.

## Conformance
`service/test/conformance` runs this library against the real service in Recordare's CI: a turn ingested once,
deletions propagate, the name, mode and gender follow the platform, own content is marked, a source is learned in
parts, listed and forgotten, recall over MCP carries the user and the conversation. Type checks there fail the build when this contract drifts from the service's schemas.

## Synced copy (Arkimede)
Arkimede still uses a copy of the sources instead of the npm package: `scripts/sync-to.sh <dir>` copies them into a
host repository with a header naming the source commit (Arkimede: `backend/src/recordare/client/`). The host never
edits them; change the library here and sync again. Switching to the npm package only changes the imports.

## Development
`npm ci`, `npm run typecheck`, `npm test`, `npm run build` (Node ≥ 20).
