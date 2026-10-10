// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Learning is an event (D49): the episode that refers to a learned source. When a conversation tells of it, the
 * extraction writes it and links it; otherwise — a source learned on its own, or one the extraction did not mention —
 * this writes it in code, no LLM: "Il 10 ottobre 2026 ho imparato «Manuale della caldaia», da Paolo", in the memory's
 * language and gender, with the source linked both ways.
 */
import { type EntityManager } from 'typeorm';
import { learnedSentence } from '../lang/learned';

export interface LearnedEpisode {
  id: string;
  /** The text to embed (as the extraction's written rows). */
  text: string;
}

/** Writes the learning episode of a source that has none yet; null when it already has one (or is gone). */
export async function writeLearnedEpisode(tx: EntityManager, sourceId: string): Promise<LearnedEpisode | null> {
  const [s]: Array<{ memory_id: string; title: string; learned_at: Date; provided_by_kind: string; provider: string | null;
    provided_by_person_id: string | null; locale: string; timezone: string; gender: 'masculine' | 'feminine' | 'neutral' }> = await tx.query(
    `SELECT s.memory_id, s.title, s.learned_at, s.provided_by_kind, s.provided_by_person_id, p.display_name AS provider, o.locale, o.timezone, o.gender
     FROM sources s JOIN memories o ON o.person_id = s.memory_id LEFT JOIN persons p ON p.id = s.provided_by_person_id
     WHERE s.id = $1 AND s.learned_episode_id IS NULL FOR UPDATE OF s`, [sourceId]);
  if (!s) return null;
  const content = learnedSentence(s.locale, s.learned_at, s.timezone, s.title, s.provider, s.gender ?? 'masculine');
  // Given by someone else: their contribution (author other), stated — not a claim; mine otherwise.
  const authorRole = s.provided_by_kind === 'self' ? 'holder' : 'other';
  const [e] = await tx.query(
    `INSERT INTO episodes (memory_id, kind, content, occurred_at, date_precision, importance, keywords, tags, origin, author_role,
       stance, confidence, disclosure, audience, subject_kind)
     VALUES ($1, 'event', $2, $3, 'day', 3, $4, ARRAY['learned'], 'holder_lived', $5, 'stated', 1, 'holder', ARRAY[$1::uuid], 'self')
     RETURNING id`, [s.memory_id, content, s.learned_at, [s.title], authorRole]);
  if (s.provided_by_person_id) {
    await tx.query(`INSERT INTO episode_people (episode_id, alias, person_id) VALUES ($1, $2, $3)`, [e.id, s.provider, s.provided_by_person_id]);
  }
  await tx.query(`INSERT INTO episode_sources (episode_id, source_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [e.id, sourceId]);
  await tx.query(`UPDATE sources SET learned_episode_id = $1 WHERE id = $2`, [e.id, sourceId]);
  return { id: e.id as string, text: [content, s.title].join(' | ') };
}
