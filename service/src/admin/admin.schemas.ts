// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { z } from 'zod';
import { SCOPES } from '../identity/identity.entities';
import { QUALITY_PROFILES } from '../engine/quality-profile';

const scopes = z.array(z.enum(SCOPES)).min(1);

export const createClientSchema = z.object({
  name: z.string().min(1).max(200),
  kind: z.enum(['platform', 'mcp_client', 'import']),
  autoProvision: z.boolean().default(false),
  rawLogScope: z.enum(['own', 'all']).default('own'),
});

/** Client keys never carry `admin`, `owner_settings` or `export` (consent stays with the owner, D33). */
export const createKeySchema = z.object({
  scopes: z.array(z.enum(['ingest', 'mcp', 'read', 'write'])).min(1),
});

export const createOwnerSchema = z.object({
  displayName: z.string().min(1).max(200),
  /** `entity`: a memory everyone using the account reads and writes — a shared device, a robot, a place (D48). */
  kind: z.enum(['human', 'entity']).default('human'),
  locale: z.enum(['it', 'en']).default('it'),
  timezone: z.string().min(1).default('Europe/Rome'),
  episodicEnabled: z.boolean().default(false),
  /** D35; omitted = installation default. */
  qualityProfile: z.enum(QUALITY_PROFILES).nullable().default(null),
});

export const updateOwnerSchema = z.object({
  displayName: z.string().trim().min(1).max(200).optional(),
  kind: z.enum(['human', 'entity']).optional(),
  locale: z.enum(['it', 'en']).optional(),
  timezone: z.string().min(1).optional(),
  episodicEnabled: z.boolean().optional(),
  /** null = back to the installation default. */
  qualityProfile: z.enum(QUALITY_PROFILES).nullable().optional(),
});

export const createIdentitySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('client_user'), personId: z.uuid(), clientId: z.uuid(), externalId: z.string().min(1) }),
  z.object({
    kind: z.literal('channel'), personId: z.uuid(), ownerScope: z.uuid().nullable().default(null),
    channel: z.string().min(1), externalId: z.string().min(1), verified: z.boolean().default(false),
  }),
]);

export const createTokenSchema = z.object({
  clientId: z.uuid(),
  scopes,
  expiresAt: z.iso.datetime({ offset: true }).optional(),
});

export type CreateClient = z.infer<typeof createClientSchema>;
export type CreateKey = z.infer<typeof createKeySchema>;
export type CreateOwner = z.infer<typeof createOwnerSchema>;
export type UpdateOwner = z.infer<typeof updateOwnerSchema>;
export type CreateIdentity = z.infer<typeof createIdentitySchema>;
export type CreateToken = z.infer<typeof createTokenSchema>;
