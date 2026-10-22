// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { type INestApplication } from '@nestjs/common';
import { type ConfigService } from '@nestjs/config';
import { type Queue } from 'bullmq';
import { type Server } from 'node:http';
import { DataSource } from 'typeorm';
import { type Env } from '../../src/config/env';
import { type ConsolidationService } from '../../src/engine/consolidation.service';
import { ConsolidationProcessor } from '../../src/queue/consolidation.processor';
import { type QueuePort } from '../../src/queue/queue.port';
import { ADMIN_KEY, call, resetSchema, startApp, startFakeEmbeddings, testEnv } from '../helpers/app';

describe('nightly sweep extracts the messages left behind before consolidating (WORK_PLAN 4.1)', () => {
  let app: INestApplication;
  let url: string;
  let emb: Server;
  let key: string;
  let db: DataSource;
  const NOW = new Date('2026-10-12T12:00:00Z');
  const as = (user: string) => ({ token: key, headers: { 'x-recordare-user': user } });

  async function chat(user: string, conversation: string, minutesAgo: number): Promise<{ memoryId: string; conversationId: string }> {
    await call(url, 'POST', '/api/v1/ingest/messages', { ...as(user), body: { conversation: { externalId: conversation }, messages: [
      { externalId: `${conversation}-1`, role: 'user', content: 'Oggi sono andata al mare', sentAt: '2026-10-12T08:00:00Z' }] } });
    const memoryId: string = (await call(url, 'GET', '/api/v1/me', as(user))).body.memoryId;
    const [c] = await db.query(`SELECT id FROM conversations WHERE memory_id = $1 AND external_id = $2`, [memoryId, conversation]);
    await db.query(`UPDATE messages SET received_at = $2::timestamptz - make_interval(mins => $3) WHERE conversation_id = $1`, [c.id, NOW, minutesAgo]);
    return { memoryId, conversationId: c.id };
  }

  beforeAll(async () => {
    const fake = await startFakeEmbeddings();
    emb = fake.server;
    testEnv({ EMBEDDING_BASE_URL: fake.url, IDLE_DELAY_SECONDS: '3600' });
    await resetSchema();
    ({ app, url } = await startApp());
    db = app.get(DataSource);
    const client = (await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'P', kind: 'platform', autoProvision: true } })).body;
    key = (await call(url, 'POST', `/api/v1/admin/clients/${client.id}/keys`, { token: ADMIN_KEY, body: { scopes: ['ingest', 'read'] } })).body.key;
  });
  afterAll(async () => { await app?.close(); emb?.close(); });

  it('extracts idle conversations with pending messages, then consolidates; recent and already-consolidated ones wait', async () => {
    const idle = await chat('u1', 'idle', 120);
    const recent = await chat('u1', 'recent', 5);
    const done = await chat('u2', 'done', 120);
    await db.query(`UPDATE memories SET consolidated_at = $2 WHERE person_id = $1`, [done.memoryId, NOW]);

    const log: string[] = [];
    const embedded: string[] = [];
    const settings: Partial<Env> = { CONSOLIDATION_SCHEDULE: true, CONSOLIDATION_HOUR: 3, IDLE_DELAY_SECONDS: 900 };
    const sweep = new ConsolidationProcessor(
      {} as Queue, db,
      { consolidateMemory: async (id: string) => { log.push(`consolidate ${id}`); return { days: 0, months: 0, llmCalls: 0 }; } } as unknown as ConsolidationService,
      { get: (k: keyof Env) => settings[k] } as unknown as ConfigService<Env, true>,
      { now: () => NOW },
      { runForConversation: async (id: string) => { log.push(`extract ${id}`); } },
      { enqueueMessageEmbeddings: async (ids: string[]) => { embedded.push(...ids); } } as unknown as QueuePort,
    );
    // A reply stored before replies were embedded (D30) has none: the sweep queues it again.
    await db.query(`UPDATE messages SET embedding = NULL WHERE conversation_id = $1`, [idle.conversationId]);
    const [missing] = await db.query(`SELECT id FROM messages WHERE conversation_id = $1`, [idle.conversationId]);
    await sweep.process({} as never);

    expect(embedded).toContain(missing.id);
    expect(log).toEqual([`extract ${idle.conversationId}`, `consolidate ${idle.memoryId}`]);
    expect(log.join()).not.toContain(recent.conversationId);
    expect(log.join()).not.toContain(done.conversationId);
  });
});
