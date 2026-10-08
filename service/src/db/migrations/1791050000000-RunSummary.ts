// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * WORK_PLAN 4.12: every extraction run keeps a summary — what the model returned, what was written, what the code-side
 * rules dropped and why. Counts only, never text, so forgetting stays complete.
 */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class RunSummary1791050000000 implements MigrationInterface {
  name = 'RunSummary1791050000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE extraction_runs ADD COLUMN summary jsonb`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE extraction_runs DROP COLUMN summary`);
  }
}
