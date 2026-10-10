// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Nightly facts review (M5): the memory's current facts checked against the episodes recorded since the last review —
 * one LLM call (task `facts`) per memory per night with new episodes, none otherwise. The model only proposes verdicts;
 * the extraction's writer applies them with the same rules (history kept, corrections never rewrite, forgotten content
 * never comes back, other people's words never become someone's facts), each change backed by the messages behind
 * the episodes it cites. v2 (WORK_PLAN 8.6): facts of every subject — the self's and the contacts' — with the
 * extraction's people context (ME, PEOPLE I KNOW); other people's claims (author other, inferred) are not reviewed.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EMBEDDING_PORT, type EmbeddingPort } from '../embedding/embedding.port';
import { LLM_PORT, type LlmPort } from '../llm/llm.port';
import { TelemetryService } from '../telemetry/telemetry.service';
import { type ExtractionInput, type FactRef, peopleContext, type WindowMessage } from './extraction.context';
import { ExtractionWriter, type WrittenRow } from './extraction.writer';
import { ENTITY_FACTS_REVIEW_SUFFIX, ENTITY_FACTS_REVIEW_SYSTEM, FACTS_REVIEW_SYSTEM, FACTS_REVIEW_VERSION, factsReviewSchema } from './facts-review.prompt';
import { type PromptContext } from './extraction.prompt';
import { localDate } from './time';
import { accountSpeaker, type AuthorKind } from '../rawlog/attribution';
import { type SubjectKind } from '../identity/identity.entities';
import { subjectLabel } from './subjects';

/** Episodes per review: the oldest new ones first; the rest wait for the next night. */
const MAX_EPISODES = 300;
const HISTORY_PER_KEY = 3;

export interface FactsReviewReport { calls: number; changed: number; failed: number }

@Injectable()
export class FactsReviewService {
  private readonly log = new Logger(FactsReviewService.name);

  constructor(
    private readonly db: DataSource,
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    @Inject(EMBEDDING_PORT) private readonly embeddings: EmbeddingPort,
    private readonly telemetry: TelemetryService,
  ) {}

  async review(ownerId: string, now: Date, runId: string): Promise<FactsReviewReport> {
    const report: FactsReviewReport = { calls: 0, changed: 0, failed: 0 };
    const [owner]: Array<{ timezone: string; locale: string; mode: string; gender: 'masculine' | 'feminine' | 'neutral'; display_name: string }> = await this.db.query(
      `SELECT o.timezone, o.locale, o.mode, o.gender, p.display_name FROM owners o JOIN persons p ON p.id = o.person_id WHERE o.person_id = $1`, [ownerId]);
    if (!owner) return report;
    const tz = owner.timezone;
    const entity = owner.mode === 'entity';
    const episodes: Array<{ id: string; kind: string; content: string; occurred_at: Date | null; recorded_at: Date;
      subject_kind: SubjectKind; subject: string | null; candidates: string[] | null }> = await this.db.query(
      `SELECT e.id, e.kind, e.content, e.occurred_at, e.recorded_at, e.subject_kind,
         (SELECT display_name FROM persons WHERE id = e.subject_person_id) AS subject,
         (SELECT array_agg(COALESCE(full_name, display_name) ORDER BY created_at) FROM persons WHERE id = ANY(e.subject_candidates)) AS candidates
       FROM episodes e
       WHERE e.owner_id = $1 AND e.deleted_at IS NULL AND e.invalidated_at IS NULL AND e.duplicate_of IS NULL
         AND NOT (e.author_role = 'other' AND e.stance = 'inferred')
         -- compared in SQL: read into JS the watermark would lose its microseconds
         AND e.recorded_at > COALESCE((SELECT facts_reviewed_upto FROM owners WHERE person_id = $1), '-infinity'::timestamptz)
         AND EXISTS (SELECT 1 FROM episode_evidence v WHERE v.episode_id = e.id AND v.message_id IS NOT NULL)
       ORDER BY e.recorded_at LIMIT $2`, [ownerId, MAX_EPISODES]);
    if (episodes.length === 0) return report; // nothing new: no call

    // One message behind each episode stands for its evidence (number n ↔ episode n); its text carries the episode's
    // too, so the writer's checks (a person named, a person speaking of themself) see both.
    const evidence: Array<{ episode_id: string; id: string; role: WindowMessage['role']; tool_name: string | null;
      account_speaker: boolean; author_kind: AuthorKind; author_person_id: string | null; author_name: string | null; content: string; sent_at: Date }> = await this.db.query(
      `SELECT DISTINCT ON (v.episode_id) v.episode_id, m.id, m.role, m.tool_name,
         ${entity ? accountSpeaker('m') : `m.author_kind IN ('self', 'own')`} AS account_speaker, m.author_kind,
         m.author_person_id, COALESCE(p.display_name, cp.display_name) AS author_name, m.content, m.sent_at
       FROM episode_evidence v JOIN messages m ON m.id = v.message_id LEFT JOIN persons p ON p.id = m.author_person_id
         LEFT JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.ref = m.author_ref
       WHERE v.episode_id = ANY($1) ORDER BY v.episode_id, m.sent_at`,
      [episodes.map((e) => e.id)]);
    const byEpisode = new Map(evidence.map((m) => [m.episode_id, m]));
    const listed = episodes.filter((e) => byEpisode.has(e.id));
    const messages: WindowMessage[] = listed.map((e) => {
      const m = byEpisode.get(e.id)!;
      return { id: m.id, role: m.role, toolName: m.tool_name, accountSpeaker: m.account_speaker, authorKind: m.author_kind,
        authorPersonId: m.author_person_id, authorName: m.author_name, content: `${e.content}\n${m.content}`, sentAt: m.sent_at };
    });

    const facts: Array<{ id: string; key: string; value: string | null; valid_from: Date | null; subject_id: string | null; subject: string | null }> = await this.db.query(
      `SELECT f.id, f.key, f.value, f.valid_from, f.subject_person_id AS subject_id, p.display_name AS subject
       FROM facts f LEFT JOIN persons p ON p.id = f.subject_person_id
       WHERE f.owner_id = $1 AND f.deleted_at IS NULL AND f.status IN ('current', 'unknown_current')
       ORDER BY p.display_name NULLS FIRST, f.key, f.valid_from NULLS FIRST`, [ownerId]);
    const history: Array<{ key: string; subject_id: string | null; value: string | null; valid_from: Date | null; valid_to: Date | null }> = await this.db.query(
      `SELECT key, subject_id, value, valid_from, valid_to FROM (
         SELECT key, subject_person_id AS subject_id, value, valid_from, valid_to,
           row_number() OVER (PARTITION BY key, subject_person_id ORDER BY valid_to DESC NULLS LAST) AS n
         FROM facts WHERE owner_id = $1 AND deleted_at IS NULL AND status = 'superseded') h
       WHERE n <= $2`, [ownerId, HISTORY_PER_KEY]);
    const slots: Array<{ key: string }> = await this.db.query(`SELECT key FROM fact_slots ORDER BY key`);
    const people = await peopleContext(this.db.manager, { id: ownerId, name: owner.display_name, locale: owner.locale, timezone: tz, entity },
      messages, facts.map((f) => f.subject_id).filter((x): x is string => !!x));
    const day = (d: Date | null) => (d ? localDate(d, tz) : '?');
    const factMap = new Map<string, FactRef>();
    const factLines = facts.map((f, i) => {
      factMap.set(`F${i + 1}`, { id: f.id, key: f.key, validFrom: f.valid_from, subjectId: f.subject_id });
      const before = history.filter((h) => h.key === f.key && h.subject_id === f.subject_id)
        .map((h) => `${h.value ?? '(unknown)'} ${day(h.valid_from)}→${day(h.valid_to)}`);
      return `F${i + 1}: [${f.subject ?? 'me'}] ${f.key} = ${f.value ?? '(unknown)'} (since ${day(f.valid_from)})${before.length ? `; before: ${before.join('; ')}` : ''}`;
    });
    const [name, ...others] = people.selfNames;
    const user = [
      `ME: ${name ?? '(unnamed)'}${others.length ? ` (also: ${others.join(', ')})` : ''} — gender ${owner.gender ?? 'masculine'}`,
      `MEMORY LANGUAGE: ${owner.locale}`,
      `TODAY: ${localDate(now, tz)}`,
      `PEOPLE I KNOW:\n${people.list.map((c) => `${c.ref}: ${c.fullName && c.fullName !== c.name ? `${c.name} (${c.fullName})` : c.name}${c.relation ? ` — ${c.relation}` : ''}`).join('\n') || '(none)'}`,
      `CURRENT FACTS:\n${factLines.join('\n') || '(none)'}`,
      `KNOWN SLOTS: ${slots.map((s) => s.key).join(', ')}`,
      `EPISODES:\n${listed.map((e, i) => `${i + 1}. [${day(e.occurred_at)}] (${e.kind}) ${subjectLabel(e.subject_kind, e.subject, e.candidates)}${e.content}`).join('\n')}`,
    ].join('\n\n');

    let out;
    try {
      report.calls++;
      out = await this.llm.completeJson({ promptId: entity ? `${FACTS_REVIEW_VERSION}${ENTITY_FACTS_REVIEW_SUFFIX}` : FACTS_REVIEW_VERSION,
        system: entity ? ENTITY_FACTS_REVIEW_SYSTEM : FACTS_REVIEW_SYSTEM, user, schema: factsReviewSchema, maxTokens: 4000, task: 'facts' }, { ownerId, runId });
    } catch (err) {
      // A failed review changes nothing and is retried next night (the watermark does not move).
      report.failed++;
      this.log.warn(`facts review skipped: ${(err as Error).name}`);
      return report;
    }
    const input: ExtractionInput = { messages, facts: factMap, plans: new Map(), notes: new Map(), episodes: new Map(),
      contacts: people.contacts, questions: people.questions, selfNames: people.selfNames, sources: new Map(),
      prompt: { contacts: people.list } as PromptContext };
    const written: WrittenRow[] = await this.db.transaction(async (tx) => {
      const rows = await new ExtractionWriter(tx, { ownerId, timezone: tz, runId, conversationId: '', entity }, input)
        .applyFacts(out.facts.map((f) => ({ ...f, evidence: f.evidence ?? [] })) as never);
      // The watermark is computed in Postgres: a JS Date keeps milliseconds only, and the last episode would look
      // newer than it every night.
      await tx.query(`UPDATE owners SET facts_reviewed_upto = (SELECT max(recorded_at) FROM episodes WHERE id = ANY($2)) WHERE person_id = $1`,
        [ownerId, episodes.map((e) => e.id)]);
      return rows;
    });
    report.changed = written.length;
    await this.embed(written);
    for (const w of written) this.telemetry.emit({ type: 'memory.written', ownerId, runId, table: 'facts', id: w.id });
    return report;
  }

  /** New fact rows get their embedding like the extraction's (search_memory ranks by it); a failure leaves it null. */
  private async embed(rows: WrittenRow[]): Promise<void> {
    if (rows.length === 0) return;
    try {
      const vectors = await this.embeddings.embed(rows.map((r) => r.text), 'document');
      for (const [i, r] of rows.entries()) {
        await this.db.query(`UPDATE facts SET embedding = $1::vector, embedding_model = $2, embedding_text = $3 WHERE id = $4`,
          [`[${(vectors[i] ?? []).join(',')}]`, this.embeddings.model, r.text, r.id]);
      }
    } catch (err) {
      this.log.warn(`embedding reviewed facts failed: ${(err as Error).message}`);
    }
  }
}
