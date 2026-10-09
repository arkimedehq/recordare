// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Whose a memory row is (D50, docs/DATA_MODEL.md → Agent memory): the memory's self, a contact, an unidentified someone,
 * or undecided between candidate contacts. As built (WORK_PLAN 8.3) the subject follows today's rules — personal
 * memories: the self; entity memories: a fact's subject, an episode's one known contact, else someone — and is never
 * `undecided` yet (asking "which Marco?" comes with 8.4 / 8.5).
 */
import { type EntityManager } from 'typeorm';
import { type SubjectKind } from '../identity/identity.entities';

export interface Subject {
  kind: SubjectKind;
  personId: string | null;
  candidates: string[];
}

export const SELF_SUBJECT: Subject = { kind: 'self', personId: null, candidates: [] };
export const SOMEONE_SUBJECT: Subject = { kind: 'someone', personId: null, candidates: [] };
export const contact = (personId: string): Subject => ({ kind: 'contact', personId, candidates: [] });

/** "Marta (figlia)" → "Marta". */
export const withoutRelation = (raw: string): string => raw.replace(/\s*\(.*\)\s*$/, '').trim();

/** The contacts of this memory a name designates (by display name or alias); several when the name is ambiguous. */
export async function contactsNamed(tx: EntityManager, ownerId: string, raw: string): Promise<string[]> {
  const name = withoutRelation(raw).slice(0, 200);
  if (!name) return [];
  const rows: Array<{ id: string }> = await tx.query(
    `SELECT p.id FROM persons p WHERE p.owner_scope = $1 AND (lower(p.display_name) = lower($2)
       OR EXISTS (SELECT 1 FROM person_aliases a WHERE a.person_id = p.id AND a.alias_norm = lower(unaccent(btrim($2)))))
     ORDER BY p.created_at`, [ownerId, name]);
  return rows.map((r) => r.id);
}

/**
 * Entity memories: an episode is the contact's when its people name exactly one known contact; otherwise someone's.
 * Also returns, per alias, the contact it designates unambiguously (for `episode_people.person_id`).
 */
export async function episodeSubject(tx: EntityManager, ownerId: string, people: string[]): Promise<{ subject: Subject; people: Map<string, string> }> {
  const all = new Set<string>();
  const byAlias = new Map<string, string>();
  for (const alias of people) {
    const ids = await contactsNamed(tx, ownerId, alias);
    ids.forEach((id) => all.add(id));
    if (ids.length === 1) byAlias.set(alias, ids[0] as string);
  }
  const [only] = all;
  return { subject: all.size === 1 && only ? contact(only) : SOMEONE_SUBJECT, people: byAlias };
}
