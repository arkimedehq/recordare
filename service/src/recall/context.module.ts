// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { BadRequestException, Body, Controller, ForbiddenException, Get, Headers, HttpCode, Inject, Module, Post, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { CurrentPrincipal, RequireScopes } from '../auth/decorators';
import { MemoryResolver, USER_HEADER } from '../auth/memory-resolver.service';
import { hasScope, type Principal } from '../auth/principal';
import { CONVERSATION_HEADER, ConversationResolver } from '../auth/conversation-resolver.service';
import { CLOCK_PORT, type ClockPort } from '../clock/clock.port';
import { Returns } from '../common/returns';
import { ZodBody } from '../common/zod-body.pipe';
import { charterResponse, contextResponse } from '../openapi/responses';
import { CHARTER, CHARTER_CONTEXT_ONLY, CHARTER_VERSION } from './charter';
import { type Env } from '../config/env';
import { NOW_HEADER } from '../mcp/mcp-tools';
import { ingestSchema } from '../rawlog/ingest.schemas';
import { IngestService } from '../rawlog/ingest.service';
import { RawLogModule } from '../rawlog/rawlog.module';
import { ContextService, type MemoryContext } from './context.service';

const contextSchema = z.object({
  /** The message the host is about to answer (default: the last user message of `ingest`). */
  query: z.string().trim().min(1).max(8_000).optional(),
  /**
   * The turn to store first, same body as `POST api/v1/ingest/messages` (needs the `ingest` scope): one round trip
   * before each turn instead of two; the conversation is then the one ingested.
   */
  ingest: ingestSchema.optional(),
  /** Open the block with the self card — who I am: current facts and notes about me (WORK_PLAN 8.13). On by default (D54). */
  card: z.boolean().optional(),
});

const charterQuery = z.object({
  /** `false`: the agent has no memory tools, only the memory context. */
  tools: z.enum(['true', 'false']).optional(),
});

/** `POST api/v1/context` — the pre-turn memory context for the message a host is about to answer (WORK_PLAN 5.7). */
@Controller('api/v1/context')
export class ContextController {
  constructor(
    private readonly context: ContextService,
    private readonly memories: MemoryResolver,
    private readonly conversations: ConversationResolver,
    private readonly ingestion: IngestService,
    private readonly config: ConfigService<Env, true>,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
  ) {}

  @Post()
  @HttpCode(200)
  @RequireScopes('read')
  @Returns(contextResponse)
  async build(
    @CurrentPrincipal() principal: Principal,
    @Headers(USER_HEADER) user: string | undefined,
    @Headers(CONVERSATION_HEADER) conversation: string | undefined,
    @Headers(NOW_HEADER) at: string | undefined,
    @Body(new ZodBody(contextSchema)) body: z.infer<typeof contextSchema>,
  ): Promise<MemoryContext> {
    const memoryId = await this.memories.resolve(principal, user);
    let query = body.query;
    if (body.ingest) {
      if (principal.kind === 'admin' || !hasScope(principal, 'ingest')) throw new ForbiddenException();
      await this.ingestion.ingest(principal.clientId, memoryId, body.ingest);
      conversation = body.ingest.conversation.externalId;
      query ??= [...body.ingest.messages].reverse().find((m) => m.role === 'user')?.content;
    }
    if (!query?.trim()) throw new BadRequestException('query required');
    // The whole memory in every conversation (D50); the conversation only scopes the recall log and the current turn.
    const ctx = await this.conversations.resolve(principal, memoryId, conversation);
    const override = this.config.get('ALLOW_CLOCK_OVERRIDE', { infer: true }) && at ? new Date(at) : null;
    const now = override && !Number.isNaN(override.getTime()) ? override : this.clock.now();
    return this.context.build(memoryId, query.trim().slice(0, 8_000), ctx.conversationId, now, { card: body.card });
  }
}

/**
 * `GET api/v1/charter` — the memory charter (D54): how the agent uses its memory, for the host to put in the agent's
 * system prompt. The same for every memory; stable until `version` changes (clients may cache it). `tools=false`: the
 * form for a host that gives the agent only the memory context, no memory tools.
 */
@Controller('api/v1/charter')
export class CharterController {
  @Get()
  @RequireScopes('read')
  @Returns(charterResponse)
  get(@Query(new ZodBody(charterQuery)) q: z.infer<typeof charterQuery>): { charter: string; version: string } {
    return { charter: q.tools === 'false' ? CHARTER_CONTEXT_ONLY : CHARTER, version: CHARTER_VERSION };
  }
}

@Module({ imports: [RawLogModule], controllers: [ContextController, CharterController], providers: [ContextService, ConversationResolver] })
export class ContextModule {}
