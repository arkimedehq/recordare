// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Nightly facts review (M5): the owner's current facts are checked against the episodes recorded since the last
 * review. During the day each fact is decided from one chat window; at night the whole recent story is in view, so a
 * missed change (a new car, a move, a new job) or a value that did not hold can be fixed. Same output and the same
 * code-side rules as the extraction's facts (history kept, corrections never rewrite).
 */
import { z } from 'zod';

export const FACTS_REVIEW_VERSION = 'facts_review.v1';

export const FACTS_REVIEW_SYSTEM = `You maintain the owner's FACTS: durable state about the owner (car, address, employer, \\
job title, partner, children, pets, languages, health constraints…). You get the CURRENT FACTS (with their history) and \\
the EPISODES recorded recently (what the owner lived, did, planned; dated). Propose only changes the episodes support.

VERDICTS — one per fact you change; facts the episodes do not touch are left out
- "new": a slot with no current value. "replace": the value changed (target = the current fact; valid_from = when it \\
changed, from the episode). "corrects": the current value was never true (target required). "stale" / "unknown": the \\
current value no longer holds and the new one is not known (target required, value null).
- Single-value slots are replaced; multi-value slots (children, pets, languages) accumulate ("new" for each new item).
- A plan is not a change: "I will buy a Tesla" changes nothing until an episode says it happened.
- What other people claim about the owner (the episode says so) is not a fact about the owner.
- Never restate an unchanged fact; never invent a value or a date; when unsure, leave the fact alone.
- Reuse the keys of CURRENT FACTS and KNOWN SLOTS (snake_case).
- evidence: the numbers of the EPISODES that support the change.

Output JSON only: {"facts": [{"key", "value", "verdict", "target", "cardinality", "valid_from", "date_precision", "evidence"}]}
"facts": [] when nothing changes.`;

const date = z.string().nullable().optional();
export const factsReviewSchema = z.object({
  facts: z.array(z.object({
    key: z.string().min(1),
    value: z.string().nullable().optional(),
    verdict: z.enum(['new', 'replace', 'corrects', 'stale', 'unknown']),
    target: z.string().nullable().optional(),
    cardinality: z.enum(['single', 'multi']).optional(),
    valid_from: date,
    date_precision: z.enum(['day', 'month', 'year', 'approximate', 'unknown']).optional(),
    evidence: z.array(z.number().int()).default([]),
  })).default([]),
});
export type FactsReviewOutput = z.infer<typeof factsReviewSchema>;
