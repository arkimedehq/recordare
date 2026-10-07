// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/** Output contract of the extraction call (one call per window, D32). Validated in code. */
import { z } from 'zod';

const evidence = z.array(z.number().int().positive()).default([]);
const date = z.string().nullable().optional();
const precision = z.enum(['day', 'month', 'year', 'approximate', 'unknown']).optional();

export const extractionSchema = z.object({
  episodes: z.array(z.object({
    content: z.string().min(1),
    kind: z.enum(['event', 'plan', 'state_change']).default('event'),
    occurred_at: date,
    occurred_until: date,
    date_precision: precision,
    time_expression: z.string().nullable().optional(),
    origin: z.enum(['owner_lived', 'owner_told', 'assistant_stated']).default('owner_lived'),
    people: z.array(z.string()).default([]),
    place: z.string().nullable().optional(),
    importance: z.number().int().min(1).max(10).default(5),
    valence: z.number().int().min(-2).max(2).nullable().optional(),
    feelings: z.array(z.string()).default([]),
    opinion: z.string().nullable().optional(),
    keywords: z.array(z.string()).default([]),
    context: z.string().nullable().optional(),
    tags: z.array(z.string()).default([]),
    corrects: z.string().nullable().optional(),
    evidence,
  })).default([]),
  plan_patches: z.array(z.object({
    plan: z.string(),
    patch: z.enum(['confirm', 'cancel', 'reschedule', 'amend']),
    new_date: date,
    new_until: date,
    date_precision: precision,
    new_content: z.string().nullable().optional(),
    event: z.number().int().nonnegative().nullable().optional(),
    note: z.string().nullable().optional(),
    evidence,
  })).default([]),
  facts: z.array(z.object({
    key: z.string().min(1),
    value: z.string().nullable().optional(),
    verdict: z.enum(['new', 'keep', 'replace', 'corrects', 'stale', 'unknown']),
    target: z.string().nullable().optional(),
    /** Entity memories (D48): the person the fact is about; null = the entity itself. Ignored for a person's memory. */
    subject: z.string().max(200).nullable().optional(),
    cardinality: z.enum(['single', 'multi']).optional(),
    valid_from: date,
    date_precision: precision,
    evidence,
  })).default([]),
  notes: z.array(z.object({
    category: z.enum(['preference', 'habit', 'value', 'relationship', 'knowledge', 'profile', 'constraint']),
    content: z.string().min(1),
    keywords: z.array(z.string()).default([]),
    context: z.string().nullable().optional(),
    tags: z.array(z.string()).default([]),
    verdict: z.enum(['new', 'keep', 'replace', 'corrects']).default('new'),
    target: z.string().nullable().optional(),
    stance: z.enum(['stated', 'inferred']).default('stated'),
    evidence,
  })).default([]),
});

export type ExtractionOutput = z.infer<typeof extractionSchema>;
