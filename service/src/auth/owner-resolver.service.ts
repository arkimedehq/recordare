// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { Client, ExternalIdentity, Owner, Person } from '../identity/identity.entities';
import { type Principal } from './principal';

export const USER_HEADER = 'x-recordare-user';

/**
 * Which owner a request acts for. Personal tokens are bound to one owner; client keys name the
 * owner with `X-Recordare-User` (the client's own user id), auto-provisioned if the client allows it.
 */
@Injectable()
export class OwnerResolver {
  constructor(private readonly db: DataSource) {}

  async resolve(principal: Principal, externalUserId: string | undefined): Promise<string> {
    if (principal.kind === 'owner_token') return principal.ownerId;
    if (principal.kind !== 'client' || !externalUserId) throw new NotFoundException();

    const known = await this.lookup(principal.clientId, externalUserId);
    if (known !== undefined) return known;
    const client = await this.db.getRepository(Client).findOneByOrFail({ id: principal.clientId });
    if (!client.autoProvision) throw new NotFoundException();
    try {
      return await this.provision(principal.clientId, externalUserId);
    } catch (err) {
      // Concurrent first contact (e.g. ingest + MCP at once): the other request created it.
      if (err instanceof QueryFailedError && (err.driverError as { code?: string }).code === '23505') {
        const winner = await this.lookup(principal.clientId, externalUserId);
        if (winner !== undefined) return winner;
      }
      throw err;
    }
  }

  /** Owner id for a client user id; undefined when unknown; 404 when bound to a non-owner. */
  private async lookup(clientId: string, externalUserId: string): Promise<string | undefined> {
    const identity = await this.db.getRepository(ExternalIdentity).findOne({
      where: { kind: 'client_user', clientId, externalId: externalUserId },
    });
    if (!identity) return undefined;
    const owner = await this.db.getRepository(Owner).findOne({ where: { personId: identity.personId } });
    if (!owner) throw new NotFoundException();
    return owner.personId;
  }

  private provision(clientId: string, externalUserId: string): Promise<string> {
    return this.db.transaction(async (tx) => {
      const person = await tx.getRepository(Person).save({ displayName: externalUserId, ownerScope: null });
      await tx.getRepository(Owner).save({ personId: person.id });
      await tx.getRepository(ExternalIdentity).save({
        personId: person.id, kind: 'client_user', clientId, externalId: externalUserId, verifiedAt: new Date(),
      });
      return person.id;
    });
  }
}
