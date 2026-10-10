// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { type INestApplication } from '@nestjs/common';
import { ADMIN_KEY, call, resetSchema, startApp, testEnv } from '../helpers/app';

describe('admin console (WORK_PLAN 6.9)', () => {
  let app: INestApplication;
  let url: string;

  beforeAll(async () => {
    testEnv();
    await resetSchema();
    ({ app, url } = await startApp());
  });
  afterAll(async () => { await app?.close(); });

  it('serves the page and its assets without data, with a strict content security policy', async () => {
    const page = await fetch(`${url}/admin`);
    expect(page.status).toBe(200);
    expect(page.headers.get('content-type')).toContain('text/html');
    expect(page.headers.get('content-security-policy')).toContain("script-src 'self'");
    expect(page.headers.get('cache-control')).toBe('no-store');
    expect(await page.text()).toContain('/admin/app.js');
    expect((await fetch(`${url}/admin/app.js`)).headers.get('content-type')).toContain('javascript');
    expect((await fetch(`${url}/admin/console.css`)).status).toBe(200);
    expect((await fetch(`${url}/admin/main.js`)).status).toBe(404);
    expect((await fetch(`${url}/admin/..%2Fpackage.json`)).status).toBe(404);
  });

  it('lists people and clients for the admin only, and manages clients and identities', async () => {
    expect((await call(url, 'GET', '/api/v1/admin/persons')).status).toBe(401);
    const client = (await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'Arkimede', kind: 'platform' } })).body;
    const key = (await call(url, 'POST', `/api/v1/admin/clients/${client.id}/keys`, { token: ADMIN_KEY, body: { scopes: ['read'] } })).body.key;
    expect((await call(url, 'GET', '/api/v1/admin/persons', { token: key })).status).toBe(403);
    const memoryId = (await call(url, 'POST', '/api/v1/admin/memories', { token: ADMIN_KEY, body: { displayName: 'Casa', mode: 'entity' } })).body.personId;
    const identity = (await call(url, 'POST', '/api/v1/admin/identities',
      { token: ADMIN_KEY, body: { kind: 'account', personId: memoryId, clientId: client.id, externalId: 'voice' } })).body;

    const persons = (await call(url, 'GET', '/api/v1/admin/persons', { token: ADMIN_KEY })).body;
    expect(persons).toEqual([expect.objectContaining({
      id: memoryId, name: 'Casa', mode: 'entity', gender: 'masculine', contacts: 0, messages: 0, episodes: 0, facts: 0, notes: 0,
      identities: [expect.objectContaining({ id: identity.id, kind: 'account', client: 'Arkimede', externalId: 'voice' })], tokens: [],
    })]);
    const clients = (await call(url, 'GET', '/api/v1/admin/clients', { token: ADMIN_KEY })).body;
    expect(clients).toEqual([expect.objectContaining({ id: client.id, name: 'Arkimede', autoProvision: false, disabledAt: null,
      keys: [expect.objectContaining({ scopes: ['read'] })] })]);
    expect(JSON.stringify(clients)).not.toContain(key); // prefixes only, never the secret

    expect((await call(url, 'GET', '/api/v1/me', { token: key, headers: { 'x-recordare-user': 'voice' } })).status).toBe(200);
    expect((await call(url, 'PATCH', `/api/v1/admin/clients/${client.id}`, { token: ADMIN_KEY, body: { disabled: true } })).status).toBe(204);
    expect((await call(url, 'GET', '/api/v1/me', { token: key, headers: { 'x-recordare-user': 'voice' } })).status).toBe(401);
    expect((await call(url, 'PATCH', `/api/v1/admin/clients/${client.id}`, { token: ADMIN_KEY, body: { disabled: false } })).status).toBe(204);
    expect((await call(url, 'GET', '/api/v1/me', { token: key, headers: { 'x-recordare-user': 'voice' } })).status).toBe(200);

    expect((await call(url, 'DELETE', `/api/v1/admin/identities/${identity.id}`, { token: ADMIN_KEY })).status).toBe(204);
    expect((await call(url, 'GET', '/api/v1/me', { token: key, headers: { 'x-recordare-user': 'voice' } })).status).toBe(404);
    expect((await call(url, 'DELETE', `/api/v1/admin/identities/${identity.id}`, { token: ADMIN_KEY })).status).toBe(404);
  });
});
