// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { Body, Controller, Delete, Get, Headers, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Env } from '../config/env';
import { CLOCK_PORT, type ClockPort } from '../clock/clock.port';
import { ConsolidationService } from '../engine/consolidation.service';
import { ZodBody } from '../common/zod-body.pipe';
import { AdminService } from './admin.service';
import {
  createClientSchema, createIdentitySchema, createKeySchema, createOwnerSchema, createTokenSchema, updateClientSchema, updateOwnerSchema,
  type CreateClient, type CreateIdentity, type CreateKey, type CreateOwner, type CreateToken, type UpdateClient, type UpdateOwner,
} from './admin.schemas';

/** Admin API (no @RequireScopes → admin credential only). */
@Controller('api/v1/admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly consolidation: ConsolidationService,
    private readonly config: ConfigService<Env, true>,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
  ) {}

  /** Admin console: owners with settings, counts, identities and tokens (metadata only). */
  @Get('persons')
  listPersons() {
    return this.admin.listPersons();
  }

  @Get('clients')
  listClients() {
    return this.admin.listClients();
  }

  @Patch('clients/:id')
  @HttpCode(204)
  updateClient(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodBody(updateClientSchema)) body: UpdateClient) {
    return this.admin.updateClient(id, body);
  }

  @Delete('identities/:id')
  @HttpCode(204)
  deleteIdentity(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.deleteIdentity(id);
  }

  @Post('clients')
  createClient(@Body(new ZodBody(createClientSchema)) body: CreateClient) {
    return this.admin.createClient(body);
  }

  @Post('clients/:id/keys')
  createKey(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodBody(createKeySchema)) body: CreateKey) {
    return this.admin.createKey(id, body);
  }

  @Delete('keys/:id')
  @HttpCode(204)
  revokeKey(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.revokeKey(id);
  }

  @Post('owners')
  createOwner(@Body(new ZodBody(createOwnerSchema)) body: CreateOwner) {
    return this.admin.createOwner(body);
  }

  @Patch('owners/:id')
  updateOwner(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodBody(updateOwnerSchema)) body: UpdateOwner) {
    return this.admin.updateOwner(id, body);
  }

  @Post('identities')
  createIdentity(@Body(new ZodBody(createIdentitySchema)) body: CreateIdentity) {
    return this.admin.createIdentity(body);
  }

  /** Run the nightly consolidation now (operators, tests and the eval harness; honours X-Recordare-Now when allowed). */
  @Post('owners/:id/consolidate')
  consolidate(@Param('id', ParseUUIDPipe) id: string, @Headers('x-recordare-now') at?: string) {
    const override = this.config.get('ALLOW_CLOCK_OVERRIDE', { infer: true }) && at ? new Date(at) : null;
    return this.consolidation.consolidateOwner(id, override && !Number.isNaN(override.getTime()) ? override : this.clock.now());
  }

  /** Run the facts review alone now (operators and evaluations; honours X-Recordare-Now when allowed). */
  @Post('owners/:id/review-facts')
  reviewFacts(@Param('id', ParseUUIDPipe) id: string, @Headers('x-recordare-now') at?: string) {
    const override = this.config.get('ALLOW_CLOCK_OVERRIDE', { infer: true }) && at ? new Date(at) : null;
    return this.consolidation.reviewFactsNow(id, override && !Number.isNaN(override.getTime()) ? override : this.clock.now());
  }

  @Post('owners/:id/tokens')
  createToken(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodBody(createTokenSchema)) body: CreateToken) {
    return this.admin.createToken(id, body);
  }

  @Delete('tokens/:id')
  @HttpCode(204)
  revokeToken(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.revokeToken(id);
  }
}
