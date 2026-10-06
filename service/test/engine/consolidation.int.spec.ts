// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { type INestApplication } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { type Server } from 'node:http';
import { DataSource } from 'typeorm';
import { ADMIN_KEY, call, resetSchema, startApp, startFakeEmbeddings, startFakeLlm, testEnv } from '../helpers/app';

describe('nightly consolidation (M5): day and month digests', () => {
  let app: INestApplication;
  let url: string;
  let db: DataSource;
  let llm: Awaited<ReturnType<typeof startFakeLlm>>;
  let emb: Server;
  let ownerId: string;
  let token: string;
  const NOW = '2026-03-20T10:00:00+01:00';

  const consolidate = () => call(url, 'POST', `/api/v1/admin/owners/${ownerId}/consolidate`, { token: ADMIN_KEY, headers: { 'x-recordare-now': NOW } });
  const episode = async (content: string, at: string, author = 'owner') => {
    const [r] = await db.query(
      `INSERT INTO episodes (owner_id, kind, content, origin, author_role, audience, occurred_at, date_precision)
       VALUES ($1, 'event', $2, 'owner_lived', $3, $4, $5, 'day') RETURNING id`, [ownerId, content, author, [ownerId], at]);
    return r.id as string;
  };
  const current = () => db.query(`SELECT level, period_start::text AS day, content FROM digests WHERE owner_id = $1 AND superseded_at IS NULL ORDER BY level, period_start`, [ownerId]);

  beforeAll(async () => {
    llm = await startFakeLlm();
    const fake = await startFakeEmbeddings();
    emb = fake.server;
    testEnv({ EMBEDDING_BASE_URL: fake.url, LLM_BASE_URL: llm.url, IDLE_DELAY_SECONDS: '3600', ALLOW_CLOCK_OVERRIDE: 'true' });
    await resetSchema();
    ({ app, url } = await startApp());
    db = app.get(DataSource);
    const client = await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'A', kind: 'platform' } });
    ownerId = (await call(url, 'POST', '/api/v1/admin/owners', { token: ADMIN_KEY, body: { displayName: 'Luca', episodicEnabled: true } })).body.personId;
    token = (await call(url, 'POST', `/api/v1/admin/owners/${ownerId}/tokens`, { token: ADMIN_KEY, body: { clientId: client.body.id, scopes: ['mcp'] } })).body.token;
  });
  afterAll(async () => { await app?.close(); llm?.server.close(); emb?.close(); });

  it('writes one digest per changed past day and one per month, and costs nothing when nothing changed', async () => {
    const a = await episode('Cena al ristorante con Marco', '2026-03-14T20:00:00+01:00');
    await episode('Partita di calcetto', '2026-03-15T18:00:00+01:00');
    await episode('Giorgio dice che Luca va a Londra', '2026-03-15T19:00:00+01:00', 'other'); // a claim: never in the diary
    await episode('Oggi dal dentista', '2026-03-20T09:00:00+01:00'); // today: not a complete day yet
    llm.queue.push({ summary: 'Il 14 Luca cena con Marco.' }, { summary: 'Il 15 Luca gioca a calcetto.' }, { summary: 'Marzo: cena con Marco, calcetto.' });
    const before = llm.requests.length;
    expect((await consolidate()).body).toEqual({ days: 2, months: 1, superseded: 0, llmCalls: 3, failed: 0 });
    expect(await current()).toEqual([
      { level: 'day', day: '2026-03-14', content: 'Il 14 Luca cena con Marco.' },
      { level: 'day', day: '2026-03-15', content: 'Il 15 Luca gioca a calcetto.' },
      { level: 'month', day: '2026-03-01', content: 'Marzo: cena con Marco, calcetto.' },
    ]);
    const prompts = llm.requests.slice(before).map((r) => r.messages[1]?.content ?? '').join('\n');
    expect(prompts).not.toContain('Londra');
    expect(prompts).not.toContain('dentista');

    expect((await consolidate()).body).toEqual({ days: 0, months: 0, superseded: 0, llmCalls: 0, failed: 0 });

    // Forgetting an episode supersedes the digests built on it; the next night rewrites the month from what is left.
    const { client } = await connectOwner();
    await client.callTool({ name: 'forget_episode', arguments: { id: a } });
    await client.close();
    expect((await current()).map((d: { day: string }) => d.day)).toEqual(['2026-03-15']);
    llm.queue.push({ summary: 'Marzo: calcetto.' });
    expect((await consolidate()).body).toEqual({ days: 0, months: 1, superseded: 0, llmCalls: 1, failed: 0 });
  });

  it('skips a digest whose call fails and retries it at the next consolidation', async () => {
    await episode('Corsa al parco', '2026-03-16T08:00:00+01:00');
    llm.queue.push({ not: 'a digest' }, { still: 'not' }); // the day's call fails (with its repair); the month is unchanged
    expect((await consolidate()).body).toMatchObject({ days: 0, months: 0, failed: 1 });
    llm.queue.push({ summary: 'Il 16 Luca corre al parco.' }, { summary: 'Marzo: calcetto, corsa.' });
    expect((await consolidate()).body).toMatchObject({ days: 1, months: 1, failed: 0 });
  });

  it('gives the diary of a period to search_episodes', async () => {
    const { client } = await connectOwner();
    const res = await client.callTool({ name: 'search_episodes', arguments: { from: '2026-03-14', to: '2026-03-16', mode: 'list' } });
    const out = res.structuredContent as { digests: Array<{ level: string; from: string; text: string }> };
    expect(out.digests).toEqual([
      { level: 'day', from: '2026-03-15', to: '2026-03-15', text: 'Il 15 Luca gioca a calcetto.' },
      { level: 'day', from: '2026-03-16', to: '2026-03-16', text: 'Il 16 Luca corre al parco.' },
    ]);
    const point = await client.callTool({ name: 'search_episodes', arguments: { query: 'calcetto', from: '2026-03-14', to: '2026-03-16' } });
    expect((point.structuredContent as { digests: unknown[] }).digests).toEqual([]); // point questions: episodes only
    const long = await client.callTool({ name: 'search_episodes', arguments: { from: '2026-01-01', to: '2026-06-30', mode: 'list' } });
    expect((long.structuredContent as { digests: Array<{ level: string }> }).digests.map((d) => d.level)).toEqual(['month']);
    await client.close();
  });

  async function connectOwner(): Promise<{ client: Client }> {
    const transport = new StreamableHTTPClientTransport(new URL(`${url}/mcp`), { requestInit: { headers: { authorization: `Bearer ${token}` } } });
    const client = new Client({ name: 'test', version: '1' });
    await client.connect(transport);
    return { client };
  }
});
