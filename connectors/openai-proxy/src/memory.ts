// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * The Recordare side of the proxy: the person's message is sent before the answer, then the memories relevant to it
 * come back as a `<memory-context>` block; the answer is sent after it. Never in the way of the chat: every call
 * before the answer is time-boxed, a Recordare outage turns the proxy into a pass-through for a while, and messages that
 * could not be sent are retried in the background (in memory: lost on restart — README → Limits).
 */
import { createHash } from 'node:crypto';
import {
  afterFailure, clipUtf8, type DeliveryPolicy, type FetchLike, type IngestConversation, type IngestMessage, type IngestRequest,
  RecordareClient, RecordareUnavailableError,
} from '@arkimedehq/recordare-client';
import type { ProxyConfig } from './config.js';
import type { Identity } from './identity.js';

export interface Logger { info(msg: string): void; warn(msg: string): void }

/** One turn: whose, and the person's message. */
export interface Turn {
  identity: Identity;
  /** What the person wrote (cleaned). */
  text: string;
  /** How many user messages the request carries up to this one: tells two equal messages of one conversation apart. */
  ordinal: number;
  /** The model asked for (the assistant's display name). */
  model?: string;
}

const RETRY: DeliveryPolicy = { maxAttempts: 8, baseDelayMs: 2_000, maxDelayMs: 5 * 60_000 };
const MAX_QUEUE = 1000;
const MAX_TRACKED = 2000;
/** A repeated call of the same turn within this time (agent loop, regeneration) reuses what the first one did. */
const TURN_TTL_MS = 15 * 60_000;
/** After Recordare is unreachable, the calls before the answer are skipped for this long. */
const DOWN_FOR_MS = 30_000;
/** A person without consent is not asked for memories again for this long. */
const NO_CONSENT_FOR_MS = 60_000;

const hash = (s: string): string => createHash('sha256').update(s).digest('hex').slice(0, 24);
const errName = (err: unknown): string => (err instanceof Error ? err.message : 'error');

/** A Map that forgets its oldest entries past `max`. */
function put<K, V>(map: Map<K, V>, key: K, value: V, max = MAX_TRACKED): void {
  map.delete(key);
  map.set(key, value);
  while (map.size > max) map.delete(map.keys().next().value as K);
}

interface TurnState { at: number; ingested: boolean; block: string | null | undefined }
interface Pending { user: string; req: IngestRequest; attempts: number }
interface LastSent { user: string; conversation: IngestConversation; message: IngestMessage; timer?: NodeJS.Timeout }

/** The stable id of the person's message: the platform's own, else a hash of conversation, text and position. */
export function userMessageId(turn: Turn): string {
  if (turn.identity.messageId) return `m:${turn.identity.messageId}`;
  return `u:${hash(`${turn.identity.conversation}\u0000${turn.ordinal}\u0000${turn.text}`)}`;
}

export class Memory {
  private readonly fast: RecordareClient;
  private readonly slow: RecordareClient;
  private readonly turns = new Map<string, TurnState>();
  private readonly lastSent = new Map<string, LastSent>();
  private readonly noConsent = new Map<string, number>();
  private readonly queue: Pending[] = [];
  private timer: NodeJS.Timeout | undefined;
  private downUntil = 0;
  private stopped = false;

  constructor(private readonly cfg: ProxyConfig, private readonly log: Logger, fetchImpl?: FetchLike, private readonly now = () => Date.now()) {
    const base = { baseUrl: cfg.recordareUrl as string, apiKey: cfg.recordareApiKey as string, fetch: fetchImpl };
    this.fast = new RecordareClient({ ...base, timeoutMs: cfg.recallTimeoutMs });
    this.slow = new RecordareClient(base);
  }

  /** Messages waiting for a retry. */
  queued(): number {
    return this.queue.length;
  }

  /**
   * Before the answer: sends the person's message (once per turn), then asks the memory context (once per turn; a
   * repeated call reuses it). Returns the block to inject, or null. Never throws.
   */
  async beforeTurn(turn: Turn): Promise<string | null> {
    const { identity } = turn;
    const key = `${identity.conversation}\u0000${userMessageId(turn)}`;
    const now = this.now();
    const state = this.turns.get(key);
    const fresh = state && now - state.at < TURN_TTL_MS ? state : undefined;
    if (fresh && (fresh.block !== undefined || !this.cfg.recall)) return fresh.block ?? null;
    const st: TurnState = fresh ?? { at: now, ingested: false, block: undefined };
    put(this.turns, key, st);
    this.cancelEnd(identity.conversation);

    const down = now < this.downUntil;
    if (this.cfg.capture && !st.ingested) {
      const req: IngestRequest = { conversation: this.conversation(turn), messages: [this.userMessage(turn)] };
      st.ingested = true;
      if (down) {
        this.enqueue({ user: identity.user, req, attempts: 0 });
      } else {
        try {
          const res = await this.fast.ingest(this.headerUser(identity.user), req);
          if (!res.stored) put(this.noConsent, identity.user, now);
        } catch (err) {
          this.failed(err, 'ingest before the answer');
          this.enqueue({ user: identity.user, req, attempts: 1 }, err);
        }
      }
    }
    if (!this.cfg.recall || now < this.downUntil) return null;
    const refused = this.noConsent.get(identity.user);
    if (refused !== undefined && now - refused < NO_CONSENT_FOR_MS) return null;
    try {
      const res = await this.fast.context(this.headerUser(identity.user), identity.conversation, turn.text.slice(0, 4000));
      st.block = res.block;
      return res.block;
    } catch (err) {
      this.failed(err, 'memory context');
      return null;
    }
  }

  /** After the final answer: sends it in the background (an edit of the stored one when the turn is regenerated). */
  afterTurn(turn: Turn, answer: string): void {
    if (!this.cfg.capture || !answer.trim()) return;
    const conversation = this.conversation(turn);
    const message: IngestMessage = {
      externalId: `${userMessageId(turn)}:a`, role: 'assistant', authorRef: 'assistant',
      content: clipUtf8(answer), sentAt: new Date(this.now()).toISOString(), upsert: true,
    };
    void this.deliver({ user: turn.identity.user, req: { conversation, messages: [message] }, attempts: 0 });
    this.scheduleEnd({ user: turn.identity.user, conversation, message });
  }

  /** Tells Recordare the conversation ended (re-sending its last answer, same id: stored once). */
  async endConversation(conversationId: string): Promise<void> {
    const last = this.lastSent.get(conversationId);
    if (!last) return;
    this.cancelEnd(conversationId);
    this.lastSent.delete(conversationId);
    await this.deliver({ user: last.user, req: { conversation: last.conversation, messages: [last.message], hints: { conversationEnded: true } }, attempts: 0 });
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    for (const l of this.lastSent.values()) if (l.timer) clearTimeout(l.timer);
    const pending = this.queue.splice(0);
    await Promise.race([
      Promise.all(pending.map((p) => this.slow.ingest(this.headerUser(p.user), p.req).catch(() => undefined))),
      new Promise((r) => setTimeout(r, 2000).unref()),
    ]);
    if (pending.length) this.log.warn(`recordare: shutdown with ${pending.length} batch(es) in the retry queue (last attempt made)`);
  }

  // ── Internals ──────────────────────────────────────────────────────────────────────────────────────────────────
  /** With a personal token the token is the person: no user header. */
  private headerUser(user: string): string {
    return this.cfg.personal ? '' : user;
  }

  private conversation(turn: Turn): IngestConversation {
    return {
      externalId: turn.identity.conversation,
      source: 'chat',
      channel: `proxy:${turn.identity.platform}`,
      participants: [
        { ref: 'owner', role: 'owner' },
        { ref: 'assistant', role: 'assistant', displayName: turn.model || 'assistant' },
      ],
    };
  }

  private userMessage(turn: Turn): IngestMessage {
    return {
      externalId: userMessageId(turn), role: 'user', authorRef: 'owner',
      content: clipUtf8(turn.text), sentAt: new Date(this.now()).toISOString(),
    };
  }

  private failed(err: unknown, what: string): void {
    if (err instanceof RecordareUnavailableError) this.downUntil = this.now() + DOWN_FOR_MS;
    this.log.warn(`recordare: ${what} failed (${errName(err)})`);
  }

  private async deliver(p: Pending): Promise<void> {
    try {
      const res = await this.slow.ingest(this.headerUser(p.user), p.req);
      if (!res.stored) put(this.noConsent, p.user, this.now());
      if (res.conflicts.length) this.log.warn(`recordare: ${res.conflicts.length} message id(s) conflicted (kept the stored version)`);
    } catch (err) {
      p.attempts++;
      this.failed(err, 'ingest');
      this.enqueue(p, err);
    }
  }

  private enqueue(p: Pending, err: unknown = new RecordareUnavailableError('not sent yet')): void {
    const next = p.attempts === 0 ? { action: 'retry' as const, delayMs: RETRY.baseDelayMs } : afterFailure(err, p.attempts, RETRY);
    if (next.action === 'park') {
      this.log.warn(`recordare: dropped ${p.req.messages.length} message(s) after ${p.attempts} attempt(s) (${next.reason})`);
      return;
    }
    if (this.queue.length >= MAX_QUEUE) {
      this.queue.shift();
      this.log.warn('recordare: retry queue full, dropped the oldest batch');
    }
    this.queue.push(p);
    this.schedule(next.delayMs);
  }

  private schedule(delayMs: number): void {
    if (this.stopped || this.timer) return;
    this.timer = setTimeout(() => { this.timer = undefined; void this.flush(); }, delayMs);
    this.timer.unref?.();
  }

  private async flush(): Promise<void> {
    const batch = this.queue.splice(0);
    for (const p of batch) await this.deliver(p);
  }

  private cancelEnd(conversationId: string): void {
    const last = this.lastSent.get(conversationId);
    if (last?.timer) clearTimeout(last.timer);
    if (last) last.timer = undefined;
  }

  private scheduleEnd(last: LastSent): void {
    const id = last.conversation.externalId;
    this.cancelEnd(id);
    put(this.lastSent, id, last);
    if (this.cfg.endIdleSeconds <= 0 || this.stopped) return;
    last.timer = setTimeout(() => { void this.endConversation(id); }, this.cfg.endIdleSeconds * 1000);
    last.timer.unref?.();
  }
}
