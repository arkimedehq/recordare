// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Near-duplicate resolution (D32 second call, Graphiti dedupe idea, WORK_PLAN 5.3): a new episode
 * that is very similar to an existing one close in time is checked by one small call, only when
 * such candidates exist. Outcomes: `duplicate` (the telling the other one fully covers is hidden as duplicate_of), `corrects`
 * (the new one fixes the old, which is invalidated — corrections the extractor did not link),
 * `distinct` (nothing changes). Never rewrites content.
 */
import { z } from 'zod';
import { type DataSource } from 'typeorm';
import { type LlmCallContext, type LlmPort } from '../llm/llm.port';
import { type QualityProfile } from './quality-profile';

/** Candidates: same kind, within ± profile days, and similar by embedding (profile threshold) or by trigrams. */
const TRIGRAM = 0.3;

export const RESOLVE_PROMPT_VERSION = 'resolve.v2';

export const RESOLVE_SYSTEM = `You compare memories of a personal memory service. For each pair (NEW, EXISTING) decide:
- "duplicate": the same event with no contradiction, told twice; give "keep": "NEW" or "EXISTING", the telling that \
says everything the other says (more detail is fine);
- "corrects": the same event, and NEW states that a detail of EXISTING was wrong (date, place, person, amount) — \
the owner corrected it;
- "distinct": different events (e.g. the same activity on different days), a plan and its later outcome — or the same \
event when each telling has something of its own the other lacks (one the pages sent, the other the time and the \
receipt number): hiding either would lose it.
Reply with JSON {"decisions": [{"pair": <number>, "relation": "duplicate" | "corrects" | "distinct", "keep": "NEW" | \
"EXISTING"}]}.`;

const schema = z.object({
  decisions: z.array(z.object({
    pair: z.number().int().positive(),
    relation: z.enum(['duplicate', 'corrects', 'distinct']),
    keep: z.enum(['NEW', 'EXISTING']).optional().catch(undefined),
  })).default([]),
});

export interface ResolvedLink { relation: 'duplicate' | 'corrects'; from: string; to: string }

interface Candidate {
  new_id: string;
  new_content: string;
  old_id: string;
  old_content: string;
}

export async function resolveNearDuplicates(db: DataSource, llm: LlmPort, memoryId: string, newIds: string[], ctx: LlmCallContext,
  profile: Pick<QualityProfile, 'resolverWindowDays' | 'resolverSimilarity'>): Promise<ResolvedLink[]> {
  const links: ResolvedLink[] = [];
  if (newIds.length === 0) return links;
  const pairs: Candidate[] = await db.query(
    `SELECT DISTINCT ON (n.id) n.id AS new_id, n.content AS new_content, o.id AS old_id, o.content AS old_content
     FROM episodes n JOIN episodes o
       ON o.memory_id = n.memory_id AND o.id <> n.id AND NOT (o.id = ANY($2))
      AND o.kind = n.kind AND o.deleted_at IS NULL AND o.invalidated_at IS NULL AND o.duplicate_of IS NULL
      AND n.occurred_at IS NOT NULL AND o.occurred_at IS NOT NULL
      AND abs(extract(epoch FROM n.occurred_at - o.occurred_at)) <= $4 * 86400
      AND ((n.embedding IS NOT NULL AND o.embedding IS NOT NULL AND 1 - (o.embedding <=> n.embedding) >= $3)
           OR similarity(o.content, n.content) >= $5)
     WHERE n.memory_id = $1 AND n.id = ANY($2)
     ORDER BY n.id, similarity(o.content, n.content) DESC`,
    [memoryId, newIds, profile.resolverSimilarity, profile.resolverWindowDays, TRIGRAM]);
  if (pairs.length === 0) return links;

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
      // Keep the telling that holds every detail: the model says which; length only when it does not (a later, shorter
      // mention often carries the outcome, so length alone hid it).
      const keepNew = d.keep ? d.keep === 'NEW' : p.new_content.length > p.old_content.length;
      const [keep, hide] = keepNew ? [p.new_id, p.old_id] : [p.old_id, p.new_id];
      await db.query(`UPDATE episodes SET duplicate_of = $1 WHERE id = $2 AND memory_id = $3`, [keep, hide, memoryId]);
      links.push({ relation: 'duplicate', from: hide, to: keep });
    } else if (d.relation === 'corrects') {
      await db.query(`UPDATE episodes SET corrects = $1 WHERE id = $2 AND memory_id = $3`, [p.old_id, p.new_id, memoryId]);
      await db.query(`UPDATE episodes SET invalidated_at = now() WHERE id = $1 AND memory_id = $2`, [p.old_id, memoryId]);
      links.push({ relation: 'corrects', from: p.new_id, to: p.old_id });
    }
  }
  return links;
}
