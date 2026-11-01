// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { INITIATIVE_QUEUE, WEBHOOK_QUEUE } from './initiative.queue';
import { InitiativeController } from './initiative.controller';
import { InitiativeProcessor, WebhookProcessor } from './initiative.processor';
import { InitiativeService } from './initiative.service';
import { WebhooksService } from './webhooks.service';

/** Intents, initiatives and the webhooks that carry them (D53, WORK_PLAN 8.12c). */
@Module({
  imports: [BullModule.registerQueue({ name: INITIATIVE_QUEUE }, { name: WEBHOOK_QUEUE })],
  controllers: [InitiativeController],
  providers: [InitiativeService, WebhooksService, InitiativeProcessor, WebhookProcessor],
  exports: [InitiativeService, WebhooksService],
})
export class InitiativeModule {}
