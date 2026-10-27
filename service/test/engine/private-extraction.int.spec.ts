// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { type INestApplication } from '@nestjs/common';
import { type Server } from 'node:http';
import { DataSource } from 'typeorm';
import { EXTRACTION_RUNNER, type ExtractionRunner } from '../../src/queue/queue.port';
import { ADMIN_KEY, call, resetSchema, startApp, startFakeEmbeddings, startFakeLlm, testEnv } from '../helpers/app';

/**
 * A person asking in words that what they said stay between us (D52, `extract.v20`): the extraction names the asking
 * message and the messages it covers; the code makes private only that person's own messages (with the replies that
 * answer them), never someone else's, and frees them again when the person says so.
 */
describe('private by the person\'s own words (D52)', () => {
  let app: INestApplication;
  let url: string;
  let db: DataSource;
  let llm: Awaited<ReturnType<typeof startFakeLlm>>;
  let emb: Server;
  let key: string;
  const people = [
    { ref: 'marta', role: 'other', displayName: 'Marta', identity: { channel: 'tg', externalId: 'marta' } },
    { ref: 'gino', role: 'other', displayName: 'Gino', identity: { channel: 'tg', externalId: 'gino' } },
  ];
  const say = (id: string, ref: string | null, content: string, min: number) => ({
    externalId: id, role: ref ? 'other' : 'assistant', ...(ref ? { authorRef: ref } : {}), content,
    sentAt: `2026-10-05T10:${String(min).padStart(2, '0')}:00+02:00` });

  async function window(messages: object[], out: object): Promise<void> {
    const res = await call(url, 'POST', '/api/v1/ingest/messages', {
      token: key, headers: { 'x-recordare-user': 'u1' }, body: { conversation: { externalId: 'group', participants: people }, messages } });
    llm.queue.push(out);
    await app.get<ExtractionRunner>(EXTRACTION_RUNNER).runForConversation(res.body.conversationId as string);
  }
  const flags = async () => Object.fromEntries((await db.query(`SELECT external_id, private FROM messages ORDER BY sent_at`))
    .map((r: { external_id: string; private: boolean }) => [r.external_id, r.private]));

  beforeAll(async () => {
    llm = await startFakeLlm();
    const fake = await startFakeEmbeddings();
    emb = fake.server;
    testEnv({ EMBEDDING_BASE_URL: fake.url, LLM_BASE_URL: llm.url, IDLE_DELAY_SECONDS: '3600' });
    await resetSchema();
    ({ app, url } = await startApp());
    db = app.get(DataSource);
    const client = (await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'A', kind: 'platform', autoProvision: true } })).body;
    key = (await call(url, 'POST', `/api/v1/admin/clients/${client.id}/keys`, { token: ADMIN_KEY, body: { scopes: ['ingest', 'read'] } })).body.key;
  });
  afterAll(async () => { await app?.close(); llm?.server.close(); emb?.close(); });

  it('makes private only the asking person\'s own messages, the reply along, and frees them on request', async () => {
    await window([
      say('m1', 'marta', 'Ho un debito con la banca.', 0),
      say('m2', 'marta', 'Non ditelo a nessuno, mi raccomando.', 1),
      say('m3', 'gino', 'Io parto per Lisbona.', 2),
      say('m4', null, 'Ci penso io, Marta.', 3),
    ], { private: [{ declared_in: 2, messages: [1, 2, 3], private: true }] }); // m3 is Gino's: not hers to hide
    expect(await flags()).toEqual({ m1: true, m2: true, m3: false, m4: false });
    const [summary] = await db.query(`SELECT summary FROM extraction_runs ORDER BY started_at DESC LIMIT 1`);
    expect(summary.summary.dropped).toEqual({ private: { not_their_own: 1 } });

    await window([say('m5', 'gino', 'Anche questo resti tra noi.', 10)],
      { private: [{ declared_in: 1, messages: [1], private: true }] });
    expect((await flags()).m5).toBe(true); // Gino's own, in his own words

    // Freed in a later window: what she kept between us earlier in this conversation is no longer in it.
    await window([say('m6', 'marta', 'Ora potete dirlo a tutti.', 20)], { private: [{ declared_in: 1, messages: [], private: false }] });
    expect(await flags()).toEqual({ m1: false, m2: false, m3: false, m4: false, m5: true, m6: false });
  });
});
