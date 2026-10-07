// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { type INestApplication } from '@nestjs/common';
import { ADMIN_KEY, call, resetSchema, startApp, testEnv } from '../helpers/app';

describe('auth and admin (v1 home / research profile)', () => {
  let app: INestApplication;
  let url: string;

  beforeAll(async () => {
    testEnv();
    await resetSchema();
    ({ app, url } = await startApp());
  });
  afterAll(async () => { await app?.close(); });

  it('health is public', async () => {
    expect(await call(url, 'GET', '/api/v1/health')).toMatchObject({ status: 200, body: { status: 'ok', database: true } });
  });

  it('denies by default: no credential → 401, bad credential → 401 with problem details', async () => {
    expect((await call(url, 'GET', '/api/v1/me')).status).toBe(401);
    const bad = await call(url, 'POST', '/api/v1/admin/clients', { token: 'rk_000000000000_' + 'x'.repeat(43), body: {} });
    expect(bad).toMatchObject({ status: 401, body: { status: 401, code: 'unauthorized' } });
  });

  it('runs the admin flow: client, key, owner, identity, token; scopes and revocation are enforced', async () => {
    const client = await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'Arkimede', kind: 'platform' } });
    expect(client.status).toBe(201);
    const key = await call(url, 'POST', `/api/v1/admin/clients/${client.body.id}/keys`, { token: ADMIN_KEY, body: { scopes: ['ingest', 'read'] } });
    expect(key.body.key).toMatch(/^rk_[0-9a-f]{12}_/);

    // Client keys can never carry admin / consent scopes.
    const adminScope = await call(url, 'POST', `/api/v1/admin/clients/${client.body.id}/keys`, { token: ADMIN_KEY, body: { scopes: ['admin'] } });
    expect(adminScope).toMatchObject({ status: 400, body: { code: 'invalid_request' } });

    const owner = await call(url, 'POST', '/api/v1/admin/owners', { token: ADMIN_KEY, body: { displayName: 'Luca', episodicEnabled: true } });
    expect(owner.body).toMatchObject({ episodicEnabled: true, episodicEnabledBy: 'admin', locale: 'it' });
    const ownerId: string = owner.body.personId;

    const ident = { kind: 'client_user', personId: ownerId, clientId: client.body.id, externalId: 'user-42' };
    expect((await call(url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY, body: ident })).status).toBe(201);
    expect(await call(url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY, body: ident }))
      .toMatchObject({ status: 400, body: { code: 'cannot_link' } });

    // Client key acts for the mapped owner; admin routes stay forbidden.
    expect(await call(url, 'GET', '/api/v1/me', { token: key.body.key, headers: { 'x-recordare-user': 'user-42' } }))
      .toMatchObject({ status: 200, body: { ownerId, via: 'client' } });
    expect((await call(url, 'GET', '/api/v1/me', { token: key.body.key, headers: { 'x-recordare-user': 'stranger' } })).status).toBe(404);
    expect((await call(url, 'GET', '/api/v1/me', { token: key.body.key })).status).toBe(404);
    expect((await call(url, 'POST', '/api/v1/admin/clients', { token: key.body.key, body: { name: 'x', kind: 'import' } })).status).toBe(403);

    // Personal token bound to the owner.
    const tok = await call(url, 'POST', `/api/v1/admin/owners/${ownerId}/tokens`, { token: ADMIN_KEY, body: { clientId: client.body.id, scopes: ['mcp', 'read'] } });
    expect(tok.body.token).toMatch(/^rp_/);
    expect(await call(url, 'GET', '/api/v1/me', { token: tok.body.token })).toMatchObject({ status: 200, body: { ownerId, via: 'owner_token' } });

    // Revocation takes effect immediately.
    expect((await call(url, 'DELETE', `/api/v1/admin/keys/${key.body.id}`, { token: ADMIN_KEY })).status).toBe(204);
    expect((await call(url, 'GET', '/api/v1/me', { token: key.body.key, headers: { 'x-recordare-user': 'user-42' } })).status).toBe(401);
    expect((await call(url, 'DELETE', `/api/v1/admin/tokens/${tok.body.id}`, { token: ADMIN_KEY })).status).toBe(204);
    expect((await call(url, 'GET', '/api/v1/me', { token: tok.body.token })).status).toBe(401);
  });

  it('auto-provisions owners only for clients that allow it', async () => {
    const client = await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'Bot', kind: 'platform', autoProvision: true } });
    const key = await call(url, 'POST', `/api/v1/admin/clients/${client.body.id}/keys`, { token: ADMIN_KEY, body: { scopes: ['read'] } });
    const first = await call(url, 'GET', '/api/v1/me', { token: key.body.key, headers: { 'x-recordare-user': 'new-user' } });
    expect(first.status).toBe(200);
    const again = await call(url, 'GET', '/api/v1/me', { token: key.body.key, headers: { 'x-recordare-user': 'new-user' } });
    expect(again.body.ownerId).toBe(first.body.ownerId);
    expect(first.body.displayName).toBe('new-user'); // named after the client's id until named
    expect(first.body.episodicEnabled).toBe(false); // consent belongs to the admin / the owner, never to the client

    // The client may name a person it created, once; after the admin renamed them it may not.
    const ingestKey = await call(url, 'POST', `/api/v1/admin/clients/${client.body.id}/keys`, { token: ADMIN_KEY, body: { scopes: ['ingest', 'read'] } });
    const name = (displayName: string) => call(url, 'PATCH', '/api/v1/me', { token: ingestKey.body.key, headers: { 'x-recordare-user': 'new-user' }, body: { displayName } });
    expect((await name('Andrea')).status).toBe(204);
    expect((await call(url, 'GET', '/api/v1/me', { token: key.body.key, headers: { 'x-recordare-user': 'new-user' } })).body.displayName).toBe('Andrea');
    expect((await name('Second name')).status).toBe(403);
    expect((await call(url, 'PATCH', '/api/v1/me', { token: key.body.key, headers: { 'x-recordare-user': 'new-user' }, body: { displayName: 'x' } })).status).toBe(403); // scope

    // Concurrent first contact resolves to one owner, no 500.
    const burst = await Promise.all(Array.from({ length: 5 }, () =>
      call(url, 'GET', '/api/v1/me', { token: key.body.key, headers: { 'x-recordare-user': 'burst-user' } })));
    expect(burst.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
    expect(new Set(burst.map((r) => r.body.ownerId)).size).toBe(1);
  });

  it('rejects tokens for unknown clients and cuts off tokens of disabled clients', async () => {
    const owner = await call(url, 'POST', '/api/v1/admin/owners', { token: ADMIN_KEY, body: { displayName: 'Chiara' } });
    const missing = await call(url, 'POST', `/api/v1/admin/owners/${owner.body.personId}/tokens`, {
      token: ADMIN_KEY, body: { clientId: '00000000-0000-4000-8000-000000000000', scopes: ['read'] },
    });
    expect(missing.status).toBe(404);

    const client = await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'Desk', kind: 'mcp_client' } });
    const tok = await call(url, 'POST', `/api/v1/admin/owners/${owner.body.personId}/tokens`, {
      token: ADMIN_KEY, body: { clientId: client.body.id, scopes: ['read'] },
    });
    expect((await call(url, 'GET', '/api/v1/me', { token: tok.body.token })).status).toBe(200);
    const { DataSource } = await import('typeorm');
    const ds = app.get(DataSource);
    await ds.query('UPDATE clients SET disabled_at = now() WHERE id = $1', [client.body.id]);
    (app.get((await import('../../src/auth/auth.service.js')).AuthService)).forget();
    expect((await call(url, 'GET', '/api/v1/me', { token: tok.body.token })).status).toBe(401);
  });
});
