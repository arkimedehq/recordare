// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/** Nightly facts review (M5): the recording time of the last episode the facts were reviewed against (the real clock, so an evaluation clock cannot hide new episodes). */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class FactsReview1791020000000 implements MigrationInterface {
  name = 'FactsReview1791020000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE owners ADD COLUMN facts_reviewed_upto timestamptz`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE owners DROP COLUMN facts_reviewed_upto`);
  }
}
