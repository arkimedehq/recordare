// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * The agent's procedures (D53, WORK_PLAN 8.12d): how it learned to do a recurring task for a person or place — "when X, I do
 * it this way" — from an outcome (taught, corrected, approved), a note of category `procedure` drawn by the thought pass.
 */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class Procedures1791250000000 implements MigrationInterface {
  name = 'Procedures1791250000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TYPE note_category ADD VALUE IF NOT EXISTS 'procedure'`);
    // The lessons about myself (self notes, procedures) are a call of their own, with their own watermark: my replies seen.
    await q.query(`ALTER TABLE memories ADD COLUMN self_upto timestamptz`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE memories DROP COLUMN self_upto`);
    await q.query(`DELETE FROM notes WHERE category::text = 'procedure'`);
    // note_category keeps its value: Postgres cannot drop an enum value.
  }
}
