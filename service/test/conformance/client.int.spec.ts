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
  type LearnSourceResult as ClientLearnSourceResult, MemoryNotEmptyError, type Source as ClientSource,
  PersonDirectory, RecordareClient, TOOLS,
} from '../../../packages/client/src/index.js';
import { type EpisodeItem } from '../../src/read/read.service';
import { type IngestResult, type ingestSchema } from '../../src/rawlog/ingest.schemas';
import { type LearnSourceResult, type learnSourceSchema } from '../../src/knowledge/sources.schemas';
import { type SourceView } from '../../src/knowledge/sources.service';
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
      `INSERT INTO notes (owner_id, category, content, origin, author_role, stance, confidence, disclosure, audience)
       SELECT o.person_id, 'preference', 'x', 'owner_lived', 'owner', 'stated', 1, 'owner', ARRAY[o.person_id] FROM owners o
       JOIN external_identities i ON i.person_id = o.person_id WHERE i.external_id = 'user-1'`);
    await expect(rc.updateMe('user-1', { mode: 'entity' })).rejects.toBeInstanceOf(MemoryNotEmptyError);
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
       JOIN conversations c ON c.id = r.conversation_id JOIN external_identities i ON i.person_id = r.owner_id
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
