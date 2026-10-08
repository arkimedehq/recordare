// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Explicit writes from tools (D11, D16, D34): log_episode, remember, correct_episode,
 * forget_episode. Explicit capture is "stated" with importance 10 only when evidence binds to a
 * message of the owner; otherwise it is recorded as noted by the assistant (poisoning guard).
 * Forgetting is physical and sticks (tombstones also hide the evidence from the chat search).
 */
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DataSource, type EntityManager } from 'typeorm';
import { EMBEDDING_PORT, type EmbeddingPort } from '../embedding/embedding.port';
import { toStored, type Precision } from '../engine/time';
import { TelemetryService } from '../telemetry/telemetry.service';

/**
 * The agent's text is backed by a message of the owner when the two overlap as a whole (trigram similarity ≥ 0.2) or
 * when the text is found inside the message (word similarity ≥ 0.6): a long message ("use the tools: … remember that
 * my favourite colour is green") dilutes the whole-text similarity of the short fact it contains.
 */
const OVERLAP = (col: string) => `(similarity(${col}, $3) >= 0.2 OR word_similarity($3, ${col}) >= 0.6)`;
const SCORE = (col: string) => `GREATEST(similarity(${col}, $3), word_similarity($3, ${col}))`;

export interface Evidence {
  /** Conversation the tool was called from (resolved viewer context), if any. */
  conversationId?: string;
  clientId: string;
  /** A personal token (owner-direct): without a conversation, the owner's recent messages from this client count. */
  ownerDirect?: boolean;
}

@Injectable()
export class MemoryWriteService {
  constructor(
    private readonly db: DataSource,
    @Inject(EMBEDDING_PORT) private readonly embeddings: EmbeddingPort,
    private readonly telemetry: TelemetryService,
  ) {}

  /** Consent (D4): without it nothing is stored, also through the tools (forgetting stays allowed). */
  async consented(ownerId: string): Promise<boolean> {
    const [o] = await this.db.query(`SELECT episodic_enabled FROM owners WHERE person_id = $1`, [ownerId]);
    return Boolean(o?.episodic_enabled);
  }

  async logEpisode(ownerId: string, ev: Evidence, input: {
    content: string; kind?: 'event' | 'plan'; occurredAt?: string; occurredUntil?: string; datePrecision?: Precision; people?: string[]; place?: string;
  }): Promise<string> {
    const id = await this.db.transaction(async (tx) => {
      const [owner] = await tx.query(`SELECT timezone FROM owners WHERE person_id = $1`, [ownerId]);
      const { messageId, byOwner } = await this.bindEvidence(tx, ownerId, ev, input.content);
      const at = toStored(input.occurredAt, input.datePrecision, owner.timezone);
      const until = toStored(input.occurredUntil, 'day', owner.timezone);
      const kind = input.kind ?? 'event';
      const [row] = await tx.query(
        `INSERT INTO episodes (owner_id, kind, content, occurred_at, occurred_until, date_precision, place, importance, plan_status, plan_status_at,
           origin, author_role, stance, confidence, disclosure, audience)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'owner', $15) RETURNING id`,
        [ownerId, kind, input.content, at.at, until.at, at.precision, input.place ?? null, byOwner ? 10 : 5,
          kind === 'plan' ? 'open' : null, kind === 'plan' ? new Date() : null,
          byOwner ? 'owner_lived' : 'assistant_stated', byOwner ? 'owner' : 'assistant',
          // "stated" only with the owner's own words behind it (API.md §3), as for notes.
          byOwner ? 'stated' : 'inferred', byOwner ? 1 : 0.6, [ownerId]]);
      await tx.query(`INSERT INTO episode_evidence (episode_id, message_id, evidence_kind) VALUES ($1, $2, $3)`,
        [row.id, messageId, byOwner ? 'message' : 'agent_paraphrase']);
      for (const p of input.people ?? []) await tx.query(`INSERT INTO episode_people (episode_id, alias) VALUES ($1, $2)`, [row.id, p]);
      return row.id as string;
    });
    await this.embed('episodes', id, input.content);
    return id;
  }

  async remember(ownerId: string, ev: Evidence, input: { content: string; category?: string }): Promise<string> {
    const id = await this.db.transaction(async (tx) => {
      const { messageId, byOwner } = await this.bindEvidence(tx, ownerId, ev, input.content);
      const [row] = await tx.query(
        `INSERT INTO notes (owner_id, category, content, pending, origin, author_role, stance, confidence, disclosure, audience)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'owner', $9) RETURNING id`,
        [ownerId, input.category ?? 'knowledge', input.content, !byOwner, byOwner ? 'owner_lived' : 'assistant_stated',
          byOwner ? 'owner' : 'assistant', byOwner ? 'stated' : 'inferred', byOwner ? 1 : 0.6, [ownerId]]);
      await tx.query(`INSERT INTO note_evidence (note_id, message_id) VALUES ($1, $2)`, [row.id, messageId]);
      await tx.query(`INSERT INTO note_changes (owner_id, note_id, change) VALUES ($1, $2, 'created')`, [ownerId, row.id]);
      return row.id as string;
    });
    await this.embed('notes', id, input.content);
    return id;
  }

  async correctEpisode(ownerId: string, ev: Evidence, input: { id: string; content?: string; occurredAt?: string; datePrecision?: Precision }): Promise<string> {
    const id = await this.db.transaction(async (tx) => {
      const [old] = await tx.query(`SELECT * FROM episodes WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL`, [input.id, ownerId]);
      if (!old) throw new NotFoundException();
      const [owner] = await tx.query(`SELECT timezone FROM owners WHERE person_id = $1`, [ownerId]);
      const { messageId } = await this.bindEvidence(tx, ownerId, ev, input.content ?? old.content);
      const at = input.occurredAt ? toStored(input.occurredAt, input.datePrecision, owner.timezone) : { at: old.occurred_at, precision: old.date_precision };
      const [row] = await tx.query(
        `INSERT INTO episodes (owner_id, kind, content, occurred_at, occurred_until, date_precision, place, importance, valence, feelings,
           opinion, keywords, context, tags, plan_status, plan_status_at, corrects, origin, author_role, stance, confidence, disclosure, audience)
         SELECT owner_id, kind, $3, $4, occurred_until, $5, place, importance, valence, feelings, opinion, keywords, context, tags,
           plan_status, plan_status_at, id, origin, author_role, stance, confidence, disclosure, audience
         FROM episodes WHERE id = $1 AND owner_id = $2 RETURNING id`,
        [input.id, ownerId, input.content ?? old.content, at.at, at.precision]);
      await tx.query(`UPDATE episodes SET invalidated_at = now() WHERE id = $1`, [input.id]);
      await tx.query(`INSERT INTO episode_people (episode_id, alias, person_id, role) SELECT $1, alias, person_id, role FROM episode_people WHERE episode_id = $2`, [row.id, input.id]);
      await tx.query(`INSERT INTO episode_evidence (episode_id, message_id, evidence_kind) VALUES ($1, $2, 'message') ON CONFLICT DO NOTHING`, [row.id, messageId]);
      return row.id as string;
    });
    const [row] = await this.db.query(`SELECT content FROM episodes WHERE id = $1`, [id]);
    await this.embed('episodes', id, row.content);
    return id;
  }

  /** Physical forgetting of an episode and its correction chain; never recreated (tombstone). */
  async forgetEpisode(ownerId: string, id: string): Promise<void> {
    let forgotten: string[] = [];
    await this.db.transaction(async (tx) => {
      const chain: Array<{ id: string; content: string }> = await tx.query(
        // Everything that tells the same memory: corrections, hidden duplicates, the event of a
        // confirmed plan and rescheduled plans — otherwise a forgotten memory would resurface.
        `WITH RECURSIVE chain AS (
           SELECT id, content, corrects, duplicate_of, confirmed_by, rescheduled_to FROM episodes WHERE id = $1 AND owner_id = $2
           UNION
           SELECT e.id, e.content, e.corrects, e.duplicate_of, e.confirmed_by, e.rescheduled_to FROM episodes e JOIN chain c
             ON e.id IN (c.corrects, c.duplicate_of, c.confirmed_by, c.rescheduled_to)
             OR c.id IN (e.corrects, e.duplicate_of, e.confirmed_by, e.rescheduled_to)
           WHERE e.owner_id = $2)
         SELECT id, content FROM chain`, [id, ownerId]);
      if (chain.length === 0) throw new NotFoundException();
      const ids = chain.map((c) => c.id);
      // Only real evidence is hidden from the chat search (agent paraphrases are tool messages).
      const msgs: Array<{ message_id: string }> = await tx.query(
        `SELECT DISTINCT message_id FROM episode_evidence WHERE episode_id = ANY($1) AND evidence_kind = 'message'`, [ids]);
      await tx.query(
        `INSERT INTO forget_tombstones (owner_id, scope, episode_fingerprint, message_ids) VALUES ($1, 'episode', $2, $3)`,
        [ownerId, createHash('sha256').update(chain.map((c) => c.content).join('\n')).digest(), msgs.map((m) => m.message_id)]);
      // Digests written from these episodes are superseded now (no stale diary text); the next consolidation
      // rewrites the day / month from what is left (D16).
      await tx.query(
        `WITH days AS (SELECT DISTINCT digest_id FROM digest_sources WHERE episode_id = ANY($1)),
              months AS (SELECT DISTINCT s.digest_id FROM digest_sources s JOIN days d ON s.source_digest_id = d.digest_id)
         UPDATE digests SET superseded_at = now()
         WHERE owner_id = $2 AND superseded_at IS NULL AND id IN (SELECT digest_id FROM days UNION SELECT digest_id FROM months)`,
        [ids, ownerId]);
      await tx.query(`DELETE FROM episodes WHERE id = ANY($1) AND owner_id = $2`, [ids, ownerId]);
      forgotten = ids;
    });
    this.telemetry.emit({ type: 'episode.forgotten', ownerId, ids: forgotten });
  }

  /**
   * Evidence for an explicit write: the owner's latest message in the calling conversation when
   * there is one (stated by the owner); otherwise the tool call is stored in a per-client daily
   * `mcp_tool` conversation as the agent's paraphrase (role assistant: the extraction gate never
   * spends a call on it).
   */
  private async bindEvidence(tx: EntityManager, ownerId: string, ev: Evidence, text: string): Promise<{ messageId: string; byOwner: boolean }> {
    if (ev.conversationId) {
      // Owner-stated only when a recent message of the owner actually says it (text overlap):
      // an agent cannot turn "ciao" into "the owner decided X" (poisoning guard).
      const [m] = await tx.query(
        `SELECT id FROM messages
         WHERE conversation_id = $1 AND owner_id = $2 AND (role = 'user' OR author_person_id = $2)
           AND received_at > now() - interval '30 minutes' AND ${OVERLAP('content')}
         ORDER BY ${SCORE('content')} DESC, sent_at DESC LIMIT 1`,
        [ev.conversationId, ownerId, text]);
      if (m) return { messageId: m.id, byOwner: true };
    } else if (ev.ownerDirect) {
      // A personal-token client (Claude Code, a connector) ingests the person's turns but cannot name the conversation
      // on MCP calls: the person's own recent words from the same client are the evidence, same overlap rule.
      const [m] = await tx.query(
        `SELECT m.id FROM messages m JOIN conversations c ON c.id = m.conversation_id
         WHERE c.client_id = $1 AND m.owner_id = $2 AND (m.role = 'user' OR m.author_person_id = $2)
           AND m.received_at > now() - interval '30 minutes' AND ${OVERLAP('m.content')}
         ORDER BY ${SCORE('m.content')} DESC, m.sent_at DESC LIMIT 1`,
        [ev.clientId, ownerId, text]);
      if (m) return { messageId: m.id, byOwner: true };
    }
    const day = new Date().toISOString().slice(0, 10);
    const [conv] = await tx.query(
      `INSERT INTO conversations (owner_id, client_id, external_id, source, channel, started_at, last_message_at)
       VALUES ($1, $2, $3, 'mcp_tool', 'mcp', now(), now())
       ON CONFLICT (client_id, owner_id, external_id) DO UPDATE SET last_message_at = now() RETURNING id`,
      [ownerId, ev.clientId, `mcp-tool-${day}`]);
    const [msg] = await tx.query(
      `INSERT INTO messages (conversation_id, owner_id, external_id, role, content, content_hash, sent_at)
       VALUES ($1, $2, $3, 'assistant', $4, $5, now()) RETURNING id`,
      [conv.id, ownerId, `tool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text, createHash('sha256').update(text).digest()]);
    return { messageId: msg.id, byOwner: false };
  }

  private async embed(table: 'episodes' | 'notes', id: string, text: string): Promise<void> {
    try {
      const [v] = await this.embeddings.embed([text], 'document');
      if (!v) return;
      const sql = table === 'episodes'
        ? `UPDATE episodes SET embedding = $1::vector, embedding_model = $2, embedding_text = $3 WHERE id = $4`
        : `UPDATE notes SET embedding = $1::vector, embedding_model = $2, embedding_text = $3 WHERE id = $4`;
      await this.db.query(sql, [`[${v.join(',')}]`, this.embeddings.model, text, id]);
    } catch {
      // Embedding is best-effort; full-text still finds the row.
    }
  }
}
