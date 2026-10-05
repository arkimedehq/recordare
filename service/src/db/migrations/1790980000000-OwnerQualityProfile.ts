// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/** Per-owner quality profile (D35); null = the installation default (`QUALITY_PROFILE`). */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class OwnerQualityProfile1790980000000 implements MigrationInterface {
  name = 'OwnerQualityProfile1790980000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE owners ADD COLUMN quality_profile text CHECK (quality_profile IN ('economy', 'balanced', 'full'))`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE owners DROP COLUMN quality_profile`);
  }
}
