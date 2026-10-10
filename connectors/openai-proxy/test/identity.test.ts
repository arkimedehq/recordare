// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { resolveIdentity, stripMarkers, verifyJwt } from '../src/identity.js';
import { config as base } from './helpers.js';

/** Memory per user (the behaviour before D50): the resolvers' ids are the Recordare users. */
const config = (env: Record<string, string> = {}) => base({ MEMORY_PER: 'user', ...env });

const now = new Date('2026-10-08T10:00:00Z');
const msgs = (system: string) => [{ role: 'system', content: system }, { role: 'user', content: 'ciao' }];

function jwt(claims: Record<string, unknown>, secret: string): string {
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc(claims)}`;
  return `${head}.${createHmac('sha256', secret).update(head).digest('base64url')}`;
}

describe('AnythingLLM marker', () => {
  it('reads the marker from the first system message and removes it', () => {
    const r = resolveIdentity(config(), {}, msgs('You are helpful.\n[[recordare user=7 ws=3]]'), now);
    expect(r.identity).toEqual({ platform: 'anythingllm', user: 'anythingllm:7', conversation: 'anythingllm:3:7:2026-10-08', messageId: undefined });
    expect(r.messages[0]?.content).toBe('You are helpful.');
    expect(JSON.stringify(r.messages)).not.toContain('[[recordare');
  });

  it('a placeholder user ([User ID] in single-user mode) falls back to DEFAULT_USER, else no identity — marker removed either way', () => {
    const m = msgs('[[recordare user=[User ID] ws=2]] Be brief.');
    const none = resolveIdentity(config(), {}, m, now);
    expect(none.identity).toBeNull();
    expect(none.messages[0]?.content).toBe('Be brief.');
    const mine = resolveIdentity(config({ DEFAULT_USER: 'me' }), {}, m, now);
    expect(mine.identity?.user).toBe('anythingllm:me');
    expect(mine.identity?.conversation).toBe('anythingllm:2:me:2026-10-08');
  });

  it('removes markers from later system messages and content arrays, but trusts only the first system message', () => {
    const r = stripMarkers([
      { role: 'system', content: [{ type: 'text', text: 'A [[recordare user=1 ws=1]]' }] },
      { role: 'system', content: 'B [[recordare user=2 ws=2]]' },
      { role: 'user', content: '[[recordare user=evil]] hi' },
    ]);
    expect(r.attrs).toEqual({ user: '1', ws: '1' });
    expect(JSON.stringify(r.messages.slice(0, 2))).not.toContain('[[recordare');
    expect(r.messages[2]?.content).toBe('[[recordare user=evil]] hi'); // user text is never read nor changed
  });

  it('a marker only in a user message gives no identity', () => {
    expect(resolveIdentity(config(), {}, [{ role: 'user', content: '[[recordare user=9 ws=1]]' }], now).identity).toBeNull();
  });

  it('alias map and map-only', () => {
    const map = JSON.stringify({ 'anythingllm:7': 'andrea' });
    expect(resolveIdentity(config({ USER_MAP: map }), {}, msgs('[[recordare user=7 ws=3]]'), now).identity?.user).toBe('andrea');
    expect(resolveIdentity(config({ USER_MAP: map, USER_MAP_ONLY: 'true' }), {}, msgs('[[recordare user=8 ws=3]]'), now).identity).toBeNull();
  });
});

describe('Open WebUI', () => {
  it('forwarded user and chat headers', () => {
    const r = resolveIdentity(config(), { 'x-openwebui-user-id': 'u-1', 'x-openwebui-chat-id': 'c-9' }, msgs('sys'), now);
    expect(r.identity).toMatchObject({ platform: 'openwebui', user: 'openwebui:u-1', conversation: 'openwebui:c-9' });
  });

  it('without a chat id: one conversation per user and day', () => {
    const r = resolveIdentity(config(), { 'x-openwebui-user-id': 'u-1' }, msgs('sys'), now);
    expect(r.identity?.conversation).toBe('openwebui:u-1:2026-10-08');
  });

  it('JWT mode: only a valid signed token counts; plain headers are ignored', () => {
    const cfg = config({ OPENWEBUI_JWT_SECRET: 's3cret' });
    const good = jwt({ sub: 'u-2', exp: Math.floor(now.getTime() / 1000) + 300 }, 's3cret');
    expect(resolveIdentity(cfg, { 'x-openwebui-user-jwt': good, 'x-openwebui-chat-id': 'c' }, msgs('s'), now).identity?.user).toBe('openwebui:u-2');
    expect(resolveIdentity(cfg, { 'x-openwebui-user-jwt': jwt({ sub: 'u-2' }, 'other') }, msgs('s'), now).identity).toBeNull();
    expect(resolveIdentity(cfg, { 'x-openwebui-user-id': 'u-3' }, msgs('s'), now).identity).toBeNull();
    const expired = jwt({ sub: 'u-2', exp: Math.floor(now.getTime() / 1000) - 1 }, 's3cret');
    expect(verifyJwt(expired, 's3cret', now.getTime())).toBeNull();
  });
});

describe('generic headers (LibreChat)', () => {
  it('user, conversation and message id from the headers', () => {
    const r = resolveIdentity(config(), {
      'x-recordare-user': '64f0a1', 'x-recordare-conversation': 'librechat:conv-1', 'x-recordare-message': 'msg-5',
    }, msgs('sys'), now);
    expect(r.identity).toEqual({ platform: 'generic', user: '64f0a1', conversation: 'librechat:conv-1', messageId: 'msg-5' });
  });

  it('unexpanded placeholders count as missing', () => {
    const r = resolveIdentity(config(), {
      'x-recordare-user': 'alice', 'x-recordare-conversation': '{{LIBRECHAT_BODY_CONVERSATIONID}}', 'x-recordare-message': 'null',
    }, msgs('sys'), now);
    expect(r.identity).toEqual({ platform: 'generic', user: 'alice', conversation: 'generic:alice:2026-10-08', messageId: undefined });
    expect(resolveIdentity(config(), { 'x-recordare-user': '{{LIBRECHAT_USER_ID}}' }, msgs('sys'), now).identity).toBeNull();
    const first = resolveIdentity(config(), { 'x-recordare-user': 'alice', 'x-recordare-conversation': 'librechat:new' }, msgs('sys'), now);
    expect(first.identity?.conversation).toBe('generic:alice:2026-10-08');
  });

  it('resolver order and selection', () => {
    const h = { 'x-recordare-user': 'alice', 'x-openwebui-user-id': 'u-1' };
    expect(resolveIdentity(config(), h, msgs('s'), now).identity?.platform).toBe('generic');
    expect(resolveIdentity(config({ RESOLVERS: 'openwebui' }), h, msgs('s'), now).identity?.platform).toBe('openwebui');
  });
});

describe('memory per instance (default, D50) and per workspace', () => {
  const agent = (env: Record<string, string> = {}) => base({ RECORDARE_API_KEY: 'rk_x', RECORDARE_USER: 'agent', ...env });

  it('one memory for the proxy; the platform user is a participant with their name', () => {
    const r = resolveIdentity(agent(), { 'x-openwebui-user-id': 'u-1', 'x-openwebui-user-name': 'Alice', 'x-openwebui-chat-id': 'c-9' }, msgs('s'), now);
    expect(r.identity).toEqual({
      platform: 'openwebui', user: 'agent', conversation: 'openwebui:c-9', messageId: undefined,
      participant: { ref: 'openwebui:u-1', identity: { externalUserId: 'openwebui:u-1' }, displayName: 'Alice' },
    });
    const ll = resolveIdentity(agent(), {}, msgs('[[recordare user=7 name="Bruno Rossi" ws=3]]'), now);
    expect(ll.identity?.participant).toEqual({ ref: 'anythingllm:7', identity: { externalUserId: 'anythingllm:7' }, displayName: 'Bruno Rossi' });
    // USER_MAP gives one person one id across platforms
    const mapped = resolveIdentity(agent({ USER_MAP: JSON.stringify({ 'anythingllm:7': 'bruno' }) }), {}, msgs('[[recordare user=7 ws=3]]'), now);
    expect(mapped.identity?.participant?.identity).toEqual({ externalUserId: 'bruno' });
  });

  it('SELF_USERS are the account holder: no participant', () => {
    const cfg = agent({ SELF_USERS: 'openwebui:u-1, andrea' });
    const self = resolveIdentity(cfg, { 'x-openwebui-user-id': 'u-1' }, msgs('s'), now).identity;
    expect(self?.user).toBe('agent');
    expect(self?.participant).toBeUndefined();
    expect(resolveIdentity(cfg, { 'x-recordare-user': 'andrea' }, msgs('s'), now).identity?.participant).toBeUndefined();
  });

  it('a client key without RECORDARE_USER remembers nothing; a personal token is the memory', () => {
    expect(resolveIdentity(base({ RECORDARE_API_KEY: 'rk_x' }), { 'x-openwebui-user-id': 'u-1' }, msgs('s'), now).identity).toBeNull();
    expect(resolveIdentity(base({ RECORDARE_API_KEY: 'rp_x' }), { 'x-openwebui-user-id': 'u-1' }, msgs('s'), now).identity?.participant?.ref).toBe('openwebui:u-1');
  });

  it('per workspace: each AnythingLLM workspace its own memory, other platforms the instance\'s', () => {
    const cfg = agent({ MEMORY_PER: 'workspace', USER_MAP: JSON.stringify({ 'anythingllm:ws:3': 'kitchen' }) });
    expect(resolveIdentity(cfg, {}, msgs('[[recordare user=7 ws=3]]'), now).identity?.user).toBe('kitchen');
    expect(resolveIdentity(cfg, {}, msgs('[[recordare user=7 ws=4]]'), now).identity?.user).toBe('anythingllm:ws:4');
    expect(resolveIdentity(cfg, { 'x-openwebui-user-id': 'u-1' }, msgs('s'), now).identity?.user).toBe('agent');
    expect(() => base({ MEMORY_PER: 'team' })).toThrow(/MEMORY_PER/);
  });
});
