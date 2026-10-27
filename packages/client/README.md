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

// Which memory the user's account opens, its mode (personal | entity) and Atlas address; the name and gender follow the platform's profile. `enabled` is the
// platform's own memory switch: while false, Recordare is not contacted (no consent flag in Recordare, D50).
const people = new PersonDirectory(rc, { user: async (id) => ({ enabled: true, name: 'Andrea', gender: 'masculine' }) });
const person = await people.refresh('user-42');           // { memoryId, mode, atlasUrl }; peek() reads the cache

// Ingest (split into requests of 500, idempotent on each externalId): → { conversationId, accepted, duplicates, conflicts }.
await rc.ingest('user-42', { conversation: { externalId: 'chat-1' }, messages: [
  { externalId: 'm1', role: 'user', content: 'Domani vado a Bologna', sentAt: new Date().toISOString() },
] });
// The agent's own content (knowledge given to it, a perception, a document): `own: true` on a user / other message.
await rc.ingest('user-42', { conversation: { externalId: 'doc-1', source: 'document' }, messages: [
  { externalId: 'd1', role: 'user', own: true, content: 'La caldaia va revisionata ogni due anni.', sentAt: new Date().toISOString() },
] });
// Private (D52): told only to whoever said it (and to a personal memory's holder); `conversation.private` for a whole chat.
await rc.ingest('user-42', { conversation: { externalId: 'chat-1' }, messages: [
  { externalId: 'm2', role: 'user', private: true, content: 'Non dirlo a nessuno: cambio lavoro', sentAt: new Date().toISOString() },
] });
await rc.setMessagePrivate('user-42', 'chat-1', 'm2', false); // "now you can say it"
// A room transcript (continuous listening): Recordare fans it out to the memories of the people present.
await rc.ingestRoom({ conversation: { externalId: 'kitchen-1' }, recipients: ['user-42', 'user-7'],
  speakers: [{ ref: 'a', user: 'user-42' }, { ref: 'b', user: 'user-7' }, { ref: 'c', displayName: 'Leo', identity: { channel: 'voice', externalId: 'leo' } }],
  messages: [{ externalId: 'k1', speakerRef: 'c', content: 'Mi hanno preso in squadra!', sentAt: new Date().toISOString() }] });
// Mode (only while the memory is empty, else MemoryNotEmptyError) and the first person's gender, from the profile.
await rc.updateMe('user-42', { gender: 'feminine' });
// The account is deleted: erase the whole memory (a key with the erase scope; the memory id confirms which).
await rc.eraseMemory('user-42', (await rc.me('user-42')).memoryId);

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
the platform's UI; `correctEpisode`, `forgetEpisode`, `forgetPeriod`, `pinNote`, `delete`, `decide` are the person's edits (API.md §4).
`fact`, `note` give one item with its evidence; `addEpisode`, `addNote` are written by the person (stated, theirs);
`correctFact`, `correctNote` keep the wrong version as history. `noteChanges` is the change feed for a platform keeping a
copy of the notes (pass `next` back as `since`). `settings`, `usage` read the memory's settings and the LLM calls spent on
it; `updateSettings` and the export (`startExport` → `exportJob` → `exportArchive`) need the memory's personal token
(scopes `memory_settings`, `export`; pass `user` empty). Private memories (D52): a private item carries `private: {by}`
(whose it is) where the reader may see it — the holder of a personal memory; in an entity memory the account reads the
public ones and `privateItems(user)` lists the private ones without their content (forget one with `forgetEpisode` /
`delete`).

## Linking the holder's channel identity (D51)
In a personal memory a channel sender speaks as "I" only once the holder links it: `linkCode(user)` → `{code,
expiresAt}` (`RCD-XXXX-XXXX`, ten minutes, one use) — the holder sends the code alone to the agent from that channel, in
a direct chat (set `conversation.direct` on the ingest when you know it; `false` = a group, where a code claims nothing);
then `holderIdentities(user)` → `{linked, pending}`, and `confirmHolderClaim(user, id)` / `rejectHolderClaim(user, id)`
within seven days; `unlinkHolderIdentity(user, id)` undoes a link. Recordare never stores the code's message, but your
model sees it: when `isLinkCode(text)` (the service's own `LINK_CODE` pattern), send the turn at once and give the model
`LINK_CODE_INSTRUCTION` instead of a memory context.

```ts
const { code } = await rc.linkCode('user-42');            // show it to the holder
if (isLinkCode(text)) systemExtra = LINK_CODE_INSTRUCTION; // the model says the code was received, without repeating it
const { pending } = await rc.holderIdentities('user-42');
await rc.confirmHolderClaim('user-42', pending[0].id);
```

## What stays with the host
How it stores its outbox (its own database, its own transaction) and how it maps its chats to the ingest contract.
Everything else is here, the same for every client.

## Conformance
`service/test/conformance` runs this library against the real service in Recordare's CI: a turn ingested once,
deletions propagate, the name, mode and gender follow the platform, own content is marked, a source is learned in
parts, listed and forgotten, recall over MCP carries the user and the conversation. Type checks there fail the build when this contract drifts from the service's schemas.

## CommonJS hosts
The package is ESM only. A CommonJS host (Arkimede's NestJS backend) loads it with `require`, which Node supports for
ES modules from 20.19 / 22.12; with TypeScript, `"module": "nodenext"` (5.8 or later) type-checks that import.

## Development
`npm ci`, `npm run typecheck`, `npm test`, `npm run build` (Node ≥ 20).
