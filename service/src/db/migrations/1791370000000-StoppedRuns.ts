// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * A procedure run left halfway (WORK_PLAN 8.16 F2): outcome `stopped` — the person gave up or changed their mind; it
 * counts as a run, confirms nothing and marks no step as failed.
 */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class StoppedRuns1791370000000 implements MigrationInterface {
  name = 'StoppedRuns1791370000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE procedure_runs DROP CONSTRAINT procedure_runs_outcome_check`);
    await q.query(`ALTER TABLE procedure_runs ADD CONSTRAINT procedure_runs_outcome_check CHECK (outcome IN ('done', 'failed', 'stopped', 'corrected'))`);
    await q.query(`CREATE INDEX procedure_runs_conversation_idx ON procedure_runs(procedure_id, conversation_id, at) WHERE conversation_id IS NOT NULL`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX procedure_runs_conversation_idx`);
    await q.query(`DELETE FROM procedure_runs WHERE outcome = 'stopped'`);
    await q.query(`ALTER TABLE procedure_runs DROP CONSTRAINT procedure_runs_outcome_check`);
    await q.query(`ALTER TABLE procedure_runs ADD CONSTRAINT procedure_runs_outcome_check CHECK (outcome IN ('done', 'failed', 'corrected'))`);
  }
}
