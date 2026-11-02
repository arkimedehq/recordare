// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { type INestApplication } from '@nestjs/common';
import { type Server } from 'node:http';
import { DataSource } from 'typeorm';
import { ConsolidationService } from '../../src/engine/consolidation.service';
import { ReadService } from '../../src/read/read.service';
import { buildCards } from '../../src/recall/cards';
import { EVERYTHING } from '../../src/recall/privacy';
import { createHash } from 'node:crypto';
import { ADMIN_KEY, call, resetSchema, startApp, startFakeEmbeddings, startFakeLlm, testEnv } from '../helpers/app';

describe('the agent\'s own thoughts: drawn from new episodes, backed, weakened and retired (D53, 8.12a)', () => {
  let app: INestApplication;
  let emb: Server;
  let llm: Awaited<ReturnType<typeof startFakeLlm>>;
  let db: DataSource;
  let memoryId: string;
  let clientId: string;
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
    clientId = (await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'A', kind: 'platform' } })).body.id;
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

  it('learns about itself from its replies and how they went (8.12b): a self note, in the self card', async () => {
    const [conv] = await db.query(`INSERT INTO conversations (memory_id, client_id, external_id, started_at, last_message_at)
      VALUES ($1, $2, 'c1', '2026-10-01T09:00:00Z', '2026-10-03T09:00:00Z') RETURNING id`, [memoryId, clientId]);
    const say = async (id: string, role: string, content: string, at: string) => db.query(
      `INSERT INTO messages (conversation_id, memory_id, external_id, role, content, content_hash, sent_at, author_kind, attribution_method, attribution_confidence, author_person_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'account', 1, $9)`,
      [conv.id, memoryId, id, role, content, createHash('sha256').update(content).digest(), at, role === 'user' ? 'self' : 'agent', role === 'user' ? memoryId : null]);
    await say('a1', 'assistant', 'Ecco un lungo riepilogo di tutto quello che potresti fare domani, con tre opzioni…', '2026-10-01T09:00:00Z');
    await say('u1', 'user', 'Troppo lungo, dimmi solo l\'orario.', '2026-10-01T09:01:00Z');
    await say('a2', 'assistant', 'Il dentista è alle 15, ma ti spiego anche come arrivarci e cosa portare…', '2026-10-03T09:00:00Z');
    await say('u2', 'user', 'Basta l\'orario, grazie.', '2026-10-03T09:01:00Z');
    await episode('Dal dentista', '2026-10-03', { importance: 10 });
    await episode('Spesa al mercato', '2026-10-04', { importance: 10 });
    llm.queue.push({ thoughts: [] }); // the call about the world first: nothing
    llm.queue.push({ thoughts: [
      { verdict: 'new', kind: 'self', subject: 'me', content: 'Con Marco funzionano le risposte brevi: due volte mi ha chiesto solo l\'orario', evidence: ['R1', 'R2'], confidence: 'medium' },
      { verdict: 'new', kind: 'self', subject: 'me', content: 'Sono bravo a ricordare gli appuntamenti', evidence: [9] }, // no reply behind it
    ] });
    expect(await pass()).toMatchObject({ calls: 2, written: 1 }); // the world call, then the lessons about myself
    expect(asked()).toContain('R1*. [2026-10-01] ME: Ecco un lungo riepilogo'); // the last call: the lessons
    expect(asked()).toContain('→ Marco: Troppo lungo, dimmi solo l\'orario.');
    const [self] = await db.query(`SELECT n.id, n.category::text, n.subject_kind::text, n.support_count, n.confidence,
        (SELECT count(*)::int FROM note_evidence x WHERE x.note_id = n.id AND x.message_id IS NOT NULL) AS messages
      FROM notes n WHERE n.memory_id = $1 AND n.category = 'self'`, [memoryId]);
    expect(self).toMatchObject({ category: 'self', subject_kind: 'self', support_count: 2, messages: 4, confidence: expect.closeTo(0.6, 5) });
    const cards = await buildCards(db, memoryId, EVERYTHING);
    expect(cards!.self.notes.map((n) => n.category)).toEqual(['self']); // the other thoughts stay out of the card
  });

  it('learns a procedure from one correction (8.12d): one day is enough, a reply is needed', async () => {
    const [conv] = await db.query(`SELECT id FROM conversations WHERE memory_id = $1 LIMIT 1`, [memoryId]);
    const say = async (id: string, role: string, content: string, at: string) => db.query(
      `INSERT INTO messages (conversation_id, memory_id, external_id, role, content, content_hash, sent_at, author_kind, attribution_method, attribution_confidence, author_person_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'account', 1, $9)`,
      [conv.id, memoryId, id, role, content, createHash('sha256').update(content).digest(), at, role === 'user' ? 'self' : 'agent', role === 'user' ? memoryId : null]);
    await say('p1', 'assistant', 'Ho mandato l\'ordine della farina al mulino per email.', '2026-10-06T09:00:00Z');
    await say('p2', 'user', 'No, al mulino si ordina per telefono entro mezzogiorno, col codice 4471.', '2026-10-06T09:01:00Z');
    await episode('Ordine della farina rifatto per telefono', '2026-10-06', { importance: 10 });
    await episode('Consegna in negozio', '2026-10-07', { importance: 10 });
    llm.queue.push({ thoughts: [] }); // the call about the world first: nothing
    llm.queue.push({ thoughts: [
      { verdict: 'new', kind: 'procedure', subject: 'me', content: 'Quando ordino la farina al mulino, telefono entro mezzogiorno e do il codice 4471', evidence: ['R3'], confidence: 'high' },
      { verdict: 'new', kind: 'procedure', subject: 'me', content: 'Quando consegno, uso il furgone', evidence: [11] }, // no reply behind it
    ] });
    const r = await pass();
    expect(r).toMatchObject({ calls: 2, written: 1 }); // the world call, then the lessons about myself
    const [p] = await db.query(`SELECT n.category::text, n.subject_kind::text,
        (SELECT count(*)::int FROM note_evidence x WHERE x.note_id = n.id AND x.message_id IS NOT NULL) AS messages
      FROM notes n WHERE n.memory_id = $1 AND n.category = 'procedure'`, [memoryId]);
    expect(p).toEqual({ category: 'procedure', subject_kind: 'self', messages: 2 });
  });

  it('survives the pattern pass: a thought with fewer than three episodes is not a weak pattern', async () => {
    const before = (await db.query(`SELECT count(*)::int AS n FROM notes WHERE memory_id = $1 AND 'thought' = ANY(tags)`, [memoryId]))[0].n;
    expect(before).toBeGreaterThan(0);
    llm.queue.push({ patterns: [] });
    await app.get(ConsolidationService).patternsNow(memoryId, NOW);
    expect((await db.query(`SELECT count(*)::int AS n FROM notes WHERE memory_id = $1 AND 'thought' = ANY(tags)`, [memoryId]))[0].n).toBe(before);
  });

  it('the Diary and the recall tell it as my own thought', async () => {
    await db.query(`UPDATE notes SET status = 'current' WHERE 'thought' = ANY(tags)`);
    const notes = await app.get(ReadService).notes(memoryId, {});
    expect(notes.map((n) => [n.category, n.thought, n.pattern, n.inferred])).toEqual([['procedure', true, false, true], ['self', true, false, true], ['insight', true, false, true]]);
  });
});
