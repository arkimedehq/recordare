// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { EMBEDDING_QUEUE, EXTRACTION_QUEUE, type QueuePort } from './queue.port';

@Injectable()
export class BullMqQueueAdapter implements QueuePort {
  constructor(
    @InjectQueue(EXTRACTION_QUEUE) private readonly extraction: Queue,
    @InjectQueue(EMBEDDING_QUEUE) private readonly embedding: Queue,
  ) {}

  async scheduleIdleExtraction(conversationId: string, delayMs: number): Promise<void> {
    const jobId = `idle-${conversationId}`;
    const existing = await this.extraction.getJob(jobId);
    if (existing && (await existing.isDelayed())) {
      await existing.changeDelay(delayMs);
      return;
    }
    if (existing && (await existing.isActive())) {
      // Extraction is running: queue a follow-up so messages that arrived meanwhile are not missed.
      await this.extraction.add('idle', { conversationId }, { jobId: `${jobId}-${Date.now()}`, delay: delayMs, removeOnComplete: true, removeOnFail: 100 });
      return;
    }
    if (existing) await existing.remove();
    await this.extraction.add('idle', { conversationId }, { jobId, delay: delayMs, removeOnComplete: true, removeOnFail: 100 });
  }

  async enqueueMessageEmbeddings(messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) return;
    await this.embedding.add('messages', { messageIds }, { removeOnComplete: true, removeOnFail: 100, attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
  }

  async enqueueSourcePassages(sourceId: string): Promise<void> {
    await this.embedding.add('passages', { sourceId }, { removeOnComplete: true, removeOnFail: 100, attempts: 5, backoff: { type: 'exponential', delay: 5000 } });
  }
}
