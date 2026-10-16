// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { type INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { type Queue } from 'bullmq';
import { type Server } from 'node:http';
import { DataSource } from 'typeorm';
import { ADMIN_KEY, call, resetSchema, startApp, startFakeEmbeddings, testEnv } from '../helpers/app';

describe('room fan-out: one transcript heard in a room, into the memories of the people present (WORK_PLAN 6.5 (4))', () => {
  let app: INestApplication;
  let url: string;
  let db: DataSource;
  let emb: Server;
  let key: string;
  let clientId: string;
  const memory: Record<string, string> = {};

  beforeAll(async () => {
    const fake = await startFakeEmbeddings();
    emb = fake.server;
    testEnv({ EMBEDDING_BASE_URL: fake.url });
    await resetSchema();
    ({ app, url } = await startApp());
    db = app.get(DataSource);
    await app.get<Queue>(getQueueToken('extraction')).obliterate({ force: true });
    const client = await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'Casa', kind: 'platform' } });
    clientId = client.body.id;
    key = (await call(url, 'POST', `/api/v1/admin/clients/${clientId}/keys`, { token: ADMIN_KEY, body: { scopes: ['ingest'] } })).body.key;
    for (const [user, name] of [['stefano', 'Stefano'], ['chiara', 'Chiara']] as const) {
      memory[user] = (await call(url, 'POST', '/api/v1/admin/memories', { token: ADMIN_KEY, body: { displayName: name } })).body.personId;
      await call(url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY, body: { kind: 'account', personId: memory[user], clientId, externalId: user } });
    }
  });
  afterAll(async () => { await app?.close(); emb?.close(); });

  const room = (recipients: string[], extra: Record<string, unknown> = {}) => ({
    conversation: { externalId: 'kitchen-2026-11-08', channel: 'kitchen' },
    speakers: [
      { ref: 's', displayName: 'Stefano', user: 'stefano' },
      { ref: 'c', displayName: 'Chiara', user: 'chiara' },
      { ref: 'l', displayName: 'Leo', identity: { channel: 'voice', externalId: 'leo-voice' } },
    ],
    recipients,
    messages: [
      { externalId: 'k1', speakerRef: 's', content: 'Domenica pranzo ad Asolo con la mamma.', sentAt: '2026-11-08T13:00:00+01:00' },
      { externalId: 'k2', speakerRef: 'c', content: 'Io faccio le notti fino a Natale.', sentAt: '2026-11-08T13:01:00+01:00' },
      { externalId: 'k3', speakerRef: 'l', content: 'Mi hanno preso nell\'Under 15!', sentAt: '2026-11-08T13:02:00+01:00' },
      { externalId: 'k4', content: 'Chi ha visto le chiavi?', sentAt: '2026-11-08T13:03:00+01:00' },
    ],
    ...extra,
  });
  const authors = (user: string) => db.query(
    `SELECT m.external_id, m.role, m.author_kind, p.display_name AS author FROM messages m JOIN conversations c ON c.id = m.conversation_id
       LEFT JOIN persons p ON p.id = m.author_person_id
     WHERE c.memory_id = $1 AND c.external_id = 'kitchen-2026-11-08' AND c.source = 'ambient' ORDER BY m.external_id`, [memory[user]]);

  it('each recipient gets it as an ambient conversation: their own words theirs, the others contacts, an unknown voice someone', async () => {
    const res = await call(url, 'POST', '/api/v1/ingest/room', { token: key, body: room(['stefano', 'chiara']) });
    expect(res.status).toBe(200);
    expect(res.body.recipients).toEqual([
      expect.objectContaining({ user: 'stefano', accepted: 4, duplicates: 0, conflicts: [] }),
      expect.objectContaining({ user: 'chiara', accepted: 4, duplicates: 0, conflicts: [] }),
    ]);
    expect(await authors('stefano')).toEqual([
      { external_id: 'k1', role: 'user', author_kind: 'self', author: 'Stefano' },
      { external_id: 'k2', role: 'other', author_kind: 'contact', author: 'Chiara' },
      { external_id: 'k3', role: 'other', author_kind: 'contact', author: 'Leo' },
      { external_id: 'k4', role: 'other', author_kind: 'someone', author: null },
    ]);
    expect(await authors('chiara')).toEqual([
      { external_id: 'k1', role: 'other', author_kind: 'contact', author: 'Stefano' },
      { external_id: 'k2', role: 'user', author_kind: 'self', author: 'Chiara' },
      { external_id: 'k3', role: 'other', author_kind: 'contact', author: 'Leo' },
      { external_id: 'k4', role: 'other', author_kind: 'someone', author: null },
    ]);
    // Contacts live inside each memory (D50): Chiara is a contact of Stefano's, never his memory's link to hers.
    const [contact] = await db.query(`SELECT memory_id FROM persons WHERE display_name = 'Chiara' AND memory_id = $1`, [memory['stefano']]);
    expect(contact).toEqual({ memory_id: memory['stefano'] });
  });

  it('a resend is idempotent; a recipient who is not speaking still hears it', async () => {
    const again = await call(url, 'POST', '/api/v1/ingest/room', { token: key, body: room(['stefano', 'chiara']) });
    expect(again.body.recipients.map((r: { duplicates: number }) => r.duplicates)).toEqual([4, 4]);
    await call(url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY, body: { kind: 'account', clientId,
      personId: (await call(url, 'POST', '/api/v1/admin/memories', { token: ADMIN_KEY, body: { displayName: 'Rosanna' } })).body.personId,
      externalId: 'rosanna' } });
    const listener = await call(url, 'POST', '/api/v1/ingest/room', { token: key, body: room(['rosanna']) });
    expect(listener.body.recipients).toEqual([expect.objectContaining({ user: 'rosanna', accepted: 4 })]);
  });

  it('rejects a speakerRef naming no speaker, and a personal token (it acts for one memory)', async () => {
    const bad = room(['stefano']);
    bad.messages[0]!.speakerRef = 'x';
    expect((await call(url, 'POST', '/api/v1/ingest/room', { token: key, body: bad })).status).toBe(400);
    const token = (await call(url, 'POST', `/api/v1/admin/memories/${memory['stefano']}/tokens`, { token: ADMIN_KEY, body: { clientId, scopes: ['ingest'] } })).body.token;
    expect((await call(url, 'POST', '/api/v1/ingest/room', { token, body: room(['stefano']) })).status).toBe(403);
  });
});
