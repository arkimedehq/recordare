// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { Memory } from '../src/memory.js';
import { createProxy } from '../src/proxy.js';
import { config, silent } from './helpers.js';

interface Seen { url: string; headers: Record<string, string>; body: Record<string, unknown> }

const SSE = ['Hel', 'lo'].map((t) => `data: {"choices":[{"index":0,"delta":{"content":"${t}"}}]}\n\n`).join('')
  + 'data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n';

/** A fake provider: records what it receives, answers streamed or whole. */
function upstream(seen: Seen[]): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    seen.push({ url: String(input), headers: init?.headers as Record<string, string>, body });
    if (String(input).endsWith('/models')) return Response.json({ data: [{ id: 'm' }] });
    if (body.stream) {
      const stream = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(SSE)); c.close(); } });
      return new Response(stream, { headers: { 'content-type': 'text/event-stream' } });
    }
    return Response.json({ choices: [{ index: 0, message: { role: 'assistant', content: 'Whole answer' }, finish_reason: 'stop' }] });
  }) as typeof fetch;
}

interface RCall { path: string; headers: Headers; body: Record<string, unknown> }

/** A fake Recordare; `down` = unreachable. */
function recordare(calls: RCall[], opts: { down?: boolean; block?: string | null } = {}) {
  return async (input: string | URL, init?: RequestInit): Promise<Response> => {
    if (opts.down) throw new TypeError('fetch failed');
    const path = new URL(String(input)).pathname;
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    calls.push({ path, headers: new Headers(init?.headers), body });
    if (path.endsWith('/end')) return new Response(null, { status: 202 });
    if (path.endsWith('/context')) return Response.json({ block: opts.block === undefined ? '<memory-context>Il gatto si chiama Biscotto</memory-context>' : opts.block, items: 1 });
    return Response.json({ conversationId: 'c1', accepted: 1, duplicates: 0, conflicts: [] });
  };
}

const servers: Server[] = [];
afterEach(() => { for (const s of servers.splice(0)) s.close(); });

async function start(env: Record<string, string>, seen: Seen[], calls: RCall[], opts: { down?: boolean; block?: string | null } = {}) {
  const cfg = config({ RECORDARE_URL: 'http://recordare:8080', RECORDARE_API_KEY: 'rk_test', UPSTREAM_API_KEY: 'sk-up', ...env });
  const memory = new Memory(cfg, silent, recordare(calls, opts));
  const server = createProxy(cfg, { log: silent, memory, fetch: upstream(seen) });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  servers.push(server);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { base, memory };
}

const chat = (base: string, body: unknown, headers: Record<string, string> = {}) => fetch(`${base}/v1/chat/completions`, {
  method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer from-platform', ...headers }, body: JSON.stringify(body),
});

const until = async (cond: () => boolean) => { for (let i = 0; i < 100 && !cond(); i++) await new Promise((r) => setTimeout(r, 10)); };

const anythingllm = (user: string) => ({
  model: 'deepseek-flash', stream: true,
  messages: [{ role: 'system', content: 'You are kind. [[recordare user=7 ws=3]]' }, { role: 'user', content: user }],
});

describe('proxy', () => {
  it('captures, injects the memory block, strips the marker, keeps streaming', async () => {
    const seen: Seen[] = []; const calls: RCall[] = [];
    const { base } = await start({}, seen, calls);
    const res = await chat(base, anythingllm('Come si chiama il mio gatto?'));
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    expect(await res.text()).toBe(SSE); // bytes piped unchanged
    const sent = seen[0]!;
    expect(sent.url).toBe('http://upstream/v1/chat/completions');
    expect(sent.headers.authorization).toBe('Bearer sk-up');
    const system = (sent.body.messages as Array<{ content: string }>)[0]!.content;
    expect(system).toBe('You are kind.\n\n<memory-context>Il gatto si chiama Biscotto</memory-context>');
    expect(JSON.stringify(sent.body)).not.toContain('[[recordare');

    await until(() => calls.length >= 2);
    expect(calls.map((c) => c.path)).toEqual(['/api/v1/context', '/api/v1/ingest/messages']); // message + context: one call
    expect(calls[0]!.headers.get('x-recordare-user')).toBe('anythingllm:7');
    const ingest = calls[0]!.body.ingest as { conversation: { externalId: string }; messages: Array<{ externalId: string; role: string }> };
    expect(ingest.conversation.externalId).toMatch(/^anythingllm:3:7:\d{4}-\d{2}-\d{2}$/);
    expect(ingest.messages[0]!.role).toBe('user');
    expect(calls[0]!.body.query).toBe('Come si chiama il mio gatto?');
    const answer = (calls[1]!.body.messages as Array<Record<string, unknown>>)[0]!;
    expect(answer).toMatchObject({ role: 'assistant', content: 'Hello', upsert: true });
    expect(answer.externalId).toBe(`${ingest.messages[0]!.externalId}:a`);
  });

  it('a repeated call of the same turn (regeneration, agent loop) sends the message and asks the context once', async () => {
    const seen: Seen[] = []; const calls: RCall[] = [];
    const { base } = await start({}, seen, calls);
    await (await chat(base, { ...anythingllm('ciao'), stream: false })).text();
    const loop = { ...anythingllm('ciao'), stream: false };
    loop.messages = [...loop.messages, { role: 'assistant', content: '', tool_calls: [{ id: 't' }] } as never, { role: 'tool', content: 'r', tool_call_id: 't' } as never];
    await (await chat(base, loop)).text();
    await until(() => calls.filter((c) => c.path.endsWith('/ingest/messages')).length >= 2);
    expect(calls.filter((c) => c.path.endsWith('/context'))).toHaveLength(1);
    expect(calls.filter((c) => (c.body.messages as Array<{ role: string }> | undefined)?.[0]?.role === 'user')).toHaveLength(0);
    // both upstream calls got the block
    for (const s of seen) expect(JSON.stringify(s.body)).toContain('Biscotto');
  });

  it('skips background calls (Open WebUI tasks) from capture and injection', async () => {
    const seen: Seen[] = []; const calls: RCall[] = [];
    const { base } = await start({}, seen, calls);
    await (await chat(base, { model: 'm', messages: [{ role: 'user', content: '### Task:\nGenerate a concise title' }] },
      { 'x-openwebui-user-id': 'u1', 'x-openwebui-chat-id': 'c1' })).text();
    await new Promise((r) => setTimeout(r, 50));
    expect(calls).toHaveLength(0);
    expect(seen[0]!.body.messages).toEqual([{ role: 'user', content: '### Task:\nGenerate a concise title' }]);
    expect(seen[0]!.headers['x-openwebui-user-id']).toBeUndefined(); // identity headers never go upstream
  });

  it('no identity: pure pass-through, nothing sent to Recordare', async () => {
    const seen: Seen[] = []; const calls: RCall[] = [];
    const { base } = await start({}, seen, calls);
    const body = { model: 'm', messages: [{ role: 'system', content: 'plain' }, { role: 'user', content: 'hi' }] };
    expect((await (await chat(base, body)).json()).choices[0].message.content).toBe('Whole answer');
    await new Promise((r) => setTimeout(r, 50));
    expect(calls).toHaveLength(0);
    expect(seen[0]!.body).toEqual(body);
  });

  it('Recordare down: the chat still works (no block), the messages wait in the retry queue', async () => {
    const seen: Seen[] = []; const calls: RCall[] = [];
    const { base, memory } = await start({}, seen, calls, { down: true });
    const res = await chat(base, anythingllm('ciao'));
    expect(await res.text()).toBe(SSE);
    expect(JSON.stringify(seen[0]!.body)).not.toContain('memory-context');
    expect(JSON.stringify(seen[0]!.body)).not.toContain('[[recordare');
    await until(() => memory.queued() >= 2);
    expect(memory.queued()).toBe(2);
    const health = await (await fetch(`${base}/health`)).json();
    expect(health).toMatchObject({ status: 'ok', queued: 2 });
  });

  it('passes other /v1 calls through and the caller\'s key when no upstream key is set', async () => {
    const seen: Seen[] = []; const calls: RCall[] = [];
    const cfgEnv = { UPSTREAM_API_KEY: '' };
    const { base } = await start(cfgEnv, seen, calls);
    const res = await fetch(`${base}/v1/models`, { headers: { authorization: 'Bearer caller' } });
    expect((await res.json()).data[0].id).toBe('m');
    expect(seen[0]!.url).toBe('http://upstream/v1/models');
    expect(seen[0]!.headers.authorization).toBe('Bearer caller');
  });

  it('PROXY_API_KEY protects the proxy', async () => {
    const seen: Seen[] = []; const calls: RCall[] = [];
    const { base } = await start({ PROXY_API_KEY: 'pk' }, seen, calls);
    expect((await fetch(`${base}/v1/models`)).status).toBe(401);
    expect((await fetch(`${base}/v1/models`, { headers: { authorization: 'Bearer pk' } })).status).toBe(200);
    expect(seen[0]!.headers.authorization).toBe('Bearer sk-up');
  });

  it('ends an idle conversation', async () => {
    const seen: Seen[] = []; const calls: RCall[] = [];
    const { base } = await start({ END_IDLE_SECONDS: '0.05' }, seen, calls);
    await (await chat(base, anythingllm('ciao'))).text();
    await until(() => calls.some((c) => c.path.endsWith('/end')));
    const end = calls.find((c) => c.path.endsWith('/end'))!;
    const conversation = (calls[0]!.body.ingest as { conversation: { externalId: string } }).conversation.externalId;
    expect(end.path).toBe(`/api/v1/ingest/conversations/${encodeURIComponent(conversation)}/end`);
    expect(end.headers.get('x-recordare-user')).toBe('anythingllm:7');
    expect(calls.filter((c) => c.path.endsWith('/end'))).toHaveLength(1);
  });

  it('with recall off, stores the message with a plain ingest', async () => {
    const seen: Seen[] = []; const calls: RCall[] = [];
    const { base } = await start({ RECALL: 'false' }, seen, calls);
    await (await chat(base, { ...anythingllm('ciao'), stream: false })).text();
    await until(() => calls.length >= 2);
    expect(calls.map((c) => c.path)).toEqual(['/api/v1/ingest/messages', '/api/v1/ingest/messages']);
    expect(JSON.stringify(seen[0]!.body)).not.toContain('memory-context');
  });
});
