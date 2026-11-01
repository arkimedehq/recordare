// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { z } from 'zod';

export const INITIATIVE_KINDS = ['say', 'ask', 'lookup', 'do'] as const;
export const INITIATIVE_STATUSES = ['pending', 'said', 'asked', 'ignored', 'declined', 'done', 'failed', 'expired'] as const;

/** An initiative (D53, 8.12c): what the agent decided to say or do on its own, for whom and until when. */
export const initiative = z.object({
  id: z.uuid(),
  seq: z.number().int().describe('The feed position: pass the last one back as `since`.'),
  kind: z.enum(INITIATIVE_KINDS).describe('say: tell it; ask: ask it; lookup: find it out (for the host agent, with its own tools); do: an action.'),
  for: z.object({ personId: z.uuid(), name: z.string() }).nullable().describe('Whom it is for; null: the holder, or anyone in an entity memory.'),
  text: z.string().describe('In the memory\'s language, ready to be said.'),
  reason: z.string(),
  episodeIds: z.array(z.uuid()).describe('The memories behind it.'),
  dueAt: z.string().describe('From when it may be delivered (after the quiet hours).'),
  expiresAt: z.string().describe('Until when; then it lapses, quietly.'),
  status: z.enum(INITIATIVE_STATUSES),
  outcomeAt: z.string().nullable(),
  reply: z.string().nullable(),
  createdAt: z.string(),
});

export const initiativesResponse = z.object({ items: z.array(initiative), next: z.number().int(), more: z.boolean() });
export const initiativeResponse = initiative;

export const webhook = z.object({
  id: z.uuid(), clientId: z.uuid(), url: z.string(), token: z.string().nullable(),
  authentication: z.object({ scheme: z.string(), credentials: z.string().optional() }).nullable(),
  description: z.string().nullable(), createdAt: z.string(), disabledAt: z.string().nullable(), disabledReason: z.string().nullable(),
});
export const webhookCreatedResponse = webhook.extend({ secret: z.string().describe('The `whsec_` signing secret, shown once (Standard Webhooks).') });
export const webhooksResponse = z.array(webhook);
