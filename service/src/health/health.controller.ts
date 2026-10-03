// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Public } from '../auth/decorators';

@Controller('api/v1/health')
export class HealthController {
  constructor(private readonly db: DataSource) {}

  /** Liveness + database reachability. No auth: exposes no data. */
  @Get()
  @Public()
  async check(): Promise<{ status: 'ok' | 'degraded'; database: boolean }> {
    const database = await this.db.query('SELECT 1').then(() => true, () => false);
    return { status: database ? 'ok' : 'degraded', database };
  }
}
