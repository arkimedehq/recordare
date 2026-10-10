// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * `search_knowledge` (WORK_PLAN 8.9, D49): passages of the sources the agent learned, ranked by fused relevance (weighted
 * RRF of vector and full-text ranks, as episodes), each with its source (title, author, who gave it, when) and the
 * episodes that refer to that source — what I learned, from whom, and when I used it. Passages are knowledge, not
 * memories of what happened; the memory context may take one (see context.service).
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EMBEDDING_PORT, type EmbeddingPort } from '../embedding/embedding.port';
import { toOrTsQuery } from '../rawlog/rawlog-search.service';
import { describe, type Precision } from '../engine/time';
import { logRecall } from '../recall/recall-log';
import { type MemoryMode } from '../identity/identity.entities';

const RRF_K = 60;
const CANDIDATES = 50;
const MIN_VECTOR_SIMILARITY = 0.35;
const EPISODES_PER_SOURCE = 5;

export interface KnowledgePassage {
  text: string;
  heading: string | null;
  /** Vector similarity to the query (null when found by words only). */
  similarity: number | null;
  source: {
    id: string; title: string; kind: string; author: string | null; uri: string | null;
    providedBy: { kind: 'self' } | { kind: 'someone' } | { kind: 'contact'; name: string };
    learnedAt: string;
  };
}

export interface KnowledgeResult {
  memory: { name: string; mode: MemoryMode };
  passages: KnowledgePassage[];
  /** The episodes that refer to the sources returned: when I learned them, what I did with them. */
  episodes: Array<{ id: string; sourceId: string; content: string; when: string }>;
  notes: string[];
}

@Injectable()
export class KnowledgeSearchService {
  private readonly log = new Logger(KnowledgeSearchService.name);

  constructor(private readonly db: DataSource, @Inject(EMBEDDING_PORT) private readonly embeddings: EmbeddingPort) {}

  async search(memoryId: string, args: { query: string; limit?: number; conversationId?: string }, now: Date): Promise<KnowledgeResult> {
    const [memory]: Array<{ display_name: string; mode: MemoryMode; locale: string; timezone: string }> = await this.db.query(
      `SELECT p.display_name, o.mode, o.locale, o.timezone FROM memories o JOIN persons p ON p.id = o.person_id WHERE o.person_id = $1`, [memoryId]);
    const ranked = await this.rank(memoryId, args.query);
    const top = [...ranked.scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, args.limit ?? 5).map(([id]) => id);
    const rows: Array<{ id: string; heading: string | null; content: string; source_id: string; title: string; kind: string; author: string | null;
      origin_uri: string | null; provided_by_kind: string; provider: string | null; learned_at: Date }> = top.length ? await this.db.query(
      `SELECT x.id, x.heading, x.content, s.id AS source_id, s.title, s.kind, s.author, s.origin_uri, s.provided_by_kind,
         p.display_name AS provider, s.learned_at
       FROM source_passages x JOIN sources s ON s.id = x.source_id LEFT JOIN persons p ON p.id = s.provided_by_person_id
       WHERE x.id = ANY($1) AND x.memory_id = $2`, [top, memoryId]) : [];
    const byId = new Map(rows.map((r) => [r.id, r]));
    const passages: KnowledgePassage[] = top.flatMap((id) => {
      const r = byId.get(id);
      if (!r) return [];
      return [{
        text: r.content, heading: r.heading, similarity: ranked.similarity.get(id) ?? null,
        source: {
          id: r.source_id, title: r.title, kind: r.kind, author: r.author, uri: r.origin_uri, learnedAt: r.learned_at.toISOString(),
          providedBy: r.provided_by_kind === 'contact' && r.provider ? { kind: 'contact' as const, name: r.provider }
            : { kind: r.provided_by_kind === 'self' ? 'self' as const : 'someone' as const },
        },
      }];
    });
    const sourceIds = [...new Set(passages.map((p) => p.source.id))];
    const episodes: Array<{ id: string; source_id: string; content: string; occurred_at: Date | null; date_precision: Precision }> = sourceIds.length
      ? await this.db.query(
        `SELECT id, source_id, content, occurred_at, date_precision FROM (
           SELECT e.id, es.source_id, e.content, e.occurred_at, e.date_precision,
             row_number() OVER (PARTITION BY es.source_id ORDER BY e.occurred_at DESC NULLS LAST) AS n
           FROM episode_sources es JOIN episodes e ON e.id = es.episode_id
           WHERE es.source_id = ANY($1) AND e.memory_id = $2 AND e.deleted_at IS NULL AND e.invalidated_at IS NULL) r
         WHERE n <= $3 ORDER BY occurred_at`, [sourceIds, memoryId, EPISODES_PER_SOURCE])
      : [];
    const it = memory?.locale === 'it';
    const notes = passages.length
      ? [it ? 'i brani sono ciò che ho imparato dalle fonti (il loro testo), non ricordi di ciò che è successo; la fonte dice da chi e quando'
        : 'passages are what I learned from sources (their text), not memories of what happened; the source says from whom and when']
      : [];
    await logRecall(this.db, memoryId, 'search_knowledge', null, passages.length, args.conversationId, now);
    return {
      memory: { name: memory?.display_name ?? '', mode: memory?.mode ?? 'personal' },
      passages,
      episodes: episodes.map((e) => ({ id: e.id, sourceId: e.source_id, content: e.content,
        when: describe(e.occurred_at, e.date_precision, memory?.timezone ?? 'UTC', memory?.locale ?? 'en') })),
      notes,
    };
  }

  /** The passages nearest a text, for the memory context: id, text, source title and similarity (vector leg only). */
  async nearest(memoryId: string, vector: number[], limit: number): Promise<Array<{ text: string; title: string; similarity: number }>> {
    return this.db.query(
      `SELECT x.content AS text, s.title, 1 - (x.embedding <=> $2::vector) AS similarity
       FROM source_passages x JOIN sources s ON s.id = x.source_id
       WHERE x.memory_id = $1 AND x.embedding IS NOT NULL ORDER BY x.embedding <=> $2::vector LIMIT $3`, [memoryId, `[${vector.join(',')}]`, limit]);
  }

  private async rank(memoryId: string, query: string): Promise<{ scores: Map<string, number>; similarity: Map<string, number> }> {
    const scores = new Map<string, number>();
    const similarity = new Map<string, number>();
    const tsq = toOrTsQuery(query);
    if (tsq) {
      const text: Array<{ id: string }> = await this.db.query(
        `SELECT id FROM source_passages WHERE memory_id = $1 AND tsv @@ to_tsquery('simple', $2)
         ORDER BY ts_rank_cd(tsv, to_tsquery('simple', $2)) DESC LIMIT $3`, [memoryId, tsq, CANDIDATES]);
      text.forEach((r, i) => scores.set(r.id, (scores.get(r.id) ?? 0) + 0.5 / (RRF_K + i + 1)));
    }
    try {
      const [q] = await this.embeddings.embed([query], 'query');
      if (q) {
        const vec: Array<{ id: string; sim: number }> = await this.db.query(
          `SELECT id, 1 - (embedding <=> $2::vector) AS sim FROM source_passages
           WHERE memory_id = $1 AND embedding IS NOT NULL ORDER BY embedding <=> $2::vector LIMIT $3`, [memoryId, `[${q.join(',')}]`, CANDIDATES]);
        vec.forEach((r) => similarity.set(r.id, r.sim));
        vec.filter((r) => r.sim >= MIN_VECTOR_SIMILARITY).forEach((r, i) => scores.set(r.id, (scores.get(r.id) ?? 0) + 1 / (RRF_K + i + 1)));
      }
    } catch (err) {
      this.log.warn(`knowledge vector leg skipped: ${(err as Error).message}`);
    }
    return { scores, similarity };
  }
}
