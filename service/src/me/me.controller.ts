// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { Body, ConflictException, Controller, Delete, ForbiddenException, Get, Headers, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { z } from 'zod';
import { CurrentPrincipal, RequireScopes } from '../auth/decorators';
import { MemoryResolver, USER_HEADER } from '../auth/memory-resolver.service';
import { type Principal } from '../auth/principal';
import { ZodBody } from '../common/zod-body.pipe';
import { Returns } from '../common/returns';
import { holderIdentitiesResponse, linkCodeResponse, meResponse } from '../openapi/responses';
import { type Env } from '../config/env';
import { MEMORY_GENDERS, MEMORY_MODES } from '../identity/identity.entities';
import { confirmClaim, createLinkCode, holderIdentities, rejectClaim, unlinkHolderIdentity } from '../identity/holder-links';

const settingsSchema = z.object({
  displayName: z.string().trim().min(1).max(100).optional(),
  /** D50: `personal` (the account holder is "I") or `entity` (a shared device, robot, place). Chosen on the platform. */
  mode: z.enum(MEMORY_MODES).optional(),
  /** First person in gendered languages (D50); defaults to masculine, the client sends it from the account's profile. */
  gender: z.enum(MEMORY_GENDERS).optional(),
}).refine((b) => b.displayName !== undefined || b.mode !== undefined || b.gender !== undefined, { message: 'nothing to change' });

/** Who am I acting as: lets a client verify its credential and memory mapping. */
@Controller('api/v1/me')
export class MeController {
  constructor(private readonly memories: MemoryResolver, private readonly db: DataSource, private readonly config: ConfigService<Env, true>) {}

  @Get()
  @RequireScopes('read')
  @Returns(meResponse)
  async me(@CurrentPrincipal() principal: Principal, @Headers(USER_HEADER) user?: string) {
    const memoryId = await this.memories.resolve(principal, user);
    const [memory] = await this.db.query(
      `SELECT p.display_name, o.mode, o.gender FROM memories o JOIN persons p ON p.id = o.person_id WHERE o.person_id = $1`, [memoryId]);
    // mode `entity`: a memory shared by everyone using the account (D48, D50) — a client tells its users so.
    // atlasUrl: the live view, when installed — a client links it for its admins (it shows every person's activity).
    const atlasUrl = this.config.get('ATLAS_URL', { infer: true });
    return { memoryId, displayName: memory?.display_name ?? null, mode: memory?.mode ?? 'personal', gender: memory?.gender ?? 'masculine',
      ...(atlasUrl ? { atlasUrl } : {}), via: principal.kind, scopes: principal.kind === 'admin' ? ['admin'] : principal.scopes };
  }

  /**
   * Settings made on the platform. The name follows the client's user (the account's name: in a personal memory the
   * name of "I") and stays in sync when they rename their profile (auto-provisioning first names it after the client's
   * user id). The mode (personal or entity, D50) changes only while the memory is empty: first-person memories would
   * otherwise mix with "someone"'s (409 `memory_not_empty`; the admin can still change it). The gender changes any time.
   * A personal token (`ingest` scope) sets the same settings of its own memory: a host without user accounts (an MCP
   * client, a connector) has no platform profile to sync, so its holder sets them once.
   */
  @Patch()
  @HttpCode(204)
  @RequireScopes('ingest')
  async settings(@CurrentPrincipal() principal: Principal, @Headers(USER_HEADER) user: string | undefined,
    @Body(new ZodBody(settingsSchema)) body: z.infer<typeof settingsSchema>): Promise<void> {
    const memoryId = await this.own(principal, user);
    await this.db.transaction(async (tx) => {
      if (body.mode) {
        const [cur] = await tx.query(`SELECT mode FROM memories WHERE person_id = $1 FOR UPDATE`, [memoryId]);
        if (cur?.mode !== body.mode) {
          const [used] = await tx.query(
            `SELECT EXISTS (SELECT 1 FROM episodes WHERE memory_id = $1 AND deleted_at IS NULL)
                 OR EXISTS (SELECT 1 FROM facts WHERE memory_id = $1 AND deleted_at IS NULL)
                 OR EXISTS (SELECT 1 FROM notes WHERE memory_id = $1 AND deleted_at IS NULL) AS used`, [memoryId]);
          if (used.used) throw new ConflictException({ code: 'memory_not_empty' });
          await tx.query(`UPDATE memories SET mode = $1 WHERE person_id = $2`, [body.mode, memoryId]);
        }
      }
      if (body.gender) await tx.query(`UPDATE memories SET gender = $1 WHERE person_id = $2`, [body.gender, memoryId]);
      if (body.displayName) await tx.query(`UPDATE persons SET display_name = $1 WHERE id = $2`, [body.displayName, memoryId]);
    });
  }

  /**
   * D51: a one-time code (`RCD-XXXX-XXXX`, ten minutes) the holder sends from a channel to link that channel identity
   * to themselves — a claim they then confirm. Personal memories only (409 `memory_not_personal`).
   */
  @Post('link-codes')
  @RequireScopes('ingest')
  @Returns(linkCodeResponse)
  async linkCode(@CurrentPrincipal() principal: Principal, @Headers(USER_HEADER) user?: string) {
    const memoryId = await this.own(principal, user);
    return createLinkCode(this.db, memoryId, new Date());
  }

  /** The identities that speak as the memory's "I" and the claims waiting for confirmation (D51). */
  @Get('identities')
  @RequireScopes('read')
  @Returns(holderIdentitiesResponse)
  async identities(@CurrentPrincipal() principal: Principal, @Headers(USER_HEADER) user?: string) {
    return holderIdentities(this.db, await this.memories.resolve(principal, user), new Date());
  }

  /** Confirms a claim: that channel identity is the holder from now on (earlier messages keep their attribution). */
  @Post('identities/pending/:id/confirm')
  @HttpCode(204)
  @RequireScopes('ingest')
  async confirm(@CurrentPrincipal() principal: Principal, @Param('id', ParseUUIDPipe) id: string, @Headers(USER_HEADER) user?: string): Promise<void> {
    const memoryId = await this.own(principal, user);
    await this.db.transaction((tx) => confirmClaim(tx, memoryId, id, new Date()));
  }

  /** Rejects a claim (not the holder). */
  @Delete('identities/pending/:id')
  @HttpCode(204)
  @RequireScopes('ingest')
  async reject(@CurrentPrincipal() principal: Principal, @Param('id', ParseUUIDPipe) id: string, @Headers(USER_HEADER) user?: string): Promise<void> {
    await rejectClaim(this.db, await this.own(principal, user), id);
  }

  /** Unlinks one of the holder's identities. */
  @Delete('identities/:id')
  @HttpCode(204)
  @RequireScopes('ingest')
  async unlink(@CurrentPrincipal() principal: Principal, @Param('id', ParseUUIDPipe) id: string, @Headers(USER_HEADER) user?: string): Promise<void> {
    await unlinkHolderIdentity(this.db, await this.own(principal, user), id);
  }

  /** The caller's own memory for a write: a personal token, or a client key acting for one of its users. */
  private own(principal: Principal, user: string | undefined): Promise<string> {
    if (principal.kind === 'admin' || (principal.kind === 'client' && !user)) throw new ForbiddenException();
    return this.memories.resolve(principal, user);
  }
}
