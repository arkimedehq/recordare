// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { Controller, Get, Module, Param, ParseUUIDPipe } from '@nestjs/common';
import { AtlasService } from './atlas.service';

/** Admin only (no @RequireScopes): the dashboard's starting map of one memory's memory, metadata only. */
@Controller('api/v1/admin/memories')
export class AtlasController {
  constructor(private readonly atlas: AtlasService) {}

  /** Memories with their memory size, most recently active first (to pick whose brain to watch). */
  @Get()
  memories() {
    return this.atlas.memories();
  }

  @Get(':id/atlas')
  snapshot(@Param('id', ParseUUIDPipe) id: string) {
    return this.atlas.snapshot(id);
  }
}

@Module({ controllers: [AtlasController], providers: [AtlasService] })
export class AtlasModule {}
