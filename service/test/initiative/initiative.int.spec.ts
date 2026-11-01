// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { type INestApplication } from '@nestjs/common';
import { createServer, type Server } from 'node:http';
import { DataSource } from 'typeorm';
import { InitiativeService, afterQuiet } from '../../src/initiative/initiative.service';
import { sign } from '../../src/initiative/webhooks.service';
import { ADMIN_KEY, call, resetSchema, startApp, startFakeEmbeddings, testEnv } from '../helpers/app';

interface Received { headers: Record<string, string>; body: string }

describe('initiatives (D53, 8.12c): intents from plans and questions, pushed by Standard Webhooks and read as a feed', () => {
  let app: INestApplication;
  let url: string;
  let emb: Server;
  let receiver: Server;
  let db: DataSource;
  let memoryId: string;
  let clientId: string;
  let key: string;
  let secret: string;
  const received: Received[] = [];
  const NOW = new Date('2026-10-12T10:00:00Z'); // 12:00 in Rome: outside the quiet hours
  const DAY = 86_400_000;
  const sweep = (at = NOW) => app.get(InitiativeService).sweep(memoryId, at);
  const user = { 'x-recordare-user': 'u1' };

  async function plan(content: string, at: Date, status = 'open'): Promise<string> {
    const [r] = await db.query(
      `INSERT INTO episodes (memory_id, kind, content, origin, author_role, stance, audience, occurred_at, date_precision, plan_status)
       VALUES ($1, 'plan', $2, 'holder_lived', 'holder', 'stated', ARRAY[$1::uuid], $3, 'day', $4) RETURNING id`, [memoryId, content, at, status]);
    return r.id as string;
  }
  async function delivered(n: number): Promise<Received[]> {
    for (let i = 0; i < 100 && received.length < n; i++) await new Promise((r) => setTimeout(r, 100));
    return received;
  }
  const intents = () => db.query(`SELECT kind::text, status::text, attempts, reconsider_at FROM intents WHERE memory_id = $1 ORDER BY created_at`, [memoryId]);

  beforeAll(async () => {
    const fake = await startFakeEmbeddings();
    emb = fake.server;
    receiver = createServer((req, res) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => { received.push({ headers: req.headers as Record<string, string>, body }); res.statusCode = 204; res.end(); });
    });
    await new Promise<void>((r) => receiver.listen(0, '127.0.0.1', r));
    const { port } = receiver.address() as { port: number };
    testEnv({ EMBEDDING_BASE_URL: fake.url, WEBHOOK_ALLOW_PRIVATE: 'true', INITIATIVE_DAILY_LIMIT: '3', CONSOLIDATION_SCHEDULE: 'false', INITIATIVE_WORDING: 'false' });
    await resetSchema();
    ({ app, url } = await startApp());
    db = app.get(DataSource);
    clientId = (await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'A', kind: 'platform' } })).body.id;
    key = (await call(url, 'POST', `/api/v1/admin/clients/${clientId}/keys`, { token: ADMIN_KEY, body: { scopes: ['read', 'write'] } })).body.key;
    memoryId = (await call(url, 'POST', '/api/v1/admin/memories', { token: ADMIN_KEY, body: { displayName: 'Marco', locale: 'it', timezone: 'Europe/Rome' } })).body.personId;
    await call(url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY, body: { kind: 'account', personId: memoryId, clientId, externalId: 'u1' } });
    const hook = await call(url, 'POST', `/api/v1/admin/clients/${clientId}/webhooks`, { token: ADMIN_KEY, body: { url: `http://127.0.0.1:${port}/hooks`, description: 'test' } });
    expect(hook.status).toBe(201);
    expect(hook.body.secret).toMatch(/^whsec_/);
    secret = hook.body.secret;
  });
  afterAll(async () => { await app?.close(); emb?.close(); receiver?.close(); });

  it('asks about a plan past its date, pushes it signed with the client\'s user, lists it in the feed, follows the outcome', async () => {
    await plan('Portare la macchina dal meccanico', new Date(NOW.getTime() - 3 * DAY));
    expect(await sweep()).toEqual({ armed: 1, fired: 1, expired: 0 });

    const feed = await call(url, 'GET', '/api/v1/initiatives', { token: key, headers: user });
    expect(feed.status).toBe(200);
    expect(feed.body.items).toHaveLength(1);
    const it0 = feed.body.items[0];
    expect(it0).toMatchObject({ kind: 'ask', status: 'pending', for: null });
    expect(it0.text).toContain('Portare la macchina dal meccanico');
    expect(it0.text).toContain('È andata?');
    expect(feed.body.next).toBe(it0.seq);

    const [d] = await delivered(1);
    expect(d).toBeDefined();
    const h = d!.headers;
    expect(h['webhook-id']).toMatch(/^msg_/);
    expect(h['webhook-signature']).toBe(sign(secret, h['webhook-id']!, Number(h['webhook-timestamp']), d!.body));
    const event = JSON.parse(d!.body);
    expect(event).toMatchObject({ type: 'initiative.created', data: { id: it0.id, user: 'u1', memoryId, kind: 'ask' } });

    const done = await call(url, 'POST', `/api/v1/initiatives/${it0.id}/outcome`, { token: key, headers: user, body: { status: 'asked', at: NOW.toISOString() } });
    expect(done.status).toBe(201);
    expect(done.body.status).toBe('asked');
    expect(await intents()).toEqual([expect.objectContaining({ kind: 'open_plan', status: 'done', attempts: 1 })]);
    expect((await delivered(2))[1] && JSON.parse(received[1]!.body).type).toBe('initiative.updated');

    // Asked once: a new sweep arms nothing more for that plan.
    expect(await sweep()).toEqual({ armed: 0, fired: 0, expired: 0 });
  });

  it('reminds of a plan coming up and asks the host to look up a question it holds; the daily limit holds the rest', async () => {
    await plan('Dentista alle 15', new Date(NOW.getTime() + DAY), 'confirmed');
    await db.query(`INSERT INTO notes (memory_id, category, content, origin, author_role, stance, audience, tags)
      VALUES ($1, 'question', 'Mi chiedo se Marta abbia prenotato il volo', 'reflected', 'holder', 'inferred', ARRAY[$1::uuid], '{thought}')`, [memoryId]);
    await plan('Chiamare il commercialista', new Date(NOW.getTime() - 2 * DAY)); // a third for today: over the limit of 3 with the first test's
    const r = await sweep();
    expect(r.armed).toBe(3);
    expect(r.fired).toBe(2);
    // The earliest due first: the past plan, then the reminder; the lookup (due now too, armed last) waits for tomorrow.
    const feed = await call(url, 'GET', '/api/v1/initiatives', { token: key, headers: { ...user } });
    expect(feed.body.items.map((i: { kind: string }) => i.kind).sort()).toEqual(['ask', 'ask', 'say']);
    expect(feed.body.items.find((i: { kind: string }) => i.kind === 'say').text).toContain('promemoria');
    expect((await sweep(new Date(NOW.getTime() + 4 * 3_600_000))).fired).toBe(0); // 16:00, the same day
    expect((await sweep(new Date(NOW.getTime() + DAY))).fired).toBe(1);
    const later = await call(url, 'GET', '/api/v1/initiatives', { token: key, headers: user });
    expect(later.body.items.find((i: { kind: string }) => i.kind === 'lookup').text).toContain('Vorrei scoprire');
  });

  it('an ignored initiative is offered again a week later, then no more; a lapsed one expires quietly', async () => {
    const feed = await call(url, 'GET', '/api/v1/initiatives', { token: key, headers: user, });
    const ask = feed.body.items.find((i: { text: string }) => i.text.includes('commercialista'));
    await call(url, 'POST', `/api/v1/initiatives/${ask.id}/outcome`, { token: key, headers: user, body: { status: 'ignored', at: new Date(NOW.getTime() + DAY).toISOString() } });
    const [t] = await db.query(`SELECT status::text, attempts, reconsider_at FROM intents WHERE id = (SELECT intent_id FROM initiatives WHERE id = $1)`, [ask.id]);
    expect(t).toMatchObject({ status: 'armed', attempts: 1 });
    expect(new Date(t.reconsider_at).getTime()).toBe(NOW.getTime() + 8 * DAY);
    // A week later it is asked again (its intent is kept alive past the plan's week); ignored again → cancelled. The
    // pending reminder, whose plan's time has passed, lapses in the same sweep.
    await db.query(`UPDATE intents SET expires_at = $2 WHERE id = (SELECT intent_id FROM initiatives WHERE id = $1)`, [ask.id, new Date(NOW.getTime() + 30 * DAY)]);
    const before = received.length;
    const again = await sweep(new Date(NOW.getTime() + 8 * DAY));
    expect(again).toMatchObject({ fired: 1, expired: 1 });
    const second = (await call(url, 'GET', '/api/v1/initiatives', { token: key, headers: user, body: undefined })).body.items.filter((i: { text: string; status: string }) => i.text.includes('commercialista') && i.status === 'pending');
    expect(second).toHaveLength(1);
    await call(url, 'POST', `/api/v1/initiatives/${second[0].id}/outcome`, { token: key, headers: user, body: { status: 'ignored', at: new Date(NOW.getTime() + 8 * DAY).toISOString() } });
    expect((await db.query(`SELECT status::text FROM intents WHERE id = (SELECT intent_id FROM initiatives WHERE id = $1)`, [ask.id]))[0].status).toBe('cancelled');

    const expired = (await call(url, 'GET', '/api/v1/initiatives', { token: key, headers: user, })).body.items.filter((i: { status: string }) => i.status === 'expired');
    expect(expired.map((i: { kind: string }) => i.kind)).toEqual(['say']);
    await delivered(before + 2);
    expect(received.slice(before).some((d) => JSON.parse(d.body).type === 'initiative.expired')).toBe(true);
  });

  it('quiet hours: a due initiative waits for the morning; the admin sets them', async () => {
    const r = await call(url, 'PATCH', `/api/v1/admin/memories/${memoryId}`, { token: ADMIN_KEY, body: { quietFrom: 21, quietTo: 7 } });
    expect(r.status).toBe(200);
    expect((await db.query(`SELECT quiet_from, quiet_to FROM memories WHERE person_id = $1`, [memoryId]))[0]).toEqual({ quiet_from: 21, quiet_to: 7 });
    const lateEvening = new Date('2026-10-12T21:30:00Z'); // 23:30 in Rome
    expect(afterQuiet(lateEvening, 'Europe/Rome', 22, 8).toISOString()).toBe('2026-10-13T06:00:00.000Z'); // 08:00 Rome
    expect(afterQuiet(NOW, 'Europe/Rome', 22, 8)).toBe(NOW);
    expect(afterQuiet(new Date('2026-10-12T02:00:00Z'), 'Europe/Rome', 22, 8).toISOString()).toBe('2026-10-12T06:00:00.000Z');
  });

  it('a webhook endpoint is admin-only, listed, and removed', async () => {
    const list = await call(url, 'GET', `/api/v1/admin/clients/${clientId}/webhooks`, { token: ADMIN_KEY });
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).not.toHaveProperty('secret');
    expect((await call(url, 'GET', `/api/v1/admin/clients/${clientId}/webhooks`, { token: key })).status).toBe(403);
    expect((await call(url, 'DELETE', `/api/v1/admin/webhooks/${list.body[0].id}`, { token: ADMIN_KEY })).status).toBe(204);
    expect((await call(url, 'GET', `/api/v1/admin/clients/${clientId}/webhooks`, { token: ADMIN_KEY })).body).toEqual([]);
  });
});
