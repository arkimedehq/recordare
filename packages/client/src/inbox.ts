// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * The initiatives inbox (D55): what every host does to deliver the memory's initiatives, done once here — the host only
 * says how it delivers one. Three ways in, deduplicated together:
 *   - `handleWebhook(rawBody, headers)`: a Standard Webhooks delivery, verified (`verifyWebhook`), a `webhook-id` seen
 *     again ignored; `initiative.deliver` is delivered, the other events are information;
 *   - `presence(user, impulse)`: a presence impulse; what Recordare answers with is delivered now;
 *   - `catchUp()` (or `start(intervalMs)`): the feed, from a cursor per user, catching up on what was pushed recently on
 *     the host's channels and not delivered yet.
 * The host's `deliver(user, initiative, how)` speaks it (a chat message, speech, a notification…) on the first of
 * `initiative.channels` that reaches the person now (D55 §5b; `addressesOn` finds them on a channel) and returns the
 * outcome to report (`said`, `asked`, `done` when the host already had it — a reminder it scheduled itself —, `declined`,
 * `failed`) — with the channel it used, `{outcome, channel}` —, or null to report nothing. Each initiative is handed to
 * `deliver` once (`seen`: in memory by default, or the host's own durable store). Look-ups and actions go to `deliver`
 * only when `kinds` asks for them.
 * When others are in the room (§5c) a presence answer carries an `opening`: it goes to `open`, never to `deliver` (the
 * initiative stays pending, and the person's "yes" in their next turn gets it); without `open` nothing is said.
 */
import { type RecordareClient } from './client.js';
import {
  type DeliveryChannel, type Initiative, type InitiativeAddress, type InitiativeOutcome, type PresenceImpulse, type PresenceResult,
  type WebhookEvent,
} from './contract.js';
import { verifyWebhook, WebhookVerificationError, type WebhookHeaders } from './webhooks.js';

/** How an initiative reached the host: a webhook push, a presence answer, the feed. */
export interface DeliveryContext { via: 'webhook' | 'presence' | 'feed' }

/** What the host did with an initiative: the outcome, and the channel it reached the person on. */
export interface Delivered { outcome: InitiativeOutcome; channel: DeliveryChannel }

export interface InitiativeInboxOptions {
  client: RecordareClient;
  /**
   * Speaks one initiative to `user` (the client's own user id) on the first of its `channels` that reaches the person
   * now; returns the outcome to report (with the channel used, or the default below), or null for none.
   */
  deliver: (user: string, initiative: Initiative, how: DeliveryContext) => Promise<InitiativeOutcome | Delivered | null>;
  /** Says only the `opening` to the person in a room with others (§5c); the initiative itself stays pending. */
  open?: (user: string, initiative: Initiative, opening: string) => Promise<void>;
  /** The webhook endpoint's `whsec_` secret (for `handleWebhook`). */
  secret?: string;
  /** The users whose feed `catchUp` reads (the client's own ids). */
  users?: () => Promise<string[]> | string[];
  /** The channels this host delivers pushes on (`catchUp` skips the others); default: every channel. */
  channels?: string[];
  /** The kinds handed to `deliver`; default say and ask (look-ups and actions are for an agent's tools). */
  kinds?: Initiative['kind'][];
  /** `catchUp` delivers what was pushed at most this long ago (default a day: an older push is moot). */
  catchUpMs?: number;
  /** The channel reported with an outcome `deliver` gave without one; default the initiative's own (`turn` when it has none). */
  channel?: DeliveryChannel;
  /** Which initiatives were already handed over — the host's durable store, or an in-memory one by default. */
  seen?: { has(id: string): Promise<boolean> | boolean; add(id: string): Promise<void> | void };
  /** The feed cursor per user — the host's durable store, or in memory by default. */
  cursors?: { get(user: string): Promise<number | undefined> | number | undefined; set(user: string, seq: number): Promise<void> | void };
  /** Where problems are told (never thrown from the background work). */
  log?: (message: string) => void;
}

const DAY_MS = 86_400_000;
const DELIVERY_CHANNELS: readonly string[] = ['turn', 'chat', 'messaging', 'voice', 'panel'] satisfies DeliveryChannel[];

/** The ids of the person an initiative is for on one channel (their Telegram chat id, their Home Assistant person). */
export function addressesOn(initiative: Initiative, channel: string): string[] {
  return (initiative.for?.addresses ?? []).filter((a: InitiativeAddress) => a.channel === channel).map((a) => a.id);
}
/** How long a `webhook-id` is remembered (Recordare retries for a day and a half). */
const WEBHOOK_ID_TTL_MS = 2 * DAY_MS;

export class InitiativeInbox {
  private readonly seen: NonNullable<InitiativeInboxOptions['seen']>;
  private readonly cursors: NonNullable<InitiativeInboxOptions['cursors']>;
  private readonly webhookIds = new Map<string, number>();
  private readonly inFlight = new Set<string>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly opts: InitiativeInboxOptions) {
    const ids = new Set<string>();
    this.seen = opts.seen ?? { has: (id) => ids.has(id), add: (id) => { ids.add(id); } };
    const at = new Map<string, number>();
    this.cursors = opts.cursors ?? { get: (u) => at.get(u), set: (u, s) => { at.set(u, s); } };
  }

  /**
   * A webhook delivery: verified over the raw body (throws `WebhookVerificationError` → answer 401), then handled in the
   * background (answer 2xx at once). Returns the event, or null for a `webhook-id` already received.
   */
  handleWebhook(rawBody: string | Uint8Array, headers: WebhookHeaders, now = Date.now()): WebhookEvent | null {
    if (!this.opts.secret) throw new WebhookVerificationError('no webhook secret configured');
    const event = verifyWebhook(rawBody, headers, this.opts.secret);
    const key = Object.keys(headers).find((k) => k.toLowerCase() === 'webhook-id');
    const id = key ? String(Array.isArray(headers[key]) ? headers[key]![0] : headers[key]) : '';
    for (const [k, t] of this.webhookIds) if (now - t > WEBHOOK_ID_TTL_MS) this.webhookIds.delete(k);
    if (id && this.webhookIds.has(id)) return null;
    if (id) this.webhookIds.set(id, now);
    void this.receive(event);
    return event;
  }

  /** A verified event: `initiative.deliver` is delivered now; the other events are information. True when delivered. */
  async receive(event: WebhookEvent): Promise<boolean> {
    if (event.type !== 'initiative.deliver') return false;
    return this.dispatch(event.data.user, event.data, 'webhook');
  }

  /**
   * A presence impulse: Recordare may answer with something to say now, which is delivered — or, with others in the room,
   * only an opening, handed to `open` (`opened`).
   */
  async presence(user: string, impulse: PresenceImpulse): Promise<PresenceResult & { delivered: boolean; opened: boolean }> {
    const res = await this.opts.client.presence(user, impulse);
    if (res.initiative && res.opening) {
      const opened = this.opts.open
        ? await this.opts.open(user, res.initiative, res.opening).then(() => true, (err: Error) => {
          this.opts.log?.(`initiative ${res.initiative!.id} opening not said: ${err.message}`);
          return false;
        })
        : false;
      return { ...res, delivered: false, opened };
    }
    const delivered = res.initiative ? await this.dispatch(user, res.initiative, 'presence') : false;
    return { ...res, delivered, opened: false };
  }

  /** The feed: what was pushed on this host's channels recently and not delivered yet. Returns how many were delivered. */
  async catchUp(now = Date.now()): Promise<number> {
    const users = (await this.opts.users?.()) ?? [];
    const window = this.opts.catchUpMs ?? DAY_MS;
    let delivered = 0;
    for (const user of users) {
      try {
        for (let more = true; more;) {
          const page = await this.opts.client.initiatives(user, { since: (await this.cursors.get(user)) ?? 0, limit: 200 });
          await this.cursors.set(user, page.next);
          more = page.more;
          for (const i of page.items) {
            const pushed = i.pushedAt ? Date.parse(i.pushedAt) : 0;
            const onOurChannel = !this.opts.channels || (i.channel !== null && this.opts.channels.includes(i.channel));
            if (i.status === 'offered' && pushed && now - pushed < window && onOurChannel && (await this.dispatch(user, i, 'feed'))) delivered++;
          }
        }
      } catch (err) {
        this.opts.log?.(`initiatives feed failed for ${user}: ${(err as Error).message}`);
      }
    }
    return delivered;
  }

  /** `catchUp` now and every `intervalMs` (never two at once); `stop()` ends it. */
  start(intervalMs = 15 * 60_000): void {
    this.stop();
    let running = false;
    const tick = async () => {
      if (running) return;
      running = true;
      try { await this.catchUp(); } finally { running = false; }
    };
    void tick();
    this.timer = setInterval(() => void tick(), intervalMs);
    (this.timer as { unref?: () => void }).unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Hands one initiative to the host once, then reports what became of it. True when the host delivered it. */
  private async dispatch(user: string, i: Initiative, via: DeliveryContext['via']): Promise<boolean> {
    if (!(this.opts.kinds ?? ['say', 'ask']).includes(i.kind) || this.inFlight.has(i.id)) return false;
    this.inFlight.add(i.id);
    try {
      if (await this.seen.has(i.id)) return false;
      const result = await this.opts.deliver(user, i, { via });
      await this.seen.add(i.id);
      const outcome = typeof result === 'string' ? result : result?.outcome ?? null;
      if (outcome) {
        const channel = (typeof result === 'object' && result?.channel) || this.opts.channel || reported(i.channel);
        await this.opts.client.reportInitiative(user, i.id, outcome, { channel }).catch((err: Error) =>
          this.opts.log?.(`initiative ${i.id} outcome not reported: ${err.message}`));
      }
      return outcome === 'said' || outcome === 'asked';
    } catch (err) {
      this.opts.log?.(`initiative ${i.id} not delivered: ${(err as Error).message}`);
      return false;
    } finally {
      this.inFlight.delete(i.id);
    }
  }
}

/** An initiative's own channel as an outcome's: a camera presence was answered by voice; anything else unknown is the turn. */
function reported(channel: string | null): DeliveryChannel {
  if (channel === 'camera') return 'voice';
  return channel && DELIVERY_CHANNELS.includes(channel) ? (channel as DeliveryChannel) : 'turn';
}
