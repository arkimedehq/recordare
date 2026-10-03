// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { type Job } from 'bullmq';
import { DataSource } from 'typeorm';
import { EMBEDDING_PORT, type EmbeddingPort } from '../embedding/embedding.port';
import { EMBEDDING_QUEUE } from './queue.port';

/** Embeds user / other / tool messages for the raw-log fallback (assistant replies are not searched). */
@Processor(EMBEDDING_QUEUE)
export class EmbeddingProcessor extends WorkerHost {
  constructor(private readonly db: DataSource, @Inject(EMBEDDING_PORT) private readonly embeddings: EmbeddingPort) {
    super();
  }

  async process(job: Job<{ messageIds: string[] }>): Promise<void> {
    const rows: { id: string; content: string }[] = await this.db.query(
      `SELECT id, content FROM messages WHERE id = ANY($1) AND role <> 'assistant' AND embedding IS NULL`,
      [job.data.messageIds],
    );
    if (rows.length === 0) return;
    const vectors = await this.embeddings.embed(rows.map((r) => r.content), 'document');
    for (const [i, row] of rows.entries()) {
      await this.db.query(`UPDATE messages SET embedding = $1 WHERE id = $2`, [`[${(vectors[i] ?? []).join(',')}]`, row.id]);
    }
  }
}
