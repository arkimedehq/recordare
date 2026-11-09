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
  const received: Array<{ type: string; data: { id: string; status: string; channel: string; text: string; for: unknown; user: string } }> = [];
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
    // The fields a Hermes webhook route reads (F3, connectors/hermes): the text, the channel, the holder as `for: null`.
    expect(received.find((r) => r.data.id === s.id)?.data).toMatchObject({ channel: 'messaging', for: null, user: 'marco' });
    expect(received.find((r) => r.data.id === s.id)?.data.text).toContain('medicina');
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

    // A time the person chose is kept even in the quiet hours (they asked for 23:00)…
    await intent('spegnere la caldaia', rome('23:00'), { timed: true });
    await sweep(rome('23:00'));
    const night = await state('spegnere la caldaia');
    expect(night).toMatchObject({ status: 'offered', channel: 'messaging' });
    // …anything else waits for the morning.
    await intent('ordinare il pane', rome('23:00', '2026-10-15'), { until: rome('21:00', '2026-10-16') });
    await sweep(rome('23:30', '2026-10-15'));
    const bread = await state('ordinare il pane');
    expect(bread).toMatchObject({ status: 'pending' });
    expect(bread.pushed_at).toBeNull();
  });

  it('the last chance comes before the quiet hours begin, not inside them (dev_timing g5)', async () => {
    await intent('rispondere a Sara', rome('08:30', '2026-10-17'), { timed: true }); // something given that morning
    await sweep(rome('08:30', '2026-10-17'));
    await intent('ritirare il pacco', rome('09:00', '2026-10-17'), { until: rome('23:59', '2026-10-17') });
    await sweep(rome('09:00', '2026-10-17'));
    await sweep(rome('19:45', '2026-10-17')); // 2 h 15 before the quiet hours (22:00): not yet
    expect((await state('ritirare il pacco')).status).toBe('pending');
    await sweep(rome('20:00', '2026-10-17')); // 2 h before them: the last chance
    expect((await state('ritirare il pacco')).status).toBe('offered');
  });

  it('an entity memory never pushes what is for one person on its shared channels: that waits for their presence or turn', async () => {
    const [{ id: home }] = await db.query(`SELECT person_id AS id FROM memories m JOIN persons p ON p.id = m.person_id WHERE p.display_name = 'Marco'`);
    expect(home).toBe(marco);
    await db.query(`UPDATE memories SET mode = 'entity' WHERE person_id = $1`, [marco]);
    const [eri] = await db.query(`INSERT INTO persons (memory_id, display_name) VALUES ($1, 'Eriona') RETURNING id`, [marco]);
    await db.query(`INSERT INTO intents (memory_id, kind, content, for_person_id, due_at, expires_at) VALUES ($1, 'request', 'stendere i panni', $2, $3, $4)`,
      [marco, eri.id, rome('11:00', '2026-10-16'), rome('21:00', '2026-10-16')]);
    await sweep(rome('12:00', '2026-10-16'));
    const s = await state('stendere i panni');
    expect(s).toMatchObject({ status: 'pending', channel: 'messaging' }); // where a client could push it — not to her: she has no address
    expect(await decisions(s.id)).toEqual([]); // not even considered by the clock
    await db.query(`UPDATE memories SET mode = 'personal' WHERE person_id = $1`, [marco]);
  });
});
