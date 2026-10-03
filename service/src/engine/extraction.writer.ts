// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Applies one validated extraction output inside a transaction. All lifecycle logic is code:
 * the model only proposes items, verdicts and patches (D29, PIS). Rules:
 * - evidence: message numbers are mapped to ids in code; items without valid evidence are dropped;
 * - provenance: author_role from the evidence messages; items backed only by other people or tool
 *   output are `inferred` (facts / notes pending) — poisoning guard;
 * - forgetting: items whose evidence or date hits a tombstone are not recreated (D16);
 * - plans: confirm / cancel / reschedule / amend change status in code, with a plan_events log;
 * - facts: verdicts with world + knowledge time, forward-only supersession (imports never
 *   overwrite newer values), single-value slots replaced, multi-value slots accumulate;
 * - corrections never rewrite: a new row `corrects` the old one, which is invalidated.
 */
import { type EntityManager } from 'typeorm';
import { type ExtractionInput, type WindowMessage } from './extraction.context';
import { type ExtractionOutput } from './extraction.schema';
import { localDate, toStored, type Precision } from './time';

type AuthorRole = 'owner' | 'assistant' | 'other' | 'tool';

export interface WriteContext {
  ownerId: string;
  timezone: string;
  runId: string;
  conversationId: string;
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

export class ExtractionWriter {
  private readonly written: WrittenRow[] = [];
  private audience: string[] = [];
  private audienceUnverified: string[] = [];
  private tombstones: Tombstones = { messageIds: new Set(), periods: [] };

  constructor(private readonly tx: EntityManager, private readonly ctx: WriteContext, private readonly input: ExtractionInput) {}

  async apply(out: ExtractionOutput): Promise<WrittenRow[]> {
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
      if (msgs.length === 0 || this.forgotten(msgs, at.at)) {
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
    for (const p of out.plan_patches) {
      const planId = this.input.plans.get(p.plan);
      const msgs = this.evidence(p.evidence);
      if (!planId || msgs.length === 0) continue;
      const at = msgs[0]?.sentAt ?? new Date();
      let newPlanId: string | null = null;
      if (p.patch === 'confirm') {
        const event = p.event !== null && p.event !== undefined ? (episodeIds[p.event] ?? null) : null;
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
      [this.ctx.ownerId, p.new_content ?? old.content, at.at, until, at.precision, old.place, old.importance, old.valence,
        old.feelings, old.opinion, old.keywords, old.context, old.tags, old.origin, this.authorRole(msgs), old.stance, old.confidence,
        this.ctx.runId, this.audience, this.audienceUnverified],
    );
    for (const m of msgs) {
      await this.tx.query(`INSERT INTO episode_evidence (episode_id, message_id, evidence_kind) VALUES ($1, $2, 'message') ON CONFLICT DO NOTHING`, [row.id, m.id]);
    }
    this.written.push({ table: 'episodes', id: row.id, text: [p.new_content ?? old.content, old.place].filter(Boolean).join(' | ') });
    return row.id as string;
  }

  // ── facts ─────────────────────────────────────────────────────────────────────

  private async writeFacts(out: ExtractionOutput): Promise<void> {
    for (const f of out.facts) {
      const msgs = this.evidence(f.evidence);
      if (msgs.length === 0 || this.forgotten(msgs, null)) continue;
      const key = f.key.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      if (!key) continue;
      await this.tx.query(`INSERT INTO fact_slots (key, description, cardinality) VALUES ($1, $1, $2) ON CONFLICT (key) DO NOTHING`, [key, f.cardinality ?? 'single']);
      const [{ cardinality }] = await this.tx.query(`SELECT cardinality FROM fact_slots WHERE key = $1`, [key]);
      const role = this.authorRole(msgs);
      const inferred = role === 'other' || role === 'tool';
      const from = toStored(f.valid_from ?? this.messageDay(msgs), f.date_precision as Precision | undefined, this.ctx.timezone);
      let target = f.target ? this.input.facts.get(f.target) : undefined;
      if (target && target.key !== key) target = undefined;

      if (f.verdict === 'keep') {
        if (target) await this.tx.query(`UPDATE facts SET support_count = support_count + 1 WHERE id = $1 AND owner_id = $2`, [target.id, this.ctx.ownerId]);
        continue;
      }
      let verdict = f.verdict;
      if (!target && cardinality === 'single' && verdict !== 'corrects') {
        // A new value for a single-value slot that already has one is a replacement.
        const [cur] = await this.tx.query(
          `SELECT id, valid_from FROM facts WHERE owner_id = $1 AND subject_person_id IS NULL AND key = $2 AND status IN ('current', 'unknown_current') AND deleted_at IS NULL`,
          [this.ctx.ownerId, key]);
        if (cur) {
          target = { id: cur.id, key, validFrom: cur.valid_from };
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
           origin, author_role, stance, confidence, extraction_run_id, disclosure, audience, audience_unverified)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'owner', $17, $18)
         RETURNING id`,
        [this.ctx.ownerId, key, value, status, from.at, validTo, from.precision, supersedes, correctsId, verdict, inferred,
          role === 'assistant' ? 'assistant_stated' : 'owner_lived', role, inferred ? 'inferred' : 'stated', inferred ? 0.6 : 1,
          this.ctx.runId, this.audience, this.audienceUnverified],
      );
      for (const m of msgs) await this.tx.query(`INSERT INTO fact_evidence (fact_id, message_id) VALUES ($1, $2)`, [row.id, m.id]);
      this.written.push({ table: 'facts', id: row.id, text: `${key}: ${value ?? '(unknown)'}` });
    }
  }

  // ── notes ─────────────────────────────────────────────────────────────────────

  private async writeNotes(out: ExtractionOutput): Promise<void> {
    for (const n of out.notes) {
      const msgs = this.evidence(n.evidence);
      if (msgs.length === 0 || this.forgotten(msgs, null)) continue;
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
