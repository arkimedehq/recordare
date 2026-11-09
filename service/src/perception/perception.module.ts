// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { Module } from '@nestjs/common';
import { PerceptionController } from './perception.controller';
import { PerceptionService } from './perception.service';

/** What the agent's senses noticed, remembered as seen until it fades (WORK_PLAN 8.12e). */
@Module({
  controllers: [PerceptionController],
  providers: [PerceptionService],
})
export class PerceptionModule {}
