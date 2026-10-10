// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * `search_episodes` (D12, D13, D14, D29). Episodes are filtered by event-time overlap with the
 * requested period; ranking = relevance (vector + full-text, fused) + importance + recency, with
 * in-range items only when a period is given; `list` is chronological, `latest` most recent first.
 * Plan statuses are always explicit — a past plan never confirmed is shown as unresolved.
 * Relevant episodes first, free places filled; a few raw-log hits always come along (more when episodes are few or weak).
 * Every item carries its subject (D50, 8.4); an identified speaker asking gets their own items first (both modes since
 * 8.5), and open clarifications about the people involved come along — in an entity memory only for an identified
 * speaker (someone unidentified cannot confirm who is who).
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EMBEDDING_PORT, type EmbeddingPort } from '../embedding/embedding.port';
import { describe, periodEnd, zonedMidnight, addDays, type Precision } from '../engine/time';
import { RawLogSearchService, toOrTsQuery, type RawHit } from '../rawlog/rawlog-search.service';
import { ConfigService } from '@nestjs/config';
import { type Env } from '../config/env';
import { qualityProfile, type QualityProfileName } from '../engine/quality-profile';
import { TelemetryService } from '../telemetry/telemetry.service';
import { logRecall } from './recall-log';
import { peopleInQuestion } from './people';
import { contactNames, speakerOf, subjectView, type Speaker, type SubjectRow, type SubjectView } from './subjects';
import { relevantClarifications } from '../engine/clarifications';
import { type MemoryMode, type SubjectKind } from '../identity/identity.entities';

export interface EpisodeSearchArgs {
  /** The conversation the recall is served in (recall log: lets the extractor recognise answers from memory). */
  conversationId?: string;
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
  /** Whose memory it is: the self (first person), a contact, someone, or undecided between candidates (D50). */
  subject: SubjectView;
  /** Who wrote the evidence when it is someone else's claim (authorRole other / tool): names, never the self. */
  claimedBy?: string[];
  inferred: boolean;
  people: string[];
  feelings: string[];
  opinion?: string;
  source: { conversation: string; messageIds: string[]; at: string };
  /** The learned sources it refers to (WORK_PLAN 8.9): their title, or a marker when the source was forgotten. */
  sources?: Array<{ id: string; title: string } | { forgotten: true }>;
}

/** Whose memory this is: personal — written in the first person, "I" is `name`; entity — the shared memory `name`. */
export interface MemoryView { name: string; mode: MemoryMode }

export interface EpisodeSearchResult {
  memory: MemoryView;
  /** Who is asking: the self (personal), someone not identified (entity), or an identified contact ("I" in the question). */
  speaker: { kind: 'self' } | { kind: 'someone' } | { kind: 'contact'; name: string };
  period?: { from: string | null; to: string | null };
  /** The diary of the period (M5), for `list` requests: day entries for spans up to ~6 weeks, months for longer. */
  digests: Array<{ level: 'day' | 'month'; from: string; to: string; text: string }>;
  /** What the memory holds as lived, done, planned or learned (each with its subject). */
  episodes: EpisodeView[];
  /** Other people's statements kept apart so an answer never mixes them with the memory's own: what someone in the
   * conversation (not the account's speaker) said about another person — about the self, or a third person; a person's
   * news about themself is an episode of theirs, what a tool taught is the memory's learning. */
  claims: EpisodeView[];
  /** Open questions about people involved ("Marco chi — il collega o il cugino?"), to ask if natural. */
  clarifications?: string[];
  outsidePeriod: EpisodeView[];
  fromChats: Array<Omit<RawHit, 'score'>>;
  notes: string[];
}

interface Row {
  id: string; kind: EpisodeView['kind']; content: string; occurred_at: Date | null; occurred_until: Date | null;
  date_precision: Precision; plan_status: EpisodeView['planStatus'] | null; rescheduled_to: string | null; origin: EpisodeView['origin'];
  author_role: EpisodeView['authorRole']; stance: 'stated' | 'inferred'; importance: number; feelings: string[]; opinion: string | null;
  recorded_at: Date; subject_kind: SubjectKind; subject_person_id: string | null; subject_candidates: string[] | null;
}

const RRF_K = 60;
const CANDIDATES = 60;
const MIN_VECTOR_SIMILARITY = 0.35;
const FALLBACK_BELOW = 3;
const RAW_HITS = 3;
/** Extra chat excerpts written by the people a question names (by name or relation). */
const PEOPLE_HITS = 3;
/** Periods up to this many days get the day diary; longer ones the month summaries. */
const DIGEST_DAY_SPAN = 45;
/** Ranking bonus of an identified speaker's own items (and, half of it, of items they took part in). */
const SPEAKER_BONUS = 0.02;
const MAX_CLARIFICATIONS = 2;

@Injectable()
export class EpisodeSearchService {
  private readonly log = new Logger(EpisodeSearchService.name);
  private readonly defaultProfile: QualityProfileName;
  private readonly recallDigests: boolean | undefined;

  constructor(
    private readonly db: DataSource,
    @Inject(EMBEDDING_PORT) private readonly embeddings: EmbeddingPort,
    private readonly rawLog: RawLogSearchService,
    config: ConfigService<Env, true>,
    private readonly telemetry: TelemetryService,
  ) {
    this.defaultProfile = config.get('QUALITY_PROFILE', { infer: true });
    this.recallDigests = config.get('RECALL_DIGESTS', { infer: true });
  }

  async search(ownerId: string, clientId: string | null, args: EpisodeSearchArgs, now: Date): Promise<EpisodeSearchResult> {
    return this.telemetry.track('recall', ownerId, () => this.searchNow(ownerId, clientId, args, now));
  }

  private async searchNow(ownerId: string, clientId: string | null, args: EpisodeSearchArgs, now: Date): Promise<EpisodeSearchResult> {
    const [owner] = await this.db.query(
      `SELECT o.locale, o.timezone, o.quality_profile, o.mode, p.display_name FROM owners o JOIN persons p ON p.id = o.person_id WHERE o.person_id = $1`, [ownerId]);
    const speaker: Speaker = await speakerOf(this.db, args.conversationId, now, owner.mode);
    const theirs = speaker.kind === 'contact' ? new Set<string>((await this.db.query(
      `SELECT DISTINCT ep.episode_id FROM episode_people ep JOIN episodes e ON e.id = ep.episode_id WHERE e.owner_id = $1 AND ep.person_id = $2`,
      [ownerId, speaker.id])).map((r: { episode_id: string }) => r.episode_id)) : new Set<string>();
    const profile = qualityProfile(owner.quality_profile, this.defaultProfile, undefined, undefined, this.recallDigests);
    const tz: string = owner.timezone;
    const locale: string = owner.locale;
    const mode = args.mode ?? 'search';
    // YYYY-MM means the whole month (from its first day / to its last day).
    const from = args.from ? zonedMidnight(args.from.length === 7 ? `${args.from}-01` : args.from.slice(0, 10), tz) : null;
    const to = args.to ? zonedMidnight(args.to.length === 7 ? firstOfNextMonth(args.to) : addDays(args.to.slice(0, 10), 1), tz) : null; // exclusive
    const hasPeriod = !!(from || to);

    const rows: Row[] = await this.db.query(
      `SELECT id, kind, content, occurred_at, occurred_until, date_precision, plan_status, rescheduled_to, origin, author_role, stance,
              importance, feelings, opinion, recorded_at, subject_kind, subject_person_id, subject_candidates
       FROM episodes
       WHERE owner_id = $1 AND deleted_at IS NULL AND invalidated_at IS NULL AND duplicate_of IS NULL
         AND ($2::boolean OR kind <> 'plan')`,
      [ownerId, args.includePlans ?? true],
    );
    const { scores: relevance, similarity } = args.query
      ? await this.relevance(ownerId, args.query) : { scores: new Map<string, number>(), similarity: new Map<string, number>() };
    const inRange = (r: Row) => {
      if (!hasPeriod) return true;
      if (!r.occurred_at) return false;
      const end = r.occurred_until ? periodEnd(r.occurred_until, 'day', tz) : periodEnd(r.occurred_at, r.date_precision, tz);
      return (!from || end > from) && (!to || r.occurred_at < to);
    };
    const relevant = (r: Row) => !args.query || relevance.has(r.id);
    const score = (r: Row) => {
      const ageDays = Math.max(0, (now.getTime() - (r.occurred_at ?? r.recorded_at).getTime()) / 86_400_000);
      // An identified speaker asking about themself: their own items first, then those they took part in.
      const own = speaker.kind === 'contact' ? (r.subject_person_id === speaker.id ? SPEAKER_BONUS : theirs.has(r.id) ? SPEAKER_BONUS / 2 : 0) : 0;
      return (relevance.get(r.id) ?? 0) + 0.01 * r.importance + 0.03 * Math.exp(-ageDays / 90) + own;
    };
    const limit = args.limit ?? (mode === 'list' ? 30 : mode === 'latest' ? 5 : 10);
    const candidates = rows.filter(inRange);

    // Relevant items first; free places are filled (M4b blind set 4: an over-strict relevance gate left the answer
    // model with half the episodes D gave it). Search fills by raw similarity; a period list by importance.
    const ranked = candidates.filter(relevant).sort((a, b) => score(b) - score(a));
    const rest = (by: (r: Row) => number) => candidates.filter((r) => !relevant(r)).sort((a, b) => by(b) - by(a));
    let chosen: Row[];
    if (mode === 'list') {
      const pool = !args.query ? rest((r) => r.importance) : hasPeriod ? [...ranked, ...rest((r) => r.importance)] : ranked;
      chosen = pool.slice(0, limit).sort((a, b) => (a.occurred_at?.getTime() ?? 0) - (b.occurred_at?.getTime() ?? 0));
    } else if (mode === 'latest') {
      chosen = candidates.filter(relevant).filter((r) => r.occurred_at && r.occurred_at <= now && r.kind !== 'plan')
        .sort((a, b) => (b.occurred_at?.getTime() ?? 0) - (a.occurred_at?.getTime() ?? 0)).slice(0, limit);
    } else {
      chosen = [...ranked, ...rest((r) => similarity.get(r.id) ?? -1).filter((r) => similarity.has(r.id))].slice(0, limit);
    }
    if (speaker.kind === 'contact' && mode !== 'list') {
      // An identified speaker: their own items first, then those they took part in, then the rest (each in rank order).
      const rank = (r: Row) => (r.subject_person_id === speaker.id ? 0 : theirs.has(r.id) ? 1 : 2);
      chosen = chosen.map((r, i) => ({ r, i })).sort((a, b) => rank(a.r) - rank(b.r) || a.i - b.i).map((x) => x.r);
    }
    const outside = chosen.length === 0 && hasPeriod && args.query
      ? rows.filter((r) => !inRange(r) && relevant(r)).sort((a, b) => score(b) - score(a)).slice(0, 5)
      : [];

    const views = await this.views([...chosen, ...outside], tz, locale, now);
    const it = locale === 'it';
    const name: string = owner.display_name;
    const result: EpisodeSearchResult = {
      memory: { name, mode: owner.mode },
      speaker: speaker.kind === 'contact' ? { kind: 'contact', name: speaker.name } : speaker,
      ...(hasPeriod ? { period: { from: args.from ?? null, to: args.to ?? null } } : {}),
      // The diary serves overviews of a period (mode list); point questions get the episodes themselves.
      digests: hasPeriod && mode === 'list' && profile.recallDigests ? await this.digests(ownerId, from, to) : [],
      episodes: views.slice(0, chosen.length).filter((v) => !isClaim(v)),
      claims: views.slice(0, chosen.length).filter(isClaim),
      outsidePeriod: views.slice(chosen.length),
      fromChats: [],
      notes: [],
    };
    if (result.episodes.some((e) => e.planStatus === 'unresolved')) {
      result.notes.push(locale === 'it'
        ? 'alcuni piani hanno la data passata senza conferma: non è noto se siano avvenuti'
        : 'some plans are past their date without confirmation: whether they happened is unknown');
    }
    if (speaker.kind === 'contact') {
      result.notes.push(it
        ? `chi chiede è ${speaker.name}, una persona che conosco: "io" nella domanda è ${speaker.name}; i ricordi in prima persona sono miei (${name}), non di ${speaker.name}`
        : `the person asking is ${speaker.name}, someone I know: "I" in the question is ${speaker.name}; first-person memories are mine (${name}), not ${speaker.name}'s`);
    } else if (speaker.kind === 'someone') {
      result.notes.push(it
        ? `chi chiede non si è identificato: "io" nella domanda è chi parla, non io (${name}); i ricordi in prima persona sono miei`
        : `the person asking has not said who they are: "I" in the question is the speaker, not me (${name}); first-person memories are mine`);
    }
    if (result.claims.length) {
      result.notes.push(it
        ? `"claims" sono affermazioni di chi è in claimedBy, non confermate: ciò che dicono di me (${name}) non è un mio ricordo né qualcosa che ho detto`
        : `"claims" are statements of the people in claimedBy, unconfirmed: what they say about me (${name}) is not my memory nor something I said`);
    }
    // The chat log answers what episodes never hold (help requests, how-tos: "when did I ask you…") and keeps the
    // owner's own words next to the summaries, so a few raw hits always come along — also when they are behind a
    // returned episode (the episode drops "I asked you"); more when episodes are few or weak.
    if (args.query) {
      const best = Math.max(0, ...chosen.map((r) => relevance.get(r.id) ?? 0));
      const limit = chosen.length < FALLBACK_BELOW || best < 0.02 ? Math.max(RAW_HITS, profile.rawHitsAlongside) : profile.rawHitsAlongside;
      const hits = await this.rawLog.search(ownerId, clientId, { query: args.query, from: from ?? undefined, to: to ?? undefined, limit,
        conversationId: args.conversationId });
      // A question about someone ("what did my mother ask you?") also gets what that person wrote in the owner's chats:
      // their words rarely contain the relation or the question's terms.
      const people = await peopleInQuestion(this.db, ownerId, args.query);
      const theirs = people.length ? await this.rawLog.search(ownerId, clientId, { query: args.query, from: from ?? undefined,
        to: to ?? undefined, limit: PEOPLE_HITS, conversationId: args.conversationId, authors: people }) : [];
      const seen = new Set(hits.map((h) => h.messageId));
      result.fromChats = [...hits, ...theirs.filter((h) => !seen.has(h.messageId))].map(({ score: _s, ...h }) => h);
      if (result.fromChats.some((h) => h.authorRole !== 'owner')) {
        result.notes.push(it
          ? `gli estratti scritti da altri (author) sono parole loro: ciò che dicono di me (${name}) non è confermato`
          : `excerpts written by others (author) are their words: what they say about me (${name}) is unconfirmed`);
      }
    }
    if (owner.mode === 'personal' || speaker.kind === 'contact') {
      const asks = await relevantClarifications(this.db, ownerId, args.query ?? '', views.map((v) => v.id), now, MAX_CLARIFICATIONS);
      if (asks.length) result.clarifications = asks.map((c) => c.question);
    }
    this.telemetry.emit({ type: 'recall.served', ownerId, tool: 'search_episodes', mode,
      episodeIds: result.episodes.map((e) => e.id), claimIds: result.claims.map((e) => e.id), chats: result.fromChats.length, digests: result.digests.length });
    await logRecall(this.db, ownerId, 'search_episodes', mode,
      result.episodes.length + result.claims.length + result.fromChats.length + result.digests.length, args.conversationId, now);
    if (chosen.length) {
      await this.db.query(`UPDATE episodes SET access_count = access_count + 1, last_accessed_at = now() WHERE id = ANY($1)`, [chosen.map((r) => r.id)]);
    }
    return result;
  }

  /** Current digests overlapping the period, chronological; day level for short spans, month level for long ones. */
  private async digests(ownerId: string, from: Date | null, to: Date | null): Promise<EpisodeSearchResult['digests']> {
    const spanDays = from && to ? (to.getTime() - from.getTime()) / 86_400_000 : Infinity;
    const level = spanDays <= DIGEST_DAY_SPAN ? 'day' : 'month';
    const rows: Array<{ level: 'day' | 'month'; period_start: string; period_end: string; content: string }> = await this.db.query(
      `SELECT level, period_start::text, period_end::text, content FROM digests
       WHERE owner_id = $1 AND superseded_at IS NULL AND level = $2
         AND ($3::timestamptz IS NULL OR period_end >= ($3::timestamptz AT TIME ZONE (SELECT timezone FROM owners WHERE person_id = $1))::date)
         AND ($4::timestamptz IS NULL OR period_start < ($4::timestamptz AT TIME ZONE (SELECT timezone FROM owners WHERE person_id = $1))::date)
       ORDER BY period_start LIMIT $5`, [ownerId, level, from, to, level === 'day' ? 45 : 24]);
    return rows.map((r) => ({ level: r.level, from: r.period_start, to: r.period_end, text: r.content }));
  }

  /** Fused relevance (weighted RRF of vector and full-text ranks; only matching episodes get a score) and the raw
   * vector similarity of the nearest episodes (to fill free places). */
  private async relevance(ownerId: string, query: string): Promise<{ scores: Map<string, number>; similarity: Map<string, number> }> {
    const scores = new Map<string, number>();
    const similarity = new Map<string, number>();
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
        vec.forEach((r) => similarity.set(r.id, r.sim));
        vec.filter((r) => r.sim >= MIN_VECTOR_SIMILARITY)
          .forEach((r, i) => scores.set(r.id, (scores.get(r.id) ?? 0) + 1 / (RRF_K + i + 1)));
      }
    } catch (err) {
      this.log.warn(`episode vector leg skipped: ${(err as Error).message}`);
    }
    return { scores, similarity };
  }

  private async views(rows: Row[], tz: string, locale: string, now: Date): Promise<EpisodeView[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const people: Array<{ episode_id: string; alias: string }> = await this.db.query(`SELECT episode_id, alias FROM episode_people WHERE episode_id = ANY($1)`, [ids]);
    const evidence: Array<{ episode_id: string; message_id: string; external_id: string; sent_at: Date; role: string; author: string | null }> = await this.db.query(
      `SELECT ev.episode_id, ev.message_id, c.external_id, m.sent_at, m.role,
              CASE WHEN m.role = 'tool' THEN m.tool_name ELSE COALESCE(p.display_name, cp.display_name) END AS author
       FROM episode_evidence ev
       JOIN messages m ON m.id = ev.message_id JOIN conversations c ON c.id = m.conversation_id
       LEFT JOIN persons p ON p.id = m.author_person_id
       LEFT JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.ref = m.author_ref
       WHERE ev.episode_id = ANY($1) ORDER BY m.sent_at`, [ids]);
    const names = await contactNames(this.db, rows as SubjectRow[]);
    const learned: Array<{ episode_id: string; source_id: string | null; title: string | null }> = await this.db.query(
      `SELECT es.episode_id, es.source_id, s.title FROM episode_sources es LEFT JOIN sources s ON s.id = es.source_id
       WHERE es.episode_id = ANY($1) ORDER BY es.id`, [ids]);
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
      const sources = learned.filter((l) => l.episode_id === r.id)
        .map((l) => (l.source_id && l.title ? { id: l.source_id, title: l.title } : { forgotten: true as const }));
      return {
        id: r.id, kind: r.kind, content: r.content,
        when: describe(r.occurred_at, r.date_precision, tz, locale) + (r.occurred_until ? ` → ${describe(r.occurred_until, 'day', tz, locale)}` : ''),
        ...(planStatus ? { planStatus } : {}),
        ...(target ? { rescheduledTo: describe(target.occurred_at, target.date_precision, tz, locale) } : {}),
        origin: r.origin, authorRole: r.author_role, subject: subjectView(r, names),
        ...(r.author_role === 'other' || r.author_role === 'tool'
          ? { claimedBy: [...new Set(ev.filter((e) => e.role === 'other' || e.role === 'tool').map((e) => e.author ?? '?'))] } : {}),
        inferred: r.stance === 'inferred',
        people: people.filter((p) => p.episode_id === r.id).map((p) => p.alias),
        feelings: r.feelings, ...(r.opinion ? { opinion: r.opinion } : {}),
        source: { conversation: ev[0]?.external_id ?? '', messageIds: ev.map((e) => e.message_id), at: ev[0]?.sent_at.toISOString() ?? '' },
        ...(sources.length ? { sources } : {}),
      } satisfies EpisodeView;
    });
  }
}

/**
 * A claim is what other people said about me or someone else (inferred) — not a person's own news (stated for them), not
 * what a tool or a document taught me (my learning, still inferred), not what the account's speaker said.
 */
function isClaim(v: EpisodeView): boolean {
  return v.authorRole === 'other' && v.inferred;
}

function firstOfNextMonth(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number) as [number, number];
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}
