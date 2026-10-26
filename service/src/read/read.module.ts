// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/** Routes of the read / write API for host UIs (API.md §4, WORK_PLAN 4.7). */
import {
  Body, Controller, Delete, ForbiddenException, Get, Headers, HttpCode, Inject, Module, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query,
  Res, StreamableFile,
} from '@nestjs/common';
import { type Response } from 'express';
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
import { MemoryWriteService } from '../recall/memory-write.service';
import { QUALITY_PROFILES } from '../engine/quality-profile';
import { ExportsService } from './exports.service';
import {
  createdResponse, digestsResponse, episodeDetailResponse, episodesResponse, exportResponse, factDetailResponse, factsResponse, forgetPeriodResponse,
  cardsResponse, noteChangesResponse, noteDetailResponse, notesResponse, plansResponse, settingsResponse, usageResponse,
} from './read.responses';
import { ReadService } from './read.service';
import { SettingsService } from './settings.service';

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
const CATEGORIES = ['preference', 'habit', 'value', 'relationship', 'knowledge', 'profile', 'constraint'] as const;
const episodeBody = z.object({
  content: z.string().trim().min(1).max(4_000),
  kind: z.enum(['event', 'plan']).optional(),
  occurredAt: isoDay.optional(), occurredUntil: isoDay.optional(),
  datePrecision: z.enum(['day', 'month', 'year', 'approximate']).optional(),
  place: z.string().trim().max(200).optional(),
  people: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
});
const noteBody = z.object({ content: z.string().trim().min(1).max(2_000), category: z.enum(CATEGORIES).optional() });
const factCorrectionBody = z.object({
  value: z.string().trim().min(1).max(500).nullable(),
  validFrom: isoDay.optional(),
  datePrecision: z.enum(['day', 'month', 'year', 'approximate']).optional(),
});
const changesQuery = z.object({ since: z.coerce.number().int().min(0).optional(), limit: z.coerce.number().int().min(1).max(500).optional() });
const settingsBody = z.object({
  locale: z.string().trim().min(2).max(35).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
  qualityProfile: z.enum(QUALITY_PROFILES).nullable().optional(),
});
const usageQuery = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });
const forgetBody = z.object({ from: isoDay, to: isoDay, keepRaw: z.boolean().optional() })
  // A month (YYYY-MM) counts from its first day to its last one.
  .refine((b) => (b.from.length === 7 ? `${b.from}-01` : b.from) <= (b.to.length === 7 ? `${b.to}-31` : b.to), { message: 'from after to' });

/**
 * The person's diary, read and edited from their platform's UI: the reader is the person themself (memory-direct), so
 * a client key names them with X-Recordare-User; a personal token is the person.
 */
@Controller('api/v1')
export class ReadController {
  constructor(
    private readonly read: ReadService,
    private readonly writes: MemoryWriteService,
    private readonly settings: SettingsService,
    private readonly exports: ExportsService,
    private readonly memories: MemoryResolver,
    private readonly config: ConfigService<Env, true>,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
  ) {}

  private async who(p: Principal, user: string | undefined): Promise<{ memoryId: string; clientId: string }> {
    if (p.kind === 'admin') throw new ForbiddenException();
    return { memoryId: await this.memories.resolve(p, user), clientId: p.clientId };
  }

  private now(at: string | undefined): Date {
    const d = this.config.get('ALLOW_CLOCK_OVERRIDE', { infer: true }) && at ? new Date(at) : null;
    return d && !Number.isNaN(d.getTime()) ? d : this.clock.now();
  }

  @Get('episodes')
  @RequireScopes('read')
  @Returns(episodesResponse)
  async episodes(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Headers(NOW_HEADER) at: string | undefined,
    @Query(new ZodBody(episodesQuery)) q: z.infer<typeof episodesQuery>) {
    const { memoryId } = await this.who(p, user);
    return this.read.episodes(memoryId, q, this.now(at));
  }

  @Get('episodes/:id')
  @RequireScopes('read')
  @Returns(episodeDetailResponse)
  async episode(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Headers(NOW_HEADER) at: string | undefined,
    @Param('id', ParseUUIDPipe) id: string) {
    const { memoryId, clientId } = await this.who(p, user);
    return this.read.episode(memoryId, clientId, id, this.now(at));
  }

  /** Manual entry from the host's UI: written by the person, stated (API.md §4). */
  @Post('episodes')
  @RequireScopes('write')
  @Returns(createdResponse)
  async addEpisode(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined,
    @Body(new ZodBody(episodeBody)) body: z.infer<typeof episodeBody>) {
    const { memoryId } = await this.who(p, user);
    return { id: await this.writes.logEpisode(memoryId, null, body) };
  }

  @Post('episodes/:id/corrections')
  @RequireScopes('write')
  @Returns(createdResponse)
  async correct(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBody(correctionBody)) body: z.infer<typeof correctionBody>) {
    const { memoryId, clientId } = await this.who(p, user);
    return { id: await this.writes.correctEpisode(memoryId, { clientId }, { id, ...body }) };
  }

  @Delete('episodes/:id')
  @HttpCode(204)
  @RequireScopes('write')
  async forget(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
    const { memoryId } = await this.who(p, user);
    await this.writes.forgetEpisode(memoryId, id);
  }

  /** Forgets a period (D16): its episodes and raw messages (kept, hidden, with `keepRaw`), and what only they supported. */
  @Post('forget')
  @HttpCode(200)
  @RequireScopes('write')
  @Returns(forgetPeriodResponse)
  async forgetPeriod(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined,
    @Body(new ZodBody(forgetBody)) body: z.infer<typeof forgetBody>) {
    const { memoryId } = await this.who(p, user);
    return this.writes.forgetPeriod(memoryId, body);
  }

  @Get('digests')
  @RequireScopes('read')
  @Returns(digestsResponse)
  async digests(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Query(new ZodBody(digestsQuery)) q: z.infer<typeof digestsQuery>) {
    const { memoryId } = await this.who(p, user);
    return this.read.digests(memoryId, q);
  }

  @Get('facts')
  @RequireScopes('read')
  @Returns(factsResponse)
  async facts(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Headers(NOW_HEADER) at: string | undefined,
    @Query(new ZodBody(factsQuery)) q: z.infer<typeof factsQuery>) {
    const { memoryId } = await this.who(p, user);
    return this.read.facts(memoryId, q, this.now(at));
  }

  @Get('facts/:id')
  @RequireScopes('read')
  @Returns(factDetailResponse)
  async fact(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
    const { memoryId, clientId } = await this.who(p, user);
    return this.read.fact(memoryId, clientId, id);
  }

  @Post('facts/:id/corrections')
  @RequireScopes('write')
  @Returns(createdResponse)
  async correctFact(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBody(factCorrectionBody)) body: z.infer<typeof factCorrectionBody>) {
    const { memoryId } = await this.who(p, user);
    return { id: await this.writes.correctFact(memoryId, { id, ...body }) };
  }

  @Delete('facts/:id')
  @HttpCode(204)
  @RequireScopes('write')
  async deleteFact(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
    const { memoryId } = await this.who(p, user);
    await this.read.deleteRow(memoryId, 'facts', id);
  }

  @Post('facts/:id/confirm')
  @HttpCode(204)
  @RequireScopes('write')
  async confirmFact(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
    const { memoryId } = await this.who(p, user);
    await this.read.decide(memoryId, 'facts', id, true);
  }

  @Post('facts/:id/reject')
  @HttpCode(204)
  @RequireScopes('write')
  async rejectFact(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
    const { memoryId } = await this.who(p, user);
    await this.read.decide(memoryId, 'facts', id, false);
  }

  @Get('notes')
  @RequireScopes('read')
  @Returns(notesResponse)
  async notes(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Query(new ZodBody(notesQuery)) q: z.infer<typeof notesQuery>) {
    const { memoryId } = await this.who(p, user);
    return this.read.notes(memoryId, q);
  }

  /** The notes change feed (D34): declared before `notes/:id`. */
  @Get('notes/changes')
  @RequireScopes('read')
  @Returns(noteChangesResponse)
  async noteChanges(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Query(new ZodBody(changesQuery)) q: z.infer<typeof changesQuery>) {
    const { memoryId } = await this.who(p, user);
    return this.read.noteChanges(memoryId, q);
  }

  @Get('notes/:id')
  @RequireScopes('read')
  @Returns(noteDetailResponse)
  async note(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
    const { memoryId, clientId } = await this.who(p, user);
    return this.read.note(memoryId, clientId, id);
  }

  /** Manual entry from the host's UI: written by the person, stated. */
  @Post('notes')
  @RequireScopes('write')
  @Returns(createdResponse)
  async addNote(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined,
    @Body(new ZodBody(noteBody)) body: z.infer<typeof noteBody>) {
    const { memoryId } = await this.who(p, user);
    return { id: await this.writes.remember(memoryId, null, body) };
  }

  @Post('notes/:id/corrections')
  @RequireScopes('write')
  @Returns(createdResponse)
  async correctNote(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBody(noteBody)) body: z.infer<typeof noteBody>) {
    const { memoryId } = await this.who(p, user);
    return { id: await this.writes.correctNote(memoryId, { id, ...body }) };
  }

  @Patch('notes/:id')
  @HttpCode(204)
  @RequireScopes('write')
  async pin(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBody(pinBody)) body: z.infer<typeof pinBody>) {
    const { memoryId } = await this.who(p, user);
    await this.read.pinNote(memoryId, id, body.pinned);
  }

  @Delete('notes/:id')
  @HttpCode(204)
  @RequireScopes('write')
  async deleteNote(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
    const { memoryId } = await this.who(p, user);
    await this.read.deleteRow(memoryId, 'notes', id);
  }

  @Post('notes/:id/confirm')
  @HttpCode(204)
  @RequireScopes('write')
  async confirmNote(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
    const { memoryId } = await this.who(p, user);
    await this.read.decide(memoryId, 'notes', id, true);
  }

  @Post('notes/:id/reject')
  @HttpCode(204)
  @RequireScopes('write')
  async rejectNote(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
    const { memoryId } = await this.who(p, user);
    await this.read.decide(memoryId, 'notes', id, false);
  }

  /** Who I am and who my contacts are (WORK_PLAN 8.13): current facts and notes, no LLM. */
  @Get('cards')
  @RequireScopes('read')
  @Returns(cardsResponse)
  async cards(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined) {
    const { memoryId } = await this.who(p, user);
    return this.read.cards(memoryId);
  }

  @Get('plans')
  @RequireScopes('read')
  @Returns(plansResponse)
  async plans(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Headers(NOW_HEADER) at: string | undefined,
    @Query(new ZodBody(plansQuery)) q: z.infer<typeof plansQuery>) {
    const { memoryId } = await this.who(p, user);
    return this.read.plans(memoryId, q, this.now(at));
  }

  @Get('settings')
  @RequireScopes('read')
  @Returns(settingsResponse)
  async getSettings(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined) {
    const { memoryId } = await this.who(p, user);
    return this.settings.get(memoryId);
  }

  @Patch('settings')
  @RequireScopes('memory_settings')
  @Returns(settingsResponse)
  async patchSettings(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined,
    @Body(new ZodBody(settingsBody)) body: z.infer<typeof settingsBody>) {
    const { memoryId } = await this.who(p, user);
    return this.settings.update(memoryId, body);
  }

  @Get('usage')
  @RequireScopes('read')
  @Returns(usageResponse)
  async usage(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Headers(NOW_HEADER) at: string | undefined,
    @Query(new ZodBody(usageQuery)) q: z.infer<typeof usageQuery>) {
    const { memoryId } = await this.who(p, user);
    return this.settings.usage(memoryId, q, this.now(at));
  }

  /** A full export, built in the background: poll `GET exports/{id}`, then download `GET exports/{id}/archive`. */
  @Post('exports')
  @HttpCode(202)
  @RequireScopes('export')
  @Returns(exportResponse)
  async startExport(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined) {
    const { memoryId, clientId } = await this.who(p, user);
    return this.exports.start(memoryId, clientId);
  }

  @Get('exports/:id')
  @RequireScopes('export')
  @Returns(exportResponse)
  async exportStatus(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
    const { memoryId } = await this.who(p, user);
    return this.exports.status(memoryId, id);
  }

  /** The archive: JSON, sent gzipped (`Content-Encoding: gzip`); 404 until the export is done. */
  @Get('exports/:id/archive')
  @RequireScopes('export')
  async exportArchive(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response) {
    const { memoryId } = await this.who(p, user);
    const archive = await this.exports.archive(memoryId, id);
    if (!archive) throw new NotFoundException();
    res.set({ 'Content-Type': 'application/json', 'Content-Encoding': 'gzip',
      'Content-Disposition': `attachment; filename="recordare-export-${id}.json"` });
    return new StreamableFile(archive);
  }
}

@Module({ controllers: [ReadController], providers: [ReadService, MemoryWriteService, SettingsService, ExportsService] })
export class ReadModule {}
