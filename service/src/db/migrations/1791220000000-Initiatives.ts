// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Intents and initiatives (D53, WORK_PLAN 8.12c): what the agent means to do or say on its own.
 * - `intents`: one row per thing the agent holds as its own to do — an open plan to ask about or remind of, a question to
 *   look up, later a promise or a request it took on — with its cue (when it is due) and a lifecycle
 *   (pending → armed → fired → done / cancelled / expired), reconsidered on the outcome of what it produced.
 * - `initiatives`: what the agent decided to say or do, pushed to the clients (webhooks) and read as a feed (`seq`);
 *   the client reports what became of it (`status`, `outcome_at`, `reply`).
 * - `client_webhooks`: where a client receives them (Standard Webhooks: a `whsec_` secret per endpoint, kept to sign);
 *   `webhook_deliveries`: every delivery with its attempts (retried with backoff; `410` disables the endpoint).
 * - `memories.quiet_from` / `quiet_to`: the memory's quiet hours (local), when nothing is due.
 */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class Initiatives1791220000000 implements MigrationInterface {
  name = 'Initiatives1791220000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TYPE intent_kind AS ENUM ('open_plan', 'upcoming_plan', 'lookup', 'promise', 'request', 'own')`);
    await q.query(`CREATE TYPE intent_status AS ENUM ('pending', 'armed', 'fired', 'done', 'cancelled', 'expired')`);
    await q.query(`CREATE TYPE initiative_kind AS ENUM ('say', 'ask', 'lookup', 'do')`);
    await q.query(`CREATE TYPE initiative_status AS ENUM ('pending', 'said', 'asked', 'ignored', 'declined', 'done', 'failed', 'expired')`);
    await q.query(`
      CREATE TABLE intents (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        memory_id uuid NOT NULL REFERENCES memories(person_id) ON DELETE CASCADE,
        kind intent_kind NOT NULL,
        content text NOT NULL,
        for_person_id uuid REFERENCES persons(id) ON DELETE SET NULL,
        episode_id uuid REFERENCES episodes(id) ON DELETE CASCADE,
        note_id uuid REFERENCES notes(id) ON DELETE CASCADE,
        due_at timestamptz,
        expires_at timestamptz,
        status intent_status NOT NULL DEFAULT 'armed',
        attempts integer NOT NULL DEFAULT 0,
        reconsider_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX intents_memory_status_idx ON intents(memory_id, status)`);
    // One intent per source: an open plan asked about once, a question looked up once.
    await q.query(`CREATE UNIQUE INDEX intents_episode_kind_uq ON intents(episode_id, kind) WHERE episode_id IS NOT NULL`);
    await q.query(`CREATE UNIQUE INDEX intents_note_kind_uq ON intents(note_id, kind) WHERE note_id IS NOT NULL`);
    await q.query(`
      CREATE TABLE initiatives (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        seq bigserial NOT NULL,
        memory_id uuid NOT NULL REFERENCES memories(person_id) ON DELETE CASCADE,
        intent_id uuid REFERENCES intents(id) ON DELETE SET NULL,
        kind initiative_kind NOT NULL,
        for_person_id uuid REFERENCES persons(id) ON DELETE SET NULL,
        text text NOT NULL,
        reason text NOT NULL,
        episode_ids uuid[] NOT NULL DEFAULT '{}',
        due_at timestamptz NOT NULL,
        expires_at timestamptz NOT NULL,
        status initiative_status NOT NULL DEFAULT 'pending',
        outcome_at timestamptz,
        reply text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX initiatives_memory_seq_idx ON initiatives(memory_id, seq)`);
    await q.query(`CREATE INDEX initiatives_pending_idx ON initiatives(expires_at) WHERE status = 'pending'`);
    await q.query(`
      CREATE TABLE client_webhooks (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        url text NOT NULL,
        secret text NOT NULL,
        token text,
        authentication jsonb,
        description text,
        created_at timestamptz NOT NULL DEFAULT now(),
        disabled_at timestamptz,
        disabled_reason text
      )`);
    await q.query(`CREATE INDEX client_webhooks_client_idx ON client_webhooks(client_id) WHERE disabled_at IS NULL`);
    await q.query(`
      CREATE TABLE webhook_deliveries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        webhook_id uuid NOT NULL REFERENCES client_webhooks(id) ON DELETE CASCADE,
        initiative_id uuid REFERENCES initiatives(id) ON DELETE CASCADE,
        event_type text NOT NULL,
        payload jsonb NOT NULL,
        attempts integer NOT NULL DEFAULT 0,
        last_status integer,
        last_error text,
        delivered_at timestamptz,
        gave_up_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX webhook_deliveries_webhook_idx ON webhook_deliveries(webhook_id, created_at)`);
    await q.query(`ALTER TABLE memories ADD COLUMN quiet_from smallint NOT NULL DEFAULT 22 CHECK (quiet_from BETWEEN 0 AND 23),
      ADD COLUMN quiet_to smallint NOT NULL DEFAULT 8 CHECK (quiet_to BETWEEN 0 AND 23)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE memories DROP COLUMN quiet_to, DROP COLUMN quiet_from`);
    await q.query(`DROP TABLE IF EXISTS webhook_deliveries, client_webhooks, initiatives, intents CASCADE`);
    await q.query(`DROP TYPE IF EXISTS initiative_status, initiative_kind, intent_status, intent_kind`);
  }
}
