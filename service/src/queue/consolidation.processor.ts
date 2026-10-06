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
import { CONSOLIDATION_QUEUE } from './queue.port';

/**
 * The nightly "sleep" (M5): an hourly sweep consolidates every owner for whom, in their own timezone, the
 * consolidation hour has passed and today's run has not happened yet. Owners with nothing new cost no LLM call.
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
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler('nightly-sweep', { every: 60 * 60 * 1000 }, { name: 'sweep' });
  }

  async process(_job: Job): Promise<void> {
    const now = this.clock.now();
    const hour = this.config.get('CONSOLIDATION_HOUR', { infer: true });
    const due: Array<{ person_id: string }> = await this.db.query(
      `SELECT o.person_id FROM owners o
       WHERE o.episodic_enabled
         AND extract(hour FROM ($1::timestamptz AT TIME ZONE o.timezone)) >= $2
         AND (o.consolidated_at IS NULL OR (o.consolidated_at AT TIME ZONE o.timezone)::date < ($1::timestamptz AT TIME ZONE o.timezone)::date)
         AND EXISTS (SELECT 1 FROM episodes e WHERE e.owner_id = o.person_id)`, [now, hour]);
    for (const { person_id } of due) {
      try {
        const r = await this.consolidation.consolidateOwner(person_id, now);
        this.log.debug(`consolidated ${person_id}: ${r.days} days, ${r.months} months, ${r.llmCalls} calls`);
      } catch (err) {
        this.log.warn(`consolidation failed for ${person_id}: ${(err as Error).name}`);
      }
    }
  }
}
