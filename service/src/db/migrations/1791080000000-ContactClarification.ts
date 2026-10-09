// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * D50, WORK_PLAN 8.4 (owner's decision 2026-10-09) — "same person?" clarifications. A participant identified for the first
 * time whose name matches a contact the memory knows only by a first name becomes a new contact, and a clarification asks
 * whether the two are one person: `clarifications.contact_id` is that new contact (the candidates hold the existing one).
 * Such a question concerns no episode, fact or note.
 */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class ContactClarification1791080000000 implements MigrationInterface {
  name = 'ContactClarification1791080000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE clarifications ADD COLUMN contact_id uuid REFERENCES persons(id) ON DELETE CASCADE,
      ADD CONSTRAINT clarifications_contact_check CHECK (contact_id IS NULL OR num_nonnulls(episode_id, fact_id, note_id) = 0)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE clarifications DROP CONSTRAINT clarifications_contact_check, DROP COLUMN contact_id`);
  }
}
