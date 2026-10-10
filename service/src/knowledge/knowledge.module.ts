// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Learned sources (WORK_PLAN 8.9, D49): ingest routes for clients (text only — the client turns files into text; in one
 * request or in parts), read / forget routes for host UIs (the Diary), and the search the MCP tool and the memory
 * context use.
 */
import { Body, Controller, Delete, ForbiddenException, Get, Headers, HttpCode, Inject, Module, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentPrincipal, RequireScopes } from '../auth/decorators';
import { MemoryResolver, USER_HEADER } from '../auth/memory-resolver.service';
import { type Principal } from '../auth/principal';
import { CLOCK_PORT, type ClockPort } from '../clock/clock.port';
import { ZodBody } from '../common/zod-body.pipe';
import { KnowledgeSearchService } from './knowledge-search.service';
import { learnSourceSchema, type LearnSourceRequest, type LearnSourceResult, sourcePartSchema, type SourcePartRequest } from './sources.schemas';
import { SourcesService, type SourceView } from './sources.service';

@Controller('api/v1/ingest/sources')
@RequireScopes('ingest')
export class SourceIngestController {
  constructor(private readonly sources: SourcesService, private readonly memories: MemoryResolver, @Inject(CLOCK_PORT) private readonly clock: ClockPort) {}

  @Post()
  @HttpCode(200)
  async learn(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined,
    @Body(new ZodBody(learnSourceSchema)) body: LearnSourceRequest): Promise<LearnSourceResult> {
    const { clientId, memoryId } = await this.scope(p, user);
    return this.sources.learn(memoryId, clientId, body, this.clock.now());
  }

  @Post(':externalId/parts')
  @HttpCode(200)
  async part(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Param('externalId') externalId: string,
    @Body(new ZodBody(sourcePartSchema)) body: SourcePartRequest): Promise<LearnSourceResult> {
    const { clientId, memoryId } = await this.scope(p, user);
    return this.sources.part(memoryId, clientId, externalId, body);
  }

  /** Forgets a source the client sent (by its own id); one Recordare never had is done. */
  @Delete(':externalId')
  @HttpCode(204)
  async forget(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Param('externalId') externalId: string): Promise<void> {
    const { clientId, memoryId } = await this.scope(p, user);
    await this.sources.forget(memoryId, { clientId, externalId });
  }

  private async scope(p: Principal, user: string | undefined): Promise<{ clientId: string; memoryId: string }> {
    if (p.kind === 'admin') throw new ForbiddenException();
    return { clientId: p.clientId, memoryId: await this.memories.resolve(p, user) };
  }
}

@Controller('api/v1/sources')
export class SourceReadController {
  constructor(private readonly sources: SourcesService, private readonly memories: MemoryResolver) {}

  @Get()
  @RequireScopes('read')
  async list(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined): Promise<SourceView[]> {
    return this.sources.list(await this.who(p, user));
  }

  @Get(':id')
  @RequireScopes('read')
  async get(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
    return this.sources.get(await this.who(p, user), id);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequireScopes('write')
  async forget(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.sources.forget(await this.who(p, user), { id });
  }

  private async who(p: Principal, user: string | undefined): Promise<string> {
    if (p.kind === 'admin') throw new ForbiddenException();
    return this.memories.resolve(p, user);
  }
}

@Module({
  controllers: [SourceIngestController, SourceReadController],
  providers: [SourcesService, KnowledgeSearchService],
  exports: [SourcesService, KnowledgeSearchService],
})
export class KnowledgeModule {}
