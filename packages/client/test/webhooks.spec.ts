// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { createHmac, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyWebhook, WebhookVerificationError } from '../src/webhooks.js';

/** A delivery as Recordare signs it (Standard Webhooks): `v1,` + base64 HMAC-SHA256 over `id.timestamp.body`. */
function signed(secret: string, body: string, at: Date, id = 'msg_1') {
  const ts = Math.floor(at.getTime() / 1000);
  const sig = createHmac('sha256', Buffer.from(secret.replace(/^whsec_/, ''), 'base64')).update(`${id}.${ts}.${body}`).digest('base64');
  return { 'webhook-id': id, 'webhook-timestamp': String(ts), 'webhook-signature': `v1,${sig}` };
}

describe('verifyWebhook (Standard Webhooks)', () => {
  const secret = `whsec_${randomBytes(24).toString('base64')}`;
  const now = new Date('2026-11-01T10:00:00Z');
  const body = JSON.stringify({ type: 'initiative.created', timestamp: now.toISOString(), data: { id: 'i1', kind: 'ask', text: 'Did it happen?', user: 'u1' } });

  it('accepts a good signature and returns the event', () => {
    const event = verifyWebhook(body, signed(secret, body, now), secret, { now });
    expect(event.type).toBe('initiative.created');
    expect(event.data.user).toBe('u1');
  });

  it('accepts one good signature among several (secret rotation), header names in any case', () => {
    const h = signed(secret, body, now);
    const headers = { 'Webhook-Id': h['webhook-id'], 'Webhook-Timestamp': h['webhook-timestamp'], 'Webhook-Signature': `v1,AAAA ${h['webhook-signature']}` };
    expect(verifyWebhook(Buffer.from(body), headers, secret, { now }).data.kind).toBe('ask');
  });

  it('refuses a tampered body, a wrong secret, a stale timestamp and missing headers', () => {
    const h = signed(secret, body, now);
    expect(() => verifyWebhook(body.replace('ask', 'say'), h, secret, { now })).toThrow(WebhookVerificationError);
    expect(() => verifyWebhook(body, h, `whsec_${randomBytes(24).toString('base64')}`, { now })).toThrow(WebhookVerificationError);
    expect(() => verifyWebhook(body, h, secret, { now: new Date(now.getTime() + 6 * 60_000) })).toThrow(/tolerance/);
    expect(() => verifyWebhook(body, { 'webhook-id': 'x' }, secret, { now })).toThrow(/missing/);
  });
});
