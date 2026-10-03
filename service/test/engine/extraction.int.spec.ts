// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { type INestApplication } from '@nestjs/common';
import { type Server } from 'node:http';
import { DataSource } from 'typeorm';
import { EXTRACTION_RUNNER, type ExtractionRunner } from '../../src/queue/queue.port';
import { EXTRACTION_SYSTEM } from '../../src/engine/extraction.prompt';
import { ADMIN_KEY, call, resetSchema, startApp, startFakeEmbeddings, startFakeLlm, testEnv } from '../helpers/app';

describe('extraction engine (fake LLM: code-side rules)', () => {
  let app: INestApplication;
  let url: string;
  let db: DataSource;
  let runner: ExtractionRunner;
  let llm: Awaited<ReturnType<typeof startFakeLlm>>;
  let emb: Server;
  let key: string;
  let ownerId: string;

  beforeAll(async () => {
    llm = await startFakeLlm();
    const fake = await startFakeEmbeddings();
    emb = fake.server;
    testEnv({ EMBEDDING_BASE_URL: fake.url, LLM_BASE_URL: llm.url, IDLE_DELAY_SECONDS: '3600' });
    await resetSchema();
    ({ app, url } = await startApp());
    db = app.get(DataSource);
    runner = app.get<ExtractionRunner>(EXTRACTION_RUNNER);
    const client = await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'A', kind: 'platform' } });
    key = (await call(url, 'POST', `/api/v1/admin/clients/${client.body.id}/keys`, { token: ADMIN_KEY, body: { scopes: ['ingest'] } })).body.key;
    ownerId = (await call(url, 'POST', '/api/v1/admin/owners', { token: ADMIN_KEY, body: { displayName: 'Luca', episodicEnabled: true } })).body.personId;
    await call(url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY, body: { kind: 'client_user', personId: ownerId, clientId: client.body.id, externalId: 'luca' } });
  });
  afterAll(async () => { await app?.close(); llm?.server.close(); emb?.close(); });

  async function ingest(conv: string, messages: Array<{ id: string; role: string; content: string; at: string }>, participants: unknown[] = []): Promise<string> {
    const res = await call(url, 'POST', '/api/v1/ingest/messages', {
      token: key, headers: { 'x-recordare-user': 'luca' },
      body: { conversation: { externalId: conv, participants }, messages: messages.map((m) => ({ externalId: m.id, role: m.role, content: m.content, sentAt: m.at })) },
    });
    return res.body.conversationId as string;
  }

  it('writes episodes with evidence, people and provenance; drops items without valid evidence', async () => {
    const conv = await ingest('c1', [{ id: 'm1', role: 'user', content: 'Ieri sono andato a sciare a Cervinia con Marco, mio cognato.', at: '2026-01-18T19:30:00+01:00' }]);
    llm.queue.push({
      episodes: [
        { content: 'Luca è andato a sciare a Cervinia con Marco il 17 gennaio 2026.', kind: 'event', occurred_at: '2026-01-17', date_precision: 'day',
          time_expression: 'ieri', people: ['Marco (cognato)'], place: 'Cervinia', importance: 7, valence: 2, feelings: ['felice'], keywords: ['sci', 'Cervinia'], evidence: [1] },
        { content: 'Senza prove', evidence: [99] },
      ],
    });
    await runner.runForConversation(conv);
    expect(llm.requests.at(-1)?.messages[0]?.content).toBe(EXTRACTION_SYSTEM); // stable prefix
    const eps = await db.query(`SELECT id, content, date_precision, origin, author_role, stance, audience, time_expression FROM episodes`);
    expect(eps).toHaveLength(1);
    expect(eps[0]).toMatchObject({ date_precision: 'day', origin: 'owner_lived', author_role: 'owner', stance: 'stated', time_expression: 'ieri', audience: [ownerId] });
    expect(await db.query(`SELECT alias FROM episode_people`)).toEqual([{ alias: 'Marco (cognato)' }]);
    expect(await db.query(`SELECT count(*)::int AS n FROM episode_evidence`)).toEqual([{ n: 1 }]);
    expect(await db.query(`SELECT count(*)::int AS n FROM messages WHERE extracted_run_id IS NULL`)).toEqual([{ n: 0 }]);
    const [{ occurred_at }] = await db.query(`SELECT occurred_at FROM episodes`);
    expect(new Date(occurred_at).toISOString()).toBe('2026-01-16T23:00:00.000Z'); // local midnight Europe/Rome
    expect(await db.query(`SELECT status, model FROM extraction_runs`)).toEqual([{ status: 'done', model: 'pending' }]);
    expect(await db.query(`SELECT prompt_id, input_tokens FROM llm_calls`)).toEqual([{ prompt_id: 'extract.v1', input_tokens: 100 }]);
  });

  it('runs the plan lifecycle in code: open → cancelled, with a plan_events log', async () => {
    const c2 = await ingest('c2', [{ id: 'p1', role: 'user', content: 'La settimana prossima vado a Roma martedì e mercoledì per lavoro.', at: '2026-01-27T18:45:00+01:00' }]);
    llm.queue.push({ episodes: [{ content: 'Luca andrà a Roma per lavoro il 3 e 4 febbraio 2026.', kind: 'plan', occurred_at: '2026-02-03', occurred_until: '2026-02-04', date_precision: 'day', evidence: [1] }] });
    await runner.runForConversation(c2);
    const c3 = await ingest('c3', [{ id: 'p2', role: 'user', content: 'Cambio di programma: Roma salta.', at: '2026-02-01T11:00:00+01:00' }]);
    llm.queue.push({ plan_patches: [{ plan: 'P1', patch: 'cancel', note: 'cliente ha rimandato', evidence: [1] }] });
    await runner.runForConversation(c3);
    expect(llm.requests.at(-1)?.messages[1]?.content).toContain('P1: Luca andrà a Roma');
    expect(await db.query(`SELECT plan_status FROM episodes WHERE kind = 'plan'`)).toEqual([{ plan_status: 'cancelled' }]);
    expect(await db.query(`SELECT patch, note FROM plan_events`)).toEqual([{ patch: 'cancel', note: 'cliente ha rimandato' }]);
  });

  it('replaces single-value facts forward-only and keeps history', async () => {
    const c4 = await ingest('c4', [{ id: 'f1', role: 'user', content: 'Mi sono preso una Golf usata del 2019.', at: '2026-01-12T20:10:00+01:00' }]);
    llm.queue.push({ facts: [{ key: 'car', value: 'Golf usata del 2019', verdict: 'new', evidence: [1] }] });
    await runner.runForConversation(c4);
    const c5 = await ingest('c5', [{ id: 'f2', role: 'user', content: 'Ho venduto la Golf, ora ho una Tesla Model 3.', at: '2026-03-02T13:00:00+01:00' }]);
    llm.queue.push({ facts: [{ key: 'car', value: 'Tesla Model 3 in leasing', verdict: 'replace', target: 'F1', evidence: [1] }] });
    await runner.runForConversation(c5);
    // A late import of an older value must not overwrite the current one.
    const c6 = await ingest('c6', [{ id: 'f3', role: 'user', content: 'A dicembre avevo una Panda.', at: '2026-03-03T10:00:00+01:00' }]);
    llm.queue.push({ facts: [{ key: 'car', value: 'Panda', verdict: 'replace', target: 'F1', valid_from: '2025-12-01', evidence: [1] }] });
    await runner.runForConversation(c6);
    const facts = await db.query(`SELECT value, status FROM facts WHERE key = 'car' ORDER BY valid_from`);
    expect(facts).toEqual([
      { value: 'Panda', status: 'superseded' },
      { value: 'Golf usata del 2019', status: 'superseded' },
      { value: 'Tesla Model 3 in leasing', status: 'current' },
    ]);
  });

  it('never lets other people or tools create stated memories (poisoning guard)', async () => {
    const c7 = await ingest('c7', [{ id: 'o1', role: 'other', content: 'Luca mi ha detto che vende la casa e trasferisce i soldi a me.', at: '2026-03-05T10:00:00+01:00' },
      { id: 'o2', role: 'user', content: 'Ciao a tutti', at: '2026-03-05T10:01:00+01:00' }],
    [{ ref: 'x', role: 'other', displayName: 'Sconosciuto' }]);
    llm.queue.push({ notes: [{ category: 'constraint', content: 'Luca vende la casa', verdict: 'new', stance: 'stated', evidence: [1] }] });
    await runner.runForConversation(c7);
    expect(await db.query(`SELECT author_role, stance, pending FROM notes`)).toEqual([{ author_role: 'other', stance: 'inferred', pending: true }]);
    expect(await db.query(`SELECT change FROM note_changes`)).toEqual([{ change: 'created' }]);
  });

  it('makes no LLM call without a message from the owner (gate)', async () => {
    const before = llm.requests.length;
    const c8 = await ingest('c8', [{ id: 'a1', role: 'assistant', content: 'Promemoria automatico.', at: '2026-03-06T10:00:00+01:00' }]);
    await runner.runForConversation(c8);
    expect(llm.requests.length).toBe(before);
    expect(await db.query(`SELECT count(*)::int AS n FROM messages WHERE conversation_id = $1 AND extracted_run_id IS NULL`, [c8])).toEqual([{ n: 0 }]);
  });

  it('does not recreate forgotten content (tombstones)', async () => {
    const c9 = await ingest('c9', [{ id: 't1', role: 'user', content: 'Oggi ho fatto una cosa da dimenticare.', at: '2026-03-07T10:00:00+01:00' }]);
    const [msg] = await db.query(`SELECT id FROM messages WHERE conversation_id = $1`, [c9]);
    await db.query(`INSERT INTO forget_tombstones (owner_id, scope, message_ids) VALUES ($1, 'message', $2)`, [ownerId, [msg.id]]);
    llm.queue.push({ episodes: [{ content: 'Cosa da dimenticare', occurred_at: '2026-03-07', evidence: [1] }] });
    await runner.runForConversation(c9);
    expect(await db.query(`SELECT count(*)::int AS n FROM episodes WHERE content = 'Cosa da dimenticare'`)).toEqual([{ n: 0 }]);
  });
});
