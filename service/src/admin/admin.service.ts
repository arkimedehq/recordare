// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { AccessToken, ApiKey, Client, ExternalIdentity, Owner, Person } from '../identity/identity.entities';
import { generateCredential, hashCredential } from '../auth/credentials';
import { AuthService } from '../auth/auth.service';
import { type CreateClient, type CreateIdentity, type CreateKey, type CreateOwner, type CreateToken, type UpdateClient, type UpdateOwner } from './admin.schemas';

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

  // ── Reads for the admin console (metadata only: names, settings, counts — never memory content) ──────────────────

  /** Recent extraction runs of a person, newest first (metadata and counts only). */
  async listRuns(ownerId: string, conversationId: string | undefined, limit: number): Promise<unknown[]> {
    return this.db.query(
      `SELECT r.id, r.kind, r.status, r.model, r.prompt_version AS "promptVersion", r.error, r.started_at AS "startedAt",
              r.finished_at AS "finishedAt", r.conversation_id AS "conversationId", c.external_id AS "conversation", r.summary
       FROM extraction_runs r LEFT JOIN conversations c ON c.id = r.conversation_id
       WHERE r.owner_id = $1 AND ($2::uuid IS NULL OR r.conversation_id = $2)
       ORDER BY r.started_at DESC LIMIT $3`, [ownerId, conversationId ?? null, limit]);
  }

  /** Owners with their settings, memory size, linked identities and personal tokens. */
  async listPersons(): Promise<unknown[]> {
    const owners: Array<Record<string, unknown> & { id: string }> = await this.db.query(
      `SELECT p.id, p.display_name AS name, p.kind, o.episodic_enabled AS "episodicEnabled", o.episodic_enabled_at AS "episodicEnabledAt",
              CASE WHEN o.episodic_enabled THEN NULL ELSE o.ingest_refused_at END AS "waitingForConsentSince",
              o.quality_profile AS "qualityProfile", o.locale, o.timezone, o.created_at AS "createdAt",
              (SELECT count(*)::int FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.owner_id = p.id) AS messages,
              (SELECT count(*)::int FROM messages m JOIN conversations c ON c.id = m.conversation_id
                WHERE c.owner_id = p.id AND m.extracted_run_id IS NULL) AS pending,
              (SELECT count(*)::int FROM episodes e WHERE e.owner_id = p.id AND e.deleted_at IS NULL) AS episodes,
              (SELECT count(*)::int FROM facts f WHERE f.owner_id = p.id AND f.deleted_at IS NULL AND f.status = 'current') AS facts,
              (SELECT count(*)::int FROM notes n WHERE n.owner_id = p.id AND n.deleted_at IS NULL AND n.status = 'current') AS notes,
              (SELECT max(m.sent_at) FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.owner_id = p.id) AS "lastMessage"
       FROM owners o JOIN persons p ON p.id = o.person_id ORDER BY p.display_name`);
    const identities: Array<{ personId: string }> = await this.db.query(
      `SELECT i.id, i.person_id AS "personId", i.kind, i.external_id AS "externalId", i.channel, c.name AS client
       FROM external_identities i LEFT JOIN clients c ON c.id = i.client_id ORDER BY i.created_at`);
    const tokens: Array<{ ownerId: string }> = await this.db.query(
      `SELECT t.id, t.owner_id AS "ownerId", t.prefix, t.scopes, c.name AS client, t.created_at AS "createdAt",
              t.expires_at AS "expiresAt", t.last_used_at AS "lastUsedAt"
       FROM access_tokens t JOIN clients c ON c.id = t.client_id WHERE t.revoked_at IS NULL ORDER BY t.created_at`);
    return owners.map((o) => ({
      ...o,
      identities: identities.filter((i) => i.personId === o.id),
      tokens: tokens.filter((t) => t.ownerId === o.id),
    }));
  }

  /** Clients with their active keys (prefixes only). */
  async listClients(): Promise<unknown[]> {
    const clients: Array<Record<string, unknown> & { id: string }> = await this.db.query(
      `SELECT id, name, kind, auto_provision AS "autoProvision", raw_log_scope AS "rawLogScope", created_at AS "createdAt",
              disabled_at AS "disabledAt"
       FROM clients ORDER BY created_at`);
    const keys: Array<{ clientId: string }> = await this.db.query(
      `SELECT id, client_id AS "clientId", prefix, scopes, created_at AS "createdAt", last_used_at AS "lastUsedAt"
       FROM api_keys WHERE revoked_at IS NULL AND client_id IS NOT NULL ORDER BY created_at`);
    return clients.map((c) => ({ ...c, keys: keys.filter((k) => k.clientId === c.id) }));
  }

  async updateClient(id: string, input: UpdateClient): Promise<void> {
    const repo = this.db.getRepository(Client);
    const client = await repo.findOneBy({ id });
    if (!client) throw new NotFoundException();
    if (input.autoProvision !== undefined) client.autoProvision = input.autoProvision;
    if (input.disabled !== undefined) client.disabledAt = input.disabled ? (client.disabledAt ?? new Date()) : null;
    await repo.save(client);
    this.auth.forget();
  }

  /** Unlinks an identity: the client's user no longer reaches this person (memories stay). */
  async deleteIdentity(id: string): Promise<void> {
    const res = await this.db.getRepository(ExternalIdentity).delete(id);
    if (!res.affected) throw new NotFoundException();
    this.auth.forget();
  }
}
