// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * The Recordare side of the proxy: before the answer one call stores the person's message and returns the memories
 * relevant to it as a `<memory-context>` block; the answer is sent after it. Never in the way of the chat: every call
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
/** A conversation with a captured answer, to end after it goes quiet (`END_IDLE_SECONDS`). */
interface Open { user: string; timer?: NodeJS.Timeout }

/** The stable id of the person's message: the platform's own, else a hash of conversation, text and position. */
export function userMessageId(turn: Turn): string {
  if (turn.identity.messageId) return `m:${turn.identity.messageId}`;
  return `u:${hash(`${turn.identity.conversation}\u0000${turn.ordinal}\u0000${turn.text}`)}`;
}

export class Memory {
  private readonly fast: RecordareClient;
  private readonly slow: RecordareClient;
  private readonly turns = new Map<string, TurnState>();
  private readonly open = new Map<string, Open>();
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
   * Before the answer: stores the person's message and gets the memory context in one call (each once per turn; a
   * repeated call reuses the block). Returns the block to inject, or null. Never throws.
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

    const req: IngestRequest | undefined = this.cfg.capture && !st.ingested
      ? { conversation: this.conversation(turn), messages: [this.userMessage(turn)] } : undefined;
    if (req) st.ingested = true;
    if (now < this.downUntil) {
      if (req) this.enqueue({ user: identity.user, req, attempts: 0 });
      return null;
    }
    const recall = this.cfg.recall;
    const user = this.headerUser(identity.user);
    const query = turn.text.slice(0, 4000);
    if (req && !recall) {
      try {
        await this.fast.ingest(user, req);
      } catch (err) {
        this.failed(err, 'ingest before the answer');
        this.enqueue({ user: identity.user, req, attempts: 1 }, err);
      }
      return null;
    }
    if (!recall) return null;
    try {
      const res = req ? await this.fast.contextWithTurn(user, req, query) : await this.fast.context(user, identity.conversation, query);
      st.block = res.block;
      return res.block;
    } catch (err) {
      this.failed(err, req ? 'storing the message with its memory context' : 'memory context');
      // Retried as a plain ingest (same id: stored once), which needs only the `ingest` scope.
      if (req) this.enqueue({ user: identity.user, req, attempts: 0 });
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
    this.scheduleEnd(conversation.externalId, turn.identity.user);
  }

  /** Tells Recordare the conversation ended (extraction now); waits while its messages are still in the retry queue. */
  async endConversation(conversationId: string): Promise<void> {
    const open = this.open.get(conversationId);
    if (!open) return;
    if (this.queue.some((p) => p.req.conversation.externalId === conversationId)) {
      this.scheduleEnd(conversationId, open.user);
      return;
    }
    this.cancelEnd(conversationId);
    this.open.delete(conversationId);
    try {
      await this.slow.endConversation(this.headerUser(open.user), conversationId);
    } catch (err) {
      this.failed(err, 'end of the conversation'); // Recordare's own idle delay ends it anyway
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    for (const o of this.open.values()) if (o.timer) clearTimeout(o.timer);
    const pending = this.queue.splice(0);
    await Promise.race([
      Promise.all(pending.map((p) => this.slow.ingest(this.headerUser(p.user), p.req).catch(() => undefined))),
      new Promise((r) => setTimeout(r, 2000).unref()),
    ]);
    if (pending.length) this.log.warn(`recordare: shutdown with ${pending.length} batch(es) in the retry queue (last attempt made)`);
  }

  // ── Internals ──────────────────────────────────────────────────────────────────────────────────────────────────
  /** With a personal token the token is the memory: no user header. */
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
        // A platform user who is not the account holder: a participant Recordare links to a contact of the memory.
        ...(turn.identity.participant ? [{ ...turn.identity.participant, role: 'other' as const }] : []),
      ],
    };
  }

  /** The person's message: `user` for the account holder; `other` with its author for anyone else (kept as theirs). */
  private userMessage(turn: Turn): IngestMessage {
    const author = turn.identity.participant;
    return {
      externalId: userMessageId(turn), role: author ? 'other' : 'user', authorRef: author ? author.ref : 'owner',
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
    const open = this.open.get(conversationId);
    if (open?.timer) clearTimeout(open.timer);
    if (open) open.timer = undefined;
  }

  private scheduleEnd(id: string, user: string): void {
    if (this.cfg.endIdleSeconds <= 0 || this.stopped) return;
    this.cancelEnd(id);
    const open: Open = { user };
    put(this.open, id, open);
    open.timer = setTimeout(() => { void this.endConversation(id); }, this.cfg.endIdleSeconds * 1000);
    open.timer.unref?.();
  }
}
