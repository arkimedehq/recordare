// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type Scope } from '../identity/identity.entities';
import { AuthService } from './auth.service';
import { PUBLIC_KEY, SCOPES_KEY } from './decorators';
import { hasScope, type Principal } from './principal';

/** Global guard: bearer credential → principal; deny by default (admin-only without @RequireScopes). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly auth: AuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, targets)) return true;

    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; principal?: Principal }>();
    const header = req.headers['authorization'] ?? '';
    const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const principal = bearer ? await this.auth.authenticate(bearer) : null;
    if (!principal) throw new UnauthorizedException();
    req.principal = principal;

    const required = this.reflector.getAllAndOverride<Scope[] | undefined>(SCOPES_KEY, targets);
    if (!required) {
      if (principal.kind !== 'admin') throw new ForbiddenException();
      return true;
    }
    if (!required.every((s) => hasScope(principal, s))) throw new ForbiddenException();
    return true;
  }
}
