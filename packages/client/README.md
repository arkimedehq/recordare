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
The memory-first contract (D54, `docs/INTEGRATION.md` §4): `charter()` returns `{charter, version}` — put the text in
the system prompt of every agent that uses Recordare (cache it until `version` changes); then before **every** turn
`contextWithTurn(user, turn)` stores the turn and returns its memory context in one round trip (`{block, items}`, the
block to append to the system prompt after the charter, opening with the self card unless `{ card: false }`;
`context(user, conversation, query)` when the turn is already stored); if Recordare does not answer, go on without it; `endConversation(user, conversation)` tells Recordare a conversation ended
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

## Initiatives — what the agent says on its own (D53)
`initiatives(user, {since})` is the feed of what the agent decided to say, ask or look up (pass `next` back as `since`);
the same objects reach your webhook (admin `POST api/v1/admin/clients/{id}/webhooks`) as Standard Webhooks — verify a
delivery with `verifyWebhook(rawBody, headers, secret)` (the raw body, the `whsec_` secret the registration returned;
throws `WebhookVerificationError`). Deliver an initiative when the person it is for (`for`, or the holder) is present
and before `expiresAt`; a `lookup` is for your agent's own tools; then `reportInitiative(user, id, outcome)` with
`said` / `asked` / `ignored` / `declined` / `done` / `failed` (API.md §4b, INTEGRATION.md §4d).
D55 — Recordare decides who, when and where: send `presence(user, {channel, person?, confidence?})` when your agent
recognises someone (your voiceprint or face model's score; an account is 1) and speak the `initiative` you get back
(already `offered`), or ask "is it you?" for `askWho`; pass `channel` and `reaction` to `reportInitiative`; give
`context(…, {initiatives: {lookups: true}})` when your agent has tools; `source` on an initiative names your own messages
it came from (a reminder you scheduled yourself). Deliver on the webhook event `initiative.deliver` (Recordare chose
the moment): `data.channel` says where.
`InitiativeInbox` does all of it once — give it how you speak one initiative, and it verifies webhooks (a repeated
`webhook-id` ignored), asks on presence, catches up from the feed with a cursor, hands each initiative to you once and
reports the outcome you return:
```ts
const inbox = new InitiativeInbox({ client, secret: process.env.RECORDARE_WEBHOOK_SECRET, channels: ['chat'],
  users: () => enabledUserIds(),
  deliver: async (user, i) => (await alreadyScheduled(user, i)) ? 'done' : (await postToChat(user, i.text), i.kind === 'ask' ? 'asked' : 'said') });
app.post('/recordare/webhook', (req, res) => { try { inbox.handleWebhook(req.rawBody, req.headers); res.sendStatus(204); } catch { res.sendStatus(401); } });
inbox.start();                                 // the feed every 15 min
await inbox.presence(userId, { channel: 'chat' }); // when the user shows up
```
Pass `seen` / `cursors` to keep them in your own store across restarts.
Channels and rooms (D55 §5b–§5c): `initiative.channels` lists the acceptable channels in order — deliver on the first
that reaches the person now and return `{outcome, channel}` so the channel is reported; `addressesOn(i, 'telegram')`
gives the person's ids on a channel (`for.addresses`, bound in the console). Send presence by place —
`presence(user, {channel: 'voice', place, people: [{identity, confidence}], someone})`, `home` for "at home" — and give
`open(user, i, opening)`: with others in the room only the opening is said, the initiative stays pending, and the
person's "yes" is their next turn (the memory context then carries it).
```ts
deliver: async (user, i) => {
  const chat = i.channels.includes('messaging') ? addressesOn(i, 'telegram')[0] : undefined;
  if (chat) return (await telegram.send(chat, i.text), { outcome: 'said', channel: 'messaging' });
  return (await postToChat(user, i.text), i.kind === 'ask' ? 'asked' : 'said');
},
open: async (user, i, opening) => speakInRoom(user, opening),
```

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
