// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { type AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  afterFailure, backoffMs, clipUtf8, MemoryNotEmptyError, parseRetryAfter, PersonDirectory, RecordareClient,
  RecordareHttpError, RecordareUnavailableError,
} from '../src/index.js';

interface Seen { method: string; path: string; headers: IncomingMessage['headers']; body: any }
const seen: Seen[] = [];
let reply: (s: Seen) => { status: number; body?: unknown; headers?: Record<string, string> } = () => ({ status: 404 });
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      const s: Seen = { method: req.method!, path: req.url!, headers: req.headers, body: raw ? JSON.parse(raw) : undefined };
      seen.push(s);
      const r = reply(s);
      res.writeHead(r.status, { 'content-type': 'application/json', ...r.headers });
      res.end(r.body === undefined ? '' : JSON.stringify(r.body));
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));
beforeEach(() => { seen.length = 0; reply = () => ({ status: 404 }); });

const client = (extra: Record<string, string> = {}) => new RecordareClient({ baseUrl: `${baseUrl}/`, apiKey: 'rk_test', headers: () => extra });

describe('RecordareClient', () => {
  it('sends the credential, the user and the host\'s trace context on every request', async () => {
    reply = () => ({ status: 200, body: { memoryId: 'o1', displayName: 'Andrea', mode: 'personal', gender: 'masculine', via: 'client', scopes: ['read'] } });
    const me = await client({ traceparent: '00-abc-def-01' }).me('u1');
    expect(me.memoryId).toBe('o1');
    expect(seen[0]).toMatchObject({ method: 'GET', path: '/api/v1/me' });
    expect(seen[0]?.headers).toMatchObject({ authorization: 'Bearer rk_test', 'x-recordare-user': 'u1', traceparent: '00-abc-def-01' });
  });

  it('maps a refused mode change to MemoryNotEmptyError and problem details to RecordareHttpError', async () => {
    reply = () => ({ status: 409, body: { type: 'about:blank', title: 'Conflict', status: 409, code: 'memory_not_empty' } });
    await expect(client().updateMe('u1', { mode: 'entity' })).rejects.toBeInstanceOf(MemoryNotEmptyError);
    reply = () => ({ status: 503, body: { title: 'Service Unavailable', code: 'unavailable' }, headers: { 'retry-after': '30' } });
    const err = await client().updateMe('u1', { displayName: 'A' }).catch((e) => e);
    expect(err).toBeInstanceOf(RecordareHttpError);
    expect(err).toMatchObject({ status: 503, problem: { code: 'unavailable' }, retryAfterMs: 30_000 });
    expect(err.message).not.toContain('"A"'); // no request content in messages (they end up in logs)
  });

  it('splits a large ingest into requests of 500 messages, the end hint only on the last one', async () => {
    reply = (s) => ({ status: 200, body: { conversationId: 'c1', accepted: s.body.messages.length, duplicates: 0, conflicts: [] } });
    const messages = Array.from({ length: 1200 }, (_, i) => ({ externalId: `m${i}`, role: 'user' as const, content: 'x', sentAt: '2026-10-07T10:00:00+02:00' }));
    const res = await client().ingest('u1', { conversation: { externalId: 'chat-1' }, messages, hints: { conversationEnded: true } });
    expect(seen.map((s) => s.body.messages.length)).toEqual([500, 500, 200]);
    expect(seen.map((s) => s.body.hints)).toEqual([undefined, undefined, { conversationEnded: true }]);
    expect(res).toEqual({ conversationId: 'c1', accepted: 1200, duplicates: 0, conflicts: [] });
  });

  it('asks for the memory context of a message in its conversation', async () => {
    reply = () => ({ status: 200, body: { block: '<memory-context>…</memory-context>', items: 1 } });
    expect(await client().context('u1', 'chat-1', 'Che macchina ho?')).toEqual({ block: '<memory-context>…</memory-context>', items: 1 });
    expect(seen[0]).toMatchObject({ method: 'POST', path: '/api/v1/context', body: { query: 'Che macchina ho?' } });
    expect(seen[0]?.headers['x-recordare-conversation']).toBe('chat-1');
  });

  it('reads the diary with query strings and acts on its items', async () => {
    reply = () => ({ status: 200, body: { items: [], nextCursor: null } });
    await client().episodes('u1', { from: '2026-10-01', planStatus: 'unresolved', limit: 20 });
    expect(seen[0]?.path).toBe('/api/v1/episodes?from=2026-10-01&planStatus=unresolved&limit=20');
    reply = () => ({ status: 204 });
    await client().decide('u1', 'notes', 'n 1', 'confirm');
    await client().pinNote('u1', 'n1', true);
    expect(seen.slice(1).map((s) => `${s.method} ${s.path}`)).toEqual(['POST /api/v1/notes/n%201/confirm', 'PATCH /api/v1/notes/n1']);
  });

  it('treats deleting what Recordare never had as done, encodes ids, and reports outages as unavailable', async () => {
    reply = () => ({ status: 404, body: { code: 'not_found' } });
    await client().deleteMessage('u1', 'chat/1', 'm 1');
    expect(seen[0]?.path).toBe('/api/v1/ingest/conversations/chat%2F1/messages/m%201');
    reply = () => ({ status: 500, body: { code: 'internal_error' } });
    await expect(client().deleteConversation('u1', 'chat-1')).rejects.toBeInstanceOf(RecordareHttpError);
    const down = new RecordareClient({ baseUrl: 'http://127.0.0.1:1', apiKey: 'k', timeoutMs: 2_000 });
    await expect(down.me('u1')).rejects.toBeInstanceOf(RecordareUnavailableError);
  });
});

describe('delivery policy', () => {
  it('parks what Recordare will never accept and after the last attempt; otherwise retries with jitter and Retry-After', () => {
    const rejected = new RecordareHttpError(422, { code: 'invalid' });
    expect(afterFailure(rejected, 1)).toEqual({ action: 'park', reason: 'rejected' });
    expect(afterFailure(new Error('down'), 12)).toEqual({ action: 'park', reason: 'max_attempts' });
    expect(afterFailure(new Error('down'), 3, undefined, () => 1)).toEqual({ action: 'retry', delayMs: backoffMs(3) });
    expect(afterFailure(new Error('down'), 3, undefined, () => 0)).toEqual({ action: 'retry', delayMs: 5_000 }); // never below base
    const busy = new RecordareHttpError(503, {}, 120_000);
    expect(afterFailure(busy, 1, undefined, () => 0.5)).toEqual({ action: 'retry', delayMs: 120_000 });
    expect(backoffMs(30)).toBe(60 * 60 * 1_000);
  });

  it('parses Retry-After as seconds or an HTTP date', () => {
    expect(parseRetryAfter('7')).toBe(7_000);
    expect(parseRetryAfter(new Date(10_000).toUTCString(), 4_000)).toBe(6_000);
    expect(parseRetryAfter('soon')).toBeUndefined();
  });
});

describe('clipUtf8', () => {
  it('never splits a character', () => {
    expect(clipUtf8('aèb', 2, '')).toBe('a');
    expect(clipUtf8('aèb', 3, '')).toBe('aè');
    expect(clipUtf8('short')).toBe('short');
    const long = clipUtf8('è'.repeat(40_000));
    expect(Buffer.byteLength(long, 'utf8')).toBeLessThanOrEqual(64 * 1024);
    expect(long.endsWith(' …[truncated]')).toBe(true);
  });
});

describe('PersonDirectory', () => {
  it('keeps the name in sync with the profile, caches the memory, mode and Atlas, and survives an outage', async () => {
    let shown = 'Andrea';
    reply = (s) => (s.method === 'GET'
      ? { status: 200, body: { memoryId: 'o1', displayName: shown, mode: 'entity', gender: 'masculine', atlasUrl: 'http://atlas', via: 'client', scopes: [] } }
      : { status: 204 });
    let profile = 'Andrea';
    const resolved: string[] = [];
    const people = new PersonDirectory(client(), {
      user: async (u) => (u === 'off' ? { enabled: false } : { enabled: true, name: profile }),
      onResolved: (u, p) => { resolved.push(`${u}:${p.memoryId}`); },
    });
    expect(people.peek('u1')).toBeUndefined(); // never waits; looks up in the background
    expect(await people.refresh('u1')).toEqual({ memoryId: 'o1', mode: 'entity', atlasUrl: 'http://atlas' });
    expect(people.peek('u1')).toEqual({ memoryId: 'o1', mode: 'entity', atlasUrl: 'http://atlas' });
    expect(seen.filter((s) => s.method === 'PATCH')).toHaveLength(0); // same name: no rename

    profile = 'Andrea G.';
    await people.refresh('u1');
    expect(seen.filter((s) => s.method === 'PATCH').map((s) => s.body)).toEqual([{ displayName: 'Andrea G.' }]);
    shown = 'Andrea G.';

    reply = () => ({ status: 503 });
    expect((await people.refresh('u1')).memoryId).toBe('o1');
    expect(people.peek('u1')?.memoryId).toBe('o1'); // the last known person stays
    expect(resolved).toEqual(['u1:o1', 'u1:o1']);

    // Not opted in on the platform: Recordare is never contacted; a stored person stays known.
    seen.length = 0;
    people.seed('off', 'o-stored');
    expect(await people.refresh('off')).toEqual({ memoryId: 'o-stored', mode: null, atlasUrl: null });
    expect(people.peek('off')?.memoryId).toBe('o-stored');
    expect(seen).toHaveLength(0);
  });
});

describe('learned sources (WORK_PLAN 8.9)', () => {
  it('sends a big text in parts at paragraph boundaries, in order', async () => {
    seen.length = 0;
    reply = (s) => ({ status: 200, body: { sourceId: 's1', status: s.path.endsWith('/parts') && s.body.final ? 'indexing' : 'receiving', parts: 1, passages: 1, duplicate: false } });
    const text = ['Primo paragrafo.', 'Secondo paragrafo, più lungo.', 'Terzo.'].join('\n\n');
    const r = await client().learnSource('u1', { externalId: 'doc-1', title: 'Manuale', text }, 40);
    expect(r.status).toBe('indexing');
    expect(seen.map((s) => [s.method, s.path])).toEqual([
      ['POST', '/api/v1/ingest/sources'], ['POST', '/api/v1/ingest/sources/doc-1/parts'],
    ]);
    expect(seen[0]?.body).toMatchObject({ externalId: 'doc-1', title: 'Manuale', text: 'Primo paragrafo.', final: false });
    expect(seen[1]?.body).toEqual({ part: 1, text: 'Secondo paragrafo, più lungo.\n\nTerzo.', final: true });
    expect(seen.every((s) => Buffer.byteLength(s.body.text, 'utf8') <= 40)).toBe(true);
  });
});
