// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { type INestApplication } from '@nestjs/common';
import { type Server } from 'node:http';
import { DataSource } from 'typeorm';
import { EXTRACTION_RUNNER, type ExtractionRunner } from '../../src/queue/queue.port';
import { EPISODES_ONLY_NOTE } from '../../src/engine/facts.prompt';
import { ADMIN_KEY, call, resetSchema, startApp, startFakeEmbeddings, startFakeLlm, testEnv } from '../helpers/app';

describe('separate facts-and-notes pass (FACTS_PASS=separate)', () => {
  let app: INestApplication;
  let url: string;
  let llm: Awaited<ReturnType<typeof startFakeLlm>>;
  let emb: Server;

  beforeAll(async () => {
    llm = await startFakeLlm();
    const fake = await startFakeEmbeddings();
    emb = fake.server;
    testEnv({ EMBEDDING_BASE_URL: fake.url, LLM_BASE_URL: llm.url, IDLE_DELAY_SECONDS: '3600', FACTS_PASS: 'separate', LLM_FACTS_MODEL: 'facts-model' });
    await resetSchema();
    ({ app, url } = await startApp());
  });
  afterAll(async () => { await app?.close(); llm?.server.close(); emb?.close(); });

  it('runs facts and notes in their own call on the facts task model and writes both in one go', async () => {
    const client = await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'A', kind: 'platform' } });
    const key = (await call(url, 'POST', `/api/v1/admin/clients/${client.body.id}/keys`, { token: ADMIN_KEY, body: { scopes: ['ingest'] } })).body.key;
    const ownerId = (await call(url, 'POST', '/api/v1/admin/owners', { token: ADMIN_KEY, body: { displayName: 'Luca' } })).body.personId;
    await call(url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY, body: { kind: 'account', personId: ownerId, clientId: client.body.id, externalId: 'luca' } });
    const res = await call(url, 'POST', '/api/v1/ingest/messages', {
      token: key, headers: { 'x-recordare-user': 'luca' },
      body: { conversation: { externalId: 'fp' }, messages: [{ externalId: 'fp1', role: 'user', content: "Da oggi lavoro come infermiera all'ospedale Sant'Orsola.", sentAt: '2026-06-07T10:00:00+02:00' }] },
    });
    const out = { facts: [{ key: 'employer', value: "Ospedale Sant'Orsola", verdict: 'new', valid_from: '2026-06-07', date_precision: 'day', evidence: [1] }] };
    llm.queue.push(out, out); // the two calls run side by side: either may get either answer
    await app.get<ExtractionRunner>(EXTRACTION_RUNNER).runForConversation(res.body.conversationId as string);

    const reqs = llm.requests as unknown as Array<{ model: string; messages: Array<{ content: string }> }>;
    expect(reqs).toHaveLength(2);
    expect(reqs.find((r) => r.messages[0]?.content.startsWith('You keep the state and profile'))?.model).toBe('facts-model');
    expect(reqs.some((r) => (r.messages[1]?.content ?? '').includes(EPISODES_ONLY_NOTE))).toBe(true);
    expect(await app.get(DataSource).query(`SELECT value FROM facts WHERE owner_id = $1 AND key = 'employer' AND status = 'current'`, [ownerId]))
      .toEqual([{ value: "Ospedale Sant'Orsola" }]);
  });
});
