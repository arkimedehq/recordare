// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Timing v0 over a day (D55 F2a): the clock pushes a timed reminder at its minute on the channel noticed now, a flexible
 * ask when its hour comes, nothing in the quiet hours, less to someone who already got something today — and an owed
 * request at its last chance. Every decision is logged with its probability.
 */
import { type INestApplication } from '@nestjs/common';
import { createServer, type Server } from 'node:http';
import { DataSource } from 'typeorm';
import { InitiativeService } from '../../src/initiative/initiative.service';
import { ADMIN_KEY, call, resetSchema, startApp, startFakeEmbeddings, testEnv } from '../helpers/app';

/** A local time in Rome on 2026-10-13 (CEST, UTC+2). */
const rome = (hhmm: string, day = '2026-10-13') => new Date(`${day}T${hhmm}:00+02:00`);
const HOUR = 3_600_000;

describe('timing v0 (D55 F2a): the clock chooses the moment, every decision logged', () => {
  let app: INestApplication;
  let emb: Server;
  let receiver: Server;
  let db: DataSource;
  let marco: string;
  const received: Array<{ type: string; data: { id: string; status: string; channel: string } }> = [];
  const sweep = (at: Date) => app.get(InitiativeService).sweep(marco, at);
  const state = async (content: string) => (await db.query(
    `SELECT i.id, i.status::text, i.channel, i.pushed_at, i.timing FROM initiatives i WHERE i.text LIKE '%' || $1 || '%'`, [content]))[0];
  const decisions = async (id: string) => db.query(
    `SELECT trigger, p, threshold, delivered, features->>'reason' AS reason FROM initiative_decisions WHERE initiative_id = $1 ORDER BY at, id`, [id]);
  async function intent(content: string, due: Date, opts: { timed?: boolean; kind?: string; until?: Date } = {}): Promise<void> {
    await db.query(`INSERT INTO intents (memory_id, kind, content, due_at, expires_at, timed) VALUES ($1, $2, $3, $4, $5, $6)`,
      [marco, opts.kind ?? 'request', content, due, opts.until ?? new Date(due.getTime() + 24 * HOUR), opts.timed ?? false]);
  }
  async function plan(content: string, at: Date): Promise<void> {
    await db.query(
      `INSERT INTO episodes (memory_id, kind, content, origin, author_role, stance, audience, occurred_at, date_precision, plan_status)
       VALUES ($1, 'plan', $2, 'holder_lived', 'holder', 'stated', ARRAY[$1::uuid], $3, 'day', 'open')`, [marco, content, at]);
  }
  const delivered = async (id: string) => {
    for (let i = 0; i < 50 && !received.some((r) => r.data.id === id && r.type === 'initiative.deliver'); i++) await new Promise((r) => setTimeout(r, 100));
    return received.filter((r) => r.data.id === id).map((r) => r.type);
  };

  beforeAll(async () => {
    const fake = await startFakeEmbeddings();
    emb = fake.server;
    receiver = createServer((req, res) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => { received.push(JSON.parse(body)); res.statusCode = 204; res.end(); });
    });
    await new Promise<void>((r) => receiver.listen(0, '127.0.0.1', r));
    const { port } = receiver.address() as { port: number };
    testEnv({ EMBEDDING_BASE_URL: fake.url, WEBHOOK_ALLOW_PRIVATE: 'true', CONSOLIDATION_SCHEDULE: 'false', INITIATIVE_WORDING: 'false', INITIATIVE_DAILY_LIMIT: '20' });
    await resetSchema();
    let url: string;
    ({ app, url } = await startApp());
    db = app.get(DataSource);
    const clientId = (await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY,
      body: { name: 'A', kind: 'platform', channels: [{ kind: 'chat', reach: 'always' }, { kind: 'messaging', reach: 'always' }] } })).body.id;
    marco = (await call(url, 'POST', '/api/v1/admin/memories', { token: ADMIN_KEY, body: { displayName: 'Marco' } })).body.personId;
    await call(url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY, body: { kind: 'account', personId: marco, clientId, externalId: 'marco' } });
    await call(url, 'POST', `/api/v1/admin/clients/${clientId}/webhooks`, { token: ADMIN_KEY, body: { url: `http://127.0.0.1:${port}/h`, events: ['initiative.deliver'] } });
  });
  afterAll(async () => { await app?.close(); emb?.close(); receiver?.close(); });

  it('a timed reminder goes out at its minute on messaging; the processor knows it is coming', async () => {
    await intent('prendere la medicina', rome('09:00'), { timed: true });
    expect(await app.get(InitiativeService).timedSoon(rome('08:30'))).toEqual([expect.objectContaining({ memoryId: marco, at: rome('09:00') })]);
    await sweep(rome('08:30'));
    expect(await state('prendere la medicina')).toBeUndefined(); // not due yet
    await sweep(rome('09:00'));
    const s = await state('prendere la medicina');
    expect(s).toMatchObject({ status: 'offered', channel: 'messaging', timing: 'timed' });
    expect(new Date(s.pushed_at).toISOString()).toBe(rome('09:00').toISOString());
    expect(await delivered(s.id)).toEqual(['initiative.deliver']); // the endpoint takes the deliveries only
    expect(await decisions(s.id)).toEqual([expect.objectContaining({ trigger: 'clock', p: 1, delivered: true, reason: 'timed' })]);
  });

  it('a flexible ask waits for its hour: not before 10 in the morning, then on chat (another day: nothing else given yet)', async () => {
    await plan('Portare la bici dal meccanico', new Date(rome('09:00', '2026-10-14').getTime() - 3 * 24 * HOUR));
    await sweep(rome('09:15', '2026-10-14'));
    const before = await state('Portare la bici dal meccanico');
    expect(before).toMatchObject({ status: 'pending', channel: 'chat', timing: 'flexible' });
    await sweep(rome('11:00', '2026-10-14'));
    expect(await state('Portare la bici dal meccanico')).toMatchObject({ status: 'offered', channel: 'chat' });
    const d = await decisions(before.id);
    expect(d.map((x: { reason: string; delivered: boolean }) => [x.reason, x.delivered])).toEqual([['off_hours', false], ['moment', true]]);
    expect(d[0].p).toBeCloseTo(0.21);
  });

  it('less to whoever already got something today; an owed request at its last chance; nothing in the quiet hours', async () => {
    // A flexible request (no time asked) for today, due from 9: Marco already got the medicine today, so p is halved…
    await intent('chiamare la banca', rome('09:00'), { until: rome('21:30') });
    await sweep(rome('12:00'));
    const s = await state('chiamare la banca');
    expect(s.status).toBe('pending');
    // …until its last chance (two hours before the window ends): owed, so it goes.
    await sweep(rome('19:45'));
    expect((await state('chiamare la banca')).status).toBe('offered');
    expect((await decisions(s.id)).map((x: { reason: string }) => x.reason)).toEqual(['low', 'last_chance']);

    await intent('spegnere la caldaia', rome('23:00'), { timed: true });
    await sweep(rome('23:00'));
    const night = await state('spegnere la caldaia');
    // In the quiet hours the intent becomes an initiative due in the morning (after the quiet hours): nothing pushed now.
    expect(night).toMatchObject({ status: 'pending' });
    expect(night.pushed_at).toBeNull();
  });
});
