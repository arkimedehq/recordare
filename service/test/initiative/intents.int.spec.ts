// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { type INestApplication } from '@nestjs/common';
import { type Server } from 'node:http';
import { DataSource } from 'typeorm';
import { InitiativeService } from '../../src/initiative/initiative.service';
import { INITIATIVE_SYSTEM } from '../../src/initiative/initiative.prompt';
import { EXTRACTION_RUNNER, type ExtractionRunner } from '../../src/queue/queue.port';
import { ADMIN_KEY, call, resetSchema, startApp, startFakeEmbeddings, startFakeLlm, testEnv } from '../helpers/app';

/**
 * Intents from conversation (D53, 8.12c, extract.v21 INTENTS): a request made to the agent and a promise it made become
 * armed intents on their date; a withdrawn request cancels it; when due, the initiative is worded by the model (balanced)
 * or by the service's own sentence when the model fails.
 */
describe('intents from conversation: requests and promises, withdrawn requests, the model\'s wording', () => {
  let app: INestApplication;
  let url: string;
  let db: DataSource;
  let llm: Awaited<ReturnType<typeof startFakeLlm>>;
  let emb: Server;
  let key: string;
  let conversationId: string;
  const people = [{ ref: 'marta', role: 'other', displayName: 'Marta', identity: { channel: 'tg', externalId: 'marta' } }];
  const say = (id: string, ref: string | null, content: string, at: string) => ({
    externalId: id, role: ref ? 'other' : 'assistant', ...(ref ? { authorRef: ref } : {}), content, sentAt: at });

  async function window(messages: object[], out: object): Promise<void> {
    const res = await call(url, 'POST', '/api/v1/ingest/messages', {
      token: key, headers: { 'x-recordare-user': 'u1' }, body: { conversation: { externalId: 'group', participants: people }, messages } });
    conversationId = res.body.conversationId as string;
    llm.queue.push(out);
    await app.get<ExtractionRunner>(EXTRACTION_RUNNER).runForConversation(conversationId);
  }
  const intents = () => db.query(`SELECT kind::text, content, status::text, due_at, (SELECT display_name FROM persons WHERE id = for_person_id) AS who FROM intents ORDER BY due_at, created_at`);

  beforeAll(async () => {
    llm = await startFakeLlm((req) => (req.messages[0]?.content === INITIATIVE_SYSTEM
      ? { initiatives: [{ candidate: 'C1', text: 'Marta, mi avevi chiesto di ricordarti di chiamare il commercialista: è oggi.', worth: 0.9 }] }
      : {}));
    const fake = await startFakeEmbeddings();
    emb = fake.server;
    testEnv({ EMBEDDING_BASE_URL: fake.url, LLM_BASE_URL: llm.url, IDLE_DELAY_SECONDS: '3600', CONSOLIDATION_SCHEDULE: 'false' });
    await resetSchema();
    ({ app, url } = await startApp());
    db = app.get(DataSource);
    const client = (await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'A', kind: 'platform', autoProvision: true } })).body;
    key = (await call(url, 'POST', `/api/v1/admin/clients/${client.id}/keys`, { token: ADMIN_KEY, body: { scopes: ['ingest', 'read', 'write'] } })).body.key;
  });
  afterAll(async () => { await app?.close(); llm?.server.close(); emb?.close(); });

  it('arms a request and a promise on their dates, once per message; a withdrawn request is cancelled', async () => {
    await window([
      say('m1', 'marta', 'Ricordami giovedì di chiamare il commercialista.', '2026-10-05T10:00:00+02:00'),
      say('m2', null, 'Va bene, te lo ricordo giovedì. E venerdì ti faccio sapere del preventivo.', '2026-10-05T10:01:00+02:00'),
      say('m3', 'marta', 'Ricordami anche di comprare il pane.', '2026-10-05T10:02:00+02:00'), // no date: not an intent
    ], { intents: [
      { kind: 'request', content: 'chiamare il commercialista', due: '2026-10-08', for: 'Marta', evidence: [1] },
      { kind: 'promise', content: 'far sapere a Marta del preventivo', due: '2026-10-09', for: 'Marta', evidence: [2] },
      { kind: 'request', content: 'comprare il pane', due: null, for: 'Marta', evidence: [3] },
    ] });
    expect(await intents()).toEqual([
      expect.objectContaining({ kind: 'request', content: 'chiamare il commercialista', status: 'armed', who: 'Marta' }),
      expect.objectContaining({ kind: 'promise', content: 'far sapere a Marta del preventivo', status: 'armed', who: 'Marta' }),
    ]);
    const [summary] = await db.query(`SELECT summary FROM extraction_runs ORDER BY started_at DESC LIMIT 1`);
    expect(summary.summary.returned.intents).toBe(3);
    expect(summary.summary.dropped).toEqual({ intent: { no_date: 1 } });

    await window([say('m4', 'marta', 'Lascia stare il commercialista, l\'ho già chiamato.', '2026-10-06T09:00:00+02:00')],
      { intents: [{ kind: 'request', cancel: true, content: 'chiamare il commercialista', for: 'Marta', evidence: [1] }] });
    expect((await intents()).map((i: { content: string; status: string }) => [i.content, i.status])).toEqual([
      ['chiamare il commercialista', 'cancelled'], ['far sapere a Marta del preventivo', 'armed']]);
  });

  it('when due, the promise becomes a reminder worded by the model (balanced), for the person it concerns', async () => {
    const [{ person_id }] = await db.query(`SELECT person_id FROM external_identities WHERE external_id = 'u1'`);
    const r = await app.get(InitiativeService).sweep(person_id, new Date('2026-10-09T08:30:00+02:00'));
    expect(r).toMatchObject({ fired: 1 });
    const feed = await call(url, 'GET', '/api/v1/initiatives', { token: key, headers: { 'x-recordare-user': 'u1' } });
    expect(feed.body.items).toHaveLength(1);
    expect(feed.body.items[0]).toMatchObject({ kind: 'say', for: { name: 'Marta' }, text: 'Marta, mi avevi chiesto di ricordarti di chiamare il commercialista: è oggi.' });
    expect(feed.body.items[0].reason).toBe('a promise I made');
    // The model's prompt named the candidate with its kind, whom it is for and the date.
    const asked = llm.requests.at(-1)!.messages[1]!.content;
    expect(asked).toContain('C1. kind say · FOR Marta · WHAT far sapere a Marta del preventivo · WHEN 2026-10-09 · SOURCE a promise I made');
  });
});
