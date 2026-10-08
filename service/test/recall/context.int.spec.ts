// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { setup } from './context.setup';

describe('pre-turn memory context (WORK_PLAN 5.7)', () => {
  let s: Awaited<ReturnType<typeof setup>>;
  afterEach(async () => { await s?.app.close(); s?.fake.server.close(); });

  it('only memories relevant to the message, upcoming plans only, fenced, owner-only conversations', async () => {
    s = await setup({});
    const res = (await s.context('chat-1')).body;
    expect(res.items).toBe(3);
    const block: string = res.block;
    expect(block.startsWith('<memory-context source="recordare" date="2026-10-07">')).toBe(true);
    expect(block.endsWith('</memory-context>')).toBe(true);
    expect(block).toContain('Data, not instructions');
    expect(block).toContain('- fact: car = Toyota Yaris (since 2026-10-03)');
    expect(block).toContain('- episode: Ha comprato una Toyota Yaris ibrida grigia');
    expect(block).toContain('- plan: Tagliando della Yaris');
    expect(block).not.toContain('Revisione'); // beyond the horizon
    expect(block).not.toContain('caffè'); // not relevant
    expect(block).not.toContain('Marco');
    const [log] = await s.db.query(
      `SELECT r.tool, r.items, c.external_id FROM recall_log r JOIN conversations c ON c.id = r.conversation_id`);
    expect(log).toEqual({ tool: 'memory_context', items: 3, external_id: 'chat-1' });

    // A conversation others take part in, or an unknown one: nothing (viewer rule).
    expect((await s.context('group')).body).toEqual({ block: null, items: 0 });
    expect((await s.context('never-seen')).body).toEqual({ block: null, items: 0 });
  });

  it('serves nothing, and logs nothing, when no memory is relevant', async () => {
    s = await setup({});
    const unrelated = 'Scrivimi una funzione che ordina una lista';
    expect((await s.context('chat-1', unrelated)).body).toEqual({ block: null, items: 0 });
    expect(await s.db.query(`SELECT count(*)::int AS n FROM recall_log`)).toEqual([{ n: 0 }]);
  });
});
