// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Nightly pattern pass (WORK_PLAN 5.4; D20, D26 as decided 2026-10-12): the memory draws, keeps, updates and retires its
 * own conclusions about what keeps happening. One LLM call (task `patterns`) per memory per night with new episodes,
 * none otherwise. A pattern is written as a note of the memory — inferred (recall labels it), never pending: nobody has
 * to confirm it — backed by the episodes it was drawn from, and registered in `episode_promotions`.
 * The model only proposes; the code decides:
 * - at least three episodes on different days, all of one subject (the self or one known person), each existing and
 *   visible; only what the people lived or told — never the assistant's or a tool's words, never others' claims;
 * - nothing that restates a note the memory holds, nothing like a pattern the memory was told to forget or that stopped
 *   holding unless at least two episodes it was not drawn from back it;
 * - a pattern whose note was deleted is `forgotten`; one whose note was replaced, corrected or retired is `retired`; one
 *   left with fewer than three of its episodes (forgotten) is dropped, and may be drawn again from new ones.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { EMBEDDING_PORT, type EmbeddingPort } from '../embedding/embedding.port';
import { LLM_PORT, type LlmPort } from '../llm/llm.port';
import { TelemetryService } from '../telemetry/telemetry.service';
import { type SubjectKind } from '../identity/identity.entities';
import { ENTITY_PATTERNS_SUFFIX, ENTITY_PATTERNS_SYSTEM, PATTERNS_SYSTEM, PATTERNS_VERSION, type PatternsOutput, patternsSchema } from './patterns.prompt';
import { localDate } from './time';
import { subjectLabel } from './subjects';

/** Episodes looked at: those of the last LOOKBACK_DAYS, the newest MAX_EPISODES. */
const LOOKBACK_DAYS = 90;
const MAX_EPISODES = 400;
const MAX_KNOWN_NOTES = 150;
const MAX_PAST = 50;
/** Episodes on different days a pattern needs. */
export const MIN_PATTERN_EPISODES = 3;
/** New episodes a pattern like a forgotten or stopped one needs before it is drawn again. */
const NEW_AFTER_PAST = 2;
/** A pattern at least this similar (cosine) to a note or a past pattern restates it. */
const SAME_SIMILARITY = 0.88;

export interface PatternsReport { calls: number; written: number; retired: number; failed: number }

interface EpisodeRow {
  id: string; content: string; occurred_at: Date; subject_kind: SubjectKind; subject_person_id: string | null;
  subject: string | null; candidates: string[] | null; fresh: boolean;
}
interface ActiveRow { id: string; note_id: string; content: string; subject_person_id: string | null; episode_ids: string[] }
type Proposal = PatternsOutput['patterns'][number];

@Injectable()
export class PatternsService {
  private readonly log = new Logger(PatternsService.name);

  constructor(
    private readonly db: DataSource,
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    @Inject(EMBEDDING_PORT) private readonly embeddings: EmbeddingPort,
    private readonly telemetry: TelemetryService,
  ) {}

  async review(memoryId: string, now: Date, runId: string): Promise<PatternsReport> {
    const report: PatternsReport = { calls: 0, written: 0, retired: 0, failed: 0 };
    const [memory]: Array<{ timezone: string; locale: string; mode: string; gender: string | null; display_name: string; aliases: string[] }> = await this.db.query(
      `SELECT o.timezone, o.locale, o.mode, o.gender, p.display_name,
         ARRAY(SELECT alias FROM person_aliases a WHERE a.person_id = o.person_id ORDER BY created_at) AS aliases
       FROM memories o JOIN persons p ON p.id = o.person_id WHERE o.person_id = $1`, [memoryId]);
    if (!memory) return report;
    const tz = memory.timezone;
    const entity = memory.mode === 'entity';
    await this.sync(memoryId);

    const episodes: EpisodeRow[] = (await this.db.query(
      `SELECT e.id, e.content, e.occurred_at, e.subject_kind, e.subject_person_id,
         (SELECT display_name FROM persons WHERE id = e.subject_person_id) AS subject,
         (SELECT array_agg(COALESCE(full_name, display_name) ORDER BY created_at) FROM persons WHERE id = ANY(e.subject_candidates)) AS candidates,
         -- compared in SQL: read into JS the watermark would lose its microseconds
         e.recorded_at > COALESCE((SELECT patterns_upto FROM memories WHERE person_id = $1), '-infinity'::timestamptz) AS fresh
       FROM episodes e
       WHERE e.memory_id = $1 AND e.deleted_at IS NULL AND e.invalidated_at IS NULL AND e.duplicate_of IS NULL
         AND e.kind IN ('event', 'state_change') AND e.occurred_at IS NOT NULL
         AND e.occurred_at <= $2 AND e.occurred_at > $2::timestamptz - make_interval(days => $3)
         AND e.origin <> 'assistant_stated' AND e.author_role <> 'tool' AND NOT (e.author_role = 'other' AND e.stance = 'inferred')
       ORDER BY e.occurred_at DESC, e.id DESC LIMIT $4`, [memoryId, now, LOOKBACK_DAYS, MAX_EPISODES]) as EpisodeRow[]).reverse();
    // Nothing new since the last pass, or too little to repeat itself: no call.
    if (!episodes.some((e) => e.fresh) || episodes.length < MIN_PATTERN_EPISODES) return report;

    const active: ActiveRow[] = await this.db.query(
      `SELECT p.id, p.note_id, n.content, p.subject_person_id,
         ARRAY(SELECT x.episode_id FROM note_evidence x WHERE x.note_id = p.note_id AND x.episode_id IS NOT NULL) AS episode_ids
       FROM episode_promotions p JOIN notes n ON n.id = p.note_id
       WHERE p.memory_id = $1 AND p.status = 'active' ORDER BY p.created_at`, [memoryId]);
    const known: Array<{ content: string; about: string | null }> = await this.db.query(
      `SELECT n.content, (SELECT display_name FROM persons WHERE id = n.subject_person_id) AS about FROM notes n
       WHERE n.memory_id = $1 AND n.status = 'current' AND n.deleted_at IS NULL AND NOT n.pending
         AND NOT EXISTS (SELECT 1 FROM episode_promotions p WHERE p.note_id = n.id)
       ORDER BY n.recorded_at DESC LIMIT $2`, [memoryId, MAX_KNOWN_NOTES]);
    // Forgotten (note deleted) and stopped (retired) patterns: not drawn again from the episodes they came from.
    const past: Array<{ pattern: string; episode_ids: string[]; status: 'forgotten' | 'retired' }> = await this.db.query(
      `SELECT pattern, episode_ids, status::text FROM episode_promotions WHERE memory_id = $1 AND status IN ('forgotten', 'retired')
       ORDER BY updated_at DESC LIMIT $2`, [memoryId, MAX_PAST]);

    const number = new Map(episodes.map((e, i) => [e.id, `E${i + 1}`]));
    const names: Array<{ id: string; display_name: string }> = active.length
      ? await this.db.query(`SELECT id, display_name FROM persons WHERE id = ANY($1)`, [active.map((a) => a.subject_person_id).filter(Boolean)]) : [];
    const nameOf = new Map(names.map((p) => [p.id, p.display_name]));
    const selfNames = [...new Set([memory.display_name, ...memory.aliases].filter(Boolean))];
    // The weekday helps see "every Saturday" (models do not compute it reliably from a date).
    const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: tz });
    const user = [
      `ME: ${selfNames[0] ?? '(unnamed)'}${selfNames.length > 1 ? ` (also: ${selfNames.slice(1).join(', ')})` : ''} — gender ${memory.gender ?? 'masculine'}`,
      `MEMORY LANGUAGE: ${memory.locale}`,
      `TODAY: ${localDate(now, tz)}`,
      `EPISODES:\n${episodes.map((e, i) => `E${i + 1}. [${localDate(e.occurred_at, tz)}, ${weekday.format(e.occurred_at)}] ${subjectLabel(e.subject_kind, e.subject, e.candidates)}${e.content}`).join('\n')}`,
      `PATTERNS:\n${active.map((a, i) => {
        const cited = a.episode_ids.map((id) => number.get(id)).filter(Boolean);
        const who = a.subject_person_id ? `[${nameOf.get(a.subject_person_id) ?? '?'}] ` : '';
        return `P${i + 1}: ${who}${a.content}${cited.length ? ` (${cited.join(', ')})` : ''}`;
      }).join('\n') || '(none)'}`,
      `KNOW:\n${known.map((n) => `- ${n.about ? `[${n.about}] ` : ''}${n.content}`).join('\n') || '(none)'}`,
      `FORGET:\n${past.filter((f) => f.status === 'forgotten').map((f) => `- ${f.pattern}`).join('\n') || '(none)'}`,
      `STOPPED:\n${past.filter((f) => f.status === 'retired').map((f) => `- ${f.pattern}`).join('\n') || '(none)'}`,
    ].join('\n\n');

    let out: PatternsOutput;
    try {
      report.calls++;
      out = await this.llm.completeJson({ promptId: entity ? `${PATTERNS_VERSION}${ENTITY_PATTERNS_SUFFIX}` : PATTERNS_VERSION,
        system: entity ? ENTITY_PATTERNS_SYSTEM : PATTERNS_SYSTEM, user, schema: patternsSchema, maxTokens: 2000, task: 'patterns' }, { memoryId, runId });
    } catch (err) {
      // A failed pass changes nothing and is retried next night (the watermark does not move).
      report.failed++;
      this.log.warn(`pattern pass skipped: ${(err as Error).name}`);
      return report;
    }

    // Vectors of the proposed contents (restating a note?), of the past patterns and of the active ones (a pattern retired
    // in this pass is past for the proposals after it), in one batch.
    const contents = out.patterns.filter((p) => (p.verdict === 'new' || p.verdict === 'update') && p.content?.trim()).map((p) => p.content!.trim());
    let vectors: number[][] = [];
    if (contents.length) {
      try {
        vectors = await this.embeddings.embed([...contents, ...past.map((f) => f.pattern), ...active.map((a) => a.content)], 'document');
      } catch (err) {
        // Without vectors a restatement cannot be told apart: nothing is written, the night is retried.
        report.failed++;
        this.log.warn(`pattern pass skipped: embeddings failed (${(err as Error).message})`);
        return report;
      }
    }
    const vectorOf = new Map(contents.map((c, i) => [c, vectors[i]!]));
    const pastVectors = past.map((f, i) => ({ episode_ids: f.episode_ids, vector: vectors[contents.length + i]! }));
    const activeVector = new Map(active.map((a, i) => [a.id, vectors[contents.length + past.length + i]]));

    const byNumber = new Map(episodes.map((e, i) => [i + 1, e]));
    const target = (raw: string | null | undefined): ActiveRow | undefined => {
      const n = Number((raw ?? '').match(/^\s*P?(\d+)\s*$/i)?.[1]);
      return active[n - 1];
    };
    await this.db.transaction(async (tx) => {
      for (const p of out.patterns) {
        const ev = [...new Set(p.evidence.map((x) => byNumber.get(Number(String(x).replace(/^\s*E/i, '')))).filter((e): e is EpisodeRow => !!e))];
        const t = target(p.target);
        if (p.verdict === 'keep') {
          if (t) await this.keep(tx, memoryId, t, ev);
          continue;
        }
        if (p.verdict === 'retire') {
          if (!t || !ev.some((e) => !t.episode_ids.includes(e.id))) { this.drop('no_evidence'); continue; }
          await this.retire(tx, memoryId, t);
          const vector = activeVector.get(t.id);
          if (vector) pastVectors.push({ episode_ids: t.episode_ids, vector });
          report.retired++;
          continue;
        }
        const content = p.content?.trim();
        if (!content) { this.drop('no_content'); continue; }
        const problem = this.problem(p, ev, tz);
        if (problem) { this.drop(problem); continue; }
        const vector = vectorOf.get(content)!;
        const replaced = p.verdict === 'update' ? t : undefined;
        if (await this.restates(tx, memoryId, vector, replaced?.note_id)) { this.drop('known'); continue; }
        const like = pastVectors.find((f) => cosine(f.vector, vector) >= SAME_SIMILARITY);
        if (like && ev.filter((e) => !like.episode_ids.includes(e.id)).length < NEW_AFTER_PAST) { this.drop('past'); continue; }
        if (replaced) await this.retire(tx, memoryId, replaced, true);
        await this.write(tx, memoryId, runId, p.category, content, ev, vector, replaced?.note_id ?? null);
        report.written++;
      }
      // The watermark is computed in Postgres (microseconds): the last episode would otherwise look new every night.
      await tx.query(`UPDATE memories SET patterns_upto = (SELECT max(recorded_at) FROM episodes WHERE id = ANY($2)) WHERE person_id = $1`,
        [memoryId, episodes.map((e) => e.id)]);
    });
    return report;
  }

  /** Why a new or updated pattern is not written (null: it is). */
  private problem(p: Proposal, ev: EpisodeRow[], tz: string): string | null {
    if (ev.length < MIN_PATTERN_EPISODES) return 'too_few_episodes';
    if (new Set(ev.map((e) => localDate(e.occurred_at, tz))).size < MIN_PATTERN_EPISODES) return 'too_few_days';
    const whose = new Set(ev.map((e) => (e.subject_kind === 'self' ? 'self' : e.subject_kind === 'contact' ? e.subject_person_id : null)));
    if (whose.size !== 1 || whose.has(null)) return 'mixed_subjects';
    const said = (p.subject ?? '').trim().toLowerCase();
    if ((said === '' || said === 'me') !== whose.has('self')) return 'wrong_subject';
    return null;
  }

  private async restates(tx: EntityManager, memoryId: string, vector: number[], except?: string): Promise<boolean> {
    const rows: unknown[] = await tx.query(
      `SELECT 1 FROM notes WHERE memory_id = $1 AND status = 'current' AND deleted_at IS NULL AND embedding IS NOT NULL
         AND id IS DISTINCT FROM $3 AND 1 - (embedding <=> $2::vector) >= $4 LIMIT 1`,
      [memoryId, `[${vector.join(',')}]`, except ?? null, SAME_SIMILARITY]);
    return rows.length > 0;
  }

  private async write(tx: EntityManager, memoryId: string, runId: string, category: string, content: string, ev: EpisodeRow[],
    vector: number[], supersedes: string | null): Promise<void> {
    const first = ev[0]!;
    const subjectId = first.subject_kind === 'contact' ? first.subject_person_id : null;
    const [note] = await tx.query(
      `INSERT INTO notes (memory_id, category, content, tags, supersedes, pending, valid_from, origin, author_role, stance, confidence,
         support_count, extraction_run_id, disclosure, audience, subject_kind, subject_person_id, embedding, embedding_model, embedding_text)
       VALUES ($1, $2, $3, '{pattern}', $4, false, $5, 'holder_lived', 'holder', 'inferred', $6, $7, $8, 'holder', ARRAY[$1::uuid], $9, $10,
         $11::vector, $12, $3) RETURNING id`,
      [memoryId, category, content, supersedes, ev.reduce((a, e) => (e.occurred_at < a ? e.occurred_at : a), first.occurred_at),
        confidence(ev.length), ev.length, runId, subjectId ? 'contact' : 'self', subjectId, `[${vector.join(',')}]`, this.embeddings.model]);
    for (const e of ev) await tx.query(`INSERT INTO note_evidence (note_id, episode_id) VALUES ($1, $2)`, [note.id, e.id]);
    await tx.query(`INSERT INTO note_changes (memory_id, note_id, change) VALUES ($1, $2, $3)`, [memoryId, note.id, supersedes ? 'updated' : 'created']);
    await tx.query(`INSERT INTO episode_promotions (memory_id, note_id, pattern, episode_ids, subject_person_id) VALUES ($1, $2, $3, $4, $5)`,
      [memoryId, note.id, content, ev.map((e) => e.id), subjectId]);
    this.telemetry.emit({ type: 'memory.written', memoryId, runId, table: 'notes', id: note.id });
  }

  /** New episodes of the same subject back an active pattern: more evidence, more confidence. */
  private async keep(tx: EntityManager, memoryId: string, t: ActiveRow, ev: EpisodeRow[]): Promise<void> {
    const added = ev.filter((e) => !t.episode_ids.includes(e.id)
      && (t.subject_person_id ? e.subject_kind === 'contact' && e.subject_person_id === t.subject_person_id : e.subject_kind === 'self'));
    if (!added.length) return;
    for (const e of added) await tx.query(`INSERT INTO note_evidence (note_id, episode_id) VALUES ($1, $2)`, [t.note_id, e.id]);
    const n = t.episode_ids.length + added.length;
    await tx.query(`UPDATE notes SET support_count = $3, confidence = $4 WHERE id = $1 AND memory_id = $2`, [t.note_id, memoryId, n, confidence(n)]);
    await tx.query(`UPDATE episode_promotions SET episode_ids = episode_ids || $2::uuid[], updated_at = now() WHERE id = $1`, [t.id, added.map((e) => e.id)]);
    t.episode_ids.push(...added.map((e) => e.id));
  }

  /** A pattern that stopped holding (or changed: `replaced`) becomes history: superseded, never deleted. */
  private async retire(tx: EntityManager, memoryId: string, t: ActiveRow, replaced = false): Promise<void> {
    await tx.query(`UPDATE notes SET status = 'superseded' WHERE id = $1 AND memory_id = $2 AND status = 'current'`, [t.note_id, memoryId]);
    if (!replaced) await tx.query(`INSERT INTO note_changes (memory_id, note_id, change) VALUES ($1, $2, 'retired')`, [memoryId, t.note_id]);
    await tx.query(`UPDATE episode_promotions SET status = 'retired', updated_at = now() WHERE id = $1`, [t.id]);
  }

  /**
   * What happened to the patterns since the last pass, without a call: a deleted note → forgotten (never drawn again from
   * the same episodes); a note replaced, corrected or retired → retired; a pattern left with fewer than three of its
   * episodes (the others forgotten) is dropped with its note.
   */
  private async sync(memoryId: string): Promise<void> {
    await this.db.query(`UPDATE episode_promotions SET status = 'forgotten', updated_at = now() WHERE memory_id = $1 AND status = 'active' AND note_id IS NULL`, [memoryId]);
    await this.db.query(
      `UPDATE episode_promotions p SET status = 'retired', updated_at = now() FROM notes n
       WHERE p.memory_id = $1 AND p.status = 'active' AND n.id = p.note_id AND (n.status <> 'current' OR n.deleted_at IS NOT NULL)`, [memoryId]);
    const weak: Array<{ id: string; note_id: string }> = await this.db.query(
      `SELECT p.id, p.note_id FROM episode_promotions p
       WHERE p.memory_id = $1 AND p.status = 'active' AND (
         SELECT count(*) FROM note_evidence x JOIN episodes e ON e.id = x.episode_id
         WHERE x.note_id = p.note_id AND e.deleted_at IS NULL AND e.invalidated_at IS NULL) < $2`, [memoryId, MIN_PATTERN_EPISODES]);
    if (!weak.length) return;
    await this.db.transaction(async (tx) => {
      await tx.query(`DELETE FROM episode_promotions WHERE id = ANY($1)`, [weak.map((w) => w.id)]);
      await tx.query(`DELETE FROM notes WHERE id = ANY($1) AND memory_id = $2`, [weak.map((w) => w.note_id), memoryId]);
      for (const w of weak) await tx.query(`INSERT INTO note_changes (memory_id, note_id, change) VALUES ($1, $2, 'forgotten')`, [memoryId, w.note_id]);
    });
  }

  private drop(reason: string): void {
    this.log.debug(`pattern dropped: ${reason}`);
  }
}

/** Three or four episodes: medium; five or more: high. */
function confidence(episodes: number): number {
  return episodes >= 5 ? 0.85 : 0.7;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i]! * b[i]!; na += a[i]! * a[i]!; nb += b[i]! * b[i]!; }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}
