// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Conformance suite (WORK_PLAN 6.7): the client library (`packages/client`) against the real service. Every client
 * passes the same behaviour: a turn ingested once (always stored: no consent step, D50), deletions propagate, the name,
 * mode and gender follow the platform, the agent's own content is marked, recall over MCP carries the user AND the conversation. The type checks below fail the build when
 * the client's hand-written contract drifts from the service's schemas.
 */
import { type INestApplication } from '@nestjs/common';
import { type Server } from 'node:http';
import { DataSource } from 'typeorm';
import { type z } from 'zod';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type Episode as ClientEpisode, type IngestRequest as ClientIngest, type IngestResult as ClientIngestResult, type LearnSource as ClientLearnSource,
  type HolderIdentities as ClientHolderIdentities, isLinkCode, type LinkCode as ClientLinkCode,
  type LearnSourceResult as ClientLearnSourceResult, MemoryNotEmptyError, type Source as ClientSource,
  PersonDirectory, RecordareClient, TOOLS,
} from '../../../packages/client/src/index.js';
import { type EpisodeItem } from '../../src/read/read.service';
import { type IngestResult, type ingestSchema } from '../../src/rawlog/ingest.schemas';
import { type LearnSourceResult, type learnSourceSchema } from '../../src/knowledge/sources.schemas';
import { type SourceView } from '../../src/knowledge/sources.service';
import { type HolderIdentities, type LinkCode } from '../../src/identity/holder-links';
import type * as client from '../../../packages/client/src/index.js';
import type * as read from '../../src/read/read.responses';
import type * as api from '../../src/openapi/responses';
import { ADMIN_KEY, call, resetSchema, startApp, startFakeEmbeddings, startFakeLlm, testEnv } from '../helpers/app';

// ── Contract drift (compile time) ──────────────────────────────────────────────
type Assert<T extends true> = T;
type Extends<A, B> = [A] extends [B] ? true : false;
export type ClientIngestFitsService = Assert<Extends<ClientIngest, z.input<typeof ingestSchema>>>;
export type ServiceResultFitsClient = Assert<Extends<IngestResult, ClientIngestResult>>;
export type ServiceEpisodeFitsClient = Assert<Extends<EpisodeItem, ClientEpisode>>;
export type ClientSourceFitsService = Assert<Extends<ClientLearnSource & { final?: boolean }, z.input<typeof learnSourceSchema>>>;
export type ServiceSourceResultFitsClient = Assert<Extends<LearnSourceResult, ClientLearnSourceResult>>;
export type ServiceSourceFitsClient = Assert<Extends<SourceView, ClientSource>>;
export type ServiceLinkCodeFitsClient = Assert<Extends<LinkCode, ClientLinkCode>>;
export type ServiceHolderIdentitiesFitsClient = Assert<Extends<HolderIdentities, ClientHolderIdentities>>;
// What the service answers (its `@Returns` schemas, checked against every response in the tests) fits the client's types.
type Answer<S extends z.ZodType> = z.output<S>;
export type AnswersFitClient = Assert<Extends<[
  Answer<typeof read.episodesResponse>, Answer<typeof read.episodeDetailResponse>, Answer<typeof read.digestsResponse>,
  Answer<typeof read.factsResponse>, Answer<typeof read.factDetailResponse>, Answer<typeof read.notesResponse>,
  Answer<typeof read.noteDetailResponse>, Answer<typeof read.noteChangesResponse>['items'], Answer<typeof read.settingsResponse>,
  Answer<typeof read.usageResponse>, Answer<typeof read.exportResponse>, Answer<typeof api.contextResponse>, Answer<typeof api.meResponse>,
  Answer<typeof api.ingestResponse>, Answer<typeof api.roomResponse>, Answer<typeof api.learnSourceResponse>, Answer<typeof api.sourcesResponse>,
  Answer<typeof api.linkCodeResponse>, Answer<typeof api.holderIdentitiesResponse>, Answer<typeof api.erasedResponse>, Answer<typeof read.cardsResponse>,
], [
  { items: client.Episode[]; nextCursor: string | null }, client.EpisodeDetail, client.Digest[],
  client.Fact[], client.FactDetail, client.Note[],
  client.NoteDetail, client.NoteChange[], client.MemorySettings,
  client.Usage, client.ExportJob, client.MemoryContext, client.Me,
  client.IngestResult, client.RoomResult, client.LearnSourceResult, client.Source[],
  client.LinkCode, client.HolderIdentities, client.Erased, client.Cards,
]>>;

describe('client conformance (packages/client against the service)', () => {
  let app: INestApplication;
  let url: string;
  let llm: Awaited<ReturnType<typeof startFakeLlm>>;
  let emb: Server;
  let rc: RecordareClient;
  let clientId: string;

  beforeAll(async () => {
    llm = await startFakeLlm();
    const fake = await startFakeEmbeddings();
    emb = fake.server;
    testEnv({ EMBEDDING_BASE_URL: fake.url, LLM_BASE_URL: llm.url, IDLE_DELAY_SECONDS: '3600' });
    await resetSchema();
    ({ app, url } = await startApp());
    clientId = (await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'Platform', kind: 'platform', autoProvision: true } })).body.id;
    const key = (await call(url, 'POST', `/api/v1/admin/clients/${clientId}/keys`, { token: ADMIN_KEY, body: { scopes: ['ingest', 'mcp', 'read', 'write'] } })).body.key;
    rc = new RecordareClient({ baseUrl: url, apiKey: key });
  });
  afterAll(async () => { await rc?.close(); await app?.close(); llm?.server.close(); emb?.close(); });

  const turn = (id: string, content: string): ClientIngest['messages'][number] =>
    ({ externalId: id, role: 'user', content, sentAt: '2026-10-07T10:00:00+02:00' });
  const db = () => app.get(DataSource);

  it('stores each turn exactly once, with no consent step (D50)', async () => {
    const me = await rc.me('user-1');
    expect(me).toMatchObject({ mode: 'personal', gender: 'masculine' });
    expect(me).not.toHaveProperty('episodicEnabled');
    const first = await rc.ingest('user-1', { conversation: { externalId: 'chat-1' }, messages: [turn('m1', 'Ciao'), turn('m2', 'Domani vado a Bologna')] });
    expect(first).toMatchObject({ accepted: 2, duplicates: 0 });
    expect(first).not.toHaveProperty('stored');
    const again = await rc.ingest('user-1', { conversation: { externalId: 'chat-1' }, messages: [turn('m1', 'Ciao'), turn('m2', 'Domani vado a Bologna')] });
    expect(again).toMatchObject({ accepted: 0, duplicates: 2 });
  });

  it("marks the agent's own content and accepts the new sources (D50)", async () => {
    const res = await rc.ingest('user-1', {
      conversation: { externalId: 'doc-1', source: 'document', title: 'Manuale della caldaia' },
      messages: [{ ...turn('d1', 'La caldaia va revisionata ogni due anni.'), own: true }],
    });
    expect(res).toMatchObject({ accepted: 1 });
    expect(await db().query(`SELECT m.author_kind, c.source FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE m.external_id = 'd1'`))
      .toEqual([{ author_kind: 'own', source: 'document' }]);
    await rc.deleteConversation('user-1', 'doc-1');
  });

  it('sends a room transcript to the memories of the people present (6.5 (4)); deleted through the per-user calls', async () => {
    const res = await rc.ingestRoom({
      conversation: { externalId: 'room-1' },
      speakers: [{ ref: 'a', user: 'user-1' }, { ref: 'b', displayName: 'Giulia', identity: { channel: 'voice', externalId: 'giulia' } }],
      recipients: ['user-1'],
      messages: [{ externalId: 'r1', speakerRef: 'a', content: 'Stasera pizza.', sentAt: '2026-10-07T19:00:00+02:00' },
        { externalId: 'r2', speakerRef: 'b', content: 'Io porto il dolce.', sentAt: '2026-10-07T19:01:00+02:00' }],
    });
    expect(res.recipients).toEqual([expect.objectContaining({ user: 'user-1', accepted: 2, duplicates: 0, conflicts: [] })]);
    expect(await db().query(`SELECT m.author_kind, c.source FROM messages m JOIN conversations c ON c.id = m.conversation_id
      WHERE c.external_id = 'room-1' ORDER BY m.external_id`)).toEqual([{ author_kind: 'self', source: 'ambient' }, { author_kind: 'contact', source: 'ambient' }]);
    await rc.deleteConversation('user-1', 'room-1');
  });

  it('propagates deletions; deleting what Recordare never had is done', async () => {
    await rc.deleteMessage('user-1', 'chat-1', 'm2');
    const live = await db().query(
      `SELECT m.external_id FROM messages m JOIN conversations c ON c.id = m.conversation_id
       WHERE c.external_id = 'chat-1' ORDER BY 1`);
    expect(live).toEqual([{ external_id: 'm1' }]);
    await rc.deleteMessage('user-1', 'chat-1', 'never-sent');
    await rc.deleteConversation('user-1', 'chat-404');
  });

  it('stores a turn and asks its memory context in one call; ends a conversation without a message', async () => {
    const res = await rc.contextWithTurn('user-1', { conversation: { externalId: 'chat-2' }, messages: [turn('t1', 'Che tempo fa?')] });
    expect(res).toEqual({ block: null, items: 0 });
    expect(await db().query(`SELECT count(*)::int AS n FROM messages WHERE external_id = 't1'`)).toEqual([{ n: 1 }]);
    await rc.endConversation('user-1', 'chat-2');
    await rc.endConversation('user-1', 'chat-never-seen'); // nothing to end: done
  });

  it('keeps the name in sync with the platform and accepts the mode only while the memory is empty', async () => {
    const people = new PersonDirectory(rc, { user: async (u) => ({ enabled: true, name: u === 'user-2' ? 'Casa' : 'Andrea' }) });
    expect(await people.refresh('user-2')).toMatchObject({ mode: 'personal', atlasUrl: null });
    expect((await rc.me('user-2')).displayName).toBe('Casa');
    await rc.updateMe('user-2', { mode: 'entity', gender: 'feminine' });
    expect(await rc.me('user-2')).toMatchObject({ mode: 'entity', gender: 'feminine' });
    await expect(rc.updateMe('user-1', { mode: 'entity' })).resolves.toBeUndefined(); // no episodes yet: allowed
    await rc.updateMe('user-1', { mode: 'personal' });
    await db().query(
      `INSERT INTO notes (memory_id, category, content, origin, author_role, stance, confidence, disclosure, audience)
       SELECT o.person_id, 'preference', 'x', 'holder_lived', 'holder', 'stated', 1, 'holder', ARRAY[o.person_id] FROM memories o
       JOIN external_identities i ON i.person_id = o.person_id WHERE i.external_id = 'user-1'`);
    await expect(rc.updateMe('user-1', { mode: 'entity' })).rejects.toBeInstanceOf(MemoryNotEmptyError);
  });

  it('erases a user\'s whole memory with a key that has the erase scope', async () => {
    const key = (await call(url, 'POST', `/api/v1/admin/clients/${clientId}/keys`, { token: ADMIN_KEY, body: { scopes: ['ingest', 'read', 'erase'] } })).body.key;
    const eraser = new RecordareClient({ baseUrl: url, apiKey: key });
    await eraser.ingest('user-erase', { conversation: { externalId: 'c' }, messages: [{ externalId: 'm', role: 'user', content: 'ciao', sentAt: '2026-10-01T10:00:00Z' }] });
    const { memoryId } = await eraser.me('user-erase');
    await expect(rc.eraseMemory('user-erase', memoryId)).rejects.toMatchObject({ status: 403 });
    expect((await eraser.eraseMemory('user-erase', memoryId)).erased).toMatchObject({ conversations: 1, messages: 1 });
    expect(await db().query(`SELECT count(*)::int AS n FROM memories WHERE person_id = $1`, [memoryId])).toEqual([{ n: 0 }]);
  });

  it('sends private messages and makes them public again (D52)', async () => {
    await rc.ingest('user-1', { conversation: { externalId: 'priv', private: true }, messages: [
      { externalId: 'p1', role: 'user', content: 'Una cosa mia', sentAt: '2026-10-02T10:00:00Z' },
      { externalId: 'p2', role: 'assistant', content: 'Capito', sentAt: '2026-10-02T10:01:00Z' }] });
    const flags = () => db().query(`SELECT external_id, private FROM messages WHERE external_id IN ('p1', 'p2') ORDER BY external_id`);
    expect(await flags()).toEqual([{ external_id: 'p1', private: true }, { external_id: 'p2', private: true }]);
    await rc.setMessagePrivate('user-1', 'priv', 'p1', false);
    expect(await flags()).toEqual([{ external_id: 'p1', private: false }, { external_id: 'p2', private: false }]);
  });

  it('links the holder\'s channel identity by one-time code and confirmation (D51)', async () => {
    const { code } = await rc.linkCode('user-link');
    expect(isLinkCode(code)).toBe(true); // the library recognises what the service makes
    const sender = { ref: 'telegram:42', role: 'other' as const, identity: { channel: 'telegram', externalId: '42' } };
    const send = (id: string, content: string) => rc.ingest('user-link', {
      conversation: { externalId: 'tg', direct: true, participants: [sender] },
      messages: [{ externalId: id, role: 'other', authorRef: 'telegram:42', content, sentAt: '2026-10-14T10:00:00+02:00' }],
    });
    expect(await send('c1', code)).toMatchObject({ accepted: 0 });
    const { pending } = await rc.holderIdentities('user-link');
    expect(pending).toMatchObject([{ channel: 'telegram', externalId: '42' }]);
    await rc.confirmHolderClaim('user-link', pending[0]!.id);
    await send('c2', 'Ciao');
    const [row] = await db().query(`SELECT author_kind FROM messages WHERE external_id = 'c2' AND content = 'Ciao'`);
    expect(row.author_kind).toBe('self');
    const { linked } = await rc.holderIdentities('user-link');
    await rc.unlinkHolderIdentity('user-link', linked[0]!.id);
    expect((await rc.holderIdentities('user-link')).linked).toEqual([]);
  });

  it('reads and edits the person\'s diary', async () => {
    const notes = await rc.notes('user-1');
    expect(notes.map((n) => n.content)).toEqual(['x']);
    await rc.pinNote('user-1', notes[0]!.id, true);
    expect((await rc.notes('user-1', { pinned: true })).map((n) => n.pinned)).toEqual([true]);
    expect(await rc.episodes('user-1')).toEqual({ items: [], nextCursor: null });
    await rc.delete('user-1', 'notes', notes[0]!.id);
    expect(await rc.notes('user-1')).toEqual([]);
  });

  it('writes, corrects and follows the diary; reads settings and usage; exports with a personal token (4.7)', async () => {
    const episodeId = await rc.addEpisode('user-1', { content: 'Cena da Aldina', occurredAt: '2026-10-03' });
    expect((await rc.episode('user-1', episodeId)).content).toBe('Cena da Aldina');
    const noteId = await rc.addNote('user-1', { content: 'Il caffè lo prendo amaro', category: 'preference' });
    const fixed = await rc.correctNote('user-1', noteId, { content: 'Il caffè lo prendo amaro, senza zucchero' });
    expect(await rc.note('user-1', fixed)).toMatchObject({ corrects: noteId, status: 'current', pattern: false, evidence: [] });
    const feed = await rc.noteChanges('user-1');
    expect(feed.items.slice(-2).map((c) => c.change)).toEqual(['created', 'corrected']);
    expect(await rc.noteChanges('user-1', { since: feed.next })).toEqual({ items: [], next: feed.next, more: false });
    expect(await rc.settings('user-1')).toMatchObject({ locale: 'it', effectiveQualityProfile: 'balanced' });
    expect(await rc.usage('user-1', { from: '2026-10-01', to: '2026-10-07' })).toMatchObject({ from: '2026-10-01', calls: expect.any(Number) });

    const memoryId = (await rc.me('user-1')).memoryId;
    const token = (await call(url, 'POST', `/api/v1/admin/memories/${memoryId}/tokens`,
      { token: ADMIN_KEY, body: { clientId, scopes: ['read', 'memory_settings', 'export'] } })).body.token;
    const own = new RecordareClient({ baseUrl: url, apiKey: token });
    expect(await own.updateSettings('', { qualityProfile: 'full' })).toMatchObject({ qualityProfile: 'full', effectiveQualityProfile: 'full' });
    let job = await own.startExport('');
    for (let i = 0; i < 50 && job.status === 'running'; i++) {
      await new Promise((r) => setTimeout(r, 100));
      job = await own.exportJob('', job.id);
    }
    expect(job.status).toBe('done');
    expect(await own.exportArchive('', job.id)).toMatchObject({ format: 'recordare-export/1' });
    await own.close();
  });

  it('learns a source in parts, lists it and forgets it (WORK_PLAN 8.9)', async () => {
    const text = Array.from({ length: 6 }, (_, i) => `Paragrafo ${i + 1} del manuale della caldaia.`).join('\n\n');
    const r = await rc.learnSource('user-1', { externalId: 'manual', title: 'Manuale della caldaia', text }, 100);
    expect(r).toMatchObject({ status: expect.stringMatching(/indexing|ready/), duplicate: false });
    expect(r.parts).toBeGreaterThan(1);
    expect((await rc.sources('user-1')).map((s) => s.title)).toEqual(['Manuale della caldaia']);
    await rc.forgetSource('user-1', 'manual');
    await rc.forgetSource('user-1', 'never-sent');
    expect(await rc.sources('user-1')).toEqual([]);
  });

  it('recalls over MCP with the user and the conversation bound to the session', async () => {
    const tools = (await rc.mcp.listTools('user-1', 'chat-1')).map((t) => t.name);
    expect(tools).toEqual(expect.arrayContaining(['search_episodes', 'search_memory', 'resolve_period']));
    const res = await rc.mcp.callTool('user-1', 'chat-1', 'search_episodes', { query: 'Bologna' });
    expect(res.isError).toBe(false);
    const [log] = await db().query(
      `SELECT c.external_id AS conversation, i.external_id AS user FROM recall_log r
       JOIN conversations c ON c.id = r.conversation_id JOIN external_identities i ON i.person_id = r.memory_id
       WHERE r.tool = 'search_episodes' ORDER BY r.served_at DESC LIMIT 1`);
    expect(log).toEqual({ conversation: 'chat-1', user: 'user-1' });
  });

  it('publishes the MCP tool schemas the service serves (packages/client TOOLS)', async () => {
    const served = (await rc.mcp.listTools('user-1', 'chat-1'))
      .map(({ name, title, description, inputSchema }) => ({ name, title, description, inputSchema }))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (process.env['RECORDARE_UPDATE_TOOLS']) {
      writeFileSync(join(__dirname, '../../../packages/client/src/tools.ts'), `${TOOLS_HEADER}export const TOOLS = ${JSON.stringify(served, null, 2)} as const;\n`);
    }
    // Regenerate with RECORDARE_UPDATE_TOOLS=1 npx vitest run test/conformance when a tool changes.
    expect(JSON.parse(JSON.stringify(TOOLS))).toEqual(JSON.parse(JSON.stringify(served)));
  });
});

const TOOLS_HEADER = `// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * The MCP tools Recordare serves (name, title, description, JSON Schema of the arguments), for connectors that must
 * declare tools before talking to the service. Generated by the conformance suite (service/test/conformance,
 * RECORDARE_UPDATE_TOOLS=1), which fails when this copy drifts from the service.
 */
`;
