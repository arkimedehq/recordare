// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { type INestApplication } from '@nestjs/common';
import { call, resetSchema, startApp, testEnv } from '../helpers/app';

describe('OpenAPI document generated from the routes (API.md)', () => {
  let app: INestApplication;
  let url: string;
  type Operation = { operationId: string; security?: unknown[]; parameters: Array<Record<string, unknown>>; responses: Record<string, { content?: object }>;
    requestBody: { content: Record<string, { schema: { required?: string[] } }> }; 'x-recordare-scopes': string[] };
  let doc: { openapi: string; info: { version: string }; paths: Record<string, Record<string, Operation>> };
  const op = (path: string, method: string) => doc.paths[path]![method]!;

  beforeAll(async () => {
    testEnv({});
    await resetSchema();
    ({ app, url } = await startApp());
    const res = await call(url, 'GET', '/api/v1/openapi.json');
    expect(res.status).toBe(200);
    doc = res.body;
  });
  afterAll(async () => { await app?.close(); });

  it('is OpenAPI 3.1 with the service version, public, REST routes only (no console pages, no /mcp)', async () => {
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(Object.keys(doc.paths).every((p) => p.startsWith('/api/v1/'))).toBe(true);
    expect(op('/api/v1/health', 'get').security).toEqual([]);
    expect(op('/api/v1/openapi.json', 'get').security).toEqual([]);
  });

  it('request bodies and query parameters come from the zod schemas that validate them', () => {
    const ingest = op('/api/v1/ingest/messages', 'post');
    expect(ingest['x-recordare-scopes']).toEqual(['ingest']);
    expect(ingest.requestBody.content['application/json']!.schema).toMatchObject({ type: 'object', required: expect.arrayContaining(['messages']) });
    expect(op('/api/v1/forget', 'post').requestBody.content['application/json']!.schema.required).toEqual(['from', 'to']);
    const episodes = op('/api/v1/episodes', 'get').parameters.map((p) => `${String(p['in'])}:${String(p['name'])}`);
    expect(episodes).toEqual(expect.arrayContaining(['query:from', 'query:to', 'query:q', 'query:limit', 'header:X-Recordare-User']));
  });

  it('path parameters, scopes, status codes and errors', () => {
    const fact = op('/api/v1/facts/{id}', 'delete');
    expect(fact.parameters).toContainEqual({ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } });
    expect(fact['x-recordare-scopes']).toEqual(['write']);
    expect(Object.keys(fact.responses)).toEqual(['204', '4XX']);
    expect(op('/api/v1/admin/memories', 'post')['x-recordare-scopes']).toEqual(['admin']);
    expect(op('/api/v1/exports', 'post').responses['202']).toBeDefined();
    expect(op('/api/v1/admin/telemetry/stream', 'get').responses['200']!.content).toHaveProperty('text/event-stream');
  });

  it('every operation has a unique id and every path parameter is declared', () => {
    const ids: string[] = [];
    for (const [path, methods] of Object.entries(doc.paths)) {
      for (const o of Object.values(methods)) {
        ids.push(o.operationId);
        for (const name of path.match(/\{(\w+)\}/g)?.map((m) => m.slice(1, -1)) ?? []) {
          expect(o.parameters).toContainEqual(expect.objectContaining({ name, in: 'path', required: true }));
        }
      }
    }
    expect(new Set(ids).size).toBe(ids.length);
    expect(JSON.stringify(doc)).not.toContain('"$schema"');
  });
});
