// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { type Job } from 'bullmq';
import { DataSource } from 'typeorm';
import { EMBEDDING_PORT, type EmbeddingPort } from '../embedding/embedding.port';
import { TelemetryService } from '../telemetry/telemetry.service';
import { EMBEDDING_QUEUE } from './queue.port';

/** Passages embedded per call (a source of any size is embedded in batches, one job). */
const PASSAGE_BATCH = 64;

/**
 * Embeds user / other / tool messages for the raw-log fallback (assistant replies are not searched), and the passages of
 * learned sources (WORK_PLAN 8.9): batch after batch until none is left, then the source is ready (unless more parts
 * are still coming). A failed batch leaves the rest for the job's retry; full-text finds passages meanwhile.
 */
@Processor(EMBEDDING_QUEUE)
export class EmbeddingProcessor extends WorkerHost {
  constructor(private readonly db: DataSource, @Inject(EMBEDDING_PORT) private readonly embeddings: EmbeddingPort,
    private readonly telemetry: TelemetryService) {
    super();
  }

  async process(job: Job<{ messageIds: string[] } | { sourceId: string }>): Promise<void> {
    if ('sourceId' in job.data) return this.passages(job.data.sourceId);
    const rows: { id: string; content: string; memory_id: string }[] = await this.db.query(
      `SELECT id, content, memory_id FROM messages WHERE id = ANY($1) AND role <> 'assistant' AND embedding IS NULL`,
      [job.data.messageIds],
    );
    if (rows.length === 0) return;
    await this.telemetry.track('embed.messages', rows[0]?.memory_id ?? null, async () => {
      const vectors = await this.embeddings.embed(rows.map((r) => r.content), 'document');
      for (const [i, row] of rows.entries()) {
        await this.db.query(`UPDATE messages SET embedding = $1 WHERE id = $2`, [`[${(vectors[i] ?? []).join(',')}]`, row.id]);
      }
    });
  }

  private async passages(sourceId: string): Promise<void> {
    for (;;) {
      const rows: { id: string; heading: string | null; content: string; memory_id: string }[] = await this.db.query(
        `SELECT id, heading, content, memory_id FROM source_passages WHERE source_id = $1 AND embedding IS NULL ORDER BY ordinal LIMIT $2`,
        [sourceId, PASSAGE_BATCH]);
      if (rows.length === 0) break;
      await this.telemetry.track('embed.memories', rows[0]?.memory_id ?? null, async () => {
        const vectors = await this.embeddings.embed(rows.map((r) => (r.heading ? `${r.heading}\n${r.content}` : r.content)), 'document');
        for (const [i, row] of rows.entries()) {
          await this.db.query(`UPDATE source_passages SET embedding = $1::vector, embedding_model = $2 WHERE id = $3`,
            [`[${(vectors[i] ?? []).join(',')}]`, this.embeddings.model, row.id]);
        }
      });
    }
    await this.db.query(`UPDATE sources SET status = 'ready', updated_at = now() WHERE id = $1 AND status = 'indexing'
      AND NOT EXISTS (SELECT 1 FROM source_passages WHERE source_id = $1 AND embedding IS NULL)`, [sourceId]);
  }
}
