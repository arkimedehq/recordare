// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * D50, WORK_PLAN 8.3 — memory identity (docs/DATA_MODEL.md → "Agent memory"). A memory belongs to an agent (one client
 * account); humans are contacts of one memory. Adds:
 * - `owners.mode` (personal | entity, from `persons.kind`, which goes) and `owners.gender` (first person, default masculine);
 * - contacts: every human that is not a memory's own row is scoped to one memory (deferred constraint trigger), with
 *   `full_name`, `relation` and names in `person_aliases`; a person referenced inside another memory (e.g. an owner who
 *   speaks in an entity memory) gets a contact row there and every reference in that memory moves to it;
 * - `external_identities.kind`: `account` (today's `client_user`: which memory a client account opens) and `participant`
 *   (a client's participant id or a channel id → a contact or the self of one memory);
 * - messages: `author_kind`, `attribution_method`, `attribution_confidence`;
 * - conversation sources `document`, `perception`, `ambient`;
 * - the subject of every memory row (`subject_kind`, `subject_person_id`, `subject_candidates`) on episodes, facts, notes;
 * - `clarifications` (created, no behaviour yet: WORK_PLAN 8.4 / 8.5).
 * Prompts and `origin` values do not change here (first person comes in 8.4).
 */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

/** Normalised alias (the same expression the code uses): lower case, no accents, trimmed. */
const NORM = (col: string) => `lower(unaccent(btrim(${col})))`;
/** "Marta (figlia)" → "Marta". */
const STRIP_RELATION = (col: string) => `regexp_replace(${col}, '\\s*\\(.*\\)\\s*$', '')`;
const MEMORY_TABLES = ['episodes', 'facts', 'notes'] as const;

export class MemoryIdentity1791070000000 implements MigrationInterface {
  name = 'MemoryIdentity1791070000000';

  async up(q: QueryRunner): Promise<void> {
    // ── The memory: mode and gender (from persons.kind) ─────────────────────────────────────────────────────────────
    await q.query(`CREATE TYPE memory_mode AS ENUM ('personal', 'entity')`);
    await q.query(`CREATE TYPE memory_gender AS ENUM ('masculine', 'feminine', 'neutral')`);
    await q.query(`ALTER TABLE owners ADD COLUMN mode memory_mode NOT NULL DEFAULT 'personal',
      ADD COLUMN gender memory_gender NOT NULL DEFAULT 'masculine'`);
    // ::text: 'entity' was added to person_kind by an earlier migration, possibly in this same transaction.
    await q.query(`UPDATE owners o SET mode = 'entity' FROM persons p WHERE p.id = o.person_id AND p.kind::text = 'entity'`);
    await q.query(`ALTER TABLE persons DROP COLUMN kind`);
    await q.query(`DROP TYPE person_kind`);

    // ── Contacts: names, full name, relation ────────────────────────────────────────────────────────────────────────
    await q.query(`ALTER TABLE persons ADD COLUMN full_name text, ADD COLUMN relation text`);
    await q.query(`ALTER TYPE alias_source RENAME TO alias_source_old`);
    await q.query(`CREATE TYPE alias_source AS ENUM ('extracted', 'manual', 'client')`);
    await q.query(`ALTER TABLE person_aliases ALTER COLUMN source TYPE alias_source USING source::text::alias_source`);
    await q.query(`DROP TYPE alias_source_old`);
    await q.query(`DELETE FROM person_aliases a USING person_aliases b
      WHERE a.person_id = b.person_id AND a.alias_norm = b.alias_norm AND (a.created_at, a.id) > (b.created_at, b.id)`);
    await q.query(`CREATE UNIQUE INDEX person_aliases_person_norm_uq ON person_aliases(person_id, alias_norm)`);

    // ── Identities: account | participant ───────────────────────────────────────────────────────────────────────────
    await q.query(`ALTER TABLE external_identities DROP CONSTRAINT external_identities_check`);
    await q.query(`DROP INDEX external_identities_client_user_uq`);
    await q.query(`DROP INDEX external_identities_channel_uq`);
    await q.query(`CREATE TYPE identity_kind_v2 AS ENUM ('account', 'participant')`);
    await q.query(`ALTER TABLE external_identities ALTER COLUMN kind TYPE identity_kind_v2
      USING (CASE kind::text WHEN 'client_user' THEN 'account' ELSE 'participant' END)::identity_kind_v2`);
    await q.query(`DROP TYPE identity_kind`);
    await q.query(`ALTER TYPE identity_kind_v2 RENAME TO identity_kind`);
    // A channel id bound to a memory's own person without a scope: a participant of that memory (its self).
    await q.query(`UPDATE external_identities i SET owner_scope = i.person_id
      WHERE i.kind = 'participant' AND i.owner_scope IS NULL AND EXISTS (SELECT 1 FROM owners o WHERE o.person_id = i.person_id)`);
    await q.query(`CREATE UNIQUE INDEX external_identities_account_uq ON external_identities(client_id, external_id) WHERE kind = 'account'`);
    await q.query(`CREATE UNIQUE INDEX external_identities_participant_client_uq ON external_identities(owner_scope, client_id, external_id)
      WHERE kind = 'participant' AND client_id IS NOT NULL`);
    await q.query(`CREATE UNIQUE INDEX external_identities_participant_channel_uq ON external_identities(owner_scope, channel, external_id)
      WHERE kind = 'participant' AND channel IS NOT NULL`);

    // ── Backfill: a contact row in every memory where a person of another memory (or of none) appears ──────────────
    const pairs: Array<{ owner_id: string; person_id: string; display_name: string }> = await q.query(`
      WITH refs(owner_id, person_id) AS (
        SELECT c.owner_id, cp.person_id FROM conversation_participants cp JOIN conversations c ON c.id = cp.conversation_id
          WHERE cp.person_id IS NOT NULL
        UNION SELECT owner_id, author_person_id FROM messages WHERE author_person_id IS NOT NULL
        UNION SELECT e.owner_id, ep.person_id FROM episode_people ep JOIN episodes e ON e.id = ep.episode_id WHERE ep.person_id IS NOT NULL
        UNION SELECT owner_id, subject_person_id FROM facts WHERE subject_person_id IS NOT NULL
        UNION SELECT owner_id, confidence_of FROM episodes WHERE confidence_of IS NOT NULL
        UNION SELECT owner_id, confidence_of FROM facts WHERE confidence_of IS NOT NULL
        UNION SELECT owner_id, confidence_of FROM notes WHERE confidence_of IS NOT NULL
        UNION SELECT owner_id, unnest(audience) FROM episodes
        UNION SELECT owner_id, unnest(audience) FROM facts
        UNION SELECT owner_id, unnest(audience) FROM notes
        UNION SELECT owner_id, unnest(audience) FROM digests
        UNION SELECT owner_scope, person_id FROM external_identities WHERE owner_scope IS NOT NULL
        UNION SELECT owner_id, person_id FROM person_aliases)
      SELECT r.owner_id, r.person_id, p.display_name FROM refs r JOIN persons p ON p.id = r.person_id
      WHERE r.person_id <> r.owner_id AND p.owner_scope IS DISTINCT FROM r.owner_id
      ORDER BY r.owner_id, p.created_at`);
    for (const { owner_id: m, person_id: p, display_name: name } of pairs) {
      const [{ id: c }] = await q.query(`INSERT INTO persons (owner_scope, display_name) VALUES ($1, $2) RETURNING id`, [m, name]);
      // The ids that named the person elsewhere (a client's user id, a global channel id) now name the contact here.
      await q.query(`INSERT INTO external_identities (owner_scope, person_id, kind, client_id, channel, external_id, verified_at)
        SELECT $1, $2, 'participant', client_id, channel, external_id, verified_at FROM external_identities
        WHERE person_id = $3 AND (kind = 'account' OR owner_scope IS NULL) ON CONFLICT DO NOTHING`, [m, c, p]);
      await q.query(`UPDATE external_identities SET person_id = $3 WHERE owner_scope = $1 AND person_id = $2`, [m, p, c]);
      await q.query(`UPDATE person_aliases SET person_id = $3 WHERE owner_id = $1 AND person_id = $2`, [m, p, c]);
      await q.query(`UPDATE conversation_participants cp SET person_id = $3 FROM conversations v
        WHERE v.id = cp.conversation_id AND v.owner_id = $1 AND cp.person_id = $2`, [m, p, c]);
      await q.query(`UPDATE messages SET author_person_id = $3 WHERE owner_id = $1 AND author_person_id = $2`, [m, p, c]);
      await q.query(`UPDATE episode_people ep SET person_id = $3 FROM episodes e
        WHERE e.id = ep.episode_id AND e.owner_id = $1 AND ep.person_id = $2`, [m, p, c]);
      await q.query(`UPDATE facts SET subject_person_id = $3 WHERE owner_id = $1 AND subject_person_id = $2`, [m, p, c]);
      for (const t of MEMORY_TABLES) {
        await q.query(`UPDATE ${t} SET confidence_of = $3 WHERE owner_id = $1 AND confidence_of = $2`, [m, p, c]);
      }
      for (const t of [...MEMORY_TABLES, 'digests']) {
        await q.query(`UPDATE ${t} SET audience = array_replace(audience, $2, $3) WHERE owner_id = $1 AND $2 = ANY(audience)`, [m, p, c]);
      }
    }
    // Persons that are neither a memory nor a contact are now referenced by no memory: gone (with their identities).
    await q.query(`DELETE FROM persons p WHERE p.owner_scope IS NULL AND NOT EXISTS (SELECT 1 FROM owners o WHERE o.person_id = p.id)`);
    // An account id bound to a contact (by hand) is a participant id of the contact's memory.
    await q.query(`INSERT INTO external_identities (owner_scope, person_id, kind, client_id, channel, external_id, verified_at)
      SELECT p.owner_scope, i.person_id, 'participant', i.client_id, NULL, i.external_id, i.verified_at
      FROM external_identities i JOIN persons p ON p.id = i.person_id
      WHERE i.kind = 'account' AND p.owner_scope IS NOT NULL ON CONFLICT DO NOTHING`);
    await q.query(`DELETE FROM external_identities i USING persons p WHERE p.id = i.person_id AND i.kind = 'account' AND p.owner_scope IS NOT NULL`);
    // A channel id bound to a contact without a scope: scoped to the contact's memory.
    await q.query(`INSERT INTO external_identities (owner_scope, person_id, kind, client_id, channel, external_id, verified_at)
      SELECT p.owner_scope, i.person_id, 'participant', NULL, i.channel, i.external_id, i.verified_at
      FROM external_identities i JOIN persons p ON p.id = i.person_id
      WHERE i.kind = 'participant' AND i.owner_scope IS NULL ON CONFLICT DO NOTHING`);
    await q.query(`DELETE FROM external_identities WHERE kind = 'participant' AND owner_scope IS NULL`);
    await q.query(`ALTER TABLE external_identities ADD CONSTRAINT external_identities_kind_check CHECK (
      (kind = 'account' AND client_id IS NOT NULL AND channel IS NULL AND owner_scope IS NULL)
      OR (kind = 'participant' AND owner_scope IS NOT NULL AND ((client_id IS NULL) <> (channel IS NULL))))`);
    // Every contact has its name among its aliases.
    await q.query(`INSERT INTO person_aliases (owner_id, person_id, alias, alias_norm, source)
      SELECT p.owner_scope, p.id, p.display_name, ${NORM('p.display_name')},
        CASE WHEN EXISTS (SELECT 1 FROM external_identities i WHERE i.person_id = p.id) THEN 'client' ELSE 'extracted' END::alias_source
      FROM persons p WHERE p.owner_scope IS NOT NULL ON CONFLICT DO NOTHING`);
    // A human is a memory's own row or a contact of exactly one memory (checked at commit: a memory's person row is
    // written just before its owners row).
    await q.query(`
      CREATE FUNCTION persons_scope_check() RETURNS trigger AS $$
      BEGIN
        IF NEW.owner_scope IS NULL AND EXISTS (SELECT 1 FROM persons WHERE id = NEW.id)
           AND NOT EXISTS (SELECT 1 FROM owners WHERE person_id = NEW.id) THEN
          RAISE EXCEPTION 'person % is neither a memory nor a contact of one: owner_scope is required', NEW.id USING ERRCODE = '23514';
        END IF;
        RETURN NULL;
      END $$ LANGUAGE plpgsql`);
    await q.query(`CREATE CONSTRAINT TRIGGER persons_scope_required AFTER INSERT OR UPDATE OF owner_scope ON persons
      DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION persons_scope_check()`);

    // ── Messages: who said it, how it was established, how sure ─────────────────────────────────────────────────────
    await q.query(`CREATE TYPE message_author_kind AS ENUM ('self', 'contact', 'someone', 'agent', 'own', 'tool')`);
    await q.query(`CREATE TYPE attribution_method AS ENUM ('account', 'declared', 'self_introduction', 'addressed_by_name', 'voiceprint',
      'face', 'client_assertion', 'none')`);
    await q.query(`ALTER TABLE messages ADD COLUMN author_kind message_author_kind, ADD COLUMN attribution_method attribution_method,
      ADD COLUMN attribution_confidence real CHECK (attribution_confidence BETWEEN 0 AND 1)`);
    // Entity memories: the account's speaker is not the entity — "someone" unless identified.
    await q.query(`UPDATE messages m SET author_person_id = NULL FROM owners o
      WHERE o.person_id = m.owner_id AND o.mode = 'entity' AND m.author_person_id = m.owner_id`);
    await q.query(`UPDATE conversation_participants cp SET person_id = NULL FROM conversations c JOIN owners o ON o.person_id = c.owner_id
      WHERE c.id = cp.conversation_id AND o.mode = 'entity' AND cp.person_id = c.owner_id`);
    await q.query(`UPDATE messages m SET author_kind = (CASE
        WHEN m.role = 'tool' THEN 'tool'
        WHEN m.role = 'assistant' THEN 'agent'
        WHEN m.author_person_id IS NOT NULL AND m.author_person_id <> m.owner_id THEN 'contact'
        WHEN o.mode = 'personal' AND (m.author_person_id = m.owner_id OR m.role = 'user') THEN 'self'
        ELSE 'someone' END)::message_author_kind
      FROM owners o WHERE o.person_id = m.owner_id`);
    await q.query(`UPDATE messages m SET author_person_id = m.owner_id WHERE m.author_kind = 'self' AND m.author_person_id IS NULL`);
    await q.query(`UPDATE messages m SET
        attribution_method = (CASE m.author_kind
          WHEN 'self' THEN 'account'
          WHEN 'someone' THEN 'none'
          WHEN 'contact' THEN CASE WHEN EXISTS (SELECT 1 FROM external_identities i WHERE i.person_id = m.author_person_id AND i.client_id IS NOT NULL)
            THEN 'client_assertion' ELSE 'declared' END
          ELSE 'client_assertion' END)::attribution_method,
        attribution_confidence = CASE WHEN m.author_kind = 'someone' THEN NULL ELSE 1 END`);
    await q.query(`ALTER TABLE messages ALTER COLUMN author_kind SET NOT NULL, ALTER COLUMN attribution_method SET NOT NULL`);

    // ── Sources ─────────────────────────────────────────────────────────────────────────────────────────────────────
    for (const v of ['document', 'perception', 'ambient']) await q.query(`ALTER TYPE conversation_source ADD VALUE IF NOT EXISTS '${v}'`);

    // ── Subject of every memory row ─────────────────────────────────────────────────────────────────────────────────
    await q.query(`CREATE TYPE subject_kind AS ENUM ('self', 'contact', 'someone', 'undecided')`);
    for (const t of MEMORY_TABLES) {
      await q.query(`ALTER TABLE ${t} ADD COLUMN subject_kind subject_kind NOT NULL DEFAULT 'self',
        ADD COLUMN subject_candidates uuid[] NOT NULL DEFAULT '{}'`);
    }
    for (const t of ['episodes', 'notes']) {
      await q.query(`ALTER TABLE ${t} ADD COLUMN subject_person_id uuid REFERENCES persons(id) ON DELETE SET NULL`);
    }
    // Facts keep their subject (entity memories: a contact, or the entity itself).
    await q.query(`UPDATE facts SET subject_kind = 'contact' WHERE subject_person_id IS NOT NULL`);
    // Entity memories: notes and episodes are someone's, an episode the contact's when it names exactly one known contact.
    await q.query(`UPDATE notes n SET subject_kind = 'someone' FROM owners o WHERE o.person_id = n.owner_id AND o.mode = 'entity'`);
    await q.query(`UPDATE episodes e SET subject_kind = 'someone' FROM owners o WHERE o.person_id = e.owner_id AND o.mode = 'entity'`);
    await q.query(`
      WITH named AS (
        SELECT e.id, array_agg(DISTINCT c.id) AS contacts
        FROM episodes e JOIN owners o ON o.person_id = e.owner_id AND o.mode = 'entity'
          JOIN episode_people ep ON ep.episode_id = e.id
          JOIN persons c ON c.owner_scope = e.owner_id AND (c.id = ep.person_id OR EXISTS (
            SELECT 1 FROM person_aliases a WHERE a.person_id = c.id AND a.alias_norm = ${NORM(STRIP_RELATION('ep.alias'))}))
        GROUP BY e.id)
      UPDATE episodes e SET subject_kind = 'contact', subject_person_id = n.contacts[1]
      FROM named n WHERE n.id = e.id AND cardinality(n.contacts) = 1`);

    // ── Clarifications (Recordare's first initiative, L1): created, no behaviour yet ────────────────────────────────
    await q.query(`CREATE TYPE clarification_status AS ENUM ('open', 'resolved', 'expired')`);
    await q.query(`
      CREATE TABLE clarifications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id uuid NOT NULL REFERENCES owners(person_id) ON DELETE CASCADE,
        question text NOT NULL,
        candidates uuid[] NOT NULL DEFAULT '{}',
        episode_id uuid REFERENCES episodes(id) ON DELETE CASCADE,
        fact_id uuid REFERENCES facts(id) ON DELETE CASCADE,
        note_id uuid REFERENCES notes(id) ON DELETE CASCADE,
        status clarification_status NOT NULL DEFAULT 'open',
        resolution text,
        resolved_person_id uuid REFERENCES persons(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        resolved_at timestamptz,
        CHECK (num_nonnulls(episode_id, fact_id, note_id) <= 1),
        CHECK ((status = 'open') = (resolved_at IS NULL))
      )`);
    await q.query(`CREATE INDEX clarifications_owner_open_idx ON clarifications(owner_id, created_at) WHERE status = 'open'`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE clarifications`);
    await q.query(`DROP TYPE clarification_status`);
    for (const t of ['episodes', 'notes']) await q.query(`ALTER TABLE ${t} DROP COLUMN subject_person_id`);
    for (const t of MEMORY_TABLES) await q.query(`ALTER TABLE ${t} DROP COLUMN subject_kind, DROP COLUMN subject_candidates`);
    await q.query(`DROP TYPE subject_kind`);

    // Postgres cannot drop an enum value: conversations of the new sources become chats, the values stay unused.
    await q.query(`UPDATE conversations SET source = 'chat' WHERE source::text IN ('document', 'perception', 'ambient')`);

    // Entity memories: the account's speaker was recorded as the entity.
    await q.query(`UPDATE messages m SET author_person_id = m.owner_id FROM owners o
      WHERE o.person_id = m.owner_id AND o.mode = 'entity' AND m.author_kind = 'someone' AND m.author_person_id IS NULL
        AND (m.role = 'user' AND m.author_ref IS NULL OR EXISTS (SELECT 1 FROM conversation_participants cp
          WHERE cp.conversation_id = m.conversation_id AND cp.ref = m.author_ref AND cp.role = 'owner'))`);
    await q.query(`UPDATE conversation_participants cp SET person_id = c.owner_id FROM conversations c
      WHERE c.id = cp.conversation_id AND cp.role = 'owner' AND cp.person_id IS NULL`);
    await q.query(`ALTER TABLE messages DROP COLUMN author_kind, DROP COLUMN attribution_method, DROP COLUMN attribution_confidence`);
    await q.query(`DROP TYPE message_author_kind`);
    await q.query(`DROP TYPE attribution_method`);

    await q.query(`DROP TRIGGER persons_scope_required ON persons`);
    await q.query(`DROP FUNCTION persons_scope_check`);
    // Identities: participant ids of a client did not exist; channel ids stay scoped to their memory.
    await q.query(`ALTER TABLE external_identities DROP CONSTRAINT external_identities_kind_check`);
    await q.query(`DROP INDEX external_identities_account_uq`);
    await q.query(`DROP INDEX external_identities_participant_client_uq`);
    await q.query(`DROP INDEX external_identities_participant_channel_uq`);
    await q.query(`DELETE FROM external_identities WHERE kind = 'participant' AND client_id IS NOT NULL`);
    await q.query(`CREATE TYPE identity_kind_v1 AS ENUM ('client_user', 'channel')`);
    await q.query(`ALTER TABLE external_identities ALTER COLUMN kind TYPE identity_kind_v1
      USING (CASE kind::text WHEN 'account' THEN 'client_user' ELSE 'channel' END)::identity_kind_v1`);
    await q.query(`DROP TYPE identity_kind`);
    await q.query(`ALTER TYPE identity_kind_v1 RENAME TO identity_kind`);
    await q.query(`ALTER TABLE external_identities ADD CONSTRAINT external_identities_check CHECK (
      (kind = 'client_user' AND client_id IS NOT NULL AND channel IS NULL) OR (kind = 'channel' AND channel IS NOT NULL AND client_id IS NULL))`);
    await q.query(`CREATE UNIQUE INDEX external_identities_client_user_uq ON external_identities(client_id, external_id) WHERE kind = 'client_user'`);
    await q.query(`CREATE UNIQUE INDEX external_identities_channel_uq ON external_identities(COALESCE(owner_scope, '00000000-0000-0000-0000-000000000000'::uuid), channel, external_id) WHERE kind = 'channel'`);

    await q.query(`DROP INDEX person_aliases_person_norm_uq`);
    await q.query(`ALTER TYPE alias_source RENAME TO alias_source_v2`);
    await q.query(`CREATE TYPE alias_source AS ENUM ('extracted', 'manual')`);
    await q.query(`ALTER TABLE person_aliases ALTER COLUMN source TYPE alias_source
      USING (CASE source::text WHEN 'manual' THEN 'manual' ELSE 'extracted' END)::alias_source`);
    await q.query(`DROP TYPE alias_source_v2`);
    await q.query(`ALTER TABLE persons DROP COLUMN full_name, DROP COLUMN relation`);

    await q.query(`CREATE TYPE person_kind AS ENUM ('human', 'entity')`);
    await q.query(`ALTER TABLE persons ADD COLUMN kind person_kind NOT NULL DEFAULT 'human'`);
    await q.query(`UPDATE persons p SET kind = 'entity' FROM owners o WHERE o.person_id = p.id AND o.mode = 'entity'`);
    await q.query(`ALTER TABLE owners DROP COLUMN mode, DROP COLUMN gender`);
    await q.query(`DROP TYPE memory_mode`);
    await q.query(`DROP TYPE memory_gender`);
  }
}
