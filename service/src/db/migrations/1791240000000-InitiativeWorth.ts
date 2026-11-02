// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/** The worth the model gave an initiative (D53, 8.12c; balanced and full), kept for the client to weigh and for us to calibrate. */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class InitiativeWorth1791240000000 implements MigrationInterface {
  name = 'InitiativeWorth1791240000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE initiatives ADD COLUMN worth real CHECK (worth BETWEEN 0 AND 1)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE initiatives DROP COLUMN worth`);
  }
}
