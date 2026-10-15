// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Pending facts only propose a change (WORK_PLAN 6.5, `engine/pending.ts`): a single-value slot keeps one current stated
 * fact, and pending ones may stand next to it until one is confirmed (which retires the stated one first).
 */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

const check = (pending: boolean): string => `
  CREATE OR REPLACE FUNCTION facts_single_current_check() RETURNS trigger AS $$
  BEGIN
    -- Serialise writers of the same slot so concurrent extractions cannot both pass the check.
    PERFORM pg_advisory_xact_lock(hashtextextended(
      NEW.memory_id::text || '|' || COALESCE(NEW.subject_person_id::text, '') || '|' || NEW.key, 0));
    IF NEW.status = 'current' AND NEW.deleted_at IS NULL${pending ? ' AND NOT NEW.pending' : ''}
       AND (SELECT cardinality FROM fact_slots WHERE key = NEW.key) = 'single'
       AND EXISTS (
         SELECT 1 FROM facts f
         WHERE f.memory_id = NEW.memory_id AND f.key = NEW.key AND f.id <> NEW.id
           AND f.subject_person_id IS NOT DISTINCT FROM NEW.subject_person_id
           AND f.status = 'current' AND f.deleted_at IS NULL${pending ? ' AND NOT f.pending' : ''})
    THEN
      RAISE EXCEPTION 'single-value slot % already has a current fact', NEW.key USING ERRCODE = 'unique_violation';
    END IF;
    RETURN NEW;
  END $$ LANGUAGE plpgsql`;

export class PendingProposals1791160000000 implements MigrationInterface {
  name = 'PendingProposals1791160000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(check(true));
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(check(false));
  }
}
