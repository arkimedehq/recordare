// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { type INestApplication } from '@nestjs/common';
import { type Server } from 'node:http';
import { DataSource } from 'typeorm';
import { ADMIN_KEY, call, resetSchema, startApp, startFakeEmbeddings, startFakeLlm, testEnv } from '../helpers/app';

describe('nightly facts review (M5): facts checked against the new episodes', () => {
  let app: INestApplication;
  let url: string;
  let db: DataSource;
  let llm: Awaited<ReturnType<typeof startFakeLlm>>;
  let emb: Server;
  let ownerId: string;
  let key: string;

  const consolidate = (now: string) => call(url, 'POST', `/api/v1/admin/owners/${ownerId}/consolidate`, { token: ADMIN_KEY, headers: { 'x-recordare-now': now } });
  /** An owner message and the episode extracted from it (the review's evidence is the message behind the episode). */
  const lived = async (id: string, text: string, at: string, kind = 'event') => {
    await call(url, 'POST', '/api/v1/ingest/messages', {
      token: key, headers: { 'x-recordare-user': 'luca' },
      body: { conversation: { externalId: `c-${id}` }, messages: [{ externalId: id, role: 'user', content: text, sentAt: at }] },
    });
    const [m] = await db.query(`SELECT id FROM messages WHERE external_id = $1`, [id]);
    await db.query(`UPDATE messages SET extracted_run_id = NULL WHERE id = $1`, [m.id]);
    const [e] = await db.query(
      `INSERT INTO episodes (owner_id, kind, content, origin, author_role, audience, occurred_at, date_precision)
       VALUES ($1, $2, $3, 'owner_lived', 'owner', $4, $5, 'day') RETURNING id`, [ownerId, kind, text, [ownerId], at]);
    await db.query(`INSERT INTO episode_evidence (episode_id, message_id, evidence_kind) VALUES ($1, $2, 'message')`, [e.id, m.id]);
  };

  beforeAll(async () => {
    llm = await startFakeLlm();
    const fake = await startFakeEmbeddings();
    emb = fake.server;
    testEnv({ EMBEDDING_BASE_URL: fake.url, LLM_BASE_URL: llm.url, IDLE_DELAY_SECONDS: '3600', ALLOW_CLOCK_OVERRIDE: 'true', FACTS_REVIEW: 'true' });
    await resetSchema();
    ({ app, url } = await startApp());
    db = app.get(DataSource);
    const client = await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'A', kind: 'platform' } });
    key = (await call(url, 'POST', `/api/v1/admin/clients/${client.body.id}/keys`, { token: ADMIN_KEY, body: { scopes: ['ingest'] } })).body.key;
    ownerId = (await call(url, 'POST', '/api/v1/admin/owners', { token: ADMIN_KEY, body: { displayName: 'Luca' } })).body.personId;
    await call(url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY, body: { kind: 'account', personId: ownerId, clientId: client.body.id, externalId: 'luca' } });
  });
  afterAll(async () => { await app?.close(); llm?.server.close(); emb?.close(); });

  it('replaces a fact a new episode changed — mine or a contact\'s —, keeps the history, and costs nothing the next night', async () => {
    await db.query(`INSERT INTO fact_slots (key, description, cardinality) VALUES ('car', 'car', 'single') ON CONFLICT (key) DO NOTHING`);
    await db.query(`INSERT INTO facts (owner_id, key, value, status, verdict, valid_from, origin, author_role, audience)
      VALUES ($1, 'car', 'Panda', 'current', 'new', '2025-06-01', 'owner_lived', 'owner', $2)`, [ownerId, [ownerId]]);
    const [{ id: giulia }] = await db.query(`INSERT INTO persons (owner_scope, display_name, relation) VALUES ($1, 'Giulia', 'sorella') RETURNING id`, [ownerId]);
    await lived('m1', 'Ho venduto la Panda e comprato una Golf usata.', '2026-03-10T18:00:00+01:00', 'state_change');
    await lived('m2', 'Mia sorella Giulia ha comprato una Clio.', '2026-03-10T19:00:00+01:00', 'state_change');
    llm.queue.push({ summary: 'Il 10 ho comprato una Golf.' }, { summary: 'Marzo: Golf.' }, {
      facts: [
        { subject: 'me', key: 'car', value: 'Golf usata', verdict: 'replace', target: 'F1', valid_from: '2026-03-10', evidence: [1] },
        { subject: 'C1', key: 'car', value: 'Renault Clio', verdict: 'new', valid_from: '2026-03-10', evidence: [2] },
        { key: 'boat', value: 'Gommone', verdict: 'new', evidence: [7] }, // no such episode: dropped
        { subject: 'someone', key: 'bike', value: 'Bianchi', verdict: 'new', evidence: [1] }, // nobody's: dropped
      ],
    });
    const before = llm.requests.length;
    expect((await consolidate('2026-03-12T10:00:00+01:00')).body).toMatchObject({ facts: 2, failed: 0 });
    const review = llm.requests.at(-1)?.messages[1]?.content ?? '';
    expect(review).toMatch(/^ME: Luca — gender masculine/);
    expect(review).toContain('PEOPLE I KNOW:\nC1: Giulia — sorella');
    expect(review).toContain('F1: [me] car = Panda');
    expect(review).toContain('1. [2026-03-10] (state_change) Ho venduto la Panda');
    expect(llm.requests.at(-1)?.messages[0]?.content).toContain('FIRST PERSON');
    expect(await db.query(`SELECT value, status, subject_person_id AS subject FROM facts WHERE owner_id = $1 AND key IN ('car', 'boat', 'bike')
      ORDER BY valid_from, value`, [ownerId])).toEqual([
      { value: 'Panda', status: 'superseded', subject: null },
      { value: 'Golf usata', status: 'current', subject: null },
      { value: 'Renault Clio', status: 'current', subject: giulia }, // her slot, not a replacement of mine
    ]);
    expect(llm.requests.length - before).toBe(3); // two digests + one review
    // Nothing new: no review call (and no digest either).
    const again = llm.requests.length;
    expect((await consolidate('2026-03-13T10:00:00+01:00')).body).toMatchObject({ facts: 0, llmCalls: 0 });
    expect(llm.requests.length).toBe(again);
    // On demand (operators, evaluations): the review alone, with nothing new, costs nothing either.
    expect((await call(url, 'POST', `/api/v1/admin/owners/${ownerId}/review-facts`, { token: ADMIN_KEY })).body).toEqual({ calls: 0, changed: 0, failed: 0 });
  });
});
