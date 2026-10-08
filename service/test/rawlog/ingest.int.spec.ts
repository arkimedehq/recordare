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
  let ownerId: string;
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
    ownerId = (await call(url, 'POST', '/api/v1/admin/owners', { token: ADMIN_KEY, body: { displayName: 'Luca' } })).body.personId;
    await call(url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY, body: { kind: 'client_user', personId: ownerId, clientId, externalId: 'luca' } });
  });
  afterAll(async () => { await app?.close(); emb?.close(); });

  const batch = (conv: string, msgs: Array<Record<string, unknown>>, extra: Record<string, unknown> = {}) => ({
    conversation: { externalId: conv, ...extra }, messages: msgs,
  });
  const msg = (id: string, content: string, role = 'user', sentAt = '2026-01-18T19:30:00+01:00') => ({ externalId: id, role, content, sentAt });

  it('stores nothing without consent (D4)', async () => {
    const res = await call(url, 'POST', '/api/v1/ingest/messages', { ...as('luca'), body: batch('c0', [msg('m1', 'ciao')]) });
    expect(res).toMatchObject({ status: 200, body: { stored: false, accepted: 0 } });
    expect(await db.query('SELECT count(*)::int AS n FROM messages')).toEqual([{ n: 0 }]);
  });

  it('ingests idempotently, records conflicts, applies upserts as edits with revisions', async () => {
    await call(url, 'PATCH', `/api/v1/admin/owners/${ownerId}`, { token: ADMIN_KEY, body: { episodicEnabled: true } });
    const first = await call(url, 'POST', '/api/v1/ingest/messages', {
      ...as('luca'),
      body: batch('c1', [msg('m1', 'Ieri sono andato a sciare a Cervinia'), msg('m2', 'Che bello!', 'assistant', '2026-01-18T19:31:00+01:00')]),
    });
    expect(first.body).toMatchObject({ stored: true, accepted: 2, duplicates: 0, conflicts: [] });

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

    const rows = await db.query(`SELECT external_id, role, author_person_id FROM messages ORDER BY external_id`);
    expect(rows).toEqual([
      { external_id: 'm1', role: 'user', author_person_id: ownerId },
      { external_id: 'm2', role: 'assistant', author_person_id: null },
    ]);
    // Implicit owner participant.
    expect(await db.query(`SELECT ref, role, person_id FROM conversation_participants`)).toEqual([{ ref: 'owner', role: 'owner', person_id: ownerId }]);
  });

  it('rejects system messages and malformed batches', async () => {
    const res = await call(url, 'POST', '/api/v1/ingest/messages', { ...as('luca'), body: batch('c2', [msg('s1', 'secret prompt', 'system')]) });
    expect(res).toMatchObject({ status: 400, body: { code: 'invalid_request' } });
    expect((await call(url, 'POST', '/api/v1/ingest/messages', { token: ADMIN_KEY, body: batch('c2', [msg('x', 'y')]) })).status).toBe(403);
  });

  it('resolves only verified identities to persons (audience)', async () => {
    const marco = (await call(url, 'POST', '/api/v1/admin/owners', { token: ADMIN_KEY, body: { displayName: 'tmp' } })).body.personId;
    await db.query(`UPDATE persons SET owner_scope = $1 WHERE id = $2`, [ownerId, marco]);
    await db.query(`DELETE FROM owners WHERE person_id = $1`, [marco]);
    await call(url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY, body: { kind: 'channel', personId: marco, ownerScope: ownerId, channel: 'telegram', externalId: '111', verified: true } });

    await call(url, 'POST', '/api/v1/ingest/messages', {
      ...as('luca'),
      body: batch('group', [msg('g1', 'Ciao a tutti')], {
        participants: [
          { ref: 'marco', role: 'other', displayName: 'Marco', identity: { channel: 'telegram', externalId: '111' } },
          { ref: 'stranger', role: 'other', displayName: 'Tizio', identity: { channel: 'telegram', externalId: '999' } },
        ],
      }),
    });
    const parts = await db.query(
      `SELECT p.ref, p.person_id FROM conversation_participants p JOIN conversations c ON c.id = p.conversation_id
       WHERE c.external_id = 'group' ORDER BY p.ref`);
    expect(parts).toEqual([
      { ref: 'marco', person_id: marco },
      { ref: 'owner', person_id: ownerId },
      { ref: 'stranger', person_id: null },
    ]);
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
