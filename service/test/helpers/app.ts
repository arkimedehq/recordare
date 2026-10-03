// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Integration-test app: fresh schema in the `recordare_test` database (docker compose `db`),
 * migrations applied, Nest app listening on a random port.
 */
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../../src/db/data-source-options';

export const ADMIN_KEY = 'test-admin-key-0123456789abcdef0123456789abcdef';

export function testEnv(): void {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: process.env['TEST_DATABASE_URL'] ?? 'postgres://recordare:recordare@localhost:5433/recordare_test',
    REDIS_URL: process.env['TEST_REDIS_URL'] ?? 'redis://localhost:6380',
    ADMIN_API_KEY: ADMIN_KEY,
    LLM_MODEL: 'test-model',
    LLM_PROFILE: 'generic',
    LLM_BASE_URL: 'http://127.0.0.1:9/v1',
    EMBEDDING_BASE_URL: 'http://127.0.0.1:9/v1',
    EMBEDDING_MODEL: 'test-embedding',
    EMBEDDING_DIM: '8',
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
  const app = moduleRef.createNestApplication({ logger: false });
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
