// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Verifying a webhook from Recordare (D53, 8.12c), as Standard Webhooks prescribes (https://www.standardwebhooks.com/,
 * spec 1.0): the `webhook-signature` header carries one or more `v1,<base64>` signatures — HMAC-SHA256 with the
 * `whsec_` secret (base64 after the prefix) over `${webhook-id}.${webhook-timestamp}.${raw body}`; a timestamp farther
 * than the tolerance from now is refused (replay). The raw body must be the bytes received, not a re-serialisation.
 * Written from the specification; no code reused.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { type WebhookEvent } from './contract.js';

export type WebhookHeaders = Record<string, string | string[] | undefined>;

export class WebhookVerificationError extends Error {
  constructor(message: string) { super(message); this.name = 'WebhookVerificationError'; }
}

function header(h: WebhookHeaders, name: string): string | undefined {
  const key = Object.keys(h).find((k) => k.toLowerCase() === name);
  const v = key === undefined ? undefined : h[key];
  return Array.isArray(v) ? v[0] : v;
}

/**
 * The event, once the signature and the timestamp check out; throws `WebhookVerificationError` otherwise.
 * `body` is the raw request body (string or bytes); `secret` the `whsec_` value the registration returned.
 */
export function verifyWebhook(body: string | Uint8Array, headers: WebhookHeaders, secret: string, options: { toleranceSeconds?: number; now?: Date } = {}): WebhookEvent {
  const id = header(headers, 'webhook-id');
  const ts = header(headers, 'webhook-timestamp');
  const sig = header(headers, 'webhook-signature');
  if (!id || !ts || !sig) throw new WebhookVerificationError('missing webhook headers');
  const tolerance = options.toleranceSeconds ?? 300;
  const now = Math.floor((options.now ?? new Date()).getTime() / 1000);
  const timestamp = Number(ts);
  if (!Number.isInteger(timestamp) || Math.abs(now - timestamp) > tolerance) throw new WebhookVerificationError('webhook timestamp out of tolerance');
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const raw = typeof body === 'string' ? body : Buffer.from(body).toString('utf8');
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${raw}`).digest();
  const ok = sig.split(' ').some((part) => {
    const [version, value] = part.split(',');
    if (version !== 'v1' || !value) return false;
    const given = Buffer.from(value, 'base64');
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
  if (!ok) throw new WebhookVerificationError('webhook signature does not match');
  return JSON.parse(raw) as WebhookEvent;
}
