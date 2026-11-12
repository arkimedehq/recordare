// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Initiatives from learned knowledge and the learning loop (WORK_PLAN 8.16 F3, D57):
 * - intent `learned`: something read that touches a known life and is still ahead ("a bus strike tomorrow"), said with its
 *   source and date when the source is trusted (and the memory past its first stage), else asked as a question;
 * - intent `check`: something read and still pending, asked of a household member — a contradiction with what the memory
 *   holds, or knowledge of the place to confirm;
 * - intent `step`: a step of a procedure that failed in a run, asked how it is done here;
 * - `intents.source` (who brought it: a site, a tool), `intents.trusted` (said, not asked), `intents.procedure_run_id`.
 */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class LearnedInitiatives1791360000000 implements MigrationInterface {
  name = 'LearnedInitiatives1791360000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TYPE intent_kind ADD VALUE IF NOT EXISTS 'learned'`);
    await q.query(`ALTER TYPE intent_kind ADD VALUE IF NOT EXISTS 'check'`);
    await q.query(`ALTER TYPE intent_kind ADD VALUE IF NOT EXISTS 'step'`);
    await q.query(`ALTER TABLE intents ADD COLUMN source text, ADD COLUMN trusted boolean NOT NULL DEFAULT false,
      ADD COLUMN procedure_run_id uuid REFERENCES procedure_runs(id) ON DELETE CASCADE`);
    await q.query(`CREATE UNIQUE INDEX intents_run_kind_uq ON intents(procedure_run_id, kind) WHERE procedure_run_id IS NOT NULL`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`UPDATE intents SET status = 'cancelled' WHERE kind::text IN ('learned', 'check', 'step') AND status IN ('armed', 'fired')`);
    await q.query(`DROP INDEX IF EXISTS intents_run_kind_uq`);
    await q.query(`ALTER TABLE intents DROP COLUMN procedure_run_id, DROP COLUMN trusted, DROP COLUMN source`);
    // Enum values cannot be dropped in place; they stay in the type, unused.
  }
}
