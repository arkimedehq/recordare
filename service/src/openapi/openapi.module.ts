// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { Controller, Get, Module, type Type } from '@nestjs/common';
import { DiscoveryModule, DiscoveryService } from '@nestjs/core';
import { Public } from '../auth/decorators';
import { Returns } from '../common/returns';
import { buildOpenApi } from './openapi';
import { openApiResponse } from './responses';

/** `GET api/v1/openapi.json`: the REST contract generated from the routes (API.md). No auth: the API is public, the data is not. */
@Controller('api/v1/openapi.json')
export class OpenApiController {
  private doc?: Record<string, unknown>;

  constructor(private readonly discovery: DiscoveryService) {}

  @Get()
  @Public()
  @Returns(openApiResponse)
  get(): Record<string, unknown> {
    this.doc ??= buildOpenApi(this.discovery.getControllers().map((c) => c.metatype as Type).filter(Boolean));
    return this.doc;
  }
}

@Module({ imports: [DiscoveryModule], controllers: [OpenApiController] })
export class OpenApiModule {}
