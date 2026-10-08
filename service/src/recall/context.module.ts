// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { Body, Controller, Headers, HttpCode, Inject, Module, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { CurrentPrincipal, RequireScopes } from '../auth/decorators';
import { OwnerResolver, USER_HEADER } from '../auth/owner-resolver.service';
import { type Principal } from '../auth/principal';
import { CONVERSATION_HEADER, VIEWERS_HEADER, ViewerContextService } from '../auth/viewer-context.service';
import { CLOCK_PORT, type ClockPort } from '../clock/clock.port';
import { ZodBody } from '../common/zod-body.pipe';
import { type Env } from '../config/env';
import { NOW_HEADER } from '../mcp/mcp-tools';
import { ContextService, type MemoryContext } from './context.service';

const contextSchema = z.object({
  /** The message the host is about to answer. */
  query: z.string().trim().min(1).max(8_000),
});

/** `POST api/v1/context` — the pre-turn memory context for the message a host is about to answer (WORK_PLAN 5.7). */
@Controller('api/v1/context')
export class ContextController {
  constructor(
    private readonly context: ContextService,
    private readonly owners: OwnerResolver,
    private readonly viewers: ViewerContextService,
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
    @Headers(VIEWERS_HEADER) extraViewers: string | undefined,
    @Headers(NOW_HEADER) at: string | undefined,
    @Body(new ZodBody(contextSchema)) body: z.infer<typeof contextSchema>,
  ): Promise<MemoryContext> {
    const ownerId = await this.owners.resolve(principal, user);
    // Same viewer rule as every read: nothing unless only the owner will see the answer.
    const ctx = await this.viewers.resolve(principal, ownerId, conversation, extraViewers);
    if (!ctx.ownerOnly) return { block: null, items: 0 };
    const override = this.config.get('ALLOW_CLOCK_OVERRIDE', { infer: true }) && at ? new Date(at) : null;
    const now = override && !Number.isNaN(override.getTime()) ? override : this.clock.now();
    return this.context.build(ownerId, body.query, ctx.conversationId, now);
  }
}

@Module({ controllers: [ContextController], providers: [ContextService, ViewerContextService] })
export class ContextModule {}
