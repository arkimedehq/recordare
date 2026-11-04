// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * The memory context never makes the host wait for a busy embedding server (CONTEXT_EMBEDDING_BUDGET_MS): past the
 * budget it serves the self card alone, at once; the late vectors still arrive and serve the same message next time.
 */
import { call } from '../helpers/app';
import { setup } from './context.setup';

const BUDGET_MS = 300;

describe('memory context: embedding budget', () => {
  let s: Awaited<ReturnType<typeof setup>>;
  beforeAll(async () => { s = await setup({ CONTEXT_EMBEDDING_BUDGET_MS: String(BUDGET_MS) }); });
  afterAll(async () => { await s?.app.close(); s?.fake.server.close(); });
  const ctx = (query: string) => call(s.url, 'POST', '/api/v1/context', {
    token: s.key, headers: { 'x-recordare-user': 'u1', 'x-recordare-conversation': 'chat-1', 'x-recordare-now': '2026-10-07T10:00:00+02:00' },
    body: { query },
  });

  it('past the budget, serves the self card only, without waiting; the late vectors serve the next ask', async () => {
    s.fake.delay = (input) => (input.includes(s.query) ? 1_500 : 0); // the server is busy with something long
    const t0 = Date.now();
    const late = await ctx(s.query);
    const ms = Date.now() - t0;
    expect(late.status).toBe(200);
    expect(ms).toBeLessThan(1_200); // budget + the card's queries, not the server's 1.5 s
    expect(late.body.block).toContain('- about me: car = Toyota Yaris (since 2026-10-03)');
    expect(late.body.block).toContain('Nothing else came to mind.');
    expect(late.body.block).not.toContain('- episode:');
    expect(late.body.items).toBe(2);

    // The late request completes and its vectors are kept: the same message is answered in full, with no new request.
    await new Promise((r) => setTimeout(r, 1_500));
    const before = s.fake.requests.length;
    const full = await ctx(s.query);
    expect(full.body.block).toContain('- episode: Ha comprato una Toyota Yaris ibrida grigia');
    expect(full.body.block).not.toContain('Nothing else came to mind.');
    expect(s.fake.requests.length).toBe(before);
    s.fake.delay = () => 0;
  });

  it('within the budget, nothing changes (a sentence already embedded comes from the cache, the others in one request)', async () => {
    s.fake.delay = () => 100;
    const before = s.fake.requests.length;
    const res = await ctx(`Dimmi una cosa. ${s.query}`);
    expect(res.body.block).toContain('- episode: Ha comprato una Toyota Yaris ibrida grigia');
    expect(s.fake.requests.slice(before)).toEqual([[`Dimmi una cosa. ${s.query}`, 'Dimmi una cosa.']]);
    s.fake.delay = () => 0;
  });
});
