// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { AccessToken, ApiKey, Client, ExternalIdentity, Owner, Person } from '../identity/identity.entities';
import { generateCredential, hashCredential } from '../auth/credentials';
import { AuthService } from '../auth/auth.service';
import { type CreateClient, type CreateIdentity, type CreateKey, type CreateOwner, type CreateToken, type UpdateOwner } from './admin.schemas';

/** Installation management for the v1 home / research profile (owners created by the admin, D33). */
@Injectable()
export class AdminService {
  constructor(private readonly db: DataSource, private readonly auth: AuthService) {}

  createClient(input: CreateClient): Promise<Client> {
    return this.db.getRepository(Client).save(input);
  }

  async createKey(clientId: string, input: CreateKey): Promise<{ id: string; key: string; prefix: string }> {
    await this.db.getRepository(Client).findOneByOrFail({ id: clientId }).catch(() => { throw new NotFoundException(); });
    const cred = generateCredential('rk');
    const row = await this.db.getRepository(ApiKey).save({ clientId, prefix: cred.prefix, hash: await hashCredential(cred.raw), scopes: input.scopes });
    return { id: row.id, key: cred.raw, prefix: cred.prefix };
  }

  async revokeKey(id: string): Promise<void> {
    await this.db.getRepository(ApiKey).update(id, { revokedAt: new Date() });
    this.auth.forget();
  }

  createOwner(input: CreateOwner): Promise<Owner> {
    return this.db.transaction(async (tx) => {
      const person = await tx.getRepository(Person).save({ displayName: input.displayName, kind: input.kind, ownerScope: null });
      return tx.getRepository(Owner).save({
        personId: person.id, locale: input.locale, timezone: input.timezone, episodicEnabled: input.episodicEnabled, qualityProfile: input.qualityProfile,
        episodicEnabledAt: input.episodicEnabled ? new Date() : null, episodicEnabledBy: input.episodicEnabled ? 'admin' : null,
      });
    });
  }

  async updateOwner(personId: string, input: UpdateOwner): Promise<Owner> {
    const repo = this.db.getRepository(Owner);
    const owner = await repo.findOneBy({ personId });
    if (!owner) throw new NotFoundException();
    if (input.episodicEnabled !== undefined && input.episodicEnabled !== owner.episodicEnabled) {
      owner.episodicEnabled = input.episodicEnabled;
      owner.episodicEnabledAt = new Date();
      owner.episodicEnabledBy = 'admin';
    }
    if (input.displayName || input.kind) {
      await this.db.getRepository(Person).update(personId, {
        ...(input.displayName ? { displayName: input.displayName } : {}), ...(input.kind ? { kind: input.kind } : {}) });
    }
    if (input.locale) owner.locale = input.locale;
    if (input.timezone) owner.timezone = input.timezone;
    if (input.qualityProfile !== undefined) owner.qualityProfile = input.qualityProfile;
    return repo.save(owner);
  }

  async createIdentity(input: CreateIdentity): Promise<ExternalIdentity> {
    try {
      return await this.db.getRepository(ExternalIdentity).save(input.kind === 'client_user'
        ? { personId: input.personId, kind: 'client_user', clientId: input.clientId, externalId: input.externalId, verifiedAt: new Date() }
        : { personId: input.personId, kind: 'channel', ownerScope: input.ownerScope, channel: input.channel, externalId: input.externalId,
            verifiedAt: input.verified ? new Date() : null });
    } catch (err) {
      // Already bound (possibly to another owner): generic answer, no hint that the id exists.
      if (err instanceof QueryFailedError) throw new BadRequestException({ code: 'cannot_link' });
      throw err;
    }
  }

  async createToken(ownerId: string, input: CreateToken): Promise<{ id: string; token: string; prefix: string }> {
    const owner = await this.db.getRepository(Owner).findOneBy({ personId: ownerId });
    const client = await this.db.getRepository(Client).findOneBy({ id: input.clientId });
    if (!owner || !client) throw new NotFoundException();
    const cred = generateCredential('rp');
    const row = await this.db.getRepository(AccessToken).save({
      ownerId, clientId: input.clientId, prefix: cred.prefix, hash: await hashCredential(cred.raw), scopes: input.scopes,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    });
    return { id: row.id, token: cred.raw, prefix: cred.prefix };
  }

  async revokeToken(id: string): Promise<void> {
    await this.db.getRepository(AccessToken).update(id, { revokedAt: new Date() });
    this.auth.forget();
  }
}
