// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { Controller, Get, Headers } from '@nestjs/common';
import { CurrentPrincipal, RequireScopes } from '../auth/decorators';
import { OwnerResolver, USER_HEADER } from '../auth/owner-resolver.service';
import { type Principal } from '../auth/principal';

/** Who am I acting as: lets a client verify its credential and owner mapping. */
@Controller('api/v1/me')
export class MeController {
  constructor(private readonly owners: OwnerResolver) {}

  @Get()
  @RequireScopes('read')
  async me(@CurrentPrincipal() principal: Principal, @Headers(USER_HEADER) user?: string) {
    const ownerId = await this.owners.resolve(principal, user);
    return { ownerId, via: principal.kind, scopes: principal.kind === 'admin' ? ['admin'] : principal.scopes };
  }
}
