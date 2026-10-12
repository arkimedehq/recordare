// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * WORK_PLAN 5.4 (D20, D26 as decided 2026-10-12): recurring patterns are the memory's own conclusions, not proposals.
 * `episode_promotions` (created unused in the initial schema) becomes the register of what the memory inferred: the
 * note it wrote, the episodes behind it, its state (active, retired when it stopped holding, forgotten when the note
 * was deleted — never inferred again from the same episodes). `memories.patterns_upto`: the last episode the nightly
 * pattern pass has seen; `note_changes` gains `retired` (a pattern that stopped holding).
 */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class Patterns1791130000000 implements MigrationInterface {
  name = 'Patterns1791130000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE episode_promotions`);
    await q.query(`DROP TYPE promotion_status`);
    await q.query(`CREATE TYPE promotion_status AS ENUM ('active', 'retired', 'forgotten')`);
    await q.query(`
      CREATE TABLE episode_promotions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        memory_id uuid NOT NULL REFERENCES memories(person_id) ON DELETE CASCADE,
        note_id uuid REFERENCES notes(id) ON DELETE SET NULL,
        pattern text NOT NULL,
        episode_ids uuid[] NOT NULL,
        subject_person_id uuid REFERENCES persons(id) ON DELETE SET NULL,
        status promotion_status NOT NULL DEFAULT 'active',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX episode_promotions_memory_idx ON episode_promotions(memory_id, status)`);
    await q.query(`CREATE INDEX episode_promotions_note_idx ON episode_promotions(note_id)`);
    await q.query(`ALTER TABLE memories ADD COLUMN patterns_upto timestamptz`);
    await q.query(`ALTER TYPE note_change ADD VALUE IF NOT EXISTS 'retired'`);
  }

  async down(q: QueryRunner): Promise<void> {
    // `note_change` keeps the value: Postgres cannot drop an enum value.
    await q.query(`ALTER TABLE memories DROP COLUMN patterns_upto`);
    await q.query(`DROP TABLE episode_promotions`);
    await q.query(`DROP TYPE promotion_status`);
    await q.query(`CREATE TYPE promotion_status AS ENUM ('proposed', 'confirmed', 'rejected')`);
    await q.query(`
      CREATE TABLE episode_promotions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        memory_id uuid NOT NULL REFERENCES memories(person_id) ON DELETE CASCADE,
        pattern text NOT NULL,
        episode_ids uuid[] NOT NULL,
        proposed_note_ref text,
        status promotion_status NOT NULL DEFAULT 'proposed',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
  }
}
