// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * The agent's own thoughts (D53, WORK_PLAN 8.12a). What the memory concludes by itself gets its own origin, `reflected`,
 * apart from what was lived or told (the recurring patterns were stored as `holder_lived`: moved here). A thought is a
 * note of category `insight`, `question` or `opinion`, registered with the patterns in `episode_promotions` (`kind`);
 * `note_evidence.against` marks an episode that contradicts it; `memories.thoughts_upto` is the thought pass's watermark.
 * The origin type is rebuilt rather than extended: a value added with ADD VALUE cannot be used in the same transaction.
 */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

const PROVENANCE_TABLES = ['episodes', 'facts', 'notes'];

export class Thoughts1791200000000 implements MigrationInterface {
  name = 'Thoughts1791200000000';

  async up(q: QueryRunner): Promise<void> {
    await this.origins(q, ['holder_lived', 'holder_told', 'assistant_stated', 'reflected'],
      (table) => (table === 'notes' ? `CASE WHEN 'pattern' = ANY(tags) THEN 'reflected' ELSE origin::text END` : 'origin::text'));
    for (const v of ['insight', 'question', 'opinion']) await q.query(`ALTER TYPE note_category ADD VALUE IF NOT EXISTS '${v}'`);
    await q.query(`ALTER TABLE note_evidence ADD COLUMN against boolean NOT NULL DEFAULT false`);
    await q.query(`ALTER TABLE episode_promotions ADD COLUMN kind text NOT NULL DEFAULT 'pattern' CHECK (kind IN ('pattern', 'thought'))`);
    await q.query(`ALTER TABLE memories ADD COLUMN thoughts_upto timestamptz`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DELETE FROM notes WHERE category::text IN ('insight', 'question', 'opinion')`);
    await q.query(`DELETE FROM episode_promotions WHERE kind = 'thought'`);
    await q.query(`ALTER TABLE memories DROP COLUMN thoughts_upto`);
    await q.query(`ALTER TABLE episode_promotions DROP COLUMN kind`);
    await q.query(`ALTER TABLE note_evidence DROP COLUMN against`);
    // note_category keeps its values: Postgres cannot drop an enum value.
    await this.origins(q, ['holder_lived', 'holder_told', 'assistant_stated'],
      () => `CASE WHEN origin::text = 'reflected' THEN 'holder_lived' ELSE origin::text END`);
  }

  private async origins(q: QueryRunner, values: string[], using: (table: string) => string): Promise<void> {
    await q.query(`CREATE TYPE origin_kind_next AS ENUM (${values.map((v) => `'${v}'`).join(', ')})`);
    for (const t of PROVENANCE_TABLES) {
      await q.query(`ALTER TABLE ${t} ALTER COLUMN origin TYPE origin_kind_next USING (${using(t)})::origin_kind_next`);
    }
    await q.query(`DROP TYPE origin_kind`);
    await q.query(`ALTER TYPE origin_kind_next RENAME TO origin_kind`);
  }
}
