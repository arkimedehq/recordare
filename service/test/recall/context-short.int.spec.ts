// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/** D54: the memory charter, and a short follow-up matched with the person's previous turn. */
import { call, fakeVector } from '../helpers/app';
import { CHARTER, CHARTER_VERSION } from '../../src/recall/charter';
import { setup } from './context.setup';

const PREVIOUS = 'Ti ricordi Paolo, il fratello di Giulia?';
const FOLLOW_UP = 'e lui?';
const cos = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * (b[i] as number), 0);

describe('memory-first contract (D54)', () => {
  let s: Awaited<ReturnType<typeof setup>>;
  beforeAll(async () => { s = await setup({ CONTEXT_SHORT_QUERY_WORDS: '4' }); });
  afterAll(async () => { await s?.app.close(); s?.fake.server.close(); });
  const as = (conversation: string) => ({ token: s.key, headers: { 'x-recordare-user': 'u1', 'x-recordare-conversation': conversation,
    'x-recordare-now': '2026-10-07T10:00:00+02:00' } });

  it('serves the charter, the same for every memory, with its version', async () => {
    const res = await call(s.url, 'GET', '/api/v1/charter', { token: s.key });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ charter: CHARTER, version: CHARTER_VERSION });
    expect((await call(s.url, 'GET', '/api/v1/charter', {})).status).toBe(401);
  });

  it('matches a short follow-up with the turn before it in the same conversation, not elsewhere', async () => {
    // An episode that only the previous turn joined with the follow-up points to (fake vectors are a hash of the text).
    const target = fakeVector(`${PREVIOUS}\n${FOLLOW_UP}`);
    expect(cos(target, fakeVector(FOLLOW_UP))).toBeLessThan(0.55); // the follow-up alone does not find it
    await s.db.query(`INSERT INTO episodes (memory_id, kind, content, occurred_at, date_precision, origin, author_role, stance, confidence, disclosure, audience, embedding)
      VALUES ($1, 'event', 'Paolo ha cambiato lavoro', '2026-10-01', 'day', 'holder_lived', 'holder', 'stated', 1, 'holder', ARRAY[$1::uuid], $2)`,
      [s.memoryId, `[${target.join(',')}]`]);
    const turn = (conversation: string, id: string, content: string, sentAt: string) => call(s.url, 'POST', '/api/v1/ingest/messages', {
      token: s.key, headers: { 'x-recordare-user': 'u1' },
      body: { conversation: { externalId: conversation }, messages: [{ externalId: id, role: 'user', content, sentAt }] } });
    await turn('talk', 't1', PREVIOUS, '2026-10-07T09:58:00+02:00');
    const ask = (conversation: string) => call(s.url, 'POST', '/api/v1/context', { ...as(conversation), body: { query: FOLLOW_UP, card: false } });

    expect((await ask('talk')).body.block).toContain('Paolo ha cambiato lavoro');
    // The current turn already ingested is not its own previous turn.
    await turn('talk', 't2', FOLLOW_UP, '2026-10-07T09:59:00+02:00');
    expect((await ask('talk')).body.block).toContain('Paolo ha cambiato lavoro');
    // Another conversation's turn is not this one's.
    expect((await ask('chat-1')).body.block ?? '').not.toContain('Paolo ha cambiato lavoro');
  });
});
