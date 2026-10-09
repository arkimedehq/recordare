// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Per-person isolation (WORK_PLAN M7 hygiene): two people on the same client. Nothing of one is visible to, or
 * editable by, the other — read API, writes, memory context and MCP recall.
 */
import { type INestApplication } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { type Server } from 'node:http';
import { DataSource } from 'typeorm';
import { ADMIN_KEY, call, fakeVector, resetSchema, startApp, startFakeEmbeddings, testEnv } from '../helpers/app';

const SECRET = 'Visita dal cardiologo per la pressione alta';

describe('per-person isolation', () => {
  let app: INestApplication;
  let url: string;
  let emb: Server;
  let key: string;
  let tokenB: string;
  const ids: Record<string, string> = {};
  const NOW = '2026-10-08T10:00:00+02:00';
  const as = (user: string) => ({ token: key, headers: { 'x-recordare-user': user, 'x-recordare-now': NOW, 'x-recordare-conversation': `${user}-chat` } });

  beforeAll(async () => {
    const fake = await startFakeEmbeddings();
    emb = fake.server;
    testEnv({ EMBEDDING_BASE_URL: fake.url, IDLE_DELAY_SECONDS: '3600', ALLOW_CLOCK_OVERRIDE: 'true' });
    await resetSchema();
    ({ app, url } = await startApp());
    const client = (await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'P', kind: 'platform' } })).body;
    key = (await call(url, 'POST', `/api/v1/admin/clients/${client.id}/keys`, { token: ADMIN_KEY, body: { scopes: ['ingest', 'mcp', 'read', 'write'] } })).body.key;
    const person = async (name: string, ext: string) => {
      const id = (await call(url, 'POST', '/api/v1/admin/owners', { token: ADMIN_KEY, body: { displayName: name } })).body.personId as string;
      await call(url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY, body: { kind: 'account', personId: id, clientId: client.id, externalId: ext } });
      return id;
    };
    const a = await person('Anna', 'anna');
    const b = await person('Bruno', 'bruno');
    tokenB = (await call(url, 'POST', `/api/v1/admin/owners/${b}/tokens`, { token: ADMIN_KEY, body: { clientId: client.id, scopes: ['mcp'] } })).body.token;
    await call(url, 'POST', '/api/v1/ingest/messages', { ...as('anna'), body: { conversation: { externalId: 'anna-chat' }, messages: [
      { externalId: 'a1', role: 'user', content: SECRET, sentAt: '2026-10-05T10:00:00+02:00' },
    ] } });

    // Anna's memory, embedded like the query Bruno will send: a leak would be the best match.
    const db = app.get(DataSource);
    const v = `[${fakeVector(SECRET).join(',')}]`;
    const prov = `'owner_lived', 'owner', 'stated', 1, 'owner', ARRAY[$1::uuid]`;
    ids['episode'] = (await db.query(`INSERT INTO episodes (owner_id, kind, content, occurred_at, date_precision, origin, author_role, stance, confidence, disclosure, audience, embedding)
      VALUES ($1, 'event', $2, '2026-10-05', 'day', ${prov}, $3) RETURNING id`, [a, SECRET, v]))[0].id;
    ids['plan'] = (await db.query(`INSERT INTO episodes (owner_id, kind, content, occurred_at, date_precision, plan_status, origin, author_role, stance, confidence, disclosure, audience, embedding)
      VALUES ($1, 'plan', $2, '2026-10-10', 'day', 'open', ${prov}, $3) RETURNING id`, [a, `Controllo: ${SECRET}`, v]))[0].id;
    await db.query(`INSERT INTO fact_slots (key, description) VALUES ('health', 'health') ON CONFLICT DO NOTHING`);
    ids['fact'] = (await db.query(`INSERT INTO facts (owner_id, key, value, valid_from, origin, author_role, stance, confidence, disclosure, audience, embedding)
      VALUES ($1, 'health', $2, '2026-10-05', ${prov}, $3) RETURNING id`, [a, SECRET, v]))[0].id;
    ids['note'] = (await db.query(`INSERT INTO notes (owner_id, category, content, pending, origin, author_role, stance, confidence, disclosure, audience, embedding)
      VALUES ($1, 'preference', $2, true, ${prov}, $3) RETURNING id`, [a, SECRET, v]))[0].id;
    await db.query(`INSERT INTO digests (owner_id, level, period_start, period_end, content, audience) VALUES ($1, 'day', '2026-10-05', '2026-10-05', $2, ARRAY[$1::uuid])`, [a, SECRET]);
  });
  afterAll(async () => { await app?.close(); emb?.close(); });

  it('Anna sees her own memory (control)', async () => {
    expect((await call(url, 'GET', '/api/v1/episodes', as('anna'))).body.items).toHaveLength(2);
    expect((await call(url, 'GET', `/api/v1/episodes/${ids['episode']}`, as('anna'))).status).toBe(200);
  });

  it('the read API shows Bruno nothing of Anna', async () => {
    const leaks = async (path: string) => JSON.stringify((await call(url, 'GET', path, as('bruno'))).body).includes('cardiologo');
    for (const path of ['/api/v1/episodes', '/api/v1/episodes?q=cardiologo', '/api/v1/plans', '/api/v1/digests?level=day',
      '/api/v1/facts?includePending=true', '/api/v1/notes?includePending=true']) expect([path, await leaks(path)]).toEqual([path, false]);
    expect((await call(url, 'GET', `/api/v1/episodes/${ids['episode']}`, as('bruno'))).status).toBe(404);
  });

  it('Bruno cannot edit Anna\'s memory by id', async () => {
    const st = async (method: string, path: string, body?: unknown) => (await call(url, method, path, { ...as('bruno'), body })).status;
    expect(await st('POST', `/api/v1/episodes/${ids['episode']}/corrections`, { content: 'x' })).toBe(404);
    expect(await st('DELETE', `/api/v1/episodes/${ids['plan']}`)).toBe(404);
    expect(await st('PATCH', `/api/v1/notes/${ids['note']}`, { pinned: true })).toBe(404);
    expect(await st('POST', `/api/v1/notes/${ids['note']}/confirm`)).toBe(404);
    expect(await st('POST', `/api/v1/facts/${ids['fact']}/reject`)).toBe(404);
    expect(await st('DELETE', `/api/v1/facts/${ids['fact']}`)).toBe(404);
    // Anna's memory is intact: both episodes uncorrected, the note neither pinned nor confirmed, the fact still there.
    const episodes = (await call(url, 'GET', '/api/v1/episodes', as('anna'))).body.items;
    expect(episodes.map((e: { id: string; corrected: boolean }) => [e.id, e.corrected]).sort()).toEqual([[ids['episode'], false], [ids['plan'], false]].sort());
    const notes = (await call(url, 'GET', '/api/v1/notes?includePending=true', as('anna'))).body;
    expect(notes).toEqual([expect.objectContaining({ id: ids['note'], pinned: false, pending: true })]);
    expect(JSON.stringify((await call(url, 'GET', '/api/v1/facts', as('anna'))).body)).toContain(ids['fact']);
  });

  it('the memory context for Bruno carries nothing of Anna', async () => {
    const res = await call(url, 'POST', '/api/v1/context', { ...as('bruno'), body: { query: SECRET } });
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain('cardiologo');
  });

  it('MCP recall with Bruno\'s token finds nothing of Anna', async () => {
    const transport = new StreamableHTTPClientTransport(new URL(`${url}/mcp`), { requestInit: { headers: { authorization: `Bearer ${tokenB}` } } });
    const mcp = new Client({ name: 'test', version: '1' });
    await mcp.connect(transport);
    for (const name of ['search_episodes', 'search_memory']) {
      const res = await mcp.callTool({ name, arguments: { query: SECRET } });
      expect([name, JSON.stringify(res).includes('cardiologo')]).toEqual([name, false]);
    }
    await mcp.close();
  });
});
