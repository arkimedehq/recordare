// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Interactive embeddings never wait for background ones. Many embedding servers compute one request at a time (a CPU
 * sentence-transformers server, e.g. Arkimede's, runs the model inside its request handler): a batch of long documents
 * then holds every query sent after it — measured on a small home server (i3-1215U, bge-m3 on CPU): one short query
 * ≈ 100 ms, a 3-text batch with a 4 000-character tool output ≈ 5 s, so the memory context of the next turn missed the
 * host's 2.5 s timeout. This wrapper, around any EmbeddingPort:
 * - sends interactive requests at once, and answers repeated queries from a small LRU cache (the recall tools of one
 *   turn often embed the same query in parallel: one request is shared);
 * - runs background requests one at a time, in order, in batches of at most `batchChars` characters (a long text alone),
 *   each started only when no interactive request is in flight and none happened in the last `quietMs` (a conversation
 *   asks again within seconds: background work waits for a pause in it) — or once the request has waited `maxHoldMs`,
 *   so background work always progresses under constant traffic.
 * A text already being computed by the server cannot be interrupted: the longest wait left for a query is one
 * background batch, which the memory context bounds with its own budget (CONTEXT_EMBEDDING_BUDGET_MS).
 */
import { type OnModuleDestroy } from '@nestjs/common';
import { type EmbedOptions, type EmbeddingKind, type EmbeddingPort } from './embedding.port';

export interface PrioritizedEmbeddingsOptions {
  /** Characters per background request (at least one text per request). */
  batchChars: number;
  /** Texts per background request. */
  batchTexts: number;
  /** A background request starts only this long after the last interactive one (0: as soon as none is in flight). */
  quietMs: number;
  /** A background request waiting this long starts anyway. */
  maxHoldMs: number;
  /** Query vectors kept for repeated texts (0: no cache). */
  cacheSize: number;
}

/** Defaults sized for a small CPU host (docs/KNOBS.md). */
export const EMBEDDING_SCHEDULING_DEFAULTS: PrioritizedEmbeddingsOptions = {
  batchChars: 2_000, batchTexts: 64, quietMs: 10_000, maxHoldMs: 60_000, cacheSize: 512,
};

interface BackgroundJob {
  texts: string[];
  kind: EmbeddingKind;
  enqueuedAt: number;
  resolve: (v: number[][]) => void;
  reject: (e: unknown) => void;
}

export class PrioritizedEmbeddings implements EmbeddingPort, OnModuleDestroy {
  readonly model: string;
  readonly dim: number;
  private readonly opts: PrioritizedEmbeddingsOptions;
  private interactive = 0;
  private lastInteractive = Number.NEGATIVE_INFINITY;
  private readonly queue: BackgroundJob[] = [];
  private pumping = false;
  private closing = false;
  /** Resolved when an interactive request ends or the service shuts down: a waiting background request looks again. */
  private wake: (() => void) | null = null;
  /** LRU of query vectors (Map keeps insertion order: the first key is the least recently used). */
  private readonly cache = new Map<string, number[]>();
  private readonly pending = new Map<string, Promise<number[]>>();

  constructor(private readonly inner: EmbeddingPort, opts: Partial<PrioritizedEmbeddingsOptions> = {}) {
    this.model = inner.model;
    this.dim = inner.dim;
    this.opts = { ...EMBEDDING_SCHEDULING_DEFAULTS, ...opts };
  }

  embed(texts: string[], kind: EmbeddingKind, opts: EmbedOptions = {}): Promise<number[][]> {
    if (texts.length === 0) return Promise.resolve([]);
    return opts.priority === 'interactive' ? this.now(texts, kind) : this.later(texts, kind);
  }

  /** Shutdown: background requests stop waiting for a pause (queue workers are draining). */
  onModuleDestroy(): void {
    this.closing = true;
    this.notify();
  }

  private async now(texts: string[], kind: EmbeddingKind): Promise<number[][]> {
    this.interactive++;
    try {
      return kind === 'query' && this.opts.cacheSize > 0 ? await this.cachedQueries(texts) : await this.inner.embed(texts, kind);
    } finally {
      this.interactive--;
      this.lastInteractive = Date.now();
      this.notify();
    }
  }

  /** Each text from the cache, from a request already in flight, or from one new request for all the others. */
  private async cachedQueries(texts: string[]): Promise<number[][]> {
    const missing = [...new Set(texts.filter((t) => !this.cache.has(t) && !this.pending.has(t)))];
    if (missing.length) {
      const request = this.inner.embed(missing, 'query', { priority: 'interactive' });
      missing.forEach((t, i) => {
        const one = request.then((v) => {
          const vector = v[i];
          if (!vector) throw new Error('embedding server returned fewer vectors than texts');
          this.remember(t, vector);
          return vector;
        });
        one.catch(() => undefined).finally(() => this.pending.delete(t));
        this.pending.set(t, one);
      });
    }
    return Promise.all(texts.map((t) => {
      const hit = this.cache.get(t);
      if (hit) {
        this.cache.delete(t); // most recently used again
        this.cache.set(t, hit);
        return hit;
      }
      return this.pending.get(t) as Promise<number[]>;
    }));
  }

  private remember(text: string, vector: number[]): void {
    this.cache.delete(text);
    this.cache.set(text, vector);
    while (this.cache.size > this.opts.cacheSize) this.cache.delete(this.cache.keys().next().value as string);
  }

  private later(texts: string[], kind: EmbeddingKind): Promise<number[][]> {
    return new Promise((resolve, reject) => {
      this.queue.push({ texts, kind, enqueuedAt: Date.now(), resolve, reject });
      void this.pump();
    });
  }

  /** Background jobs one at a time, in order; each batch waits for its turn. */
  private async pump(): Promise<void> {
    if (this.pumping) return;
    this.pumping = true;
    try {
      for (let job = this.queue[0]; job; job = this.queue[0]) {
        try {
          const out: number[][] = [];
          for (const batch of batches(job.texts, this.opts.batchChars, this.opts.batchTexts)) {
            await this.turn(job.enqueuedAt);
            out.push(...await this.inner.embed(batch, job.kind, { priority: 'background' }));
          }
          job.resolve(out);
        } catch (err) {
          job.reject(err);
        }
        this.queue.shift();
      }
    } finally {
      this.pumping = false;
    }
  }

  /** Resolves when a background batch may start: no interactive request in flight, a pause after the last one. */
  private async turn(enqueuedAt: number): Promise<void> {
    for (;;) {
      const t = Date.now();
      const holdLeft = enqueuedAt + this.opts.maxHoldMs - t;
      if (this.closing || holdLeft <= 0) return;
      const quietLeft = this.interactive > 0 ? holdLeft : this.lastInteractive + this.opts.quietMs - t;
      if (quietLeft <= 0) return;
      await this.sleep(Math.min(quietLeft, holdLeft));
    }
  }

  /** Waits `ms`, or less when an interactive request ends (the pause is then measured again). One waiter at a time. */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.wake = null;
        resolve();
      }, ms);
      this.wake = () => {
        clearTimeout(timer);
        resolve();
      };
    });
  }

  private notify(): void {
    const wake = this.wake;
    this.wake = null;
    wake?.();
  }
}

/** Consecutive texts grouped up to `maxChars` characters and `maxTexts` texts per group; a longer text goes alone. */
export function batches(texts: string[], maxChars: number, maxTexts: number): string[][] {
  const out: string[][] = [];
  let current: string[] = [];
  let size = 0;
  for (const t of texts) {
    if (current.length && (size + t.length > maxChars || current.length >= maxTexts)) {
      out.push(current);
      current = [];
      size = 0;
    }
    current.push(t);
    size += t.length;
  }
  if (current.length) out.push(current);
  return out;
}
