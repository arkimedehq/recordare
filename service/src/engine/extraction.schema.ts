// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/** Output contract of the extraction call (one call per window, D32). Validated in code. */
import { z } from 'zod';

const evidence = z.array(z.number().int().positive()).default([]);
const date = z.string().nullable().optional();
const precision = z.enum(['day', 'month', 'year', 'approximate', 'unknown']).optional();
/**
 * Whose an item is (personal memories, extract.v12): "me", a C-number of the listed contacts, "Name (relation)",
 * "someone" or "undecided" (with candidates and a question). Entity memories use it on facts only (D48).
 */
const subject = z.string().max(200).nullable().optional();
const candidates = z.array(z.string().max(20)).max(10).default([]);

export const extractionSchema = z.object({
  episodes: z.array(z.object({
    content: z.string().min(1),
    subject,
    candidates,
    question: z.string().max(300).nullable().optional(),
    kind: z.enum(['event', 'plan', 'state_change']).default('event'),
    occurred_at: date,
    occurred_until: date,
    date_precision: precision,
    time_expression: z.string().nullable().optional(),
    // extract.v11 (entity): owner_*; extract.v12 (personal): lived / told.
    origin: z.enum(['owner_lived', 'owner_told', 'assistant_stated', 'lived', 'told']).default('owner_lived'),
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
    /** Entity memories (D48): the person the fact is about; null = the entity itself. Personal memories: see `subject`. */
    subject,
    cardinality: z.enum(['single', 'multi']).optional(),
    valid_from: date,
    date_precision: precision,
    evidence,
  })).default([]),
  notes: z.array(z.object({
    subject,
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
  /** Personal memories: OPEN QUESTIONS the window answers (Q-number → the chosen C-number). */
  answers: z.array(z.object({
    question: z.string().max(20),
    contact: z.string().max(20),
    evidence,
  })).default([]),
});

export type ExtractionOutput = z.infer<typeof extractionSchema>;
