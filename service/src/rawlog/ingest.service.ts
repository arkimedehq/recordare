// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * REST ingest into Layer 0 (docs/API.md §2): idempotent on (client, owner, conversation, message),
 * nothing stored without consent (D4), participants resolved to persons only through verified
 * identities (audience, D29), idle extraction (re)scheduled after commit (D1, D5).
 */
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { DataSource, type EntityManager } from 'typeorm';
import { type Env } from '../config/env';
import { QUEUE_PORT, type QueuePort } from '../queue/queue.port';
import { type IngestRequest, type IngestResult } from './ingest.schemas';
import { TelemetryService } from '../telemetry/telemetry.service';

type Participant = IngestRequest['conversation']['participants'][number];

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
    const [owner] = await this.db.query(`SELECT episodic_enabled FROM owners WHERE person_id = $1`, [ownerId]);
    if (!owner?.episodic_enabled) return { conversationId: null, accepted: 0, duplicates: 0, conflicts: [], stored: false };

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

      const persons = await this.upsertParticipants(tx, conversationId, ownerId, clientId, req.conversation.participants);
      let accepted = 0;
      let duplicates = 0;
      const conflicts: string[] = [];
      const newIds: string[] = [];

      for (const m of req.messages) {
        const hash = contentHash(m.content);
        const author = m.authorRef !== undefined ? (persons.get(m.authorRef) ?? null) : m.role === 'user' ? ownerId : null;
        const [inserted] = await tx.query(
          `INSERT INTO messages (conversation_id, owner_id, external_id, role, tool_name, author_person_id, author_ref, content, content_hash, sent_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (conversation_id, external_id) DO NOTHING
           RETURNING id`,
          [conversationId, ownerId, m.externalId, m.role, m.toolName ?? null, author, m.authorRef ?? null, m.content, hash, new Date(m.sentAt)],
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
    return { conversationId: outcome.conversationId, accepted: outcome.accepted, duplicates: outcome.duplicates, conflicts: outcome.conflicts, stored: true };
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
  /** Ends a conversation without a message: schedules its extraction now (404 when unknown, nothing when no consent). */
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
   * Participants → persons. Only the owner and verified identities become persons (they enter
   * `audience`); everyone else is kept by display name. Returns ref → person id.
   */
  private async upsertParticipants(
    tx: EntityManager, conversationId: string, ownerId: string, clientId: string, participants: Participant[],
  ): Promise<Map<string, string | null>> {
    const list = participants.some((p) => p.role === 'owner') ? participants : [{ ref: 'owner', role: 'owner' as const }, ...participants];
    const persons = new Map<string, string | null>();
    for (const p of list) {
      let personId: string | null = null;
      if (p.role === 'owner') {
        personId = ownerId;
      } else if (p.role === 'other' && p.identity) {
        const [hit] = 'externalUserId' in p.identity
          ? await tx.query(
            `SELECT person_id FROM external_identities WHERE kind = 'client_user' AND client_id = $1 AND external_id = $2`,
            [clientId, p.identity.externalUserId])
          : await tx.query(
            `SELECT person_id FROM external_identities
             WHERE kind = 'channel' AND channel = $1 AND external_id = $2 AND verified_at IS NOT NULL
               AND (owner_scope = $3 OR owner_scope IS NULL)
             ORDER BY owner_scope NULLS LAST LIMIT 1`,
            [p.identity.channel, p.identity.externalId, ownerId]);
        personId = hit?.person_id ?? null;
      }
      persons.set(p.ref, personId);
      await tx.query(
        `INSERT INTO conversation_participants (conversation_id, ref, person_id, role, display_name)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (conversation_id, ref) DO UPDATE SET
           person_id = COALESCE(EXCLUDED.person_id, conversation_participants.person_id),
           display_name = COALESCE(EXCLUDED.display_name, conversation_participants.display_name)`,
        [conversationId, p.ref, personId, p.role, ('displayName' in p ? p.displayName : undefined) ?? null],
      );
    }
    return persons;
  }
}
