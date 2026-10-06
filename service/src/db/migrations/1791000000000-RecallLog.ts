// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Recall log: one row per recall served (tool, mode, how many items) — metadata only, never the query or the
 * memories. Gives the operators' dashboard real totals, and is the base of a future "who read my twin" view.
 */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class RecallLog1791000000000 implements MigrationInterface {
  name = 'RecallLog1791000000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE recall_log (
      id bigserial PRIMARY KEY,
      owner_id uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      tool text NOT NULL,
      mode text,
      items int NOT NULL DEFAULT 0,
      served_at timestamptz NOT NULL DEFAULT now())`);
    await q.query(`CREATE INDEX recall_log_owner ON recall_log (owner_id, served_at)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE recall_log`);
  }
}
