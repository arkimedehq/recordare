// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * `POST api/v1/perceptions` (WORK_PLAN 8.12e, `API.md` §4c): something the agent's senses noticed, in words. The agent sees
 * and describes; Recordare remembers it, as seen, until it fades.
 */
import { Body, Controller, Headers, HttpCode, Inject, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { CurrentPrincipal, RequireScopes } from '../auth/decorators';
import { MemoryResolver, USER_HEADER } from '../auth/memory-resolver.service';
import { type Principal } from '../auth/principal';
import { CLOCK_PORT, type ClockPort } from '../clock/clock.port';
import { Returns } from '../common/returns';
import { ZodBody } from '../common/zod-body.pipe';
import { type Env } from '../config/env';
import { NOW_HEADER } from '../mcp/mcp-tools';
import { perceptionResponse } from './perception.responses';
import { PERCEPTION_SENSORS, PerceptionService } from './perception.service';

const identity = z.union([z.object({ channel: z.string().min(1), externalId: z.string().min(1) }), z.object({ externalUserId: z.string().min(1) })]);
export const perceptionBody = z.object({
  /** What was noticed, as the agent would tell it ("someone I don't know on the driveway"); never an image or a sound. */
  text: z.string().trim().min(1).max(2_000),
  /** When it was noticed (default: now). */
  at: z.iso.datetime({ offset: true }).optional(),
  place: z.string().trim().max(200).optional(),
  /** By what: a camera, a microphone, another sensor, a photo someone showed. */
  sensor: z.enum(PERCEPTION_SENSORS),
  /** Who was recognised, with how sure (an identity as in ingest or a presence: a face, a voiceprint, an account). */
  people: z.array(z.object({ identity, confidence: z.number().min(0).max(1).default(1) })).max(20).optional(),
  /** Days before it fades (default: the memory's setting, else `PERCEPTION_KEEP_DAYS`); longer for a serious event. */
  keepDays: z.number().int().min(1).max(3_650).optional(),
  /** D52: told only to the holder of a personal memory; to nobody in an entity memory. */
  private: z.boolean().optional(),
});

@Controller('api/v1/perceptions')
export class PerceptionController {
  constructor(private readonly perceptions: PerceptionService, private readonly memories: MemoryResolver,
    private readonly config: ConfigService<Env, true>, @Inject(CLOCK_PORT) private readonly clock: ClockPort) {}

  @Post()
  @HttpCode(201)
  @RequireScopes('ingest')
  @Returns(perceptionResponse)
  async perceive(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Headers(NOW_HEADER) at: string | undefined,
    @Body(new ZodBody(perceptionBody)) body: z.infer<typeof perceptionBody>) {
    const memoryId = await this.memories.resolve(p, user);
    // Evaluations replay timelines "as of" a past instant (`X-Recordare-Now`, ALLOW_CLOCK_OVERRIDE), as presence does.
    const override = this.config.get('ALLOW_CLOCK_OVERRIDE', { infer: true }) && at ? new Date(at) : null;
    const now = override && !Number.isNaN(override.getTime()) ? override : this.clock.now();
    return this.perceptions.perceive(memoryId, p.kind === 'admin' ? null : p.clientId, body, now);
  }
}
