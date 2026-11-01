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
 * - a new insight or opinion cites at least one new episode (no new thought without new evidence: not rumination) and
 *   episodes on two days; a question may rest on older ones — silence about something awaited is its evidence (what was
 *   asked once stays until answered: the list of held thoughts and the restatement check keep it from being asked again);
 *   at most MAX_NEW a pass;
 * - nothing that restates a note the memory holds, nothing like a thought it was told to forget or that stopped holding
 *   unless a new episode backs it;
 * - support rises with the episodes that back it and falls with those against it; at zero the thought is retired
 *   (superseded, never deleted); one whose note was deleted is `forgotten`.
 * Thoughts are never drawn from thoughts (the depth stays one).
 * The self-model (8.12b): a thought of kind `self` — what the agent learned about itself as an agent — rests on MY REPLIES
 * (its own messages with the person's next message), public ones only, as message evidence; the same rules.
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
import { episodeVisible, messageVisible, PUBLIC_ONLY } from '../recall/privacy';
import { cosine } from './patterns.service';

const LOOKBACK_DAYS = 60;
const MAX_EPISODES = 300;
const MAX_KNOWN_NOTES = 150;
const MAX_PAST = 50;
/** My own replies shown, the newest; each with the person's next message, cut to REPLY_CHARS. */
const MAX_REPLIES = 60;
const REPLY_CHARS = 240;
/** Importance (1–10 per episode) the new episodes must gather before the agent thinks again. */
export const THOUGHT_IMPORTANCE = 20;
const MAX_NEW = 4;
/** A thought at least this similar (cosine) to a note or a past thought restates it. */
const SAME_SIMILARITY = 0.88;
/** A new thought at least this similar to one I hold, on the same subject, is that thought revised (the models add an
 * opposite thought next to the old one instead of retiring it: the train that is late, then the train that is on time). */
const REVISE_SIMILARITY = 0.8;
const CONFIDENCE = { low: 0.4, medium: 0.6, high: 0.8 } as const;

export interface ThoughtsReport { calls: number; written: number; retired: number; failed: number }

interface EpisodeRow {
  id: string; content: string; occurred_at: Date | null; recorded_at: Date; subject_kind: SubjectKind; subject_person_id: string | null;
  subject: string | null; candidates: string[] | null; fresh: boolean; importance: number;
}
interface ActiveRow {
  id: string; note_id: string; category: string; content: string; subject_person_id: string | null; support: number; episode_ids: string[];
  message_ids: string[];
}
/** One of my replies and what the person said next (null: nothing within the day). */
interface ReplyRow {
  id: string; content: string; sent_at: Date; fresh: boolean; reaction_id: string | null; reaction: string | null; who: string | null;
}
/** What a proposal cites: episodes and replies. */
interface Cited { ev: EpisodeRow[]; rv: ReplyRow[]; ids: string[]; fresh: boolean; days: number }
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

    // Dated or not (a told opinion has no date): the lived and told episodes of the last weeks, public only (D52); an open
    // plan still ahead comes along once its telling was said (what is awaited or prepared is food for thought).
    const episodes: EpisodeRow[] = (await this.db.query(
      `SELECT e.id, e.content, e.occurred_at, e.recorded_at, e.subject_kind, e.subject_person_id, e.importance,
         (SELECT display_name FROM persons WHERE id = e.subject_person_id) AS subject,
         (SELECT array_agg(COALESCE(full_name, display_name) ORDER BY created_at) FROM persons WHERE id = ANY(e.subject_candidates)) AS candidates,
         e.recorded_at > COALESCE((SELECT thoughts_upto FROM memories WHERE person_id = $1), '-infinity'::timestamptz) AS fresh
       FROM episodes e
       WHERE e.memory_id = $1 AND e.deleted_at IS NULL AND e.invalidated_at IS NULL AND e.duplicate_of IS NULL
         AND (COALESCE(e.occurred_at, e.recorded_at) <= $2 OR (e.kind = 'plan' AND e.plan_status = 'open'
           AND EXISTS (SELECT 1 FROM episode_evidence pv JOIN messages pm ON pm.id = pv.message_id WHERE pv.episode_id = e.id AND pm.sent_at <= $2)))
         AND COALESCE(e.occurred_at, e.recorded_at) > $2::timestamptz - make_interval(days => $3)
         AND e.origin <> 'assistant_stated' AND e.author_role <> 'tool' AND NOT (e.author_role = 'other' AND e.stance = 'inferred')
         AND ${episodeVisible('e', PUBLIC_ONLY)}
       ORDER BY COALESCE(e.occurred_at, e.recorded_at) DESC, e.id DESC LIMIT $4`, [memoryId, now, LOOKBACK_DAYS, MAX_EPISODES]) as EpisodeRow[]).reverse();
    // Not enough new since the last pass: no call (the watermark stays, so the importance keeps adding up).
    if (episodes.filter((e) => e.fresh).reduce((a, e) => a + e.importance, 0) < THOUGHT_IMPORTANCE) return report;

    // My replies and what came next, public only (D52): what I learned about myself rests on them (8.12b).
    const replies: ReplyRow[] = (await this.db.query(
      `SELECT a.id, a.content, a.sent_at, a.received_at > COALESCE((SELECT thoughts_upto FROM memories WHERE person_id = $1), '-infinity'::timestamptz) AS fresh,
         r.id AS reaction_id, r.content AS reaction, (SELECT display_name FROM persons WHERE id = r.author_person_id) AS who
       FROM messages a LEFT JOIN LATERAL (
         SELECT m.id, m.content, m.author_person_id FROM messages m
         WHERE m.conversation_id = a.conversation_id AND m.role IN ('user', 'other') AND m.sent_at > a.sent_at
           AND m.sent_at < a.sent_at + interval '1 day' AND ${messageVisible('m', PUBLIC_ONLY)} ORDER BY m.sent_at LIMIT 1) r ON true
       WHERE a.memory_id = $1 AND a.role = 'assistant' AND a.sent_at <= $2 AND a.sent_at > $2::timestamptz - make_interval(days => $3)
         AND ${messageVisible('a', PUBLIC_ONLY)}
       ORDER BY a.sent_at DESC LIMIT $4`, [memoryId, now, LOOKBACK_DAYS, MAX_REPLIES]) as ReplyRow[]).reverse();

    const active: ActiveRow[] = await this.db.query(
      `SELECT p.id, p.note_id, n.category::text, n.content, p.subject_person_id, n.support_count AS support,
         ARRAY(SELECT x.episode_id FROM note_evidence x WHERE x.note_id = p.note_id AND x.episode_id IS NOT NULL AND NOT x.against) AS episode_ids,
         ARRAY(SELECT x.message_id FROM note_evidence x WHERE x.note_id = p.note_id AND x.message_id IS NOT NULL AND NOT x.against) AS message_ids
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

    const number = new Map<string, string>([...episodes.map((e, i): [string, string] => [e.id, `E${i + 1}`]), ...replies.map((r, i): [string, string] => [r.id, `R${i + 1}`])]);
    const cut = (text: string) => (text.length > REPLY_CHARS ? `${text.slice(0, REPLY_CHARS)}…` : text).replace(/\s+/g, ' ');
    const names: Array<{ id: string; display_name: string }> = active.length
      ? await this.db.query(`SELECT id, display_name FROM persons WHERE id = ANY($1)`, [active.map((a) => a.subject_person_id).filter(Boolean)]) : [];
    const nameOf = new Map(names.map((p) => [p.id, p.display_name]));
    const selfNames = [...new Set([memory.display_name, ...memory.aliases].filter(Boolean))];
    const user = [
      `ME: ${selfNames[0] ?? '(unnamed)'}${selfNames.length > 1 ? ` (also: ${selfNames.slice(1).join(', ')})` : ''} — gender ${memory.gender ?? 'masculine'}`,
      `MEMORY LANGUAGE: ${memory.locale}`,
      `TODAY: ${localDate(now, tz)}`,
      `EPISODES:\n${episodes.map((e, i) => `E${i + 1}${e.fresh ? '*' : ''}. [${localDate(e.occurred_at ?? e.recorded_at, tz)}] ${subjectLabel(e.subject_kind, e.subject, e.candidates)}${e.content}`).join('\n')}`,
      `MY REPLIES:\n${replies.map((r, i) => `R${i + 1}${r.fresh ? '*' : ''}. [${localDate(r.sent_at, tz)}] ME: ${cut(r.content)}${r.reaction ? ` → ${r.who ?? 'they'}: ${cut(r.reaction)}` : ''}`).join('\n') || '(none)'}`,
      `THOUGHTS:\n${active.map((a, i) => {
        const cited = [...a.episode_ids, ...a.message_ids].map((id) => number.get(id)).filter(Boolean);
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
        vectors = await this.embeddings.embed([...contents, ...past.map((f) => f.pattern), ...active.map((a) => a.content)], 'document');
      } catch (err) {
        report.failed++;
        this.log.warn(`thought pass skipped: embeddings failed (${(err as Error).message})`);
        return report;
      }
    }
    const vectorOf = new Map(contents.map((c, i) => [c, vectors[i]!]));
    const pastVectors = past.map((f, i) => ({ episode_ids: f.episode_ids, vector: vectors[contents.length + i]! }));
    const activeVector = new Map(active.map((a, i) => [a.id, vectors[contents.length + past.length + i]!]));

    const byNumber = new Map(episodes.map((e, i) => [i + 1, e]));
    const replyByNumber = new Map(replies.map((r, i) => [i + 1, r]));
    /** What a proposal cites: "E3" / 3 are episodes, "R2" my replies. */
    const cited = (t: Proposal): Cited => {
      const ev: EpisodeRow[] = [], rv: ReplyRow[] = [];
      for (const x of t.evidence) {
        const m = String(x).trim().match(/^([ER])?(\d+)$/i);
        if (!m) continue;
        if (m[1]?.toUpperCase() === 'R') { const r = replyByNumber.get(Number(m[2])); if (r && !rv.includes(r)) rv.push(r); }
        else { const e = byNumber.get(Number(m[2])); if (e && !ev.includes(e)) ev.push(e); }
      }
      const when = [...ev.map((e) => e.occurred_at ?? e.recorded_at), ...rv.map((r) => r.sent_at)];
      return { ev, rv, ids: [...ev.map((e) => e.id), ...rv.map((r) => r.id)], fresh: ev.some((e) => e.fresh) || rv.some((r) => r.fresh),
        days: new Set(when.map((d) => localDate(d, tz))).size };
    };
    const target = (raw: string | null | undefined): ActiveRow | undefined => active[Number((raw ?? '').match(/^\s*T?(\d+)\s*$/i)?.[1]) - 1];
    let added = 0;
    await this.db.transaction(async (tx) => {
      for (const t of out.thoughts) {
        const c = cited(t);
        const old = target(t.target);
        if (t.verdict === 'support' || t.verdict === 'weaken' || t.verdict === 'retire') {
          const news: Cited | null = old ? { ...c, ev: c.ev.filter((e) => e.fresh && !old.episode_ids.includes(e.id)),
            rv: c.rv.filter((r) => r.fresh && !old.message_ids.includes(r.id)) } : null;
          const n = news ? news.ev.length + news.rv.length : 0;
          if (!old || !news || !n) { this.drop('no_new_evidence'); continue; }
          if (t.verdict === 'support') await this.evidence(tx, memoryId, old, news, false);
          else if (t.verdict === 'retire' || old.support - n <= 0) { await this.retire(tx, memoryId, old); report.retired++; }
          else await this.evidence(tx, memoryId, old, news, true);
          continue;
        }
        const content = t.content?.trim();
        if (!content) { this.drop('no_content'); continue; }
        if (t.verdict === 'new' && added >= MAX_NEW) { this.drop('too_many', t); continue; }
        if (!c.fresh && t.kind !== 'question') { this.drop('nothing_new', t); continue; }
        if (t.kind !== 'question' && c.days < 2) { this.drop('one_day', t); continue; }
        if (t.kind === 'self' && !c.rv.length) { this.drop('no_reply', t); continue; } // what I learned of myself rests on my replies
        const subjectId = t.kind === 'self' ? null : await this.subject(tx, t, c.ev);
        const vector = vectorOf.get(content)!;
        if (t.verdict === 'revise' && !old) { this.drop('no_target', t); continue; }
        // A new thought on the same subject and matter as one I hold revises it (it is not added beside it).
        const alike = t.verdict === 'new'
          ? active.find((a) => a.subject_person_id === subjectId && cosine(activeVector.get(a.id)!, vector) >= REVISE_SIMILARITY) : undefined;
        const replaced = t.verdict === 'revise' ? old : alike;
        if (await this.restates(tx, memoryId, vector, replaced?.note_id)) { this.drop('known', t); continue; }
        const like = pastVectors.find((f) => cosine(f.vector, vector) >= SAME_SIMILARITY);
        if (like && !c.ids.some((id) => !like.episode_ids.includes(id))) { this.drop('past', t); continue; }
        if (replaced) await this.retire(tx, memoryId, replaced, true);
        await this.write(tx, memoryId, runId, t, content, c, subjectId, vector, replaced?.note_id ?? null);
        if (t.verdict === 'new') added++;
        report.written++;
      }
      await tx.query(`UPDATE memories SET thoughts_upto = (SELECT max(recorded_at) FROM episodes WHERE id = ANY($2)) WHERE person_id = $1`,
        [memoryId, episodes.map((e) => e.id)]);
    });
    return report;
  }

  /**
   * Whom the thought is about: null for me (or my place), else the contact named — the subject of a cited episode, or a
   * person named in one (a thought about my sister rests on episodes of mine). A name none of them carries: the thought
   * stays mine (its words say whom it concerns).
   */
  private async subject(tx: EntityManager, t: Proposal, ev: EpisodeRow[]): Promise<string | null> {
    const said = (t.subject ?? '').trim().toLowerCase();
    if (said === '' || said === 'me') return null;
    const match = ev.find((e) => e.subject_kind === 'contact' && e.subject?.toLowerCase() === said);
    if (match) return match.subject_person_id;
    const [named]: Array<{ person_id: string }> = await tx.query(
      `SELECT ep.person_id FROM episode_people ep JOIN persons p ON p.id = ep.person_id
       WHERE ep.episode_id = ANY($1) AND (lower(ep.alias) = $2 OR lower(p.display_name) = $2) LIMIT 1`, [ev.map((e) => e.id), said]);
    return named?.person_id ?? null;
  }

  /** Restates a note the memory holds — a habit apart: a thought may build on a pattern ("the flour is late on Thursdays: order on Wednesday"). */
  private async restates(tx: EntityManager, memoryId: string, vector: number[], except?: string): Promise<boolean> {
    const rows: unknown[] = await tx.query(
      `SELECT 1 FROM notes WHERE memory_id = $1 AND status = 'current' AND deleted_at IS NULL AND embedding IS NOT NULL
         AND NOT 'pattern' = ANY(tags) AND id IS DISTINCT FROM $3 AND 1 - (embedding <=> $2::vector) >= $4 LIMIT 1`,
      [memoryId, vectorParam(vector), except ?? null, SAME_SIMILARITY]);
    return rows.length > 0;
  }

  private async write(tx: EntityManager, memoryId: string, runId: string, t: Proposal, content: string, c: Cited,
    subjectId: string | null, vector: number[], supersedes: string | null): Promise<void> {
    const when = [...c.ev.map((e) => e.occurred_at ?? e.recorded_at), ...c.rv.map((r) => r.sent_at)];
    const [note] = await tx.query(
      `INSERT INTO notes (memory_id, category, content, tags, supersedes, pending, valid_from, origin, author_role, stance, confidence,
         support_count, extraction_run_id, disclosure, audience, subject_kind, subject_person_id, embedding, embedding_model, embedding_text)
       VALUES ($1, $2, $3, '{thought}', $4, false, $5, 'reflected', 'holder', 'inferred', $6, $7, $8, 'holder', ARRAY[$1::uuid], $9, $10,
         $11::vector, $12, $3) RETURNING id`,
      [memoryId, t.kind, content, supersedes, when.reduce((a, d) => (d < a ? d : a)),
        CONFIDENCE[t.confidence], c.ids.length, runId, subjectId ? 'contact' : 'self', subjectId, vectorParam(vector), this.embeddings.model]);
    for (const e of c.ev) await tx.query(`INSERT INTO note_evidence (note_id, episode_id) VALUES ($1, $2)`, [note.id, e.id]);
    // A reply with what they said next: both messages back it (what I said, how it went).
    for (const r of c.rv) for (const id of [r.id, r.reaction_id]) if (id) await tx.query(`INSERT INTO note_evidence (note_id, message_id) VALUES ($1, $2)`, [note.id, id]);
    await tx.query(`INSERT INTO note_changes (memory_id, note_id, change) VALUES ($1, $2, $3)`, [memoryId, note.id, supersedes ? 'updated' : 'created']);
    await tx.query(`INSERT INTO episode_promotions (memory_id, note_id, pattern, episode_ids, subject_person_id, kind) VALUES ($1, $2, $3, $4, $5, 'thought')`,
      [memoryId, note.id, content, c.ev.map((e) => e.id), subjectId]);
    this.telemetry.emit({ type: 'memory.written', memoryId, runId, table: 'notes', id: note.id });
  }

  /** New episodes and replies for (or, `against`, against) a thought: its support moves with them. */
  private async evidence(tx: EntityManager, memoryId: string, t: ActiveRow, c: Cited, against: boolean): Promise<void> {
    for (const e of c.ev) await tx.query(`INSERT INTO note_evidence (note_id, episode_id, against) VALUES ($1, $2, $3)`, [t.note_id, e.id, against]);
    for (const r of c.rv) for (const id of [r.id, r.reaction_id]) if (id) await tx.query(`INSERT INTO note_evidence (note_id, message_id, against) VALUES ($1, $2, $3)`, [t.note_id, id, against]);
    const n = c.ev.length + c.rv.length;
    t.support += against ? -n : n;
    await tx.query(`UPDATE notes SET support_count = $3 WHERE id = $1 AND memory_id = $2`, [t.note_id, memoryId, t.support]);
    if (!against) await tx.query(`UPDATE episode_promotions SET episode_ids = episode_ids || $2::uuid[], updated_at = now() WHERE id = $1`, [t.id, c.ev.map((e) => e.id)]);
    t.episode_ids.push(...c.ev.map((e) => e.id));
    t.message_ids.push(...c.rv.map((r) => r.id));
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
         WHERE x.note_id = p.note_id AND NOT x.against AND e.deleted_at IS NULL AND e.invalidated_at IS NULL)
         AND NOT EXISTS (SELECT 1 FROM note_evidence x JOIN messages m ON m.id = x.message_id WHERE x.note_id = p.note_id AND NOT x.against)`, [memoryId]);
    if (!empty.length) return;
    await this.db.transaction(async (tx) => {
      await tx.query(`DELETE FROM episode_promotions WHERE id = ANY($1)`, [empty.map((w) => w.id)]);
      await tx.query(`DELETE FROM notes WHERE id = ANY($1) AND memory_id = $2`, [empty.map((w) => w.note_id), memoryId]);
      for (const w of empty) await tx.query(`INSERT INTO note_changes (memory_id, note_id, change) VALUES ($1, $2, 'forgotten')`, [memoryId, w.note_id]);
    });
  }

  private drop(reason: string, t?: Proposal): void {
    this.log.debug(`thought dropped: ${reason}${t ? ` (${t.kind}, ${t.evidence.length} ep.)` : ''}`);
  }
}
