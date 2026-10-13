// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentTool, HookMap, OpenClawPluginApi, ToolContext } from 'openclaw/plugin-sdk/plugin-entry';
import { parseConfig } from '../src/config.js';
import { conversationId, resolveSpeaker, resolveUser } from '../src/identity.js';
import { registerRecordare } from '../src/plugin.js';
import { TOOLS, toolName } from '../src/tools.js';
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
  it('needs url and key; by default one memory for the agent, every sender a participant of it', () => {
    expect(parseConfig({}, {})).toBeNull();
    const cfg = parseConfig({ url: 'http://r', apiKey: 'rp_x', selfSenders: ['telegram:1'] }, {})!;
    expect(cfg.personal).toBe(true);
    expect(cfg.memoryPer).toBe('agent');
    expect(resolveUser(cfg, 'telegram', '42')).toBe('me');
    expect(resolveUser(cfg, undefined, undefined)).toBe('me');
    expect(resolveSpeaker(cfg, 'telegram', '42', 'Alice')).toEqual({
      ref: 'telegram:42', role: 'other',
      participant: { ref: 'telegram:42', role: 'other', identity: { channel: 'telegram', externalId: '42' }, displayName: 'Alice' },
    });
    // The account holder ("I"): listed senders and turns without a channel sender (CLI, Control UI).
    expect(resolveSpeaker(cfg, 'telegram', '1')).toEqual({ ref: 'holder', role: 'user' });
    expect(resolveSpeaker(cfg, undefined, undefined)).toEqual({ ref: 'holder', role: 'user' });
    const key = parseConfig({ url: 'http://r', apiKey: 'rk_x', defaultUser: 'agent' }, {})!;
    expect(resolveUser(key, 'telegram', '99')).toBe('agent');
  });

  it('memoryPer user: a client key remembers mapped senders and the default user only', () => {
    const cfg = parseConfig({ url: 'http://r', apiKey: 'rk_x', memoryPer: 'user', users: { 'telegram:42': 'alice' }, defaultUser: 'me' }, {})!;
    expect(resolveUser(cfg, 'telegram', '42')).toBe('alice');
    expect(resolveUser(cfg, 'telegram', '43')).toBeUndefined();
    expect(resolveUser(cfg, undefined, undefined)).toBe('me');
    expect(resolveSpeaker(cfg, 'telegram', '42')).toEqual({ ref: 'holder', role: 'user' });
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
      if (String(url).endsWith('/end')) return new Response(null, { status: 202 });
      const body = String(url).endsWith('/context') ? { block: '<memory-context>x</memory-context>', items: 1 }
        : { conversationId: 'c', accepted: 1, duplicates: 0, conflicts: [] };
      return new Response(JSON.stringify(body), { status: 200 });
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('memoryPer user: stores the message and gets the context in one call, sends the answer, ends the conversation', async () => {
    const { api, hooks } = fakeApi({ url: 'http://r', apiKey: 'rk_x', memoryPer: 'user', users: { 'telegram:42': 'alice' } });
    const plugin = registerRecordare(api, parseConfig(api.pluginConfig, {})!, kinds);
    const ctx = { runId: 'r1', sessionKey: 'agent:main:telegram:42', sessionId: 's1', channel: 'telegram', senderId: '42', agentId: 'main' };

    const res = await hooks.before_prompt_build({ prompt: 'p', currentUserMessage: 'my sister is Giulia', currentUserMessageId: 'm1', messages: [] }, ctx);
    expect(res).toEqual({ prependContext: '<memory-context>x</memory-context>' });
    expect(calls.map((c) => c.url)).toEqual(['http://r/api/v1/context']);
    expect(calls[0]!.headers.get('x-recordare-user')).toBe('alice');
    const ingest = calls[0]!.body.ingest as { conversation: { externalId: string }; messages: Array<{ externalId: string; authorRef: string }> };
    expect(ingest.conversation.externalId).toBe('openclaw:agent:main:telegram:42/s1');
    expect(ingest.messages[0]!.externalId).toBe('m1:u');
    expect(ingest.messages[0]!.authorRef).toBe('holder');
    expect(calls[0]!.body.query).toBe('my sister is Giulia');

    await hooks.agent_end({ success: true, messages: [{ role: 'user', content: 'x' }, { role: 'assistant', content: 'Nice!' }] }, ctx);
    expect(calls[1]!.url).toBe('http://r/api/v1/ingest/messages');
    const sent = calls[1]!.body.messages as Array<{ externalId: string; role: string }>;
    expect(sent.map((m) => [m.externalId, m.role])).toEqual([['m1:u', 'user'], ['r1:a', 'assistant']]);

    await hooks.session_end({ sessionId: 's1', sessionKey: 'agent:main:telegram:42', messageCount: 2, reason: 'new' }, { sessionId: 's1' });
    expect(calls[2]!.url).toBe(`http://r/api/v1/ingest/conversations/${encodeURIComponent('openclaw:agent:main:telegram:42/s1')}/end`);
    expect(calls[2]!.headers.get('x-recordare-user')).toBe('alice');
    // A session Recordare never had is not ended; a compaction never ends one.
    await hooks.session_end({ sessionId: 's9', sessionKey: 'agent:main:other', messageCount: 0, reason: 'new' }, { sessionId: 's9' });
    expect(calls).toHaveLength(3);
    await plugin.stop();
  });

  it('with recall off, stores the message with a plain ingest', async () => {
    const { api, hooks } = fakeApi({ url: 'http://r', apiKey: 'rp_x', autoRecall: false });
    const plugin = registerRecordare(api, parseConfig(api.pluginConfig, {})!, kinds);
    const res = await hooks.before_prompt_build({ prompt: 'p', currentUserMessage: 'hello', currentUserMessageId: 'm2', messages: [] }, { runId: 'r2', sessionKey: 'k', sessionId: 's' });
    expect(res).toBeUndefined();
    expect(calls.map((c) => c.url)).toEqual(['http://r/api/v1/ingest/messages']);
    expect(calls[0]!.headers.get('x-recordare-user')).toBeNull();
    await plugin.stop();
  });

  it('offers the eight memory tools from the published schemas, as the manifest lists them', () => {
    const manifest = JSON.parse(readFileSync(new URL('../openclaw.plugin.json', import.meta.url), 'utf8')) as { contracts: { tools: string[] } };
    expect(TOOLS.map(toolName).sort()).toEqual([...manifest.contracts.tools].sort());
    expect(TOOLS.map((t) => t.mcpName)).not.toContain('log_episode');
    const search = TOOLS.find((t) => t.mcpName === 'search_episodes')!;
    expect(search.description).toContain('recordare_resolve_period');
    expect(search.parameters).not.toHaveProperty('$schema');
    expect(search.parameters).not.toHaveProperty('additionalProperties');
  });

  it('agent memory: the sender is a participant with a channel identity and their name, the agent the account', async () => {
    const { api, hooks, tools } = fakeApi({ url: 'http://r', apiKey: 'rk_x', defaultUser: 'agent' });
    const plugin = registerRecordare(api, parseConfig(api.pluginConfig, {})!, kinds);
    await hooks.message_received({ from: 'telegram:42', content: 'my sister is Giulia', senderId: '42', metadata: { senderName: 'Alice' } }, { channelId: 'telegram' });
    const ctx = { runId: 'r1', sessionKey: 'agent:main:telegram:42', sessionId: 's1', channel: 'telegram', senderId: '42', agentId: 'main' };
    await hooks.before_prompt_build({ prompt: 'p', currentUserMessage: 'my sister is Giulia', currentUserMessageId: 'm1', messages: [] }, ctx);
    expect(calls[0]!.headers.get('x-recordare-user')).toBe('agent');
    const ingest = calls[0]!.body.ingest as { conversation: { participants: unknown[] }; messages: Array<{ role: string; authorRef: string }> };
    expect(ingest.conversation.participants).toContainEqual({ ref: 'telegram:42', role: 'other', identity: { channel: 'telegram', externalId: '42' }, displayName: 'Alice' });
    expect(ingest.messages).toEqual([expect.objectContaining({ role: 'other', authorRef: 'telegram:42' })]);
    await hooks.agent_end({ success: true, messages: [{ role: 'user', content: 'x' }, { role: 'assistant', content: 'Nice!' }] }, ctx);
    expect((calls[1]!.body.messages as Array<{ authorRef: string }>).map((m) => m.authorRef)).toEqual(['telegram:42', 'assistant']);
    // Any sender may use the tools: they act on the agent's memory.
    expect(tools[0]!({ sessionKey: 'k', sessionId: 's', messageChannel: 'telegram', requesterSenderId: '99' })).not.toBeNull();
    await plugin.stop();
  });

  it('agent memory in a group: the account holder is "I", the other members participants', async () => {
    const { api, hooks } = fakeApi({ url: 'http://r', apiKey: 'rp_x', selfSenders: ['telegram:1'] });
    const plugin = registerRecordare(api, parseConfig(api.pluginConfig, {})!, kinds);
    const key = 'agent:main:telegram:group:7';
    await hooks.message_received({ from: 'x', content: 'dinner on Friday?', senderId: '5', sessionKey: key, messageId: 'g1' }, { channelId: 'telegram' });
    await hooks.message_received({ from: 'x', content: 'agent, book it', senderId: '1', sessionKey: key, messageId: 'g2' }, { channelId: 'telegram' });
    await hooks.before_prompt_build({ prompt: 'p', currentUserMessage: 'agent, book it', currentUserMessageId: 'g2', messages: [] },
      { runId: 'r1', sessionKey: key, sessionId: 's1', channel: 'telegram', senderId: '1' });
    const ingest = calls[0]!.body.ingest as { conversation: { participants: Array<{ ref: string }> }; messages: Array<{ externalId: string; role: string; authorRef: string }> };
    expect(calls[0]!.headers.get('x-recordare-user')).toBeNull();
    expect(ingest.conversation.participants.map((p) => p.ref)).toEqual(['holder', 'assistant', 'telegram:5']);
    expect(ingest.messages.map((m) => [m.externalId, m.role, m.authorRef])).toEqual([['msg:g1', 'other', 'telegram:5'], ['g2:u', 'user', 'holder']]);
    await plugin.stop();
  });

  it('agent memory with a client key needs the agent account', async () => {
    const { api, hooks, logs } = fakeApi({ url: 'http://r', apiKey: 'rk_x' });
    const plugin = registerRecordare(api, parseConfig(api.pluginConfig, {})!, kinds);
    await hooks.before_prompt_build({ prompt: 'hi', currentUserMessage: 'hi', messages: [] }, { sessionKey: 'k', sessionId: 's', channel: 'telegram', senderId: '42' });
    expect(calls).toHaveLength(0);
    expect(logs.join('\n')).toMatch(/defaultUser/);
    await plugin.stop();
  });

  it('memoryPer user: leaves unknown senders alone and never throws when Recordare is down', async () => {
    const { api, hooks, tools } = fakeApi({ url: 'http://r', apiKey: 'rk_x', memoryPer: 'user', users: { 'telegram:42': 'alice' } });
    const plugin = registerRecordare(api, parseConfig(api.pluginConfig, {})!, kinds);
    await hooks.before_prompt_build({ prompt: 'hi', currentUserMessage: 'hi', messages: [] }, { sessionKey: 'k', channel: 'telegram', senderId: '99' });
    expect(calls).toHaveLength(0);
    expect(tools[0]!({ sessionKey: 'k', sessionId: 's', messageChannel: 'telegram', requesterSenderId: '99' })).toBeNull();

    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED'); }));
    const res = await hooks.before_prompt_build({ prompt: 'hi', currentUserMessage: 'hi', messages: [] }, { sessionKey: 'k', sessionId: 's', channel: 'telegram', senderId: '42' });
    expect(res).toBeUndefined();
    const tool = tools.map((f) => f({ sessionKey: 'k', sessionId: 's', messageChannel: 'telegram', requesterSenderId: '42' })!)
      .find((t) => t.name === 'recordare_search_episodes')!;
    expect(tool).toBeDefined();
    expect((await tool.execute('t', { query: 'x' })).content[0]!.text).toMatch(/unavailable/);
    await plugin.stop();
  });
});

describe('durable retry queue', () => {
  let dir: string;
  let calls: string[];
  let down: boolean;
  const cfg = { url: 'http://r', apiKey: 'rk_x', memoryPer: 'user', users: { 'telegram:42': 'alice' } };
  const ctx = { sessionKey: 'k', sessionId: 's', channel: 'telegram', senderId: '42', runId: 'r1' };
  const end = { success: true, messages: [{ role: 'user', content: 'my sister is Giulia' }, { role: 'assistant', content: 'Noted.' }] };
  const files = () => readdirSync(dir).filter((n) => n.endsWith('.json'));

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'recordare-outbox-'));
    calls = [];
    down = true;
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      if (down) throw new Error('ECONNREFUSED');
      calls.push(String(init.body));
      return new Response(JSON.stringify({ conversationId: 'c', accepted: 2, duplicates: 0, conflicts: [] }), { status: 200 });
    }));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    rmSync(dir, { recursive: true, force: true });
  });

  it('a batch Recordare did not take survives a restart and is sent by the next run', async () => {
    const first = fakeApi(cfg);
    const plugin = registerRecordare(first.api, parseConfig(first.api.pluginConfig, {})!, kinds, dir);
    await first.hooks.agent_end(end, ctx);
    expect(files()).toHaveLength(1);
    expect(readFileSync(join(dir, files()[0]!), 'utf8')).toContain('my sister is Giulia');
    await plugin.stop();
    expect(files()).toHaveLength(1);           // still down at shutdown: kept for the next start

    vi.useFakeTimers();
    down = false;
    const second = fakeApi(cfg);
    const again = registerRecordare(second.api, parseConfig(second.api.pluginConfig, {})!, kinds, dir);
    expect(second.logs.some((m) => m.includes('1 undelivered batch'))).toBe(true);
    await vi.advanceTimersByTimeAsync(6_000);
    expect(calls).toHaveLength(1);
    expect(JSON.parse(calls[0]!).messages.map((m: { content: string }) => m.content)).toEqual(['my sister is Giulia', 'Noted.']);
    expect(files()).toHaveLength(0);
    vi.useRealTimers();
    await again.stop();
  });

  it('a batch sent at once never touches the disk; an unreadable file is dropped', async () => {
    down = false;
    writeFileSync(join(dir, '000000000000001-aaaaaaaaaaaa.json'), '{broken');
    const { api, hooks, logs } = fakeApi(cfg);
    const plugin = registerRecordare(api, parseConfig(api.pluginConfig, {})!, kinds, dir);
    expect(logs.some((m) => m.includes('unreadable'))).toBe(true);
    await hooks.agent_end(end, ctx);
    expect(calls).toHaveLength(1);
    expect(files()).toHaveLength(0);
    await plugin.stop();
  });
});
