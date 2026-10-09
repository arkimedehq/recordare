// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { z } from 'zod';
import { MEMORY_GENDERS, MEMORY_MODES, SCOPES } from '../identity/identity.entities';
import { QUALITY_PROFILES } from '../engine/quality-profile';

const scopes = z.array(z.enum(SCOPES)).min(1);

export const createClientSchema = z.object({
  name: z.string().min(1).max(200),
  kind: z.enum(['platform', 'mcp_client', 'import']),
  autoProvision: z.boolean().default(false),
  rawLogScope: z.enum(['own', 'all']).default('own'),
});

export const updateClientSchema = z.object({
  autoProvision: z.boolean().optional(),
  /** true = every key and token of the client stops working at once; false = back on. */
  disabled: z.boolean().optional(),
});

/** Client keys never carry `admin`, `owner_settings` or `export` (installation-level powers stay with the admin). */
export const createKeySchema = z.object({
  scopes: z.array(z.enum(['ingest', 'mcp', 'read', 'write'])).min(1),
});

export const createOwnerSchema = z.object({
  displayName: z.string().min(1).max(200),
  /** `entity`: a memory everyone using the account reads and writes — a shared device, a robot, a place (D48, D50). */
  mode: z.enum(MEMORY_MODES).default('personal'),
  /** First person in gendered languages (D50). */
  gender: z.enum(MEMORY_GENDERS).default('masculine'),
  locale: z.enum(['it', 'en']).default('it'),
  timezone: z.string().min(1).default('Europe/Rome'),
  /** D35; omitted = installation default. */
  qualityProfile: z.enum(QUALITY_PROFILES).nullable().default(null),
});

export const updateOwnerSchema = z.object({
  displayName: z.string().trim().min(1).max(200).optional(),
  mode: z.enum(MEMORY_MODES).optional(),
  gender: z.enum(MEMORY_GENDERS).optional(),
  locale: z.enum(['it', 'en']).optional(),
  timezone: z.string().min(1).optional(),
  /** null = back to the installation default. */
  qualityProfile: z.enum(QUALITY_PROFILES).nullable().optional(),
});

/**
 * `account`: a client's user opens the memory `personId`. `participant`: inside the memory `ownerScope`, a client's
 * participant id (`clientId`) or a channel id (`channel`) names `personId` — a contact of that memory or its self (D50).
 */
export const createIdentitySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('account'), personId: z.uuid(), clientId: z.uuid(), externalId: z.string().min(1) }),
  z.object({
    kind: z.literal('participant'), ownerScope: z.uuid(), personId: z.uuid(),
    clientId: z.uuid().optional(), channel: z.string().min(1).optional(), externalId: z.string().min(1), verified: z.boolean().default(false),
  }).refine((b) => (b.clientId === undefined) !== (b.channel === undefined), { message: 'exactly one of clientId or channel' }),
]);

export const createTokenSchema = z.object({
  clientId: z.uuid(),
  scopes,
  expiresAt: z.iso.datetime({ offset: true }).optional(),
});

export type CreateClient = z.infer<typeof createClientSchema>;
export type CreateKey = z.infer<typeof createKeySchema>;
export type UpdateClient = z.infer<typeof updateClientSchema>;
export type CreateOwner = z.infer<typeof createOwnerSchema>;
export type UpdateOwner = z.infer<typeof updateOwnerSchema>;
export type CreateIdentity = z.infer<typeof createIdentitySchema>;
export type CreateToken = z.infer<typeof createTokenSchema>;
