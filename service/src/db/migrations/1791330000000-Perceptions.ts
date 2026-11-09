// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Perceptions (WORK_PLAN 8.12e): what the agent's senses noticed, described in words by the client — never an image, a
 * sound or a face. Each one is a message of the raw log (a `perception` conversation of the day) and an episode written
 * without the model, of origin `perceived` ("I saw it" apart from "I was told" and "I thought it"); `perceptions` keeps
 * the sensor, the place and when it fades (`expires_at`, null: kept). `memories.perception_keep_days`: the memory's own
 * keep time (null: the installation's `PERCEPTION_KEEP_DAYS`). The origin type is rebuilt, as in Thoughts1791200000000.
 */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

const PROVENANCE_TABLES = ['episodes', 'facts', 'notes'];

export class Perceptions1791330000000 implements MigrationInterface {
  name = 'Perceptions1791330000000';

  async up(q: QueryRunner): Promise<void> {
    await this.origins(q, ['holder_lived', 'holder_told', 'assistant_stated', 'reflected', 'perceived'], () => 'origin::text');
    await q.query(`
      CREATE TABLE perceptions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        memory_id uuid NOT NULL REFERENCES memories(person_id) ON DELETE CASCADE,
        message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        episode_id uuid REFERENCES episodes(id) ON DELETE SET NULL,
        sensor text NOT NULL CHECK (sensor IN ('camera', 'microphone', 'sensor', 'photo')),
        place text,
        seen_at timestamptz NOT NULL,
        expires_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX perceptions_recent_idx ON perceptions(memory_id, seen_at)`);
    await q.query(`CREATE INDEX perceptions_expiry_idx ON perceptions(memory_id, expires_at) WHERE expires_at IS NOT NULL`);
    await q.query(`ALTER TABLE memories ADD COLUMN perception_keep_days smallint CHECK (perception_keep_days >= 0)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE memories DROP COLUMN perception_keep_days`);
    await q.query(`DROP TABLE perceptions`);
    await this.origins(q, ['holder_lived', 'holder_told', 'assistant_stated', 'reflected'],
      () => `CASE WHEN origin::text = 'perceived' THEN 'holder_lived' ELSE origin::text END`);
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
