// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { type INestApplication } from '@nestjs/common';
import { type Server } from 'node:http';
import { DataSource } from 'typeorm';
import { EXTRACTION_RUNNER, type ExtractionRunner } from '../../src/queue/queue.port';
import { MemorySearchService } from '../../src/recall/memory-search.service';
import { ADMIN_KEY, call, resetSchema, startApp, startFakeEmbeddings, startFakeLlm, testEnv } from '../helpers/app';

describe('entity memory (D48)', () => {
  let app: INestApplication;
  let url: string;
  let llm: Awaited<ReturnType<typeof startFakeLlm>>;
  let emb: Server;
  let key: string;
  let clientId: string;

  beforeAll(async () => {
    llm = await startFakeLlm();
    const fake = await startFakeEmbeddings();
    emb = fake.server;
    testEnv({ EMBEDDING_BASE_URL: fake.url, LLM_BASE_URL: llm.url, IDLE_DELAY_SECONDS: '3600', ATLAS_URL: 'http://atlas.test:5175' });
    await resetSchema();
    ({ app, url } = await startApp());
    const client = await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'A', kind: 'platform' } });
    clientId = client.body.id;
    key = (await call(url, 'POST', `/api/v1/admin/clients/${clientId}/keys`, { token: ADMIN_KEY, body: { scopes: ['ingest', 'read'] } })).body.key;
  });
  afterAll(async () => { await app?.close(); llm?.server.close(); emb?.close(); });

  async function owner(name: string, mode?: 'entity'): Promise<string> {
    const id = (await call(url, 'POST', '/api/v1/admin/owners', { token: ADMIN_KEY, body: { displayName: name, ...(mode ? { mode } : {}) } })).body.personId;
    await call(url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY, body: { kind: 'account', personId: id, clientId, externalId: name } });
    return id;
  }

  async function extract(user: string, conversation: string, content: string, out: object): Promise<void> {
    const res = await call(url, 'POST', '/api/v1/ingest/messages', {
      token: key, headers: { 'x-recordare-user': user },
      body: { conversation: { externalId: conversation }, messages: [{ externalId: `${conversation}-1`, role: 'user', content, sentAt: '2026-06-07T10:00:00+02:00' }] },
    });
    llm.queue.push(out);
    await app.get<ExtractionRunner>(EXTRACTION_RUNNER).runForConversation(res.body.conversationId as string);
  }

  it('writes facts about the people who talk to it, each with its own history, and says so in GET /me', async () => {
    const home = await owner('Casa', 'entity');
    expect((await call(url, 'GET', '/api/v1/me', { token: key, headers: { 'x-recordare-user': 'Casa' } })).body.mode).toBe('entity');
    await extract('Casa', 'e1', 'Sono Andrea: ho comprato una Panda. Le chiavi di scorta sono nel cassetto blu.', {
      facts: [
        { key: 'car', value: 'Fiat Panda', verdict: 'new', subject: 'Andrea', evidence: [1] },
        { key: 'spare_keys_location', value: 'cassetto blu', verdict: 'new', subject: null, evidence: [1] },
      ],
    });
    const req = (llm.requests as unknown as Array<{ messages: Array<{ content: string }> }>).at(-1);
    expect(req?.messages[0]?.content).toContain('THIS MEMORY BELONGS TO AN ENTITY');
    expect(req?.messages[1]?.content).toContain(' person: Sono Andrea');

    await extract('Casa', 'e2', 'Sono Marta, anche io ho una macchina nuova: una Clio.', {
      facts: [{ key: 'car', value: 'Renault Clio', verdict: 'new', subject: 'Marta (figlia)', evidence: [1] }],
    });
    const db = app.get(DataSource);
    const rows = await db.query(
      `SELECT p.display_name AS about, f.key, f.value, f.status FROM facts f LEFT JOIN persons p ON p.id = f.subject_person_id
       WHERE f.owner_id = $1 ORDER BY f.key, about`, [home]);
    // Marta's car does not replace Andrea's: one single-value slot per person.
    expect(rows).toEqual([
      { about: 'Andrea', key: 'car', value: 'Fiat Panda', status: 'current' },
      { about: 'Marta', key: 'car', value: 'Renault Clio', status: 'current' },
      { about: null, key: 'spare_keys_location', value: 'cassetto blu', status: 'current' },
    ]);
    expect((await db.query(`SELECT DISTINCT prompt_version FROM extraction_runs WHERE owner_id = $1`, [home])))
      .toEqual([{ prompt_version: 'extract.v11+entity.v3' }]);

    const found = await app.get(MemorySearchService).search(home, { query: 'macchina auto car' }, new Date('2026-06-08T10:00:00Z'));
    expect(found.facts.filter((f) => f.key === 'car').map((f) => [f.about, f.value]).sort())
      .toEqual([['Andrea', 'Fiat Panda'], ['Marta', 'Renault Clio']]);
  });

  it('records nothing about a person the conversation never names (no identity carried over from other chats)', async () => {
    const home = await owner('Sala', 'entity');
    await extract('Sala', 's1', 'Oggi il mio capo mi ha detto che mi promuovono!', {
      episodes: [{ content: 'Il capo di Andrea gli ha detto che verrà promosso.', people: ['Andrea'], evidence: [1] },
        { content: 'Qualcuno in casa ha saputo che verrà promosso.', people: [], evidence: [1] }],
      facts: [{ key: 'job_title', value: 'responsabile', verdict: 'new', subject: 'Andrea', evidence: [1] }],
    });
    const db = app.get(DataSource);
    expect(await db.query(`SELECT content FROM episodes WHERE owner_id = $1`, [home])).toEqual([{ content: 'Qualcuno in casa ha saputo che verrà promosso.' }]);
    expect(await db.query(`SELECT id FROM facts WHERE owner_id = $1`, [home])).toEqual([]);
  });

  it("leaves a person's memory as it was: a subject from the model is ignored", async () => {
    const luca = await owner('Luca');
    expect((await call(url, 'GET', '/api/v1/me', { token: key, headers: { 'x-recordare-user': 'Luca' } })).body.mode).toBe('personal');
    await extract('Luca', 'p1', 'Ho comprato una Golf.', { facts: [{ key: 'car', value: 'VW Golf', verdict: 'new', subject: 'Luca', evidence: [1] }] });
    const req = (llm.requests as unknown as Array<{ messages: Array<{ content: string }> }>).at(-1);
    expect(req?.messages[0]?.content).not.toContain('THIS MEMORY BELONGS TO AN ENTITY');
    expect(req?.messages[1]?.content).toContain(' owner: Ho comprato');
    expect(await app.get(DataSource).query(`SELECT subject_person_id, value FROM facts WHERE owner_id = $1`, [luca]))
      .toEqual([{ subject_person_id: null, value: 'VW Golf' }]);
  });

  it('lets the person choose the kind on their platform while the memory is empty, and tells the atlas address', async () => {
    await owner('tablet');
    const me = () => call(url, 'GET', '/api/v1/me', { token: key, headers: { 'x-recordare-user': 'tablet' } });
    const set = (body: object) => call(url, 'PATCH', '/api/v1/me', { token: key, headers: { 'x-recordare-user': 'tablet' }, body });
    expect((await me()).body).toMatchObject({ mode: 'personal', gender: 'masculine', atlasUrl: 'http://atlas.test:5175' });
    expect((await set({ mode: 'entity', displayName: 'Tablet cucina' })).status).toBe(204);
    expect((await me()).body).toMatchObject({ mode: 'entity', displayName: 'Tablet cucina' });
    await extract('tablet', 't1', 'Le chiavi di scorta sono nel cassetto blu.', {
      facts: [{ key: 'spare_keys_location', value: 'cassetto blu', verdict: 'new', subject: null, evidence: [1] }] });
    expect((await set({ mode: 'personal' })).status).toBe(409); // first-person memories would mix with someone's
    expect((await set({ mode: 'entity' })).status).toBe(204); // unchanged mode: fine
    expect((await set({ gender: 'feminine' })).status).toBe(204); // the gender changes any time
    expect((await set({ gender: 'plural' })).status).toBe(400);
    expect((await me()).body).toMatchObject({ mode: 'entity', gender: 'feminine' });
  });

  it('renames an owner and turns it into an entity from the admin API', async () => {
    const id = await owner('voice');
    const res = await call(url, 'PATCH', `/api/v1/admin/owners/${id}`, { token: ADMIN_KEY, body: { displayName: 'Casa Genovese', mode: 'entity', gender: 'neutral' } });
    expect(res.status).toBe(200);
    expect((await call(url, 'GET', '/api/v1/me', { token: key, headers: { 'x-recordare-user': 'voice' } })).body)
      .toMatchObject({ displayName: 'Casa Genovese', mode: 'entity', gender: 'neutral' });
  });
});
