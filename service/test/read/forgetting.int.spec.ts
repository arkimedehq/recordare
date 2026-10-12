// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { type INestApplication } from '@nestjs/common';
import { type Server } from 'node:http';
import { DataSource } from 'typeorm';
import { ADMIN_KEY, call, resetSchema, startApp, startFakeEmbeddings, testEnv } from '../helpers/app';

describe('forgetting takes what only it supported (D16, WORK_PLAN 5.5)', () => {
  let app: INestApplication;
  let url: string;
  let emb: Server;
  let key: string;
  let db: DataSource;
  const as = (user: string) => ({ token: key, headers: { 'x-recordare-user': user } });
  const prov = `'holder_lived', 'holder', 'stated', 1, 'holder', ARRAY[$1::uuid]`;

  /** A memory with a chat of messages (externalId → text, sent on the given day). */
  async function memory(user: string, messages: Array<[string, string, string]>) {
    await call(url, 'POST', '/api/v1/ingest/messages', { ...as(user), body: { conversation: { externalId: 'chat' }, messages:
      messages.map(([externalId, content, day]) => ({ externalId, role: 'user', content, sentAt: `${day}T10:00:00+02:00` })) } });
    const memoryId: string = (await call(url, 'GET', '/api/v1/me', as(user))).body.memoryId;
    const msg = async (externalId: string): Promise<string> =>
      (await db.query(`SELECT id FROM messages WHERE memory_id = $1 AND external_id = $2`, [memoryId, externalId]))[0].id;
    const episode = async (content: string, day: string, evidence: string[], extra: { kind?: string; planStatus?: string } = {}) => {
      const [row] = await db.query(
        `INSERT INTO episodes (memory_id, kind, content, occurred_at, date_precision, plan_status, origin, author_role, stance, confidence, disclosure, audience)
         VALUES ($1, $2, $3, $4, 'day', $5, ${prov}) RETURNING id`,
        [memoryId, extra.kind ?? 'event', content, day, extra.planStatus ?? null]);
      for (const m of evidence) await db.query(`INSERT INTO episode_evidence (episode_id, message_id) VALUES ($1, $2)`, [row.id, await msg(m)]);
      return row.id as string;
    };
    const fact = async (value: string, evidence: { messages?: string[]; episodes?: string[] }, extra: { status?: string; supersedes?: string } = {}) => {
      await db.query(`INSERT INTO fact_slots (key, description) VALUES ('city', 'city') ON CONFLICT DO NOTHING`);
      const [row] = await db.query(
        `INSERT INTO facts (memory_id, key, value, status, supersedes, origin, author_role, stance, confidence, disclosure, audience)
         VALUES ($1, 'city', $2, $3, $4, ${prov}) RETURNING id`, [memoryId, value, extra.status ?? 'current', extra.supersedes ?? null]);
      for (const m of evidence.messages ?? []) await db.query(`INSERT INTO fact_evidence (fact_id, message_id) VALUES ($1, $2)`, [row.id, await msg(m)]);
      for (const e of evidence.episodes ?? []) await db.query(`INSERT INTO fact_evidence (fact_id, episode_id) VALUES ($1, $2)`, [row.id, e]);
      return row.id as string;
    };
    const note = async (content: string, evidence: string[]) => {
      const [row] = await db.query(`INSERT INTO notes (memory_id, category, content, origin, author_role, stance, confidence, disclosure, audience)
        VALUES ($1, 'preference', $2, ${prov}) RETURNING id`, [memoryId, content]);
      for (const m of evidence) await db.query(`INSERT INTO note_evidence (note_id, message_id) VALUES ($1, $2)`, [row.id, await msg(m)]);
      return row.id as string;
    };
    const exists = async (table: string, id: string) => (await db.query(`SELECT 1 FROM ${table} WHERE id = $1`, [id])).length === 1;
    return { memoryId, msg, episode, fact, note, exists };
  }

  beforeAll(async () => {
    const fake = await startFakeEmbeddings();
    emb = fake.server;
    testEnv({ EMBEDDING_BASE_URL: fake.url, IDLE_DELAY_SECONDS: '3600' });
    await resetSchema();
    ({ app, url } = await startApp());
    db = app.get(DataSource);
    const client = (await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'P', kind: 'platform', autoProvision: true } })).body;
    key = (await call(url, 'POST', `/api/v1/admin/clients/${client.id}/keys`, { token: ADMIN_KEY, body: { scopes: ['ingest', 'read', 'write'] } })).body.key;
  });
  afterAll(async () => { await app?.close(); emb?.close(); });

  it('a deleted message takes what only it supported; the older fact it replaced is current again, a plan reopens', async () => {
    const m = await memory('u1', [
      ['a', 'Abito a Torino', '2026-09-01'],
      ['b', 'Mi sono trasferita a Milano, e ieri cena da Luca', '2026-10-02'],
      ['c', 'La cena da Luca è stata bellissima', '2026-10-03'],
      ['d', 'Il caffè lo prendo amaro', '2026-10-02'],
    ]);
    const torino = await m.fact('Torino', { messages: ['a'] }, { status: 'superseded' });
    const milano = await m.fact('Milano', { messages: ['b'] }, { supersedes: torino });
    const move = await m.episode('Trasloco a Milano', '2026-10-02', ['b']);
    const dinner = await m.episode('Cena da Luca', '2026-10-01', ['b', 'c']);
    const plan = await m.episode('Cena da Luca', '2026-10-01', ['a'], { kind: 'plan', planStatus: 'confirmed' });
    const done = await m.episode('Cena da Luca fatta', '2026-10-01', ['b']);
    await db.query(`UPDATE episodes SET confirmed_by = $1 WHERE id = $2`, [done, plan]);
    await db.query(`INSERT INTO plan_events (plan_id, patch, evidence_message_id) VALUES ($1, 'confirm', $2)`, [plan, await m.msg('b')]);
    const coffee = await m.note('Caffè amaro', ['b', 'd']);
    const moving = await m.note('Ama i traslochi', ['b']);
    const [digest] = await db.query(`INSERT INTO digests (memory_id, level, period_start, period_end, content, audience)
      VALUES ($1, 'day', '2026-10-02', '2026-10-02', 'Trasloco.', ARRAY[$1::uuid]) RETURNING id`, [m.memoryId]);
    await db.query(`INSERT INTO digest_sources (digest_id, episode_id) VALUES ($1, $2)`, [digest.id, move]);

    expect((await call(url, 'DELETE', '/api/v1/ingest/conversations/chat/messages/b', as('u1'))).status).toBe(202);

    expect(await m.exists('facts', milano)).toBe(false);
    expect((await db.query(`SELECT status, valid_to, expired_at FROM facts WHERE id = $1`, [torino]))[0])
      .toEqual({ status: 'current', valid_to: null, expired_at: null });
    expect(await m.exists('episodes', move)).toBe(false);
    expect(await m.exists('episodes', done)).toBe(false);
    expect(await m.exists('episodes', dinner)).toBe(true); // still told by message c
    expect((await db.query(`SELECT plan_status, confirmed_by FROM episodes WHERE id = $1`, [plan]))[0]).toEqual({ plan_status: 'open', confirmed_by: null });
    expect(await m.exists('notes', coffee)).toBe(true);
    expect(await m.exists('notes', moving)).toBe(false);
    expect((await db.query(`SELECT change::text FROM note_changes WHERE note_id = $1`, [moving])).map((r: { change: string }) => r.change)).toEqual(['forgotten']);
    expect((await db.query(`SELECT superseded_at FROM digests WHERE id = $1`, [digest.id]))[0].superseded_at).not.toBeNull();
  });

  it('a deleted conversation takes the episodes it alone told', async () => {
    const m = await memory('u2', [['a', 'Sono andata al mare', '2026-10-02']]);
    const sea = await m.episode('Al mare', '2026-10-02', ['a']);
    expect((await call(url, 'DELETE', '/api/v1/ingest/conversations/chat', as('u2'))).status).toBe(202);
    expect(await m.exists('episodes', sea)).toBe(false);
  });

  it('a forgotten episode takes the facts drawn from it, not those drawn from the same message', async () => {
    const m = await memory('u3', [['a', 'Mi sono trasferita a Milano per il nuovo lavoro', '2026-10-02']]);
    const move = await m.episode('Trasloco a Milano', '2026-10-02', ['a']);
    const fromEpisode = await m.fact('Milano', { episodes: [move] });
    const fromMessage = await m.note('Nuovo lavoro', ['a']);
    expect((await call(url, 'DELETE', `/api/v1/episodes/${move}`, as('u3'))).status).toBe(204);
    expect(await m.exists('facts', fromEpisode)).toBe(false);
    expect(await m.exists('notes', fromMessage)).toBe(true);
  });

  it('forgets a period: its episodes, its messages and what only they supported, behind a period tombstone', async () => {
    const m = await memory('u4', [
      ['a', 'Domani parto per Roma', '2026-09-30'],
      ['b', 'Roma è stupenda', '2026-10-02'],
      ['c', 'A novembre vado a Parigi', '2026-10-03'],
      ['d', 'Tornata a casa', '2026-10-06'],
    ]);
    const trip = await m.episode('Viaggio a Roma', '2026-10-02', ['a', 'b']);
    const paris = await m.episode('Viaggio a Parigi', '2026-11-10', ['c'], { kind: 'plan', planStatus: 'open' });
    const home = await m.episode('Ritorno a casa', '2026-10-06', ['d']);
    const city = await m.fact('Parigi', { messages: ['c'] });

    expect((await call(url, 'POST', '/api/v1/forget', { ...as('u4'), body: { from: '2026-10-05', to: '2026-10-01' } })).status).toBe(400);
    const res = await call(url, 'POST', '/api/v1/forget', { ...as('u4'), body: { from: '2026-10-01', to: '2026-10-05' } });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ episodes: 2, messages: 2, facts: 1, notes: 0 });
    expect(await m.exists('episodes', trip)).toBe(false);   // took place in the period
    expect(await m.exists('episodes', paris)).toBe(false);  // told only by a message of the period
    expect(await m.exists('episodes', home)).toBe(true);
    expect(await m.exists('facts', city)).toBe(false);
    const left = (await db.query(`SELECT external_id FROM messages WHERE memory_id = $1 ORDER BY external_id`, [m.memoryId])).map((r: { external_id: string }) => r.external_id);
    expect(left).toEqual(['a', 'd']); // a is the trip's evidence but was sent before: hidden by the tombstone, not deleted
    const [t] = await db.query(`SELECT message_ids FROM forget_tombstones WHERE memory_id = $1 AND scope = 'period'`, [m.memoryId]);
    expect(t.message_ids).toContain(await m.msg('a'));
  });

  it('forgets a period keeping its raw messages: hidden and supporting nothing', async () => {
    const m = await memory('u5', [['a', 'Ho visto Giulia', '2026-08-10'], ['b', 'Giulia mi ha detto che si sposa', '2026-08-20']]);
    const news = await m.episode('Giulia si sposa', '2026-09-30', ['b']);
    const res = await call(url, 'POST', '/api/v1/forget', { ...as('u5'), body: { from: '2026-08', to: '2026-08', keepRaw: true } });
    expect(res.body).toEqual({ episodes: 1, messages: 2, facts: 0, notes: 0 });
    expect(await m.exists('episodes', news)).toBe(false);
    expect((await db.query(`SELECT count(*)::int AS n FROM messages WHERE memory_id = $1`, [m.memoryId]))[0].n).toBe(2);
    const [t] = await db.query(`SELECT message_ids FROM forget_tombstones WHERE memory_id = $1 AND scope = 'period'`, [m.memoryId]);
    expect(t.message_ids).toEqual(expect.arrayContaining([await m.msg('a'), await m.msg('b')]));
  });
});
