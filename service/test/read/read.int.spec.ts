// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { type INestApplication } from '@nestjs/common';
import { type Server } from 'node:http';
import { DataSource } from 'typeorm';
import { ADMIN_KEY, call, resetSchema, startApp, startFakeEmbeddings, testEnv } from '../helpers/app';

describe('read / write API for host UIs — the diary (API.md §4, WORK_PLAN 4.7)', () => {
  let app: INestApplication;
  let url: string;
  let emb: Server;
  let key: string;
  let otherKey: string;
  let ownerId: string;
  const NOW = '2026-10-08T10:00:00+02:00';
  const as = (k: string, user = 'u1') => ({ token: k, headers: { 'x-recordare-user': user, 'x-recordare-now': NOW } });

  beforeAll(async () => {
    const fake = await startFakeEmbeddings();
    emb = fake.server;
    testEnv({ EMBEDDING_BASE_URL: fake.url, IDLE_DELAY_SECONDS: '3600', ALLOW_CLOCK_OVERRIDE: 'true' });
    await resetSchema();
    ({ app, url } = await startApp());
    const client = (await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'P', kind: 'platform', autoProvision: true } })).body;
    key = (await call(url, 'POST', `/api/v1/admin/clients/${client.id}/keys`, { token: ADMIN_KEY, body: { scopes: ['ingest', 'read', 'write'] } })).body.key;
    const other = (await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'Other', kind: 'platform' } })).body;
    otherKey = (await call(url, 'POST', `/api/v1/admin/clients/${other.id}/keys`, { token: ADMIN_KEY, body: { scopes: ['read'] } })).body.key;
    ownerId = (await call(url, 'GET', '/api/v1/me', as(key))).body.ownerId;
    await call(url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY, body: { kind: 'account', personId: ownerId, clientId: other.id, externalId: 'u1' } });
    await call(url, 'POST', '/api/v1/ingest/messages', { ...as(key), body: { conversation: { externalId: 'chat-1' }, messages: [
      { externalId: 'm1', role: 'user', content: 'Sabato sono andata a Bologna con Marco', sentAt: '2026-10-05T10:00:00+02:00' },
    ] } });

    const db = app.get(DataSource);
    const prov = `'owner_lived', 'owner', 'stated', 1, 'owner', ARRAY[$1::uuid]`;
    const ep = async (kind: string, content: string, at: string, extra = '') => (await db.query(
      `INSERT INTO episodes (owner_id, kind, content, occurred_at, date_precision, plan_status, origin, author_role, stance, confidence, disclosure, audience${extra ? ', corrects' : ''})
       VALUES ($1, $2, $3, $4, 'day', ${kind === 'plan' ? "'open'" : 'NULL'}, ${prov}${extra ? `, '${extra}'` : ''}) RETURNING id`, [ownerId, kind, content, at]))[0].id as string;
    const wrong = await ep('event', 'Gita a Modena con Marco', '2026-10-03');
    await db.query(`UPDATE episodes SET invalidated_at = now() WHERE id = $1`, [wrong]);
    const trip = await ep('event', 'Gita a Bologna con Marco', '2026-10-03', wrong);
    const msg = (await db.query(`SELECT id FROM messages WHERE external_id = 'm1'`))[0].id;
    await db.query(`INSERT INTO episode_evidence (episode_id, message_id, evidence_kind) VALUES ($1, $2, 'message')`, [trip, msg]);
    await db.query(`INSERT INTO episode_people (episode_id, alias) VALUES ($1, 'Marco')`, [trip]);
    await ep('plan', 'Dentista', '2026-10-01');           // past and never confirmed → unresolved
    await ep('plan', 'Cena da Luca', '2026-10-09');      // upcoming → open
    for (let i = 0; i < 4; i++) await ep('event', `Corsa ${i}`, `2026-09-2${i}`);
    await db.query(`INSERT INTO fact_slots (key, description) VALUES ('car', 'car') ON CONFLICT DO NOTHING`);
    const old = (await db.query(`INSERT INTO facts (owner_id, key, value, status, valid_from, valid_to, origin, author_role, stance, confidence, disclosure, audience)
      VALUES ($1, 'car', 'Fiat Panda', 'superseded', '2020-01-01', '2026-10-03', ${prov}) RETURNING id`, [ownerId]))[0].id;
    await db.query(`INSERT INTO facts (owner_id, key, value, valid_from, supersedes, origin, author_role, stance, confidence, disclosure, audience)
      VALUES ($1, 'car', 'Toyota Yaris', '2026-10-03', $2, ${prov})`, [ownerId, old]);
    await db.query(`INSERT INTO notes (owner_id, category, content, pending, origin, author_role, stance, confidence, disclosure, audience)
      VALUES ($1, 'preference', 'Prende il caffè amaro', false, ${prov}), ($1, 'habit', 'Forse corre il sabato', true, 'owner_lived', 'other', 'inferred', 0.6, 'owner', ARRAY[$1::uuid])`, [ownerId]);
    await db.query(`INSERT INTO digests (owner_id, level, period_start, period_end, content, audience) VALUES ($1, 'day', '2026-10-03', '2026-10-03', 'Gita a Bologna.', ARRAY[$1::uuid])`, [ownerId]);
  });
  afterAll(async () => { await app?.close(); emb?.close(); });

  it('pages the timeline newest first, with filters, plan statuses and corrections hidden', async () => {
    const first = (await call(url, 'GET', '/api/v1/episodes?limit=3', as(key))).body;
    expect(first.items.map((i: { content: string }) => i.content)).toEqual(['Cena da Luca', 'Gita a Bologna con Marco', 'Dentista']);
    expect(first.items[0].planStatus).toBe('open');
    expect(first.items[2].planStatus).toBe('unresolved');
    expect(first.items[1]).toMatchObject({ occurredAt: '2026-10-03', people: ['Marco'], corrected: true });
    const next = (await call(url, 'GET', `/api/v1/episodes?limit=3&cursor=${first.nextCursor}`, as(key))).body;
    expect(next.items.map((i: { content: string }) => i.content)).toEqual(['Corsa 3', 'Corsa 2', 'Corsa 1']);
    const all = (await call(url, 'GET', '/api/v1/episodes?limit=50', as(key))).body.items.map((i: { content: string }) => i.content);
    expect(all).not.toContain('Gita a Modena con Marco'); // the wrong version lives only in the detail's history
    expect((await call(url, 'GET', '/api/v1/episodes?q=Bologna', as(key))).body.items).toHaveLength(1);
    expect((await call(url, 'GET', '/api/v1/episodes?from=2026-09-21&to=2026-09-22', as(key))).body.items).toHaveLength(2);
    expect((await call(url, 'GET', '/api/v1/episodes?planStatus=unresolved', as(key))).body.items.map((i: { content: string }) => i.content)).toEqual(['Dentista']);
    expect((await call(url, 'GET', '/api/v1/plans', as(key))).body.map((i: { content: string }) => i.content)).toEqual(['Dentista', 'Cena da Luca']);
    expect((await call(url, 'GET', '/api/v1/episodes?kind=nonsense', as(key))).status).toBe(400);
  });

  it('shows an episode with its evidence (quotes only from the client\'s own chats) and the version it corrected', async () => {
    const id = (await call(url, 'GET', '/api/v1/episodes?q=Bologna', as(key))).body.items[0].id;
    const detail = (await call(url, 'GET', `/api/v1/episodes/${id}`, as(key))).body;
    expect(detail.evidence).toEqual([expect.objectContaining({ conversation: 'chat-1', text: 'Sabato sono andata a Bologna con Marco' })]);
    expect(detail.history).toEqual([expect.objectContaining({ content: 'Gita a Modena con Marco' })]);
    const seenByOther = (await call(url, 'GET', `/api/v1/episodes/${id}`, as(otherKey))).body;
    expect(seenByOther.evidence).toEqual([expect.objectContaining({ otherClient: true })]);
    expect(JSON.stringify(seenByOther.evidence)).not.toContain('Bologna');
  });

  it('serves the diary, facts with history and as of a date, notes and pending items', async () => {
    expect((await call(url, 'GET', '/api/v1/digests?level=day', as(key))).body).toEqual([expect.objectContaining({ periodStart: '2026-10-03', content: 'Gita a Bologna.' })]);
    const [car] = (await call(url, 'GET', '/api/v1/facts', as(key))).body;
    expect(car).toMatchObject({ key: 'car', value: 'Toyota Yaris', validFrom: '2026-10-03' });
    expect(car.history.map((h: { value: string }) => h.value)).toEqual(['Fiat Panda', 'Toyota Yaris']);
    expect((await call(url, 'GET', '/api/v1/facts?asOf=2025-06-01', as(key))).body[0].value).toBe('Fiat Panda');
    expect((await call(url, 'GET', '/api/v1/notes', as(key))).body.map((n: { content: string }) => n.content)).toEqual(['Prende il caffè amaro']);
    const pending = (await call(url, 'GET', '/api/v1/notes?includePending=true', as(key))).body.find((n: { pending: boolean }) => n.pending);
    expect(pending).toMatchObject({ content: 'Forse corre il sabato', inferred: true });
  });

  it('lets the person correct and forget episodes, pin, confirm and delete notes — with the write scope only', async () => {
    const id = (await call(url, 'GET', '/api/v1/episodes?q=Cena', as(key))).body.items[0].id;
    expect((await call(url, 'POST', `/api/v1/episodes/${id}/corrections`, { ...as(otherKey), body: { occurredAt: '2026-10-10' } })).status).toBe(403);
    const fixed = (await call(url, 'POST', `/api/v1/episodes/${id}/corrections`, { ...as(key), body: { occurredAt: '2026-10-10' } })).body.id;
    expect((await call(url, 'GET', `/api/v1/episodes/${fixed}`, as(key))).body).toMatchObject({ occurredAt: '2026-10-10', corrected: true });
    expect((await call(url, 'DELETE', `/api/v1/episodes/${fixed}`, as(key))).status).toBe(204);
    expect((await call(url, 'GET', '/api/v1/episodes?q=Cena', as(key))).body.items).toHaveLength(0);

    const notes = (await call(url, 'GET', '/api/v1/notes?includePending=true', as(key))).body;
    const coffee = notes.find((n: { content: string }) => n.content.includes('caffè')).id;
    const run = notes.find((n: { pending: boolean }) => n.pending).id;
    expect((await call(url, 'PATCH', `/api/v1/notes/${coffee}`, { ...as(key), body: { pinned: true } })).status).toBe(204);
    expect((await call(url, 'POST', `/api/v1/notes/${run}/confirm`, as(key))).status).toBe(204);
    const after = (await call(url, 'GET', '/api/v1/notes', as(key))).body;
    expect(after.map((n: { content: string; pinned: boolean; pending: boolean }) => [n.content, n.pinned, n.pending])).toEqual([
      ['Prende il caffè amaro', true, false], ['Forse corre il sabato', false, false],
    ]);
    expect((await call(url, 'DELETE', `/api/v1/notes/${coffee}`, as(key))).status).toBe(204);
    expect((await call(url, 'DELETE', `/api/v1/notes/${coffee}`, as(key))).status).toBe(404);
  });

  it('is the person\'s own: an unknown user gets 404, the admin key is refused', async () => {
    expect((await call(url, 'GET', '/api/v1/episodes', as(otherKey, 'stranger'))).status).toBe(404);
    expect((await call(url, 'GET', '/api/v1/episodes', { token: ADMIN_KEY })).status).toBe(403);
  });
});
