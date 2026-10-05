// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * The client's participant ref of each message's author. Unverified participants never become
 * persons, so without the ref the extractor could not tell which group member wrote a message
 * (a third party's claim about the owner then read as the owner's own words — M4b probe b34).
 */
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class MessageAuthorRef1790970000000 implements MigrationInterface {
  name = 'MessageAuthorRef1790970000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE messages ADD COLUMN author_ref text`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE messages DROP COLUMN author_ref`);
  }
}
