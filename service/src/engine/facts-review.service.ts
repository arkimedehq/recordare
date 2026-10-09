// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Nightly facts review (M5): the owner's current facts checked against the episodes recorded since the last review —
 * one LLM call (task `facts`) per owner per night with new episodes, none otherwise. The model only proposes verdicts;
 * the extraction's writer applies them with the same rules (history kept, corrections never rewrite, forgotten content
 * never comes back, other people's words never become the owner's facts), each change backed by the messages behind
 * the episodes it cites.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EMBEDDING_PORT, type EmbeddingPort } from '../embedding/embedding.port';
import { LLM_PORT, type LlmPort } from '../llm/llm.port';
import { TelemetryService } from '../telemetry/telemetry.service';
import { type ExtractionInput, type FactRef, type WindowMessage } from './extraction.context';
import { ExtractionWriter, type WrittenRow } from './extraction.writer';
import { FACTS_REVIEW_SYSTEM, FACTS_REVIEW_VERSION, factsReviewSchema } from './facts-review.prompt';
import { localDate } from './time';
import { accountSpeaker } from '../rawlog/attribution';

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
    const [owner] = await this.db.query(`SELECT timezone FROM owners WHERE person_id = $1`, [ownerId]);
    if (!owner) return report;
    const tz: string = owner.timezone;
    const episodes: Array<{ id: string; kind: string; content: string; occurred_at: Date | null; recorded_at: Date }> = await this.db.query(
      `SELECT e.id, e.kind, e.content, e.occurred_at, e.recorded_at FROM episodes e
       WHERE e.owner_id = $1 AND e.deleted_at IS NULL AND e.invalidated_at IS NULL AND e.duplicate_of IS NULL
         AND e.author_role IN ('owner', 'assistant')
         -- compared in SQL: read into JS the watermark would lose its microseconds
         AND e.recorded_at > COALESCE((SELECT facts_reviewed_upto FROM owners WHERE person_id = $1), '-infinity'::timestamptz)
         AND EXISTS (SELECT 1 FROM episode_evidence v WHERE v.episode_id = e.id AND v.message_id IS NOT NULL)
       ORDER BY e.recorded_at LIMIT $2`, [ownerId, MAX_EPISODES]);
    if (episodes.length === 0) return report; // nothing new: no call

    // One message behind each episode stands for its evidence (number n ↔ episode n).
    const evidence: Array<{ episode_id: string; id: string; role: WindowMessage['role']; tool_name: string | null;
      account_speaker: boolean; content: string; sent_at: Date }> = await this.db.query(
      `SELECT DISTINCT ON (v.episode_id) v.episode_id, m.id, m.role, m.tool_name, ${accountSpeaker('m')} AS account_speaker, m.content, m.sent_at
       FROM episode_evidence v JOIN messages m ON m.id = v.message_id WHERE v.episode_id = ANY($1) ORDER BY v.episode_id, m.sent_at`,
      [episodes.map((e) => e.id)]);
    const byEpisode = new Map(evidence.map((m) => [m.episode_id, m]));
    const listed = episodes.filter((e) => byEpisode.has(e.id));
    const messages: WindowMessage[] = listed.map((e) => {
      const m = byEpisode.get(e.id)!;
      return { id: m.id, role: m.role, toolName: m.tool_name, accountSpeaker: m.account_speaker, authorName: null, content: m.content, sentAt: m.sent_at };
    });

    const facts: Array<{ id: string; key: string; value: string | null; valid_from: Date | null }> = await this.db.query(
      `SELECT id, key, value, valid_from FROM facts WHERE owner_id = $1 AND subject_person_id IS NULL AND deleted_at IS NULL
         AND status IN ('current', 'unknown_current') ORDER BY key, valid_from NULLS FIRST`, [ownerId]);
    const history: Array<{ key: string; value: string | null; valid_from: Date | null; valid_to: Date | null }> = await this.db.query(
      `SELECT key, value, valid_from, valid_to FROM (
         SELECT key, value, valid_from, valid_to, row_number() OVER (PARTITION BY key ORDER BY valid_to DESC NULLS LAST) AS n
         FROM facts WHERE owner_id = $1 AND subject_person_id IS NULL AND deleted_at IS NULL AND status = 'superseded') h
       WHERE n <= $2`, [ownerId, HISTORY_PER_KEY]);
    const slots: Array<{ key: string }> = await this.db.query(`SELECT key FROM fact_slots ORDER BY key`);
    const day = (d: Date | null) => (d ? localDate(d, tz) : '?');
    const factMap = new Map<string, FactRef>();
    const factLines = facts.map((f, i) => {
      factMap.set(`F${i + 1}`, { id: f.id, key: f.key, validFrom: f.valid_from });
      const before = history.filter((h) => h.key === f.key).map((h) => `${h.value ?? '(unknown)'} ${day(h.valid_from)}→${day(h.valid_to)}`);
      return `F${i + 1}: ${f.key} = ${f.value ?? '(unknown)'} (since ${day(f.valid_from)})${before.length ? `; before: ${before.join('; ')}` : ''}`;
    });
    const user = [
      `TODAY: ${localDate(now, tz)}`,
      `CURRENT FACTS:\n${factLines.join('\n') || '(none)'}`,
      `KNOWN SLOTS: ${slots.map((s) => s.key).join(', ')}`,
      `EPISODES:\n${listed.map((e, i) => `${i + 1}. [${day(e.occurred_at)}] (${e.kind}) ${e.content}`).join('\n')}`,
    ].join('\n\n');

    let out;
    try {
      report.calls++;
      out = await this.llm.completeJson({ promptId: FACTS_REVIEW_VERSION, system: FACTS_REVIEW_SYSTEM, user, schema: factsReviewSchema,
        maxTokens: 4000, task: 'facts' }, { ownerId, runId });
    } catch (err) {
      // A failed review changes nothing and is retried next night (the watermark does not move).
      report.failed++;
      this.log.warn(`facts review skipped: ${(err as Error).name}`);
      return report;
    }
    const input = { messages, facts: factMap, plans: new Map(), notes: new Map(), episodes: new Map() } as unknown as ExtractionInput;
    const written: WrittenRow[] = await this.db.transaction(async (tx) => {
      const rows = await new ExtractionWriter(tx, { ownerId, timezone: tz, runId, conversationId: '' }, input)
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
