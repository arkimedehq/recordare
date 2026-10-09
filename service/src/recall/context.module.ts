// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { BadRequestException, Body, Controller, ForbiddenException, Headers, HttpCode, Inject, Module, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { CurrentPrincipal, RequireScopes } from '../auth/decorators';
import { OwnerResolver, USER_HEADER } from '../auth/owner-resolver.service';
import { hasScope, type Principal } from '../auth/principal';
import { CONVERSATION_HEADER, ConversationResolver } from '../auth/conversation-resolver.service';
import { CLOCK_PORT, type ClockPort } from '../clock/clock.port';
import { ZodBody } from '../common/zod-body.pipe';
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
});

/** `POST api/v1/context` — the pre-turn memory context for the message a host is about to answer (WORK_PLAN 5.7). */
@Controller('api/v1/context')
export class ContextController {
  constructor(
    private readonly context: ContextService,
    private readonly owners: OwnerResolver,
    private readonly conversations: ConversationResolver,
    private readonly ingestion: IngestService,
    private readonly config: ConfigService<Env, true>,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
  ) {}

  @Post()
  @HttpCode(200)
  @RequireScopes('read')
  async build(
    @CurrentPrincipal() principal: Principal,
    @Headers(USER_HEADER) user: string | undefined,
    @Headers(CONVERSATION_HEADER) conversation: string | undefined,
    @Headers(NOW_HEADER) at: string | undefined,
    @Body(new ZodBody(contextSchema)) body: z.infer<typeof contextSchema>,
  ): Promise<MemoryContext> {
    const ownerId = await this.owners.resolve(principal, user);
    let query = body.query;
    if (body.ingest) {
      if (principal.kind === 'admin' || !hasScope(principal, 'ingest')) throw new ForbiddenException();
      await this.ingestion.ingest(principal.clientId, ownerId, body.ingest);
      conversation = body.ingest.conversation.externalId;
      query ??= [...body.ingest.messages].reverse().find((m) => m.role === 'user')?.content;
    }
    if (!query?.trim()) throw new BadRequestException('query required');
    // The whole memory in every conversation (D50); the conversation only scopes the recall log and the current turn.
    const ctx = await this.conversations.resolve(principal, ownerId, conversation);
    const override = this.config.get('ALLOW_CLOCK_OVERRIDE', { infer: true }) && at ? new Date(at) : null;
    const now = override && !Number.isNaN(override.getTime()) ? override : this.clock.now();
    return this.context.build(ownerId, query.trim().slice(0, 8_000), ctx.conversationId, now);
  }
}

@Module({ imports: [RawLogModule], controllers: [ContextController], providers: [ContextService, ConversationResolver] })
export class ContextModule {}
