// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { Body, Controller, ForbiddenException, Get, Headers, HttpCode, Patch } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { z } from 'zod';
import { CurrentPrincipal, RequireScopes } from '../auth/decorators';
import { OwnerResolver, USER_HEADER } from '../auth/owner-resolver.service';
import { type Principal } from '../auth/principal';
import { ZodBody } from '../common/zod-body.pipe';

const nameSchema = z.object({ displayName: z.string().trim().min(1).max(100) });

/** Who am I acting as: lets a client verify its credential and owner mapping. */
@Controller('api/v1/me')
export class MeController {
  constructor(private readonly owners: OwnerResolver, private readonly db: DataSource) {}

  @Get()
  @RequireScopes('read')
  async me(@CurrentPrincipal() principal: Principal, @Headers(USER_HEADER) user?: string) {
    const ownerId = await this.owners.resolve(principal, user);
    const [person] = await this.db.query(`SELECT display_name FROM persons WHERE id = $1`, [ownerId]);
    return { ownerId, displayName: person?.display_name ?? null, via: principal.kind, scopes: principal.kind === 'admin' ? ['admin'] : principal.scopes };
  }

  /**
   * Names a person a client created (auto-provisioning names them after the client's user id). Only while the name is
   * still that id: once the admin or the owner renamed the person, a client can no longer change it.
   */
  @Patch()
  @HttpCode(204)
  @RequireScopes('ingest')
  async name(@CurrentPrincipal() principal: Principal, @Headers(USER_HEADER) user: string | undefined,
    @Body(new ZodBody(nameSchema)) body: z.infer<typeof nameSchema>): Promise<void> {
    if (principal.kind !== 'client' || !user) throw new ForbiddenException();
    const ownerId = await this.owners.resolve(principal, user);
    // TypeORM returns [rows, affected] for an UPDATE on Postgres.
    const [, affected]: [unknown[], number] = await this.db.query(
      `UPDATE persons SET display_name = $1 WHERE id = $2 AND display_name = $3`, [body.displayName, ownerId, user]);
    if (!affected) throw new ForbiddenException();
  }
}
