// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Applies one validated extraction output inside a transaction. All lifecycle logic is code:
 * the model only proposes items, verdicts and patches (D29, PIS). Rules:
 * - evidence: message numbers are mapped to ids in code; items without valid evidence are dropped;
 * - provenance: author_role from the evidence messages; items backed only by other people or tool
 *   output are `inferred` (facts / notes pending) — poisoning guard;
 * - forgetting: items whose evidence or date hits a tombstone are not recreated (D16);
 * - plans: confirm / cancel / reschedule / amend change status in code, with a plan_events log; a patch needs evidence
 *   that speaks of that plan (a shared name / place / keyword, or a similar embedding), and a reschedule must move it;
 * - facts: verdicts with world + knowledge time, forward-only supersession (imports never
 *   overwrite newer values), single-value slots replaced, multi-value slots accumulate;
 * - corrections never rewrite: a new row `corrects` the old one, which is invalidated;
 * - recall echoes: what only an assistant reply answering from memory said — neither the owner nor another person nor
 *   a non-memory tool (web search, a calendar…) said it — is not recorded: a wrong or invented recall must not become
 *   a memory because the owner said "ok", while news a tool brought in the same turn stays news.
 */
import { type EntityManager } from 'typeorm';
import { type ExtractionInput, isMemoryTool, type WindowMessage } from './extraction.context';
import { type ExtractionOutput } from './extraction.schema';
import { localDate, toStored, type Precision } from './time';

type AuthorRole = 'owner' | 'assistant' | 'other' | 'tool';

/**
 * Below this plan ↔ evidence-message similarity, with no shared name, place or keyword, a plan patch is treated as
 * unfounded. Calibrated on bge-m3 against the patches of three non-blind sets (2026-10-08): the patches backed by an
 * unrelated message (a plan "cancelled" by a work update, "confirmed" by a physiotherapy session) scored 0.27–0.36,
 * the right ones without a lexical anchor 0.38 and up.
 */
const PLAN_EVIDENCE_MIN_SIMILARITY = 0.37;

export interface WriteContext {
  ownerId: string;
  timezone: string;
  runId: string;
  conversationId: string;
  /** An entity memory (D48): facts name the person they are about. */
  entity?: boolean;
}

export interface WrittenRow {
  table: 'episodes' | 'facts' | 'notes';
  id: string;
  text: string;
}

interface Tombstones {
  messageIds: Set<string>;
  periods: Array<{ from: Date; to: Date }>;
}

export class ConcurrentExtractionError extends Error {
  constructor() {
    super('window already extracted by another run');
    this.name = 'ConcurrentExtractionError';
  }
}

export class ExtractionWriter {
  private readonly written: WrittenRow[] = [];
  private audience: string[] = [];
  private audienceUnverified: string[] = [];
  private tombstones: Tombstones = { messageIds: new Set(), periods: [] };
  private readonly subjects = new Map<string, string>();

  constructor(private readonly tx: EntityManager, private readonly ctx: WriteContext, private readonly input: ExtractionInput) {}

  async apply(out: ExtractionOutput): Promise<WrittenRow[]> {
    // Concurrency guard: lock the window's messages; if another run already extracted any of them,
    // this run writes nothing (no duplicates, no double processing).
    const pending: Array<{ id: string }> = await this.tx.query(
      `SELECT id FROM messages WHERE id = ANY($1) AND extracted_run_id IS NULL FOR UPDATE`, [this.input.messages.map((m) => m.id)]);
    if (pending.length !== this.input.messages.length) throw new ConcurrentExtractionError();
    await this.loadAudience();
    await this.loadTombstones();
    const episodeIds = await this.writeEpisodes(out);
    await this.applyPlanPatches(out, episodeIds);
    await this.writeFacts(out);
    await this.writeNotes(out);
    await this.tx.query(`UPDATE messages SET extracted_run_id = $1 WHERE id = ANY($2)`, [this.ctx.runId, this.input.messages.map((m) => m.id)]);
    for (const w of this.written) {
      await this.tx.query(`INSERT INTO run_outputs (run_id, table_name, row_id) VALUES ($1, $2, $3)`, [this.ctx.runId, w.table, w.id]);
    }
    return this.written;
  }

  /**
   * Facts only, from the nightly review (no chat window to lock): the same code-side rules as the extraction's facts.
   * The evidence messages are those of the reviewed episodes; the audience is the owner alone.
   */
  async applyFacts(facts: ExtractionOutput['facts']): Promise<WrittenRow[]> {
    this.audience = [this.ctx.ownerId];
    await this.loadTombstones();
    await this.writeFacts({ episodes: [], plan_patches: [], facts, notes: [] } as unknown as ExtractionOutput);
    return this.written;
  }

  // ── shared ────────────────────────────────────────────────────────────────────

  private async loadAudience(): Promise<void> {
    const rows: Array<{ person_id: string | null; display_name: string | null; role: string }> = await this.tx.query(
      `SELECT person_id, display_name, role FROM conversation_participants WHERE conversation_id = $1`, [this.ctx.conversationId]);
    const ids = new Set<string>([this.ctx.ownerId]);
    for (const r of rows) {
      if (r.person_id) ids.add(r.person_id);
      else if (r.role === 'other' && r.display_name) this.audienceUnverified.push(r.display_name);
    }
    this.audience = [...ids];
  }

  private async loadTombstones(): Promise<void> {
    const rows: Array<{ message_ids: string[]; period_from: Date | null; period_to: Date | null }> = await this.tx.query(
      `SELECT message_ids, period_from, period_to FROM forget_tombstones WHERE owner_id = $1`, [this.ctx.ownerId]);
    for (const r of rows) {
      for (const id of r.message_ids) this.tombstones.messageIds.add(id);
      if (r.period_from && r.period_to) this.tombstones.periods.push({ from: r.period_from, to: r.period_to });
    }
  }

  private evidence(nums: number[]): WindowMessage[] {
    const seen = new Set<string>();
    return nums.flatMap((n) => {
      const m = this.input.messages[n - 1];
      if (!m || seen.has(m.id)) return [];
      seen.add(m.id);
      return [m];
    });
  }

  /**
   * True when an item comes only from a recall echo: its names (or, without names, its words) appear in an assistant
   * reply answering from memory and in no message of the owner, of another person or of a non-memory tool (the
   * world's sources) in the window. Inactive when the window has no such reply.
   */
  private echoOnly(text: string): boolean {
    const echoes = this.input.messages.filter((m) => m.fromMemory);
    if (echoes.length === 0) return false;
    const names = (text.match(/\p{Lu}[\p{L}'’-]{2,}/gu) ?? []).flatMap(words).map(stem);
    const anchors = names.length ? names : words(text).map(stem);
    const echoed = new Set(echoes.flatMap((m) => words(m.content)).map(stem));
    if (!anchors.some((a) => echoed.has(a))) return false;
    const sources = this.input.messages.filter((m) => m.role === 'user' || m.role === 'other' || (m.role === 'tool' && !isMemoryTool(m.toolName)));
    const own = new Set(sources.flatMap((m) => words(m.content)).map(stem));
    return !anchors.some((a) => own.has(a));
  }

  /**
   * After a recall, a fact changes (replaced, stale, unknown, corrected) only when a statement in its evidence — by the
   * owner, another person or a non-memory tool, not a question — speaks of it: asking "what's my dentist called?" and
   * hearing a wrong name is no news about the dentist. Always true when the window has no reply answering from memory.
   */
  private assertedAfterRecall(msgs: WindowMessage[], about: string): boolean {
    if (!this.input.messages.some((m) => m.fromMemory)) return true;
    const topic = new Set(words(about).map(stem));
    // Sentence by sentence: "What's my dentist called? I must call him." asks about the dentist, it does not assert.
    return msgs.some((m) => (m.role === 'user' || m.role === 'other' || (m.role === 'tool' && !isMemoryTool(m.toolName)))
      && (m.content.match(/[^.!?\n]+[.!?\n]*/g) ?? []).some((s) => !s.trim().endsWith('?') && words(s).map(stem).some((w) => topic.has(w))));
  }

  private authorRole(msgs: WindowMessage[]): AuthorRole {
    if (msgs.some((m) => m.role === 'user' || m.authorPersonId === this.ctx.ownerId)) return 'owner';
    if (msgs.some((m) => m.role === 'assistant')) return 'assistant';
    if (msgs.some((m) => m.role === 'tool')) return 'tool';
    return 'other';
  }

  private forgotten(msgs: WindowMessage[], at: Date | null): boolean {
    if (msgs.some((m) => this.tombstones.messageIds.has(m.id))) return true;
    return !!at && this.tombstones.periods.some((p) => at >= p.from && at < p.to);
  }

  private messageDay(msgs: WindowMessage[]): string {
    const first = msgs[0] ?? this.input.messages[0];
    return localDate((first as WindowMessage).sentAt, this.ctx.timezone);
  }

  // ── episodes ──────────────────────────────────────────────────────────────────

  private async writeEpisodes(out: ExtractionOutput): Promise<Array<string | null>> {
    const ids: Array<string | null> = [];
    for (const e of out.episodes) {
      const msgs = this.evidence(e.evidence);
      const at = toStored(e.occurred_at, e.date_precision as Precision | undefined, this.ctx.timezone);
      const until = toStored(e.occurred_until, 'day', this.ctx.timezone);
      if (msgs.length === 0 || this.forgotten(msgs, at.at) || this.echoOnly(e.content)
        || (this.ctx.entity && !e.people.every((p) => this.namedInWindow(p)))) {
        ids.push(null);
        continue;
      }
      const role = this.authorRole(msgs);
      const origin = role === 'assistant' ? 'assistant_stated' : e.origin;
      const stance = role === 'other' || role === 'tool' ? 'inferred' : 'stated';
      const corrects = e.corrects ? (this.input.episodes.get(e.corrects) ?? null) : null;
      const [row] = await this.tx.query(
        `INSERT INTO episodes (owner_id, kind, content, occurred_at, occurred_until, date_precision, time_expression, place,
           importance, valence, feelings, opinion, keywords, context, tags, plan_status, plan_status_at, corrects,
           origin, author_role, stance, confidence, extraction_run_id, disclosure, audience, audience_unverified)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, 'owner', $24, $25)
         RETURNING id`,
        [this.ctx.ownerId, e.kind, e.content, at.at, until.at, at.precision, e.time_expression ?? null, e.place ?? null,
          e.importance, e.valence ?? null, e.feelings, e.opinion ?? null, e.keywords, e.context ?? null, e.tags,
          e.kind === 'plan' ? 'open' : null, e.kind === 'plan' ? new Date() : null, corrects,
          origin, role, stance, stance === 'stated' ? 1 : 0.6, this.ctx.runId, this.audience, this.audienceUnverified],
      );
      const id = row.id as string;
      if (corrects) await this.tx.query(`UPDATE episodes SET invalidated_at = now() WHERE id = $1 AND owner_id = $2`, [corrects, this.ctx.ownerId]);
      for (const m of msgs) {
        await this.tx.query(`INSERT INTO episode_evidence (episode_id, message_id, evidence_kind) VALUES ($1, $2, 'message') ON CONFLICT DO NOTHING`, [id, m.id]);
      }
      for (const alias of e.people) {
        await this.tx.query(`INSERT INTO episode_people (episode_id, alias) VALUES ($1, $2)`, [id, alias]);
      }
      this.written.push({ table: 'episodes', id, text: [e.content, e.place, e.people.join(', '), e.keywords.join(' '), e.context, e.opinion].filter(Boolean).join(' | ') });
      ids.push(id);
    }
    return ids;
  }

  // ── plans ─────────────────────────────────────────────────────────────────────

  private async applyPlanPatches(out: ExtractionOutput, episodeIds: Array<string | null>): Promise<void> {
    for (const patch of out.plan_patches) {
      let p = patch;
      const planId = this.input.plans.get(p.plan);
      const msgs = this.evidence(p.evidence);
      if (!planId || msgs.length === 0 || this.forgotten(msgs, null)) continue;
      if (!(await this.speaksOfPlan(planId, msgs))) continue;
      // A plan cannot have happened before its date: a "confirm" said before the plan starts confirms details, not an
      // outcome ("the trip is for the whole family" days before the trip). With a new text it amends the plan.
      if (p.patch === 'confirm' && await this.startsAfter(planId, msgs)) {
        if (!p.new_content) continue;
        p = { ...p, patch: 'amend' };
      }
      if ((p.patch === 'reschedule' || p.patch === 'amend') && !(await this.changesPlan(planId, p))) continue;
      const at = msgs[0]?.sentAt ?? new Date();
      let newPlanId: string | null = null;
      if (p.patch === 'confirm') {
        let event = p.event !== null && p.event !== undefined ? (episodeIds[p.event] ?? null) : null;
        // A confirmed plan always has the event that happened (D10): created from the plan if the
        // model did not provide one.
        if (!event) event = await this.eventFromPlan(planId, msgs);
        await this.tx.query(`UPDATE episodes SET plan_status = 'confirmed', plan_status_at = $1, confirmed_by = $2 WHERE id = $3 AND owner_id = $4`,
          [at, event, planId, this.ctx.ownerId]);
      } else if (p.patch === 'cancel') {
        await this.tx.query(`UPDATE episodes SET plan_status = 'cancelled', plan_status_at = $1 WHERE id = $2 AND owner_id = $3`, [at, planId, this.ctx.ownerId]);
      } else {
        newPlanId = await this.copyPlan(planId, p, msgs);
        await this.tx.query(`UPDATE episodes SET plan_status = 'rescheduled', plan_status_at = $1, rescheduled_to = $2 WHERE id = $3 AND owner_id = $4`,
          [at, newPlanId, planId, this.ctx.ownerId]);
      }
      await this.tx.query(
        `INSERT INTO plan_events (plan_id, patch, evidence_message_id, new_plan_id, note, extraction_run_id) VALUES ($1, $2, $3, $4, $5, $6)`,
        [planId, p.patch, msgs[0]?.id ?? null, newPlanId, p.note ?? null, this.ctx.runId]);
    }
  }

  /**
   * Whether the evidence is about this plan: a name, place or keyword of the plan appears in it, or (when both are
   * embedded) it is similar enough. Guards against a model closing an old plan with an unrelated message.
   */
  private async speaksOfPlan(planId: string, msgs: WindowMessage[]): Promise<boolean> {
    const [plan]: Array<{ content: string; keywords: string[] | null; place: string | null; people: string[] | null; owner: string | null; sim: number | null }> = await this.tx.query(
      `SELECT e.content, e.keywords, e.place,
         (SELECT array_agg(alias) FROM episode_people WHERE episode_id = e.id) AS people,
         (SELECT display_name FROM persons WHERE id = e.owner_id) AS owner,
         (SELECT max(1 - (e.embedding <=> m.embedding)) FROM messages m WHERE m.id = ANY($2) AND m.embedding IS NOT NULL) AS sim
       FROM episodes e WHERE e.id = $1`, [planId, msgs.map((m) => m.id)]);
    if (!plan) return false;
    const owner = new Set(words(plan.owner ?? '').map(stem));
    const names = (plan.content.match(/\p{Lu}[\p{L}'’-]{2,}/gu) ?? []); // proper names and places written in the plan
    const anchors = [...(plan.keywords ?? []), ...(plan.people ?? []), plan.place ?? '', ...names].flatMap(words).map(stem).filter((w) => !owner.has(w));
    const said = new Set(msgs.flatMap((m) => words(m.content)).map(stem));
    if (anchors.some((a) => said.has(a))) return true;
    return plan.sim === null || plan.sim >= PLAN_EVIDENCE_MIN_SIMILARITY;
  }

  /** The plan starts after the day of its evidence (in the owner's timezone): it cannot have happened yet. */
  private async startsAfter(planId: string, msgs: WindowMessage[]): Promise<boolean> {
    const [plan]: Array<{ occurred_at: Date | null; date_precision: Precision }> = await this.tx.query(
      `SELECT occurred_at, date_precision FROM episodes WHERE id = $1`, [planId]);
    if (!plan?.occurred_at || plan.date_precision === 'unknown') return false;
    return localDate(plan.occurred_at, this.ctx.timezone) > this.messageDay(msgs);
  }

  /** A reschedule or amend that leaves the plan as it is (same date, no new text) is a repeat, not a change. */
  private async changesPlan(planId: string, p: ExtractionOutput['plan_patches'][number]): Promise<boolean> {
    if (p.new_content || p.new_until) return true;
    if (!p.new_date) return false;
    const [old]: Array<{ occurred_at: Date | null }> = await this.tx.query(`SELECT occurred_at FROM episodes WHERE id = $1`, [planId]);
    const moved = toStored(p.new_date, p.date_precision as Precision | undefined, this.ctx.timezone).at;
    if (!moved) return false;
    return !old?.occurred_at || new Date(old.occurred_at).getTime() !== moved.getTime();
  }

  /** The event of a confirmed plan, derived from the plan itself (same dates, people, place). */
  private async eventFromPlan(planId: string, msgs: WindowMessage[]): Promise<string> {
    const [row] = await this.tx.query(
      `INSERT INTO episodes (owner_id, kind, content, occurred_at, occurred_until, date_precision, place, importance, valence,
         feelings, opinion, keywords, context, tags, origin, author_role, stance, confidence, extraction_run_id, disclosure,
         audience, audience_unverified)
       SELECT owner_id, 'event', content, occurred_at, occurred_until, date_precision, place, importance, valence, feelings,
         opinion, keywords, context, tags, origin, $3, stance, confidence, $4, 'owner', $5, $6
       FROM episodes WHERE id = $1 AND owner_id = $2 RETURNING id, content, place`,
      [planId, this.ctx.ownerId, this.authorRole(msgs), this.ctx.runId, this.audience, this.audienceUnverified]);
    await this.tx.query(`INSERT INTO episode_people (episode_id, alias, person_id, role) SELECT $1, alias, person_id, role FROM episode_people WHERE episode_id = $2`, [row.id, planId]);
    for (const m of msgs) {
      await this.tx.query(`INSERT INTO episode_evidence (episode_id, message_id, evidence_kind) VALUES ($1, $2, 'message') ON CONFLICT DO NOTHING`, [row.id, m.id]);
    }
    this.written.push({ table: 'episodes', id: row.id, text: [row.content, row.place].filter(Boolean).join(' | ') });
    return row.id as string;
  }

  /** Reschedule / amend: a new open plan row; the old one keeps its history. */
  private async copyPlan(planId: string, p: ExtractionOutput['plan_patches'][number], msgs: WindowMessage[]): Promise<string> {
    const [old] = await this.tx.query(`SELECT * FROM episodes WHERE id = $1`, [planId]);
    const at = p.new_date ? toStored(p.new_date, p.date_precision as Precision | undefined, this.ctx.timezone) : { at: old.occurred_at, precision: old.date_precision };
    const until = p.new_until ? toStored(p.new_until, 'day', this.ctx.timezone).at : (p.new_date ? null : old.occurred_until);
    const [row] = await this.tx.query(
      `INSERT INTO episodes (owner_id, kind, content, occurred_at, occurred_until, date_precision, place, importance, valence,
         feelings, opinion, keywords, context, tags, plan_status, plan_status_at, origin, author_role, stance, confidence,
         extraction_run_id, disclosure, audience, audience_unverified)
       VALUES ($1, 'plan', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'open', now(), $14, $15, $16, $17, $18, 'owner', $19, $20)
       RETURNING id`,
      [this.ctx.ownerId, this.planText(old.content, p), at.at, until, at.precision, old.place, old.importance, old.valence,
        old.feelings, old.opinion, old.keywords, old.context, old.tags, old.origin, this.authorRole(msgs), old.stance, old.confidence,
        this.ctx.runId, this.audience, this.audienceUnverified],
    );
    for (const m of msgs) {
      await this.tx.query(`INSERT INTO episode_evidence (episode_id, message_id, evidence_kind) VALUES ($1, $2, 'message') ON CONFLICT DO NOTHING`, [row.id, m.id]);
    }
    await this.tx.query(`INSERT INTO episode_people (episode_id, alias, person_id, role) SELECT $1, alias, person_id, role FROM episode_people WHERE episode_id = $2`, [row.id, planId]);
    this.written.push({ table: 'episodes', id: row.id, text: [this.planText(old.content, p), old.place].filter(Boolean).join(' | ') });
    return row.id as string;
  }

  /** The moved plan's sentence: the model's rewrite, else the old one marked with the new date (never the stale date alone). */
  private planText(old: string, p: ExtractionOutput['plan_patches'][number]): string {
    if (p.new_content) return p.new_content;
    return p.patch === 'reschedule' && p.new_date ? `${old} (→ ${p.new_date}${p.new_until ? ` – ${p.new_until}` : ''})` : old;
  }

  // ── facts ─────────────────────────────────────────────────────────────────────

  private async writeFacts(out: ExtractionOutput): Promise<void> {
    for (const f of out.facts) {
      const msgs = this.evidence(f.evidence);
      if (msgs.length === 0 || this.forgotten(msgs, null) || (f.value && this.echoOnly(f.value))) continue;
      const key = f.key.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      if (!key) continue;
      if (f.verdict !== 'new' && f.verdict !== 'keep' && !this.assertedAfterRecall(msgs, `${key.replace(/_/g, ' ')} ${f.value ?? ''}`)) continue;
      await this.tx.query(`INSERT INTO fact_slots (key, description, cardinality) VALUES ($1, $1, $2) ON CONFLICT (key) DO NOTHING`, [key, f.cardinality ?? 'single']);
      const [{ cardinality }] = await this.tx.query(`SELECT cardinality FROM fact_slots WHERE key = $1`, [key]);
      const role = this.authorRole(msgs);
      const inferred = role === 'other' || role === 'tool';
      const from = toStored(f.valid_from ?? this.messageDay(msgs), f.date_precision as Precision | undefined, this.ctx.timezone);
      if (this.ctx.entity && f.subject && !this.namedInWindow(f.subject)) continue;
      const subjectId = this.ctx.entity ? await this.subject(f.subject) : null;
      let target = f.target ? this.input.facts.get(f.target) : undefined;
      if (target && (target.key !== key || (target.subjectId ?? null) !== subjectId)) target = undefined;

      if (f.verdict === 'keep') {
        if (target) await this.tx.query(`UPDATE facts SET support_count = support_count + 1 WHERE id = $1 AND owner_id = $2`, [target.id, this.ctx.ownerId]);
        continue;
      }
      let verdict = f.verdict;
      // "new" with a target on a single-value slot is a replacement; on a multi-value slot it is a new item.
      if (target && verdict === 'new') {
        if (cardinality === 'single') verdict = 'replace';
        else target = undefined;
      }
      if (!target && cardinality === 'single' && verdict !== 'corrects') {
        // A new value for a single-value slot that already has one is a replacement.
        const [cur] = await this.tx.query(
          `SELECT id, valid_from FROM facts WHERE owner_id = $1 AND subject_person_id IS NOT DISTINCT FROM $3 AND key = $2 AND status IN ('current', 'unknown_current') AND deleted_at IS NULL`,
          [this.ctx.ownerId, key, subjectId]);
        if (cur) {
          target = { id: cur.id, key, validFrom: cur.valid_from, subjectId };
          if (verdict === 'new') verdict = 'replace';
        }
      }
      if (!target && (verdict === 'replace' || verdict === 'stale' || verdict === 'unknown' || verdict === 'corrects')) {
        if (verdict === 'corrects' || !f.value) continue;
        verdict = 'new';
      }

      let status: 'current' | 'superseded' | 'unknown_current' = 'current';
      let supersedes: string | null = null;
      let correctsId: string | null = null;
      let validTo: Date | null = null;
      const value = verdict === 'stale' || verdict === 'unknown' ? null : (f.value ?? null);
      if (value === null && verdict !== 'stale' && verdict !== 'unknown') continue;

      if (target && (verdict === 'replace' || verdict === 'stale' || verdict === 'unknown')) {
        if (target.validFrom && from.at && from.at < target.validFrom) {
          // Older evidence that a value became unknown changes nothing in the newer history.
          if (value === null) continue;
          // Forward-only: an older value (late import) becomes history, the newer fact stays current.
          status = 'superseded';
          validTo = target.validFrom;
        } else {
          await this.tx.query(`UPDATE facts SET status = 'superseded', valid_to = $1, expired_at = now() WHERE id = $2 AND owner_id = $3`,
            [from.at, target.id, this.ctx.ownerId]);
          supersedes = target.id;
          status = value === null ? 'unknown_current' : 'current';
        }
      } else if (target && verdict === 'corrects') {
        await this.tx.query(`UPDATE facts SET status = 'corrected', expired_at = now() WHERE id = $1 AND owner_id = $2`, [target.id, this.ctx.ownerId]);
        correctsId = target.id;
      }
      const [row] = await this.tx.query(
        `INSERT INTO facts (owner_id, key, value, status, valid_from, valid_to, date_precision, supersedes, corrects, verdict, pending,
           origin, author_role, stance, confidence, extraction_run_id, disclosure, audience, audience_unverified, subject_person_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'owner', $17, $18, $19)
         RETURNING id`,
        [this.ctx.ownerId, key, value, status, from.at, validTo, from.precision, supersedes, correctsId, verdict, inferred,
          role === 'assistant' ? 'assistant_stated' : 'owner_lived', role, inferred ? 'inferred' : 'stated', inferred ? 0.6 : 1,
          this.ctx.runId, this.audience, this.audienceUnverified, subjectId],
      );
      for (const m of msgs) await this.tx.query(`INSERT INTO fact_evidence (fact_id, message_id) VALUES ($1, $2)`, [row.id, m.id]);
      const about = subjectId ? `${f.subject?.trim()} — ` : '';
      this.written.push({ table: 'facts', id: row.id, text: `${about}${key}: ${value ?? '(unknown)'}` });
    }
  }

  /**
   * Entity memories: whose memory it is comes only from the conversation (a self-introduction, being addressed by
   * name). A person named by an item but never in the window — e.g. carried over from an earlier conversation — is a
   * wrong attribution: the item is not recorded.
   */
  private namedInWindow(raw: string): boolean {
    // Any word of the name counts ("dott. Ferri" ↔ "il dottor Ferri"); titles and initials are too short to decide.
    const parts = tokens(raw.replace(/\s*\(.*\)\s*$/, '')).filter((w) => w.length >= 3);
    if (parts.length === 0) return true;
    const seen = new Set(this.input.messages.flatMap((m) => tokens(m.content)));
    return parts.some((w) => seen.has(w));
  }

  /**
   * Entity memories: the person a fact is about, a contact of this memory found by name ("Marta (figlia)" → Marta) or
   * created; null (no subject) = the entity itself.
   */
  private async subject(raw: string | null | undefined): Promise<string | null> {
    const name = raw?.replace(/\s*\(.*\)\s*$/, '').trim().slice(0, 200);
    if (!name) return null;
    const lower = name.toLowerCase();
    const known = this.subjects.get(lower);
    if (known) return known;
    const [found] = await this.tx.query(
      `SELECT id FROM persons WHERE owner_scope = $1 AND lower(display_name) = $2 ORDER BY created_at LIMIT 1`, [this.ctx.ownerId, lower]);
    const id = (found ?? (await this.tx.query(
      `INSERT INTO persons (owner_scope, display_name) VALUES ($1, $2) RETURNING id`, [this.ctx.ownerId, name]))[0]).id as string;
    this.subjects.set(lower, id);
    return id;
  }

  // ── notes ─────────────────────────────────────────────────────────────────────

  private async writeNotes(out: ExtractionOutput): Promise<void> {
    for (const n of out.notes) {
      const msgs = this.evidence(n.evidence);
      if (msgs.length === 0 || this.forgotten(msgs, null) || (n.content && this.echoOnly(n.content))) continue;
      const target = n.target ? this.input.notes.get(n.target) : undefined;
      if (n.verdict === 'keep') {
        if (target) await this.tx.query(`UPDATE notes SET support_count = support_count + 1 WHERE id = $1 AND owner_id = $2`, [target, this.ctx.ownerId]);
        continue;
      }
      const role = this.authorRole(msgs);
      const inferred = n.stance === 'inferred' || role === 'other' || role === 'tool';
      let supersedes: string | null = null;
      let correctsId: string | null = null;
      if (target && n.verdict === 'replace') {
        await this.tx.query(`UPDATE notes SET status = 'superseded' WHERE id = $1 AND owner_id = $2`, [target, this.ctx.ownerId]);
        supersedes = target;
      } else if (target && n.verdict === 'corrects') {
        await this.tx.query(`UPDATE notes SET status = 'corrected' WHERE id = $1 AND owner_id = $2`, [target, this.ctx.ownerId]);
        correctsId = target;
      }
      const [row] = await this.tx.query(
        `INSERT INTO notes (owner_id, category, content, keywords, context, tags, supersedes, corrects, pending, valid_from,
           origin, author_role, stance, confidence, extraction_run_id, disclosure, audience, audience_unverified)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'owner', $16, $17)
         RETURNING id`,
        [this.ctx.ownerId, n.category, n.content, n.keywords, n.context ?? null, n.tags, supersedes, correctsId, inferred,
          msgs[0]?.sentAt ?? null, role === 'assistant' ? 'assistant_stated' : 'owner_lived', role, inferred ? 'inferred' : 'stated',
          inferred ? 0.6 : 1, this.ctx.runId, this.audience, this.audienceUnverified],
      );
      for (const m of msgs) await this.tx.query(`INSERT INTO note_evidence (note_id, message_id) VALUES ($1, $2)`, [row.id, m.id]);
      await this.tx.query(`INSERT INTO note_changes (owner_id, note_id, change) VALUES ($1, $2, $3)`,
        [this.ctx.ownerId, row.id, correctsId ? 'corrected' : supersedes ? 'updated' : 'created']);
      this.written.push({ table: 'notes', id: row.id, text: [n.content, n.keywords.join(' '), n.context].filter(Boolean).join(' | ') });
    }
  }
}

const tokens = (s: string): string[] => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const words = (s: string): string[] => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 4);
/** A crude cross-inflection key (cena / cene, festa / feste, spostata / spostato). */
const stem = (w: string): string => w.slice(0, 5);
