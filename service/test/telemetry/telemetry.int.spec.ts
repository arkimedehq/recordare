// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { type INestApplication } from '@nestjs/common';
import { type Server } from 'node:http';
import { EXTRACTION_RUNNER, type ExtractionRunner } from '../../src/queue/queue.port';
import { ADMIN_KEY, call, resetSchema, startApp, startFakeEmbeddings, startFakeLlm, testEnv } from '../helpers/app';

/** Reads Server-Sent Events from the telemetry stream until `count` events arrived (or the time runs out). */
async function collect(url: string, token: string, count: number, during: () => Promise<void>): Promise<Array<Record<string, unknown>>> {
  const ctrl = new AbortController();
  const res = await fetch(`${url}/api/v1/admin/telemetry/stream`, { headers: { authorization: `Bearer ${token}` }, signal: ctrl.signal });
  const events: Array<Record<string, unknown>> = [];
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  const reading = (async () => {
    for (;;) {
      const { value, done } = await reader.read().catch(() => ({ value: undefined, done: true }));
      if (done) return;
      buf += decoder.decode(value, { stream: true });
      let i: number;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, i); buf = buf.slice(i + 2);
        const data = block.split('\n').find((l) => l.startsWith('data: '));
        if (data) events.push(JSON.parse(data.slice(6)));
        if (events.length >= count) { ctrl.abort(); return; }
      }
    }
  })();
  await during();
  await Promise.race([reading, new Promise((r) => setTimeout(r, 2000))]);
  ctrl.abort();
  return events;
}

describe('live telemetry (M5b)', () => {
  let app: INestApplication;
  let url: string;
  let llm: Awaited<ReturnType<typeof startFakeLlm>>;
  let emb: Server;

  beforeAll(async () => {
    llm = await startFakeLlm();
    const fake = await startFakeEmbeddings();
    emb = fake.server;
    testEnv({ EMBEDDING_BASE_URL: fake.url, LLM_BASE_URL: llm.url, IDLE_DELAY_SECONDS: '3600' });
    await resetSchema();
    ({ app, url } = await startApp());
  });
  afterAll(async () => { await app?.close(); llm?.server.close(); emb?.close(); });

  it('streams the real steps of an ingest and an extraction, metadata only, to the admin', async () => {
    const client = await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'A', kind: 'platform' } });
    const key = (await call(url, 'POST', `/api/v1/admin/clients/${client.body.id}/keys`, { token: ADMIN_KEY, body: { scopes: ['ingest'] } })).body.key;
    const ownerId = (await call(url, 'POST', '/api/v1/admin/owners', { token: ADMIN_KEY, body: { displayName: 'Luca', episodicEnabled: true } })).body.personId;
    await call(url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY, body: { kind: 'client_user', personId: ownerId, clientId: client.body.id, externalId: 'luca' } });

    const events = await collect(url, ADMIN_KEY, 6, async () => {
      const res = await call(url, 'POST', '/api/v1/ingest/messages', {
        token: key, headers: { 'x-recordare-user': 'luca' },
        body: { conversation: { externalId: 't1' }, messages: [{ externalId: 'm1', role: 'user', content: 'Ieri cena da Marco, bellissima.', sentAt: '2026-05-10T21:00:00+02:00' }] },
      });
      llm.queue.push({ episodes: [{ content: 'Il 9 maggio 2026 Luca ha cenato da Marco.', kind: 'event', occurred_at: '2026-05-09', date_precision: 'day', origin: 'owner_lived', people: ['Marco'], importance: 5, feelings: [], keywords: [], tags: [], evidence: [1] }] });
      await app.get<ExtractionRunner>(EXTRACTION_RUNNER).runForConversation(res.body.conversationId as string);
    });
    const types = events.map((e) => e['type']);
    expect(types).toEqual(expect.arrayContaining(['message.ingested', 'extraction.started', 'llm.call', 'memory.written', 'extraction.finished']));
    expect(events.find((e) => e['type'] === 'memory.written')).toMatchObject({ ownerId, table: 'episodes', kind: 'event', authorRole: 'owner' });
    expect(JSON.stringify(events)).not.toContain('Marco'); // metadata only, never content

    const denied = await fetch(`${url}/api/v1/admin/telemetry/stream`, { headers: { authorization: `Bearer ${key}` } });
    expect(denied.status).toBe(403); // a client key is not the admin
  });
});
