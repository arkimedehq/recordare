// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/** REST ingest contract (docs/API.md §2). */
import { z } from 'zod';
import { CONVERSATION_SOURCES } from './rawlog.entities';

const identity = z.union([
  z.object({ channel: z.string().min(1), externalId: z.string().min(1) }),
  z.object({ externalUserId: z.string().min(1) }),
]);

export const ingestSchema = z.object({
  conversation: z.object({
    externalId: z.string().min(1).max(500),
    source: z.enum(CONVERSATION_SOURCES).exclude(['mcp_tool']).default('chat'),
    channel: z.string().max(100).optional(),
    title: z.string().max(500).optional(),
    participants: z.array(z.object({
      ref: z.string().min(1).max(200),
      role: z.enum(['holder', 'assistant', 'other']),
      displayName: z.string().max(200).optional(),
      identity: identity.optional(),
    })).max(200).default([]),
  }),
  messages: z.array(z.object({
    externalId: z.string().min(1).max(500),
    // `system` is not accepted: system prompts may carry secrets (docs/API.md §2).
    role: z.enum(['user', 'assistant', 'tool', 'other']),
    toolName: z.string().max(200).optional(),
    authorRef: z.string().max(200).optional(),
    content: z.string().min(1).max(64 * 1024),
    sentAt: z.iso.datetime({ offset: true }),
    upsert: z.boolean().default(false),
    /** The agent's own content (knowledge given to it, its perceptions, a document) — D50; only on `user` / `other` turns. */
    own: z.boolean().optional(),
  }).refine((m) => !m.own || m.role === 'user' || m.role === 'other', { message: 'own applies to user or other messages', path: ['own'] }))
    .min(1).max(500),
  hints: z.object({ conversationEnded: z.boolean().optional() }).default({}),
});

export type IngestRequest = z.infer<typeof ingestSchema>;

export interface IngestResult {
  conversationId: string;
  accepted: number;
  duplicates: number;
  conflicts: string[];
}

export const editMessageSchema = z.object({ content: z.string().min(1).max(64 * 1024) });
