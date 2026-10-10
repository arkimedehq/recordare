// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Integration-test app: fresh schema in the `recordare_test` database (docker compose `db`),
 * migrations applied, Nest app listening on a random port.
 */
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { configureHttp } from '../../src/http.js';
import { DataSource } from 'typeorm';
import { createServer, type Server } from 'node:http';
import { createHash } from 'node:crypto';
import { dataSourceOptions } from '../../src/db/data-source-options';

export const ADMIN_KEY = 'test-admin-key-0123456789abcdef0123456789abcdef';

/** Deterministic vector for a text (dim 8): same text → same vector, used by the fake embedding server. */
export function fakeVector(text: string): number[] {
  const h = createHash('sha256').update(text.toLowerCase()).digest();
  const v = Array.from({ length: 8 }, (_, i) => (h[i] as number) / 255 - 0.5);
  const norm = Math.sqrt(v.reduce((a, x) => a + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

/** OpenAI-compatible /v1/embeddings stub on a random port. */
export async function startFakeEmbeddings(): Promise<{ url: string; server: Server; requests: string[][] }> {
  const requests: string[][] = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const input = JSON.parse(body).input as string[];
      requests.push(input);
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ object: 'list', model: 'fake', data: input.map((t, i) => ({ object: 'embedding', index: i, embedding: fakeVector(t) })), usage: { prompt_tokens: 0, total_tokens: 0 } }));
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as { port: number };
  return { url: `http://127.0.0.1:${port}/v1`, server, requests };
}

/** OpenAI-compatible /v1/chat/completions stub: answers with the queued JSON outputs in order. */
export async function startFakeLlm(): Promise<{ url: string; server: Server; queue: unknown[]; requests: Array<{ messages: Array<{ role: string; content: string }> }> }> {
  const queue: unknown[] = [];
  const requests: Array<{ messages: Array<{ role: string; content: string }> }> = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      requests.push(JSON.parse(body));
      const next = queue.shift() ?? {};
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({
        id: 'x', object: 'chat.completion', created: 0, model: 'fake',
        choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(next) } }],
        usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
      }));
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as { port: number };
  return { url: `http://127.0.0.1:${port}/v1`, server, queue, requests };
}

export function testEnv(overrides: Record<string, string> = {}): void {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: process.env['TEST_DATABASE_URL'] ?? 'postgres://recordare:recordare@localhost:5433/recordare_test',
    REDIS_URL: process.env['TEST_REDIS_URL'] ?? 'redis://localhost:6380',
    ADMIN_API_KEY: ADMIN_KEY,
    LLM_MODEL: 'test-model',
    CONSOLIDATION_SCHEDULE: 'false', // the nightly sweep would consume the fake LLM's queued answers
    LLM_PROFILE: 'generic',
    LLM_BASE_URL: 'http://127.0.0.1:9/v1',
    EMBEDDING_BASE_URL: 'http://127.0.0.1:9/v1',
    EMBEDDING_MODEL: 'test-embedding',
    EMBEDDING_DIM: '8',
    // own queue namespace: a running dev service on the same Redis never takes test jobs
    QUEUE_PREFIX: `test-${process.pid}`,
    ...overrides,
  });
}

export async function resetSchema(): Promise<void> {
  const ds = new DataSource(dataSourceOptions(process.env['DATABASE_URL'] as string));
  await ds.initialize();
  await ds.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  await ds.runMigrations();
  await ds.destroy();
}

export async function startApp(): Promise<{ app: INestApplication; url: string }> {
  const { AppModule } = await import('../../src/app.module.js');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false, logger: process.env['TEST_LOG'] ? ['error', 'warn'] : false });
  configureHttp(app);
  await app.listen(0);
  const address = app.getHttpServer().address() as { port: number };
  return { app, url: `http://127.0.0.1:${address.port}` };
}

export async function call(url: string, method: string, path: string, opts: { token?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  const res = await fetch(`${url}${path}`, {
    method,
    headers: {
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...opts.headers,
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}
