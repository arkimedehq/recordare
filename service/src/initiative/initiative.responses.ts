// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { z } from 'zod';

export const INITIATIVE_KINDS = ['say', 'ask', 'lookup', 'do'] as const;
export const INITIATIVE_STATUSES = ['pending', 'offered', 'said', 'asked', 'ignored', 'declined', 'done', 'failed', 'expired'] as const;

/** An initiative (D53, 8.12c): what the agent decided to say or do on its own, for whom and until when. */
export const initiative = z.object({
  id: z.uuid(),
  seq: z.number().int().describe('The feed position: pass the last one back as `since`.'),
  kind: z.enum(INITIATIVE_KINDS).describe('say: tell it; ask: ask it; lookup: find it out (for the host agent, with its own tools); do: an action.'),
  for: z.object({ personId: z.uuid(), name: z.string() }).nullable().describe('Whom it is for; null: the holder, or anyone in an entity memory.'),
  text: z.string().describe('In the memory\'s language, ready to be said.'),
  reason: z.string(),
  worth: z.number().min(0).max(1).nullable().describe('How much the model found it worth saying (balanced, full); null when the sentence is the service\'s own.'),
  episodeIds: z.array(z.uuid()).describe('The memories behind it.'),
  dueAt: z.string().describe('From when it may be delivered (after the quiet hours).'),
  expiresAt: z.string().describe('Until when; then it lapses, quietly.'),
  status: z.enum(INITIATIVE_STATUSES).describe('offered: given to the agent in a turn or after a presence impulse (D55), waiting for what happens next.'),
  outcomeAt: z.string().nullable(),
  reply: z.string().nullable(),
  createdAt: z.string(),
  timing: z.enum(['timed', 'flexible']).describe('timed: a time was asked for; flexible: a window, the moment chosen by Recordare (D55).'),
  window: z.object({ notBefore: z.string(), notAfter: z.string() }),
  channel: z.string().nullable().describe('Where it was offered, or will be delivered (a declared channel); null: at the person\'s next presence or turn.'),
  identity: z.object({ required: z.enum(['medium', 'high']) }).describe('How surely the person must be recognised before hearing it.'),
  source: z.object({ conversation: z.string(), messageIds: z.array(z.string()) }).nullable()
    .describe('The client\'s own ids of the messages its intent came from: a host recognises a reminder it scheduled itself.'),
  offeredAt: z.string().nullable(),
  pushedAt: z.string().nullable().describe('When Recordare pushed it to its channel (event `initiative.deliver`).'),
});

export const initiativesResponse = z.object({ items: z.array(initiative), next: z.number().int(), more: z.boolean() });
export const initiativeResponse = initiative;

export const webhook = z.object({
  id: z.uuid(), clientId: z.uuid(), url: z.string(), token: z.string().nullable(),
  authentication: z.object({ scheme: z.string(), credentials: z.string().optional() }).nullable(),
  description: z.string().nullable(), events: z.array(z.string()).nullable().describe('The event types it takes; null: all.'),
  createdAt: z.string(), disabledAt: z.string().nullable(), disabledReason: z.string().nullable(),
});
export const webhookCreatedResponse = webhook.extend({ secret: z.string().describe('The `whsec_` signing secret, shown once (Standard Webhooks).') });
export const webhooksResponse = z.array(webhook);

/** `POST api/v1/presence` (D55): who was recognised, and what to tell or ask them now, if this is the moment. */
export const presenceResponse = z.object({
  person: z.object({ personId: z.uuid(), name: z.string() }).nullable().describe('The person recognised in this memory; null: not identified.'),
  initiative: initiative.nullable().describe('To deliver now (it is `offered`); report the outcome afterwards.'),
  askWho: z.object({ personId: z.uuid(), name: z.string() }).nullable()
    .describe('Nobody identified, something waits for this person: the agent may ask whether it is them — revealing nothing of it.'),
});
