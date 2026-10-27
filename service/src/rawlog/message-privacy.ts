// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/** Private messages (D52): what makes a message private or public again — the client (ingest, edit) or the person's own words (extraction). */
import { type EntityManager } from 'typeorm';
import { supersedeDigests } from '../recall/forgetting';

/** The agent's and tools' turns (a reply), as opposed to what people say (`user`, `other`). */
export const isReply = (role: string): boolean => role === 'assistant' || role === 'tool';

/**
 * Makes a message private or public again (D52; whoever said it decides): a person's message carries the replies that
 * answer it — the agent's and tools' turns after it, until the next person's message. A reply alone follows its own flag.
 */
export async function setPrivate(tx: EntityManager, messageId: string, isPrivate: boolean): Promise<void> {
  const [m] = await tx.query(`SELECT memory_id, conversation_id, role, sent_at, author_person_id FROM messages WHERE id = $1`, [messageId]);
  let changed: Array<{ id: string }>;
  if (isReply(m.role)) {
    const [asked] = await tx.query(
      `SELECT author_person_id FROM messages WHERE conversation_id = $1 AND role IN ('user', 'other') AND sent_at <= $2
       ORDER BY sent_at DESC LIMIT 1`, [m.conversation_id, m.sent_at]);
    [changed] = await tx.query(`UPDATE messages SET private = $2, private_owner_id = $3 WHERE id = $1 RETURNING id`,
      [messageId, isPrivate, isPrivate ? asked?.author_person_id ?? null : null]);
  } else {
    [changed] = await tx.query(
      `UPDATE messages r SET private = $2, private_owner_id = CASE WHEN $2 THEN $3::uuid END
       WHERE r.id = $1 OR (r.conversation_id = $4 AND r.role IN ('assistant', 'tool') AND r.sent_at >= $5
         AND NOT EXISTS (SELECT 1 FROM messages n WHERE n.conversation_id = $4 AND n.role IN ('user', 'other')
                         AND n.sent_at > $5 AND n.sent_at <= r.sent_at))
       RETURNING r.id`,
      [messageId, isPrivate, m.author_person_id, m.conversation_id, m.sent_at]);
  }
  // The diary is written from public memories only: the days these messages are behind are written again.
  const episodes: Array<{ episode_id: string }> = await tx.query(
    `SELECT DISTINCT episode_id FROM episode_evidence WHERE message_id = ANY($1)`, [changed.map((r) => r.id)]);
  await supersedeDigests(tx, m.memory_id, episodes.map((e) => e.episode_id));
}
