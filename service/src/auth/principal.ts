// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { type Scope } from '../identity/identity.entities';

/** Who is calling (v1 home / research profile, D33). */
export type Principal =
  | { kind: 'admin' }
  | { kind: 'client'; clientId: string; keyId: string; scopes: Scope[] }
  | { kind: 'owner_token'; ownerId: string; clientId: string; tokenId: string; scopes: Scope[] };

export function hasScope(p: Principal, scope: Scope): boolean {
  return p.kind === 'admin' || p.scopes.includes(scope);
}
