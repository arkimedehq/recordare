// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Subjects in recall results (D50, WORK_PLAN 8.4): whose each item is — the memory's self ("I"), a contact by name,
 * someone, or undecided between candidates — and who is asking: the author of the conversation's latest turn when it is
 * an identified contact, otherwise the self (an undeclared speaker gets "I"'s memories).
 */
import { type DataSource } from 'typeorm';
import { type SubjectKind } from '../identity/identity.entities';

export type SubjectView =
  | { kind: 'self' }
  | { kind: 'contact'; name: string }
  | { kind: 'someone' }
  | { kind: 'undecided'; candidates: string[] };

export interface SubjectRow { subject_kind: SubjectKind; subject_person_id: string | null; subject_candidates: string[] | null }

/** The display names of the contacts the rows refer to (subjects and candidates). */
export async function contactNames(db: DataSource, rows: SubjectRow[]): Promise<Map<string, string>> {
  const ids = [...new Set(rows.flatMap((r) => [r.subject_person_id, ...(r.subject_candidates ?? [])]).filter((x): x is string => !!x))];
  if (ids.length === 0) return new Map();
  const found: Array<{ id: string; display_name: string; relation: string | null }> = await db.query(
    `SELECT id, display_name, relation FROM persons WHERE id = ANY($1)`, [ids]);
  return new Map(found.map((p) => [p.id, p.display_name]));
}

export function subjectView(r: SubjectRow, names: Map<string, string>): SubjectView {
  if (r.subject_kind === 'contact' && r.subject_person_id) return { kind: 'contact', name: names.get(r.subject_person_id) ?? '?' };
  if (r.subject_kind === 'undecided') return { kind: 'undecided', candidates: (r.subject_candidates ?? []).map((id) => names.get(id) ?? '?') };
  if (r.subject_kind === 'someone') return { kind: 'someone' };
  return { kind: 'self' };
}

export type Speaker = { kind: 'self' } | { kind: 'contact'; id: string; name: string };

/** Who is asking: the latest person's turn of the conversation (as of `now`) when an identified contact wrote it. */
export async function speakerOf(db: DataSource, conversationId: string | undefined, now: Date): Promise<Speaker> {
  if (!conversationId) return { kind: 'self' };
  const [m]: Array<{ author_kind: string; author_person_id: string | null; display_name: string | null }> = await db.query(
    `SELECT m.author_kind, m.author_person_id, p.display_name FROM messages m LEFT JOIN persons p ON p.id = m.author_person_id
     WHERE m.conversation_id = $1 AND m.role IN ('user', 'other') AND m.sent_at <= $2 ORDER BY m.sent_at DESC LIMIT 1`, [conversationId, now]);
  return m?.author_kind === 'contact' && m.author_person_id ? { kind: 'contact', id: m.author_person_id, name: m.display_name ?? '?' } : { kind: 'self' };
}
