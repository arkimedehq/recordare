// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Entity memory (D48): an owner can be an entity — a shared device, a robot, a place — whose memory everyone using it
 * reads and writes. Its person row has kind `entity`; facts about the people who talk to it carry `subject_person_id`.
 */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class EntityMemory1791030000000 implements MigrationInterface {
  name = 'EntityMemory1791030000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TYPE person_kind ADD VALUE IF NOT EXISTS 'entity'`);
  }

  async down(q: QueryRunner): Promise<void> {
    // Postgres cannot drop an enum value: entity owners go back to human, the value stays unused.
    await q.query(`UPDATE persons SET kind = 'human' WHERE kind = 'entity'`);
  }
}
