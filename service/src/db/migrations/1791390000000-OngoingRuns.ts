// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * A procedure run still going (WORK_PLAN 8.16 F2): outcome `ongoing` — the task goes on (a game in progress), the step
 * reached if any; `done` is only the whole task finished. `confirmed`: this run confirmed the procedure, so a `done`
 * told too soon (the same conversation then says it goes on, or stops) can take the confirmation back.
 */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class OngoingRuns1791390000000 implements MigrationInterface {
  name = 'OngoingRuns1791390000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE procedure_runs DROP CONSTRAINT procedure_runs_outcome_check`);
    await q.query(`ALTER TABLE procedure_runs ADD CONSTRAINT procedure_runs_outcome_check CHECK (outcome IN ('done', 'ongoing', 'failed', 'stopped', 'corrected'))`);
    await q.query(`ALTER TABLE procedure_runs ADD COLUMN confirmed boolean NOT NULL DEFAULT false`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE procedure_runs DROP COLUMN confirmed`);
    await q.query(`UPDATE procedure_runs SET outcome = 'done' WHERE outcome = 'ongoing'`);
    await q.query(`ALTER TABLE procedure_runs DROP CONSTRAINT procedure_runs_outcome_check`);
    await q.query(`ALTER TABLE procedure_runs ADD CONSTRAINT procedure_runs_outcome_check CHECK (outcome IN ('done', 'failed', 'stopped', 'corrected'))`);
  }
}
