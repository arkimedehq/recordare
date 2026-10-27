// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * REST ingest into Layer 0 (docs/API.md §2): idempotent on (client, memory, conversation, message),
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
import { type EditMessage, type IngestRequest, type IngestResult } from './ingest.schemas';
import { TelemetryService } from '../telemetry/telemetry.service';
import { type MemoryMode } from '../identity/identity.entities';
import { type Attribution, SOMEONE } from './attribution';
import { askSameContact, matchUnboundContacts, sameContactQuestion } from '../engine/contacts';
import { dropUnsupported, supportedBy } from '../recall/forgetting';
import { claimLinkCode, type Claimant } from '../identity/holder-links';

type Participant = IngestRequest['conversation']['participants'][number];
interface MemoryInfo { mode: MemoryMode; locale: string; timezone: string }
type IngestMessage = IngestRequest['messages'][number];

const self = (memoryId: string): Attribution => ({ kind: 'self', personId: memoryId, method: 'account', confidence: 1 });
const asserted = (kind: 'agent' | 'tool'): Attribution => ({ kind, personId: null, method: 'client_assertion', confidence: 1 });

/**
 * Who wrote a message (D50): the role the client gave it, the participant its `authorRef` names, and the memory's mode
 * (personal: an undeclared user turn is the self; entity: someone).
 */
export function attribute(m: IngestMessage, participants: Map<string, Attribution>, memoryId: string, mode: MemoryMode): Attribution {
  const byRef = m.authorRef !== undefined ? participants.get(m.authorRef) : undefined;
  if (m.own) return { kind: 'own', personId: byRef?.personId ?? null, method: 'client_assertion', confidence: 1 };
  if (m.role === 'tool') return asserted('tool');
  if (m.role === 'assistant') return asserted('agent');
  if (byRef) return byRef;
  return m.role === 'user' && mode === 'personal' ? self(memoryId) : SOMEONE;
}

/** The participant a message names, when it carries an identity (a link code's claimant). */
function claimant(participants: Participant[], m: IngestMessage): Claimant | null {
  const p = m.authorRef !== undefined ? participants.find((x) => x.ref === m.authorRef) : undefined;
  return p?.identity && p.role === 'other' ? { identity: p.identity, displayName: p.displayName } : null;
}

/** The agent's and tools' turns (a reply), as opposed to what people say (`user`, `other`). */
const isReply = (role: string): boolean => role === 'assistant' || role === 'tool';

/**
 * A message's privacy (D52): a person's message is private when it or its conversation says so, and belongs to its
 * author (null: someone unidentified). A reply follows the person's message it answers — the latest one before it —
 * unless it says otherwise, and belongs to the same person.
 */
async function privacyOf(tx: EntityManager, conversationId: string, m: IngestMessage, author: Attribution, privateChat: boolean | undefined)
  : Promise<{ private: boolean; owner: string | null }> {
  if (!isReply(m.role)) {
    const isPrivate = m.private ?? privateChat ?? false;
    return { private: isPrivate, owner: isPrivate ? author.personId : null };
  }
  const [asked] = await tx.query(
    `SELECT private, private_owner_id, author_person_id FROM messages
     WHERE conversation_id = $1 AND role IN ('user', 'other') AND sent_at <= $2 ORDER BY sent_at DESC LIMIT 1`,
    [conversationId, new Date(m.sentAt)]);
  const isPrivate = m.private ?? (privateChat || !!asked?.private);
  return { private: isPrivate, owner: isPrivate ? (asked?.private ? asked.private_owner_id : asked?.author_person_id ?? null) : null };
}

export function contentHash(content: string): Buffer {
  return createHash('sha256').update(content).digest();
}

/**
 * Makes a message private or public again (D52; whoever said it decides): a person's message carries the replies that
 * answer it — the agent's and tools' turns after it, until the next person's message. A reply alone follows its own flag.
 */
export async function setPrivate(tx: EntityManager, messageId: string, isPrivate: boolean): Promise<void> {
  const [m] = await tx.query(`SELECT conversation_id, role, sent_at, author_person_id FROM messages WHERE id = $1`, [messageId]);
  if (isReply(m.role)) {
    const [asked] = await tx.query(
      `SELECT author_person_id FROM messages WHERE conversation_id = $1 AND role IN ('user', 'other') AND sent_at <= $2
       ORDER BY sent_at DESC LIMIT 1`, [m.conversation_id, m.sent_at]);
    await tx.query(`UPDATE messages SET private = $2, private_owner_id = $3 WHERE id = $1`,
      [messageId, isPrivate, isPrivate ? asked?.author_person_id ?? null : null]);
    return;
  }
  await tx.query(
    `UPDATE messages r SET private = $2, private_owner_id = CASE WHEN $2 THEN $3::uuid END
     WHERE r.id = $1 OR (r.conversation_id = $4 AND r.role IN ('assistant', 'tool') AND r.sent_at >= $5
       AND NOT EXISTS (SELECT 1 FROM messages n WHERE n.conversation_id = $4 AND n.role IN ('user', 'other')
                       AND n.sent_at > $5 AND n.sent_at <= r.sent_at))`,
    [messageId, isPrivate, m.author_person_id, m.conversation_id, m.sent_at]);
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

  async ingest(clientId: string, memoryId: string, req: IngestRequest): Promise<IngestResult> {
    const sentAts = req.messages.map((m) => new Date(m.sentAt).getTime());
    const first = new Date(Math.min(...sentAts));
    const last = new Date(Math.max(...sentAts));

    const outcome = await this.db.transaction(async (tx) => {
      const [conv] = await tx.query(
        `INSERT INTO conversations (memory_id, client_id, external_id, source, channel, title, started_at, last_message_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (client_id, memory_id, external_id) DO UPDATE SET
           started_at = LEAST(conversations.started_at, EXCLUDED.started_at),
           last_message_at = GREATEST(conversations.last_message_at, EXCLUDED.last_message_at),
           title = COALESCE(EXCLUDED.title, conversations.title),
           channel = COALESCE(EXCLUDED.channel, conversations.channel)
         RETURNING id, deleted_at`,
        [memoryId, clientId, req.conversation.externalId, req.conversation.source, req.conversation.channel ?? null,
          req.conversation.title ?? null, first, last],
      );
      if (conv.deleted_at) throw new NotFoundException();
      const conversationId: string = conv.id;

      const [memory]: Array<MemoryInfo> = await tx.query(`SELECT mode, locale, timezone FROM memories WHERE person_id = $1`, [memoryId]);
      const { mode } = memory as MemoryInfo;
      const participants = await this.upsertParticipants(tx, conversationId, memoryId, memory as MemoryInfo, clientId, req.conversation.participants, first);
      let accepted = 0;
      let duplicates = 0;
      const conflicts: string[] = [];
      const newIds: string[] = [];

      const now = new Date();
      for (const m of req.messages) {
        // A link code (D51) is a claim of the sender's identity for the holder, never a message of the memory; heard in
        // the room (continuous listening, WORK_PLAN 6.5) it is nobody's claim, like one sent in a group.
        if (mode === 'personal' && (m.role === 'user' || m.role === 'other') && !m.own
          && await claimLinkCode(tx, memoryId, clientId, m.content, claimant(req.conversation.participants, m),
            req.conversation.source === 'ambient' ? false : req.conversation.direct, now)) {
          continue;
        }
        const hash = contentHash(m.content);
        const author = attribute(m, participants, memoryId, mode);
        const privacy = await privacyOf(tx, conversationId, m, author, req.conversation.private);
        const [inserted] = await tx.query(
          `INSERT INTO messages (conversation_id, memory_id, external_id, role, tool_name, author_person_id, author_ref, author_kind,
             attribution_method, attribution_confidence, content, content_hash, sent_at, private, private_owner_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           ON CONFLICT (conversation_id, external_id) DO NOTHING
           RETURNING id`,
          [conversationId, memoryId, m.externalId, m.role, m.toolName ?? null, author.personId, m.authorRef ?? null, author.kind,
            author.method, author.confidence, m.content, hash, new Date(m.sentAt), privacy.private, privacy.owner],
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
          if (m.private !== undefined) await setPrivate(tx, existing.id, m.private);
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
      this.telemetry.emit({ type: 'message.ingested', memoryId, conversationId: outcome.conversationId, messages: outcome.accepted, roles });
    }
    return { conversationId: outcome.conversationId, accepted: outcome.accepted, duplicates: outcome.duplicates, conflicts: outcome.conflicts };
  }

  /**
   * An edited message: new content (re-extracted after the idle delay) and / or a new privacy (D52). What was extracted
   * from it follows its privacy at read time, so a privacy change needs no extraction.
   */
  async edit(clientId: string, memoryId: string, conversationExternalId: string, messageExternalId: string, edit: EditMessage): Promise<void> {
    const changed = await this.db.transaction(async (tx) => {
      const [row] = await tx.query(
        `SELECT m.id, m.content, m.conversation_id FROM messages m JOIN conversations c ON c.id = m.conversation_id
         WHERE c.client_id = $1 AND c.memory_id = $2 AND c.external_id = $3 AND m.external_id = $4 AND c.deleted_at IS NULL`,
        [clientId, memoryId, conversationExternalId, messageExternalId],
      );
      if (!row) throw new NotFoundException();
      if (edit.private !== undefined) await setPrivate(tx, row.id, edit.private);
      if (edit.content === undefined || row.content === edit.content) return null;
      await this.applyEdit(tx, row.id, row.content, edit.content);
      return row.conversation_id as string;
    });
    if (changed) await this.queue.scheduleIdleExtraction(changed, this.idleDelayMs);
  }

  /** Physical purge of one message; what only it supported goes too (`forgetting.ts`, WORK_PLAN 5.5). */
  async deleteMessage(clientId: string, memoryId: string, conversationExternalId: string, messageExternalId: string): Promise<void> {
    const [msg] = await this.db.query(
      `SELECT m.id FROM messages m JOIN conversations c ON c.id = m.conversation_id
       WHERE c.client_id = $1 AND c.memory_id = $2 AND c.external_id = $3 AND m.external_id = $4`,
      [clientId, memoryId, conversationExternalId, messageExternalId]);
    if (!msg) throw new NotFoundException();
    await this.purge(memoryId, [msg.id], (tx) => tx.query(`DELETE FROM messages WHERE id = $1`, [msg.id]));
  }

  /** Ends a conversation without a message: schedules its extraction now (404 when unknown). */
  async end(clientId: string, memoryId: string, conversationExternalId: string): Promise<void> {
    const [conv] = await this.db.query(
      `SELECT id FROM conversations WHERE client_id = $1 AND memory_id = $2 AND external_id = $3 AND deleted_at IS NULL`,
      [clientId, memoryId, conversationExternalId],
    );
    if (!conv) throw new NotFoundException();
    await this.db.query(`UPDATE conversations SET idle_job_at = now() WHERE id = $1`, [conv.id]);
    await this.queue.scheduleIdleExtraction(conv.id, 0);
  }

  /** Physical purge of a conversation and its messages (cascade); what only they supported goes too. */
  async deleteConversation(clientId: string, memoryId: string, conversationExternalId: string): Promise<void> {
    const [conv] = await this.db.query(
      `SELECT id FROM conversations WHERE client_id = $1 AND memory_id = $2 AND external_id = $3`, [clientId, memoryId, conversationExternalId]);
    if (!conv) throw new NotFoundException();
    const messages: Array<{ id: string }> = await this.db.query(`SELECT id FROM messages WHERE conversation_id = $1`, [conv.id]);
    await this.purge(memoryId, messages.map((m) => m.id), (tx) => tx.query(`DELETE FROM conversations WHERE id = $1`, [conv.id]));
  }

  /** Deletes messages (`remove`) and drops the episodes, facts, notes and plan states only they supported. */
  private async purge(memoryId: string, ids: string[], remove: (tx: EntityManager) => Promise<unknown>): Promise<void> {
    let forgotten: string[] = [];
    await this.db.transaction(async (tx) => {
      const support = await supportedBy(tx, memoryId, { messageIds: ids });
      await remove(tx);
      forgotten = (await dropUnsupported(tx, memoryId, support)).episodes;
    });
    if (forgotten.length) this.telemetry.emit({ type: 'episode.forgotten', memoryId, ids: forgotten });
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
   * Participants → the memory's self or its contacts (D50). Personal mode: the `holder` participant is the self (implied
   * when missing). A participant with an identity is resolved inside this memory only: its participant identity, or
   * the account's own user id (the self); an identity seen for the first time binds to a contact only on strong evidence
   * (its full name equals exactly one contact without an identity), else creates a contact (the client is trusted) — with
   * a "same person?" question when one contact known only by name shares its name (personal memories). An unverified
   * channel binding identifies nobody. Everyone else is kept by display name ("someone").
   * Returns ref → attribution.
   */
  private async upsertParticipants(
    tx: EntityManager, conversationId: string, memoryId: string, memory: MemoryInfo, clientId: string, participants: Participant[], at: Date,
  ): Promise<Map<string, Attribution>> {
    const { mode } = memory;
    const implied = mode === 'personal' && !participants.some((p) => p.role === 'holder');
    const list: Participant[] = implied ? [{ ref: 'holder', role: 'holder' }, ...participants] : participants;
    const out = new Map<string, Attribution>();
    for (const p of list) {
      let who: Attribution = SOMEONE;
      if (p.role === 'assistant') who = { kind: 'agent', personId: null, method: 'client_assertion', confidence: 1 };
      else if (p.role === 'holder' && mode === 'personal') who = self(memoryId);
      else if (p.identity) who = await this.resolveIdentity(tx, memoryId, memory, clientId, p, at);
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
  private async resolveIdentity(tx: EntityManager, memoryId: string, memory: MemoryInfo, clientId: string, p: Participant, at: Date): Promise<Attribution> {
    const { mode } = memory;
    const id = p.identity as NonNullable<Participant['identity']>;
    const byClient = 'externalUserId' in id;
    const method = byClient ? 'client_assertion' : 'declared';
    if (byClient && mode === 'personal') {
      // The account's own user speaking as a participant of their memory: the self.
      const [own] = await tx.query(
        `SELECT 1 FROM external_identities WHERE kind = 'account' AND client_id = $1 AND external_id = $2 AND person_id = $3`,
        [clientId, id.externalUserId, memoryId]);
      if (own) return self(memoryId);
    }
    const [hit] = byClient
      ? await tx.query(
        `SELECT person_id, verified_at FROM external_identities WHERE kind = 'participant' AND memory_id = $1 AND client_id = $2 AND external_id = $3`,
        [memoryId, clientId, id.externalUserId])
      : await tx.query(
        `SELECT person_id, verified_at FROM external_identities WHERE kind = 'participant' AND memory_id = $1 AND channel = $2 AND external_id = $3`,
        [memoryId, id.channel, id.externalId]);
    if (hit) {
      if (!hit.verified_at) return SOMEONE;
      if (hit.person_id === memoryId) return self(memoryId);
      // A known contact under a new name on the channel (e.g. a nickname became a full name): the name becomes an alias,
      // so a search by it finds them. The contact's display name stays as it is.
      const renamed = p.displayName?.trim().slice(0, 200);
      if (renamed) {
        await tx.query(
          `INSERT INTO person_aliases (memory_id, person_id, alias, alias_norm, source) VALUES ($1, $2, $3, lower(unaccent(btrim($3))), 'client')
           ON CONFLICT DO NOTHING`, [memoryId, hit.person_id, renamed]);
      }
      return { kind: 'contact', personId: hit.person_id, method, confidence: 1 };
    }
    const name = (p.displayName?.trim() || (byClient ? id.externalUserId : id.externalId)).slice(0, 200);
    // A person the memory knows without an identity is this participant only on strong evidence: the full name, equal to
    // exactly one such contact (8.4). A first name alone is not (maintainer's decision 2026-10-09): a new contact, and — when
    // exactly one contact known only by name shares it — a "same person?" question (both modes since 8.5; several: none).
    const match = p.displayName?.trim() ? await matchUnboundContacts(tx, memoryId, name) : { bind: null, similar: [] };
    const contact: { id: string } = match.bind ? { id: match.bind }
      : (await tx.query(`INSERT INTO persons (memory_id, display_name) VALUES ($1, $2) RETURNING id`, [memoryId, name]))[0];
    const [known] = match.similar;
    if (!match.bind && match.similar.length === 1 && known) {
      const question = await sameContactQuestion(tx, name, known, at, memory.locale, memory.timezone);
      await askSameContact(tx, memoryId, contact.id, known, question, at);
    }
    await tx.query(
      `INSERT INTO person_aliases (memory_id, person_id, alias, alias_norm, source) VALUES ($1, $2, $3, lower(unaccent(btrim($3))), 'client')
       ON CONFLICT DO NOTHING`, [memoryId, contact.id, name]);
    await tx.query(
      `INSERT INTO external_identities (memory_id, person_id, kind, client_id, channel, external_id, verified_at)
       VALUES ($1, $2, 'participant', $3, $4, $5, now())`,
      [memoryId, contact.id, byClient ? clientId : null, byClient ? null : id.channel, byClient ? id.externalUserId : id.externalId]);
    return { kind: 'contact', personId: contact.id, method, confidence: 1 };
  }
}
