// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentTool, HookMap, OpenClawPluginApi, ToolContext } from 'openclaw/plugin-sdk/plugin-entry';
import { parseConfig } from '../src/config.js';
import { conversationId, resolveUser } from '../src/identity.js';
import { registerRecordare } from '../src/plugin.js';
import { cleanUserText, lastTurn } from '../src/transcript.js';

const kinds = { isIncognito: () => false, isCron: () => false, isSubagent: () => false };

function fakeApi(config: Record<string, unknown>) {
  const hooks: Partial<HookMap> = {};
  const tools: Array<(ctx: ToolContext) => AgentTool | null | undefined> = [];
  const logs: string[] = [];
  const api: OpenClawPluginApi = {
    id: 'recordare',
    pluginConfig: config,
    logger: { info: (m) => logs.push(m), warn: (m) => logs.push(m), error: (m) => logs.push(m) },
    on: (name, handler) => { (hooks as Record<string, unknown>)[name] = handler; },
    registerTool: (factory) => { tools.push(factory); },
    registerService: () => undefined,
  };
  return { api, hooks: hooks as HookMap, tools, logs };
}

interface Call { url: string; headers: Headers; body: Record<string, unknown> }

describe('config and identity', () => {
  it('needs url and key; a personal token defaults to one person', () => {
    expect(parseConfig({}, {})).toBeNull();
    const cfg = parseConfig({ url: 'http://r', apiKey: 'rp_x' }, {})!;
    expect(cfg.personal).toBe(true);
    expect(resolveUser(cfg, 'telegram', '42')).toBe('me');
    expect(resolveUser(cfg, undefined, undefined)).toBe('me');
  });

  it('a client key remembers mapped senders and the default user only', () => {
    const cfg = parseConfig({ url: 'http://r', apiKey: 'rk_x', users: { 'telegram:42': 'alice' }, defaultUser: 'owner' }, {})!;
    expect(resolveUser(cfg, 'telegram', '42')).toBe('alice');
    expect(resolveUser(cfg, 'telegram', '43')).toBeUndefined();
    expect(resolveUser(cfg, undefined, undefined)).toBe('owner');
    expect(conversationId('agent:main:main', 's1')).toBe('openclaw:agent:main:main/s1');
  });
});

describe('transcript', () => {
  it('strips the memory block, the timestamp and the metadata fences', () => {
    const raw = '<memory-context source="recordare">\nfacts\n</memory-context>\n'
      + 'Conversation info (untrusted metadata):\n```json\n{"sender_id":"42"}\n```\n[Mon 2026-03-23 13:12] my sister is Giulia';
    expect(cleanUserText(raw)).toBe('my sister is Giulia');
  });

  it('takes the last user message and the assistant text after it', () => {
    const t = lastTurn([
      { role: 'user', content: 'old' }, { role: 'assistant', content: 'old answer' },
      { role: 'user', content: [{ type: 'text', text: 'hi' }] },
      { role: 'assistant', content: [{ type: 'thinking', thinking: 'x' }, { type: 'text', text: 'hello' }] },
    ]);
    expect(t).toEqual({ user: 'hi', assistant: 'hello' });
  });
});

describe('hooks and tools', () => {
  let calls: Call[];
  beforeEach(() => {
    calls = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), headers: new Headers(init.headers), body: JSON.parse(String(init.body ?? '{}')) });
      const body = String(url).endsWith('/context') ? { block: '<memory-context>x</memory-context>', items: 1 }
        : { conversationId: 'c', accepted: 1, duplicates: 0, conflicts: [], stored: true };
      return new Response(JSON.stringify(body), { status: 200 });
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sends the message, injects the context, sends the answer, signals the end', async () => {
    const { api, hooks } = fakeApi({ url: 'http://r', apiKey: 'rk_x', users: { 'telegram:42': 'alice' } });
    const plugin = registerRecordare(api, parseConfig(api.pluginConfig, {})!, kinds);
    const ctx = { runId: 'r1', sessionKey: 'agent:main:telegram:42', sessionId: 's1', channel: 'telegram', senderId: '42', agentId: 'main' };

    const res = await hooks.before_prompt_build({ prompt: 'p', currentUserMessage: 'my sister is Giulia', currentUserMessageId: 'm1', messages: [] }, ctx);
    expect(res).toEqual({ prependContext: '<memory-context>x</memory-context>' });
    expect(calls.map((c) => c.url)).toEqual(['http://r/api/v1/ingest/messages', 'http://r/api/v1/context']);
    expect(calls[0]!.headers.get('x-recordare-user')).toBe('alice');
    expect(calls[1]!.headers.get('x-recordare-conversation')).toBe('openclaw:agent:main:telegram:42/s1');
    expect((calls[0]!.body.messages as Array<{ externalId: string }>)[0]!.externalId).toBe('m1:u');

    await hooks.agent_end({ success: true, messages: [{ role: 'user', content: 'x' }, { role: 'assistant', content: 'Nice!' }] }, ctx);
    const sent = calls[2]!.body.messages as Array<{ externalId: string; role: string }>;
    expect(sent.map((m) => [m.externalId, m.role])).toEqual([['m1:u', 'user'], ['r1:a', 'assistant']]);

    await hooks.session_end({ sessionId: 's1', sessionKey: 'agent:main:telegram:42', messageCount: 2, reason: 'new' }, { sessionId: 's1' });
    expect(calls[3]!.body.hints).toEqual({ conversationEnded: true });
    await plugin.stop();
  });

  it('leaves unknown senders alone and never throws when Recordare is down', async () => {
    const { api, hooks, tools } = fakeApi({ url: 'http://r', apiKey: 'rk_x', users: { 'telegram:42': 'alice' } });
    const plugin = registerRecordare(api, parseConfig(api.pluginConfig, {})!, kinds);
    await hooks.before_prompt_build({ prompt: 'hi', currentUserMessage: 'hi', messages: [] }, { sessionKey: 'k', channel: 'telegram', senderId: '99' });
    expect(calls).toHaveLength(0);
    expect(tools[0]!({ sessionKey: 'k', sessionId: 's', messageChannel: 'telegram', requesterSenderId: '99' })).toBeNull();

    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED'); }));
    const res = await hooks.before_prompt_build({ prompt: 'hi', currentUserMessage: 'hi', messages: [] }, { sessionKey: 'k', sessionId: 's', channel: 'telegram', senderId: '42' });
    expect(res).toBeUndefined();
    const tool = tools[0]!({ sessionKey: 'k', sessionId: 's', messageChannel: 'telegram', requesterSenderId: '42' })!;
    expect(tool.name).toBe('recordare_search_episodes');
    expect((await tool.execute('t', { query: 'x' })).content[0]!.text).toMatch(/unavailable/);
    await plugin.stop();
  });
});
