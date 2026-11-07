// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * A confirmation (D55 F2b): something the memory believes about a person but heard once or guessed — a `confirm`
 * intent on the note, asked once of who could know: is it so, or is there more?
 */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class IntentConfirm1791310000000 implements MigrationInterface {
  name = 'IntentConfirm1791310000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TYPE intent_kind ADD VALUE IF NOT EXISTS 'confirm'`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`UPDATE intents SET status = 'cancelled' WHERE kind = 'confirm' AND status IN ('armed', 'fired')`);
    // An enum value cannot be dropped in place; `confirm` stays in the type, unused.
  }
}
