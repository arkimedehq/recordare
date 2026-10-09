// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * D50, WORK_PLAN 8.1: Recordare has no consent flag any more — every memory stores what its client sends; the on/off
 * switch belongs to the client platform. Drops the consent columns (InitialSchema, ConsentWaiting).
 */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class NoConsent1791060000000 implements MigrationInterface {
  name = 'NoConsent1791060000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE owners DROP COLUMN ingest_refused_at, DROP COLUMN episodic_enabled_by,
      DROP COLUMN episodic_enabled_at, DROP COLUMN episodic_enabled`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE owners ADD COLUMN episodic_enabled boolean NOT NULL DEFAULT false,
      ADD COLUMN episodic_enabled_at timestamptz, ADD COLUMN episodic_enabled_by text, ADD COLUMN ingest_refused_at timestamptz`);
  }
}
