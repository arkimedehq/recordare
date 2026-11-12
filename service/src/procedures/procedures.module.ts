// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Procedures kept whole (WORK_PLAN 8.16 F2, D57): the routes a client — an agent's host, a robot's controller — uses to
 * keep a procedure, add the household's way of a step, report how a run went, and read them whole.
 */
import { Body, Controller, Delete, ForbiddenException, Get, Headers, HttpCode, Inject, Module, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { type Env } from '../config/env';
import { NOW_HEADER } from '../mcp/mcp-tools';
import { CurrentPrincipal, RequireScopes } from '../auth/decorators';
import { MemoryResolver, USER_HEADER } from '../auth/memory-resolver.service';
import { type Principal } from '../auth/principal';
import { CLOCK_PORT, type ClockPort } from '../clock/clock.port';
import { ZodBody } from '../common/zod-body.pipe';
import { Returns } from '../common/returns';
import { procedureLearnedResponse, procedureResponse, proceduresResponse, procedureWrittenResponse } from '../openapi/responses';
import {
  learnProcedureSchema, type LearnProcedureRequest, procedureRunSchema, type ProcedureRunRequest, procedureVariantSchema, type ProcedureVariantRequest,
} from './procedures.schemas';
import { ProceduresService, type ProcedureView } from './procedures.service';

@Controller('api/v1/procedures')
export class ProceduresController {
  constructor(private readonly procedures: ProceduresService, private readonly memories: MemoryResolver, private readonly db: DataSource,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort, private readonly config: ConfigService<Env, true>) {}

  /** Now, or `X-Recordare-Now` when the deployment allows it (evaluations replay timelines "as of" a past instant). */
  private now(at: string | undefined): Date {
    const d = this.config.get('ALLOW_CLOCK_OVERRIDE', { infer: true }) && at ? new Date(at) : null;
    return d && !Number.isNaN(d.getTime()) ? d : this.clock.now();
  }

  @Post()
  @HttpCode(200)
  @RequireScopes('ingest')
  @Returns(procedureLearnedResponse)
  async learn(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Headers(NOW_HEADER) at: string | undefined,
    @Body(new ZodBody(learnProcedureSchema)) body: LearnProcedureRequest) {
    const { memoryId, who } = await this.scope(p, user, body.conversation?.externalId);
    return this.procedures.learn(memoryId, who, body, this.now(at));
  }

  @Post(':id/variants')
  @HttpCode(200)
  @RequireScopes('ingest')
  @Returns(procedureWrittenResponse)
  async variant(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Param('id', ParseUUIDPipe) id: string, @Headers(NOW_HEADER) at: string | undefined,
    @Body(new ZodBody(procedureVariantSchema)) body: ProcedureVariantRequest) {
    const { memoryId, who } = await this.scope(p, user, body.conversation?.externalId);
    return this.procedures.variant(memoryId, id, who, body, this.now(at));
  }

  @Post(':id/runs')
  @HttpCode(200)
  @RequireScopes('ingest')
  @Returns(procedureWrittenResponse)
  async run(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Param('id', ParseUUIDPipe) id: string, @Headers(NOW_HEADER) at: string | undefined,
    @Body(new ZodBody(procedureRunSchema)) body: ProcedureRunRequest) {
    const { memoryId, who } = await this.scope(p, user, body.conversation?.externalId);
    return this.procedures.run(memoryId, id, who, body, this.now(at));
  }

  @Get()
  @RequireScopes('read')
  @Returns(proceduresResponse)
  async list(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined): Promise<ProcedureView[]> {
    return this.procedures.list((await this.scope(p, user)).memoryId);
  }

  @Get(':id')
  @RequireScopes('read')
  @Returns(procedureResponse)
  async get(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Param('id', ParseUUIDPipe) id: string): Promise<ProcedureView> {
    return this.procedures.get((await this.scope(p, user)).memoryId, id);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequireScopes('write')
  async forget(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.procedures.forget((await this.scope(p, user)).memoryId, id);
  }

  private async scope(p: Principal, user: string | undefined, conversation?: string) {
    if (p.kind === 'admin') throw new ForbiddenException();
    const memoryId = await this.memories.resolve(p, user);
    const [m]: Array<{ mode: string }> = await this.db.query(`SELECT mode FROM memories WHERE person_id = $1`, [memoryId]);
    const [c]: Array<{ id: string }> = conversation
      ? await this.db.query(`SELECT id FROM conversations WHERE memory_id = $1 AND client_id = $2 AND external_id = $3 AND deleted_at IS NULL`,
        [memoryId, p.clientId, conversation])
      : [];
    return { memoryId, who: { conversationId: c?.id ?? null, personal: m?.mode === 'personal' } };
  }
}

@Module({
  controllers: [ProceduresController],
  providers: [ProceduresService],
  exports: [ProceduresService],
})
export class ProceduresModule {}
