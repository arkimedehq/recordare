// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import { type Scope } from '../identity/identity.entities';
import { type Principal } from './principal';

export const PUBLIC_KEY = 'recordare:public';
export const SCOPES_KEY = 'recordare:scopes';

/** No authentication (health only). */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

/** Every listed scope is required. Routes without this decorator require admin. */
export const RequireScopes = (...scopes: Scope[]) => SetMetadata(SCOPES_KEY, scopes);

export const CurrentPrincipal = createParamDecorator((_: unknown, ctx: ExecutionContext): Principal => {
  return ctx.switchToHttp().getRequest<{ principal: Principal }>().principal;
});
