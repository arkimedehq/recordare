// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * The conversation a recall was served in: the extractor then knows which assistant replies were answering from
 * memory (a recall echo is not a new memory).
 */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class RecallLogConversation1791010000000 implements MigrationInterface {
  name = 'RecallLogConversation1791010000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE recall_log ADD COLUMN conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL`);
    await q.query(`CREATE INDEX recall_log_conversation ON recall_log (conversation_id, served_at) WHERE conversation_id IS NOT NULL`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE recall_log DROP COLUMN conversation_id`);
  }
}
