// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * A gap (D55 F2b): someone the memory has heard named but does not know who they are — a `who` intent, asked once of
 * whoever named them most. `about_person_id` is the person asked about; one such intent per person, ever.
 */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class IntentWho1791300000000 implements MigrationInterface {
  name = 'IntentWho1791300000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TYPE intent_kind ADD VALUE IF NOT EXISTS 'who'`);
    await q.query(`ALTER TABLE intents ADD COLUMN about_person_id uuid REFERENCES persons(id) ON DELETE CASCADE`);
    await q.query(`CREATE UNIQUE INDEX intents_about_kind_uq ON intents(about_person_id, kind) WHERE about_person_id IS NOT NULL`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS intents_about_kind_uq`);
    await q.query(`UPDATE intents SET status = 'cancelled' WHERE about_person_id IS NOT NULL AND status IN ('armed', 'fired')`);
    await q.query(`ALTER TABLE intents DROP COLUMN IF EXISTS about_person_id`);
    // An enum value cannot be dropped in place; `who` stays in the type, unused.
  }
}
