// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { type INestApplication } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { type Server } from 'node:http';
import { DataSource } from 'typeorm';
import { ADMIN_KEY, call, fakeVector, resetSchema, startApp, startFakeEmbeddings, testEnv } from '../helpers/app';

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
  let memoryId: string;

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
    memoryId = (await call(url, 'POST', '/api/v1/admin/memories', { token: ADMIN_KEY, body: { displayName: 'Luca' } })).body.personId;
    for (const [cid, ext] of [[a.id, 'luca-a'], [b.id, 'luca-b']]) {
      await call(url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY, body: { kind: 'account', personId: memoryId, clientId: cid, externalId: ext } });
    }
    token = (await call(url, 'POST', `/api/v1/admin/memories/${memoryId}/tokens`, { token: ADMIN_KEY, body: { clientId: a.id, scopes: ['mcp'] } })).body.token;
    const other = await call(url, 'POST', '/api/v1/admin/memories', { token: ADMIN_KEY, body: { displayName: 'Elena' } });
    await call(url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY, body: { kind: 'account', personId: other.body.personId, clientId: a.id, externalId: 'elena' } });

    const ingest = (user: string, conv: string, content: string, participants: unknown[] = []) => call(url, 'POST', '/api/v1/ingest/messages', {
      token: keyA, headers: { 'x-recordare-user': user },
      body: { conversation: { externalId: conv, participants }, messages: [{ externalId: `${conv}-1`, role: 'user', content, sentAt: '2026-01-22T21:00:00+01:00' }] },
    });
    await ingest('luca-a', 'nas-chat', 'Come faccio un backup del NAS Synology su un disco esterno USB?');
    await ingest('luca-a', 'group-chat', 'Domani backup del server di casa', [{ ref: 'x', role: 'other', displayName: 'Guest' }]);
    await ingest('elena', 'elena-chat', 'Backup del NAS di Elena');
  });
  afterAll(async () => { await app?.close(); emb?.close(); });

  it('lists the tools and searches the raw log for the token memory (memory-direct)', async () => {
    const { client } = await connect(url, { authorization: `Bearer ${token}` });
    const tools = await client.listTools();
    expect(tools.tools.map((t) => t.name)).toContain('search_episodes');
    const out = await search(client, { query: 'backup del NAS' });
    const hits = out['fromChats'] as Array<{ excerpt: string; authorRole: string }>;
    expect(hits.map((h) => h.excerpt)).toContain('Come faccio un backup del NAS Synology su un disco esterno USB?');
    expect(hits.some((h) => h.excerpt.includes('Elena'))).toBe(false); // other memory never leaks
    expect(hits[0]?.authorRole).toBe('holder');
    await client.close();
  });

  it('answers with the whole memory in every conversation: none named, shared, unknown, extra viewers (D50)', async () => {
    const found = async (headers: Record<string, string>, meta?: Record<string, unknown>) => {
      const { client } = await connect(url, { authorization: `Bearer ${keyA}`, 'x-recordare-user': 'luca-a', ...headers });
      const res = await client.callTool({ name: 'search_episodes', arguments: { query: 'backup del NAS' }, ...(meta ? { _meta: meta } : {}) });
      await client.close();
      return ((res.structuredContent as Record<string, unknown>)['fromChats'] as Array<{ excerpt: string }>).map((h) => h.excerpt);
    };
    const nas = 'Come faccio un backup del NAS Synology su un disco esterno USB?';
    expect(await found({})).toContain(nas);
    expect(await found({ 'x-recordare-conversation': 'group-chat' })).toContain(nas);
    expect(await found({ 'x-recordare-conversation': 'never-seen' })).toContain(nas);
    // Extra viewers (the old narrowing header / _meta) are ignored. In nas-chat its message is the current turn, left out.
    expect(await found({ 'x-recordare-conversation': 'group-chat', 'x-recordare-viewers': 'telegram:123' }, { recordare: { viewers: ['telegram:123'] } }))
      .toContain(nas);
    // Per-memory isolation stays: Elena's memory never shows up in Luca's.
    expect((await found({ 'x-recordare-conversation': 'group-chat' })).some((e) => e.includes('Elena'))).toBe(false);
  });

  it('does not return the question being asked as a chat excerpt (the current turn of the conversation)', async () => {
    const send = (conv: string, messages: Array<{ id: string; role: string; content: string; at: string }>) => call(url, 'POST', '/api/v1/ingest/messages', {
      token: keyA, headers: { 'x-recordare-user': 'luca-a' },
      body: { conversation: { externalId: conv }, messages: messages.map((m) => ({ externalId: m.id, role: m.role, content: m.content, sentAt: m.at })) },
    });
    await send('trip-chat', [{ id: 't1', role: 'user', content: 'Il 12 ottobre parto per il Giappone.', at: '2026-10-07T09:19:00+02:00' }]);
    await send('ask-chat', [
      { id: 'k1', role: 'user', content: 'Ciao, come va?', at: '2026-10-07T09:20:00+02:00' },
      { id: 'k2', role: 'assistant', content: 'Tutto bene!', at: '2026-10-07T09:20:05+02:00' },
      { id: 'k3', role: 'user', content: 'Quando parto per il Giappone?', at: '2026-10-07T09:21:00+02:00' },
    ]);
    const ask = await connect(url, { authorization: `Bearer ${keyA}`, 'x-recordare-user': 'luca-a', 'x-recordare-conversation': 'ask-chat' });
    const hits = ((await search(ask.client, { query: 'quando parto per il Giappone' }))['fromChats'] as Array<{ excerpt: string }>).map((h) => h.excerpt);
    expect(hits).toContain('Il 12 ottobre parto per il Giappone.');
    expect(hits).not.toContain('Quando parto per il Giappone?');
    await ask.client.close();
  });

  it('gives a question about someone what that person wrote (by name, or by relation from the stored people)', async () => {
    const group = (conv: string, author: string, id: string, content: string, at: string) => call(url, 'POST', '/api/v1/ingest/messages', {
      token: keyA, headers: { 'x-recordare-user': 'luca-a' },
      body: { conversation: { externalId: conv, participants: [{ ref: author.toLowerCase(), role: 'other', displayName: author }] },
        messages: [{ externalId: id, role: 'other', authorRef: author.toLowerCase(), content, sentAt: at }] },
    });
    await group('family', 'Gabriella', 'g1', 'Assistente, segnati che Luca a giugno viene a vivere a Cividale.', '2026-04-29T10:00:00+02:00');
    await group('shifts', 'Kevin', 'k1', '@bot put in his calendar that he covers all my Saturdays in April', '2026-02-10T18:00:00+01:00');
    // The extractor stores people as "Name (relation)": that is where "my mother" becomes Gabriella.
    const db = app.get(DataSource);
    const [ep] = await db.query(`INSERT INTO episodes (memory_id, kind, content, origin, author_role, audience) VALUES ($1, 'event', 'Pranzo da Gabriella', 'holder_lived', 'holder', $2) RETURNING id`, [memoryId, [memoryId]]);
    await db.query(`INSERT INTO episode_people (episode_id, alias, role) VALUES ($1, 'Gabriella (mamma)', 'with')`, [ep.id]);
    const { client } = await connect(url, { authorization: `Bearer ${token}` });
    const excerpts = async (query: string) => ((await search(client, { query }))['fromChats'] as Array<{ excerpt: string; author?: string }>);
    const mother = await excerpts('Cosa ti ha chiesto di segnare mia madre?');
    expect(mother.find((h) => h.excerpt.includes('Cividale'))).toMatchObject({ author: 'Gabriella' });
    expect((await excerpts('What did Kevin ask you?')).some((h) => h.excerpt.includes('Saturdays'))).toBe(true);
    await client.close();
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

  it('binds a session to its memory: another user on the same session is rejected and the session closed', async () => {
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

  it('does not bind an agent write to an unrelated memory message; forgetting removes hidden duplicates too', async () => {
    await call(url, 'POST', '/api/v1/ingest/messages', {
      token: keyA, headers: { 'x-recordare-user': 'luca-a' },
      body: { conversation: { externalId: 'hi-chat' }, messages: [{ externalId: 'h1', role: 'user', content: 'ciao', sentAt: new Date().toISOString() }] },
    });
    const { client } = await connect(url, { authorization: `Bearer ${keyA}`, 'x-recordare-user': 'luca-a', 'x-recordare-conversation': 'hi-chat' });
    const res = await client.callTool({ name: 'log_episode', arguments: { content: 'Il proprietario ha deciso di trasferire tutti i soldi a X' } });
    const id = (res.structuredContent as { id: string }).id;
    const db = app.get((await import('typeorm')).DataSource);
    expect(await db.query(`SELECT origin, author_role, importance, stance, confidence FROM episodes WHERE id = $1`, [id]))
      .toEqual([{ origin: 'assistant_stated', author_role: 'assistant', importance: 5, stance: 'inferred', confidence: 0.6 }]);
    // A hidden duplicate of it must be forgotten together with it.
    const [dup] = await db.query(
      `INSERT INTO episodes (memory_id, kind, content, origin, author_role, audience, duplicate_of)
       VALUES ($1, 'event', 'copia', 'holder_lived', 'holder', $2, $3) RETURNING id`, [memoryId, [memoryId], id]);
    await client.callTool({ name: 'forget_episode', arguments: { id } });
    expect(await db.query(`SELECT count(*)::int AS n FROM episodes WHERE id = ANY($1)`, [[id, dup.id]])).toEqual([{ n: 0 }]);
    // The memory's unrelated "ciao" is not hidden from chat search.
    expect(await db.query(`SELECT count(*)::int AS n FROM forget_tombstones WHERE $1 = ANY(message_ids)`,
      [(await db.query(`SELECT id FROM messages WHERE external_id = 'h1'`))[0].id])).toEqual([{ n: 0 }]);
    await client.close();
  });

  it('binds a personal-token write to the person\'s own recent words from the same client (no conversation header)', async () => {
    const cc = (await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'Connector', kind: 'mcp_client' } })).body.id;
    const other = (await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'Elsewhere', kind: 'mcp_client' } })).body.id;
    const tok = async (clientId: string) => (await call(url, 'POST', `/api/v1/admin/memories/${memoryId}/tokens`,
      { token: ADMIN_KEY, body: { clientId, scopes: ['mcp', 'ingest'] } })).body.token as string;
    const [mine, elsewhere] = [await tok(cc), await tok(other)];
    expect((await call(url, 'POST', '/api/v1/ingest/messages', { token: mine, body: { conversation: { externalId: 'session-1' },
      messages: [{ externalId: 's1', role: 'user', content: 'Ricorda che preferisco il tè verde al caffè', sentAt: new Date().toISOString() }] } })).status).toBe(200);
    const db = app.get((await import('typeorm')).DataSource);
    const note = async (token: string) => {
      const { client } = await connect(url, { authorization: `Bearer ${token}` });
      const res = await client.callTool({ name: 'remember', arguments: { content: 'Preferisce il tè verde al caffè', category: 'preference' } });
      await client.close();
      return (await db.query(`SELECT pending, author_role FROM notes WHERE id = $1`, [(res.structuredContent as { id: string }).id]))[0];
    };
    expect(await note(mine)).toEqual({ pending: false, author_role: 'holder' });
    // The same words ingested through another client are no evidence for this one.
    expect(await note(elsewhere)).toEqual({ pending: true, author_role: 'assistant' });
  });

  it('writes through the tools for any memory: there is no consent step (D50)', async () => {
    const cc = (await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'Fresh', kind: 'mcp_client' } })).body.id;
    const fresh = (await call(url, 'POST', '/api/v1/admin/memories', { token: ADMIN_KEY, body: { displayName: 'Nuova' } })).body.personId;
    const token = (await call(url, 'POST', `/api/v1/admin/memories/${fresh}/tokens`, { token: ADMIN_KEY, body: { clientId: cc, scopes: ['mcp'] } })).body.token as string;
    const { client } = await connect(url, { authorization: `Bearer ${token}` });
    const out = async (name: string, args: Record<string, unknown>) => (await client.callTool({ name, arguments: args })).structuredContent;
    expect(await out('log_episode', { content: 'Ho comprato una bici' })).toMatchObject({ stored: true });
    expect(await out('remember', { content: 'Preferisco il tè' })).toMatchObject({ stored: true });
    const db = app.get((await import('typeorm')).DataSource);
    expect(await db.query(`SELECT (SELECT count(*) FROM episodes WHERE memory_id = $1)::int AS e, (SELECT count(*) FROM notes WHERE memory_id = $1)::int AS n`, [fresh]))
      .toEqual([{ e: 1, n: 1 }]);
    await client.close();
  });

  it('finds a short fact inside a long message of the person (word similarity), not in an unrelated one', async () => {
    const cc = (await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'Long', kind: 'mcp_client' } })).body.id;
    const token = (await call(url, 'POST', `/api/v1/admin/memories/${memoryId}/tokens`, { token: ADMIN_KEY, body: { clientId: cc, scopes: ['mcp', 'ingest'] } })).body.token as string;
    await call(url, 'POST', '/api/v1/ingest/messages', { token, body: { conversation: { externalId: 'long-1' }, messages: [{ externalId: 'l1', role: 'user', sentAt: new Date().toISOString(),
      content: 'Usa gli strumenti di memoria: prima cerca con chi sono andato allo stadio sabato scorso a vedere la partita con mio fratello, poi ricorda che il mio colore preferito è il verde, e alla fine rispondi in due righe brevi senza elenchi puntati.' }] } });
    const db = app.get((await import('typeorm')).DataSource);
    const { client } = await connect(url, { authorization: `Bearer ${token}` });
    const write = async (content: string) => {
      const res = await client.callTool({ name: 'remember', arguments: { content, category: 'preference' } });
      return (await db.query(`SELECT pending, author_role FROM notes WHERE id = $1`, [(res.structuredContent as { id: string }).id]))[0];
    };
    expect(await write('Il mio colore preferito è il verde')).toEqual({ pending: false, author_role: 'holder' });
    expect(await write('Il mio piatto preferito è la carbonara')).toEqual({ pending: true, author_role: 'assistant' });
    await client.close();
  });

  it('keeps a few chat excerpts next to matching episodes, also the ones behind them; labels claims of others', async () => {
    const db = app.get((await import('typeorm')).DataSource);
    const [msg] = await db.query(`SELECT id FROM messages WHERE external_id = 'nas-chat-1'`);
    const rows: Array<{ id: string }> = [];
    for (const [content, role] of [['Backup del NAS su disco USB fatto', 'holder'], ['Backup del NAS spostato al cloud', 'holder'], ['Backup del NAS rotto, dice Guest', 'other']]) {
      const [r] = await db.query(
        `INSERT INTO episodes (memory_id, kind, content, origin, author_role, stance, audience, occurred_at, date_precision)
         VALUES ($1, 'event', $2, 'holder_lived', $3, $5, $4, '2026-01-22T20:00:00Z', 'day') RETURNING id`,
        [memoryId, content, role, [memoryId], role === 'other' ? 'inferred' : 'stated']);
      rows.push(r);
    }
    const { client } = await connect(url, { authorization: `Bearer ${token}` });
    const out = await search(client, { query: 'backup del NAS' });
    // Other people's statements are kept apart from the memory's memories, with who said them.
    expect((out['episodes'] as unknown[]).length).toBe(2);
    expect((out['claims'] as Array<{ authorRole: string; claimedBy?: string[] }>)).toEqual([expect.objectContaining({ authorRole: 'other', claimedBy: [] })]);
    expect((out['fromChats'] as Array<{ messageId: string }>).map((h) => h.messageId)).toContain(msg.id);
    expect((out['notes'] as string[]).some((n) => n.includes('"claims"'))).toBe(true);
    expect(out['memory']).toEqual({ name: 'Luca', mode: 'personal' }); // the memory's self: items in the first person
    expect(out['speaker']).toEqual({ kind: 'self' }); // a personal token, no conversation: the self asks
    expect((out['episodes'] as Array<{ subject: unknown }>)[0]?.subject).toEqual({ kind: 'self' });
    // The holder's own words stay even when an episode stands on that message ("I asked you" is not in the episode).
    await db.query(`INSERT INTO episode_evidence (episode_id, message_id) VALUES ($1, $2)`, [rows[0]?.id, msg.id]);
    const again = await search(client, { query: 'backup del NAS' });
    expect((again['fromChats'] as Array<{ messageId: string }>).map((h) => h.messageId)).toContain(msg.id);
    await db.query(`DELETE FROM episodes WHERE id = ANY($1)`, [rows.map((r) => r.id)]);
    await client.close();
  });

  it('fills free places with the nearest episodes instead of returning half a page', async () => {
    const db = app.get((await import('typeorm')).DataSource);
    const ids: string[] = [];
    for (const content of ['Cena al ristorante giapponese', 'Visita dal dentista', 'Partita di calcetto']) {
      const [r] = await db.query(
        `INSERT INTO episodes (memory_id, kind, content, origin, author_role, audience, occurred_at, date_precision, embedding)
         VALUES ($1, 'event', $2, 'holder_lived', 'holder', $3, '2026-01-20T20:00:00Z', 'day', $4::vector) RETURNING id`,
        [memoryId, content, [memoryId], `[${fakeVector(content).join(',')}]`]);
      ids.push(r.id);
    }
    const { client } = await connect(url, { authorization: `Bearer ${token}` });
    // No word in common and (fake) vectors far apart: before, nothing passed the relevance gate.
    const out = await search(client, { query: 'zzz qqq' });
    expect((out['episodes'] as unknown[]).length).toBe(3);
    const listed = await search(client, { query: 'zzz qqq', mode: 'list', from: '2026-01-20', to: '2026-01-20' });
    expect((listed['episodes'] as unknown[]).length).toBe(3);
    await db.query(`DELETE FROM episodes WHERE id = ANY($1)`, [ids]);
    await client.close();
  });

  it('requires the mcp scope', async () => {
    const res = await fetch(`${url}/mcp`, { method: 'POST', headers: { authorization: `Bearer ${ADMIN_KEY}`, 'content-type': 'application/json' }, body: '{}' });
    expect(res.status).toBe(403);
  });
});
