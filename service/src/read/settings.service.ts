// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * The memory's settings and its LLM usage, for the host's UI (API.md §4, WORK_PLAN 4.7): locale, time zone and quality
 * profile (D35; null = the installation default), and the calls and tokens the engine spent on this memory.
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { type Env } from '../config/env';
import { type QualityProfileName } from '../engine/quality-profile';
import { addDays, localDate, zonedMidnight } from '../engine/time';
import { canonicalLocale } from '../lang';

export interface Settings { locale: string; timezone: string; qualityProfile: QualityProfileName | null; effectiveQualityProfile: QualityProfileName }

interface Totals { calls: number; inputTokens: number; cachedInputTokens: number; outputTokens: number; failed: number }

@Injectable()
export class SettingsService {
  constructor(private readonly db: DataSource, private readonly config: ConfigService<Env, true>) {}

  async get(memoryId: string): Promise<Settings> {
    const [m]: Array<{ locale: string; timezone: string; quality_profile: QualityProfileName | null }> = await this.db.query(
      `SELECT locale, timezone, quality_profile FROM memories WHERE person_id = $1`, [memoryId]);
    if (!m) throw new NotFoundException();
    return { locale: m.locale, timezone: m.timezone, qualityProfile: m.quality_profile,
      effectiveQualityProfile: m.quality_profile ?? this.config.get('QUALITY_PROFILE', { infer: true }) };
  }

  async update(memoryId: string, patch: { locale?: string; timezone?: string; qualityProfile?: QualityProfileName | null }): Promise<Settings> {
    const sets: string[] = [];
    const params: unknown[] = [memoryId];
    if (patch.locale !== undefined) {
      const locale = canonicalLocale(patch.locale);
      if (!locale) throw new BadRequestException('invalid locale');
      sets.push(`locale = $${params.push(locale)}`);
    }
    if (patch.timezone !== undefined) {
      try {
        new Intl.DateTimeFormat('en', { timeZone: patch.timezone });
      } catch {
        throw new BadRequestException('invalid timezone');
      }
      sets.push(`timezone = $${params.push(patch.timezone)}`);
    }
    if (patch.qualityProfile !== undefined) sets.push(`quality_profile = $${params.push(patch.qualityProfile)}`);
    if (sets.length) {
      const [, n] = await this.db.query(`UPDATE memories SET ${sets.join(', ')} WHERE person_id = $1`, params);
      if (!n) throw new NotFoundException();
    }
    return this.get(memoryId);
  }

  /** LLM calls and tokens for this memory between two local days (inclusive; default: the last 30 days), by prompt and by day. */
  async usage(memoryId: string, query: { from?: string; to?: string }, now: Date) {
    const { timezone: tz } = await this.get(memoryId);
    const to = query.to ?? localDate(now, tz);
    const from = query.from ?? addDays(to, -29);
    if (from > to) throw new BadRequestException('from after to');
    const range = [zonedMidnight(from, tz), zonedMidnight(addDays(to, 1), tz)];
    const sum = `count(*)::int AS calls, coalesce(sum(input_tokens), 0)::int AS input, coalesce(sum(cached_input_tokens), 0)::int AS cached,
      coalesce(sum(output_tokens), 0)::int AS output, (count(*) FILTER (WHERE status <> 'ok'))::int AS failed`;
    type Row = { calls: number; input: number; cached: number; output: number; failed: number };
    const totals = (r: Row | undefined): Totals => ({ calls: r?.calls ?? 0, inputTokens: r?.input ?? 0, cachedInputTokens: r?.cached ?? 0,
      outputTokens: r?.output ?? 0, failed: r?.failed ?? 0 });
    const where = `memory_id = $1 AND created_at >= $2 AND created_at < $3`;
    const [all]: Row[] = await this.db.query(`SELECT ${sum} FROM llm_calls WHERE ${where}`, [memoryId, ...range]);
    const byPrompt: Array<Row & { prompt: string }> = await this.db.query(
      `SELECT prompt_id AS prompt, ${sum} FROM llm_calls WHERE ${where} GROUP BY prompt_id ORDER BY prompt_id`, [memoryId, ...range]);
    const byDay: Array<Row & { day: string }> = await this.db.query(
      `SELECT (created_at AT TIME ZONE $4)::date::text AS day, ${sum} FROM llm_calls WHERE ${where} GROUP BY 1 ORDER BY 1`, [memoryId, ...range, tz]);
    return {
      from, to, ...totals(all),
      byPrompt: byPrompt.map((r) => ({ prompt: r.prompt, ...totals(r) })),
      byDay: byDay.map((r) => ({ day: r.day, ...totals(r) })),
    };
  }
}
