// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * WORK_PLAN 4.13 — deleting a fact or a note leaves a tombstone, so a re-extraction of the same messages does not write
 * it again. Ids only, never content: the scope (`fact` / `note`), the item's slot key or note category (`item_key`), its
 * subject (`subject_person_id`, null = the memory itself) and its evidence messages. Unlike a forgotten episode's,
 * these messages stay in the chat search: the person removed one memory drawn from them, not the conversation.
 */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class FactNoteTombstones1791110000000 implements MigrationInterface {
  name = 'FactNoteTombstones1791110000000';

  async up(q: QueryRunner): Promise<void> {
    for (const v of ['fact', 'note']) await q.query(`ALTER TYPE tombstone_scope ADD VALUE IF NOT EXISTS '${v}'`);
    await q.query(`ALTER TABLE forget_tombstones ADD COLUMN item_key text,
      ADD COLUMN subject_person_id uuid REFERENCES persons(id) ON DELETE CASCADE`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DELETE FROM forget_tombstones WHERE scope::text IN ('fact', 'note')`);
    await q.query(`ALTER TABLE forget_tombstones DROP COLUMN subject_person_id, DROP COLUMN item_key`);
  }
}
