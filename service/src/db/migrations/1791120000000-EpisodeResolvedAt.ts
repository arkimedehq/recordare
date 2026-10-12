// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * WORK_PLAN 5.3 — when the near-duplicate check last looked at an episode (`resolved_at`), so the nightly pass asks only
 * about the pairs no check could see: episodes written by extractions running at the same time, a failed check, an
 * explicit `log_episode`. Existing episodes count as checked when they were recorded.
 */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class EpisodeResolvedAt1791120000000 implements MigrationInterface {
  name = 'EpisodeResolvedAt1791120000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE episodes ADD COLUMN resolved_at timestamptz`);
    await q.query(`UPDATE episodes SET resolved_at = recorded_at`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE episodes DROP COLUMN resolved_at`);
  }
}
