// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Intents and initiatives (D53, WORK_PLAN 8.12c): the agent's own things to do, and what it decides to say or do about
 * them, pushed to the clients. This first cut needs no model (the economy level): the intents come from what the memory
 * already holds —
 * - an open plan past its date: an `ask` ("did it happen?") the day after, kept for a week;
 * - no reminder of a plan nobody asked to be reminded of (the maintainer's rule, 2026-11-03: a reminder only when asked —
 *   a request, or a promise of mine; "tomorrow Chloé has a test" is told, not asked);
 * - a question the agent holds (a thought of kind `question`): a `lookup` for the host agent, kept two weeks.
 * An intent is armed once per source (a plan asked about once, a question looked up once); it fires when due, outside
 * the memory's quiet hours and within the daily limit per person; what the client reports steers it (declined →
 * cancelled; ignored → asked again a week later, then cancelled; nobody came in time → expired, quietly — the maintainer's
 * rule: speak when someone who can answer is there, and presence is the host's knowledge). Private plans are left alone
 * (D52: an initiative addresses a person; a private plan would be told to the wrong one). All SQL is parameterised; the
 * only interpolations are constant column lists and the privacy predicate.
 */
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, type EntityManager } from 'typeorm';
import { type Env } from '../config/env';
import { LLM_PORT, type LlmPort } from '../llm/llm.port';
import { qualityProfile, type QualityProfileName } from '../engine/quality-profile';
import { localDate, type Precision } from '../engine/time';
import { INITIATIVE_SYSTEM, INITIATIVE_VERSION, type InitiativeOutput, initiativeSchema } from './initiative.prompt';
import { initiativeText } from '../lang/initiative';
import { saysRelativeDay } from '../lang/periods';
import { overlap } from '../lang/overlap';
import { episodeVisible, PUBLIC_ONLY } from '../recall/privacy';
import { TelemetryService } from '../telemetry/telemetry.service';
import { WebhooksService } from './webhooks.service';

export type InitiativeKind = 'say' | 'ask' | 'lookup' | 'do';
export type InitiativeStatus = 'pending' | 'offered' | 'said' | 'asked' | 'ignored' | 'declined' | 'done' | 'failed' | 'expired';
export const OUTCOMES = ['said', 'asked', 'ignored', 'declined', 'done', 'failed', 'expired'] as const;
/** Where an initiative reached the person (D55): in a turn (the memory context), a chat, messaging, by voice, on a panel. */
export const DELIVERY_CHANNELS = ['turn', 'chat', 'messaging', 'voice', 'panel'] as const;
export type DeliveryChannel = (typeof DELIVERY_CHANNELS)[number];
export type Reaction = 'positive' | 'neutral' | 'negative';

/** A way to reach a person (D55 §5c): one of their verified identities on a channel — `homeassistant` / `person.chloe`, `telegram` / a chat id. */
export interface Address { channel: string; id: string }

export interface InitiativeView {
  id: string; seq: number; kind: InitiativeKind; for: { personId: string; name: string; addresses: Address[] } | null; text: string; reason: string; worth: number | null;
  episodeIds: string[]; dueAt: string; expiresAt: string; status: InitiativeStatus; outcomeAt: string | null; reply: string | null;
  createdAt: string;
  /** D55: timed (a time was asked for) or flexible (a window, the moment chosen by Recordare). */
  timing: 'timed' | 'flexible';
  window: { notBefore: string; notAfter: string };
  /** Where it was offered, or will be delivered (a client's declared channel); null: at the person's next presence or turn. */
  channel: string | null;
  /** The acceptable channels in order (D55 §5b): the client delivers on the first that reaches the person now. */
  channels: string[];
  /** How surely the person must be recognised before hearing it (D55: medium, or high for what came from a private message). */
  identity: { required: 'medium' | 'high' };
  /** The client's own ids of the messages its intent came from: a host recognises a reminder it scheduled itself. */
  source: { conversation: string; messageIds: string[] } | null;
  offeredAt: string | null;
  /** When Recordare pushed it to its channel (event `initiative.deliver`: deliver it now there). */
  pushedAt: string | null;
}

interface Row {
  id: string; seq: string; kind: InitiativeKind; for_person_id: string | null; for_name: string | null; text: string; reason: string; worth: number | null;
  episode_ids: string[]; due_at: Date; expires_at: Date; status: InitiativeStatus; outcome_at: Date | null; reply: string | null; created_at: Date;
  timing: 'timed' | 'flexible'; identity_required: 'medium' | 'high'; channel: string | null; channels: string[]; offered_at: Date | null;
  for_addresses: Address[] | null;
  source_conversation: string | null; source_messages: string[]; pushed_at: Date | null;
}

const COLUMNS = `i.id, i.seq::text, i.kind::text, i.for_person_id, (SELECT display_name FROM persons WHERE id = i.for_person_id) AS for_name,
  i.text, i.reason, i.worth, i.episode_ids, i.due_at, i.expires_at, i.status::text, i.outcome_at, i.reply, i.created_at,
  i.timing, i.identity_required, i.channel, i.channels, i.offered_at, i.pushed_at,
  (SELECT json_agg(json_build_object('channel', x.channel, 'id', x.external_id) ORDER BY x.created_at) FROM external_identities x
     WHERE x.person_id = i.for_person_id AND x.kind = 'participant' AND x.channel IS NOT NULL AND x.verified_at IS NOT NULL) AS for_addresses,
  (SELECT c.external_id FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE m.id = i.source_message_ids[1]) AS source_conversation,
  ARRAY(SELECT m.external_id FROM messages m WHERE m.id = ANY(i.source_message_ids) ORDER BY m.sent_at) AS source_messages`;

/**
 * The confidence a person must be recognised with (D55), by the initiative's sensitivity: a platform account or a link
 * code is 1; a declared name, a voiceprint or a face comes with the agent's own number.
 */
export const IDENTITY_THRESHOLD: Record<'medium' | 'high', number> = { medium: 0.6, high: 0.85 };

/** Who is there to receive an initiative: an identified person (or the memory's self), with how surely; or nobody known. */
export interface Recipient {
  /** The person recognised (the memory's own id for its self); null: someone not identified. */
  personId: string | null;
  confidence: number;
  /** The conversation the person is talking in (a turn), when there is one. */
  conversationId?: string;
}

/** How far back a past plan is still asked about, how far ahead a plan is reminded of; the ask waits two days after the
 * plan's end — people tell how it went the day after on their own, and asking first is a nag. */
/**
 * The local days an intent may be said on: from its due day (today at the earliest) to the last before it lapses. A
 * timed request or promise is said at the moment the person chose (pushed then, quiet hours or not): that day alone.
 */
function sayDays(t: { kind: string; timed: boolean; due_at: Date; expires_at: Date }, now: Date, tz: string): { from: string; to: string } {
  const from = localDate(t.due_at > now ? t.due_at : now, tz);
  return { from, to: t.timed && (t.kind === 'request' || t.kind === 'promise') ? from : localDate(new Date(t.expires_at.getTime() - 1), tz) };
}

const ASK_BACK_DAYS = 30;
const ASK_AFTER_DAYS = 2;
const ASK_KEEP_DAYS = 7;
const LOOKUP_KEEP_DAYS = 14;
/** An ignored initiative is asked again after this, then no more. */
const RETRY_AFTER_DAYS = 7;
const MAX_ATTEMPTS = 2;
const DAY_MS = 86_400_000;
/** Below this worth (the model's, balanced and full) an initiative is not said — and its intent is dropped, not postponed. */
const WORTH_FLOOR = 0.3;

/** The rows of an UPDATE … RETURNING as TypeORM hands them back (`[rows, count]`). */
function updated<T>(res: unknown): T[] {
  return Array.isArray(res) && Array.isArray(res[0]) ? (res[0] as T[]) : (res as T[]);
}

export function view(r: Row): InitiativeView {
  return {
    id: r.id, seq: Number(r.seq), kind: r.kind,
    for: r.for_person_id ? { personId: r.for_person_id, name: r.for_name ?? '', addresses: r.for_addresses ?? [] } : null,
    text: r.text, reason: r.reason, worth: r.worth, episodeIds: r.episode_ids, dueAt: r.due_at.toISOString(), expiresAt: r.expires_at.toISOString(),
    status: r.status, outcomeAt: r.outcome_at?.toISOString() ?? null, reply: r.reply, createdAt: r.created_at.toISOString(),
    timing: r.timing, window: { notBefore: r.due_at.toISOString(), notAfter: r.expires_at.toISOString() }, channel: r.channel, channels: r.channels,
    identity: { required: r.identity_required },
    source: r.source_conversation ? { conversation: r.source_conversation, messageIds: r.source_messages } : null,
    offeredAt: r.offered_at?.toISOString() ?? null,
    pushedAt: r.pushed_at?.toISOString() ?? null,
  };
}

/**
 * Timing v0 (D55 F2a; RESEARCH_NOTES H14): the clock's decision to push an initiative now on a channel that always
 * reaches the person — an explicit cost-sensitive gate (PRISM-like): deliver when p ≥ the kind's threshold. A timed one
 * is pushed at its time (within a grace); a flexible one when p = prior (the model's worth, or a default) × the fit of the
 * hour (the kind's preferred local hours) × fatigue (what this person already got today) passes the threshold; an owed
 * one (a request, a promise) at the last chance before its window ends. Constants are a first guess, logged with every
 * decision so the learner (F4) replaces them.
 */
export const TIMING = {
  timedPushGraceMs: 2 * 3_600_000,
  lastChanceMs: 2 * 3_600_000,
  preferred: { say: [9, 21], ask: [10, 20], do: [9, 21], lookup: [0, 24] } as Record<InitiativeKind, [number, number]>,
  threshold: { say: 0.5, ask: 0.6, do: 0.6, lookup: 0.5 } as Record<InitiativeKind, number>,
  defaultPrior: 0.7,
  offHoursFit: 0.3,
};

export interface MomentInput {
  kind: InitiativeKind;
  timing: 'timed' | 'flexible';
  worth: number | null;
  /** A request they made or a promise I made: owed, so not left to lapse. */
  owed: boolean;
  localHour: number;
  preferred: [number, number];
  deliveredToday: number;
  sinceDueMs: number;
  untilEndMs: number;
}

export function decideMoment(m: MomentInput): { p: number; threshold: number; deliver: boolean; reason: string } {
  const threshold = TIMING.threshold[m.kind];
  if (m.timing === 'timed') {
    const p = m.sinceDueMs >= 0 && m.sinceDueMs < TIMING.timedPushGraceMs ? 1 : 0;
    return { p, threshold, deliver: p >= threshold, reason: p ? 'timed' : 'timed_missed' };
  }
  const [from, to] = m.preferred;
  const fits = from <= to ? m.localHour >= from && m.localHour < to : m.localHour >= from || m.localHour < to;
  const p = Math.min(1, Math.max(0, (m.worth ?? TIMING.defaultPrior) * (fits ? 1 : TIMING.offHoursFit) / (1 + m.deliveredToday)));
  if (p >= threshold) return { p, threshold, deliver: true, reason: 'moment' };
  if (m.owed && m.untilEndMs <= TIMING.lastChanceMs) return { p, threshold, deliver: true, reason: 'last_chance' };
  return { p, threshold, deliver: false, reason: fits ? 'low' : 'off_hours' };
}

@Injectable()
export class InitiativeService {
  private readonly log = new Logger(InitiativeService.name);

  constructor(
    private readonly db: DataSource,
    private readonly config: ConfigService<Env, true>,
    private readonly webhooks: WebhooksService,
    private readonly telemetry: TelemetryService,
    @Inject(LLM_PORT) private readonly llm: LlmPort,
  ) {}

  /** Every memory with something that could be due: arm, fire, expire. Hourly (the initiative processor) and on demand. */
  async sweepAll(now: Date): Promise<void> {
    const memories: Array<{ person_id: string }> = await this.db.query(
      `SELECT o.person_id FROM memories o WHERE EXISTS (SELECT 1 FROM episodes e WHERE e.memory_id = o.person_id AND e.kind IN ('plan', 'event'))
         OR EXISTS (SELECT 1 FROM notes n WHERE n.memory_id = o.person_id AND n.category = 'question')
         OR EXISTS (SELECT 1 FROM intents t WHERE t.memory_id = o.person_id AND t.status IN ('armed', 'fired'))
         -- what was given or waits to be (D55): settled, pushed or lapsed even when no intent is open any more
         OR EXISTS (SELECT 1 FROM initiatives i WHERE i.memory_id = o.person_id AND i.status IN ('pending', 'offered'))`);
    for (const { person_id } of memories) {
      try { await this.sweep(person_id, now); } catch (err) { this.log.warn(`initiative sweep failed for ${person_id}: ${(err as Error).name}`); }
    }
  }

  async sweep(memoryId: string, now: Date): Promise<{ armed: number; fired: number; expired: number }> {
    const armed = await this.arm(memoryId, now);
    await this.settle(memoryId, now);
    const expired = await this.expire(memoryId, now);
    const fired = await this.fire(memoryId, now);
    await this.push(memoryId, now);
    return { armed, fired, expired };
  }

  /** Intents from what the memory holds; sources that moved on (a plan confirmed or cancelled, a question retired) close theirs. */
  private async arm(memoryId: string, now: Date): Promise<number> {
    let armed = 0;
    // Plans, and events told ahead of their day ("tomorrow Chloé has her geometry test": an appointment, recorded as an event).
    const plans: Array<{ id: string; kind: string; content: string; occurred_at: Date; ends_at: Date; date_precision: Precision; subject_person_id: string | null; past: boolean }> = await this.db.query(
      `SELECT e.id, e.kind::text, e.content, e.occurred_at, COALESCE(e.occurred_until, e.occurred_at) AS ends_at, e.date_precision::text,
         CASE WHEN e.subject_kind = 'contact' THEN e.subject_person_id END AS subject_person_id,
         e.occurred_at < $2 AS past
       FROM episodes e
       WHERE e.memory_id = $1 AND e.deleted_at IS NULL AND e.invalidated_at IS NULL AND e.duplicate_of IS NULL
         AND (e.kind = 'plan' OR (e.kind = 'event' AND EXISTS (SELECT 1 FROM episode_evidence pv JOIN messages pm ON pm.id = pv.message_id
           WHERE pv.episode_id = e.id AND pm.sent_at < e.occurred_at)))
         AND e.occurred_at IS NOT NULL AND e.author_role <> 'tool' AND e.origin <> 'assistant_stated'
         AND (e.kind = 'event' OR e.plan_status IN ('open', 'confirmed'))
         AND COALESCE(e.occurred_until, e.occurred_at) < $2::timestamptz - make_interval(days => $4) AND e.occurred_at > $2::timestamptz - make_interval(days => $3)
         AND ${episodeVisible('e', PUBLIC_ONLY)}
         -- a plan nobody told ahead of its day is a decision, not an appointment: nothing to ask "how did it go" about
         AND NOT (e.occurred_at < $2 AND EXISTS (SELECT 1 FROM episode_evidence pv WHERE pv.episode_id = e.id)
           AND NOT EXISTS (SELECT 1 FROM episode_evidence pv JOIN messages pm ON pm.id = pv.message_id WHERE pv.episode_id = e.id AND pm.sent_at < e.occurred_at))
         -- a plan confirmed by a telling at or after its start: they said how it went, nothing to ask
         AND NOT (e.occurred_at < $2 AND EXISTS (SELECT 1 FROM plan_events pe JOIN messages pm ON pm.id = pe.evidence_message_id
           WHERE pe.plan_id = e.id AND pe.patch = 'confirm' AND pm.sent_at >= e.occurred_at AND pm.sent_at <= $2))`, [memoryId, now, ASK_BACK_DAYS, ASK_AFTER_DAYS]);
    // A request or a promise about the same thing, for the same person, around the same days: that one speaks, not the plan.
    const owed: Array<{ content: string; for_person_id: string | null; due_at: Date }> = plans.length ? await this.db.query(
      `SELECT content, for_person_id, due_at FROM intents WHERE memory_id = $1 AND kind IN ('promise', 'request')`, [memoryId]) : []; // any state: said, lapsed or withdrawn, it was the one
    // An appointment told as an event has no outcome patch: a later episode of the same person on the same thing is its outcome.
    const after: Array<{ id: string; subject_person_id: string | null; content: string; occurred_at: Date }> = plans.some((p) => p.kind === 'event' && p.past)
      ? await this.db.query(`SELECT id, CASE WHEN subject_kind = 'contact' THEN subject_person_id END AS subject_person_id, content, occurred_at
          FROM episodes WHERE memory_id = $1 AND kind = 'event' AND deleted_at IS NULL AND occurred_at > $2::timestamptz - make_interval(days => $3)
            AND occurred_at <= $2`, [memoryId, now, ASK_BACK_DAYS]) : [];
    for (const p of plans) {
      if (p.kind === 'event' && p.past && after.some((a) => a.id !== p.id && a.subject_person_id === p.subject_person_id
        && a.occurred_at >= p.occurred_at && overlap(a.content, p.content))) continue;
      if (owed.some((o) => o.for_person_id === p.subject_person_id && Math.abs(o.due_at.getTime() - p.occurred_at.getTime()) < 3 * DAY_MS && overlap(o.content, p.content))) continue;
      const kind = 'open_plan';
      const due = new Date(p.ends_at.getTime() + ASK_AFTER_DAYS * DAY_MS);
      const expires = new Date(due.getTime() + ASK_KEEP_DAYS * DAY_MS);
      const r = await this.db.query(
        `INSERT INTO intents (memory_id, kind, content, for_person_id, episode_id, due_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (episode_id, kind) WHERE episode_id IS NOT NULL DO NOTHING RETURNING id`,
        [memoryId, kind, p.content, p.subject_person_id, p.id, due, expires]);
      armed += r.length;
    }
    // A question the agent holds becomes a look-up — unless it asks about the outcome of a plan (the ask the day after
    // covers it), or the question it supersedes (the thought pass revised it) was already looked up.
    const questions: Array<{ id: string; content: string; subject: string | null }> = await this.db.query(
      `SELECT n.id, n.content, CASE WHEN n.subject_kind = 'contact' THEN n.subject_person_id END AS subject FROM notes n
       WHERE n.memory_id = $1 AND n.category = 'question' AND n.status = 'current' AND n.deleted_at IS NULL AND NOT n.pending
         -- a question about an open plan's outcome is the ask after its day; once the plan is confirmed, asking more is fine
         AND NOT EXISTS (SELECT 1 FROM note_evidence x JOIN episodes e ON e.id = x.episode_id WHERE x.note_id = n.id AND e.kind = 'plan' AND e.plan_status = 'open')
         -- a question about my own doings (it rests on my replies: did I keep my promise?) is no look-up for the host
         AND NOT EXISTS (SELECT 1 FROM note_evidence x JOIN messages m ON m.id = x.message_id WHERE x.note_id = n.id AND m.role = 'assistant')
         AND NOT EXISTS (SELECT 1 FROM intents t WHERE t.kind IN ('lookup', 'own') AND t.note_id = n.supersedes)
         AND NOT EXISTS (SELECT 1 FROM intents t WHERE t.kind IN ('lookup', 'own') AND t.note_id = n.id)`, [memoryId]);
    const [mem]: Array<{ mode: string }> = questions.length ? await this.db.query(`SELECT mode FROM memories WHERE person_id = $1`, [memoryId]) : [];
    for (const q of questions) {
      // D55 F2b: whom to ask. A question about the world goes to the agent's tools (a look-up); one about a person to
      // someone who could know — that person when they talk to me, else whoever told me most about them (the holder of a
      // personal memory, an identified contact in an entity memory); nobody to ask: not asked. One question at a time
      // for each person.
      const to = q.subject ? await this.answerer(memoryId, q.subject, mem?.mode === 'entity') : null;
      if (q.subject && to === undefined) continue;
      if (to !== null && to !== undefined) {
        const [busy] = await this.db.query(
          `SELECT 1 FROM intents WHERE memory_id = $1 AND kind = 'own' AND status IN ('armed', 'fired') AND for_person_id IS NOT DISTINCT FROM $2`,
          [memoryId, to === 'holder' ? null : to]);
        if (busy) continue;
      }
      const r = await this.db.query(
        `INSERT INTO intents (memory_id, kind, content, for_person_id, note_id, due_at, expires_at) VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (note_id, kind) WHERE note_id IS NOT NULL DO NOTHING RETURNING id`,
        [memoryId, q.subject ? 'own' : 'lookup', q.content, to && to !== 'holder' ? to : null, q.id, now, new Date(now.getTime() + LOOKUP_KEEP_DAYS * DAY_MS)]);
      armed += r.length;
    }
    // A source that moved on closes its intent: the plan confirmed, cancelled or rescheduled; the question answered or forgotten.
    await this.db.query(
      `UPDATE intents t SET status = 'done', updated_at = now() FROM episodes e
       WHERE t.memory_id = $1 AND t.status IN ('armed', 'fired') AND t.episode_id = e.id
         AND ((t.kind = 'open_plan' AND e.plan_status NOT IN ('open', 'confirmed'))
              OR e.deleted_at IS NOT NULL OR e.invalidated_at IS NOT NULL)`, [memoryId]);
    await this.db.query(
      `UPDATE intents t SET status = 'done', updated_at = now() FROM notes n
       WHERE t.memory_id = $1 AND t.status IN ('armed', 'fired') AND t.note_id = n.id AND (n.status <> 'current' OR n.deleted_at IS NOT NULL)`, [memoryId]);
    return armed;
  }

  /**
   * Who could answer a question about `subject` (D55 F2b): the subject when they talk to me (a message of theirs in this
   * memory); else whoever told me most about them — 'holder' (a personal memory's own turns) or an identified contact; in
   * an entity memory only an identified contact. undefined: nobody to ask.
   */
  private async answerer(memoryId: string, subject: string, entity: boolean): Promise<string | 'holder' | undefined> {
    const [talks] = await this.db.query(
      `SELECT 1 FROM messages WHERE memory_id = $1 AND author_kind = 'contact' AND author_person_id = $2 LIMIT 1`, [memoryId, subject]);
    if (talks) return subject;
    const [teller]: Array<{ who: string }> = await this.db.query(
      `SELECT CASE WHEN m.author_kind = 'self' THEN 'holder' ELSE m.author_person_id::text END AS who
       FROM episodes e JOIN episode_evidence v ON v.episode_id = e.id JOIN messages m ON m.id = v.message_id
       WHERE e.memory_id = $1 AND e.subject_person_id = $2 AND e.deleted_at IS NULL
         AND ((m.author_kind = 'self' AND NOT $3) OR (m.author_kind = 'contact' AND m.author_person_id IS NOT NULL AND m.author_person_id <> $2))
       GROUP BY 1 ORDER BY count(*) DESC, 1 LIMIT 1`, [memoryId, subject, entity]);
    return teller?.who;
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
    const [memory]: Array<{ timezone: string; locale: string; quiet_from: number; quiet_to: number; quality_profile: string | null; display_name: string; mode: string }> = await this.db.query(
      `SELECT o.timezone, o.locale, o.quiet_from, o.quiet_to, o.quality_profile, o.mode, p.display_name FROM memories o JOIN persons p ON p.id = o.person_id WHERE o.person_id = $1`, [memoryId]);
    if (!memory) return 0;
    const due: Array<{ id: string; kind: string; content: string; for_person_id: string | null; for_name: string | null; episode_id: string | null; note_id: string | null; expires_at: Date; due_at: Date; occurred_at: Date | null;
      timed: boolean; message_id: string | null; private: boolean; note_subject: string | null }> =
      await this.db.query(
        `SELECT t.id, t.kind::text, t.content, t.for_person_id, (SELECT display_name FROM persons WHERE id = t.for_person_id) AS for_name,
           t.episode_id, t.note_id, t.expires_at, t.due_at, e.occurred_at, t.timed, t.message_id,
           COALESCE((SELECT m.private FROM messages m WHERE m.id = t.message_id), false) AS private,
           (SELECT CASE WHEN n.subject_kind = 'contact' THEN n.subject_person_id END FROM notes n WHERE n.id = t.note_id) AS note_subject
         FROM intents t LEFT JOIN episodes e ON e.id = t.episode_id
         WHERE t.memory_id = $1 AND t.status = 'armed' AND t.due_at <= $2 AND (t.reconsider_at IS NULL OR t.reconsider_at <= $2)
         ORDER BY t.due_at`, [memoryId, now]);
    if (!due.length) return 0;
    const text = initiativeText(memory.locale);
    const channels = await this.declaredChannels(memoryId);
    const day = (d: Date) => new Intl.DateTimeFormat(memory.locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: memory.timezone }).format(d);
    const when = afterQuiet(now, memory.timezone, memory.quiet_from, memory.quiet_to);
    const limit = this.config.get('INITIATIVE_DAILY_LIMIT', { infer: true }) ?? 3; // counted on the day they are due (the memory's clock)
    const profile = qualityProfile(memory.quality_profile, this.config.get('QUALITY_PROFILE', { infer: true }) as QualityProfileName,
      undefined, undefined, undefined, undefined, undefined, undefined, this.config.get('INITIATIVE_WORDING', { infer: true }));
    const worded = profile.initiativeWording ? await this.word(memoryId, memory, due, now)
      : new Map<string, { text: string | null; worth: number; skip: boolean; hours: [number, number] | null }>();
    let fired = 0;
    for (const t of due) {
      // A time the person chose (a timed request or promise) is kept, quiet hours or not: they asked for that moment.
      const at = t.timed && (t.kind === 'request' || t.kind === 'promise') ? now : when;
      if (t.expires_at <= at) continue; // due only after it lapses: left to expire
      const w = worded.get(t.id);
      if (w && (w.skip || w.worth < WORTH_FLOOR)) {
        // Not worth saying: dropped, not postponed (a request or a promise is never skipped: the prompt says so, the code too).
        if (t.kind === 'promise' || t.kind === 'request') { /* owed: said anyway */ } else {
          await this.db.query(`UPDATE intents SET status = 'cancelled', updated_at = now() WHERE id = $1`, [t.id]);
          this.telemetry.emit({ type: 'initiative.outcome', memoryId, id: t.id, status: 'not_worth' });
          continue;
        }
      }
      const counted: Array<{ n: number }> = await this.db.query(
        `SELECT count(*)::int AS n FROM initiatives WHERE memory_id = $1 AND for_person_id IS NOT DISTINCT FROM $2
           AND (due_at AT TIME ZONE $3)::date = ($4::timestamptz AT TIME ZONE $3)::date`, [memoryId, t.for_person_id, memory.timezone, when]);
      if ((counted[0]?.n ?? 0) >= limit) continue; // the day's share is spent: tomorrow
      const plan = t.content.trim().replace(/([^.!?])$/, '$1.');
      const [kind, fallback, reason] = t.kind === 'open_plan' ? ['ask', text.askPlan(plan, day(t.occurred_at!)), 'a plan past its date without an outcome']
          : t.kind === 'lookup' ? ['lookup', text.lookup(t.content), 'a question I hold']
            // A follow-up's content is already the question, in the memory's language (the extraction wrote it so).
            : t.kind === 'followup' ? ['ask', t.content.trim(), 'something they left unfinished']
              // A question of mine for someone who could know (D55 F2b): the question as the thought pass wrote it.
              : t.kind === 'own' ? ['ask', t.content.trim(), 'a question I hold, for someone who could know']
            : ['say', text.remindPlan(plan, day(t.due_at)), t.kind === 'promise' ? 'a promise I made' : 'a request they made to me'];
      // A day relative to now ("yesterday") is true only today: in a text that may be said on a later day (an ask, a
      // look-up: days of window), the service's own sentence, which names the day.
      const said = w?.text?.trim();
      const days = sayDays(t, now, memory.timezone);
      const todayOnly = days.from === days.to && days.from === localDate(now, memory.timezone);
      const content = said && (todayOnly || !saysRelativeDay(said)) ? said : fallback;
      const acceptable = acceptableChannels(kind as InitiativeKind, t.kind);
      const rows: Row[] = await this.db.transaction(async (tx: EntityManager) => {
        const inserted: Row[] = await tx.query(
          `WITH i AS (INSERT INTO initiatives (memory_id, intent_id, kind, for_person_id, text, reason, episode_ids, due_at, expires_at, worth,
               timing, identity_required, channel, source_message_ids, preferred_from, preferred_to, channels)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *)
           SELECT ${COLUMNS} FROM i`,
          [memoryId, t.id, kind, t.for_person_id, content, reason, t.episode_id ? [t.episode_id] : [], t.due_at > at ? t.due_at : at, t.expires_at, w?.worth ?? null,
            // High: from a private message, or a question about someone asked to another person (it tells what I know of them).
            t.timed ? 'timed' : 'flexible', t.private || (t.kind === 'own' && t.for_person_id && t.note_subject !== t.for_person_id) ? 'high' : 'medium', pickChannel(channels, acceptable),
            t.message_id ? [t.message_id] : [], w?.hours?.[0] ?? null, w?.hours?.[1] ?? null, acceptable]);
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

  /** The model words each due intent as the agent would say it and weighs it (balanced, full); on a failure, the templates. */
  private async word(memoryId: string, memory: { locale: string; timezone: string; display_name: string; mode: string },
    due: Array<{ id: string; kind: string; content: string; for_name: string | null; due_at: Date; expires_at: Date; timed: boolean; occurred_at: Date | null }>, now: Date,
  ): Promise<Map<string, { text: string | null; worth: number; skip: boolean; hours: [number, number] | null }>> {
    const out = new Map<string, { text: string | null; worth: number; skip: boolean; hours: [number, number] | null }>();
    if (!due.length) return out;
    const kindOf = (k: string) => (k === 'open_plan' || k === 'followup' || k === 'own' ? 'ask' : k === 'lookup' ? 'lookup' : 'say');
    const sourceOf = (k: string) => (k === 'open_plan' ? 'a plan of theirs past its date'
      : k === 'promise' ? 'a promise I made' : k === 'request' ? 'a request they made to me'
        : k === 'followup' ? 'something they started and left to finish (WHAT is the question to check it)'
          : k === 'own' ? 'a question I hold, to ask the person FOR, who could know (WHAT is the question)' : 'a question I hold');
    // The days it may be said on: one day alone when it is said today or lapses.
    const said = (t: { kind: string; timed: boolean; due_at: Date; expires_at: Date }) => { const d = sayDays(t, now, memory.timezone); return d.from === d.to ? d.from : `${d.from} to ${d.to}`; };
    const user = [
      `ME: ${memory.display_name}${memory.mode === 'entity' ? ' (a shared agent several people talk to)' : ''}`,
      `MEMORY LANGUAGE: ${memory.locale}`,
      `TODAY: ${localDate(now, memory.timezone)}`,
      `CANDIDATES:\n${due.map((t, i) => `C${i + 1}. kind ${kindOf(t.kind)} · FOR ${t.for_name ?? (memory.mode === 'entity' ? 'anyone' : 'holder')} · WHAT ${t.content} · WHEN ${localDate(t.occurred_at ?? t.due_at, memory.timezone)} · SOURCE ${sourceOf(t.kind)} · SAID ${said(t)}`).join('\n')}`,
    ].join('\n\n');
    try {
      const res: InitiativeOutput = await this.llm.completeJson({ promptId: INITIATIVE_VERSION, system: INITIATIVE_SYSTEM, user, schema: initiativeSchema, maxTokens: 1500, task: 'initiative' }, { memoryId });
      for (const r of res.initiatives) {
        const n = Number(String(r.candidate).replace(/^\s*C/i, ''));
        const t = due[n - 1];
        if (t) out.set(t.id, { text: r.text ?? null, worth: r.worth, skip: r.skip, hours: r.hours ?? null });
      }
    } catch (err) {
      this.log.warn(`initiative wording skipped: ${(err as Error).name}`);
    }
    return out;
  }

  /**
   * D55: the one initiative to give now to who is there — a turn of theirs (the memory context) or a presence impulse —
   * marked `offered` so it is given once; or, in an entity memory with nobody identified, whom to ask "are you …?"
   * (something waits for them; nothing of it is told). An initiative for a person reaches only that person, recognised
   * at least as surely as it requires; one for nobody in particular reaches the holder of a personal memory, and in an
   * entity memory anyone identified — or whoever talks in the conversation it came from (the one who asked is there).
   * A look-up goes to the agent (its tools) only when the host says it has some. By voice only what accepts voice
   * (§5b); `timedOwedOnly`: only a timed request or promise (a refresh of a presence, the pace, the quiet hours — §5c);
   * `open`: others are in the room — the initiative is not given, only marked opened (the agent says the opening, and a
   * "yes" in the next turn gets it).
   */
  async offer(memoryId: string, who: Recipient, channel: DeliveryChannel, now: Date,
    opts: { lookups?: boolean; timedOwedOnly?: boolean; open?: boolean } = {}):
    Promise<{ initiative: InitiativeView | null; askWho: { personId: string; name: string } | null; opened: boolean }> {
    const [memory]: Array<{ mode: string }> = await this.db.query(`SELECT mode FROM memories WHERE person_id = $1`, [memoryId]);
    if (!memory) return { initiative: null, askWho: null, opened: false };
    const entity = memory.mode === 'entity';
    const self = who.personId === memoryId;
    const contact = who.personId && !self ? who.personId : null;
    const [hit]: Array<{ id: string }> = await this.db.query(
      `SELECT i.id FROM initiatives i LEFT JOIN intents t ON t.id = i.intent_id
       WHERE i.memory_id = $1 AND i.status = 'pending' AND i.due_at <= $2 AND i.expires_at > $2
         AND (t.id IS NULL OR t.status = 'fired')
         AND (i.kind <> 'lookup' OR $3)
         AND (NOT $11 OR (i.timing = 'timed' AND t.kind IN ('request', 'promise')))
         AND ($12::text IS NULL OR $12 = ANY(i.channels))
         AND (
           (i.kind = 'lookup' AND i.for_person_id IS NULL)
           OR (i.for_person_id IS NOT NULL AND i.for_person_id = $4 AND $5 >= CASE i.identity_required WHEN 'high' THEN $8 ELSE $7 END)
           OR (i.for_person_id IS NULL AND NOT $6 AND $9 AND $5 >= CASE i.identity_required WHEN 'high' THEN $8 ELSE $7 END)
           OR (i.for_person_id IS NULL AND $6 AND $4 IS NOT NULL AND $5 >= CASE i.identity_required WHEN 'high' THEN $8 ELSE $7 END)
           OR (i.for_person_id IS NULL AND $6 AND $10::uuid IS NOT NULL
               AND EXISTS (SELECT 1 FROM messages m WHERE m.id = ANY(i.source_message_ids) AND m.conversation_id = $10))
         )
       -- what is owed first (a request, a promise), then what has a time, then the worth (dev_timing g5, 2026-11-04)
       ORDER BY (t.kind IN ('request', 'promise')) DESC NULLS LAST, (i.timing = 'timed') DESC, i.worth DESC NULLS LAST, i.due_at LIMIT 1`,
      [memoryId, now, !!opts.lookups, contact, who.confidence, entity, IDENTITY_THRESHOLD.medium, IDENTITY_THRESHOLD.high, self, who.conversationId ?? null,
        !!opts.timedOwedOnly, channel === 'voice' ? 'voice' : null]);
    if (hit && opts.open) {
      // Others in the room: only the opening is said; the initiative stays pending for a "yes" in the next turn.
      const rows = updated<Row>(await this.db.query(
        `UPDATE initiatives i SET opened_at = $3, updated_at = now() WHERE i.memory_id = $1 AND i.id = $2 AND i.status = 'pending' RETURNING ${COLUMNS}`,
        [memoryId, hit.id, now]));
      if (rows[0]) {
        await this.logDecision(memoryId, rows[0].id, 'presence', now, 1, 0, false, { channel, confidence: who.confidence, reason: 'opening' });
        return { initiative: view(rows[0]), askWho: null, opened: true };
      }
    }
    if (hit && !opts.open) {
      const rows = updated<Row>(await this.db.query(
        `UPDATE initiatives i SET status = 'offered', offered_at = $3, channel = $4, offered_conversation_id = $5, updated_at = now()
         WHERE i.memory_id = $1 AND i.id = $2 AND i.status = 'pending' RETURNING ${COLUMNS}`,
        [memoryId, hit.id, now, channel, channel === 'turn' ? who.conversationId ?? null : null]));
      const r = rows[0];
      if (r) {
        const v = view(r);
        // The person is there (a turn, a presence): v0 takes the moment; logged like the clock's decisions (F4 learns from all).
        await this.logDecision(memoryId, v.id, channel === 'turn' ? 'turn' : 'presence', now, 1, 0, true,
          { channel, confidence: who.confidence, reason: 'present' });
        this.telemetry.emit({ type: 'initiative.outcome', memoryId, id: v.id, status: 'offered' });
        await this.webhooks.notify(memoryId, 'initiative.updated', v, v.id);
        return { initiative: v, askWho: null, opened: false };
      }
    }
    if (!entity || who.personId) return { initiative: null, askWho: null, opened: false };
    const [waiting]: Array<{ person_id: string; name: string }> = await this.db.query(
      `SELECT i.for_person_id AS person_id, p.display_name AS name FROM initiatives i JOIN persons p ON p.id = i.for_person_id
       LEFT JOIN intents t ON t.id = i.intent_id
       WHERE i.memory_id = $1 AND i.status = 'pending' AND i.due_at <= $2 AND i.expires_at > $2 AND (t.id IS NULL OR t.status = 'fired')
       ORDER BY i.worth DESC NULLS LAST, i.due_at LIMIT 1`, [memoryId, now]);
    return { initiative: null, askWho: waiting ? { personId: waiting.person_id, name: waiting.name } : null, opened: false };
  }

  /**
   * Offered or pending initiatives whose intent moved on (D55, no LLM call): done in a conversation (the extraction saw
   * the reminder given, the plan's outcome told, the question answered) closes an offered one as said / asked / done and
   * a pending one as done (no longer needed); withdrawn closes it as declined. An offered one nobody followed up by its
   * end is ignored (an ask is offered once more a week later) — or expired, for a reminder (moot after its day).
   */
  private async settle(memoryId: string, now: Date): Promise<void> {
    const moved: Array<{ id: string; status: InitiativeStatus }> = await this.db.query(
      `SELECT i.id, CASE WHEN t.status = 'cancelled' THEN 'declined'
                         WHEN i.status = 'pending' THEN 'done'
                         WHEN i.kind = 'ask' THEN 'asked' WHEN i.kind = 'say' THEN 'said' ELSE 'done' END AS status
       FROM initiatives i JOIN intents t ON t.id = i.intent_id
       WHERE i.memory_id = $1 AND i.status IN ('pending', 'offered') AND t.status IN ('done', 'cancelled')`, [memoryId]);
    for (const m of moved) await this.close(memoryId, m.id, m.status, now);
    const lapsed: Array<{ id: string; kind: InitiativeKind }> = await this.db.query(
      `SELECT id, kind::text FROM initiatives WHERE memory_id = $1 AND status = 'offered' AND expires_at < $2`, [memoryId, now]);
    for (const l of lapsed) await this.outcome(memoryId, l.id, l.kind === 'say' ? 'expired' : 'ignored', now);
  }

  /** Closes an initiative whose intent is already settled (no intent bookkeeping), and tells the clients. */
  private async close(memoryId: string, id: string, status: InitiativeStatus, now: Date): Promise<void> {
    const rows = updated<Row>(await this.db.query(
      `UPDATE initiatives i SET status = $3, outcome_at = $4, outcome_channel = COALESCE(i.outcome_channel, i.channel), updated_at = now()
       WHERE i.memory_id = $1 AND i.id = $2 AND i.status IN ('pending', 'offered') RETURNING ${COLUMNS}`, [memoryId, id, status, now]));
    const r = rows[0];
    if (!r) return;
    this.telemetry.emit({ type: 'initiative.outcome', memoryId, id, status });
    await this.webhooks.notify(memoryId, 'initiative.updated', view(r), id);
  }

  /**
   * The clock's trigger (D55 F2a): pending initiatives with a channel that reaches the person now, decided one by one
   * (`decideMoment`), every decision logged; pushed ones become `offered` and go out as `initiative.deliver`. Never in the
   * memory's quiet hours; look-ups stay with the turn (they are for the agent's tools). The channel (§5b–§5c): a timed
   * request or promise whose person is live in a room goes by voice; in an entity memory, what is for one person never
   * goes on its shared channels (a panel, the agent's own chat) — only by voice so, or by messaging to an address of
   * theirs; otherwise the first acceptable channel a client declared as always reaching.
   */
  private async push(memoryId: string, now: Date): Promise<void> {
    const [memory]: Array<{ timezone: string; quiet_from: number; quiet_to: number; mode: string }> = await this.db.query(
      `SELECT timezone, quiet_from, quiet_to, mode FROM memories WHERE person_id = $1`, [memoryId]);
    if (!memory) return;
    const policy = this.config.get('INITIATIVE_TIMING', { infer: true }) ?? 'v0';
    const entity = memory.mode === 'entity';
    const listed: Array<{ id: string; kind: InitiativeKind; timing: 'timed' | 'flexible'; worth: number | null; due_at: Date; expires_at: Date;
      for_person_id: string | null; channel: string | null; channels: string[]; preferred_from: number | null; preferred_to: number | null;
      intent_kind: string | null; live_room: boolean; addressed: boolean }> = await this.db.query(
      `SELECT i.id, i.kind::text, i.timing, i.worth, i.due_at, i.expires_at, i.for_person_id, i.channel, i.channels, i.preferred_from, i.preferred_to,
         t.kind::text AS intent_kind,
         EXISTS (SELECT 1 FROM presences p WHERE p.memory_id = i.memory_id AND p.person_id = COALESCE(i.for_person_id, CASE WHEN NOT $3 THEN i.memory_id END)
           AND p.channel IN ('voice', 'camera') AND p.seen_at <= $2 AND p.expires_at > $2) AS live_room,
         EXISTS (SELECT 1 FROM external_identities x WHERE x.person_id = i.for_person_id AND x.kind = 'participant' AND x.channel IS NOT NULL
           AND x.verified_at IS NOT NULL) AS addressed
       FROM initiatives i LEFT JOIN intents t ON t.id = i.intent_id
       WHERE i.memory_id = $1 AND i.status = 'pending' AND i.pushed_at IS NULL AND i.kind <> 'lookup'
         AND i.due_at <= $2 AND i.expires_at > $2 AND (t.id IS NULL OR t.status = 'fired')
       ORDER BY i.due_at`, [memoryId, now, entity]);
    const declared = await this.declaredChannels(memoryId);
    const messaging = declared.some((c) => c.kind === 'messaging' && c.reach === 'always');
    const candidates = listed.flatMap((c) => {
      const owed = c.intent_kind === 'request' || c.intent_kind === 'promise';
      const channel = c.timing === 'timed' && owed && c.live_room && c.channels.includes('voice') ? 'voice'
        : entity && c.for_person_id ? (c.channels.includes('messaging') && messaging && c.addressed ? 'messaging' : null)
          : c.channel;
      return channel ? [{ ...c, channel }] : [];
    });
    if (!candidates.length) return;
    const quiet = afterQuiet(now, memory.timezone, memory.quiet_from, memory.quiet_to).getTime() !== now.getTime();
    // The window ends for the clock where the quiet hours begin: a last chance at 22:30 would be no chance (dev_timing g5).
    const quietStart = quiet ? now : nextLocalHour(now, memory.timezone, memory.quiet_from);
    const localHour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: memory.timezone }).format(now)) % 24;
    for (const c of candidates) {
      const counted: Array<{ n: number }> = await this.db.query(
        `SELECT count(*)::int AS n FROM initiatives WHERE memory_id = $1 AND for_person_id IS NOT DISTINCT FROM $2 AND offered_at IS NOT NULL
           AND (offered_at AT TIME ZONE $3)::date = ($4::timestamptz AT TIME ZONE $3)::date`, [memoryId, c.for_person_id, memory.timezone, now]);
      const n = counted[0]?.n ?? 0;
      const preferred: [number, number] = c.preferred_from !== null && c.preferred_to !== null ? [c.preferred_from, c.preferred_to] : TIMING.preferred[c.kind];
      const input: MomentInput = { kind: c.kind, timing: c.timing, worth: c.worth, owed: c.intent_kind === 'request' || c.intent_kind === 'promise',
        localHour, preferred, deliveredToday: n, sinceDueMs: now.getTime() - c.due_at.getTime(),
        untilEndMs: Math.min(c.expires_at.getTime(), memory.quiet_from === memory.quiet_to ? Infinity : quietStart.getTime()) - now.getTime() };
      const d = policy === 'due' ? { p: 1, threshold: 0, deliver: true, reason: 'due' } : decideMoment(input);
      // Quiet hours hold everything but a time the person chose themselves (a timed request or promise).
      const held = quiet && !(c.timing === 'timed' && input.owed);
      const deliver = d.deliver && !held;
      await this.logDecision(memoryId, c.id, 'clock', now, d.p, d.threshold, deliver,
        { reason: held && d.deliver ? 'quiet_hours' : d.reason, channel: c.channel, localHour, deliveredToday: n, timing: c.timing, kind: c.kind, policy });
      if (!deliver) continue;
      const rows = updated<Row>(await this.db.query(
        `UPDATE initiatives i SET status = 'offered', offered_at = $3, pushed_at = $3, channel = $4, updated_at = now()
         WHERE i.memory_id = $1 AND i.id = $2 AND i.status = 'pending' RETURNING ${COLUMNS}`, [memoryId, c.id, now, c.channel]));
      const r = rows[0];
      if (!r) continue;
      const v = view(r);
      this.telemetry.emit({ type: 'initiative.outcome', memoryId, id: v.id, status: 'offered' });
      await this.webhooks.notify(memoryId, 'initiative.deliver', v, v.id);
    }
  }

  private async logDecision(memoryId: string, initiativeId: string, trigger: 'clock' | 'presence' | 'turn', at: Date, p: number, threshold: number,
    delivered: boolean, features: Record<string, unknown>): Promise<void> {
    await this.db.query(
      `INSERT INTO initiative_decisions (memory_id, initiative_id, trigger, at, p, threshold, delivered, features) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [memoryId, initiativeId, trigger, at, p, threshold, delivered, JSON.stringify(features)]);
  }

  /**
   * Timed intents and initiatives due before the next hourly sweep (D55 F2a): the processor sweeps their memory at that
   * minute, so a reminder asked for 09:00 goes out at 09:00, not at the next hour.
   */
  async timedSoon(now: Date, horizonMs = 3_600_000): Promise<Array<{ key: string; memoryId: string; at: Date }>> {
    const rows: Array<{ key: string; memory_id: string; at: Date }> = await this.db.query(
      `SELECT 'intent-' || id AS key, memory_id, due_at AS at FROM intents WHERE status = 'armed' AND timed AND due_at > $1 AND due_at <= $2
       UNION ALL
       SELECT 'initiative-' || id, memory_id, due_at FROM initiatives WHERE status = 'pending' AND timing = 'timed' AND pushed_at IS NULL
         AND due_at > $1 AND due_at <= $2`, [now, new Date(now.getTime() + horizonMs)]);
    return rows.map((r) => ({ key: r.key, memoryId: r.memory_id, at: r.at }));
  }

  /** The channels the memory's clients declared (D55), from the clients that open this memory. */
  private async declaredChannels(memoryId: string): Promise<Array<{ kind: string; reach: string }>> {
    const rows: Array<{ channels: Array<{ kind: string; reach: string }> }> = await this.db.query(
      `SELECT c.channels FROM clients c JOIN external_identities x ON x.client_id = c.id AND x.person_id = $1 AND x.kind = 'account'
       WHERE c.disabled_at IS NULL ORDER BY c.created_at`, [memoryId]);
    return rows.flatMap((r) => r.channels ?? []);
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
  async outcome(memoryId: string, id: string, status: (typeof OUTCOMES)[number], at: Date, reply?: string,
    context: { channel?: DeliveryChannel; reaction?: Reaction } = {}): Promise<InitiativeView> {
    // The outcome's context is what timing learns from (D55): where it reached the person, how late, how it was taken.
    const rows = updated<Row>(await this.db.query(
      `UPDATE initiatives i SET status = $3, outcome_at = $4, reply = COALESCE($5, i.reply), updated_at = now(),
         outcome_channel = COALESCE($6, i.outcome_channel, i.channel),
         outcome_context = jsonb_strip_nulls(jsonb_build_object('reaction', $7::text,
           'latencyMs', (extract(epoch FROM ($4::timestamptz - i.due_at)) * 1000)::bigint))
       WHERE i.memory_id = $1 AND i.id = $2 RETURNING ${COLUMNS}`, [memoryId, id, status, at, reply ?? null, context.channel ?? null, context.reaction ?? null]));
    if (!rows.length) throw new NotFoundException();
    const linked: Array<{ intent_id: string | null }> = await this.db.query(`SELECT intent_id FROM initiatives WHERE id = $1`, [id]);
    const intent_id = linked[0]?.intent_id;
    if (intent_id) {
      if (status === 'said' || status === 'asked' || status === 'done') {
        await this.db.query(`UPDATE intents SET status = 'done', updated_at = now() WHERE id = $1`, [intent_id]);
        // A look-up done: the question it came from is answered — retired, like the thought pass would.
        if (status === 'done') {
          await this.db.query(
            `UPDATE notes SET status = 'superseded' WHERE id = (SELECT note_id FROM intents WHERE id = $1 AND kind = 'lookup') AND status = 'current'`, [intent_id]);
          await this.db.query(
            `UPDATE episode_promotions SET status = 'retired', updated_at = now() WHERE note_id = (SELECT note_id FROM intents WHERE id = $1 AND kind = 'lookup') AND status = 'active'`, [intent_id]);
        }
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
  return nextLocalHour(now, tz, to);
}

/** The local hour `hour` (the memory's timezone) at `isoDay`. */
function localHourAt(isoDay: string, hour: number, tz: string): Date {
  const utcMidnight = new Date(`${isoDay}T00:00:00Z`);
  const offset = utcMidnight.getTime() - new Date(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .format(utcMidnight).replace(/(\d+)\/(\d+)\/(\d+), (\d+):(\d+):(\d+)/, '$3-$1-$2T$4:$5:$6Z')).getTime();
  return new Date(utcMidnight.getTime() + offset + hour * 3_600_000);
}

/** The next time it is the local hour `hour` after `now`: today, or tomorrow. */
export function nextLocalHour(now: Date, tz: string, hour: number): Date {
  const today = localDate(now, tz);
  const end = localHourAt(today, hour, tz);
  return end > now ? end : localHourAt(new Date(new Date(`${today}T12:00:00Z`).getTime() + DAY_MS).toISOString().slice(0, 10), hour, tz);
}

/**
 * The acceptable channels of an initiative, in order (D55 §5b, maintainer 2026-11-05): messaging interrupts, so only what
 * was asked or promised — a request, a promise (a timed reminder is one of them) — may go there: voice → messaging → chat;
 * anything else waits for a voice presence, a turn or the chat: voice → chat; a look-up is for the agent's tools: the turn
 * only (none). The turn is always acceptable and never listed. The client delivers on the first that reaches the person now.
 */
export function acceptableChannels(kind: InitiativeKind, intentKind: string | null): string[] {
  if (kind === 'lookup') return [];
  return intentKind === 'request' || intentKind === 'promise' ? ['voice', 'messaging', 'chat'] : ['voice', 'chat'];
}

/**
 * Where the clock may push an initiative (D55): the first acceptable channel some client declared as reaching the person
 * at any time (`always`); none: at their next presence impulse or turn.
 */
export function pickChannel(declared: Array<{ kind: string; reach: string }>, acceptable: string[]): string | null {
  const always = new Set(declared.filter((c) => c.reach === 'always').map((c) => c.kind));
  return acceptable.find((c) => always.has(c)) ?? null;
}
