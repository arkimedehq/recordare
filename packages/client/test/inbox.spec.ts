// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { addressesOn, type Delivered, InitiativeInbox, WebhookVerificationError, type Initiative, type InitiativeOutcome } from '../src/index.js';

const SECRET = `whsec_${Buffer.from('an inbox test secret, long enough').toString('base64')}`;
const NOW = Date.parse('2026-11-05T09:00:00Z');

function initiative(over: Partial<Initiative> = {}): Initiative {
  return {
    id: 'i1', seq: 1, kind: 'say', for: null, text: 'Hai steso i panni?', reason: 'r', worth: 0.8, episodeIds: [],
    dueAt: '2026-11-05T08:00:00Z', expiresAt: '2026-11-05T20:00:00Z', status: 'offered', outcomeAt: null, reply: null,
    createdAt: '2026-11-05T08:00:00Z', timing: 'flexible', window: { notBefore: '2026-11-05T08:00:00Z', notAfter: '2026-11-05T20:00:00Z' },
    channel: 'chat', channels: ['voice', 'chat'], identity: { required: 'medium' }, source: null, offeredAt: '2026-11-05T08:00:00Z', pushedAt: '2026-11-05T08:00:00Z', ...over,
  };
}

function signed(event: object, id = 'msg_1') {
  const body = JSON.stringify(event);
  const ts = Math.floor(Date.now() / 1000);
  const sig = `v1,${createHmac('sha256', Buffer.from(SECRET.replace(/^whsec_/, ''), 'base64')).update(`${id}.${ts}.${body}`).digest('base64')}`;
  return { body, headers: { 'webhook-id': id, 'webhook-timestamp': String(ts), 'webhook-signature': sig } };
}

type Deliver = (user: string, i: Initiative, how: { via: string }) => Promise<InitiativeOutcome | Delivered | null>;

function setup(deliver: Deliver & { mock?: unknown } = vi.fn<Deliver>(async (_u, i) => (i.kind === 'ask' ? 'asked' : 'said')),
  open?: (user: string, i: Initiative, opening: string) => Promise<void>) {
  const client = {
    reportInitiative: vi.fn(async () => ({})),
    presence: vi.fn(async () => ({ person: null, initiative: null, askWho: null })),
    initiatives: vi.fn(async () => ({ items: [] as Initiative[], next: 0, more: false })),
  };
  const log: string[] = [];
  const inbox = new InitiativeInbox({ client: client as never, deliver, open, secret: SECRET, users: () => ['u1'], channels: ['chat'], log: (m) => log.push(m) });
  return { inbox, client, deliver, log };
}
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('InitiativeInbox', () => {
  it('a verified initiative.deliver is delivered once and reported; a repeated webhook-id is ignored; a bad signature throws', async () => {
    const { inbox, client, deliver } = setup();
    const w = signed({ type: 'initiative.deliver', timestamp: '', data: { ...initiative(), user: 'u1', memoryId: 'm' } });
    expect(inbox.handleWebhook(w.body, w.headers)?.type).toBe('initiative.deliver');
    await settle();
    expect(deliver).toHaveBeenCalledWith('u1', expect.objectContaining({ id: 'i1' }), { via: 'webhook' });
    expect(client.reportInitiative).toHaveBeenCalledWith('u1', 'i1', 'said', { channel: 'chat' });
    expect(inbox.handleWebhook(w.body, w.headers)).toBeNull(); // the same delivery again
    expect(() => inbox.handleWebhook(w.body.replace('u1', 'u2'), w.headers)).toThrow(WebhookVerificationError);
    // Other events are information; the same initiative by another way is not handed over twice.
    const updated = signed({ type: 'initiative.updated', timestamp: '', data: { ...initiative(), user: 'u1', memoryId: 'm' } }, 'msg_2');
    inbox.handleWebhook(updated.body, updated.headers);
    expect(await inbox.receive({ type: 'initiative.deliver', timestamp: '', data: { ...initiative(), user: 'u1', memoryId: 'm' } })).toBe(false);
    await settle();
    expect(deliver).toHaveBeenCalledTimes(1);
  });

  it('a presence impulse delivers what Recordare answers with; the host may report done (it had it already) or nothing', async () => {
    const deliver = vi.fn(async (_u: string, i: Initiative) => (i.id === 'had' ? 'done' as const : null));
    const { inbox, client } = setup(deliver);
    client.presence.mockResolvedValueOnce({ person: { personId: 'p', name: 'Eriona' }, initiative: initiative({ id: 'had', channel: 'voice' }), askWho: null } as never);
    const res = await inbox.presence('u1', { channel: 'voice', confidence: 0.9 });
    expect(res).toMatchObject({ person: { name: 'Eriona' }, delivered: false });
    expect(client.reportInitiative).toHaveBeenCalledWith('u1', 'had', 'done', { channel: 'voice' });
    client.presence.mockResolvedValueOnce({ person: null, initiative: initiative({ id: 'quiet' }), askWho: null } as never);
    await inbox.presence('u1', { channel: 'chat' });
    expect(client.reportInitiative).toHaveBeenCalledTimes(1); // null: nothing reported
  });

  it('catches up from the feed with a cursor: recent pushes on its channels only, look-ups left to the agent', async () => {
    const { inbox, client, deliver } = setup();
    client.initiatives.mockResolvedValueOnce({ items: [
      initiative({ id: 'recent' }), initiative({ id: 'old', pushedAt: '2026-11-01T08:00:00Z' }), initiative({ id: 'voice', channel: 'voice' }),
      initiative({ id: 'pending', status: 'pending', pushedAt: null }), initiative({ id: 'lookup', kind: 'lookup' }),
    ], next: 9, more: false });
    expect(await inbox.catchUp(NOW)).toBe(1);
    expect(deliver).toHaveBeenCalledTimes(1);
    await inbox.catchUp(NOW);
    expect(client.initiatives).toHaveBeenLastCalledWith('u1', { since: 9, limit: 200 });
  });

  it('a failing delivery is logged, not thrown, and tried again later', async () => {
    let fail = true;
    const { inbox, log } = setup(vi.fn(async () => { if (fail) throw new Error('chat down'); return 'said' as const; }));
    expect(await inbox.receive({ type: 'initiative.deliver', timestamp: '', data: { ...initiative(), user: 'u1', memoryId: 'm' } })).toBe(false);
    expect(log[0]).toContain('chat down');
    fail = false;
    expect(await inbox.receive({ type: 'initiative.deliver', timestamp: '', data: { ...initiative(), user: 'u1', memoryId: 'm' } })).toBe(true);
  });
  it('the host reports the channel it used (§5b) and finds the person there; a camera presence is reported as voice', async () => {
    const deliver = vi.fn<Deliver>(async (_u, i) => {
      const chat = addressesOn(i, 'telegram')[0];
      return chat ? { outcome: 'said', channel: 'messaging' } : 'said';
    });
    const { inbox, client } = setup(deliver);
    const forChloe = { personId: 'p', name: 'Chloé', addresses: [{ channel: 'telegram', id: '42' }, { channel: 'homeassistant', id: 'person.chloe' }] };
    expect(addressesOn(initiative({ for: forChloe }), 'homeassistant')).toEqual(['person.chloe']);
    expect(addressesOn(initiative(), 'telegram')).toEqual([]);
    await inbox.receive({ type: 'initiative.deliver', timestamp: '', data: { ...initiative({ id: 'msg', for: forChloe, channels: ['voice', 'messaging', 'chat'] }), user: 'u1', memoryId: 'm' } });
    expect(client.reportInitiative).toHaveBeenLastCalledWith('u1', 'msg', 'said', { channel: 'messaging' });
    client.presence.mockResolvedValueOnce({ person: null, people: [], initiative: initiative({ id: 'cam', channel: 'camera' }), askWho: null, opening: null } as never);
    await inbox.presence('u1', { channel: 'camera', people: [{ identity: { channel: 'face', externalId: 'chloe' } }] });
    expect(deliver).toHaveBeenLastCalledWith('u1', expect.objectContaining({ id: 'cam' }), { via: 'presence' });
    expect(client.reportInitiative).toHaveBeenLastCalledWith('u1', 'cam', 'said', { channel: 'voice' });
  });

  it('with others in the room only the opening is said, by `open`; the initiative is not taken and comes back later', async () => {
    const open = vi.fn(async () => undefined);
    const { inbox, client, deliver } = setup(undefined, open);
    const waiting = initiative({ id: 'w', status: 'pending', channel: null });
    const opening = 'Chloé, ho una cosa per te: vuoi sentirla?';
    client.presence.mockResolvedValueOnce({ person: { personId: 'p', name: 'Chloé' }, people: [], initiative: waiting, askWho: null, opening } as never);
    const res = await inbox.presence('u1', { channel: 'voice', place: 'kitchen', people: [{ identity: { channel: 'homeassistant', externalId: 'person.chloe' } }], someone: 1 });
    expect(res).toMatchObject({ delivered: false, opened: true, opening });
    expect(open).toHaveBeenCalledWith('u1', waiting, opening);
    expect(deliver).not.toHaveBeenCalled();
    expect(client.reportInitiative).not.toHaveBeenCalled();
    // Alone later: the same initiative is delivered.
    client.presence.mockResolvedValueOnce({ person: { personId: 'p', name: 'Chloé' }, people: [], initiative: { ...waiting, status: 'offered' }, askWho: null, opening: null } as never);
    expect((await inbox.presence('u1', { channel: 'voice' })).delivered).toBe(true);
    // A host without `open` says nothing at all.
    const bare = setup();
    bare.client.presence.mockResolvedValueOnce({ person: null, people: [], initiative: waiting, askWho: null, opening } as never);
    expect(await bare.inbox.presence('u1', { channel: 'voice' })).toMatchObject({ delivered: false, opened: false });
    expect(bare.deliver).not.toHaveBeenCalled();
  });
});
