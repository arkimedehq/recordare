// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/** Routes of the read / write API for host UIs (API.md §4, WORK_PLAN 4.7). */
import {
  Body, Controller, Delete, ForbiddenException, Get, Headers, HttpCode, Inject, Module, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { CurrentPrincipal, RequireScopes } from '../auth/decorators';
import { OwnerResolver, USER_HEADER } from '../auth/owner-resolver.service';
import { type Principal } from '../auth/principal';
import { CLOCK_PORT, type ClockPort } from '../clock/clock.port';
import { ZodBody } from '../common/zod-body.pipe';
import { type Env } from '../config/env';
import { NOW_HEADER } from '../mcp/mcp-tools';
import { MemoryWriteService } from '../recall/memory-write.service';
import { ReadService } from './read.service';

const isoDay = z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/);
const bool = z.enum(['true', 'false']).transform((v) => v === 'true');
const PLAN_STATUSES = ['open', 'confirmed', 'cancelled', 'rescheduled', 'unresolved'] as const;

const episodesQuery = z.object({
  from: isoDay.optional(), to: isoDay.optional(),
  kind: z.enum(['event', 'plan', 'state_change']).optional(),
  planStatus: z.enum(PLAN_STATUSES).optional(),
  q: z.string().max(500).optional(), cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});
const digestsQuery = z.object({ level: z.enum(['day', 'month']).optional(), from: isoDay.optional(), to: isoDay.optional() });
const factsQuery = z.object({ key: z.string().max(200).optional(), asOf: isoDay.optional(), includePending: bool.optional() });
const notesQuery = z.object({
  category: z.enum(['preference', 'habit', 'value', 'relationship', 'knowledge', 'profile', 'constraint']).optional(),
  pinned: bool.optional(), includePending: bool.optional(),
});
const plansQuery = z.object({ status: z.enum(PLAN_STATUSES).optional() });
const correctionBody = z.object({
  content: z.string().trim().min(1).max(4_000).optional(),
  occurredAt: isoDay.optional(),
  datePrecision: z.enum(['day', 'month', 'year', 'approximate']).optional(),
}).refine((b) => b.content !== undefined || b.occurredAt !== undefined, { message: 'nothing to correct' });
const pinBody = z.object({ pinned: z.boolean() });

function parse<T>(schema: z.ZodType<T>, raw: unknown): T {
  return new ZodBody(schema).transform(raw);
}

/**
 * The person's diary, read and edited from their platform's UI: the reader is the person themself (owner-direct), so
 * a client key names them with X-Recordare-User; a personal token is the person.
 */
@Controller('api/v1')
export class ReadController {
  constructor(
    private readonly read: ReadService,
    private readonly writes: MemoryWriteService,
    private readonly owners: OwnerResolver,
    private readonly config: ConfigService<Env, true>,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
  ) {}

  private async who(p: Principal, user: string | undefined): Promise<{ ownerId: string; clientId: string }> {
    if (p.kind === 'admin') throw new ForbiddenException();
    return { ownerId: await this.owners.resolve(p, user), clientId: p.clientId };
  }

  private now(at: string | undefined): Date {
    const d = this.config.get('ALLOW_CLOCK_OVERRIDE', { infer: true }) && at ? new Date(at) : null;
    return d && !Number.isNaN(d.getTime()) ? d : this.clock.now();
  }

  @Get('episodes')
  @RequireScopes('read')
  async episodes(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Headers(NOW_HEADER) at: string | undefined,
    @Query() q: Record<string, string>) {
    const { ownerId } = await this.who(p, user);
    return this.read.episodes(ownerId, parse(episodesQuery, q), this.now(at));
  }

  @Get('episodes/:id')
  @RequireScopes('read')
  async episode(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Headers(NOW_HEADER) at: string | undefined,
    @Param('id', ParseUUIDPipe) id: string) {
    const { ownerId, clientId } = await this.who(p, user);
    return this.read.episode(ownerId, clientId, id, this.now(at));
  }

  @Post('episodes/:id/corrections')
  @RequireScopes('write')
  async correct(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBody(correctionBody)) body: z.infer<typeof correctionBody>) {
    const { ownerId, clientId } = await this.who(p, user);
    return { id: await this.writes.correctEpisode(ownerId, { clientId }, { id, ...body }) };
  }

  @Delete('episodes/:id')
  @HttpCode(204)
  @RequireScopes('write')
  async forget(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
    const { ownerId } = await this.who(p, user);
    await this.writes.forgetEpisode(ownerId, id);
  }

  @Get('digests')
  @RequireScopes('read')
  async digests(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Query() q: Record<string, string>) {
    const { ownerId } = await this.who(p, user);
    return this.read.digests(ownerId, parse(digestsQuery, q));
  }

  @Get('facts')
  @RequireScopes('read')
  async facts(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Headers(NOW_HEADER) at: string | undefined,
    @Query() q: Record<string, string>) {
    const { ownerId } = await this.who(p, user);
    return this.read.facts(ownerId, parse(factsQuery, q), this.now(at));
  }

  @Delete('facts/:id')
  @HttpCode(204)
  @RequireScopes('write')
  async deleteFact(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
    const { ownerId } = await this.who(p, user);
    await this.read.deleteRow(ownerId, 'facts', id);
  }

  @Post('facts/:id/confirm')
  @HttpCode(204)
  @RequireScopes('write')
  async confirmFact(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
    const { ownerId } = await this.who(p, user);
    await this.read.decide(ownerId, 'facts', id, true);
  }

  @Post('facts/:id/reject')
  @HttpCode(204)
  @RequireScopes('write')
  async rejectFact(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
    const { ownerId } = await this.who(p, user);
    await this.read.decide(ownerId, 'facts', id, false);
  }

  @Get('notes')
  @RequireScopes('read')
  async notes(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Query() q: Record<string, string>) {
    const { ownerId } = await this.who(p, user);
    return this.read.notes(ownerId, parse(notesQuery, q));
  }

  @Patch('notes/:id')
  @HttpCode(204)
  @RequireScopes('write')
  async pin(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBody(pinBody)) body: z.infer<typeof pinBody>) {
    const { ownerId } = await this.who(p, user);
    await this.read.pinNote(ownerId, id, body.pinned);
  }

  @Delete('notes/:id')
  @HttpCode(204)
  @RequireScopes('write')
  async deleteNote(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
    const { ownerId } = await this.who(p, user);
    await this.read.deleteRow(ownerId, 'notes', id);
  }

  @Post('notes/:id/confirm')
  @HttpCode(204)
  @RequireScopes('write')
  async confirmNote(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
    const { ownerId } = await this.who(p, user);
    await this.read.decide(ownerId, 'notes', id, true);
  }

  @Post('notes/:id/reject')
  @HttpCode(204)
  @RequireScopes('write')
  async rejectNote(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
    const { ownerId } = await this.who(p, user);
    await this.read.decide(ownerId, 'notes', id, false);
  }

  @Get('plans')
  @RequireScopes('read')
  async plans(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Headers(NOW_HEADER) at: string | undefined,
    @Query() q: Record<string, string>) {
    const { ownerId } = await this.who(p, user);
    return this.read.plans(ownerId, parse(plansQuery, q), this.now(at));
  }
}

@Module({ controllers: [ReadController], providers: [ReadService, MemoryWriteService] })
export class ReadModule {}
