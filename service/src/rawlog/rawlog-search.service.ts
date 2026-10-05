// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Raw-log search (D13 fallback, Layer 0): full-text + vector over the owner's non-assistant
 * messages, fused with weighted reciprocal rank (the spike found vector retrieval more robust
 * under noise, so it weighs more). Limited to the calling client's conversations unless the
 * client's `raw_log_scope` is `all`.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EMBEDDING_PORT, type EmbeddingPort } from '../embedding/embedding.port';

export interface RawHit {
  conversationId: string;
  /** The client's own id of the conversation, to link back to its chat. */
  conversation: string;
  messageId: string;
  at: string;
  authorRole: 'owner' | 'other' | 'tool';
  /** Who wrote it, when not the owner (group members by their display name; tools by name). */
  author?: string;
  excerpt: string;
  score: number;
}

export interface RawSearchOptions {
  query: string;
  from?: Date;
  to?: Date;
  limit?: number;
}

const RRF_K = 60;
const VECTOR_WEIGHT = 1;
const TEXT_WEIGHT = 0.5;
const CANDIDATES = 50;
const EXCERPT_CHARS = 400;

@Injectable()
export class RawLogSearchService {
  private readonly log = new Logger(RawLogSearchService.name);

  constructor(private readonly db: DataSource, @Inject(EMBEDDING_PORT) private readonly embeddings: EmbeddingPort) {}

  async search(ownerId: string, clientId: string | null, opts: RawSearchOptions): Promise<RawHit[]> {
    const scope = await this.scopeClause(clientId);
    const params: unknown[] = [ownerId, opts.from ?? null, opts.to ?? null];
    // Messages behind forgotten memories never come back through the chat search (D16).
    const base = `m.owner_id = $1 AND m.role <> 'assistant' AND c.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM forget_tombstones t WHERE t.owner_id = $1 AND m.id = ANY(t.message_ids))
      AND ($2::timestamptz IS NULL OR m.sent_at >= $2) AND ($3::timestamptz IS NULL OR m.sent_at < $3) ${scope.sql(params)}`;

    const tsq = toOrTsQuery(opts.query);
    const text: { id: string }[] = tsq
      ? await this.db.query(
        `SELECT m.id FROM messages m JOIN conversations c ON c.id = m.conversation_id
         WHERE ${base} AND m.tsv @@ to_tsquery('simple', $${params.length + 1})
         ORDER BY ts_rank_cd(m.tsv, to_tsquery('simple', $${params.length + 1})) DESC LIMIT ${CANDIDATES}`,
        [...params, tsq])
      : [];

    let vector: { id: string }[] = [];
    try {
      const [q] = await this.embeddings.embed([opts.query], 'query');
      if (q) {
        vector = await this.db.query(
          `SELECT m.id FROM messages m JOIN conversations c ON c.id = m.conversation_id
           WHERE ${base} AND m.embedding IS NOT NULL
           ORDER BY m.embedding <=> $${params.length + 1}::vector LIMIT ${CANDIDATES}`,
          [...params, `[${q.join(',')}]`]);
      }
    } catch (err) {
      // Embedding server down: degrade to full-text only.
      this.log.warn(`raw-log vector leg skipped: ${(err as Error).message}`);
    }

    const scores = new Map<string, number>();
    text.forEach((r, i) => scores.set(r.id, (scores.get(r.id) ?? 0) + TEXT_WEIGHT / (RRF_K + i + 1)));
    vector.forEach((r, i) => scores.set(r.id, (scores.get(r.id) ?? 0) + VECTOR_WEIGHT / (RRF_K + i + 1)));
    const top = [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, opts.limit ?? 5);
    if (top.length === 0) return [];

    const rows: { id: string; conversation_id: string; external_id: string; sent_at: Date; role: string; author_person_id: string | null;
      author_name: string | null; tool_name: string | null; content: string }[] =
      await this.db.query(
        `SELECT m.id, m.conversation_id, c.external_id, m.sent_at, m.role, m.author_person_id, m.tool_name, m.content,
                COALESCE(p.display_name, cp.display_name) AS author_name
         FROM messages m JOIN conversations c ON c.id = m.conversation_id
           LEFT JOIN persons p ON p.id = m.author_person_id
           LEFT JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.ref = m.author_ref
         WHERE m.id = ANY($1)`,
        [top.map(([id]) => id)]);
    const byId = new Map(rows.map((r) => [r.id, r]));
    return top.flatMap(([id, score]) => {
      const r = byId.get(id);
      if (!r) return [];
      const authorRole = r.role === 'tool' ? 'tool' : r.author_person_id === ownerId ? 'owner' : 'other';
      const author = authorRole === 'tool' ? r.tool_name : authorRole === 'other' ? r.author_name : null;
      return [{
        conversationId: r.conversation_id, conversation: r.external_id, messageId: r.id, at: r.sent_at.toISOString(), authorRole,
        ...(author ? { author } : {}),
        excerpt: r.content.length > EXCERPT_CHARS ? `${r.content.slice(0, EXCERPT_CHARS)}…` : r.content, score,
      } satisfies RawHit];
    });
  }

  private async scopeClause(clientId: string | null): Promise<{ sql: (params: unknown[]) => string }> {
    if (!clientId) return { sql: () => '' };
    const [client] = await this.db.query(`SELECT raw_log_scope FROM clients WHERE id = $1`, [clientId]);
    if (client?.raw_log_scope === 'all') return { sql: () => '' };
    return { sql: (params) => { params.push(clientId); return `AND c.client_id = $${params.length}`; } };
  }
}

/** "Quando ho fatto il backup del NAS?" → 'quando | backup | nas' (OR of words ≥ 3 chars). */
export function toOrTsQuery(text: string): string {
  const words = text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3);
  return [...new Set(words)].map((w) => w.replace(/'/g, '')).join(' | ');
}
