// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { Module } from '@nestjs/common';
import { IngestController } from './ingest.controller';
import { IngestService } from './ingest.service';

@Module({ controllers: [IngestController], providers: [IngestService], exports: [IngestService] })
export class RawLogModule {}
