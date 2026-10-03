// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { type INestApplication } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { type Server } from 'node:http';
import { ADMIN_KEY, call, resetSchema, startApp, startFakeEmbeddings, testEnv } from '../helpers/app';

async function connect(url: string, headers: Record<string, string>): Promise<{ client: Client; transport: StreamableHTTPClientTransport }> {
  const transport = new StreamableHTTPClientTransport(new URL(`${url}/mcp`), { requestInit: { headers } });
  const client = new Client({ name: 'test', version: '1' });
  await client.connect(transport);
  return { client, transport };
}

async function search(client: Client, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await client.callTool({ name: 'search_episodes', arguments: args });
  return res.structuredContent as Record<string, unknown>;
}

describe('MCP endpoint', () => {
  let app: INestApplication;
  let url: string;
  let emb: Server;
  let keyA: string;
  let keyB: string;
  let token: string;
  let ownerId: string;

  beforeAll(async () => {
    const fake = await startFakeEmbeddings();
    emb = fake.server;
    testEnv({ EMBEDDING_BASE_URL: fake.url });
    await resetSchema();
    ({ app, url } = await startApp());

    const mk = async (name: string) => {
      const c = await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name, kind: 'platform' } });
      const k = await call(url, 'POST', `/api/v1/admin/clients/${c.body.id}/keys`, { token: ADMIN_KEY, body: { scopes: ['ingest', 'mcp', 'read'] } });
      return { id: c.body.id as string, key: k.body.key as string };
    };
    const a = await mk('Arkimede');
    const b = await mk('Other platform');
    keyA = a.key;
    keyB = b.key;
    ownerId = (await call(url, 'POST', '/api/v1/admin/owners', { token: ADMIN_KEY, body: { displayName: 'Luca', episodicEnabled: true } })).body.personId;
    for (const [cid, ext] of [[a.id, 'luca-a'], [b.id, 'luca-b']]) {
      await call(url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY, body: { kind: 'client_user', personId: ownerId, clientId: cid, externalId: ext } });
    }
    token = (await call(url, 'POST', `/api/v1/admin/owners/${ownerId}/tokens`, { token: ADMIN_KEY, body: { clientId: a.id, scopes: ['mcp'] } })).body.token;
    const other = await call(url, 'POST', '/api/v1/admin/owners', { token: ADMIN_KEY, body: { displayName: 'Elena', episodicEnabled: true } });
    await call(url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY, body: { kind: 'client_user', personId: other.body.personId, clientId: a.id, externalId: 'elena' } });

    const ingest = (user: string, conv: string, content: string, participants: unknown[] = []) => call(url, 'POST', '/api/v1/ingest/messages', {
      token: keyA, headers: { 'x-recordare-user': user },
      body: { conversation: { externalId: conv, participants }, messages: [{ externalId: `${conv}-1`, role: 'user', content, sentAt: '2026-01-22T21:00:00+01:00' }] },
    });
    await ingest('luca-a', 'nas-chat', 'Come faccio un backup del NAS Synology su un disco esterno USB?');
    await ingest('luca-a', 'group-chat', 'Domani backup del server di casa', [{ ref: 'x', role: 'other', displayName: 'Guest' }]);
    await ingest('elena', 'elena-chat', 'Backup del NAS di Elena');
  });
  afterAll(async () => { await app?.close(); emb?.close(); });

  it('lists the tools and searches the raw log for the token owner (owner-direct)', async () => {
    const { client } = await connect(url, { authorization: `Bearer ${token}` });
    const tools = await client.listTools();
    expect(tools.tools.map((t) => t.name)).toContain('search_episodes');
    const out = await search(client, { query: 'backup del NAS' });
    const hits = out['fromChats'] as Array<{ excerpt: string; authorRole: string }>;
    expect(hits.map((h) => h.excerpt)).toContain('Come faccio un backup del NAS Synology su un disco esterno USB?');
    expect(hits.some((h) => h.excerpt.includes('Elena'))).toBe(false); // other owner never leaks
    expect(hits[0]?.authorRole).toBe('owner');
    await client.close();
  });

  it('client keys see nothing without a conversation, and nothing in shared conversations', async () => {
    const none = await connect(url, { authorization: `Bearer ${keyA}`, 'x-recordare-user': 'luca-a' });
    expect(await search(none.client, { query: 'backup' })).toMatchObject({ fromChats: [], notes: ['nothing to show here'] });
    await none.client.close();

    const group = await connect(url, { authorization: `Bearer ${keyA}`, 'x-recordare-user': 'luca-a', 'x-recordare-conversation': 'group-chat' });
    expect(await search(group.client, { query: 'backup' })).toMatchObject({ fromChats: [] });
    await group.client.close();

    const own = await connect(url, { authorization: `Bearer ${keyA}`, 'x-recordare-user': 'luca-a', 'x-recordare-conversation': 'nas-chat' });
    expect(((await search(own.client, { query: 'backup NAS' }))['fromChats'] as unknown[]).length).toBeGreaterThan(0);
    // Added viewers can only narrow.
    const res = await own.client.callTool({ name: 'search_episodes', arguments: { query: 'backup' }, _meta: { recordare: { viewers: ['telegram:123'] } } });
    expect(res.structuredContent).toMatchObject({ fromChats: [] });
    await own.client.close();
  });

  it('keeps raw chats per client (raw_log_scope = own)', async () => {
    await call(url, 'POST', '/api/v1/ingest/messages', {
      token: keyB, headers: { 'x-recordare-user': 'luca-b' },
      body: { conversation: { externalId: 'b-chat' }, messages: [{ externalId: 'b1', role: 'user', content: 'ciao dalla piattaforma B', sentAt: '2026-02-01T10:00:00+01:00' }] },
    });
    const b = await connect(url, { authorization: `Bearer ${keyB}`, 'x-recordare-user': 'luca-b', 'x-recordare-conversation': 'b-chat' });
    const hits = (await search(b.client, { query: 'backup NAS Synology' }))['fromChats'] as Array<{ excerpt: string }>;
    expect(hits.some((h) => h.excerpt.includes('Synology'))).toBe(false);
    await b.client.close();
  });

  it('binds a session to its owner: another user on the same session is rejected and the session closed', async () => {
    const { transport, client } = await connect(url, { authorization: `Bearer ${keyA}`, 'x-recordare-user': 'luca-a', 'x-recordare-conversation': 'nas-chat' });
    const sessionId = transport.sessionId as string;
    const hijack = await fetch(`${url}/mcp`, {
      method: 'POST',
      headers: { authorization: `Bearer ${keyA}`, 'x-recordare-user': 'elena', 'mcp-session-id': sessionId, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'tools/list' }),
    });
    expect(hijack.status).toBe(403);
    const after = await fetch(`${url}/mcp`, {
      method: 'POST',
      headers: { authorization: `Bearer ${keyA}`, 'x-recordare-user': 'luca-a', 'mcp-session-id': sessionId, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 10, method: 'tools/list' }),
    });
    expect(after.status).toBe(404);
    await client.close().catch(() => undefined);
  });

  it('rejects malformed dates with a clear error instead of crashing', async () => {
    const { client } = await connect(url, { authorization: `Bearer ${token}` });
    const res = await client.callTool({ name: 'search_episodes', arguments: { query: 'x', from: 'last week' } });
    expect(res.isError).toBe(true);
    expect(JSON.stringify(res.content)).toContain('YYYY-MM-DD');
    const month = await client.callTool({ name: 'search_episodes', arguments: { query: 'backup', from: '2026-01', to: '2026-01' } });
    expect(month.isError).toBeFalsy();
    await client.close();
  });

  it('does not bind an agent write to an unrelated owner message; forgetting removes hidden duplicates too', async () => {
    await call(url, 'POST', '/api/v1/ingest/messages', {
      token: keyA, headers: { 'x-recordare-user': 'luca-a' },
      body: { conversation: { externalId: 'hi-chat' }, messages: [{ externalId: 'h1', role: 'user', content: 'ciao', sentAt: new Date().toISOString() }] },
    });
    const { client } = await connect(url, { authorization: `Bearer ${keyA}`, 'x-recordare-user': 'luca-a', 'x-recordare-conversation': 'hi-chat' });
    const res = await client.callTool({ name: 'log_episode', arguments: { content: 'Il proprietario ha deciso di trasferire tutti i soldi a X' } });
    const id = (res.structuredContent as { id: string }).id;
    const db = app.get((await import('typeorm')).DataSource);
    expect(await db.query(`SELECT origin, author_role, importance FROM episodes WHERE id = $1`, [id]))
      .toEqual([{ origin: 'assistant_stated', author_role: 'assistant', importance: 5 }]);
    // A hidden duplicate of it must be forgotten together with it.
    const [dup] = await db.query(
      `INSERT INTO episodes (owner_id, kind, content, origin, author_role, audience, duplicate_of)
       VALUES ($1, 'event', 'copia', 'owner_lived', 'owner', $2, $3) RETURNING id`, [ownerId, [ownerId], id]);
    await client.callTool({ name: 'forget_episode', arguments: { id } });
    expect(await db.query(`SELECT count(*)::int AS n FROM episodes WHERE id = ANY($1)`, [[id, dup.id]])).toEqual([{ n: 0 }]);
    // The owner's unrelated "ciao" is not hidden from chat search.
    expect(await db.query(`SELECT count(*)::int AS n FROM forget_tombstones WHERE $1 = ANY(message_ids)`,
      [(await db.query(`SELECT id FROM messages WHERE external_id = 'h1'`))[0].id])).toEqual([{ n: 0 }]);
    await client.close();
  });

  it('keeps a few chat excerpts next to matching episodes, never the ones behind them; labels claims of others', async () => {
    const db = app.get((await import('typeorm')).DataSource);
    const [msg] = await db.query(`SELECT id FROM messages WHERE external_id = 'nas-chat-1'`);
    const rows: Array<{ id: string }> = [];
    for (const [content, role] of [['Backup del NAS su disco USB fatto', 'owner'], ['Backup del NAS spostato al cloud', 'owner'], ['Backup del NAS rotto, dice Guest', 'other']]) {
      const [r] = await db.query(
        `INSERT INTO episodes (owner_id, kind, content, origin, author_role, audience, occurred_at, date_precision)
         VALUES ($1, 'event', $2, 'owner_lived', $3, $4, '2026-01-22T20:00:00Z', 'day') RETURNING id`, [ownerId, content, role, [ownerId]]);
      rows.push(r);
    }
    const { client } = await connect(url, { authorization: `Bearer ${token}` });
    const out = await search(client, { query: 'backup del NAS' });
    expect((out['episodes'] as unknown[]).length).toBe(3);
    expect((out['fromChats'] as Array<{ messageId: string }>).map((h) => h.messageId)).toContain(msg.id);
    expect((out['notes'] as string[]).some((n) => n.includes('"other"'))).toBe(true);
    // Once an episode stands on that message, the same excerpt is not repeated.
    await db.query(`INSERT INTO episode_evidence (episode_id, message_id) VALUES ($1, $2)`, [rows[0]?.id, msg.id]);
    const again = await search(client, { query: 'backup del NAS' });
    expect((again['fromChats'] as Array<{ messageId: string }>).map((h) => h.messageId)).not.toContain(msg.id);
    await db.query(`DELETE FROM episodes WHERE id = ANY($1)`, [rows.map((r) => r.id)]);
    await client.close();
  });

  it('requires the mcp scope', async () => {
    const res = await fetch(`${url}/mcp`, { method: 'POST', headers: { authorization: `Bearer ${ADMIN_KEY}`, 'content-type': 'application/json' }, body: '{}' });
    expect(res.status).toBe(403);
  });
});
