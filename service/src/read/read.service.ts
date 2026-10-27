// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Read / write API for host UIs (API.md §4, WORK_PLAN 4.7) — the diary a platform shows the person: the timeline of
 * episodes, an episode's detail, the day / month diary, facts with their history, notes and plans; plus the person's
 * own edits (correct or forget an episode, pin or delete a note, confirm or reject what is pending). The reader is the
 * person themself in the platform's UI (memory-direct), never a conversation: no conversation resolution here. Quotes of
 * messages are limited to the client's own conversations unless its raw-log scope is `all`. Private memories (D52): the
 * account is the holder of a personal memory and reads everything; in an entity memory only the agent knows them, so the
 * account reads the public ones.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { localDate, periodEnd, type Precision, zonedMidnight, addDays } from '../engine/time';
import { toOrTsQuery } from '../rawlog/rawlog-search.service';
import { confirmPending } from '../engine/pending';
import { type NoteCategory, type NoteChangeKind, type NoteStatus } from './read.responses';
import { buildCards, type Cards } from '../recall/cards';
import { episodeVisible, factVisible, messageVisible, noteVisible, readerOf, type Reader } from '../recall/privacy';

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
interface DigestRow { id: string; level: 'day' | 'month'; period_start: string; period_end: string; content: string; created_at: Date }
interface FactRow {
  id: string; key: string; value: string | null; status: string; valid_from: Date | null; valid_to: Date | null;
  pending: boolean; stance: string; author_role: string; about: string | null;
}
interface NoteRow {
  id: string; category: NoteCategory; content: string; pinned: boolean; pending: boolean; stance: string; pattern: boolean; author_role: string;
  support_count: number; recorded_at: Date;
}

const NOTE_COLUMNS = `id, category, content, pinned, pending, stance, 'pattern' = ANY(tags) AS pattern, author_role, support_count, recorded_at`;

function noteView(r: NoteRow) {
  return { id: r.id, category: r.category, content: r.content, pinned: r.pinned, pending: r.pending, inferred: r.stance === 'inferred',
    pattern: r.pattern, authorRole: r.author_role, supportCount: r.support_count, recordedAt: (r.recorded_at as Date).toISOString() };
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

  /** Who reads through this API: the account itself (D52). */
  private reader(memoryId: string, now = new Date()): Promise<Reader> {
    return readerOf(this.db, memoryId, undefined, now);
  }

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
    const where = [`e.memory_id = $1`, VISIBLE, episodeVisible('e', await this.reader(memoryId, now))];
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
    const reader = await this.reader(memoryId, now);
    const [row]: EpisodeRow[] = await this.db.query(
      `SELECT e.* FROM episodes e WHERE e.id = $1 AND e.memory_id = $2 AND e.deleted_at IS NULL AND ${episodeVisible('e', reader)}`, [id, memoryId]);
    if (!row) throw new NotFoundException();
    const [item] = await this.items([row], o, now) as [EpisodeItem];
    const [client] = await this.db.query(`SELECT raw_log_scope FROM clients WHERE id = $1`, [clientId]);
    const evidence: EvidenceRow[] = await this.db.query(
      `SELECT ev.evidence_kind, m.id AS message_id, m.role, m.content, m.sent_at, c.external_id AS conversation,
              COALESCE(p.display_name, cp.display_name) AS author, (c.client_id = $2) AS own
       FROM episode_evidence ev JOIN messages m ON m.id = ev.message_id JOIN conversations c ON c.id = m.conversation_id
       LEFT JOIN persons p ON p.id = m.author_person_id
       LEFT JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.ref = m.author_ref
       WHERE ev.episode_id = $1 AND ${messageVisible('m', reader)} ORDER BY m.sent_at`, [id, clientId]);
    const history: HistoryRow[] = await this.db.query(
      `WITH RECURSIVE prev AS (
         SELECT id, content, occurred_at, date_precision, recorded_at, corrects FROM episodes WHERE id = (SELECT corrects FROM episodes WHERE id = $1)
         UNION ALL
         SELECT e.id, e.content, e.occurred_at, e.date_precision, e.recorded_at, e.corrects FROM episodes e JOIN prev ON e.id = prev.corrects)
       SELECT id, content, occurred_at, date_precision, recorded_at FROM prev WHERE ${episodeVisible('prev', reader)}`, [id]);
    const planEvents: PlanEventRow[] = row.kind === 'plan'
      ? await this.db.query(`SELECT patch, note, created_at FROM plan_events WHERE plan_id = $1 ORDER BY created_at`, [id]) : [];
    const linked = async (linkId: string | null) => {
      if (!linkId) return null;
      const [l]: EpisodeRow[] = await this.db.query(
        `SELECT e.* FROM episodes e WHERE e.id = $1 AND e.memory_id = $2 AND e.deleted_at IS NULL AND ${episodeVisible('e', reader)}`, [linkId, memoryId]);
      return l ? (await this.items([l], o, now))[0] : null;
    };
    const showAll = client?.raw_log_scope === 'all';
    return {
      ...item,
      evidence: evidence.map((e) => (e.own || showAll
        ? { messageId: e.message_id, conversation: e.conversation, role: e.role, author: e.author, sentAt: (e.sent_at as Date).toISOString(), text: e.content, kind: e.evidence_kind }
        : { role: e.role, sentAt: (e.sent_at as Date).toISOString(), kind: e.evidence_kind, otherClient: true as const })),
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
         AND ${factVisible('f', await this.reader(memoryId, now))}
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

  async cards(memoryId: string): Promise<Cards> {
    const cards = await buildCards(this.db, memoryId, await this.reader(memoryId));
    if (!cards) throw new NotFoundException();
    return cards;
  }

  async notes(memoryId: string, query: { category?: string; pinned?: boolean; includePending?: boolean }) {
    await this.memory(memoryId);
    const params: unknown[] = [memoryId, query.includePending ?? false];
    const extra = [
      query.category ? `AND category = $${params.push(query.category)}` : '',
      query.pinned !== undefined ? `AND pinned = $${params.push(query.pinned)}` : '',
    ].join(' ');
    const rows: NoteRow[] = await this.db.query(
      `SELECT ${NOTE_COLUMNS} FROM notes
       WHERE memory_id = $1 AND status = 'current' AND deleted_at IS NULL AND ($2::boolean OR NOT pending) ${extra}
         AND ${noteVisible('notes', await this.reader(memoryId))}
       ORDER BY pinned DESC, recorded_at DESC`, params);
    return rows.map(noteView);
  }

  /** Plans, soonest first (open and unresolved by default). */
  async plans(memoryId: string, query: { status?: PlanStatus }, now: Date): Promise<EpisodeItem[]> {
    const o = await this.memory(memoryId);
    const rows: EpisodeRow[] = await this.db.query(
      `SELECT e.* FROM episodes e WHERE e.memory_id = $1 AND ${VISIBLE} AND e.kind = 'plan' AND ${episodeVisible('e', await this.reader(memoryId, now))}
       ORDER BY e.occurred_at NULLS LAST, e.recorded_at`, [memoryId]);
    const items = await this.items(rows, o, now);
    return items.filter((i) => (query.status ? i.planStatus === query.status : i.planStatus === 'open' || i.planStatus === 'unresolved'));
  }

  // ── The person's own edits ───────────────────────────────────────────────────

  async pinNote(memoryId: string, id: string, pinned: boolean): Promise<void> {
    const [, n] = await this.db.query(`UPDATE notes SET pinned = $3 WHERE id = $1 AND memory_id = $2 AND deleted_at IS NULL`, [id, memoryId, pinned]);
    if (!n) throw new NotFoundException();
  }

  /**
   * Deletes a fact or a note and leaves a tombstone (WORK_PLAN 4.13): a re-extraction of the same messages (an edit, a
   * re-run) must not write it again. Ids only: the slot key or note category, the subject and the evidence messages
   * (also those behind evidence episodes). Without evidence messages (a note the agent was told to remember) none.
   */
  async deleteRow(memoryId: string, table: 'notes' | 'facts', id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [item]: Array<{ item_key: string; subject_person_id: string | null }> = await tx.query(
        `SELECT ${table === 'facts' ? 'key' : 'category::text'} AS item_key, subject_person_id FROM ${table} WHERE id = $1 AND memory_id = $2`,
        [id, memoryId]);
      if (!item) throw new NotFoundException();
      const evidence = table === 'facts' ? 'fact_evidence' : 'note_evidence';
      const owner = table === 'facts' ? 'fact_id' : 'note_id';
      const [row]: Array<{ ids: string[] }> = await tx.query(
        `SELECT coalesce(array_agg(DISTINCT m), '{}') AS ids FROM (
           SELECT message_id AS m FROM ${evidence} WHERE ${owner} = $1 AND message_id IS NOT NULL
           UNION SELECT ee.message_id FROM ${evidence} x JOIN episode_evidence ee ON ee.episode_id = x.episode_id WHERE x.${owner} = $1) s`,
        [id]);
      const ids = row?.ids ?? [];
      if (ids.length) {
        await tx.query(`INSERT INTO forget_tombstones (memory_id, scope, item_key, subject_person_id, message_ids) VALUES ($1, $2, $3, $4, $5)`,
          [memoryId, table === 'facts' ? 'fact' : 'note', item.item_key, item.subject_person_id, ids]);
      }
      await tx.query(`DELETE FROM ${table} WHERE id = $1 AND memory_id = $2`, [id, memoryId]);
      if (table === 'notes') await tx.query(`INSERT INTO note_changes (memory_id, note_id, change) VALUES ($1, $2, 'forgotten')`, [memoryId, id]);
    });
  }

  /** A pending (inferred) fact or note the person confirms becomes theirs; rejected, it is removed. */
  async decide(memoryId: string, table: 'notes' | 'facts', id: string, confirm: boolean): Promise<void> {
    if (!confirm) return this.deleteRow(memoryId, table, id);
    if (!(await this.db.transaction((tx) => confirmPending(tx, table, id, memoryId)))) throw new NotFoundException();
  }

  /**
   * One fact with its slot's history and its evidence (WORK_PLAN 4.7): the messages behind it (text only from the
   * client's own conversations unless its `raw_log_scope` is `all`, as for episodes) and the episodes it was drawn from.
   */
  async fact(memoryId: string, clientId: string, id: string) {
    const o = await this.memory(memoryId);
    const reader = await this.reader(memoryId);
    const [f]: Array<FactRow & { subject_person_id: string | null; corrects: string | null; recorded_at: Date }> = await this.db.query(
      `SELECT f.id, f.key, f.value, f.status, f.valid_from, f.valid_to, f.pending, f.stance, f.author_role, f.subject_person_id, f.corrects,
         f.recorded_at, s.display_name AS about
       FROM facts f LEFT JOIN persons s ON s.id = f.subject_person_id
       WHERE f.id = $1 AND f.memory_id = $2 AND f.deleted_at IS NULL AND ${factVisible('f', reader)}`, [id, memoryId]);
    if (!f) throw new NotFoundException();
    const history: FactRow[] = await this.db.query(
      `SELECT id, key, value, status, valid_from, valid_to, pending, stance, author_role FROM facts
       WHERE memory_id = $1 AND key = $2 AND subject_person_id IS NOT DISTINCT FROM $3 AND deleted_at IS NULL AND ${factVisible('facts', reader)}
       ORDER BY valid_from NULLS FIRST, recorded_at`, [memoryId, f.key, f.subject_person_id]);
    const day = (d: Date | null) => (d ? localDate(d, o.tz) : null);
    return {
      id: f.id, ...(f.about ? { about: f.about } : {}), key: f.key, value: f.value,
      status: f.status === 'unknown_current' ? 'unknown' : f.status, validFrom: day(f.valid_from), validTo: day(f.valid_to),
      pending: f.pending, inferred: f.stance === 'inferred', authorRole: f.author_role, corrects: f.corrects,
      recordedAt: f.recorded_at.toISOString(),
      history: history.map((r) => ({ id: r.id, value: r.value, from: day(r.valid_from), to: day(r.valid_to), status: r.status })),
      ...(await this.itemEvidence('facts', id, clientId, reader)),
    };
  }

  /** One note (any status) with its evidence, as `fact`. */
  async note(memoryId: string, clientId: string, id: string) {
    await this.memory(memoryId);
    const reader = await this.reader(memoryId);
    const [n]: Array<NoteRow & { status: NoteStatus; supersedes: string | null; corrects: string | null }> = await this.db.query(
      `SELECT ${NOTE_COLUMNS}, status::text, supersedes, corrects FROM notes
       WHERE id = $1 AND memory_id = $2 AND deleted_at IS NULL AND ${noteVisible('notes', reader)}`, [id, memoryId]);
    if (!n) throw new NotFoundException();
    return { ...noteView(n), status: n.status, supersedes: n.supersedes, corrects: n.corrects, ...(await this.itemEvidence('notes', id, clientId, reader)) };
  }

  private async itemEvidence(table: 'facts' | 'notes', id: string, clientId: string, reader: Reader) {
    const [client] = await this.db.query(`SELECT raw_log_scope FROM clients WHERE id = $1`, [clientId]);
    const showAll = client?.raw_log_scope === 'all';
    const x = table === 'facts' ? 'fact_evidence' : 'note_evidence';
    const owner = table === 'facts' ? 'fact_id' : 'note_id';
    const messages: Array<Omit<EvidenceRow, 'evidence_kind'>> = await this.db.query(
      `SELECT m.id AS message_id, m.role, m.content, m.sent_at, c.external_id AS conversation,
              COALESCE(p.display_name, cp.display_name) AS author, (c.client_id = $2) AS own
       FROM ${x} ev JOIN messages m ON m.id = ev.message_id JOIN conversations c ON c.id = m.conversation_id
       LEFT JOIN persons p ON p.id = m.author_person_id
       LEFT JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.ref = m.author_ref
       WHERE ev.${owner} = $1 AND ${messageVisible('m', reader)} ORDER BY m.sent_at`, [id, clientId]);
    const episodes: Array<{ episode_id: string }> = await this.db.query(
      `SELECT episode_id FROM ${x} WHERE ${owner} = $1 AND episode_id IS NOT NULL`, [id]);
    return {
      evidence: messages.map((e) => (e.own || showAll
        ? { messageId: e.message_id, conversation: e.conversation, role: e.role, author: e.author, sentAt: (e.sent_at as Date).toISOString(), text: e.content }
        : { role: e.role, sentAt: (e.sent_at as Date).toISOString(), otherClient: true as const })),
      episodeIds: episodes.map((e) => e.episode_id),
    };
  }

  /**
   * The notes change feed (D34, WORK_PLAN 4.3): every change after `since`, oldest first, for clients keeping a copy
   * (Arkimede → A-MEM). Each entry carries the note as it is now — null once it is forgotten (only its id is kept) — and
   * `replaces`: the note an `updated` or `corrected` one took the place of, so a copy of the old one can follow it.
   */
  async noteChanges(memoryId: string, query: { since?: number; limit?: number }) {
    await this.memory(memoryId);
    const limit = query.limit ?? 100;
    const rows: Array<{ seq: string; note_id: string; change: NoteChangeKind; at: Date }> = await this.db.query(
      `SELECT seq::text, note_id, change::text, at FROM note_changes WHERE memory_id = $1 AND seq > $2 ORDER BY seq LIMIT $3`,
      [memoryId, query.since ?? 0, limit]);
    const notes: Array<NoteRow & { status: NoteStatus }> = rows.length ? await this.db.query(
      `SELECT ${NOTE_COLUMNS}, status::text FROM notes WHERE id = ANY($1) AND memory_id = $2 AND deleted_at IS NULL
         AND ${noteVisible('notes', await this.reader(memoryId))}`,
      [[...new Set(rows.map((r) => r.note_id))], memoryId]) : [];
    const byId = new Map(notes.map((n) => [n.id, { ...noteView(n), status: n.status }]));
    // Read apart from the note: a forgotten note keeps what it replaced.
    const links: Array<{ id: string; replaces: string | null }> = rows.length ? await this.db.query(
      `SELECT id, coalesce(corrects, supersedes) AS replaces FROM notes WHERE id = ANY($1) AND memory_id = $2`,
      [[...new Set(rows.map((r) => r.note_id))], memoryId]) : [];
    const replaces = new Map(links.map((l) => [l.id, l.replaces]));
    const last = rows.at(-1);
    return {
      items: rows.map((r) => ({ seq: Number(r.seq), noteId: r.note_id, change: r.change, at: r.at.toISOString(),
        replaces: r.change === 'updated' || r.change === 'corrected' ? replaces.get(r.note_id) ?? null : null, note: byId.get(r.note_id) ?? null })),
      // Ask again from here; equal to `since` when nothing new.
      next: last ? Number(last.seq) : (query.since ?? 0),
      more: rows.length === limit,
    };
  }
}
