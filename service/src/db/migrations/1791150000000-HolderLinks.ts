// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * D51 — the holder's identities by one-time code (WORK_PLAN 8.7): the holder makes a code, sends it from a channel, and
 * confirms the claim; only then does that channel identity speak as the memory's "I". The code itself is kept hashed.
 */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class HolderLinks1791150000000 implements MigrationInterface {
  name = 'HolderLinks1791150000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE link_codes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        memory_id uuid NOT NULL REFERENCES memories(person_id) ON DELETE CASCADE,
        code_hash bytea NOT NULL,
        expires_at timestamptz NOT NULL,
        failures int NOT NULL DEFAULT 0,
        claimed_at timestamptz,
        claim_client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
        claim_channel text,
        claim_external_id text,
        claim_display_name text,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE UNIQUE INDEX link_codes_hash_uq ON link_codes(memory_id, code_hash)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE link_codes`);
  }
}
