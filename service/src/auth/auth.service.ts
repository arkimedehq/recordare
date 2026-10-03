// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { Injectable, Logger } from '@nestjs/common';
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
  private readonly log = new Logger(AuthService.name);
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
    const found = cred.kind === 'rk' ? await this.clientKey(cred.prefix, bearer) : await this.personalToken(cred.prefix, bearer);
    if (!found) return null;
    // Never cache a token past its expiry.
    const until = Math.min(Date.now() + CACHE_TTL_MS, found.expiresAt?.getTime() ?? Infinity);
    this.cache.set(cacheKey, { principal: found.principal, until });
    return found.principal;
  }

  /** Drop cached principals (after a revocation). */
  forget(): void {
    this.cache.clear();
  }

  private async clientKey(prefix: string, raw: string): Promise<Found | null> {
    const key = await this.keys.findOne({ where: { prefix, revokedAt: IsNull() } });
    if (!key?.clientId || !(await verifyCredential(key.hash, raw))) return null;
    if (!(await this.clientActive(key.clientId))) return null;
    this.touch(this.keys.update(key.id, { lastUsedAt: new Date() }));
    return { principal: { kind: 'client', clientId: key.clientId, keyId: key.id, scopes: key.scopes } };
  }

  private async personalToken(prefix: string, raw: string): Promise<Found | null> {
    const t = await this.tokens.findOne({ where: { prefix, revokedAt: IsNull() } });
    if (!t || (t.expiresAt && t.expiresAt < new Date()) || !(await verifyCredential(t.hash, raw))) return null;
    // Disabling a client cuts off its personal tokens too.
    if (!(await this.clientActive(t.clientId))) return null;
    this.touch(this.tokens.update(t.id, { lastUsedAt: new Date() }));
    return {
      principal: { kind: 'owner_token', ownerId: t.ownerId, clientId: t.clientId, tokenId: t.id, scopes: t.scopes },
      expiresAt: t.expiresAt ?? undefined,
    };
  }

  private async clientActive(clientId: string): Promise<boolean> {
    const client = await this.clients.findOne({ where: { id: clientId } });
    return !!client && !client.disabledAt;
  }

  /** Bookkeeping write: a failure is logged, never an unhandled rejection. */
  private touch(p: Promise<unknown>): void {
    p.catch((err: unknown) => this.log.warn(`last_used_at update failed: ${(err as Error).message}`));
  }
}

interface Found {
  principal: Principal;
  expiresAt?: Date;
}

function digest(s: string): Buffer {
  return createHash('sha256').update(s).digest();
}
