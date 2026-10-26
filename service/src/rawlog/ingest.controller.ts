// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { Body, Controller, Delete, ForbiddenException, Headers, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { CurrentPrincipal, RequireScopes } from '../auth/decorators';
import { MemoryResolver, USER_HEADER } from '../auth/memory-resolver.service';
import { type Principal } from '../auth/principal';
import { ZodBody } from '../common/zod-body.pipe';
import { Returns } from '../common/returns';
import { ingestResponse, roomResponse } from '../openapi/responses';
import { editMessageSchema, ingestSchema, type IngestRequest, type IngestResult, roomSchema, type RoomRequest, type RoomResult } from './ingest.schemas';
import { roomFor } from './room';
import { IngestService } from './ingest.service';

@Controller('api/v1/ingest')
@RequireScopes('ingest')
export class IngestController {
  constructor(private readonly ingestion: IngestService, private readonly memories: MemoryResolver) {}

  @Post('messages')
  @HttpCode(200)
  @Returns(ingestResponse)
  async messages(
    @CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined,
    @Body(new ZodBody(ingestSchema)) body: IngestRequest,
  ): Promise<IngestResult> {
    const { clientId, memoryId } = await this.scope(p, user);
    return this.ingestion.ingest(clientId, memoryId, body);
  }

  /**
   * A room transcript fanned out to the memories of the people present (WORK_PLAN 6.5 (4)): client keys only (a personal
   * token acts for one memory). Recipient by recipient, each idempotent: a failed request is safe to resend whole.
   */
  @Post('room')
  @HttpCode(200)
  @Returns(roomResponse)
  async room(@CurrentPrincipal() p: Principal, @Body(new ZodBody(roomSchema)) body: RoomRequest): Promise<RoomResult> {
    if (p.kind !== 'client') throw new ForbiddenException();
    const recipients: RoomResult['recipients'] = [];
    for (const user of new Set(body.recipients)) {
      const memoryId = await this.memories.resolve(p, user);
      recipients.push({ user, ...await this.ingestion.ingest(p.clientId, memoryId, roomFor(body, user)) });
    }
    return { recipients };
  }

  @Patch('conversations/:conv/messages/:msg')
  @HttpCode(204)
  async edit(
    @CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined,
    @Param('conv') conv: string, @Param('msg') msg: string, @Body(new ZodBody(editMessageSchema)) body: { content: string },
  ): Promise<void> {
    const { clientId, memoryId } = await this.scope(p, user, false);
    await this.ingestion.edit(clientId, memoryId, conv, msg, body.content);
  }

  @Delete('conversations/:conv/messages/:msg')
  @HttpCode(202)
  async deleteMessage(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Param('conv') conv: string, @Param('msg') msg: string): Promise<void> {
    const { clientId, memoryId } = await this.scope(p, user, false);
    await this.ingestion.deleteMessage(clientId, memoryId, conv, msg);
  }

  /** The conversation ended (client side: session closed, /new): extraction runs now instead of after the idle delay. */
  @Post('conversations/:conv/end')
  @HttpCode(202)
  async end(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Param('conv') conv: string): Promise<void> {
    const { clientId, memoryId } = await this.scope(p, user, false);
    await this.ingestion.end(clientId, memoryId, conv);
  }

  @Delete('conversations/:conv')
  @HttpCode(202)
  async deleteConversation(@CurrentPrincipal() p: Principal, @Headers(USER_HEADER) user: string | undefined, @Param('conv') conv: string): Promise<void> {
    const { clientId, memoryId } = await this.scope(p, user, false);
    await this.ingestion.deleteConversation(clientId, memoryId, conv);
  }

  /**
   * Ingest acts for a client: client keys name the memory; personal tokens ingest for their memory. Only new messages
   * provision a memory: editing, deleting or ending a conversation of a user without one is a 404, like an unknown
   * conversation (nothing to change), so a late deletion never brings an erased memory back as an empty one.
   */
  private async scope(p: Principal, user: string | undefined, provision = true): Promise<{ clientId: string; memoryId: string }> {
    if (p.kind === 'admin') throw new ForbiddenException();
    return { clientId: p.clientId, memoryId: await (provision ? this.memories.resolve(p, user) : this.memories.existing(p, user)) };
  }
}
