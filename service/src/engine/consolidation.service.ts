// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Nightly consolidation (M5, D8): the "sleep" of the memory. For every past day whose visible episodes changed it
 * writes a day digest; for every month whose days (or month-dated episodes) changed, a month digest. Each digest
 * keeps the fingerprint of its sources, so an unchanged day costs nothing — zero LLM calls when nothing is new (D5).
 * Digests are summaries of episodes only, in the agent's voice (v2, WORK_PLAN 8.6): the memory's own items, a person's
 * news about themself, what a tool taught; other people's claims (author other, inferred) are left out, so a claim can
 * never be laundered into the diary. Each item carries its subject. The prompt version is part of a digest's
 * fingerprint: a new version rewrites every day once. Old versions are superseded, never edited (bi-temporal, D16).
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DataSource } from 'typeorm';
import { EMBEDDING_PORT, type EmbeddingPort } from '../embedding/embedding.port';
import { LLM_PORT, type LlmPort } from '../llm/llm.port';
import { DAY_DIGEST_SYSTEM, DAY_DIGEST_VERSION, digestSchema, ENTITY_DAY_DIGEST_SYSTEM, ENTITY_DIGEST_SUFFIX, ENTITY_MONTH_DIGEST_SYSTEM,
  MONTH_DIGEST_SYSTEM, MONTH_DIGEST_VERSION } from './consolidation.prompt';
import { selfLeak } from '../lang';
import { type SubjectKind } from '../identity/identity.entities';
import { addDays, localDate, periodEnd, type Precision } from './time';
import { TelemetryService } from '../telemetry/telemetry.service';
import { ConfigService } from '@nestjs/config';
import { type Env } from '../config/env';
import { FactsReviewService } from './facts-review.service';
import { FACTS_REVIEW_VERSION } from './facts-review.prompt';
import { PatternsService } from './patterns.service';
import { PATTERNS_VERSION } from './patterns.prompt';
import { qualityProfile, type QualityProfile, type QualityProfileName } from './quality-profile';
import { resolveNearDuplicates } from './episode-resolver';
import { expireClarifications } from './clarifications';
import { subjectLabel } from './subjects';
import { vectorParam } from '../db/pgvector';

interface EpisodeRow {
  id: string; kind: 'event' | 'plan' | 'state_change'; content: string; occurred_at: Date; occurred_until: Date | null;
  date_precision: Precision; plan_status: string | null; rescheduled_to_day: string | null; people: string[] | null; feelings: string[];
  subject_kind: SubjectKind; subject: string | null; candidates: string[] | null;
}
interface DigestRow { id: string; level: 'day' | 'month'; period_start: string; version: number; source_hash: string; content: string }

/** `failed`: digests whose call failed — left as they were and retried at the next consolidation. */
export interface ConsolidationReport { days: number; months: number; superseded: number; llmCalls: number; failed: number; facts: number;
  /** Episodes linked by the nightly near-duplicate pass (hidden duplicates, corrections). */
  duplicates: number;
  /** Recurring patterns written (new or updated) and retired by the nightly pattern pass (5.4). */
  patterns: number;
  /** Digests still naming the self in the third person (counts only, like the extraction's). */
  leaks: number }

/** Multi-day items are listed on each of their days, up to this many. */
const MAX_SPAN_DAYS = 14;

@Injectable()
export class ConsolidationService {
  private readonly log = new Logger(ConsolidationService.name);

  constructor(
    private readonly db: DataSource,
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    @Inject(EMBEDDING_PORT) private readonly embeddings: EmbeddingPort,
    private readonly telemetry: TelemetryService,
    private readonly factsReview: FactsReviewService,
    private readonly patterns: PatternsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Consolidate every complete day (in the memory's timezone) before `now`. Idempotent; one run per memory at a time. */
  async consolidateMemory(memoryId: string, now: Date): Promise<ConsolidationReport> {
    const report: ConsolidationReport = { days: 0, months: 0, superseded: 0, llmCalls: 0, failed: 0, facts: 0, leaks: 0, duplicates: 0, patterns: 0 };
    const runner = this.db.createQueryRunner();
    await runner.connect();
    try {
      const [{ locked }] = await runner.query(`SELECT pg_try_advisory_lock(hashtextextended($1, 11)) AS locked`, [memoryId]);
      if (!locked) return report;
      try {
        await this.telemetry.track('consolidation', memoryId, () => this.run(memoryId, now, report));
      } finally {
        await runner.query(`SELECT pg_advisory_unlock(hashtextextended($1, 11))`, [memoryId]);
      }
    } finally {
      await runner.release();
    }
    return report;
  }

  private async run(memoryId: string, now: Date, report: ConsolidationReport): Promise<void> {
    const [memory] = await this.db.query(
      `SELECT o.timezone, o.locale, o.quality_profile, o.mode, o.gender, p.display_name,
         ARRAY(SELECT alias FROM person_aliases a WHERE a.person_id = o.person_id ORDER BY created_at) AS aliases
       FROM memories o JOIN persons p ON p.id = o.person_id WHERE o.person_id = $1`, [memoryId]);
    if (!memory) return;
    const entity = memory.mode === 'entity';
    const selfNames: string[] = [...new Set([memory.display_name as string, ...(memory.aliases as string[])].filter(Boolean))];
    const me = `ME: ${selfNames[0] ?? '(unnamed)'}${selfNames.length > 1 ? ` (also: ${selfNames.slice(1).join(', ')})` : ''} — gender ${memory.gender ?? 'masculine'}`
      + `\nMEMORY LANGUAGE: ${memory.locale}`;
    const dayVersion = entity ? `${DAY_DIGEST_VERSION}${ENTITY_DIGEST_SUFFIX}` : DAY_DIGEST_VERSION;
    const monthVersion = entity ? `${MONTH_DIGEST_VERSION}${ENTITY_DIGEST_SUFFIX}` : MONTH_DIGEST_VERSION;
    // Open clarifications nobody answered expire (D50 / 8.4; also checked on read and at extraction).
    await expireClarifications(this.db, memoryId, now);
    const tz: string = memory.timezone;
    const today = localDate(now, tz);
    const [run] = await this.db.query(
      `INSERT INTO extraction_runs (memory_id, kind, window_to, model, provider, prompt_version) VALUES ($1, 'consolidation', $2, 'task:digest', 'configured', $3) RETURNING id`,
      [memoryId, now, dayVersion]);
    const ctx = { memoryId, runId: run.id as string };
    try {
      const profile = qualityProfile(memory.quality_profile, this.config.get('QUALITY_PROFILE', { infer: true }) as QualityProfileName,
        undefined, undefined, undefined, this.config.get('FACTS_REVIEW', { infer: true }), this.config.get('PATTERNS', { infer: true }));
      // Same event told twice where no check could see both (5.3): resolved before the diary is written from them.
      report.duplicates = await this.resolveUnseen(memoryId, ctx, profile, report);
      const episodes: EpisodeRow[] = await this.db.query(
        `SELECT e.id, e.kind, e.content, e.occurred_at, e.occurred_until, e.date_precision, e.plan_status,
                (SELECT (r.occurred_at AT TIME ZONE $2)::date::text FROM episodes r WHERE r.id = e.rescheduled_to) AS rescheduled_to_day,
                (SELECT array_agg(alias ORDER BY alias) FROM episode_people p WHERE p.episode_id = e.id) AS people, e.feelings,
                e.subject_kind, (SELECT display_name FROM persons WHERE id = e.subject_person_id) AS subject,
                (SELECT array_agg(COALESCE(full_name, display_name) ORDER BY created_at) FROM persons WHERE id = ANY(e.subject_candidates)) AS candidates
         FROM episodes e
         WHERE e.memory_id = $1 AND e.deleted_at IS NULL AND e.invalidated_at IS NULL AND e.duplicate_of IS NULL
           AND NOT (e.author_role = 'other' AND e.stance = 'inferred') AND e.occurred_at IS NOT NULL AND e.occurred_at < $3
           AND e.date_precision IN ('day', 'approximate', 'month')
         ORDER BY e.occurred_at, e.id`, [memoryId, tz, now]);

      // Group by local day (multi-day items on each day) and month-only items by month.
      const byDay = new Map<string, EpisodeRow[]>();
      const monthOnly = new Map<string, EpisodeRow[]>();
      for (const e of episodes) {
        const first = localDate(e.occurred_at, tz);
        if (e.date_precision === 'month') { push(monthOnly, first.slice(0, 7), e); continue; }
        const last = e.occurred_until ? localDate(e.occurred_until, tz) : first;
        for (let d = first, i = 0; d <= last && i < MAX_SPAN_DAYS; d = addDays(d, 1), i++) if (d < today) push(byDay, d, e);
      }

      const current: DigestRow[] = await this.db.query(
        `SELECT id, level, period_start::text, version, source_hash, content FROM digests WHERE memory_id = $1 AND superseded_at IS NULL`, [memoryId]);
      const currentDay = new Map(current.filter((d) => d.level === 'day').map((d) => [d.period_start, d]));
      const currentMonth = new Map(current.filter((d) => d.level === 'month').map((d) => [d.period_start.slice(0, 7), d]));

      // Days: rewrite only when the fingerprint of their items changed; drop digests of days that emptied.
      for (const [day, items] of byDay) {
        const lines = items.map((e) => this.line(e, tz, now));
        const hash = fingerprint([dayVersion, ...lines]);
        if (currentDay.get(day)?.source_hash === hash) continue;
        report.llmCalls++;
        const out = await this.llm.completeJson({
          promptId: dayVersion, system: entity ? ENTITY_DAY_DIGEST_SYSTEM : DAY_DIGEST_SYSTEM, task: 'digest', maxTokens: 600,
          user: `${me}\nDAY: ${day}\nITEMS:\n${lines.join('\n')}`, schema: digestSchema,
        }, ctx).catch((err: unknown) => this.skip(report, `day ${day}`, err));
        if (!out) continue;
        if (selfLeak(out.summary, selfNames)) report.leaks++;
        await this.write(memoryId, 'day', day, day, out.summary, hash, currentDay.get(day), items.map((e) => e.id), [], ctx.runId);
        report.days++;
      }
      for (const [day, d] of currentDay) if (!byDay.has(day)) { await this.supersede([d.id]); report.superseded++; }

      // Months: from the current day digests of the month plus month-dated items.
      const days: DigestRow[] = await this.db.query(
        `SELECT id, level, period_start::text, version, source_hash, content FROM digests
         WHERE memory_id = $1 AND superseded_at IS NULL AND level = 'day' ORDER BY period_start`, [memoryId]);
      const months = new Set([...days.map((d) => d.period_start.slice(0, 7)), ...monthOnly.keys()]);
      for (const month of [...months].sort()) {
        const dayDigests = days.filter((d) => d.period_start.startsWith(month));
        const extra = (monthOnly.get(month) ?? []).map((e) => this.line(e, tz, now));
        const lines = [...dayDigests.map((d) => `${d.period_start}: ${d.content}`), ...extra.map((l) => `(${month}) ${l}`)];
        const hash = fingerprint([monthVersion, ...dayDigests.map((d) => `${d.id}`), ...extra]);
        if (currentMonth.get(month)?.source_hash === hash) continue;
        report.llmCalls++;
        const out = await this.llm.completeJson({
          promptId: monthVersion, system: entity ? ENTITY_MONTH_DIGEST_SYSTEM : MONTH_DIGEST_SYSTEM, task: 'digest', maxTokens: 1200,
          user: `${me}\nMONTH: ${month}\nDAYS AND ITEMS:\n${lines.join('\n')}`, schema: digestSchema,
        }, ctx).catch((err: unknown) => this.skip(report, `month ${month}`, err));
        if (!out) continue;
        if (selfLeak(out.summary, selfNames)) report.leaks++;
        const last = addDays(`${nextMonth(month)}-01`, -1);
        await this.write(memoryId, 'month', `${month}-01`, last, out.summary, hash, currentMonth.get(month),
          (monthOnly.get(month) ?? []).map((e) => e.id), dayDigests.map((d) => d.id), ctx.runId);
        report.months++;
      }
      // Facts: checked against the episodes recorded since the last review (quality-profile knob, off by default).
      if (profile.factsReview) {
        const r = await this.factsReview.review(memoryId, now, ctx.runId);
        report.facts += r.changed; report.llmCalls += r.calls; report.failed += r.failed;
      }
      // Recurring patterns: the memory's own conclusions from the episodes of the last months (quality-profile knob).
      if (profile.patterns) {
        const r = await this.patterns.review(memoryId, now, ctx.runId);
        report.patterns += r.written + r.retired; report.llmCalls += r.calls; report.failed += r.failed;
      }
      await this.db.query(`UPDATE extraction_runs SET status = 'done', finished_at = now(), summary = $2 WHERE id = $1`, [ctx.runId,
        { days: report.days, months: report.months, superseded: report.superseded, failed: report.failed, facts: report.facts, leaks: report.leaks,
          duplicates: report.duplicates, patterns: report.patterns }]);
      await this.db.query(`UPDATE memories SET consolidated_at = $2 WHERE person_id = $1`, [memoryId, now]);
      this.telemetry.emit({ type: 'consolidation.finished', memoryId, days: report.days, months: report.months, llmCalls: report.llmCalls, failed: report.failed });
    } catch (err) {
      await this.db.query(`UPDATE extraction_runs SET status = 'failed', finished_at = now(), error = $1 WHERE id = $2`, [(err as Error).name, ctx.runId]);
      throw err;
    }
  }

  /**
   * The facts review alone, now (operators and evaluations; the night runs it inside the consolidation when the
   * profile asks for it). Same lock as the consolidation: never two at once for one memory.
   */
  async reviewFactsNow(memoryId: string, now: Date): Promise<{ calls: number; changed: number; failed: number }> {
    return (await this.alone(memoryId, now, 'task:facts', FACTS_REVIEW_VERSION, (runId) => this.factsReview.review(memoryId, now, runId)))
      ?? { calls: 0, changed: 0, failed: 0 };
  }

  /** The pattern pass alone, now (operators and evaluations), whatever the profile says. */
  async patternsNow(memoryId: string, now: Date): Promise<{ calls: number; written: number; retired: number; failed: number }> {
    return (await this.alone(memoryId, now, 'task:patterns', PATTERNS_VERSION, (runId) => this.patterns.review(memoryId, now, runId)))
      ?? { calls: 0, written: 0, retired: 0, failed: 0 };
  }

  /** One nightly step on its own run, under the consolidation's lock (null: a consolidation of this memory is running). */
  private async alone<T>(memoryId: string, now: Date, model: string, version: string, step: (runId: string) => Promise<T>): Promise<T | null> {
    const runner = this.db.createQueryRunner();
    await runner.connect();
    try {
      const [{ locked }] = await runner.query(`SELECT pg_try_advisory_lock(hashtextextended($1, 11)) AS locked`, [memoryId]);
      if (!locked) return null;
      try {
        const [run] = await this.db.query(
          `INSERT INTO extraction_runs (memory_id, kind, window_to, model, provider, prompt_version) VALUES ($1, 'consolidation', $2, $3, 'configured', $4) RETURNING id`,
          [memoryId, now, model, version]);
        const r = await this.telemetry.track('consolidation', memoryId, () => step(run.id));
        await this.db.query(`UPDATE extraction_runs SET status = 'done', finished_at = now() WHERE id = $1`, [run.id]);
        return r;
      } finally {
        await runner.query(`SELECT pg_advisory_unlock(hashtextextended($1, 11))`, [memoryId]);
      }
    } finally {
      await runner.release();
    }
  }

  /** A failed digest call does not stop the night: that day / month keeps its old digest and is retried next time. */
  /**
   * The nightly near-duplicate pass (WORK_PLAN 5.3): the episodes never checked, or recorded since the last
   * consolidation, against the episodes their check could not see. One call, only when such pairs exist.
   */
  private async resolveUnseen(memoryId: string, ctx: { memoryId: string; runId: string }, profile: QualityProfile, report: ConsolidationReport): Promise<number> {
    const rows: Array<{ id: string }> = await this.db.query(
      `SELECT e.id FROM episodes e JOIN memories o ON o.person_id = e.memory_id
       WHERE e.memory_id = $1 AND e.deleted_at IS NULL AND e.invalidated_at IS NULL AND e.duplicate_of IS NULL
         AND (e.resolved_at IS NULL OR o.consolidated_at IS NULL OR e.recorded_at > o.consolidated_at)`, [memoryId]);
    if (!rows.length) return 0;
    const links = await resolveNearDuplicates(this.db, this.llm, memoryId, rows.map((r) => r.id), ctx, profile,
      { unseen: true, onCall: () => report.llmCalls++ })
      .catch((err: unknown) => { report.failed++; this.log.warn(`near-duplicate pass skipped: ${(err as Error).name}`); return []; });
    for (const l of links) this.telemetry.emit({ type: 'episode.linked', memoryId, ...l });
    return links.length;
  }

  private skip(report: ConsolidationReport, what: string, err: unknown): null {
    report.failed++;
    this.log.warn(`digest skipped (${what}): ${(err as Error).name}`);
    return null;
  }

  /** One item of the diary input: whose (when not mine), kind / status, content, people, feelings. */
  private line(e: EpisodeRow, tz: string, now: Date): string {
    let status = '';
    if (e.kind === 'plan') {
      const past = periodEnd(e.occurred_until ?? e.occurred_at, e.occurred_until ? 'day' : e.date_precision, tz) <= now;
      const s = e.plan_status === 'open' && past ? 'unresolved' : e.plan_status;
      status = s === 'rescheduled' && e.rescheduled_to_day ? `plan, moved to ${e.rescheduled_to_day}` : `plan, ${s}`;
    }
    const kind = e.kind === 'plan' ? status : e.kind === 'state_change' ? 'change' : 'event';
    const extra = [e.people?.length ? `people: ${e.people.join(', ')}` : '', e.feelings.length ? `feelings: ${e.feelings.join(', ')}` : '']
      .filter(Boolean).join('; ');
    return `- ${subjectLabel(e.subject_kind, e.subject, e.candidates)}[${kind}] ${e.content}${extra ? ` (${extra})` : ''}`;
  }

  private async write(memoryId: string, level: 'day' | 'month', start: string, end: string, text: string, hash: string,
    previous: DigestRow | undefined, episodeIds: string[], digestIds: string[], runId: string): Promise<void> {
    let vector: number[] | undefined;
    try {
      [vector] = await this.embeddings.embed([text], 'document');
    } catch (err) {
      this.log.warn(`digest embedding skipped: ${(err as Error).message}`); // full-text search still works
    }
    await this.db.transaction(async (tx) => {
      if (previous) await tx.query(`UPDATE digests SET superseded_at = now() WHERE id = $1`, [previous.id]);
      const [d] = await tx.query(
        `INSERT INTO digests (memory_id, level, period_start, period_end, content, version, audience, extraction_run_id, source_hash,
           embedding, embedding_model, embedding_text)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::vector, $11, $5) RETURNING id`,
        [memoryId, level, start, end, text, (previous?.version ?? 0) + 1, [memoryId], runId, hash,
          vector ? vectorParam(vector) : null, vector ? this.embeddings.model : null]);
      for (const id of episodeIds) await tx.query(`INSERT INTO digest_sources (digest_id, episode_id) VALUES ($1, $2)`, [d.id, id]);
      for (const id of digestIds) await tx.query(`INSERT INTO digest_sources (digest_id, source_digest_id) VALUES ($1, $2)`, [d.id, id]);
    });
    this.telemetry.emit({ type: 'digest.written', memoryId, level, period: start, sources: episodeIds.length + digestIds.length });
  }

  private async supersede(ids: string[]): Promise<void> {
    await this.db.query(`UPDATE digests SET superseded_at = now() WHERE id = ANY($1) AND superseded_at IS NULL`, [ids]);
  }
}

function push<K, V>(m: Map<K, V[]>, k: K, v: V): void {
  const list = m.get(k);
  if (list) list.push(v); else m.set(k, [v]);
}

function fingerprint(lines: string[]): string {
  return createHash('sha256').update(lines.join('\n')).digest('hex');
}

function nextMonth(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number) as [number, number];
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}
