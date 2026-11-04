// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/** Interactive embeddings never wait for background ones (PrioritizedEmbeddings), and the memory context's budget. */
import { type EmbeddingKind, type EmbeddingPort } from '../../src/embedding/embedding.port';
import { batches, PrioritizedEmbeddings } from '../../src/embedding/prioritized-embeddings';
import { withinBudget } from '../../src/recall/context.service';

/** A serial server stand-in: every call is recorded and answered when the test says so. */
class ManualServer implements EmbeddingPort {
  readonly model = 'm';
  readonly dim = 1;
  readonly calls: Array<{ texts: string[]; kind: EmbeddingKind; answer: () => void; fail: (e: Error) => void }> = [];
  auto = false;
  embed(texts: string[], kind: EmbeddingKind): Promise<number[][]> {
    return new Promise((resolve, reject) => {
      const answer = () => resolve(texts.map((t) => [t.length]));
      this.calls.push({ texts, kind, answer, fail: reject });
      if (this.auto) answer();
    });
  }
  sent(): string[][] { return this.calls.map((c) => c.texts); }
}

const tick = () => vi.advanceTimersByTimeAsync(0);

describe('PrioritizedEmbeddings', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('sends a query at once while background work waits for a pause in the conversation', async () => {
    const server = new ManualServer();
    const e = new PrioritizedEmbeddings(server, { quietMs: 1_000, maxHoldMs: 60_000 });
    const q = e.embed(['who lives here?'], 'query', { priority: 'interactive' });
    await tick();
    expect(server.sent()).toEqual([['who lives here?']]);
    const bg = e.embed(['a long tool output'], 'document');
    server.calls[0]?.answer();
    expect(await q).toEqual([[15]]);
    await vi.advanceTimersByTimeAsync(999);
    expect(server.calls).toHaveLength(1); // still within the pause after the query
    // Another query in the pause: sent at once, and the pause starts again.
    const q2 = e.embed(['and in Japan?'], 'query', { priority: 'interactive' });
    await tick();
    expect(server.calls[1]?.texts).toEqual(['and in Japan?']);
    server.calls[1]?.answer();
    await q2;
    await vi.advanceTimersByTimeAsync(999);
    expect(server.calls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(server.calls[2]).toMatchObject({ texts: ['a long tool output'], kind: 'document' });
    server.calls[2]?.answer();
    expect(await bg).toEqual([[18]]);
  });

  it('starts background work at once when nothing interactive happened, and never during an interactive request', async () => {
    const server = new ManualServer();
    const e = new PrioritizedEmbeddings(server, { quietMs: 0, batchChars: 10 });
    const bg = e.embed(['aaaa', 'bbbb', 'cccc'], 'document');
    await tick();
    expect(server.sent()).toEqual([['aaaa', 'bbbb']]); // 10 characters per request
    const q = e.embed(['q'], 'query', { priority: 'interactive' });
    await tick();
    expect(server.sent()[1]).toEqual(['q']); // not queued behind the background batch
    server.calls[0]?.answer(); // first batch done, the query still in flight: the next batch waits
    await vi.advanceTimersByTimeAsync(5_000);
    expect(server.calls).toHaveLength(2);
    server.calls[1]?.answer();
    await q;
    await tick();
    expect(server.sent()[2]).toEqual(['cccc']);
    server.calls[2]?.answer();
    expect(await bg).toEqual([[4], [4], [4]]); // in order, across batches
  });

  it('runs background requests one at a time, in order; a failed one fails alone', async () => {
    const server = new ManualServer();
    const e = new PrioritizedEmbeddings(server, { quietMs: 0 });
    const a = e.embed(['a'], 'document');
    const b = e.embed(['bb'], 'query'); // a background query (e.g. an extraction's window topic) is still background
    await tick();
    expect(server.sent()).toEqual([['a']]);
    server.calls[0]?.fail(new Error('server down'));
    await expect(a).rejects.toThrow('server down');
    await tick();
    expect(server.calls[1]).toMatchObject({ texts: ['bb'], kind: 'query' });
    server.calls[1]?.answer();
    expect(await b).toEqual([[2]]);
  });

  it('starts background work anyway once it waited the longest hold (constant traffic)', async () => {
    const server = new ManualServer();
    server.auto = true;
    const e = new PrioritizedEmbeddings(server, { quietMs: 1_000, maxHoldMs: 5_000 });
    await e.embed(['first'], 'query', { priority: 'interactive' });
    const bg = e.embed(['doc'], 'document');
    for (let t = 0; t < 4_500; t += 500) { // 4.5 s of queries, 500 ms apart
      await e.embed([`q${t}`], 'query', { priority: 'interactive' });
      await vi.advanceTimersByTimeAsync(500);
    }
    expect(server.sent().flat()).not.toContain('doc');
    await vi.advanceTimersByTimeAsync(500); // 5 s since it was asked
    expect(await bg).toEqual([[3]]);
  });

  it('stops waiting for a pause at shutdown', async () => {
    const server = new ManualServer();
    server.auto = true;
    const e = new PrioritizedEmbeddings(server, { quietMs: 60_000 });
    await e.embed(['q'], 'query', { priority: 'interactive' });
    const bg = e.embed(['doc'], 'document');
    await vi.advanceTimersByTimeAsync(1_000);
    expect(server.calls).toHaveLength(1);
    e.onModuleDestroy();
    expect(await bg).toEqual([[3]]);
  });

  it('answers a repeated query from the cache and shares a request already in flight; a failure is not kept', async () => {
    const server = new ManualServer();
    const e = new PrioritizedEmbeddings(server, { cacheSize: 2 });
    const one = e.embed(['x', 'yy'], 'query', { priority: 'interactive' });
    const two = e.embed(['yy', 'zzz', 'zzz'], 'query', { priority: 'interactive' });
    await tick();
    expect(server.sent()).toEqual([['x', 'yy'], ['zzz']]); // yy shared, zzz once
    server.calls[0]?.answer();
    server.calls[1]?.answer();
    expect(await one).toEqual([[1], [2]]);
    expect(await two).toEqual([[2], [3], [3]]);
    expect(await e.embed(['zzz', 'yy'], 'query', { priority: 'interactive' })).toEqual([[3], [2]]);
    expect(server.calls).toHaveLength(2);
    // Least recently used goes first (size 2: x is gone).
    const again = e.embed(['x'], 'query', { priority: 'interactive' });
    await tick();
    expect(server.calls[2]?.texts).toEqual(['x']);
    server.calls[2]?.fail(new Error('boom'));
    await expect(again).rejects.toThrow('boom');
    const retry = e.embed(['x'], 'query', { priority: 'interactive' });
    await tick();
    expect(server.calls).toHaveLength(4);
    server.calls[3]?.answer();
    expect(await retry).toEqual([[1]]);
    // Documents are never cached, even when interactive (remember): every text goes to the server.
    server.auto = true;
    await e.embed(['note'], 'document', { priority: 'interactive' });
    await e.embed(['note'], 'document', { priority: 'interactive' });
    expect(server.calls).toHaveLength(6);
  });
});

describe('batches', () => {
  it('groups consecutive texts by characters and count; a longer text goes alone', () => {
    expect(batches(['aa', 'bb', 'cc'], 4, 64)).toEqual([['aa', 'bb'], ['cc']]);
    expect(batches(['a', 'long text', 'b'], 4, 64)).toEqual([['a'], ['long text'], ['b']]);
    expect(batches(['a', 'b', 'c'], 100, 2)).toEqual([['a', 'b'], ['c']]);
    expect(batches([], 4, 64)).toEqual([]);
  });
});

describe('withinBudget', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('gives the value in time, null past the budget, and waits without limit at 0', async () => {
    const slow = (ms: number, v: string) => new Promise<string>((r) => setTimeout(() => r(v), ms));
    const fast = withinBudget(slow(100, 'v'), 1_000);
    await vi.advanceTimersByTimeAsync(100);
    expect(await fast).toBe('v');
    const late = withinBudget(slow(2_000, 'v'), 1_000);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(await late).toBeNull();
    const unlimited = withinBudget(slow(5_000, 'v'), 0);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(await unlimited).toBe('v');
  });

  it('drops a failure that comes after the budget (no unhandled rejection), and passes one within it', async () => {
    const failing = (ms: number) => new Promise<string>((_, j) => setTimeout(() => j(new Error('down')), ms));
    const late = withinBudget(failing(2_000), 1_000);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(await late).toBeNull();
    const early = withinBudget(failing(10), 1_000);
    const caught = expect(early).rejects.toThrow('down');
    await vi.advanceTimersByTimeAsync(10);
    await caught;
  });
});
