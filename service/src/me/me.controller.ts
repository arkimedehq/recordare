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

const settingsSchema = z.object({
  displayName: z.string().trim().min(1).max(100).optional(),
  /** D48: `entity` = a memory shared by everyone using the account. Chosen by the person on their platform. */
  kind: z.enum(['human', 'entity']).optional(),
}).refine((b) => b.displayName !== undefined || b.kind !== undefined, { message: 'nothing to change' });

/** Who am I acting as: lets a client verify its credential and owner mapping. */
@Controller('api/v1/me')
export class MeController {
  constructor(private readonly owners: OwnerResolver, private readonly db: DataSource, private readonly config: ConfigService<Env, true>) {}

  @Get()
  @RequireScopes('read')
  async me(@CurrentPrincipal() principal: Principal, @Headers(USER_HEADER) user?: string) {
    const ownerId = await this.owners.resolve(principal, user);
    const [person] = await this.db.query(
      `SELECT p.display_name, p.kind, o.episodic_enabled FROM persons p JOIN owners o ON o.person_id = p.id WHERE p.id = $1`, [ownerId]);
    // episodicEnabled: whether the owner's consent is given (a client shows "waiting for activation" until then).
    // kind `entity`: a memory shared by everyone using the account (D48) — a client tells its users so.
    // atlasUrl: the live view, when installed — a client links it for its admins (it shows every person's activity).
    const atlasUrl = this.config.get('ATLAS_URL', { infer: true });
    return { ownerId, displayName: person?.display_name ?? null, kind: person?.kind ?? 'human', episodicEnabled: person?.episodic_enabled ?? false,
      ...(atlasUrl ? { atlasUrl } : {}), via: principal.kind, scopes: principal.kind === 'admin' ? ['admin'] : principal.scopes };
  }

  /**
   * Settings the person makes on their platform. The name follows the client's user and stays in sync when they rename
   * their profile (auto-provisioning first names them after the client's user id). The kind of memory (person or
   * entity, D48) changes only while the memory is empty: memories written as one person's would otherwise mix with
   * shared ones (409 `memory_not_empty`; the admin can still change it). Consent stays with the admin.
   */
  @Patch()
  @HttpCode(204)
  @RequireScopes('ingest')
  async settings(@CurrentPrincipal() principal: Principal, @Headers(USER_HEADER) user: string | undefined,
    @Body(new ZodBody(settingsSchema)) body: z.infer<typeof settingsSchema>): Promise<void> {
    if (principal.kind !== 'client' || !user) throw new ForbiddenException();
    const ownerId = await this.owners.resolve(principal, user);
    await this.db.transaction(async (tx) => {
      if (body.kind) {
        const [cur] = await tx.query(`SELECT kind FROM persons WHERE id = $1 FOR UPDATE`, [ownerId]);
        if (cur?.kind !== body.kind) {
          const [used] = await tx.query(
            `SELECT EXISTS (SELECT 1 FROM episodes WHERE owner_id = $1 AND deleted_at IS NULL)
                 OR EXISTS (SELECT 1 FROM facts WHERE owner_id = $1 AND deleted_at IS NULL)
                 OR EXISTS (SELECT 1 FROM notes WHERE owner_id = $1 AND deleted_at IS NULL) AS used`, [ownerId]);
          if (used.used) throw new ConflictException({ code: 'memory_not_empty' });
          await tx.query(`UPDATE persons SET kind = $1 WHERE id = $2`, [body.kind, ownerId]);
        }
      }
      if (body.displayName) await tx.query(`UPDATE persons SET display_name = $1 WHERE id = $2`, [body.displayName, ownerId]);
    });
  }
}
