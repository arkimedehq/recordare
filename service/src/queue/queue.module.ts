// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Env } from '../config/env';
import { BullMqQueueAdapter } from './bullmq-queue.adapter';
import { ExtractionProcessor, PendingExtractionRunner } from './extraction.processor';
import { EmbeddingProcessor } from './embedding.processor';
import { EMBEDDING_QUEUE, EXTRACTION_QUEUE, EXTRACTION_RUNNER, QUEUE_PORT } from './queue.port';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const url = new URL(config.get('REDIS_URL', { infer: true }));
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
          },
          prefix: 'recordare',
        };
      },
    }),
    BullModule.registerQueue({ name: EXTRACTION_QUEUE }, { name: EMBEDDING_QUEUE }),
  ],
  providers: [
    { provide: QUEUE_PORT, useClass: BullMqQueueAdapter },
    { provide: EXTRACTION_RUNNER, useClass: PendingExtractionRunner },
    ExtractionProcessor,
    EmbeddingProcessor,
  ],
  exports: [QUEUE_PORT],
})
export class QueueModule {}
