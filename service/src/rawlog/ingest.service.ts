// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * REST ingest into Layer 0 (docs/API.md §2): idempotent on (client, owner, conversation, message),
 * always stored (no consent flag, D50: the on/off switch belongs to the client), participants resolved
 * to the memory's self or its contacts through identities (participant identities scoped to the memory, D50), every
 * message attributed (author kind, method, confidence), idle extraction (re)scheduled after commit (D1, D5).
 */
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { DataSource, type EntityManager } from 'typeorm';
import { type Env } from '../config/env';
import { QUEUE_PORT, type QueuePort } from '../queue/queue.port';
import { type IngestRequest, type IngestResult } from './ingest.schemas';
import { TelemetryService } from '../telemetry/telemetry.service';
import { type MemoryMode } from '../identity/identity.entities';
import { type Attribution, SOMEONE } from './attribution';

type Participant = IngestRequest['conversation']['participants'][number];
type IngestMessage = IngestRequest['messages'][number];

const self = (ownerId: string): Attribution => ({ kind: 'self', personId: ownerId, method: 'account', confidence: 1 });
const asserted = (kind: 'agent' | 'tool'): Attribution => ({ kind, personId: null, method: 'client_assertion', confidence: 1 });

/**
 * Who wrote a message (D50): the role the client gave it, the participant its `authorRef` names, and the memory's mode
 * (personal: an undeclared user turn is the self; entity: someone).
 */
export function attribute(m: IngestMessage, participants: Map<string, Attribution>, ownerId: string, mode: MemoryMode): Attribution {
  const byRef = m.authorRef !== undefined ? participants.get(m.authorRef) : undefined;
  if (m.own) return { kind: 'own', personId: byRef?.personId ?? null, method: 'client_assertion', confidence: 1 };
  if (m.role === 'tool') return asserted('tool');
  if (m.role === 'assistant') return asserted('agent');
  if (byRef) return byRef;
  return m.role === 'user' && mode === 'personal' ? self(ownerId) : SOMEONE;
}

export function contentHash(content: string): Buffer {
  return createHash('sha256').update(content).digest();
}

@Injectable()
export class IngestService {
  private readonly idleDelayMs: number;

  constructor(
    private readonly db: DataSource,
    @Inject(QUEUE_PORT) private readonly queue: QueuePort,
    config: ConfigService<Env, true>,
    private readonly telemetry: TelemetryService,
  ) {
    this.idleDelayMs = config.get('IDLE_DELAY_SECONDS', { infer: true }) * 1000;
  }

  async ingest(clientId: string, ownerId: string, req: IngestRequest): Promise<IngestResult> {
    const sentAts = req.messages.map((m) => new Date(m.sentAt).getTime());
    const first = new Date(Math.min(...sentAts));
    const last = new Date(Math.max(...sentAts));

    const outcome = await this.db.transaction(async (tx) => {
      const [conv] = await tx.query(
        `INSERT INTO conversations (owner_id, client_id, external_id, source, channel, title, started_at, last_message_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (client_id, owner_id, external_id) DO UPDATE SET
           started_at = LEAST(conversations.started_at, EXCLUDED.started_at),
           last_message_at = GREATEST(conversations.last_message_at, EXCLUDED.last_message_at),
           title = COALESCE(EXCLUDED.title, conversations.title),
           channel = COALESCE(EXCLUDED.channel, conversations.channel)
         RETURNING id, deleted_at`,
        [ownerId, clientId, req.conversation.externalId, req.conversation.source, req.conversation.channel ?? null,
          req.conversation.title ?? null, first, last],
      );
      if (conv.deleted_at) throw new NotFoundException();
      const conversationId: string = conv.id;

      const [{ mode }] = await tx.query(`SELECT mode FROM owners WHERE person_id = $1`, [ownerId]);
      const participants = await this.upsertParticipants(tx, conversationId, ownerId, mode, clientId, req.conversation.participants);
      let accepted = 0;
      let duplicates = 0;
      const conflicts: string[] = [];
      const newIds: string[] = [];

      for (const m of req.messages) {
        const hash = contentHash(m.content);
        const author = attribute(m, participants, ownerId, mode);
        const [inserted] = await tx.query(
          `INSERT INTO messages (conversation_id, owner_id, external_id, role, tool_name, author_person_id, author_ref, author_kind,
             attribution_method, attribution_confidence, content, content_hash, sent_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           ON CONFLICT (conversation_id, external_id) DO NOTHING
           RETURNING id`,
          [conversationId, ownerId, m.externalId, m.role, m.toolName ?? null, author.personId, m.authorRef ?? null, author.kind,
            author.method, author.confidence, m.content, hash, new Date(m.sentAt)],
        );
        if (inserted) {
          accepted++;
          newIds.push(inserted.id);
          continue;
        }
        const [existing] = await tx.query(
          `SELECT id, content, content_hash FROM messages WHERE conversation_id = $1 AND external_id = $2`, [conversationId, m.externalId],
        );
        if (Buffer.compare(existing.content_hash, hash) === 0) {
          duplicates++;
        } else if (m.upsert) {
          await this.applyEdit(tx, existing.id, existing.content, m.content);
          accepted++;
          newIds.push(existing.id);
        } else {
          conflicts.push(m.externalId);
        }
      }
      return { conversationId, accepted, duplicates, conflicts, newIds };
    });

    // "Conversation ended" counts even when every message was already stored (a client re-sending its last message
    // only to carry the hint, e.g. at the end of a session): extraction then runs now instead of after the idle delay.
    if (outcome.accepted > 0 || req.hints.conversationEnded) {
      const delay = req.hints.conversationEnded ? 0 : this.idleDelayMs;
      await this.db.query(`UPDATE conversations SET idle_job_at = now() + ($1 || ' milliseconds')::interval WHERE id = $2`, [String(delay), outcome.conversationId]);
      await this.queue.scheduleIdleExtraction(outcome.conversationId, delay);
    }
    if (outcome.accepted > 0) {
      await this.queue.enqueueMessageEmbeddings(outcome.newIds);
      const roles: Record<string, number> = {};
      for (const m of req.messages) roles[m.role] = (roles[m.role] ?? 0) + 1;
      this.telemetry.emit({ type: 'message.ingested', ownerId, conversationId: outcome.conversationId, messages: outcome.accepted, roles });
    }
    return { conversationId: outcome.conversationId, accepted: outcome.accepted, duplicates: outcome.duplicates, conflicts: outcome.conflicts };
  }

  async edit(clientId: string, ownerId: string, conversationExternalId: string, messageExternalId: string, content: string): Promise<void> {
    const conversationId = await this.db.transaction(async (tx) => {
      const [row] = await tx.query(
        `SELECT m.id, m.content, m.conversation_id FROM messages m JOIN conversations c ON c.id = m.conversation_id
         WHERE c.client_id = $1 AND c.owner_id = $2 AND c.external_id = $3 AND m.external_id = $4 AND c.deleted_at IS NULL`,
        [clientId, ownerId, conversationExternalId, messageExternalId],
      );
      if (!row) throw new NotFoundException();
      if (row.content !== content) await this.applyEdit(tx, row.id, row.content, content);
      return row.conversation_id as string;
    });
    await this.queue.scheduleIdleExtraction(conversationId, this.idleDelayMs);
  }

  /** Physical purge of one message (derived memories are re-evaluated by the engine, M4). */
  async deleteMessage(clientId: string, ownerId: string, conversationExternalId: string, messageExternalId: string): Promise<void> {
    // WITH … SELECT: plain rows back (a bare DELETE … RETURNING comes back as [rows, count]).
    const [row] = await this.db.query(
      `WITH d AS (
         DELETE FROM messages m USING conversations c
         WHERE c.id = m.conversation_id AND c.client_id = $1 AND c.owner_id = $2 AND c.external_id = $3 AND m.external_id = $4
         RETURNING m.id)
       SELECT id FROM d`,
      [clientId, ownerId, conversationExternalId, messageExternalId],
    );
    if (!row) throw new NotFoundException();
  }

  /** Physical purge of a conversation and its messages (cascade). */
  /** Ends a conversation without a message: schedules its extraction now (404 when unknown). */
  async end(clientId: string, ownerId: string, conversationExternalId: string): Promise<void> {
    const [conv] = await this.db.query(
      `SELECT id FROM conversations WHERE client_id = $1 AND owner_id = $2 AND external_id = $3 AND deleted_at IS NULL`,
      [clientId, ownerId, conversationExternalId],
    );
    if (!conv) throw new NotFoundException();
    await this.db.query(`UPDATE conversations SET idle_job_at = now() WHERE id = $1`, [conv.id]);
    await this.queue.scheduleIdleExtraction(conv.id, 0);
  }

  async deleteConversation(clientId: string, ownerId: string, conversationExternalId: string): Promise<void> {
    const [row] = await this.db.query(
      `WITH d AS (DELETE FROM conversations WHERE client_id = $1 AND owner_id = $2 AND external_id = $3 RETURNING id)
       SELECT id FROM d`,
      [clientId, ownerId, conversationExternalId],
    );
    if (!row) throw new NotFoundException();
  }

  private async applyEdit(tx: EntityManager, messageId: string, previous: string, content: string): Promise<void> {
    await tx.query(`INSERT INTO message_revisions (message_id, content) VALUES ($1, $2)`, [messageId, previous]);
    // Edited text is pending again: the extractor re-reads it (corrections, not rewrites, downstream).
    await tx.query(
      `UPDATE messages SET content = $1, content_hash = $2, edited_at = now(), extracted_run_id = NULL, embedding = NULL WHERE id = $3`,
      [content, contentHash(content), messageId],
    );
  }

  /**
   * Participants → the memory's self or its contacts (D50). Personal mode: the `owner` participant is the self (implied
   * when missing). A participant with an identity is resolved inside this memory only: its participant identity, or
   * the account's own user id (the self); an identity seen for the first time creates the contact (the client is
   * trusted). An unverified channel binding identifies nobody. Everyone else is kept by display name ("someone").
   * Returns ref → attribution.
   */
  private async upsertParticipants(
    tx: EntityManager, conversationId: string, ownerId: string, mode: MemoryMode, clientId: string, participants: Participant[],
  ): Promise<Map<string, Attribution>> {
    const implied = mode === 'personal' && !participants.some((p) => p.role === 'owner');
    const list: Participant[] = implied ? [{ ref: 'owner', role: 'owner' }, ...participants] : participants;
    const out = new Map<string, Attribution>();
    for (const p of list) {
      let who: Attribution = SOMEONE;
      if (p.role === 'assistant') who = { kind: 'agent', personId: null, method: 'client_assertion', confidence: 1 };
      else if (p.role === 'owner' && mode === 'personal') who = self(ownerId);
      else if (p.identity) who = await this.resolveIdentity(tx, ownerId, mode, clientId, p);
      out.set(p.ref, who);
      await tx.query(
        `INSERT INTO conversation_participants (conversation_id, ref, person_id, role, display_name)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (conversation_id, ref) DO UPDATE SET
           person_id = COALESCE(EXCLUDED.person_id, conversation_participants.person_id),
           display_name = COALESCE(EXCLUDED.display_name, conversation_participants.display_name)`,
        [conversationId, p.ref, who.personId, p.role, p.displayName ?? null],
      );
    }
    return out;
  }

  /** A participant's identity inside this memory: the self, a known contact, or a new contact. */
  private async resolveIdentity(tx: EntityManager, ownerId: string, mode: MemoryMode, clientId: string, p: Participant): Promise<Attribution> {
    const id = p.identity as NonNullable<Participant['identity']>;
    const byClient = 'externalUserId' in id;
    const method = byClient ? 'client_assertion' : 'declared';
    if (byClient && mode === 'personal') {
      // The account's own user speaking as a participant of their memory: the self.
      const [own] = await tx.query(
        `SELECT 1 FROM external_identities WHERE kind = 'account' AND client_id = $1 AND external_id = $2 AND person_id = $3`,
        [clientId, id.externalUserId, ownerId]);
      if (own) return self(ownerId);
    }
    const [hit] = byClient
      ? await tx.query(
        `SELECT person_id, verified_at FROM external_identities WHERE kind = 'participant' AND owner_scope = $1 AND client_id = $2 AND external_id = $3`,
        [ownerId, clientId, id.externalUserId])
      : await tx.query(
        `SELECT person_id, verified_at FROM external_identities WHERE kind = 'participant' AND owner_scope = $1 AND channel = $2 AND external_id = $3`,
        [ownerId, id.channel, id.externalId]);
    if (hit) {
      if (!hit.verified_at) return SOMEONE;
      return hit.person_id === ownerId ? self(ownerId) : { kind: 'contact', personId: hit.person_id, method, confidence: 1 };
    }
    const name = (p.displayName?.trim() || (byClient ? id.externalUserId : id.externalId)).slice(0, 200);
    const [contact] = await tx.query(`INSERT INTO persons (owner_scope, display_name) VALUES ($1, $2) RETURNING id`, [ownerId, name]);
    await tx.query(
      `INSERT INTO person_aliases (owner_id, person_id, alias, alias_norm, source) VALUES ($1, $2, $3, lower(unaccent(btrim($3))), 'client')
       ON CONFLICT DO NOTHING`, [ownerId, contact.id, name]);
    await tx.query(
      `INSERT INTO external_identities (owner_scope, person_id, kind, client_id, channel, external_id, verified_at)
       VALUES ($1, $2, 'participant', $3, $4, $5, now())`,
      [ownerId, contact.id, byClient ? clientId : null, byClient ? null : id.channel, byClient ? id.externalUserId : id.externalId]);
    return { kind: 'contact', personId: contact.id, method, confidence: 1 };
  }
}
