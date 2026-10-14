// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * D51 (WORK_PLAN 8.7): the holder's channel identities by one-time code — the code makes a claim, never a message; only
 * the holder's confirmation makes that sender "I"; groups, wrong codes, retries, entity memories, unlinking.
 */
import { type INestApplication } from '@nestjs/common';
import { type Server } from 'node:http';
import { DataSource } from 'typeorm';
import { ADMIN_KEY, call, resetSchema, startApp, startFakeEmbeddings, startFakeLlm, testEnv } from '../helpers/app';

describe('holder links (D51)', () => {
  let app: INestApplication;
  let url: string;
  let db: DataSource;
  let llm: Awaited<ReturnType<typeof startFakeLlm>>;
  let emb: Server;
  let token: string;
  let memoryId: string;
  let n = 0;

  beforeAll(async () => {
    llm = await startFakeLlm();
    const fake = await startFakeEmbeddings();
    emb = fake.server;
    testEnv({ EMBEDDING_BASE_URL: fake.url, LLM_BASE_URL: llm.url, IDLE_DELAY_SECONDS: '3600' });
    await resetSchema();
    ({ app, url } = await startApp());
    db = app.get(DataSource);
    const clientId = (await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'Gateway', kind: 'mcp_client' } })).body.id;
    memoryId = (await call(url, 'POST', '/api/v1/admin/memories', { token: ADMIN_KEY, body: { displayName: 'Andrea' } })).body.personId;
    token = (await call(url, 'POST', `/api/v1/admin/memories/${memoryId}/tokens`, { token: ADMIN_KEY, body: { clientId, scopes: ['mcp', 'ingest', 'read'] } })).body.token;
  });
  afterAll(async () => { await app?.close(); llm?.server.close(); emb?.close(); });

  const me = (method: string, path: string) => call(url, method, `/api/v1/me${path}`, { token });
  /** One message from a Telegram sender in a conversation; `direct` as the connector knows it. */
  const send = (sender: string, content: string, direct?: boolean, conversation = 'tg-dm') => call(url, 'POST', '/api/v1/ingest/messages', {
    token,
    body: {
      conversation: { externalId: conversation, ...(direct === undefined ? {} : { direct }), participants: [
        { ref: `telegram:${sender}`, role: 'other', displayName: sender === '42' ? 'Andrea G.' : 'Mallory', identity: { channel: 'telegram', externalId: sender } },
      ] },
      messages: [{ externalId: `m${++n}`, role: 'other', authorRef: `telegram:${sender}`, content, sentAt: '2026-10-14T10:00:00+02:00' }],
    },
  });
  const author = async (content: string) => (await db.query(
    `SELECT author_kind AS kind FROM messages WHERE memory_id = $1 AND content = $2 ORDER BY sent_at DESC, external_id DESC LIMIT 1`, [memoryId, content]))[0]?.kind;
  const stored = async (content: string) => Number((await db.query(`SELECT count(*) FROM messages WHERE content = $1`, [content]))[0].count);

  it('links a channel identity only after the holder confirms the claim', async () => {
    await send('42', 'Ciao, sono io');
    expect(await author('Ciao, sono io')).toBe('contact'); // not configured as the holder: a contact (kept, D51 / option a)

    const code = await me('POST', '/link-codes');
    expect(code.status).toBe(201);
    expect(code.body.code).toMatch(/^RCD-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);

    // In a group the code claims nothing; the message is never stored.
    await send('42', code.body.code, false, 'tg-group');
    expect((await me('GET', '/identities')).body.pending).toEqual([]);

    // In the DM (lower case, no dashes: still the code): a claim, not a message.
    const typed = code.body.code.toLowerCase().replace(/-/g, '');
    expect(await send('42', typed, true)).toMatchObject({ status: 200, body: { accepted: 0 } });
    expect(await stored(typed)).toBe(0);
    const ids = (await me('GET', '/identities')).body;
    expect(ids.linked).toEqual([]);
    expect(ids.pending).toMatchObject([{ channel: 'telegram', externalId: '42', displayName: 'Andrea G.' }]);

    // Not confirmed yet: still the contact.
    await send('42', 'Prima della conferma');
    expect(await author('Prima della conferma')).toBe('contact');

    // Someone else re-using the claimed code claims nothing.
    await send('666', code.body.code, true);
    expect((await me('GET', '/identities')).body.pending).toHaveLength(1);

    expect((await me('POST', `/identities/pending/${ids.pending[0].id}/confirm`)).status).toBe(204);
    await send('42', 'Dopo la conferma');
    expect(await author('Dopo la conferma')).toBe('self');
    expect(await author('Prima della conferma')).toBe('contact'); // the past keeps its attribution
    const after = (await me('GET', '/identities')).body;
    expect(after.pending).toEqual([]);
    expect(after.linked).toMatchObject([{ channel: 'telegram', externalId: '42' }]);

    // Unlinked: a participant like any other again.
    expect((await me('DELETE', `/identities/${after.linked[0].id}`)).status).toBe(204);
    await send('42', 'Scollegato');
    expect(await author('Scollegato')).toBe('contact');
  });

  it('rejects claims, cancels open codes after five wrong ones, and refuses entity memories', async () => {
    const code = (await me('POST', '/link-codes')).body.code as string;
    await send('666', code, true);
    const [claim] = (await me('GET', '/identities')).body.pending;
    expect(claim).toMatchObject({ externalId: '666' });
    expect((await me('DELETE', `/identities/pending/${claim.id}`)).status).toBe(204);
    expect((await me('GET', '/identities')).body.pending).toEqual([]);

    const open = (await me('POST', '/link-codes')).body.code as string;
    for (let i = 0; i < 5; i++) await send('666', `RCD-ZZZZ-ZZZ${i}`, true);
    await send('42', open, true);
    expect((await me('GET', '/identities')).body.pending).toEqual([]); // cancelled
    expect(await stored(open)).toBe(0);

    await call(url, 'PATCH', `/api/v1/admin/memories/${memoryId}`, { token: ADMIN_KEY, body: { mode: 'entity' } });
    expect(await me('POST', '/link-codes')).toMatchObject({ status: 409, body: { code: 'memory_not_personal' } });
    await call(url, 'PATCH', `/api/v1/admin/memories/${memoryId}`, { token: ADMIN_KEY, body: { mode: 'personal' } });
  });

  it('lets the admin make a code and confirm a claim', async () => {
    const code = (await call(url, 'POST', `/api/v1/admin/memories/${memoryId}/link-codes`, { token: ADMIN_KEY })).body.code;
    await send('77', code, true);
    const persons = (await call(url, 'GET', '/api/v1/admin/persons', { token: ADMIN_KEY })).body;
    const [claim] = persons.find((p: { id: string }) => p.id === memoryId).linkClaims;
    expect(claim).toMatchObject({ channel: 'telegram', externalId: '77' });
    expect((await call(url, 'POST', `/api/v1/admin/memories/${memoryId}/link-claims/${claim.id}/confirm`, { token: ADMIN_KEY })).status).toBe(204);
    await send('77', 'Dal secondo telefono');
    expect(await author('Dal secondo telefono')).toBe('self');
  });
});
