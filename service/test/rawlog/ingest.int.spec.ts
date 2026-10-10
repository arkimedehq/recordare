// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { type INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { type Queue } from 'bullmq';
import { type Server } from 'node:http';
import { DataSource } from 'typeorm';
import { ADMIN_KEY, call, resetSchema, startApp, startFakeEmbeddings, testEnv } from '../helpers/app';

describe('REST ingest (Layer 0)', () => {
  let app: INestApplication;
  let url: string;
  let db: DataSource;
  let emb: Server;
  let key: string;
  let clientId: string;
  let memoryId: string;
  const as = (user: string) => ({ token: key, headers: { 'x-recordare-user': user } });

  beforeAll(async () => {
    const fake = await startFakeEmbeddings();
    emb = fake.server;
    testEnv({ EMBEDDING_BASE_URL: fake.url });
    await resetSchema();
    ({ app, url } = await startApp());
    db = app.get(DataSource);
    await app.get<Queue>(getQueueToken('extraction')).obliterate({ force: true });

    const client = await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'Arkimede', kind: 'platform' } });
    clientId = client.body.id;
    key = (await call(url, 'POST', `/api/v1/admin/clients/${clientId}/keys`, { token: ADMIN_KEY, body: { scopes: ['ingest', 'read'] } })).body.key;
    memoryId = (await call(url, 'POST', '/api/v1/admin/memories', { token: ADMIN_KEY, body: { displayName: 'Luca' } })).body.personId;
    await call(url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY, body: { kind: 'account', personId: memoryId, clientId, externalId: 'luca' } });
  });
  afterAll(async () => { await app?.close(); emb?.close(); });

  const batch = (conv: string, msgs: Array<Record<string, unknown>>, extra: Record<string, unknown> = {}) => ({
    conversation: { externalId: conv, ...extra }, messages: msgs,
  });
  const msg = (id: string, content: string, role = 'user', sentAt = '2026-01-18T19:30:00+01:00') => ({ externalId: id, role, content, sentAt });

  it('stores what the client sends without any consent step (D50: the switch is the client\'s)', async () => {
    const res = await call(url, 'POST', '/api/v1/ingest/messages', { ...as('luca'), body: batch('c0', [msg('m1', 'ciao')]) });
    expect(res).toMatchObject({ status: 200, body: { accepted: 1, duplicates: 0, conflicts: [] } });
    expect(res.body).not.toHaveProperty('stored');
    expect(await db.query(`SELECT count(*)::int AS n FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.external_id = 'c0'`)).toEqual([{ n: 1 }]);
    expect((await call(url, 'DELETE', '/api/v1/ingest/conversations/c0', as('luca'))).status).toBe(202); // a clean slate for the next tests
  });

  it('ingests idempotently, records conflicts, applies upserts as edits with revisions', async () => {
    const first = await call(url, 'POST', '/api/v1/ingest/messages', {
      ...as('luca'),
      body: batch('c1', [msg('m1', 'Ieri sono andato a sciare a Cervinia'), msg('m2', 'Che bello!', 'assistant', '2026-01-18T19:31:00+01:00')]),
    });
    expect(first.body).toMatchObject({ accepted: 2, duplicates: 0, conflicts: [] });

    const again = await call(url, 'POST', '/api/v1/ingest/messages', {
      ...as('luca'),
      body: batch('c1', [msg('m1', 'Ieri sono andato a sciare a Cervinia'), msg('m2', 'Testo cambiato', 'assistant')]),
    });
    expect(again.body).toMatchObject({ accepted: 0, duplicates: 1, conflicts: ['m2'] });

    const upsert = await call(url, 'POST', '/api/v1/ingest/messages', {
      ...as('luca'), body: batch('c1', [{ ...msg('m2', 'Testo cambiato', 'assistant'), upsert: true }]),
    });
    expect(upsert.body).toMatchObject({ accepted: 1, conflicts: [] });
    expect(await db.query(`SELECT content FROM message_revisions`)).toEqual([{ content: 'Che bello!' }]);

    const rows = await db.query(`SELECT external_id, role, author_person_id, author_kind, attribution_method FROM messages ORDER BY external_id`);
    expect(rows).toEqual([
      { external_id: 'm1', role: 'user', author_person_id: memoryId, author_kind: 'self', attribution_method: 'account' },
      { external_id: 'm2', role: 'assistant', author_person_id: null, author_kind: 'agent', attribution_method: 'client_assertion' },
    ]);
    // Implicit memory participant.
    expect(await db.query(`SELECT ref, role, person_id FROM conversation_participants`)).toEqual([{ ref: 'holder', role: 'holder', person_id: memoryId }]);
  });

  it('rejects system messages and malformed batches', async () => {
    const res = await call(url, 'POST', '/api/v1/ingest/messages', { ...as('luca'), body: batch('c2', [msg('s1', 'secret prompt', 'system')]) });
    expect(res).toMatchObject({ status: 400, body: { code: 'invalid_request' } });
    expect((await call(url, 'POST', '/api/v1/ingest/messages', { token: ADMIN_KEY, body: batch('c2', [msg('x', 'y')]) })).status).toBe(403);
  });

  it('resolves participants inside the memory only: known, unverified, first seen (D50)', async () => {
    // Two contacts of Luca's memory, bound by the admin: Marco verified, Gino not.
    const contact = async (name: string, verified: boolean) => {
      const id = (await call(url, 'POST', '/api/v1/admin/memories', { token: ADMIN_KEY, body: { displayName: name } })).body.personId;
      await db.query(`UPDATE persons SET memory_id = $1 WHERE id = $2`, [memoryId, id]);
      await db.query(`DELETE FROM memories WHERE person_id = $1`, [id]);
      const res = await call(url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY,
        body: { kind: 'participant', memoryId: memoryId, personId: id, channel: 'telegram', externalId: name, verified } });
      expect(res.status).toBe(201);
      return id;
    };
    const marco = await contact('Marco', true);
    await contact('Gino', false);

    await call(url, 'POST', '/api/v1/ingest/messages', {
      ...as('luca'),
      body: batch('group', [msg('g1', 'Ciao a tutti')], {
        participants: [
          { ref: 'marco', role: 'other', displayName: 'Marco', identity: { channel: 'telegram', externalId: 'Marco' } },
          { ref: 'gino', role: 'other', displayName: 'Gino', identity: { channel: 'telegram', externalId: 'Gino' } },
          { ref: 'stranger', role: 'other', displayName: 'Tizio', identity: { channel: 'telegram', externalId: '999' } },
        ],
      }),
    });
    const parts = await db.query(
      `SELECT p.ref, p.person_id FROM conversation_participants p JOIN conversations c ON c.id = p.conversation_id
       WHERE c.external_id = 'group' ORDER BY p.ref`);
    const [tizio] = await db.query(`SELECT id, memory_id, display_name FROM persons WHERE display_name = 'Tizio'`);
    expect(tizio).toMatchObject({ memory_id: memoryId });
    expect(parts).toEqual([
      { ref: 'gino', person_id: null }, // an unverified binding identifies nobody
      { ref: 'holder', person_id: memoryId },
      { ref: 'marco', person_id: marco },
      { ref: 'stranger', person_id: tizio.id }, // first seen: a new contact of this memory, with its participant id and name
    ]);
    expect(await db.query(`SELECT kind, channel, external_id FROM external_identities WHERE person_id = $1`, [tizio.id]))
      .toEqual([{ kind: 'participant', channel: 'telegram', external_id: '999' }]);
    expect(await db.query(`SELECT alias, source FROM person_aliases WHERE person_id = $1`, [tizio.id])).toEqual([{ alias: 'Tizio', source: 'client' }]);
  });

  it('schedules one idle extraction per conversation and reschedules it on new messages', async () => {
    const queue = app.get<Queue>(getQueueToken('extraction'));
    const [conv] = await db.query(`SELECT id FROM conversations WHERE external_id = 'c1'`);
    const job = await queue.getJob(`idle-${conv.id}`);
    expect(job).toBeTruthy();
    expect(await job!.isDelayed()).toBe(true);
    await call(url, 'POST', '/api/v1/ingest/messages', { ...as('luca'), body: { ...batch('c1', [msg('m3', 'altro')]), hints: { conversationEnded: true } } });
    // Delay 0 → the job runs right away (and is removed on completion) or is no longer delayed.
    const after = await queue.getJob(`idle-${conv.id}`);
    expect(after ? await after.isDelayed() : false).toBe(false);
  });

  it('honours "conversation ended" when the message carrying it was already stored', async () => {
    const queue = app.get<Queue>(getQueueToken('extraction'));
    await call(url, 'POST', '/api/v1/ingest/messages', { ...as('luca'), body: batch('c-end', [msg('e1', 'ultima risposta')]) });
    const [conv] = await db.query(`SELECT id FROM conversations WHERE external_id = 'c-end'`);
    expect(await (await queue.getJob(`idle-${conv.id}`))!.isDelayed()).toBe(true);
    const res = await call(url, 'POST', '/api/v1/ingest/messages', { ...as('luca'), body: { ...batch('c-end', [msg('e1', 'ultima risposta')]), hints: { conversationEnded: true } } });
    expect(res.body).toMatchObject({ accepted: 0, duplicates: 1 });
    // The delayed job is promoted to "run now" asynchronously: wait for it.
    let delayed = true;
    for (let i = 0; i < 40 && delayed; i++) {
      const after = await queue.getJob(`idle-${conv.id}`);
      delayed = after ? await after.isDelayed() : false;
      if (delayed) await new Promise((r) => setTimeout(r, 50));
    }
    expect(delayed).toBe(false);
  });

  it('computes embeddings for non-assistant messages in the background', { timeout: 15000 }, async () => {
    for (let i = 0; i < 50; i++) {
      const [{ n }] = await db.query(`SELECT count(*)::int AS n FROM messages WHERE embedding IS NOT NULL`);
      if (n >= 3) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    const rows = await db.query(`SELECT role, embedding IS NOT NULL AS has FROM messages ORDER BY external_id`);
    expect(rows.filter((r: { role: string; has: boolean }) => r.role === 'assistant').every((r: { has: boolean }) => !r.has)).toBe(true);
    expect(rows.filter((r: { role: string; has: boolean }) => r.role === 'user').every((r: { has: boolean }) => r.has)).toBe(true);
  });

  it('edits and deletes messages and conversations of the calling client only', async () => {
    expect((await call(url, 'PATCH', '/api/v1/ingest/conversations/c1/messages/m1', { ...as('luca'), body: { content: 'Ieri a Livigno' } })).status).toBe(204);
    expect(await db.query(`SELECT content, extracted_run_id FROM messages WHERE external_id = 'm1'`)).toEqual([{ content: 'Ieri a Livigno', extracted_run_id: null }]);
    expect((await call(url, 'DELETE', '/api/v1/ingest/conversations/c1/messages/m1', as('luca'))).status).toBe(202);
    expect((await call(url, 'DELETE', '/api/v1/ingest/conversations/c1/messages/m1', as('luca'))).status).toBe(404);
    expect((await call(url, 'DELETE', '/api/v1/ingest/conversations/nope', as('luca'))).status).toBe(404);
    expect((await call(url, 'DELETE', '/api/v1/ingest/conversations/c1', as('luca'))).status).toBe(202);
    expect(await db.query(`SELECT count(*)::int AS n FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.external_id = 'c1'`)).toEqual([{ n: 0 }]);
  });
});
