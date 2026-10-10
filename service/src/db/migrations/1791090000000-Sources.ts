// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * D49, WORK_PLAN 8.9 — learned sources: what the agent learned (a manual, a page, a note, its own text) kept apart from
 * episodes, facts and notes. A source arrives as text (the client turns files into text), in one request or in parts,
 * and is split into passages embedded in the background; no size limit (owner's decision 2026-10-10). The learning is
 * an episode linked to its source both ways (`episode_sources`); forgetting a source deletes it with its passages and
 * leaves the episodes a "forgotten source" marker. The embedding dimension is the installation's (that of episodes).
 */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class Sources1791090000000 implements MigrationInterface {
  name = 'Sources1791090000000';

  async up(q: QueryRunner): Promise<void> {
    const [{ dim }] = await q.query(
      `SELECT atttypmod AS dim FROM pg_attribute WHERE attrelid = 'episodes'::regclass AND attname = 'embedding'`);
    await q.query(`
      CREATE TABLE sources (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id uuid NOT NULL REFERENCES owners(person_id) ON DELETE CASCADE,
        client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
        external_id text NOT NULL,
        title text NOT NULL,
        kind text NOT NULL DEFAULT 'document' CHECK (kind IN ('document', 'page', 'note', 'book', 'own_text')),
        author text,
        origin_uri text,
        language text,
        provided_by_kind text NOT NULL DEFAULT 'self' CHECK (provided_by_kind IN ('self', 'contact', 'someone')),
        provided_by_person_id uuid REFERENCES persons(id) ON DELETE SET NULL,
        learned_at timestamptz NOT NULL,
        conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
        status text NOT NULL DEFAULT 'receiving' CHECK (status IN ('receiving', 'indexing', 'ready')),
        parts int NOT NULL DEFAULT 0,
        chars bigint NOT NULL DEFAULT 0,
        content_hash bytea,
        learned_episode_id uuid REFERENCES episodes(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT sources_provider_check CHECK (provided_by_person_id IS NULL OR provided_by_kind = 'contact')
      )`);
    // One source per client id (the client's own id for it); a source sent without a client (MCP of a personal token) has one too.
    await q.query(`CREATE UNIQUE INDEX sources_external_idx ON sources (owner_id, COALESCE(client_id, '00000000-0000-0000-0000-000000000000'::uuid), external_id)`);
    await q.query(`CREATE INDEX sources_owner_idx ON sources (owner_id, learned_at DESC)`);
    await q.query(`CREATE INDEX sources_conversation_idx ON sources (conversation_id) WHERE conversation_id IS NOT NULL`);
    await q.query(`
      CREATE TABLE source_passages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        source_id uuid NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
        owner_id uuid NOT NULL REFERENCES owners(person_id) ON DELETE CASCADE,
        ordinal int NOT NULL,
        heading text,
        content text NOT NULL,
        tsv tsvector GENERATED ALWAYS AS (to_tsvector('simple', COALESCE(heading, '') || ' ' || content)) STORED,
        embedding vector(${Number(dim)}),
        embedding_model text,
        UNIQUE (source_id, ordinal)
      )`);
    await q.query(`CREATE INDEX source_passages_owner_idx ON source_passages (owner_id)`);
    await q.query(`CREATE INDEX source_passages_tsv_idx ON source_passages USING gin (tsv)`);
    await q.query(`CREATE INDEX source_passages_embedding_idx ON source_passages USING hnsw (embedding vector_cosine_ops)`);
    await q.query(`CREATE INDEX source_passages_pending_idx ON source_passages (source_id) WHERE embedding IS NULL`);
    await q.query(`
      CREATE TABLE episode_sources (
        id bigserial PRIMARY KEY,
        episode_id uuid NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
        source_id uuid REFERENCES sources(id) ON DELETE SET NULL,
        forgotten_at timestamptz,
        CHECK (source_id IS NOT NULL OR forgotten_at IS NOT NULL)
      )`);
    await q.query(`CREATE UNIQUE INDEX episode_sources_link_idx ON episode_sources (episode_id, source_id) WHERE source_id IS NOT NULL`);
    await q.query(`CREATE INDEX episode_sources_source_idx ON episode_sources (source_id)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE episode_sources`);
    await q.query(`DROP TABLE source_passages`);
    await q.query(`DROP TABLE sources`);
  }
}
