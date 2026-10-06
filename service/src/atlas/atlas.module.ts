// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { Controller, Get, Module, Param, ParseUUIDPipe } from '@nestjs/common';
import { AtlasService } from './atlas.service';

/** Admin only (no @RequireScopes): the dashboard's starting map of one owner's memory, metadata only. */
@Controller('api/v1/admin/owners')
export class AtlasController {
  constructor(private readonly atlas: AtlasService) {}

  /** Owners with their memory size, most recently active first (to pick whose brain to watch). */
  @Get()
  owners() {
    return this.atlas.owners();
  }

  @Get(':id/atlas')
  snapshot(@Param('id', ParseUUIDPipe) id: string) {
    return this.atlas.snapshot(id);
  }
}

@Module({ controllers: [AtlasController], providers: [AtlasService] })
export class AtlasModule {}
