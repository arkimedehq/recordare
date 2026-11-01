// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Intents and initiatives (D53, WORK_PLAN 8.12c): the agent's own things to do, and what it decides to say or do about
 * them, pushed to the clients. This first cut needs no model (the economy level): the intents come from what the memory
 * already holds —
 * - an open plan past its date: an `ask` ("did it happen?") the day after, kept for a week;
 * - a plan coming up: a `say` (a reminder) the day before, until the plan's time;
 * - a question the agent holds (a thought of kind `question`): a `lookup` for the host agent, kept two weeks.
 * An intent is armed once per source (a plan asked about once, a question looked up once); it fires when due, outside
 * the memory's quiet hours and within the daily limit per person; what the client reports steers it (declined →
 * cancelled; ignored → asked again a week later, then cancelled; nobody came in time → expired, quietly — the maintainer's
 * rule: speak when someone who can answer is there, and presence is the host's knowledge). Private plans are left alone
 * (D52: an initiative addresses a person; a private plan would be told to the wrong one). All SQL is parameterised; the
 * only interpolations are constant column lists and the privacy predicate.
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, type EntityManager } from 'typeorm';
import { type Env } from '../config/env';
import { localDate } from '../engine/time';
import { initiativeText } from '../lang/initiative';
import { episodeVisible, PUBLIC_ONLY } from '../recall/privacy';
import { TelemetryService } from '../telemetry/telemetry.service';
import { WebhooksService } from './webhooks.service';

export type InitiativeKind = 'say' | 'ask' | 'lookup' | 'do';
export type InitiativeStatus = 'pending' | 'said' | 'asked' | 'ignored' | 'declined' | 'done' | 'failed' | 'expired';
export const OUTCOMES = ['said', 'asked', 'ignored', 'declined', 'done', 'failed', 'expired'] as const;

export interface InitiativeView {
  id: string; seq: number; kind: InitiativeKind; for: { personId: string; name: string } | null; text: string; reason: string;
  episodeIds: string[]; dueAt: string; expiresAt: string; status: InitiativeStatus; outcomeAt: string | null; reply: string | null;
  createdAt: string;
}

interface Row {
  id: string; seq: string; kind: InitiativeKind; for_person_id: string | null; for_name: string | null; text: string; reason: string;
  episode_ids: string[]; due_at: Date; expires_at: Date; status: InitiativeStatus; outcome_at: Date | null; reply: string | null; created_at: Date;
}

const COLUMNS = `i.id, i.seq::text, i.kind::text, i.for_person_id, (SELECT display_name FROM persons WHERE id = i.for_person_id) AS for_name,
  i.text, i.reason, i.episode_ids, i.due_at, i.expires_at, i.status::text, i.outcome_at, i.reply, i.created_at`;

/** How far back a past plan is still asked about, how far ahead a plan is reminded of. */
const ASK_BACK_DAYS = 30;
const REMIND_AHEAD_HOURS = 48;
const ASK_KEEP_DAYS = 7;
const LOOKUP_KEEP_DAYS = 14;
/** An ignored initiative is asked again after this, then no more. */
const RETRY_AFTER_DAYS = 7;
const MAX_ATTEMPTS = 2;
const DAY_MS = 86_400_000;

/** The rows of an UPDATE … RETURNING as TypeORM hands them back (`[rows, count]`). */
function updated<T>(res: unknown): T[] {
  return Array.isArray(res) && Array.isArray(res[0]) ? (res[0] as T[]) : (res as T[]);
}

export function view(r: Row): InitiativeView {
  return {
    id: r.id, seq: Number(r.seq), kind: r.kind, for: r.for_person_id ? { personId: r.for_person_id, name: r.for_name ?? '' } : null,
    text: r.text, reason: r.reason, episodeIds: r.episode_ids, dueAt: r.due_at.toISOString(), expiresAt: r.expires_at.toISOString(),
    status: r.status, outcomeAt: r.outcome_at?.toISOString() ?? null, reply: r.reply, createdAt: r.created_at.toISOString(),
  };
}

@Injectable()
export class InitiativeService {
  private readonly log = new Logger(InitiativeService.name);

  constructor(
    private readonly db: DataSource,
    private readonly config: ConfigService<Env, true>,
    private readonly webhooks: WebhooksService,
    private readonly telemetry: TelemetryService,
  ) {}

  /** Every memory with something that could be due: arm, fire, expire. Hourly (the initiative processor) and on demand. */
  async sweepAll(now: Date): Promise<void> {
    const memories: Array<{ person_id: string }> = await this.db.query(
      `SELECT o.person_id FROM memories o WHERE EXISTS (SELECT 1 FROM episodes e WHERE e.memory_id = o.person_id AND e.kind = 'plan')
         OR EXISTS (SELECT 1 FROM notes n WHERE n.memory_id = o.person_id AND n.category = 'question')
         OR EXISTS (SELECT 1 FROM intents t WHERE t.memory_id = o.person_id AND t.status IN ('armed', 'fired'))`);
    for (const { person_id } of memories) {
      try { await this.sweep(person_id, now); } catch (err) { this.log.warn(`initiative sweep failed for ${person_id}: ${(err as Error).name}`); }
    }
  }

  async sweep(memoryId: string, now: Date): Promise<{ armed: number; fired: number; expired: number }> {
    const armed = await this.arm(memoryId, now);
    const expired = await this.expire(memoryId, now);
    const fired = await this.fire(memoryId, now);
    return { armed, fired, expired };
  }

  /** Intents from what the memory holds; sources that moved on (a plan confirmed or cancelled, a question retired) close theirs. */
  private async arm(memoryId: string, now: Date): Promise<number> {
    let armed = 0;
    const plans: Array<{ id: string; content: string; occurred_at: Date; subject_person_id: string | null; past: boolean }> = await this.db.query(
      `SELECT e.id, e.content, e.occurred_at, CASE WHEN e.subject_kind = 'contact' THEN e.subject_person_id END AS subject_person_id,
         e.occurred_at < $2 AS past
       FROM episodes e
       WHERE e.memory_id = $1 AND e.kind = 'plan' AND e.deleted_at IS NULL AND e.invalidated_at IS NULL AND e.duplicate_of IS NULL
         AND e.occurred_at IS NOT NULL AND e.author_role <> 'tool' AND e.origin <> 'assistant_stated'
         AND ((e.plan_status = 'open' AND e.occurred_at < $2::timestamptz - interval '1 day' AND e.occurred_at > $2::timestamptz - make_interval(days => $3))
           OR (e.plan_status IN ('open', 'confirmed') AND e.occurred_at > $2 AND e.occurred_at < $2::timestamptz + make_interval(hours => $4)))
         AND ${episodeVisible('e', PUBLIC_ONLY)}`, [memoryId, now, ASK_BACK_DAYS, REMIND_AHEAD_HOURS]);
    for (const p of plans) {
      const kind = p.past ? 'open_plan' : 'upcoming_plan';
      const due = p.past ? new Date(p.occurred_at.getTime() + DAY_MS) : new Date(Math.max(now.getTime(), p.occurred_at.getTime() - DAY_MS));
      const expires = p.past ? new Date(due.getTime() + ASK_KEEP_DAYS * DAY_MS) : p.occurred_at;
      const r = await this.db.query(
        `INSERT INTO intents (memory_id, kind, content, for_person_id, episode_id, due_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (episode_id, kind) WHERE episode_id IS NOT NULL DO NOTHING RETURNING id`,
        [memoryId, kind, p.content, p.subject_person_id, p.id, due, expires]);
      armed += r.length;
    }
    const questions: Array<{ id: string; content: string }> = await this.db.query(
      `SELECT id, content FROM notes WHERE memory_id = $1 AND category = 'question' AND status = 'current' AND deleted_at IS NULL AND NOT pending`, [memoryId]);
    for (const q of questions) {
      const r = await this.db.query(
        `INSERT INTO intents (memory_id, kind, content, note_id, due_at, expires_at) VALUES ($1, 'lookup', $2, $3, $4, $5)
         ON CONFLICT (note_id, kind) WHERE note_id IS NOT NULL DO NOTHING RETURNING id`,
        [memoryId, q.content, q.id, now, new Date(now.getTime() + LOOKUP_KEEP_DAYS * DAY_MS)]);
      armed += r.length;
    }
    // A source that moved on closes its intent: the plan confirmed, cancelled or rescheduled; the question answered or forgotten.
    await this.db.query(
      `UPDATE intents t SET status = 'done', updated_at = now() FROM episodes e
       WHERE t.memory_id = $1 AND t.status IN ('armed', 'fired') AND t.episode_id = e.id
         AND ((t.kind = 'open_plan' AND e.plan_status <> 'open') OR (t.kind = 'upcoming_plan' AND e.plan_status NOT IN ('open', 'confirmed'))
              OR e.deleted_at IS NOT NULL OR e.invalidated_at IS NOT NULL)`, [memoryId]);
    await this.db.query(
      `UPDATE intents t SET status = 'done', updated_at = now() FROM notes n
       WHERE t.memory_id = $1 AND t.status IN ('armed', 'fired') AND t.note_id = n.id AND (n.status <> 'current' OR n.deleted_at IS NOT NULL)`, [memoryId]);
    return armed;
  }

  /** Pending initiatives nobody answered in time lapse, quietly; their intents lapse with them. */
  private async expire(memoryId: string, now: Date): Promise<number> {
    const rows = updated<Row>(await this.db.query(
      `UPDATE initiatives i SET status = 'expired', outcome_at = $2, updated_at = now() WHERE i.memory_id = $1 AND i.status = 'pending' AND i.expires_at < $2
       RETURNING ${COLUMNS}`, [memoryId, now]));
    for (const r of rows) {
      await this.db.query(`UPDATE intents SET status = 'expired', updated_at = now() WHERE id = (SELECT intent_id FROM initiatives WHERE id = $1) AND status = 'fired'`, [r.id]);
      await this.webhooks.notify(memoryId, 'initiative.expired', view(r), r.id);
    }
    await this.db.query(`UPDATE intents SET status = 'expired', updated_at = now() WHERE memory_id = $1 AND status = 'armed' AND expires_at < $2`, [memoryId, now]);
    return rows.length;
  }

  /** Armed intents that are due become initiatives — outside the quiet hours, within the day's limit per person. */
  private async fire(memoryId: string, now: Date): Promise<number> {
    const [memory]: Array<{ timezone: string; locale: string; quiet_from: number; quiet_to: number }> = await this.db.query(
      `SELECT timezone, locale, quiet_from, quiet_to FROM memories WHERE person_id = $1`, [memoryId]);
    if (!memory) return 0;
    const due: Array<{ id: string; kind: string; content: string; for_person_id: string | null; episode_id: string | null; note_id: string | null; expires_at: Date; occurred_at: Date | null }> =
      await this.db.query(
        `SELECT t.id, t.kind::text, t.content, t.for_person_id, t.episode_id, t.note_id, t.expires_at, e.occurred_at
         FROM intents t LEFT JOIN episodes e ON e.id = t.episode_id
         WHERE t.memory_id = $1 AND t.status = 'armed' AND t.due_at <= $2 AND (t.reconsider_at IS NULL OR t.reconsider_at <= $2)
         ORDER BY t.due_at`, [memoryId, now]);
    if (!due.length) return 0;
    const text = initiativeText(memory.locale);
    const day = (d: Date) => new Intl.DateTimeFormat(memory.locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: memory.timezone }).format(d);
    const when = afterQuiet(now, memory.timezone, memory.quiet_from, memory.quiet_to);
    const limit = this.config.get('INITIATIVE_DAILY_LIMIT', { infer: true }) ?? 3; // counted on the day they are due (the memory's clock)
    let fired = 0;
    for (const t of due) {
      if (t.expires_at <= when) continue; // due only after it lapses: left to expire
      const counted: Array<{ n: number }> = await this.db.query(
        `SELECT count(*)::int AS n FROM initiatives WHERE memory_id = $1 AND for_person_id IS NOT DISTINCT FROM $2
           AND (due_at AT TIME ZONE $3)::date = ($4::timestamptz AT TIME ZONE $3)::date`, [memoryId, t.for_person_id, memory.timezone, when]);
      if ((counted[0]?.n ?? 0) >= limit) continue; // the day's share is spent: tomorrow
      const plan = t.content.trim().replace(/([^.!?])$/, '$1.');
      const [kind, content, reason] = t.kind === 'open_plan' ? ['ask', text.askPlan(plan, day(t.occurred_at!)), 'a plan past its date without an outcome']
        : t.kind === 'upcoming_plan' ? ['say', text.remindPlan(plan, day(t.occurred_at!)), 'a plan coming up']
          : ['lookup', text.lookup(t.content), 'a question I hold'];
      const rows: Row[] = await this.db.transaction(async (tx: EntityManager) => {
        const inserted: Row[] = await tx.query(
          `WITH i AS (INSERT INTO initiatives (memory_id, intent_id, kind, for_person_id, text, reason, episode_ids, due_at, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *)
           SELECT ${COLUMNS} FROM i`,
          [memoryId, t.id, kind, t.for_person_id, content, reason, t.episode_id ? [t.episode_id] : [], when, t.expires_at]);
        await tx.query(`UPDATE intents SET status = 'fired', attempts = attempts + 1, updated_at = now() WHERE id = $1`, [t.id]);
        return inserted;
      });
      const v = view(rows[0]!);
      this.telemetry.emit({ type: 'initiative.created', memoryId, id: v.id, kind: v.kind });
      await this.webhooks.notify(memoryId, 'initiative.created', v, v.id);
      fired++;
    }
    return fired;
  }

  /** The feed: initiatives after `since` (seq), in order; `next` goes back as `since`, `more` when a page was full. */
  async list(memoryId: string, query: { since?: number; limit?: number; status?: InitiativeStatus }): Promise<{ items: InitiativeView[]; next: number; more: boolean }> {
    const limit = Math.min(Math.max(query.limit ?? 100, 1), 500);
    const rows: Row[] = await this.db.query(
      `SELECT ${COLUMNS} FROM initiatives i WHERE i.memory_id = $1 AND i.seq > $2 AND ($3::text IS NULL OR i.status::text = $3)
       ORDER BY i.seq LIMIT $4`, [memoryId, query.since ?? 0, query.status ?? null, limit + 1]);
    const page = rows.slice(0, limit);
    return { items: page.map(view), next: page.length ? Number(page[page.length - 1]!.seq) : query.since ?? 0, more: rows.length > limit };
  }

  /** What became of an initiative (the client's report); its intent follows. */
  async outcome(memoryId: string, id: string, status: (typeof OUTCOMES)[number], at: Date, reply?: string): Promise<InitiativeView> {
    const rows = updated<Row>(await this.db.query(
      `UPDATE initiatives i SET status = $3, outcome_at = $4, reply = COALESCE($5, i.reply), updated_at = now()
       WHERE i.memory_id = $1 AND i.id = $2 RETURNING ${COLUMNS}`, [memoryId, id, status, at, reply ?? null]));
    if (!rows.length) throw new NotFoundException();
    const linked: Array<{ intent_id: string | null }> = await this.db.query(`SELECT intent_id FROM initiatives WHERE id = $1`, [id]);
    const intent_id = linked[0]?.intent_id;
    if (intent_id) {
      if (status === 'said' || status === 'asked' || status === 'done') {
        await this.db.query(`UPDATE intents SET status = 'done', updated_at = now() WHERE id = $1`, [intent_id]);
      } else if (status === 'declined') {
        await this.db.query(`UPDATE intents SET status = 'cancelled', updated_at = now() WHERE id = $1`, [intent_id]);
      } else if (status === 'ignored' || status === 'expired') {
        // Offered once; asked again a week later, then left alone (no nagging).
        await this.db.query(
          `UPDATE intents SET status = CASE WHEN attempts >= $3 THEN 'cancelled'::intent_status ELSE 'armed'::intent_status END,
             reconsider_at = $2::timestamptz + make_interval(days => $4), updated_at = now() WHERE id = $1`, [intent_id, at, MAX_ATTEMPTS, RETRY_AFTER_DAYS]);
      } else if (status === 'failed') {
        await this.db.query(`UPDATE intents SET status = 'armed', reconsider_at = $2::timestamptz + interval '1 day', updated_at = now() WHERE id = $1`, [intent_id, at]);
      }
    }
    const v = view(rows[0]!);
    this.telemetry.emit({ type: 'initiative.outcome', memoryId, id, status });
    await this.webhooks.notify(memoryId, 'initiative.updated', v, id);
    return v;
  }
}

/** `now`, or the end of the quiet hours when `now` falls inside them (the memory's local hours `from` → `to`). */
export function afterQuiet(now: Date, tz: string, from: number, to: number): Date {
  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: tz }).format(now)) % 24;
  const quiet = from === to ? false : from < to ? hour >= from && hour < to : hour >= from || hour < to;
  if (!quiet) return now;
  // The local hour `to`, today or tomorrow: found by stepping from the local midnight.
  const today = localDate(now, tz);
  const candidate = (isoDay: string) => {
    const utcMidnight = new Date(`${isoDay}T00:00:00Z`);
    const offset = utcMidnight.getTime() - new Date(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .format(utcMidnight).replace(/(\d+)\/(\d+)\/(\d+), (\d+):(\d+):(\d+)/, '$3-$1-$2T$4:$5:$6Z')).getTime();
    return new Date(utcMidnight.getTime() + offset + to * 3_600_000);
  };
  const end = candidate(today);
  return end > now ? end : candidate(new Date(new Date(`${today}T12:00:00Z`).getTime() + DAY_MS).toISOString().slice(0, 10));
}
