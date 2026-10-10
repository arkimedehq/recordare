// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Learned sources (WORK_PLAN 8.9, D49): the agent's semantic memory — what it learned, kept apart from what it lived.
 * A source arrives as text, in one request or in parts (no size limit: a part is one request's worth); each part is split
 * into passages at once and the passages are embedded in the background (status receiving → indexing → ready; full-text
 * finds them before their embeddings). The learning is an episode linked to the source: the extraction of the
 * conversation it came with tells of it, or — learned on its own — a code-written one. Forgetting a source deletes it with
 * its passages; the episodes that referred to it keep a "forgotten source" marker.
 */
import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DataSource, type EntityManager } from 'typeorm';
import { EMBEDDING_PORT, type EmbeddingPort } from '../embedding/embedding.port';
import { QUEUE_PORT, type QueuePort } from '../queue/queue.port';
import { ContactBook } from '../engine/subjects';
import { splitPassages } from './passages';
import { writeLearnedEpisode } from './learned-episode';
import { type LearnSourceRequest, type LearnSourceResult, type SourcePartRequest } from './sources.schemas';

export interface SourceView {
  id: string;
  externalId: string;
  title: string;
  kind: string;
  author: string | null;
  uri: string | null;
  providedBy: { kind: 'self' } | { kind: 'someone' } | { kind: 'contact'; name: string };
  learnedAt: string;
  status: 'receiving' | 'indexing' | 'ready';
  chars: number;
  passages: number;
  /** The episodes that refer to it (the learning, and what was done with it). */
  episodeIds: string[];
}

const hash = (text: string): Buffer => createHash('sha256').update(text).digest();

@Injectable()
export class SourcesService {
  private readonly log = new Logger(SourcesService.name);

  constructor(
    private readonly db: DataSource,
    @Inject(QUEUE_PORT) private readonly queue: QueuePort,
    @Inject(EMBEDDING_PORT) private readonly embeddings: EmbeddingPort,
  ) {}

  /** A new source, or a new version of one the client sent before (same external id); the same first request again is a duplicate. */
  async learn(ownerId: string, clientId: string | null, req: LearnSourceRequest, now: Date, inConversation?: string): Promise<LearnSourceResult> {
    const result = await this.db.transaction(async (tx) => {
      const [existing]: Array<{ id: string; content_hash: Buffer | null; title: string; status: LearnSourceResult['status']; parts: number }> = await tx.query(
        `SELECT id, content_hash, title, status, parts FROM sources
         WHERE owner_id = $1 AND client_id IS NOT DISTINCT FROM $2 AND external_id = $3 FOR UPDATE`, [ownerId, clientId, req.externalId]);
      const first = hash(req.text);
      if (existing && existing.content_hash?.equals(first) && existing.title === req.title) {
        return { ...(await this.counts(tx, existing.id)), duplicate: true };
      }
      const provider = await this.provider(tx, ownerId, req.providedBy);
      const conversationId = inConversation
        ?? (req.conversation && clientId ? await this.conversation(tx, ownerId, clientId, req.conversation.externalId) : null);
      const learnedAt = req.learnedAt ? new Date(req.learnedAt) : now;
      let id: string;
      if (existing) {
        // A new version replaces the text; the learning episode and its links stay.
        await tx.query(`DELETE FROM source_passages WHERE source_id = $1`, [existing.id]);
        await tx.query(
          `UPDATE sources SET title = $2, kind = $3, author = $4, origin_uri = $5, language = $6, provided_by_kind = $7, provided_by_person_id = $8,
             learned_at = $9, conversation_id = COALESCE($10, conversation_id), status = 'receiving', parts = 0, chars = 0, content_hash = $11, updated_at = now()
           WHERE id = $1`,
          [existing.id, req.title, req.kind, req.author ?? null, req.uri ?? null, req.language ?? null, provider.kind, provider.personId, learnedAt,
            conversationId, first]);
        id = existing.id;
      } else {
        [{ id }] = await tx.query(
          `INSERT INTO sources (owner_id, client_id, external_id, title, kind, author, origin_uri, language, provided_by_kind, provided_by_person_id,
             learned_at, conversation_id, content_hash)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
          [ownerId, clientId, req.externalId, req.title, req.kind, req.author ?? null, req.uri ?? null, req.language ?? null, provider.kind,
            provider.personId, learnedAt, conversationId, first]);
      }
      await this.addPart(tx, id, ownerId, req.text, req.final);
      return { ...(await this.counts(tx, id)), duplicate: false };
    });
    if (!result.duplicate) await this.afterWrite(result.sourceId, result.status);
    return result;
  }

  /** The next part of a source still receiving (parts in order; a part sent again is a duplicate). */
  async part(ownerId: string, clientId: string | null, externalId: string, req: SourcePartRequest): Promise<LearnSourceResult> {
    const result = await this.db.transaction(async (tx) => {
      const [s]: Array<{ id: string; parts: number; status: string }> = await tx.query(
        `SELECT id, parts, status FROM sources WHERE owner_id = $1 AND client_id IS NOT DISTINCT FROM $2 AND external_id = $3 FOR UPDATE`,
        [ownerId, clientId, externalId]);
      if (!s) throw new NotFoundException({ code: 'source_not_found' });
      if (req.part < s.parts) return { ...(await this.counts(tx, s.id)), duplicate: true };
      if (s.status !== 'receiving') throw new ConflictException({ code: 'source_complete', detail: 'the source already received its final part' });
      if (req.part > s.parts) throw new ConflictException({ code: 'part_out_of_order', detail: `expected part ${s.parts}` });
      await this.addPart(tx, s.id, ownerId, req.text, req.final);
      return { ...(await this.counts(tx, s.id)), duplicate: false };
    });
    if (!result.duplicate) await this.afterWrite(result.sourceId, result.status);
    return result;
  }

  /** Forgets a source: it and its passages are deleted; the episodes that referred to it keep a marker. */
  async forget(ownerId: string, where: { id: string } | { clientId: string | null; externalId: string }): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [s]: Array<{ id: string }> = 'id' in where
        ? await tx.query(`SELECT id FROM sources WHERE id = $1 AND owner_id = $2 FOR UPDATE`, [where.id, ownerId])
        : await tx.query(`SELECT id FROM sources WHERE owner_id = $1 AND client_id IS NOT DISTINCT FROM $2 AND external_id = $3 FOR UPDATE`,
          [ownerId, where.clientId, where.externalId]);
      if (!s) {
        if ('id' in where) throw new NotFoundException({ code: 'source_not_found' });
        return; // forgetting what Recordare never had is done
      }
      await tx.query(`UPDATE episode_sources SET source_id = NULL, forgotten_at = now() WHERE source_id = $1`, [s.id]);
      await tx.query(`DELETE FROM sources WHERE id = $1`, [s.id]);
    });
  }

  async list(ownerId: string): Promise<SourceView[]> {
    const rows: Array<SourceRow> = await this.db.query(`${SOURCE_SELECT} WHERE s.owner_id = $1 ORDER BY s.learned_at DESC, s.id`, [ownerId]);
    return rows.map(view);
  }

  /** A source with its text, passage by passage. */
  async get(ownerId: string, id: string): Promise<SourceView & { text: Array<{ ordinal: number; heading: string | null; content: string }> }> {
    const [row]: Array<SourceRow> = await this.db.query(`${SOURCE_SELECT} WHERE s.owner_id = $1 AND s.id = $2`, [ownerId, id]);
    if (!row) throw new NotFoundException({ code: 'source_not_found' });
    const passages = await this.db.query(`SELECT ordinal, heading, content FROM source_passages WHERE source_id = $1 ORDER BY ordinal`, [id]);
    return { ...view(row), text: passages as Array<{ ordinal: number; heading: string | null; content: string }> };
  }

  // ── internals ─────────────────────────────────────────────────────────────────

  private async addPart(tx: EntityManager, sourceId: string, ownerId: string, text: string, final: boolean): Promise<void> {
    const [{ next }] = await tx.query(`SELECT COALESCE(max(ordinal) + 1, 0) AS next FROM source_passages WHERE source_id = $1`, [sourceId]);
    const passages = splitPassages(text);
    for (const [i, p] of passages.entries()) {
      await tx.query(`INSERT INTO source_passages (source_id, owner_id, ordinal, heading, content) VALUES ($1, $2, $3, $4, $5)`,
        [sourceId, ownerId, Number(next) + i, p.heading, p.content]);
    }
    await tx.query(`UPDATE sources SET parts = parts + 1, chars = chars + $2, status = $3, updated_at = now() WHERE id = $1`,
      [sourceId, text.length, final ? 'indexing' : 'receiving']);
  }

  /** After a write: embed the new passages in the background; once complete, the learning episode (unless a conversation will tell of it). */
  private async afterWrite(sourceId: string, status: LearnSourceResult['status']): Promise<void> {
    await this.queue.enqueueSourcePassages(sourceId);
    if (status === 'receiving') return;
    const [s]: Array<{ conversation_id: string | null; pending: boolean }> = await this.db.query(
      `SELECT s.conversation_id, EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = s.conversation_id AND m.extracted_run_id IS NULL
         AND m.role IN ('user', 'other')) AS pending
       FROM sources s WHERE s.id = $1`, [sourceId]);
    // Its conversation still has messages to extract: the extraction tells of it (and writes the episode itself if not).
    if (s?.conversation_id && s.pending) return;
    const written = await this.db.transaction((tx) => writeLearnedEpisode(tx, sourceId));
    if (written) await this.embed(written.id, written.text);
  }

  private async embed(episodeId: string, text: string): Promise<void> {
    try {
      const [v] = await this.embeddings.embed([text], 'document');
      await this.db.query(`UPDATE episodes SET embedding = $1::vector, embedding_model = $2, embedding_text = $3 WHERE id = $4`,
        [`[${(v ?? []).join(',')}]`, this.embeddings.model, text, episodeId]);
    } catch (err) {
      this.log.warn(`learning episode embedding skipped: ${(err as Error).message}`); // full-text still finds it
    }
  }

  private async counts(tx: EntityManager, id: string): Promise<{ sourceId: string; status: LearnSourceResult['status']; parts: number; passages: number }> {
    const [r] = await tx.query(
      `SELECT s.status, s.parts, (SELECT count(*)::int FROM source_passages p WHERE p.source_id = s.id) AS passages FROM sources s WHERE s.id = $1`, [id]);
    return { sourceId: id, status: r.status, parts: r.parts, passages: r.passages };
  }

  /** Who gave it: me, someone, or a person by name (a contact, created when new; an ambiguous name stays someone). */
  private async provider(tx: EntityManager, ownerId: string, by: LearnSourceRequest['providedBy']): Promise<{ kind: 'self' | 'contact' | 'someone'; personId: string | null }> {
    if (by === 'me') return { kind: 'self', personId: null };
    if (by === 'someone') return { kind: 'someone', personId: null };
    const names: Array<{ alias: string }> = await tx.query(
      `SELECT p.display_name AS alias FROM persons p WHERE p.id = $1 UNION ALL SELECT alias FROM person_aliases WHERE person_id = $1`, [ownerId]);
    const r = await new ContactBook(tx, ownerId, names.map((n) => n.alias), new Map()).byName(by.name);
    if (r.subject.kind === 'self') return { kind: 'self', personId: null };
    return r.subject.kind === 'contact' && r.subject.personId ? { kind: 'contact', personId: r.subject.personId } : { kind: 'someone', personId: null };
  }

  private async conversation(tx: EntityManager, ownerId: string, clientId: string, externalId: string): Promise<string | null> {
    const [c] = await tx.query(`SELECT id FROM conversations WHERE owner_id = $1 AND client_id = $2 AND external_id = $3 AND deleted_at IS NULL`,
      [ownerId, clientId, externalId]);
    return (c?.id as string | undefined) ?? null;
  }
}

interface SourceRow {
  id: string; external_id: string; title: string; kind: string; author: string | null; origin_uri: string | null;
  provided_by_kind: 'self' | 'contact' | 'someone'; provider: string | null; learned_at: Date; status: SourceView['status'];
  chars: string; passages: number; episode_ids: string[];
}

const SOURCE_SELECT = `SELECT s.id, s.external_id, s.title, s.kind, s.author, s.origin_uri, s.provided_by_kind, p.display_name AS provider,
    s.learned_at, s.status, s.chars, (SELECT count(*)::int FROM source_passages x WHERE x.source_id = s.id) AS passages,
    ARRAY(SELECT es.episode_id FROM episode_sources es JOIN episodes e ON e.id = es.episode_id
          WHERE es.source_id = s.id AND e.deleted_at IS NULL ORDER BY e.occurred_at) AS episode_ids
  FROM sources s LEFT JOIN persons p ON p.id = s.provided_by_person_id`;

function view(r: SourceRow): SourceView {
  return {
    id: r.id, externalId: r.external_id, title: r.title, kind: r.kind, author: r.author, uri: r.origin_uri,
    providedBy: r.provided_by_kind === 'contact' && r.provider ? { kind: 'contact', name: r.provider } : { kind: r.provided_by_kind === 'self' ? 'self' : 'someone' },
    learnedAt: r.learned_at.toISOString(), status: r.status, chars: Number(r.chars), passages: r.passages, episodeIds: r.episode_ids,
  };
}
