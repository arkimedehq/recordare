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
  let wording = 'Marta, ti avevo promesso di farti sapere del preventivo venerdì: eccomi.';
  const intents = () => db.query(`SELECT kind::text, content, status::text, due_at, (SELECT display_name FROM persons WHERE id = for_person_id) AS who FROM intents ORDER BY due_at, created_at`);

  beforeAll(async () => {
    llm = await startFakeLlm((req) => (req.messages[0]?.content === INITIATIVE_SYSTEM
      ? { initiatives: [{ candidate: 'C1', text: wording, worth: 0.9 }] }
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
    // Recordare does its own work whatever the host's tools did (the host deduplicates, D53): a request with a time keeps it.
    await window([say('h1', 'marta', 'Domani alle 9 ricordami di innaffiare le piante.', '2026-10-05T11:00:00+02:00'),
      say('h2', null, 'Fatto: promemoria impostato per domani alle 9.', '2026-10-05T11:00:30+02:00')],
    { intents: [{ kind: 'request', content: 'innaffiare le piante', due: '2026-10-06T09:00', for: 'Marta', evidence: [1] }] });
    const [handled] = await db.query(`SELECT status::text, due_at, timed FROM intents WHERE content = 'innaffiare le piante'`);
    expect(handled.status).toBe('armed');
    expect(handled.timed).toBe(true); // D55: a time was asked for — a timed initiative
    expect(new Date(handled.due_at).toISOString()).toBe('2026-10-06T07:00:00.000Z'); // 09:00 in Rome: the time kept
    await db.query(`DELETE FROM intents WHERE content = 'innaffiare le piante'`);

    await window([say('m4', 'marta', 'Lascia stare il commercialista, l\'ho già chiamato.', '2026-10-06T09:00:00+02:00')],
      { intents: [{ kind: 'request', cancel: true, content: 'chiamare il commercialista', for: 'Marta', evidence: [1] }] });
    expect((await intents()).map((i: { content: string; status: string }) => [i.content, i.status])).toEqual([
      ['chiamare il commercialista', 'cancelled'], ['far sapere a Marta del preventivo', 'armed']]);
    // A promise kept in conversation closes; nothing kept that matches: dropped, counted.
    await window([say('m5', 'marta', 'Novità sul preventivo?', '2026-10-07T09:00:00+02:00'),
      say('m6', null, 'Sì, è arrivato: 900 euro.', '2026-10-07T09:01:00+02:00')],
    { intents: [{ kind: 'promise', done: true, content: 'far sapere del preventivo', for: 'Marta', evidence: [2] },
      { kind: 'promise', done: true, content: 'portare il cane dal veterinario', for: 'Marta', evidence: [2] }] });
    expect((await intents()).map((i: { status: string }) => i.status)).toEqual(['cancelled', 'done']);
    const [last] = await db.query(`SELECT summary FROM extraction_runs ORDER BY started_at DESC LIMIT 1`);
    expect(last.summary.dropped).toEqual({ intent: { nothing_done: 1 } });
  });

  it('a move takes the armed reminder to the new time, in the same window or a later one; the same request again adds none (extract.v24)', async () => {
    await window([
      say('y1', 'marta', 'Ricordami che stasera devo preparare lo yogurt.', '2026-10-12T11:17:00+02:00'),
      say('y2', null, 'Fatto, te lo ricordo stasera alle 20.', '2026-10-12T11:17:30+02:00'),
      say('y3', 'marta', 'Sposta alle 21. Grazie', '2026-10-12T11:20:00+02:00'),
    ], { intents: [ // listed out of order: the move, said later, still wins
      { kind: 'request', content: 'preparare lo yogurt', due: '2026-10-12T21:00', for: 'Marta', evidence: [3] },
      { kind: 'request', content: 'preparare lo yogurt', due: '2026-10-12T20:00', for: 'Marta', evidence: [1] },
    ] });
    const yogurt = () => db.query(`SELECT due_at, status::text FROM intents WHERE content LIKE '%yogurt%'`);
    expect((await yogurt()).map((r: { due_at: Date }) => new Date(r.due_at).toISOString())).toEqual(['2026-10-12T19:00:00.000Z']);
    // A later conversation moves it again to the next day; then the same request again (the agent: already set) adds nothing.
    await window([say('y4', 'marta', 'Lo yogurt fallo domani sera alle 21, stasera non ce la faccio.', '2026-10-12T18:00:00+02:00')],
      { intents: [{ kind: 'request', content: 'preparare lo yogurt', due: '2026-10-13T21:00', for: 'Marta', evidence: [1] }] });
    // The extraction sees what I already hold (MY REMINDERS), to move it or not add it again.
    const seen = llm.requests.at(-1)?.messages.find((m) => m.role === 'user')?.content ?? '';
    expect(seen).toContain('MY REMINDERS (still to say):\n- preparare lo yogurt (request, for Marta; due');
    await window([say('y5', 'marta', 'Domani alle 21 ricordami lo yogurt.', '2026-10-12T19:00:00+02:00')],
      { intents: [{ kind: 'request', content: 'preparare lo yogurt', due: '2026-10-13T21:00', for: 'Marta', evidence: [1] }] });
    expect((await yogurt()).map((r: { due_at: Date; status: string }) => [new Date(r.due_at).toISOString(), r.status])).toEqual([['2026-10-13T19:00:00.000Z', 'armed']]);
    await db.query(`DELETE FROM intents WHERE content LIKE '%yogurt%'`);
  });

  it('a follow-up (extract.v23): something Marta left to finish becomes, a few hours later, the question the extraction wrote; done closes it', async () => {
    await window([say('f1', 'marta', 'Ho messo la lavatrice, poi stendo.', '2026-10-09T10:00:00+02:00')],
      { intents: [{ kind: 'followup', content: 'Hai steso i panni?', due: '2026-10-09T12:00', for: 'Marta', evidence: [1] }] });
    const [f] = await db.query(`SELECT kind::text, status::text, due_at, expires_at, timed FROM intents WHERE content = 'Hai steso i panni?'`);
    expect(f).toMatchObject({ kind: 'followup', status: 'armed', timed: false });
    expect(new Date(f.due_at).toISOString()).toBe('2026-10-09T10:00:00.000Z'); // 12:00 in Rome
    expect(new Date(f.expires_at).getTime() - new Date(f.due_at).getTime()).toBe(12 * 3_600_000); // half a day
    await db.query(`UPDATE memories SET quality_profile = 'economy'`); // the extraction's own question, no wording call
    await app.get(InitiativeService).sweepAll(new Date('2026-10-09T10:30:00Z'));
    const [i] = await db.query(`SELECT kind::text, text, reason, status::text FROM initiatives WHERE intent_id = (SELECT id FROM intents WHERE content = 'Hai steso i panni?')`);
    expect(i).toMatchObject({ kind: 'ask', text: 'Hai steso i panni?', reason: 'something they left unfinished', status: 'pending' });
    await window([say('f2', 'marta', 'Panni stesi!', '2026-10-09T12:40:00+02:00')],
      { intents: [{ kind: 'followup', done: true, content: 'stendere i panni', for: 'Marta', evidence: [1] }] });
    expect((await db.query(`SELECT status::text FROM intents WHERE content = 'Hai steso i panni?'`))[0].status).toBe('done');
    await app.get(InitiativeService).sweepAll(new Date('2026-10-09T10:45:00Z'));
    expect((await db.query(`SELECT status::text FROM initiatives WHERE text = 'Hai steso i panni?'`))[0].status).toBe('done'); // not needed any more
    await db.query(`UPDATE memories SET quality_profile = NULL`);
    await db.query(`DELETE FROM initiatives WHERE text = 'Hai steso i panni?'`); // the next test reads the feed
    await db.query(`DELETE FROM intents WHERE kind = 'followup'`);
  });

  it('when due, the promise becomes a reminder worded by the model (balanced), for the person it concerns', async () => {
    const [{ person_id }] = await db.query(`SELECT person_id FROM external_identities WHERE external_id = 'u1'`);
    await db.query(`UPDATE intents SET status = 'armed' WHERE kind = 'promise'`); // undo the kept promise: the wording is what this test checks
    const r = await app.get(InitiativeService).sweep(person_id, new Date('2026-10-09T08:30:00+02:00'));
    expect(r).toMatchObject({ fired: 1 });
    const feed = await call(url, 'GET', '/api/v1/initiatives', { token: key, headers: { 'x-recordare-user': 'u1' } });
    expect(feed.body.items).toHaveLength(1);
    expect(feed.body.items[0]).toMatchObject({ kind: 'say', for: { name: 'Marta' }, text: 'Marta, ti avevo promesso di farti sapere del preventivo venerdì: eccomi.' });
    expect(feed.body.items[0].reason).toBe('a promise I made');
    // The model's prompt named the candidate with its kind, whom it is for and the date.
    const asked = llm.requests.at(-1)!.messages[1]!.content;
    expect(asked).toContain('C1. kind say · FOR Marta · WHAT far sapere a Marta del preventivo · WHEN 2026-10-09 · SOURCE a promise I made');
  });

  it('a day relative to now ("oggi") is kept in a text said today alone, not in one that may be said later', async () => {
    const [{ person_id }] = await db.query(`SELECT person_id FROM external_identities WHERE external_id = 'u1'`);
    const sweep = async () => {
      await db.query(`DELETE FROM initiatives`);
      await db.query(`UPDATE intents SET status = 'armed' WHERE kind = 'promise'`);
      expect(await app.get(InitiativeService).sweep(person_id, new Date('2026-10-09T08:30:00+02:00'))).toMatchObject({ fired: 1 });
      return (await db.query(`SELECT text FROM initiatives`))[0].text as string;
    };
    wording = 'Marta, ti avevo promesso di farti sapere del preventivo: è oggi.';
    // Due on the 9th, lapsing at its end: said on the 9th alone, "oggi" stays true.
    expect(await sweep()).toBe(wording);
    expect(llm.requests.at(-1)!.messages[1]!.content).toContain('SOURCE a promise I made · SAID 2026-10-09');
    // A window of days: "oggi" could be said on the 11th: the service's own sentence, which names the day.
    await db.query(`UPDATE intents SET expires_at = due_at + interval '3 days' WHERE kind = 'promise'`);
    expect(await sweep()).toBe('Un promemoria per venerdì 9 ottobre: far sapere a Marta del preventivo.');
    expect(llm.requests.at(-1)!.messages[1]!.content).toContain('SAID 2026-10-09 to 2026-10-11');
  });

  it('a gap ("who is…") the model would skip is asked anyway, once, with the service\'s sentence (D55 F2b)', async () => {
    const [{ person_id }] = await db.query(`SELECT person_id FROM external_identities WHERE external_id = 'u1'`);
    await db.query(`DELETE FROM initiatives`);
    await db.query(`UPDATE intents SET status = 'done'`);
    const [bruna] = await db.query(`INSERT INTO persons (memory_id, display_name) VALUES ($1, 'Bruna') RETURNING id`, [person_id]);
    await db.query(`INSERT INTO intents (memory_id, kind, content, about_person_id, due_at, expires_at) VALUES ($1, 'who', 'Bruna', $2, '2026-10-09T06:00:00Z', '2026-10-20T00:00:00Z')`,
      [person_id, bruna.id]);
    llm.queue.push({ initiatives: [{ candidate: 'C1', text: '', worth: 0.1, skip: true }] });
    expect(await app.get(InitiativeService).sweep(person_id, new Date('2026-10-09T08:30:00+02:00'))).toMatchObject({ fired: 1 });
    expect((await db.query(`SELECT kind::text, text FROM initiatives`))[0]).toEqual({ kind: 'ask', text: 'Chi è Bruna? Ho sentito il nome, ma non so chi sia.' });
  });
});

