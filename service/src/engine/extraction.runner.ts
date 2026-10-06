// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * The engine's extraction job (D1 idle debounce → here). For each window of pending messages:
 * gate (no LLM call without a message from the owner — D5), one extraction call (D32), a
 * transactional write, then embeddings of the new rows. A failed call leaves the messages pending
 * (retried by the next idle job or the nightly sweep).
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EMBEDDING_PORT, type EmbeddingPort } from '../embedding/embedding.port';
import { LLM_PORT, type LlmPort } from '../llm/llm.port';
import { type ExtractionRunner } from '../queue/queue.port';
import { buildInput, pendingWindows, type Owner, type WindowMessage } from './extraction.context';
import { buildExtractionUser, EXTRACTION_PROMPT_VERSION, EXTRACTION_SYSTEM } from './extraction.prompt';
import { extractionSchema } from './extraction.schema';
import { ConcurrentExtractionError, ExtractionWriter, type WrittenRow } from './extraction.writer';
import { resolveNearDuplicates } from './episode-resolver';
import { SEED_SLOTS } from '../db/migrations/1790960000000-Notes';
import { ConfigService } from '@nestjs/config';
import { type Env } from '../config/env';
import { qualityProfile, type QualityProfile, type QualityProfileName } from './quality-profile';

@Injectable()
export class EngineExtractionRunner implements ExtractionRunner {
  private readonly log = new Logger(EngineExtractionRunner.name);
  private readonly defaultProfile: QualityProfileName;
  private readonly windowCharsOverride: number | undefined;

  constructor(
    private readonly db: DataSource,
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    @Inject(EMBEDDING_PORT) private readonly embeddings: EmbeddingPort,
    config: ConfigService<Env, true>,
  ) {
    this.defaultProfile = config.get('QUALITY_PROFILE', { infer: true });
    this.windowCharsOverride = config.get('EXTRACTION_WINDOW_CHARS', { infer: true });
  }

  async runForConversation(conversationId: string): Promise<void> {
    const [conv] = await this.db.query(
      `SELECT c.owner_id, c.client_id, o.locale, o.timezone, o.episodic_enabled, o.quality_profile
       FROM conversations c JOIN owners o ON o.person_id = c.owner_id WHERE c.id = $1 AND c.deleted_at IS NULL`, [conversationId]);
    if (!conv?.episodic_enabled) return;
    const owner: Owner = { id: conv.owner_id, locale: conv.locale, timezone: conv.timezone };
    const profile = qualityProfile(conv.quality_profile, this.defaultProfile, this.windowCharsOverride);

    // One extraction per conversation at a time (session advisory lock); a concurrent job leaves
    // the work to the run in progress, whose follow-up job picks up anything that arrived meanwhile.
    const runner = this.db.createQueryRunner();
    await runner.connect();
    try {
      const [{ locked }] = await runner.query(`SELECT pg_try_advisory_lock(hashtextextended($1, 7)) AS locked`, [conversationId]);
      if (!locked) return;
      try {
        const windows = await pendingWindows(this.db.manager, conversationId, profile.windowChars);
        for (const window of windows) {
          await this.runWindow(owner, profile, conv.client_id as string, conversationId, window);
        }
      } finally {
        await runner.query(`SELECT pg_advisory_unlock(hashtextextended($1, 7))`, [conversationId]);
      }
    } finally {
      await runner.release();
    }
  }

  private async runWindow(owner: Owner, profile: QualityProfile, clientId: string, conversationId: string, window: WindowMessage[]): Promise<void> {
    const runId = await this.startRun(owner.id, conversationId, window);
    if (!window.some((m) => m.role === 'user' || m.authorPersonId === owner.id)) {
      // Gate: nothing the owner said → no LLM call (D5).
      await this.db.transaction(async (tx) => {
        await tx.query(`UPDATE messages SET extracted_run_id = $1 WHERE id = ANY($2)`, [runId, window.map((m) => m.id)]);
        await tx.query(`UPDATE extraction_runs SET status = 'done', finished_at = now(), model = 'gate:no-owner-message' WHERE id = $1`, [runId]);
      });
      return;
    }
    try {
      // Only the seeded slots and this owner's own keys: slot names never leak across owners
      // and the list stays bounded.
      const slots: Array<{ key: string }> = await this.db.query(
        `SELECT key FROM fact_slots WHERE key = ANY($2)
         UNION SELECT DISTINCT key FROM facts WHERE owner_id = $1 ORDER BY key`, [owner.id, SEED_SLOTS]);
      const input = await buildInput(this.db.manager, owner, window, slots.map((s) => s.key), await this.windowVector(window), profile);
      const output = await this.llm.completeJson({
        promptId: EXTRACTION_PROMPT_VERSION,
        system: EXTRACTION_SYSTEM,
        user: buildExtractionUser(input.prompt),
        schema: extractionSchema,
        maxTokens: 6000,
        task: profile.extractionTask,
        reasoning: profile.reasoning,
      }, { ownerId: owner.id, clientId, runId });
      const written = await this.db.transaction(async (tx) => {
        const rows = await new ExtractionWriter(tx, { ownerId: owner.id, timezone: owner.timezone, runId, conversationId }, input).apply(output);
        await tx.query(`UPDATE extraction_runs SET status = 'done', finished_at = now() WHERE id = $1`, [runId]);
        return rows;
      });
      await this.embed(written);
      // Second call only when near-duplicates exist (corrections not linked, same event in two chats).
      await resolveNearDuplicates(this.db, this.llm, owner.id, written.filter((w) => w.table === 'episodes').map((w) => w.id),
        { ownerId: owner.id, clientId, runId }, profile).catch((err: unknown) => this.log.warn(`near-duplicate resolution skipped: ${(err as Error).name}`));
    } catch (err) {
      if (err instanceof ConcurrentExtractionError) {
        await this.db.query(`UPDATE extraction_runs SET status = 'done', finished_at = now(), model = 'skipped:concurrent' WHERE id = $1`, [runId]);
        return;
      }
      // No user content in the error column (docs/DATA_MODEL.md).
      await this.db.query(`UPDATE extraction_runs SET status = 'failed', finished_at = now(), error = $1 WHERE id = $2`,
        [(err as Error).name, runId]);
      this.log.warn(`extraction failed for conversation ${conversationId}: ${(err as Error).name}`);
      throw err;
    }
  }

  private async startRun(ownerId: string, conversationId: string, window: WindowMessage[]): Promise<string> {
    const [run] = await this.db.query(
      `INSERT INTO extraction_runs (owner_id, conversation_id, kind, window_from, window_to, model, provider, prompt_version)
       VALUES ($1, $2, 'extraction', $3, $4, 'pending', 'configured', $5) RETURNING id`,
      [ownerId, conversationId, window[0]?.sentAt, window[window.length - 1]?.sentAt, EXTRACTION_PROMPT_VERSION]);
    return run.id as string;
  }

  /** The window's topic as one query vector: picks related older episodes for the E# list. Null on failure. */
  private async windowVector(window: WindowMessage[]): Promise<number[] | null> {
    try {
      const text = window.filter((m) => m.role !== 'assistant').map((m) => m.content).join('\n').slice(0, 4000);
      const [v] = text ? await this.embeddings.embed([text], 'query') : [];
      return v ?? null;
    } catch (err) {
      this.log.warn(`window embedding failed, recent episodes only: ${(err as Error).message}`);
      return null;
    }
  }

  /** Embeds new rows (content + retrieval keys). Failures leave embedding null (full-text still works). */
  private async embed(rows: WrittenRow[]): Promise<void> {
    if (rows.length === 0) return;
    try {
      const vectors = await this.embeddings.embed(rows.map((r) => r.text), 'document');
      for (const [i, r] of rows.entries()) {
        const sql = r.table === 'episodes'
          ? `UPDATE episodes SET embedding = $1::vector, embedding_model = $2, embedding_text = $3 WHERE id = $4`
          : r.table === 'facts'
            ? `UPDATE facts SET embedding = $1::vector, embedding_model = $2, embedding_text = $3 WHERE id = $4`
            : `UPDATE notes SET embedding = $1::vector, embedding_model = $2, embedding_text = $3 WHERE id = $4`;
        await this.db.query(sql, [`[${(vectors[i] ?? []).join(',')}]`, this.embeddings.model, r.text, r.id]);
      }
    } catch (err) {
      this.log.warn(`embedding new memories failed: ${(err as Error).message}`);
    }
  }
}
