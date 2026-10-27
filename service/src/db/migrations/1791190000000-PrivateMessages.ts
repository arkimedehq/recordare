// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Private memories (D52): a message declared private is told only to whoever it belongs to (and to the holder of a
 * personal memory); what is extracted from it inherits that at read time through its evidence. `private_owner_id` is the
 * person it belongs to — its author, or for the agent's reply the author it answers; null when nobody identified said it.
 */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class PrivateMessages1791190000000 implements MigrationInterface {
  name = 'PrivateMessages1791190000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE messages ADD COLUMN private boolean NOT NULL DEFAULT false,
      ADD COLUMN private_owner_id uuid REFERENCES persons(id) ON DELETE SET NULL`);
    // Every recall asks whether the memory has a private message at all (none: no filter).
    await q.query(`CREATE INDEX messages_private_idx ON messages (memory_id) WHERE private`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX messages_private_idx`);
    await q.query(`ALTER TABLE messages DROP COLUMN private_owner_id, DROP COLUMN private`);
  }
}
