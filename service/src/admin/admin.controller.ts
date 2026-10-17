// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { Body, Controller, Delete, Get, Headers, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Env } from '../config/env';
import { CLOCK_PORT, type ClockPort } from '../clock/clock.port';
import { ConsolidationService } from '../engine/consolidation.service';
import { ZodBody } from '../common/zod-body.pipe';
import { Returns } from '../common/returns';
import { adminList, adminObject, keyResponse, linkCodeResponse, tokenResponse } from '../openapi/responses';
import { AdminService } from './admin.service';
import {
  createClientSchema, createIdentitySchema, createKeySchema, createMemorySchema, createTokenSchema, updateClientSchema, updateMemorySchema,
  type CreateClient, type CreateIdentity, type CreateKey, type CreateMemory, type CreateToken, type UpdateClient, type UpdateMemory,
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

  /** Admin console: memories with settings, counts, identities and tokens (metadata only). */
  @Get('persons')
  @Returns(adminList)
  listPersons() {
    return this.admin.listPersons();
  }

  /**
   * Recent extraction runs of a person (WORK_PLAN 4.12): status, model, prompt version and the summary — what the model
   * returned, what was written, what the rules dropped and why (counts only). `conversation` = a conversation's id.
   */
  @Get('memories/:id/runs')
  @Returns(adminList)
  listRuns(@Param('id', ParseUUIDPipe) id: string, @Query('conversation', new ParseUUIDPipe({ optional: true })) conversation?: string, @Query('limit') limit?: string) {
    return this.admin.listRuns(id, conversation, Math.min(Math.max(Number(limit) || 20, 1), 200));
  }

  @Get('clients')
  @Returns(adminList)
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
  @Returns(adminObject)
  createClient(@Body(new ZodBody(createClientSchema)) body: CreateClient) {
    return this.admin.createClient(body);
  }

  @Post('clients/:id/keys')
  @Returns(keyResponse)
  createKey(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodBody(createKeySchema)) body: CreateKey) {
    return this.admin.createKey(id, body);
  }

  @Delete('keys/:id')
  @HttpCode(204)
  revokeKey(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.revokeKey(id);
  }

  @Post('memories')
  @Returns(adminObject)
  createMemory(@Body(new ZodBody(createMemorySchema)) body: CreateMemory) {
    return this.admin.createMemory(body);
  }

  @Patch('memories/:id')
  @Returns(adminObject)
  updateMemory(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodBody(updateMemorySchema)) body: UpdateMemory) {
    return this.admin.updateMemory(id, body);
  }

  @Post('identities')
  @Returns(adminObject)
  createIdentity(@Body(new ZodBody(createIdentitySchema)) body: CreateIdentity) {
    return this.admin.createIdentity(body);
  }

  /** Run the nightly consolidation now (operators, tests and the eval harness; honours X-Recordare-Now when allowed). */
  @Post('memories/:id/consolidate')
  @Returns(adminObject)
  consolidate(@Param('id', ParseUUIDPipe) id: string, @Headers('x-recordare-now') at?: string) {
    const override = this.config.get('ALLOW_CLOCK_OVERRIDE', { infer: true }) && at ? new Date(at) : null;
    return this.consolidation.consolidateMemory(id, override && !Number.isNaN(override.getTime()) ? override : this.clock.now());
  }

  /** Run the facts review alone now (operators and evaluations; honours X-Recordare-Now when allowed). */
  @Post('memories/:id/review-facts')
  @Returns(adminObject)
  reviewFacts(@Param('id', ParseUUIDPipe) id: string, @Headers('x-recordare-now') at?: string) {
    const override = this.config.get('ALLOW_CLOCK_OVERRIDE', { infer: true }) && at ? new Date(at) : null;
    return this.consolidation.reviewFactsNow(id, override && !Number.isNaN(override.getTime()) ? override : this.clock.now());
  }

  /** Run the recurring-pattern pass alone now (operators and evaluations; honours X-Recordare-Now when allowed). */
  @Post('memories/:id/patterns')
  @Returns(adminObject)
  patterns(@Param('id', ParseUUIDPipe) id: string, @Headers('x-recordare-now') at?: string) {
    const override = this.config.get('ALLOW_CLOCK_OVERRIDE', { infer: true }) && at ? new Date(at) : null;
    return this.consolidation.patternsNow(id, override && !Number.isNaN(override.getTime()) ? override : this.clock.now());
  }

  @Post('memories/:id/tokens')
  @Returns(tokenResponse)
  createToken(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodBody(createTokenSchema)) body: CreateToken) {
    return this.admin.createToken(id, body);
  }

  @Delete('tokens/:id')
  @HttpCode(204)
  revokeToken(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.revokeToken(id);
  }

  /** D51: a one-time code for the holder to send from a channel (personal memories only). */
  @Post('memories/:id/link-codes')
  @Returns(linkCodeResponse)
  linkCode(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.linkCode(id);
  }

  /** Confirms a claimed link code: that channel identity is the memory's holder from now on. */
  @Post('memories/:id/link-claims/:claim/confirm')
  @HttpCode(204)
  confirmClaim(@Param('id', ParseUUIDPipe) id: string, @Param('claim', ParseUUIDPipe) claim: string) {
    return this.admin.confirmClaim(id, claim);
  }

  @Delete('memories/:id/link-claims/:claim')
  @HttpCode(204)
  rejectClaim(@Param('id', ParseUUIDPipe) id: string, @Param('claim', ParseUUIDPipe) claim: string) {
    return this.admin.rejectClaim(id, claim);
  }
}
