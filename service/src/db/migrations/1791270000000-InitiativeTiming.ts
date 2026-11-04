// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Timing v0 (D55, `docs/INITIATIVES_DELIVERY.md` F2a): Recordare chooses the moment to push an initiative on a channel
 * that always reaches the person.
 * - `initiatives.pushed_at`: when it was pushed (event `initiative.deliver`); `preferred_from` / `preferred_to`: the
 *   local hours that suit it (null: the kind's default).
 * - `initiative_decisions`: every decision with its trigger (clock, presence, turn), the probability it was taken with
 *   and the threshold — so timelines can be replayed offline and the learner (F4) has its data. Features only, no text.
 */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class InitiativeTiming1791270000000 implements MigrationInterface {
  name = 'InitiativeTiming1791270000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE initiatives
        ADD COLUMN pushed_at timestamptz,
        ADD COLUMN preferred_from smallint CHECK (preferred_from BETWEEN 0 AND 23),
        ADD COLUMN preferred_to smallint CHECK (preferred_to BETWEEN 0 AND 24)`);
    await q.query(`
      CREATE TABLE initiative_decisions (
        id bigserial PRIMARY KEY,
        memory_id uuid NOT NULL REFERENCES memories(person_id) ON DELETE CASCADE,
        initiative_id uuid NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
        trigger text NOT NULL CHECK (trigger IN ('clock', 'presence', 'turn')),
        at timestamptz NOT NULL,
        p real NOT NULL CHECK (p BETWEEN 0 AND 1),
        threshold real NOT NULL CHECK (threshold BETWEEN 0 AND 1),
        delivered boolean NOT NULL,
        features jsonb NOT NULL DEFAULT '{}'
      )`);
    await q.query(`CREATE INDEX initiative_decisions_initiative_idx ON initiative_decisions(initiative_id, at)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE initiative_decisions`);
    await q.query(`ALTER TABLE initiatives DROP COLUMN pushed_at, DROP COLUMN preferred_from, DROP COLUMN preferred_to`);
  }
}
