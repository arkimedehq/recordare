// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { z } from 'zod';
import { AnthropicAdapter } from '../../src/llm/anthropic.adapter';
import { resolveProfile } from '../../src/llm/provider-profiles';
import { LlmOutputError } from '../../src/llm/llm.port';

type Reply = { text: string; stop?: string };

function fakeFetch(replies: Reply[]) {
  const requests: { body: Record<string, unknown>; headers: Headers }[] = [];
  const fn = async (_url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    requests.push({ body: JSON.parse(String(init?.body)), headers: new Headers(init?.headers) });
    const r = replies.shift() ?? { text: '{}' };
    return new Response(JSON.stringify({
      id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-test',
      content: [{ type: 'text', text: r.text }],
      stop_reason: r.stop ?? 'end_turn', stop_sequence: null,
      usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 80 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return { fn: fn as unknown as typeof fetch, requests };
}

const schema = z.object({ episodes: z.array(z.object({ content: z.string() })) });
const req = { promptId: 'extract.test.v1', system: 'stable system prompt', user: 'hello', schema };

describe('AnthropicAdapter', () => {
  it('sends structured output, cached system prompt, effort and the refusal fallback', async () => {
    const f = fakeFetch([{ text: '{"episodes":[{"content":"x"}]}' }]);
    const a = new AnthropicAdapter({ apiKey: 'k', model: 'claude-test', profile: resolveProfile('anthropic'), fetch: f.fn });
    await expect(a.completeJson(req)).resolves.toEqual({ episodes: [{ content: 'x' }] });
    const { body, headers } = f.requests[0]!;
    expect(body).toMatchObject({
      model: 'claude-test',
      system: [{ type: 'text', text: 'stable system prompt', cache_control: { type: 'ephemeral' } }],
      output_config: { effort: 'low', format: { type: 'json_schema' } },
      fallbacks: 'default',
    });
    expect(body).not.toHaveProperty('thinking');
    expect(headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
  });

  it('omits the fallback when the profile disables it', async () => {
    const f = fakeFetch([{ text: '{"episodes":[]}' }]);
    const profile = resolveProfile('anthropic', '{"anthropic":{"refusalFallback":false}}');
    const a = new AnthropicAdapter({ apiKey: 'k', model: 'claude-test', profile, fetch: f.fn });
    await a.completeJson(req);
    expect(f.requests[0]!.body).not.toHaveProperty('fallbacks');
  });

  it('turns a refusal into an LlmOutputError', async () => {
    const f = fakeFetch([{ text: '', stop: 'refusal' }]);
    const a = new AnthropicAdapter({ apiKey: 'k', model: 'claude-test', profile: resolveProfile('anthropic'), fetch: f.fn });
    await expect(a.completeJson(req)).rejects.toBeInstanceOf(LlmOutputError);
  });

  it('retries once on output that fails validation', async () => {
    const f = fakeFetch([{ text: '{"episodes":"bad"}' }, { text: '{"episodes":[]}' }]);
    const a = new AnthropicAdapter({ apiKey: 'k', model: 'claude-test', profile: resolveProfile('anthropic'), fetch: f.fn });
    await expect(a.completeJson(req)).resolves.toEqual({ episodes: [] });
    expect(f.requests).toHaveLength(2);
  });
});
