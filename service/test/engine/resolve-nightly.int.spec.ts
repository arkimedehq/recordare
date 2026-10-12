// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { type INestApplication } from '@nestjs/common';
import { type Server } from 'node:http';
import { DataSource } from 'typeorm';
import { ConsolidationService } from '../../src/engine/consolidation.service';
import { ADMIN_KEY, call, resetSchema, startApp, startFakeEmbeddings, startFakeLlm, testEnv } from '../helpers/app';

describe('nightly near-duplicate pass: only the pairs no check could see (WORK_PLAN 5.3)', () => {
  let app: INestApplication;
  let emb: Server;
  let llm: Awaited<ReturnType<typeof startFakeLlm>>;
  let db: DataSource;
  let memoryId: string;
  // Today in the memory's time zone: no complete day to write a diary for, so the only LLM call is the resolver's.
  const NOW = new Date('2026-10-12T20:00:00Z');

  /** An episode recorded at `recorded` and last checked at `resolved` (null: never checked, e.g. log_episode). */
  async function episode(content: string, recorded: string, resolved: string | null, run: string | null = null): Promise<string> {
    const [r] = await db.query(
      `INSERT INTO episodes (memory_id, kind, content, origin, author_role, stance, audience, occurred_at, date_precision, recorded_at, resolved_at, extraction_run_id)
       VALUES ($1, 'event', $2, 'holder_lived', 'holder', 'stated', ARRAY[$1::uuid], '2026-10-12T08:00:00Z', 'day', $3, $4, $5) RETURNING id`,
      [memoryId, content, recorded, resolved, run]);
    return r.id as string;
  }
  const hidden = async (id: string) => (await db.query(`SELECT duplicate_of FROM episodes WHERE id = $1`, [id]))[0].duplicate_of as string | null;

  beforeAll(async () => {
    llm = await startFakeLlm();
    const fake = await startFakeEmbeddings();
    emb = fake.server;
    testEnv({ EMBEDDING_BASE_URL: fake.url, LLM_BASE_URL: llm.url, PATTERNS: 'false' }); // the pattern pass is tested on its own
    await resetSchema();
    let url: string;
    ({ app, url } = await startApp());
    db = app.get(DataSource);
    memoryId = (await call(url, 'POST', '/api/v1/admin/memories', { token: ADMIN_KEY, body: { displayName: 'Luca' } })).body.personId;
  });
  afterAll(async () => { await app?.close(); llm?.server.close(); emb?.close(); });

  it('asks about tellings from extractions that ran at the same time or were never checked, once', async () => {
    const [{ id: runA }] = await db.query(`INSERT INTO extraction_runs (memory_id, kind, model, provider, prompt_version) VALUES ($1, 'extraction', 'test', 'test', 'test') RETURNING id`, [memoryId]);
    const [{ id: runB }] = await db.query(`INSERT INTO extraction_runs (memory_id, kind, model, provider, prompt_version) VALUES ($1, 'extraction', 'test', 'test', 'test') RETURNING id`, [memoryId]);
    // Two conversations extracted at the same time: neither check saw the other's episode.
    const telegram = await episode('Sono andato al mare a Rimini con Giulia', '2026-10-12T18:00:00Z', '2026-10-12T18:00:05Z', runA);
    const web = await episode('Sono andato al mare a Rimini con Giulia', '2026-10-12T18:00:02Z', '2026-10-12T18:00:06Z', runB);
    // Checked an hour after the other was written: that check saw it (and judged them distinct) — not asked again.
    await episode('Ho corso al parco con Marco', '2026-10-12T15:00:00Z', '2026-10-12T15:00:05Z');
    await episode('Ho corso al parco con Marco', '2026-10-12T16:00:00Z', '2026-10-12T16:00:05Z');
    // log_episode: never checked; it pairs with an old episode it was never compared with.
    const old = await episode('Cena da Aldina con i miei genitori', '2026-10-12T09:00:00Z', '2026-10-12T09:00:05Z');
    const logged = await episode('Cena da Aldina con i miei genitori', '2026-10-12T19:00:00Z', null);

    llm.queue.push({ decisions: [{ pair: 1, relation: 'duplicate', keep: 'EXISTING' }, { pair: 2, relation: 'duplicate', keep: 'EXISTING' }] });
    const before = llm.requests.length;
    const report = await app.get(ConsolidationService).consolidateMemory(memoryId, NOW);
    expect(llm.requests.length - before).toBe(1);
    const asked = llm.requests.at(-1)?.messages[1]?.content ?? '';
    expect(asked.match(/^PAIR \d+/gm)).toEqual(['PAIR 1', 'PAIR 2']);
    expect(asked).toContain('Rimini');
    expect(asked).toContain('Aldina');
    expect(asked).not.toContain('parco');
    expect(report).toMatchObject({ duplicates: 2, llmCalls: 1 });
    expect([await hidden(telegram), await hidden(web)].filter(Boolean)).toHaveLength(1);
    expect(await hidden(logged)).toBe(old);

    // Everything is checked now: the next night asks nothing.
    await db.query(`UPDATE memories SET consolidated_at = NULL WHERE person_id = $1`, [memoryId]);
    const next = await app.get(ConsolidationService).consolidateMemory(memoryId, new Date(NOW.getTime() + 3600_000));
    expect(next).toMatchObject({ duplicates: 0, llmCalls: 0 });
  });
});
