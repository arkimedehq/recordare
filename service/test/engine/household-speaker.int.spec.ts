// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Who said it, in an entity memory (Kinox 2026-11-19): a voice nobody recognised is someone, not the account's speaker —
 * its words wait, and it backs no `remember`; a household member (a verified identity) asking to remember is the
 * evidence, kept at once; `remember` with `replaces` retires the note it corrects; what a household member says about
 * another household member is kept at once (maintainer 2026-11-19), what a guest says still waits.
 */
import { type INestApplication } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { type Server } from 'node:http';
import { DataSource } from 'typeorm';
import { EXTRACTION_RUNNER, type ExtractionRunner } from '../../src/queue/queue.port';
import { ADMIN_KEY, call, resetSchema, startApp, startFakeEmbeddings, startFakeLlm, testEnv } from '../helpers/app';

type Msg = { role: 'user' | 'assistant' | 'other'; content: string; authorRef?: string };

describe('who said it in an entity memory', () => {
  let app: INestApplication;
  let url: string;
  let llm: Awaited<ReturnType<typeof startFakeLlm>>;
  let emb: Server;
  let db: DataSource;
  let key: string;
  let clientId: string;
  let n = 0;
  const T0 = Date.now() - 60_000;

  beforeAll(async () => {
    llm = await startFakeLlm(() => ({}));
    const fake = await startFakeEmbeddings();
    emb = fake.server;
    testEnv({ EMBEDDING_BASE_URL: fake.url, LLM_BASE_URL: llm.url, IDLE_DELAY_SECONDS: '3600', CONSOLIDATION_SCHEDULE: 'false' });
    await resetSchema();
    ({ app, url } = await startApp());
    db = app.get(DataSource);
    clientId = (await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'Robot', kind: 'platform' } })).body.id;
    key = (await call(url, 'POST', `/api/v1/admin/clients/${clientId}/keys`, { token: ADMIN_KEY, body: { scopes: ['ingest', 'read', 'mcp'] } })).body.key;
  });
  afterAll(async () => { await app?.close(); llm?.server.close(); emb?.close(); });

  async function memory(name: string): Promise<string> {
    const id = (await call(url, 'POST', '/api/v1/admin/memories', { token: ADMIN_KEY, body: { displayName: name, mode: 'entity' } })).body.personId;
    await call(url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY, body: { kind: 'account', personId: id, clientId, externalId: name } });
    return id;
  }

  const people = (home: string) => [
    { ref: 'holder', role: 'holder', displayName: home },
    { ref: 'livia', role: 'other', displayName: 'Livia', identity: { channel: 'voice', externalId: `livia-${home}` } },
    { ref: 'bianca', role: 'other', displayName: 'Bianca', identity: { channel: 'voice', externalId: `bianca-${home}` } },
    { ref: 'ugo', role: 'other', displayName: 'Ugo' },
  ];

  /** Turns of one conversation (voice or chat); returns its id. */
  async function say(user: string, conversation: string, source: 'voice' | 'chat', msgs: Msg[]): Promise<string> {
    const res = await call(url, 'POST', '/api/v1/ingest/messages', {
      token: key, headers: { 'x-recordare-user': user },
      body: { conversation: { externalId: conversation, source, participants: people(user) },
        messages: msgs.map((m, i) => ({ externalId: `${conversation}-${++n}`, sentAt: new Date(T0 + n * 1000 + i).toISOString(),
          ...(m.role === 'user' ? { authorRef: 'holder' } : {}), ...m })) },
    });
    expect(res.status).toBeLessThan(300);
    return res.body.conversationId as string;
  }

  /** Livia and Bianca are the household (an identity the client declared, or one verified); Ugo, a guest without one, is someone. */
  async function household(user: string, home: string): Promise<{ livia: string; bianca: string }> {
    await say(user, 'hello', 'chat', [{ role: 'other', authorRef: 'livia', content: 'Ciao!' }, { role: 'other', authorRef: 'bianca', content: 'Ciao!' },
      { role: 'other', authorRef: 'ugo', content: 'Ciao!' }]);
    const id = async (name: string) => (await db.query(`SELECT id FROM persons WHERE memory_id = $1 AND display_name = $2`, [home, name]))[0].id as string;
    const livia = await id('Livia');
    const bianca = await id('Bianca');
    for (const [who, ext] of [[livia, 'livia'], [bianca, 'bianca']]) {
      await call(url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY,
        body: { kind: 'participant', memoryId: home, personId: who, channel: 'face', externalId: `${ext}-face-${home}`, verified: true } });
    }
    return { livia, bianca };
  }

  async function extract(conversationId: string, out: object): Promise<void> {
    llm.queue.push(out);
    await app.get<ExtractionRunner>(EXTRACTION_RUNNER).runForConversation(conversationId);
  }

  async function mcp(home: string, conversation: string): Promise<Client> {
    const transport = new StreamableHTTPClientTransport(new URL(`${url}/mcp`), { requestInit: { headers: {
      authorization: `Bearer ${key}`, 'x-recordare-user': home, 'x-recordare-conversation': conversation } } });
    const client = new Client({ name: 'test', version: '1' });
    await client.connect(transport);
    return client;
  }
  const out = async (client: Client, name: string, args: Record<string, unknown>) =>
    (await client.callTool({ name, arguments: args })).structuredContent as Record<string, unknown>;
  const note = async (id: unknown) => (await db.query(
    `SELECT status::text, pending, origin::text, author_role::text, supersedes FROM notes WHERE id = $1`, [id]))[0];

  it('keeps an unrecognised voice as someone: its words wait; the same turn in a chat is still the account\'s speaker', async () => {
    const home = await memory('Villa');
    const voice = await say('Villa', 'v1', 'voice', [{ role: 'user', content: 'Il bidone della carta si porta fuori il martedì.' }]);
    await extract(voice, { facts: [{ key: 'paper_bin_day', value: 'martedì', verdict: 'new', subject: 'me', evidence: [1] }] });
    expect((await db.query(`SELECT pending, author_role::text FROM facts WHERE memory_id = $1 AND key = 'paper_bin_day'`, [home]))[0])
      .toEqual({ pending: true, author_role: 'other' });

    const chat = await say('Villa', 'c1', 'chat', [{ role: 'user', content: 'Il bidone del vetro si porta fuori il giovedì.' }]);
    await extract(chat, { facts: [{ key: 'glass_bin_day', value: 'giovedì', verdict: 'new', subject: 'me', evidence: [1] }] });
    expect((await db.query(`SELECT pending, author_role::text FROM facts WHERE memory_id = $1 AND key = 'glass_bin_day'`, [home]))[0])
      .toEqual({ pending: false, author_role: 'holder' });
  });

  it('remember: an unrecognised voice backs nothing; a household member does, and `replaces` retires the note corrected', async () => {
    const home = await memory('Corte');
    await household('Corte', home);
    await say('Corte', 'v2', 'voice', [{ role: 'user', content: 'Il corso di musica di Bianca il giovedì finisce alle 16 e 30.' }]);
    const client = await mcp('Corte', 'v2');
    const wrong = await out(client, 'remember', { content: 'Il corso di musica di Bianca il giovedì finisce alle 16:30.' });
    expect(await note(wrong['id'])).toMatchObject({ status: 'current', pending: true, origin: 'assistant_stated' });

    await say('Corte', 'v2', 'voice', [{ role: 'other', authorRef: 'livia', content: 'Correggi: il corso di musica di Bianca il giovedì va dalle 15 alle 16.' }]);
    const right = await out(client, 'remember', { content: 'Il corso di musica di Bianca il giovedì va dalle 15 alle 16.', replaces: wrong['id'] });
    expect(await note(right['id'])).toEqual({ status: 'current', pending: false, origin: 'holder_told', author_role: 'other', supersedes: wrong['id'] });
    expect(await note(wrong['id'])).toMatchObject({ status: 'superseded' });
    expect((await db.query(`SELECT count(*)::int AS n FROM item_informants WHERE note_id = $1`, [right['id']]))[0]).toEqual({ n: 1 });

    // A note that is not current (or not this memory's) cannot be replaced.
    const again = await client.callTool({ name: 'remember', arguments: { content: 'Il corso di musica finisce alle 17.', replaces: wrong['id'] } });
    expect(again.isError).toBe(true);
    await client.close();
  });

  it('remember: a guest nobody identified backs nothing — pending, and only proposed against the stated note it replaces', async () => {
    const home = await memory('Borgo');
    await household('Borgo', home);
    await say('Borgo', 'c3', 'chat', [{ role: 'other', authorRef: 'livia', content: 'Ricorda che la palestra di Bianca è il lunedì.' }]);
    const client = await mcp('Borgo', 'c3');
    const stated = await out(client, 'remember', { content: 'La palestra di Bianca è il lunedì.' });
    expect(await note(stated['id'])).toMatchObject({ pending: false, origin: 'holder_told' });

    await say('Borgo', 'c3', 'chat', [{ role: 'other', authorRef: 'ugo', content: 'La palestra di Bianca è il martedì, ricordalo.' }]);
    const proposed = await out(client, 'remember', { content: 'La palestra di Bianca è il martedì.', replaces: stated['id'] });
    expect(await note(proposed['id'])).toMatchObject({ pending: true, origin: 'assistant_stated', supersedes: stated['id'] });
    expect(await note(stated['id'])).toMatchObject({ status: 'current' });
    await client.close();
  });

  it('keeps at once what a household member says about another; what a guest says still waits', async () => {
    const home = await memory('Cascina');
    await household('Cascina', home);
    const c = await say('Cascina', 'c4', 'chat', [{ role: 'other', authorRef: 'livia', content: 'Bianca il giovedì ha musica dalle 15 alle 16.' }]);
    await extract(c, { notes: [{ subject: 'Bianca', category: 'habit', content: 'Bianca il giovedì ha musica dalle 15 alle 16.', evidence: [1] }] });
    expect((await db.query(`SELECT pending FROM notes WHERE memory_id = $1 AND content LIKE 'Bianca il giovedì%'`, [home]))[0]).toEqual({ pending: false });

    const d = await say('Cascina', 'c5', 'chat', [{ role: 'other', authorRef: 'ugo', content: 'Bianca il venerdì ha nuoto.' }]);
    await extract(d, { notes: [{ subject: 'Bianca', category: 'habit', content: 'Bianca il venerdì ha nuoto.', evidence: [1] }] });
    expect((await db.query(`SELECT pending FROM notes WHERE memory_id = $1 AND content LIKE 'Bianca il venerdì%'`, [home]))[0]).toEqual({ pending: true });
  });
});
