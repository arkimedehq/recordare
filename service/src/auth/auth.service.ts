// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, timingSafeEqual } from 'node:crypto';
import { IsNull, type Repository } from 'typeorm';
import { type Env } from '../config/env';
import { AccessToken, ApiKey, Client } from '../identity/identity.entities';
import { parseCredential, verifyCredential } from './credentials';
import { type Principal } from './principal';

/** Verified credentials are cached briefly so argon2 does not run on every request. */
const CACHE_TTL_MS = 60_000;

@Injectable()
export class AuthService {
  private readonly cache = new Map<string, { principal: Principal; until: number }>();
  private readonly adminDigest: Buffer;

  constructor(
    config: ConfigService<Env, true>,
    @InjectRepository(ApiKey) private readonly keys: Repository<ApiKey>,
    @InjectRepository(AccessToken) private readonly tokens: Repository<AccessToken>,
    @InjectRepository(Client) private readonly clients: Repository<Client>,
  ) {
    this.adminDigest = digest(config.get('ADMIN_API_KEY', { infer: true }));
  }

  /** Resolve a bearer credential to a principal, or null (same answer for unknown and revoked). */
  async authenticate(bearer: string): Promise<Principal | null> {
    if (timingSafeEqual(digest(bearer), this.adminDigest)) return { kind: 'admin' };
    const cacheKey = digest(bearer).toString('hex');
    const hit = this.cache.get(cacheKey);
    if (hit && hit.until > Date.now()) return hit.principal;

    const cred = parseCredential(bearer);
    if (!cred) return null;
    const principal = cred.kind === 'rk' ? await this.clientKey(cred.prefix, bearer) : await this.personalToken(cred.prefix, bearer);
    if (principal) this.cache.set(cacheKey, { principal, until: Date.now() + CACHE_TTL_MS });
    return principal;
  }

  /** Drop cached principals (after a revocation). */
  forget(): void {
    this.cache.clear();
  }

  private async clientKey(prefix: string, raw: string): Promise<Principal | null> {
    const key = await this.keys.findOne({ where: { prefix, revokedAt: IsNull() } });
    if (!key?.clientId || !(await verifyCredential(key.hash, raw))) return null;
    const client = await this.clients.findOne({ where: { id: key.clientId } });
    if (!client || client.disabledAt) return null;
    void this.keys.update(key.id, { lastUsedAt: new Date() });
    return { kind: 'client', clientId: key.clientId, keyId: key.id, scopes: key.scopes };
  }

  private async personalToken(prefix: string, raw: string): Promise<Principal | null> {
    const t = await this.tokens.findOne({ where: { prefix, revokedAt: IsNull() } });
    if (!t || (t.expiresAt && t.expiresAt < new Date()) || !(await verifyCredential(t.hash, raw))) return null;
    void this.tokens.update(t.id, { lastUsedAt: new Date() });
    return { kind: 'owner_token', ownerId: t.ownerId, clientId: t.clientId, tokenId: t.id, scopes: t.scopes };
  }
}

function digest(s: string): Buffer {
  return createHash('sha256').update(s).digest();
}
