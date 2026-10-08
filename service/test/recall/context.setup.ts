// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/** Shared set-up of the memory context tests: an owner, two conversations, memories with controlled vectors. */
import { DataSource } from 'typeorm';
import { ADMIN_KEY, call, fakeVector, resetSchema, startApp, startFakeEmbeddings, testEnv } from '../helpers/app';

const QUERY = 'Che macchina ho?';
const vec = (v: number[]) => `[${v.join(',')}]`;
const near = vec(fakeVector(QUERY));
const far = vec(fakeVector(QUERY).map((x) => -x));

export async function setup(env: Record<string, string>) {
  const fake = await startFakeEmbeddings();
  testEnv({ EMBEDDING_BASE_URL: fake.url, IDLE_DELAY_SECONDS: '3600', ALLOW_CLOCK_OVERRIDE: 'true', ...env });
  await resetSchema();
  const { app, url } = await startApp();
  const client = (await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'P', kind: 'platform', autoProvision: true } })).body;
  const key = (await call(url, 'POST', `/api/v1/admin/clients/${client.id}/keys`, { token: ADMIN_KEY, body: { scopes: ['ingest', 'read'] } })).body.key;
  const ownerId = (await call(url, 'GET', '/api/v1/me', { token: key, headers: { 'x-recordare-user': 'u1' } })).body.ownerId;
  await call(url, 'PATCH', `/api/v1/admin/owners/${ownerId}`, { token: ADMIN_KEY, body: { episodicEnabled: true } });
  const send = (conversation: string, participants: object[] = []) => call(url, 'POST', '/api/v1/ingest/messages', {
    token: key, headers: { 'x-recordare-user': 'u1' },
    body: { conversation: { externalId: conversation, participants }, messages: [{ externalId: `${conversation}-1`, role: 'user', content: 'ciao', sentAt: '2026-10-01T10:00:00+02:00' }] },
  });
  await send('chat-1');
  await send('group', [{ ref: 'bob', role: 'other', displayName: 'Bob' }]);
  const db = app.get(DataSource);
  const prov = `'owner_lived', 'owner', 'stated', 1, 'owner', ARRAY[$1::uuid]`;
  await db.query(`INSERT INTO fact_slots (key, description) VALUES ('car', 'car') ON CONFLICT DO NOTHING`);
  await db.query(`INSERT INTO facts (owner_id, key, value, valid_from, origin, author_role, stance, confidence, disclosure, audience, embedding)
    VALUES ($1, 'car', 'Toyota Yaris', '2026-10-03', ${prov}, $2)`, [ownerId, near]);
  await db.query(`INSERT INTO notes (owner_id, category, content, origin, author_role, stance, confidence, disclosure, audience, embedding)
    VALUES ($1, 'preference', 'Prende il caffè amaro', ${prov}, $2)`, [ownerId, far]);
  const episode = (content: string, kind: string, at: string, v: string) => db.query(
    `INSERT INTO episodes (owner_id, kind, content, occurred_at, date_precision, plan_status, origin, author_role, stance, confidence, disclosure, audience, embedding)
     VALUES ($1, $2, $3, $4, 'day', ${kind === 'plan' ? "'open'" : 'NULL'}, ${prov}, $5)`, [ownerId, kind, content, at, v]);
  await episode('Ha comprato una Toyota Yaris ibrida grigia', 'state_change', '2026-10-03', near);
  await episode('Cena da Marco', 'event', '2026-10-02', far);
  await episode('Tagliando della Yaris', 'plan', '2026-10-09', near);
  await episode('Revisione della Yaris', 'plan', '2026-12-01', near); // beyond the plan horizon
  const context = (conversation: string, query = QUERY) => call(url, 'POST', '/api/v1/context', {
    token: key, headers: { 'x-recordare-user': 'u1', 'x-recordare-conversation': conversation, 'x-recordare-now': '2026-10-07T10:00:00+02:00' },
    body: { query },
  });
  return { app, fake, db, ownerId, context, url, key, query: QUERY };
}

