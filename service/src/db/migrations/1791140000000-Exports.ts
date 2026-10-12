// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * WORK_PLAN 4.7 — full exports of a memory (API.md §4 `POST api/v1/exports` → `GET api/v1/exports/{id}`): built in the
 * background, kept gzipped for a few days, then purged.
 */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class Exports1791140000000 implements MigrationInterface {
  name = 'Exports1791140000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TYPE export_status AS ENUM ('running', 'done', 'failed')`);
    await q.query(`
      CREATE TABLE exports (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        memory_id uuid NOT NULL REFERENCES memories(person_id) ON DELETE CASCADE,
        client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
        status export_status NOT NULL DEFAULT 'running',
        archive bytea,
        bytes int,
        error text,
        created_at timestamptz NOT NULL DEFAULT now(),
        finished_at timestamptz
      )`);
    await q.query(`CREATE INDEX exports_memory_idx ON exports(memory_id, created_at)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE exports`);
    await q.query(`DROP TYPE export_status`);
  }
}
