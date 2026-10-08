// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { namedPeriod, sentences } from '../../src/recall/context.service';
import { call, fakeVector } from '../helpers/app';
import { setup } from './context.setup';

/** A unit vector whose cosine with `q` is exactly `cos` (q's direction plus an orthogonal part). */
function at(q: number[], cos: number, other: string): string {
  const w = fakeVector(other);
  const dot = w.reduce((a, x, i) => a + x * q[i]!, 0);
  const o = w.map((x, i) => x - dot * q[i]!);
  const n = Math.sqrt(o.reduce((a, x) => a + x * x, 0));
  return `[${q.map((x, i) => cos * x + Math.sqrt(1 - cos * cos) * (o[i]! / n)).join(',')}]`;
}

describe('memory context, WORK_PLAN 5.7: sentences and named periods', () => {
  let s: Awaited<ReturnType<typeof setup>>;
  beforeAll(async () => { s = await setup({}); });
  afterAll(async () => { await s?.app.close(); s?.fake.server.close(); });
  const ask = (query: string) => call(s.url, 'POST', '/api/v1/context', {
    token: s.key, headers: { 'x-recordare-user': 'u1', 'x-recordare-conversation': 'chat-1', 'x-recordare-now': '2026-10-07T10:00:00+02:00' }, body: { query } });

  it('matches the question even with an instruction tacked on', async () => {
    expect((await ask(`${s.query} Rispondi in una sola riga, senza elenchi.`)).body.items).toBe(3);
  });

  it('adds what happened in the period a message names, with a lower bar — not other days', async () => {
    const question = 'Cosa ho fatto ieri?'; // one sentence: one vector (the fake embedder's vectors are random)
    const q = fakeVector('Cosa ho fatto ieri?');
    const prov = `'owner_lived', 'owner', 'stated', 1, 'owner', ARRAY[$1::uuid]`;
    const add = (content: string, day: string, cos: number) => s.db.query(
      `INSERT INTO episodes (owner_id, kind, content, occurred_at, date_precision, origin, author_role, stance, confidence, disclosure, audience, embedding)
       VALUES ($1, 'event', $2, $3, 'day', ${prov}, $4)`, [s.ownerId, content, `${day}T12:00:00+02:00`, at(q, cos, content)]);
    await add('Pranzo al lago con Anna', '2026-10-06', 0.45);   // yesterday, moderately related: in
    await add('Cena con i colleghi', '2026-10-05', 0.45);       // two days ago: out
    await add('Riunione condominio', '2026-10-06', 0.1);        // yesterday but unrelated: out
    const block: string = (await ask(question)).body.block ?? '';
    expect(block).toContain('Pranzo al lago');
    expect(block).not.toContain('Cena con i colleghi');
    expect(block).not.toContain('Riunione condominio');
  });

  it('splits sentences and finds the period a message names, in any supported language', () => {
    expect(sentences('Come si chiama il mio gatto? Rispondi in una frase.')).toEqual(['Come si chiama il mio gatto?', 'Rispondi in una frase.']);
    expect(sentences('我的猫叫什么？用一句话回答。')).toEqual(['我的猫叫什么？', '用一句话回答。']);
    expect(sentences('Che macchina ho?')).toEqual([]);
    const today = '2026-10-07'; // a Wednesday
    expect(namedPeriod('What did I do on Tuesday?', today)).toEqual({ from: '2026-10-06', to: '2026-10-06' });
    expect(namedPeriod('cosa ho fatto sabato scorso?', today)).toEqual({ from: '2026-10-03', to: '2026-10-03' });
    expect(namedPeriod('星期三我做了什么', today)).toEqual({ from: '2026-09-30', to: '2026-09-30' }); // same weekday: a week ago
    expect(namedPeriod('¿qué hice ayer?', today)).toMatchObject({ from: '2026-10-06', to: '2026-10-06' });
    expect(namedPeriod('che tempo fa?', today)).toBeNull();
  });
});
