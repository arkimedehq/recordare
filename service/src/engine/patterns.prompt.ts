// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Nightly pattern pass (WORK_PLAN 5.4, D20 / D26 as decided 2026-10-12): the memory draws its own conclusions about
 * what keeps happening — habits, routines, regular choices, regular contacts — from the episodes of the last months.
 * The model only proposes; the code keeps a pattern only when at least three episodes on different days of one subject
 * back it, never restates what the memory already knows and never brings back a pattern it was told to forget.
 * v2: the episodes carry their weekday; patterns that stopped holding are listed (STOPPED).
 * Inspired by Generative Agents' reflections and Honcho's induction step (evidence ids cited, invented ids discarded);
 * no text reused.
 */
import { z } from 'zod';

export const PATTERNS_VERSION = 'patterns.v2';
/** Entity memories: the same version with the entity voice. */
export const ENTITY_PATTERNS_SUFFIX = '+entity';

const BODY = `You get ME, TODAY, the EPISODES of the last months (E-numbers, with date and weekday; an episode is mine \
unless it starts with [Name], [someone] or [undecided: …]), the PATTERNS I already hold (P-numbers, with the E-numbers \
behind them when listed), what I already KNOW (notes: never restate them), the patterns I was told to FORGET (never \
propose them again) and those that STOPPED holding (propose one again only when new episodes show it again).

A PATTERN is a regularity: the same kind of thing done or happening again and again, on different days — a routine, a \
habit, a regular choice, a regular contact.
Not a pattern: one event; the same event told several times; plans; things of one trip or one short period only; a \
state (a job, a city, a car); a taste stated once (that is a note the conversations already give).

VERDICTS
- "new": a pattern not in PATTERNS. evidence: the E-numbers of AT LEAST THREE episodes, on different days, each of \
which shows it. Never cite an episode that does not show it.
- "keep": a pattern in PATTERNS that episodes not yet listed under it confirm (target = P-number; evidence: those \
episodes only).
- "update": a pattern in PATTERNS that changed — how often, when, where, with whom (target; content = the new form; \
evidence: at least three episodes of the new form).
- "retire": a pattern in PATTERNS that stopped holding because an episode says so (I stopped, I moved, I quit; target; \
evidence: that episode). Never retire a pattern only because recent episodes do not mention it: seasons and gaps \
are normal.
- content: one short sentence in MEMORY LANGUAGE, in the first person for mine. Say how often and when as the episodes \
show it, without exaggerating ("often" for a few times, never "always"); no reasons or feelings the episodes do not state.
- category: "habit" (what is done regularly), "preference" (what is regularly chosen), "relationship" (regular contact \
with a person).
- subject: "me", or the Name the episodes carry in brackets; every evidence episode must be of that subject.
- When unsure, propose nothing: an empty list is the usual answer.

Output JSON only: {"patterns": [{"verdict", "target", "subject", "category", "content", "evidence"}]}`;

export const PATTERNS_SYSTEM = `You find the RECURRING PATTERNS in an agent's memory, written in the FIRST PERSON: mine \
and those of the people I know. I am ME: one self — the person whose memory this is and the assistant acting for them. \
${BODY}`;

export const ENTITY_PATTERNS_SYSTEM = `You find the RECURRING PATTERNS in an agent's memory, written in the FIRST \
PERSON. I am ME: a shared agent — a device, a place, a robot or a service — that several people talk to. Patterns are \
those of the people who talk to me (each under their Name) and of me and my place (subject "me"). ${BODY}`;

export const patternsSchema = z.object({
  patterns: z.array(z.object({
    verdict: z.enum(['new', 'keep', 'update', 'retire']),
    target: z.string().nullable().optional(),
    subject: z.string().max(200).nullable().optional(),
    category: z.enum(['habit', 'preference', 'relationship']).catch('habit'),
    content: z.string().nullable().optional(),
    evidence: z.array(z.union([z.number().int(), z.string()])).default([]),
  })).default([]),
});
export type PatternsOutput = z.infer<typeof patternsSchema>;
