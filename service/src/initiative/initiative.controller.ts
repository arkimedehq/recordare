// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * The initiatives a client reads and reports on (D53, 8.12c; `API.md` §4b): the feed is the second leg next to the
 * webhooks — for a client behind NAT, or one that lost deliveries. The outcome report steers the agent's intents.
 */
import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { CurrentPrincipal, RequireScopes } from '../auth/decorators';
import { MemoryResolver, USER_HEADER } from '../auth/memory-resolver.service';
import { type Principal } from '../auth/principal';
import { Returns } from '../common/returns';
import { ZodBody } from '../common/zod-body.pipe';
import { INITIATIVE_STATUSES, initiativeResponse, initiativesResponse, presenceResponse } from './initiative.responses';
import { DELIVERY_CHANNELS, InitiativeService, OUTCOMES } from './initiative.service';
import { PresenceService, PRESENCE_CHANNELS } from './presence.service';
import { CLOCK_PORT, type ClockPort } from '../clock/clock.port';
import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Env } from '../config/env';
import { NOW_HEADER } from '../mcp/mcp-tools';

const listQuery = z.object({
  since: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  status: z.enum(INITIATIVE_STATUSES).optional(),
});
const outcomeBody = z.object({
  status: z.enum(OUTCOMES),
  at: z.iso.datetime({ offset: true }).optional(),
  reply: z.string().trim().max(4_000).optional(),
  /** Where it reached the person, and how it was taken (D55): what timing learns from. */
  channel: z.enum(DELIVERY_CHANNELS).optional(),
  reaction: z.enum(['positive', 'neutral', 'negative']).optional(),
});
const identity = z.union([z.object({ channel: z.string().min(1), externalId: z.string().min(1) }), z.object({ externalUserId: z.string().min(1) })]);
const presenceBody = z.object({
  /** Who it is: an identity as in ingest (`{channel, externalId}` — a voice profile, a face —, or `{externalUserId}`); none: the holder of a personal memory, nobody known in an entity memory. */
  person: z.object({ identity }).optional(),
  /** D55 §5c: everyone recognised in the place, each with how sure (in place of `person` + `confidence`). */
  people: z.array(z.object({ identity, confidence: z.number().min(0).max(1).default(1) })).max(20).optional(),
  /** People in the place the agent cannot name (an occupancy sensor, a face it does not know). */
  someone: z.number().int().min(0).max(50).optional(),
  channel: z.enum(PRESENCE_CHANNELS),
  /** How sure the agent is of who it is (its voiceprint's or face model's score; 1 for an account). */
  confidence: z.number().min(0).max(1).default(1),
  ttlSeconds: z.number().int().min(1).max(3_600).default(120),
  place: z.string().trim().max(200).optional(),
  /** The person left: the presence ends, nothing is offered. */
  left: z.boolean().optional(),
  /** Timing v2 (D55 F6): the person(s) of this impulse are busy now (a call, a meeting, do-not-disturb) — nothing flexible until it ends or `false`. */
  busy: z.boolean().optional(),
  /** Timing v2 (D55 F6): people in the place are talking now — an opening waits for a pause. */
  talking: z.boolean().optional(),
}).refine((b) => !(b.person && b.people), { message: 'person or people, not both' });

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
    return this.initiatives.outcome(await this.memories.resolve(p, user), id, body.status, body.at ? new Date(body.at) : new Date(), body.reply,
      { ...(body.channel ? { channel: body.channel } : {}), ...(body.reaction ? { reaction: body.reaction } : {}) });
  }
}

/**
 * `POST api/v1/presence` (D55): the agent saw or heard someone — by what, how sure, for how long. Recordare records it and
 * answers at once with what to tell or ask them now, if this is the moment (the agent speaks without waiting for a
 * webhook). The agent does the recognising (voiceprint, face, account); Recordare never reads a sensor.
 */
@Controller('api/v1/presence')
export class PresenceController {
  constructor(private readonly presence: PresenceService, private readonly memories: MemoryResolver, private readonly config: ConfigService<Env, true>,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort) {}

  @Post()
  @HttpCode(200)
  @RequireScopes('ingest')
  @Returns(presenceResponse)
  async report(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Headers(NOW_HEADER) at: string | undefined,
    @Body(new ZodBody(presenceBody)) body: z.infer<typeof presenceBody>) {
    const memoryId = await this.memories.resolve(p, user);
    // Evaluations replay timelines "as of" a past instant (`X-Recordare-Now`, ALLOW_CLOCK_OVERRIDE), as the memory context does.
    const override = this.config.get('ALLOW_CLOCK_OVERRIDE', { infer: true }) && at ? new Date(at) : null;
    const now = override && !Number.isNaN(override.getTime()) ? override : this.clock.now();
    return this.presence.report(memoryId, p.kind === 'admin' ? null : p.clientId, body, now);
  }
}
