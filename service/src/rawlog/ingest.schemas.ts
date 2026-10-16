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
    /** A one-to-one chat (true) or a group (false); unknown when missing. A link code is never accepted in a group (D51). */
    direct: z.boolean().optional(),
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

/**
 * A room transcript (continuous listening, WORK_PLAN 6.5 (4)): what a home device heard, fanned out by the service to
 * the memories of the people present (`recipients`, the client's user ids — the client's own on/off switch decides who
 * is in it, D50). Each recipient's memory gets it as an `ambient` conversation with the same external id: their own
 * words as `user` turns, everyone else's as `other` turns of participants linked to contacts of that memory.
 */
export const roomSchema = z.object({
  conversation: z.object({
    externalId: z.string().min(1).max(500),
    channel: z.string().max(100).optional(),
    title: z.string().max(500).optional(),
  }),
  speakers: z.array(z.object({
    ref: z.string().min(1).max(200),
    displayName: z.string().max(200).optional(),
    /** The client's user id of a speaker with an account: in their own memory their words are theirs. */
    user: z.string().min(1).max(500).optional(),
    /** Otherwise (or as well) a channel identity, e.g. a voice profile: a contact in every recipient's memory. */
    identity: identity.optional(),
  })).max(200).default([]),
  recipients: z.array(z.string().min(1).max(500)).min(1).max(50),
  messages: z.array(z.object({
    externalId: z.string().min(1).max(500),
    /** The speaker's ref; missing when the device could not tell who spoke (then "someone" in every memory). */
    speakerRef: z.string().max(200).optional(),
    content: z.string().min(1).max(64 * 1024),
    sentAt: z.iso.datetime({ offset: true }),
    upsert: z.boolean().default(false),
  })).min(1).max(500),
  hints: z.object({ conversationEnded: z.boolean().optional() }).default({}),
}).refine((r) => r.messages.every((m) => m.speakerRef === undefined || r.speakers.some((s) => s.ref === m.speakerRef)),
  { message: 'speakerRef must name a speaker', path: ['messages'] })
  .refine((r) => new Set(r.speakers.map((s) => s.ref)).size === r.speakers.length, { message: 'speaker refs must be unique', path: ['speakers'] });

export type RoomRequest = z.infer<typeof roomSchema>;

export interface RoomResult {
  /** One per recipient, in the request's order. */
  recipients: Array<{ user: string } & IngestResult>;
}
