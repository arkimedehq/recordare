// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { Logger } from '@nestjs/common';
import { type DataSource } from 'typeorm';

const log = new Logger('RecallLog');

/** One row per recall served (metadata only). Accounting must never break a read. */
export async function logRecall(db: DataSource, ownerId: string, tool: string, mode: string | null, items: number): Promise<void> {
  try {
    await db.query(`INSERT INTO recall_log (owner_id, tool, mode, items) VALUES ($1, $2, $3, $4)`, [ownerId, tool, mode, items]);
  } catch (err) {
    log.warn(`recall_log insert failed: ${(err as Error).message}`);
  }
}
