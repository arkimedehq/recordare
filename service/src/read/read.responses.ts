// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * What the read / write API for host UIs answers (API.md §4): the response half of the contract, in the OpenAPI document
 * and checked against every response the tests see. The handlers return these types, so the compiler checks the
 * services against them too.
 */
import { z } from 'zod';
import { QUALITY_PROFILES } from '../engine/quality-profile';

const PRECISIONS = ['minute', 'day', 'month', 'year', 'approximate', 'unknown'] as const;
const NOTE_CATEGORIES = ['preference', 'habit', 'value', 'relationship', 'knowledge', 'profile', 'constraint'] as const;
const NOTE_CHANGES = ['created', 'updated', 'corrected', 'confirmed', 'forgotten', 'retired'] as const;
const NOTE_STATUSES = ['current', 'superseded', 'corrected'] as const;
export type NoteCategory = (typeof NOTE_CATEGORIES)[number];
export type NoteChangeKind = (typeof NOTE_CHANGES)[number];
export type NoteStatus = (typeof NOTE_STATUSES)[number];

export const createdResponse = z.object({ id: z.uuid() }).describe('The new row (a correction is a new row that replaces the old one).');

/** D52: present only on a private item — whose it is (no name when nobody identified said it). */
const privateMark = z.object({ by: z.array(z.string()) }).optional()
  .describe('Private (D52): told only to these people and to a personal memory\'s holder.');

export const episodeResponse = z.object({
  id: z.uuid(),
  kind: z.enum(['event', 'plan', 'state_change']),
  content: z.string(),
  occurredAt: z.string().nullable().describe('Local date: YYYY-MM-DD, or YYYY-MM / YYYY by precision.'),
  occurredUntil: z.string().nullable(),
  datePrecision: z.enum(PRECISIONS),
  timeExpression: z.string().nullable(),
  place: z.string().nullable(),
  planStatus: z.enum(['open', 'confirmed', 'cancelled', 'rescheduled', 'unresolved']).optional(),
  importance: z.number(),
  valence: z.number().nullable(),
  feelings: z.array(z.string()),
  opinion: z.string().nullable(),
  people: z.array(z.string()),
  origin: z.string(),
  authorRole: z.string(),
  inferred: z.boolean(),
  corrected: z.boolean().describe('This row replaced an earlier, wrong version (see the detail\'s history).'),
  recordedAt: z.string(),
  private: privateMark,
});

export const episodesResponse = z.object({ items: z.array(episodeResponse), nextCursor: z.string().nullable() });

/** A message behind an item: its text only from the reading client's own conversations. */
const ownEvidence = z.object({
  messageId: z.uuid(), conversation: z.string().describe('The conversation\'s external id on the client.'), role: z.string(), author: z.string().nullable(),
  sentAt: z.string(), text: z.string(),
});
const otherEvidence = z.object({ role: z.string(), sentAt: z.string(), otherClient: z.literal(true) });
const itemEvidence = z.array(z.union([ownEvidence, otherEvidence]));
/** An episode's evidence also says how the message backs it (`kind`). */
const episodeEvidence = z.array(z.union([ownEvidence.extend({ kind: z.string() }), otherEvidence.extend({ kind: z.string() })]));

export const episodeDetailResponse = episodeResponse.extend({
  evidence: episodeEvidence,
  history: z.array(z.object({ id: z.uuid(), content: z.string(), occurredAt: z.string().nullable(), recordedAt: z.string() }))
    .describe('Earlier, wrong versions this one corrected (newest first).'),
  planEvents: z.array(z.object({ patch: z.string(), note: z.string().nullable(), at: z.string() })).optional(),
  confirmedBy: episodeResponse.nullable().optional(),
  rescheduledTo: episodeResponse.nullable().optional(),
});

export const forgetPeriodResponse = z.object({ episodes: z.number().int(), messages: z.number().int(), facts: z.number().int(), notes: z.number().int() });

export const digestsResponse = z.array(z.object({
  id: z.uuid(), level: z.enum(['day', 'month']), periodStart: z.string(), periodEnd: z.string(), content: z.string(), writtenAt: z.string(),
}));

const fact = z.object({
  id: z.uuid(),
  about: z.string().optional().describe('Entity memories: the person the fact is about.'),
  key: z.string(),
  value: z.string().nullable(),
  status: z.string(),
  validFrom: z.string().nullable(),
  validTo: z.string().nullable(),
  pending: z.boolean(),
  inferred: z.boolean(),
  history: z.array(z.object({ id: z.uuid(), value: z.string().nullable(), from: z.string().nullable(), to: z.string().nullable(), status: z.string() })),
  private: privateMark,
});

export const factsResponse = z.array(fact);

export const factDetailResponse = fact.extend({
  authorRole: z.string(),
  corrects: z.uuid().nullable(),
  recordedAt: z.string(),
  evidence: itemEvidence,
  episodeIds: z.array(z.uuid()),
});

const note = z.object({
  id: z.uuid(),
  category: z.enum(NOTE_CATEGORIES),
  content: z.string(),
  pinned: z.boolean(),
  pending: z.boolean(),
  inferred: z.boolean(),
  pattern: z.boolean().describe('A recurring pattern the memory drew from its episodes (inferred, never pending).'),
  authorRole: z.string(),
  supportCount: z.number().int(),
  recordedAt: z.string(),
  private: privateMark,
});

export const notesResponse = z.array(note);

const card = z.object({
  personId: z.uuid(),
  name: z.string(),
  aliases: z.array(z.string()),
  facts: z.array(z.object({ id: z.uuid(), key: z.string(), value: z.string().nullable(), validFrom: z.string().nullable() })),
  notes: z.array(z.object({ id: z.uuid(), category: z.string(), content: z.string(), pinned: z.boolean(), pattern: z.boolean() })),
  lastMentioned: z.string().nullable().describe('The day of the latest episode about this contact (null for the self).'),
});

export const privateItemsResponse = z.array(z.object({
  kind: z.enum(['episode', 'fact', 'note']), id: z.uuid(), by: z.array(z.string()), recordedAt: z.string(),
})).describe('Private memories (D52): that they exist and whose they are, never their content; they can be forgotten.');

export const cardsResponse = z.object({ self: card, contacts: z.array(card) })
  .describe('Who I am and who my contacts are: current facts and notes, no LLM (WORK_PLAN 8.13).');

export const noteDetailResponse = note.extend({
  status: z.enum(NOTE_STATUSES),
  supersedes: z.uuid().nullable(),
  corrects: z.uuid().nullable(),
  evidence: itemEvidence,
  episodeIds: z.array(z.uuid()),
});

export const noteChangesResponse = z.object({
  items: z.array(z.object({
    seq: z.number().int(),
    noteId: z.uuid(),
    change: z.enum(NOTE_CHANGES),
    at: z.string(),
    replaces: z.uuid().nullable().describe('For updated / corrected: the note this one took the place of.'),
    note: note.extend({ status: z.enum(NOTE_STATUSES) }).nullable().describe('The note as it is now; null once forgotten.'),
  })),
  next: z.number().int().describe('The `since` of the next call.'),
  more: z.boolean(),
});

export const plansResponse = z.array(episodeResponse);

export const settingsResponse = z.object({
  locale: z.string(),
  timezone: z.string(),
  qualityProfile: z.enum(QUALITY_PROFILES).nullable().describe('null: the installation default (effectiveQualityProfile).'),
  effectiveQualityProfile: z.enum(QUALITY_PROFILES),
});

const usageTotals = { calls: z.number().int(), inputTokens: z.number().int(), cachedInputTokens: z.number().int(), outputTokens: z.number().int(), failed: z.number().int() };

export const usageResponse = z.object({
  ...usageTotals,
  from: z.string(),
  to: z.string(),
  byPrompt: z.array(z.object({ ...usageTotals, prompt: z.string() })),
  byDay: z.array(z.object({ ...usageTotals, day: z.string() })),
});

export const exportResponse = z.object({
  id: z.uuid(), status: z.enum(['running', 'done', 'failed']), createdAt: z.string(), finishedAt: z.string().nullable(), bytes: z.number().int().nullable(),
});
