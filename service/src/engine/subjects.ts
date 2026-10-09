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
import { isFullName, isProperName } from '../lang';

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

/** Lower case without accents: the form names are compared in. */
export const fold = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/** "Giulia (sorella)" → { name: 'Giulia', relation: 'sorella' }. */
export function parseName(raw: string): { name: string; relation: string | null } {
  const m = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(raw.trim());
  const name = (m?.[1] ?? raw).trim().slice(0, 200);
  const relation = m?.[2]?.trim().slice(0, 100) || null;
  return { name, relation };
}

/** The words a personal item's subject may use for the self ("me", "I", "io"…): anything else is a name or a C-number. */
const SELF_WORDS = new Set(['me', 'i', 'myself', 'self', 'io', 'yo', 'moi', 'je', 'ich', 'eu', 'я']);

interface ContactRow { id: string; display_name: string; full_name: string | null; relation: string | null; names: string[] }

export interface Resolved {
  subject: Subject;
  /** For an undecided subject: a question naming the candidates (when the model gave none). */
  fallbackQuestion?: string;
}

/**
 * Personal memories (WORK_PLAN 8.4): links the names an extraction writes to the contacts of the memory. A C-number
 * names a listed contact; a name is matched against the self's names (→ self) and the contacts' display names, full
 * names and aliases. No match → a new contact (with its relation and, for a full name, its first name as an alias;
 * episode people only when they are names).
 * One match → that contact, unless the relation or the full name says it is someone else (then a new contact: a wrong
 * merge is worse than a duplicate); the contact gains a relation it lacked. Several matches → narrowed by relation,
 * then by full name; still several → undecided, with the candidates. Never guesses.
 */
export class ContactBook {
  private readonly cache = new Map<string, Resolved>();

  constructor(
    private readonly tx: EntityManager,
    private readonly ownerId: string,
    private readonly selfNames: string[],
    private readonly refs: Map<string, string>,
  ) {}

  /** The contact a C-number names, if listed. */
  byRef(raw: string): string | null {
    return this.refs.get(raw.trim().toUpperCase()) ?? null;
  }

  isSelf(raw: string): boolean {
    const f = fold(parseName(raw).name);
    return SELF_WORDS.has(f) || this.selfNames.some((n) => fold(n) === f);
  }

  /** The subject an item names (`null` / "me" → self, "someone", a C-number, a name); `undecided` is the caller's. */
  async resolve(raw: string | null | undefined): Promise<Resolved | null> {
    const text = raw?.trim() ?? '';
    if (!text || this.isSelf(text)) return { subject: SELF_SUBJECT };
    if (fold(text) === 'someone' || fold(text) === 'qualcuno') return { subject: SOMEONE_SUBJECT };
    if (/^C\d+$/i.test(text)) {
      const id = this.byRef(text);
      return id ? { subject: contact(id) } : null;
    }
    return this.byName(text);
  }

  /**
   * A person named in an item ("Marco (cugino)"): the contact, a new one, or undecided between several. `properOnly`
   * (episode people): references that are not names ("amiche del nuoto") create no contact.
   */
  async byName(raw: string, properOnly = false): Promise<Resolved> {
    const key = fold(raw);
    const hit = this.cache.get(key);
    if (hit) return hit;
    const { name, relation } = parseName(raw);
    if (!name) return { subject: SOMEONE_SUBJECT };
    if (this.isSelf(name)) return { subject: SELF_SUBJECT };
    const rows: ContactRow[] = await this.tx.query(
      `SELECT p.id, p.display_name, p.full_name, p.relation,
         array_remove(array_agg(a.alias_norm), NULL) || ARRAY[lower(unaccent(p.display_name)), lower(unaccent(COALESCE(p.full_name, '')))] AS names
       FROM persons p LEFT JOIN person_aliases a ON a.person_id = p.id
       WHERE p.owner_scope = $1 GROUP BY p.id ORDER BY p.created_at`, [this.ownerId]);
    const f = fold(name);
    const full = isFullName(name);
    const sameRelation = (c: ContactRow) => !relation || !c.relation || fold(c.relation) === fold(relation);
    const sameFullName = (c: ContactRow) => !full || !c.full_name || fold(c.full_name) === f;
    let matches = rows.filter((c) => c.names.some((n) => fold(n) === f));
    let out: Resolved;
    if (matches.length > 1) {
      const byRelation = relation ? matches.filter((c) => c.relation && fold(c.relation) === fold(relation)) : [];
      const byFull = full ? matches.filter((c) => c.full_name && fold(c.full_name) === f) : [];
      matches = byRelation.length === 1 ? byRelation : byFull.length === 1 ? byFull : matches.filter((c) => sameRelation(c) && sameFullName(c));
    }
    if (matches.length === 1 && sameRelation(matches[0] as ContactRow) && sameFullName(matches[0] as ContactRow)) {
      const c = matches[0] as ContactRow;
      if (relation && !c.relation) await this.tx.query(`UPDATE persons SET relation = $1 WHERE id = $2`, [relation, c.id]);
      out = { subject: contact(c.id) };
    } else if (matches.length > 1) {
      const label = (c: ContactRow) => `${c.full_name ?? c.display_name}${c.relation ? ` (${c.relation})` : ''}`;
      out = { subject: { kind: 'undecided', personId: null, candidates: matches.map((c) => c.id) }, fallbackQuestion: `${name}? ${matches.map(label).join(' / ')}` };
    } else if (properOnly && !isProperName(name)) {
      // A person listed by an item without a name ("amiche del nuoto", "i colleghi"): no contact, no link.
      return { subject: SOMEONE_SUBJECT };
    } else {
      out = { subject: contact(await this.create(name, relation)) };
    }
    this.cache.set(key, out);
    return out;
  }

  /** A contact first seen in an extraction ("only mentioned"), with its names. */
  private async create(name: string, relation: string | null): Promise<string> {
    const full = isFullName(name);
    const [{ id }] = await this.tx.query(
      `INSERT INTO persons (owner_scope, display_name, full_name, relation) VALUES ($1, $2, $3, $4) RETURNING id`,
      [this.ownerId, name, full ? name : null, relation]);
    const first = name.split(/\s+/)[0] ?? '';
    for (const alias of new Set([name, ...(full && first.length >= 2 ? [first] : [])])) {
      await this.tx.query(
        `INSERT INTO person_aliases (owner_id, person_id, alias, alias_norm, source) VALUES ($1, $2, $3, lower(unaccent(btrim($3))), 'extracted')
         ON CONFLICT DO NOTHING`, [this.ownerId, id, alias]);
    }
    return id as string;
  }
}
