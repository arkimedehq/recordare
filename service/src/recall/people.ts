// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * People named by a question, by name ("what did Kevin ask you?") or by relation ("what did my mother ask you?").
 * No LLM call: the memory's people come from what the engine already stored — episode people written as
 * "Name (relation)" by the extractor, and the participants of the holder's chats. A relation resolves only when it
 * points to a few people (a word like "friend" that matches many is left alone).
 */
import { type DataSource } from 'typeorm';
import { containsPhrase, normalize, RELATION_GROUPS } from '../lang';

/** A relation naming more people than this is too vague to narrow anything. */
const MAX_PER_RELATION = 3;

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const tokens = (s: string) => fold(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** First names (folded) of the people a question is about; empty when it names none. */
export async function peopleInQuestion(db: DataSource, memoryId: string, question: string): Promise<string[]> {
  const asked = new Set(tokens(question));
  if (asked.size === 0) return [];
  const rows: Array<{ name: string }> = await db.query(
    `SELECT DISTINCT ep.alias AS name FROM episode_people ep JOIN episodes e ON e.id = ep.episode_id
     WHERE e.memory_id = $1 AND e.deleted_at IS NULL
     UNION SELECT DISTINCT cp.display_name FROM conversation_participants cp JOIN conversations c ON c.id = cp.conversation_id
     WHERE c.memory_id = $1 AND cp.display_name IS NOT NULL
     LIMIT 5000`, [memoryId]);
  const found = new Set<string>();
  const byRelation = new Map<number, Set<string>>();
  for (const { name } of rows) {
    const [who = '', rel = ''] = name.split('(');
    const first = tokens(who)[0];
    if (!first || first.length < 3) continue;
    if (asked.has(first)) found.add(first);
    const relation = normalize(rel);
    RELATION_GROUPS.forEach((group, i) => {
      if (group.words.some((w) => containsPhrase(relation, w))) (byRelation.get(i) ?? byRelation.set(i, new Set()).get(i)!).add(first);
    });
  }
  const question_ = normalize(question);
  RELATION_GROUPS.forEach((group, i) => {
    const names = byRelation.get(i);
    if (names && names.size <= MAX_PER_RELATION && group.words.some((w) => containsPhrase(question_, w))) names.forEach((n) => found.add(n));
  });
  return [...found];
}
