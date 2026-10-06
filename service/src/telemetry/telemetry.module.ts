// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { Global, Module } from '@nestjs/common';
import { TelemetryController } from './telemetry.controller';
import { TelemetryService } from './telemetry.service';

@Global()
@Module({ controllers: [TelemetryController], providers: [TelemetryService], exports: [TelemetryService] })
export class TelemetryModule {}
