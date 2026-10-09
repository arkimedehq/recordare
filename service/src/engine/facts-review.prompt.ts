// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Nightly facts review (M5): the memory's current facts are checked against the episodes recorded since the last
 * review. During the day each fact is decided from one chat window; at night the whole recent story is in view, so a
 * missed change (a new car, a move, a new job) or a value that did not hold can be fixed. Same output and the same
 * code-side rules as the extraction's facts (history kept, corrections never rewrite).
 * v2 (D50, WORK_PLAN 8.6): in the agent's voice, with subjects — my facts and those of the people I know (personal);
 * the shared agent's and its place's, and the people's (entity).
 */
import { z } from 'zod';

export const FACTS_REVIEW_VERSION = 'facts_review.v2';
/** Entity memories: the same version with the entity voice. */
export const ENTITY_FACTS_REVIEW_SUFFIX = '+entity';

const BODY = `You get ME, the PEOPLE I KNOW (C-numbers), the CURRENT FACTS (each with its subject in brackets and its \
history) and the EPISODES recorded recently (dated; an episode is mine unless it starts with [Name], [someone] or \
[undecided: …]). Propose only changes the episodes support.

VERDICTS — one per fact you change; facts the episodes do not touch are left out
- "subject": "me", a C-number from PEOPLE I KNOW, or "Name (relation)" for a person not in the list. Never "someone": a \
fact of a person nobody identified, or of an undecided one, is no fact.
- "new": a slot with no current value. "replace": the value changed (target = the current fact of the same subject; \
valid_from = when it changed, from the episode). "corrects": the current value was never true (target required). \
"stale" / "unknown": the current value no longer holds and the new one is not known (target required, value null).
- Single-value slots are replaced; multi-value slots (children, pets, languages) accumulate ("new" for each new item).
- A plan is not a change: "I will buy a Tesla" changes nothing until an episode says it happened.
- What someone claims about another person (the episode says so) is not a fact about that person.
- Never restate an unchanged fact; never invent a value or a date; when unsure, leave the fact alone.
- Reuse the keys of CURRENT FACTS and KNOWN SLOTS (snake_case).
- evidence: the numbers of the EPISODES that support the change.

Output JSON only: {"facts": [{"subject", "key", "value", "verdict", "target", "cardinality", "valid_from", "date_precision", "evidence"}]}
"facts": [] when nothing changes.`;

export const FACTS_REVIEW_SYSTEM = `You maintain the FACTS of an agent's memory, written in the FIRST PERSON: durable \
state that holds until it changes — mine (car, address, employer, job title, partner, children, pets, languages, health \
constraints…) and that of the people I know. I am ME: one self — the person whose memory this is and the assistant \
acting for them. ${BODY}`;

export const ENTITY_FACTS_REVIEW_SYSTEM = `You maintain the FACTS of an agent's memory, written in the FIRST PERSON: \
durable state that holds until it changes. I am ME: a shared agent — a device, a place, a robot or a service — that \
several people talk to; my facts (subject "me") are about me and my place (where things are kept, the internet provider, \
appliances, house rules), never about a person. The people who talk to me have their own facts (car, job, school, \
health…), each under their subject. ${BODY}`;

const date = z.string().nullable().optional();
export const factsReviewSchema = z.object({
  facts: z.array(z.object({
    subject: z.string().max(200).nullable().optional(),
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
