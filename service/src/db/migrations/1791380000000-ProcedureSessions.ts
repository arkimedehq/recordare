// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * A procedure in progress in a conversation (WORK_PLAN 8.16 F2): opened when the memory context of that conversation
 * carries the procedure (`via` context) or search_knowledge returns it (`via` search); while open, the next turns' memory
 * context repeats a compact line with its id and the report asked for, even when the message does not recall it. Closed
 * by a report that ends the run (`closed` reported), by the conversation's end (ended), or past 3 hours unused. One that
 * was looked up and closed with no report at all counts as `unreported` in the procedure's runs.
 */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class ProcedureSessions1791380000000 implements MigrationInterface {
  name = 'ProcedureSessions1791380000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE procedure_sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        procedure_id uuid NOT NULL REFERENCES procedures(id) ON DELETE CASCADE,
        memory_id uuid NOT NULL REFERENCES memories(person_id) ON DELETE CASCADE,
        conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        via text NOT NULL CHECK (via IN ('context', 'search')),
        opened_at timestamptz NOT NULL,
        touched_at timestamptz NOT NULL,
        reported boolean NOT NULL DEFAULT false,
        last_step integer,
        closed_at timestamptz,
        closed text CHECK (closed IN ('reported', 'ended'))
      )`);
    await q.query(`CREATE INDEX procedure_sessions_open_idx ON procedure_sessions(conversation_id, touched_at) WHERE closed_at IS NULL`);
    await q.query(`CREATE INDEX procedure_sessions_procedure_idx ON procedure_sessions(procedure_id)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE procedure_sessions`);
  }
}
