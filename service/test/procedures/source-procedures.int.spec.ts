// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Procedures from a learned source (WORK_PLAN 8.16 F2c, mode B2): off unless switched on; only for a source learned for a
 * task (said by the client, or recognised by the extraction); never on the economy profile; at most a few procedures per
 * source and calls per day; always pending, with the source's site; read once.
 */
import { type INestApplication } from '@nestjs/common';
import { type Server } from 'node:http';
import { DataSource } from 'typeorm';
import { SourceProceduresService } from '../../src/engine/source-procedures';
import { EXTRACTION_RUNNER, type ExtractionRunner } from '../../src/queue/queue.port';
import { ADMIN_KEY, call, resetSchema, startApp, startFakeEmbeddings, startFakeLlm, testEnv } from '../helpers/app';

describe('procedures from a learned source (8.16 F2c)', () => {
  let app: INestApplication;
  let url: string;
  let llm: Awaited<ReturnType<typeof startFakeLlm>>;
  let emb: Server;
  let db: DataSource;
  let key: string;
  let clientId: string;
  let n = 0;
  const steps = (k: number) => Array.from({ length: k }, (_, i) => `Passo ${i + 1}`);

  beforeAll(async () => {
    // B2 answers with four procedures (one over the per-source cap); the extraction answers what a test queues.
    llm = await startFakeLlm((req) => ((req as unknown as { messages: Array<{ content: string }> }).messages[0]!.content.includes('You read a text that the agent of a household')
      ? { procedures: [1, 2, 3, 4].map((i) => ({ title: `Compito ${i}`, when: null, steps: steps(3) })) } : undefined));
    const fake = await startFakeEmbeddings();
    emb = fake.server;
    testEnv({ EMBEDDING_BASE_URL: fake.url, LLM_BASE_URL: llm.url, IDLE_DELAY_SECONDS: '3600', CONSOLIDATION_SCHEDULE: 'false', PROCEDURES_DAILY_CALLS: '2' });
    await resetSchema();
    ({ app, url } = await startApp());
    db = app.get(DataSource);
    clientId = (await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'A', kind: 'platform' } })).body.id;
    key = (await call(url, 'POST', `/api/v1/admin/clients/${clientId}/keys`, { token: ADMIN_KEY, body: { scopes: ['ingest', 'read'] } })).body.key;
  });
  afterAll(async () => { await app?.close(); llm?.server.close(); emb?.close(); });

  async function memory(name: string, patch: object = {}): Promise<string> {
    const id = (await call(url, 'POST', '/api/v1/admin/memories', { token: ADMIN_KEY, body: { displayName: name, mode: 'entity' } })).body.personId;
    await call(url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY, body: { kind: 'account', personId: id, clientId, externalId: name } });
    if (Object.keys(patch).length) expect((await call(url, 'PATCH', `/api/v1/admin/memories/${id}`, { token: ADMIN_KEY, body: patch })).status).toBe(200);
    return id;
  }
  async function learn(user: string, body: object): Promise<string> {
    const res = await call(url, 'POST', '/api/v1/ingest/sources', { token: key, headers: { 'x-recordare-user': user },
      body: { externalId: `s${++n}`, title: 'Manuale della lavatrice', uri: 'https://manuali-esempio.it/lavatrice', text: 'Per lavare: 1. … 2. … 3. …', ...body } });
    expect(res.status).toBe(200);
    return res.body.sourceId as string;
  }
  const run = (sourceId: string) => app.get(SourceProceduresService).run(sourceId);
  /** What the queued reading of a source came to (the worker runs it), as stored on the source. */
  async function outcome(sourceId: string): Promise<string> {
    for (let i = 0; i < 100; i++) {
      const [s] = await db.query(`SELECT procedures_outcome FROM sources WHERE id = $1`, [sourceId]);
      if (s?.procedures_outcome && s.procedures_outcome !== 'reading') return s.procedures_outcome as string;
      await new Promise((r) => setTimeout(r, 50));
    }
    return 'timeout';
  }

  it('reads a source learned for a task once, keeps at most three procedures pending from its site, within the daily cap', async () => {
    const off = await memory('Spenta');
    expect(await outcome(await learn('Spenta', { forTask: true }))).toBe('off');

    const home = await memory('Casa', { proceduresFromSources: true });
    expect(await run(await learn('Casa', {}))).toBe('not_for_task');
    const manual = await learn('Casa', { forTask: true });
    expect(await outcome(manual)).toBe('read:3');
    expect(await run(manual)).toBe('not_ready'); // read once
    const rows = await db.query(`SELECT origin::text, pending, source_id FROM procedures WHERE memory_id = $1 AND status = 'current'`, [home]);
    expect(rows).toHaveLength(3);
    expect(rows.every((r: { origin: string; pending: boolean; source_id: string }) => r.origin === 'learned' && r.pending && r.source_id === manual)).toBe(true);
    expect(await db.query(`SELECT DISTINCT i.key FROM item_informants ii JOIN informants i ON i.id = ii.informant_id WHERE ii.memory_id = $1`, [home]))
      .toEqual([{ key: 'manuali-esempio.it' }]);

    // The second read of the day is allowed, the third waits for the nightly sweep.
    expect(await outcome(await learn('Casa', { forTask: true, title: 'Guida del forno' }))).toBe('read:3');
    expect(await outcome(await learn('Casa', { forTask: true, title: 'Guida del frigo' }))).toBe('daily_cap');

    const cheap = await memory('Economica', { proceduresFromSources: true, qualityProfile: 'economy' });
    expect(await outcome(await learn('Economica', { forTask: true }))).toBe('economy');
    expect(await db.query(`SELECT id FROM procedures WHERE memory_id = ANY($1)`, [[off, cheap]])).toEqual([]);
  });

  it('marks a source learned for a task when the extraction recognises it in the conversation; a client\'s no stays', async () => {
    const home = await memory('Villa', { proceduresFromSources: true });
    const conv = await call(url, 'POST', '/api/v1/ingest/messages', { token: key, headers: { 'x-recordare-user': 'Villa' }, body: {
      conversation: { externalId: 'v1' },
      messages: [{ externalId: 'v1-1', role: 'user', content: 'Ti mando il manuale della caldaia: domani devi resettarla.', sentAt: '2026-06-07T10:00:00+02:00' }] } });
    const recognised = await learn('Villa', { conversation: { externalId: 'v1' } });
    const refused = await learn('Villa', { conversation: { externalId: 'v1' }, title: 'Storia della caldaia', forTask: false });
    llm.queue.push({ sources_for_task: ['S1', 'S2'] });
    await app.get<ExtractionRunner>(EXTRACTION_RUNNER).runForConversation(conv.body.conversationId as string);
    const flags = await db.query(`SELECT id, for_task FROM sources WHERE memory_id = $1 ORDER BY learned_at, title`, [home]);
    expect(Object.fromEntries(flags.map((f: { id: string; for_task: boolean | null }) => [f.id, f.for_task]))).toEqual({ [recognised]: true, [refused]: false });
  });
});
