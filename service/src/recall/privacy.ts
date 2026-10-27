// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Private memories at read time (D52): a message declared private is told only to whoever it belongs to
 * (`private_owner_id`) and, in a personal memory, to the holder; the admin reads everything. Episodes, facts and notes
 * follow the messages they rest on (their evidence): an item is hidden from a reader only when every message behind it is
 * a private one that reader may not see — what was said in the open at least once stays public. An item with no message
 * behind it is public.
 */
import { type DataSource } from 'typeorm';

/** Who reads: everything (the admin, the holder of a personal memory), or the public plus the private of one person. */
export type Reader = { all: true } | { all: false; personId: string | null };

export const EVERYTHING: Reader = { all: true };
/** What anyone may hear: the public only. */
export const PUBLIC_ONLY: Reader = { all: false, personId: null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A person id as an SQL literal (ids come from the database; anything else is refused). */
function literal(id: string): string {
  if (!UUID.test(id)) throw new Error('not a uuid');
  return `'${id}'::uuid`;
}

/**
 * Who reads in a conversation: the author of its latest person's turn (as of `now`) — the holder of a personal memory
 * reads everything, an identified contact the public and their own, anyone unidentified the public. Without a
 * conversation: the account itself — the holder of a personal memory; in an entity memory, nobody but the agent knows the
 * private things, so the public only. A memory with no private message needs no filter.
 */
export async function readerOf(db: DataSource, memoryId: string, conversationId: string | undefined, now: Date): Promise<Reader> {
  const [memory]: Array<{ mode: string; any: boolean }> = await db.query(
    `SELECT mode, EXISTS (SELECT 1 FROM messages WHERE memory_id = $1 AND private) AS any FROM memories WHERE person_id = $1`, [memoryId]);
  if (!memory?.any) return EVERYTHING;
  const personal = memory.mode === 'personal';
  if (!conversationId) return personal ? EVERYTHING : PUBLIC_ONLY;
  const [m]: Array<{ author_kind: string; author_person_id: string | null }> = await db.query(
    `SELECT author_kind, author_person_id FROM messages
     WHERE conversation_id = $1 AND role IN ('user', 'other') AND sent_at <= $2 ORDER BY sent_at DESC LIMIT 1`, [conversationId, now]);
  if (!m) return personal ? EVERYTHING : PUBLIC_ONLY;
  if (personal && (m.author_kind === 'self' || m.author_kind === 'own')) return EVERYTHING;
  return m.author_kind === 'someone' ? PUBLIC_ONLY : { all: false, personId: m.author_person_id };
}

/** SQL: the message `m` (an alias of `messages`) is hidden from the reader. */
function hidden(m: string, r: Reader): string {
  if (r.all) return 'false';
  return r.personId ? `(${m}.private AND ${m}.private_owner_id IS DISTINCT FROM ${literal(r.personId)})` : `${m}.private`;
}

/** SQL predicate: the message `m` (an alias of `messages`) may be told to the reader. */
export function messageVisible(m: string, r: Reader): string {
  return r.all ? 'true' : `NOT ${hidden(m, r)}`;
}

/** Not every message behind it is hidden: `from` joins the item's evidence messages as `pm`. */
function evidenceVisible(from: string, r: Reader): string {
  if (r.all) return 'true';
  return `NOT (EXISTS (SELECT 1 ${from} AND ${hidden('pm', r)}) AND NOT EXISTS (SELECT 1 ${from} AND NOT ${hidden('pm', r)}))`;
}

/** SQL predicate: the episode `e` (an alias or the table name) may be told to the reader. */
export function episodeVisible(e: string, r: Reader): string {
  return evidenceVisible(`FROM episode_evidence pv JOIN messages pm ON pm.id = pv.message_id WHERE pv.episode_id = ${e}.id`, r);
}

/** Facts and notes rest on messages directly or through an episode. */
function itemVisible(table: 'fact_evidence' | 'note_evidence', column: 'fact_id' | 'note_id', alias: string, r: Reader): string {
  return evidenceVisible(`FROM ${table} pv JOIN messages pm ON pm.id = pv.message_id
    OR pm.id IN (SELECT pe.message_id FROM episode_evidence pe WHERE pe.episode_id = pv.episode_id) WHERE pv.${column} = ${alias}.id`, r);
}

/** SQL predicate: the fact `f` (an alias or the table name) may be told to the reader. */
export function factVisible(f: string, r: Reader): string {
  return itemVisible('fact_evidence', 'fact_id', f, r);
}

/** SQL predicate: the note `n` (an alias or the table name) may be told to the reader. */
export function noteVisible(n: string, r: Reader): string {
  return itemVisible('note_evidence', 'note_id', n, r);
}
