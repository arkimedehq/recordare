// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Near-duplicate resolution (D32 second call, Graphiti dedupe idea, WORK_PLAN 5.3): a new episode
 * that is very similar to an existing one close in time is checked by one small call, only when
 * such candidates exist. Outcomes: `duplicate` (the less complete version is hidden as duplicate_of), `corrects`
 * (the new one fixes the old, which is invalidated — corrections the extractor did not link),
 * `distinct` (nothing changes). Never rewrites content.
 */
import { z } from 'zod';
import { type DataSource } from 'typeorm';
import { type LlmCallContext, type LlmPort } from '../llm/llm.port';
import { type QualityProfile } from './quality-profile';

/** Candidates: same kind, within ± profile days, and similar by embedding (profile threshold) or by trigrams. */
const TRIGRAM = 0.3;

export const RESOLVE_PROMPT_VERSION = 'resolve.v1';

export const RESOLVE_SYSTEM = `You compare memories of a personal memory service. For each pair (NEW, EXISTING) decide:
- "duplicate": the same event with no contradiction (one may have more detail);
- "corrects": the same event, and NEW states that a detail of EXISTING was wrong (date, place, person, amount) — \
the owner corrected it;
- "distinct": different events (e.g. the same activity on different days), or a plan and its later outcome.
Reply with JSON {"decisions": [{"pair": <number>, "relation": "duplicate" | "corrects" | "distinct"}]}.`;

const schema = z.object({
  decisions: z.array(z.object({ pair: z.number().int().positive(), relation: z.enum(['duplicate', 'corrects', 'distinct']) })).default([]),
});

interface Candidate {
  new_id: string;
  new_content: string;
  old_id: string;
  old_content: string;
}

export async function resolveNearDuplicates(db: DataSource, llm: LlmPort, ownerId: string, newIds: string[], ctx: LlmCallContext,
  profile: Pick<QualityProfile, 'resolverWindowDays' | 'resolverSimilarity'>): Promise<void> {
  if (newIds.length === 0) return;
  const pairs: Candidate[] = await db.query(
    `SELECT DISTINCT ON (n.id) n.id AS new_id, n.content AS new_content, o.id AS old_id, o.content AS old_content
     FROM episodes n JOIN episodes o
       ON o.owner_id = n.owner_id AND o.id <> n.id AND NOT (o.id = ANY($2))
      AND o.kind = n.kind AND o.deleted_at IS NULL AND o.invalidated_at IS NULL AND o.duplicate_of IS NULL
      AND n.occurred_at IS NOT NULL AND o.occurred_at IS NOT NULL
      AND abs(extract(epoch FROM n.occurred_at - o.occurred_at)) <= $4 * 86400
      AND ((n.embedding IS NOT NULL AND o.embedding IS NOT NULL AND 1 - (o.embedding <=> n.embedding) >= $3)
           OR similarity(o.content, n.content) >= $5)
     WHERE n.owner_id = $1 AND n.id = ANY($2)
     ORDER BY n.id, similarity(o.content, n.content) DESC`,
    [ownerId, newIds, profile.resolverSimilarity, profile.resolverWindowDays, TRIGRAM]);
  if (pairs.length === 0) return;

  const out = await llm.completeJson({
    promptId: RESOLVE_PROMPT_VERSION,
    system: RESOLVE_SYSTEM,
    user: pairs.map((p, i) => `PAIR ${i + 1}\nNEW: ${p.new_content}\nEXISTING: ${p.old_content}`).join('\n\n'),
    schema,
    task: 'resolve',
    maxTokens: 800,
  }, ctx);

  for (const d of out.decisions) {
    const p = pairs[d.pair - 1];
    if (!p) continue;
    if (d.relation === 'duplicate') {
      // Keep the more complete telling visible (a later mention often carries the outcome).
      const [keep, hide] = p.new_content.length > p.old_content.length ? [p.new_id, p.old_id] : [p.old_id, p.new_id];
      await db.query(`UPDATE episodes SET duplicate_of = $1 WHERE id = $2 AND owner_id = $3`, [keep, hide, ownerId]);
    } else if (d.relation === 'corrects') {
      await db.query(`UPDATE episodes SET corrects = $1 WHERE id = $2 AND owner_id = $3`, [p.old_id, p.new_id, ownerId]);
      await db.query(`UPDATE episodes SET invalidated_at = now() WHERE id = $1 AND owner_id = $2`, [p.old_id, ownerId]);
    }
  }
}
