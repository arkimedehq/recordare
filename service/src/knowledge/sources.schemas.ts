// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/** Contracts of learned sources (WORK_PLAN 8.9, D49): text only — the client turns files into text. */
import { z } from 'zod';

export const SOURCE_KINDS = ['document', 'page', 'note', 'book', 'own_text'] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

/**
 * Who gave the source: "me" (the memory's self — the account holder, or the shared agent itself), "someone" (not
 * identified), or a person by name (a contact of the memory, created when new).
 */
const providedBy = z.union([z.literal('me'), z.literal('someone'), z.object({ name: z.string().trim().min(1).max(200) })]);

export const learnSourceSchema = z.object({
  /** The client's own id for the source: sending it again replaces the source (a new version of the text). */
  externalId: z.string().min(1).max(200),
  title: z.string().trim().min(1).max(500),
  kind: z.enum(SOURCE_KINDS).default('document'),
  author: z.string().trim().max(300).optional(),
  uri: z.string().max(2000).optional(),
  language: z.string().max(20).optional(),
  learnedAt: z.iso.datetime({ offset: true }).optional(),
  providedBy: providedBy.default('me'),
  /** The conversation the source was learned in (its extraction then tells of it), when there is one. */
  conversation: z.object({ externalId: z.string().min(1).max(200) }).optional(),
  /** The text, or its first part; `final: false` = more parts follow (POST …/parts). No size limit beyond one request's. */
  text: z.string().min(1),
  final: z.boolean().default(true),
});
export type LearnSourceRequest = z.infer<typeof learnSourceSchema>;

export const sourcePartSchema = z.object({
  /** 1, 2, 3… in order (the first request is part 0); a part sent again is a duplicate, a gap is refused. */
  part: z.number().int().min(1),
  text: z.string().min(1),
  final: z.boolean().default(true),
});
export type SourcePartRequest = z.infer<typeof sourcePartSchema>;

export interface LearnSourceResult {
  sourceId: string;
  status: 'receiving' | 'indexing' | 'ready';
  /** Parts received so far (the first request included). */
  parts: number;
  passages: number;
  /** The same request (or part) was already received: nothing changed. */
  duplicate: boolean;
}
