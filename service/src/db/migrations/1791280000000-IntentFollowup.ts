// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/** A follow-up (D55 F2b, `extract.v22`): something a person started that must be finished later — the question to ask, and when. */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class IntentFollowup1791280000000 implements MigrationInterface {
  name = 'IntentFollowup1791280000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TYPE intent_kind ADD VALUE IF NOT EXISTS 'followup'`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`UPDATE intents SET status = 'cancelled' WHERE kind = 'followup' AND status IN ('armed', 'fired')`);
    // An enum value cannot be dropped in place; `followup` stays in the type, unused.
  }
}
