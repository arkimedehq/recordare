// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * The channel chosen at delivery (D55, `docs/INITIATIVES_DELIVERY.md` §5b–§5c):
 * - `initiatives.channels`: the acceptable channels in order — a timed reminder, a request, a promise: voice → messaging
 *   → chat; anything else: voice → chat (never messaging: it would interrupt); a look-up: none (the turn only). The
 *   client delivers on the first that reaches the person now; `channel` stays where it was offered or pushed.
 * - `initiatives.opened_at`: when the opening ("I have something for you: do you want to hear it?") was said aloud with
 *   others in the room — the initiative stays pending; the voice pace counts it.
 */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class InitiativeChannels1791290000000 implements MigrationInterface {
  name = 'InitiativeChannels1791290000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE initiatives ADD COLUMN channels text[] NOT NULL DEFAULT '{}', ADD COLUMN opened_at timestamptz`);
    await q.query(`
      UPDATE initiatives i SET channels = CASE
          WHEN i.kind = 'lookup' THEN '{}'::text[]
          WHEN t.kind IN ('request', 'promise') THEN ARRAY['voice', 'messaging', 'chat']
          ELSE ARRAY['voice', 'chat'] END
        FROM intents t WHERE t.id = i.intent_id`);
    await q.query(`UPDATE initiatives SET channels = ARRAY['voice', 'chat'] WHERE intent_id IS NULL AND kind <> 'lookup'`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE initiatives DROP COLUMN channels, DROP COLUMN opened_at`);
  }
}
