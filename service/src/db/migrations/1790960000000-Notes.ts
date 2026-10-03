// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/** Semantic notes + change feed (D34) and the initial fact slots (D31). */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

/** Common state slots; extraction adds new ones (snake_case keys) when needed. */
export const SLOTS: Array<[string, string, 'single' | 'multi']> = [
  ['car', 'The car the person currently has', 'single'],
  ['address', 'Where the person currently lives', 'single'],
  ['employer', 'Where the person currently works', 'single'],
  ['job_title', "The person's current role or job", 'single'],
  ['partner', "The person's current partner or spouse", 'single'],
  ['children', "The person's children", 'multi'],
  ['pets', "The person's pets", 'multi'],
  ['languages', 'Languages the person speaks', 'multi'],
];

export const SEED_SLOTS = SLOTS.map(([key]) => key);

export class Notes1790960000000 implements MigrationInterface {
  name = 'Notes1790960000000';

  async up(q: QueryRunner): Promise<void> {
    const dim = Number(process.env['EMBEDDING_DIM']);
    if (!Number.isInteger(dim) || dim <= 0) throw new Error('EMBEDDING_DIM must be set');
    await q.query(`CREATE TYPE note_category AS ENUM ('preference', 'habit', 'value', 'relationship', 'knowledge', 'profile', 'constraint')`);
    await q.query(`CREATE TYPE note_status AS ENUM ('current', 'superseded', 'corrected')`);
    await q.query(`CREATE TYPE note_change AS ENUM ('created', 'updated', 'corrected', 'confirmed', 'forgotten')`);
    await q.query(`
      CREATE TABLE notes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id uuid NOT NULL REFERENCES owners(person_id) ON DELETE CASCADE,
        category note_category NOT NULL,
        content text NOT NULL,
        keywords text[] NOT NULL DEFAULT '{}',
        context text,
        tags text[] NOT NULL DEFAULT '{}',
        pinned boolean NOT NULL DEFAULT false,
        status note_status NOT NULL DEFAULT 'current',
        supersedes uuid REFERENCES notes(id) ON DELETE SET NULL,
        corrects uuid REFERENCES notes(id) ON DELETE SET NULL,
        support_count integer NOT NULL DEFAULT 1,
        pending boolean NOT NULL DEFAULT false,
        valid_from timestamptz,
        recorded_at timestamptz NOT NULL DEFAULT now(),
        origin origin_kind NOT NULL,
        author_role author_role NOT NULL,
        stance stance NOT NULL DEFAULT 'stated',
        confidence real NOT NULL DEFAULT 1 CHECK (confidence BETWEEN 0 AND 1),
        extraction_run_id uuid REFERENCES extraction_runs(id) ON DELETE SET NULL,
        disclosure disclosure_tier NOT NULL DEFAULT 'owner',
        audience uuid[] NOT NULL,
        audience_unverified text[] NOT NULL DEFAULT '{}',
        confidence_of uuid REFERENCES persons(id) ON DELETE SET NULL,
        embedding vector(${dim}),
        embedding_model text,
        embedding_text text,
        deleted_at timestamptz
      )`);
    await q.query(`CREATE INDEX notes_owner_live_idx ON notes(owner_id, category) WHERE status = 'current' AND deleted_at IS NULL`);
    await q.query(`CREATE INDEX notes_embedding_idx ON notes USING hnsw (embedding vector_cosine_ops)`);
    await q.query(`CREATE INDEX notes_audience_idx ON notes USING gin (audience)`);
    await q.query(`CREATE INDEX notes_fts_idx ON notes USING gin (to_tsvector('simple', content))`);
    await q.query(`
      CREATE TABLE note_evidence (
        note_id uuid NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
        message_id uuid REFERENCES messages(id) ON DELETE CASCADE,
        episode_id uuid REFERENCES episodes(id) ON DELETE CASCADE,
        quote text,
        CHECK (message_id IS NOT NULL OR episode_id IS NOT NULL)
      )`);
    await q.query(`CREATE INDEX note_evidence_note_idx ON note_evidence(note_id)`);
    await q.query(`CREATE INDEX note_evidence_message_idx ON note_evidence(message_id)`);
    await q.query(`
      CREATE TABLE note_changes (
        seq bigserial PRIMARY KEY,
        owner_id uuid NOT NULL REFERENCES owners(person_id) ON DELETE CASCADE,
        note_id uuid NOT NULL,
        change note_change NOT NULL,
        at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX note_changes_owner_seq_idx ON note_changes(owner_id, seq)`);
    for (const [key, description, cardinality] of SLOTS) {
      await q.query(`INSERT INTO fact_slots (key, description, cardinality) VALUES ($1, $2, $3) ON CONFLICT (key) DO NOTHING`, [key, description, cardinality]);
    }
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS note_changes, note_evidence, notes CASCADE`);
    await q.query(`DROP TYPE IF EXISTS note_change, note_status, note_category`);
    await q.query(`DELETE FROM fact_slots WHERE key = ANY($1) AND NOT EXISTS (SELECT 1 FROM facts f WHERE f.key = fact_slots.key)`, [SLOTS.map(([k]) => k)]);
  }
}
