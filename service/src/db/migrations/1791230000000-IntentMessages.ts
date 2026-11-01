// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Intents from conversation (D53, WORK_PLAN 8.12c, the model's part): a promise the agent made or a request a person made
 * to it is an intent drawn by the extraction from a message — `message_id` is its source (one per message and kind); a
 * later "never mind" finds the request it withdraws by its words (full text), so no vector is kept.
 */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class IntentMessages1791230000000 implements MigrationInterface {
  name = 'IntentMessages1791230000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE intents ADD COLUMN message_id uuid REFERENCES messages(id) ON DELETE CASCADE`);
    await q.query(`CREATE UNIQUE INDEX intents_message_kind_uq ON intents(message_id, kind) WHERE message_id IS NOT NULL`);
    await q.query(`CREATE INDEX intents_content_fts_idx ON intents USING gin (to_tsvector('simple', content))`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX intents_content_fts_idx`);
    await q.query(`DROP INDEX intents_message_kind_uq`);
    await q.query(`ALTER TABLE intents DROP COLUMN message_id`);
  }
}
