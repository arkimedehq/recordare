// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Contacts of one memory (D50; WORK_PLAN 8.4, owner's decision 2026-10-09): a participant identified for the first time
 * is the contact the memory already knows only when the evidence is strong — its full name (two or more words) equals the
 * names of exactly one contact that has no identity yet. A first name alone is not enough ("mia sorella Giulia" and a
 * Giulia writing in a group may be two people): the participant becomes a new contact and, when exactly one unbound
 * contact shares the name, a "same person?" clarification is opened (personal memories). Answered "yes", the two
 * contacts are merged (`mergeContacts`); answered "no", they stay apart.
 */
import { type EntityManager } from 'typeorm';
import { fold } from './subjects';

type Queryable = Pick<EntityManager, 'query'>;

/** `clarifications.resolution` of a "same person?" question. */
export const SAME_PERSON = 'same person';
export const DIFFERENT_PERSON = 'different person';

/** The words of a name, folded ("Giulia  Rossì" → ["giulia", "rossi"]). */
const nameWords = (s: string): string[] => fold(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

export interface NameMatch {
  /** Exactly one unbound contact with the participant's full name: the same person. */
  bind: string | null;
  /** Unbound contacts the name only suggests (first name, or a single name): a "same person?" question when one. */
  similar: string[];
}

/**
 * The unbound contacts (no identity of their own) a participant's display name points to. Full name (two or more words)
 * equal to a contact's display name, full name or an alias → `bind` when exactly one. Otherwise `similar`: contacts one
 * of whose names is the participant's first name, or starts with it when the participant gives a single name — never a
 * contact whose known full name differs from the participant's full name.
 */
export async function matchUnboundContacts(db: Queryable, ownerId: string, displayName: string): Promise<NameMatch> {
  const words = nameWords(displayName);
  const [first] = words;
  if (!first) return { bind: null, similar: [] };
  const rows: Array<{ id: string; display_name: string; full_name: string | null; aliases: string[] }> = await db.query(
    `SELECT p.id, p.display_name, p.full_name, ARRAY(SELECT a.alias FROM person_aliases a WHERE a.person_id = p.id) AS aliases
     FROM persons p
     WHERE p.owner_scope = $1 AND NOT EXISTS (SELECT 1 FROM external_identities i WHERE i.person_id = p.id)
       AND (split_part(lower(unaccent(btrim(p.display_name))), ' ', 1) = $2
            OR split_part(lower(unaccent(btrim(COALESCE(p.full_name, '')))), ' ', 1) = $2
            OR EXISTS (SELECT 1 FROM person_aliases a WHERE a.person_id = p.id AND split_part(a.alias_norm, ' ', 1) = $2))
     ORDER BY p.created_at`, [ownerId, first]);
  const full = words.join(' ');
  const names = (r: (typeof rows)[number]) => [r.display_name, r.full_name ?? '', ...r.aliases].map((n) => nameWords(n).join(' ')).filter(Boolean);
  if (words.length >= 2) {
    const exact = rows.filter((r) => names(r).includes(full));
    if (exact.length === 1) return { bind: (exact[0] as (typeof rows)[number]).id, similar: [] };
    if (exact.length > 1) return { bind: null, similar: exact.map((r) => r.id) };
  }
  const similar = rows.filter((r) => {
    if (words.length >= 2 && r.full_name && nameWords(r.full_name).join(' ') !== full) return false;
    return names(r).some((n) => n === first || (words.length === 1 && n.split(' ')[0] === first));
  });
  return { bind: null, similar: similar.map((r) => r.id) };
}

/**
 * "Giulia, che ha scritto il 9 ottobre, è la stessa persona di Giulia (sorella)?" — in the memory's language when it is
 * Italian, in English otherwise.
 */
export async function sameContactQuestion(db: Queryable, name: string, candidateId: string, at: Date, locale: string, timezone: string): Promise<string> {
  const [c]: Array<{ display_name: string; full_name: string | null; relation: string | null }> = await db.query(
    `SELECT display_name, full_name, relation FROM persons WHERE id = $1`, [candidateId]);
  const label = `${c?.full_name ?? c?.display_name ?? ''}${c?.relation ? ` (${c.relation})` : ''}`;
  const it = locale.toLowerCase().startsWith('it');
  let day: string;
  try {
    day = new Intl.DateTimeFormat(it ? 'it-IT' : 'en-GB', { day: 'numeric', month: 'long', timeZone: timezone }).format(at);
  } catch {
    day = at.toISOString().slice(0, 10);
  }
  return it ? `${name}, che ha scritto il ${day}, è la stessa persona di ${label}?` : `Is ${name}, who wrote on ${day}, the same person as ${label}?`;
}

/** Opens a "same person?" question about `contactId` (new) and `candidateId` (known), as of `at`. */
export async function askSameContact(db: Queryable, ownerId: string, contactId: string, candidateId: string, question: string, at: Date): Promise<string> {
  const [row] = await db.query(
    `INSERT INTO clarifications (owner_id, question, candidates, contact_id, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [ownerId, question.slice(0, 300), [candidateId], contactId, at]);
  return row.id as string;
}

/** Tables holding memory rows (constants: never user input). */
const MEMORY_TABLES = ['episodes', 'facts', 'notes'] as const;
const AUDIENCE_TABLES = [...MEMORY_TABLES, 'digests'] as const;
/** A uuid[] column (constant name) with $2 replaced by $3, without duplicates, first-occurrence order kept. */
const replaced = (col: 'subject_candidates' | 'audience' | 'candidates') =>
  `ARRAY(SELECT x FROM (SELECT x, min(i) AS i FROM unnest(array_replace(${col}, $2::uuid, $3::uuid)) WITH ORDINALITY AS u(x, i) GROUP BY x) d ORDER BY i)`;

/**
 * Merges contact `from` into contact `into` (both of memory `ownerId`): every reference moves to `into`, then `from` is
 * deleted. Names (aliases) are united, `full_name` / `relation` kept from `into` when it has them; single-value facts that
 * both had as current keep the most recent one (the other becomes superseded); an item undecided between the two is now
 * the merged contact's, and open questions the merge answers are resolved. The memory's text is never rewritten.
 * Returns false when the two are the same or either is not a contact of this memory (nothing changes).
 */
export async function mergeContacts(db: Queryable, ownerId: string, from: string, into: string, at: Date): Promise<boolean> {
  if (from === into) return false;
  const both: Array<{ id: string }> = await db.query(`SELECT id FROM persons WHERE id = ANY($1::uuid[]) AND owner_scope = $2`, [[from, into], ownerId]);
  if (both.length !== 2) return false;
  const args = [ownerId, from, into];

  await db.query(`UPDATE persons i SET full_name = COALESCE(i.full_name, f.full_name), relation = COALESCE(i.relation, f.relation)
    FROM persons f WHERE i.id = $3 AND f.id = $2 AND i.owner_scope = $1`, args);
  await db.query(`DELETE FROM person_aliases a WHERE a.person_id = $2 AND a.owner_id = $1
    AND EXISTS (SELECT 1 FROM person_aliases b WHERE b.person_id = $3 AND b.alias_norm = a.alias_norm)`, args);
  await db.query(`UPDATE person_aliases SET person_id = $3 WHERE person_id = $2 AND owner_id = $1`, args);
  await db.query(`UPDATE external_identities SET person_id = $3 WHERE person_id = $2 AND owner_scope = $1`, args);
  await db.query(`UPDATE conversation_participants cp SET person_id = $3 FROM conversations c
    WHERE c.id = cp.conversation_id AND c.owner_id = $1 AND cp.person_id = $2`, args);
  await db.query(`UPDATE messages SET author_person_id = $3 WHERE owner_id = $1 AND author_person_id = $2`, args);
  await db.query(`UPDATE episode_people ep SET person_id = $3 FROM episodes e
    WHERE e.id = ep.episode_id AND e.owner_id = $1 AND ep.person_id = $2`, args);

  // Single-value slots current for both: the older becomes superseded (one current row per slot and subject).
  await db.query(`
    UPDATE facts o SET status = 'superseded', expired_at = $4
    FROM facts a JOIN facts b ON b.owner_id = a.owner_id AND b.key = a.key AND b.subject_person_id = $3
      AND b.status = 'current' AND b.deleted_at IS NULL
    JOIN fact_slots s ON s.key = a.key AND s.cardinality = 'single'
    WHERE a.owner_id = $1 AND a.subject_person_id = $2 AND a.status = 'current' AND a.deleted_at IS NULL
      AND o.id = (CASE WHEN a.recorded_at > b.recorded_at THEN b.id ELSE a.id END)`, [...args, at]);
  for (const t of MEMORY_TABLES) {
    await db.query(`UPDATE ${t} SET subject_person_id = $3 WHERE owner_id = $1 AND subject_person_id = $2`, args);
    await db.query(`UPDATE ${t} SET confidence_of = $3 WHERE owner_id = $1 AND confidence_of = $2`, args);
    await db.query(`UPDATE ${t} SET subject_candidates = ${replaced('subject_candidates')} WHERE owner_id = $1 AND $2 = ANY(subject_candidates)`, args);
    // Undecided between the two merged contacts: now the merged contact's.
    await db.query(`UPDATE ${t} SET subject_kind = 'contact', subject_person_id = subject_candidates[1], subject_candidates = '{}'
      WHERE owner_id = $1 AND subject_kind = 'undecided' AND cardinality(subject_candidates) = 1`, [ownerId]);
  }
  for (const t of AUDIENCE_TABLES) {
    await db.query(`UPDATE ${t} SET audience = ${replaced('audience')} WHERE owner_id = $1 AND $2 = ANY(audience)`, args);
  }

  await db.query(`UPDATE clarifications SET candidates = ${replaced('candidates')} WHERE owner_id = $1 AND $2 = ANY(candidates)`, args);
  await db.query(`UPDATE clarifications SET resolved_person_id = $3 WHERE owner_id = $1 AND resolved_person_id = $2`, args);
  await db.query(`UPDATE clarifications SET contact_id = $3 WHERE owner_id = $1 AND contact_id = $2`, args);
  // Open questions the merge answers: "same person?" about the merged pair; "which one?" left with one candidate.
  await db.query(`UPDATE clarifications SET candidates = array_remove(candidates, contact_id)
    WHERE owner_id = $1 AND status = 'open' AND contact_id = ANY(candidates)`, [ownerId]);
  await db.query(`UPDATE clarifications c SET status = 'resolved', resolved_at = $2,
      resolved_person_id = COALESCE(c.candidates[1], c.contact_id),
      resolution = CASE WHEN c.contact_id IS NULL THEN p.display_name ELSE '${SAME_PERSON}' END
    FROM persons p WHERE p.id = COALESCE(c.candidates[1], c.contact_id) AND c.owner_id = $1 AND c.status = 'open'
      AND cardinality(c.candidates) <= (CASE WHEN c.contact_id IS NULL THEN 1 ELSE 0 END)`, [ownerId, at]);

  await db.query(`DELETE FROM persons WHERE id = $2 AND owner_scope = $1`, [ownerId, from]);
  return true;
}
