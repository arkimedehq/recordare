// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * WORK_PLAN 8.10 (D50) — names after the agent memory: a memory is no longer "an owner". Renames only, no data
 * changes beyond the renamed values:
 * - the `owners` table → `memories`; every `owner_id` column, and `owner_scope` (the memory a contact or a channel
 *   identity belongs to), → `memory_id`; indexes and constraints named after the owner follow;
 * - the person a personal memory belongs to is its holder: the enum value `owner` (participant role, author role,
 *   disclosure tier) → `holder`, `owner_lived` / `owner_told` → `holder_lived` / `holder_told`, the implied participant
 *   ref `owner` → `holder`;
 * - the token scope `owner_settings` → `memory_settings`; the gate marker of extraction runs follows;
 * - the two trigger functions that name the old columns are recreated.
 */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

const ENUM_VALUES: Array<[type: string, from: string, to: string]> = [
  ['participant_role', 'owner', 'holder'],
  ['author_role', 'owner', 'holder'],
  ['disclosure_tier', 'owner', 'holder'],
  ['origin_kind', 'owner_lived', 'holder_lived'],
  ['origin_kind', 'owner_told', 'holder_told'],
];

export class Memories1791100000000 implements MigrationInterface {
  name = 'Memories1791100000000';

  async up(q: QueryRunner): Promise<void> {
    await this.rename(q, { table: ['owners', 'memories'], column: [['owner_id', 'owner_scope'], 'memory_id'], from: 'owner' });
    for (const [type, from, to] of ENUM_VALUES) await q.query(`ALTER TYPE ${type} RENAME VALUE '${from}' TO '${to}'`);
    await this.values(q, 'owner', 'holder', 'owner_settings', 'memory_settings', 'gate:no-owner-message', 'gate:no-holder-message');
    await this.functions(q, 'memory_id', 'memories');
  }

  async down(q: QueryRunner): Promise<void> {
    await this.functions(q, 'owner_id', 'owners', 'owner_scope');
    await this.values(q, 'holder', 'owner', 'memory_settings', 'owner_settings', 'gate:no-holder-message', 'gate:no-owner-message');
    for (const [type, from, to] of ENUM_VALUES) await q.query(`ALTER TYPE ${type} RENAME VALUE '${to}' TO '${from}'`);
    // persons and external_identities had owner_scope, every other table owner_id.
    await q.query(`ALTER TABLE memories RENAME TO owners`);
    for (const t of ['persons', 'external_identities']) await q.query(`ALTER TABLE ${t} RENAME COLUMN memory_id TO owner_scope`);
    await this.rename(q, { column: [['memory_id'], 'owner_id'], from: 'memory' });
  }

  /** Table, columns, then every index and constraint whose name carries the old word. */
  private async rename(q: QueryRunner, r: { table?: [string, string]; column: [string[], string]; from: 'owner' | 'memory' }): Promise<void> {
    if (r.table) await q.query(`ALTER TABLE ${r.table[0]} RENAME TO ${r.table[1]}`);
    const columns: Array<{ table_name: string; column_name: string }> = await q.query(
      `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = current_schema() AND column_name = ANY($1)`, [r.column[0]]);
    for (const c of columns) await q.query(`ALTER TABLE "${c.table_name}" RENAME COLUMN "${c.column_name}" TO ${r.column[1]}`);
    const { from } = r;
    const constraints: Array<{ rel: string; name: string }> = await q.query(
      `SELECT c.conrelid::regclass::text AS rel, c.conname AS name FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
       WHERE n.nspname = current_schema() AND c.conname LIKE '%' || $1 || '%'`, [from === 'owner' ? 'owner' : 'memor']);
    for (const c of constraints) {
      const name = this.word(c.name, from);
      if (name !== c.name) await q.query(`ALTER TABLE ${c.rel} RENAME CONSTRAINT "${c.name}" TO "${name}"`);
    }
    const indexes: Array<{ name: string }> = await q.query(
      `SELECT i.relname AS name FROM pg_class i JOIN pg_namespace n ON n.oid = i.relnamespace
       WHERE i.relkind = 'i' AND n.nspname = current_schema() AND i.relname LIKE '%' || $1 || '%'`, [from === 'owner' ? 'owner' : 'memor']);
    for (const i of indexes) {
      const name = this.word(i.name, from);
      if (name !== i.name) await q.query(`ALTER INDEX "${i.name}" RENAME TO "${name}"`);
    }
  }

  /** owners_pkey → memories_pkey, persons_owner_scope_fk → persons_memory_id_fk, facts_owner_key_idx → facts_memory_key_idx. */
  private word(name: string, from: string): string {
    return from === 'owner'
      ? name.replace(/^owners_/, 'memories_').replace(/owner_scope|owner_id/g, 'memory_id').replace(/owner/g, 'memory')
      : name.replace(/^memories_/, 'owners_').replace(/memory_id/g, 'owner_id').replace(/memory/g, 'owner');
  }

  private async values(q: QueryRunner, ref: string, newRef: string, scope: string, newScope: string, gate: string, newGate: string): Promise<void> {
    await q.query(`UPDATE conversation_participants SET ref = $2 WHERE ref = $1`, [ref, newRef]);
    await q.query(`UPDATE messages SET author_ref = $2 WHERE author_ref = $1`, [ref, newRef]);
    for (const t of ['api_keys', 'access_tokens']) await q.query(`UPDATE ${t} SET scopes = array_replace(scopes, $1, $2) WHERE $1 = ANY(scopes)`, [scope, newScope]);
    await q.query(`UPDATE extraction_runs SET model = $2 WHERE model = $1`, [gate, newGate]);
  }

  private async functions(q: QueryRunner, column: string, table: string, scopeColumn = column): Promise<void> {
    await q.query(`
      CREATE OR REPLACE FUNCTION facts_single_current_check() RETURNS trigger AS $$
      BEGIN
        -- Serialise writers of the same slot so concurrent extractions cannot both pass the check.
        PERFORM pg_advisory_xact_lock(hashtextextended(
          NEW.${column}::text || '|' || COALESCE(NEW.subject_person_id::text, '') || '|' || NEW.key, 0));
        IF NEW.status = 'current' AND NEW.deleted_at IS NULL
           AND (SELECT cardinality FROM fact_slots WHERE key = NEW.key) = 'single'
           AND EXISTS (
             SELECT 1 FROM facts f
             WHERE f.${column} = NEW.${column} AND f.key = NEW.key AND f.id <> NEW.id
               AND f.subject_person_id IS NOT DISTINCT FROM NEW.subject_person_id
               AND f.status = 'current' AND f.deleted_at IS NULL)
        THEN
          RAISE EXCEPTION 'single-value slot % already has a current fact', NEW.key USING ERRCODE = 'unique_violation';
        END IF;
        RETURN NEW;
      END $$ LANGUAGE plpgsql`);
    // The constraint trigger fires on updates of the scope column: it follows the column rename by itself.
    await q.query(`
      CREATE OR REPLACE FUNCTION persons_scope_check() RETURNS trigger AS $$
      BEGIN
        IF NEW.${scopeColumn} IS NULL AND EXISTS (SELECT 1 FROM persons WHERE id = NEW.id)
           AND NOT EXISTS (SELECT 1 FROM ${table} WHERE person_id = NEW.id) THEN
          RAISE EXCEPTION 'person % is neither a memory nor a contact of one: ${scopeColumn} is required', NEW.id USING ERRCODE = '23514';
        END IF;
        RETURN NULL;
      END $$ LANGUAGE plpgsql`);
  }
}
