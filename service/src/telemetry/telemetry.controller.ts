// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { Controller, type MessageEvent, Query, Sse } from '@nestjs/common';
import { filter, map, type Observable } from 'rxjs';
import { TelemetryService } from './telemetry.service';

/** Admin only (no @RequireScopes): Server-Sent Events of the live telemetry, optionally for one owner. */
@Controller('api/v1/admin/telemetry')
export class TelemetryController {
  constructor(private readonly telemetry: TelemetryService) {}

  @Sse('stream')
  stream(@Query('owner') owner?: string): Observable<MessageEvent> {
    return this.telemetry.events.pipe(
      filter((e) => !owner || ('ownerId' in e && e.ownerId === owner)),
      map((e) => ({ type: e.type, data: e })),
    );
  }
}
