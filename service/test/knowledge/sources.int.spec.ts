// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Learned sources (WORK_PLAN 8.9, D49): text in one request or in parts, passages embedded in the background, the
 * learning as an episode linked both ways (written by the extraction of its conversation, or in code), search with the
 * source and its episodes, forgetting with a marker left on the episodes.
 */
import { type INestApplication } from '@nestjs/common';
import { type Server } from 'node:http';
import { DataSource } from 'typeorm';
import { EXTRACTION_RUNNER, type ExtractionRunner } from '../../src/queue/queue.port';
import { KnowledgeSearchService } from '../../src/knowledge/knowledge-search.service';
import { EpisodeSearchService } from '../../src/recall/episode-search.service';
import { ADMIN_KEY, call, resetSchema, startApp, startFakeEmbeddings, startFakeLlm, testEnv } from '../helpers/app';

describe('learned sources (WORK_PLAN 8.9)', () => {
  let app: INestApplication;
  let url: string;
  let db: DataSource;
  let llm: Awaited<ReturnType<typeof startFakeLlm>>;
  let emb: Server;
  let key: string;
  let clientId: string;
  let marta: string;

  const as = (method: string, path: string, body?: unknown) => call(url, method, path, { token: key, headers: { 'x-recordare-user': 'marta' }, body });
  const ready = async (sourceId: string) => {
    for (let i = 0; i < 50; i++) {
      const [s] = await db.query(`SELECT status FROM sources WHERE id = $1`, [sourceId]);
      if (s?.status === 'ready') return;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('source never ready');
  };

  beforeAll(async () => {
    llm = await startFakeLlm();
    const fake = await startFakeEmbeddings();
    emb = fake.server;
    testEnv({ EMBEDDING_BASE_URL: fake.url, LLM_BASE_URL: llm.url, IDLE_DELAY_SECONDS: '3600', MAX_REQUEST_BYTES: '200000' });
    await resetSchema();
    ({ app, url } = await startApp());
    db = app.get(DataSource);
    clientId = (await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'A', kind: 'platform' } })).body.id;
    key = (await call(url, 'POST', `/api/v1/admin/clients/${clientId}/keys`, { token: ADMIN_KEY, body: { scopes: ['ingest', 'read', 'write', 'mcp'] } })).body.key;
    marta = (await call(url, 'POST', '/api/v1/admin/memories', { token: ADMIN_KEY, body: { displayName: 'Marta', gender: 'feminine' } })).body.personId;
    await call(url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY, body: { kind: 'account', personId: marta, clientId, externalId: 'marta' } });
  });
  afterAll(async () => { await app?.close(); llm?.server.close(); emb?.close(); });

  it('learns a text on its own: passages, an episode in my language, search with its source and episodes; resent = duplicate', async () => {
    const body = { externalId: 'manual', title: 'Manuale della caldaia', providedBy: { name: 'Paolo' }, learnedAt: '2026-10-08T10:00:00+02:00',
      text: '# Revisione\n\nLa caldaia va revisionata ogni due anni dal tecnico.\n\n# Reset\n\nPer il reset tenere premuto il tasto rosso per 5 secondi.' };
    const first = await as('POST', '/api/v1/ingest/sources', body);
    expect(first).toMatchObject({ status: 200, body: { status: 'indexing', parts: 1, passages: 2, duplicate: false } });
    await ready(first.body.sourceId);
    expect((await as('POST', '/api/v1/ingest/sources', body)).body).toMatchObject({ sourceId: first.body.sourceId, duplicate: true });

    const [episode] = await db.query(`SELECT e.content, e.author_role, e.subject_kind FROM episodes e JOIN sources s ON s.learned_episode_id = e.id WHERE s.id = $1`, [first.body.sourceId]);
    expect(episode).toEqual({ content: "L'8 ottobre 2026 ho imparato «Manuale della caldaia», da Paolo.", author_role: 'other', subject_kind: 'self' });
    const [paolo] = await db.query(`SELECT id FROM persons WHERE memory_id = $1 AND display_name = 'Paolo'`, [marta]);
    expect(paolo).toBeDefined(); // the giver is a contact

    const found = await app.get(KnowledgeSearchService).search(marta, { query: 'ogni quanto revisionare la caldaia' }, new Date());
    expect(found.passages[0]).toMatchObject({ heading: 'Revisione', text: 'La caldaia va revisionata ogni due anni dal tecnico.',
      source: { title: 'Manuale della caldaia', providedBy: { kind: 'contact', name: 'Paolo' } } });
    expect(found.episodes.map((e) => e.content)).toEqual(["L'8 ottobre 2026 ho imparato «Manuale della caldaia», da Paolo."]);
    expect((await as('GET', '/api/v1/sources')).body).toMatchObject([{ title: 'Manuale della caldaia', status: 'ready', passages: 2 }]);
  });

  it('takes a big text in parts, in order; a part sent again is a duplicate, a gap is refused', async () => {
    const start = await as('POST', '/api/v1/ingest/sources', { externalId: 'book', title: 'Ricettario', text: 'Capitolo uno: il pane.', final: false });
    expect(start.body).toMatchObject({ status: 'receiving', parts: 1 });
    expect((await as('POST', '/api/v1/ingest/sources/book/parts', { part: 2, text: 'x' })).body).toMatchObject({ status: 409, code: 'part_out_of_order' });
    expect((await as('POST', '/api/v1/ingest/sources/book/parts', { part: 1, text: 'Capitolo due: la pizza.', final: true })).body)
      .toMatchObject({ status: 'indexing', parts: 2, passages: 2 });
    expect((await as('POST', '/api/v1/ingest/sources/book/parts', { part: 1, text: 'Capitolo due: la pizza.' })).body).toMatchObject({ duplicate: true });
    expect((await as('POST', '/api/v1/ingest/sources/book/parts', { part: 2, text: 'Capitolo tre.' })).body).toMatchObject({ status: 409, code: 'source_complete' });
    // A request bigger than the installation's limit is refused: such a text comes in parts.
    expect((await as('POST', '/api/v1/ingest/sources', { externalId: 'huge', title: 'Enorme', text: 'a'.repeat(250_000) })).status).toBe(413);
  });

  it('lets the extraction of its conversation tell of it, links both ways, and writes the episode of a source it left out', async () => {
    await as('POST', '/api/v1/ingest/messages', { conversation: { externalId: 'chat-1' }, messages: [
      { externalId: 'm1', role: 'user', content: 'Ho letto il libretto dell\'auto che mi ha mandato Paolo: tagliando ogni 15.000 km.', sentAt: '2026-10-09T10:00:00+02:00' }] });
    const a = (await as('POST', '/api/v1/ingest/sources', { externalId: 'car', title: 'Libretto dell\'auto', providedBy: { name: 'Paolo' },
      conversation: { externalId: 'chat-1' }, learnedAt: '2026-10-09T10:00:00+02:00', text: 'Tagliando ogni 15.000 km o una volta l\'anno.' })).body;
    const b = (await as('POST', '/api/v1/ingest/sources', { externalId: 'tv', title: 'Istruzioni della TV', conversation: { externalId: 'chat-1' },
      learnedAt: '2026-10-09T10:00:00+02:00', text: 'Per sintonizzare i canali premere Menu.' })).body;
    // Its conversation has messages to extract: no code-written episode yet.
    expect(await db.query(`SELECT learned_episode_id FROM sources WHERE id = ANY($1)`, [[a.sourceId, b.sourceId]])).toEqual([{ learned_episode_id: null }, { learned_episode_id: null }]);

    llm.queue.push({ episodes: [{ content: 'Il 9 ottobre 2026 ho letto il libretto dell\'auto che mi ha mandato Paolo: tagliando ogni 15.000 km.',
      subject: 'me', people: ['Paolo'], sources: ['S1'], occurred_at: '2026-10-09', evidence: [1] }] });
    const [conv] = await db.query(`SELECT id FROM conversations WHERE external_id = 'chat-1'`);
    await app.get<ExtractionRunner>(EXTRACTION_RUNNER).runForConversation(conv.id as string);
    const prompt = (llm.requests as unknown as Array<{ messages: Array<{ content: string }> }>).map((r) => r.messages[1]?.content ?? '')
      .filter((u) => u.includes('CONVERSATION WINDOW')).at(-1) ?? '';
    expect(prompt).toContain('SOURCES LEARNED IN THIS CONVERSATION');
    expect(prompt).toContain("S1: «Libretto dell'auto» (document; given by Paolo)");
    expect(prompt).toContain('S2: «Istruzioni della TV» (document; mine)');

    const links: Array<{ title: string; content: string }> = await db.query(
      `SELECT s.title, e.content FROM sources s JOIN episodes e ON e.id = s.learned_episode_id WHERE s.id = ANY($1) ORDER BY s.title`, [[a.sourceId, b.sourceId]]);
    expect(links).toEqual([
      { title: "Istruzioni della TV", content: 'Il 9 ottobre 2026 ho imparato «Istruzioni della TV».' }, // left out by the model: written in code
      { title: "Libretto dell'auto", content: "Il 9 ottobre 2026 ho letto il libretto dell'auto che mi ha mandato Paolo: tagliando ogni 15.000 km." },
    ]);
    const recall = await app.get(EpisodeSearchService).search(marta, clientId, { query: 'libretto auto tagliando' }, new Date('2026-10-10T10:00:00Z'));
    expect(recall.episodes.find((e) => e.content.includes('libretto'))?.sources).toEqual([{ id: a.sourceId, title: "Libretto dell'auto" }]);
  });

  it('forgets a source: its text is gone, its episodes keep a marker; forgetting one it never had is done', async () => {
    const [s] = await db.query(`SELECT id, learned_episode_id FROM sources WHERE external_id = 'car'`);
    expect((await as('DELETE', '/api/v1/ingest/sources/car')).status).toBe(204);
    expect(await db.query(`SELECT count(*)::int AS n FROM source_passages WHERE source_id = $1`, [s.id])).toEqual([{ n: 0 }]);
    const recall = await app.get(EpisodeSearchService).search(marta, clientId, { query: 'libretto auto tagliando' }, new Date('2026-10-10T10:00:00Z'));
    expect(recall.episodes.find((e) => e.id === s.learned_episode_id)?.sources).toEqual([{ forgotten: true }]);
    expect((await as('DELETE', '/api/v1/ingest/sources/never-sent')).status).toBe(204);
    const [tv] = await db.query(`SELECT id FROM sources WHERE external_id = 'tv'`);
    expect((await as('DELETE', `/api/v1/sources/${tv.id}`)).status).toBe(204); // from the Diary
    expect((await as('DELETE', `/api/v1/sources/${tv.id}`)).status).toBe(404);
  });
});
