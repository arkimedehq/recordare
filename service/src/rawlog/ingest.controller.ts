// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { Body, Controller, Delete, ForbiddenException, Headers, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { CurrentPrincipal, RequireScopes } from '../auth/decorators';
import { MemoryResolver, USER_HEADER } from '../auth/memory-resolver.service';
import { type Principal } from '../auth/principal';
import { ZodBody } from '../common/zod-body.pipe';
import { editMessageSchema, ingestSchema, type IngestRequest, type IngestResult } from './ingest.schemas';
import { IngestService } from './ingest.service';

@Controller('api/v1/ingest')
@RequireScopes('ingest')
export class IngestController {
  constructor(private readonly ingestion: IngestService, private readonly memories: MemoryResolver) {}

  @Post('messages')
  @HttpCode(200)
  async messages(
    @CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined,
    @Body(new ZodBody(ingestSchema)) body: IngestRequest,
  ): Promise<IngestResult> {
    const { clientId, memoryId } = await this.scope(p, user);
    return this.ingestion.ingest(clientId, memoryId, body);
  }

  @Patch('conversations/:conv/messages/:msg')
  @HttpCode(204)
  async edit(
    @CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined,
    @Param('conv') conv: string, @Param('msg') msg: string, @Body(new ZodBody(editMessageSchema)) body: { content: string },
  ): Promise<void> {
    const { clientId, memoryId } = await this.scope(p, user);
    await this.ingestion.edit(clientId, memoryId, conv, msg, body.content);
  }

  @Delete('conversations/:conv/messages/:msg')
  @HttpCode(202)
  async deleteMessage(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Param('conv') conv: string, @Param('msg') msg: string): Promise<void> {
    const { clientId, memoryId } = await this.scope(p, user);
    await this.ingestion.deleteMessage(clientId, memoryId, conv, msg);
  }

  /** The conversation ended (client side: session closed, /new): extraction runs now instead of after the idle delay. */
  @Post('conversations/:conv/end')
  @HttpCode(202)
  async end(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Param('conv') conv: string): Promise<void> {
    const { clientId, memoryId } = await this.scope(p, user);
    await this.ingestion.end(clientId, memoryId, conv);
  }

  @Delete('conversations/:conv')
  @HttpCode(202)
  async deleteConversation(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Param('conv') conv: string): Promise<void> {
    const { clientId, memoryId } = await this.scope(p, user);
    await this.ingestion.deleteConversation(clientId, memoryId, conv);
  }

  /** Ingest acts for a client: client keys name the memory; personal tokens ingest for their memory. */
  private async scope(p: Principal, user: string | undefined): Promise<{ clientId: string; memoryId: string }> {
    if (p.kind === 'admin') throw new ForbiddenException();
    return { clientId: p.clientId, memoryId: await this.memories.resolve(p, user) };
  }
}
