// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * The initiatives a client reads and reports on (D53, 8.12c; `API.md` §4b): the feed is the second leg next to the
 * webhooks — for a client behind NAT, or one that lost deliveries. The outcome report steers the agent's intents.
 */
import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { CurrentPrincipal, RequireScopes } from '../auth/decorators';
import { MemoryResolver, USER_HEADER } from '../auth/memory-resolver.service';
import { type Principal } from '../auth/principal';
import { Returns } from '../common/returns';
import { ZodBody } from '../common/zod-body.pipe';
import { INITIATIVE_STATUSES, initiativeResponse, initiativesResponse } from './initiative.responses';
import { InitiativeService, OUTCOMES } from './initiative.service';

const listQuery = z.object({
  since: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  status: z.enum(INITIATIVE_STATUSES).optional(),
});
const outcomeBody = z.object({
  status: z.enum(OUTCOMES),
  at: z.iso.datetime({ offset: true }).optional(),
  reply: z.string().trim().max(4_000).optional(),
});

@Controller('api/v1/initiatives')
export class InitiativeController {
  constructor(private readonly initiatives: InitiativeService, private readonly memories: MemoryResolver) {}

  @Get()
  @RequireScopes('read')
  @Returns(initiativesResponse)
  async list(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Query(new ZodBody(listQuery)) q: z.infer<typeof listQuery>) {
    return this.initiatives.list(await this.memories.resolve(p, user), q);
  }

  @Post(':id/outcome')
  @RequireScopes('write')
  @Returns(initiativeResponse)
  async outcome(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBody(outcomeBody)) body: z.infer<typeof outcomeBody>) {
    return this.initiatives.outcome(await this.memories.resolve(p, user), id, body.status, body.at ? new Date(body.at) : new Date(), body.reply);
  }
}
