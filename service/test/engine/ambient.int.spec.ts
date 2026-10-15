// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { type INestApplication } from '@nestjs/common';
import { type Server } from 'node:http';
import { DataSource } from 'typeorm';
import { EXTRACTION_RUNNER, type ExtractionRunner } from '../../src/queue/queue.port';
import { ADMIN_KEY, call, resetSchema, startApp, startFakeEmbeddings, startFakeLlm, testEnv } from '../helpers/app';

describe('continuous listening: what a device hears in the room waits for its person (WORK_PLAN 6.5)', () => {
  let app: INestApplication;
  let url: string;
  let db: DataSource;
  let llm: Awaited<ReturnType<typeof startFakeLlm>>;
  let emb: Server;
  let key: string;
  let memoryId: string;

  beforeAll(async () => {
    llm = await startFakeLlm();
    const fake = await startFakeEmbeddings();
    emb = fake.server;
    testEnv({ EMBEDDING_BASE_URL: fake.url, LLM_BASE_URL: llm.url, IDLE_DELAY_SECONDS: '3600' });
    await resetSchema();
    ({ app, url } = await startApp());
    db = app.get(DataSource);
    const client = await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'A', kind: 'platform' } });
    key = (await call(url, 'POST', `/api/v1/admin/clients/${client.body.id}/keys`, { token: ADMIN_KEY, body: { scopes: ['ingest'] } })).body.key;
    memoryId = (await call(url, 'POST', '/api/v1/admin/memories', { token: ADMIN_KEY, body: { displayName: 'Luca' } })).body.personId;
    await call(url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY, body: { kind: 'account', personId: memoryId, clientId: client.body.id, externalId: 'luca' } });
  });
  afterAll(async () => { await app?.close(); llm?.server.close(); emb?.close(); });

  async function run(conversation: Record<string, unknown>, messages: Array<{ id: string; role: string; content: string; at: string; authorRef?: string }>, out: object) {
    const res = await call(url, 'POST', '/api/v1/ingest/messages', {
      token: key, headers: { 'x-recordare-user': 'luca' },
      body: { conversation, messages: messages.map((m) => ({ externalId: m.id, role: m.role, content: m.content, sentAt: m.at, ...(m.authorRef ? { authorRef: m.authorRef } : {}) })) },
    });
    llm.queue.push(out);
    await app.get<ExtractionRunner>(EXTRACTION_RUNNER).runForConversation(res.body.conversationId as string);
  }
  const fact = () => db.query(`SELECT value, pending, stance, confidence, support_count FROM facts WHERE key = 'allergia'`);
  const note = () => db.query(`SELECT pending, stance FROM notes WHERE content = 'Odio il coriandolo'`);

  it('facts and notes heard in the room are pending; episodes are written as usual', async () => {
    await run({ externalId: 'room-1', source: 'ambient' }, [
      { id: 'a1', role: 'user', content: 'Sono allergico alle noci, ricordatevelo. E odio il coriandolo.', at: '2026-06-09T19:00:00+02:00' },
    ], {
      episodes: [{ content: 'A cena ho detto di essere allergico alle noci.', kind: 'event', occurred_at: '2026-06-09', date_precision: 'day', evidence: [1] }],
      facts: [{ key: 'allergia', value: 'noci', verdict: 'new', subject: 'me', evidence: [1] }],
      notes: [{ subject: 'me', category: 'preference', content: 'Odio il coriandolo', evidence: [1] }],
    });
    expect(await fact()).toEqual([{ value: 'noci', pending: true, stance: 'inferred', confidence: 0.6, support_count: 1 }]);
    expect(await note()).toEqual([{ pending: true, stance: 'inferred' }]);
    expect(await db.query(`SELECT stance FROM episodes`)).toEqual([{ stance: 'stated' }]);
  });

  it('heard again in the room, or repeated by the assistant, it stays pending', async () => {
    await run({ externalId: 'room-2', source: 'ambient' }, [
      { id: 'a2', role: 'user', content: 'Niente noci per me, sono allergico.', at: '2026-06-10T19:00:00+02:00' },
    ], { facts: [{ key: 'allergia', value: 'noci', verdict: 'keep', target: 'F1', subject: 'me', evidence: [1] }] });
    await run({ externalId: 'chat-1' }, [
      { id: 'c1', role: 'user', content: 'Che cosa sai di me?', at: '2026-06-11T09:00:00+02:00' },
      { id: 'c2', role: 'assistant', content: 'Che sei allergico alle noci e odi il coriandolo.', at: '2026-06-11T09:00:05+02:00' },
    ], {
      facts: [{ key: 'allergia', value: 'noci', verdict: 'keep', target: 'F1', subject: 'me', evidence: [2] }],
      notes: [{ subject: 'me', category: 'preference', content: 'Odio il coriandolo', verdict: 'keep', target: 'N1', evidence: [2] }],
    });
    expect(await fact()).toEqual([expect.objectContaining({ pending: true, support_count: 3 })]);
    expect(await note()).toEqual([{ pending: true, stance: 'inferred' }]);
  });

  it('said again by the person in a chat (or by voice to the assistant), it is confirmed', async () => {
    await run({ externalId: 'chat-2', source: 'voice' }, [
      { id: 'v1', role: 'user', content: 'Sì, sono allergico alle noci. E il coriandolo proprio no.', at: '2026-06-12T09:00:00+02:00' },
    ], {
      facts: [{ key: 'allergia', value: 'noci', verdict: 'keep', target: 'F1', subject: 'me', evidence: [1] }],
      notes: [{ subject: 'me', category: 'preference', content: 'Odio il coriandolo', verdict: 'keep', target: 'N1', evidence: [1] }],
    });
    expect(await fact()).toEqual([{ value: 'noci', pending: false, stance: 'stated', confidence: 1, support_count: 4 }]);
    expect(await note()).toEqual([{ pending: false, stance: 'stated' }]);
  });

  it('a link code heard in the room is nobody\'s claim (D51)', async () => {
    const { code } = (await call(url, 'POST', `/api/v1/admin/memories/${memoryId}/link-codes`, { token: ADMIN_KEY })).body;
    await run({ externalId: 'room-3', source: 'ambient', participants: [{ ref: 'g', role: 'other', displayName: 'Giulia', identity: { channel: 'voice', externalId: 'giulia' } }] }, [
      { id: 'a3', role: 'other', authorRef: 'g', content: code, at: '2026-06-12T20:00:00+02:00' },
    ], {});
    expect(await db.query(`SELECT count(*)::int AS n FROM link_codes WHERE claimed_at IS NOT NULL`)).toEqual([{ n: 0 }]);
    expect(await db.query(`SELECT count(*)::int AS n FROM messages WHERE content = $1`, [code])).toEqual([{ n: 0 }]);
  });
});
