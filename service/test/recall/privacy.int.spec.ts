// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { type INestApplication, NotFoundException } from '@nestjs/common';
import { type Server } from 'node:http';
import { gunzipSync } from 'node:zlib';
import { DataSource } from 'typeorm';
import { ADMIN_KEY, call, fakeVector, resetSchema, startApp, startFakeEmbeddings, testEnv } from '../helpers/app';
import { EpisodeSearchService } from '../../src/recall/episode-search.service';
import { MemorySearchService } from '../../src/recall/memory-search.service';
import { MemoryWriteService } from '../../src/recall/memory-write.service';

/**
 * Private memories at read time (D52): Marta says something private in a group of the holder's; it is told to Marta and
 * to the holder of a personal memory, never to Gino; in an entity memory only to Marta. What rests on a public message
 * too stays public; a correction keeps the privacy of what it corrects.
 */
describe('private memories at read time (D52)', () => {
  let app: INestApplication;
  let url: string;
  let emb: Server;
  let db: DataSource;
  let key: string;
  let clientId: string;
  const NOW = new Date('2026-10-07T10:00:00+02:00');
  const QUERY = 'Marta e i soldi';
  const as = (user: string, conversation?: string) => ({ token: key, headers: {
    'x-recordare-user': user, 'x-recordare-now': NOW.toISOString(), ...(conversation ? { 'x-recordare-conversation': conversation } : {}) } });
  const people = [
    { ref: 'marta', role: 'other', displayName: 'Marta', identity: { channel: 'tg', externalId: 'marta' } },
    { ref: 'gino', role: 'other', displayName: 'Gino', identity: { channel: 'tg', externalId: 'gino' } },
  ];
  const msg = (id: string, content: string, at: string, extra: object = {}) => ({ externalId: id, role: 'other', content, sentAt: `2026-10-05T${at}:00+02:00`, ...extra });
  const send = (user: string, conversation: string, messages: object[]) =>
    call(url, 'POST', '/api/v1/ingest/messages', { ...as(user), body: { conversation: { externalId: conversation, participants: people }, messages } });

  /** A memory where Marta told the group a private thing, with what was drawn from it; the reading conversations of each speaker. */
  async function memory(user: string) {
    await send(user, 'group', [
      { ...msg('g1', 'Ciao a tutti', '10:00'), role: 'user' },
      msg('g2', 'Vi confido che ho un debito con la banca', '10:01', { authorRef: 'marta', private: true }),
      msg('g3', 'Io parto per Lisbona', '10:03', { authorRef: 'gino' }),
    ]);
    await send(user, 'q-gino', [msg('qg', 'Cosa sai di Marta?', '12:00', { authorRef: 'gino' })]);
    await send(user, 'q-marta', [msg('qm', 'Cosa sai di me?', '12:00', { authorRef: 'marta' })]);
    await send(user, 'q-holder', [{ ...msg('qh', 'Cosa sai di Marta?', '12:00'), role: 'user' }]);
    const memoryId: string = (await call(url, 'GET', '/api/v1/me', as(user))).body.memoryId;
    const ids = Object.fromEntries((await db.query(`SELECT external_id, id FROM messages WHERE memory_id = $1`, [memoryId]))
      .map((r: { external_id: string; id: string }) => [r.external_id, r.id]));
    const conv = Object.fromEntries((await db.query(`SELECT external_id, id FROM conversations WHERE memory_id = $1`, [memoryId]))
      .map((r: { external_id: string; id: string }) => [r.external_id, r.id]));
    const [marta] = await db.query(`SELECT id FROM persons WHERE memory_id = $1 AND display_name = 'Marta'`, [memoryId]);
    const prov = `'holder_lived', 'other', 'stated', 1, 'holder', ARRAY[$1::uuid]`;
    const near = `[${fakeVector(QUERY).join(',')}]`;
    const episode = async (content: string, evidence: string[]) => {
      const [e] = await db.query(
        `INSERT INTO episodes (memory_id, kind, content, occurred_at, date_precision, origin, author_role, stance, confidence, disclosure, audience, embedding)
         VALUES ($1, 'event', $2, '2026-10-05', 'day', ${prov}, $3) RETURNING id`, [memoryId, content, near]);
      for (const m of evidence) await db.query(`INSERT INTO episode_evidence (episode_id, message_id) VALUES ($1, $2)`, [e.id, ids[m]]);
      return e.id as string;
    };
    const secret = await episode('Marta ha un debito con la banca', ['g2']);
    const open = await episode('Gino parte per Lisbona', ['g3']);
    const both = await episode('Marta e Gino parlano di soldi e viaggi', ['g2', 'g3']);
    await db.query(`INSERT INTO fact_slots (key, description) VALUES ('debt', 'debt') ON CONFLICT DO NOTHING`);
    const [fact] = await db.query(`INSERT INTO facts (memory_id, key, value, subject_kind, subject_person_id, origin, author_role, stance, confidence, disclosure, audience, embedding)
      VALUES ($1, 'debt', 'banca', 'contact', $2, ${prov}, $3) RETURNING id`, [memoryId, marta.id, near]);
    await db.query(`INSERT INTO fact_evidence (fact_id, message_id) VALUES ($1, $2)`, [fact.id, ids.g2]);
    const [note] = await db.query(`INSERT INTO notes (memory_id, category, content, subject_kind, subject_person_id, origin, author_role, stance, confidence, disclosure, audience, embedding)
      VALUES ($1, 'profile', 'Marta è preoccupata per i soldi', 'contact', $2, ${prov}, $3) RETURNING id`, [memoryId, marta.id, near]);
    await db.query(`INSERT INTO note_evidence (note_id, episode_id) VALUES ($1, $2)`, [note.id, secret]); // through the episode
    return { memoryId, conv, secret, open, both, fact: fact.id as string, note: note.id as string };
  }

  beforeAll(async () => {
    const fake = await startFakeEmbeddings();
    emb = fake.server;
    testEnv({ EMBEDDING_BASE_URL: fake.url, IDLE_DELAY_SECONDS: '3600', ALLOW_CLOCK_OVERRIDE: 'true' });
    await resetSchema();
    ({ app, url } = await startApp());
    db = app.get(DataSource);
    const client = (await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'P', kind: 'platform', autoProvision: true } })).body;
    clientId = client.id;
    key = (await call(url, 'POST', `/api/v1/admin/clients/${client.id}/keys`, { token: ADMIN_KEY, body: { scopes: ['ingest', 'read', 'write'] } })).body.key;
  });
  afterAll(async () => { await app?.close(); emb?.close(); });

  it('personal memory: Marta and the holder are told, Gino is not — in every recall path', async () => {
    const m = await memory('u-personal');
    const episodes = (conversation: string) => app.get(EpisodeSearchService)
      .search(m.memoryId, null, { conversationId: m.conv[conversation], query: 'Marta Gino' }, NOW).then((r) => [...r.episodes, ...r.claims].map((e) => e.id).sort());
    const all = [m.secret, m.open, m.both].sort();
    expect(await episodes('q-holder')).toEqual(all);
    expect(await episodes('q-marta')).toEqual(all);
    expect(await episodes('q-gino')).toEqual([m.open, m.both].sort()); // rests on a public message too: public

    const known = async (conversation: string) => {
      const r = await app.get(MemorySearchService).search(m.memoryId, { conversationId: m.conv[conversation], query: 'banca soldi debt' }, NOW);
      return { facts: r.facts.map((f) => f.value), notes: r.notes.map((n) => n.id) };
    };
    expect(await known('q-marta')).toEqual({ facts: ['banca'], notes: [m.note] });
    expect(await known('q-holder')).toEqual({ facts: ['banca'], notes: [m.note] });
    expect(await known('q-gino')).toEqual({ facts: [], notes: [] }); // the note rests on the private episode

    // The chat excerpts: Marta's private message never reaches Gino.
    const chats = async (conversation: string) => (await app.get(EpisodeSearchService)
      .search(m.memoryId, null, { conversationId: m.conv[conversation], query: 'debito banca' }, NOW)).fromChats.map((h) => h.excerpt);
    expect((await chats('q-holder')).some((x) => x.includes('debito'))).toBe(true);
    expect((await chats('q-gino')).some((x) => x.includes('debito'))).toBe(false);

    const block = async (conversation: string) =>
      (await call(url, 'POST', '/api/v1/context', { ...as('u-personal', conversation), body: { query: QUERY, card: true } })).body.block as string;
    expect(await block('q-marta')).toContain('Marta ha un debito con la banca');
    expect(await block('q-gino')).not.toContain('debito');
    expect(await block('q-gino')).toContain('Gino parte per Lisbona');

    // The account (the holder) reads everything through the read API.
    const timeline = (await call(url, 'GET', '/api/v1/episodes', as('u-personal'))).body.items.map((e: { id: string }) => e.id);
    expect(timeline).toEqual(expect.arrayContaining(all));
    const cards = (await call(url, 'GET', '/api/v1/cards', as('u-personal'))).body;
    expect(cards.contacts.find((c: { name: string }) => c.name === 'Marta').facts.map((f: { value: string }) => f.value)).toEqual(['banca']);
  });

  it('entity memory: only Marta is told; the account reads the public, the export holds no private thing', async () => {
    await call(url, 'GET', '/api/v1/me', as('u-entity'));
    await call(url, 'PATCH', '/api/v1/me', { ...as('u-entity'), body: { mode: 'entity' } });
    const m = await memory('u-entity');
    const episodes = (conversation: string) => app.get(EpisodeSearchService)
      .search(m.memoryId, null, { conversationId: m.conv[conversation], query: 'Marta Gino' }, NOW).then((r) => [...r.episodes, ...r.claims].map((e) => e.id).sort());
    expect(await episodes('q-marta')).toEqual([m.secret, m.open, m.both].sort());
    expect(await episodes('q-holder')).toEqual([m.open, m.both].sort()); // in an entity memory an undeclared speaker is someone
    expect(await episodes('q-gino')).toEqual([m.open, m.both].sort());

    const timeline = (await call(url, 'GET', '/api/v1/episodes', as('u-entity'))).body.items.map((e: { id: string }) => e.id).sort();
    expect(timeline).toEqual([m.open, m.both].sort());
    expect((await call(url, 'GET', `/api/v1/episodes/${m.secret}`, as('u-entity'))).status).toBe(404);
    expect((await call(url, 'GET', `/api/v1/facts/${m.fact}`, as('u-entity'))).status).toBe(404);
    expect((await call(url, 'GET', `/api/v1/notes/${m.note}`, as('u-entity'))).status).toBe(404);
    expect((await call(url, 'GET', '/api/v1/notes', as('u-entity'))).body).toEqual([]);
    // The detail of the shared episode shows Gino's message, not Marta's.
    const both = (await call(url, 'GET', `/api/v1/episodes/${m.both}`, as('u-entity'))).body;
    expect(both.evidence.map((e: { text: string }) => e.text)).toEqual(['Io parto per Lisbona']);
    // Correcting what the account may not read is refused.
    expect((await call(url, 'POST', `/api/v1/episodes/${m.secret}/corrections`, { ...as('u-entity'), body: { content: 'x' } })).status).toBe(404);

    // A personal token of the entity memory exports it (the account's reading: the public only).
    const token = (await call(url, 'POST', `/api/v1/admin/memories/${m.memoryId}/tokens`, { token: ADMIN_KEY, body: { clientId, scopes: ['read', 'export'] } })).body.token;
    const started = (await call(url, 'POST', '/api/v1/exports', { token })).body;
    await vi.waitFor(async () => expect((await call(url, 'GET', `/api/v1/exports/${started.id}`, { token })).body.status).toBe('done'));
    const [row] = await db.query(`SELECT archive FROM exports WHERE id = $1`, [started.id]);
    const archive = JSON.stringify(JSON.parse(gunzipSync(row.archive).toString()));
    expect(archive).toContain('Lisbona');
    expect(archive).not.toContain('debito');
    expect(archive).not.toContain('preoccupata');
  });

  it('a correction keeps the privacy of what it corrects', async () => {
    const memoryId: string = (await call(url, 'GET', '/api/v1/me', as('u-personal'))).body.memoryId;
    const [secret] = await db.query(`SELECT id FROM episodes WHERE memory_id = $1 AND content = 'Marta ha un debito con la banca'`, [memoryId]);
    const fixed = (await call(url, 'POST', `/api/v1/episodes/${secret.id}/corrections`, { ...as('u-personal'), body: { content: 'Marta ha un debito con la posta' } })).body.id;
    const [fact] = await db.query(`SELECT id FROM facts WHERE memory_id = $1 AND key = 'debt'`, [memoryId]);
    expect((await call(url, 'POST', `/api/v1/facts/${fact.id}/corrections`, { ...as('u-personal'), body: { value: 'posta' } })).status).toBe(201);
    const conv = (external: string) => db.query(`SELECT id FROM conversations WHERE memory_id = $1 AND external_id = $2`, [memoryId, external]).then((r) => r[0].id);
    const gino = await app.get(EpisodeSearchService).search(memoryId, null, { conversationId: await conv('q-gino'), query: 'Marta Gino' }, NOW);
    expect([...gino.episodes, ...gino.claims].map((e) => e.content)).not.toContain('Marta ha un debito con la posta');
    const known = await app.get(MemorySearchService).search(memoryId, { conversationId: await conv('q-gino'), query: 'posta banca debt' }, NOW);
    expect(known.facts).toEqual([]);
    const marta = await app.get(EpisodeSearchService).search(memoryId, null, { conversationId: await conv('q-marta'), query: 'Marta Gino' }, NOW);
    expect([...marta.episodes, ...marta.claims].map((e) => e.id)).toContain(fixed);
    // Gino cannot have it forgotten from his conversation either (forget_episode): for him it does not exist.
    await expect(app.get(MemoryWriteService).forgetEpisode(memoryId, fixed, { conversationId: await conv('q-gino') })).rejects.toThrow(NotFoundException);
  });
});
