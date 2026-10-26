// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { call } from '../helpers/app';
import { setup } from './context.setup';

describe('cards: who I am and who my contacts are (WORK_PLAN 8.13)', () => {
  // One app for the file: the service reads its environment once, so a second app would embed against a closed server.
  let s: Awaited<ReturnType<typeof setup>>;
  beforeAll(async () => { s = await setup({}); });
  afterAll(async () => { await s?.app.close(); s?.fake.server.close(); });
  const as = () => ({ token: s.key, headers: { 'x-recordare-user': 'u1', 'x-recordare-conversation': 'chat-1', 'x-recordare-now': '2026-10-07T10:00:00+02:00' } });

  it('the memory context opens with the self card only when asked, without repeating what it shows', async () => {
    const ctx = (body: object) => call(s.url, 'POST', '/api/v1/context', { ...as(), body });

    const plain: string = (await ctx({ query: s.query })).body.block;
    expect(plain).not.toContain('about me');
    expect(plain).toContain('- fact: car = Toyota Yaris');

    const res = (await ctx({ query: s.query, card: true })).body;
    expect(res.block).toContain('- about me: car = Toyota Yaris (since 2026-10-03)\n- about me: Prende il caffè amaro');
    expect(res.block).not.toContain('- fact: car'); // already in the card
    expect(res.block).toContain('- episode: Ha comprato una Toyota Yaris ibrida grigia');
    expect(res.items).toBe(4);

    // Whatever is relevant, the card is there.
    const unrelated = (await ctx({ query: 'Scrivimi una funzione che ordina una lista', card: true })).body;
    expect(unrelated.block).toContain('- about me: car = Toyota Yaris (since 2026-10-03)\n- about me: Prende il caffè amaro');
  });
  // After the context test: the rows it adds would change the self card there.
  it('current facts and notes of the self and of each contact, nothing pending, retired or about someone unknown', async () => {
    const prov = `'holder_lived', 'holder', 'stated', 1, 'holder', ARRAY[$1::uuid]`;
    const [bob] = await s.db.query(`INSERT INTO persons (memory_id, display_name) VALUES ($1, 'Bob') RETURNING id`, [s.memoryId]);
    await s.db.query(`INSERT INTO person_aliases (memory_id, person_id, alias, alias_norm, source) VALUES ($1, $2, 'Roberto', 'roberto', 'manual')`, [s.memoryId, bob.id]);
    await s.db.query(`INSERT INTO fact_slots (key, description) VALUES ('city', 'city') ON CONFLICT DO NOTHING`);
    await s.db.query(`INSERT INTO facts (memory_id, key, value, subject_kind, subject_person_id, origin, author_role, stance, confidence, disclosure, audience)
      VALUES ($1, 'city', 'Bologna', 'contact', $2, ${prov})`, [s.memoryId, bob.id]);
    await s.db.query(`INSERT INTO facts (memory_id, key, value, status, origin, author_role, stance, confidence, disclosure, audience)
      VALUES ($1, 'city', 'Torino', 'superseded', ${prov})`, [s.memoryId]);
    const note = (content: string, extra: string, args: unknown[] = []) => s.db.query(
      `INSERT INTO notes (memory_id, category, content, origin, author_role, stance, confidence, disclosure, audience${extra ? `, ${extra.split('=')[0]}` : ''})
       VALUES ($1, 'preference', $2, ${prov}${extra ? `, ${extra.split('=')[1]}` : ''})`, [s.memoryId, content, ...args]);
    await note('Bob ama il jazz', 'subject_kind, subject_person_id=\'contact\', $3', [bob.id]);
    await note('Forse vuole un cane', 'pending=true');
    await note('A qualcuno piace il tè', 'subject_kind=\'someone\'');
    await note('Odio le code', 'pinned=true');
    await s.db.query(`INSERT INTO episodes (memory_id, kind, content, occurred_at, date_precision, subject_kind, subject_person_id, origin, author_role, stance, confidence, disclosure, audience)
      VALUES ($1, 'event', 'Bob ha cambiato lavoro', '2026-10-05', 'day', 'contact', $2, ${prov})`, [s.memoryId, bob.id]);

    const res = await call(s.url, 'GET', '/api/v1/cards', as());
    expect(res.status).toBe(200);
    const { self, contacts } = res.body;
    expect(self).toMatchObject({ personId: s.memoryId, aliases: [], lastMentioned: null });
    expect(self.facts.map((f: { key: string; value: string }) => `${f.key}=${f.value}`)).toEqual(['car=Toyota Yaris']);
    expect(self.notes.map((n: { content: string }) => n.content)).toEqual(['Odio le code', 'Prende il caffè amaro']); // pinned first
    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({ personId: bob.id, name: 'Bob', aliases: ['Roberto'], lastMentioned: '2026-10-05' });
    expect(contacts[0].facts.map((f: { value: string }) => f.value)).toEqual(['Bologna']);
    expect(contacts[0].notes.map((n: { content: string }) => n.content)).toEqual(['Bob ama il jazz']);
  });

});
