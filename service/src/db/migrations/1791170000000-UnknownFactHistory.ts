// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * A period in which a fact was not known can end (blind12, 2026-10-19): "back pain: (unknown)" superseded by a new value,
 * or corrected. Before, only `unknown_current` could hold no value, so superseding or correcting an unknown fact failed the
 * whole extraction window. Now: `current` always has a value, `unknown_current` never has one, history (`superseded`,
 * `corrected`) keeps whatever the fact held.
 */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class UnknownFactHistory1791170000000 implements MigrationInterface {
  name = 'UnknownFactHistory1791170000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE facts DROP CONSTRAINT facts_check`);
    await q.query(`ALTER TABLE facts ADD CONSTRAINT facts_check CHECK (
      (status = 'current' AND value IS NOT NULL) OR (status = 'unknown_current' AND value IS NULL) OR status IN ('superseded', 'corrected'))`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DELETE FROM facts WHERE value IS NULL AND status IN ('superseded', 'corrected')`);
    await q.query(`ALTER TABLE facts DROP CONSTRAINT facts_check`);
    await q.query(`ALTER TABLE facts ADD CONSTRAINT facts_check CHECK ((status = 'unknown_current') = (value IS NULL))`);
  }
}
