// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * M5 consolidation: digests carry the fingerprint of the sources they were written from (a day is rewritten only
 * when its visible episodes changed — zero LLM calls otherwise); owners remember when they were last consolidated.
 */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class Consolidation1790990000000 implements MigrationInterface {
  name = 'Consolidation1790990000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE digests ADD COLUMN source_hash text NOT NULL DEFAULT ''`);
    await q.query(`ALTER TABLE owners ADD COLUMN consolidated_at timestamptz`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE owners DROP COLUMN consolidated_at`);
    await q.query(`ALTER TABLE digests DROP COLUMN source_hash`);
  }
}
