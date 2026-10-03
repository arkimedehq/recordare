// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * `search_episodes` (D12, D13, D14, D29). Episodes are filtered by event-time overlap with the
 * requested period; ranking = relevance (vector + full-text, fused) + importance + recency, with
 * in-range items only when a period is given; `list` is chronological, `latest` most recent first.
 * Plan statuses are always explicit — a past plan never confirmed is shown as unresolved.
 * The raw log is the fallback when episodes are few or weak.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EMBEDDING_PORT, type EmbeddingPort } from '../embedding/embedding.port';
import { describe, periodEnd, zonedMidnight, addDays, type Precision } from '../engine/time';
import { RawLogSearchService, toOrTsQuery, type RawHit } from '../rawlog/rawlog-search.service';

export interface EpisodeSearchArgs {
  query?: string;
  from?: string;
  to?: string;
  mode?: 'search' | 'list' | 'latest';
  includePlans?: boolean;
  limit?: number;
}

export interface EpisodeView {
  id: string;
  kind: 'event' | 'plan' | 'state_change';
  content: string;
  when: string;
  planStatus?: 'open' | 'confirmed' | 'cancelled' | 'rescheduled' | 'unresolved';
  rescheduledTo?: string;
  origin: 'owner_lived' | 'owner_told' | 'assistant_stated';
  authorRole: 'owner' | 'assistant' | 'other' | 'tool';
  inferred: boolean;
  people: string[];
  feelings: string[];
  opinion?: string;
  source: { conversation: string; messageIds: string[]; at: string };
}

export interface EpisodeSearchResult {
  period?: { from: string | null; to: string | null };
  digests: Array<{ day: string; text: string }>;
  episodes: EpisodeView[];
  outsidePeriod: EpisodeView[];
  fromChats: Array<Omit<RawHit, 'score'>>;
  notes: string[];
}

interface Row {
  id: string; kind: EpisodeView['kind']; content: string; occurred_at: Date | null; occurred_until: Date | null;
  date_precision: Precision; plan_status: EpisodeView['planStatus'] | null; rescheduled_to: string | null; origin: EpisodeView['origin'];
  author_role: EpisodeView['authorRole']; stance: 'stated' | 'inferred'; importance: number; feelings: string[]; opinion: string | null;
  recorded_at: Date;
}

const RRF_K = 60;
const CANDIDATES = 60;
const MIN_VECTOR_SIMILARITY = 0.35;
const FALLBACK_BELOW = 3;

@Injectable()
export class EpisodeSearchService {
  private readonly log = new Logger(EpisodeSearchService.name);

  constructor(
    private readonly db: DataSource,
    @Inject(EMBEDDING_PORT) private readonly embeddings: EmbeddingPort,
    private readonly rawLog: RawLogSearchService,
  ) {}

  async search(ownerId: string, clientId: string | null, args: EpisodeSearchArgs, now: Date): Promise<EpisodeSearchResult> {
    const [owner] = await this.db.query(`SELECT locale, timezone FROM owners WHERE person_id = $1`, [ownerId]);
    const tz: string = owner.timezone;
    const locale: string = owner.locale;
    const mode = args.mode ?? 'search';
    // YYYY-MM means the whole month (from its first day / to its last day).
    const from = args.from ? zonedMidnight(args.from.length === 7 ? `${args.from}-01` : args.from.slice(0, 10), tz) : null;
    const to = args.to ? zonedMidnight(args.to.length === 7 ? firstOfNextMonth(args.to) : addDays(args.to.slice(0, 10), 1), tz) : null; // exclusive
    const hasPeriod = !!(from || to);

    const rows: Row[] = await this.db.query(
      `SELECT id, kind, content, occurred_at, occurred_until, date_precision, plan_status, rescheduled_to, origin, author_role, stance,
              importance, feelings, opinion, recorded_at
       FROM episodes
       WHERE owner_id = $1 AND deleted_at IS NULL AND invalidated_at IS NULL AND duplicate_of IS NULL
         AND ($2::boolean OR kind <> 'plan')`,
      [ownerId, args.includePlans ?? true],
    );
    const relevance = args.query ? await this.relevance(ownerId, args.query) : new Map<string, number>();
    const inRange = (r: Row) => {
      if (!hasPeriod) return true;
      if (!r.occurred_at) return false;
      const end = r.occurred_until ? periodEnd(r.occurred_until, 'day', tz) : periodEnd(r.occurred_at, r.date_precision, tz);
      return (!from || end > from) && (!to || r.occurred_at < to);
    };
    const relevant = (r: Row) => !args.query || relevance.has(r.id);
    const score = (r: Row) => {
      const ageDays = Math.max(0, (now.getTime() - (r.occurred_at ?? r.recorded_at).getTime()) / 86_400_000);
      return (relevance.get(r.id) ?? 0) + 0.01 * r.importance + 0.03 * Math.exp(-ageDays / 90);
    };
    const limit = args.limit ?? (mode === 'list' ? 30 : mode === 'latest' ? 5 : 10);
    const candidates = rows.filter(inRange);

    let chosen: Row[];
    if (mode === 'list') {
      const pool = args.query ? candidates.filter(relevant).sort((a, b) => score(b) - score(a)) : [...candidates].sort((a, b) => b.importance - a.importance);
      chosen = pool.slice(0, limit).sort((a, b) => (a.occurred_at?.getTime() ?? 0) - (b.occurred_at?.getTime() ?? 0));
    } else if (mode === 'latest') {
      chosen = candidates.filter(relevant).filter((r) => r.occurred_at && r.occurred_at <= now && r.kind !== 'plan')
        .sort((a, b) => (b.occurred_at?.getTime() ?? 0) - (a.occurred_at?.getTime() ?? 0)).slice(0, limit);
    } else {
      chosen = candidates.filter(relevant).sort((a, b) => score(b) - score(a)).slice(0, limit);
    }
    const outside = chosen.length === 0 && hasPeriod && args.query
      ? rows.filter((r) => !inRange(r) && relevant(r)).sort((a, b) => score(b) - score(a)).slice(0, 5)
      : [];

    const views = await this.views([...chosen, ...outside], tz, locale, now);
    const result: EpisodeSearchResult = {
      ...(hasPeriod ? { period: { from: args.from ?? null, to: args.to ?? null } } : {}),
      digests: [],
      episodes: views.slice(0, chosen.length),
      outsidePeriod: views.slice(chosen.length),
      fromChats: [],
      notes: [],
    };
    if (result.episodes.some((e) => e.planStatus === 'unresolved')) {
      result.notes.push(locale === 'it'
        ? 'alcuni piani hanno la data passata senza conferma: non è noto se siano avvenuti'
        : 'some plans are past their date without confirmation: whether they happened is unknown');
    }
    const best = Math.max(0, ...chosen.map((r) => relevance.get(r.id) ?? 0));
    if (args.query && (chosen.length < FALLBACK_BELOW || best < 0.02)) {
      const hits = await this.rawLog.search(ownerId, clientId, {
        query: args.query, from: from ?? undefined, to: to ?? undefined, limit: 3,
      });
      result.fromChats = hits.map(({ score: _s, ...h }) => h);
    }
    if (chosen.length) {
      await this.db.query(`UPDATE episodes SET access_count = access_count + 1, last_accessed_at = now() WHERE id = ANY($1)`, [chosen.map((r) => r.id)]);
    }
    return result;
  }

  /** Fused relevance (weighted RRF of vector and full-text ranks); only matching episodes get a score. */
  private async relevance(ownerId: string, query: string): Promise<Map<string, number>> {
    const scores = new Map<string, number>();
    const tsq = toOrTsQuery(query);
    if (tsq) {
      const text: Array<{ id: string }> = await this.db.query(
        `SELECT id FROM episodes WHERE owner_id = $1 AND deleted_at IS NULL
           AND to_tsvector('simple', content || ' ' || array_to_string(keywords, ' ')) @@ to_tsquery('simple', $2)
         ORDER BY ts_rank_cd(to_tsvector('simple', content || ' ' || array_to_string(keywords, ' ')), to_tsquery('simple', $2)) DESC
         LIMIT $3`, [ownerId, tsq, CANDIDATES]);
      text.forEach((r, i) => scores.set(r.id, (scores.get(r.id) ?? 0) + 0.5 / (RRF_K + i + 1)));
    }
    try {
      const [q] = await this.embeddings.embed([query], 'query');
      if (q) {
        const vec: Array<{ id: string; sim: number }> = await this.db.query(
          `SELECT id, 1 - (embedding <=> $2::vector) AS sim FROM episodes
           WHERE owner_id = $1 AND deleted_at IS NULL AND embedding IS NOT NULL
           ORDER BY embedding <=> $2::vector LIMIT $3`, [ownerId, `[${q.join(',')}]`, CANDIDATES]);
        vec.filter((r) => r.sim >= MIN_VECTOR_SIMILARITY)
          .forEach((r, i) => scores.set(r.id, (scores.get(r.id) ?? 0) + 1 / (RRF_K + i + 1)));
      }
    } catch (err) {
      this.log.warn(`episode vector leg skipped: ${(err as Error).message}`);
    }
    return scores;
  }

  private async views(rows: Row[], tz: string, locale: string, now: Date): Promise<EpisodeView[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const people: Array<{ episode_id: string; alias: string }> = await this.db.query(`SELECT episode_id, alias FROM episode_people WHERE episode_id = ANY($1)`, [ids]);
    const evidence: Array<{ episode_id: string; message_id: string; external_id: string; sent_at: Date }> = await this.db.query(
      `SELECT ev.episode_id, ev.message_id, c.external_id, m.sent_at FROM episode_evidence ev
       JOIN messages m ON m.id = ev.message_id JOIN conversations c ON c.id = m.conversation_id WHERE ev.episode_id = ANY($1)`, [ids]);
    const rescheduled = rows.filter((r) => r.rescheduled_to).map((r) => r.rescheduled_to as string);
    const targets: Array<{ id: string; occurred_at: Date | null; date_precision: Precision }> = rescheduled.length
      ? await this.db.query(`SELECT id, occurred_at, date_precision FROM episodes WHERE id = ANY($1)`, [rescheduled]) : [];
    return rows.map((r) => {
      const ev = evidence.filter((e) => e.episode_id === r.id);
      let planStatus = r.plan_status ?? undefined;
      if (planStatus === 'open' && r.occurred_at) {
        const end = r.occurred_until ? periodEnd(r.occurred_until, 'day', tz) : periodEnd(r.occurred_at, r.date_precision, tz);
        if (end <= now) planStatus = 'unresolved';
      }
      const target = targets.find((t) => t.id === r.rescheduled_to);
      return {
        id: r.id, kind: r.kind, content: r.content,
        when: describe(r.occurred_at, r.date_precision, tz, locale) + (r.occurred_until ? ` → ${describe(r.occurred_until, 'day', tz, locale)}` : ''),
        ...(planStatus ? { planStatus } : {}),
        ...(target ? { rescheduledTo: describe(target.occurred_at, target.date_precision, tz, locale) } : {}),
        origin: r.origin, authorRole: r.author_role, inferred: r.stance === 'inferred',
        people: people.filter((p) => p.episode_id === r.id).map((p) => p.alias),
        feelings: r.feelings, ...(r.opinion ? { opinion: r.opinion } : {}),
        source: { conversation: ev[0]?.external_id ?? '', messageIds: ev.map((e) => e.message_id), at: ev[0]?.sent_at.toISOString() ?? '' },
      } satisfies EpisodeView;
    });
  }
}

function firstOfNextMonth(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number) as [number, number];
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}
