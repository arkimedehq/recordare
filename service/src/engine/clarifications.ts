// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Clarifications — Recordare's first initiative (D50, vision L1; WORK_PLAN 8.4): when an extraction cannot tell which of
 * several contacts a memory is about ("Marco" — the colleague or the cousin?), the item is stored `undecided` with its
 * candidates and a question in the conversation's language. The question is shown to later extractions (OPEN
 * QUESTIONS), which may answer it from the conversation; the memory context offers one relevant question to the agent
 * ("if natural, ask: …"). An answer adds the attribution (subject, person link) and never rewrites the memory's text.
 * Open questions expire after CLARIFICATION_TTL_DAYS (on read, at extraction and in the nightly consolidation).
 */
import { type EntityManager } from 'typeorm';
import { fold } from './subjects';

export const CLARIFICATION_TTL_DAYS = 14;

type Queryable = Pick<EntityManager, 'query'>;

/** Open questions older than the TTL (as of `now`) become `expired`. */
export async function expireClarifications(db: Queryable, ownerId: string, now: Date): Promise<void> {
  await db.query(
    `UPDATE clarifications SET status = 'expired', resolved_at = $2
     WHERE owner_id = $1 AND status = 'open' AND created_at < $2::timestamptz - make_interval(days => $3) AND created_at <= $2`,
    [ownerId, now, CLARIFICATION_TTL_DAYS]);
}

export interface ItemRef { table: 'episodes' | 'facts' | 'notes'; id: string }

/** A new open question about one item (asked as of the conversation's time). */
export async function askClarification(db: Queryable, ownerId: string, item: ItemRef, question: string, candidates: string[], at: Date): Promise<string> {
  const column = item.table === 'episodes' ? 'episode_id' : item.table === 'facts' ? 'fact_id' : 'note_id';
  const [row] = await db.query(
    `INSERT INTO clarifications (owner_id, question, candidates, ${column}, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [ownerId, question.slice(0, 300), candidates, item.id, at]);
  return row.id as string;
}

/**
 * Applies an answer: the item gets the chosen contact as its subject (if undecided) and its people link; the question —
 * and any other open one with the same text and candidates — is resolved. The memory's text is never rewritten.
 */
export async function resolveClarification(db: Queryable, ownerId: string, clarificationId: string, personId: string, at: Date): Promise<boolean> {
  const [c]: Array<{ question: string; candidates: string[] }> = await db.query(
    `SELECT question, candidates FROM clarifications WHERE id = $1 AND owner_id = $2 AND status = 'open'`, [clarificationId, ownerId]);
  if (!c || !c.candidates.includes(personId)) return false;
  const [person]: Array<{ display_name: string; names: string[] }> = await db.query(
    `SELECT p.display_name, array_remove(array_agg(a.alias_norm), NULL) || ARRAY[lower(unaccent(p.display_name))] AS names
     FROM persons p LEFT JOIN person_aliases a ON a.person_id = p.id WHERE p.id = $1 GROUP BY p.id`, [personId]);
  const resolved: Array<{ episode_id: string | null; fact_id: string | null; note_id: string | null }> = await db.query(
    // WITH … SELECT: plain rows back (a bare UPDATE … RETURNING comes back as [rows, count]).
    `WITH u AS (
       UPDATE clarifications SET status = 'resolved', resolved_at = $3, resolved_person_id = $4, resolution = $5
       WHERE owner_id = $1 AND status = 'open' AND (id = $2 OR (question = $6 AND candidates = $7::uuid[]))
       RETURNING episode_id, fact_id, note_id)
     SELECT * FROM u`,
    [ownerId, clarificationId, at, personId, person?.display_name ?? null, c.question, c.candidates]);
  const names = new Set((person?.names ?? []).map(fold));
  for (const r of resolved) {
    for (const [table, id] of [['episodes', r.episode_id], ['facts', r.fact_id], ['notes', r.note_id]] as const) {
      if (!id) continue;
      await db.query(
        `UPDATE ${table} SET subject_kind = 'contact', subject_person_id = $1, subject_candidates = '{}'
         WHERE id = $2 AND owner_id = $3 AND subject_kind = 'undecided'`, [personId, id, ownerId]);
    }
    if (r.episode_id) {
      const people: Array<{ alias: string }> = await db.query(
        `SELECT alias FROM episode_people WHERE episode_id = $1 AND person_id IS NULL`, [r.episode_id]);
      for (const p of people) {
        const first = fold(p.alias.replace(/\s*\(.*\)\s*$/, ''));
        if (names.has(first) || [...names].some((n) => n.split(' ')[0] === first)) {
          await db.query(`UPDATE episode_people SET person_id = $1 WHERE episode_id = $2 AND alias = $3 AND person_id IS NULL`, [personId, r.episode_id, p.alias]);
        }
      }
    }
  }
  return resolved.length > 0;
}

export interface OpenClarification { id: string; question: string; episodeId: string | null; candidates: string[] }

/**
 * Open questions relevant to a message or a recall: one of its candidates is named in the text (any of their names),
 * or the item it concerns is among `itemIds`. Newest first.
 */
export async function relevantClarifications(db: Queryable, ownerId: string, text: string, itemIds: string[], now: Date, limit: number): Promise<OpenClarification[]> {
  await expireClarifications(db, ownerId, now);
  const rows: Array<{ id: string; question: string; episode_id: string | null; fact_id: string | null; note_id: string | null; candidates: string[]; names: string[] }> = await db.query(
    `SELECT c.id, c.question, c.episode_id, c.fact_id, c.note_id, c.candidates,
       ARRAY(SELECT a.alias_norm FROM person_aliases a WHERE a.person_id = ANY(c.candidates)
             UNION SELECT lower(unaccent(p.display_name)) FROM persons p WHERE p.id = ANY(c.candidates)) AS names
     FROM clarifications c WHERE c.owner_id = $1 AND c.status = 'open' AND c.created_at <= $2 ORDER BY c.created_at DESC LIMIT 50`,
    [ownerId, now]);
  const words = new Set(fold(text).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2));
  const ids = new Set(itemIds);
  return rows
    .filter((r) => [r.episode_id, r.fact_id, r.note_id].some((id) => id && ids.has(id))
      || r.names.some((n) => { const parts = fold(n).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2); return parts.length > 0 && parts.every((w) => words.has(w)); }))
    .slice(0, limit)
    .map((r) => ({ id: r.id, question: r.question, episodeId: r.episode_id, candidates: r.candidates }));
}
