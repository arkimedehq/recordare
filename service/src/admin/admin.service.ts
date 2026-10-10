// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { AccessToken, ApiKey, Client, ExternalIdentity, Memory, Person } from '../identity/identity.entities';
import { generateCredential, hashCredential } from '../auth/credentials';
import { AuthService } from '../auth/auth.service';
import { type CreateClient, type CreateIdentity, type CreateKey, type CreateMemory, type CreateToken, type UpdateClient, type UpdateMemory } from './admin.schemas';

/** Installation management for the v1 home / research profile (memories created by the admin, D33). */
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

  createMemory(input: CreateMemory): Promise<Memory> {
    return this.db.transaction(async (tx) => {
      const person = await tx.getRepository(Person).save({ displayName: input.displayName, memoryId: null });
      return tx.getRepository(Memory).save({
        personId: person.id, locale: input.locale, timezone: input.timezone, qualityProfile: input.qualityProfile, mode: input.mode, gender: input.gender,
      });
    });
  }

  async updateMemory(personId: string, input: UpdateMemory): Promise<Memory> {
    const repo = this.db.getRepository(Memory);
    const memory = await repo.findOneBy({ personId });
    if (!memory) throw new NotFoundException();
    if (input.displayName) await this.db.getRepository(Person).update(personId, { displayName: input.displayName });
    // The admin may change the mode of a memory that already holds memories (the console asks first).
    if (input.mode) memory.mode = input.mode;
    if (input.gender) memory.gender = input.gender;
    if (input.locale) memory.locale = input.locale;
    if (input.timezone) memory.timezone = input.timezone;
    if (input.qualityProfile !== undefined) memory.qualityProfile = input.qualityProfile;
    return repo.save(memory);
  }

  /**
   * An account identity opens a memory (the person must be a memory); a participant identity names the memory's self or
   * one of its contacts inside that memory only.
   */
  async createIdentity(input: CreateIdentity): Promise<ExternalIdentity> {
    const [person]: Array<{ memory_id: string | null; memory: boolean }> = await this.db.query(
      `SELECT p.memory_id, EXISTS (SELECT 1 FROM memories o WHERE o.person_id = p.id) AS memory FROM persons p WHERE p.id = $1`, [input.personId]);
    const fits = input.kind === 'account'
      ? person?.memory
      : person && (person.memory_id === input.memoryId || (person.memory && input.personId === input.memoryId));
    if (!fits) throw new BadRequestException({ code: 'cannot_link' });
    try {
      return await this.db.getRepository(ExternalIdentity).save(input.kind === 'account'
        ? { personId: input.personId, kind: 'account', clientId: input.clientId, externalId: input.externalId, verifiedAt: new Date() }
        : { personId: input.personId, kind: 'participant', memoryId: input.memoryId, clientId: input.clientId ?? null, channel: input.channel ?? null,
            externalId: input.externalId, verifiedAt: input.verified ? new Date() : null });
    } catch (err) {
      // Already bound (possibly to another memory): generic answer, no hint that the id exists.
      if (err instanceof QueryFailedError) throw new BadRequestException({ code: 'cannot_link' });
      throw err;
    }
  }

  async createToken(memoryId: string, input: CreateToken): Promise<{ id: string; token: string; prefix: string }> {
    const memory = await this.db.getRepository(Memory).findOneBy({ personId: memoryId });
    const client = await this.db.getRepository(Client).findOneBy({ id: input.clientId });
    if (!memory || !client) throw new NotFoundException();
    const cred = generateCredential('rp');
    const row = await this.db.getRepository(AccessToken).save({
      memoryId, clientId: input.clientId, prefix: cred.prefix, hash: await hashCredential(cred.raw), scopes: input.scopes,
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
  async listRuns(memoryId: string, conversationId: string | undefined, limit: number): Promise<unknown[]> {
    return this.db.query(
      `SELECT r.id, r.kind, r.status, r.model, r.prompt_version AS "promptVersion", r.error, r.started_at AS "startedAt",
              r.finished_at AS "finishedAt", r.conversation_id AS "conversationId", c.external_id AS "conversation", r.summary
       FROM extraction_runs r LEFT JOIN conversations c ON c.id = r.conversation_id
       WHERE r.memory_id = $1 AND ($2::uuid IS NULL OR r.conversation_id = $2)
       ORDER BY r.started_at DESC LIMIT $3`, [memoryId, conversationId ?? null, limit]);
  }

  /**
   * Memories with their settings, size, contacts count, identities (the accounts that open it and the participant ids
   * that name its self or contacts) and personal tokens.
   */
  async listPersons(): Promise<unknown[]> {
    const memories: Array<Record<string, unknown> & { id: string }> = await this.db.query(
      `SELECT p.id, p.display_name AS name, o.mode, o.gender,
              o.quality_profile AS "qualityProfile", o.locale, o.timezone, o.created_at AS "createdAt",
              (SELECT count(*)::int FROM persons c WHERE c.memory_id = p.id) AS contacts,
              (SELECT count(*)::int FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.memory_id = p.id) AS messages,
              (SELECT count(*)::int FROM messages m JOIN conversations c ON c.id = m.conversation_id
                WHERE c.memory_id = p.id AND m.extracted_run_id IS NULL) AS pending,
              (SELECT count(*)::int FROM episodes e WHERE e.memory_id = p.id AND e.deleted_at IS NULL) AS episodes,
              (SELECT count(*)::int FROM facts f WHERE f.memory_id = p.id AND f.deleted_at IS NULL AND f.status = 'current') AS facts,
              (SELECT count(*)::int FROM notes n WHERE n.memory_id = p.id AND n.deleted_at IS NULL AND n.status = 'current') AS notes,
              (SELECT max(m.sent_at) FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.memory_id = p.id) AS "lastMessage"
       FROM memories o JOIN persons p ON p.id = o.person_id ORDER BY p.display_name`);
    const identities: Array<{ personId: string; memoryId: string | null }> = await this.db.query(
      `SELECT i.id, i.person_id AS "personId", i.memory_id AS "memoryId", i.kind, i.external_id AS "externalId", i.channel,
              c.name AS client, p.display_name AS person, i.verified_at IS NOT NULL AS verified
       FROM external_identities i LEFT JOIN clients c ON c.id = i.client_id JOIN persons p ON p.id = i.person_id ORDER BY i.created_at`);
    const tokens: Array<{ memoryId: string }> = await this.db.query(
      `SELECT t.id, t.memory_id AS "memoryId", t.prefix, t.scopes, c.name AS client, t.created_at AS "createdAt",
              t.expires_at AS "expiresAt", t.last_used_at AS "lastUsedAt"
       FROM access_tokens t JOIN clients c ON c.id = t.client_id WHERE t.revoked_at IS NULL ORDER BY t.created_at`);
    return memories.map((o) => ({
      ...o,
      identities: identities.filter((i) => (i.memoryId ?? i.personId) === o.id),
      tokens: tokens.filter((t) => t.memoryId === o.id),
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
