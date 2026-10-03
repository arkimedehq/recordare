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
import { ExtractionWriter, type WrittenRow } from './extraction.writer';
import { resolveNearDuplicates } from './episode-resolver';

@Injectable()
export class EngineExtractionRunner implements ExtractionRunner {
  private readonly log = new Logger(EngineExtractionRunner.name);

  constructor(
    private readonly db: DataSource,
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    @Inject(EMBEDDING_PORT) private readonly embeddings: EmbeddingPort,
  ) {}

  async runForConversation(conversationId: string): Promise<void> {
    const [conv] = await this.db.query(
      `SELECT c.owner_id, c.client_id, o.locale, o.timezone, o.episodic_enabled
       FROM conversations c JOIN owners o ON o.person_id = c.owner_id WHERE c.id = $1 AND c.deleted_at IS NULL`, [conversationId]);
    if (!conv?.episodic_enabled) return;
    const owner: Owner = { id: conv.owner_id, locale: conv.locale, timezone: conv.timezone };

    const windows = await pendingWindows(this.db.manager, conversationId);
    for (const window of windows) {
      await this.runWindow(owner, conv.client_id as string, conversationId, window);
    }
  }

  private async runWindow(owner: Owner, clientId: string, conversationId: string, window: WindowMessage[]): Promise<void> {
    const runId = await this.startRun(owner.id, conversationId, window);
    if (!window.some((m) => m.role === 'user')) {
      // Gate: nothing the owner said → no LLM call (D5).
      await this.db.transaction(async (tx) => {
        await tx.query(`UPDATE messages SET extracted_run_id = $1 WHERE id = ANY($2)`, [runId, window.map((m) => m.id)]);
        await tx.query(`UPDATE extraction_runs SET status = 'done', finished_at = now(), model = 'gate:no-owner-message' WHERE id = $1`, [runId]);
      });
      return;
    }
    try {
      const slots: Array<{ key: string }> = await this.db.query(`SELECT key FROM fact_slots ORDER BY key`);
      const input = await buildInput(this.db.manager, owner, window, slots.map((s) => s.key));
      const output = await this.llm.completeJson({
        promptId: EXTRACTION_PROMPT_VERSION,
        system: EXTRACTION_SYSTEM,
        user: buildExtractionUser(input.prompt),
        schema: extractionSchema,
        maxTokens: 6000,
      }, { ownerId: owner.id, clientId, runId });
      const written = await this.db.transaction(async (tx) => {
        const rows = await new ExtractionWriter(tx, { ownerId: owner.id, timezone: owner.timezone, runId, conversationId }, input).apply(output);
        await tx.query(`UPDATE extraction_runs SET status = 'done', finished_at = now() WHERE id = $1`, [runId]);
        return rows;
      });
      await this.embed(written);
      // Second call only when near-duplicates exist (corrections not linked, same event in two chats).
      await resolveNearDuplicates(this.db, this.llm, owner.id, written.filter((w) => w.table === 'episodes').map((w) => w.id),
        { ownerId: owner.id, clientId, runId }).catch((err: unknown) => this.log.warn(`near-duplicate resolution skipped: ${(err as Error).name}`));
    } catch (err) {
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
