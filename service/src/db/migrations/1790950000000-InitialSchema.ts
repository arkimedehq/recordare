// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Data model v1, home / research profile (docs/DATA_MODEL.md rev 3, D33). Tables of the public
 * profile (owner sessions, OAuth clients, link codes, idempotency keys, read audit) and deferred
 * tables (relationships, grants, autonomy settings, snapshots) are not created here.
 *
 * The embedding dimension is fixed per installation (D27) and read from EMBEDDING_DIM.
 */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

function embeddingDim(): number {
  const dim = Number(process.env['EMBEDDING_DIM']);
  if (!Number.isInteger(dim) || dim <= 0) throw new Error('EMBEDDING_DIM must be set for the initial migration');
  return dim;
}

export class InitialSchema1790950000000 implements MigrationInterface {
  name = 'InitialSchema1790950000000';

  async up(q: QueryRunner): Promise<void> {
    const dim = embeddingDim();
    const vec = `vector(${dim})`;
    // Shared column groups (docs/DATA_MODEL.md → Shared columns).
    const provenance = `
      origin origin_kind NOT NULL,
      author_role author_role NOT NULL,
      stance stance NOT NULL DEFAULT 'stated',
      confidence real NOT NULL DEFAULT 1 CHECK (confidence BETWEEN 0 AND 1),
      extraction_run_id uuid REFERENCES extraction_runs(id) ON DELETE SET NULL`;
    const disclosure = `
      disclosure disclosure_tier NOT NULL DEFAULT 'owner',
      audience uuid[] NOT NULL,
      audience_unverified text[] NOT NULL DEFAULT '{}',
      confidence_of uuid REFERENCES persons(id) ON DELETE SET NULL`;
    const embedding = `
      embedding ${vec},
      embedding_model text,
      embedding_text text`;

    await q.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    await q.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await q.query(`CREATE EXTENSION IF NOT EXISTS unaccent`);

    // ── Enums ────────────────────────────────────────────────────────────────────
    const enums: Record<string, string[]> = {
      person_kind: ['human'],
      client_kind: ['platform', 'mcp_client', 'import'],
      raw_log_scope: ['own', 'all'],
      token_kind: ['personal'],
      identity_kind: ['client_user', 'channel'],
      conversation_source: ['chat', 'voice', 'mcp_tool', 'import_chat', 'import_social', 'import_email', 'import_notes', 'interview'],
      participant_role: ['owner', 'assistant', 'other'],
      message_role: ['user', 'assistant', 'tool', 'other'],
      origin_kind: ['owner_lived', 'owner_told', 'assistant_stated'],
      author_role: ['owner', 'assistant', 'other', 'tool'],
      stance: ['stated', 'inferred'],
      disclosure_tier: ['owner', 'inner', 'friends', 'acquaintances', 'public'],
      date_precision: ['minute', 'day', 'month', 'year', 'approximate', 'unknown'],
      episode_kind: ['event', 'plan', 'state_change'],
      plan_status: ['open', 'confirmed', 'cancelled', 'rescheduled', 'unresolved'],
      evidence_kind: ['message', 'agent_paraphrase'],
      plan_patch: ['open', 'confirm', 'cancel', 'reschedule', 'amend', 'expire'],
      promotion_status: ['proposed', 'confirmed', 'rejected'],
      digest_level: ['day', 'month'],
      slot_cardinality: ['single', 'multi'],
      fact_status: ['current', 'superseded', 'corrected', 'unknown_current'],
      fact_verdict: ['new', 'keep', 'stale', 'replace', 'corrects', 'unknown'],
      run_kind: ['extraction', 'digest', 'consolidation'],
      run_status: ['running', 'done', 'failed'],
      alias_source: ['extracted', 'manual'],
      tombstone_scope: ['episode', 'period', 'conversation', 'message'],
    };
    for (const [name, values] of Object.entries(enums)) {
      await q.query(`CREATE TYPE ${name} AS ENUM (${values.map((v) => `'${v}'`).join(', ')})`);
    }

    // ── Identity ─────────────────────────────────────────────────────────────────
    await q.query(`
      CREATE TABLE persons (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_scope uuid,
        display_name text NOT NULL,
        kind person_kind NOT NULL DEFAULT 'human',
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`
      CREATE TABLE owners (
        person_id uuid PRIMARY KEY REFERENCES persons(id) ON DELETE CASCADE,
        email text UNIQUE,
        locale text NOT NULL DEFAULT 'it',
        timezone text NOT NULL DEFAULT 'Europe/Rome',
        episodic_enabled boolean NOT NULL DEFAULT false,
        episodic_enabled_at timestamptz,
        episodic_enabled_by text,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    // Contacts belong to one owner's memory (never shared across owners).
    await q.query(`ALTER TABLE persons ADD CONSTRAINT persons_owner_scope_fk FOREIGN KEY (owner_scope) REFERENCES owners(person_id) ON DELETE CASCADE`);
    await q.query(`CREATE INDEX persons_owner_scope_idx ON persons(owner_scope)`);

    await q.query(`
      CREATE TABLE clients (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        kind client_kind NOT NULL,
        auto_provision boolean NOT NULL DEFAULT false,
        raw_log_scope raw_log_scope NOT NULL DEFAULT 'own',
        created_at timestamptz NOT NULL DEFAULT now(),
        disabled_at timestamptz
      )`);
    await q.query(`
      CREATE TABLE api_keys (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
        prefix text NOT NULL UNIQUE,
        hash text NOT NULL,
        scopes text[] NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        last_used_at timestamptz,
        revoked_at timestamptz
      )`);
    await q.query(`
      CREATE TABLE access_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id uuid NOT NULL REFERENCES owners(person_id) ON DELETE CASCADE,
        client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        kind token_kind NOT NULL DEFAULT 'personal',
        prefix text NOT NULL UNIQUE,
        hash text NOT NULL,
        scopes text[] NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz,
        last_used_at timestamptz,
        revoked_at timestamptz
      )`);
    await q.query(`
      CREATE TABLE external_identities (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_scope uuid REFERENCES owners(person_id) ON DELETE CASCADE,
        person_id uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
        kind identity_kind NOT NULL,
        client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
        channel text,
        external_id text NOT NULL,
        verified_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CHECK ((kind = 'client_user' AND client_id IS NOT NULL AND channel IS NULL)
            OR (kind = 'channel' AND channel IS NOT NULL AND client_id IS NULL))
      )`);
    await q.query(`CREATE UNIQUE INDEX external_identities_client_user_uq ON external_identities(client_id, external_id) WHERE kind = 'client_user'`);
    await q.query(`CREATE UNIQUE INDEX external_identities_channel_uq ON external_identities(COALESCE(owner_scope, '00000000-0000-0000-0000-000000000000'::uuid), channel, external_id) WHERE kind = 'channel'`);
    await q.query(`
      CREATE TABLE person_aliases (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id uuid NOT NULL REFERENCES owners(person_id) ON DELETE CASCADE,
        person_id uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
        alias text NOT NULL,
        alias_norm text NOT NULL,
        source alias_source NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX person_aliases_norm_trgm ON person_aliases USING gin (alias_norm gin_trgm_ops)`);
    await q.query(`CREATE INDEX person_aliases_owner_idx ON person_aliases(owner_id)`);

    // ── Engine bookkeeping (referenced by memory rows) ────────────────────────────
    await q.query(`
      CREATE TABLE extraction_runs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id uuid NOT NULL REFERENCES owners(person_id) ON DELETE CASCADE,
        conversation_id uuid,
        kind run_kind NOT NULL,
        window_from timestamptz,
        window_to timestamptz,
        model text NOT NULL,
        provider text NOT NULL,
        prompt_version text NOT NULL,
        status run_status NOT NULL DEFAULT 'running',
        error text,
        started_at timestamptz NOT NULL DEFAULT now(),
        finished_at timestamptz
      )`);
    await q.query(`CREATE INDEX extraction_runs_owner_idx ON extraction_runs(owner_id, started_at)`);

    // ── Layer 0 — raw log ───────────────────────────────────────────────────────
    await q.query(`
      CREATE TABLE conversations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id uuid NOT NULL REFERENCES owners(person_id) ON DELETE CASCADE,
        client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        external_id text NOT NULL,
        source conversation_source NOT NULL DEFAULT 'chat',
        channel text,
        title text,
        started_at timestamptz NOT NULL,
        last_message_at timestamptz NOT NULL,
        idle_job_at timestamptz,
        deleted_at timestamptz,
        UNIQUE (client_id, owner_id, external_id)
      )`);
    await q.query(`ALTER TABLE extraction_runs ADD CONSTRAINT extraction_runs_conversation_fk FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL`);
    await q.query(`
      CREATE TABLE conversation_participants (
        conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        ref text NOT NULL,
        person_id uuid REFERENCES persons(id) ON DELETE SET NULL,
        role participant_role NOT NULL,
        display_name text,
        joined_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (conversation_id, ref)
      )`);
    await q.query(`
      CREATE TABLE messages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        owner_id uuid NOT NULL REFERENCES owners(person_id) ON DELETE CASCADE,
        external_id text NOT NULL,
        role message_role NOT NULL,
        tool_name text,
        author_person_id uuid REFERENCES persons(id) ON DELETE SET NULL,
        content text NOT NULL,
        content_hash bytea NOT NULL,
        sent_at timestamptz NOT NULL,
        received_at timestamptz NOT NULL DEFAULT now(),
        extracted_run_id uuid REFERENCES extraction_runs(id) ON DELETE SET NULL,
        edited_at timestamptz,
        tsv tsvector GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED,
        embedding ${vec},
        UNIQUE (conversation_id, external_id)
      )`);
    await q.query(`CREATE INDEX messages_owner_sent_idx ON messages(owner_id, sent_at)`);
    await q.query(`CREATE INDEX messages_pending_idx ON messages(conversation_id, sent_at) WHERE extracted_run_id IS NULL`);
    await q.query(`CREATE INDEX messages_tsv_idx ON messages USING gin (tsv)`);
    await q.query(`CREATE INDEX messages_embedding_idx ON messages USING hnsw (embedding vector_cosine_ops)`);
    await q.query(`
      CREATE TABLE message_revisions (
        message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        content text NOT NULL,
        replaced_at timestamptz NOT NULL DEFAULT now()
      )`);

    // ── Layer 1 — episodes ──────────────────────────────────────────────────────
    await q.query(`
      CREATE TABLE episodes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id uuid NOT NULL REFERENCES owners(person_id) ON DELETE CASCADE,
        kind episode_kind NOT NULL,
        content text NOT NULL,
        occurred_at timestamptz,
        occurred_until timestamptz,
        date_precision date_precision NOT NULL DEFAULT 'unknown',
        time_expression text,
        recorded_at timestamptz NOT NULL DEFAULT now(),
        place text,
        importance smallint NOT NULL DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
        valence smallint CHECK (valence BETWEEN -2 AND 2),
        feelings text[] NOT NULL DEFAULT '{}',
        opinion text,
        keywords text[] NOT NULL DEFAULT '{}',
        context text,
        tags text[] NOT NULL DEFAULT '{}',
        plan_status plan_status,
        plan_status_at timestamptz,
        rescheduled_to uuid REFERENCES episodes(id) ON DELETE SET NULL,
        confirmed_by uuid REFERENCES episodes(id) ON DELETE SET NULL,
        corrects uuid REFERENCES episodes(id) ON DELETE SET NULL,
        invalidated_at timestamptz,
        duplicate_of uuid REFERENCES episodes(id) ON DELETE SET NULL,
        linked_notes text[] NOT NULL DEFAULT '{}',
        access_count integer NOT NULL DEFAULT 0,
        last_accessed_at timestamptz,
        ${provenance},
        ${disclosure},
        ${embedding},
        deleted_at timestamptz,
        CHECK ((kind = 'plan') = (plan_status IS NOT NULL))
      )`);
    await q.query(`CREATE INDEX episodes_owner_time_live_idx ON episodes(owner_id, occurred_at) WHERE deleted_at IS NULL AND invalidated_at IS NULL AND duplicate_of IS NULL`);
    await q.query(`CREATE INDEX episodes_owner_plan_idx ON episodes(owner_id, kind, plan_status)`);
    await q.query(`CREATE INDEX episodes_embedding_idx ON episodes USING hnsw (embedding vector_cosine_ops)`);
    await q.query(`CREATE INDEX episodes_tags_idx ON episodes USING gin (tags)`);
    await q.query(`CREATE INDEX episodes_keywords_idx ON episodes USING gin (keywords)`);
    await q.query(`CREATE INDEX episodes_audience_idx ON episodes USING gin (audience)`);
    await q.query(`CREATE INDEX episodes_fts_idx ON episodes USING gin (to_tsvector('simple', content))`);
    await q.query(`
      CREATE TABLE episode_evidence (
        episode_id uuid NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
        message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        evidence_kind evidence_kind NOT NULL DEFAULT 'message',
        quote text,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (episode_id, message_id)
      )`);
    await q.query(`CREATE INDEX episode_evidence_message_idx ON episode_evidence(message_id)`);
    await q.query(`
      CREATE TABLE episode_people (
        episode_id uuid NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
        alias text NOT NULL,
        person_id uuid REFERENCES persons(id) ON DELETE SET NULL,
        role text
      )`);
    await q.query(`CREATE INDEX episode_people_episode_idx ON episode_people(episode_id)`);
    await q.query(`
      CREATE TABLE plan_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_id uuid NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
        patch plan_patch NOT NULL,
        evidence_message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
        new_plan_id uuid REFERENCES episodes(id) ON DELETE SET NULL,
        note text,
        created_at timestamptz NOT NULL DEFAULT now(),
        extraction_run_id uuid REFERENCES extraction_runs(id) ON DELETE SET NULL
      )`);
    await q.query(`CREATE INDEX plan_events_plan_idx ON plan_events(plan_id)`);
    await q.query(`
      CREATE TABLE episode_promotions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id uuid NOT NULL REFERENCES owners(person_id) ON DELETE CASCADE,
        pattern text NOT NULL,
        episode_ids uuid[] NOT NULL,
        proposed_note_ref text,
        status promotion_status NOT NULL DEFAULT 'proposed',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);

    // ── Layer 2 — digests ───────────────────────────────────────────────────────
    await q.query(`
      CREATE TABLE digests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id uuid NOT NULL REFERENCES owners(person_id) ON DELETE CASCADE,
        level digest_level NOT NULL,
        period_start date NOT NULL,
        period_end date NOT NULL,
        content text NOT NULL,
        version integer NOT NULL DEFAULT 1,
        superseded_at timestamptz,
        disclosure disclosure_tier NOT NULL DEFAULT 'owner',
        audience uuid[] NOT NULL,
        extraction_run_id uuid REFERENCES extraction_runs(id) ON DELETE SET NULL,
        ${embedding},
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE UNIQUE INDEX digests_current_uq ON digests(owner_id, level, period_start) WHERE superseded_at IS NULL`);
    await q.query(`CREATE INDEX digests_embedding_idx ON digests USING hnsw (embedding vector_cosine_ops)`);
    await q.query(`
      CREATE TABLE digest_sources (
        digest_id uuid NOT NULL REFERENCES digests(id) ON DELETE CASCADE,
        episode_id uuid REFERENCES episodes(id) ON DELETE CASCADE,
        source_digest_id uuid REFERENCES digests(id) ON DELETE CASCADE,
        CHECK ((episode_id IS NULL) <> (source_digest_id IS NULL))
      )`);
    await q.query(`CREATE INDEX digest_sources_digest_idx ON digest_sources(digest_id)`);
    await q.query(`CREATE INDEX digest_sources_episode_idx ON digest_sources(episode_id)`);

    // ── Layer 3 — facts (D31) ───────────────────────────────────────────────────
    await q.query(`
      CREATE TABLE fact_slots (
        key text PRIMARY KEY,
        description text NOT NULL,
        cardinality slot_cardinality NOT NULL DEFAULT 'single',
        update_policy text,
        default_disclosure disclosure_tier NOT NULL DEFAULT 'owner',
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`
      CREATE TABLE facts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id uuid NOT NULL REFERENCES owners(person_id) ON DELETE CASCADE,
        subject_person_id uuid REFERENCES persons(id) ON DELETE CASCADE,
        key text NOT NULL REFERENCES fact_slots(key),
        value text,
        status fact_status NOT NULL DEFAULT 'current',
        valid_from timestamptz,
        valid_to timestamptz,
        date_precision date_precision NOT NULL DEFAULT 'unknown',
        time_expression text,
        recorded_at timestamptz NOT NULL DEFAULT now(),
        expired_at timestamptz,
        supersedes uuid REFERENCES facts(id) ON DELETE SET NULL,
        corrects uuid REFERENCES facts(id) ON DELETE SET NULL,
        verdict fact_verdict NOT NULL DEFAULT 'new',
        support_count integer NOT NULL DEFAULT 1,
        pending boolean NOT NULL DEFAULT false,
        ${provenance},
        ${disclosure},
        ${embedding},
        deleted_at timestamptz,
        CHECK ((status = 'unknown_current') = (value IS NULL))
      )`);
    await q.query(`CREATE INDEX facts_owner_key_idx ON facts(owner_id, subject_person_id, key, status)`);
    await q.query(`CREATE INDEX facts_embedding_idx ON facts USING hnsw (embedding vector_cosine_ops)`);
    await q.query(`CREATE INDEX facts_audience_idx ON facts USING gin (audience)`);
    // At most one current row per single-value slot (cardinality looked up by trigger).
    await q.query(`
      CREATE FUNCTION facts_single_current_check() RETURNS trigger AS $$
      BEGIN
        -- Serialise writers of the same slot so concurrent extractions cannot both pass the check.
        PERFORM pg_advisory_xact_lock(hashtextextended(
          NEW.owner_id::text || '|' || COALESCE(NEW.subject_person_id::text, '') || '|' || NEW.key, 0));
        IF NEW.status = 'current' AND NEW.deleted_at IS NULL
           AND (SELECT cardinality FROM fact_slots WHERE key = NEW.key) = 'single'
           AND EXISTS (
             SELECT 1 FROM facts f
             WHERE f.owner_id = NEW.owner_id AND f.key = NEW.key AND f.id <> NEW.id
               AND f.subject_person_id IS NOT DISTINCT FROM NEW.subject_person_id
               AND f.status = 'current' AND f.deleted_at IS NULL)
        THEN
          RAISE EXCEPTION 'single-value slot % already has a current fact', NEW.key USING ERRCODE = 'unique_violation';
        END IF;
        RETURN NEW;
      END $$ LANGUAGE plpgsql`);
    await q.query(`CREATE TRIGGER facts_single_current BEFORE INSERT OR UPDATE ON facts FOR EACH ROW EXECUTE FUNCTION facts_single_current_check()`);
    await q.query(`
      CREATE TABLE fact_evidence (
        fact_id uuid NOT NULL REFERENCES facts(id) ON DELETE CASCADE,
        message_id uuid REFERENCES messages(id) ON DELETE CASCADE,
        episode_id uuid REFERENCES episodes(id) ON DELETE CASCADE,
        quote text,
        CHECK (message_id IS NOT NULL OR episode_id IS NOT NULL)
      )`);
    await q.query(`CREATE INDEX fact_evidence_fact_idx ON fact_evidence(fact_id)`);
    await q.query(`CREATE INDEX fact_evidence_message_idx ON fact_evidence(message_id)`);

    // ── Engine bookkeeping ──────────────────────────────────────────────────────
    await q.query(`
      CREATE TABLE run_outputs (
        run_id uuid NOT NULL REFERENCES extraction_runs(id) ON DELETE CASCADE,
        table_name text NOT NULL,
        row_id uuid NOT NULL
      )`);
    await q.query(`CREATE INDEX run_outputs_row_idx ON run_outputs(row_id)`);
    await q.query(`
      CREATE TABLE llm_calls (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id uuid REFERENCES owners(person_id) ON DELETE SET NULL,
        client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
        run_id uuid REFERENCES extraction_runs(id) ON DELETE SET NULL,
        prompt_id text NOT NULL,
        provider text NOT NULL,
        model text NOT NULL,
        input_tokens integer NOT NULL DEFAULT 0,
        cached_input_tokens integer NOT NULL DEFAULT 0,
        output_tokens integer NOT NULL DEFAULT 0,
        latency_ms integer NOT NULL DEFAULT 0,
        status text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX llm_calls_owner_day_idx ON llm_calls(owner_id, created_at)`);
    await q.query(`
      CREATE TABLE forget_tombstones (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id uuid NOT NULL REFERENCES owners(person_id) ON DELETE CASCADE,
        scope tombstone_scope NOT NULL,
        episode_fingerprint bytea,
        message_ids uuid[] NOT NULL DEFAULT '{}',
        period_from timestamptz,
        period_to timestamptz,
        conversation_id uuid,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX forget_tombstones_owner_idx ON forget_tombstones(owner_id)`);
  }

  async down(q: QueryRunner): Promise<void> {
    for (const t of ['forget_tombstones', 'llm_calls', 'run_outputs', 'fact_evidence', 'facts', 'fact_slots',
      'digest_sources', 'digests', 'episode_promotions', 'plan_events', 'episode_people', 'episode_evidence',
      'episodes', 'message_revisions', 'messages', 'conversation_participants', 'extraction_runs', 'conversations',
      'person_aliases', 'external_identities', 'access_tokens', 'api_keys', 'clients']) {
      await q.query(`DROP TABLE IF EXISTS ${t} CASCADE`);
    }
    await q.query(`ALTER TABLE IF EXISTS persons DROP CONSTRAINT IF EXISTS persons_owner_scope_fk`);
    await q.query(`DROP TABLE IF EXISTS owners CASCADE`);
    await q.query(`DROP TABLE IF EXISTS persons CASCADE`);
    await q.query(`DROP FUNCTION IF EXISTS facts_single_current_check`);
    for (const e of ['person_kind', 'client_kind', 'raw_log_scope', 'token_kind', 'identity_kind', 'conversation_source',
      'participant_role', 'message_role', 'origin_kind', 'author_role', 'stance', 'disclosure_tier', 'date_precision',
      'episode_kind', 'plan_status', 'evidence_kind', 'plan_patch', 'promotion_status', 'digest_level',
      'slot_cardinality', 'fact_status', 'fact_verdict', 'run_kind', 'run_status', 'alias_source', 'tombstone_scope']) {
      await q.query(`DROP TYPE IF EXISTS ${e}`);
    }
  }
}
