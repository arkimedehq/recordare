// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Conformance suite (WORK_PLAN 6.7): the client library (`packages/client`) against the real service. Every client
 * passes the same behaviour: a turn ingested once, nothing stored before consent, deletions propagate, the name and kind
 * follow the platform, recall over MCP carries the user AND the conversation. The type checks below fail the build when
 * the client's hand-written contract drifts from the service's schemas.
 */
import { type INestApplication } from '@nestjs/common';
import { type Server } from 'node:http';
import { DataSource } from 'typeorm';
import { type z } from 'zod';
import {
  type Episode as ClientEpisode, type IngestRequest as ClientIngest, type IngestResult as ClientIngestResult, MemoryNotEmptyError,
  PersonDirectory, RecordareClient,
} from '../../../packages/client/src/index.js';
import { type EpisodeItem } from '../../src/read/read.service';
import { type IngestResult, type ingestSchema } from '../../src/rawlog/ingest.schemas';
import { ADMIN_KEY, call, resetSchema, startApp, startFakeEmbeddings, startFakeLlm, testEnv } from '../helpers/app';

// ── Contract drift (compile time) ──────────────────────────────────────────────
type Assert<T extends true> = T;
type Extends<A, B> = [A] extends [B] ? true : false;
export type ClientIngestFitsService = Assert<Extends<ClientIngest, z.input<typeof ingestSchema>>>;
export type ServiceResultFitsClient = Assert<Extends<IngestResult, ClientIngestResult>>;
export type ServiceEpisodeFitsClient = Assert<Extends<EpisodeItem, ClientEpisode>>;

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

  const consent = async (ownerId: string) =>
    call(url, 'PATCH', `/api/v1/admin/owners/${ownerId}`, { token: ADMIN_KEY, body: { episodicEnabled: true } });
  const turn = (id: string, content: string): ClientIngest['messages'][number] =>
    ({ externalId: id, role: 'user', content, sentAt: '2026-10-07T10:00:00+02:00' });
  const db = () => app.get(DataSource);

  it('stores nothing before consent, then each turn exactly once', async () => {
    const me = await rc.me('user-1');
    expect(me).toMatchObject({ kind: 'human', episodicEnabled: false });
    const before = await rc.ingest('user-1', { conversation: { externalId: 'chat-1' }, messages: [turn('m1', 'Ciao')] });
    expect(before.stored).toBe(false);
    expect(await db().query(`SELECT count(*)::int AS n FROM messages`)).toEqual([{ n: 0 }]);

    await consent(me.ownerId);
    const first = await rc.ingest('user-1', { conversation: { externalId: 'chat-1' }, messages: [turn('m1', 'Ciao'), turn('m2', 'Domani vado a Bologna')] });
    expect(first).toMatchObject({ stored: true, accepted: 2, duplicates: 0 });
    const again = await rc.ingest('user-1', { conversation: { externalId: 'chat-1' }, messages: [turn('m1', 'Ciao'), turn('m2', 'Domani vado a Bologna')] });
    expect(again).toMatchObject({ stored: true, accepted: 0, duplicates: 2 });
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

  it('keeps the name in sync with the platform and accepts the kind only while the memory is empty', async () => {
    const people = new PersonDirectory(rc, { user: async (u) => ({ enabled: true, name: u === 'user-2' ? 'Casa' : 'Andrea' }) });
    expect(await people.status('user-2')).toBe('waiting_activation');
    expect((await rc.me('user-2')).displayName).toBe('Casa');
    await rc.updateMe('user-2', { kind: 'entity' });
    expect((await rc.me('user-2')).kind).toBe('entity');
    await expect(rc.updateMe('user-1', { kind: 'entity' })).resolves.toBeUndefined(); // no episodes yet: allowed
    await rc.updateMe('user-1', { kind: 'human' });
    await db().query(
      `INSERT INTO notes (owner_id, category, content, origin, author_role, stance, confidence, disclosure, audience)
       SELECT o.person_id, 'preference', 'x', 'owner_lived', 'owner', 'stated', 1, 'owner', ARRAY[o.person_id] FROM owners o
       JOIN external_identities i ON i.person_id = o.person_id WHERE i.external_id = 'user-1'`);
    await expect(rc.updateMe('user-1', { kind: 'entity' })).rejects.toBeInstanceOf(MemoryNotEmptyError);
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
});
