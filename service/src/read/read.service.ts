// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Read / write API for host UIs (API.md §4, WORK_PLAN 4.7) — the diary a platform shows the person: the timeline of
 * episodes, an episode's detail, the day / month diary, facts with their history, notes and plans; plus the person's
 * own edits (correct or forget an episode, pin or delete a note, confirm or reject what is pending). The reader is the
 * person themself in the platform's UI (memory-direct), never a conversation: no conversation resolution here. Quotes of
 * messages are limited to the client's own conversations unless its raw-log scope is `all`.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { localDate, periodEnd, type Precision, zonedMidnight, addDays } from '../engine/time';
import { toOrTsQuery } from '../rawlog/rawlog-search.service';

export type PlanStatus = 'open' | 'confirmed' | 'cancelled' | 'rescheduled' | 'unresolved';

export interface EpisodeItem {
  id: string;
  kind: 'event' | 'plan' | 'state_change';
  content: string;
  occurredAt: string | null;
  occurredUntil: string | null;
  datePrecision: Precision;
  timeExpression: string | null;
  place: string | null;
  planStatus?: PlanStatus;
  importance: number;
  valence: number | null;
  feelings: string[];
  opinion: string | null;
  people: string[];
  origin: string;
  authorRole: string;
  inferred: boolean;
  /** This row replaced an earlier, wrong version (see the detail's history). */
  corrected: boolean;
  recordedAt: string;
}

export interface EpisodeQuery {
  from?: string;
  to?: string;
  kind?: EpisodeItem['kind'];
  planStatus?: PlanStatus;
  q?: string;
  cursor?: string;
  limit?: number;
}

interface Memory { tz: string; locale: string }

interface EpisodeRow {
  id: string; kind: EpisodeItem['kind']; content: string; occurred_at: Date | null; occurred_until: Date | null;
  date_precision: Precision; time_expression: string | null; place: string | null; plan_status: string | null;
  importance: number; valence: number | null; feelings: string[] | null; opinion: string | null; origin: string;
  author_role: string; stance: string; corrects: string | null; recorded_at: Date; confirmed_by: string | null;
  rescheduled_to: string | null; sort_at?: Date;
}
interface EvidenceRow {
  evidence_kind: string; message_id: string; role: string; content: string; sent_at: Date; conversation: string;
  author: string | null; own: boolean;
}
interface HistoryRow { id: string; content: string; occurred_at: Date | null; recorded_at: Date }
interface PlanEventRow { patch: string; note: string | null; created_at: Date }
interface DigestRow { id: string; level: string; period_start: string; period_end: string; content: string; created_at: Date }
interface FactRow {
  id: string; key: string; value: string | null; status: string; valid_from: Date | null; valid_to: Date | null;
  pending: boolean; stance: string; author_role: string; about: string | null;
}
interface NoteRow {
  id: string; category: string; content: string; pinned: boolean; pending: boolean; stance: string; author_role: string;
  support_count: number; recorded_at: Date;
}

const VISIBLE = `e.deleted_at IS NULL AND e.invalidated_at IS NULL AND e.duplicate_of IS NULL`;

/** Keyset cursor: the last item's (occurred_at or recorded_at, id). Opaque to clients. */
const encodeCursor = (at: string, id: string): string => Buffer.from(`${at}|${id}`).toString('base64url');
function decodeCursor(cursor: string): { at: string; id: string } | null {
  const [at, id] = Buffer.from(cursor, 'base64url').toString().split('|');
  return at && id && !Number.isNaN(Date.parse(at)) && /^[0-9a-f-]{36}$/.test(id) ? { at, id } : null;
}

@Injectable()
export class ReadService {
  constructor(private readonly db: DataSource) {}

  private async memory(memoryId: string): Promise<Memory> {
    const [o] = await this.db.query(`SELECT timezone, locale FROM memories WHERE person_id = $1`, [memoryId]);
    if (!o) throw new NotFoundException();
    return { tz: o.timezone, locale: o.locale };
  }

  /** A plan still open whose date has passed is shown as unresolved (API.md §3). */
  private status(r: EpisodeRow, tz: string, now: Date): PlanStatus | undefined {
    if (r.kind !== 'plan' || !r.plan_status) return undefined;
    if (r.plan_status === 'open' && r.occurred_at) {
      const end = r.occurred_until ? periodEnd(r.occurred_until, 'day', tz) : periodEnd(r.occurred_at, r.date_precision, tz);
      if (end <= now) return 'unresolved';
    }
    return r.plan_status as PlanStatus;
  }

  private async items(rows: EpisodeRow[], o: Memory, now: Date): Promise<EpisodeItem[]> {
    const ids = rows.map((r) => r.id);
    const people: Array<{ episode_id: string; alias: string }> = ids.length
      ? await this.db.query(`SELECT episode_id, alias FROM episode_people WHERE episode_id = ANY($1)`, [ids]) : [];
    const day = (d: Date | null) => (d ? localDate(d, o.tz) : null);
    return rows.map((r) => {
      const planStatus = this.status(r, o.tz, now);
      return {
        id: r.id, kind: r.kind, content: r.content,
        occurredAt: r.date_precision === 'year' ? day(r.occurred_at)?.slice(0, 4) ?? null
          : r.date_precision === 'month' ? day(r.occurred_at)?.slice(0, 7) ?? null : day(r.occurred_at),
        occurredUntil: day(r.occurred_until), datePrecision: r.date_precision, timeExpression: r.time_expression, place: r.place,
        ...(planStatus ? { planStatus } : {}),
        importance: r.importance, valence: r.valence, feelings: r.feelings ?? [], opinion: r.opinion,
        people: people.filter((p) => p.episode_id === r.id).map((p) => p.alias),
        origin: r.origin, authorRole: r.author_role, inferred: r.stance === 'inferred', corrected: !!r.corrects,
        recordedAt: (r.recorded_at as Date).toISOString(),
      };
    });
  }

  /** The timeline, newest first; `from` / `to` are local dates (inclusive), `q` a full-text filter. */
  async episodes(memoryId: string, query: EpisodeQuery, now: Date): Promise<{ items: EpisodeItem[]; nextCursor: string | null }> {
    const o = await this.memory(memoryId);
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const where = [`e.memory_id = $1`, VISIBLE];
    const params: unknown[] = [memoryId];
    const p = (v: unknown) => `$${params.push(v)}`;
    // Sort key: the event's date, else when it was recorded.
    const at = `COALESCE(e.occurred_at, e.recorded_at)`;
    if (query.from) where.push(`${at} >= ${p(zonedMidnight(query.from.slice(0, 10), o.tz))}`);
    if (query.to) where.push(`${at} < ${p(zonedMidnight(addDays(query.to.slice(0, 10), 1), o.tz))}`);
    if (query.kind) where.push(`e.kind = ${p(query.kind)}`);
    if (query.planStatus) {
      // 'unresolved' and 'open' are told apart after reading (it depends on the plan's date): read open plans for both.
      where.push(`e.kind = 'plan' AND e.plan_status = ${p(query.planStatus === 'unresolved' ? 'open' : query.planStatus)}`);
    }
    const tsq = query.q ? toOrTsQuery(query.q) : '';
    if (tsq) where.push(`to_tsvector('simple', e.content || ' ' || array_to_string(e.keywords, ' ')) @@ to_tsquery('simple', ${p(tsq)})`);
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    if (cursor) where.push(`(${at}, e.id) < (${p(cursor.at)}::timestamptz, ${p(cursor.id)}::uuid)`);
    const rows: EpisodeRow[] = await this.db.query(
      `SELECT e.*, ${at} AS sort_at FROM episodes e WHERE ${where.join(' AND ')} ORDER BY sort_at DESC, e.id DESC LIMIT ${p(limit + 1)}`, params);
    const page = rows.slice(0, limit);
    let items = await this.items(page, o, now);
    if (query.planStatus === 'open' || query.planStatus === 'unresolved') items = items.filter((i) => i.planStatus === query.planStatus);
    const last = page.at(-1);
    return { items, nextCursor: rows.length > limit && last ? encodeCursor((last.sort_at as Date).toISOString(), last.id) : null };
  }

  /** One episode with its evidence (quotes from this client's conversations unless its raw-log scope is all), the
   * versions it corrected and, for a plan, its outcome and its history. */
  async episode(memoryId: string, clientId: string, id: string, now: Date) {
    const o = await this.memory(memoryId);
    const [row]: EpisodeRow[] = await this.db.query(`SELECT e.* FROM episodes e WHERE e.id = $1 AND e.memory_id = $2 AND e.deleted_at IS NULL`, [id, memoryId]);
    if (!row) throw new NotFoundException();
    const [item] = await this.items([row], o, now) as [EpisodeItem];
    const [client] = await this.db.query(`SELECT raw_log_scope FROM clients WHERE id = $1`, [clientId]);
    const evidence: EvidenceRow[] = await this.db.query(
      `SELECT ev.evidence_kind, m.id AS message_id, m.role, m.content, m.sent_at, c.external_id AS conversation,
              COALESCE(p.display_name, cp.display_name) AS author, (c.client_id = $2) AS own
       FROM episode_evidence ev JOIN messages m ON m.id = ev.message_id JOIN conversations c ON c.id = m.conversation_id
       LEFT JOIN persons p ON p.id = m.author_person_id
       LEFT JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.ref = m.author_ref
       WHERE ev.episode_id = $1 ORDER BY m.sent_at`, [id, clientId]);
    const history: HistoryRow[] = await this.db.query(
      `WITH RECURSIVE prev AS (
         SELECT id, content, occurred_at, date_precision, recorded_at, corrects FROM episodes WHERE id = (SELECT corrects FROM episodes WHERE id = $1)
         UNION ALL
         SELECT e.id, e.content, e.occurred_at, e.date_precision, e.recorded_at, e.corrects FROM episodes e JOIN prev ON e.id = prev.corrects)
       SELECT id, content, occurred_at, date_precision, recorded_at FROM prev`, [id]);
    const planEvents: PlanEventRow[] = row.kind === 'plan'
      ? await this.db.query(`SELECT patch, note, created_at FROM plan_events WHERE plan_id = $1 ORDER BY created_at`, [id]) : [];
    const linked = async (linkId: string | null) => {
      if (!linkId) return null;
      const [l]: EpisodeRow[] = await this.db.query(`SELECT e.* FROM episodes e WHERE e.id = $1 AND e.memory_id = $2 AND e.deleted_at IS NULL`, [linkId, memoryId]);
      return l ? (await this.items([l], o, now))[0] : null;
    };
    const showAll = client?.raw_log_scope === 'all';
    return {
      ...item,
      evidence: evidence.map((e) => (e.own || showAll
        ? { messageId: e.message_id, conversation: e.conversation, role: e.role, author: e.author, sentAt: (e.sent_at as Date).toISOString(), text: e.content, kind: e.evidence_kind }
        : { role: e.role, sentAt: (e.sent_at as Date).toISOString(), kind: e.evidence_kind, otherClient: true })),
      history: history.map((h) => ({ id: h.id, content: h.content, occurredAt: h.occurred_at ? localDate(h.occurred_at, o.tz) : null,
        recordedAt: (h.recorded_at as Date).toISOString() })),
      ...(row.kind === 'plan' ? {
        planEvents: planEvents.map((e) => ({ patch: e.patch, note: e.note, at: (e.created_at as Date).toISOString() })),
        confirmedBy: await linked(row.confirmed_by),
        rescheduledTo: await linked(row.rescheduled_to),
      } : {}),
    };
  }

  /** The diary: current day / month entries, newest first. */
  async digests(memoryId: string, query: { level?: 'day' | 'month'; from?: string; to?: string }) {
    await this.memory(memoryId);
    const where = [`memory_id = $1`, `superseded_at IS NULL`];
    const params: unknown[] = [memoryId];
    const p = (v: unknown) => `$${params.push(v)}`;
    if (query.level) where.push(`level = ${p(query.level)}`);
    if (query.from) where.push(`period_end >= ${p(query.from.slice(0, 10))}::date`);
    if (query.to) where.push(`period_start <= ${p(query.to.slice(0, 10))}::date`);
    const rows: DigestRow[] = await this.db.query(
      `SELECT id, level, period_start::text AS period_start, period_end::text AS period_end, content, created_at FROM digests WHERE ${where.join(' AND ')}
       ORDER BY period_start DESC, level LIMIT 400`, params);
    return rows.map((r) => ({ id: r.id, level: r.level, periodStart: r.period_start, periodEnd: r.period_end, content: r.content,
      writtenAt: (r.created_at as Date).toISOString() }));
  }

  /** Facts as slots (per person in an entity memory), each with its value as of `asOf` (default now) and its history. */
  async facts(memoryId: string, query: { key?: string; asOf?: string; includePending?: boolean }, now: Date) {
    const o = await this.memory(memoryId);
    const asOf = query.asOf ? zonedMidnight(addDays(query.asOf.slice(0, 10), 1), o.tz) : now;
    const params: unknown[] = [memoryId, query.includePending ?? false];
    const keyFilter = query.key ? `AND f.key = $${params.push(query.key)}` : '';
    const rows: FactRow[] = await this.db.query(
      `SELECT f.id, f.key, f.value, f.status, f.valid_from, f.valid_to, f.pending, f.stance, f.author_role, s.display_name AS about
       FROM facts f LEFT JOIN persons s ON s.id = f.subject_person_id
       WHERE f.memory_id = $1 AND f.deleted_at IS NULL AND f.status <> 'corrected' AND ($2::boolean OR NOT f.pending) ${keyFilter}
       ORDER BY s.display_name NULLS FIRST, f.key, f.valid_from NULLS FIRST, f.recorded_at`, params);
    const day = (d: Date | null) => (d ? localDate(d, o.tz) : null);
    const slots = new Map<string, FactRow[]>();
    for (const r of rows) slots.set(`${r.about ?? ''}\u0000${r.key}`, [...(slots.get(`${r.about ?? ''}\u0000${r.key}`) ?? []), r]);
    return [...slots.values()].flatMap((rs) => {
      const valid = rs.filter((r) => (!r.valid_from || r.valid_from < asOf) && (!r.valid_to || r.valid_to >= asOf));
      const at = valid.at(-1) ?? rs.filter((r) => !r.valid_from || r.valid_from < asOf).at(-1);
      if (!at) return [];
      return [{
        id: at.id, ...(at.about ? { about: at.about } : {}), key: at.key, value: at.value,
        status: at.status === 'unknown_current' ? 'unknown' : at.status, validFrom: day(at.valid_from), validTo: day(at.valid_to),
        pending: at.pending, inferred: at.stance === 'inferred',
        history: rs.map((r) => ({ id: r.id, value: r.value, from: day(r.valid_from), to: day(r.valid_to), status: r.status })),
      }];
    });
  }

  async notes(memoryId: string, query: { category?: string; pinned?: boolean; includePending?: boolean }) {
    await this.memory(memoryId);
    const params: unknown[] = [memoryId, query.includePending ?? false];
    const extra = [
      query.category ? `AND category = $${params.push(query.category)}` : '',
      query.pinned !== undefined ? `AND pinned = $${params.push(query.pinned)}` : '',
    ].join(' ');
    const rows: NoteRow[] = await this.db.query(
      `SELECT id, category, content, pinned, pending, stance, author_role, support_count, recorded_at FROM notes
       WHERE memory_id = $1 AND status = 'current' AND deleted_at IS NULL AND ($2::boolean OR NOT pending) ${extra}
       ORDER BY pinned DESC, recorded_at DESC`, params);
    return rows.map((r) => ({ id: r.id, category: r.category, content: r.content, pinned: r.pinned, pending: r.pending,
      inferred: r.stance === 'inferred', authorRole: r.author_role, supportCount: r.support_count, recordedAt: (r.recorded_at as Date).toISOString() }));
  }

  /** Plans, soonest first (open and unresolved by default). */
  async plans(memoryId: string, query: { status?: PlanStatus }, now: Date): Promise<EpisodeItem[]> {
    const o = await this.memory(memoryId);
    const rows: EpisodeRow[] = await this.db.query(
      `SELECT e.* FROM episodes e WHERE e.memory_id = $1 AND ${VISIBLE} AND e.kind = 'plan'
       ORDER BY e.occurred_at NULLS LAST, e.recorded_at`, [memoryId]);
    const items = await this.items(rows, o, now);
    return items.filter((i) => (query.status ? i.planStatus === query.status : i.planStatus === 'open' || i.planStatus === 'unresolved'));
  }

  // ── The person's own edits ───────────────────────────────────────────────────

  async pinNote(memoryId: string, id: string, pinned: boolean): Promise<void> {
    const [, n] = await this.db.query(`UPDATE notes SET pinned = $3 WHERE id = $1 AND memory_id = $2 AND deleted_at IS NULL`, [id, memoryId, pinned]);
    if (!n) throw new NotFoundException();
  }

  /** Deleting a note or a fact removes that row (its evidence goes with it); the history around it stays. */
  async deleteRow(memoryId: string, table: 'notes' | 'facts', id: string): Promise<void> {
    const [, n] = await this.db.query(`DELETE FROM ${table} WHERE id = $1 AND memory_id = $2`, [id, memoryId]);
    if (!n) throw new NotFoundException();
  }

  /** A pending (inferred) fact or note the person confirms becomes theirs; rejected, it is removed. */
  async decide(memoryId: string, table: 'notes' | 'facts', id: string, confirm: boolean): Promise<void> {
    if (!confirm) return this.deleteRow(memoryId, table, id);
    const [, n] = await this.db.query(
      `UPDATE ${table} SET pending = false, stance = 'stated', confidence = 1 WHERE id = $1 AND memory_id = $2 AND pending AND deleted_at IS NULL`, [id, memoryId]);
    if (!n) throw new NotFoundException();
  }
}
