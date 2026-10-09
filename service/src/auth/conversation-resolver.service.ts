// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * The conversation a read or an MCP write happens in (`X-Recordare-Conversation` / `_meta.recordare.conversation`),
 * resolved against what Recordare has ingested — never asserted by the client or the LLM. It does not filter answers:
 * every answer uses the whole memory, whoever takes part in the conversation (D50; privacy / disclosure come later).
 * It serves evidence binding for MCP writes, the current turn excluded from chat excerpts and the recall log.
 */
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { type Principal } from './principal';

export const CONVERSATION_HEADER = 'x-recordare-conversation';

export interface ResolvedConversation {
  /** `conversation`: an ingested conversation of this client; `owner_direct`: a personal token without one; `none`. */
  source: 'conversation' | 'owner_direct' | 'none';
  conversationId?: string;
}

@Injectable()
export class ConversationResolver {
  constructor(private readonly db: DataSource) {}

  async resolve(principal: Principal, ownerId: string, conversationExternalId: string | undefined): Promise<ResolvedConversation> {
    if (principal.kind === 'admin') return { source: 'none' };
    // A personal token is the person: no conversation, or one not stored yet (a client asking before it ingests).
    const fallback: ResolvedConversation = { source: principal.kind === 'owner_token' ? 'owner_direct' : 'none' };
    if (!conversationExternalId) return fallback;
    const [conv] = await this.db.query(
      `SELECT id FROM conversations WHERE client_id = $1 AND owner_id = $2 AND external_id = $3 AND deleted_at IS NULL`,
      [principal.clientId, ownerId, conversationExternalId],
    );
    return conv ? { source: 'conversation', conversationId: conv.id } : fallback;
  }
}
