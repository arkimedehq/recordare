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
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DELETE FROM notes WHERE category::text = 'procedure'`);
    // note_category keeps its value: Postgres cannot drop an enum value.
  }
}
