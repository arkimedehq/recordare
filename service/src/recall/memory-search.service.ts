// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * `search_memory` (D34 + D29): semantic notes plus state facts, facts as of a date with their
 * value chain (initial → revisions → current). `unknown_current` is reported as "not known";
 * pending (inferred) items only on request.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EMBEDDING_PORT, type EmbeddingPort } from '../embedding/embedding.port';
import { addDays, localDate, zonedMidnight } from '../engine/time';
import { toOrTsQuery } from '../rawlog/rawlog-search.service';
import { TelemetryService } from '../telemetry/telemetry.service';
import { logRecall } from './recall-log';

export interface MemorySearchArgs {
  query: string;
  asOf?: string;
  includePending?: boolean;
  limit?: number;
}

export interface FactView {
  key: string;
  value: string | null;
  status: string;
  validFrom: string | null;
  validTo: string | null;
  history: Array<{ value: string | null; from: string | null; to: string | null; status: string }>;
}

export interface MemorySearchResult {
  /** Whose memory this is (items name the owner in the third person). */
  owner: { name: string };
  notes: Array<{ id: string; category: string; content: string; pinned: boolean; pending: boolean; authorRole: string }>;
  facts: FactView[];
  notes_info: string[];
}

const MIN_VECTOR_SIMILARITY = 0.35;

@Injectable()
export class MemorySearchService {
  private readonly log = new Logger(MemorySearchService.name);

  constructor(
    private readonly db: DataSource,
    @Inject(EMBEDDING_PORT) private readonly embeddings: EmbeddingPort,
    private readonly telemetry: TelemetryService,
  ) {}

  async search(ownerId: string, args: MemorySearchArgs, now: Date): Promise<MemorySearchResult> {
    return this.telemetry.track('recall', ownerId, () => this.searchNow(ownerId, args, now));
  }

  private async searchNow(ownerId: string, args: MemorySearchArgs, now: Date): Promise<MemorySearchResult> {
    const [owner] = await this.db.query(
      `SELECT o.timezone, o.locale, p.display_name FROM owners o JOIN persons p ON p.id = o.person_id WHERE o.person_id = $1`, [ownerId]);
    const tz: string = owner.timezone;
    const asOfDay = args.asOf ? (args.asOf.length === 7 ? `${args.asOf}-01` : args.asOf.slice(0, 10)) : null;
    const asOf = asOfDay ? zonedMidnight(addDays(asOfDay, 1), tz) : now; // end of that day
    const limit = args.limit ?? 8;
    let vec: number[] | undefined;
    try {
      [vec] = await this.embeddings.embed([args.query], 'query');
    } catch (err) {
      this.log.warn(`memory vector leg skipped: ${(err as Error).message}`);
    }
    const tsq = toOrTsQuery(args.query);

    const noteRows: Array<{ id: string; category: string; content: string; pinned: boolean; pending: boolean; author_role: string; sim: number | null; fts: boolean }> =
      await this.db.query(
        `SELECT id, category, content, pinned, pending, author_role,
                CASE WHEN $2::text IS NULL OR embedding IS NULL THEN NULL ELSE 1 - (embedding <=> $2::vector) END AS sim,
                ($3::text <> '' AND to_tsvector('simple', content || ' ' || array_to_string(keywords, ' ')) @@ to_tsquery('simple', NULLIF($3, ''))) AS fts
         FROM notes WHERE owner_id = $1 AND status = 'current' AND deleted_at IS NULL AND ($4::boolean OR NOT pending)`,
        [ownerId, vec ? `[${vec.join(',')}]` : null, tsq, args.includePending ?? false]);
    const notes = noteRows.filter((n) => n.pinned || n.fts || (n.sim ?? 0) >= MIN_VECTOR_SIMILARITY)
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.sim ?? 0) + (b.fts ? 0.1 : 0) - ((a.sim ?? 0) + (a.fts ? 0.1 : 0)))
      .slice(0, limit)
      .map((n) => ({ id: n.id, category: n.category, content: n.content, pinned: n.pinned, pending: n.pending, authorRole: n.author_role }));

    // Facts: rank slots by relevance, then report the value valid at `asOf` plus the chain.
    const factRows: Array<{ id: string; key: string; value: string | null; status: string; valid_from: Date | null; valid_to: Date | null;
      pending: boolean; sim: number | null; fts: boolean }> = await this.db.query(
      `SELECT id, key, value, status, valid_from, valid_to, pending,
              CASE WHEN $2::text IS NULL OR embedding IS NULL THEN NULL ELSE 1 - (embedding <=> $2::vector) END AS sim,
              ($3::text <> '' AND to_tsvector('simple', key || ' ' || COALESCE(value, '')) @@ to_tsquery('simple', NULLIF($3, ''))) AS fts
       FROM facts WHERE owner_id = $1 AND subject_person_id IS NULL AND deleted_at IS NULL AND status <> 'corrected'
         AND ($4::boolean OR NOT pending)
       ORDER BY key, valid_from NULLS FIRST, recorded_at`,
      [ownerId, vec ? `[${vec.join(',')}]` : null, tsq, args.includePending ?? false]);
    const byKey = new Map<string, typeof factRows>();
    for (const f of factRows) byKey.set(f.key, [...(byKey.get(f.key) ?? []), f]);
    const keyScore = (rows: typeof factRows) => Math.max(...rows.map((r) => (r.sim ?? 0) + (r.fts ? 0.1 : 0)));
    const day = (d: Date | null) => (d ? localDate(d, tz) : null);
    const facts: FactView[] = [...byKey.entries()]
      .filter(([, rows]) => keyScore(rows) >= MIN_VECTOR_SIMILARITY || rows.some((r) => r.fts))
      .sort((a, b) => keyScore(b[1]) - keyScore(a[1]))
      .slice(0, limit)
      .flatMap(([key, rows]) => {
        const valid = rows.filter((r) => (!r.valid_from || r.valid_from < asOf) && (!r.valid_to || r.valid_to >= asOf));
        const at = valid.at(-1) ?? rows.filter((r) => !r.valid_from || r.valid_from < asOf).at(-1);
        if (!at) return [];
        return [{
          key, value: at.value, status: at.status === 'unknown_current' ? 'unknown' : at.status,
          validFrom: day(at.valid_from), validTo: day(at.valid_to),
          history: rows.map((r) => ({ value: r.value, from: day(r.valid_from), to: day(r.valid_to), status: r.status })),
        }];
      });
    const info: string[] = [];
    if (facts.some((f) => f.status === 'unknown')) {
      info.push(owner.locale === 'it' ? 'per alcuni fatti il valore attuale non è noto' : 'the current value of some facts is not known');
    }
    this.telemetry.emit({ type: 'recall.served', ownerId, tool: 'search_memory', episodeIds: [], claimIds: [], chats: 0, digests: 0,
      facts: facts.length, notes: notes.length });
    await logRecall(this.db, ownerId, 'search_memory', null, facts.length + notes.length);
    return { owner: { name: owner.display_name }, notes, facts, notes_info: info };
  }
}
