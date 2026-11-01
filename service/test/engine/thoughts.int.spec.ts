// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { type INestApplication } from '@nestjs/common';
import { type Server } from 'node:http';
import { DataSource } from 'typeorm';
import { ConsolidationService } from '../../src/engine/consolidation.service';
import { ReadService } from '../../src/read/read.service';
import { ADMIN_KEY, call, resetSchema, startApp, startFakeEmbeddings, startFakeLlm, testEnv } from '../helpers/app';

describe('the agent\'s own thoughts: drawn from new episodes, backed, weakened and retired (D53, 8.12a)', () => {
  let app: INestApplication;
  let emb: Server;
  let llm: Awaited<ReturnType<typeof startFakeLlm>>;
  let db: DataSource;
  let memoryId: string;
  const NOW = new Date('2026-10-12T20:00:00Z');
  const pass = () => app.get(ConsolidationService).thoughtsNow(memoryId, NOW);

  async function episode(content: string, day: string, extra: { origin?: string; role?: string; importance?: number } = {}): Promise<string> {
    const [r] = await db.query(
      // Recorded now, after the pass's "now" as in an evaluation run: the episodes are bounded by when they happened.
      `INSERT INTO episodes (memory_id, kind, content, origin, author_role, stance, audience, occurred_at, date_precision, importance)
       VALUES ($1, 'event', $2, $3, $4, 'stated', ARRAY[$1::uuid], $5, 'day', $6) RETURNING id`,
      [memoryId, content, extra.origin ?? 'holder_lived', extra.role ?? 'holder', `${day}T10:00:00Z`, extra.importance ?? 5]);
    return r.id as string;
  }
  const thoughts = () => db.query(
    `SELECT n.content, n.category::text, n.origin::text, n.status::text, n.tags, n.support_count, n.confidence, n.subject_kind::text, p.status::text AS promotion
     FROM episode_promotions p JOIN notes n ON n.id = p.note_id WHERE p.memory_id = $1 AND p.kind = 'thought' ORDER BY n.recorded_at`, [memoryId]);
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
    memoryId = (await call(url, 'POST', '/api/v1/admin/memories', { token: ADMIN_KEY, body: { displayName: 'Marco' } })).body.personId;
  });
  afterAll(async () => { await app?.close(); llm?.server.close(); emb?.close(); });

  it('thinks only when enough new importance gathered, and keeps a thought only with its evidence', async () => {
    await episode('Ho corso 18 km, il giorno dopo il ginocchio mi faceva male', '2026-09-20', { importance: 4 });
    expect(await pass()).toMatchObject({ calls: 0 }); // 4 < the threshold: no call
    await episode('Corsa lunga di 20 km; oggi ginocchio dolorante', '2026-09-27', { importance: 5 });
    await episode('Ti consiglio scarpe nuove', '2026-09-28', { origin: 'assistant_stated', role: 'assistant', importance: 9 });
    await episode('Cena da Giulia', '2026-10-01', { importance: 6 });
    await episode('Promosso a responsabile del team', '2026-10-05', { importance: 8 });
    llm.queue.push({ thoughts: [
      { verdict: 'new', kind: 'insight', subject: 'me', content: 'Penso che le corse oltre 15 km mi facciano male al ginocchio: meglio uscite più corte o farlo vedere',
        evidence: ['E1', 2], confidence: 'high' },
      { verdict: 'new', kind: 'opinion', subject: 'me', content: 'La promozione mi cambierà la vita', evidence: [4] }, // one day only
      { verdict: 'new', kind: 'question', subject: 'Giulia', content: 'Mi chiedo come stia Giulia', evidence: [3] }, // a question: one day is enough
    ] });
    expect(await pass()).toEqual({ calls: 1, written: 2, retired: 0, failed: 0 });
    expect(asked()).toContain('E4*. [2026-10-05] Promosso a responsabile del team');
    expect(asked()).not.toContain('scarpe nuove'); // the assistant's words are no evidence
    expect(await thoughts()).toEqual([
      expect.objectContaining({ category: 'insight', origin: 'reflected', status: 'current', tags: ['thought'], support_count: 2,
        confidence: expect.closeTo(0.8, 5), promotion: 'active', subject_kind: 'self' }),
      // Giulia is nobody the memory knows: the question stays mine (its words name her).
      expect.objectContaining({ category: 'question', subject_kind: 'self', support_count: 1 }),
    ]);

    // Nothing new: no call, however much was there before.
    const before = llm.requests.length;
    expect(await pass()).toMatchObject({ calls: 0 });
    expect(llm.requests.length).toBe(before);
  });

  it('a thought without a new episode is rumination: dropped; support rises and falls with new episodes, retired at zero', async () => {
    // The question was forgotten (its note deleted): the next pass registers it so, without a call.
    await db.query(`DELETE FROM notes WHERE memory_id = $1 AND category = 'question'`, [memoryId]);
    await episode('Corsa di 16 km, ginocchio di nuovo dolorante', '2026-10-08', { importance: 10 });
    await episode('Corsa di 8 km, tutto bene', '2026-10-09', { importance: 10 });
    llm.queue.push({ thoughts: [
      { verdict: 'new', kind: 'opinion', subject: 'me', content: 'Penso di correre troppo', evidence: [1, 2] }, // nothing new behind it
      { verdict: 'support', target: 'T1', evidence: [5] },
      { verdict: 'weaken', target: 'T1', evidence: [6] },
    ] });
    expect(await pass()).toEqual({ calls: 1, written: 0, retired: 0, failed: 0 });
    expect(await thoughts()).toEqual([expect.objectContaining({ support_count: 2, status: 'current' })]); // 2 + 1 − 1
    expect(await db.query(`SELECT status::text FROM episode_promotions WHERE memory_id = $1 AND kind = 'thought' AND note_id IS NULL`, [memoryId]))
      .toEqual([{ status: 'forgotten' }]);

    await episode('Corsa di 10 km senza dolore', '2026-10-10', { importance: 10 });
    await episode('Corsa di 12 km senza dolore', '2026-10-11', { importance: 10 });
    llm.queue.push({ thoughts: [{ verdict: 'weaken', target: 'T1', evidence: [7, 8] }] });
    expect(await pass()).toMatchObject({ retired: 1 });
    expect(await thoughts()).toEqual([expect.objectContaining({ status: 'superseded', promotion: 'retired' })]);
  });

  it('the Diary and the recall tell it as my own thought', async () => {
    await db.query(`UPDATE notes SET status = 'current' WHERE 'thought' = ANY(tags)`);
    const notes = await app.get(ReadService).notes(memoryId, {});
    expect(notes).toEqual([expect.objectContaining({ category: 'insight', thought: true, pattern: false, inferred: true })]);
  });
});
