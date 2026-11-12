// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { type Job } from 'bullmq';
import { EXTRACTION_QUEUE, EXTRACTION_RUNNER, type ExtractionRunner } from './queue.port';
import { SourceProceduresService } from '../engine/source-procedures';

/** Idle extraction jobs (D1), and reading a source learned for a task for its procedures (8.16 F2c). One worker per process. */
@Processor(EXTRACTION_QUEUE)
export class ExtractionProcessor extends WorkerHost {
  private readonly log = new Logger(ExtractionProcessor.name);

  constructor(@Inject(EXTRACTION_RUNNER) private readonly runner: ExtractionRunner, private readonly sourceProcedures: SourceProceduresService) {
    super();
  }

  async process(job: Job<{ conversationId: string } | { sourceId: string }>): Promise<void> {
    if ('sourceId' in job.data) {
      const outcome = await this.sourceProcedures.run(job.data.sourceId);
      this.log.debug(`procedures of source ${job.data.sourceId}: ${outcome}`);
      return;
    }
    this.log.debug(`idle extraction for conversation ${job.data.conversationId}`);
    await this.runner.runForConversation(job.data.conversationId);
  }
}
