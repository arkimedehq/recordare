// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * The thought pass (D53, WORK_PLAN 8.12a): the agent thinks about what it lived — insights, questions and opinions of its
 * own, each a note of origin `reflected` backed by the episodes it rests on, registered with the patterns in
 * `episode_promotions` (kind `thought`). It runs only when the new public episodes since the last pass gathered enough
 * importance; otherwise no call (the patterns' nightly guard, with a threshold: Generative Agents' importance sum). The
 * model only proposes; the code decides:
 * - every cited episode exists and is visible to anyone (public, D52), lived or told — never the assistant's or a
 *   tool's words, never others' inferred claims;
 * - a new thought cites at least one new episode (no new thought without new evidence: not rumination); an insight or an
 *   opinion needs episodes on two days; at most MAX_NEW a pass;
 * - nothing that restates a note the memory holds, nothing like a thought it was told to forget or that stopped holding
 *   unless a new episode backs it;
 * - support rises with the episodes that back it and falls with those against it; at zero the thought is retired
 *   (superseded, never deleted); one whose note was deleted is `forgotten`.
 * Thoughts are never drawn from thoughts (the depth stays one).
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { EMBEDDING_PORT, type EmbeddingPort } from '../embedding/embedding.port';
import { LLM_PORT, type LlmPort } from '../llm/llm.port';
import { TelemetryService } from '../telemetry/telemetry.service';
import { type SubjectKind } from '../identity/identity.entities';
import { ENTITY_THOUGHTS_SUFFIX, ENTITY_THOUGHTS_SYSTEM, THOUGHTS_SYSTEM, THOUGHTS_VERSION, type ThoughtsOutput, thoughtsSchema } from './thoughts.prompt';
import { localDate } from './time';
import { subjectLabel } from './subjects';
import { vectorParam } from '../db/pgvector';
import { episodeVisible, PUBLIC_ONLY } from '../recall/privacy';
import { cosine } from './patterns.service';

const LOOKBACK_DAYS = 60;
const MAX_EPISODES = 300;
const MAX_KNOWN_NOTES = 150;
const MAX_PAST = 50;
/** Importance (1–10 per episode) the new episodes must gather before the agent thinks again. */
export const THOUGHT_IMPORTANCE = 20;
const MAX_NEW = 3;
/** A thought at least this similar (cosine) to a note or a past thought restates it. */
const SAME_SIMILARITY = 0.88;
const CONFIDENCE = { low: 0.4, medium: 0.6, high: 0.8 } as const;

export interface ThoughtsReport { calls: number; written: number; retired: number; failed: number }

interface EpisodeRow {
  id: string; content: string; occurred_at: Date | null; recorded_at: Date; subject_kind: SubjectKind; subject_person_id: string | null;
  subject: string | null; candidates: string[] | null; fresh: boolean; importance: number;
}
interface ActiveRow {
  id: string; note_id: string; category: string; content: string; subject_person_id: string | null; support: number; episode_ids: string[];
}
type Proposal = ThoughtsOutput['thoughts'][number];

@Injectable()
export class ThoughtsService {
  private readonly log = new Logger(ThoughtsService.name);

  constructor(
    private readonly db: DataSource,
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    @Inject(EMBEDDING_PORT) private readonly embeddings: EmbeddingPort,
    private readonly telemetry: TelemetryService,
  ) {}

  async think(memoryId: string, now: Date, runId: string): Promise<ThoughtsReport> {
    const report: ThoughtsReport = { calls: 0, written: 0, retired: 0, failed: 0 };
    const [memory]: Array<{ timezone: string; locale: string; mode: string; gender: string | null; display_name: string; aliases: string[] }> = await this.db.query(
      `SELECT o.timezone, o.locale, o.mode, o.gender, p.display_name,
         ARRAY(SELECT alias FROM person_aliases a WHERE a.person_id = o.person_id ORDER BY created_at) AS aliases
       FROM memories o JOIN persons p ON p.id = o.person_id WHERE o.person_id = $1`, [memoryId]);
    if (!memory) return report;
    const tz = memory.timezone;
    const entity = memory.mode === 'entity';
    await this.sync(memoryId);

    // Dated or not (a told opinion has no date): the lived and told episodes of the last weeks, public only (D52).
    const episodes: EpisodeRow[] = (await this.db.query(
      `SELECT e.id, e.content, e.occurred_at, e.recorded_at, e.subject_kind, e.subject_person_id, e.importance,
         (SELECT display_name FROM persons WHERE id = e.subject_person_id) AS subject,
         (SELECT array_agg(COALESCE(full_name, display_name) ORDER BY created_at) FROM persons WHERE id = ANY(e.subject_candidates)) AS candidates,
         e.recorded_at > COALESCE((SELECT thoughts_upto FROM memories WHERE person_id = $1), '-infinity'::timestamptz) AS fresh
       FROM episodes e
       WHERE e.memory_id = $1 AND e.deleted_at IS NULL AND e.invalidated_at IS NULL AND e.duplicate_of IS NULL
         AND e.recorded_at <= $2 AND COALESCE(e.occurred_at, e.recorded_at) > $2::timestamptz - make_interval(days => $3)
         AND e.origin <> 'assistant_stated' AND e.author_role <> 'tool' AND NOT (e.author_role = 'other' AND e.stance = 'inferred')
         AND ${episodeVisible('e', PUBLIC_ONLY)}
       ORDER BY COALESCE(e.occurred_at, e.recorded_at) DESC, e.id DESC LIMIT $4`, [memoryId, now, LOOKBACK_DAYS, MAX_EPISODES]) as EpisodeRow[]).reverse();
    // Not enough new since the last pass: no call (the watermark stays, so the importance keeps adding up).
    if (episodes.filter((e) => e.fresh).reduce((a, e) => a + e.importance, 0) < THOUGHT_IMPORTANCE) return report;

    const active: ActiveRow[] = await this.db.query(
      `SELECT p.id, p.note_id, n.category::text, n.content, p.subject_person_id, n.support_count AS support,
         ARRAY(SELECT x.episode_id FROM note_evidence x WHERE x.note_id = p.note_id AND x.episode_id IS NOT NULL AND NOT x.against) AS episode_ids
       FROM episode_promotions p JOIN notes n ON n.id = p.note_id
       WHERE p.memory_id = $1 AND p.kind = 'thought' AND p.status = 'active' ORDER BY p.created_at`, [memoryId]);
    const known: Array<{ content: string; about: string | null }> = await this.db.query(
      `SELECT n.content, (SELECT display_name FROM persons WHERE id = n.subject_person_id) AS about FROM notes n
       WHERE n.memory_id = $1 AND n.status = 'current' AND n.deleted_at IS NULL AND NOT n.pending
         AND NOT EXISTS (SELECT 1 FROM episode_promotions p WHERE p.note_id = n.id AND p.kind = 'thought')
       ORDER BY n.recorded_at DESC LIMIT $2`, [memoryId, MAX_KNOWN_NOTES]);
    const past: Array<{ pattern: string; episode_ids: string[]; status: 'forgotten' | 'retired' }> = await this.db.query(
      `SELECT pattern, episode_ids, status::text FROM episode_promotions WHERE memory_id = $1 AND kind = 'thought' AND status IN ('forgotten', 'retired')
       ORDER BY updated_at DESC LIMIT $2`, [memoryId, MAX_PAST]);

    const number = new Map(episodes.map((e, i) => [e.id, `E${i + 1}`]));
    const names: Array<{ id: string; display_name: string }> = active.length
      ? await this.db.query(`SELECT id, display_name FROM persons WHERE id = ANY($1)`, [active.map((a) => a.subject_person_id).filter(Boolean)]) : [];
    const nameOf = new Map(names.map((p) => [p.id, p.display_name]));
    const selfNames = [...new Set([memory.display_name, ...memory.aliases].filter(Boolean))];
    const user = [
      `ME: ${selfNames[0] ?? '(unnamed)'}${selfNames.length > 1 ? ` (also: ${selfNames.slice(1).join(', ')})` : ''} — gender ${memory.gender ?? 'masculine'}`,
      `MEMORY LANGUAGE: ${memory.locale}`,
      `TODAY: ${localDate(now, tz)}`,
      `EPISODES:\n${episodes.map((e, i) => `E${i + 1}${e.fresh ? '*' : ''}. [${localDate(e.occurred_at ?? e.recorded_at, tz)}] ${subjectLabel(e.subject_kind, e.subject, e.candidates)}${e.content}`).join('\n')}`,
      `THOUGHTS:\n${active.map((a, i) => {
        const cited = a.episode_ids.map((id) => number.get(id)).filter(Boolean);
        const who = a.subject_person_id ? `[${nameOf.get(a.subject_person_id) ?? '?'}] ` : '';
        return `T${i + 1} (${a.category}): ${who}${a.content}${cited.length ? ` (${cited.join(', ')})` : ''}`;
      }).join('\n') || '(none)'}`,
      `KNOW:\n${known.map((n) => `- ${n.about ? `[${n.about}] ` : ''}${n.content}`).join('\n') || '(none)'}`,
      `FORGET:\n${past.filter((f) => f.status === 'forgotten').map((f) => `- ${f.pattern}`).join('\n') || '(none)'}`,
      `STOPPED:\n${past.filter((f) => f.status === 'retired').map((f) => `- ${f.pattern}`).join('\n') || '(none)'}`,
    ].join('\n\n');

    let out: ThoughtsOutput;
    try {
      report.calls++;
      out = await this.llm.completeJson({ promptId: entity ? `${THOUGHTS_VERSION}${ENTITY_THOUGHTS_SUFFIX}` : THOUGHTS_VERSION,
        system: entity ? ENTITY_THOUGHTS_SYSTEM : THOUGHTS_SYSTEM, user, schema: thoughtsSchema, maxTokens: 2000, task: 'thoughts' }, { memoryId, runId });
    } catch (err) {
      // A failed pass changes nothing and is retried next night (the watermark does not move).
      report.failed++;
      this.log.warn(`thought pass skipped: ${(err as Error).name}`);
      return report;
    }

    const contents = out.thoughts.filter((t) => (t.verdict === 'new' || t.verdict === 'revise') && t.content?.trim()).map((t) => t.content!.trim());
    let vectors: number[][] = [];
    if (contents.length) {
      try {
        vectors = await this.embeddings.embed([...contents, ...past.map((f) => f.pattern)], 'document');
      } catch (err) {
        report.failed++;
        this.log.warn(`thought pass skipped: embeddings failed (${(err as Error).message})`);
        return report;
      }
    }
    const vectorOf = new Map(contents.map((c, i) => [c, vectors[i]!]));
    const pastVectors = past.map((f, i) => ({ episode_ids: f.episode_ids, vector: vectors[contents.length + i]! }));

    const byNumber = new Map(episodes.map((e, i) => [i + 1, e]));
    const target = (raw: string | null | undefined): ActiveRow | undefined => active[Number((raw ?? '').match(/^\s*T?(\d+)\s*$/i)?.[1]) - 1];
    let added = 0;
    await this.db.transaction(async (tx) => {
      for (const t of out.thoughts) {
        const ev = [...new Set(t.evidence.map((x) => byNumber.get(Number(String(x).replace(/^\s*E/i, '')))).filter((e): e is EpisodeRow => !!e))];
        const fresh = ev.filter((e) => e.fresh);
        const old = target(t.target);
        if (t.verdict === 'support' || t.verdict === 'weaken' || t.verdict === 'retire') {
          const news = old ? fresh.filter((e) => !old.episode_ids.includes(e.id)) : [];
          if (!old || !news.length) { this.drop('no_new_evidence'); continue; }
          if (t.verdict === 'support') await this.evidence(tx, memoryId, old, news, false);
          else if (t.verdict === 'retire' || old.support - news.length <= 0) { await this.retire(tx, memoryId, old); report.retired++; }
          else await this.evidence(tx, memoryId, old, news, true);
          continue;
        }
        const content = t.content?.trim();
        if (!content) { this.drop('no_content'); continue; }
        if (t.verdict === 'new' && added >= MAX_NEW) { this.drop('too_many'); continue; }
        if (!fresh.length) { this.drop('nothing_new'); continue; }
        const days = new Set(ev.map((e) => localDate(e.occurred_at ?? e.recorded_at, tz))).size;
        if (t.kind !== 'question' && days < 2) { this.drop('one_day'); continue; }
        const subjectId = this.subject(t, ev);
        if (subjectId === undefined) { this.drop('wrong_subject'); continue; }
        const vector = vectorOf.get(content)!;
        const replaced = t.verdict === 'revise' ? old : undefined;
        if (t.verdict === 'revise' && !replaced) { this.drop('no_target'); continue; }
        if (await this.restates(tx, memoryId, vector, replaced?.note_id)) { this.drop('known'); continue; }
        const like = pastVectors.find((f) => cosine(f.vector, vector) >= SAME_SIMILARITY);
        if (like && !fresh.some((e) => !like.episode_ids.includes(e.id))) { this.drop('past'); continue; }
        if (replaced) await this.retire(tx, memoryId, replaced, true);
        await this.write(tx, memoryId, runId, t, content, ev, subjectId, vector, replaced?.note_id ?? null);
        if (t.verdict === 'new') added++;
        report.written++;
      }
      await tx.query(`UPDATE memories SET thoughts_upto = (SELECT max(recorded_at) FROM episodes WHERE id = ANY($2)) WHERE person_id = $1`,
        [memoryId, episodes.map((e) => e.id)]);
    });
    return report;
  }

  /** Whom the thought is about: null for me (or my place), a contact's id, undefined when the name is not in its episodes. */
  private subject(t: Proposal, ev: EpisodeRow[]): string | null | undefined {
    const said = (t.subject ?? '').trim().toLowerCase();
    if (said === '' || said === 'me') return null;
    const match = ev.find((e) => e.subject_kind === 'contact' && e.subject?.toLowerCase() === said);
    return match ? match.subject_person_id : undefined;
  }

  private async restates(tx: EntityManager, memoryId: string, vector: number[], except?: string): Promise<boolean> {
    const rows: unknown[] = await tx.query(
      `SELECT 1 FROM notes WHERE memory_id = $1 AND status = 'current' AND deleted_at IS NULL AND embedding IS NOT NULL
         AND id IS DISTINCT FROM $3 AND 1 - (embedding <=> $2::vector) >= $4 LIMIT 1`,
      [memoryId, vectorParam(vector), except ?? null, SAME_SIMILARITY]);
    return rows.length > 0;
  }

  private async write(tx: EntityManager, memoryId: string, runId: string, t: Proposal, content: string, ev: EpisodeRow[],
    subjectId: string | null, vector: number[], supersedes: string | null): Promise<void> {
    const [note] = await tx.query(
      `INSERT INTO notes (memory_id, category, content, tags, supersedes, pending, valid_from, origin, author_role, stance, confidence,
         support_count, extraction_run_id, disclosure, audience, subject_kind, subject_person_id, embedding, embedding_model, embedding_text)
       VALUES ($1, $2, $3, '{thought}', $4, false, $5, 'reflected', 'holder', 'inferred', $6, $7, $8, 'holder', ARRAY[$1::uuid], $9, $10,
         $11::vector, $12, $3) RETURNING id`,
      [memoryId, t.kind, content, supersedes, ev.reduce<Date>((a, e) => { const d = e.occurred_at ?? e.recorded_at; return d < a ? d : a; }, ev[0]!.occurred_at ?? ev[0]!.recorded_at),
        CONFIDENCE[t.confidence], ev.length, runId, subjectId ? 'contact' : 'self', subjectId, vectorParam(vector), this.embeddings.model]);
    for (const e of ev) await tx.query(`INSERT INTO note_evidence (note_id, episode_id) VALUES ($1, $2)`, [note.id, e.id]);
    await tx.query(`INSERT INTO note_changes (memory_id, note_id, change) VALUES ($1, $2, $3)`, [memoryId, note.id, supersedes ? 'updated' : 'created']);
    await tx.query(`INSERT INTO episode_promotions (memory_id, note_id, pattern, episode_ids, subject_person_id, kind) VALUES ($1, $2, $3, $4, $5, 'thought')`,
      [memoryId, note.id, content, ev.map((e) => e.id), subjectId]);
    this.telemetry.emit({ type: 'memory.written', memoryId, runId, table: 'notes', id: note.id });
  }

  /** New episodes for (or, `against`, against) a thought: its support moves with them. */
  private async evidence(tx: EntityManager, memoryId: string, t: ActiveRow, ev: EpisodeRow[], against: boolean): Promise<void> {
    for (const e of ev) await tx.query(`INSERT INTO note_evidence (note_id, episode_id, against) VALUES ($1, $2, $3)`, [t.note_id, e.id, against]);
    t.support += against ? -ev.length : ev.length;
    await tx.query(`UPDATE notes SET support_count = $3 WHERE id = $1 AND memory_id = $2`, [t.note_id, memoryId, t.support]);
    if (!against) await tx.query(`UPDATE episode_promotions SET episode_ids = episode_ids || $2::uuid[], updated_at = now() WHERE id = $1`, [t.id, ev.map((e) => e.id)]);
    t.episode_ids.push(...ev.map((e) => e.id));
  }

  /** A thought that stopped holding (or changed: `replaced`) becomes history: superseded, never deleted. */
  private async retire(tx: EntityManager, memoryId: string, t: ActiveRow, replaced = false): Promise<void> {
    await tx.query(`UPDATE notes SET status = 'superseded' WHERE id = $1 AND memory_id = $2 AND status = 'current'`, [t.note_id, memoryId]);
    if (!replaced) await tx.query(`INSERT INTO note_changes (memory_id, note_id, change) VALUES ($1, $2, 'retired')`, [memoryId, t.note_id]);
    await tx.query(`UPDATE episode_promotions SET status = 'retired', updated_at = now() WHERE id = $1`, [t.id]);
  }

  /**
   * What happened to the thoughts since the last pass, without a call: a deleted note → forgotten; a note replaced,
   * corrected or retired → retired; a thought left with no episode behind it (forgotten, corrected away) is dropped.
   */
  private async sync(memoryId: string): Promise<void> {
    await this.db.query(`UPDATE episode_promotions SET status = 'forgotten', updated_at = now() WHERE memory_id = $1 AND kind = 'thought' AND status = 'active' AND note_id IS NULL`, [memoryId]);
    await this.db.query(
      `UPDATE episode_promotions p SET status = 'retired', updated_at = now() FROM notes n
       WHERE p.memory_id = $1 AND p.kind = 'thought' AND p.status = 'active' AND n.id = p.note_id AND (n.status <> 'current' OR n.deleted_at IS NOT NULL)`, [memoryId]);
    const empty: Array<{ id: string; note_id: string }> = await this.db.query(
      `SELECT p.id, p.note_id FROM episode_promotions p
       WHERE p.memory_id = $1 AND p.kind = 'thought' AND p.status = 'active' AND NOT EXISTS (
         SELECT 1 FROM note_evidence x JOIN episodes e ON e.id = x.episode_id
         WHERE x.note_id = p.note_id AND NOT x.against AND e.deleted_at IS NULL AND e.invalidated_at IS NULL)`, [memoryId]);
    if (!empty.length) return;
    await this.db.transaction(async (tx) => {
      await tx.query(`DELETE FROM episode_promotions WHERE id = ANY($1)`, [empty.map((w) => w.id)]);
      await tx.query(`DELETE FROM notes WHERE id = ANY($1) AND memory_id = $2`, [empty.map((w) => w.note_id), memoryId]);
      for (const w of empty) await tx.query(`INSERT INTO note_changes (memory_id, note_id, change) VALUES ($1, $2, 'forgotten')`, [memoryId, w.note_id]);
    });
  }

  private drop(reason: string): void {
    this.log.debug(`thought dropped: ${reason}`);
  }
}
