// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { Global, Module } from '@nestjs/common';
import { EXTRACTION_RUNNER } from '../queue/queue.port';
import { EngineExtractionRunner } from './extraction.runner';
import { ConsolidationService } from './consolidation.service';
import { FactsReviewService } from './facts-review.service';

@Global()
@Module({
  providers: [{ provide: EXTRACTION_RUNNER, useClass: EngineExtractionRunner }, ConsolidationService, FactsReviewService],
  exports: [EXTRACTION_RUNNER, ConsolidationService],
})
export class EngineModule {}
