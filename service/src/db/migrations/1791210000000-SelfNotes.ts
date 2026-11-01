// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * The agent's self-model (D53, WORK_PLAN 8.12b): what the agent learned about itself as an agent — its mistakes, what works
 * with each person, its promises, its relations — is a note of category `self`, drawn by the thought pass from its own
 * replies and the people's reactions to them (never from introspection), with the messages behind it as evidence.
 */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class SelfNotes1791210000000 implements MigrationInterface {
  name = 'SelfNotes1791210000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TYPE note_category ADD VALUE IF NOT EXISTS 'self'`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DELETE FROM notes WHERE category::text = 'self'`);
    // note_category keeps its value: Postgres cannot drop an enum value.
  }
}
