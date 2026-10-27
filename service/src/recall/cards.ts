// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Cards (WORK_PLAN 8.13; COMPETITORS.md §6.6): who I am and who my contacts are, as views of what the memory holds now —
 * current facts and notes about the self and each contact, with their ids (their detail gives the evidence). Built by
 * queries only, no LLM call: nothing to go stale, each line correctable where it comes from. The memory context may
 * open with the self card when the host asks for it (`card: true`, off by default).
 */
import { type DataSource } from 'typeorm';
import { localDate } from '../engine/time';
import { episodeVisible, factVisible, noteVisible, type Reader } from './privacy';

export interface CardFact { id: string; key: string; value: string | null; validFrom: string | null }
export interface CardNote { id: string; category: string; content: string; pinned: boolean; pattern: boolean }
export interface Card {
  personId: string;
  name: string;
  aliases: string[];
  facts: CardFact[];
  notes: CardNote[];
  /** The day of the latest episode about this person (contacts; null for the self). */
  lastMentioned: string | null;
}
export interface Cards { self: Card; contacts: Card[] }

/** The self card and one card per contact, contacts most recently mentioned first; what the reader may be told (D52). */
export async function buildCards(db: DataSource, memoryId: string, reader: Reader): Promise<Cards | null> {
  const [memory] = await db.query(
    `SELECT o.timezone, p.display_name AS name FROM memories o JOIN persons p ON p.id = o.person_id WHERE o.person_id = $1`, [memoryId]);
  if (!memory) return null;
  const tz: string = memory.timezone;
  const day = (d: Date | null) => (d ? localDate(d, tz) : null);
  const facts: Array<{ id: string; key: string; value: string | null; valid_from: Date | null; who: string }> = await db.query(
    `SELECT id, key, value, valid_from, COALESCE(subject_person_id, $1) AS who FROM facts
     WHERE memory_id = $1 AND status = 'current' AND NOT pending AND deleted_at IS NULL AND subject_kind IN ('self', 'contact')
       AND ${factVisible('facts', reader)}
     ORDER BY key, valid_from NULLS FIRST`, [memoryId]);
  // Pinned first, then what more messages support, then the newest.
  const notes: Array<{ id: string; category: string; content: string; pinned: boolean; pattern: boolean; who: string }> = await db.query(
    `SELECT id, category, content, pinned, 'pattern' = ANY(tags) AS pattern, COALESCE(subject_person_id, $1) AS who FROM notes
     WHERE memory_id = $1 AND status = 'current' AND NOT pending AND deleted_at IS NULL AND subject_kind IN ('self', 'contact')
       AND ${noteVisible('notes', reader)}
     ORDER BY pinned DESC, support_count DESC, recorded_at DESC`, [memoryId]);
  const contacts: Array<{ id: string; name: string; aliases: string[] | null; last: Date | null }> = await db.query(
    `SELECT p.id, p.display_name AS name,
            (SELECT array_agg(a.alias ORDER BY a.alias) FROM person_aliases a WHERE a.person_id = p.id) AS aliases,
            (SELECT max(e.occurred_at) FROM episodes e WHERE e.memory_id = $1 AND e.deleted_at IS NULL AND ${episodeVisible('e', reader)}
               AND (e.subject_person_id = p.id OR EXISTS (SELECT 1 FROM episode_people ep WHERE ep.episode_id = e.id AND ep.person_id = p.id))) AS last
     FROM persons p WHERE p.memory_id = $1
     ORDER BY last DESC NULLS LAST, p.display_name`, [memoryId]);
  const card = (personId: string, name: string, aliases: string[], last: Date | null): Card => ({
    personId, name, aliases,
    facts: facts.filter((f) => f.who === personId).map((f) => ({ id: f.id, key: f.key, value: f.value, validFrom: day(f.valid_from) })),
    notes: notes.filter((n) => n.who === personId).map((n) => ({ id: n.id, category: n.category, content: n.content, pinned: n.pinned, pattern: n.pattern })),
    lastMentioned: day(last),
  });
  return {
    self: card(memoryId, memory.name, [], null),
    contacts: contacts.map((c) => card(c.id, c.name, (c.aliases ?? []).filter((a) => a !== c.name), c.last)),
  };
}

/** The self card as context lines, within `budget` characters (facts first, then notes in card order), with their ids. */
export function selfCardLines(card: Card, budget: number): { lines: string[]; ids: Set<string> } {
  const all: Array<[string, string]> = [
    ...card.facts.filter((f) => f.value !== null)
      .map((f): [string, string] => [f.id, `- about me: ${f.key.replace(/_/g, ' ')} = ${f.value}${f.validFrom ? ` (since ${f.validFrom})` : ''}`]),
    ...card.notes.map((n): [string, string] => [n.id, `- about me${n.pattern ? ' (a pattern I noticed)' : ''}: ${n.content}`]),
  ];
  const lines: string[] = [];
  const ids = new Set<string>();
  let size = 0;
  for (const [id, l] of all) {
    if (size + l.length > budget) break;
    lines.push(l);
    ids.add(id);
    size += l.length;
  }
  return { lines, ids };
}
