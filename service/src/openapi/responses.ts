// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * What the ingest, sources, context, `me`, health and admin routes answer (API.md): the response half of the contract,
 * as `read/read.responses.ts` is for the read API. The admin and Atlas answers serve the console and Atlas: loose
 * objects, not a stable contract.
 */
import { z } from 'zod';

export const healthResponse = z.object({ status: z.enum(['ok', 'degraded']), database: z.boolean() });

const ingestResult = {
  conversationId: z.uuid().nullable().describe('null only when no message was sent.'),
  accepted: z.number().int(),
  duplicates: z.number().int(),
  conflicts: z.array(z.string()).describe('External ids of messages already stored with another content (send `upsert` to replace).'),
};

export const ingestResponse = z.object(ingestResult);

export const roomResponse = z.object({
  recipients: z.array(z.object({ user: z.string(), ...ingestResult })).describe('One per recipient, in the request\'s order.'),
});

export const learnSourceResponse = z.object({
  sourceId: z.uuid(),
  status: z.enum(['receiving', 'indexing', 'ready']),
  parts: z.number().int().describe('Parts received so far (the first request included).'),
  passages: z.number().int(),
  duplicate: z.boolean().describe('The same request (or part) was already received: nothing changed.'),
});

const source = z.object({
  id: z.uuid(),
  externalId: z.string(),
  title: z.string(),
  kind: z.string(),
  author: z.string().nullable(),
  uri: z.string().nullable(),
  providedBy: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('self') }), z.object({ kind: z.literal('someone') }), z.object({ kind: z.literal('contact'), name: z.string() }),
  ]),
  learnedAt: z.string(),
  status: z.enum(['receiving', 'indexing', 'ready']),
  chars: z.number().int(),
  passages: z.number().int(),
  episodeIds: z.array(z.uuid()).describe('The episodes that refer to it (the learning, and what was done with it).'),
});

export const sourcesResponse = z.array(source);

export const sourceDetailResponse = source.extend({
  text: z.array(z.object({ ordinal: z.number().int(), heading: z.string().nullable(), content: z.string() })),
});

export const contextResponse = z.object({
  block: z.string().nullable().describe('The fenced <memory-context> block to append to the prompt, or null.'),
  items: z.number().int(),
});

export const meResponse = z.object({
  memoryId: z.uuid(),
  displayName: z.string().nullable(),
  mode: z.enum(['personal', 'entity']),
  gender: z.enum(['masculine', 'feminine', 'neutral']),
  atlasUrl: z.string().optional().describe('Recordare Atlas, when installed: link it for the platform\'s admins only.'),
  via: z.enum(['admin', 'client', 'memory_token']),
  scopes: z.array(z.string()),
});

export const erasedResponse = z.object({
  erased: z.object({ conversations: z.number().int(), messages: z.number().int(), episodes: z.number().int(), facts: z.number().int(),
    notes: z.number().int(), digests: z.number().int(), sources: z.number().int(), contacts: z.number().int() }),
});

export const linkCodeResponse = z.object({ code: z.string(), expiresAt: z.string() });

export const holderIdentitiesResponse = z.object({
  linked: z.array(z.object({ id: z.uuid(), channel: z.string().nullable(), client: z.string().nullable(), externalId: z.string(), linkedAt: z.string() })),
  pending: z.array(z.object({
    id: z.uuid(), channel: z.string().nullable(), client: z.string().nullable(), externalId: z.string(), displayName: z.string().nullable(), claimedAt: z.string(),
  })),
});

const LOOSE = 'Admin console data: its shape is not part of the stable contract.';
/** An admin console object (an entity, a report): its shape follows the console, not a stable contract. */
export const adminObject = z.custom<object>((v) => typeof v === 'object' && v !== null).meta({ type: 'object', description: LOOSE });
export const adminList = z.array(z.unknown()).describe(LOOSE);

export const keyResponse = z.object({ id: z.uuid(), key: z.string().describe('Shown once.'), prefix: z.string() });
export const tokenResponse = z.object({ id: z.uuid(), token: z.string().describe('Shown once.'), prefix: z.string() });

export const atlasMemoriesResponse = z.array(z.object({ id: z.uuid(), name: z.string(), episodes: z.number().int(), lastActivity: z.string().nullable() }));
export const atlasSnapshotResponse = z.custom<object>((v) => typeof v === 'object' && v !== null)
  .meta({ type: 'object', description: 'The Atlas snapshot (docs/ATLAS_EVENTS.md).' });

export const openApiResponse = z.custom<Record<string, unknown>>((v) => typeof v === 'object' && v !== null)
  .meta({ type: 'object', description: 'This OpenAPI 3.1 document.' });
