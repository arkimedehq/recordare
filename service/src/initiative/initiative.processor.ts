// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * The initiative sweep (D53, 8.12c): hourly, like the nightly sweep, every memory with something that could be due is
 * armed, fired and expired (`CONSOLIDATION_SCHEDULE` switches the schedulers on). The webhook queue delivers each event
 * once, tried again with a growing delay.
 */
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Job, type Queue } from 'bullmq';
import { type Env } from '../config/env';
import { CLOCK_PORT, type ClockPort } from '../clock/clock.port';
import { INITIATIVE_QUEUE, WEBHOOK_QUEUE } from './initiative.queue';
import { InitiativeService } from './initiative.service';
import { WebhooksService } from './webhooks.service';

@Processor(INITIATIVE_QUEUE)
export class InitiativeProcessor extends WorkerHost implements OnModuleInit {
  private readonly log = new Logger(InitiativeProcessor.name);

  constructor(
    @InjectQueue(INITIATIVE_QUEUE) private readonly queue: Queue,
    private readonly initiatives: InitiativeService,
    private readonly config: ConfigService<Env, true>,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    if (this.config.get('CONSOLIDATION_SCHEDULE', { infer: true })) {
      await this.queue.upsertJobScheduler('initiative-sweep', { every: 60 * 60 * 1000 }, { name: 'sweep' });
    } else {
      await this.queue.removeJobScheduler('initiative-sweep');
    }
  }

  async process(_job: Job): Promise<void> {
    if (!this.config.get('CONSOLIDATION_SCHEDULE', { infer: true })) return;
    await this.initiatives.sweepAll(this.clock.now());
    this.log.debug('initiative sweep done');
  }
}

@Processor(WEBHOOK_QUEUE)
export class WebhookProcessor extends WorkerHost {
  constructor(private readonly webhooks: WebhooksService) {
    super();
  }

  async process(job: Job<{ deliveryId: string; attempt: number }>): Promise<void> {
    await this.webhooks.deliver(job.data.deliveryId, job.data.attempt);
  }
}
