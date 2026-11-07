// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Timing v2 (D55 F6), the moment's context on a presence: `busy` (the client says the person is occupied — a call, a
 * meeting, do-not-disturb), `talking` (the client says people in the place are talking now) and `arrival_held` (an
 * arrival whose spontaneous moment was held for a busy person or a conversation: the next impulse in that place still
 * counts as the arrival).
 */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class PresenceMoment1791320000000 implements MigrationInterface {
  name = 'PresenceMoment1791320000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE presences ADD COLUMN busy boolean NOT NULL DEFAULT false,
      ADD COLUMN talking boolean NOT NULL DEFAULT false, ADD COLUMN arrival_held boolean NOT NULL DEFAULT false`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE presences DROP COLUMN busy, DROP COLUMN talking, DROP COLUMN arrival_held`);
  }
}
