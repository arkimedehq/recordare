// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { type INestApplication } from '@nestjs/common';
import { type Server } from 'node:http';
import { DataSource } from 'typeorm';
import { ADMIN_KEY, call, resetSchema, startApp, startFakeEmbeddings, testEnv } from '../helpers/app';

describe('erasing a whole memory (WORK_PLAN 8.13)', () => {
  let app: INestApplication;
  let url: string;
  let emb: Server;
  let db: DataSource;
  let clientId: string;
  let plainKey: string;
  let eraseKey: string;
  const as = (key: string, user: string) => ({ token: key, headers: { 'x-recordare-user': user } });
  const prov = `'holder_lived', 'holder', 'stated', 1, 'holder', ARRAY[$1::uuid]`;

  /** A memory holding a bit of everything: chat, episode, fact, note, a contact, a token, an LLM call. */
  async function filled(user: string): Promise<string> {
    await call(url, 'POST', '/api/v1/ingest/messages', { ...as(plainKey, user), body: { conversation: { externalId: 'chat' }, messages: [
      { externalId: 'a', role: 'user', content: 'Abito a Torino con Marta', sentAt: '2026-10-01T10:00:00+02:00' }] } });
    const memoryId: string = (await call(url, 'GET', '/api/v1/me', as(plainKey, user))).body.memoryId;
    const [msg] = await db.query(`SELECT id FROM messages WHERE memory_id = $1`, [memoryId]);
    const [ep] = await db.query(`INSERT INTO episodes (memory_id, kind, content, occurred_at, date_precision, origin, author_role, stance, confidence, disclosure, audience)
      VALUES ($1, 'event', 'Trasloco a Torino', '2026-10-01', 'day', ${prov}) RETURNING id`, [memoryId]);
    await db.query(`INSERT INTO episode_evidence (episode_id, message_id) VALUES ($1, $2)`, [ep.id, msg.id]);
    await db.query(`INSERT INTO fact_slots (key, description) VALUES ('city', 'city') ON CONFLICT DO NOTHING`);
    await db.query(`INSERT INTO facts (memory_id, key, value, status, origin, author_role, stance, confidence, disclosure, audience)
      VALUES ($1, 'city', 'Torino', 'current', ${prov})`, [memoryId]);
    await db.query(`INSERT INTO notes (memory_id, category, content, origin, author_role, stance, confidence, disclosure, audience)
      VALUES ($1, 'preference', 'Caffè amaro', ${prov})`, [memoryId]);
    await db.query(`INSERT INTO persons (display_name, memory_id) VALUES ('Marta', $1)`, [memoryId]);
    await db.query(`INSERT INTO llm_calls (memory_id, prompt_id, provider, model, status, input_tokens) VALUES ($1, 'extract.v19', 'p', 'm', 'ok', 100)`, [memoryId]);
    return memoryId;
  }

  /** Rows still tied to the memory, in every table with a memory_id column (and its holder row). */
  async function left(memoryId: string): Promise<Record<string, number>> {
    const tables: Array<{ table_name: string }> = await db.query(
      `SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'memory_id'`);
    const out: Record<string, number> = {};
    for (const { table_name } of tables) {
      const [{ n }] = await db.query(`SELECT count(*)::int AS n FROM "${table_name}" WHERE memory_id = $1`, [memoryId]);
      if (n > 0) out[table_name] = n;
    }
    const [{ n }] = await db.query(`SELECT count(*)::int AS n FROM persons WHERE id = $1`, [memoryId]);
    if (n > 0) out.persons_self = n;
    return out;
  }

  beforeAll(async () => {
    const fake = await startFakeEmbeddings();
    emb = fake.server;
    testEnv({ EMBEDDING_BASE_URL: fake.url, IDLE_DELAY_SECONDS: '3600' });
    await resetSchema();
    ({ app, url } = await startApp());
    db = app.get(DataSource);
    clientId = (await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'P', kind: 'platform', autoProvision: true } })).body.id;
    const key = async (scopes: string[]) => (await call(url, 'POST', `/api/v1/admin/clients/${clientId}/keys`, { token: ADMIN_KEY, body: { scopes } })).body.key as string;
    plainKey = await key(['ingest', 'read', 'write']);
    eraseKey = await key(['read', 'erase']);
  });
  afterAll(async () => { await app?.close(); emb?.close(); });

  it('the admin erases a memory only with its id as confirmation; nothing of it is left, the other memory is untouched', async () => {
    const a = await filled('u-a');
    const b = await filled('u-b');
    const before = await left(b);

    expect((await call(url, 'DELETE', `/api/v1/admin/memories/${a}`, { token: ADMIN_KEY })).status).toBe(400);
    const wrong = await call(url, 'DELETE', `/api/v1/admin/memories/${a}?confirm=${b}`, { token: ADMIN_KEY });
    expect(wrong.status).toBe(400);
    expect(wrong.body.code).toBe('confirm_mismatch');

    const res = await call(url, 'DELETE', `/api/v1/admin/memories/${a}?confirm=${a}`, { token: ADMIN_KEY });
    expect(res.status).toBe(200);
    expect(res.body.erased).toEqual({ conversations: 1, messages: 1, episodes: 1, facts: 1, notes: 1, digests: 0, sources: 0, contacts: 1 });
    expect(await left(a)).toEqual({});
    expect(await left(b)).toEqual(before);
    // The LLM call log keeps the row (tokens and cost, no content), without the memory.
    expect((await db.query(`SELECT count(*)::int AS n FROM llm_calls WHERE memory_id IS NULL`))[0].n).toBe(1);
    expect((await call(url, 'DELETE', `/api/v1/admin/memories/${a}?confirm=${a}`, { token: ADMIN_KEY })).status).toBe(404);
  });

  it('a platform erases its user\'s memory with the erase scope only, and never creates one to erase', async () => {
    const c = await filled('u-c');
    expect((await call(url, 'DELETE', `/api/v1/me?confirm=${c}`, as(plainKey, 'u-c'))).status).toBe(403);
    expect((await call(url, 'DELETE', `/api/v1/me?confirm=${c}`, as(eraseKey, 'u-nobody'))).status).toBe(404);
    expect((await db.query(`SELECT count(*)::int AS n FROM external_identities WHERE external_id = 'u-nobody'`))[0].n).toBe(0);

    const res = await call(url, 'DELETE', `/api/v1/me?confirm=${c}`, as(eraseKey, 'u-c'));
    expect(res.status).toBe(200);
    expect(res.body.erased.messages).toBe(1);
    expect(await left(c)).toEqual({});
  });

  it('a personal token with the erase scope erases its own memory, and stops working', async () => {
    const d = await filled('u-d');
    const token = (await call(url, 'POST', `/api/v1/admin/memories/${d}/tokens`, { token: ADMIN_KEY, body: { clientId, scopes: ['read', 'erase'] } })).body.token;
    expect((await call(url, 'GET', '/api/v1/me', { token })).status).toBe(200);

    expect((await call(url, 'DELETE', `/api/v1/me?confirm=${d}`, { token })).status).toBe(200);
    expect(await left(d)).toEqual({});
    expect((await call(url, 'GET', '/api/v1/me', { token })).status).toBe(401);
  });
});
