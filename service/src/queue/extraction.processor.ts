// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { type Job } from 'bullmq';
import { EXTRACTION_QUEUE, EXTRACTION_RUNNER, type ExtractionRunner } from './queue.port';

/** Idle extraction jobs (D1). One worker per process; per-owner serialisation lives in the runner. */
@Processor(EXTRACTION_QUEUE)
export class ExtractionProcessor extends WorkerHost {
  private readonly log = new Logger(ExtractionProcessor.name);

  constructor(@Inject(EXTRACTION_RUNNER) private readonly runner: ExtractionRunner) {
    super();
  }

  async process(job: Job<{ conversationId: string }>): Promise<void> {
    this.log.debug(`idle extraction for conversation ${job.data.conversationId}`);
    await this.runner.runForConversation(job.data.conversationId);
  }
}
