// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Webhooks to the clients (D53, WORK_PLAN 8.12c), as Standard Webhooks (https://www.standardwebhooks.com/, spec 1.0;
 * what OpenAI's and Anthropic's webhooks follow): a `whsec_` secret per endpoint, the headers `webhook-id`,
 * `webhook-timestamp` and `webhook-signature` (`v1,` + base64 HMAC-SHA256 over `id.timestamp.body`), the envelope
 * `{type, timestamp, data}`. The delivery is a job: tried again with a growing delay for a day and a half, then given up;
 * `410 Gone` disables the endpoint. Private addresses are refused unless the deployer allows them (`WEBHOOK_ALLOW_PRIVATE`,
 * for a client co-hosted with Recordare). The secret is kept as it is: it signs every delivery (it is the endpoint's, not
 * a credential to Recordare; an admin may rotate it by registering a new webhook and removing the old one).
 */
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Queue } from 'bullmq';
import { lookup } from 'node:dns/promises';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { DataSource } from 'typeorm';
import { type Env } from '../config/env';
import { WEBHOOK_QUEUE } from './initiative.queue';

export interface WebhookView { id: string; clientId: string; url: string; token: string | null; authentication: { scheme: string; credentials?: string } | null; description: string | null; createdAt: string; disabledAt: string | null; disabledReason: string | null }
export interface RegisterWebhook { url: string; token?: string; authentication?: { scheme: string; credentials?: string }; description?: string }

/** Seconds before each retry (the Standard Webhooks' shape: growing, over a day and a half). */
export const RETRY_DELAYS_S = [60, 300, 1800, 7200, 21600, 43200, 43200];
const TIMEOUT_MS = 20_000;

interface Row { id: string; client_id: string; url: string; secret: string; token: string | null; authentication: WebhookView['authentication']; description: string | null; created_at: Date; disabled_at: Date | null; disabled_reason: string | null }

const viewOf = (r: Row): WebhookView => ({
  id: r.id, clientId: r.client_id, url: r.url, token: r.token, authentication: r.authentication, description: r.description,
  createdAt: r.created_at.toISOString(), disabledAt: r.disabled_at?.toISOString() ?? null, disabledReason: r.disabled_reason,
});

/** Standard Webhooks signature: `v1,` + base64(HMAC-SHA256(secret, `${id}.${timestamp}.${body}`)); the secret after `whsec_` is base64. */
export function sign(secret: string, id: string, timestamp: number, body: string): string {
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  return `v1,${createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64')}`;
}

@Injectable()
export class WebhooksService {
  private readonly log = new Logger(WebhooksService.name);
  /** For tests: a fetch of their own. */
  fetchImpl: typeof fetch = fetch;

  constructor(
    private readonly db: DataSource,
    private readonly config: ConfigService<Env, true>,
    @InjectQueue(WEBHOOK_QUEUE) private readonly queue: Queue,
  ) {}

  async register(clientId: string, input: RegisterWebhook): Promise<WebhookView & { secret: string }> {
    await this.checkUrl(input.url);
    const [client] = await this.db.query(`SELECT id FROM clients WHERE id = $1`, [clientId]);
    if (!client) throw new NotFoundException();
    const secret = `whsec_${randomBytes(24).toString('base64')}`;
    const [row]: Row[] = await this.db.query(
      `INSERT INTO client_webhooks (client_id, url, secret, token, authentication, description) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [clientId, input.url, secret, input.token ?? null, input.authentication ? JSON.stringify(input.authentication) : null, input.description ?? null]);
    return { ...viewOf(row!), secret };
  }

  async list(clientId: string): Promise<WebhookView[]> {
    const rows: Row[] = await this.db.query(`SELECT * FROM client_webhooks WHERE client_id = $1 ORDER BY created_at`, [clientId]);
    return rows.map(viewOf);
  }

  async remove(id: string): Promise<void> {
    const r: [unknown[], number] | unknown[] = await this.db.query(`DELETE FROM client_webhooks WHERE id = $1 RETURNING id`, [id]);
    const deleted = Array.isArray(r[0]) ? (r[0] as unknown[]).length : r.length;
    if (!deleted) throw new NotFoundException();
  }

  /**
   * An event about a memory to every enabled webhook of the clients that know it (an account identity): the payload carries
   * the client's own id for the memory's person (`user`), so the client knows whom it is about without a round trip.
   */
  async notify(memoryId: string, type: string, data: object, initiativeId: string | null): Promise<void> {
    const targets: Array<Row & { external_id: string }> = await this.db.query(
      `SELECT w.*, i.external_id FROM client_webhooks w
       JOIN external_identities i ON i.client_id = w.client_id AND i.person_id = $1 AND i.kind = 'account'
       WHERE w.disabled_at IS NULL`, [memoryId]);
    const timestamp = new Date().toISOString();
    for (const w of targets) {
      const payload = { type, timestamp, data: { ...data, user: w.external_id, memoryId } };
      const [d] = await this.db.query(
        `INSERT INTO webhook_deliveries (webhook_id, initiative_id, event_type, payload) VALUES ($1, $2, $3, $4) RETURNING id`,
        [w.id, initiativeId, type, JSON.stringify(payload)]);
      await this.queue.add('deliver', { deliveryId: d.id as string, attempt: 0 }, { removeOnComplete: true, removeOnFail: true });
    }
  }

  /** One attempt of a delivery (the webhook processor): success, a retry later, or giving up. */
  async deliver(deliveryId: string, attempt: number): Promise<void> {
    const [d]: Array<{ id: string; payload: object; webhook_id: string; url: string; secret: string; token: string | null; authentication: WebhookView['authentication']; disabled_at: Date | null }> =
      await this.db.query(
        `SELECT d.id, d.payload, d.webhook_id, w.url, w.secret, w.token, w.authentication, w.disabled_at
         FROM webhook_deliveries d JOIN client_webhooks w ON w.id = d.webhook_id WHERE d.id = $1 AND d.delivered_at IS NULL AND d.gave_up_at IS NULL`, [deliveryId]);
    if (!d || d.disabled_at) return;
    const body = JSON.stringify(d.payload);
    const id = `msg_${randomUUID().replace(/-/g, '')}`;
    const ts = Math.floor(Date.now() / 1000);
    const headers: Record<string, string> = {
      'content-type': 'application/json', 'webhook-id': id, 'webhook-timestamp': String(ts), 'webhook-signature': sign(d.secret, id, ts, body),
      ...(d.token ? { 'x-recordare-token': d.token } : {}),
      ...(d.authentication?.credentials ? { authorization: `${d.authentication.scheme} ${d.authentication.credentials}` } : {}),
    };
    let status = 0, error: string | null = null;
    try {
      await this.checkUrl(d.url);
      const res = await this.fetchImpl(d.url, { method: 'POST', headers, body, redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) });
      status = res.status;
    } catch (err) {
      error = (err as Error).message;
    }
    const ok = status >= 200 && status < 300;
    await this.db.query(
      `UPDATE webhook_deliveries SET attempts = $2, last_status = $3, last_error = $4, delivered_at = CASE WHEN $5 THEN now() END WHERE id = $1`,
      [deliveryId, attempt + 1, status || null, error, ok]);
    if (ok) return;
    if (status === 410) {
      await this.db.query(`UPDATE client_webhooks SET disabled_at = now(), disabled_reason = '410 Gone' WHERE id = $1`, [d.webhook_id]);
      this.log.warn(`webhook ${d.webhook_id} disabled: 410 Gone`);
      return;
    }
    const delay = RETRY_DELAYS_S[attempt];
    if (delay === undefined) {
      await this.db.query(`UPDATE webhook_deliveries SET gave_up_at = now() WHERE id = $1`, [deliveryId]);
      this.log.warn(`webhook delivery ${deliveryId} given up after ${attempt + 1} attempts (${status || error})`);
      return;
    }
    await this.queue.add('deliver', { deliveryId, attempt: attempt + 1 }, { delay: delay * 1000, removeOnComplete: true, removeOnFail: true });
  }

  /** https, a public address (unless the deployer allows private ones), no credentials in the URL. */
  async checkUrl(url: string): Promise<void> {
    let u: URL;
    try { u = new URL(url); } catch { throw new Error('webhook url is not a URL'); }
    if (u.username || u.password) throw new Error('webhook url must not carry credentials');
    const allowPrivate = this.config.get('WEBHOOK_ALLOW_PRIVATE', { infer: true }) ?? false;
    if (u.protocol !== 'https:' && !(allowPrivate && u.protocol === 'http:')) throw new Error('webhook url must be https');
    if (allowPrivate) return;
    const host = u.hostname.replace(/^\[|\]$/g, '');
    const addresses = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
    if (!addresses.length || addresses.some(isPrivate)) throw new Error('webhook url must resolve to a public address');
  }
}

/** Loopback, link-local, private and unique-local ranges (SSRF). */
export function isPrivate(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number) as [number, number];
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const v6 = ip.toLowerCase();
  return v6 === '::1' || v6 === '::' || v6.startsWith('fe80') || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('::ffff:');
}
