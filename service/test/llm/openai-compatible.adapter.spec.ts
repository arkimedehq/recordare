// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { z } from 'zod';
import { OpenAiCompatibleAdapter, parseJsonObject } from '../../src/llm/openai-compatible.adapter';
import { resolveProfile } from '../../src/llm/provider-profiles';
import { LlmOutputError } from '../../src/llm/llm.port';
import { type LlmCallRecord, type LlmCallRecorder } from '../../src/llm/llm-call-recorder';
import { LlmRouter } from '../../src/llm/llm-router';

type Reply = { status?: number; content?: string };

/** Fake fetch: records request bodies, answers with the queued replies in order. */
function fakeFetch(replies: Reply[]) {
  const bodies: Record<string, unknown>[] = [];
  const fn = async (_url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    bodies.push(JSON.parse(String(init?.body)));
    const r = replies.shift() ?? { content: '{}' };
    if (r.status && r.status >= 400) {
      return new Response(JSON.stringify({ error: { message: 'boom' } }), { status: r.status, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({
      id: 'x', object: 'chat.completion', created: 0, model: 'm',
      choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: r.content ?? '' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return { fn: fn as unknown as typeof fetch, bodies };
}

function recorder() {
  const calls: LlmCallRecord[] = [];
  return { rec: { record: async (c: LlmCallRecord) => { calls.push(c); } } as unknown as LlmCallRecorder, calls };
}

const schema = z.object({ episodes: z.array(z.object({ content: z.string() })) });
const req = { promptId: 'extract.test.v1', system: 'sys', user: 'hello', schema, task: 'extract' as const };

describe('OpenAiCompatibleAdapter', () => {
  it('applies the DeepSeek profile: reasoning off, JSON mode, temperature 0', async () => {
    const f = fakeFetch([{ content: '{"episodes":[]}' }]);
    const a = new OpenAiCompatibleAdapter({ model: 'deepseek-flash', profile: resolveProfile('deepseek'), fetch: f.fn, baseURL: 'http://x/v1' });
    await a.completeJson(req);
    expect(f.bodies[0]).toMatchObject({
      model: 'deepseek-flash', thinking: { type: 'disabled' }, response_format: { type: 'json_object' }, temperature: 0, max_tokens: 4000,
    });
  });

  it('applies the OpenAI profile: json_schema, max_completion_tokens, no temperature', async () => {
    const f = fakeFetch([{ content: '{"episodes":[]}' }]);
    const a = new OpenAiCompatibleAdapter({ model: 'gpt-x', profile: resolveProfile('openai'), fetch: f.fn, baseURL: 'http://x/v1' });
    await a.completeJson(req);
    const body = f.bodies[0] as Record<string, unknown>;
    expect(body['max_completion_tokens']).toBe(4000);
    expect(body).not.toHaveProperty('temperature');
    expect(body['response_format']).toMatchObject({ type: 'json_schema', json_schema: { name: 'extract_test_v1' } });
  });

  it('routes each task to its own configured model', async () => {
    const f = fakeFetch([{ content: '{"episodes":[]}' }, { content: '{"episodes":[]}' }]);
    const big = new OpenAiCompatibleAdapter({ model: 'big', profile: resolveProfile('generic'), fetch: f.fn, baseURL: 'http://x/v1' });
    const small = new OpenAiCompatibleAdapter({ model: 'small', profile: resolveProfile('generic'), fetch: f.fn, baseURL: 'http://x/v1' });
    const router = new LlmRouter({ extract: big, extract_economy: big, resolve: small, facts: big, digest: small });
    await router.completeJson({ ...req, task: 'resolve' });
    await router.completeJson(req);
    expect(f.bodies.map((b) => b['model'])).toEqual(['small', 'big']);
  });

  it('repairs an invalid reply once and records both calls', async () => {
    const f = fakeFetch([{ content: '{"episodes": "nope"}' }, { content: '```json\n{"episodes":[{"content":"ok"}]}\n```' }]);
    const r = recorder();
    const a = new OpenAiCompatibleAdapter({ model: 'm', profile: resolveProfile('generic'), fetch: f.fn, baseURL: 'http://x/v1' }, r.rec);
    const out = await a.completeJson(req, { ownerId: 'o1' });
    expect(out.episodes[0]?.content).toBe('ok');
    expect(r.calls.map((c) => c.status)).toEqual(['invalid_output', 'ok']);
    const repairMsgs = (f.bodies[1] as { messages: { role: string }[] }).messages;
    expect(repairMsgs.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
  });

  it('treats empty content (reasoning ate the budget) as invalid and fails after the repair', async () => {
    const f = fakeFetch([{ content: '' }, { content: '' }]);
    const a = new OpenAiCompatibleAdapter({ model: 'm', profile: resolveProfile('generic'), fetch: f.fn, baseURL: 'http://x/v1' });
    await expect(a.completeJson(req)).rejects.toBeInstanceOf(LlmOutputError);
  });

  it('retries transient errors, not client errors', async () => {
    const ok = fakeFetch([{ status: 503 }, { content: '{"episodes":[]}' }]);
    const a = new OpenAiCompatibleAdapter({ model: 'm', profile: resolveProfile('generic'), fetch: ok.fn, baseURL: 'http://x/v1' });
    await expect(a.completeJson(req)).resolves.toEqual({ episodes: [] });
    const bad = fakeFetch([{ status: 400 }]);
    const r = recorder();
    const b = new OpenAiCompatibleAdapter({ model: 'm', profile: resolveProfile('generic'), fetch: bad.fn, baseURL: 'http://x/v1' }, r.rec);
    await expect(b.completeJson(req)).rejects.toThrow();
    expect(bad.bodies).toHaveLength(1);
    expect(r.calls[0]?.status).toBe('error');
  });

  it('adds the JSON schema to the system prompt in prompt-only mode', async () => {
    const f = fakeFetch([{ content: 'Sure: {"episodes":[]} done' }]);
    const a = new OpenAiCompatibleAdapter({ model: 'm', profile: resolveProfile('generic', '{"structuredOutput":"prompt"}'), fetch: f.fn, baseURL: 'http://x/v1' });
    await expect(a.completeJson(req)).resolves.toEqual({ episodes: [] });
    const msgs = (f.bodies[0] as { messages: { content: string }[] }).messages;
    expect(msgs[0]?.content).toContain('JSON Schema');
    expect(f.bodies[0]).not.toHaveProperty('response_format');
  });
});

describe('parseJsonObject', () => {
  it('reads fenced and prose-wrapped JSON', () => {
    expect(parseJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonObject('here {"a":2} end')).toEqual({ a: 2 });
    expect(() => parseJsonObject('no json')).toThrow();
  });
});

describe('resolveProfile', () => {
  it('rejects unknown profiles without override', () => {
    expect(() => resolveProfile('nope')).toThrow(/Unknown LLM profile/);
    expect(resolveProfile('nope', '{"reasoningOff":{"x":1}}').reasoningOff).toEqual({ x: 1 });
  });

  it('merges nested overrides instead of replacing them', () => {
    const p = resolveProfile('anthropic', '{"anthropic":{"thinking":{"type":"between_tools"}}}');
    expect(p.anthropic).toMatchObject({ effort: 'low', refusalFallback: true, thinking: { type: 'between_tools' } });
  });
});
