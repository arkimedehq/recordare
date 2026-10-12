// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { type INestApplication } from '@nestjs/common';
import { type Server } from 'node:http';
import { DataSource } from 'typeorm';
import { ConsolidationService } from '../../src/engine/consolidation.service';
import { ReadService } from '../../src/read/read.service';
import { ADMIN_KEY, call, fakeVector, resetSchema, startApp, startFakeEmbeddings, startFakeLlm, testEnv } from '../helpers/app';

describe('recurring patterns: the memory draws, keeps, retires its own conclusions (WORK_PLAN 5.4)', () => {
  let app: INestApplication;
  let emb: Server;
  let llm: Awaited<ReturnType<typeof startFakeLlm>>;
  let db: DataSource;
  let memoryId: string;
  const NOW = new Date('2026-10-12T20:00:00Z');
  const pass = () => app.get(ConsolidationService).patternsNow(memoryId, NOW);

  async function episode(content: string, day: string, extra: { origin?: string; role?: string } = {}): Promise<string> {
    const [r] = await db.query(
      `INSERT INTO episodes (memory_id, kind, content, origin, author_role, stance, audience, occurred_at, date_precision)
       VALUES ($1, 'event', $2, $3, $4, 'stated', ARRAY[$1::uuid], $5, 'day') RETURNING id`,
      [memoryId, content, extra.origin ?? 'holder_lived', extra.role ?? 'holder', `${day}T10:00:00Z`]);
    return r.id as string;
  }
  const patterns = () => db.query(
    `SELECT n.id, n.content, n.status::text, n.pending, n.stance::text, n.tags, n.confidence, n.support_count, p.status::text AS promotion,
       (SELECT count(*)::int FROM note_evidence x WHERE x.note_id = n.id AND x.episode_id IS NOT NULL) AS episodes
     FROM episode_promotions p JOIN notes n ON n.id = p.note_id WHERE p.memory_id = $1 ORDER BY n.recorded_at`, [memoryId]);
  const asked = () => llm.requests.at(-1)?.messages[1]?.content ?? '';

  beforeAll(async () => {
    llm = await startFakeLlm();
    const fake = await startFakeEmbeddings();
    emb = fake.server;
    testEnv({ EMBEDDING_BASE_URL: fake.url, LLM_BASE_URL: llm.url });
    await resetSchema();
    let url: string;
    ({ app, url } = await startApp());
    db = app.get(DataSource);
    memoryId = (await call(url, 'POST', '/api/v1/admin/memories', { token: ADMIN_KEY, body: { displayName: 'Luca' } })).body.personId;
  });
  afterAll(async () => { await app?.close(); llm?.server.close(); emb?.close(); });

  it('writes a pattern only with three episodes on different days, never what a note already says', async () => {
    await episode('Corsa al parco', '2026-09-13');                       // E1
    await episode('Corsa al parco', '2026-09-20');                       // E2
    await episode('Corsa al parco con Marco', '2026-09-27');             // E3
    await episode('Sushi da Koi', '2026-10-01');                         // E4
    await episode('Sushi da Koi a pranzo', '2026-10-01');                // E5 (same day)
    await episode('Ti consiglio di correre ogni giorno', '2026-10-02', { origin: 'assistant_stated', role: 'assistant' });
    await episode('Corsa al parco', '2026-10-04');                       // E6
    await db.query(`INSERT INTO notes (memory_id, category, content, origin, author_role, audience, embedding)
      VALUES ($1, 'preference', 'Bevo il caffè amaro', 'holder_lived', 'holder', ARRAY[$1::uuid], $2::vector)`,
    [memoryId, `[${fakeVector('Bevo il caffè amaro').join(',')}]`]);

    llm.queue.push({ patterns: [
      { verdict: 'new', subject: 'me', category: 'habit', content: 'Corro al parco la domenica', evidence: [1, 2, 'E3'] },
      { verdict: 'new', subject: 'me', category: 'preference', content: 'Mangio spesso sushi da Koi', evidence: [4, 5, 99] },
      { verdict: 'new', subject: 'me', category: 'preference', content: 'Bevo il caffè amaro', evidence: [1, 2, 3] },
      { verdict: 'new', subject: 'Marco', category: 'habit', content: 'Marco corre la domenica', evidence: [1, 2, 3] },
    ] });
    expect(await pass()).toEqual({ calls: 1, written: 1, retired: 0, failed: 0 });
    expect(asked()).toContain('E6. [2026-10-04, Sun] Corsa al parco');
    expect(asked()).toContain('- Bevo il caffè amaro');
    expect(asked()).not.toContain('correre ogni giorno'); // the assistant's words are no evidence
    expect(await patterns()).toEqual([expect.objectContaining({ content: 'Corro al parco la domenica', status: 'current', pending: false,
      stance: 'inferred', tags: ['pattern'], support_count: 3, episodes: 3, promotion: 'active' })]);

    // Nothing new: no call.
    const before = llm.requests.length;
    expect(await pass()).toMatchObject({ calls: 0 });
    expect(llm.requests.length).toBe(before);
  });

  it('keeps a pattern with new episodes, more confident; recall labels it', async () => {
    await episode('Corsa al parco', '2026-10-11'); // E7
    llm.queue.push({ patterns: [{ verdict: 'keep', target: 'P1', evidence: [6, 7] }] });
    await pass();
    expect(asked()).toContain('P1: Corro al parco la domenica (E1, E2, E3)');
    const [p] = await patterns();
    expect(p).toMatchObject({ support_count: 5, episodes: 5 });
    expect(p.confidence).toBeCloseTo(0.85);
    const notes = await app.get(ReadService).notes(memoryId, {});
    expect(notes.find((n) => n.id === p.id)).toMatchObject({ inferred: true, pattern: true, pending: false });
  });

  it('a forgotten pattern is not drawn again from the episodes it came from', async () => {
    const [p] = await patterns();
    await app.get(ReadService).deleteRow(memoryId, 'notes', p.id);
    await episode('Cena dalla nonna', '2026-10-12');
    llm.queue.push({ patterns: [{ verdict: 'new', subject: 'me', category: 'habit', content: 'Corro al parco la domenica', evidence: [1, 2, 3, 8] }] });
    expect(await pass()).toMatchObject({ calls: 1, written: 0 });
    expect(asked()).toContain('FORGET:\n- Corro al parco la domenica');
    expect((await db.query(`SELECT status::text FROM episode_promotions WHERE memory_id = $1`, [memoryId]))[0].status).toBe('forgotten');
  });

  it('retires a pattern an episode says stopped: history, not deleted', async () => {
    const [swim] = await Promise.all([episode('Nuoto in piscina', '2026-09-15'), episode('Nuoto in piscina', '2026-09-22'), episode('Nuoto in piscina', '2026-09-29')]);
    const num = async (id: string) => {
      const rows: Array<{ id: string }> = await db.query(`SELECT id FROM episodes WHERE memory_id = $1 AND origin <> 'assistant_stated' ORDER BY occurred_at, id`, [memoryId]);
      return rows.findIndex((r) => r.id === id) + 1;
    };
    const first = await num(swim);
    llm.queue.push({ patterns: [{ verdict: 'new', subject: 'me', category: 'habit', content: 'Nuoto il martedì', evidence: [first, first + 1, first + 2] }] });
    expect(await pass()).toMatchObject({ written: 1 });

    const stop = await episode('Ho smesso di andare in piscina', '2026-10-12');
    // Retired, then proposed again from the same episodes in the same pass: not written.
    llm.queue.push({ patterns: [{ verdict: 'retire', target: 'P1', evidence: [await num(stop)] },
      { verdict: 'new', subject: 'me', category: 'habit', content: 'Nuoto il martedì', evidence: [first, first + 1, first + 2] }] });
    expect(await pass()).toMatchObject({ retired: 1, written: 0 });
    const swimming = (await patterns()).find((p: { content: string }) => p.content === 'Nuoto il martedì');
    expect(swimming).toMatchObject({ status: 'superseded', promotion: 'retired' });
    expect((await db.query(`SELECT change::text FROM note_changes WHERE note_id = $1 ORDER BY seq`, [swimming.id])).map((r: { change: string }) => r.change))
      .toEqual(['created', 'retired']);
  });

  it('a pattern left with fewer than three of its episodes is dropped', async () => {
    const days = ['2026-09-16', '2026-09-23', '2026-09-30'];
    const ids = [];
    for (const d of days) ids.push(await episode('Scacchi al circolo', d));
    const rows: Array<{ id: string }> = await db.query(`SELECT id FROM episodes WHERE memory_id = $1 AND origin <> 'assistant_stated' ORDER BY occurred_at, id`, [memoryId]);
    llm.queue.push({ patterns: [{ verdict: 'new', subject: 'me', category: 'habit', content: 'Gioco a scacchi il mercoledì',
      evidence: ids.map((id) => rows.findIndex((r) => r.id === id) + 1) }] });
    expect(await pass()).toMatchObject({ written: 1 });
    await db.query(`DELETE FROM episodes WHERE id = $1`, [ids[0]]);
    await episode('Pizza con Anna', '2026-10-12');
    llm.queue.push({ patterns: [] });
    await pass();
    expect((await patterns()).map((p: { content: string }) => p.content)).not.toContain('Gioco a scacchi il mercoledì');
  });
});
