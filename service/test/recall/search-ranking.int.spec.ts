// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { type INestApplication } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { type Server } from 'node:http';
import { DataSource } from 'typeorm';
import { ADMIN_KEY, call, resetSchema, startApp, startFakeEmbeddings, testEnv } from '../helpers/app';

describe('search_episodes ranking by the question type (H13)', () => {
  let app: INestApplication;
  let url: string;
  let emb: Server;
  let token: string;
  let memoryId: string;
  let client: Client;
  const ids: string[] = [];

  beforeAll(async () => {
    const fake = await startFakeEmbeddings();
    emb = fake.server;
    testEnv({ EMBEDDING_BASE_URL: fake.url });
    await resetSchema();
    ({ app, url } = await startApp());
    const c = await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'A', kind: 'platform' } });
    memoryId = (await call(url, 'POST', '/api/v1/admin/memories', { token: ADMIN_KEY, body: { displayName: 'Marco' } })).body.personId;
    token = (await call(url, 'POST', `/api/v1/admin/memories/${memoryId}/tokens`, { token: ADMIN_KEY, body: { clientId: c.body.id, scopes: ['mcp'] } })).body.token;
    const db = app.get(DataSource);
    const now = Date.now();
    // The small item the question names (older, unimportant) and five big recent events of the same person.
    for (const [content, at, importance] of [
      ['Tommaso mi ha detto che in Ducati ha fatto solo il colloquio: la risposta arriva a febbraio', now - 10 * 86_400_000, 3],
      ...[1, 2, 3, 4, 5].map((i) => [`Grande giornata per Tommaso, evento numero ${i}`, now - i * 86_400_000, 9])]) {
      const [r] = await db.query(
        `INSERT INTO episodes (memory_id, kind, content, origin, author_role, audience, occurred_at, date_precision, importance)
         VALUES ($1, 'event', $2, 'holder_lived', 'holder', $3, $4, 'day', $5) RETURNING id`,
        [memoryId, content, [memoryId], new Date(at as number), importance]);
      ids.push(r.id);
    }
    const transport = new StreamableHTTPClientTransport(new URL(`${url}/mcp`), { requestInit: { headers: { authorization: `Bearer ${token}` } } });
    client = new Client({ name: 'test', version: '1' });
    await client.connect(transport);
  });
  afterAll(async () => { await client?.close(); await app?.close(); emb?.close(); });

  const search = async (args: Record<string, unknown>) =>
    ((await client.callTool({ name: 'search_episodes', arguments: args })).structuredContent as { episodes: Array<{ id: string }> }).episodes;

  it('a search puts the item the question names first: importance and recency only break ties', async () => {
    const eps = await search({ query: 'Tommaso Ducati colloquio', mode: 'search', limit: 3 });
    expect(eps.map((e) => e.id)).toContain(ids[0]);
  });

  it('a period list keeps the blend: the big events come first', async () => {
    const from = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    const to = new Date().toISOString().slice(0, 10);
    const eps = await search({ query: 'Tommaso Ducati colloquio', mode: 'list', from, to, limit: 3 });
    expect(eps.map((e) => e.id)).not.toContain(ids[0]);
  });

  it('a list without a period selects by its topic, like a search (blind12 h30)', async () => {
    const eps = await search({ query: 'Tommaso Ducati colloquio', mode: 'list', limit: 3 });
    expect(eps.map((e) => e.id)).toContain(ids[0]);
  });
});
