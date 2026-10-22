// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Job, type Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import { type Env } from '../config/env';
import { CLOCK_PORT, type ClockPort } from '../clock/clock.port';
import { ConsolidationService } from '../engine/consolidation.service';
import { CONSOLIDATION_QUEUE, EXTRACTION_RUNNER, QUEUE_PORT, type ExtractionRunner, type QueuePort } from './queue.port';

/** Messages without an embedding queued again per sweep, and per job (a failed job, or replies stored before D30). */
const EMBED_PER_SWEEP = 2_000;
const EMBED_PER_JOB = 64;

/**
 * The nightly "sleep" (M5): an hourly sweep consolidates every memory for whom, in their own timezone, the
 * consolidation hour has passed and today's run has not happened yet. Memories with nothing new cost no LLM call.
 * Before consolidating, it extracts the messages still pending in conversations idle for longer than the idle delay
 * (WORK_PLAN 4.1): a failed call or a lost idle job leaves them behind, and they would otherwise wait for the next
 * message in that conversation. Once a day per memory, so a window that keeps failing costs one retry a day.
 * Every sweep also queues the embeddings still missing (a job that failed for good; my replies stored before they were
 * searched, D30), a bounded batch at a time.
 */
@Processor(CONSOLIDATION_QUEUE)
export class ConsolidationProcessor extends WorkerHost implements OnModuleInit {
  private readonly log = new Logger(ConsolidationProcessor.name);

  constructor(
    @InjectQueue(CONSOLIDATION_QUEUE) private readonly queue: Queue,
    private readonly db: DataSource,
    private readonly consolidation: ConsolidationService,
    private readonly config: ConfigService<Env, true>,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(EXTRACTION_RUNNER) private readonly extraction: ExtractionRunner,
    @Inject(QUEUE_PORT) private readonly jobs: QueuePort,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    if (this.config.get('CONSOLIDATION_SCHEDULE', { infer: true })) {
      await this.queue.upsertJobScheduler('nightly-sweep', { every: 60 * 60 * 1000 }, { name: 'sweep' });
    } else {
      await this.queue.removeJobScheduler('nightly-sweep');
    }
  }

  async process(_job: Job): Promise<void> {
    if (!this.config.get('CONSOLIDATION_SCHEDULE', { infer: true })) return; // a sweep queued before it was switched off
    await this.embedMissing();
    const now = this.clock.now();
    const hour = this.config.get('CONSOLIDATION_HOUR', { infer: true });
    const due: Array<{ person_id: string }> = await this.db.query(
      `SELECT o.person_id FROM memories o
       WHERE extract(hour FROM ($1::timestamptz AT TIME ZONE o.timezone)) >= $2
         AND (o.consolidated_at IS NULL OR (o.consolidated_at AT TIME ZONE o.timezone)::date < ($1::timestamptz AT TIME ZONE o.timezone)::date)
         AND (EXISTS (SELECT 1 FROM episodes e WHERE e.memory_id = o.person_id)
              OR EXISTS (SELECT 1 FROM messages m WHERE m.memory_id = o.person_id AND m.extracted_run_id IS NULL))`, [now, hour]);
    for (const { person_id } of due) {
      await this.extractPending(person_id, now);
      try {
        const r = await this.consolidation.consolidateMemory(person_id, now);
        this.log.debug(`consolidated ${person_id}: ${r.days} days, ${r.months} months, ${r.llmCalls} calls`);
      } catch (err) {
        this.log.warn(`consolidation failed for ${person_id}: ${(err as Error).name}`);
      }
    }
  }

  private async embedMissing(): Promise<void> {
    const rows: Array<{ id: string }> = await this.db.query(
      `SELECT m.id FROM messages m JOIN conversations c ON c.id = m.conversation_id
       WHERE m.embedding IS NULL AND c.deleted_at IS NULL ORDER BY m.sent_at DESC LIMIT $1`, [EMBED_PER_SWEEP]);
    for (let i = 0; i < rows.length; i += EMBED_PER_JOB) {
      await this.jobs.enqueueMessageEmbeddings(rows.slice(i, i + EMBED_PER_JOB).map((r) => r.id));
    }
  }

  /** Extracts the pending messages of this memory's conversations where nothing arrived for longer than the idle delay. */
  private async extractPending(memoryId: string, now: Date): Promise<void> {
    const idle = this.config.get('IDLE_DELAY_SECONDS', { infer: true });
    const conversations: Array<{ id: string }> = await this.db.query(
      `SELECT c.id FROM conversations c
       WHERE c.memory_id = $1 AND c.deleted_at IS NULL
         AND EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id AND m.extracted_run_id IS NULL)
         -- idle by arrival, not by sent_at: an import of old messages still arriving is left to its idle job
         AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id AND m.received_at > $2::timestamptz - make_interval(secs => $3))
       ORDER BY c.last_message_at`, [memoryId, now, idle]);
    for (const { id } of conversations) {
      try {
        await this.extraction.runForConversation(id);
      } catch (err) {
        this.log.warn(`sweep extraction failed for conversation ${id}: ${(err as Error).name}`);
      }
    }
  }
}
