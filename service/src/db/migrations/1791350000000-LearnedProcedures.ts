// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Procedures kept whole (WORK_PLAN 8.16 F2, D57): a multi-step task — a title, when it is used, its steps in order — with
 * where it was learned (a source, a page, a person) and who brought it (an informant, F1), returned whole, never as
 * fragments. Apart from 8.12d's one-line procedures (notes of category `procedure`, which stay).
 * - `procedures`: one version per row; a new version replaces the old (`replaced_by`); `pending` until a trusted person
 *   confirms it or a run succeeds; steps as taught (never optimised);
 * - `procedure_variants`: the household's own way of a step (or of the whole task), shown above the generic step;
 * - `procedure_runs`: how each run went (done / failed at step N / corrected by a person) — outcomes like a reply's;
 * - `item_informants.procedure_id`: who backs a procedure (independent corroboration as for facts and notes);
 * - `sources.for_task` (learned to do a task: said by the client, or recognised by the extraction), `procedures_at` /
 *   `procedures_outcome` (Recordare's own reading of it for procedures, mode B2 — once per source);
 * - `memories.procedures_from_sources`: the memory's switch for B2 (null: the installation's PROCEDURES_FROM_SOURCES).
 */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class LearnedProcedures1791350000000 implements MigrationInterface {
  name = 'LearnedProcedures1791350000000';

  async up(q: QueryRunner): Promise<void> {
    const [{ dim }] = await q.query(
      `SELECT atttypmod AS dim FROM pg_attribute WHERE attrelid = 'episodes'::regclass AND attname = 'embedding'`);
    await q.query(`
      CREATE TABLE procedures (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        memory_id uuid NOT NULL REFERENCES memories(person_id) ON DELETE CASCADE,
        title text NOT NULL,
        situation text,
        steps jsonb NOT NULL,
        source_id uuid REFERENCES sources(id) ON DELETE SET NULL,
        origin_uri text,
        origin origin_kind NOT NULL,
        pending boolean NOT NULL DEFAULT false,
        status text NOT NULL DEFAULT 'current' CHECK (status IN ('current', 'replaced')),
        replaced_by uuid REFERENCES procedures(id) ON DELETE SET NULL,
        conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
        extraction_run_id uuid REFERENCES extraction_runs(id) ON DELETE SET NULL,
        embedding vector(${Number(dim)}),
        embedding_model text,
        embedding_text text,
        created_at timestamptz NOT NULL DEFAULT now(),
        learned_at timestamptz NOT NULL,
        confirmed_at timestamptz
      )`);
    await q.query(`CREATE INDEX procedures_memory_idx ON procedures(memory_id) WHERE status = 'current'`);
    await q.query(`CREATE INDEX procedures_embedding_idx ON procedures USING hnsw (embedding vector_cosine_ops)`);
    await q.query(`
      CREATE TABLE procedure_variants (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        procedure_id uuid NOT NULL REFERENCES procedures(id) ON DELETE CASCADE,
        memory_id uuid NOT NULL REFERENCES memories(person_id) ON DELETE CASCADE,
        step integer,
        text text NOT NULL,
        informant_id uuid REFERENCES informants(id) ON DELETE SET NULL,
        pending boolean NOT NULL DEFAULT false,
        conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
        at timestamptz NOT NULL,
        retired_at timestamptz
      )`);
    await q.query(`CREATE INDEX procedure_variants_procedure_idx ON procedure_variants(procedure_id)`);
    await q.query(`
      CREATE TABLE procedure_runs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        procedure_id uuid NOT NULL REFERENCES procedures(id) ON DELETE CASCADE,
        memory_id uuid NOT NULL REFERENCES memories(person_id) ON DELETE CASCADE,
        outcome text NOT NULL CHECK (outcome IN ('done', 'failed', 'corrected')),
        step integer,
        note text,
        conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
        at timestamptz NOT NULL
      )`);
    await q.query(`CREATE INDEX procedure_runs_procedure_idx ON procedure_runs(procedure_id, at)`);
    await q.query(`ALTER TABLE item_informants ADD COLUMN procedure_id uuid REFERENCES procedures(id) ON DELETE CASCADE`);
    await q.query(`ALTER TABLE item_informants DROP CONSTRAINT item_informants_check`);
    await q.query(`ALTER TABLE item_informants ADD CONSTRAINT item_informants_check CHECK (num_nonnulls(fact_id, note_id, procedure_id) = 1)`);
    await q.query(`CREATE INDEX item_informants_procedure_idx ON item_informants(procedure_id) WHERE procedure_id IS NOT NULL`);
    await q.query(`ALTER TABLE sources ADD COLUMN for_task boolean, ADD COLUMN procedures_at timestamptz, ADD COLUMN procedures_outcome text`);
    await q.query(`ALTER TABLE memories ADD COLUMN procedures_from_sources boolean`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE memories DROP COLUMN procedures_from_sources`);
    await q.query(`ALTER TABLE sources DROP COLUMN for_task, DROP COLUMN procedures_at, DROP COLUMN procedures_outcome`);
    await q.query(`DELETE FROM item_informants WHERE procedure_id IS NOT NULL`);
    await q.query(`DROP INDEX item_informants_procedure_idx`);
    await q.query(`ALTER TABLE item_informants DROP CONSTRAINT item_informants_check`);
    await q.query(`ALTER TABLE item_informants DROP COLUMN procedure_id`);
    await q.query(`ALTER TABLE item_informants ADD CONSTRAINT item_informants_check CHECK ((fact_id IS NULL) <> (note_id IS NULL))`);
    await q.query(`DROP TABLE procedure_runs`);
    await q.query(`DROP TABLE procedure_variants`);
    await q.query(`DROP TABLE procedures`);
  }
}
