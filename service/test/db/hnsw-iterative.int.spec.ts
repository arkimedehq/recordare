// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * WORK_PLAN 4.14: every session scans HNSW indexes iteratively, so a vector search filtered by memory returns the rows
 * asked for even when other memories fill the index (pgvector ≥ 0.8).
 */
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../../src/db/data-source-options';
import { resetSchema, testEnv } from '../helpers/app';

describe('HNSW iterative scan (WORK_PLAN 4.14)', () => {
  let db: DataSource;

  beforeAll(async () => {
    testEnv();
    await resetSchema();
    db = new DataSource(dataSourceOptions(process.env['DATABASE_URL'] as string));
    await db.initialize();
  });
  afterAll(async () => { await db?.destroy(); });

  it('returns the asked rows of a small memory among a large one', async () => {
    const q = db.createQueryRunner();
    await q.connect();
    try {
      await q.query(`CREATE TEMP TABLE hnsw_probe (memory int NOT NULL, v vector(8) NOT NULL)`);
      // One memory holds 0.5 % of 20,000 rows: hnsw.ef_search (40) candidates of the whole index hold few of them.
      await q.query(`SELECT setseed(0.42)`);
      await q.query(`INSERT INTO hnsw_probe SELECT CASE WHEN i % 200 = 0 THEN 1 ELSE 2 END,
        ARRAY(SELECT random() FROM generate_series(1, 8 + i * 0))::vector FROM generate_series(1, 20000) i`);
      await q.query(`CREATE INDEX ON hnsw_probe USING hnsw (v vector_cosine_ops)`);
      await q.query(`ANALYZE hnsw_probe`);
      await q.query(`SET enable_seqscan = off`);
      const top10 = async () => (await q.query(
        `SELECT count(*)::int AS n FROM (SELECT 1 FROM hnsw_probe WHERE memory = 1 ORDER BY v <=> '[0.5,0.4,0.3,0.2,0.1,0.2,0.3,0.4]' LIMIT 10) s`))[0].n;
      expect((await q.query(`SHOW hnsw.iterative_scan`))[0]).toEqual({ 'hnsw.iterative_scan': 'strict_order' });
      expect(await top10()).toBe(10);
      await q.query(`SET hnsw.iterative_scan = off`);
      expect(await top10()).toBeLessThan(10);
    } finally {
      await q.release();
    }
  });
});
