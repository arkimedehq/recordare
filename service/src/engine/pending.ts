// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Pending facts and notes (inferred: someone else's claim, a tool's output, words heard in the room — WORK_PLAN 6.5)
 * only propose a change. One that would replace or correct a stated item keeps the link (`supersedes` / `corrects`) but
 * leaves that item current; confirming it — in the diary, or by its person saying it again — applies the change then.
 * Measured on dev_ambient (2026-10-15): a sister's "I turn 39" heard as the holder's retired the holder's stated age.
 */
import { type EntityManager } from 'typeorm';

type Db = Pick<EntityManager, 'query'>;

/** Is this item pending (a new pending item replacing it is only a proposal while it is stated)? */
export async function isPending(db: Db, table: 'facts' | 'notes', id: string): Promise<boolean> {
  const [row]: Array<{ pending: boolean }> = await db.query(`SELECT pending FROM ${table} WHERE id = $1`, [id]);
  return !!row?.pending;
}

/**
 * Confirms a pending item of the memory (false: none such): the stated item it proposed to replace or correct is retired
 * first (one current stated fact per single-value slot), then the item is stated.
 */
export async function confirmPending(db: Db, table: 'facts' | 'notes', id: string, memoryId: string): Promise<boolean> {
  const [row]: Array<{ id: string }> = await db.query(
    `SELECT id FROM ${table} WHERE id = $1 AND memory_id = $2 AND pending AND deleted_at IS NULL FOR UPDATE`, [id, memoryId]);
  if (!row) return false;
  await retireReplaced(db, table, id);
  await db.query(`UPDATE ${table} SET pending = false, stance = 'stated', confidence = 1 WHERE id = $1`, [id]);
  return true;
}

async function retireReplaced(db: Db, table: 'facts' | 'notes', id: string): Promise<void> {
  if (table === 'facts') {
    await db.query(
      `UPDATE facts o SET status = CASE WHEN o.id = n.corrects THEN 'corrected'::fact_status ELSE 'superseded'::fact_status END,
         valid_to = CASE WHEN o.id = n.corrects THEN o.valid_to ELSE n.valid_from END, expired_at = now()
       FROM facts n WHERE n.id = $1 AND n.status IN ('current', 'unknown_current') AND o.memory_id = n.memory_id
         AND o.id IN (n.supersedes, n.corrects) AND o.status IN ('current', 'unknown_current')`, [id]);
    return;
  }
  await db.query(
    `UPDATE notes o SET status = CASE WHEN o.id = n.corrects THEN 'corrected'::note_status ELSE 'superseded'::note_status END
     FROM notes n WHERE n.id = $1 AND n.status = 'current' AND o.memory_id = n.memory_id
       AND o.id IN (n.supersedes, n.corrects) AND o.status = 'current'`, [id]);
}
