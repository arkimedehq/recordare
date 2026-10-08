// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * WORK_PLAN 6.6b (11): when a client sends messages for a person whose consent is off, Recordare stores nothing — and
 * now remembers when it last refused, so the admin console can show who is waiting for consent.
 */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class ConsentWaiting1791040000000 implements MigrationInterface {
  name = 'ConsentWaiting1791040000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE owners ADD COLUMN ingest_refused_at timestamptz`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE owners DROP COLUMN ingest_refused_at`);
  }
}
