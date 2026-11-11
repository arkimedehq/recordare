// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Learning from outside (WORK_PLAN 8.16 F1, D57): an entity memory learns by itself from what it is told and reads.
 * - origin `learned`: read in a tool's output or a page ("I read it"), apart from told, perceived and reflected;
 * - `informants`: who or what brought something (a person, a tool, a site), with its class and its track record
 *   (confirmed / corrected) — trust learned from outcomes;
 * - `item_informants`: which informants back a fact or a note, from which conversation — corroboration counts only
 *   independent ones;
 * - `notes.lasts` / `expires_at` / `recheck_at`: perishable knowledge fades, slowly changing knowledge is rechecked;
 * - `memories.learn_from_outside`: the memory's switch (null: on for an entity memory, off for a personal one).
 * The origin type is rebuilt, as in Perceptions1791330000000.
 */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

const PROVENANCE_TABLES = ['episodes', 'facts', 'notes'];

export class Learning1791340000000 implements MigrationInterface {
  name = 'Learning1791340000000';

  async up(q: QueryRunner): Promise<void> {
    await this.origins(q, ['holder_lived', 'holder_told', 'assistant_stated', 'reflected', 'perceived', 'learned'], () => 'origin::text');
    await q.query(`
      CREATE TABLE informants (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        memory_id uuid NOT NULL REFERENCES memories(person_id) ON DELETE CASCADE,
        kind text NOT NULL CHECK (kind IN ('person', 'tool', 'site')),
        key text NOT NULL,
        person_id uuid REFERENCES persons(id) ON DELETE SET NULL,
        class text NOT NULL CHECK (class IN ('household', 'contact', 'own_tool', 'site', 'anonymous')),
        confirmed integer NOT NULL DEFAULT 0,
        corrected integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (memory_id, kind, key)
      )`);
    await q.query(`
      CREATE TABLE item_informants (
        id bigserial PRIMARY KEY,
        memory_id uuid NOT NULL REFERENCES memories(person_id) ON DELETE CASCADE,
        fact_id uuid REFERENCES facts(id) ON DELETE CASCADE,
        note_id uuid REFERENCES notes(id) ON DELETE CASCADE,
        informant_id uuid NOT NULL REFERENCES informants(id) ON DELETE CASCADE,
        conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
        at timestamptz NOT NULL,
        CHECK ((fact_id IS NULL) <> (note_id IS NULL))
      )`);
    await q.query(`CREATE INDEX item_informants_fact_idx ON item_informants(fact_id) WHERE fact_id IS NOT NULL`);
    await q.query(`CREATE INDEX item_informants_note_idx ON item_informants(note_id) WHERE note_id IS NOT NULL`);
    await q.query(`CREATE INDEX item_informants_informant_idx ON item_informants(informant_id)`);
    await q.query(`ALTER TABLE notes ADD COLUMN lasts text CHECK (lasts IN ('perishable', 'changing', 'lasting')),
      ADD COLUMN expires_at timestamptz, ADD COLUMN recheck_at timestamptz`);
    await q.query(`CREATE INDEX notes_expiry_idx ON notes(memory_id, expires_at) WHERE expires_at IS NOT NULL`);
    await q.query(`ALTER TABLE memories ADD COLUMN learn_from_outside boolean`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE memories DROP COLUMN learn_from_outside`);
    await q.query(`DROP INDEX notes_expiry_idx`);
    await q.query(`ALTER TABLE notes DROP COLUMN lasts, DROP COLUMN expires_at, DROP COLUMN recheck_at`);
    await q.query(`DROP TABLE item_informants`);
    await q.query(`DROP TABLE informants`);
    await this.origins(q, ['holder_lived', 'holder_told', 'assistant_stated', 'reflected', 'perceived'],
      () => `CASE WHEN origin::text = 'learned' THEN 'holder_told' ELSE origin::text END`);
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
