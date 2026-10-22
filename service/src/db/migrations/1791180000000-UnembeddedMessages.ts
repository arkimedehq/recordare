// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * My own replies are searched too (D30, 2026-10-21): every message gets an embedding, and the hourly sweep queues the ones
 * still missing (replies stored before, a job that failed for good). This index finds them without reading the table.
 */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class UnembeddedMessages1791180000000 implements MigrationInterface {
  name = 'UnembeddedMessages1791180000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE INDEX messages_unembedded_idx ON messages (sent_at) WHERE embedding IS NULL`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX messages_unembedded_idx`);
  }
}
