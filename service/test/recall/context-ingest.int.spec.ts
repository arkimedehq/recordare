// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { getQueueToken } from '@nestjs/bullmq';
import { type Queue } from 'bullmq';
import { ADMIN_KEY, call } from '../helpers/app';
import { setup } from './context.setup';

/** WORK_PLAN 6.6b: what the connectors needed — one call before a turn, a message-less end, personal tokens. */
describe('connector calls (WORK_PLAN 6.6b)', () => {
  let s: Awaited<ReturnType<typeof setup>>;
  beforeAll(async () => { s = await setup({}); });
  afterAll(async () => { await s?.app.close(); s?.fake.server.close(); });
  const as = (extra: Record<string, string> = {}) => ({ token: s.key, headers: { 'x-recordare-user': 'u1', 'x-recordare-now': '2026-10-07T10:00:00+02:00', ...extra } });
  const turn = (conversation: string, id: string, content: string) =>
    ({ conversation: { externalId: conversation }, messages: [{ externalId: id, role: 'user', content, sentAt: '2026-10-07T09:59:00+02:00' }] });

  it('stores the turn and returns the memory context in one call (query defaults to the last user message)', async () => {
    const res = await call(s.url, 'POST', '/api/v1/context', { ...as(), body: { ingest: turn('new-chat', 'n1', s.query) } });
    expect(res.status).toBe(200);
    expect(res.body.items).toBe(3);
    const [m] = await s.db.query(`SELECT c.external_id FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE m.external_id = 'n1'`);
    expect(m).toEqual({ external_id: 'new-chat' });
    // Without the ingest scope the turn is refused (a read-only key cannot write).
    const client = (await call(s.url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'R', kind: 'platform' } })).body;
    const readOnly = (await call(s.url, 'POST', `/api/v1/admin/clients/${client.id}/keys`, { token: ADMIN_KEY, body: { scopes: ['read'] } })).body.key;
    await call(s.url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY, body: { kind: 'client_user', personId: s.ownerId, clientId: client.id, externalId: 'u1' } });
    expect((await call(s.url, 'POST', '/api/v1/context', { token: readOnly, headers: { 'x-recordare-user': 'u1' }, body: { ingest: turn('x', 'x1', 'ciao') } })).status).toBe(403);
    expect((await call(s.url, 'POST', '/api/v1/context', { ...as(), body: {} })).status).toBe(400);
  });

  it('ends a conversation without a message', async () => {
    const queue = s.app.get<Queue>(getQueueToken('extraction'));
    await call(s.url, 'POST', '/api/v1/ingest/messages', { ...as(), body: turn('to-end', 'e1', 'ciao') });
    const [conv] = await s.db.query(`SELECT id FROM conversations WHERE external_id = 'to-end'`);
    expect(await (await queue.getJob(`idle-${conv.id}`))!.isDelayed()).toBe(true);
    expect((await call(s.url, 'POST', '/api/v1/ingest/conversations/to-end/end', as())).status).toBe(202);
    let delayed = true;
    for (let i = 0; i < 40 && delayed; i++) {
      const job = await queue.getJob(`idle-${conv.id}`);
      delayed = job ? await job.isDelayed() : false;
      if (delayed) await new Promise((r) => setTimeout(r, 50));
    }
    expect(delayed).toBe(false);
    expect((await call(s.url, 'POST', '/api/v1/ingest/conversations/never-seen/end', as())).status).toBe(404);
  });

  it('lets a personal token and a client key read before their conversation is stored', async () => {
    const client = (await call(s.url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'T', kind: 'mcp_client' } })).body;
    const token = (await call(s.url, 'POST', `/api/v1/admin/owners/${s.ownerId}/tokens`, { token: ADMIN_KEY, body: { clientId: client.id, scopes: ['read'] } })).body.token;
    const ask = (t: string, user?: string) => call(s.url, 'POST', '/api/v1/context', {
      token: t, headers: { 'x-recordare-conversation': 'not-stored-yet', 'x-recordare-now': '2026-10-07T10:00:00+02:00', ...(user ? { 'x-recordare-user': user } : {}) }, body: { query: s.query } });
    expect((await ask(token)).body.items).toBe(3);
    expect((await ask(s.key, 'u1')).body.items).toBe(3);
  });
});
