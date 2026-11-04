// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Delivery of initiatives decided by Recordare (D55, `docs/INITIATIVES_DELIVERY.md` F1): who, when and where.
 * - `initiative_status` gains `offered`: given to the agent in a turn or after a presence impulse, waiting for what
 *   happens next (the conversation's extraction, or the client's report, closes it).
 * - `initiatives`: `timing` (timed: a time was asked for; flexible: a window), `identity_required` (medium / high: the
 *   confidence a person must be recognised with), `channel` (where it was or will be delivered), `offered_at` and the
 *   conversation it was offered in, `source_message_ids` (the messages its intent came from: a host recognises its own
 *   scheduled reminder), and the outcome's context (`outcome_channel`, `outcome_context`: the data timing learns from).
 * - `intents.timed`: the request or promise named a time ("ricordami alle 9").
 * - `clients.channels`: the channels a client declares and how each reaches a person (`always` | `presence`).
 * - `client_webhooks.events`: the event types an endpoint takes (null: all).
 * - `presences`: presence impulses — who the agent sees or hears now, by what, how sure, until when (short-lived).
 */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class InitiativeDelivery1791260000000 implements MigrationInterface {
  name = 'InitiativeDelivery1791260000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TYPE initiative_status ADD VALUE IF NOT EXISTS 'offered' AFTER 'pending'`);
    await q.query(`
      ALTER TABLE initiatives
        ADD COLUMN timing text NOT NULL DEFAULT 'flexible' CHECK (timing IN ('timed', 'flexible')),
        ADD COLUMN identity_required text NOT NULL DEFAULT 'medium' CHECK (identity_required IN ('medium', 'high')),
        ADD COLUMN channel text,
        ADD COLUMN offered_at timestamptz,
        ADD COLUMN offered_conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
        ADD COLUMN source_message_ids uuid[] NOT NULL DEFAULT '{}',
        ADD COLUMN outcome_channel text,
        ADD COLUMN outcome_context jsonb`);
    await q.query(`ALTER TABLE intents ADD COLUMN timed boolean NOT NULL DEFAULT false`);
    await q.query(`ALTER TABLE clients ADD COLUMN channels jsonb NOT NULL DEFAULT '[]'`);
    await q.query(`ALTER TABLE client_webhooks ADD COLUMN events text[]`);
    await q.query(`
      CREATE TABLE presences (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        memory_id uuid NOT NULL REFERENCES memories(person_id) ON DELETE CASCADE,
        person_id uuid REFERENCES persons(id) ON DELETE CASCADE,
        client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
        channel text NOT NULL,
        confidence real NOT NULL CHECK (confidence BETWEEN 0 AND 1),
        place text,
        seen_at timestamptz NOT NULL,
        expires_at timestamptz NOT NULL
      )`);
    await q.query(`CREATE INDEX presences_memory_idx ON presences(memory_id, expires_at)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE presences`);
    await q.query(`ALTER TABLE client_webhooks DROP COLUMN events`);
    await q.query(`ALTER TABLE clients DROP COLUMN channels`);
    await q.query(`ALTER TABLE intents DROP COLUMN timed`);
    await q.query(`UPDATE initiatives SET status = 'pending' WHERE status = 'offered'`);
    await q.query(`
      ALTER TABLE initiatives DROP COLUMN timing, DROP COLUMN identity_required, DROP COLUMN channel, DROP COLUMN offered_at,
        DROP COLUMN offered_conversation_id, DROP COLUMN source_message_ids, DROP COLUMN outcome_channel, DROP COLUMN outcome_context`);
    // An enum value cannot be dropped in place; `offered` stays in the type, unused.
  }
}
