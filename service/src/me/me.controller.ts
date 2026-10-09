// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { Body, ConflictException, Controller, ForbiddenException, Get, Headers, HttpCode, Patch } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { z } from 'zod';
import { CurrentPrincipal, RequireScopes } from '../auth/decorators';
import { OwnerResolver, USER_HEADER } from '../auth/owner-resolver.service';
import { type Principal } from '../auth/principal';
import { ZodBody } from '../common/zod-body.pipe';
import { type Env } from '../config/env';
import { MEMORY_GENDERS, MEMORY_MODES } from '../identity/identity.entities';

const settingsSchema = z.object({
  displayName: z.string().trim().min(1).max(100).optional(),
  /** D50: `personal` (the account holder is "I") or `entity` (a shared device, robot, place). Chosen on the platform. */
  mode: z.enum(MEMORY_MODES).optional(),
  /** First person in gendered languages (D50); defaults to masculine, the client sends it from the account's profile. */
  gender: z.enum(MEMORY_GENDERS).optional(),
}).refine((b) => b.displayName !== undefined || b.mode !== undefined || b.gender !== undefined, { message: 'nothing to change' });

/** Who am I acting as: lets a client verify its credential and owner mapping. */
@Controller('api/v1/me')
export class MeController {
  constructor(private readonly owners: OwnerResolver, private readonly db: DataSource, private readonly config: ConfigService<Env, true>) {}

  @Get()
  @RequireScopes('read')
  async me(@CurrentPrincipal() principal: Principal, @Headers(USER_HEADER) user?: string) {
    const ownerId = await this.owners.resolve(principal, user);
    const [memory] = await this.db.query(
      `SELECT p.display_name, o.mode, o.gender FROM owners o JOIN persons p ON p.id = o.person_id WHERE o.person_id = $1`, [ownerId]);
    // mode `entity`: a memory shared by everyone using the account (D48, D50) — a client tells its users so.
    // atlasUrl: the live view, when installed — a client links it for its admins (it shows every person's activity).
    const atlasUrl = this.config.get('ATLAS_URL', { infer: true });
    return { ownerId, displayName: memory?.display_name ?? null, mode: memory?.mode ?? 'personal', gender: memory?.gender ?? 'masculine',
      ...(atlasUrl ? { atlasUrl } : {}), via: principal.kind, scopes: principal.kind === 'admin' ? ['admin'] : principal.scopes };
  }

  /**
   * Settings made on the platform. The name follows the client's user (the account's name: in a personal memory the
   * name of "I") and stays in sync when they rename their profile (auto-provisioning first names it after the client's
   * user id). The mode (personal or entity, D50) changes only while the memory is empty: first-person memories would
   * otherwise mix with "someone"'s (409 `memory_not_empty`; the admin can still change it). The gender changes any time.
   */
  @Patch()
  @HttpCode(204)
  @RequireScopes('ingest')
  async settings(@CurrentPrincipal() principal: Principal, @Headers(USER_HEADER) user: string | undefined,
    @Body(new ZodBody(settingsSchema)) body: z.infer<typeof settingsSchema>): Promise<void> {
    if (principal.kind !== 'client' || !user) throw new ForbiddenException();
    const ownerId = await this.owners.resolve(principal, user);
    await this.db.transaction(async (tx) => {
      if (body.mode) {
        const [cur] = await tx.query(`SELECT mode FROM owners WHERE person_id = $1 FOR UPDATE`, [ownerId]);
        if (cur?.mode !== body.mode) {
          const [used] = await tx.query(
            `SELECT EXISTS (SELECT 1 FROM episodes WHERE owner_id = $1 AND deleted_at IS NULL)
                 OR EXISTS (SELECT 1 FROM facts WHERE owner_id = $1 AND deleted_at IS NULL)
                 OR EXISTS (SELECT 1 FROM notes WHERE owner_id = $1 AND deleted_at IS NULL) AS used`, [ownerId]);
          if (used.used) throw new ConflictException({ code: 'memory_not_empty' });
          await tx.query(`UPDATE owners SET mode = $1 WHERE person_id = $2`, [body.mode, ownerId]);
        }
      }
      if (body.gender) await tx.query(`UPDATE owners SET gender = $1 WHERE person_id = $2`, [body.gender, ownerId]);
      if (body.displayName) await tx.query(`UPDATE persons SET display_name = $1 WHERE id = $2`, [body.displayName, ownerId]);
    });
  }
}
