// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { type INestApplication } from '@nestjs/common';
import { type Server } from 'node:http';
import { DataSource } from 'typeorm';
import { ADMIN_KEY, call, resetSchema, startApp, startFakeEmbeddings, testEnv } from '../helpers/app';

/**
 * The admin's view of a memory's items (D52: the Recordare admin reads and forgets everything): in an entity memory, where
 * the account reads the public only, the admin lists the private items too, marked whose they are; claims apart; forgets
 * an episode, a fact, a note. Any other credential is refused.
 */
describe('admin: a memory\'s episodes, facts and notes', () => {
  let app: INestApplication;
  let url: string;
  let emb: Server;
  let db: DataSource;
  let key: string;
  let memoryId: string;
  const ids: Record<string, string> = {};
  const as = { token: '', headers: { 'x-recordare-user': 'u1' } };
  const admin = (path: string, method = 'GET') => call(url, method, `/api/v1/admin/memories/${memoryId}/${path}`, { token: ADMIN_KEY });

  beforeAll(async () => {
    const fake = await startFakeEmbeddings();
    emb = fake.server;
    testEnv({ EMBEDDING_BASE_URL: fake.url, IDLE_DELAY_SECONDS: '3600' });
    await resetSchema();
    ({ app, url } = await startApp());
    db = app.get(DataSource);
    const client = (await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'P', kind: 'platform', autoProvision: true } })).body;
    key = (await call(url, 'POST', `/api/v1/admin/clients/${client.id}/keys`, { token: ADMIN_KEY, body: { scopes: ['ingest', 'read', 'write'] } })).body.key;
    as.token = key;
    await call(url, 'GET', '/api/v1/me', as);
    await call(url, 'PATCH', '/api/v1/me', { ...as, body: { mode: 'entity' } });
    await call(url, 'POST', '/api/v1/ingest/messages', { ...as, body: {
      conversation: { externalId: 'c', participants: [{ ref: 'marta', role: 'other', displayName: 'Marta', identity: { channel: 'tg', externalId: 'marta' } }] },
      messages: [
        { externalId: 'm1', role: 'other', authorRef: 'marta', content: 'Ho un debito con la banca', sentAt: '2026-10-05T10:00:00+02:00', private: true },
        { externalId: 'm2', role: 'other', authorRef: 'marta', content: 'Domani piove', sentAt: '2026-10-05T10:01:00+02:00' },
      ] } });
    memoryId = (await call(url, 'GET', '/api/v1/me', as)).body.memoryId;
    const msg = Object.fromEntries((await db.query(`SELECT external_id, id FROM messages WHERE memory_id = $1`, [memoryId]))
      .map((r: { external_id: string; id: string }) => [r.external_id, r.id]));
    const prov = (role: string) => `'holder_lived', '${role}', 'stated', 1, 'holder', ARRAY[$1::uuid]`;
    for (const [name, content, role, m] of [['secret', 'Marta ha un debito', 'holder', 'm1'], ['open', 'Domani piove', 'holder', 'm2'],
      ['claim', 'Marta dice che domani piove', 'other', 'm2']] as const) {
      const [e] = await db.query(`INSERT INTO episodes (memory_id, kind, content, occurred_at, date_precision, origin, author_role, stance, confidence, disclosure, audience)
        VALUES ($1, 'event', $2, '2026-10-05', 'day', ${prov(role)}) RETURNING id`, [memoryId, content]);
      await db.query(`INSERT INTO episode_evidence (episode_id, message_id) VALUES ($1, $2)`, [e.id, msg[m]]);
      ids[name] = e.id;
    }
    await db.query(`INSERT INTO fact_slots (key, description) VALUES ('debt', 'debt') ON CONFLICT DO NOTHING`);
    const [fact] = await db.query(`INSERT INTO facts (memory_id, key, value, subject_kind, origin, author_role, stance, confidence, disclosure, audience)
      VALUES ($1, 'debt', 'banca', 'self', ${prov('holder')}) RETURNING id`, [memoryId]);
    await db.query(`INSERT INTO fact_evidence (fact_id, message_id) VALUES ($1, $2)`, [fact.id, msg.m1]);
    const [note] = await db.query(`INSERT INTO notes (memory_id, category, content, subject_kind, origin, author_role, stance, confidence, disclosure, audience)
      VALUES ($1, 'profile', 'Marta è preoccupata', 'self', ${prov('holder')}) RETURNING id`, [memoryId]);
    await db.query(`INSERT INTO note_evidence (note_id, episode_id) VALUES ($1, $2)`, [note.id, ids.secret]);
    ids.fact = fact.id; ids.note = note.id;
  });
  afterAll(async () => { await app?.close(); emb?.close(); });

  it('lists everything, private items marked, claims apart — where the account reads the public only', async () => {
    const account = (await call(url, 'GET', '/api/v1/episodes', as)).body.items.map((e: { id: string }) => e.id);
    expect(account).not.toContain(ids.secret);

    const own = (await admin('episodes?source=own')).body.items as Array<{ id: string; private?: { by: string[] } }>;
    expect(own.map((e) => e.id).sort()).toEqual([ids.secret, ids.open].sort());
    expect(own.find((e) => e.id === ids.secret)?.private).toEqual({ by: ['Marta'] });
    expect(own.find((e) => e.id === ids.open)?.private).toBeUndefined();
    expect((await admin('episodes?source=claims')).body.items.map((e: { id: string }) => e.id)).toEqual([ids.claim]);
    expect((await admin('episodes')).body.items).toHaveLength(3);

    const facts = (await admin('facts')).body as Array<{ id: string; private?: { by: string[] } }>;
    expect(facts.map((f) => [f.id, f.private])).toEqual([[ids.fact, { by: ['Marta'] }]]);
    const notes = (await admin('notes')).body as Array<{ id: string; private?: { by: string[] } }>;
    expect(notes.map((n) => [n.id, n.private])).toEqual([[ids.note, { by: ['Marta'] }]]);
  });

  it('only the admin: a client key is refused', async () => {
    expect((await call(url, 'GET', `/api/v1/admin/memories/${memoryId}/episodes`, { token: key })).status).toBe(403);
    expect((await call(url, 'DELETE', `/api/v1/admin/memories/${memoryId}/episodes/${ids.open}`, { token: key })).status).toBe(403);
  });

  it('forgets an episode, a fact and a note; another memory\'s id is not found', async () => {
    expect((await admin(`episodes/${ids.claim}`, 'DELETE')).status).toBe(204);
    expect((await admin(`facts/${ids.fact}`, 'DELETE')).status).toBe(204);
    expect((await admin(`notes/${ids.note}`, 'DELETE')).status).toBe(204);
    expect((await admin('episodes?source=claims')).body.items).toEqual([]);
    expect((await admin('facts')).body).toEqual([]);
    expect((await admin('notes')).body).toEqual([]);
    expect((await call(url, 'DELETE', `/api/v1/admin/memories/00000000-0000-4000-8000-000000000000/episodes/${ids.open}`, { token: ADMIN_KEY })).status).toBe(404);
  });
});
