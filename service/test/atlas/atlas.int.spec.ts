// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { type INestApplication } from '@nestjs/common';
import { type Server } from 'node:http';
import { DataSource } from 'typeorm';
import { layout } from '../../src/atlas/atlas.service';
import { ADMIN_KEY, call, fakeVector, resetSchema, startApp, startFakeEmbeddings, testEnv } from '../helpers/app';

describe('atlas snapshot (M5b.2)', () => {
  it('places items by meaning: two clusters land apart', () => {
    const a = [1, 0, 0, 0], b = [0, 0, 1, 0];
    const jitter = (v: number[], s: number) => v.map((x, k) => x + s * Math.sin(k + s * 10));
    const xyz = layout([jitter(a, 0.01), jitter(a, 0.02), jitter(b, 0.01), jitter(b, 0.03), null]);
    expect(Math.sign(xyz[0]![0])).toBe(Math.sign(xyz[1]![0]));
    expect(Math.sign(xyz[2]![0])).toBe(Math.sign(xyz[3]![0]));
    expect(Math.sign(xyz[0]![0])).not.toBe(Math.sign(xyz[2]![0]));
    expect(xyz[4]).toEqual([0, 0, 0]);
  });

  describe('endpoint', () => {
    let app: INestApplication;
    let url: string;
    let emb: Server;
    beforeAll(async () => {
      const fake = await startFakeEmbeddings();
      emb = fake.server;
      testEnv({ EMBEDDING_BASE_URL: fake.url });
      await resetSchema();
      ({ app, url } = await startApp());
    });
    afterAll(async () => { await app?.close(); emb?.close(); });

    it('returns the network of one owner: real relations, metadata only, admin only', async () => {
      const ownerId = (await call(url, 'POST', '/api/v1/admin/owners', { token: ADMIN_KEY, body: { displayName: 'Luca', episodicEnabled: true } })).body.personId;
      const db = app.get(DataSource);
      const ins = async (content: string, corrects: string | null = null) => {
        const [r] = await db.query(
          `INSERT INTO episodes (owner_id, kind, content, origin, author_role, audience, occurred_at, date_precision, embedding, corrects)
           VALUES ($1, 'event', $2, 'owner_lived', 'owner', $3, '2026-03-14T20:00:00Z', 'day', $4::vector, $5) RETURNING id`,
          [ownerId, content, [ownerId], `[${fakeVector(content).join(',')}]`, corrects]);
        return r.id as string;
      };
      const a = await ins('Cena da Marco segretissima');
      const b = await ins('Cena da Marco, correzione', a);
      await ins('Partita di calcetto');
      const res = await call(url, 'GET', `/api/v1/admin/owners/${ownerId}/atlas`, { token: ADMIN_KEY });
      expect(res.status).toBe(200);
      expect(res.body.owner).toEqual({ id: ownerId, name: 'Luca' });
      expect(res.body.episodes).toHaveLength(3);
      expect(res.body.edges).toEqual(expect.arrayContaining([{ a: b, b: a, kind: 'corrects' }, expect.objectContaining({ kind: 'similar' })]));
      expect(JSON.stringify(res.body)).not.toContain('segretissima');
      const client = await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'A', kind: 'platform' } });
      const key = (await call(url, 'POST', `/api/v1/admin/clients/${client.body.id}/keys`, { token: ADMIN_KEY, body: { scopes: ['read'] } })).body.key;
      expect((await call(url, 'GET', `/api/v1/admin/owners/${ownerId}/atlas`, { token: key })).status).toBe(403);
    });
  });
});
